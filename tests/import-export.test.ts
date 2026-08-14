// tests/import-export.test.ts
import yaml from 'js-yaml';
import {
  exportToJSON,
  exportToYAML,
  importFromJSON,
  importFromYAML
} from '../src/engine/import-export';
import { readStorage, writeStorage, getAllCategories } from '../src/storage/manager';
import type { Prompt, PromptStorage } from '../src/storage/manager';
import { mockFs } from './helpers/mockFs';

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
