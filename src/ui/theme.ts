// src/ui/theme.ts

/**
 * 主题适配工具
 * 跟随 Harness 的 data-ds-dark-theme 属性；同时支持插件根容器上的
 * data-pv-theme 手动覆盖（不污染 Harness 全局主题）。
 */

import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

/**
 * 检测当前主题模式
 * 优先级：根容器 data-pv-theme 手动覆盖 > Harness body[data-ds-dark-theme]
 */
export function detectTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';

  const root = document.getElementById('dsh-invoke-root');
  const override = root?.getAttribute('data-pv-theme');
  if (override === 'dark' || override === 'light') return override;

  const attr = document.body.getAttribute('data-ds-dark-theme');
  // 与 CSS 选择器 body[data-ds-dark-theme] 保持一致：存在即视为暗色
  const isDark = attr !== null && attr !== '' && attr !== 'false';
  return isDark ? 'dark' : 'light';
}

/**
 * React Hook: 监听主题变化（body 属性 + 根容器手动覆盖）
 */
export function useTheme(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>(detectTheme);

  useEffect(() => {
    const root = document.getElementById('dsh-invoke-root');
    const observer = new MutationObserver(() => {
      setTheme(detectTheme());
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-ds-dark-theme']
    });

    if (root) {
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-pv-theme']
      });
    }

    return () => observer.disconnect();
  }, []);

  return theme;
}
