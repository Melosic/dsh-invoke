// tests/manager.test.ts
import {
  readStorage,
  readProjectStorage,
  writeStorage,
  writeProjectStorage,
  getMergedStorage,
  getPromptById,
  getAllCategories,
  addPrompt,
  updatePrompt,
  deletePrompt,
  incrementUsage,
  addCustomCategory,
  removeCustomCategory,
  computeSmartScore,
  getSortedPrompts
} from '../src/storage/manager';
import { initStorageContext } from '../src/storage/context';
import type { Prompt, PromptStorage } from '../src/storage/manager';
import { addAlias, getAllAliases } from '../src/storage/alias-store';
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
    tags: ['t'],
    body: 'body {{x}}',
    variables: [{ name: 'x', type: 'text', required: true }],
    builtin: false,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function makeStorage(prompts: Prompt[] = [], customCategories: string[] = []): PromptStorage {
  return {
    version: 1,
    categories: ['开发', '测试', '文档', '效率'],
    customCategories,
    prompts
  };
}

const basePrompt = (id: string, title = 'Title'): Parameters<typeof addPrompt>[0] => ({
  id,
  title,
  description: 'Desc',
  category: '开发',
  tags: [],
  body: 'body',
  variables: []
});

describe('user storage (without workspace)', () => {
  beforeEach(() => mockFs.__reset());

  test('首次读取自动创建默认存储，含内置示例', () => {
    const storage = readStorage();
    expect(storage.prompts).toHaveLength(1);
    expect(storage.prompts[0].id).toBe('code-review');
    expect(storage.prompts[0].builtin).toBe(true);
  });

  test('无工作区时 getMergedStorage writable 为 user', () => {
    const merged = getMergedStorage();
    expect(merged.writable).toBe('user');
    expect(merged.storage.prompts.some(p => p.id === 'code-review')).toBe(true);
  });

  test('addPrompt 写入用户级存储', () => {
    const added = addPrompt(basePrompt('my'));
    expect(added.builtin).toBe(false);
    expect(added.usageCount).toBe(0);
    const storage = readStorage();
    expect(storage.prompts.some(p => p.id === 'my')).toBe(true);
  });

  test('addPrompt 重复 ID 抛错', () => {
    addPrompt(basePrompt('dup'));
    expect(() => addPrompt(basePrompt('dup'))).toThrow(/已存在/);
  });

  test('updatePrompt 更新字段并刷新 updatedAt', () => {
    addPrompt(basePrompt('u1', 'old'));
    const updated = updatePrompt('u1', { title: 'new' });
    expect(updated?.title).toBe('new');
    expect(getPromptById('u1')?.title).toBe('new');
  });

  test('updatePrompt 不存在的 ID 返回 null', () => {
    expect(updatePrompt('nope', { title: 'x' })).toBeNull();
  });

  test('deletePrompt 删除返回 true，再次删除返回 false', () => {
    addPrompt(basePrompt('d1'));
    expect(deletePrompt('d1')).toBe(true);
    expect(deletePrompt('d1')).toBe(false);
    expect(getPromptById('d1')).toBeNull();
  });

  test('getPromptById 找不到返回 null', () => {
    expect(getPromptById('missing')).toBeNull();
  });

  test('getAllCategories 返回预置 + 自定义分类', () => {
    addCustomCategory('AI辅助');
    const cats = getAllCategories();
    expect(cats).toContain('开发');
    expect(cats).toContain('AI辅助');
  });

  test('addCustomCategory 去重', () => {
    addCustomCategory('AI辅助');
    addCustomCategory('AI辅助');
    expect(getAllCategories().filter(c => c === 'AI辅助')).toHaveLength(1);
  });

  test('removeCustomCategory 移除自定义分类', () => {
    addCustomCategory('AI辅助');
    removeCustomCategory('AI辅助');
    expect(getAllCategories()).not.toContain('AI辅助');
  });

  test('incrementUsage 增加次数并记录最近使用', () => {
    addPrompt(basePrompt('i1'));
    incrementUsage('i1');
    incrementUsage('i1');
    const prompt = getPromptById('i1');
    expect(prompt?.usageCount).toBe(2);
    expect(prompt?.lastUsedAt).toBeDefined();
  });

  test('computeSmartScore：使用次数权重', () => {
    expect(computeSmartScore(makePrompt({ usageCount: 3 }))).toBe(30);
  });

  test('computeSmartScore：最近使用有衰减加分', () => {
    const now = Date.now();
    const prompt = makePrompt({ usageCount: 0, lastUsedAt: new Date(now).toISOString() });
    expect(computeSmartScore(prompt, now)).toBeCloseTo(50, 0);
  });

  test('computeSmartScore：未来时间不加分', () => {
    const now = Date.now();
    const prompt = makePrompt({ usageCount: 0, lastUsedAt: new Date(now + 1000000).toISOString() });
    expect(computeSmartScore(prompt, now)).toBe(0);
  });

  test('getSortedPrompts usage 按使用次数降序', () => {
    writeStorage(
      makeStorage([
        makePrompt({ id: 'a', title: 'A', usageCount: 1 }),
        makePrompt({ id: 'b', title: 'B', usageCount: 5 })
      ])
    );
    const sorted = getSortedPrompts('usage');
    expect(sorted[0].id).toBe('b');
    expect(sorted[1].id).toBe('a');
  });

  test('getSortedPrompts name 按标题排序', () => {
    writeStorage(
      makeStorage([
        makePrompt({ id: 'a', title: 'beta' }),
        makePrompt({ id: 'b', title: 'alpha' })
      ])
    );
    const sorted = getSortedPrompts('name');
    expect(sorted[0].title).toBe('alpha');
  });

  test('getSortedPrompts created 按创建时间降序', () => {
    const now = Date.now();
    writeStorage(
      makeStorage([
        makePrompt({ id: 'a', createdAt: new Date(now).toISOString() }),
        makePrompt({ id: 'b', createdAt: new Date(now + 10000).toISOString() })
      ])
    );
    const sorted = getSortedPrompts('created');
    expect(sorted[0].id).toBe('b');
  });

  test('getSortedPrompts smart 综合得分排序', () => {
    writeStorage(
      makeStorage([
        makePrompt({ id: 'highUsage', usageCount: 10 }),
        makePrompt({ id: 'recent', usageCount: 0, lastUsedAt: new Date().toISOString() }),
        makePrompt({ id: 'cold', usageCount: 2 })
      ])
    );
    const sorted = getSortedPrompts('smart');
    expect(sorted[0].id).toBe('highUsage');
    expect(sorted[1].id).toBe('recent');
    expect(sorted[2].id).toBe('cold');
  });
});

