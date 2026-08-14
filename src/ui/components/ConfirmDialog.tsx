// src/ui/components/ConfirmDialog.tsx

import React, { useState, useEffect } from 'react';
import { injectStyles } from '../styles';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** 需要用户输入时（如重命名），显示输入框 */
  showInput?: boolean;
  inputPlaceholder?: string;
  initialInput?: string;
  /** 外部传入的错误信息（如重名校验失败），显示在输入框下方 */
  error?: string;
  onConfirm: (inputValue?: string) => void;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  showInput = false,
  inputPlaceholder,
  initialInput = '',
  error = '',
  onConfirm,
  onClose
}) => {
  const [inputValue, setInputValue] = useState(initialInput);
  const [internalError, setInternalError] = useState('');

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setInputValue(initialInput);
      setInternalError('');
    }
  }, [isOpen, initialInput]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (showInput && !inputValue.trim()) {
      setInternalError('输入不能为空');
      return;
    }
    onConfirm(showInput ? inputValue.trim() : undefined);
  };

  return (
    <div className="pv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pv-modal pv-modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="pv-modal-title">{title}</h2>
        {message && <p className="pv-modal-desc">{message}</p>}

        {showInput && (
          <div className="pv-field">
            <input
              type="text"
              className={`pv-input${(internalError || error) ? ' pv-input-error' : ''}`}
              value={inputValue}
              onChange={(e) => { setInputValue(e.target.value); if (internalError) setInternalError(''); }}
              placeholder={inputPlaceholder}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirm();
                if (e.key === 'Escape') onClose();
              }}
            />
            {(internalError || error) && <div className="pv-hint pv-hint-error">{internalError || error}</div>}
          </div>
        )}

        <div className="pv-modal-footer">
          <button className="pv-btn-secondary" onClick={onClose}>{cancelText}</button>
          <button
            className={danger ? 'pv-btn-danger' : 'pv-btn-primary'}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;