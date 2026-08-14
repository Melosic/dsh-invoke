// @deepseek-ai/dsh 类型声明（本地 stub）
// 真实 npm 包由 DeepSeek Harness 运行时提供，未附带 .d.ts，
// 此文件声明插件实际用到的 API 接口，仅用于本地构建。

export interface CommandAction<T = any> {
  action(fn: (args: T) => void | Promise<void>): void;
  subcommand(name: string, description?: string): CommandAction;
}

export interface UIAPI {
  openPanel?(options: { id: string; title?: string; render?: () => string | HTMLElement }): void;
  registerWebview?(options: { id: string; title?: string; render?: () => string | HTMLElement }): void;
  openFrame?(options: { id: string; title?: string; content?: string | HTMLElement }): void;
}

export interface EditorAPI {
  getSelection?(): string | null;
}

export interface WorkspaceAPI {
  root?: string;
}

export interface StorageConfig {
  userPath?: string;
  projectPath?: string;
}

export interface Context {
  command(name: string, description?: string): CommandAction;
  ui?: UIAPI;
  editor?: EditorAPI;
  workspace?: WorkspaceAPI;
  invoke?: {
    storage?: StorageConfig;
  };
}

export function defineConfig(config: any): any;
