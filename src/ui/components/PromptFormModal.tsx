// src/ui/components/PromptFormModal.tsx

import React, { useState, useEffect } from 'react';
import { Prompt, Variable, addPrompt, updatePrompt } from '../../storage/manager';
import { injectStyles } from '../styles';

interface PromptFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editPrompt?: Prompt | null;
  categories: string[];
}

export const PromptFormModal: React.FC<PromptFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editPrompt,
  categories
}) => {
  const isEditMode = !!editPrompt;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState<Variable[]>([
    { name: '', type: 'text', placeholder: '', required: false }
  ]);
  const [error, setError] = useState('');

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (isOpen) {
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
        setTitle('');
        setDescription('');
        setCategory(categories.length > 0 ? categories[0] : '');
        setTags('');
        setBody('');
        setVariables([{ name: '', type: 'text', placeholder: '', required: false }]);
        setError('');
      }
    }
  }, [isOpen, editPrompt, categories]);

  const addVariable = () => {
    setVariables([...variables, { name: '', type: 'text', placeholder: '', required: false }]);
  };

  const removeVariable = (index: number) => {
    if (variables.length <= 1) {
      setError('至少保留一个变量占位');
      return;
    }
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof Variable, value: string | boolean) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
  };

  const handleSubmit = () => {
    if (!title.trim()) { setError('请输入标题'); return; }
    if (!description.trim()) { setError('请输入描述'); return; }
    if (!category.trim()) { setError('请选择分类'); return; }
    if (!body.trim()) { setError('请输入提示词正文'); return; }

    const varNames = variables.map(v => v.name.trim()).filter(name => name !== '');
    if (varNames.length !== new Set(varNames).size) {
      setError('变量名不能重复');
      return;
    }

    const cleanVariables = variables.filter(v => v.name.trim() !== '');
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
        updatePrompt(id, promptData);
      } else {
        addPrompt(promptData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  const categoryOptions = categories.length > 0 ? categories : ['未分类'];
  const safeCategory = categoryOptions.includes(category) ? category : categoryOptions[0];

  return (
    <div className="pv-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="pv-modal" onClick={(e) => e.stopPropagation()}>
        <h2 className="pv-modal-title">{isEditMode ? '编辑提示词' : '新增提示词'}</h2>
        <p className="pv-modal-desc">填写以下信息{isEditMode ? '修改' : '创建'}你的提示词</p>

        {error && <div className="pv-error">{error}</div>}

        <div className="pv-field">
          <label className="pv-label">标题<span className="pv-required">*</span></label>
          <input
            type="text"
            className="pv-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：代码审查"
          />
        </div>

        <div className="pv-field">
          <label className="pv-label">描述<span className="pv-required">*</span></label>
          <input
            type="text"
            className="pv-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="简要描述提示词的用途"
          />
        </div>

        <div className="pv-field">
          <label className="pv-label">分类<span className="pv-required">*</span></label>
          <select
            className="pv-select"
            value={safeCategory}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="pv-hint">可在左侧分类树中新增或重命名分类</div>
        </div>

        <div className="pv-field">
          <label className="pv-label">标签</label>
          <input
            type="text"
            className="pv-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="用逗号分隔，例如：review, quality"
          />
        </div>

        <div className="pv-field">
          <label className="pv-label">正文<span className="pv-required">*</span></label>
          <textarea
            className="pv-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="提示词内容，使用 {{变量名}} 作为占位符"
            rows={4}
          />
        </div>

        {/* 变量列表 */}
        <div className="pv-field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label className="pv-label" style={{ marginBottom: 0 }}>变量占位符</label>
            <button className="pv-btn-secondary" style={{ padding: '2px 10px', fontSize: 12 }} onClick={addVariable}>
              ＋ 添加变量
            </button>
          </div>

          {variables.map((v, index) => (
            <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 60px', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <input
                type="text"
                className="pv-input"
                value={v.name}
                onChange={(e) => updateVariable(index, 'name', e.target.value)}
                placeholder="变量名 (如 code)"
                style={{ padding: '6px 10px', fontSize: 13 }}
              />
              <select
                className="pv-select"
                value={v.type}
                onChange={(e) => updateVariable(index, 'type', e.target.value)}
                style={{ padding: '6px 10px', fontSize: 13 }}
              >
                <option value="text">单行文本</option>
                <option value="textarea">多行文本</option>
              </select>
              <button
                className="pv-btn-secondary"
                style={{ padding: '4px 8px', fontSize: 12, color: 'var(--red-600)' }}
                onClick={() => removeVariable(index)}
              >
                删除
              </button>
            </div>
          ))}
          <div className="pv-hint">在正文中使用 {'{{变量名}}'} 引用变量</div>
        </div>

        <div className="pv-modal-footer">
          <button className="pv-btn-secondary" onClick={handleClose}>取消</button>
          <button className="pv-btn-primary" onClick={handleSubmit}>
            {isEditMode ? '保存修改' : '创建提示词'}
          </button>
        </div>
      </div>
    </div>
  );
};

