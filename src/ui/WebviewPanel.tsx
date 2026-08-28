// src/ui/WebviewPanel.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  SearchIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  CopyIcon,
  ImportIcon,
  ExportIcon,
  ChevronDownIcon,
  InboxIcon,
  MoonIcon,
  SunIcon,
  BookmarkIcon,
  LinkIcon,
  ListIcon,
  GridIcon,
  XIcon,
  DrawerIcon,
  DialogIcon
} from './icons.js';
import { useTheme, ThemeMode } from './theme.js';
import { usePanelMode, setPanelMode } from './panel-mode.js';
import { injectStyles } from './styles.js';
import { useT, t } from './i18n.js';
import { PromptFormModal } from './components/PromptFormModal.js';
import { CategoryTree } from './components/CategoryTree.js';
import { VariableDialog } from './components/VariableDialog.js';
import { ImportDialog } from './components/ImportDialog.js';
import { ConfirmDialog } from './components/ConfirmDialog.js';
import {
  Prompt,
  Variable,
  AliasEntry,
  getAllCategories,
  getSortedPrompts,
  getAllAliases,
  deletePrompt,
  incrementUsage,
  exportPrompts
} from '../client/api.js';
import { renderTemplate, extractVariablesFromBody } from '../engine/template.js';
import { prepareVariables } from '../engine/variable-resolver.js';
import { AliasDialog } from './components/AliasDialog.js';

// ============ React 组件 ============

/** 由 esbuild define 注入（scripts/build-client.mjs 读取 package.json 版本），保证版本号单源 */
declare const __DSH_INVOKE_VERSION__: string;

// ============ 视图模式（紧凑/舒适）与悬停速览常量 ============

type ViewMode = 'compact' | 'comfortable';

const VIEW_STORAGE_KEY = 'dsh-invoke:view-mode';

/** 悬停速览延迟（ms）：对齐 Voyager 提示词库的 250ms 交互 */
const HOVER_PREVIEW_DELAY_MS = 250;

/** 搜索防抖延迟（ms）：大库下避免每次击键全量过滤触发昂贵重渲染 */
const SEARCH_DEBOUNCE_MS = 250;

/** 速览浮窗宽度（与 styles.ts 的 .pv-preview width 保持一致，用于视口内钳位） */
const PREVIEW_WIDTH = 360;
/** 速览浮窗预估最大高度（标题 + 描述 + 300px 正文 + 内边距） */
const PREVIEW_MAX_HEIGHT = 360;
/** 浮窗与视口边缘的最小间距 */
const PREVIEW_VIEWPORT_MARGIN = 16;

function loadViewMode(): ViewMode {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'compact' ? 'compact' : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

function saveViewMode(mode: ViewMode): void {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, mode);
  } catch {
    // 隐私模式等场景下 localStorage 不可用：仅本次会话生效
  }
}

/** 计算速览浮窗位置：光标右下方，越界时向视口内钳位 */
function getPreviewPosition(x: number, y: number): { left: number; top: number } {
  const m = PREVIEW_VIEWPORT_MARGIN;
  const w = Math.min(PREVIEW_WIDTH, window.innerWidth - 2 * m);
  return {
    left: Math.max(m, Math.min(x + 14, window.innerWidth - w - m)),
    top: Math.max(m, Math.min(y + 14, window.innerHeight - PREVIEW_MAX_HEIGHT - m))
  };
}

export interface WebviewPanelProps {
  /** 预留：可选获取编辑器选中文本的回调（浏览器端暂不注入） */
  getSelectedText?: () => string | null;
  /** 关闭面板（由 client/index.tsx 注入，隐藏挂载根节点） */
  onClose?: () => void;
}

