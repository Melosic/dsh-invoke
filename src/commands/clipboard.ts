// src/commands/clipboard.ts
// 跨平台剪贴板复制工具（命令行版本）
// 供 prompt 命令和 alias 命令共用

/**
 * 复制文本到系统剪贴板
 * 由于 Node.js 没有内置剪贴板 API，使用 child_process 调用系统命令
 * @param text 要复制的文本
 * @returns 是否成功
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  // 根据平台选择复制命令
  let command: string;
  switch (process.platform) {
    case 'darwin':
      command = `echo "${escapeShell(text)}" | pbcopy`;
      break;
    case 'win32':
      command = `echo ${escapeShell(text)} | clip`;
      break;
    default:
      command = `echo "${escapeShell(text)}" | xclip -selection clipboard`;
      break;
  }

  try {
    await execAsync(command);
    return true;
  } catch (error) {
    // 尝试备用方案（xsel）
    if (process.platform !== 'darwin' && process.platform !== 'win32') {
      try {
        await execAsync(`echo "${escapeShell(text)}" | xsel --clipboard --input`);
        return true;
      } catch {
        // 两者都失败，返回 false
      }
    }
    return false;
  }
}

/**
 * 转义 shell 特殊字符，避免注入
 */
function escapeShell(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');
}

