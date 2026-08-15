// src/ui/components/VariableDialog.tsx

import React, { useState, useEffect } from 'react';
import { Variable } from '../../storage/manager.js';
import { CopyIcon, CheckIcon, InfoIcon } from '../icons.js';
import { injectStyles } from '../styles.js';
import { t, DictKey } from '../i18n.js';

/** 空值字典的模块级稳定引用：作为默认参数时避免每次渲染新建对象，
 *  触发下方初始化 effect 反复重置 values（表现为输入框无法输入/粘贴） */
const EMPTY_VALUES: Record<string, string> = {};

interface VariableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: Record<string, string>) => void;
  title: string;
  description: string;
  variables: Variable[];
  initialValues?: Record<string, string>;
  autoExtractValues?: Record<string, string>;
  /** 自动提取提示的 i18n key（engine/variable-resolver 返回），渲染时翻译 */
  extractMessageKey?: string;
  /** 提示插值参数 */
  extractMessageParams?: Record<string, string>;
}

export const VariableDialog: React.FC<VariableDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  variables,
  initialValues = EMPTY_VALUES,
  autoExtractValues = EMPTY_VALUES,
  extractMessageKey = '',
  extractMessageParams
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

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
      const merged: Record<string, string> = {};
      variables.forEach(v => {
        merged[v.name] = autoExtractValues[v.name] || initialValues[v.name] || '';
      });
      setValues(merged);
      setErrors({});
    }
  }, [isOpen, variables, autoExtractValues, initialValues]);

  const handleChange = (name: string, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    variables.forEach(v => {
      if (v.required && (!values[v.name] || !values[v.name].trim())) {
        newErrors[v.name] = t('varDialog.required');
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onConfirm(values);
  };

  const hasAutoExtract = Object.keys(autoExtractValues).length > 0;
  const hasExtractMessage = extractMessageKey.trim().length > 0;
  // key 来自本插件 engine 层的固定枚举，as 收窄是安全的
  const extractMessage = hasExtractMessage
    ? t(extractMessageKey as DictKey, extractMessageParams)
    : '';

  if (!isOpen) return null;

  return (
    <div className="pv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pv-modal pv-modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="pv-modal-title">{title}</h2>
        <p className="pv-modal-desc">{description}</p>

        {hasExtractMessage && (
          <div className={`pv-extract ${hasAutoExtract ? 'success' : 'info'}`}>
            {hasAutoExtract ? <CheckIcon size={14} /> : <InfoIcon size={14} />}
            <span>{extractMessage}</span>
          </div>
        )}

        {variables.map(v => {
          const isTextarea = v.type === 'textarea';
          const hasError = !!errors[v.name];
          return (
            <div key={v.name} className="pv-field">
              <label className="pv-label" htmlFor={`pv-var-${v.name}`}>
                {v.name}
                {v.required && <span className="pv-required">*</span>}
              </label>
              {isTextarea ? (
                <textarea
                  id={`pv-var-${v.name}`}
                  className="pv-textarea"
                  value={values[v.name] || ''}
                  onChange={(e) => handleChange(v.name, e.target.value)}
                  placeholder={v.placeholder || t('varDialog.inputPlaceholder', { name: v.name })}
                  rows={3}
                  style={hasError ? { borderColor: 'var(--red-600)' } : undefined}
                />
              ) : (
                <input
                  id={`pv-var-${v.name}`}
                  type="text"
                  className="pv-input"
                  value={values[v.name] || ''}
                  onChange={(e) => handleChange(v.name, e.target.value)}
                  placeholder={v.placeholder || t('varDialog.inputPlaceholder', { name: v.name })}
                  style={hasError ? { borderColor: 'var(--red-600)' } : undefined}
                />
              )}
              {hasError && (
                <div style={{ fontSize: 11, color: 'var(--red-600)', marginTop: 4 }}>
                  {errors[v.name]}
                </div>
              )}
            </div>
          );
        })}

        {variables.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--pv-text-caption)', fontSize: 13 }}>
            {t('varDialog.noVars')}
          </div>
        )}

        <div className="pv-modal-footer">
          <button className="pv-btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
          <button className="pv-btn-primary" onClick={handleSubmit}>
            <CopyIcon size={14} />
            {t('varDialog.copy')}
          </button>
        </div>
      </div>
    </div>
  );
};

