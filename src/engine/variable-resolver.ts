// src/engine/variable-resolver.ts
// 变量提取与解析引擎
// 职责：
//   1. 从提示词正文中提取变量定义（依赖 template.ts 的基础提取）
//   2. 从编辑器选中文本中自动提取变量值（实验性功能）
//   3. 智能推断变量类型（text / textarea）

import type { Variable } from '../storage/manager.js';
import { extractVariablesFromBody } from './template.js';

// ============ 类型定义 ============

export interface AutoExtractResult {
  /** 成功自动提取的变量值，key 为变量名 */
  values: Record<string, string>;
  /** 自动提取是否可用（编辑器 API 是否存在） */
  available: boolean;
  /** 提示信息的 i18n key（UI 层渲染时翻译，见 ui/i18n.ts 的 varExtract.*） */
  messageKey: string;
  /** 提示信息插值参数 */
  messageParams?: Record<string, string>;
}

// ============ 变量类型推断 ============

/**
 * 根据正文内容智能推断变量类型
 */
export function inferVariableType(
  body: string,
  varName: string
): 'text' | 'textarea' {
  const lines = body.split('\n');
  const line = lines.find(l => l.includes(`{{${varName}}}`));
  if (!line) return 'text';

  const surrounding = lines.filter(l => l.includes(`{{${varName}}}`));
  const totalLen = surrounding.reduce((sum, l) => sum + l.trim().length, 0);
  return totalLen > 50 ? 'textarea' : 'text';
}

/**
 * 从提示词正文生成完整的变量定义
 * 优先使用已有的变量元数据，缺失部分自动推断
 */
export function resolveVariables(
  body: string,
  existingVariables: Variable[] = []
): Variable[] {
  const varNames = extractVariablesFromBody(body);
  if (varNames.length === 0) return [];

  const existingMap = new Map(existingVariables.map(v => [v.name, v]));

  return varNames.map(name => {
    const existing = existingMap.get(name);
    if (existing) {
      return existing;
    }
    return {
      name,
      type: inferVariableType(body, name),
      placeholder: `请输入 ${name}`,
      required: true
    };
  });
}

// ============ 自动变量提取（实验性） ============

/**
 * 从编辑器选中文本中自动提取变量值（实验性功能）
 */
export function autoExtractValues(
  body: string,
  variables: Variable[],
  selectedText: string | null
): AutoExtractResult {
  if (!selectedText || selectedText.trim().length === 0) {
    return {
      values: {},
      available: true,
      messageKey: 'varExtract.noSelection'
    };
  }

  const text = selectedText.trim();
  const values: Record<string, string> = {};

  // 规则 1：只有一个变量，且变量名语义暗示"整段内容"
  if (variables.length === 1) {
    const name = variables[0].name.toLowerCase();
    const wholeContentVars = ['code', 'content', 'text', 'body', 'prompt', '代码', '内容', '文本'];
    if (wholeContentVars.some(k => name.includes(k))) {
      values[variables[0].name] = text;
      return {
        values,
        available: true,
        messageKey: 'varExtract.wholeContent',
        messageParams: { name: variables[0].name }
      };
    }
  }

  // 规则 2：匹配 key: value 或 key=value 模式
  const kvPattern = /(?:^|[\n;])\s*["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*[:=]\s*["']?([^"';\n]+)["']?\s*(?:[;,]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = kvPattern.exec(text)) !== null) {
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim();
    const target = variables.find(v => v.name.toLowerCase() === key);
    if (target && value) {
      values[target.name] = value;
    }
  }

  // 规则 3：匹配常见代码符号
  variables.forEach(v => {
    if (values[v.name]) return;
    const keyRegex = new RegExp(
      `["']?${v.name}["']?\\s*[:=]\\s*["']?([^"'\\s,;]+)`,
      'i'
    );
    const m = text.match(keyRegex);
    if (m && m[1]) {
      values[v.name] = m[1];
    }
  });

  const extractedCount = Object.keys(values).length;
  if (extractedCount === 0) {
    return {
      values: {},
      available: true,
      messageKey: 'varExtract.failed'
    };
  }

  const names = Object.keys(values).join('、');
  return {
    values,
    available: true,
    messageKey: 'varExtract.extracted',
    messageParams: { count: String(extractedCount), names }
  };
}

// ============ 便捷组合函数 ============

/**
 * 一键完成：解析变量 + 尝试自动提取
 */
export function prepareVariables(
  body: string,
  existingVariables: Variable[],
  selectedText: string | null
): {
  variables: Variable[];
  autoExtract: AutoExtractResult;
} {
  const variables = resolveVariables(body, existingVariables);
  const autoExtract = autoExtractValues(body, variables, selectedText);
  return { variables, autoExtract };
}

