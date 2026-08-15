// tests/template.test.ts
import {
  renderTemplate,
  extractVariablesFromBody,
  validateVariables
} from '../src/engine/template';
import type { Variable } from '../src/storage/manager';

describe('renderTemplate', () => {
  test('替换单个变量', () => {
    expect(renderTemplate('你好 {{name}}', { name: '世界' })).toBe('你好 世界');
  });

  test('替换多处相同变量', () => {
    expect(renderTemplate('{{x}} + {{x}}', { x: '1' })).toBe('1 + 1');
  });

  test('替换多个不同变量', () => {
    expect(renderTemplate('{{a}}-{{b}}', { a: '1', b: '2' })).toBe('1-2');
  });

  test('未提供的变量保持原样', () => {
    expect(renderTemplate('{{a}} {{b}}', { a: '1' })).toBe('1 {{b}}');
  });

  test('空值替换为空字符串', () => {
    expect(renderTemplate('[{{x}}]', { x: '' })).toBe('[]');
  });

  test('变量值中的 $& 等替换模式不被解释', () => {
    expect(renderTemplate('{{x}}', { x: '$&' })).toBe('$&');
    expect(renderTemplate('{{x}}', { x: '$1' })).toBe('$1');
    expect(renderTemplate('a{{x}}b', { x: '$`' })).toBe('a$`b');
  });

  test('变量名含正则元字符时仍按字面量匹配', () => {
    expect(renderTemplate('[{{a.b}}]', { 'a.b': 'X' })).toBe('[X]');
    expect(renderTemplate('[{{a*b}}]', { 'a*b': 'Y' })).toBe('[Y]');
  });
});

describe('extractVariablesFromBody', () => {
  test('提取变量名并去重', () => {
    expect(extractVariablesFromBody('{{a}} {{b}} {{a}}')).toEqual(['a', 'b']);
  });

  test('无变量返回空数组', () => {
    expect(extractVariablesFromBody('no vars here')).toEqual([]);
  });
});

describe('validateVariables', () => {
  const vars: Variable[] = [
    { name: 'a', type: 'text', required: true },
    { name: 'b', type: 'text', required: false }
  ];

  test('必填缺失时 invalid 并列出缺失项', () => {
    const result = validateVariables(vars, { b: 'x' });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['a']);
  });

  test('全部填充时 valid', () => {
    const result = validateVariables(vars, { a: '1', b: '2' });
    expect(result.valid).toBe(true);
    expect(result.missing).toEqual([]);
  });

  test('可选变量缺省不影响校验', () => {
    const result = validateVariables(vars, { a: '1' });
    expect(result.valid).toBe(true);
  });

  test('空白字符串视为未填充', () => {
    const result = validateVariables(vars, { a: '   ', b: 'x' });
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['a']);
  });
});
