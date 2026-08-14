// src/engine/import-export.ts

import { PromptStorage, Prompt, readStorage, writeStorage, getAllPrompts } from '../storage/manager';

/**
 * 导出数据为 JSON 字符串
 */
export function exportToJSON(): string {
  const storage = readStorage();
  return JSON.stringify(storage, null, 2);
}

/**
 * 从 JSON 字符串导入数据
 * @param jsonString JSON 字符串
 * @param mode 导入模式：'overwrite' 覆盖全部 | 'merge' 合并（保留已有，添加新的）
 * @returns 导入结果统计
 */
export function importFromJSON(
  jsonString: string,
  mode: 'overwrite' | 'merge'
): { success: boolean; message: string; added: number; skipped: number } {
  try {
    const data = JSON.parse(jsonString) as PromptStorage;

    // 验证数据结构
    if (!data.version || !Array.isArray(data.prompts)) {
      return {
        success: false,
        message: '无效的数据格式：缺少 version 或 prompts 字段',
        added: 0,
        skipped: 0
      };
    }

    if (mode === 'overwrite') {
      // 覆盖模式：直接写入
      writeStorage(data);
      return {
        success: true,
        message: `导入成功，共 ${data.prompts.length} 条提示词`,
        added: data.prompts.length,
        skipped: 0
      };
    }

    // 合并模式：合并提示词和分类
    const current = readStorage();

    // 合并分类
    const mergedCategories = [...current.categories];
    const mergedCustomCategories = [...current.customCategories];

    // 新增分类
    data.categories?.forEach(cat => {
      if (!mergedCategories.includes(cat) && !mergedCustomCategories.includes(cat)) {
        mergedCustomCategories.push(cat);
      }
    });

    // 合并提示词：按 ID 去重
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
 * 下载 JSON 文件到本地
 */
export function downloadJSON(data: string, filename?: string): void {
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `prompts-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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
