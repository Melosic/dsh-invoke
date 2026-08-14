// src/storage/context.ts
// 存储上下文：管理当前工作区信息与存储路径配置
// 支持双层存储合并的基础设施

import * as path from 'path';

// ============ 存储层级 ============

export type StorageLayer = 'user' | 'project';

export interface StorageConfig {
  /** 用户级存储路径（默认 ~/.deepseek-harness/prompts.user.json） */
  userPath?: string;
  /** 项目级存储文件名或相对路径（默认 .harness/prompts.json） */
  projectPath?: string;
}

// ============ 全局上下文 ============

let workspaceRoot: string | null = null;
let storageConfig: StorageConfig = {};

/**
 * 初始化存储上下文（插件加载时调用）
 * @param root 工作区根目录，可能为 null（未打开工作区）
 * @param config 存储配置
 */
export function initStorageContext(
  root: string | null,
  config: StorageConfig = {}
): void {
  workspaceRoot = root;
  storageConfig = config;
}

/**
 * 获取当前工作区根目录
 */
export function getWorkspaceRoot(): string | null {
  return workspaceRoot;
}

/**
 * 获取项目级存储的绝对路径
 * 返回 null 表示没有工作区，无法使用项目级存储
 */
export function getProjectStoragePath(): string | null {
  if (!workspaceRoot) return null;
  const rel = storageConfig.projectPath || '.harness/prompts.json';
  return path.resolve(workspaceRoot, rel);
}

/**
 * 项目级存储是否可用（是否有工作区）
 */
export function hasProjectStorage(): boolean {
  return workspaceRoot !== null;
}

/**
 * 获取存储配置（供 UI/CLI 展示诊断信息）
 */
export function getStorageConfig(): StorageConfig {
  return { ...storageConfig };
}

