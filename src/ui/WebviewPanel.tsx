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
  GistIcon,
  ChevronDownIcon,
  InboxIcon,
  MoonIcon,
  SunIcon,
  BookmarkIcon,
  LinkIcon,
  XIcon
} from './icons.js';
import { useTheme, ThemeMode } from './theme.js';
import { injectStyles } from './styles.js';
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

export interface WebviewPanelProps {
  /** 预留：可选获取编辑器选中文本的回调（浏览器端暂不注入） */
  getSelectedText?: () => string | null;
  /** 关闭面板（由 client/index.ts 注入，隐藏挂载根节点） */
  onClose?: () => void;
}

export const WebviewPanel: React.FC<WebviewPanelProps> = ({ getSelectedText: getSelectedTextProp, onClose }) => {
  const theme = useTheme(); // 主题：跟随系统 + 手动覆盖
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  // 导出下拉菜单状态
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

  // 卡片展开状态（记录展开的 prompt id 集合）
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // 变量对话框状态
  const [isVarDialogOpen, setIsVarDialogOpen] = useState(false);
  const [varDialogPrompt, setVarDialogPrompt] = useState<Prompt | null>(null);
  const [varDialogAutoExtract, setVarDialogAutoExtract] = useState<Record<string, string>>({});
  const [varDialogExtractMessage, setVarDialogExtractMessage] = useState('');
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
    const [sorted, cats, aliasList] = await Promise.all([
      getSortedPrompts('smart'),
      getAllCategories(),
      getAllAliases()
    ]);
    setPrompts(sorted);
    setCategories(cats);
    setAliases(aliasList);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCategoryChange = () => {
    loadData();
  };

  // ============ 过滤逻辑 ============

  const filteredPrompts = useMemo(() => {
    let result = prompts;
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }
    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(p =>
        p.title.toLowerCase().includes(query) ||
        p.description.toLowerCase().includes(query) ||
        p.tags.some(tag => tag.toLowerCase().includes(query)) ||
        p.body.toLowerCase().includes(query)
      );
    }
    return result;
  }, [prompts, selectedCategory, searchQuery]);

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
    setVarDialogExtractMessage(autoExtract.message);
  };

  const handleVarDialogConfirm = (values: Record<string, string>) => {
    if (!varDialogPrompt) return;
    const rendered = renderTemplate(varDialogPrompt.body, values);
    copyToClipboard(rendered, varDialogPrompt.id);
    setIsVarDialogOpen(false);
    setVarDialogPrompt(null);
    setVarDialogVars([]);
    setVarDialogExtractMessage('');
  };

  // 复制到剪贴板
  const copyToClipboard = (text: string, promptId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        incrementUsage(promptId);
        loadData();
        showToast('已复制到剪贴板');
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
      showToast('已复制到剪贴板');
    } catch {
      showToast('复制失败，请手动复制');
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
    showToast('导出成功');
  };

  const handleImportSuccess = () => {
    loadData();
    showToast('导入成功');
  };

  // ============ 主题切换（仅覆盖插件根容器，不污染全局） ============

  const handleToggleTheme = () => {
    const root = document.getElementById('dsh-invoke-root');
    if (!root) return;
    const next: ThemeMode = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-pv-theme', next);
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

  // ============ 导出下拉 ============

  const handleExportClick = (format: 'json' | 'yaml') => {
    setIsExportMenuOpen(false);
    handleExport(format);
  };

  // ============ 渲染 ============

  return (
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
            onClick={handleToggleTheme}
            title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
          </button>
          <button className="pv-icon-btn" onClick={handleAdd} title="新增提示词">
            <PlusIcon size={16} />
          </button>
          <button className="pv-icon-btn" onClick={closePanel} title="关闭面板 (Esc)" aria-label="关闭面板">
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
          {/* 搜索框 */}
          <div className="pv-searchbar">
            <div className="pv-search-wrap">
              <span className="pv-search-icon">
                <SearchIcon size={14} />
              </span>
              <input
                className="pv-search-input"
                type="text"
                placeholder="搜索标题、描述、标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="pv-stats">共 {filteredPrompts.length} 条</span>
          </div>

          {/* 卡片网格 */}
          <div className="pv-grid">
            {filteredPrompts.length === 0 ? (
              <div className="pv-empty">
                <div className="pv-empty-icon">
                  <InboxIcon size={22} />
                </div>
                <div className="pv-empty-title">
                  {searchQuery || selectedCategory ? '没有匹配的提示词' : '暂无提示词'}
                </div>
                <div className="pv-empty-desc">
                  {searchQuery || selectedCategory
                    ? '换个关键词或分类试试'
                    : '点击右上角「+」添加第一条提示词'}
                </div>
              </div>
            ) : (
              filteredPrompts.map(prompt => {
                const aliasEntry = aliasByPromptId.get(prompt.id) ?? null;
                return (
                <div key={prompt.id} className="pv-card">
                  <div className="pv-card-header">
                    <span className="pv-card-title">{highlightText(prompt.title, 't')}</span>
                    <div className="pv-card-actions">
                      <button
                        className="pv-card-action-btn"
                        onClick={() => setAliasTarget(prompt)}
                        title={aliasEntry ? `别名 /${aliasEntry.alias}，点击修改` : '设置别名'}
                      >
                        <LinkIcon size={13} />
                      </button>
                      <button
                        className="pv-card-action-btn"
                        onClick={() => handleEdit(prompt)}
                        title="编辑"
                      >
                        <EditIcon size={13} />
                      </button>
                      <button
                        className="pv-card-action-btn danger"
                        onClick={() => handleDelete(prompt)}
                        title="删除"
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
                        title="点击修改别名"
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
                      <span className="pv-tag pv-tag-builtin">示例</span>
                    )}
                  </div>

                  {/* 点击展开正文预览 */}
                  <span
                    className="pv-card-expand-hint"
                    onClick={() => toggleExpand(prompt.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={expandedIds.has(prompt.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleExpand(prompt.id);
                      }
                    }}
                  >
                    {expandedIds.has(prompt.id) ? '收起正文 ▾' : '展开正文 ▸'}
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
                      复制
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
          导入
        </button>

        {/* 导出下拉 */}
        <div className="pv-dropdown">
          <button
            className="pv-toolbar-btn"
            onClick={() => setIsExportMenuOpen(v => !v)}
          >
            <ExportIcon size={12} />
            导出
            <ChevronDownIcon size={12} />
          </button>
          {isExportMenuOpen && (
            <>
              <div className="pv-context-mask" onClick={() => setIsExportMenuOpen(false)} />
              <div className="pv-dropdown-menu">
                <button className="pv-dropdown-item" onClick={() => handleExportClick('json')}>
                  导出 JSON
                </button>
                <button className="pv-dropdown-item" onClick={() => handleExportClick('yaml')}>
                  导出 YAML
                </button>
              </div>
            </>
          )}
        </div>

        <button className="pv-toolbar-btn" disabled title="Gist 同步规划中，敬请期待">
          <GistIcon size={12} />
          Gist同步
        </button>
        <span className="pv-spacer" />
        <span className="pv-statusbar">
          v{__DSH_INVOKE_VERSION__} · {prompts.length} 条提示词
        </span>
      </div>

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
            setVarDialogExtractMessage('');
          }}
          onConfirm={handleVarDialogConfirm}
          title={varDialogPrompt.title}
          description="请填充以下变量后复制"
          variables={varDialogVars}
          autoExtractValues={varDialogAutoExtract}
          extractMessage={varDialogExtractMessage}
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
        title="删除提示词"
        message={deleteTarget ? `确定要删除「${deleteTarget.title}」吗？此操作不可撤销。` : ''}
        confirmText="删除"
        cancelText="取消"
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
  );
};

export default WebviewPanel;

