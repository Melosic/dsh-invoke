// tests/helpers/mockFs.ts
// 内存版 fs mock：manager/import-export 使用真实路径读写，测试时替换为内存 Map，
// 避免污染真实家目录（~/.deepseek-harness）。

let files = new Map<string, string>();
let dirs = new Set<string>();

export const mockFs = {
  existsSync: (p: string): boolean => dirs.has(p) || files.has(p),
  mkdirSync: (p: string): void => {
    dirs.add(p);
  },
  readFileSync: (p: string): string => {
    const content = files.get(p);
    if (content === undefined) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, open '${p}'`
      );
      err.code = 'ENOENT';
      throw err;
    }
    return content;
  },
  writeFileSync: (p: string, content: string): void => {
    const idx = p.lastIndexOf('/');
    if (idx > 0) dirs.add(p.slice(0, idx));
    files.set(p, content);
  },
  copyFileSync: (src: string, dest: string): void => {
    const content = files.get(src);
    if (content === undefined) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, copy '${src}'`
      );
      err.code = 'ENOENT';
      throw err;
    }
    files.set(dest, content);
  },
  renameSync: (from: string, to: string): void => {
    const content = files.get(from);
    if (content === undefined) {
      const err: NodeJS.ErrnoException = new Error(
        `ENOENT: no such file or directory, rename '${from}'`
      );
      err.code = 'ENOENT';
      throw err;
    }
    files.delete(from);
    files.set(to, content);
  },
  /** 供测试检查当前文件系统内容 */
  __files: (): Map<string, string> => files,
  /** 供测试重置文件系统状态 */
  __reset: (): void => {
    files = new Map();
    dirs = new Set();
  }
};
