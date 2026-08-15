// tests/import-export.test.ts
import yaml from 'js-yaml';
import {
  exportToJSON,
  exportToYAML,
  importFromJSON,
  importFromYAML
} from '../src/engine/import-export';
import { readStorage, writeStorage, getAllCategories } from '../src/storage/manager';
import type { Prompt, PromptStorage, Variable } from '../src/storage/manager';
import { mockFs } from './helpers/mockFs';

jest.mock('@deepseek-ai/dsh-home-paths', () => ({
  dshHomePath: () => '/tmp/dsh-invoke-test'
}));
jest.mock('fs', () => require('./helpers/mockFs').mockFs);

function makePrompt(overrides: Partial<Prompt> = {}): Prompt {
  const now = new Date().toISOString();
  return {
    id: 'p1',
    title: 'Title',
    description: 'Desc',
    category: '开发',
    tags: [],
    body: 'body',
    variables: [],
    builtin: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeStorage(prompts: Prompt[], categories: string[] = ['团队']): PromptStorage {
  return {
    version: 1,
    categories,
    customCategories: [],
    prompts
  };
}

describe('exportToJSON', () => {
  beforeEach(() => mockFs.__reset());

  test('导出可解析的 JSON，包含内置示例', () => {
    const json = exportToJSON();
    const data = JSON.parse(json) as PromptStorage;
    expect(data.version).toBe(1);
    expect(Array.isArray(data.prompts)).toBe(true);
    expect(data.prompts.some(p => p.id === 'code-review')).toBe(true);
  });
});

describe('importFromJSON', () => {
  beforeEach(() => mockFs.__reset());

  test('非法结构返回失败', () => {
    const result = importFromJSON('{"foo":1}', 'merge');
    expect(result.success).toBe(false);
    expect(result.message).toContain('无效的数据格式');
  });

  test('非法 JSON 返回失败', () => {
    const result = importFromJSON('not-json{', 'merge');
    expect(result.success).toBe(false);
    expect(result.message).toContain('导入失败');
  });

  test('merge 模式：新增新 ID，跳过重复 ID', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a', title: 'A' })]));
    const imported = makeStorage([
      makePrompt({ id: 'a', title: 'A2' }),
      makePrompt({ id: 'b', title: 'B' })
    ]);
    const result = importFromJSON(JSON.stringify(imported), 'merge');
    expect(result.success).toBe(true);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);

    const storage = readStorage();
    expect(storage.prompts).toHaveLength(2);
    // 已存在的 ID 保留原内容，不被覆盖
    expect(storage.prompts.find(p => p.id === 'a')?.title).toBe('A');
    expect(storage.prompts.find(p => p.id === 'b')).toBeDefined();
  });

  test('merge 模式：导入的分类并入自定义分类', () => {
    writeStorage(makeStorage([], ['已有分类']));
    const imported = makeStorage([makePrompt({ id: 'x' })], ['新分类']);
    importFromJSON(JSON.stringify(imported), 'merge');
    expect(getAllCategories()).toContain('新分类');
    expect(getAllCategories()).toContain('已有分类');
  });

  test('overwrite 模式：覆盖全部提示词', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a', title: 'A' })]));
    const imported = makeStorage([makePrompt({ id: 'b', title: 'B' })]);
    const result = importFromJSON(JSON.stringify(imported), 'overwrite');
    expect(result.success).toBe(true);
    expect(result.added).toBe(1);

    const storage = readStorage();
    expect(storage.prompts.map(p => p.id)).toEqual(['b']);
  });

  test('merge 模式：无效条目被过滤，不进入存储', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a' })]));
    const imported = {
      version: 1,
      categories: ['x'],
      prompts: [
        makePrompt({ id: 'b' }),
        { id: '', title: '空 ID' },
        'not-an-object',
        { nope: 1 }
      ]
    };
    const result = importFromJSON(JSON.stringify(imported), 'merge');
    expect(result.success).toBe(true);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(3);
    expect(result.message).toContain('过滤无效条目 3 条');

    const storage = readStorage();
    expect(storage.prompts.map(p => p.id).sort()).toEqual(['a', 'b']);
  });

  test('overwrite 模式：version 不取导入值，无效条目被过滤', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a' })]));
    const imported = {
      version: 999,
      categories: 'not-array',
      prompts: [makePrompt({ id: 'b' }), { nope: 1 }]
    };
    const result = importFromJSON(JSON.stringify(imported), 'overwrite');
    expect(result.success).toBe(true);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);

    const storage = readStorage();
    expect(storage.version).toBe(1);
    expect(storage.prompts.map(p => p.id)).toEqual(['b']);
  });

  test('变量数组中的非法项被过滤，提示词保留', () => {
    const imported = makeStorage([
      makePrompt({
        id: 'v1',
        variables: [{ name: 'code', type: 'text' }, 'bad' as unknown as Variable]
      })
    ]);
    const result = importFromJSON(JSON.stringify(imported), 'overwrite');
    expect(result.success).toBe(true);
    expect(result.added).toBe(1);

    const storage = readStorage();
    expect(storage.prompts[0].variables).toHaveLength(1);
    expect(storage.prompts[0].variables[0].name).toBe('code');
  });

  test('merge 模式：导入的 customCategories 并入自定义分类', () => {
    writeStorage(makeStorage([], ['已有分类']));
    const imported: PromptStorage = {
      version: 1,
      categories: [],
      customCategories: ['项目分类'],
      prompts: [makePrompt({ id: 'x' })]
    };
    importFromJSON(JSON.stringify(imported), 'merge');
    expect(getAllCategories()).toContain('项目分类');
  });
});

