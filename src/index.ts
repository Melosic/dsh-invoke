// src/index.ts
// dsh-invoke 插件主入口（Host 端）
// 职责：
//   1. 注册 HTTP 路由（CRUD API）
//   2. 注册命令行命令
//   3. 初始化存储上下文

import { Context } from '@deepseek-ai/cordis';
import { registerRoutes } from './host/routes';
import { registerPromptCommands } from './commands/prompt';
import { registerAliasCommands } from './commands/alias';
import { initStorageContext } from './storage/context';

export const name = 'dsh-invoke';
export const version = '0.1.0';
export const description = 'Prompt Vault & Invoker for DeepSeek Harness';

export const inject = ['webServer', 'commands'];

export function apply(ctx: Context) {
  console.log('[dsh-invoke] 🚀 正在加载 Prompt Vault 插件...');

  // ============ 1. 初始化存储上下文 ============

  const workspaceRoot = getWorkspaceRoot();
  if (workspaceRoot) {
    console.log(`[dsh-invoke] 📁 工作区路径: ${workspaceRoot}`);
  } else {
    console.warn('[dsh-invoke] ⚠️ 无法获取工作区路径，仅加载用户级存储');
  }

  initStorageContext(workspaceRoot);

  // ============ 2. 注册 HTTP 路由 ============

  ctx.effect(() => registerRoutes(ctx), 'dsh-invoke.routes');
  console.log('[dsh-invoke] ✅ HTTP 路由注册完成');

  // ============ 3. 注册命令行命令 ============

  registerPromptCommands(ctx);
  registerAliasCommands(ctx);
  console.log('[dsh-invoke] ✅ 命令注册完成');

  console.log('[dsh-invoke] ✅ 插件加载完成');
}

/**
 * 获取当前进程工作区根目录
 */
function getWorkspaceRoot(): string | null {
  try {
    return process.cwd();
  } catch {
    return null;
  }
}