describe('project storage (with workspace + merge)', () => {
  beforeAll(() => initStorageContext('/workspace'));
  beforeEach(() => mockFs.__reset());

  test('有工作区但无项目文件时 writable 为 both', () => {
    const merged = getMergedStorage();
    expect(merged.writable).toBe('both');
  });

  test('addPrompt 优先写入项目级，用户级不变', () => {
    addPrompt(basePrompt('pj'));
    const project = readProjectStorage();
    expect(project?.prompts.some(p => p.id === 'pj')).toBe(true);
    const user = readStorage();
    expect(user.prompts.some(p => p.id === 'pj')).toBe(false);
  });

  test('双层合并：项目级覆盖同 ID 提示词', () => {
    writeStorage(makeStorage([makePrompt({ id: 'p1', title: 'UserTitle' })]));
    writeProjectStorage(
      makeStorage([
        makePrompt({ id: 'p1', title: 'ProjectTitle' }),
        makePrompt({ id: 'p2', title: 'OnlyProject' })
      ])
    );
    const { storage, writable } = getMergedStorage();
    expect(writable).toBe('both');
    expect(storage.prompts.find(p => p.id === 'p1')?.title).toBe('ProjectTitle');
    expect(storage.prompts.find(p => p.id === 'p2')).toBeDefined();
  });

  test('合并后 getPromptById 取项目级版本', () => {
    writeStorage(makeStorage([makePrompt({ id: 'p1', title: 'UserTitle' })]));
    writeProjectStorage(makeStorage([makePrompt({ id: 'p1', title: 'ProjectTitle' })]));
    expect(getPromptById('p1')?.title).toBe('ProjectTitle');
  });

  test('双层合并：自定义分类取并集', () => {
    writeStorage(makeStorage([], ['用户分类']));
    writeProjectStorage(makeStorage([], ['项目分类']));
    const { storage } = getMergedStorage();
    expect(storage.customCategories).toContain('用户分类');
    expect(storage.customCategories).toContain('项目分类');
  });

  test('updatePrompt 优先更新项目级记录', () => {
    writeStorage(makeStorage([makePrompt({ id: 'p1', title: 'User' })]));
    writeProjectStorage(makeStorage([makePrompt({ id: 'p1', title: 'Proj' })]));
    const updated = updatePrompt('p1', { title: 'New' });
    expect(updated?.title).toBe('New');
    expect(readProjectStorage()?.prompts.find(p => p.id === 'p1')?.title).toBe('New');
    expect(readStorage().prompts.find(p => p.id === 'p1')?.title).toBe('User');
  });

  test('deletePrompt 同时删除两层记录', () => {
    writeStorage(makeStorage([makePrompt({ id: 'p1' })]));
    writeProjectStorage(makeStorage([makePrompt({ id: 'p1' })]));
    expect(deletePrompt('p1')).toBe(true);
    expect(getPromptById('p1')).toBeNull();
    expect(readProjectStorage()?.prompts.some(p => p.id === 'p1')).toBe(false);
    expect(readStorage().prompts.some(p => p.id === 'p1')).toBe(false);
  });

  test('deletePrompt 级联删除别名', () => {
    addAlias('cascade', 'p1');
    writeStorage(makeStorage([makePrompt({ id: 'p1' })]));
    expect(deletePrompt('p1')).toBe(true);
    expect(getAllAliases().some(a => a.promptId === 'p1')).toBe(false);
  });

  test('incrementUsage 双层副本同步更新', () => {
    writeStorage(makeStorage([makePrompt({ id: 'p1', usageCount: 0 })]));
    writeProjectStorage(makeStorage([makePrompt({ id: 'p1', usageCount: 0 })]));
    incrementUsage('p1');
    expect(readStorage().prompts.find(p => p.id === 'p1')?.usageCount).toBe(1);
    expect(readProjectStorage()?.prompts.find(p => p.id === 'p1')?.usageCount).toBe(1);
  });
});