describe('原子写入与损坏回退', () => {
  beforeEach(() => mockFs.__reset());

  test('二次写入产生 .bak 备份，主文件始终为最新版', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a' })]));
    writeStorage(makeStorage([makePrompt({ id: 'b' })]));

    const files = mockFs.__files();
    const main = JSON.parse(files.get('/tmp/dsh-invoke-test/prompts.user.json')!) as PromptStorage;
    expect(main.prompts.map(p => p.id)).toEqual(['b']);
    const bak = JSON.parse(files.get('/tmp/dsh-invoke-test/prompts.user.json.bak')!) as PromptStorage;
    expect(bak.prompts.map(p => p.id)).toEqual(['a']);
  });

  test('主文件损坏时读取回退 .bak 备份', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a' })]));
    writeStorage(makeStorage([makePrompt({ id: 'b' })]));
    // 模拟崩溃截断（writeFileSync 会更新 mtime，使读缓存失效）
    mockFs.writeFileSync('/tmp/dsh-invoke-test/prompts.user.json', '{broken');

    const storage = readStorage();
    expect(storage.prompts.map(p => p.id)).toEqual(['a']);
  });
});

describe('读缓存', () => {
  beforeEach(() => mockFs.__reset());

  test('manager 写路径后立即读到最新（写穿透）', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a' })]));
    expect(readStorage().prompts.map(p => p.id)).toEqual(['a']);
    writeStorage(makeStorage([makePrompt({ id: 'b' })]));
    expect(readStorage().prompts.map(p => p.id)).toEqual(['b']);
  });

  test('外部修改（mtime 变化）后读到新内容，不返回脏缓存', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a' })]));
    expect(readStorage().prompts.map(p => p.id)).toEqual(['a']);
    // 模拟外部编辑器改写（不经 manager 写路径，但 mtime 变化）
    mockFs.writeFileSync(
      '/tmp/dsh-invoke-test/prompts.user.json',
      JSON.stringify(makeStorage([makePrompt({ id: 'z' })]))
    );
    expect(readStorage().prompts.map(p => p.id)).toEqual(['z']);
  });

  test('文件被删除后读取回退默认存储（缓存失效）', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a' })]));
    mockFs.__files().delete('/tmp/dsh-invoke-test/prompts.user.json');
    const s = readStorage();
    expect(s.prompts.some(p => p.id === 'code-review')).toBe(true);
  });
});

describe('exportToYAML / importFromYAML', () => {
  beforeEach(() => mockFs.__reset());

  test('导出可解析的 YAML，包含内置示例', () => {
    const yamlString = exportToYAML();
    const data = yaml.load(yamlString) as PromptStorage;
    expect(data.version).toBe(1);
    expect(Array.isArray(data.prompts)).toBe(true);
    expect(data.prompts.some(p => p.id === 'code-review')).toBe(true);
  });

  test('YAML 往返（overwrite）保留多行正文与标签', () => {
    writeStorage(
      makeStorage([
        makePrompt({ id: 'a', title: 'A', body: '多行正文\n{{code}}', tags: ['x', 'y'] })
      ])
    );
    const yamlString = exportToYAML();
    const result = importFromYAML(yamlString, 'overwrite');
    expect(result.success).toBe(true);

    const storage = readStorage();
    const prompt = storage.prompts.find(p => p.id === 'a');
    expect(prompt?.title).toBe('A');
    expect(prompt?.body).toBe('多行正文\n{{code}}');
    expect(prompt?.tags).toEqual(['x', 'y']);
  });

  test('merge 模式：新增新 ID，跳过重复 ID', () => {
    writeStorage(makeStorage([makePrompt({ id: 'a', title: 'A' })]));
    const imported = makeStorage([
      makePrompt({ id: 'a', title: 'A2' }),
      makePrompt({ id: 'b', title: 'B' })
    ]);
    const result = importFromYAML(yaml.dump(imported), 'merge');
    expect(result.success).toBe(true);
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(1);

    const storage = readStorage();
    expect(storage.prompts.find(p => p.id === 'a')?.title).toBe('A');
    expect(storage.prompts.find(p => p.id === 'b')).toBeDefined();
  });

  test('非法 YAML 返回失败', () => {
    const result = importFromYAML('not: [valid: yaml', 'merge');
    expect(result.success).toBe(false);
    expect(result.message).toContain('导入失败');
  });

  test('缺少必填字段的 YAML 返回失败', () => {
    const result = importFromYAML('foo: bar', 'merge');
    expect(result.success).toBe(false);
    expect(result.message).toContain('无效的数据格式');
  });
});
