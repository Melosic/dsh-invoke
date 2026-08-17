// src/ui/icons.tsx

/**
 * 内联 SVG 图标组件
 * 头部高频图标（Plus/Moon/Sun/X）为 16px 填充式（对齐官方 ic_ds_* 风格），
 * 其余为 Feather 描边式；全部纯 SVG 内联，无网络请求
 */

import React from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const IconBase: React.FC<{
  children: React.ReactNode;
  size?: number;
  className?: string;
  strokeWidth?: number;
}> = ({ children, size = 18, className = '', strokeWidth = 2 }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

/**
 * 填充式图标基座（对齐官方 ic_ds_* 16px 风格）
 * viewBox 16、fill=currentColor，通过正片叠底形状相减（fill-rule）实现镂空
 */
const FillBase: React.FC<{
  children: React.ReactNode;
  size?: number;
  className?: string;
}> = ({ children, size = 16, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="currentColor"
    aria-hidden="true"
    className={className}
  >
    {children}
  </svg>
);

export const SearchIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </IconBase>
);

export const PlusIcon: React.FC<IconProps> = ({ size, className }) => (
  <FillBase size={size} className={className}>
    <path d="M8 2.2c.5 0 .9.4.9.9v4h4a.9.9 0 1 1 0 1.8h-4v4a.9.9 0 1 1-1.8 0v-4h-4a.9.9 0 1 1 0-1.8h4v-4c0-.5.4-.9.9-.9z" />
  </FillBase>
);

export const EditIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
  </IconBase>
);

export const DeleteIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </IconBase>
);

export const CopyIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </IconBase>
);

export const CheckIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polyline points="20 6 9 17 4 12" />
  </IconBase>
);

export const InfoIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </IconBase>
);

export const InboxIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </IconBase>
);

export const ChevronDownIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <polyline points="6 9 12 15 18 9" />
  </IconBase>
);

export const MoonIcon: React.FC<IconProps> = ({ size, className }) => (
  <FillBase size={size} className={className}>
    <path d="M8.4 1.6a6.4 6.4 0 1 0 6 8.7.7.7 0 0 0-.92-.9 5 5 0 0 1-4.86-8.4.7.7 0 0 0-.22-1.4z" />
  </FillBase>
);

export const SunIcon: React.FC<IconProps> = ({ size, className }) => (
  <FillBase size={size} className={className}>
    <path d="M8 4.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z" />
    <path d="M8 .3a.8.8 0 0 1 .8.8v1.1a.8.8 0 0 1-1.6 0V1.1A.8.8 0 0 1 8 .3zM8 13a.8.8 0 0 1 .8.8v1.1a.8.8 0 0 1-1.6 0v-1.1A.8.8 0 0 1 8 13zM1.1 7.2h1.1a.8.8 0 0 1 0 1.6H1.1a.8.8 0 0 1 0-1.6zM13.8 7.2h1.1a.8.8 0 0 1 0 1.6h-1.1a.8.8 0 0 1 0-1.6zM3.23 2.43a.8.8 0 0 1 1.13 0l.78.78a.8.8 0 1 1-1.13 1.13l-.78-.78a.8.8 0 0 1 0-1.13zM10.86 10.06a.8.8 0 0 1 1.13 0l.78.78a.8.8 0 1 1-1.13 1.13l-.78-.78a.8.8 0 0 1 0-1.13zM3.23 13.57a.8.8 0 0 1 0-1.13l.78-.78a.8.8 0 1 1 1.13 1.13l-.78.78a.8.8 0 0 1-1.13 0zM10.86 5.94a.8.8 0 0 1 0-1.13l.78-.78a.8.8 0 1 1 1.13 1.13l-.78.78a.8.8 0 0 1-1.13 0z" />
  </FillBase>
);

export const ImportIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </IconBase>
);

export const BookmarkIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </IconBase>
);

export const ExportIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </IconBase>
);

export const LinkIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </IconBase>
);

/** 紧凑列表视图（Feather list 风格） */
export const ListIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </IconBase>
);

/** 舒适网格视图（Feather grid 风格） */
export const GridIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </IconBase>
);

export const XIcon: React.FC<IconProps> = ({ size, className }) => (
  <FillBase size={size} className={className}>
    <path d="M3.34 2.26a.9.9 0 0 0-1.08 1.4L6.74 8.3l-4.48 4.44a.9.9 0 1 0 1.26 1.28L8 9.58l4.48 4.44a.9.9 0 1 0 1.26-1.28L9.26 8.3l4.48-4.44a.9.9 0 1 0-1.26-1.28L8 7.02 3.34 2.26z" />
  </FillBase>
);
