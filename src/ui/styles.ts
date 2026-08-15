// src/ui/styles.ts
// DeepSeek Harness 风格设计系统
// 基于 dsh-client-ui-theme 的真实 design token 重建
// 通过注入 <style> 标签 + CSS 类实现，支持 body[data-ds-dark-theme] 自动切换主题

let injected = false;

/**
 * 注入全局样式（幂等，多次调用只注入一次）
 */
export function injectStyles(): void {
  if (injected) return;
  if (typeof document === 'undefined') return;
  injected = true;

  const style = document.createElement('style');
  style.id = 'dsh-invoke-styles';
  style.textContent = `
/* ============ 设计 Token（亮色）============ */
/* 对齐 @deepseek-ai/dsh-client-ui-theme 的 design-platform.css */
#dsh-invoke-root {
  /* 根锚点容器：作为 body 上的覆盖层挂载，flex 纵向撑满 */
  position: fixed;
  inset: 0;
  z-index: 9990;
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* 色板 - static */
  --nb-00: rgb(255,255,255);
  --nb-50: rgb(249,250,251);
  --nb-60: rgb(245,246,247);
  --nb-75: rgb(241,243,245);
  --nb-100: rgb(235,238,242);
  --nb-150: rgb(233,236,242);
  --nb-200: rgb(225,229,238);
  --nb-300: rgb(207,211,214);
  --nb-400: rgb(173,178,184);
  --nb-500: rgb(151,157,166);
  --nb-600: rgb(129,133,140);
  --nb-700: rgb(97,102,107);
  --nb-750: rgb(67,69,74);
  --nb-800: rgb(53,54,56);
  --nb-850: rgb(44,44,46);
  --nb-875: rgb(35,35,36);
  --nb-900: rgb(27,27,28);
  --nb-950: rgb(21,21,23);
  --nb-1000: rgb(15,17,21);

  /* 品牌蓝（deepseek 点缀色）*/
  --ds-500: rgb(65,118,230);
  --ds-400: rgb(103,158,254);
  --ds-50: rgb(237,243,254);
  --ds-100: rgb(228,237,253);

  /* 语义色 */
  --red-600: rgb(220,38,38);
  --red-50: rgb(254,242,242);
  --green-500: rgb(34,197,94);

  /* 别名 - 背景 */
  --pv-bg-base: var(--nb-50);        /* 容器微灰，让卡片浮起 */
  --pv-bg-layer: var(--nb-60);
  --pv-bg-card: var(--nb-00);        /* 卡片纯白 */
  --pv-bg-input: var(--nb-60);
  --pv-bg-hover: rgba(38,49,72,0.06);
  --pv-bg-active: rgba(38,49,72,0.1);
  --pv-bg-mask: rgba(0,0,0,0.24);
  --pv-bg-tag: var(--nb-100);
  --pv-bg-toast: var(--nb-800);
  --pv-bg-modal: var(--nb-00);

  /* 别名 - 文字 */
  --pv-text-primary: var(--nb-1000);
  --pv-text-secondary: var(--nb-700);
  --pv-text-tertiary: var(--nb-600);
  --pv-text-caption: var(--nb-400);
  --pv-text-on-primary: var(--nb-00);

  /* 别名 - 边框（Harness 用极淡半透明）*/
  --pv-border-1: rgba(0,0,0,0.04);
  --pv-border-2: rgba(0,0,0,0.1);
  --pv-border-3: rgba(0,0,0,0.12);

  /* 别名 - 品牌（Harness 主按钮是近黑，不是蓝）*/
  --pv-brand: var(--nb-1000);
  --pv-brand-hover: var(--nb-750);
  --pv-accent: var(--ds-500);
  --pv-accent-hover: var(--ds-400);
  --pv-accent-soft: var(--ds-50);

  /* 阴影（Harness 极轻）*/
  --pv-shadow-1: 0 2px 4px 0 rgba(0,0,0,0.05);
  --pv-shadow-2: 0 4px 12px 0 rgba(0,0,0,0.02), 0 2px 8px 0 rgba(0,0,0,0.04);
  --pv-shadow-modal: 0 0 1px 0 rgba(0,0,0,0.2), 0 12px 32px 0 rgba(0,0,0,0.08);

  /* 圆角（Harness 克制）*/
  --pv-radius-sm: 6px;
  --pv-radius: 8px;
  --pv-radius-lg: 12px;

  /* 字体 */
  --pv-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial, sans-serif;
  --pv-font-mono: "SF Mono", "JetBrains Mono", "Fira Code", Consolas, Menlo, monospace;

  /* 动效（对齐 Harness：.16s 入场 + 标准缓动）*/
  --pv-ease: cubic-bezier(.4, 0, .2, 1);
  --pv-ease-out: cubic-bezier(0, 0, .2, 1);
  --pv-dur-fast: .1s;
  --pv-dur: .16s;
  --pv-dur-slow: .24s;
}

/* ============ 暗色主题 ============ */
body[data-ds-dark-theme="true"] #dsh-invoke-root,
body[data-ds-dark-theme] #dsh-invoke-root,
#dsh-invoke-root[data-pv-theme="dark"] {
  --pv-bg-base: var(--nb-950);
  --pv-bg-layer: var(--nb-900);
  --pv-bg-card: var(--nb-875);
  --pv-bg-input: var(--nb-850);
  --pv-bg-hover: rgba(255,255,255,0.08);
  --pv-bg-active: rgba(255,255,255,0.14);
  --pv-bg-mask: rgba(0,0,0,0.5);
  --pv-bg-tag: var(--nb-800);
  --pv-bg-toast: var(--nb-750);
  --pv-bg-modal: var(--nb-850);

  --pv-text-primary: var(--nb-50);
  --pv-text-secondary: var(--nb-300);
  --pv-text-tertiary: var(--nb-400);
  --pv-text-caption: var(--nb-600);
  --pv-text-on-primary: var(--nb-1000);

  --pv-border-1: rgba(255,255,255,0.06);
  --pv-border-2: rgba(255,255,255,0.12);
  --pv-border-3: rgba(255,255,255,0.16);

  --pv-brand: var(--nb-50);
  --pv-brand-hover: var(--nb-100);
  --pv-accent: var(--ds-400);
  --pv-accent-hover: var(--ds-500);
  --pv-accent-soft: rgba(103,158,254,0.12);
}

/* ============ 布局 ============ */
.pv-container {
  display: flex;
  flex-direction: column;
  flex: 1;
  height: 100%;
  min-height: 0;
  padding: 12px 14px;
  font-family: var(--pv-font);
  color: var(--pv-text-primary);
  background: var(--pv-bg-base);
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
}

/* 顶栏 */
.pv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 0 2px;
}
.pv-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--pv-text-primary);
  letter-spacing: 0.01em;
}
.pv-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: var(--pv-radius-sm);
  cursor: pointer;
  color: var(--pv-text-secondary);
  transition: background 0.15s ease, color 0.15s ease;
}
.pv-icon-btn:hover { background: var(--pv-bg-hover); color: var(--pv-text-primary); }
.pv-header-actions {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 主布局 */
.pv-main {
  display: flex;
  flex: 1;
  overflow: hidden;
  gap: 14px;
}

/* 侧边栏 */
.pv-sidebar {
  width: 168px;
  flex-shrink: 0;
  overflow-y: auto;
  padding-right: 6px;
}

/* 分类项（按钮语义）*/
.pv-cat-item {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  background: transparent;
  border-radius: var(--pv-radius-sm);
  cursor: pointer;
  color: var(--pv-text-secondary);
  font-size: 13px;
  font-family: var(--pv-font);
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
  margin-bottom: 1px;
}
.pv-cat-item:hover { background: var(--pv-bg-hover); }
.pv-cat-item.active {
  background: var(--pv-bg-active);
  color: var(--pv-text-primary);
  font-weight: 500;
}
.pv-cat-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--pv-text-caption);
}
.pv-cat-new {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 8px;
  margin-top: 6px;
  border: none;
  background: transparent;
  border-radius: var(--pv-radius-sm);
  cursor: pointer;
  color: var(--pv-text-tertiary);
  font-size: 13px;
  font-family: var(--pv-font);
  text-align: left;
  transition: background 0.15s ease;
}
.pv-cat-new:hover { background: var(--pv-bg-hover); color: var(--pv-text-secondary); }
.pv-cat-input-row {
  display: flex;
  gap: 6px;
  margin-top: 6px;
  padding: 2px 0;
  align-items: center;
}
.pv-cat-input-row .pv-input { flex: 1; padding: 4px 8px; font-size: 12px; }
.pv-btn-sm { padding: 4px 10px; font-size: 12px; }

/* 右键菜单遮罩层 */
.pv-context-mask {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

/* 内容区 */
.pv-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* 搜索栏 */
.pv-searchbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-shrink: 0;
}
.pv-search-wrap { position: relative; flex: 1; }
.pv-search-icon {
  position: absolute;
  left: 9px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--pv-text-caption);
  display: flex;
}
.pv-search-input {
  width: 100%;
  padding: 6px 10px 6px 30px;
  border-radius: var(--pv-radius);
  border: 1px solid var(--pv-border-2);
  background: var(--pv-bg-card);
  color: var(--pv-text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  font-family: var(--pv-font);
}
.pv-search-input:focus {
  border-color: var(--pv-accent);
  box-shadow: 0 0 0 2px var(--pv-accent-soft);
}
.pv-search-input::placeholder { color: var(--pv-text-caption); }
.pv-stats {
  font-size: 12px;
  color: var(--pv-text-caption);
  white-space: nowrap;
}

/* 卡片网格 */
.pv-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-content: start;
  padding-right: 4px;
}

/* 卡片 */
.pv-card {
  background: var(--pv-bg-card);
  border: 1px solid var(--pv-border-2);
  border-radius: var(--pv-radius);
  padding: 12px 13px;
  box-shadow: var(--pv-shadow-1);
  min-width: 0;
}
.pv-card:hover {
  border-color: var(--pv-border-3);
  box-shadow: var(--pv-shadow-2);
}
.pv-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 4px;
}
.pv-card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--pv-text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pv-card-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}
.pv-card:hover .pv-card-actions,
.pv-card:focus-within .pv-card-actions { opacity: 1; }
.pv-card-action-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  border-radius: var(--pv-radius-sm);
  cursor: pointer;
  color: var(--pv-text-tertiary);
  transition: background 0.15s ease, color 0.15s ease;
}
.pv-card-action-btn:hover { background: var(--pv-bg-hover); color: var(--pv-text-primary); }
.pv-card-action-btn.danger:hover { background: var(--red-50); color: var(--red-600); }
.pv-card-desc {
  font-size: 12px;
  color: var(--pv-text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
}

/* 卡片展开：完整正文预览 */
.pv-card-body {
  font-size: 12px;
  color: var(--pv-text-secondary);
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  background: var(--pv-bg-layer);
  border: 1px solid var(--pv-border-1);
  border-radius: var(--pv-radius-sm);
  padding: 8px 10px;
  margin-bottom: 8px;
  max-height: 180px;
  overflow-y: auto;
  animation: pv-fade-in var(--pv-dur) var(--pv-ease-out);
}
.pv-card-expand-hint {
  font-size: 11px;
  color: var(--pv-text-caption);
  margin-bottom: 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color 0.15s ease;
}
.pv-card:hover .pv-card-expand-hint { color: var(--pv-text-tertiary); }
.pv-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 10px;
}
.pv-tag {
  font-size: 11px;
  padding: 1px 7px;
  border-radius: 999px;
  background: var(--pv-bg-tag);
  color: var(--pv-text-tertiary);
  line-height: 1.6;
}
.pv-tag-builtin {
  background: var(--pv-accent-soft);
  color: var(--pv-accent);
}
.pv-tag-alias {
  background: transparent;
  border: 1px dashed var(--pv-accent);
  color: var(--pv-accent);
  cursor: pointer;
  font-family: var(--pv-font-mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
  transition: background 0.15s ease;
}
.pv-tag-alias:hover {
  background: var(--pv-accent-soft);
}
.pv-card-footer { display: flex; justify-content: flex-end; }

/* 主按钮（Harness 近黑底白字）*/
.pv-btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--pv-radius-sm);
  border: none;
  background: var(--pv-brand);
  color: var(--pv-text-on-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
  font-family: var(--pv-font);
}
.pv-btn-primary:hover { background: var(--pv-brand-hover); }

/* 次按钮 */
.pv-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--pv-radius-sm);
  border: 1px solid var(--pv-border-2);
  background: transparent;
  color: var(--pv-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  font-family: var(--pv-font);
}
.pv-btn-secondary:hover { background: var(--pv-bg-hover); border-color: var(--pv-border-3); }

/* 危险按钮（删除确认）*/
.pv-btn-danger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: var(--pv-radius-sm);
  border: none;
  background: var(--red-600);
  color: var(--nb-00);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
  font-family: var(--pv-font);
}
.pv-btn-danger:hover { background: rgb(185,28,28); }

/* 空状态 */
.pv-empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 48px 16px;
  color: var(--pv-text-caption);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.pv-empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--pv-bg-layer);
  color: var(--pv-text-caption);
  margin-bottom: 2px;
}
.pv-empty-title { font-size: 13px; font-weight: 500; color: var(--pv-text-tertiary); }
.pv-empty-desc { font-size: 12px; color: var(--pv-text-caption); max-width: 260px; line-height: 1.6; }

/* 底部工具栏 */
.pv-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-top: 10px;
  margin-top: 10px;
  border-top: 1px solid var(--pv-border-1);
  font-size: 12px;
  color: var(--pv-text-caption);
  flex-shrink: 0;
}
.pv-toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: var(--pv-radius-sm);
  border: 1px solid var(--pv-border-1);
  background: transparent;
  color: var(--pv-text-tertiary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  font-family: var(--pv-font);
}
.pv-toolbar-btn:hover { background: var(--pv-bg-hover); color: var(--pv-text-secondary); }
.pv-toolbar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  background: transparent;
  color: var(--pv-text-tertiary);
}

/* 导出下拉菜单 */
.pv-dropdown { position: relative; }
.pv-dropdown-menu {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 0;
  min-width: 150px;
  background: var(--pv-bg-modal);
  border: 1px solid var(--pv-border-2);
  border-radius: var(--pv-radius-sm);
  box-shadow: var(--pv-shadow-modal);
  padding: 4px;
  z-index: 9998;
  animation: pv-pop var(--pv-dur) var(--pv-ease-out);
}
.pv-dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  font-size: 12px;
  font-family: var(--pv-font);
  text-align: left;
  color: var(--pv-text-secondary);
  border: none;
  background: transparent;
  border-radius: var(--pv-radius-sm);
  cursor: pointer;
  transition: background 0.15s ease;
}
.pv-dropdown-item:hover { background: var(--pv-bg-hover); color: var(--pv-text-primary); }

.pv-spacer { flex: 1; }
.pv-statusbar { font-size: 11px; color: var(--pv-text-caption); }

/* 键盘焦点可见性 */
#dsh-invoke-root :focus-visible {
  outline: 2px solid var(--pv-accent-soft);
  outline-offset: 1px;
  border-radius: var(--pv-radius-sm);
}

/* ============ 模态框 ============ */
.pv-overlay {
  position: fixed;
  inset: 0;
  background: var(--pv-bg-mask);
  backdrop-filter: blur(2px);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}
.pv-modal {
  background: var(--pv-bg-modal);
  border-radius: var(--pv-radius-lg);
  padding: 20px 22px;
  max-width: 520px;
  width: 100%;
  max-height: 88vh;
  overflow-y: auto;
  border: 1px solid var(--pv-border-2);
  box-shadow: var(--pv-shadow-modal);
}
.pv-modal-sm { max-width: 440px; }
.pv-modal-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--pv-text-primary);
  margin-bottom: 4px;
}
.pv-modal-desc {
  font-size: 13px;
  color: var(--pv-text-secondary);
  margin-bottom: 18px;
  white-space: pre-line; /* 保留 \n 换行（如删除分类的多行提示） */
}

/* 表单 */
.pv-field { margin-bottom: 14px; }
.pv-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--pv-text-secondary);
  margin-bottom: 5px;
}
.pv-required { color: var(--red-600); margin-left: 2px; }
.pv-input, .pv-textarea, .pv-select {
  width: 100%;
  padding: 7px 11px;
  border-radius: var(--pv-radius);
  border: 1px solid var(--pv-border-2);
  background: var(--pv-bg-input);
  color: var(--pv-text-primary);
  font-size: 13px;
  outline: none;
  font-family: var(--pv-font);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.pv-input:focus, .pv-textarea:focus, .pv-select:focus {
  border-color: var(--pv-accent);
  box-shadow: 0 0 0 2px var(--pv-accent-soft);
}
.pv-input::placeholder, .pv-textarea::placeholder { color: var(--pv-text-caption); }
.pv-input-error { border-color: var(--red-600) !important; }
.pv-input-error:focus {
  border-color: var(--red-600) !important;
  box-shadow: 0 0 0 2px var(--red-50) !important;
}
.pv-textarea { resize: vertical; }
.pv-hint { font-size: 11px; color: var(--pv-text-caption); margin-top: 5px; }
.pv-hint-error { color: var(--red-600); }

/* 变量编辑行：名称 + 类型 + 删除 */
.pv-var-row {
  display: grid;
  grid-template-columns: 1fr 1fr 56px;
  gap: 8px;
  margin-bottom: 6px;
  align-items: center;
}

/* 表单区块标题行（左侧 label + 右侧操作按钮）*/
.pv-field-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

/* 紧凑次按钮（用于行内小操作）*/
.pv-btn-compact {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 10px;
  border-radius: var(--pv-radius-sm);
  border: 1px solid var(--pv-border-2);
  background: transparent;
  color: var(--pv-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
  font-family: var(--pv-font);
}
.pv-btn-compact:hover { background: var(--pv-bg-hover); border-color: var(--pv-border-3); color: var(--pv-text-primary); }
.pv-btn-compact.danger { color: var(--red-600); }
.pv-btn-compact.danger:hover { background: var(--red-50); }

/* 单选组 */
.pv-radio-group {
  display: flex;
  gap: 16px;
}
.pv-radio {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--pv-text-secondary);
  cursor: pointer;
  user-select: none;
}
.pv-radio input[type="radio"] {
  appearance: none;
  width: 14px;
  height: 14px;
  border: 1px solid var(--pv-border-3);
  border-radius: 50%;
  background: transparent;
  position: relative;
  cursor: pointer;
  transition: border-color 0.15s ease;
  flex-shrink: 0;
}
.pv-radio input[type="radio"]:hover { border-color: var(--pv-accent); }
.pv-radio input[type="radio"]:checked { border-color: var(--pv-accent); }
.pv-radio input[type="radio"]:checked::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: var(--pv-accent);
}
.pv-radio input[type="radio"]:focus-visible {
  outline: 2px solid var(--pv-accent-soft);
  outline-offset: 1px;
}

/* 错误提示 */
.pv-error {
  background: var(--red-50);
  color: var(--red-600);
  padding: 8px 12px;
  border-radius: var(--pv-radius-sm);
  font-size: 12px;
  margin-bottom: 14px;
}

/* 自动提取提示 */
.pv-extract {
  padding: 8px 12px;
  border-radius: var(--pv-radius-sm);
  font-size: 12px;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 7px;
}
.pv-extract.success { background: var(--pv-accent-soft); color: var(--pv-accent); }
.pv-extract.info { background: var(--pv-bg-tag); color: var(--pv-text-secondary); }

/* 模态框底部按钮 */
.pv-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--pv-border-1);
}

/* 滚动条 */
.pv-grid::-webkit-scrollbar, .pv-sidebar::-webkit-scrollbar, .pv-modal::-webkit-scrollbar { width: 8px; }
.pv-grid::-webkit-scrollbar-thumb, .pv-sidebar::-webkit-scrollbar-thumb, .pv-modal::-webkit-scrollbar-thumb {
  background: var(--pv-border-3);
  border-radius: 4px;
}
.pv-grid::-webkit-scrollbar-track, .pv-sidebar::-webkit-scrollbar-track, .pv-modal::-webkit-scrollbar-track { background: transparent; }

/* Toast（对齐官方：距视口顶 120px、水平居中、3s 保持 + 1s 淡出）*/
.pv-toast {
  position: fixed;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  padding: 8px 18px;
  border-radius: 999px;
  background: var(--pv-bg-toast);
  color: var(--nb-00);
  font-size: 13px;
  z-index: 10000;
  box-shadow: var(--pv-shadow-2);
  transition: opacity 1s ease;
  font-family: var(--pv-font);
}

/* 右键菜单 */
.pv-context-menu {
  position: fixed;
  background: var(--pv-bg-modal);
  border: 1px solid var(--pv-border-2);
  border-radius: var(--pv-radius);
  box-shadow: var(--pv-shadow-modal);
  padding: 4px;
  z-index: 10000;
  min-width: 140px;
}
.pv-context-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 6px 12px;
  font-size: 13px;
  font-family: var(--pv-font);
  text-align: left;
  cursor: pointer;
  color: var(--pv-text-secondary);
  border: none;
  background: transparent;
  border-radius: var(--pv-radius-sm);
  transition: background 0.15s ease;
}
.pv-context-item:hover { background: var(--pv-bg-hover); }
.pv-context-item.danger { color: var(--red-600); }
.pv-context-item.danger:hover { background: var(--red-50); }

/* ============ 动效系统 ============ */

/* 关键帧 */
@keyframes pv-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes pv-rise-in {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pv-scale-in {
  from { opacity: 0; transform: scale(.96) translateY(4px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}
@keyframes pv-toast-in {
  from { opacity: 0; transform: translate(-50%, -8px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}
@keyframes pv-menu-in {
  from { opacity: 0; transform: scale(.95); }
  to { opacity: 1; transform: scale(1); }
}
@keyframes pv-pop {
  from { opacity: 0; transform: translateY(-4px) scale(.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 卡片入场：逐张错峰浮现 */
.pv-card { animation: pv-rise-in var(--pv-dur) var(--pv-ease-out) backwards; }
.pv-card:nth-child(1) { animation-delay: .00s; }
.pv-card:nth-child(2) { animation-delay: .03s; }
.pv-card:nth-child(3) { animation-delay: .06s; }
.pv-card:nth-child(4) { animation-delay: .09s; }
.pv-card:nth-child(5) { animation-delay: .12s; }
.pv-card:nth-child(n+6) { animation-delay: .15s; }

/* 卡片悬停：轻微上浮 + 阴影加深 */
.pv-card {
  transition:
    border-color var(--pv-dur) var(--pv-ease),
    box-shadow var(--pv-dur) var(--pv-ease),
    transform var(--pv-dur) var(--pv-ease);
}
.pv-card:hover { transform: translateY(-1px); }
.pv-card:active { transform: translateY(0); }

/* 按钮：按下轻微缩放（点按反馈）*/
.pv-btn-primary, .pv-btn-secondary, .pv-toolbar-btn, .pv-icon-btn, .pv-card-action-btn {
  transition:
    background var(--pv-dur) var(--pv-ease),
    color var(--pv-dur) var(--pv-ease),
    border-color var(--pv-dur) var(--pv-ease),
    box-shadow var(--pv-dur) var(--pv-ease),
    transform var(--pv-dur-fast) var(--pv-ease),
    opacity var(--pv-dur) var(--pv-ease);
}
.pv-btn-primary:active, .pv-btn-secondary:active, .pv-toolbar-btn:active { transform: scale(.97); }
.pv-icon-btn:active, .pv-card-action-btn:active { transform: scale(.9); }

/* 图标按钮：悬停时图标轻微放大 */
.pv-icon-btn svg, .pv-card-action-btn svg, .pv-btn-primary svg, .pv-toolbar-btn svg {
  transition: transform var(--pv-dur) var(--pv-ease);
}
.pv-icon-btn:hover svg { transform: scale(1.08); }

/* 输入框聚焦：边框 + 光晕平滑过渡 */
.pv-input, .pv-textarea, .pv-select, .pv-search-input {
  transition:
    border-color var(--pv-dur) var(--pv-ease),
    box-shadow var(--pv-dur) var(--pv-ease),
    background var(--pv-dur) var(--pv-ease);
}

/* 分类项：选中态左侧滑入指示条 + 背景过渡 */
.pv-cat-item {
  position: relative;
  transition:
    background var(--pv-dur) var(--pv-ease),
    color var(--pv-dur) var(--pv-ease);
}
.pv-cat-item.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 14px;
  border-radius: 2px;
  background: var(--pv-accent);
  animation: pv-fade-in var(--pv-dur) var(--pv-ease-out);
}

/* 模态框：遮罩淡入 + 内容缩放浮入 */
.pv-overlay { animation: pv-fade-in var(--pv-dur) var(--pv-ease-out); }
.pv-modal { animation: pv-scale-in var(--pv-dur-slow) var(--pv-ease-out); }

/* 右键菜单：弹出缩放 */
.pv-context-menu {
  animation: pv-menu-in var(--pv-dur) var(--pv-ease-out);
  transform-origin: top left;
}

/* Toast：从下方滑入 */
.pv-toast { animation: pv-toast-in var(--pv-dur) var(--pv-ease-out); }

/* 卡片操作按钮：悬停浮现（增强位移）*/
.pv-card-actions {
  transition: opacity var(--pv-dur) var(--pv-ease), transform var(--pv-dur) var(--pv-ease);
  transform: translateX(2px);
}
.pv-card:hover .pv-card-actions { transform: translateX(0); }

/* 减少动态偏好：尊重系统设置 */
@media (prefers-reduced-motion: reduce) {
  .pv-card, .pv-modal, .pv-overlay, .pv-context-menu,
  .pv-btn-primary, .pv-btn-secondary, .pv-icon-btn, .pv-card-action-btn {
    animation: none !important;
    transition: none !important;
  }
  /* 官方约定：reduce-motion 下取消 Toast 滑入，仅保留延迟淡出 */
  .pv-toast {
    animation: none !important;
    transition: opacity 1s ease !important;
  }
}

/* 响应式：窄面板（< 760px）单列网格 + 收窄侧边栏 */
@media (max-width: 760px) {
  .pv-layout { grid-template-columns: 1fr; }
  .pv-sidebar { display: none; }
  .pv-main { min-width: 0; }
  .pv-grid { grid-template-columns: 1fr !important; }
  .pv-search-input { width: 100%; }
}

/* ============ 搜索命中高亮 ============ */
.pv-highlight {
  background: var(--pv-accent-soft);
  color: var(--pv-accent);
  border-radius: 2px;
  padding: 0 1px;
}

/* 标题图标：与文字垂直居中对齐 */
.pv-title {
  display: flex;
  align-items: center;
  gap: 6px;
}
.pv-title-icon { color: var(--pv-accent); flex: none; }

/* 空分类树引导文案 */
.pv-cat-hint {
  margin: 8px 10px 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--pv-text-caption);
}

/* 触屏设备：卡片操作按钮常显（无 hover 时也可见/可点） */
@media (hover: none) {
  .pv-card-actions {
    opacity: 1 !important;
    transform: none !important;
  }
}

/* ============ 侧边栏入口按钮（全局，位于 #dsh-invoke-root 之外） ============ */
/* 不使用 pv token（其作用域为 #dsh-invoke-root），颜色独立定义并跟随 body 暗色主题 */
.dsh-invoke-sidebar-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 8px);
  margin: 2px 4px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--ds-invoke-sb-text, #5c6370);
  font-family: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s ease, color 0.15s ease;
}
.dsh-invoke-sidebar-btn:hover {
  background: var(--ds-invoke-sb-hover, rgba(128, 128, 128, 0.12));
  color: var(--ds-invoke-sb-text-active, #1a1a1a);
}
.dsh-invoke-sidebar-btn svg { flex: none; }
.dsh-invoke-sidebar-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

body[data-ds-dark-theme="true"] .dsh-invoke-sidebar-btn,
body[data-ds-dark-theme] .dsh-invoke-sidebar-btn {
  --ds-invoke-sb-text: #9aa0aa;
  --ds-invoke-sb-text-active: #e6e6e6;
  --ds-invoke-sb-hover: rgba(255, 255, 255, 0.08);
}
`;
  document.head.appendChild(style);
}

