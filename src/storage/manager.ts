// src/storage/manager.ts

import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

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
 * 确保存储目录和文件存在
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
 * 读取存储文件
 */
export function readStorage(): PromptStorage {
  ensureStorageFile();
  try {
    const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
    const data = JSON.parse(raw) as PromptStorage;
    // 确保 version 字段存在
    if (!data.version) data.version = 1;
    if (!data.categories) data.categories = DEFAULT_CATEGORIES;
    if (!data.customCategories) data.customCategories = [];
    if (!data.prompts) data.prompts = [];
    return data;
  } catch (error) {
    // 文件损坏时重建
    console.warn('[dsh-invoke] 存储文件损坏，重新创建默认配置');
    return getDefaultStorage();
  }
}

/**
 * 写入存储文件
 */
export function writeStorage(data: PromptStorage): void {
  ensureStorageFile();
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ============ CRUD 操作 ============

/**
 * 获取所有提示词（含内置示例）
 */
export function getAllPrompts(): Prompt[] {
  const storage = readStorage();
  return storage.prompts;
}

/**
 * 根据 ID 获取单个提示词
 */
export function getPromptById(id: string): Prompt | null {
  const storage = readStorage();
  return storage.prompts.find(p => p.id === id) || null;
}

/**
 * 添加新提示词（用户自定义）
 */
export function addPrompt(prompt: Omit<Prompt, 'builtin' | 'usageCount' | 'createdAt' | 'updatedAt'>): Prompt {
  const storage = readStorage();

  // 检查 ID 是否已存在
  if (storage.prompts.some(p => p.id === prompt.id)) {
    throw new Error(`提示词 ID "${prompt.id}" 已存在`);
  }

  const newPrompt: Prompt = {
    ...prompt,
    builtin: false,
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  storage.prompts.push(newPrompt);
  writeStorage(storage);
  return newPrompt;
}

/**
 * 更新提示词
 */
export function updatePrompt(id: string, updates: Partial<Omit<Prompt, 'id' | 'builtin' | 'createdAt'>>): Prompt | null {
  const storage = readStorage();
  const index = storage.prompts.findIndex(p => p.id === id);

  if (index === -1) {
    return null;
  }

  // 内置提示词不允许修改 builtin、id、createdAt
  const updated: Prompt = {
    ...storage.prompts[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };

  storage.prompts[index] = updated;
  writeStorage(storage);
  return updated;
}

/**
 * 删除提示词
 */
export function deletePrompt(id: string): boolean {
  const storage = readStorage();
  const index = storage.prompts.findIndex(p => p.id === id);

  if (index === -1) {
    return false;
  }

  storage.prompts.splice(index, 1);
  writeStorage(storage);
  return true;
}

/**
 * 增加使用次数
 */
export function incrementUsage(id: string): void {
  const storage = readStorage();
  const prompt = storage.prompts.find(p => p.id === id);
  if (prompt) {
    prompt.usageCount += 1;
    prompt.updatedAt = new Date().toISOString();
    writeStorage(storage);
  }
}

/**
 * 获取所有分类（预置 + 自定义）
 */
export function getAllCategories(): string[] {
  const storage = readStorage();
  return [...storage.categories, ...storage.customCategories];
}

/**
 * 添加自定义分类
 */
export function addCustomCategory(name: string): void {
  const storage = readStorage();
  if (!storage.customCategories.includes(name)) {
    storage.customCategories.push(name);
    writeStorage(storage);
  }
}

/**
 * 删除自定义分类
 */
export function removeCustomCategory(name: string): void {
  const storage = readStorage();
  storage.customCategories = storage.customCategories.filter(c => c !== name);
  writeStorage(storage);
}
