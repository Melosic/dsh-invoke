// src/client/api.ts
// 浏览器端 API 封装：通过 fetch 与 host 端 HTTP 路由通信。
// UI 组件统一从这里获取数据，避免在浏览器端引入 Node 的 fs/os 依赖。

import type {
  Prompt,
  PromptSortMode,
  PromptStorage,
  Variable,
} from '../storage/manager';

export type { Prompt, PromptSortMode, PromptStorage, Variable };

/** host 端注册的 API 前缀（与 src/host/routes.ts 保持一致） */
const API_BASE = '/api/dsh-invoke';

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
  const data = await request<{ prompts: Prompt[] }>(`/prompts?sort=${mode}`);
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
    body: JSON.stringify(prompt),
  });
}

/** 更新提示词 */
export async function updatePrompt(
  id: string,
  updates: Partial<Omit<Prompt, 'id' | 'builtin' | 'createdAt'>>
): Promise<Prompt | null> {
  try {
    return await request<Prompt>(`/prompt/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  } catch {
    return null;
  }
}

/** 删除提示词 */
export async function deletePrompt(id: string): Promise<boolean> {
  const data = await request<{ success: boolean }>(`/prompt/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return data.success;
}

/** 增加使用次数 */
export async function incrementUsage(id: string): Promise<void> {
  await request<{ success: boolean }>(`/prompt/${encodeURIComponent(id)}/use`, {
    method: 'POST',
  });
}

// ============ 分类 ============

/** 获取所有分类 */
export async function getAllCategories(): Promise<string[]> {
  const data = await request<{ categories: string[] }>('/categories');
  return data.categories;
}

/** 添加自定义分类 */
export async function addCustomCategory(name: string): Promise<void> {
  await request<{ success: boolean }>('/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

/** 删除自定义分类 */
export async function removeCustomCategory(name: string): Promise<void> {
  await request<{ success: boolean }>(
    `/categories?name=${encodeURIComponent(name)}`,
    { method: 'DELETE' }
  );
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
      body: JSON.stringify({ content, format, mode }),
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
  return request<string>(`/export?format=${format}`);
}