// src/ui/i18n.ts
// 插件 UI 文案国际化：注册到 Harness 官方 ctx.locale（命名空间 dsh-invoke）。
// 不走 slot 系统时通过 ctx.locale.bind() 获取稳定 t 引用；
// ctx.locale 不可用（旧版 Harness）时回退到内置 zh 字典，行为与接入前一致。

import { useEffect, useState } from 'react';

export type LocaleId = 'zh' | 'en';

/** zh 字典为真理源；en 键集必须与 zh 完全对齐（TS 强制） */
const zh = {
  // 通用
  'common.cancel': '取消',
  'common.confirm': '确定',
  'common.delete': '删除',
  'common.save': '保存',
  'common.edit': '编辑',
  'common.inputRequired': '输入不能为空',

  // 顶栏
  'header.addTitle': '新增提示词',
  'header.closeTitle': '关闭面板 (Esc)',
  'header.closeAria': '关闭面板',
  'header.themeToLight': '切换到亮色模式',
  'header.themeToDark': '切换到暗色模式',

  // 搜索
  'search.placeholder': '搜索标题、描述、标签...',
  'search.stats': '共 {count} 条',

  // 空状态
  'empty.noMatch': '没有匹配的提示词',
  'empty.none': '暂无提示词',
  'empty.noMatchDesc': '换个关键词或分类试试',
  'empty.noneDesc': '点击右上角「+」添加第一条提示词',

  // 视图切换
  'view.toCompact': '切换到紧凑列表',
  'view.toComfortable': '切换到舒适视图',
  'view.compactAria': '紧凑列表视图',
  'view.comfortableAria': '舒适网格视图',

  // 卡片
  'card.aliasEdit': '别名 /{alias}，点击修改',
  'card.aliasSet': '设置别名',
  'card.aliasTagTitle': '点击修改别名',
  'card.deleteTitle': '删除',
  'card.builtin': '示例',
  'card.expand': '展开正文 ▸',
  'card.collapse': '收起正文 ▾',
  'card.copy': '复制',

  // Toast
  'toast.copied': '已复制到剪贴板',
  'toast.copyFailed': '复制失败，请手动复制',
  'toast.exported': '导出成功',
  'toast.imported': '导入成功',

  // 底部工具栏
  'toolbar.import': '导入',
  'toolbar.export': '导出',
  'toolbar.exportJson': '导出 JSON',
  'toolbar.exportYaml': '导出 YAML',
  'toolbar.gist': 'Gist同步',
  'toolbar.gistTitle': 'Gist 同步规划中，敬请期待',
  'statusbar.count': '{count} 条提示词',

  // 加载错误
  'status.loadError': '数据加载失败：{message}',

  // 变量填充弹窗
  'varDialog.desc': '请填充以下变量后复制',
  'varDialog.copy': '复制到剪贴板',
  'varDialog.required': '此字段为必填',
  'varDialog.inputPlaceholder': '请输入 {name}',
  'varDialog.noVars': '此提示词没有变量，点击下方按钮直接复制',

  // 变量自动提取（engine/variable-resolver 返回的 messageKey）
  'varExtract.noSelection': '未选中任何文本，请手动输入',
  'varExtract.wholeContent': '已自动提取选中文本到变量「{name}」',
  'varExtract.failed': '无法从选中文本中自动提取变量，请手动输入',
  'varExtract.extracted': '已自动提取 {count} 个变量（{names}）',

  // 删除确认
  'deleteDialog.title': '删除提示词',
  'deleteDialog.message': '确定要删除「{title}」吗？此操作不可撤销。',

  // 别名弹窗
  'aliasDialog.title': '设置别名',
  'aliasDialog.desc': '为「{title}」设置快捷调用别名。设置后可在输入框用 /别名 内容 快速调用：渲染后的提示词会复制到剪贴板。',
  'aliasDialog.required': '别名不能为空',
  'aliasDialog.saveFailed': '设置失败，请重试',
  'aliasDialog.removeFailed': '删除失败，请重试',
  'aliasDialog.label': '别名',
  'aliasDialog.placeholder': '例如 cr',
  'aliasDialog.hint': '仅小写字母、数字、连字符；不能与 prompt / alias / help 等保留命令重名。',
  'aliasDialog.hintVars': ' 提示词含变量时，命令后的内容会按顺序填充变量（多变量用 || 分隔）。',
  'aliasDialog.remove': '删除别名',

  // 导入弹窗
  'importDialog.title': '导入提示词',
  'importDialog.desc': '从 JSON 或 YAML 文件导入提示词',
  'importDialog.file': '选择文件',
  'importDialog.fileSelected': '已选择: {name}',
  'importDialog.mode': '导入模式',
  'importDialog.merge': '合并（跳过重复）',
  'importDialog.overwrite': '覆盖全部',
  'importDialog.mergeHint': '保留已有提示词，仅添加新的',
  'importDialog.overwriteHint': '用导入的数据完全替换当前所有提示词',
  'importDialog.noFile': '请先选择文件',
  'importDialog.failed': '导入失败',
  'importDialog.loading': '导入中...',
  'importDialog.start': '开始导入',

  // 新增/编辑表单
  'form.editTitle': '编辑提示词',
  'form.addTitle': '新增提示词',
  'form.descEdit': '填写以下信息修改你的提示词',
  'form.descAdd': '填写以下信息创建你的提示词',
  'form.titleLabel': '标题',
  'form.titlePlaceholder': '例如：代码审查',
  'form.descLabel': '描述',
  'form.descPlaceholder': '简要描述提示词的用途',
  'form.categoryLabel': '分类',
  'form.categoryHint': '可在左侧分类树中新增或重命名分类',
  'form.tagsLabel': '标签',
  'form.tagsPlaceholder': '用逗号分隔，例如：review, quality',
  'form.bodyLabel': '正文',
  'form.bodyPlaceholder': '提示词内容，使用 {{变量名}} 作为占位符',
  'form.varsLabel': '变量占位符',
  'form.addVar': '＋ 添加变量',
  'form.varNamePlaceholder': '变量名 (如 code)',
  'form.varTypeLabel': '变量类型',
  'form.varTypeText': '单行文本',
  'form.varTypeTextarea': '多行文本',
  'form.varHint': '可选。在正文中使用 {{变量名}} 引用变量',
  'form.saveChanges': '保存修改',
  'form.create': '创建提示词',
  'form.opFailed': '操作失败，请重试',
  'form.titleRequired': '请输入标题',
  'form.descRequired': '请输入描述',
  'form.categoryRequired': '请选择分类',
  'form.bodyRequired': '请输入提示词正文',
  'form.varNameDuplicated': '变量名不能重复',

  // 分类树
  'category.all': '全部',
  'category.new': '新建分类',
  'category.namePlaceholder': '分类名称',
  'category.hint': '创建分类，按主题整理提示词',
  'category.rename': '重命名',
  'category.cannotDeleteTitle': '无法删除',
  'category.deleteTitle': '删除分类',
  'category.cannotDeleteMsg': '系统预置分类不可删除。',
  'category.deleteMsg': '确定要删除分类「{name}」吗？\n提示词不会被删除，但会失去分类关联。',
  'category.gotIt': '知道了',
  'category.cannotRenameTitle': '无法重命名',
  'category.renameTitle': '重命名分类',
  'category.cannotRenameMsg': '系统预置分类不可重命名。',
  'category.renameMsg': '将「{name}」重命名为：',
  'category.newNamePlaceholder': '新分类名称',
  'category.exists': '该分类名称已存在',
} as const;

