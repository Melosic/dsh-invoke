// src/engine/import-export.ts

import yaml from 'js-yaml';
import {
  PromptStorage,
  readStorage,
  writeStorage,
  getMergedStorage
} from '../storage/manager';

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
 */
export function exportToJSON(): string {
  const { storage } = getMergedStorage();
  return JSON.stringify(storage, null, 2);
}

/**
 * 导出数据为 YAML 字符串（合并用户级 + 项目级，保证备份完整）
 */
export function exportToYAML(): string {
  const { storage } = getMergedStorage();
  return yaml.dump(storage, { noRefs: true, lineWidth: 120 });
}

// ============ 导入 ============

/**
 * 校验并写入导入的数据（JSON 与 YAML 共用）
 * @param data 解析后的存储对象
 * @param mode 导入模式：'overwrite' 覆盖全部 | 'merge' 合并（保留已有，添加新的）
 */
function importStorage(data: PromptStorage, mode: 'overwrite' | 'merge'): ImportResult {
  if (!data || !data.version || !Array.isArray(data.prompts)) {
    return {
      success: false,
      message: '无效的数据格式：缺少 version 或 prompts 字段',
      added: 0,
      skipped: 0
    };
  }

  if (mode === 'overwrite') {
    writeStorage(data);
    return {
      success: true,
      message: `导入成功，共 ${data.prompts.length} 条提示词`,
      added: data.prompts.length,
      skipped: 0
    };
  }

  const current = readStorage();

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

  writeStorage(newStorage);

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
  mode: 'overwrite' | 'merge'
): ImportResult {
  try {
    const data = JSON.parse(jsonString) as PromptStorage;
    return importStorage(data, mode);
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
  mode: 'overwrite' | 'merge'
): ImportResult {
  try {
    const data = yaml.load(yamlString) as PromptStorage;
    return importStorage(data, mode);
  } catch (error) {
    return {
      success: false,
      message: `导入失败：${error instanceof Error ? error.message : '未知错误'}`,
      added: 0,
      skipped: 0
    };
  }
}

// ============ 文件下载 ============

function downloadFile(data: string, filename: string, mime: string): void {
  const blob = new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 下载 JSON 文件到本地
 */
export function downloadJSON(data: string, filename?: string): void {
  downloadFile(
    data,
    filename || `prompts-backup-${new Date().toISOString().slice(0, 10)}.json`,
    'application/json'
  );
}

/**
 * 下载 YAML 文件到本地
 */
export function downloadYAML(data: string, filename?: string): void {
  downloadFile(
    data,
    filename || `prompts-backup-${new Date().toISOString().slice(0, 10)}.yaml`,
    'application/yaml'
  );
}

/**
 * 从文件读取 JSON
 */
export function readJSONFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        resolve(e.target.result as string);
      } else {
        reject(new Error('读取文件失败'));
      }
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsText(file);
  });
}
