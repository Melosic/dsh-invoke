// src/ui/components/ImportDialog.tsx

import React, { useState } from 'react';
import { importFromJSON } from '../../engine/import-export';

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
      const result = importFromJSON(text, mode);
      setResult({
        success: result.success,
        message: result.message
      });
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
        if (e.target === e.currentTarget) handleClose();
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
        <h2
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary, #1e1e2f)',
            marginBottom: '6px'
          }}
        >
          📥 导入提示词
        </h2>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary, #4a4a5a)',
            marginBottom: '20px'
          }}
        >
          从 JSON 文件导入提示词
        </p>

        {/* 文件选择 */}
        <div style={{ marginBottom: '16px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #4a4a5a)',
              marginBottom: '4px'
            }}
          >
            选择文件
          </label>
          <input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid var(--border-color, #d0d7e2)',
              background: 'var(--bg-input, #f0f2f6)',
              color: 'var(--text-primary, #1e1e2f)',
              fontSize: '13px'
            }}
          />
          {file && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted, #7a7a8a)', marginTop: '4px' }}>
              已选择: {file.name}
            </div>
          )}
        </div>

        {/* 导入模式 */}
        <div style={{ marginBottom: '20px' }}>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--text-secondary, #4a4a5a)',
              marginBottom: '4px'
            }}
          >
            导入模式
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{ fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="radio"
                value="merge"
                checked={mode === 'merge'}
                onChange={(e) => setMode(e.target.value as 'merge')}
                style={{ marginRight: '4px' }}
              />
              合并（跳过重复）
            </label>
            <label style={{ fontSize: '13px', cursor: 'pointer' }}>
              <input
                type="radio"
                value="overwrite"
                checked={mode === 'overwrite'}
                onChange={(e) => setMode(e.target.value as 'overwrite')}
                style={{ marginRight: '4px' }}
              />
              覆盖全部
            </label>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted, #7a7a8a)', marginTop: '4px' }}>
            {mode === 'merge'
              ? '保留已有提示词，仅添加新的'
              : '用导入的数据完全替换当前所有提示词'}
          </div>
        </div>

        {/* 导入结果 */}
        {result && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: '6px',
              marginBottom: '16px',
              background: result.success ? '#dcfce7' : '#fee2e2',
              color: result.success ? '#166534' : '#dc2626',
              fontSize: '13px'
            }}
          >
            {result.success ? '✅' : '❌'} {result.message}
          </div>
        )}

        {/* 操作按钮 */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '10px',
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
            onClick={handleImport}
            disabled={!file || loading}
            style={{
              padding: '8px 24px',
              borderRadius: '6px',
              border: 'none',
              background: (!file || loading) ? 'var(--border-color, #d0d7e2)' : 'var(--brand-blue, #2e9bff)',
              color: '#ffffff',
              fontSize: '14px',
              cursor: (!file || loading) ? 'not-allowed' : 'pointer',
              fontWeight: 500
            }}
          >
            {loading ? '导入中...' : '开始导入'}
          </button>
        </div>
      </div>
    </div>
  );
};
