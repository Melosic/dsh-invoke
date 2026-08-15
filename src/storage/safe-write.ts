// src/storage/safe-write.ts
// JSON 存储的原子写入：tmp 写入 → 旧文件备份为 .bak → rename 替换。
// rename 在同一文件系统上是原子操作：进程崩溃/断电时最坏只留下无害的 .tmp，
// 主文件始终是完整的旧版或完整的新版，不会出现截断损坏。
// 读取侧配合 .bak 回退（见 manager.ts / alias-store.ts），形成完整的损坏自愈链路。

import * as fs from 'fs';
import * as path from 'path';

/** 确保指定文件的父目录存在（recursive 幂等，无 existsSync TOCTOU 窗口） */
function ensureDirFor(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/**
 * 清理残留的 .tmp 孤儿文件：writeFileSync(tmp) 与 renameSync 之间崩溃时留下，
 * 主文件未受影响故无害，但多次崩溃会累积。写入前顺手清理本路径的旧 .tmp。
 */
function cleanupStaleTmp(filePath: string): void {
  try {
    fs.unlinkSync(`${filePath}.tmp`);
  } catch {
    // 不存在（常态）或清理失败：均不影响本次写入
  }
}

/** 原子写入 JSON 文件（带 .bak 备份） */
export function writeJsonAtomic(filePath: string, data: unknown): void {
  ensureDirFor(filePath);
  cleanupStaleTmp(filePath);
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  try {
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, `${filePath}.bak`);
    }
  } catch {
    // 备份失败不阻断主流程（主文件仍会被完整的新版替换）
  }
  fs.renameSync(tmp, filePath);
}
