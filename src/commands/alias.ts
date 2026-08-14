// src/commands/alias.ts
// 别名管理与 DSH 命令注册

import { Context } from '@deepseek-ai/cordis';
import type { CommandResult } from '@deepseek-ai/dsh-commands';
import * as fs from 'fs';
import * as path from 'path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { getPromptById, incrementUsage } from '../storage/manager.js';
import { extractVariablesFromBody } from '../engine/template.js';

// 导入 @deepseek-ai/dsh-commands 以激活其 declare module 类型增强，
// 使 ctx.commands 在 Context 上可见（仅类型导入，无运行时副作用）。

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

const ALIASES_DIR = dshHomePath();
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

  // 冲突检测 2：与内置命令冲突
  const RESERVED = ['prompt', 'prompt-list', 'alias', 'help', 'clear', 'exit'];
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
  if (typeof ctx.commands?.register !== 'function') {
    console.warn('[dsh-invoke] ⚠️ ctx.commands 不可用，跳过别名命令注册');
    return;
  }

  // /alias - 列出所有别名
  ctx.commands.register({
    name: 'alias',
    description: '列出所有已注册的 Prompt 别名',
    handler: () => {
      const aliases = getAllAliases();
      if (aliases.length === 0) {
        return { kind: 'success' as const, text: '🔗 暂无别名，请通过 UI 面板添加' };
      }
      const lines = aliases.map(a => {
        const prompt = getPromptById(a.promptId);
        const title = prompt ? prompt.title : '（提示词已删除）';
        return `  /${a.alias} → ${title}`;
      });
      return { kind: 'success' as const, text: `🔗 别名列表（共 ${aliases.length} 个）\n\n${lines.join('\n')}` };
    },
  });

  console.log('[dsh-invoke] ✅ alias 命令注册完成');
}