describe('explicit cwd (session-scoped project storage)', () => {
  // 全局初始化到 /workspace（模拟 Host 启动目录），显式 cwd 模拟会话真实目录
  beforeAll(() => initStorageContext('/workspace'));
  beforeEach(() => mockFs.__reset());

  test('显式 cwd 覆盖全局工作区：读写指向会话目录', () => {
    addPrompt(basePrompt('scoped'), '/sessions/alpha');
    // 写入的是 /sessions/alpha/.harness/prompts.json，而非 /workspace 下
    expect(readProjectStorage('/sessions/alpha')?.prompts.some(p => p.id === 'scoped')).toBe(true);
    expect(readProjectStorage()?.prompts.some(p => p.id === 'scoped') ?? false).toBe(false);
  });

  test('getMergedStorage 显式 cwd 返回对应项目路径', () => {
    const { projectStoragePath } = getMergedStorage('/sessions/beta');
    expect(projectStoragePath).toBe('/sessions/beta/.harness/prompts.json');
  });

  test('getPromptById / incrementUsage / deletePrompt 均跟随显式 cwd', () => {
    writeProjectStorage(makeStorage([makePrompt({ id: 'pc', usageCount: 0 })]), '/sessions/gamma');
    expect(getPromptById('pc', '/sessions/gamma')).not.toBeNull();
    expect(getPromptById('pc')).toBeNull(); // 全局 /workspace 下不存在

    incrementUsage('pc', '/sessions/gamma');
    expect(readProjectStorage('/sessions/gamma')?.prompts.find(p => p.id === 'pc')?.usageCount).toBe(1);

    expect(deletePrompt('pc', '/sessions/gamma')).toBe(true);
    expect(readProjectStorage('/sessions/gamma')?.prompts.some(p => p.id === 'pc')).toBe(false);
  });

  test('cwd 为空串/空白时回落全局初始化值', () => {
    const { projectStoragePath } = getMergedStorage('   ');
    expect(projectStoragePath).toBe('/workspace/.harness/prompts.json');
  });

  test('writeProjectStorage 无工作区时抛错', () => {
    initStorageContext(null);
    expect(() => writeProjectStorage(makeStorage())).toThrow(/工作区/);
    initStorageContext('/workspace');
  });
});

describe('write failure cache consistency', () => {
  // P2-1 回归：写操作沿用「读（缓存共享引用）→ 就地修改 → 写回」，
  // 若 writeJsonAtomic 在 rename 阶段失败，必须失效该路径缓存，
  // 否则下次读命中脏缓存、后续写入把幽灵数据落盘。
  beforeAll(() => initStorageContext('/workspace'));
  beforeEach(() => mockFs.__reset());

  test('addPrompt 写失败后：报错、无幽灵数据、后续写入干净', () => {
    writeProjectStorage(makeStorage([makePrompt({ id: 'ok' })]));
    expect(getPromptById('ok')).not.toBeNull(); // 预热缓存

    mockFs.__failNextRename();
    expect(() => addPrompt(basePrompt('ghost'))).toThrow();

    // 缓存已失效：从磁盘重新解析，未落盘的 ghost 不可见
    expect(getPromptById('ghost')).toBeNull();
    expect(getPromptById('ok')).not.toBeNull();

    // rename 失败残留 .tmp 孤儿，下一次写入前被清理
    expect(mockFs.__files().has('/workspace/.harness/prompts.json.tmp')).toBe(true);

    // 后续成功写入不带幽灵数据落盘
    addPrompt(basePrompt('real'));
    const project = readProjectStorage();
    expect(project?.prompts.some(p => p.id === 'ghost')).toBe(false);
    expect(project?.prompts.some(p => p.id === 'real')).toBe(true);
    expect(project?.prompts.some(p => p.id === 'ok')).toBe(true);
    expect(mockFs.__files().has('/workspace/.harness/prompts.json.tmp')).toBe(false);
  });

  test('updatePrompt 写失败后：内存修改不残留', () => {
    writeStorage(makeStorage([makePrompt({ id: 'u1', title: 'Old' })]));
    expect(readStorage().prompts[0].title).toBe('Old'); // 预热缓存

    mockFs.__failNextRename();
    expect(() => updatePrompt('u1', { title: 'New' })).toThrow();

    // 用户级存储：u1 标题回落到磁盘上的 Old，而非缓存里的 New
    expect(getPromptById('u1')?.title).toBe('Old');
  });
});
