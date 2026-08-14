// src/index.ts

import { Context } from '@deepseek-ai/dsh';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { tryLoadUI, getWorkspaceRoot, getSelectedText } from './adapter/harness-api';
import { WebviewPanel } from './ui/WebviewPanel';
import { registerPromptCommands } from './commands/prompt';
import { registerAliasCommands } from './commands/alias';
import { initStorageContext } from './storage/context';

// ============ 插件导出 ============

export function apply(ctx: Context) {
  console.log('[dsh-invoke] 🚀 正在加载 Prompt Vault 插件...');

  // ============ 1. 注册命令 ============

  registerPromptCommands(ctx);
  registerAliasCommands(ctx);
  console.log('[dsh-invoke] ✅ 命令注册完成');

  // ============ 1.5 初始化存储上下文 ============

  const workspaceRoot = getWorkspaceRoot(ctx);
  if (workspaceRoot) {
    console.log(`[dsh-invoke] 📁 工作区路径: ${workspaceRoot}`);
  } else {
    console.warn('[dsh-invoke] ⚠️ 无法获取工作区路径，仅加载用户级存储');
  }

  // 读取存储配置（支持 dsh.config.ts 的 invoke.storage 自定义路径）
  const storageConfig = ctx.invoke?.storage ?? {};
  initStorageContext(workspaceRoot, {
    userPath: storageConfig.userPath,
    projectPath: storageConfig.projectPath
  });

  // ============ 2. 加载 React UI ============

  // 构建 UI 渲染函数
  const renderUI = () => {
    const container = document.createElement('div');
    container.id = 'dsh-invoke-root';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.overflow = 'hidden';

    const root = createRoot(container);
    root.render(
      React.createElement(WebviewPanel, {
        // 注入编辑器选区读取能力，供变量自动提取使用
        getSelectedText: () => getSelectedText(ctx)
      })
    );

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

