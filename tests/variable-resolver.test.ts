// tests/variable-resolver.test.ts
import {
  inferVariableType,
  resolveVariables,
  autoExtractValues,
  prepareVariables
} from '../src/engine/variable-resolver';
import type { Variable } from '../src/storage/manager';

describe('inferVariableType', () => {
  test('短行推断为 text', () => {
    expect(inferVariableType('代码：\n{{code}}', 'code')).toBe('text');
  });

  test('长行推断为 textarea', () => {
    const longBody =
      '这是一段用于测试占位符类型推断的超长文本内容，长度远远超过五十个字符的上限，因此应当被识别为 textarea 类型，同时包含变量 {{longContent}}';
    expect(inferVariableType(longBody, 'longContent')).toBe('textarea');
  });

  test('变量不存在返回 text', () => {
    expect(inferVariableType('hello', 'nope')).toBe('text');
  });
});

describe('resolveVariables', () => {
  test('从正文提取变量并生成默认定义', () => {
    const vars = resolveVariables('请处理 {{content}}', []);
    expect(vars).toEqual([
      { name: 'content', type: 'text', placeholder: '请输入 content', required: true }
    ]);
  });

  test('保留已有变量的元数据', () => {
    const existing: Variable[] = [{ name: 'content', type: 'textarea', required: false }];
    const vars = resolveVariables('请处理 {{content}}', existing);
    expect(vars[0]).toEqual(existing[0]);
  });

  test('无变量返回空数组', () => {
    expect(resolveVariables('no vars here', [])).toEqual([]);
  });
});

describe('autoExtractValues', () => {
  test('单个整段变量：整段选中文本', () => {
    const vars: Variable[] = [{ name: 'code', type: 'text', required: true }];
    const result = autoExtractValues('{{code}}', vars, 'function foo() {}');
    expect(result.values).toEqual({ code: 'function foo() {}' });
    expect(result.messageKey).toBe('varExtract.wholeContent');
    expect(result.messageParams).toEqual({ name: 'code' });
  });

  test('key: value 模式提取', () => {
    const vars: Variable[] = [{ name: 'model', type: 'text', required: true }];
    const result = autoExtractValues('{{model}}', vars, 'model: gpt-4');
    expect(result.values).toEqual({ model: 'gpt-4' });
  });

  test('规则 3：代码符号回退提取', () => {
    const vars: Variable[] = [{ name: 'apiKey', type: 'text', required: true }];
    const result = autoExtractValues('{{apiKey}}', vars, 'const apiKey = "abc123"');
    expect(result.values).toEqual({ apiKey: 'abc123' });
  });

  test('未选中文本时提示手动输入', () => {
    const result = autoExtractValues('{{x}}', [{ name: 'x', type: 'text' }], null);
    expect(result.values).toEqual({});
    expect(result.messageKey).toBe('varExtract.noSelection');
  });

  test('无法提取时返回提示', () => {
    const result = autoExtractValues('{{x}}', [{ name: 'x', type: 'text' }], 'hello world');
    expect(result.values).toEqual({});
    expect(result.messageKey).toBe('varExtract.failed');
  });
});

describe('prepareVariables', () => {
  test('组合解析与自动提取', () => {
    const { variables, autoExtract } = prepareVariables('处理 {{code}}', [], 'let a = 1;');
    expect(variables).toHaveLength(1);
    expect(variables[0].name).toBe('code');
    expect(autoExtract.values).toEqual({ code: 'let a = 1;' });
  });
});
