// src/shared/log.ts
// 运行轨迹日志（host 与 client 共用）。
// 默认静默，设 DSH_INVOKE_DEBUG=1 输出；warn/error 始终保留，不走本工具。
// 注意：client bundle 运行在浏览器（无 process），必须用 typeof 守卫。

const DEBUG_ENABLED =
  typeof process !== 'undefined' && process.env?.DSH_INVOKE_DEBUG === '1';

export function debugLog(...args: unknown[]): void {
  if (DEBUG_ENABLED) {
    console.log('[dsh-invoke]', ...args);
  }
}
