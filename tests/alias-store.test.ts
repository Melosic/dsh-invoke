// tests/alias-store.test.ts
import {
  getAllAliases,
  getAlias,
  getAliasByPromptId,
  validateAliasName,
  addAlias,
  removeAlias,
  removeAliasesByPromptId,
  normalizeAliasInput
} from '../src/storage/alias-store';
import { mockFs } from './helpers/mockFs';

jest.mock('@deepseek-ai/dsh-home-paths', () => ({
  dshHomePath: () => '/tmp/dsh-invoke-test'
}));
jest.mock('fs', () => require('./helpers/mockFs').mockFs);

describe('alias-store', () => {
  beforeEach(() => mockFs.__reset());

  describe('normalizeAliasInput', () => {
    test('去空白、去开头斜杠、转小写', () => {
      expect(normalizeAliasInput('  /CR ')).toBe('cr');
      expect(normalizeAliasInput('code-review')).toBe('code-review');
    });
  });

  describe('addAlias / 查询', () => {
    test('添加后可按别名与提示词 ID 查询', () => {
      addAlias('/CR', 'code-review');
      const all = getAllAliases();
      expect(all).toHaveLength(1);
      expect(all[0].alias).toBe('cr');
      expect(all[0].promptId).toBe('code-review');
      expect(getAlias('cr')?.promptId).toBe('code-review');
      expect(getAliasByPromptId('code-review')?.alias).toBe('cr');
    });

    test('重复别名被拒绝', () => {
      addAlias('cr', 'p1');
      expect(() => addAlias('cr', 'p2')).toThrow(/已被使用/);
    });

    test('保留命令名被拒绝', () => {
      for (const name of ['prompt', 'prompt-list', 'alias', 'help', 'clear', 'exit']) {
        expect(() => addAlias(name, 'p1')).toThrow(/保留命令/);
      }
    });

    test('非法格式被拒绝', () => {
      expect(() => addAlias('', 'p1')).toThrow(/不能为空/);
      expect(() => addAlias('has space', 'p1')).toThrow(/格式|字母/);
      expect(() => addAlias('-lead', 'p1')).toThrow(/格式|字母/);
      expect(() => addAlias('UPPER', 'p1')).not.toThrow(); // 自动转小写后合法
    });

    test('validateAliasName 返回错误信息而非抛出', () => {
      expect(validateAliasName('ok-name')).toBeNull();
      expect(validateAliasName('alias')).toMatch(/保留命令/);
    });
  });

  describe('removeAlias', () => {
    test('删除后查询不到', () => {
      addAlias('cr', 'p1');
      expect(removeAlias('cr')).toBe(true);
      expect(getAllAliases()).toHaveLength(0);
      expect(removeAlias('cr')).toBe(false);
    });
  });

  describe('removeAliasesByPromptId', () => {
    test('按提示词 ID 级联删除', () => {
      addAlias('cr', 'p1');
      addAlias('other', 'p2');
      expect(removeAliasesByPromptId('p1')).toBe(true);
      expect(getAllAliases().map(a => a.alias)).toEqual(['other']);
      expect(removeAliasesByPromptId('p1')).toBe(false);
    });
  });
});
