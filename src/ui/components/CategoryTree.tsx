// src/ui/components/CategoryTree.tsx

import React, { useState, useEffect } from 'react';
import { PlusIcon } from '../icons';
import { injectStyles } from '../styles';
import { getAllCategories, addCustomCategory, removeCustomCategory } from '../../storage/manager';

interface CategoryTreeProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onCategoryChange: () => void;
}

export const CategoryTree: React.FC<CategoryTreeProps> = ({
  selectedCategory,
  onSelectCategory,
  onCategoryChange
}) => {
  const [categories, setCategories] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    category: string;
    x: number;
    y: number;
  } | null>(null);

  const BUILTIN_CATEGORIES = ['开发', '测试', '文档', '效率'];

  useEffect(() => {
    injectStyles();
    loadCategories();
  }, []);

  const loadCategories = () => {
    setCategories(getAllCategories());
  };

  const handleAddCategory = () => {
    const name = newCategoryName.trim();
    if (!name) {
      alert('请输入分类名称');
      return;
    }
    if (categories.includes(name)) {
      alert('分类已存在');
      return;
    }
    addCustomCategory(name);
    loadCategories();
    onCategoryChange();
    setNewCategoryName('');
    setIsAdding(false);
    onSelectCategory(name);
  };

  const handleDeleteCategory = (category: string) => {
    if (BUILTIN_CATEGORIES.includes(category)) {
      alert('系统预置分类不可删除');
      return;
    }
    if (confirm(`确定要删除分类「${category}」吗？\n（提示词不会被删除，但会失去分类关联）`)) {
      removeCustomCategory(category);
      loadCategories();
      onCategoryChange();
      if (selectedCategory === category) {
        onSelectCategory(null);
      }
      setContextMenu(null);
    }
  };

  const handleRenameCategory = (oldName: string) => {
    if (BUILTIN_CATEGORIES.includes(oldName)) {
      alert('系统预置分类不可重命名');
      return;
    }
    const newName = prompt(`将「${oldName}」重命名为：`, oldName);
    if (newName && newName.trim() !== oldName) {
      const trimmed = newName.trim();
      if (!trimmed) {
        alert('分类名称不能为空');
        return;
      }
      if (categories.includes(trimmed) && trimmed !== oldName) {
        alert('分类已存在');
        return;
      }
      removeCustomCategory(oldName);
      addCustomCategory(trimmed);
      loadCategories();
      onCategoryChange();
      if (selectedCategory === oldName) {
        onSelectCategory(trimmed);
      }
      setContextMenu(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    setContextMenu({ category, x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <div style={{ padding: '2px 0' }}>
        {/* 全部 */}
        <div
          className={`pv-cat-item${selectedCategory === null ? ' active' : ''}`}
          onClick={() => onSelectCategory(null)}
        >
          <span>全部</span>
        </div>

        {/* 分类列表 */}
        {categories.map(cat => {
          const isSelected = selectedCategory === cat;
          return (
            <div
              key={cat}
              className={`pv-cat-item${isSelected ? ' active' : ''}`}
              onClick={() => onSelectCategory(cat)}
              onContextMenu={(e) => handleContextMenu(e, cat)}
            >
              <span>{cat}</span>
            </div>
          );
        })}

        {/* 添加分类 */}
        {isAdding ? (
          <div style={{ display: 'flex', gap: 6, marginTop: 6, padding: '2px 0' }}>
            <input
              type="text"
              className="pv-input"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="分类名称"
              autoFocus
              style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
                if (e.key === 'Escape') setIsAdding(false);
              }}
            />
            <button className="pv-btn-primary" style={{ padding: '4px 10px' }} onClick={handleAddCategory}>
              确定
            </button>
          </div>
        ) : (
          <div className="pv-cat-new" onClick={() => setIsAdding(true)}>
            <PlusIcon size={13} />
            新建分类
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setContextMenu(null)}
          />
          <div
            className="pv-context-menu"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            <div
              className="pv-context-item"
              onClick={() => contextMenu.category && handleRenameCategory(contextMenu.category)}
            >
              重命名
            </div>
            <div
              className="pv-context-item danger"
              onClick={() => contextMenu.category && handleDeleteCategory(contextMenu.category)}
            >
              删除
            </div>
          </div>
        </>
      )}
    </>
  );
};

