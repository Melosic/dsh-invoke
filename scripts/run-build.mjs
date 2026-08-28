// scripts/run-build.mjs
// 本地构建脚本（宿主机侧执行）：junction 依赖 + 编译 host(tsc) + 打包 client(esbuild)。
// 设计目标：在无法直接 npm install 的环境里，借用 harness 已安装的 @deepseek-ai/*
// 与 esbuild 原生二进制，把插件源码编译为 lib/（host ESM + client CJS bundle）。
// 依赖位置（Windows）：
//   NPM        = C:\Users\AND\AppData\Roaming\npm\node_modules
//   @deepseek-ai (顶层) 含 cordis / dsh-* / cosmokit / schemastery
//   @deepseek-ai/dsh/node_modules 含 @types/node、js-yaml
//   omniroute/node_modules/@esbuild/win32-x64/esbuild.exe 为 esbuild 原生二进制
// 仅用于本地安装构建；不进运行时。

import { symlinkSync, mkdirSync, rmSync, existsSync, readdirSync, cpSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';

const PLUGIN = 'D:\\aaaaa\\dsh-p\\dsh-invoke';
const NPM = 'C:\\Users\\AND\\AppData\\Roaming\\npm\\node_modules';
// 已构建的 @deepseek-ai（harness 运行时实际解析到的副本）
const BUILT_ADEX = join(NPM, '@deepseek-ai', 'dsh', 'node_modules', '@deepseek-ai');
const DSH_NESTED = join(NPM, '@deepseek-ai', 'dsh', 'node_modules');
const TSC = join(NPM, 'typescript', 'bin', 'tsc');
const ESBUILD = join(NPM, 'omniroute', 'node_modules', '@esbuild', 'win32-x64', 'esbuild.exe');

const log = (...a) => console.log('[run-build]', ...a);
const fail = (m) => { console.error('[run-build] FATAL:', m); process.exitCode = 1; };

function junction(target, link) {
  const t = resolve(target);
  const l = resolve(link);
  if (!existsSync(t)) { fail('junction 目标不存在: ' + t); return; }
  rmSync(l, { recursive: true, force: true });
  mkdirSync(dirname(l), { recursive: true });
  try {
    symlinkSync(t, l, 'junction');
    log('junction', l, '->', t);
  } catch (e) {
    fail('junction 失败 ' + l + ': ' + e);
  }
}

/**
 * @types/node 用实体复制而非 junction：
 * 本地 node_modules 是手工装配的，实体目录能让 tsc 的 typeRoots
 * 扫描在任意模式（自动包含 / 显式 types）下都稳定命中，避免
 * 链接目录被工具链跳过导致的 console/process/Buffer 等全局 TS25xx 错。
 */
function copyModule(src, dest) {
  const t = resolve(src);
  const l = resolve(dest);
  if (!existsSync(t)) { fail('复制目标不存在: ' + t); return; }
  rmSync(l, { recursive: true, force: true });
  mkdirSync(dirname(l), { recursive: true });
  try {
    cpSync(t, l, { recursive: true });
    log('copy', l, '<-', t);
  } catch (e) {
    fail('复制失败 ' + l + ': ' + e);
  }
}

function main() {
  const nm = join(PLUGIN, 'node_modules');
  mkdirSync(nm, { recursive: true });

  log('=== 1) 准备本地依赖 ===');
  junction(BUILT_ADEX, join(nm, '@deepseek-ai'));
  copyModule(join(DSH_NESTED, '@types', 'node'), join(nm, '@types', 'node'));
  junction(join(DSH_NESTED, 'js-yaml'), join(nm, 'js-yaml'));

  log('=== 2) 编译 host (tsc -p tsconfig.json) ===');
  const tscR = spawnSync(process.execPath, [
    TSC,
    '-p', join(PLUGIN, 'tsconfig.json'),
    '--noEmitOnError', 'false',
  ], { cwd: PLUGIN, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (tscR.stdout) console.log(tscR.stdout);
  if (tscR.stderr) console.error(tscR.stderr);
  log('tsc exit:', tscR.status);

  log('=== 3) 打包 client (esbuild -> lib/client/index.js) ===');
  const outfile = join(PLUGIN, 'lib', 'client.js');
  mkdirSync(dirname(outfile), { recursive: true });
  const esbArgs = [
    join(PLUGIN, 'src', 'client', 'index.tsx'),
    '--bundle',
    '--format=cjs',
    '--platform=browser',
    '--target=es2020',
    '--outfile=' + outfile,
    '--external:react',
    '--external:react/jsx-runtime',
    '--external:react-dom',
    '--external:react-dom/client',
    '--external:@deepseek-ai/cordis',
    '--define:process.env.NODE_ENV="production"',
    '--define:__DSH_INVOKE_VERSION__="0.2.0"',
    "--banner:js=window.__ModuleLoader__.load({ id: '@dsh-external/dsh-invoke', factory: (require) => { var module = { exports: {} }; var exports = module.exports;",
    "--footer:js=\nreturn module.exports; } });",
  ];
  const esbR = spawnSync(ESBUILD, esbArgs, { cwd: PLUGIN, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (esbR.stdout) console.log(esbR.stdout);
  if (esbR.stderr) console.error(esbR.stderr);
  log('esbuild exit:', esbR.status);

  log('=== 产物检查 ===');
  const hostIdx = join(PLUGIN, 'lib', 'index.js');
  const clientIdx = outfile;
  log('lib/index.js:', existsSync(hostIdx) ? 'OK' : 'MISSING');
  log('lib/client.js:', existsSync(clientIdx) ? 'OK' : 'MISSING');
  if (!existsSync(hostIdx) || !existsSync(clientIdx)) {
    fail('构建产物缺失');
  } else {
    log('构建完成 ✅');
  }
}

main();
