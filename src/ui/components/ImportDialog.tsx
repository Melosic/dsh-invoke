// src/ui/components/ImportDialog.tsx

import React, { useState, useEffect } from 'react';
import { importFromJSON, importFromYAML } from '../../engine/import-export';
import { injectStyles } from '../styles';

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

  useEffect(() => {
    injectStyles();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      alert('请选择文件');
      return;
    }

    setLoading(true);
    try {
      const text = await file.text();
      const isYaml = /\.(ya?ml)$/i.test(file.name);
      const result = isYaml ? importFromYAML(text, mode) : importFromJSON(text, mode);
      setResult({ success: result.success, message: result.message });
      if (result.success) {
        onSuccess();
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : '导入失败'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="pv-overlay" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="pv-modal pv-modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="pv-modal-title">导入提示词</h2>
        <p className="pv-modal-desc">从 JSON 或 YAML 文件导入提示词</p>

        <div className="pv-field">
          <label className="pv-label">选择文件</label>
          <input
            type="file"
            accept=".json,.yaml,.yml"
            className="pv-input"
            onChange={handleFileChange}
            style={{ padding: '7px' }}
          />
          {file && (
            <div className="pv-hint">已选择: {file.name}</div>
          )}
        </div>

        <div className="pv-field">
          <label className="pv-label">导入模式</label>
          <div style={{ display: 'flex', gap: 16 }}>
            <label style={{ fontSize: 13, cursor: 'pointer', color: 'var(--pv-text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                type="radio"
                value="merge"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
              />
              合并（跳过重复）
            </label>
            <label style={{ fontSize: 13, cursor: 'pointer', color: 'var(--pv-text-secondary)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <input
                type="radio"
                value="overwrite"
                checked={mode === 'overwrite'}
                onChange={() => setMode('overwrite')}
              />
              覆盖全部
            </label>
          </div>
          <div className="pv-hint">
            {mode === 'merge'
              ? '保留已有提示词，仅添加新的'
              : '用导入的数据完全替换当前所有提示词'}
          </div>
        </div>

        {result && (
          <div className={result.success ? 'pv-extract success' : 'pv-error'}>
            {result.message}
          </div>
        )}

        <div className="pv-modal-footer">
          <button className="pv-btn-secondary" onClick={handleClose}>取消</button>
          <button
            className="pv-btn-primary"
            onClick={handleImport}
            disabled={!file || loading}
            style={(!file || loading) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
          >
            {loading ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  );
};

