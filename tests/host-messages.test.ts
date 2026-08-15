// tests/host-messages.test.ts
// host 端消息字典：键集对齐 + 插值 + 语言切换

import { ht, setHostLocale } from '../src/shared/host-messages';

describe('host-messages', () => {
  afterEach(() => setHostLocale({ active: 'zh' }));

  test('默认 zh：翻译 + {name} 插值', () => {
    expect(ht('invoke.notFound', { alias: 'cr' })).toBe(
      '别名「/cr」已不存在，可用 /alias 查看当前列表'
    );
    expect(ht('cmd.prompt.header', { count: 3 })).toBe('📋 Prompt Vault（共 3 条）');
    // 未提供参数时占位符原样保留
    expect(ht('api.promptNotFound', { id: 'x' })).toBe('提示词 x 不存在');
  });

  test('切换 en：命令描述与 API 错误均为英文', () => {
    setHostLocale({ active: 'en' });
    expect(ht('cmd.prompt.desc')).toBe('Prompt Vault — list all prompts');
    expect(ht('api.cwdNotAllowed')).toBe('Working directory (cwd) is not allowed');
    expect(ht('invoke.copied', { title: 'Code Review' })).toContain('Code Review');
  });

  test('非法 locale 值被忽略（保持当前语言）', () => {
    setHostLocale({ active: 'fr' });
    expect(ht('cmd.alias.desc')).toBe('列出所有已注册的 Prompt 别名');
  });

  test('未知插值键保留占位符', () => {
    expect(ht('cmd.prompt.line', { i: 1 })).toBe(
      '1. {title} [{category}]{builtin} — {description}'
    );
  });
});
