// src/engine/template.ts

import { Variable } from '../storage/manager.js';

/** 转义正则特殊字符（变量名含 . * 等时避免误匹配） */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 渲染模板：将 {{variable}} 替换为实际值
 * 支持简单变量替换，暂不支持条件/循环（v1.1 规划）
 */
export function renderTemplate(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;
  Object.keys(variables).forEach(key => {
    const regex = new RegExp(`\\{\\{${escapeRegex(key)}\\}\\}`, 'g');
    // 用函数替换，避免变量值中的 $&、$1 等被当作替换模式解释
    result = result.replace(regex, () => variables[key] || '');
  });
  return result;
}

/**
 * 从提示词正文中提取所有变量名
 * 匹配 {{variable}} 格式，返回去重的变量名列表
 */
export function extractVariablesFromBody(body: string): string[] {
  const regex = /{{([^}]+)}}/g;
  const matches = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    matches.push(match[1]);
  }
  return [...new Set(matches)];
}

/**
 * 校验变量是否都已填充
 */
export function validateVariables(
  variables: Variable[],
  values: Record<string, string>
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  variables.forEach(v => {
    if (v.required && (!values[v.name] || !values[v.name].trim())) {
      missing.push(v.name);
    }
  });
  return {
    valid: missing.length === 0,
    missing
  };
}
