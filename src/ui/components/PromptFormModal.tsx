// src/ui/components/PromptFormModal.tsx

import React, { useState, useEffect } from 'react';
import { Prompt, Variable, addPrompt, updatePrompt } from '../../client/api.js';
import { injectStyles } from '../styles.js';
import { t } from '../i18n.js';

/** 生成提示词 ID：优先 crypto.randomUUID（同毫秒并发也不冲突），降级随机拼合 */
function generatePromptId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // 降级：随机数 + 时间戳（非安全上下文无 randomUUID 时）
  return `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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

  // Esc 关闭（document 级监听，焦点不在输入框时同样生效）
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

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
      setError(t('form.keepOneVar'));
      return;
    }
    setVariables(variables.filter((_, i) => i !== index));
  };

  const updateVariable = (index: number, field: keyof Variable, value: string | boolean) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { setError(t('form.titleRequired')); return; }
    if (!description.trim()) { setError(t('form.descRequired')); return; }
    if (!category.trim()) { setError(t('form.categoryRequired')); return; }
    if (!body.trim()) { setError(t('form.bodyRequired')); return; }

    const varNames = variables.map(v => v.name.trim()).filter(name => name !== '');
    if (varNames.length !== new Set(varNames).size) {
      setError(t('form.varNameDuplicated'));
      return;
    }

    const cleanVariables = variables.filter(v => v.name.trim() !== '');
    const id = isEditMode ? editPrompt!.id : generatePromptId();

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
        await updatePrompt(id, promptData);
      } else {
        await addPrompt(promptData);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('form.opFailed'));
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
        <h2 className="pv-modal-title">{isEditMode ? t('form.editTitle') : t('form.addTitle')}</h2>
        <p className="pv-modal-desc">{isEditMode ? t('form.descEdit') : t('form.descAdd')}</p>

        {error && <div className="pv-error">{error}</div>}

        <div className="pv-field">
          <label className="pv-label" htmlFor="pv-f-title">{t('form.titleLabel')}<span className="pv-required">*</span></label>
          <input
            id="pv-f-title"
            type="text"
            className="pv-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('form.titlePlaceholder')}
          />
        </div>

        <div className="pv-field">
          <label className="pv-label" htmlFor="pv-f-desc">{t('form.descLabel')}<span className="pv-required">*</span></label>
          <input
            id="pv-f-desc"
            type="text"
            className="pv-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('form.descPlaceholder')}
          />
        </div>

        <div className="pv-field">
          <label className="pv-label" htmlFor="pv-f-category">{t('form.categoryLabel')}<span className="pv-required">*</span></label>
          <select
            id="pv-f-category"
            className="pv-select"
            value={safeCategory}
            onChange={(e) => setCategory(e.target.value)}
          >
            {categoryOptions.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <div className="pv-hint">{t('form.categoryHint')}</div>
        </div>

        <div className="pv-field">
          <label className="pv-label" htmlFor="pv-f-tags">{t('form.tagsLabel')}</label>
          <input
            id="pv-f-tags"
            type="text"
            className="pv-input"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder={t('form.tagsPlaceholder')}
          />
        </div>

        <div className="pv-field">
          <label className="pv-label" htmlFor="pv-f-body">{t('form.bodyLabel')}<span className="pv-required">*</span></label>
          <textarea
            id="pv-f-body"
            className="pv-textarea"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('form.bodyPlaceholder')}
            rows={4}
          />
        </div>

        {/* 变量列表 */}
        <div className="pv-field">
          <div className="pv-field-head">
            <label className="pv-label" style={{ marginBottom: 0 }}>{t('form.varsLabel')}</label>
            <button className="pv-btn-compact" onClick={addVariable}>
              {t('form.addVar')}
            </button>
          </div>

          {variables.map((v, index) => (
            <div key={index} className="pv-var-row">
              <input
                type="text"
                className="pv-input"
                value={v.name}
                onChange={(e) => updateVariable(index, 'name', e.target.value)}
                placeholder={t('form.varNamePlaceholder')}
              />
              <select
                className="pv-select"
                value={v.type}
                onChange={(e) => updateVariable(index, 'type', e.target.value)}
              >
                <option value="text">{t('form.varTypeText')}</option>
                <option value="textarea">{t('form.varTypeTextarea')}</option>
              </select>
              <button
                className="pv-btn-compact danger"
                onClick={() => removeVariable(index)}
              >
                {t('common.delete')}
              </button>
            </div>
          ))}
          <div className="pv-hint">{t('form.varHint')}</div>
        </div>

        <div className="pv-modal-footer">
          <button className="pv-btn-secondary" onClick={handleClose}>{t('common.cancel')}</button>
          <button className="pv-btn-primary" onClick={handleSubmit}>
            {isEditMode ? t('form.saveChanges') : t('form.create')}
          </button>
        </div>
      </div>
    </div>
  );
};