export const WebviewPanel: React.FC<WebviewPanelProps> = ({ getSelectedText: getSelectedTextProp, onClose }) => {
  useT(); // 语言切换时整棵面板树重渲染
  const theme = useTheme(); // 主题：跟随系统 + 手动覆盖
  const panelMode = usePanelMode(); // 面板形态：右侧抽屉 / 居中弹窗（localStorage 持久化）
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // 防抖后的搜索词：列表过滤基于它，输入框即时显示原始值
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  // 数据加载错误态：失败时展示横幅，避免静默失败
  const [loadError, setLoadError] = useState<string | null>(null);

  // 导出下拉菜单状态
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // 卡片展开状态（记录展开的 prompt id 集合）
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 视图模式：紧凑列表 / 舒适网格（localStorage 持久化）
  const [viewMode, setViewMode] = useState<ViewMode>(loadViewMode);

  // 悬停速览：延迟 250ms 后在光标附近浮窗展示完整正文
  const [preview, setPreview] = useState<{ prompt: Prompt; x: number; y: number } | null>(null);
  const previewTimer = useRef<number | null>(null);

  // 变量对话框状态
  const [isVarDialogOpen, setIsVarDialogOpen] = useState(false);
  const [varDialogPrompt, setVarDialogPrompt] = useState<Prompt | null>(null);
  const [varDialogAutoExtract, setVarDialogAutoExtract] = useState<Record<string, string>>({});
  const [varDialogExtract, setVarDialogExtract] = useState<{
    key: string;
    params?: Record<string, string>;
  } | null>(null);
  const [varDialogVars, setVarDialogVars] = useState<Variable[]>([]);

  // 导入对话框状态
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // 删除确认对话框状态
  const [deleteTarget, setDeleteTarget] = useState<Prompt | null>(null);

  // 别名状态
  const [aliases, setAliases] = useState<AliasEntry[]>([]);
  const [aliasTarget, setAliasTarget] = useState<Prompt | null>(null);

  // 注入样式（幂等）
  useEffect(() => {
    injectStyles();
  }, []);

  // 关闭面板：优先走注入的 onClose，回退到直接隐藏挂载根节点
  const closePanel = () => {
    if (onClose) {
      onClose();
    } else {
      document.getElementById('dsh-invoke-root')?.style.setProperty('display', 'none');
    }
  };

  // Esc 分层关闭：弹窗打开时交给弹窗自身处理；下拉打开时先收下拉；否则关闭面板
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (isModalOpen || isVarDialogOpen || isImportDialogOpen || deleteTarget || aliasTarget) return;
      if (isExportMenuOpen) {
        setIsExportMenuOpen(false);
        return;
      }
      closePanel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, isVarDialogOpen, isImportDialogOpen, deleteTarget, aliasTarget, isExportMenuOpen, onClose]);

  // ============ 加载数据 ============

  const loadData = async () => {
    try {
      const [sorted, cats, aliasList] = await Promise.all([
        getSortedPrompts('smart'),
        getAllCategories(),
        getAllAliases()
      ]);
      setPrompts(sorted);
      setCategories(cats);
      setAliases(aliasList);
      setLoadError(null);
    } catch (err) {
      // 展示错误横幅（面板为本地插件，加载失败场景少见，但不应静默）
      setLoadError(err instanceof Error ? err.message : String(err));
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 搜索防抖：输入停止 SEARCH_DEBOUNCE_MS 后才更新过滤依据
  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedQuery(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [searchQuery]);

  const handleCategoryChange = () => {
    loadData();
  };

  // ============ 过滤逻辑 ============

  const filteredPrompts = useMemo(() => {
    let result = prompts;
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (debouncedQuery.trim()) {
      const query = debouncedQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query)) ||
        p.body.toLowerCase().includes(query)
      );
    }
    return result;
  }, [prompts, selectedCategory, debouncedQuery]);

  // promptId → 别名 映射（一个提示词最多一个别名）
  const aliasByPromptId = useMemo(() => {
    const map = new Map<string, AliasEntry>();
    aliases.forEach(a => {
      if (!map.has(a.promptId)) map.set(a.promptId, a);
    });
    return map;
  }, [aliases]);

  // ============ 操作函数 ============

  const handleAdd = () => {
    setEditingPrompt(null);
    setIsModalOpen(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setIsModalOpen(true);
  };

  const handleDelete = (prompt: Prompt) => {
    setDeleteTarget(prompt);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await deletePrompt(deleteTarget.id);
    setDeleteTarget(null);
    loadData();
  };

  // ============ 复制流程（带变量替换） ============

  const handleCopy = (prompt: Prompt) => {
    const varNames = extractVariablesFromBody(prompt.body);

    if (varNames.length === 0) {
      copyToClipboard(prompt.body, prompt.id);
      return;
    }

    const { variables: effectiveVars, autoExtract } = prepareVariables(
      prompt.body,
      prompt.variables || [],
      getSelectedTextProp ? getSelectedTextProp() : null
    );

    setVarDialogPrompt(prompt);
    setVarDialogVars(effectiveVars);
    setVarDialogAutoExtract(autoExtract.values);
    setIsVarDialogOpen(true);
    setVarDialogExtract(
      autoExtract.messageKey
        ? { key: autoExtract.messageKey, params: autoExtract.messageParams }
        : null
    );
  };

  const handleVarDialogConfirm = (values: Record<string, string>) => {
    if (!varDialogPrompt) return;
    const rendered = renderTemplate(varDialogPrompt.body, values);
    copyToClipboard(rendered, varDialogPrompt.id);
    setIsVarDialogOpen(false);
    setVarDialogPrompt(null);
    setVarDialogVars([]);
    setVarDialogExtract(null);
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string, promptId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        incrementUsage(promptId);
        loadData();
        showToast(t('toast.copied'));
      }).catch(() => {
        fallbackCopy(text, promptId);
      });
    } else {
      fallbackCopy(text, promptId);
    }
  };

  const fallbackCopy = (text: string, promptId: string) => {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      incrementUsage(promptId);
      loadData();
      showToast(t('toast.copied'));
    } catch {
      showToast(t('toast.copyFailed'));
    }
    document.body.removeChild(textarea);
  };

  // Toast 提示（对齐官方时序：3s 保持 + 1s 淡出；单实例，新提示替换旧提示）
  const toastRef = useRef<HTMLDivElement | null>(null);
  const showToast = (message: string) => {
    toastRef.current?.remove();
    const toast = document.createElement('div');
    toast.className = 'pv-toast';
    toast.setAttribute('role', 'alert');
    toast.textContent = message;
    document.body.appendChild(toast);
    toastRef.current = toast;
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => {
        toast.remove();
        if (toastRef.current === toast) toastRef.current = null;
      }, 1000);
    }, 3000);
  };

  const handleModalSuccess = () => {
    loadData();
  };

  // ============ 导入导出 ============

  const handleExport = async (format: 'json' | 'yaml') => {
    const date = new Date().toISOString().slice(0, 10);
    const content = await exportPrompts(format);
    const blob = new Blob([content], { type: format === 'yaml' ? 'application/yaml' : 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompts-backup-${date}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t('toast.exported'));
  };

  const handleImportSuccess = () => {
    loadData();
    showToast(t('toast.imported'));
  };

  // ============ 主题切换（仅覆盖插件根容器，不污染全局） ============

  const handleToggleTheme = () => {
    const root = document.getElementById('dsh-invoke-root');
    if (!root) return;
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-pv-theme', next);
  };

  // ============ 面板形态切换（抽屉 ↔ 弹窗，即时生效） ============

  const togglePanelMode = () => {
    setPanelMode(panelMode === 'drawer' ? 'dialog' : 'drawer');
  };

  // ============ 搜索高亮 ============

  // 将 query 命中的片段包装为 <mark>，未命中时原样返回文本
  const highlightText = (text: string, keyPrefix: string): React.ReactNode => {
    const q = searchQuery.trim();
    if (!q) return text;
    const lower = q.toLowerCase();
    const lowerText = text.toLowerCase();
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let key = 0;
    let hit = lowerText.indexOf(lower, cursor);
    while (hit !== -1) {
      if (hit > cursor) parts.push(text.slice(cursor, hit));
      parts.push(
        <mark key={`${keyPrefix}-${key++}`} className="pv-highlight">
          {text.slice(hit, hit + q.length)}
        </mark>
      );
      cursor = hit + q.length;
      hit = lowerText.indexOf(lower, cursor);
    }
    if (cursor < text.length) parts.push(text.slice(cursor));
    return parts.length ? parts : text;
  };

  // ============ 卡片展开 ============

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ============ 视图模式切换 ============

  const toggleViewMode = () => {
    setViewMode(prev => {
      const next: ViewMode = prev === 'compact' ? 'comfortable' : 'compact';
      saveViewMode(next);
      return next;
    });
  };

  // ============ 悬停速览 ============

  const clearPreviewTimer = () => {
    if (previewTimer.current !== null) {
      window.clearTimeout(previewTimer.current);
      previewTimer.current = null;
    }
  };

  /** 关闭速览浮窗并取消未触发的定时器 */
  const closePreview = () => {
    clearPreviewTimer();
    setPreview(null);
  };

  /** 悬停进入卡片/列表行：250ms 后在光标附近弹出速览 */
  const openPreviewLater = (prompt: Prompt, e: React.MouseEvent) => {
    clearPreviewTimer();
    const { clientX: x, clientY: y } = e;
    previewTimer.current = window.setTimeout(() => {
      setPreview({ prompt, x, y });
    }, HOVER_PREVIEW_DELAY_MS);
  };

  // 卸载时清理定时器
  useEffect(() => () => clearPreviewTimer(), []);

  // ============ 导出下拉 ============

  const handleExportClick = (format: 'json' | 'yaml') => {
    setIsExportMenuOpen(false);
    handleExport(format);
  };

  // ============ 渲染 ============

  return (
    <>
      {/* 面板背板遮罩：点击关闭（抽屉左侧 / 弹窗背景区） */}
      <div className="pv-panel-mask" onClick={closePanel} aria-hidden="true" />
      <div className="pv-container">
      {/* 顶栏 */}
      <div className="pv-header">
        <span className="pv-title">
          <BookmarkIcon size={15} className="pv-title-icon" />
          Prompt Vault
        </span>
        <div className="pv-header-actions">
          <button
            className="pv-icon-btn"
            onClick={togglePanelMode}
            title={panelMode === 'drawer' ? t('header.toDialog') : t('header.toDrawer')}
            aria-label={panelMode === 'drawer' ? t('header.toDialog') : t('header.toDrawer')}
            aria-pressed={panelMode === 'drawer'}
          >
            {panelMode === 'drawer' ? <DialogIcon size={16} /> : <DrawerIcon size={16} />}
          </button>
          <button
            className="pv-icon-btn"
            onClick={handleToggleTheme}
            title={theme === 'dark' ? t('header.themeToLight') : t('header.themeToDark')}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>
          <button className="pv-icon-btn" onClick={handleAdd} title={t('header.addTitle')}>
            <PlusIcon size={16} />
          </button>
          <button className="pv-icon-btn" onClick={closePanel} title={t('header.closeTitle')} aria-label={t('header.closeAria')}>
            <XIcon size={16} />
          </button>
        </div>
      </div>

      {/* 主布局 */}
      <div className="pv-main">
        {/* 侧边栏 */}
        <div className="pv-sidebar">
          <CategoryTree
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onCategoryChange={handleCategoryChange}
            prompts={prompts}
          />
        </div>

        {/* 内容区 */}
        <div className="pv-content">
          {loadError && (
            <div className="pv-error-banner" role="alert">
              {t('status.loadError', { message: loadError })}
            </div>
          )}
          {/* 搜索框 */}
          <div className="pv-searchbar">
            <div className="pv-search-wrap">
              <span className="pv-search-icon">
                <SearchIcon size={14} />
              </span>
              <input
                className="pv-search-input"
                type="text"
                placeholder={t('search.placeholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              className="pv-icon-btn pv-view-toggle"
              onClick={toggleViewMode}
              title={viewMode === 'compact' ? t('view.toComfortable') : t('view.toCompact')}
              aria-label={viewMode === 'compact' ? t('view.toComfortable') : t('view.toCompact')}
              aria-pressed={viewMode === 'compact'}
            >
              {viewMode === 'compact' ? <GridIcon size={15} /> : <ListIcon size={15} />}
            </button>
            <span className="pv-stats">{t('search.stats', { count: filteredPrompts.length })}</span>
          </div>

          {/* 列表区：舒适网格 / 紧凑列表 */}
          <div
            className={viewMode === 'compact' ? 'pv-grid pv-grid-compact' : 'pv-grid'}
            onScroll={closePreview}
          >
            {filteredPrompts.length === 0 ? (
              <div className="pv-empty">
                <div className="pv-empty-icon">
                  <InboxIcon size={22} />
                </div>
                <div className="pv-empty-title">
                  {searchQuery || selectedCategory ? t('empty.noMatch') : t('empty.none')}
                </div>
                <div className="pv-empty-desc">
                  {searchQuery || selectedCategory
                    ? t('empty.noMatchDesc')
                    : t('empty.noneDesc')}
                </div>
              </div>
            ) : (
              filteredPrompts.map(prompt => {
                const aliasEntry = aliasByPromptId.get(prompt.id) ?? null;
                // 紧凑列表：单行（标题 + 标签 + 悬停操作），悬停速览看全文
                if (viewMode === 'compact') {
                  return (
                    <div
                      key={prompt.id}
                      className="pv-row"
                      onMouseEnter={(e) => openPreviewLater(prompt, e)}
                      onMouseLeave={closePreview}
                    >
                      <span className="pv-row-title">{highlightText(prompt.title, 't')}</span>
                      <div className="pv-row-meta">
                        {aliasEntry && (
                          <span
                            className="pv-tag pv-tag-alias"
                            role="button"
                            tabIndex={0}
                            title={t('card.aliasTagTitle')}
                            onClick={() => setAliasTarget(prompt)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setAliasTarget(prompt);
                              }
                            }}
                          >
                            /{aliasEntry.alias}
                          </span>
                        )}
                        {prompt.tags.slice(0, 3).map(tag => (
                          <span key={tag} className="pv-tag">{tag}</span>
                        ))}
                        {prompt.builtin && (
                          <span className="pv-tag pv-tag-builtin">{t('card.builtin')}</span>
                        )}
                      </div>
                      <div className="pv-row-actions" onMouseEnter={closePreview}>
                        <button
                          className="pv-card-action-btn"
                          onClick={() => handleCopy(prompt)}
                          title={t('card.copy')}
                          aria-label={t('card.copy')}
                        >
                          <CopyIcon size={13} />
                        </button>
                        <button
                          className="pv-card-action-btn"
                          onClick={() => setAliasTarget(prompt)}
                          title={aliasEntry ? t('card.aliasEdit', { alias: aliasEntry.alias }) : t('card.aliasSet')}
                          aria-label={aliasEntry ? t('card.aliasEdit', { alias: aliasEntry.alias }) : t('card.aliasSet')}
                        >
                          <LinkIcon size={13} />
                        </button>
                        <button
                          className="pv-card-action-btn"
                          onClick={() => handleEdit(prompt)}
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                        >
                          <EditIcon size={13} />
                        </button>
                        <button
                          className="pv-card-action-btn danger"
                          onClick={() => handleDelete(prompt)}
                          title={t('card.deleteTitle')}
                          aria-label={t('card.deleteTitle')}
                        >
                          <DeleteIcon size={13} />
                        </button>
                      </div>
                    </div>
                  );
                }
                // 舒适网格：原有卡片
                return (
                <div
                  key={prompt.id}
                  className="pv-card"
                  onMouseEnter={(e) => openPreviewLater(prompt, e)}
                  onMouseLeave={closePreview}
                >
                  <div className="pv-card-header">
                    <span className="pv-card-title">{highlightText(prompt.title, 't')}</span>
                    <div className="pv-card-actions" onMouseEnter={closePreview}>
                      <button
                        className="pv-card-action-btn"
                        onClick={() => setAliasTarget(prompt)}
                        title={aliasEntry ? t('card.aliasEdit', { alias: aliasEntry.alias }) : t('card.aliasSet')}
                        aria-label={aliasEntry ? t('card.aliasEdit', { alias: aliasEntry.alias }) : t('card.aliasSet')}
                      >
                        <LinkIcon size={13} />
                      </button>
                      <button
                        className="pv-card-action-btn"
                        onClick={() => handleEdit(prompt)}
                        title={t('common.edit')}
                        aria-label={t('common.edit')}
                      >
                        <EditIcon size={13} />
                      </button>
                      <button
                        className="pv-card-action-btn danger"
                        onClick={() => handleDelete(prompt)}
                        title={t('card.deleteTitle')}
                        aria-label={t('card.deleteTitle')}
                      >
                        <DeleteIcon size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="pv-card-desc">{highlightText(prompt.description, 'd')}</div>
                  <div className="pv-card-tags">
                    {aliasEntry && (
                      <span
                        className="pv-tag pv-tag-alias"
                        role="button"
                        tabIndex={0}
                        title={t('card.aliasTagTitle')}
                        onClick={() => setAliasTarget(prompt)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setAliasTarget(prompt);
                          }
                        }}
                      >
                        /{aliasEntry.alias}
                      </span>
                    )}
                    {prompt.tags.map(tag => (
                      <span key={tag} className="pv-tag">{tag}</span>
                    ))}
                    {prompt.builtin && (
                      <span className="pv-tag pv-tag-builtin">{t('card.builtin')}</span>
                    )}
                  </div>

                  {/* 点击展开正文预览 */}
                  <span
                    className="pv-card-expand-hint"
                    onClick={() => toggleExpand(prompt.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedIds.has(prompt.id)}
                    onMouseEnter={closePreview}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(prompt.id);
                      }
                    }}
                  >
                    {expandedIds.has(prompt.id) ? t('card.collapse') : t('card.expand')}
                  </span>
                  {expandedIds.has(prompt.id) && (
                    <div className="pv-card-body">{prompt.body}</div>
                  )}

                  <div className="pv-card-footer">
                    <button
                      className="pv-btn-primary"
                      onClick={() => handleCopy(prompt)}
                    >
                      <CopyIcon size={12} />
                      {t('card.copy')}
                    </button>
                  </div>
                </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* 底部工具栏 */}
      <div className="pv-toolbar">
        <button className="pv-toolbar-btn" onClick={() => setIsImportDialogOpen(true)}>
          <ImportIcon size={12} />
          {t('toolbar.import')}
        </button>

        {/* 导出下拉 */}
        <div className="pv-dropdown">
          <button
            className="pv-toolbar-btn"
            onClick={() => setIsExportMenuOpen(v => !v)}
          >
            <ExportIcon size={12} />
            {t('toolbar.export')}
            <ChevronDownIcon size={12} />
          </button>
          {isExportMenuOpen && (
            <>
              <div className="pv-context-mask" onClick={() => setIsExportMenuOpen(false)} />
              <div className="pv-dropdown-menu">
                <button className="pv-dropdown-item" onClick={() => handleExportClick('json')}>
                  {t('toolbar.exportJson')}
                </button>
                <button className="pv-dropdown-item" onClick={() => handleExportClick('yaml')}>
                  {t('toolbar.exportYaml')}
                </button>
              </div>
            </>
          )}
        </div>

        <span className="pv-spacer" />
        <span className="pv-statusbar">
          v{__DSH_INVOKE_VERSION__} · {t('statusbar.count', { count: prompts.length })}
        </span>
      </div>

      {/* 悬停速览浮窗：固定定位，pointer-events: none 不遮挡下层交互 */}
      {preview && (
        <div
          className="pv-preview"
          role="tooltip"
          style={getPreviewPosition(preview.x, preview.y)}
        >
          <div className="pv-preview-title">{preview.prompt.title}</div>
          {preview.prompt.description && (
            <div className="pv-preview-desc">{preview.prompt.description}</div>
          )}
          <div className="pv-preview-body">{preview.prompt.body}</div>
        </div>
      )}

      {/* 表单弹窗 */}
      <PromptFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        editPrompt={editingPrompt}
        categories={categories}
      />

      {/* 变量替换对话框 */}
      {varDialogPrompt && (
        <VariableDialog
          isOpen={isVarDialogOpen}
          onClose={() => {
            setIsVarDialogOpen(false);
            setVarDialogPrompt(null);
            setVarDialogVars([]);
            setVarDialogExtract(null);
          }}
          onConfirm={handleVarDialogConfirm}
          title={varDialogPrompt.title}
          description={t('varDialog.desc')}
          variables={varDialogVars}
          autoExtractValues={varDialogAutoExtract}
          extractMessageKey={varDialogExtract?.key}
          extractMessageParams={varDialogExtract?.params}
        />
      )}

      {/* 导入对话框 */}
      <ImportDialog
        isOpen={isImportDialogOpen}
        onClose={() => setIsImportDialogOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={t('deleteDialog.title')}
        message={deleteTarget ? t('deleteDialog.message', { title: deleteTarget.title }) : ''}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        danger
        onConfirm={confirmDelete}
        onClose={() => setDeleteTarget(null)}
      />

      {/* 别名设置对话框 */}
      <AliasDialog
        isOpen={!!aliasTarget}
        prompt={aliasTarget}
        currentAlias={aliasTarget ? aliasByPromptId.get(aliasTarget.id) ?? null : null}
        onClose={() => setAliasTarget(null)}
        onChanged={loadData}
      />
      </div>
    </>
  );
};

export default WebviewPanel;

