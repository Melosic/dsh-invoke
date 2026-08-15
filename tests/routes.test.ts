// tests/routes.test.ts
// routes 层测试：安全门（Host / Origin / cwd 白名单）、queryCwd、方法分派、CRUD 透传。
// 使用真实临时目录（无 fs mock），覆盖 stat/isDirectory 的真实路径校验。

import { Readable } from 'stream';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { registerRoutes } from '../src/host/routes';
import { initStorageContext } from '../src/storage/context';

// 用户级存储落到独立临时目录，避免污染真实家目录
jest.mock('@deepseek-ai/dsh-home-paths', () => {
  const r = { fs: require('fs'), os: require('os'), path: require('path') };
  const dir = r.fs.mkdtempSync(r.path.join(r.os.tmpdir(), 'dsh-routes-home-'));
  return { dshHomePath: () => dir };
});

// ============ 路由捕获 ============

interface CapturedRoute {
  kind: string;
  path: string;
  handler: (req: unknown, res: unknown) => unknown;
}

const captured: CapturedRoute[] = [];
const fakeCtx = {
  webServer: {
    register(route: CapturedRoute) {
      captured.push(route);
      return () => undefined;
    },
  },
};

// ============ req / res 模拟 ============

interface ReqOptions {
  headers?: Record<string, string>;
  body?: unknown;
  /** 直接以原始字符串作为请求体（构造超大 body 时避免 JSON 序列化开销） */
  rawBody?: string;
}

function makeRes() {
  return {
    statusCode: 0,
    body: '' as string,
    writeHead(status: number, _headers: Record<string, string>) {
      this.statusCode = status;
    },
    end(body?: string) {
      if (body !== undefined) this.body = body;
    },
  };
}

