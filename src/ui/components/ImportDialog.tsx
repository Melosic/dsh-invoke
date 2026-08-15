// src/ui/components/ImportDialog.tsx

import React, { useState, useEffect } from 'react';
import { importPrompts } from '../../client/api.js';
import { injectStyles } from '../styles.js';
import { t } from '../i18n.js';

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [mode, setMode] = useState<'overwrite' | 'merge'>('merge');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    injectStyles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
      setError('');
    }
  };

  const handleImport = async () => {
    if (!file) {
      setError(t('importDialog.noFile'));
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const isYaml = /\.(ya?ml)$/i.test(file.name);
      const result = await importPrompts(text, isYaml ? 'yaml' : 'json', mode);
      setResult({ success: result.success, message: result.message });
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : t('importDialog.failed')
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setLoading(false);
    setError('');
    onClose();
  };

  // Esc 关闭（document 级监听，焦点不在输入框时同样生效；走 handleClose 以重置表单状态）
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="pv-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="pv-modal pv-modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="pv-modal-title">{t('importDialog.title')}</h2>
        <p className="pv-modal-desc">{t('importDialog.desc')}</p>

        <div className="pv-field">
          <label className="pv-label">{t('importDialog.file')}</label>
          <input
            type="file"
            accept=".json,.yaml,.yml"
            className="pv-input"
            onChange={handleFileChange}
          />
          {file && (
            <div className="pv-hint">{t('importDialog.fileSelected', { name: file.name })}</div>
          )}
        </div>

        <div className="pv-field">
          <label className="pv-label">{t('importDialog.mode')}</label>
          <div className="pv-radio-group">
            <label className="pv-radio">
              <input
                type="radio"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
              />
              {t('importDialog.merge')}
            </label>
            <label className="pv-radio">
              <input
                type="radio"
                value="overwrite"
                checked={mode === 'overwrite'}
                onChange={() => setMode('overwrite')}
              />
              {t('importDialog.overwrite')}
            </label>
          </div>
          <div className="pv-hint">
            {mode === 'merge'
              ? t('importDialog.mergeHint')
              : t('importDialog.overwriteHint')}
          </div>
        </div>

        {error && (
          <div className="pv-error">{error}</div>
        )}

        {result && (
          <div className={result.success ? 'pv-extract success' : 'pv-error'}>
            {result.message}
          </div>
        )}

        <div className="pv-modal-footer">
          <button className="pv-btn-secondary" onClick={handleClose}>{t('common.cancel')}</button>
          <button
            className="pv-btn-primary"
            onClick={handleImport}
            disabled={!file || loading}
            style={(!file || loading) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {loading ? t('importDialog.loading') : t('importDialog.start')}
          </button>
        </div>
      </div>
    </div>
  );
};

