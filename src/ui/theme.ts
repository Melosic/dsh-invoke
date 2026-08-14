// src/ui/theme.ts

/**
 * 主题适配工具
 * 跟随 Harness 的 data-ds-dark-theme 属性
 */

import { useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';

/**
 * 检测当前主题模式
 */
export function detectTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  const isDark = document.body.getAttribute('data-ds-dark-theme') === 'true';
  return isDark ? 'dark' : 'light';
}

/**
 * React Hook: 监听主题变化
 */
export function useTheme(): ThemeMode {
  const [theme, setTheme] = useState<ThemeMode>(detectTheme);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(detectTheme());
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-ds-dark-theme']
    });

    return () => observer.disconnect();
  }, []);

  return theme;
}

/**
 * 获取主题对应的 CSS 变量值
 */
export function getThemeVar(lightValue: string, darkValue: string): string {
  return `var(--ds-theme-${lightValue}, ${lightValue})`;
}
