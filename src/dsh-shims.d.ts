// src/dsh-shims.d.ts
// 编译期类型垫片：运行时由 junction 进 node_modules 的真实包提供实现，
// 此处仅补齐缺失的 TS 声明，使 tsc 在不安装 @types/* 的情况下通过。
// 仅用于本地构建（dev_build_plugin / run-build.mjs），不进入运行时逻辑。

declare module 'js-yaml' {
  export function load(input: string, options?: unknown): any;
  export function dump(obj: unknown, options?: unknown): string;
  export function safeLoad(input: string, options?: unknown): any;
  export function safeDump(obj: unknown, options?: unknown): string;
}
