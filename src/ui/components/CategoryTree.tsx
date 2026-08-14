// src/ui/components/CategoryTree.tsx

import React, { useState, useEffect, useMemo } from 'react';
import { PlusIcon } from '../icons';
import { injectStyles } from '../styles';
import { Prompt, getAllCategories, addCustomCategory, removeCustomCategory } from '../../client/api';
import { ConfirmDialog } from './ConfirmDialog';

interface CategoryTreeProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onCategoryChange: () => void;
  /** 当前提示词列表，用于计算分类计数 */
  prompts?: Prompt[];
}

interface DialogState {
  type: 'delete' | 'rename' | null;
  category: string;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  selectedCategory,
  onSelectCategory,
  onCategoryChange,
  prompts = []
}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    category: string;
    x: number;
    y: number;
  } | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ type: null, category: '' });

  const BUILTIN_CATEGORIES = ['开发', '测试', '文档', '效率'];

  useEffect(() => {
    injectStyles();
    loadCategories();
  }, []);

  const loadCategories = async () => {
    setCategories(await getAllCategories());
  };

  // 分类计数（基于提示词列表计算，保持实时）
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    prompts.forEach(p => {
      const key = p.category || '未分类';
      map[key] = (map[key] || 0) + 1;
    });
    return map;
  }, [prompts]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setIsAdding(false);
      return;
    }
    if (categories.includes(name)) {
      setIsAdding(false);
      return;
    }
    await addCustomCategory(name);
    await loadCategories();
    onCategoryChange();
    setNewCategoryName('');
    setIsAdding(false);
    onSelectCategory(name);
  };

  const handleDeleteCategory = (category: string) => {
    setDialog({ type: 'delete', category });
  };

  const confirmDelete = async () => {
    const category = dialog.category;
    await removeCustomCategory(category);
    await loadCategories();
    onCategoryChange();
    if (selectedCategory === category) {
      onSelectCategory(null);
    }
    setDialog({ type: null, category: '' });
    setContextMenu(null);
  };

  const handleRenameCategory = (oldName: string) => {
    setRenameError('');
    setDialog({ type: 'rename', category: oldName });
  };

  const confirmRename = async (newName?: string) => {
    const oldName = dialog.category;
    if (!newName || newName === oldName) {
      setDialog({ type: null, category: '' });
      setRenameError('');
      return;
    }
    if (categories.includes(newName)) {
      setRenameError('该分类名称已存在');
      return; // 保持弹窗打开，提示重名
    }
    await removeCustomCategory(oldName);
    await addCustomCategory(newName);
    await loadCategories();
    onCategoryChange();
    if (selectedCategory === oldName) {
      onSelectCategory(newName);
    }
    setDialog({ type: null, category: '' });
    setRenameError('');
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    setContextMenu({ category, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div style={{ padding: '2px 0' }}>
        {/* 全部 */}
        <button
          type="button"
          className={`pv-cat-item${selectedCategory === null ? ' active' : ''}`}
          onClick={() => onSelectCategory(null)}
        >
          <span>全部</span>
          <span className="pv-cat-count">{prompts.length}</span>
        </button>

        {/* 分类列表 */}
        {categories.map(cat => {
          const isSelected = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`pv-cat-item${isSelected ? ' active' : ''}`}
              onClick={() => onSelectCategory(cat)}
              onContextMenu={(e) => handleContextMenu(e, cat)}
            >
              <span>{cat}</span>
              <span className="pv-cat-count">{counts[cat] || 0}</span>
            </button>
          );
        })}

        {/* 添加分类 */}
        {isAdding ? (
          <div className="pv-cat-input-row">
            <input
              type="text"
              className="pv-input"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="分类名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
                if (e.key === 'Escape') setIsAdding(false);
              }}
            />
            <button type="button" className="pv-btn-primary pv-btn-sm" onClick={handleAddCategory}>
              确定
            </button>
          </div>
        ) : (
          <button type="button" className="pv-cat-new" onClick={() => setIsAdding(true)}>
            <PlusIcon size={13} />
            新建分类
          </button>
        )}
        {categories.length === 0 && (
          <div className="pv-cat-hint">创建分类，按主题整理提示词</div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            className="pv-context-mask"
            onClick={() => setContextMenu(null)}
          />
          <div
            className="pv-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <button
              type="button"
              className="pv-context-item"
              onClick={() => contextMenu.category && handleRenameCategory(contextMenu.category)}
            >
              重命名
            </button>
            <button
              type="button"
              className="pv-context-item danger"
              onClick={() => contextMenu.category && handleDeleteCategory(contextMenu.category)}
            >
              删除
            </button>
          </div>
        </>
      )}

      {/* 删除/重命名确认弹窗 */}
      {dialog.type === 'delete' && (
        <ConfirmDialog
          isOpen
          title={BUILTIN_CATEGORIES.includes(dialog.category) ? '无法删除' : '删除分类'}
          message={BUILTIN_CATEGORIES.includes(dialog.category)
            ? '系统预置分类不可删除。'
            : `确定要删除分类「${dialog.category}」吗？\n提示词不会被删除，但会失去分类关联。`}
          confirmText={BUILTIN_CATEGORIES.includes(dialog.category) ? '知道了' : '删除'}
          danger
          onConfirm={() => BUILTIN_CATEGORIES.includes(dialog.category)
            ? setDialog({ type: null, category: '' })
            : confirmDelete()}
          onClose={() => setDialog({ type: null, category: '' })}
        />
      )}
      {dialog.type === 'rename' && (
        <ConfirmDialog
          isOpen
          title={BUILTIN_CATEGORIES.includes(dialog.category) ? '无法重命名' : '重命名分类'}
          message={BUILTIN_CATEGORIES.includes(dialog.category)
            ? '系统预置分类不可重命名。'
            : `将「${dialog.category}」重命名为：`}
          confirmText={BUILTIN_CATEGORIES.includes(dialog.category) ? '知道了' : '确定'}
          showInput={!BUILTIN_CATEGORIES.includes(dialog.category)}
          initialInput={dialog.category}
          inputPlaceholder="新分类名称"
          error={renameError}
          onConfirm={(v) => BUILTIN_CATEGORIES.includes(dialog.category)
            ? setDialog({ type: null, category: '' })
            : confirmRename(v)}
          onClose={() => { setDialog({ type: null, category: '' }); setRenameError(''); }}
        />
      )}
    </>
  );
};