export type DictKey = keyof typeof zh;

const en: Record<DictKey, string> = {
  'common.cancel': 'Cancel',
  'common.confirm': 'OK',
  'common.delete': 'Delete',
  'common.save': 'Save',
  'common.edit': 'Edit',
  'common.inputRequired': 'Input cannot be empty',

  'header.addTitle': 'New prompt',
  'header.closeTitle': 'Close panel (Esc)',
  'header.closeAria': 'Close panel',
  'header.themeToLight': 'Switch to light mode',
  'header.themeToDark': 'Switch to dark mode',

  'search.placeholder': 'Search title, description, tags...',
  'search.stats': '{count} items',

  'empty.noMatch': 'No matching prompts',
  'empty.none': 'No prompts yet',
  'empty.noMatchDesc': 'Try a different keyword or category',
  'empty.noneDesc': 'Click "+" in the top right to add your first prompt',

  'view.toCompact': 'Switch to compact list',
  'view.toComfortable': 'Switch to comfortable view',
  'view.compactAria': 'Compact list view',
  'view.comfortableAria': 'Comfortable grid view',

  'card.aliasEdit': 'Alias /{alias}, click to edit',
  'card.aliasSet': 'Set alias',
  'card.aliasTagTitle': 'Click to edit alias',
  'card.deleteTitle': 'Delete',
  'card.builtin': 'Sample',
  'card.expand': 'Expand body ▸',
  'card.collapse': 'Collapse body ▾',
  'card.copy': 'Copy',

  'toast.copied': 'Copied to clipboard',
  'toast.copyFailed': 'Copy failed, please copy manually',
  'toast.exported': 'Exported',
  'toast.imported': 'Imported',

  'toolbar.import': 'Import',
  'toolbar.export': 'Export',
  'toolbar.exportJson': 'Export JSON',
  'toolbar.exportYaml': 'Export YAML',
  'toolbar.gist': 'Gist Sync',
  'toolbar.gistTitle': 'Gist sync is planned, stay tuned',
  'statusbar.count': '{count} prompts',

  // Load error
  'status.loadError': 'Failed to load data: {message}',

  'varDialog.desc': 'Fill in the variables below, then copy',
  'varDialog.copy': 'Copy to clipboard',
  'varDialog.required': 'This field is required',
  'varDialog.inputPlaceholder': 'Enter {name}',
  'varDialog.noVars': 'This prompt has no variables. Click the button below to copy directly',

  'varExtract.noSelection': 'No text selected, please enter values manually',
  'varExtract.wholeContent': 'Selected text auto-filled into variable "{name}"',
  'varExtract.failed': 'Could not auto-extract variables from the selected text, please enter manually',
  'varExtract.extracted': 'Auto-filled {count} variable(s) ({names})',

  'deleteDialog.title': 'Delete prompt',
  'deleteDialog.message': 'Delete "{title}"? This action cannot be undone.',

  'aliasDialog.title': 'Set alias',
  'aliasDialog.desc': 'Set a quick-invoke alias for "{title}". Then use /alias content in the input box: the rendered prompt is copied to the clipboard.',
  'aliasDialog.required': 'Alias cannot be empty',
  'aliasDialog.saveFailed': 'Failed to save, please retry',
  'aliasDialog.removeFailed': 'Failed to remove, please retry',
  'aliasDialog.label': 'Alias',
  'aliasDialog.placeholder': 'e.g. cr',
  'aliasDialog.hint': 'Lowercase letters, digits, and hyphens only; must not clash with reserved commands like prompt / alias / help.',
  'aliasDialog.hintVars': ' When the prompt has variables, content after the command fills them in order (separate multiple values with ||).',
  'aliasDialog.remove': 'Remove alias',

  'importDialog.title': 'Import prompts',
  'importDialog.desc': 'Import prompts from a JSON or YAML file',
  'importDialog.file': 'Choose file',
  'importDialog.fileSelected': 'Selected: {name}',
  'importDialog.mode': 'Import mode',
  'importDialog.merge': 'Merge (skip duplicates)',
  'importDialog.overwrite': 'Overwrite all',
  'importDialog.mergeHint': 'Keep existing prompts, add only new ones',
  'importDialog.overwriteHint': 'Replace all current prompts with the imported data',
  'importDialog.noFile': 'Please choose a file first',
  'importDialog.failed': 'Import failed',
  'importDialog.loading': 'Importing...',
  'importDialog.start': 'Start import',

  'form.editTitle': 'Edit prompt',
  'form.addTitle': 'New prompt',
  'form.descEdit': 'Update your prompt details below',
  'form.descAdd': 'Fill in the details to create your prompt',
  'form.titleLabel': 'Title',
  'form.titlePlaceholder': 'e.g. Code review',
  'form.descLabel': 'Description',
  'form.descPlaceholder': 'Briefly describe what this prompt does',
  'form.categoryLabel': 'Category',
  'form.categoryHint': 'Add or rename categories in the left category tree',
  'form.tagsLabel': 'Tags',
  'form.tagsPlaceholder': 'Comma-separated, e.g. review, quality',
  'form.bodyLabel': 'Body',
  'form.bodyPlaceholder': 'Prompt content, use {{variable}} as placeholders',
  'form.varsLabel': 'Variable placeholders',
  'form.addVar': '＋ Add variable',
  'form.varNamePlaceholder': 'Variable name (e.g. code)',
  'form.varTypeLabel': 'Variable type',
  'form.varTypeText': 'Single-line text',
  'form.varTypeTextarea': 'Multi-line text',
  'form.varHint': 'Optional. Reference variables in the body with {{variable}}',
  'form.saveChanges': 'Save changes',
  'form.create': 'Create prompt',
  'form.opFailed': 'Operation failed, please retry',
  'form.titleRequired': 'Please enter a title',
  'form.descRequired': 'Please enter a description',
  'form.categoryRequired': 'Please choose a category',
  'form.bodyRequired': 'Please enter the prompt body',
  'form.varNameDuplicated': 'Variable names must be unique',

  'category.all': 'All',
  'category.new': 'New category',
  'category.namePlaceholder': 'Category name',
  'category.hint': 'Create categories to organize prompts by topic',
  'category.rename': 'Rename',
  'category.cannotDeleteTitle': 'Cannot delete',
  'category.deleteTitle': 'Delete category',
  'category.cannotDeleteMsg': 'Built-in categories cannot be deleted.',
  'category.deleteMsg': 'Delete category "{name}"?\nPrompts are kept but lose their category.',
  'category.gotIt': 'Got it',
  'category.cannotRenameTitle': 'Cannot rename',
  'category.renameTitle': 'Rename category',
  'category.cannotRenameMsg': 'Built-in categories cannot be renamed.',
  'category.renameMsg': 'Rename "{name}" to:',
  'category.newNamePlaceholder': 'New category name',
  'category.exists': 'This category name already exists',
};

