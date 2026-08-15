// src/client/api.ts
// 浏览器端 API 封装：通过 fetch 与 host 端 HTTP 路由通信。
// UI 组件统一从这里获取数据，避免在浏览器端引入 Node 的 fs/os 依赖。

import type {
  Prompt,
  PromptSortMode,
  PromptStorage,
  Variable,
} from '../storage/manager.js';

export type { Prompt, PromptSortMode, PromptStorage, Variable };

/** host 端注册的 API 前缀（与 src/host/routes.ts 保持一致） */
const API_BASE = '/api/dsh-invoke';

// ============ 会话工作目录 ============

/**
 * 当前会话工作目录（项目级存储定位用）。
 * initApiClient() 从 /workspace 解析后缓存；null 表示无工作区或未知（不携带，host 用进程默认）。
 * 所有请求统一携带后，写路径显式经过 host 端 cwd 白名单校验。
 */
let sessionCwd: string | null = null;

export interface WorkspaceInfo {
  workspaceRoot: string | null;
  projectStoragePath: string | null;
  registeredWorkspace: boolean | null;
}

/**
 * 初始化 client API 上下文：解析会话工作目录。
 * 在 client apply() 中调用一次；失败时静默保持无 cwd 模式（host 回退进程默认）。
 */
export async function initApiClient(): Promise<WorkspaceInfo | null> {
  try {
    const info = await request<WorkspaceInfo>('/workspace');
    // 仅在目录确认未注册（registeredWorkspace === false）时放弃携带，
    // 未知（null）与已注册（true）均携带，避免误伤无注册表的宿主
    sessionCwd =
      info.workspaceRoot && info.registeredWorkspace !== false ? info.workspaceRoot : null;
    return info;
  } catch {
    sessionCwd = null;
    return null;
  }
}

/** 向查询串追加会话 cwd（已有参数时用 & 拼接） */
function withCwdQuery(path: string): string {
  if (!sessionCwd) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}cwd=${encodeURIComponent(sessionCwd)}`;
}

/** 向 JSON 请求体合并会话 cwd */
function withCwdBody<T extends object>(body: T): T {
  if (!sessionCwd) return body;
  return { ...body, cwd: sessionCwd };
}

// ============ 底层请求 ============

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.error || body.message || message;
    } catch {
      /* 非 JSON 响应，使用默认错误信息 */
    }
    throw new Error(message);
  }

  const contentType = res.headers.get('Content-Type') || '';
  if (contentType.includes('application/json')) {
    return (await res.json()) as T;
  }
  return (await res.text()) as unknown as T;
}

// ============ 提示词 CRUD ============

/** 获取按指定模式排序的提示词列表 */
export async function getSortedPrompts(mode: PromptSortMode = 'smart'): Promise<Prompt[]> {
  const data = await request<{ prompts: Prompt[] }>(withCwdQuery(`/prompts?sort=${mode}`));
  return data.prompts;
}

/** 获取单个提示词 */
export async function getPromptById(id: string): Promise<Prompt | null> {
  try {
    return await request<Prompt>(`/prompt/${encodeURIComponent(id)}`);
  } catch {
    return null;
  }
}

/** 新增提示词 */
export async function addPrompt(
  prompt: Omit<Prompt, 'builtin' | 'usageCount' | 'createdAt' | 'updatedAt'>
): Promise<Prompt> {
  return request<Prompt>('/prompts', {
    method: 'POST',
    body: JSON.stringify(withCwdBody(prompt)),
  });
}

/** 更新提示词 */
export async function updatePrompt(
  id: string,
  updates: Partial<Omit<Prompt, 'id' | 'builtin' | 'createdAt'>>
): Promise<Prompt | null> {
  try {
    return await request<Prompt>(withCwdQuery(`/prompt/${encodeURIComponent(id)}`), {
      method: 'PUT',
      body: JSON.stringify(withCwdBody(updates)),
    });
  } catch {
    return null;
  }
}

/** 删除提示词 */
export async function deletePrompt(id: string): Promise<boolean> {
  const data = await request<{ success: boolean }>(withCwdQuery(`/prompt/${encodeURIComponent(id)}`), {
    method: 'DELETE',
  });
  return data.success;
}

/** 增加使用次数 */
export async function incrementUsage(id: string): Promise<void> {
  await request<{ success: boolean }>(withCwdQuery(`/prompt/${encodeURIComponent(id)}/use`), {
    method: 'POST',
  });
}

// ============ 分类 ============

/** 获取所有分类 */
export async function getAllCategories(): Promise<string[]> {
  const data = await request<{ categories: string[] }>(withCwdQuery('/categories'));
  return data.categories;
}

/** 添加自定义分类 */
export async function addCustomCategory(name: string): Promise<void> {
  await request<{ success: boolean }>('/categories', {
    method: 'POST',
    body: JSON.stringify(withCwdBody({ name })),
  });
}

/** 删除自定义分类 */
export async function removeCustomCategory(name: string): Promise<void> {
  await request<{ success: boolean }>(
    withCwdQuery(`/categories?name=${encodeURIComponent(name)}`),
    { method: 'DELETE' }
  );
}

// ============ 别名 ============

export interface AliasEntry {
  /** 别名（不含开头的 /，小写） */
  alias: string;
  /** 关联的提示词 ID */
  promptId: string;
  /** 创建时间 */
  createdAt: string;
}

/** 获取所有别名 */
export async function getAllAliases(): Promise<AliasEntry[]> {
  const data = await request<{ aliases: AliasEntry[] }>('/aliases');
  return data.aliases;
}

/** 为提示词设置别名（若该提示词已有别名，将报错，需先删除） */
export async function addAlias(alias: string, promptId: string): Promise<AliasEntry> {
  return request<AliasEntry>('/aliases', {
    method: 'POST',
    body: JSON.stringify(withCwdBody({ alias, promptId })),
  });
}

/** 删除别名 */
export async function removeAlias(alias: string): Promise<void> {
  await request<{ success: boolean }>(`/aliases?name=${encodeURIComponent(alias)}`, {
    method: 'DELETE',
  });
}

// ============ 导入 / 导出 ============

export interface ImportResult {
  success: boolean;
  message: string;
  added: number;
  skipped: number;
}

/** 导入提示词（content 为 JSON/YAML 字符串） */
export async function importPrompts(
  content: string,
  format: 'json' | 'yaml',
  mode: 'overwrite' | 'merge' = 'merge'
): Promise<ImportResult> {
  try {
    return await request<ImportResult>('/import', {
      method: 'POST',
      body: JSON.stringify(withCwdBody({ content, format, mode })),
    });
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '导入失败',
      added: 0,
      skipped: 0,
    };
  }
}

/** 导出提示词（返回 JSON/YAML 字符串） */
export async function exportPrompts(format: 'json' | 'yaml' = 'json'): Promise<string> {
  return request<string>(withCwdQuery(`/export?format=${format}`));
}