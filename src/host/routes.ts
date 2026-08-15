// src/host/routes.ts
// Prompt Vault 的 HTTP 路由层：将存储 CRUD 暴露给浏览器端 client。
// 注册在 ctx.webServer 上，client 通过 fetch 访问同源 /api/dsh-invoke/*。
//
// 安全模型（统一安全门，见 add() 包装器）：
//   1. Host 白名单（全部请求）—— 防 DNS rebinding：攻击者域名重解析到本机回环
//   2. Origin 同源校验（写操作）—— 防 CSRF：恶意网页跨站 POST/PUT/DELETE
//   3. 显式 cwd 白名单（全部请求）—— 防任意目录写入：?cwd=/body.cwd
//      必须是已存在目录，且（注册表可用时）为 dsh 已注册的工作区

import type { IncomingMessage, ServerResponse } from 'node:http';
import { stat } from 'node:fs/promises';
import * as path from 'path';
import { ht } from '../shared/host-messages.js';
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
import { resolveStorageContext } from '../storage/context.js';
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

function forbidden(res: ServerResponse, message = 'Forbidden'): void {
  json(res, 403, { error: message });
}

// ============ 请求安全校验 ============

/** 允许的 Host：本机名、回环与局域网字面地址（防 DNS rebinding） */
const ALLOWED_HOST =
  /^(?:localhost|127(?:\.\d{1,3}){3}|0\.0\.0\.0|\[::1?\]|\[fe80:|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?$/i;

function isAllowedHost(req: IncomingMessage): boolean {
  return ALLOWED_HOST.test((req.headers.host ?? '').trim());
}

/**
 * 写操作校验 Origin：存在时必须与 Host 同源（防 CSRF，含 text/plain 表单跨站提交）。
 * GET/HEAD 无副作用不校验；无 Origin 的请求（curl/服务端调用）放行，
 * 其风险已由 Host 白名单（防 rebinding）覆盖。
 */
function isSameOrigin(req: IncomingMessage): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).host.toLowerCase() === (req.headers.host ?? '').toLowerCase();
  } catch {
    return false; // 形如 sandbox iframe 的 "null" origin
  }
}

/** 运行时鸭子类型探测目录是否为已注册工作区；注册表不可用时返回 null（未知） */
async function probeRegisteredWorkspace(ctx: Context, root: string): Promise<boolean | null> {
  const registry = (ctx as { workspaceRegistry?: { resolveByPath(p: string): Promise<unknown> } })
    .workspaceRegistry;
  if (typeof registry?.resolveByPath !== 'function') return null;
  try {
    return (await registry.resolveByPath(root)) !== undefined;
  } catch {
    return false;
  }
}

/**
 * 校验显式 cwd 是否在允许范围内：必须是已存在的目录，
 * 且（注册表可用时）必须是 dsh 已注册的工作区。
 * 防止任意目录写入原语（向 <任意路径>/.harness/prompts.json 投递文件）。
 */
async function isCwdAllowed(ctx: Context, raw: string | undefined | null): Promise<boolean> {
  const trimmed = raw?.trim();
  if (!trimmed) return true; // 未显式指定，使用全局初始化值
  const resolved = path.resolve(trimmed);
  try {
    if (!(await stat(resolved)).isDirectory()) return false;
  } catch {
    return false;
  }
  const registered = await probeRegisteredWorkspace(ctx, resolved);
  return registered !== false;
}

function serverError(res: ServerResponse, error: unknown): void {
  json(res, 500, { error: error instanceof Error ? error.message : 'Internal Server Error' });
}

/** 请求体大小上限（导入文件等场景足够，防异常超大包占用内存） */
const MAX_BODY_BYTES = 10 * 1024 * 1024;

/** 读取并解析 JSON 请求体（超过上限拒绝） */
function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.destroy();
        reject(new Error('请求体过大（上限 10MB）'));
        return;
      }
      chunks.push(chunk);
    });
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

