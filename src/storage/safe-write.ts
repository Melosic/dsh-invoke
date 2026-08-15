// src/storage/safe-write.ts
// JSON 存储的原子写入：tmp 写入 → 旧文件备份为 .bak → rename 替换。
// rename 在同一文件系统上是原子操作：进程崩溃/断电时最坏只留下无害的 .tmp，
// 主文件始终是完整的旧版或完整的新版，不会出现截断损坏。
// 读取侧配合 .bak 回退（见 manager.ts / alias-store.ts），形成完整的损坏自愈链路。

import * as fs from 'fs';
import * as path from 'path';

/** 确保指定文件的父目录存在 */
function ensureDirFor(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/** 原子写入 JSON 文件（带 .bak 备份） */
export function writeJsonAtomic(filePath: string, data: unknown): void {
  ensureDirFor(filePath);
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
