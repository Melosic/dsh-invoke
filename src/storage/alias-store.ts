// src/storage/alias-store.ts
// 别名存储层：别名 CRUD 与冲突检测。
// 独立成模块（不依赖 manager.ts），供 storage/manager.ts（级联删除）、
// commands/alias.ts（命令注册）、host/routes.ts（HTTP API）三方共用，
// 避免循环依赖。"提示词是否存在" 的校验由调用方完成（routes 层）。

import * as fs from 'fs';
import * as path from 'path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import { writeJsonAtomic } from './safe-write.js';

// ============ 类型定义 ============

export interface AliasEntry {
  /** 别名（不含开头的 /，小写） */
  alias: string;
  /** 关联的提示词 ID */
  promptId: string;
  /** 创建别名时提示词所在的工作目录（项目级存储定位用；旧数据可能缺失） */
  promptCwd?: string;
  /** 创建时间 */
  createdAt: string;
}

interface AliasStore {
  version: number;
  aliases: AliasEntry[];
}

// ============ 校验常量 ============

/** 与本插件及 Harness 内置命令冲突的保留名 */
export const RESERVED_ALIAS_NAMES = ['prompt', 'prompt-list', 'alias', 'help', 'clear', 'exit'];

/** 别名合法格式：小写字母/数字/连字符，字母或数字开头 */
const ALIAS_NAME_PATTERN = /^[a-z0-9][a-z0-9-]*$/;

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

/** 尝试解析别名存储；损坏返回 null */
function tryParseAliases(file: string): AliasStore | null {
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf-8')) as AliasStore;
    if (!Array.isArray(data.aliases)) data.aliases = [];
    return data;
  } catch {
    return null;
  }
}

function readAliases(): AliasStore {
  ensureAliasFile();
  const parsed = tryParseAliases(ALIASES_FILE);
  if (parsed) return parsed;
  // 主文件损坏：回退 .bak 备份，避免下次写入把唯一可恢复的副本冲掉
  console.warn(`[dsh-invoke] 别名存储损坏: ${ALIASES_FILE}，尝试 .bak 备份回退`);
  return tryParseAliases(`${ALIASES_FILE}.bak`) ?? { version: 1, aliases: [] };
}

function writeAliases(store: AliasStore): void {
  ensureAliasFile();
  writeJsonAtomic(ALIASES_FILE, store);
}

// ============ 别名 CRUD ============

/** 规范化别名输入：去空白、去掉开头 /、转小写 */
export function normalizeAliasInput(alias: string): string {
  return alias.trim().replace(/^\//, '').toLowerCase();
}

export function getAllAliases(): AliasEntry[] {
  return readAliases().aliases;
}

export function getAlias(alias: string): AliasEntry | null {
  const normalized = normalizeAliasInput(alias);
  return readAliases().aliases.find(a => a.alias === normalized) || null;
}

export function getAliasByPromptId(promptId: string): AliasEntry | null {
  return readAliases().aliases.find(a => a.promptId === promptId) || null;
}

/**
 * 校验别名是否可用（非空、格式合法、不与保留命令/已有别名冲突）
 * @returns 错误信息；null 表示可用
 */
export function validateAliasName(alias: string): string | null {
  const normalized = normalizeAliasInput(alias);
  if (!normalized) return '别名不能为空';
  if (!ALIAS_NAME_PATTERN.test(normalized)) {
    return '别名只能包含小写字母、数字和连字符，且以字母或数字开头';
  }
  if (RESERVED_ALIAS_NAMES.includes(normalized)) {
    return `别名「/${normalized}」与系统保留命令冲突，请换一个`;
  }
  if (getAlias(normalized)) {
    return `别名「/${normalized}」已被使用，请换一个`;
  }
  return null;
}

/**
 * 添加别名（调用方需自行校验 promptId 存在）
 * @param promptCwd 创建时解析到该提示词的工作目录（跨工作区调用时用于回定位）
 * @throws Error 当别名格式非法或冲突时
 */
export function addAlias(alias: string, promptId: string, promptCwd?: string): AliasEntry {
  const error = validateAliasName(alias);
  if (error) throw new Error(error);

  const store = readAliases();
  const entry: AliasEntry = {
    alias: normalizeAliasInput(alias),
    promptId,
    ...(promptCwd?.trim() ? { promptCwd: promptCwd.trim() } : {}),
    createdAt: new Date().toISOString()
  };
  store.aliases.push(entry);
  writeAliases(store);
  return entry;
}

/** 删除别名 */
export function removeAlias(alias: string): boolean {
  const store = readAliases();
  const normalized = normalizeAliasInput(alias);
  const index = store.aliases.findIndex(a => a.alias === normalized);
  if (index === -1) return false;
  store.aliases.splice(index, 1);
  writeAliases(store);
  return true;
}

/** 删除提示词时级联删除其别名，返回是否发生了变更 */
export function removeAliasesByPromptId(promptId: string): boolean {
  const store = readAliases();
  const before = store.aliases.length;
  store.aliases = store.aliases.filter(a => a.promptId !== promptId);
  if (store.aliases.length === before) return false;
  writeAliases(store);
  return true;
}
