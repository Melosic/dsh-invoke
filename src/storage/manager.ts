// src/storage/manager.ts

import * as fs from 'fs';
import * as path from 'path';
import { dshHomePath } from '@deepseek-ai/dsh-home-paths';
import {
  resolveStorageContext
} from './context.js';
import { writeJsonAtomic } from './safe-write.js';
import { removeAliasesByPromptId } from './alias-store.js';

// ============ 类型定义 ============

export interface Variable {
  name: string;
  type: 'text' | 'textarea';
  placeholder?: string;
  required?: boolean;
}

export interface Prompt {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  body: string;
  variables: Variable[];
  builtin: boolean;          // true 为内置示例，false 为用户自定义
  usageCount: number;
  /** 最近使用时间（ISO 字符串），供智能排序使用 */
  lastUsedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PromptStorage {
  version: number;
  categories: string[];           // 系统预置分类（只读参考）
  customCategories: string[];     // 用户自定义分类
  prompts: Prompt[];
}

// ============ 默认数据 ============

const DEFAULT_CATEGORIES = ['开发', '测试', '文档', '效率'];

const BUILTIN_EXAMPLE: Prompt = {
  id: 'code-review',
  title: '代码审查',
  description: '审查代码中的潜在问题，包括逻辑错误、安全漏洞、性能问题',
  category: '开发',
  tags: ['review', 'quality', 'security'],
  body: '请审查以下代码，重点关注：\n1. 逻辑错误\n2. 安全漏洞\n3. 性能问题\n\n代码：\n{{code}}',
  variables: [
    { name: 'code', type: 'text', placeholder: '请粘贴要审查的代码...', required: true }
  ],
  builtin: true,
  usageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

function getDefaultStorage(): PromptStorage {
  return {
    version: 1,
    categories: DEFAULT_CATEGORIES,
    customCategories: [],
    prompts: [BUILTIN_EXAMPLE]
  };
}

// ============ 文件操作 ============

const STORAGE_DIR = dshHomePath();
const STORAGE_FILE = path.join(STORAGE_DIR, 'prompts.user.json');

/**
 * 确保用户级存储目录和文件存在
 */
function ensureStorageFile(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
  if (!fs.existsSync(STORAGE_FILE)) {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(getDefaultStorage(), null, 2), 'utf-8');
  }
}

/**
 * 规范化存储数据结构（补齐默认字段）
 */
function normalizeStorage(data: Partial<PromptStorage>): PromptStorage {
  const result: PromptStorage = {
    version: data.version ?? 1,
    categories: data.categories && data.categories.length ? data.categories : DEFAULT_CATEGORIES,
    customCategories: data.customCategories ?? [],
    prompts: data.prompts ?? []
  };
  return result;
}

/** 尝试解析存储文件；损坏/不存在返回 null */
function tryParseStorageAt(filePath: string): PromptStorage | null {
  try {
    return normalizeStorage(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
  } catch {
    return null;
  }
}

// ============ 读缓存 ============
// 每次 API 调用全量读盘 + JSON.parse 两个文件，提示词过千后成为热点。
// 以「路径 → { mtimeMs, 数据 }」缓存：mtime 未变直接复用解析结果；
// 本进程写入时同步更新缓存（写穿透），外部修改（mtime 变化）自动失效。
// 注意：缓存返回的是共享引用，调用方沿用「读 → 改 → 写回」模式即可保持一致，
// 但不得在不写回的前提下就地修改缓存对象。

interface CacheEntry {
  mtimeMs: number;
  data: PromptStorage;
}
const storageCache = new Map<string, CacheEntry>();

/** 读取文件 mtime；失败（不存在等）返回 null */
function mtimeOf(filePath: string): number | null {
  try {
    return fs.statSync(filePath).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * 从指定路径读取存储（不存在则返回空）
 * 主文件损坏时回退 .bak 备份，避免下次写入把唯一可恢复的副本冲掉
 */
function readStorageAt(filePath: string): PromptStorage | null {
  const mtimeMs = mtimeOf(filePath);
  if (mtimeMs === null) {
    storageCache.delete(filePath);
    return null;
  }
  const cached = storageCache.get(filePath);
  if (cached && cached.mtimeMs === mtimeMs) {
    return cached.data;
  }
  const parsed = tryParseStorageAt(filePath);
  if (parsed) {
    storageCache.set(filePath, { mtimeMs, data: parsed });
    return parsed;
  }
  console.warn(`[dsh-invoke] 存储文件损坏: ${filePath}，尝试 .bak 备份回退`);
  return tryParseStorageAt(`${filePath}.bak`); // 损坏回退属罕见路径，不入缓存
}

/**
 * 写入存储到指定路径（原子写入 + .bak 备份，见 safe-write.ts）
 */
function writeStorageAt(filePath: string, data: PromptStorage): void {
  writeJsonAtomic(filePath, data);
  // 写穿透：同步缓存，避免下一次读重复解析
  const mtimeMs = mtimeOf(filePath);
  if (mtimeMs === null) {
    storageCache.delete(filePath);
  } else {
    storageCache.set(filePath, { mtimeMs, data });
  }
}

/**
 * 读取用户级存储
 */
export function readStorage(): PromptStorage {
  ensureStorageFile();
  return readStorageAt(STORAGE_FILE) ?? getDefaultStorage();
}

/**
 * 写入用户级存储
 */
export function writeStorage(data: PromptStorage): void {
  ensureStorageFile();
  writeStorageAt(STORAGE_FILE, data);
}

/**
 * 读取项目级存储（无工作区则返回 null）
 * @param cwd 显式工作目录（如 agent.session.header.cwd）；缺省用全局初始化值
 */
export function readProjectStorage(cwd?: string | null): PromptStorage | null {
  const { projectStoragePath } = resolveStorageContext(cwd);
  if (!projectStoragePath) return null;
  return readStorageAt(projectStoragePath);
}

/**
 * 写入项目级存储（无工作区则抛错）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function writeProjectStorage(data: PromptStorage, cwd?: string | null): void {
  const { projectStoragePath } = resolveStorageContext(cwd);
  if (!projectStoragePath) {
    throw new Error('当前未打开工作区，无法写入项目级存储');
  }
  writeStorageAt(projectStoragePath, data);
}

// ============ 双层合并 ============

/**
 * 合并用户级与项目级存储
 * 项目级优先级更高，相同 ID 的提示词以项目级为准
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function getMergedStorage(cwd?: string | null): {
  storage: PromptStorage;
  writable: 'user' | 'project' | 'both';
  /** 本次合并实际使用的项目级存储路径（无工作区为 null） */
  projectStoragePath: string | null;
} {
  const userStorage = readStorage();
  const { projectStoragePath } = resolveStorageContext(cwd);
  const projectStorage = projectStoragePath ? readStorageAt(projectStoragePath) : null;

  if (!projectStorage) {
    // 有工作区时写入目标是项目级（addPrompt 会在写入时自动创建），故为 both
    return {
      storage: userStorage,
      writable: projectStoragePath ? 'both' : 'user',
      projectStoragePath
    };
  }

  // 合并分类：预置 + 用户自定义 + 项目自定义 + 两层存储中出现的非预置分类
  const extraCategories = [...userStorage.categories, ...projectStorage.categories]
    .filter(c => !DEFAULT_CATEGORIES.includes(c));
  const customCategories = [
    ...new Set([
      ...userStorage.customCategories,
      ...projectStorage.customCategories,
      ...extraCategories
    ])
  ];

  // 合并提示词：以项目级为准
  const mergedPrompts = new Map<string, Prompt>();
  userStorage.prompts.forEach(p => mergedPrompts.set(p.id, p));
  projectStorage.prompts.forEach(p => mergedPrompts.set(p.id, p)); // 覆盖同 ID

  return {
    storage: {
      version: Math.max(userStorage.version, projectStorage.version),
      categories: [...DEFAULT_CATEGORIES],
      customCategories,
      prompts: [...mergedPrompts.values()]
    },
    writable: projectStoragePath ? 'both' : 'user',
    projectStoragePath
  };
}

// ============ 写入层级策略 ============

/**
 * 获取当前写入目标层级的存储（与 addPrompt 策略一致）：
 * 有工作区 → 项目级（不存在则以默认结构起步）；无工作区 → 用户级
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function getActiveLayerStorage(cwd?: string | null): PromptStorage {
  const { projectStoragePath } = resolveStorageContext(cwd);
  if (projectStoragePath) {
    return readStorageAt(projectStoragePath) ?? getDefaultStorage();
  }
  return readStorage();
}

/** 写入当前活跃层级（与 getActiveLayerStorage 对应） */
export function writeToActiveLayer(data: PromptStorage, cwd?: string | null): void {
  const { projectStoragePath } = resolveStorageContext(cwd);
  if (projectStoragePath) {
    writeStorageAt(projectStoragePath, data);
  } else {
    writeStorage(data);
  }
}

// ============ CRUD 操作 ============

/**
 * 获取所有提示词（合并用户级 + 项目级）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function getAllPrompts(cwd?: string | null): Prompt[] {
  return getMergedStorage(cwd).storage.prompts;
}

/**
 * 根据 ID 获取单个提示词（合并后查找）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function getPromptById(id: string, cwd?: string | null): Prompt | null {
  return getAllPrompts(cwd).find(p => p.id === id) || null;
}

/**
 * 获取所有分类（预置 + 合并后的自定义分类）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function getAllCategories(cwd?: string | null): string[] {
  const { storage } = getMergedStorage(cwd);
  return [...storage.categories, ...storage.customCategories];
}

/**
 * 判断提示词 ID 是否已存在（合并视图）
 */
function promptExistsInAny(id: string, cwd?: string | null): boolean {
  return getAllPrompts(cwd).some(p => p.id === id);
}

/**
 * 判断提示词在用户级/项目级中的存在情况
 */
function locatePrompt(id: string, cwd?: string | null): { inUser: boolean; inProject: boolean } {
  const user = readStorage();
  const project = readProjectStorage(cwd);
  return {
    inUser: user.prompts.some(p => p.id === id),
    inProject: project ? project.prompts.some(p => p.id === id) : false
  };
}

/**
 * 添加新提示词
 * 优先写入项目级（若已打开工作区），否则写入用户级
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function addPrompt(
  prompt: Omit<Prompt, 'builtin' | 'usageCount' | 'createdAt' | 'updatedAt'>,
  cwd?: string | null
): Prompt {
  if (promptExistsInAny(prompt.id, cwd)) {
    throw new Error(`提示词 ID "${prompt.id}" 已存在`);
  }

  const newPrompt: Prompt = {
    ...prompt,
    builtin: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const storage = getActiveLayerStorage(cwd);
  storage.prompts.push(newPrompt);
  writeToActiveLayer(storage, cwd);
  return newPrompt;
}

/**
 * 更新提示词
 * 更新所在层级的记录（若项目级有则更新项目级，否则更新用户级）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function updatePrompt(
  id: string,
  updates: Partial<Omit<Prompt, 'id' | 'builtin' | 'createdAt'>>,
  cwd?: string | null
): Prompt | null {
  const { inUser, inProject } = locatePrompt(id, cwd);
  if (!inUser && !inProject) {
    return null;
  }

  const applyUpdates = (p: Prompt): Prompt => ({
    ...p,
    ...updates,
    updatedAt: new Date().toISOString()
  });

  if (inProject) {
    const project = readProjectStorage(cwd)!;
    const idx = project.prompts.findIndex(p => p.id === id);
    project.prompts[idx] = applyUpdates(project.prompts[idx]);
    writeProjectStorage(project, cwd);
    return project.prompts[idx];
  }

  const user = readStorage();
  const idx = user.prompts.findIndex(p => p.id === id);
  user.prompts[idx] = applyUpdates(user.prompts[idx]);
  writeStorage(user);
  return user.prompts[idx];
}

/**
 * 删除提示词
 * 从所在层级删除（若两层都存在则同时删除），并级联删除其别名
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function deletePrompt(id: string, cwd?: string | null): boolean {
  const { inUser, inProject } = locatePrompt(id, cwd);
  if (!inUser && !inProject) {
    return false;
  }

  let deleted = false;

  if (inUser) {
    const user = readStorage();
    user.prompts = user.prompts.filter(p => p.id !== id);
    writeStorage(user);
    deleted = true;
  }

  if (inProject) {
    const project = readProjectStorage(cwd)!;
    project.prompts = project.prompts.filter(p => p.id !== id);
    writeProjectStorage(project, cwd);
    deleted = true;
  }

  // 级联删除别名（避免留下指向不存在提示词的悬空别名）
  if (deleted) {
    removeAliasesByPromptId(id);
  }

  return deleted;
}

/**
 * 增加使用次数
 * 同时记录最近使用时间（lastUsedAt），供智能排序使用。
 * 提示词可能同时存在于两层，两层副本都更新以保持计数一致。
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function incrementUsage(id: string, cwd?: string | null): void {
  const { inUser, inProject } = locatePrompt(id, cwd);
  const now = new Date().toISOString();

  if (inProject) {
    const project = readProjectStorage(cwd)!;
    const prompt = project.prompts.find(p => p.id === id);
    if (prompt) {
      prompt.usageCount = (prompt.usageCount || 0) + 1;
      prompt.lastUsedAt = now;
      prompt.updatedAt = now;
      writeProjectStorage(project, cwd);
    }
  }

  if (inUser) {
    const user = readStorage();
    const prompt = user.prompts.find(p => p.id === id);
    if (prompt) {
      prompt.usageCount = (prompt.usageCount || 0) + 1;
      prompt.lastUsedAt = now;
      prompt.updatedAt = now;
      writeStorage(user);
    }
  }
}

/**
 * 添加自定义分类
 * 优先写入项目级，否则写入用户级
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function addCustomCategory(name: string, cwd?: string | null): void {
  const { storage } = getMergedStorage(cwd);
  if (storage.customCategories.includes(name)) {
    return;
  }

  const target = getActiveLayerStorage(cwd);
  if (!target.customCategories.includes(name)) {
    target.customCategories.push(name);
    writeToActiveLayer(target, cwd);
  }
}

/**
 * 删除自定义分类
 * 从所有层级中移除
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function removeCustomCategory(name: string, cwd?: string | null): void {
  const user = readStorage();
  user.customCategories = user.customCategories.filter(c => c !== name);
  writeStorage(user);

  const project = readProjectStorage(cwd);
  if (project) {
    project.customCategories = project.customCategories.filter(c => c !== name);
    writeProjectStorage(project, cwd);
  }
}

// ============ 智能排序 ============

export type PromptSortMode = 'smart' | 'name' | 'created' | 'usage';

/**
 * 计算提示词的综合得分（用于智能排序）
 * 得分 = 使用次数权重 + 最近使用时间衰减
 */
export function computeSmartScore(prompt: Prompt, now: number = Date.now()): number {
  const usageScore = (prompt.usageCount || 0) * 10;

  let recencyScore = 0;
  if (prompt.lastUsedAt) {
    const lastUsed = new Date(prompt.lastUsedAt).getTime();
    const hoursAgo = (now - lastUsed) / 3600000;
    if (hoursAgo >= 0) {
      recencyScore = 50 * Math.exp(-hoursAgo / 48);
    }
  }

  return usageScore + recencyScore;
}

/**
 * 获取按指定模式排序的提示词列表
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function getSortedPrompts(mode: PromptSortMode = 'smart', cwd?: string | null): Prompt[] {
  const prompts = getAllPrompts(cwd);
  const now = Date.now();

  switch (mode) {
    case 'name':
      return [...prompts].sort((a, b) => a.title.localeCompare(b.title, 'zh'));
    case 'created':
      return [...prompts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    case 'usage':
      return [...prompts].sort(
        (a, b) => (b.usageCount || 0) - (a.usageCount || 0)
      );
    case 'smart':
    default:
      return [...prompts].sort(
        (a, b) => computeSmartScore(b, now) - computeSmartScore(a, now)
      );
  }
}

