// src/host/routes.ts
// Prompt Vault 的 HTTP 路由层：将存储 CRUD 暴露给浏览器端 client。
// 注册在 ctx.webServer 上，client 通过 fetch 访问同源 /api/dsh-invoke/*。

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Context } from '@deepseek-ai/cordis';
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver';
import {
  getAllPrompts,
  getPromptById,
  addPrompt,
  updatePrompt,
  deletePrompt,
  incrementUsage,
  getAllCategories,
  addCustomCategory,
  removeCustomCategory,
  getSortedPrompts,
  type Prompt,
  type PromptSortMode,
} from '../storage/manager.js';
import {
  getAllAliases,
  getAliasByPromptId,
  addAlias,
  removeAlias,
  normalizeAliasInput,
} from '../storage/alias-store.js';
import { syncAliasCommands } from '../commands/alias.js';
import {
  exportToJSON,
  exportToYAML,
  importFromJSON,
  importFromYAML,
  type ImportResult,
} from '../engine/import-export.js';

/** 路由前缀：client 端 fetch 的基路径 */
export const API_BASE = '/api/dsh-invoke';

// ============ HTTP 工具 ============

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function text(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function notFound(res: ServerResponse, message = 'Not Found'): void {
  json(res, 404, { error: message });
}

function badRequest(res: ServerResponse, message: string): void {
  json(res, 400, { error: message });
}

function serverError(res: ServerResponse, error: unknown): void {
  json(res, 500, { error: error instanceof Error ? error.message : 'Internal Server Error' });
}

/** 读取并解析 JSON 请求体 */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

/** 解析 URL，返回 pathname 分段数组（如 /api/dsh-invoke/prompts → ['api','dsh-invoke','prompts']） */
function pathSegments(url: string | undefined): string[] {
  const pathname = (url ?? '/').split('?')[0];
  return pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
}

// ============ 路由注册 ============

/**
 * 注册所有 Prompt Vault 路由。
 * 返回 disposer，卸载时由 cordis 自动回调。
 * 注意：webServer 不允许重复 (kind, path)，故每个 handler 使用唯一路径。
 */
export function registerRoutes(ctx: Context): () => void {
  const disposers: Array<() => void> = [];

  const add = (route: WebRoute) => {
    disposers.push(ctx.webServer.register(route));
  };

  // ---- 提示词：列表 / 新增 ----

  add({
    kind: 'exact',
    path: `${API_BASE}/prompts`,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'GET') {
        const sortMode = (url.searchParams.get('sort') as PromptSortMode) || 'smart';
        const prompts = getSortedPrompts(sortMode);
        return json(res, 200, { prompts });
      }

      if (req.method === 'POST') {
        try {
          const body = (await readJsonBody(req)) as Omit<
            Prompt,
            'builtin' | 'usageCount' | 'createdAt' | 'updatedAt'
          >;
          if (!body.id || !body.title || !body.body) {
            return badRequest(res, '缺少必填字段（id / title / body）');
          }
          const created = addPrompt(body);
          return json(res, 201, created);
        } catch (error) {
          return error instanceof Error
            ? badRequest(res, error.message)
            : serverError(res, error);
        }
      }

      return notFound(res);
    },
  });

  // ---- 提示词：单个 / 使用次数 ----
  // /prompt/:id           GET / PUT / DELETE
  // /prompt/:id/use       POST（增加使用次数）

  add({
    kind: 'prefix',
    path: `${API_BASE}/prompt`,
    handler: async (req, res) => {
      const parts = pathSegments(req.url);
      const id = parts[3];

      if (!id) return notFound(res);

      // 使用次数
      if (parts[4] === 'use' && req.method === 'POST') {
        incrementUsage(id);
        return json(res, 200, { success: true });
      }

      if (req.method === 'GET') {
        const prompt = getPromptById(id);
        if (!prompt) return notFound(res, `提示词 ${id} 不存在`);
        return json(res, 200, prompt);
      }

      if (req.method === 'PUT') {
        try {
          const body = await readJsonBody(req);
          const updated = updatePrompt(
            id,
            body as Partial<Omit<Prompt, 'id' | 'builtin' | 'createdAt'>>
          );
          if (!updated) return notFound(res, `提示词 ${id} 不存在`);
          return json(res, 200, updated);
        } catch (error) {
          return error instanceof Error
            ? badRequest(res, error.message)
            : serverError(res, error);
        }
      }

      if (req.method === 'DELETE') {
        const deleted = deletePrompt(id);
        // deletePrompt 级联删除了该提示词的别名，此处同步注销对应命令
        if (deleted) syncAliasCommands(ctx);
        return json(res, 200, { success: deleted });
      }

      return notFound(res);
    },
  });

  // ---- 别名：列表 / 新增 / 删除 ----
  // 别名数据全局存储于用户级 aliases.json（不区分工作区）

  add({
    kind: 'exact',
    path: `${API_BASE}/aliases`,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'GET') {
        return json(res, 200, { aliases: getAllAliases() });
      }

      if (req.method === 'POST') {
        try {
          const body = (await readJsonBody(req)) as { alias?: string; promptId?: string };
          if (!body.alias || !body.promptId) {
            return badRequest(res, '缺少必填字段（alias / promptId）');
          }
          if (!getPromptById(body.promptId)) {
            return badRequest(res, `提示词 ID「${body.promptId}」不存在`);
          }

          // upsert 语义：一个提示词一个别名，重设时替换旧别名
          const normalized = normalizeAliasInput(body.alias);
          const existing = getAliasByPromptId(body.promptId);
          if (existing) {
            if (existing.alias === normalized) {
              return json(res, 200, existing); // 未变化
            }
            removeAlias(existing.alias);
          }

          const entry = addAlias(body.alias, body.promptId);
          syncAliasCommands(ctx);
          return json(res, 201, entry);
        } catch (error) {
          return error instanceof Error
            ? badRequest(res, error.message)
            : serverError(res, error);
        }
      }

      if (req.method === 'DELETE') {
        const name = url.searchParams.get('name');
        if (!name) return badRequest(res, '缺少别名（?name=）');
        const removed = removeAlias(name);
        if (removed) syncAliasCommands(ctx);
        return json(res, 200, { success: removed });
      }

      return notFound(res);
    },
  });

  // ---- 分类：列表 / 新增 / 删除 ----

  add({
    kind: 'exact',
    path: `${API_BASE}/categories`,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'GET') {
        return json(res, 200, { categories: getAllCategories() });
      }

      if (req.method === 'POST') {
        try {
          const body = (await readJsonBody(req)) as { name?: string };
          if (!body.name || !body.name.trim()) {
            return badRequest(res, '分类名称不能为空');
          }
          addCustomCategory(body.name.trim());
          return json(res, 201, { success: true });
        } catch (error) {
          return serverError(res, error);
        }
      }

      if (req.method === 'DELETE') {
        const name = url.searchParams.get('name');
        if (!name) return badRequest(res, '缺少分类名称（?name=）');
        removeCustomCategory(name);
        return json(res, 200, { success: true });
      }

      return notFound(res);
    },
  });

  // ---- 导入 ----

  add({
    kind: 'exact',
    path: `${API_BASE}/import`,
    handler: async (req, res) => {
      if (req.method !== 'POST') return notFound(res);
      try {
        const body = (await readJsonBody(req)) as {
          content: string;
          format: 'json' | 'yaml';
          mode: 'overwrite' | 'merge';
        };
        if (typeof body.content !== 'string' || !body.content) {
          return badRequest(res, '缺少导入内容');
        }
        const result: ImportResult =
          body.format === 'yaml'
            ? importFromYAML(body.content, body.mode || 'merge')
            : importFromJSON(body.content, body.mode || 'merge');
        return json(res, result.success ? 200 : 400, result);
      } catch (error) {
        return serverError(res, error);
      }
    },
  });

  // ---- 导出 ----

  add({
    kind: 'exact',
    path: `${API_BASE}/export`,
    handler: async (req, res) => {
      if (req.method !== 'GET') return notFound(res);
      const url = new URL(req.url ?? '/', 'http://localhost');
      const format = url.searchParams.get('format') || 'json';
      const content = format === 'yaml' ? exportToYAML() : exportToJSON();
      return text(res, 200, content);
    },
  });

  return () => {
    disposers.forEach((disposer) => disposer());
  };
}