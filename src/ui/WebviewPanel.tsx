// src/ui/WebviewPanel.tsx

import React, { useState, useEffect, useMemo } from 'react';
import {
  SearchIcon,
  PlusIcon,
  EditIcon,
  DeleteIcon,
  CopyIcon,
  ImportIcon,
  ExportIcon,
  GistIcon
} from './icons';
import { useTheme } from './theme';
import { PromptFormModal } from './components/PromptFormModal';
import { CategoryTree } from './components/CategoryTree';
import { VariableDialog } from './components/VariableDialog';
import {
  Prompt,
  getAllPrompts,
  deletePrompt,
  incrementUsage
} from '../storage/manager';
import { renderTemplate, extractVariablesFromBody } from '../engine/template';

// ============ CSS 样式 ============

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    padding: '16px 20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: 'var(--text-primary, #1e1e2f)',
    background: 'var(--bg-primary, #ffffff)',
    transition: 'background 0.2s ease, color 0.2s ease'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px'
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--brand-blue, #2e9bff)'
  },
  headerActions: {
    display: 'flex',
    gap: '6px'
  },
  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    border: 'none',
    background: 'transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    color: 'var(--text-secondary, #4a4a5a)',
    transition: 'background 0.2s ease'
  },
  mainLayout: {
    display: 'flex' as const,
    flex: 1,
    overflow: 'hidden' as const,
    gap: '16px'
  },
  sidebar: {
    width: '180px',
    flexShrink: 0,
    overflowY: 'auto' as const,
    paddingRight: '8px',
    borderRight: '1px solid var(--border-color, #d0d7e2)'
  },
  contentArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const
  },
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '12px',
    flexShrink: 0
  },
  searchWrapper: {
    position: 'relative' as const,
    flex: 1
  },
  searchIcon: {
    position: 'absolute' as const,
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: 'var(--text-muted, #7a7a8a)'
  },
  searchInput: {
    width: '100%',
    padding: '6px 12px 6px 34px',
    borderRadius: '6px',
    border: '1px solid var(--border-color, #d0d7e2)',
    background: 'var(--bg-input, #f0f2f6)',
    color: 'var(--text-primary, #1e1e2f)',
    fontSize: '13px',
    outline: 'none',
    transition: 'border 0.2s ease'
  },
  stats: {
    fontSize: '12px',
    color: 'var(--text-muted, #7a7a8a)',
    whiteSpace: 'nowrap' as const
  },
  cardGrid: {
    flex: 1,
    overflowY: 'auto' as const,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    alignContent: 'start',
    paddingRight: '4px'
  },
  card: {
    background: 'var(--bg-card, #ffffff)',
    border: '1px solid var(--border-color, #d0d7e2)',
    borderRadius: '8px',
    padding: '12px 14px',
    transition: 'border 0.2s ease, box-shadow 0.2s ease',
    cursor: 'default'
  },
  cardHover: {
    borderColor: 'var(--brand-blue, #2e9bff)',
    boxShadow: '0 4px 12px rgba(46,155,255,0.08)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '8px',
    marginBottom: '4px'
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary, #1e1e2f)'
  },
  cardActions: {
    display: 'flex',
    gap: '2px',
    opacity: 0.4,
    transition: 'opacity 0.2s ease'
  },
  cardActionsVisible: {
    opacity: 1
  },
  cardDesc: {
    fontSize: '13px',
    color: 'var(--text-secondary, #4a4a5a)',
    lineHeight: 1.4,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical' as const,
    overflow: 'hidden',
    marginBottom: '4px'
  },
  cardTags: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: '4px',
    marginBottom: '6px'
  },
  tag: {
    fontSize: '10px',
    padding: '1px 8px',
    borderRadius: '12px',
    background: 'var(--tag-bg, #e8edf5)',
    color: 'var(--tag-text, #3a4a5a)',
    border: '1px solid var(--border-color, #d0d7e2)'
  },
  tagBuiltin: {
    background: 'var(--brand-blue, #2e9bff)',
    color: '#fff',
    borderColor: 'var(--brand-blue, #2e9bff)'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end'
  },
  copyBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 12px',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--brand-blue, #2e9bff)',
    color: '#ffffff',
    fontSize: '12px',
    cursor: 'pointer',
    transition: 'background 0.2s ease'
  },
  emptyState: {
    gridColumn: '1 / -1',
    textAlign: 'center' as const,
    padding: '40px 0',
    color: 'var(--text-muted, #7a7a8a)'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    paddingTop: '10px',
    marginTop: '10px',
    borderTop: '1px solid var(--border-color, #d0d7e2)',
    fontSize: '12px',
    color: 'var(--text-muted, #7a7a8a)',
    flexShrink: 0
  },
  toolbarBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '6px',
    border: '1px solid var(--border-color, #d0d7e2)',
    background: 'var(--bg-secondary, #f3f5f9)',
    color: 'var(--text-secondary, #4a4a5a)',
    fontSize: '11px',
    cursor: 'pointer',
    transition: 'border 0.2s ease'
  },
  spacer: {
    flex: 1
  },
  statusBar: {
    fontSize: '11px',
    color: 'var(--text-muted, #7a7a8a)'
  }
};

