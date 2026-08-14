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
import { injectStyles } from './styles';
import { PromptFormModal } from './components/PromptFormModal';
import { CategoryTree } from './components/CategoryTree';
import { VariableDialog } from './components/VariableDialog';
import { ImportDialog } from './components/ImportDialog';
import {
  Prompt,
  Variable,
  getAllCategories,
  getSortedPrompts,
  deletePrompt,
  incrementUsage
} from '../storage/manager';
import { renderTemplate, extractVariablesFromBody } from '../engine/template';
import { prepareVariables } from '../engine/variable-resolver';
import { exportToJSON, exportToYAML, downloadJSON, downloadYAML } from '../engine/import-export';

// ============ React 组件 ============

export interface WebviewPanelProps {
  /** 可选：获取编辑器当前选中文本的回调（由适配层注入，隔离 Harness API） */
  getSelectedText?: () => string | null;
}

export const WebviewPanel: React.FC<WebviewPanelProps> = ({
  getSelectedText: getSelectedTextProp
}) => {
  useTheme(); // 主题通过 CSS 变量 + body[data-ds-dark-theme] 自动适配
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);

  // 变量对话框状态
  const [isVarDialogOpen, setIsVarDialogOpen] = useState(false);
  const [varDialogPrompt, setVarDialogPrompt] = useState<Prompt | null>(null);
  const [varDialogAutoExtract, setVarDialogAutoExtract] = useState<Record<string, string>>({});
  const [varDialogExtractMessage, setVarDialogExtractMessage] = useState('');
  const [varDialogVars, setVarDialogVars] = useState<Variable[]>([]);

  // 导入对话框状态
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // 注入样式（幂等）
  useEffect(() => {
    injectStyles();
  }, []);

  // ============ 加载数据 ============

  const loadData = () => {
    setPrompts(getSortedPrompts('smart'));
    setCategories(getAllCategories());
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

  // Toast 提示
  const showToast = (message: string) => {
    const toast = document.createElement('div');
    toast.className = 'pv-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2500);
  };

  const handleModalSuccess = () => {
    loadData();
  };

  // ============ 导入导出 ============

  const handleExport = (format: 'json' | 'yaml') => {
    const date = new Date().toISOString().slice(0, 10);
    if (format === 'yaml') {
      downloadYAML(exportToYAML(), `prompts-backup-${date}.yaml`);
    } else {
      downloadJSON(exportToJSON(), `prompts-backup-${date}.json`);
    }
    showToast('导出成功');
  };

  const handleImportSuccess = () => {
    loadData();
    showToast('导入成功');
  };

  // ============ 渲染 ============

  return (
    <div className="pv-container">
      {/* 顶栏 */}
      <div className="pv-header">
        <span className="pv-title">Prompt Vault</span>
        <button className="pv-icon-btn" onClick={handleAdd} title="新增提示词">
          <PlusIcon size={16} />
        </button>
      </div>

      {/* 主布局 */}
      <div className="pv-main">
        {/* 侧边栏 */}
        <div className="pv-sidebar">
          <CategoryTree
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onCategoryChange={handleCategoryChange}
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
                {searchQuery || selectedCategory ? '没有匹配的提示词' : '暂无提示词，点击「+」添加第一条'}
              </div>
            ) : (
              filteredPrompts.map(prompt => (
                <div key={prompt.id} className="pv-card">
                  <div className="pv-card-header">
                    <span className="pv-card-title">{prompt.title}</span>
                    <div className="pv-card-actions">
                      <button
                        className="pv-card-action-btn"
                        onClick={() => handleEdit(prompt)}
                        title="编辑"
                      >
                        <EditIcon size={13} />
                      </button>
                      <button
                        className="pv-card-action-btn danger"
                        onClick={() => handleDelete(prompt.id)}
                        title="删除"
                      >
                        <DeleteIcon size={13} />
                      </button>
                    </div>
                  </div>
                  <div className="pv-card-desc">{prompt.description}</div>
                  <div className="pv-card-tags">
                    {prompt.tags.map(tag => (
                      <span key={tag} className="pv-tag">{tag}</span>
                    ))}
                    {prompt.builtin && (
                      <span className="pv-tag pv-tag-builtin">示例</span>
                    )}
                  </div>
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
              ))
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
        <button className="pv-toolbar-btn" onClick={() => handleExport('json')}>
          <ExportIcon size={12} />
          导出
        </button>
        <button className="pv-toolbar-btn" onClick={() => handleExport('yaml')}>
          <ExportIcon size={12} />
          导出YAML
        </button>
        <button className="pv-toolbar-btn">
          <GistIcon size={12} />
          Gist同步
        </button>
        <span className="pv-spacer" />
        <span className="pv-statusbar">
          v0.1.0 · {prompts.length} 条提示词
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
    </div>
  );
};

export default WebviewPanel;

