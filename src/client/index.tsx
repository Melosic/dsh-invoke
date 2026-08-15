// src/client/index.tsx
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
import { initApiClient } from './api.js';
import { debugLog } from '../shared/log.js';

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
 * slot 化入口：注册到官方侧边栏的 sidebar.footer.action（kind: list）。
 * 返回 true 表示已进入等待/注册流程（无论 slot 是否已声明）；
 * 返回 false 表示宿主无 slots 服务（旧版 Harness），调用方走 DOM 兜底。
 *
 * 注意：slot 未声明时 register 会同步 throw，所以用 slots.inject() 等待
 * 声明提交后再注册（官方跨插件加载顺序机制）；全程 try/catch，
 * 任何失败都静默降级到 DOM 注入方案。
 */
function tryRegisterSlotEntry(ctx: Context): boolean {
  // cordis 懒代理下未 inject 声明的服务属性访问即抛错，需 try/catch 后走 DOM 兜底
  let slots: SlotsService | undefined;
  try {
    slots = (ctx as { slots?: SlotsService }).slots;
  } catch {
    return false;
  }
  if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
    return false;
  }
  try {
    let disposeEntry: (() => void) | null = null;
    const stopInject = slots.inject('sidebar.footer.action', () => {
      try {
        const dispose = slots.register(
          { name: 'sidebar.footer.action', id: 'dsh-invoke', order: 10, label: 'Prompt Vault' },
          SidebarEntryButton
        );
        if (typeof dispose === 'function') disposeEntry = dispose as () => void;
        // slot 入口接管后，DOM 兜底按钮退场（observer 由 disposer 断开）
        document.getElementById(SIDEBAR_BTN_ID)?.remove();
        stopDomFallback();
        debugLog('registered into official sidebar.footer.action slot');
      } catch (e) {
        console.warn(`${C_LOG_PREFIX} slot 注册失败，保持 DOM 注入兜底`, e);
      }
    });
    // 卸载/热重载时注销 slot 入口与 inject 等待，避免按钮残留与回调悬挂
    ctx.effect(() => () => {
      try {
        if (typeof stopInject === 'function') stopInject();
      } catch {
        /* 忽略清理失败 */
      }
      try {
        disposeEntry?.();
      } catch {
        /* 忽略清理失败 */
      }
    }, 'dsh-invoke.slot-entry');
    return true;
  } catch (e) {
    console.warn(`${C_LOG_PREFIX} slots.inject 不可用，走 DOM 注入兜底`, e);
    return false;
  }
}

/** slots 服务的最小运行时接口（类型层 SlotMap 未合并进编译图，按结构探测） */
interface SlotsService {
  inject(key: string, callback: () => void): unknown;
  register<P>(options: { name: string; id: string; order?: number; label?: string }, component: React.ComponentType<P>): unknown;
}

/** slot 入口按钮的 props（官方 sidebar 渲染时注入 wide） */
interface SidebarEntryProps {
  wide?: boolean;
}

/** 官方侧边栏 footer slot 入口按钮：28×28 圆钮（wide）/ 36×36（折叠 rail） */
const SidebarEntryButton: React.FC<SidebarEntryProps> = ({ wide }) => (
  <button
    type="button"
    className={`dsh-invoke-slot-btn${wide ? '' : ' rail'}`}
    aria-label="Prompt Vault"
    title="Prompt Vault"
    onClick={() => togglePanel()}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path fill="currentColor" fillRule="evenodd" clipRule="evenodd" d="M8.5 1H3.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V5.5L8.5 1zM8.5 2.2v2.8h2.8L8.5 2.2zM5.5 8h5v1h-5V8zm0 2.5h5v1h-5v-1z" />
    </svg>
  </button>
);

/** DOM 兜底的退出钩子（slot 注册成功时调用） */
let stopDomFallback: () => void = () => {};

/**
 * 使用 MutationObserver 自愈地在 Harness 侧边栏注入入口按钮（DOM 兜底方案）。
 * 官方 slot 可用时会自动退场；当 Harness 的侧边栏区域重新渲染时，observer 会自动重新注入。
 *
 * 注入位置：设置按钮的正上方（insertBefore settings button）。
 */
function injectSidebarButton(ctx: Context): () => void {
  if (!isBrowserEnv()) return () => {};

  /** 打印控制台日志（DSH_INVOKE_DEBUG=1 时输出） */
  const log = (msg: string, arg?: unknown): void => {
    try {
      debugLog(msg, arg ?? '');
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
        console.warn(`${C_LOG_PREFIX} 插入设置按钮前失败，回退 body`, e);
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

  const dispose = () => {
    observer.disconnect();
    document.getElementById(SIDEBAR_BTN_ID)?.remove();
  };
  stopDomFallback = dispose;
  return dispose;
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
  debugLog('loading sidebar panel');

  // 注册双语字典到官方 locale 服务（不可用时回退内置 zh）
  setupI18n(ctx);

  // 解析会话工作目录并缓存：后续所有 API 请求携带 ?cwd=/body.cwd，
  // 使 GUI 的项目级存储显式定位（而非依赖 host 进程启动目录），并过 host 端 cwd 白名单
  void initApiClient();

  // 加载时即注入全局样式（幂等），确保侧边栏入口按钮立即可见且有样式
  injectStyles();

  // 入口策略：优先官方 sidebar.footer.action slot；DOM 注入兜底并行运行，
  // slot 注册成功后自动退场（stopDomFallback）。覆盖三种情形：
  //   1. 无 slots 服务（旧版宿主）→ 仅 DOM 兜底
  //   2. slot 已声明/稍后声明 → slot 接管，DOM 兜底退场
  //   3. slots 服务存在但 slot 永不声明 → DOM 兜底持续工作
  tryRegisterSlotEntry(ctx);
  ctx.effect(() => injectSidebarButton(ctx), 'dsh-invoke.sidebar');

  debugLog('sidebar panel loaded');
}