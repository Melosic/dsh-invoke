// src/ui/panel-mode.ts

/**
 * 面板形态工具
 * 面板以两种形态呈现：drawer（右侧抽屉）与 dialog（居中弹窗）。
 * 形态持久化到 localStorage，并同步到根容器的 data-pv-panel 属性
 * （styles.ts 依据该属性切换两套定位样式）。
 */

import { useEffect, useState } from 'react';

export type PanelMode = 'drawer' | 'dialog';

const PANEL_MODE_KEY = 'dsh-invoke:panel-mode';

/** 读取持久化的形态偏好（client 层挂载根容器时用于初始化 data-pv-panel） */
export function loadPanelMode(): PanelMode {
  try {
    return localStorage.getItem(PANEL_MODE_KEY) === 'dialog' ? 'dialog' : 'drawer';
  } catch {
    return 'drawer';
  }
}

/**
 * 检测当前形态
 * 优先级：根容器 data-pv-panel 属性
 */
export function detectPanelMode(): PanelMode {
  if (typeof document === 'undefined') return 'drawer';
  const root = document.getElementById('dsh-invoke-root');
  return root?.getAttribute('data-pv-panel') === 'dialog' ? 'dialog' : 'drawer';
}

/** 切换形态：持久化偏好并更新根容器属性（即时生效，无需重载） */
export function setPanelMode(mode: PanelMode): void {
  try {
    localStorage.setItem(PANEL_MODE_KEY, mode);
  } catch {
    // 隐私模式等场景下 localStorage 不可用：仅本次会话生效
  }
  document.getElementById('dsh-invoke-root')?.setAttribute('data-pv-panel', mode);
}

/**
 * React Hook: 监听形态变化（根容器 data-pv-panel 属性）
 */
export function usePanelMode(): PanelMode {
  const [mode, setMode] = useState<PanelMode>(detectPanelMode);

  useEffect(() => {
    const root = document.getElementById('dsh-invoke-root');
    const observer = new MutationObserver(() => {
      setMode(detectPanelMode());
    });

    if (root) {
      observer.observe(root, {
        attributes: true,
        attributeFilter: ['data-pv-panel']
      });
    }

    return () => observer.disconnect();
  }, []);

  return mode;
}