/** 调用指定路由的 handler 并返回 { status, body } */
async function call(
  routePath: string,
  method: string,
  pathname: string,
  opts: ReqOptions = {}
): Promise<{ status: number; body: Record<string, unknown> | null; raw: string }> {
  const route = captured.find((r) => r.path === routePath);
  if (!route) throw new Error(`route not found: ${routePath}`);

  // 用 Readable 模拟请求体：数据在 readJsonBody 挂上监听后才流动，
  // 与安全门包装器中 await 之后再进业务 handler 的时序兼容
  const payload =
    opts.rawBody !== undefined
      ? opts.rawBody
      : opts.body !== undefined
        ? JSON.stringify(opts.body)
        : '';
  const req = Readable.from(payload ? [Buffer.from(payload)] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = method;
  req.url = pathname;
  req.headers = { host: 'localhost:3000', ...opts.headers };

  const res = makeRes();
  await route.handler(req, res);

  let body: Record<string, unknown> | null = null;
  try {
    body = res.body ? (JSON.parse(res.body) as Record<string, unknown>) : null;
  } catch {
    body = null;
  }
  return { status: res.statusCode, body, raw: res.body };
}

// ============ 用例 ============

/** 项目级测试工作区（真实目录，过 cwd 白名单的 stat 校验） */
let tmpWs: string;

beforeAll(() => {
  initStorageContext(null); // 隔离全局 cwd，测试内全部走显式 ?cwd=
  tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-routes-ws-'));
  registerRoutes(fakeCtx as never);
});

afterAll(() => {
  fs.rmSync(tmpWs, { recursive: true, force: true });
});

const WS_Q = () => `?cwd=${encodeURIComponent(tmpWs)}`;
const PROMPTS = '/api/dsh-invoke/prompts';
const PROMPT_PREFIX = '/api/dsh-invoke/prompt';

describe('安全门', () => {
  test('Host 非法（外部域名）→ 403', async () => {
    const r = await call(PROMPTS, 'GET', '/api/dsh-invoke/prompts', {
      headers: { host: 'evil.example.com' },
    });
    expect(r.status).toBe(403);
    expect(String(r.body?.error)).toContain('Host');
  });

  test('写操作跨站 Origin → 403（防 CSRF）', async () => {
    const r = await call(PROMPTS, 'POST', '/api/dsh-invoke/prompts', {
      headers: { origin: 'https://evil.example.com' },
      body: { id: 'x1', title: 't', body: 'b' },
    });
    expect(r.status).toBe(403);
    expect(String(r.body?.error)).toContain('Origin');
  });

  test('GET 无 Origin 放行（curl / 服务端调用）', async () => {
    const r = await call(PROMPTS, 'GET', `/api/dsh-invoke/prompts${WS_Q()}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body?.prompts)).toBe(true);
  });

  test('cwd 指向不存在的路径 → 400', async () => {
    const r = await call(PROMPTS, 'GET', '/api/dsh-invoke/prompts?cwd=/nonexistent-dsh-test');
    expect(r.status).toBe(400);
    expect(String(r.body?.error)).toContain('cwd');
  });

  test('请求体超过 10MB → 400 且连接被销毁', async () => {
    const huge = JSON.stringify({ pad: 'a'.repeat(10 * 1024 * 1024 + 64) });
    const r = await call(PROMPTS, 'POST', '/api/dsh-invoke/prompts', { rawBody: huge });
    expect(r.status).toBe(400);
    expect(String(r.body?.error)).toContain('10MB');
  });
});

describe('CRUD 透传与方法分派', () => {
  test('POST 创建（项目级 cwd）→ 201，GET 列表可见', async () => {
    const created = await call(PROMPTS, 'POST', `/api/dsh-invoke/prompts${WS_Q()}`, {
      body: { id: 'rt-1', title: 'Route Test', description: '', category: '开发', tags: [], body: 'hello {{name}}', variables: [] },
    });
    expect(created.status).toBe(201);
    expect(created.body?.id).toBe('rt-1');

    const list = await call(PROMPTS, 'GET', `/api/dsh-invoke/prompts${WS_Q()}`);
    expect(list.status).toBe(200);
    const ids = (list.body?.prompts as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain('rt-1');
  });

  test('PUT 更新 → 200 且内容生效', async () => {
    const r = await call(PROMPT_PREFIX, 'PUT', `/api/dsh-invoke/prompt/rt-1${WS_Q()}`, {
      body: { title: 'Renamed' },
    });
    expect(r.status).toBe(200);
    expect(r.body?.title).toBe('Renamed');
  });

  test('GET 单个：不存在 → 404', async () => {
    const r = await call(PROMPT_PREFIX, 'GET', `/api/dsh-invoke/prompt/nope${WS_Q()}`);
    expect(r.status).toBe(404);
  });

  test('DELETE 不存在的提示词 → success:false（幂等）', async () => {
    const r = await call(PROMPT_PREFIX, 'DELETE', `/api/dsh-invoke/prompt/nope${WS_Q()}`);
    expect(r.status).toBe(200);
    expect(r.body?.success).toBe(false);
  });

  test('DELETE 已创建的提示词 → success:true，再 GET 404', async () => {
    const del = await call(PROMPT_PREFIX, 'DELETE', `/api/dsh-invoke/prompt/rt-1${WS_Q()}`);
    expect(del.status).toBe(200);
    expect(del.body?.success).toBe(true);

    const got = await call(PROMPT_PREFIX, 'GET', `/api/dsh-invoke/prompt/rt-1${WS_Q()}`);
    expect(got.status).toBe(404);
  });

  test('未支持的方法 → 404（方法分派兜底）', async () => {
    const r = await call(PROMPTS, 'PATCH', `/api/dsh-invoke/prompts${WS_Q()}`);
    expect(r.status).toBe(404);
  });

  test('分类：POST 新增 → 201，GET 列表包含', async () => {
    const add = await call('/api/dsh-invoke/categories', 'POST', '/api/dsh-invoke/categories', {
      body: { name: '路由测试分类', cwd: tmpWs },
    });
    expect(add.status).toBe(201);

    const list = await call('/api/dsh-invoke/categories', 'GET', `/api/dsh-invoke/categories${WS_Q()}`);
    expect(list.status).toBe(200);
    expect((list.body?.categories as string[])).toContain('路由测试分类');
  });

  test('workspace 端点返回项目级存储路径', async () => {
    const r = await call('/api/dsh-invoke/workspace', 'GET', `/api/dsh-invoke/workspace${WS_Q()}`);
    expect(r.status).toBe(200);
    expect(r.body?.workspaceRoot).toBe(tmpWs);
    expect(String(r.body?.projectStoragePath)).toContain('.harness');
  });
});