/** 内置插值：{name} 占位符（与官方 Translate 模板语法一致） */
function interpolate(template: string, params?: Record<string, unknown>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in params ? String(params[k]) : m
  );
}

type TranslateFn = (key: string, params?: Record<string, unknown>) => string;

/** 官方绑定引用（setupI18n 成功后非空）；调用时读取当前激活语言 */
let bound: TranslateFn | null = null;
let active: LocaleId = 'zh';
const listeners = new Set<() => void>();

/** 翻译入口：优先官方链路，回退内置 zh 字典（fail loud：缺 key 时原样显示 key） */
export function t(key: DictKey, params?: Record<string, unknown>): string {
  if (bound) return bound(key, params);
  const template = zh[key] ?? key;
  return interpolate(template, params);
}

/** 当前激活语言（供需要按语言分支的逻辑使用） */
export function getLocale(): LocaleId {
  return active;
}

/**
 * 接入官方 locale 服务（在 client apply() 中调用）。
 * ctx.locale 不可用时静默降级为内置 zh，不影响插件加载。
 */
export function setupI18n(ctx: unknown): void {
  // 注意：cordis 懒代理下，未 inject 声明的服务属性访问本身即抛错
  // （"cannot get property 'locale' without inject"），必须整体 try/catch 降级
  let loc: Partial<LocaleService> | undefined;
  try {
    loc = (ctx as { locale?: Partial<LocaleService> } | null)?.locale;
  } catch {
    return;
  }
  if (!loc || typeof loc.register !== 'function' || typeof loc.bind !== 'function') return;
  try {
    loc.register('dsh-invoke', { zh, en });
    bound = loc.bind('dsh-invoke') as TranslateFn;
    if (typeof loc.getLocale === 'function') {
      active = loc.getLocale().active;
    }
    if (typeof loc.subscribe === 'function') {
      loc.subscribe(() => {
        if (typeof loc.getLocale === 'function') {
          active = loc.getLocale().active;
        }
        listeners.forEach((l) => l());
      });
    }
  } catch {
    // 注册失败（如旧版 API 不兼容）：保持内置 zh 回退
  }
}

interface LocaleService {
  register(ns: string, dicts: Record<LocaleId, Record<string, string>>): () => void;
  bind(ns: string): TranslateFn;
  getLocale(): { active: LocaleId };
  subscribe(fn: () => void): () => void;
}

/** React Hook：语言切换时强制重渲染（面板内组件因此统一刷新文案） */
export function useT(): typeof t {
  const [, force] = useState(0);
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return t;
}
