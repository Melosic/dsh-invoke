// src/client/index.ts
// dsh-invoke 浏览器端入口
// 职责：
//   1. 通过 DOM 注入侧边栏入口按钮（DSH 暂无官方 sidebar 扩展 slot）
//   2. 挂载 React 面板到挂载点
//   3. 通过 fetch 与 host 端 API 通信

import { Context } from '@deepseek-ai/cordis';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { WebviewPanel } from '../ui/WebviewPanel.js';

export const name = 'dsh-invoke-client';
export const version = '0.1.0';
export const description = 'Prompt Vault 侧边栏面板';

/** 侧边栏按钮的 ID 与挂载点 ID */
// 挂载点 id 必须为 dsh-invoke-root：styles.ts 的 design token、暗色主题选择器、
// theme.ts 的主题检测、WebviewPanel 的主题切换均以 #dsh-invoke-root 为根。
const SIDEBAR_BTN_ID = 'dsh-invoke-sidebar-btn';
const PANEL_ROOT_ID = 'dsh-invoke-root';

/** 检查当前是否处于 Harness 的浏览器环境 */
function isBrowserEnv(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * 鲁棒地查找 Harness 侧边栏容器。
 * DSH 各版本 DOM 结构不固定（官方无稳定 data-sidebar 锚点），
 * 按优先级尝试：稳定属性 → 模糊 class → 结构回退。
 */
function findSidebarContainer(): HTMLElement | null {
  const selectors = ['[data-sidebar]', '[class*="sidebar" i]', 'aside', 'nav'];
  for (const sel of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(sel);
      if (el) return el;
    } catch {
      /* 忽略无效选择器 */
    }
  }
  // 结构回退：定位包含 "New session" 按钮的容器，向上找到带类名的最外层导航容器
  const newSessionBtn = Array.from(document.querySelectorAll('button')).find(
    (b) => /new\s*session/i.test((b.textContent ?? '').trim())
  );
  if (newSessionBtn) {
    let cursor: HTMLElement | null = newSessionBtn.parentElement;
    let best: HTMLElement | null = null;
    while (cursor && cursor !== document.body) {
      if (typeof cursor.className === 'string' && cursor.className.trim()) best = cursor;
      cursor = cursor.parentElement;
    }
    return best;
  }
  return null;
}

/**
 * 使用 MutationObserver 自愈地在 Harness 侧边栏注入入口按钮。
 * 当 Harness 的侧边栏区域重新渲染时，observer 会自动重新注入。
 */
function injectSidebarButton(ctx: Context): () => void {
  if (!isBrowserEnv()) return () => {};

  const inject = () => {
    const sidebar = findSidebarContainer();
    if (!sidebar) return false;

    if (document.getElementById(SIDEBAR_BTN_ID)) return true;

    const btn = document.createElement('button');
    btn.id = SIDEBAR_BTN_ID;
    btn.className = 'dsh-invoke-sidebar-btn';
    btn.setAttribute('data-sidebar-entry', '');
    btn.setAttribute('aria-label', 'Prompt Vault');
    btn.setAttribute('title', 'Prompt Vault');
    btn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="16" y1="13" x2="8" y2="13"/>
        <line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10 9 9 9 8 9"/>
      </svg>
      <span class="dsh-invoke-sidebar-label">Prompt Vault</span>
    `;

    btn.addEventListener('click', () => togglePanel());
    sidebar.appendChild(btn);
    return true;
  };

  // 初次注入
  inject();

  // 自愈：当 DOM 变化时重新注入
  const observer = new MutationObserver(() => {
    if (!document.getElementById(SIDEBAR_BTN_ID)) {
      inject();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}

/** 切换面板显示/隐藏 */
function togglePanel() {
  const root = document.getElementById(PANEL_ROOT_ID);
  if (!root) {
    mountPanel();
  } else {
    root.style.display = root.style.display === 'none' ? 'flex' : 'none';
  }
}

/** 挂载 React 面板到 DOM */
function mountPanel() {
  if (document.getElementById(PANEL_ROOT_ID)) return;

  const container = document.createElement('div');
  container.id = PANEL_ROOT_ID;
  container.className = 'dsh-invoke-root';
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(React.createElement(WebviewPanel, {}));

  // 存储 root 以便卸载
  container.dataset.root = '';
}

export function apply(ctx: Context) {
  console.log('[dsh-invoke-client] 🚀 正在加载侧边栏面板...');

  // 注入侧边栏按钮（disposer 在插件卸载时自动断开 observer）
  ctx.effect(() => injectSidebarButton(ctx), 'dsh-invoke.sidebar');

  console.log('[dsh-invoke-client] ✅ 侧边栏面板加载完成');
}