/** 从查询串提取显式工作目录（?cwd=），用于按调用方上下文解析项目级存储 */
function queryCwd(url: string | undefined): string | undefined {
  const raw = new URL(url ?? '/', 'http://localhost').searchParams.get('cwd');
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

// ============ 路由注册 ============

/**
 * 注册所有 Prompt Vault 路由。
 * 返回 disposer，卸载时由 cordis 自动回调。
 * 注意：webServer 不允许重复 (kind, path)，故每个 handler 使用唯一路径。
 */
export function registerRoutes(ctx: Context): () => void {
  const disposers: Array<() => void> = [];

  // 统一安全门：所有路由先过 Host / Origin / cwd 校验再进业务 handler
  const add = (route: WebRoute) => {
    disposers.push(
      ctx.webServer.register({
        ...route,
        handler: async (req, res) => {
          if (!isAllowedHost(req)) {
            return forbidden(res, ht('api.hostForbidden'));
          }
          if (!isSameOrigin(req)) {
            return forbidden(res, ht('api.originForbidden'));
          }
          if (!(await isCwdAllowed(ctx, queryCwd(req.url)))) {
            return badRequest(res, ht('api.cwdNotAllowed'));
          }
          return route.handler(req, res);
        },
      })
    );
  };

  // ---- 提示词：列表 / 新增 ----

  add({
    kind: 'exact',
    path: `${API_BASE}/prompts`,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://localhost');

      if (req.method === 'GET') {
        const sortMode = (url.searchParams.get('sort') as PromptSortMode) || 'smart';
        const prompts = getSortedPrompts(sortMode, queryCwd(req.url));
        return json(res, 200, { prompts });
      }

      if (req.method === 'POST') {
        try {
          const body = (await readJsonBody(req)) as Omit<
            Prompt,
            'builtin' | 'usageCount' | 'createdAt' | 'updatedAt'
          > & { cwd?: string };
          if (!body.id || !body.title || !body.body) {
            return badRequest(res, ht('api.missingFields'));
          }
          if (!(await isCwdAllowed(ctx, body.cwd ?? queryCwd(req.url)))) {
            return badRequest(res, ht('api.cwdNotAllowed'));
          }
          const created = addPrompt(body, body.cwd?.trim() || queryCwd(req.url));
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
      const cwd = queryCwd(req.url);

      if (!id) return notFound(res);

      // 使用次数
      if (parts[4] === 'use' && req.method === 'POST') {
        incrementUsage(id, cwd);
        return json(res, 200, { success: true });
      }

      if (req.method === 'GET') {
        const prompt = getPromptById(id, cwd);
        if (!prompt) return notFound(res, `提示词 ${id} 不存在`);
        return json(res, 200, prompt);
      }

      if (req.method === 'PUT') {
        try {
          const body = (await readJsonBody(req)) as Partial<
            Omit<Prompt, 'id' | 'builtin' | 'createdAt'>
          > & { cwd?: string };
          if (!(await isCwdAllowed(ctx, body.cwd ?? cwd))) {
            return badRequest(res, ht('api.cwdNotAllowed'));
          }
          const updated = updatePrompt(
            id,
            body,
            body.cwd?.trim() || cwd
          );
          if (!updated) return notFound(res, ht('api.promptNotFound', { id }));
          return json(res, 200, updated);
        } catch (error) {
          return error instanceof Error
            ? badRequest(res, error.message)
            : serverError(res, error);
        }
      }

      if (req.method === 'DELETE') {
        const deleted = deletePrompt(id, cwd);
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
          const body = (await readJsonBody(req)) as { alias?: string; promptId?: string; cwd?: string };
          if (!body.alias || !body.promptId) {
            return badRequest(res, ht('api.aliasMissingFields'));
          }
          if (!(await isCwdAllowed(ctx, body.cwd ?? queryCwd(req.url)))) {
            return badRequest(res, ht('api.cwdNotAllowed'));
          }
          const cwd = body.cwd?.trim() || queryCwd(req.url);
          if (!getPromptById(body.promptId, cwd)) {
            return badRequest(res, ht('api.aliasPromptNotFound', { id: body.promptId }));
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

          const entry = addAlias(body.alias, body.promptId, cwd);
          const failed = syncAliasCommands(ctx);
          if (failed.length > 0) {
            return json(res, 201, {
              ...entry,
              warning: ht('api.aliasCmdFailed', { alias: entry.alias })
            });
          }
          return json(res, 201, entry);
        } catch (error) {
          return error instanceof Error
            ? badRequest(res, error.message)
            : serverError(res, error);
        }
      }

      if (req.method === 'DELETE') {
        const name = url.searchParams.get('name');
        if (!name) return badRequest(res, ht('api.aliasNameMissing'));
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
        return json(res, 200, { categories: getAllCategories(queryCwd(req.url)) });
      }

      if (req.method === 'POST') {
        try {
          const body = (await readJsonBody(req)) as { name?: string; cwd?: string };
          if (!body.name || !body.name.trim()) {
            return badRequest(res, ht('api.categoryEmpty'));
          }
          if (!(await isCwdAllowed(ctx, body.cwd ?? queryCwd(req.url)))) {
            return badRequest(res, ht('api.cwdNotAllowed'));
          }
          addCustomCategory(body.name.trim(), body.cwd?.trim() || queryCwd(req.url));
          return json(res, 201, { success: true });
        } catch (error) {
          return serverError(res, error);
        }
      }

      if (req.method === 'DELETE') {
        const name = url.searchParams.get('name');
        if (!name) return badRequest(res, ht('api.categoryNameMissing'));
        removeCustomCategory(name, queryCwd(req.url));
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
          cwd?: string;
        };
        if (typeof body.content !== 'string' || !body.content) {
          return badRequest(res, ht('api.importContentMissing'));
        }
        if (!(await isCwdAllowed(ctx, body.cwd ?? queryCwd(req.url)))) {
          return badRequest(res, ht('api.cwdNotAllowed'));
        }
        const cwd = body.cwd?.trim() || queryCwd(req.url);
        const result: ImportResult =
          body.format === 'yaml'
            ? importFromYAML(body.content, body.mode || 'merge', cwd)
            : importFromJSON(body.content, body.mode || 'merge', cwd);
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
      const cwd = queryCwd(req.url);
      const content = format === 'yaml' ? exportToYAML(cwd) : exportToJSON(cwd);
      return text(res, 200, content);
    },
  });

  // ---- 工作区信息 ----
  // 返回项目级存储解析结果，供 UI / 诊断使用。
  // cwd 来源优先级：?cwd= > 插件加载时的全局初始化值（Host 进程工作目录）。
  // workspaceRegistry 存在时顺带验证该目录是否为 dsh 注册的 workspace。

  add({
    kind: 'exact',
    path: `${API_BASE}/workspace`,
    handler: async (req, res) => {
      if (req.method !== 'GET') return notFound(res);
      const cwd = queryCwd(req.url);
      const { workspaceRoot, projectStoragePath } = resolveStorageContext(cwd);

      const registered = workspaceRoot
        ? await probeRegisteredWorkspace(ctx, workspaceRoot)
        : null;

      return json(res, 200, {
        workspaceRoot,
        projectStoragePath,
        registeredWorkspace: registered,
      });
    },
  });

  return () => {
    disposers.forEach((disposer) => disposer());
  };
}