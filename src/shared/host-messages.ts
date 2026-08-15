// src/shared/host-messages.ts
// Host 端（Node）用户可见消息的双语字典：命令输出 + HTTP API 错误。
// 供 commands/ 与 host/routes/ 引入；client 端 UI 文案见 src/ui/i18n.ts（独立字典）。
// 注意：本文件被 tsconfig.json（host）与 tsconfig.client.json 双双编译，
// 不得引入 Node 或浏览器专属 API。

/** zh 为真理源；en 键集必须与 zh 完全对齐（TS 强制） */
const zh = {
  // ---- 命令：/prompt ----
  'cmd.prompt.desc': 'Prompt Vault 提示词管理 — 列出所有提示词',
  'cmd.prompt.header': '📋 Prompt Vault（共 {count} 条）',
  'cmd.prompt.empty': '  暂无提示词',
  'cmd.prompt.line': '{i}. {title} [{category}]{builtin} — {description}',
  'cmd.prompt.builtin': ' (内置)',
  'cmd.promptList.desc': '列出所有提示词，按分类分组',
  'cmd.promptList.header': '📋 Prompt Vault 分类视图',
  'cmd.promptList.group': '📂 {category}（{count} 条）:',
  'cmd.promptList.item': '  {i}. {title}{builtin}',
  'cmd.promptList.builtin': ' 📌',
  'cmd.promptList.uncategorized': '未分类',

  // ---- 命令：/alias ----
  'cmd.alias.desc': '列出所有已注册的 Prompt 别名',
  'cmd.aliasEntryDesc': '提示词别名 → {title}',
  'cmd.aliasEntryHint': '跟在命令后的内容，用于填充提示词变量',
  'cmd.alias.empty': '🔗 暂无别名。可在 Prompt Vault 面板的提示词卡片上点击「别名」按钮添加',
  'cmd.alias.header': '🔗 别名列表（共 {count} 个）',
  'cmd.alias.line': '  /{alias} → {title}',
  'cmd.alias.deletedPrompt': '（提示词已删除）',
  'cmd.alias.usage': '调用方式：/<别名> [内容]（内容用于填充提示词变量）',

  // ---- 别名调用链 ----
  'invoke.notFound': '别名「/{alias}」已不存在，可用 /alias 查看当前列表',
  'invoke.unknownCwd': '未知',
  'invoke.promptMissing': '别名「/{alias}」指向的提示词在当前工作区、用户级存储及其创建工作区（{cwd}）中均未找到，可能已被删除，请重新设置',
  'invoke.missingVars': '提示词「{title}」缺少必填变量：{names}\n用法：{usage}\n多变量之间用 || 分隔；也可在 Prompt Vault 面板中点击「复制」交互式填写',
  'invoke.copied': '✅ 「{title}」已渲染并复制到剪贴板，粘贴到输入框发送即可',
  'invoke.fallbackEcho': '「{title}」渲染结果（剪贴板不可用，请手动复制）：\n\n{body}',

  // ---- HTTP API 错误 ----
  'api.missingFields': '缺少必填字段（id / title / body）',
  'api.cwdNotAllowed': '工作目录（cwd）不在允许范围内',
  'api.hostForbidden': '请求被拒绝：Host 不在允许范围（仅本机/局域网地址）',
  'api.originForbidden': '请求被拒绝：跨站请求（Origin 校验失败）',
  'api.promptNotFound': '提示词 {id} 不存在',
  'api.idExists': '提示词 ID "{id}" 已存在',
  'api.aliasMissingFields': '缺少必填字段（alias / promptId）',
  'api.aliasPromptNotFound': '提示词 ID「{id}」不存在',
  'api.aliasCmdFailed': '别名已保存，但命令 /{alias} 注册失败（可能与其他命令重名），请换一个别名',
  'api.aliasNameMissing': '缺少别名（?name=）',
  'api.categoryEmpty': '分类名称不能为空',
  'api.categoryNameMissing': '缺少分类名称（?name=）',
  'api.importContentMissing': '缺少导入内容',
  'api.bodyTooLarge': '请求体过大（上限 10MB）',
} as const;

