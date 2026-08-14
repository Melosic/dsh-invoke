// src/index.ts

import { Context } from '@deepseek-ai/dsh';
import { tryLoadUI, getWorkspaceRoot } from './adapter/harness-api';

// ============ 插件导出 ============

export function apply(ctx: Context) {
  console.log('[dsh-invoke] 🚀 正在加载 Prompt Vault 插件...');

  // ============ 1. 注册命令（可选，作为降级方案） ============

  ctx.command('prompt', 'Prompt Vault 提示词管理')
    .subcommand('list [分类]', '列出所有提示词')
    .action(async (args) => {
      console.log('[dsh-invoke] 📋 列出提示词（功能开发中）');
      // TODO: 实现列表逻辑
    })
    .subcommand('add', '添加新提示词')
    .action(async () => {
      console.log('[dsh-invoke] ➕ 添加提示词（功能开发中）');
      // TODO: 实现添加逻辑
    })
    .subcommand('use <id>', '使用指定提示词')
    .action(async (args) => {
      console.log('[dsh-invoke] 📋 使用提示词（功能开发中）');
      // TODO: 实现使用逻辑
    });

  console.log('[dsh-invoke] ✅ 命令注册完成');

  // ============ 2. 尝试加载 UI ============

  const workspaceRoot = getWorkspaceRoot(ctx);
  if (workspaceRoot) {
    console.log(`[dsh-invoke] 📁 工作区路径: ${workspaceRoot}`);
  } else {
    console.warn('[dsh-invoke] ⚠️ 无法获取工作区路径，仅加载用户级存储');
  }

  // 构建 UI 渲染内容（先使用简单的占位内容，后续替换为 React 组件）
  const renderUI = () => {
    return `
      <div style="padding: 20px; font-family: -apple-system, sans-serif;">
        <h2 style="color: #2e9bff; margin-bottom: 12px;">📚 Prompt Vault</h2>
        <p style="color: #4a4a5a; margin-bottom: 16px;">提示词管理面板加载中...</p>
        <div style="background: #f0f2f6; border-radius: 8px; padding: 16px; text-align: center; color: #7a7a8a;">
          ⏳ React 组件即将就绪
        </div>
        <p style="font-size: 13px; color: #7a7a8a; margin-top: 12px;">
          💡 提示：也支持使用 /prompt 命令操作
        </p>
      </div>
    `;
  };

  // 延迟加载 UI，确保 Harness 环境完全初始化
  setTimeout(async () => {
    const uiLoaded = await tryLoadUI(ctx, renderUI);
    if (uiLoaded) {
      console.log('[dsh-invoke] ✅ UI 加载成功');
    } else {
      console.log('[dsh-invoke] ✅ 已回退至命令行模式，功能完整可用');
    }
  }, 100);

  console.log('[dsh-invoke] ✅ 插件加载完成');
}

// ============ 插件元信息 ============

export const name = 'dsh-invoke';
export const version = '0.1.0';
export const description = 'Prompt Vault & Invoker for DeepSeek Harness';
