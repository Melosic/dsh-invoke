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
import { injectStyles } from '../ui/styles.js';
import { setupI18n } from '../ui/i18n.js';

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

/** 中文字符串常量（避免被压缩器混淆成 unicode 转义） */
const C_SETTINGS = '设置';
const C_LOG_PREFIX = '[dsh-invoke-client]';

/**
 * 匹配「设置 / Settings」按钮（兼容中英文文案与 aria-label）。
 * DSH 中文环境下按钮 text 可能是「设置」，英文环境是 "Settings"。
 */
function isSettingsButton(b: HTMLElement): boolean {
  const text = (b.textContent ?? '').trim();
  const label = (b.getAttribute('aria-label') ?? '').trim();
  const haystacks = [text, label].filter(Boolean);
  return haystacks.some(
    (s) => /^settings$/i.test(s) || s.indexOf(C_SETTINGS) !== -1
  );
}

/**
 * 找到侧边栏「设置」按钮，入口按钮将插在它前面（即设置按钮正上方）。
 * 找不到时返回 null。
 */
function findSettingsButton(): HTMLElement | null {
  return (
    Array.from(document.querySelectorAll<HTMLElement>('button')).find((b) =>
      isSettingsButton(b)
    ) ?? null
  );
}

/**
 * 使用 MutationObserver 自愈地在 Harness 侧边栏注入入口按钮。
 * 当 Harness 的侧边栏区域重新渲染时，observer 会自动重新注入。
 *
 * 注入位置：设置按钮的正上方（insertBefore settings button）。
 */
function injectSidebarButton(ctx: Context): () => void {
  if (!isBrowserEnv()) return () => {};

  /** 打印控制台日志（生产环境也留一份，方便用户排查注入） */
  const log = (msg: string, arg?: unknown): void => {
    try {
      if (typeof console !== 'undefined') console.log(`${C_LOG_PREFIX} ${msg}`, arg ?? '');
    } catch {
      /* 忽略 */
    }
  };

  const inject = (): boolean => {
    // 如果按钮已存在，检查位置是否正确（紧挨设置按钮前）；不正确则移除后重插
    const existing = document.getElementById(SIDEBAR_BTN_ID);
    if (existing) {
      const settingsBtn = findSettingsButton();
      // 正确位置：设置按钮存在 && 按钮的下一个兄弟就是设置按钮
      if (settingsBtn && existing.nextElementSibling === settingsBtn) {
        return true; // 位置正确，无需重插
      }
      // 位置不对，移除后重新插入
      existing.remove();
    }

    const btn = document.createElement('button');
    btn.id = SIDEBAR_BTN_ID;
    btn.className = 'dsh-invoke-sidebar-btn';
    btn.setAttribute('data-sidebar-entry', '');
    btn.setAttribute('aria-label', 'Prompt Vault');
    btn.setAttribute('title', 'Prompt Vault');
    btn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M8.5 1H3.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V5.5L8.5 1zM8.5 2.2v2.8h2.8L8.5 2.2zM5.5 8h5v1h-5V8zm0 2.5h5v1h-5v-1z"/>
      </svg>
      <span class="dsh-invoke-sidebar-label">Prompt Vault</span>
    `;

    btn.addEventListener('click', () => togglePanel());

    // 找到「设置」按钮，把 Prompt Vault 插在它前面（即设置按钮正上方）
    const settingsBtn = findSettingsButton();
    if (settingsBtn && settingsBtn.parentElement) {
      try {
        settingsBtn.parentElement.insertBefore(btn, settingsBtn);
        log('注入成功：已插入到设置按钮上方');
        return true;
      } catch (e) {
        log('插入设置按钮前失败，回退 body', e);
      }
    }

    // 设置按钮还没渲染出来，暂不追加到 body（等下次重试/observer 再试）
    // 这样避免在 DOM 未就绪时把按钮放错位置
    return false;
  };

  // 初次注入（立即 + 两个延迟重试，兼容 Harness 异步挂载侧边栏）
  inject();
  setTimeout(inject, 500);
  setTimeout(inject, 2500);

  // 自愈：当 DOM 变化时重新注入
  const observer = new MutationObserver(() => {
    if (!document.getElementById(SIDEBAR_BTN_ID)) {
      inject();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  return () => observer.disconnect();
}

/** 隐藏面板（保留 DOM 与 React 状态，便于再次打开） */
function hidePanel() {
  const root = document.getElementById(PANEL_ROOT_ID);
  if (root) root.style.display = 'none';
}

/** 切换面板显示/隐藏 */
function togglePanel() {
  const root = document.getElementById(PANEL_ROOT_ID);
  if (!root) {
    mountPanel();
  } else if (root.style.display === 'none') {
    root.style.display = 'flex';
  } else {
    hidePanel();
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
  root.render(React.createElement(WebviewPanel, { onClose: hidePanel }));

  // 存储 root 以便卸载
  container.dataset.root = '';
}

export function apply(ctx: Context) {
  console.log('[dsh-invoke-client] 🚀 正在加载侧边栏面板...');

  // 注册双语字典到官方 locale 服务（不可用时回退内置 zh）
  setupI18n(ctx);

  // 加载时即注入全局样式（幂等），确保侧边栏入口按钮立即可见且有样式
  injectStyles();

  // 注入侧边栏按钮（disposer 在插件卸载时自动断开 observer）
  ctx.effect(() => injectSidebarButton(ctx), 'dsh-invoke.sidebar');

  console.log('[dsh-invoke-client] ✅ 侧边栏面板加载完成');
}