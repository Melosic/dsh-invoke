// src/commands/clipboard.ts
// 跨平台剪贴板复制工具（Host / Node 端）
// 供别名命令调用链使用：渲染提示词后复制到系统剪贴板。
// 实现：spawn 系统剪贴板程序并通过 stdin 写入内容，
// 不经过 shell 拼接，无注入风险，也不破坏换行/特殊字符。

import { spawn } from 'child_process';

/** 每个平台的候选命令（按优先级依次尝试） */
function clipboardCandidates(): string[][] {
  switch (process.platform) {
    case 'darwin':
      return [['pbcopy']];
    case 'win32':
      return [['clip']];
    default:
      // Linux：X11 常见两件套 + Wayland
      return [
        ['xclip', '-selection', 'clipboard'],
        ['xsel', '--clipboard', '--input'],
        ['wl-copy'],
      ];
  }
}

/** 用 spawn 向单个命令写入文本，返回是否成功 */
function writeToCommand(command: string[], text: string): Promise<boolean> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(command[0], command.slice(1), { stdio: ['pipe', 'ignore', 'ignore'] });
    } catch {
      resolve(false);
      return;
    }
    child.on('error', () => resolve(false));
    child.on('close', (code) => resolve(code === 0));
    child.stdin.on('error', () => {
      // 目标程序提前退出（如 clip 忽略尾部写入）不视为失败
    });
    child.stdin.end(text, 'utf-8');
  });
}

/**
 * 复制文本到系统剪贴板
 * @returns 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  for (const command of clipboardCandidates()) {
    if (await writeToCommand(command, text)) return true;
  }
  return false;
}
