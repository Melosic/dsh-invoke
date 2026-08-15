// src/engine/import-export.ts

import * as yaml from 'js-yaml';
import {
  PromptStorage,
  Prompt,
  Variable,
  getMergedStorage,
  getActiveLayerStorage,
  writeToActiveLayer
} from '../storage/manager.js';

// ============ 类型定义 ============

export interface ImportResult {
  success: boolean;
  message: string;
  added: number;
  skipped: number;
}

// ============ 导出 ============

/**
 * 导出数据为 JSON 字符串（合并用户级 + 项目级，保证备份完整）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function exportToJSON(cwd?: string | null): string {
  const { storage } = getMergedStorage(cwd);
  return JSON.stringify(storage, null, 2);
}

/**
 * 导出数据为 YAML 字符串（合并用户级 + 项目级，保证备份完整）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
export function exportToYAML(cwd?: string | null): string {
  const { storage } = getMergedStorage(cwd);
  return yaml.dump(storage, { noRefs: true, lineWidth: 120 });
}

// ============ 导入 ============

/**
 * 校验并规范化单条提示词（防止损坏/恶意文件把任意结构写入存储，
 * 导致后续 p.title / renderTemplate 等在 undefined 上运行）。
 * 结构非法返回 null，由调用方计入 skipped。
 */
function sanitizePrompt(raw: unknown): Prompt | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== 'string' || !o.id.trim()) return null;
  if (typeof o.title !== 'string' || typeof o.body !== 'string') return null;

  const variables = Array.isArray(o.variables)
    ? o.variables.filter(
        (v): v is Variable =>
          !!v &&
          typeof v === 'object' &&
          typeof (v as Record<string, unknown>).name === 'string' &&
          (v as Record<string, unknown>).name !== ''
      )
    : [];

  return {
    id: o.id,
    title: o.title,
    description: typeof o.description === 'string' ? o.description : '',
    category: typeof o.category === 'string' ? o.category : '',
    tags: Array.isArray(o.tags) ? o.tags.filter((t): t is string => typeof t === 'string') : [],
    body: o.body,
    variables,
    builtin: o.builtin === true,
    usageCount: typeof o.usageCount === 'number' ? o.usageCount : 0,
    lastUsedAt: typeof o.lastUsedAt === 'string' ? o.lastUsedAt : undefined,
    createdAt: typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString(),
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : new Date().toISOString(),
  };
}

/** 过滤字符串数组字段（categories / customCategories） */
function sanitizeStringArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
}

/**
 * 校验并写入导入的数据（JSON 与 YAML 共用）
 * 写入目标与新增提示词策略一致：有工作区写项目级，否则写用户级。
 * 逐条形状校验：无效条目过滤并计入 skipped，不进入存储。
 * @param data 解析后的存储对象
 * @param mode 导入模式：'overwrite' 覆盖全部 | 'merge' 合并（保留已有，添加新的）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
function importStorage(data: PromptStorage, mode: 'overwrite' | 'merge', cwd?: string | null): ImportResult {
  if (!data || typeof data.version !== 'number' || !Array.isArray(data.prompts)) {
    return {
      success: false,
      message: '无效的数据格式：缺少 version 或 prompts 字段',
      added: 0,
      skipped: 0
    };
  }

  const sanitized = data.prompts
    .map(sanitizePrompt)
    .filter((p): p is Prompt => p !== null);
  const invalidCount = data.prompts.length - sanitized.length;

  const categories = sanitizeStringArray(data.categories);
  const customCategories = sanitizeStringArray(data.customCategories);

  const current = getActiveLayerStorage(cwd);
  // version 单源：不接受导入文件的 version（避免 overwrite 把任意值写进存储）
  const version = Math.max(current.version || 1, 1);

  if (mode === 'overwrite') {
    writeToActiveLayer({ version, categories, customCategories, prompts: sanitized }, cwd);
    const invalidNote = invalidCount > 0 ? `，过滤无效条目 ${invalidCount} 条` : '';
    return {
      success: true,
      message: `导入成功，共 ${sanitized.length} 条提示词${invalidNote}`,
      added: sanitized.length,
      skipped: invalidCount
    };
  }

  const mergedCategories = [...current.categories];
  const mergedCustomCategories = [...current.customCategories];

  [...categories, ...customCategories].forEach(cat => {
    if (!mergedCategories.includes(cat) && !mergedCustomCategories.includes(cat)) {
      mergedCustomCategories.push(cat);
    }
  });

  const existingIds = new Set(current.prompts.map(p => p.id));
  let added = 0;
  let skipped = invalidCount;
  const mergedPrompts = [...current.prompts];

  sanitized.forEach(prompt => {
    if (existingIds.has(prompt.id)) {
      skipped++;
    } else {
      mergedPrompts.push(prompt);
      existingIds.add(prompt.id);
      added++;
    }
  });

  writeToActiveLayer(
    {
      version,
      categories: mergedCategories,
      customCategories: mergedCustomCategories,
      prompts: mergedPrompts
    },
    cwd
  );

  const invalidNote = invalidCount > 0 ? `，过滤无效条目 ${invalidCount} 条` : '';
  return {
    success: true,
    message: `导入完成：新增 ${added} 条，跳过 ${skipped} 条（含重复 ID 与无效条目）${invalidNote}`,
    added,
    skipped
  };
}

/**
 * 从 JSON 字符串导入数据
 */
export function importFromJSON(
  jsonString: string,
  mode: 'overwrite' | 'merge',
  cwd?: string | null
): ImportResult {
  try {
    const data = JSON.parse(jsonString) as PromptStorage;
    return importStorage(data, mode, cwd);
  } catch (error) {
    return {
      success: false,
      message: `导入失败：${error instanceof Error ? error.message : '未知错误'}`,
      added: 0,
      skipped: 0
    };
  }
}

/**
 * 从 YAML 字符串导入数据
 */
export function importFromYAML(
  yamlString: string,
  mode: 'overwrite' | 'merge',
  cwd?: string | null
): ImportResult {
  try {
    const data = yaml.load(yamlString) as PromptStorage;
    return importStorage(data, mode, cwd);
  } catch (error) {
    return {
      success: false,
      message: `导入失败：${error instanceof Error ? error.message : '未知错误'}`,
      added: 0,
      skipped: 0
    };
  }
}

// 说明：本模块仅服务 Host 端（Node）。
// 浏览器端通过 /api/dsh-invoke/import 与 /api/dsh-invoke/export 与 Host 通信，
// 文件下载 / 读取由 src/ui 组件直接使用 Blob / FileReader 完成，无需在此重复实现。
