// src/storage/manager.ts

import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import {
  initStorageContext,
  getProjectStoragePath,
  hasProjectStorage,
  getWorkspaceRoot
} from './context';

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

const STORAGE_DIR = path.join(os.homedir(), '.deepseek-harness');
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
 * 确保指定路径的存储目录存在
 */
function ensureDirFor(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
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

/**
 * 从指定路径读取存储（不存在则返回空）
 */
function readStorageAt(filePath: string): PromptStorage | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return normalizeStorage(JSON.parse(raw));
  } catch {
    console.warn(`[dsh-invoke] 存储文件损坏: ${filePath}`);
    return null;
  }
}

/**
 * 写入存储到指定路径
 */
function writeStorageAt(filePath: string, data: PromptStorage): void {
  ensureDirFor(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
 */
export function readProjectStorage(): PromptStorage | null {
  const projectPath = getProjectStoragePath();
  if (!projectPath) return null;
  return readStorageAt(projectPath);
}

/**
 * 写入项目级存储（无工作区则抛错）
 */
export function writeProjectStorage(data: PromptStorage): void {
  const projectPath = getProjectStoragePath();
  if (!projectPath) {
    throw new Error('当前未打开工作区，无法写入项目级存储');
  }
  writeStorageAt(projectPath, data);
}

// ============ 双层合并 ============

/**
 * 合并用户级与项目级存储
 * 项目级优先级更高，相同 ID 的提示词以项目级为准
 */
export function getMergedStorage(): {
  storage: PromptStorage;
  writable: 'user' | 'project' | 'both';
} {
  const userStorage = readStorage();
  const projectStorage = readProjectStorage();

  if (!projectStorage) {
    // 有工作区时写入目标是项目级（addPrompt 会在写入时自动创建），故为 both
    return { storage: userStorage, writable: hasProjectStorage() ? 'both' : 'user' };
  }

  // 合并分类：预置 + 用户自定义 + 项目自定义
  const customCategories = [
    ...new Set([
      ...userStorage.customCategories,
      ...projectStorage.customCategories
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
    writable: hasProjectStorage() ? 'both' : 'user'
  };
}

// ============ CRUD 操作 ============

/**
 * 获取所有提示词（合并用户级 + 项目级）
 */
export function getAllPrompts(): Prompt[] {
  return getMergedStorage().storage.prompts;
}

/**
 * 根据 ID 获取单个提示词（合并后查找）
 */
export function getPromptById(id: string): Prompt | null {
  return getAllPrompts().find(p => p.id === id) || null;
}

/**
 * 获取所有分类（预置 + 合并后的自定义分类）
 */
export function getAllCategories(): string[] {
  const { storage } = getMergedStorage();
  return [...storage.categories, ...storage.customCategories];
}

/**
 * 判断提示词 ID 是否已存在（合并视图）
 */
function promptExistsInAny(id: string): boolean {
  return getAllPrompts().some(p => p.id === id);
}

/**
 * 判断提示词在用户级/项目级中的存在情况
 */
function locatePrompt(id: string): { inUser: boolean; inProject: boolean } {
  const user = readStorage();
  const project = readProjectStorage();
  return {
    inUser: user.prompts.some(p => p.id === id),
    inProject: project ? project.prompts.some(p => p.id === id) : false
  };
}

/**
 * 添加新提示词
 * 优先写入项目级（若已打开工作区），否则写入用户级
 */
export function addPrompt(prompt: Omit<Prompt, 'builtin' | 'usageCount' | 'createdAt' | 'updatedAt'>): Prompt {
  if (promptExistsInAny(prompt.id)) {
    throw new Error(`提示词 ID "${prompt.id}" 已存在`);
  }

  const newPrompt: Prompt = {
    ...prompt,
    builtin: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (hasProjectStorage()) {
    const project = readProjectStorage() ?? getDefaultStorage();
    project.prompts.push(newPrompt);
    writeProjectStorage(project);
  } else {
    const user = readStorage();
    user.prompts.push(newPrompt);
    writeStorage(user);
  }
  return newPrompt;
}

/**
 * 更新提示词
 * 更新所在层级的记录（若项目级有则更新项目级，否则更新用户级）
 */
export function updatePrompt(id: string, updates: Partial<Omit<Prompt, 'id' | 'builtin' | 'createdAt'>>): Prompt | null {
  const { inUser, inProject } = locatePrompt(id);
  if (!inUser && !inProject) {
    return null;
  }

  const applyUpdates = (p: Prompt): Prompt => ({
    ...p,
    ...updates,
    updatedAt: new Date().toISOString()
  });

  if (inProject && hasProjectStorage()) {
    const project = readProjectStorage()!;
    const idx = project.prompts.findIndex(p => p.id === id);
    project.prompts[idx] = applyUpdates(project.prompts[idx]);
    writeProjectStorage(project);
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
 * 从所在层级删除（若两层都存在则同时删除）
 */
export function deletePrompt(id: string): boolean {
  const { inUser, inProject } = locatePrompt(id);
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

  if (inProject && hasProjectStorage()) {
    const project = readProjectStorage()!;
    project.prompts = project.prompts.filter(p => p.id !== id);
    writeProjectStorage(project);
    deleted = true;
  }

  return deleted;
}

/**
 * 增加使用次数
 * 同时记录最近使用时间（lastUsedAt），供智能排序使用
 */
export function incrementUsage(id: string): void {
  const { inUser, inProject } = locatePrompt(id);

  if (inProject && hasProjectStorage()) {
    const project = readProjectStorage()!;
    const prompt = project.prompts.find(p => p.id === id);
    if (prompt) {
      prompt.usageCount = (prompt.usageCount || 0) + 1;
      prompt.lastUsedAt = new Date().toISOString();
      prompt.updatedAt = new Date().toISOString();
      writeProjectStorage(project);
      return;
    }
  }

  if (inUser) {
    const user = readStorage();
    const prompt = user.prompts.find(p => p.id === id);
    if (prompt) {
      prompt.usageCount = (prompt.usageCount || 0) + 1;
      prompt.lastUsedAt = new Date().toISOString();
      prompt.updatedAt = new Date().toISOString();
      writeStorage(user);
    }
  }
}

/**
 * 添加自定义分类
 * 优先写入项目级，否则写入用户级
 */
export function addCustomCategory(name: string): void {
  const { storage } = getMergedStorage();
  if (storage.customCategories.includes(name)) {
    return;
  }

  if (hasProjectStorage()) {
    const project = readProjectStorage() ?? getDefaultStorage();
    if (!project.customCategories.includes(name)) {
      project.customCategories.push(name);
      writeProjectStorage(project);
    }
  } else {
    const user = readStorage();
    if (!user.customCategories.includes(name)) {
      user.customCategories.push(name);
      writeStorage(user);
    }
  }
}

/**
 * 删除自定义分类
 * 从所有层级中移除
 */
export function removeCustomCategory(name: string): void {
  const user = readStorage();
  user.customCategories = user.customCategories.filter(c => c !== name);
  writeStorage(user);

  if (hasProjectStorage()) {
    const project = readProjectStorage();
    if (project) {
      project.customCategories = project.customCategories.filter(c => c !== name);
      writeProjectStorage(project);
    }
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
 */
export function getSortedPrompts(mode: PromptSortMode = 'smart'): Prompt[] {
  const prompts = getAllPrompts();
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

