// src/commands/alias.ts
// 别名管理与冲突检测
// 职责：
//   1. 别名的持久化存储（~/.deepseek-harness/aliases.json）
//   2. 别名冲突检测（与已注册命令、其他别名冲突）
//   3. 别名的增删改查命令注册

import { Context } from '@deepseek-ai/dsh';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import { getPromptById, incrementUsage } from '../storage/manager';
import { extractVariablesFromBody } from '../engine/template';
import { copyToClipboard } from './clipboard';

// ============ 类型定义 ============

export interface AliasEntry {
  /** 别名（不含开头的 /） */
  alias: string;
  /** 关联的提示词 ID */
  promptId: string;
  /** 创建时间 */
  createdAt: string;
}

interface AliasStore {
  version: number;
  aliases: AliasEntry[];
}

// ============ 存储 ============

const ALIASES_DIR = path.join(os.homedir(), '.deepseek-harness');
const ALIASES_FILE = path.join(ALIASES_DIR, 'aliases.json');

function ensureAliasFile(): void {
  if (!fs.existsSync(ALIASES_DIR)) {
    fs.mkdirSync(ALIASES_DIR, { recursive: true });
  }
  if (!fs.existsSync(ALIASES_FILE)) {
    fs.writeFileSync(ALIASES_FILE, JSON.stringify({ version: 1, aliases: [] }, null, 2), 'utf-8');
  }
}

function readAliases(): AliasStore {
  ensureAliasFile();
  try {
    const raw = fs.readFileSync(ALIASES_FILE, 'utf-8');
    const data = JSON.parse(raw) as AliasStore;
    if (!data.aliases) data.aliases = [];
    return data;
  } catch {
    return { version: 1, aliases: [] };
  }
}

function writeAliases(store: AliasStore): void {
  ensureAliasFile();
  fs.writeFileSync(ALIASES_FILE, JSON.stringify(store, null, 2), 'utf-8');
}

// ============ 别名 CRUD ============

export function getAllAliases(): AliasEntry[] {
  return readAliases().aliases;
}

export function getAlias(alias: string): AliasEntry | null {
  return readAliases().aliases.find(a => a.alias === alias) || null;
}

export function getAliasByPromptId(promptId: string): AliasEntry | null {
  return readAliases().aliases.find(a => a.promptId === promptId) || null;
}

/**
 * 添加别名，带冲突检测
 * @throws Error 当别名冲突或提示词不存在时
 */
export function addAlias(alias: string, promptId: string): AliasEntry {
  const normalized = alias.trim().replace(/^\//, '').toLowerCase();
  if (!normalized) {
    throw new Error('别名不能为空');
  }

  const prompt = getPromptById(promptId);
  if (!prompt) {
    throw new Error(`提示词 ID「${promptId}」不存在`);
  }

  const store = readAliases();

  // 冲突检测 1：与其他别名冲突
  const existing = store.aliases.find(a => a.alias === normalized);
  if (existing) {
    throw new Error(
      `别名「/${normalized}」已被使用（指向提示词「${getPromptById(existing.promptId)?.title ?? existing.promptId}」）`
    );
  }

  // 冲突检测 2：与内置 prompt 命令冲突
  const RESERVED = ['prompt', 'help', 'clear', 'exit'];
  if (RESERVED.includes(normalized)) {
    throw new Error(`别名「/${normalized}」与系统保留命令冲突，请换一个`);
  }

  const entry: AliasEntry = {
    alias: normalized,
    promptId,
    createdAt: new Date().toISOString()
  };

  store.aliases.push(entry);
  writeAliases(store);
  return entry;
}

/**
 * 删除别名
 */
export function removeAlias(alias: string): boolean {
  const store = readAliases();
  const normalized = alias.trim().replace(/^\//, '').toLowerCase();
  const index = store.aliases.findIndex(a => a.alias === normalized);
  if (index === -1) return false;
  store.aliases.splice(index, 1);
  writeAliases(store);
  return true;
}

/**
 * 删除提示词时级联删除其别名
 */
export function removeAliasesByPromptId(promptId: string): void {
  const store = readAliases();
  const before = store.aliases.length;
  store.aliases = store.aliases.filter(a => a.promptId !== promptId);
  if (store.aliases.length !== before) {
    writeAliases(store);
  }
}

// ============ 命令注册 ============

export function registerAliasCommands(ctx: Context): void {
  const aliasCmd = ctx.command('alias', 'Prompt 短别名管理（键盘流快捷调用）');

  // alias list
  aliasCmd
    .subcommand('list', '列出所有别名')
    .action(async () => {
      const aliases = getAllAliases();
      console.log(`\n🔗 所有别名（共 ${aliases.length} 个）：\n`);
      if (aliases.length === 0) {
        console.log('  暂无别名，使用 /alias set <别名> <提示词ID> 添加');
        return;
      }
      aliases.forEach(a => {
        const prompt = getPromptById(a.promptId);
        const title = prompt ? prompt.title : '（提示词已删除）';
        console.log(`  /${a.alias} -> ${title} [${a.promptId}]`);
      });
      console.log('');
    });

  // alias set（新增/覆盖）
  aliasCmd
    .subcommand('set <alias> <id>', '设置别名：/alias set <别名> <提示词ID>')
    .action(async (args: { alias: string; id: string }) => {
      try {
        const entry = addAlias(args.alias, args.id);
        console.log(`✅ 已设置别名: /${entry.alias} -> ${getPromptById(entry.promptId)?.title ?? ''}`);
        console.log(`   现在可以直接输入 /${entry.alias} 快捷调用`);
      } catch (error) {
        console.log(`❌ ${error instanceof Error ? error.message : '设置失败'}`);
      }
    });

  // alias remove
  aliasCmd
    .subcommand('remove <alias>', '删除别名')
    .action(async (args: { alias: string }) => {
      const success = removeAlias(args.alias);
      if (success) {
        console.log(`✅ 已删除别名: /${args.alias.replace(/^\//, '')}`);
      } else {
        console.log(`❌ 未找到别名: /${args.alias.replace(/^\//, '')}`);
      }
    });

  // 注册所有已持久化的别名命令
  registerPersistedAliases(ctx);
}

/**
 * 注册所有已保存的别名命令
 */
export function registerPersistedAliases(ctx: Context): void {
  const aliases = getAllAliases();
  aliases.forEach(a => {
    registerAliasCommand(ctx, a);
  });
}

/**
 * 注册单个别名命令
 */
function registerAliasCommand(ctx: Context, entry: AliasEntry): void {
  const prompt = getPromptById(entry.promptId);
  if (!prompt) {
    console.warn(`[dsh-invoke] ⚠️ 别名 /${entry.alias} 指向的提示词已不存在，跳过注册`);
    return;
  }

  const aliasCmd = ctx.command(entry.alias, `快捷调用: ${prompt.title}`);
  aliasCmd.action(async () => {
    console.log(`📋 调用提示词: ${prompt.title}`);
    const varNames = extractVariablesFromBody(prompt.body);
    if (varNames.length === 0) {
      await copyToClipboard(prompt.body);
      incrementUsage(prompt.id);
      console.log('✅ 已复制到剪贴板，请粘贴使用');
    } else {
      console.log(`⚠️ 提示词「${prompt.title}」包含变量 (${varNames.join(', ')})，`);
      console.log(`   请使用 /prompt use ${prompt.id} 交互式填写变量`);
    }
  });
}