export type HostMessageKey = keyof typeof zh;

const en: Record<HostMessageKey, string> = {
  'cmd.prompt.desc': 'Prompt Vault — list all prompts',
  'cmd.prompt.header': '📋 Prompt Vault ({count} prompts)',
  'cmd.prompt.empty': '  No prompts yet',
  'cmd.prompt.line': '{i}. {title} [{category}]{builtin} — {description}',
  'cmd.prompt.builtin': ' (built-in)',
  'cmd.promptList.desc': 'List all prompts grouped by category',
  'cmd.promptList.header': '📋 Prompt Vault by category',
  'cmd.promptList.group': '📂 {category} ({count}):',
  'cmd.promptList.item': '  {i}. {title}{builtin}',
  'cmd.promptList.builtin': ' 📌',
  'cmd.promptList.uncategorized': 'Uncategorized',

  'cmd.alias.desc': 'List all registered prompt aliases',
  'cmd.aliasEntryDesc': 'Prompt alias → {title}',
  'cmd.aliasEntryHint': 'Content after the command, used to fill prompt variables',
  'cmd.alias.empty': '🔗 No aliases yet. Add one via the "Alias" button on a prompt card in the Prompt Vault panel',
  'cmd.alias.header': '🔗 Aliases ({count})',
  'cmd.alias.line': '  /{alias} → {title}',
  'cmd.alias.deletedPrompt': '(prompt deleted)',
  'cmd.alias.usage': 'Usage: /<alias> [content] (content fills prompt variables)',

  'invoke.notFound': 'Alias "/{alias}" no longer exists. Use /alias to list current aliases',
  'invoke.unknownCwd': 'unknown',
  'invoke.promptMissing': 'The prompt referenced by "/{alias}" was not found in the current workspace, user-level storage, or its origin workspace ({cwd}). It may have been deleted — please set the alias again',
  'invoke.missingVars': 'Prompt "{title}" is missing required variables: {names}\nUsage: {usage}\nSeparate multiple values with ||; or click "Copy" in the Prompt Vault panel to fill them interactively',
  'invoke.copied': '✅ "{title}" rendered and copied to the clipboard. Paste it into the input box and send',
  'invoke.fallbackEcho': 'Rendered "{title}" (clipboard unavailable, please copy manually):\n\n{body}',

  'api.missingFields': 'Missing required fields (id / title / body)',
  'api.cwdNotAllowed': 'Working directory (cwd) is not allowed',
  'api.hostForbidden': 'Request rejected: Host not allowed (local/LAN addresses only)',
  'api.originForbidden': 'Request rejected: cross-site request (Origin check failed)',
  'api.promptNotFound': 'Prompt {id} does not exist',
  'api.idExists': 'Prompt ID "{id}" already exists',
  'api.aliasMissingFields': 'Missing required fields (alias / promptId)',
  'api.aliasPromptNotFound': 'Prompt ID "{id}" does not exist',
  'api.aliasCmdFailed': 'Alias saved, but command /{alias} failed to register (name clash with another command) — please pick another alias',
  'api.aliasNameMissing': 'Missing alias (?name=)',
  'api.categoryEmpty': 'Category name cannot be empty',
  'api.categoryNameMissing': 'Missing category name (?name=)',
  'api.importContentMissing': 'Missing import content',
  'api.bodyTooLarge': 'Request body too large (10MB limit)',
};

const dicts: Record<'zh' | 'en', Record<HostMessageKey, string>> = { zh, en };

/** {name} 插值 */
function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in params ? String(params[k]) : m
  );
}

let active: 'zh' | 'en' = 'zh';

/**
 * 设置 host 端激活语言（apply 时探测，默认 zh）。
 * 探测失败保持 zh —— 与接入前的行为完全一致，无回归风险。
 */
export function setHostLocale(locale: unknown): void {
  const l = (locale as { active?: unknown } | null)?.active;
  if (l === 'zh' || l === 'en') active = l;
}

/** host 端翻译入口 */
export function ht(key: HostMessageKey, params?: Record<string, unknown>): string {
  return interpolate(dicts[active][key], params);
}
