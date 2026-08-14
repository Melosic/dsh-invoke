// src/index.ts

import { Context } from '@deepseek-ai/dsh';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { tryLoadUI, getWorkspaceRoot } from './adapter/harness-api';
import { WebviewPanel } from './ui/WebviewPanel';

// ============ 插件导出 ============

export function apply(ctx: Context) {
  console.log('[dsh-invoke] 🚀 正在加载 Prompt Vault 插件...');

  // ============ 1. 注册命令（降级方案） ============

  ctx.command('prompt', 'Prompt Vault 提示词管理')
    .subcommand('list [分类]', '列出所有提示词')
    .action(async () => {
      console.log('[dsh-invoke] 📋 列出提示词（功能开发中）');
    })
    .subcommand('add', '添加新提示词')
    .action(async () => {
      console.log('[dsh-invoke] ➕ 添加提示词（功能开发中）');
    })
    .subcommand('use <id>', '使用指定提示词')
    .action(async () => {
      console.log('[dsh-invoke] 📋 使用提示词（功能开发中）');
    });

  console.log('[dsh-invoke] ✅ 命令注册完成');

  // ============ 2. 加载 React UI ============

  const workspaceRoot = getWorkspaceRoot(ctx);
  if (workspaceRoot) {
    console.log(`[dsh-invoke] 📁 工作区路径: ${workspaceRoot}`);
  }

  // 构建 UI 渲染函数
  const renderUI = () => {
    // 创建挂载容器
    const container = document.createElement('div');
    container.id = 'dsh-invoke-root';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';

    // 使用 React 18 渲染
    const root = createRoot(container);
    root.render(React.createElement(WebviewPanel));

    return container;
  };

  // 延迟加载 UI，确保 Harness 环境完全初始化
  setTimeout(async () => {
    const uiLoaded = await tryLoadUI(ctx, renderUI);
    if (uiLoaded) {
      console.log('[dsh-invoke] ✅ React UI 加载成功');
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
