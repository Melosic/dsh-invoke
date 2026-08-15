// src/commands/prompt.ts
// Prompt Vault 的 DSH 命令注册

import { Context } from '@deepseek-ai/cordis';
import type { CommandResult, CommandInvocation } from '@deepseek-ai/dsh-commands';
import { getSortedPrompts, getAllPrompts } from '../storage/manager.js';

// 导入 @deepseek-ai/dsh-commands 以激活其 declare module 类型增强，
// 使 ctx.commands 在 Context 上可见（仅类型导入，无运行时副作用）。

/** 从命令调用中提取会话工作目录（项目级存储跟随真实会话 cwd） */
function cwdOf(invocation: CommandInvocation): string | undefined {
  return invocation.agent.session.header?.cwd ?? undefined;
}

/**
 * 注册 prompt 相关命令（DSH commands API）
 */
export function registerPromptCommands(ctx: Context): void {
  if (typeof ctx.commands?.register !== 'function') {
    console.warn('[dsh-invoke] ⚠️ ctx.commands 不可用，跳过命令注册');
    return;
  }

  // /prompt - 列出所有提示词
  ctx.commands.register({
    name: 'prompt',
    description: 'Prompt Vault 提示词管理 — 列出所有提示词',
    handler: (invocation) => {
      const prompts = getSortedPrompts('smart', cwdOf(invocation));
      const lines = prompts.map((p, i) =>
        `${i + 1}. ${p.title} [${p.category}]${p.builtin ? ' (内置)' : ''} — ${p.description}`
      );
      const text = `📋 Prompt Vault（共 ${prompts.length} 条）\n\n${lines.join('\n') || '  暂无提示词'}`;
      return { kind: 'success' as const, text };
    },
  });

  // /prompt-list - 按分类列出
  ctx.commands.register({
    name: 'prompt-list',
    description: '列出所有提示词，按分类分组',
    handler: (invocation) => {
      const prompts = getAllPrompts(cwdOf(invocation));
      const groups: Record<string, typeof prompts> = {};
      prompts.forEach(p => {
        const cat = p.category || '未分类';
        (groups[cat] ??= []).push(p);
      });
      const lines = Object.entries(groups).map(([cat, items]) =>
        `📂 ${cat}（${items.length} 条）:\n${items.map((p, i) => `  ${i + 1}. ${p.title}${p.builtin ? ' 📌' : ''}`).join('\n')}`
      );
      return { kind: 'success' as const, text: `📋 Prompt Vault 分类视图\n\n${lines.join('\n\n')}` };
    },
  });

  console.log('[dsh-invoke] ✅ prompt 命令注册完成');
}