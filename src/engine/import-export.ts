// src/engine/import-export.ts

import * as yaml from 'js-yaml';
import {
  PromptStorage,
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
 * 校验并写入导入的数据（JSON 与 YAML 共用）
 * 写入目标与新增提示词策略一致：有工作区写项目级，否则写用户级
 * @param data 解析后的存储对象
 * @param mode 导入模式：'overwrite' 覆盖全部 | 'merge' 合并（保留已有，添加新的）
 * @param cwd 显式工作目录；缺省用全局初始化值
 */
function importStorage(data: PromptStorage, mode: 'overwrite' | 'merge', cwd?: string | null): ImportResult {
  if (!data || !data.version || !Array.isArray(data.prompts)) {
    return {
      success: false,
      message: '无效的数据格式：缺少 version 或 prompts 字段',
      added: 0,
      skipped: 0
    };
  }

  if (mode === 'overwrite') {
    writeToActiveLayer(data, cwd);
    return {
      success: true,
      message: `导入成功，共 ${data.prompts.length} 条提示词`,
      added: data.prompts.length,
      skipped: 0
    };
  }

  const current = getActiveLayerStorage(cwd);

  const mergedCategories = [...current.categories];
  const mergedCustomCategories = [...current.customCategories];

  data.categories?.forEach(cat => {
    if (!mergedCategories.includes(cat) && !mergedCustomCategories.includes(cat)) {
      mergedCustomCategories.push(cat);
    }
  });

  const existingIds = new Set(current.prompts.map(p => p.id));
  let added = 0;
  let skipped = 0;
  const mergedPrompts = [...current.prompts];

  data.prompts.forEach(prompt => {
    if (existingIds.has(prompt.id)) {
      skipped++;
    } else {
      mergedPrompts.push(prompt);
      existingIds.add(prompt.id);
      added++;
    }
  });

  const newStorage: PromptStorage = {
    version: current.version,
    categories: mergedCategories,
    customCategories: mergedCustomCategories,
    prompts: mergedPrompts
  };

  writeToActiveLayer(newStorage, cwd);

  return {
    success: true,
    message: `导入完成：新增 ${added} 条，跳过 ${skipped} 条（ID 已存在）`,
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
