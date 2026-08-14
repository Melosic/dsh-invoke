// src/ui/components/VariableDialog.tsx

import React, { useState, useEffect } from 'react';
import { Variable } from '../../storage/manager';
import { CopyIcon } from '../icons';

interface VariableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (values: Record<string, string>) => void;
  title: string;
  description: string;
  variables: Variable[];
  initialValues?: Record<string, string>;
  autoExtractValues?: Record<string, string>;  // 从编辑器选区自动提取的值
  extractMessage?: string;  // 自动提取的状态提示
}

export const VariableDialog: React.FC<VariableDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  variables,
  initialValues = {},
  autoExtractValues = {},
  extractMessage = ''
}) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 初始化表单值
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

  // 更新单个字段
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

  // 提交
  const handleSubmit = () => {
    const newErrors: Record<string, string> = {};
    variables.forEach(v => {
      if (v.required && (!values[v.name] || !values[v.name].trim())) {
        newErrors[v.name] = '此字段为必填';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onConfirm(values);
  };

  // 自动提取提示：是否有成功提取的值
  const hasAutoExtract = Object.keys(autoExtractValues).length > 0;
  // 是否有提取状态消息需要展示（包括失败/不可用）
  const hasExtractMessage = extractMessage.trim().length > 0;

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--bg-card, #ffffff)',
          borderRadius: '12px',
          padding: '28px 32px',
          maxWidth: '480px',
          width: '100%',
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
            marginBottom: '4px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>📋</span> {title}
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary, #4a4a5a)',
            marginBottom: '16px'
          }}
        >
          {description}
        </p>

        {/* 自动提取提示 */}
        {hasExtractMessage && (
          <div
            style={{
              background: hasAutoExtract
                ? 'var(--brand-blue, #2e9bff)'
                : 'var(--tag-bg, #e8edf5)',
              color: hasAutoExtract ? '#fff' : 'var(--text-secondary, #4a4a5a)',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span>{hasAutoExtract ? '✨' : 'ℹ️'}</span>
            <span>{extractMessage}</span>
          </div>
        )}

        {/* 变量字段 */}
        {variables.map(v => {
          const isTextarea = v.type === 'textarea';
          const hasError = !!errors[v.name];
          return (
            <div key={v.name} style={{ marginBottom: '14px' }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--text-secondary, #4a4a5a)',
                  marginBottom: '4px'
                }}
              >
                {v.name}
                {v.required && <span style={{ color: '#dc2626', marginLeft: '4px' }}>*</span>}
              </label>
              {isTextarea ? (
                <textarea
                  value={values[v.name] || ''}
                  onChange={(e) => handleChange(v.name, e.target.value)}
                  placeholder={v.placeholder || `请输入 ${v.name}`}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: hasError
                      ? '1px solid #dc2626'
                      : '1px solid var(--border-color, #d0d7e2)',
                    background: 'var(--bg-input, #f0f2f6)',
                    color: 'var(--text-primary, #1e1e2f)',
                    fontSize: '14px',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit'
                  }}
                />
              ) : (
                <input
                  type="text"
                  value={values[v.name] || ''}
                  onChange={(e) => handleChange(v.name, e.target.value)}
                  placeholder={v.placeholder || `请输入 ${v.name}`}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: hasError
                      ? '1px solid #dc2626'
                      : '1px solid var(--border-color, #d0d7e2)',
                    background: 'var(--bg-input, #f0f2f6)',
                    color: 'var(--text-primary, #1e1e2f)',
                    fontSize: '14px',
                    outline: 'none'
                  }}
                />
              )}
              {hasError && (
                <div style={{ fontSize: '12px', color: '#dc2626', marginTop: '4px' }}>
                  ⚠️ {errors[v.name]}
                </div>
              )}
            </div>
          );
        })}

        {/* 无变量提示 */}
        {variables.length === 0 && (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--text-muted, #7a7a8a)',
              fontSize: '14px'
            }}
          >
            此提示词没有变量，点击下方按钮直接复制
          </div>
        )}

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
            onClick={onClose}
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
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
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
            <CopyIcon size={16} />
            复制到剪贴板
          </button>
        </div>
      </div>
    </div>
  );
};

