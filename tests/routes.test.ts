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

/** 调用指定路由的 handler 并返回 { status, body, raw, req } */
async function call(
  routePath: string,
  method: string,
  pathname: string,
  opts: ReqOptions = {}
): Promise<{
  status: number;
  body: Record<string, unknown> | null;
  raw: string;
  req: { destroyed: boolean };
}> {
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
  return { status: res.statusCode, body, raw: res.body, req };
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

  test('写操作 Sec-Fetch-Site: cross-site → 403（无 Origin 时的纵深防御）', async () => {
    const r = await call(PROMPTS, 'POST', '/api/dsh-invoke/prompts', {
      headers: { 'sec-fetch-site': 'cross-site' },
      body: { id: 'x2', title: 't', body: 'b' },
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
    expect(r.req.destroyed).toBe(true); // 超限后主动断开连接，不再继续接收
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

describe('别名路由与 upsert 原子性', () => {
  const ALIASES = '/api/dsh-invoke/aliases';
  const promptA = { id: 'rt-alias-a', title: 'Alias A', description: '', category: '开发', tags: [], body: 'a', variables: [] };
  const promptB = { id: 'rt-alias-b', title: 'Alias B', description: '', category: '开发', tags: [], body: 'b', variables: [] };

  beforeAll(async () => {
    for (const p of [promptA, promptB]) {
      const r = await call(PROMPTS, 'POST', `/api/dsh-invoke/prompts${WS_Q()}`, { body: p });
      expect(r.status).toBe(201);
    }
  });

  /** 读取别名映射表 { alias → promptId } */
  async function aliasMap(): Promise<Record<string, string>> {
    const r = await call(ALIASES, 'GET', ALIASES);
    expect(r.status).toBe(200);
    const map: Record<string, string> = {};
    for (const e of r.body?.aliases as Array<{ alias: string; promptId: string }>) {
      map[e.alias] = e.promptId;
    }
    return map;
  }

  test('POST 创建别名 → 201', async () => {
    const r = await call(ALIASES, 'POST', ALIASES, {
      body: { alias: 'rt-aa', promptId: promptA.id, cwd: tmpWs },
    });
    expect(r.status).toBe(201);
    expect(r.body?.alias).toBe('rt-aa');

    const r2 = await call(ALIASES, 'POST', ALIASES, {
      body: { alias: 'rt-bb', promptId: promptB.id, cwd: tmpWs },
    });
    expect(r2.status).toBe(201);
  });

  test('POST 相同别名 + 相同提示词（未变化）→ 200 幂等', async () => {
    const r = await call(ALIASES, 'POST', ALIASES, {
      body: { alias: 'rt-bb', promptId: promptB.id, cwd: tmpWs },
    });
    expect(r.status).toBe(200);
    expect(r.body?.alias).toBe('rt-bb');
  });

  test('POST 撞其他提示词的别名 → 400 且旧别名保留（upsert 原子性）', async () => {
    // rt-alias-a 已有别名 rt-aa；尝试把它的别名改成被 rt-alias-b 占用的 rt-bb
    const r = await call(ALIASES, 'POST', ALIASES, {
      body: { alias: 'rt-bb', promptId: promptA.id, cwd: tmpWs },
    });
    expect(r.status).toBe(400);

    // 关键回归断言：失败后旧别名未丢失，目标别名未易主
    const map = await aliasMap();
    expect(map['rt-aa']).toBe(promptA.id);
    expect(map['rt-bb']).toBe(promptB.id);
  });

  test('POST 重设为新别名 → 201 且完成替换', async () => {
    const r = await call(ALIASES, 'POST', ALIASES, {
      body: { alias: 'rt-cc', promptId: promptA.id, cwd: tmpWs },
    });
    expect(r.status).toBe(201);

    const map = await aliasMap();
    expect(map['rt-cc']).toBe(promptA.id);
    expect(map['rt-aa']).toBeUndefined(); // 旧别名已被替换
    expect(map['rt-bb']).toBe(promptB.id); // 旁观者不受影响
  });

  test('POST 指向不存在的提示词 → 400', async () => {
    const r = await call(ALIASES, 'POST', ALIASES, {
      body: { alias: 'rt-dd', promptId: 'no-such-prompt', cwd: tmpWs },
    });
    expect(r.status).toBe(400);
  });

  test('DELETE 按 name 删除 → success:true，再删 → success:false', async () => {
    const del = await call(ALIASES, 'DELETE', `${ALIASES}?name=rt-cc`);
    expect(del.status).toBe(200);
    expect(del.body?.success).toBe(true);

    const again = await call(ALIASES, 'DELETE', `${ALIASES}?name=rt-cc`);
    expect(again.status).toBe(200);
    expect(again.body?.success).toBe(false);
  });
});

describe('导入 / 导出路由', () => {
  test('POST import（json merge）→ 200 且新增可见', async () => {
    const content = JSON.stringify({
      version: 1,
      prompts: [{ id: 'rt-imp-1', title: 'Imported', body: 'hello' }],
    });
    const r = await call('/api/dsh-invoke/import', 'POST', '/api/dsh-invoke/import', {
      body: { content, format: 'json', mode: 'merge', cwd: tmpWs },
    });
    expect(r.status).toBe(200);
    expect(r.body?.success).toBe(true);
    expect(r.body?.added).toBe(1);

    const list = await call(PROMPTS, 'GET', `/api/dsh-invoke/prompts${WS_Q()}`);
    const ids = (list.body?.prompts as Array<{ id: string }>).map((p) => p.id);
    expect(ids).toContain('rt-imp-1');
  });

  test('POST import 数据形状非法 → 400', async () => {
    const r = await call('/api/dsh-invoke/import', 'POST', '/api/dsh-invoke/import', {
      body: { content: JSON.stringify({ foo: 1 }), format: 'json', mode: 'merge', cwd: tmpWs },
    });
    expect(r.status).toBe(400);
    expect(r.body?.success).toBe(false);
  });

  test('POST import 缺少内容 → 400', async () => {
    const r = await call('/api/dsh-invoke/import', 'POST', '/api/dsh-invoke/import', {
      body: { format: 'json', mode: 'merge', cwd: tmpWs },
    });
    expect(r.status).toBe(400);
  });

  test('GET export（json）→ 200 文本含已导入条目', async () => {
    const r = await call('/api/dsh-invoke/export', 'GET', `/api/dsh-invoke/export?format=json${WS_Q().replace('?', '&')}`);
    expect(r.status).toBe(200);
    expect(r.raw).toContain('rt-imp-1');
  });
});

describe('workspaceRegistry 服务探测容错', () => {
  afterEach(() => {
    // 清理本组注入的 getter，避免影响其他用例
    delete (fakeCtx as Record<string, unknown>).workspaceRegistry;
  });

  test('属性访问抛出（未启动懒代理）→ 降级为未知，不拖垮请求', async () => {
    Object.defineProperty(fakeCtx, 'workspaceRegistry', {
      configurable: true,
      get() {
        throw new Error('service workspaceRegistry is not ready');
      },
    });
    // ?cwd= 路径触发 isCwdAllowed → probeRegisteredWorkspace；
    // 根锚点为 null（beforeAll 设置），降级档放行已存在目录
    const r = await call(PROMPTS, 'GET', `/api/dsh-invoke/prompts${WS_Q()}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body?.prompts)).toBe(true);
  });

  test('resolveByPath 属性访问抛出（懒代理）→ 降级为未知，不拖垮请求', async () => {
    const lazy = {};
    Object.defineProperty(lazy, 'resolveByPath', {
      get() {
        throw new Error('cannot access resolveByPath before start');
      },
    });
    Object.defineProperty(fakeCtx, 'workspaceRegistry', {
      configurable: true,
      value: lazy,
    });
    const r = await call(PROMPTS, 'GET', `/api/dsh-invoke/prompts${WS_Q()}`);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body?.prompts)).toBe(true);
  });

  test('注册表可用且目录未注册 → cwd 被拒（最强档不误放）', async () => {
    Object.defineProperty(fakeCtx, 'workspaceRegistry', {
      configurable: true,
      value: { resolveByPath: async () => undefined },
    });
    const r = await call(PROMPTS, 'GET', `/api/dsh-invoke/prompts${WS_Q()}`);
    expect(r.status).toBe(400);
  });

  test('注册表可用且目录已注册 → 放行', async () => {
    Object.defineProperty(fakeCtx, 'workspaceRegistry', {
      configurable: true,
      value: { resolveByPath: async () => ({ id: 'ws-1' }) },
    });
    const r = await call(PROMPTS, 'GET', `/api/dsh-invoke/prompts${WS_Q()}`);
    expect(r.status).toBe(200);
  });
});