// ============ React 组件 ============

export const WebviewPanel: React.FC = () => {
  const theme = useTheme();
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  // ============ 变量对话框状态 ============

  const [isVarDialogOpen, setIsVarDialogOpen] = useState(false);
  const [varDialogPrompt, setVarDialogPrompt] = useState<Prompt | null>(null);
  const [varDialogAutoExtract, setVarDialogAutoExtract] = useState<Record<string, string>>({});

  // 加载数据
  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    setPrompts(getAllPrompts());
  };

  const handleCategoryChange = () => {
    loadData();
  };

  // 过滤逻辑
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

  // ============ 操作函数 ============

  const handleAdd = () => {
    setEditingPrompt(null);
    setIsModalOpen(true);
  };

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除这个提示词吗？')) {
      deletePrompt(id);
      loadData();
    }
  };

  // ============ 复制流程（带变量替换） ============

  const handleCopy = (prompt: Prompt) => {
    // 提取正文中的所有变量名
    const varNames = extractVariablesFromBody(prompt.body);

    // 如果没有变量，直接复制
    if (varNames.length === 0) {
      copyToClipboard(prompt.body, prompt.id);
      return;
    }

    // 检查提示词是否定义了变量元数据
    const definedVars = prompt.variables || [];

    // 如果提示词没有定义变量元数据，但有变量占位符，
    // 自动生成变量定义
    const effectiveVars = definedVars.length > 0
      ? definedVars
      : varNames.map(name => ({
          name,
          type: 'text' as const,
          placeholder: `请输入 ${name}`,
          required: true
        }));

    // 尝试从编辑器选区自动提取（实验性功能）
    // TODO: 后续与 Harness API 集成
    const autoExtract: Record<string, string> = {};

    // 打开变量对话框
    setVarDialogPrompt(prompt);
    setVarDialogAutoExtract(autoExtract);
    setIsVarDialogOpen(true);
  };

  // 变量对话框确认回调
  const handleVarDialogConfirm = (values: Record<string, string>) => {
    if (!varDialogPrompt) return;

    // 渲染模板
    const rendered = renderTemplate(varDialogPrompt.body, values);

    // 复制到剪贴板
    copyToClipboard(rendered, varDialogPrompt.id);

    // 关闭对话框
    setIsVarDialogOpen(false);
    setVarDialogPrompt(null);
  };

  // 复制到剪贴板（通用函数）
  const copyToClipboard = (text: string, promptId: string) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        incrementUsage(promptId);
        loadData();
        showToast('✅ 已复制到剪贴板');
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
      showToast('✅ 已复制到剪贴板');
    } catch {
      showToast('⚠️ 复制失败，请手动复制');
    }
    document.body.removeChild(textarea);
  };

  // Toast 提示
  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.textContent = message;
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '30px',
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '8px 20px',
      borderRadius: '20px',
      background: 'var(--toast-bg, #2d2d3d)',
      color: 'var(--toast-text, #ffffff)',
      fontSize: '13px',
      zIndex: '9999',
      boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
      transition: 'opacity 0.3s ease'
    });
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2500);
  };

  const handleModalSuccess = () => {
    loadData();
  };

  // ============ 渲染 ============

  return (
    <div style={styles.container}>
      {/* 顶栏 */}
      <div style={styles.header}>
        <span style={styles.title}>Prompt Vault</span>
        <div style={styles.headerActions}>
          <button style={styles.iconButton} onClick={handleAdd} title="新增提示词">
            <PlusIcon size={18} />
          </button>
        </div>
      </div>

      {/* 主布局：侧边栏 + 内容区 */}
      <div style={styles.mainLayout}>
        {/* 侧边栏：分类树 */}
        <div style={styles.sidebar}>
          <CategoryTree
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onCategoryChange={handleCategoryChange}
          />
        </div>

        {/* 内容区 */}
        <div style={styles.contentArea}>
          {/* 搜索框 */}
          <div style={styles.searchBar}>
            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>
                <SearchIcon size={15} />
              </span>
              <input
                style={styles.searchInput}
                type="text"
                placeholder="搜索标题、描述、标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <span style={styles.stats}>共 {filteredPrompts.length} 条</span>
          </div>

          {/* 卡片网格 */}
          <div style={styles.cardGrid}>
            {filteredPrompts.length === 0 ? (
              <div style={styles.emptyState}>
                {searchQuery || selectedCategory ? '没有匹配的提示词' : '📭 暂无提示词，点击「新增」添加第一条'}
              </div>
            ) : (
              filteredPrompts.map(prompt => {
                const isHovered = hoveredCardId === prompt.id;
                return (
                  <div
                    key={prompt.id}
                    style={{
                      ...styles.card,
                      ...(isHovered ? styles.cardHover : {})
                    }}
                    onMouseEnter={() => setHoveredCardId(prompt.id)}
                    onMouseLeave={() => setHoveredCardId(null)}
                  >
                    <div style={styles.cardHeader}>
                      <span style={styles.cardTitle}>{prompt.title}</span>
                      <div style={{
                        ...styles.cardActions,
                        ...(isHovered ? styles.cardActionsVisible : {})
                      }}>
                        <button
                          style={styles.iconButton}
                          onClick={() => handleEdit(prompt)}
                          title="编辑"
                        >
                          <EditIcon size={14} />
                        </button>
                        <button
                          style={styles.iconButton}
                          onClick={() => handleDelete(prompt.id)}
                          title="删除"
                        >
                          <DeleteIcon size={14} />
                        </button>
                      </div>
                    </div>
                    <div style={styles.cardDesc}>{prompt.description}</div>
                    <div style={styles.cardTags}>
                      {prompt.tags.map(tag => (
                        <span key={tag} style={styles.tag}>{tag}</span>
                      ))}
                      {prompt.builtin && (
                        <span style={{ ...styles.tag, ...styles.tagBuiltin }}>示例</span>
                      )}
                    </div>
                    <div style={styles.cardFooter}>
                      <button
                        style={styles.copyBtn}
                        onClick={() => handleCopy(prompt)}
                      >
                        <CopyIcon size={13} />
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
      <div style={styles.toolbar}>
        <button style={styles.toolbarBtn}>
          <ImportIcon size={13} />
          导入
        </button>
        <button style={styles.toolbarBtn}>
          <ExportIcon size={13} />
          导出
        </button>
        <button style={styles.toolbarBtn}>
          <GistIcon size={13} />
          Gist同步
        </button>
        <span style={styles.spacer} />
        <span style={styles.statusBar}>
          v0.1.0 · {prompts.length} 条提示词
        </span>
      </div>

      {/* 表单弹窗 */}
      <PromptFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        editPrompt={editingPrompt}
      />

      {/* 变量替换对话框 */}
      {varDialogPrompt && (
        <VariableDialog
          isOpen={isVarDialogOpen}
          onClose={() => {
            setIsVarDialogOpen(false);
            setVarDialogPrompt(null);
          }}
          onConfirm={handleVarDialogConfirm}
          title={varDialogPrompt.title}
          description="请填充以下变量后复制"
          variables={varDialogPrompt.variables || []}
          autoExtractValues={varDialogAutoExtract}
        />
      )}
    </div>
  );
};

export default WebviewPanel;
