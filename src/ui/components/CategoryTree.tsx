// src/ui/components/CategoryTree.tsx

import React, { useState, useEffect } from 'react';
import { PlusIcon, EditIcon, DeleteIcon } from '../icons';
import { getAllCategories, addCustomCategory, removeCustomCategory } from '../../storage/manager';

interface CategoryTreeProps {
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  onCategoryChange: () => void;  // 分类变更后刷新数据
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

  // 系统预置分类（不可删除/重命名）
  const BUILTIN_CATEGORIES = ['开发', '测试', '文档', '效率'];

  // 加载分类列表
  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = () => {
    setCategories(getAllCategories());
  };

  // ============ 添加分类 ============

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
    // 自动选中新分类
    onSelectCategory(name);
  };

  // ============ 删除分类 ============

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

  // ============ 重命名分类 ============

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
      // 重命名逻辑：删除旧分类，添加新分类
      // 注意：这里简化处理，实际应该遍历所有提示词更新分类
      // 但由于存储层暂不支持批量更新分类，这里先做简单实现
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

  // ============ 右键菜单 ============

  const handleContextMenu = (e: React.MouseEvent, category: string) => {
    e.preventDefault();
    if (BUILTIN_CATEGORIES.includes(category)) {
      // 内置分类只显示查看
      setContextMenu({ category, x: e.clientX, y: e.clientY });
    } else {
      setContextMenu({ category, x: e.clientX, y: e.clientY });
    }
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  // ============ 渲染 ============

  return (
    <>
      {/* 分类列表 */}
      <div style={{ padding: '4px 0' }}>
        {/* 全部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            background: selectedCategory === null ? 'var(--bg-active, #dde4ef)' : 'transparent',
            color: selectedCategory === null ? 'var(--brand-blue, #2e9bff)' : 'var(--text-secondary, #4a4a5a)',
            fontWeight: selectedCategory === null ? 500 : 400,
            borderLeft: selectedCategory === null ? '3px solid var(--brand-blue, #2e9bff)' : '3px solid transparent',
            paddingLeft: selectedCategory === null ? '7px' : '10px',
            transition: 'all 0.15s ease'
          }}
          onClick={() => onSelectCategory(null)}
          onMouseEnter={(e) => {
            if (selectedCategory !== null) {
              e.currentTarget.style.background = 'var(--bg-hover, #eaeef5)';
            }
          }}
          onMouseLeave={(e) => {
            if (selectedCategory !== null) {
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <span>📂 全部</span>
        </div>

        {/* 分类列表 */}
        {categories.map(cat => {
          const isSelected = selectedCategory === cat;
          const isBuiltin = BUILTIN_CATEGORIES.includes(cat);
          return (
            <div
              key={cat}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                background: isSelected ? 'var(--bg-active, #dde4ef)' : 'transparent',
                color: isSelected ? 'var(--brand-blue, #2e9bff)' : 'var(--text-secondary, #4a4a5a)',
                fontWeight: isSelected ? 500 : 400,
                borderLeft: isSelected ? '3px solid var(--brand-blue, #2e9bff)' : '3px solid transparent',
                paddingLeft: isSelected ? '7px' : '10px',
                transition: 'all 0.15s ease'
              }}
              onClick={() => onSelectCategory(cat)}
              onContextMenu={(e) => handleContextMenu(e, cat)}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'var(--bg-hover, #eaeef5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span>{isBuiltin ? '📁' : '📂'} {cat}</span>
              {!isBuiltin && isSelected && (
                <button
                  style={{
                    padding: '2px 6px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted, #7a7a8a)',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRenameCategory(cat);
                  }}
                  title="重命名"
                >
                  ✏️
                </button>
              )}
            </div>
          );
        })}

        {/* 添加分类 */}
        {isAdding ? (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginTop: '8px',
              padding: '4px 0'
            }}
          >
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="输入分类名称"
              autoFocus
              style={{
                flex: 1,
                padding: '4px 8px',
                borderRadius: '4px',
                border: '1px solid var(--brand-blue, #2e9bff)',
                background: 'var(--bg-input, #f0f2f6)',
                color: 'var(--text-primary, #1e1e2f)',
                fontSize: '13px',
                outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCategory();
                if (e.key === 'Escape') setIsAdding(false);
              }}
            />
            <button
              onClick={handleAddCategory}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: 'none',
                background: 'var(--brand-blue, #2e9bff)',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              确定
            </button>
            <button
              onClick={() => setIsAdding(false)}
              style={{
                padding: '4px 12px',
                borderRadius: '4px',
                border: '1px solid var(--border-color, #d0d7e2)',
                background: 'transparent',
                color: 'var(--text-secondary, #4a4a5a)',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              取消
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 10px',
              color: 'var(--text-muted, #7a7a8a)',
              fontSize: '13px',
              cursor: 'pointer',
              borderRadius: '6px',
              marginTop: '4px',
              transition: 'background 0.15s ease'
            }}
            onClick={() => setIsAdding(true)}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-hover, #eaeef5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <PlusIcon size={14} />
            新建分类
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998
            }}
            onClick={handleCloseContextMenu}
          />
          <div
            style={{
              position: 'fixed',
              top: contextMenu.y,
              left: contextMenu.x,
              background: 'var(--bg-card, #ffffff)',
              border: '1px solid var(--border-color, #d0d7e2)',
              borderRadius: '6px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              padding: '4px 0',
              zIndex: 9999,
              minWidth: '140px'
            }}
          >
            <div
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                color: 'var(--text-secondary, #4a4a5a)',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-hover, #eaeef5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                if (contextMenu.category) {
                  handleRenameCategory(contextMenu.category);
                }
              }}
            >
              ✏️ 重命名
            </div>
            <div
              style={{
                padding: '6px 16px',
                fontSize: '13px',
                cursor: 'pointer',
                color: '#dc2626',
                transition: 'background 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fee2e2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
              onClick={() => {
                if (contextMenu.category) {
                  handleDeleteCategory(contextMenu.category);
                }
              }}
            >
              🗑️ 删除
            </div>
          </div>
        </>
      )}
    </>
  );
};
