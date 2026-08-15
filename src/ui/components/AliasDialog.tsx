// src/ui/components/AliasDialog.tsx
// 为提示词设置/修改/删除别名的弹窗。
// 别名语义：一个提示词一个别名（服务端 upsert），调用方式 /<别名> [内容]。

import React, { useState, useEffect } from 'react';
import { injectStyles } from '../styles.js';
import { t } from '../i18n.js';
import { Prompt, AliasEntry, addAlias, removeAlias } from '../../client/api.js';

interface AliasDialogProps {
  isOpen: boolean;
  /** 目标提示词 */
  prompt: Prompt | null;
  /** 该提示词当前的别名（无则 null） */
  currentAlias: AliasEntry | null;
  onClose: () => void;
  /** 别名变更后回调（父组件刷新数据） */
  onChanged: () => void;
}

export const AliasDialog: React.FC<AliasDialogProps> = ({
  isOpen,
  prompt,
  currentAlias,
  onClose,
  onChanged
}) => {
  const [alias, setAlias] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (isOpen) {
      setAlias(currentAlias ? currentAlias.alias : '');
      setError('');
    }
  }, [isOpen, currentAlias]);

  // Esc 关闭（document 级监听，焦点不在输入框时同样生效）
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !prompt) return null;

  const handleSave = async () => {
    const trimmed = alias.trim();
    if (!trimmed) {
      setError(t('aliasDialog.required'));
      return;
    }
    if (currentAlias && currentAlias.alias === trimmed.replace(/^\//, '').toLowerCase()) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await addAlias(trimmed, prompt.id);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aliasDialog.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!currentAlias) return;
    setBusy(true);
    try {
      await removeAlias(currentAlias.alias);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('aliasDialog.removeFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="pv-modal pv-modal-sm" onClick={(e) => e.stopPropagation()}>
        <h2 className="pv-modal-title">{t('aliasDialog.title')}</h2>
        <p className="pv-modal-desc">
          {t('aliasDialog.desc', { title: prompt.title })}
        </p>

        {error && <div className="pv-error">{error}</div>}

        <div className="pv-field">
          <label className="pv-label" htmlFor="pv-alias-input">{t('aliasDialog.label')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--pv-text-tertiary)' }}>/</span>
            <input
              id="pv-alias-input"
              type="text"
              className={`pv-input${error ? ' pv-input-error' : ''}`}
              value={alias}
              onChange={(e) => { setAlias(e.target.value); if (error) setError(''); }}
              placeholder={t('aliasDialog.placeholder')}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </div>
          <div className="pv-hint">
            {t('aliasDialog.hint')}
            {prompt.variables.length > 0 && t('aliasDialog.hintVars')}
          </div>
        </div>

        <div className="pv-modal-footer">
          {currentAlias && (
            <button className="pv-btn-danger" onClick={handleRemove} disabled={busy}>
              {t('aliasDialog.remove')}
            </button>
          )}
          <span style={{ flex: 1 }} />
          <button className="pv-btn-secondary" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
          <button className="pv-btn-primary" onClick={handleSave} disabled={busy}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AliasDialog;
