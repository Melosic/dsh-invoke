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
import { ht } from '../shared/host-messages.js';

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
        description: ht('cmd.aliasEntryDesc', { title: describePromptTitle(entry) }),
        input: { hint: ht('cmd.aliasEntryHint') },
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
 *   1. 解析别名 → 提示词。查找顺序（别名全局存储、提示词可能属于任一工作区）：
 *      a. 别名记录的 promptCwd（创建时的工作目录）
 *      b. 当前会话 cwd
 *      c. 全局初始化值（含用户级存储）
 *   2. 用 rawInput 填充变量（单变量填全部；多变量按声明顺序用 || 分隔）
 *   3. 渲染模板 → 复制到剪贴板（失败时回显正文供手动复制）
 */
async function invokeAlias(alias: string, invocation: CommandInvocation): Promise<CommandResult> {
  const cwd = cwdOf(invocation);
  const entry = getAlias(alias);
  if (!entry) {
    return { kind: 'error', text: ht('invoke.notFound', { alias }) };
  }

  // 逐层回退查找：项目 A 的别名在项目 B 中调用时仍能定位到提示词
  const candidates = [entry.promptCwd, cwd].filter(
    (c, i, arr): c is string => !!c?.trim() && arr.indexOf(c) === i
  );
  let prompt = null as ReturnType<typeof getPromptById>;
  let hitCwd = cwd;
  for (const c of candidates) {
    prompt = getPromptById(entry.promptId, c);
    if (prompt) {
      hitCwd = c;
      break;
    }
  }
  if (!prompt) {
    prompt = getPromptById(entry.promptId, undefined);
    hitCwd = undefined;
  }
  if (!prompt) {
    return {
      kind: 'error',
      text: ht('invoke.promptMissing', { alias, cwd: entry.promptCwd ?? ht('invoke.unknownCwd') })
    };
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
      text: ht('invoke.missingVars', {
        title: prompt.title,
        names: missing.map(v => v.name).join('、'),
        usage: usageOf(entry.alias, variables),
      })
    };
  }

  // ---- 渲染 + 复制 ----
  const rendered = renderTemplate(prompt.body, values);
  incrementUsage(prompt.id, hitCwd);

  const copied = await copyToClipboard(rendered);
  if (copied) {
    return {
      kind: 'success',
      text: ht('invoke.copied', { title: prompt.title })
    };
  }

  // 剪贴板不可用（如无头环境）：直接回显正文供手动复制
  return {
    kind: 'success',
    text: ht('invoke.fallbackEcho', { title: prompt.title, body: rendered })
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
    description: ht('cmd.alias.desc'),
    handler: () => {
      const aliases = getAllAliases();
      if (aliases.length === 0) {
        return {
          kind: 'success' as const,
          text: ht('cmd.alias.empty')
        };
      }
      const lines = aliases.map(a => {
        const prompt = getPromptById(a.promptId);
        const title = prompt ? prompt.title : ht('cmd.alias.deletedPrompt');
        return ht('cmd.alias.line', { alias: a.alias, title });
      });
      return {
        kind: 'success' as const,
        text: `${ht('cmd.alias.header', { count: aliases.length })}\n\n${lines.join('\n')}\n\n${ht('cmd.alias.usage')}`
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
