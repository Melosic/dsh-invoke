// src/commands/prompt.ts
// Prompt Vault 的 DSH 命令注册

import { Context } from '@deepseek-ai/cordis';
import type { CommandResult, CommandInvocation } from '@deepseek-ai/dsh-commands';
import { getSortedPrompts, getAllPrompts } from '../storage/manager.js';
import { ht } from '../shared/host-messages.js';
import { debugLog } from '../shared/log.js';

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
    console.warn('[dsh-invoke] ctx.commands 不可用，跳过命令注册');
    return;
  }

  ctx.effect(() => {
    const disposers: Array<() => void> = [];
    const reg = (spec: Parameters<typeof ctx.commands.register>[0]): void => {
      const dispose = ctx.commands.register(spec);
      if (typeof dispose === 'function') disposers.push(dispose as () => void);
    };

    // /prompt - 列出所有提示词
    reg({
      name: 'prompt',
    description: ht('cmd.prompt.desc'),
    handler: (invocation) => {
      const prompts = getSortedPrompts('smart', cwdOf(invocation));
      const lines = prompts.map((p, i) =>
        ht('cmd.prompt.line', {
          i: i + 1,
          title: p.title,
          category: p.category,
          builtin: p.builtin ? ht('cmd.prompt.builtin') : '',
          description: p.description,
        })
      );
      const text = `${ht('cmd.prompt.header', { count: prompts.length })}\n\n${lines.join('\n') || ht('cmd.prompt.empty')}`;
      return { kind: 'success' as const, text };
    },
  });

  // /prompt-list - 按分类列出
  reg({
    name: 'prompt-list',
    description: ht('cmd.promptList.desc'),
    handler: (invocation) => {
      const prompts = getAllPrompts(cwdOf(invocation));
      const groups: Record<string, typeof prompts> = {};
      prompts.forEach(p => {
        const cat = p.category || ht('cmd.promptList.uncategorized');
        (groups[cat] ??= []).push(p);
      });
      const lines = Object.entries(groups).map(([cat, items]) =>
        `${ht('cmd.promptList.group', { category: cat, count: items.length })}:\n${items.map((p, i) => ht('cmd.promptList.item', { i: i + 1, title: p.title, builtin: p.builtin ? ht('cmd.promptList.builtin') : '' })).join('\n')}`
      );
      return { kind: 'success' as const, text: `${ht('cmd.promptList.header')}\n\n${lines.join('\n\n')}` };
    },
  });

    return () => {
      for (const dispose of disposers.reverse()) dispose();
    };
  }, 'dsh-invoke.prompt-commands');

  debugLog('prompt commands registered');
}