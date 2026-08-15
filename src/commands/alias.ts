// src/commands/alias.ts
// 别名命令层：
//   1. /alias —— 列出所有别名（只读）
//   2. /<别名> —— 动态注册的调用命令：渲染提示词 → 复制到剪贴板
// 别名的增删走 HTTP API（host/routes.ts），变更后调用 syncAliasCommands 重新同步。

import { Context } from '@deepseek-ai/cordis';
import type { CommandResult, CommandInvocation } from '@deepseek-ai/dsh-commands';
import { getPromptById, incrementUsage } from '../storage/manager.js';
import {
  getAllAliases,
  getAlias,
  type AliasEntry,
} from '../storage/alias-store.js';
import { renderTemplate } from '../engine/template.js';
import { resolveVariables } from '../engine/variable-resolver.js';
import { copyToClipboard } from './clipboard.js';

// ============ 动态命令注册 ============

/** 已注册的别名命令：alias → disposer */
const registeredAliasCommands = new Map<string, () => void>();

/**
 * 将别名存储中的变更同步到命令注册表：
 * 新增别名 → 注册 /<别名> 命令；删除别名 → 注销对应命令。
 * 幂等，可在任意变更后重复调用。
 *
 * 单条注册失败（如与其他插件命令撞名）只跳过该条，不中断整个同步，
 * 避免存储已写入但命令表只同步了一半的永久不一致。
 *
 * @returns 注册失败的别名列表（供调用方在响应中提示）
 */
export function syncAliasCommands(ctx: Context): string[] {
  if (typeof ctx.commands?.register !== 'function') return [];

  const aliases = getAllAliases();
  const wanted = new Set(aliases.map(a => a.alias));

  // 注销已失效的别名命令
  for (const [name, dispose] of registeredAliasCommands) {
    if (!wanted.has(name)) {
      dispose();
      registeredAliasCommands.delete(name);
    }
  }

  // 注册新增的别名命令（失败条目跳过，下一轮 sync 仍会重试）
  const failed: string[] = [];
  for (const entry of aliases) {
    if (registeredAliasCommands.has(entry.alias)) continue;
    try {
      const dispose = ctx.commands.register({
        name: entry.alias,
        description: `提示词别名 → ${describePromptTitle(entry)}`,
        input: { hint: '跟在命令后的内容，用于填充提示词变量' },
        handler: (invocation) => invokeAlias(entry.alias, invocation),
      });
      registeredAliasCommands.set(entry.alias, dispose);
    } catch (e) {
      console.warn(`[dsh-invoke] ⚠️ 别名命令 /${entry.alias} 注册失败，已跳过`, e);
      failed.push(entry.alias);
    }
  }
  return failed;
}

function describePromptTitle(entry: AliasEntry): string {
  return getPromptById(entry.promptId)?.title ?? entry.promptId;
}

// ============ 调用链：/<别名> [内容] ============

/** 从命令调用中提取会话工作目录（项目级存储跟随真实会话 cwd） */
function cwdOf(invocation: CommandInvocation): string | undefined {
  return invocation.agent.session.header?.cwd ?? undefined;
}

/**
 * 执行别名调用：
 *   1. 解析别名 → 提示词（项目级存储按会话 cwd 解析）
 *   2. 用 rawInput 填充变量（单变量填全部；多变量按声明顺序用 || 分隔）
 *   3. 渲染模板 → 复制到剪贴板（失败时回显正文供手动复制）
 */
async function invokeAlias(alias: string, invocation: CommandInvocation): Promise<CommandResult> {
  const cwd = cwdOf(invocation);
  const entry = getAlias(alias);
  if (!entry) {
    return { kind: 'error', text: `别名「/${alias}」已不存在，可用 /alias 查看当前列表` };
  }

  const prompt = getPromptById(entry.promptId, cwd);
  if (!prompt) {
    return { kind: 'error', text: `别名「/${alias}」指向的提示词已被删除，请重新设置` };
  }

  const variables = resolveVariables(prompt.body, prompt.variables);
  const rawInput = invocation.rawInput.trim();

  // ---- 填充变量 ----
  const values: Record<string, string> = {};

  if (variables.length === 1) {
    // 单变量：整个 rawInput 填入
    values[variables[0].name] = rawInput;
  } else if (variables.length > 1) {
    // 多变量：按声明顺序，用 || 分隔
    const parts = rawInput ? rawInput.split('||').map(s => s.trim()) : [];
    variables.forEach((v, i) => {
      values[v.name] = parts[i] ?? '';
    });
  }

  // ---- 校验必填变量 ----
  const missing = variables.filter(v => v.required && !(values[v.name] ?? '').trim());
  if (missing.length > 0) {
    return {
      kind: 'error',
      text: `提示词「${prompt.title}」缺少必填变量：${missing.map(v => v.name).join('、')}\n` +
        `用法：${usageOf(entry.alias, variables)}\n` +
        `多变量之间用 || 分隔；也可在 Prompt Vault 面板中点击「复制」交互式填写`
    };
  }

  // ---- 渲染 + 复制 ----
  const rendered = renderTemplate(prompt.body, values);
  incrementUsage(prompt.id, cwd);

  const copied = await copyToClipboard(rendered);
  if (copied) {
    return {
      kind: 'success',
      text: `✅ 「${prompt.title}」已渲染并复制到剪贴板，粘贴到输入框发送即可`
    };
  }

  // 剪贴板不可用（如无头环境）：直接回显正文供手动复制
  return {
    kind: 'success',
    text: `「${prompt.title}」渲染结果（剪贴板不可用，请手动复制）：\n\n${rendered}`
  };
}

/** 生成用法说明，如 /cr <code> 或 /log <date>||<level> */
function usageOf(alias: string, variables: { name: string }[]): string {
  if (variables.length === 0) return `/${alias}`;
  if (variables.length === 1) return `/${alias} <${variables[0].name}>`;
  return `/${alias} <${variables.map(v => v.name).join('>||<')}>`;
}

// ============ /alias 列表命令 ============

export function registerAliasCommands(ctx: Context): void {
  if (typeof ctx.commands?.register !== 'function') {
    console.warn('[dsh-invoke] ⚠️ ctx.commands 不可用，跳过别名命令注册');
    return;
  }

  // /alias - 列出所有别名
  ctx.commands.register({
    name: 'alias',
    description: '列出所有已注册的 Prompt 别名',
    handler: () => {
      const aliases = getAllAliases();
      if (aliases.length === 0) {
        return {
          kind: 'success' as const,
          text: '🔗 暂无别名。可在 Prompt Vault 面板的提示词卡片上点击「别名」按钮添加'
        };
      }
      const lines = aliases.map(a => {
        const prompt = getPromptById(a.promptId);
        const title = prompt ? prompt.title : '（提示词已删除）';
        return `  /${a.alias} → ${title}`;
      });
      return {
        kind: 'success' as const,
        text: `🔗 别名列表（共 ${aliases.length} 个）\n\n${lines.join('\n')}\n\n` +
          `调用方式：/<别名> [内容]（内容用于填充提示词变量）`
      };
    },
  });

  // 初始同步 + 卸载时清理全部动态命令
  ctx.effect(() => {
    syncAliasCommands(ctx);
    return () => {
      registeredAliasCommands.forEach(dispose => dispose());
      registeredAliasCommands.clear();
    };
  }, 'dsh-invoke.alias-commands');

  console.log('[dsh-invoke] ✅ alias 命令注册完成');
}
