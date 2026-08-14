// src/adapter/harness-api.ts

import type { Context } from '@deepseek-ai/dsh';

/**
 * Harness API 适配层
 * 所有对 Harness 官方 API 的调用集中于此，便于后续版本升级时统一适配
 */

export interface UIOptions {
  title?: string;
  width?: number;
  height?: number;
}

/**
 * 尝试加载 Webview 面板
 * 按优先级尝试多种方案，返回是否加载成功
 */
export async function tryLoadUI(ctx: Context, renderContent: () => string | HTMLElement): Promise<boolean> {
  // 方案1：尝试官方的 openPanel 方法（具体方法名需查阅 Harness API 文档）
  if (typeof ctx.ui?.openPanel === 'function') {
    try {
      ctx.ui.openPanel({
        id: 'dsh-invoke-panel',
        title: 'Prompt Vault',
        render: renderContent
      });
      console.log('[dsh-invoke] ✅ 通过 ctx.ui.openPanel 加载 UI 成功');
      return true;
    } catch (e) {
      console.warn('[dsh-invoke] ⚠️ ctx.ui.openPanel 失败，尝试下一种方案', e);
    }
  }

  // 方案2：尝试官方的 registerWebview 方法
  if (typeof ctx.ui?.registerWebview === 'function') {
    try {
      ctx.ui.registerWebview({
        id: 'dsh-invoke-webview',
        title: 'Prompt Vault',
        render: renderContent
      });
      console.log('[dsh-invoke] ✅ 通过 ctx.ui.registerWebview 加载 UI 成功');
      return true;
    } catch (e) {
      console.warn('[dsh-invoke] ⚠️ ctx.ui.registerWebview 失败，尝试下一种方案', e);
    }
  }

  // 方案3：降级 —— 通过 iframe 注入（如果 Harness 支持）
  if (typeof ctx.ui?.openFrame === 'function') {
    try {
      ctx.ui.openFrame({
        id: 'dsh-invoke-frame',
        title: 'Prompt Vault',
        content: renderContent()
      });
      console.log('[dsh-invoke] ✅ 通过 ctx.ui.openFrame 加载 UI 成功');
      return true;
    } catch (e) {
      console.warn('[dsh-invoke] ⚠️ ctx.ui.openFrame 失败', e);
    }
  }

  // 方案4：最终降级 —— UI 不可用，回退至命令行
  console.warn('[dsh-invoke] ❌ 所有 UI 加载方案均失败，回退至命令行模式');
  console.log('[dsh-invoke] 💡 提示：可直接使用 /prompt 命令管理提示词');
  return false;
}

/**
 * 获取工作区根目录
 */
export function getWorkspaceRoot(ctx: Context): string | null {
  if (typeof ctx.workspace?.root === 'string') {
    return ctx.workspace.root;
  }
  // 尝试从当前工作目录获取
  try {
    return process.cwd();
  } catch {
    return null;
  }
}

/**
 * 检测当前 Harness 版本是否支持编辑器选区 API
 */
export function supportsEditorSelection(ctx: Context): boolean {
  return typeof ctx.editor?.getSelection === 'function';
}

/**
 * 获取当前选中的文本（实验性功能）
 */
export function getSelectedText(ctx: Context): string | null {
  if (!supportsEditorSelection(ctx)) {
    return null;
  }
  try {
    return ctx.editor.getSelection() || null;
  } catch {
    return null;
  }
}
