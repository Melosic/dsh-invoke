// src/ui/components/Select.tsx
// 自定义下拉框：替换原生 <select>（原生展开列表为 OS 样式，无法美化）。
// 面板经 Portal 渲染到 body 并用 fixed 定位——modal 的 scale 动画会创建
// containing block，直接绝对定位会被裁剪/错位。

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { injectStyles } from '../styles.js';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** 追加到触发按钮的自定义类名（如紧凑行内场景） */
  className?: string;
  ariaLabel?: string;
}

/** 单个预估行高（与 .pv-dd-item 的 padding/行高保持一致） */
const ITEM_H = 30;

export const Select: React.FC<SelectProps> = ({ value, options, onChange, className = '', ariaLabel }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; upward: boolean } | null>(null);

  const current = options.find(o => o.value === value);

  // 打开时计算面板位置：优先下方展开，空间不足翻向上方
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const estH = Math.min(options.length * ITEM_H + 8, 8 * ITEM_H + 8);
    const below = window.innerHeight - r.bottom > estH + 8;
    setPos({
      top: below ? r.bottom + 4 : Math.max(8, r.top - estH - 4),
      left: Math.min(r.left, window.innerWidth - Math.max(r.width, 120) - 8),
      width: Math.max(r.width, 120),
      upward: !below,
    });
  }, [open, options]);

  // Esc 关闭 + 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (!(e.target instanceof Element && e.target.closest('.pv-dd-panel'))) setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`pv-dd-btn${open ? ' pv-dd-open' : ''} ${className}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(v => !v)}
      >
        <span className="pv-dd-value">{current?.label ?? value}</span>
        <svg
          className={`pv-dd-chevron${open ? ' open' : ''}`}
          width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && pos && createPortal(
        <div className="pv-dd-panel" style={{ top: pos.top, left: pos.left, width: pos.width }} role="listbox">
          {options.map(o => (
            <div
              key={o.value}
              className={`pv-dd-item${o.value === value ? ' active' : ''}`}
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
            >
              <span className="pv-dd-item-label">{o.label}</span>
              {o.value === value && (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  );
};
