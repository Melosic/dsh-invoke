// src/ui/components/PromptFormModal.tsx

import React, { useState, useEffect } from 'react';
import { Prompt, Variable, addPrompt, updatePrompt, getAllCategories } from '../../storage/manager';

interface PromptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPrompt?: Prompt | null;  // 有值时为编辑模式，否则为新增模式
}

export const PromptFormModal: React.FC<PromptFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editPrompt
}) => {
  const isEditMode = !!editPrompt;

  // ============ 表单状态 ============

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState<Variable[]>([
    { name: '', type: 'text', placeholder: '', required: false }
  ]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [error, setError] = useState('');

  // ============ 加载数据 ============

  useEffect(() => {
    if (isOpen) {
      // 加载分类列表
      const allCats = getAllCategories();
      setCustomCategories(allCats);

      // 如果是编辑模式，填充表单
      if (editPrompt) {
        setTitle(editPrompt.title);
        setDescription(editPrompt.description);
        setCategory(editPrompt.category);
        setTags(editPrompt.tags.join(', '));
        setBody(editPrompt.body);
        setVariables(editPrompt.variables.length > 0 ? editPrompt.variables : [
          { name: '', type: 'text', placeholder: '', required: false }
        ]);
      } else {
        // 新增模式，重置表单
        setTitle('');
        setDescription('');
        setCategory(allCats[0] || '');
        setTags('');
        setBody('');
        setVariables([{ name: '', type: 'text', placeholder: '', required: false }]);
        setError('');
      }
    }
  }, [isOpen, editPrompt]);

  // ============ 变量管理 ============

  const addVariable = () => {
    setVariables([...variables, { name: '', type: 'text', placeholder: '', required: false }]);
  };

  const removeVariable = (index: number) => {
    if (variables.length <= 1) {
      setError('至少保留一个变量占位');
      return;
    }
    const newVars = variables.filter((_, i) => i !== index);
    setVariables(newVars);
  };

  const updateVariable = (index: number, field: keyof Variable, value: string | boolean) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
  };

  // ============ 提交表单 ============

  const handleSubmit = () => {
    // 验证必填字段
    if (!title.trim()) {
      setError('请输入标题');
      return;
    }
    if (!description.trim()) {
      setError('请输入描述');
      return;
    }
    if (!category.trim()) {
      setError('请选择分类');
      return;
    }
    if (!body.trim()) {
      setError('请输入提示词正文');
      return;
    }

    // 验证变量名是否重复
    const varNames = variables.map(v => v.name.trim()).filter(name => name !== '');
    const uniqueNames = new Set(varNames);
    if (varNames.length !== uniqueNames.size) {
      setError('变量名不能重复');
      return;
    }

    // 过滤掉空的变量占位
    const cleanVariables = variables.filter(v => v.name.trim() !== '');

    // 生成 ID（新增模式自动生成，编辑模式保留原 ID）
    const id = isEditMode ? editPrompt!.id : `prompt-${Date.now()}`;

    const promptData = {
      id,
      title: title.trim(),
      description: description.trim(),
      category: category.trim(),
      tags: tags.split(',').map(t => t.trim()).filter(t => t !== ''),
      body: body.trim(),
      variables: cleanVariables
    };

    try {
      if (isEditMode) {
        // 编辑模式：更新
        updatePrompt(id, promptData);
      } else {
        // 新增模式：添加
        addPrompt(promptData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    }
  };

  // ============ 关闭弹窗 ============

  const handleClose = () => {
    setError('');
    onClose();
  };

  // ============ 弹窗外点击关闭 ============

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  // ============ 渲染 ============

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--modal-overlay, rgba(0,0,0,0.3))',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '20px'
      }}
      onClick={handleOverlayClick}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          padding: '28px 32px',
          maxWidth: '560px',
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          border: '1px solid var(--border-color, #d0d7e2)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary, #1e1e2f)',
            marginBottom: '6px'
          }}
        >
          {isEditMode ? '✏️ 编辑提示词' : '➕ 新增提示词'}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary, #4a4a5a)',
            marginBottom: '20px'
          }}
        >
          填写以下信息创建你的提示词
        </p>

        {/* 错误提示 */}
        {error && (
          <div
            style={{
              background: '#fee2e2',
              color: '#dc2626',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '16px'
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* 表单字段 */}
        <div style={{ marginBottom: '14px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #4a4a5a)',
              marginBottom: '4px'
            }}
          >
            标题 <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：代码审查"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #d0d7e2)',
              background: 'var(--bg-input, #f0f2f6)',
              color: 'var(--text-primary, #1e1e2f)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #4a4a5a)',
              marginBottom: '4px'
            }}
          >
            描述 <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述提示词的用途"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #d0d7e2)',
              background: 'var(--bg-input, #f0f2f6)',
              color: 'var(--text-primary, #1e1e2f)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #4a4a5a)',
              marginBottom: '4px'
            }}
          >
            分类 <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #d0d7e2)',
              background: 'var(--bg-input, #f0f2f6)',
              color: 'var(--text-primary, #1e1e2f)',
              fontSize: '14px',
              outline: 'none'
            }}
          >
            {customCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #4a4a5a)',
              marginBottom: '4px'
            }}
          >
            标签
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="用逗号分隔，例如：review, quality"
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #d0d7e2)',
              background: 'var(--bg-input, #f0f2f6)',
              color: 'var(--text-primary, #1e1e2f)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: '14px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #4a4a5a)',
              marginBottom: '4px'
            }}
          >
            正文 <span style={{ color: '#dc2626' }}>*</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="提示词内容，使用 {{变量名}} 作为占位符"
            rows={4}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #d0d7e2)',
              background: 'var(--bg-input, #f0f2f6)',
              color: 'var(--text-primary, #1e1e2f)',
              fontSize: '14px',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit'
            }}
          />
        </div>

        {/* 变量列表 */}
        <div style={{ marginBottom: '16px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px'
            }}
          >
            <label
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--text-secondary, #4a4a5a)'
              }}
            >
              变量占位符
            </label>
            <button
              onClick={addVariable}
              style={{
                padding: '2px 12px',
                borderRadius: '4px',
                border: '1px solid var(--brand-blue, #2e9bff)',
                background: 'transparent',
                color: 'var(--brand-blue, #2e9bff)',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              ＋ 添加变量
            </button>
          </div>

          {variables.map((v, index) => (
            <div
              key={index}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 60px',
                gap: '8px',
                marginBottom: '6px',
                alignItems: 'center'
              }}
            >
              <input
                type="text"
                value={v.name}
                onChange={(e) => updateVariable(index, 'name', e.target.value)}
                placeholder="变量名 (如 code)"
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color, #d0d7e2)',
                  background: 'var(--bg-input, #f0f2f6)',
                  color: 'var(--text-primary, #1e1e2f)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              />
              <select
                value={v.type}
                onChange={(e) => updateVariable(index, 'type', e.target.value)}
                style={{
                  padding: '6px 10px',
                  borderRadius: '4px',
                  border: '1px solid var(--border-color, #d0d7e2)',
                  background: 'var(--bg-input, #f0f2f6)',
                  color: 'var(--text-primary, #1e1e2f)',
                  fontSize: '13px',
                  outline: 'none'
                }}
              >
                <option value="text">单行文本</option>
                <option value="textarea">多行文本</option>
              </select>
              <button
                onClick={() => removeVariable(index)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  background: '#fee2e2',
                  color: '#dc2626',
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                删除
              </button>
            </div>
          ))}
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #7a7a8a)', marginTop: '4px' }}>
            💡 在正文中使用 {'{{变量名}}'} 引用变量
          </div>
        </div>

        {/* 操作按钮 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color, #d0d7e2)'
          }}
        >
          <button
            onClick={handleClose}
            style={{
              padding: '8px 24px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #d0d7e2)',
              background: 'transparent',
              color: 'var(--text-secondary, #4a4a5a)',
              fontSize: '14px',
              cursor: 'pointer'
            }}
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            style={{
              padding: '8px 24px',
              borderRadius: '6px',
              border: 'none',
              background: 'var(--brand-blue, #2e9bff)',
              color: '#ffffff',
              fontSize: '14px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            {isEditMode ? '保存修改' : '创建提示词'}
          </button>
        </div>
      </div>
    </div>
  );
};
