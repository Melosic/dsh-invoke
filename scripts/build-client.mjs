// scripts/build-client.mjs
// 构建 dsh-invoke 的浏览器端 client bundle。
// 产出 DeepSeek Harness 官方要求的闭包工厂格式：
//   window.__ModuleLoader__.load({ id, factory: (require) => { ... return module.exports; } });
// 平台模块（react / react-dom / cordis 等）保持 external，由 shell 的模块表通过 require 注入。

import { build } from 'esbuild';
import { readFileSync } from 'node:fs';

/** 版本号单源：从 package.json 读取，构建时注入 __DSH_INVOKE_VERSION__ */
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

/** 平台 seed 模块：shell 共享进冻结模块表的 specifier，必须保持 external */
const PLATFORM_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
];

await build({
  entryPoints: ['src/client/index.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  outfile: 'dist/client/index.js',
  external: PLATFORM_MODULES,
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
    __DSH_INVOKE_VERSION__: JSON.stringify(pkg.version),
  },
  banner: {
    js: 'window.__ModuleLoader__.load({ id: "dsh-invoke", factory: (require) => {\nvar module = { exports: {} }; var exports = module.exports;',
  },
  footer: {
    js: '\nreturn module.exports; } });',
  },
  logLevel: 'info',
});

console.log('[build-client] ✅ 已生成 dist/client/index.js');
