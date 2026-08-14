// src/types/dsh.d.ts
// @deepseek-ai/dsh 模块类型声明
// 真实 npm 包未附带 .d.ts，此文件声明插件实际用到的 API 接口

declare module '@deepseek-ai/dsh' {
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
}
