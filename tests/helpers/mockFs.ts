// tests/helpers/mockFs.ts
// 内存版 fs mock：manager/import-export 使用真实路径读写，测试时替换为内存 Map，
// 避免污染真实家目录（~/.deepseek-harness）。

let files = new Map<string, string>();
let dirs = new Set<string>();
/** 每个文件的 mtime（单调递增计数器模拟），供读缓存校验用 */
let mtimes = new Map<string, number>();
let mut = 0;

function enoent(op: string, p: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(
    `ENOENT: no such file or directory, ${op} '${p}'`
  );
  err.code = 'ENOENT';
  return err;
}

export const mockFs = {
  existsSync: (p: string): boolean => dirs.has(p) || files.has(p),
  mkdirSync: (p: string): void => {
    dirs.add(p);
  },
  statSync: (p: string): { mtimeMs: number } => {
    if (!files.has(p) && !dirs.has(p)) throw enoent('stat', p);
    return { mtimeMs: mtimes.get(p) ?? 0 };
  },
  readFileSync: (p: string): string => {
    const content = files.get(p);
    if (content === undefined) throw enoent('open', p);
    return content;
  },
  writeFileSync: (p: string, content: string): void => {
    const idx = p.lastIndexOf('/');
    if (idx > 0) dirs.add(p.slice(0, idx));
    files.set(p, content);
    mtimes.set(p, ++mut);
  },
  copyFileSync: (src: string, dest: string): void => {
    const content = files.get(src);
    if (content === undefined) throw enoent('copy', src);
    files.set(dest, content);
    mtimes.set(dest, ++mut);
  },
  renameSync: (from: string, to: string): void => {
    const content = files.get(from);
    if (content === undefined) throw enoent('rename', from);
    files.delete(from);
    mtimes.delete(from);
    files.set(to, content);
    mtimes.set(to, ++mut);
  },
  /** 供测试检查当前文件系统内容 */
  __files: (): Map<string, string> => files,
  /** 供测试重置文件系统状态 */
  __reset: (): void => {
    files = new Map();
    dirs = new Set();
    mtimes = new Map();
    mut = 0;
  }
};
