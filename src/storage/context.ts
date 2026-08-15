// src/storage/context.ts
// 存储上下文：管理当前工作区信息与存储路径配置
// 支持双层存储合并的基础设施。
//
// 除插件加载时的一次性全局初始化外，读写函数可传入显式 cwd
// （如命令调用链传入 agent.session.header.cwd），使项目级存储
// 跟随实际会话工作目录，而非仅凭 Host 进程启动目录。

import * as path from 'path';

// ============ 存储层级 ============

export type StorageLayer = 'user' | 'project';

export interface StorageConfig {
  /** 用户级存储路径（默认由 dshHomePath() 解析，文件 prompts.user.json） */
  userPath?: string;
  /** 项目级存储文件名或相对路径（默认 .harness/prompts.json） */
  projectPath?: string;
}

/** 一次存储访问使用的已解析上下文（全局初始化或显式 cwd） */
export interface ResolvedStorageContext {
  /** 工作区根目录；null 表示无工作区（仅用户级） */
  workspaceRoot: string | null;
  /** 项目级存储绝对路径；无工作区时为 null */
  projectStoragePath: string | null;
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
 * 获取当前工作区根目录（全局初始化值）
 */
export function getWorkspaceRoot(): string | null {
  return workspaceRoot;
}

/**
 * 为一次存储访问解析上下文：
 * 传入显式 cwd 时以其为工作区根（覆盖全局初始化值），否则用全局值。
 * @param cwd 调用方工作目录（如 agent.session.header.cwd），可选
 */
export function resolveStorageContext(cwd?: string | null): ResolvedStorageContext {
  const root = cwd?.trim() ? path.resolve(cwd) : workspaceRoot;
  if (!root) return { workspaceRoot: null, projectStoragePath: null };
  const rel = storageConfig.projectPath || '.harness/prompts.json';
  return {
    workspaceRoot: root,
    projectStoragePath: path.resolve(root, rel)
  };
}

/**
 * 获取项目级存储的绝对路径（全局初始化值）
 * 返回 null 表示没有工作区，无法使用项目级存储
 */
export function getProjectStoragePath(): string | null {
  return resolveStorageContext().projectStoragePath;
}

/**
 * 项目级存储是否可用（是否有工作区）；cwd 提供时按其判断
 */
export function hasProjectStorage(cwd?: string | null): boolean {
  return resolveStorageContext(cwd).workspaceRoot !== null;
}

/**
 * 获取存储配置（供 UI/CLI 展示诊断信息）
 */
export function getStorageConfig(): StorageConfig {
  return { ...storageConfig };
}
