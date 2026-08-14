// src/commands/prompt.ts

import { Context } from '@deepseek-ai/dsh';
import * as readline from 'readline';
import {
  getAllPrompts,
  getPromptById,
  addPrompt,
  updatePrompt,
  deletePrompt,
  incrementUsage,
  getAllCategories,
  addCustomCategory,
  removeCustomCategory
} from '../storage/manager';
import { renderTemplate, extractVariablesFromBody } from '../engine/template';
import { exportToJSON, importFromJSON } from '../engine/import-export';
import { copyToClipboard } from './clipboard';
import { removeAliasesByPromptId } from './alias';
import * as fs from 'fs';

/**
 * 注册所有 prompt 命令
 */
export function registerPromptCommands(ctx: Context) {
  const promptCmd = ctx.command('prompt', 'Prompt Vault 提示词管理');

  // ============ list ============
  promptCmd
    .subcommand('list [category]', '列出所有提示词，可按分类筛选')
    .action(async (args: { category?: string }) => {
      const prompts = getAllPrompts();
      let filtered = prompts;

      if (args.category) {
        filtered = filtered.filter(p => p.category === args.category);
        console.log(`\n📂 分类「${args.category}」下的提示词（共 ${filtered.length} 条）：\n`);
      } else {
        console.log(`\n📋 所有提示词（共 ${filtered.length} 条）：\n`);
      }

      if (filtered.length === 0) {
        console.log('  暂无提示词');
        return;
      }

      filtered.forEach((p, index) => {
        const tags = p.tags.length > 0 ? ` [${p.tags.join(', ')}]` : '';
        const builtin = p.builtin ? ' 📌内置' : '';
        const usage = p.usageCount > 0 ? ` 使用${p.usageCount}次` : '';
        console.log(`  ${index + 1}. ${p.title}${builtin}${usage}`);
        console.log(`     ID: ${p.id}`);
        console.log(`     分类: ${p.category}${tags}`);
        console.log(`     描述: ${p.description}`);
        console.log('');
      });
    });

  // ============ search ============
  promptCmd
    .subcommand('search <keyword>', '搜索提示词')
    .action(async (args: { keyword: string }) => {
      const keyword = args.keyword.toLowerCase();
      const prompts = getAllPrompts();
      const results = prompts.filter(p =>
        p.title.toLowerCase().includes(keyword) ||
        p.description.toLowerCase().includes(keyword) ||
        p.tags.some(tag => tag.toLowerCase().includes(keyword)) ||
        p.body.toLowerCase().includes(keyword)
      );

      console.log(`\n🔍 搜索「${args.keyword}」结果（共 ${results.length} 条）：\n`);
      if (results.length === 0) {
        console.log('  没有匹配的提示词');
        return;
      }

      results.forEach((p, index) => {
        console.log(`  ${index + 1}. ${p.title} [${p.category}]`);
        console.log(`     ID: ${p.id}`);
        console.log(`     描述: ${p.description}`);
        console.log('');
      });
    });

  // ============ use ============
  promptCmd
    .subcommand('use <id>', '使用指定提示词（交互式填变量后复制到剪贴板）')
    .action(async (args: { id: string }) => {
      const prompt = getPromptById(args.id);
      if (!prompt) {
        console.log(`❌ 未找到 ID 为「${args.id}」的提示词`);
        return;
      }

      console.log(`\n📋 使用提示词：${prompt.title}\n`);
      console.log(`描述：${prompt.description}\n`);

      // 提取变量
      const varNames = extractVariablesFromBody(prompt.body);
      const definedVars = prompt.variables || [];

      if (varNames.length === 0) {
        console.log('✅ 提示词无变量，已复制到剪贴板');
        await copyToClipboard(prompt.body);
        incrementUsage(prompt.id);
        return;
      }

      // 有变量，交互式填充
      const effectiveVars = definedVars.length > 0
        ? definedVars
        : varNames.map(name => ({
            name,
            type: 'text' as const,
            placeholder: `请输入 ${name}`,
            required: true
          }));

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const values: Record<string, string> = {};

      for (const v of effectiveVars) {
        const answer = await new Promise<string>((resolve) => {
          rl.question(`  请输入 ${v.name}${v.required ? ' (必填)' : ''}: `, resolve);
        });
        if (v.required && !answer.trim()) {
          console.log('  此字段为必填，请重新输入');
          let retryAnswer = answer;
          while (!retryAnswer.trim()) {
            retryAnswer = await new Promise<string>((resolve) => {
              rl.question(`  请输入 ${v.name} (必填): `, resolve);
            });
          }
          values[v.name] = retryAnswer;
        } else {
          values[v.name] = answer;
        }
      }

      rl.close();

      // 渲染模板
      const rendered = renderTemplate(prompt.body, values);
      console.log('\n✅ 已渲染提示词并复制到剪贴板');
      await copyToClipboard(rendered);
      incrementUsage(prompt.id);
    });

  // ============ add ============
  promptCmd
    .subcommand('add', '交互式添加新提示词')
    .action(async () => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = (q: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(q, resolve);
        });
      };

      console.log('\n➕ 添加新提示词\n');

      const title = await question('  标题 (必填): ');
      if (!title.trim()) {
        console.log('❌ 标题不能为空');
        rl.close();
        return;
      }

      const description = await question('  描述 (必填): ');
      if (!description.trim()) {
        console.log('❌ 描述不能为空');
        rl.close();
        return;
      }

      const categories = getAllCategories();
      console.log(`  可用分类: ${categories.join(', ')}`);
      const category = await question('  分类 (必填): ');
      if (!category.trim()) {
        console.log('❌ 分类不能为空');
        rl.close();
        return;
      }

      const tagsInput = await question('  标签 (逗号分隔，可选): ');
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

      console.log('  正文 (必填，使用 {{变量名}} 作为占位符):');
      const body = await question('  ');
      if (!body.trim()) {
        console.log('❌ 正文不能为空');
        rl.close();
        return;
      }

      const varNames = extractVariablesFromBody(body);
      const variables: { name: string; type: 'text' | 'textarea'; placeholder: string; required: boolean }[] = [];

      if (varNames.length > 0) {
        console.log(`\n  检测到变量: ${varNames.join(', ')}`);
        for (const name of varNames) {
          const required = await question(`    ${name} 是否必填? (y/n，默认 y): `);
          const type = await question(`    ${name} 类型? (text/textarea，默认 text): `);
          variables.push({
            name,
            type: (type.trim() === 'textarea' ? 'textarea' : 'text') as 'text' | 'textarea',
            placeholder: `请输入 ${name}`,
            required: required.trim().toLowerCase() !== 'n'
          });
        }
      }

      const id = `prompt-${Date.now()}`;

      try {
        addPrompt({
          id,
          title: title.trim(),
          description: description.trim(),
          category: category.trim(),
          tags,
          body: body.trim(),
          variables
        });
        console.log(`\n✅ 提示词已添加，ID: ${id}`);
      } catch (error) {
        console.log(`❌ 添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      rl.close();
    });

  // ============ edit ============
  promptCmd
    .subcommand('edit <id>', '编辑指定提示词')
    .action(async (args: { id: string }) => {
      const prompt = getPromptById(args.id);
      if (!prompt) {
        console.log(`❌ 未找到 ID 为「${args.id}」的提示词`);
        return;
      }

      console.log(`\n✏️ 编辑提示词：${prompt.title}\n`);
      console.log('（直接回车保留原值）\n');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = (q: string, defaultValue: string): Promise<string> => {
        return new Promise((resolve) => {
          rl.question(`${q} [${defaultValue}]: `, (answer) => {
            resolve(answer.trim() || defaultValue);
          });
        });
      };

      const title = await question('  标题', prompt.title);
      const description = await question('  描述', prompt.description);
      const category = await question('  分类', prompt.category);
      const tagsInput = await question('  标签 (逗号分隔)', prompt.tags.join(', '));
      const tags = tagsInput.split(',').map(t => t.trim()).filter(t => t !== '');

      console.log('  正文 (使用 {{变量名}} 作为占位符):');
      const body = await question('  ', prompt.body);

      const varNames = extractVariablesFromBody(body);
      const variables = varNames.map(name => ({
        name,
        type: 'text' as const,
        placeholder: `请输入 ${name}`,
        required: true
      }));

      try {
        updatePrompt(prompt.id, {
          title,
          description,
          category,
          tags,
          body,
          variables
        });
        console.log(`\n✅ 提示词已更新: ${title}`);
      } catch (error) {
        console.log(`❌ 更新失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }

      rl.close();
    });

  // ============ delete ============
  promptCmd
    .subcommand('delete <id>', '删除指定提示词')
    .action(async (args: { id: string }) => {
      const prompt = getPromptById(args.id);
      if (!prompt) {
        console.log(`❌ 未找到 ID 为「${args.id}」的提示词`);
        return;
      }

      console.log(`\n🗑️ 确定要删除提示词「${prompt.title}」吗？`);
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>((resolve) => {
        rl.question('  输入 y 确认删除: ', resolve);
      });

      if (answer.trim().toLowerCase() === 'y') {
        deletePrompt(prompt.id);
        // 级联删除关联的别名
        removeAliasesByPromptId(prompt.id);
        console.log('✅ 已删除');
      } else {
        console.log('❌ 已取消');
      }

      rl.close();
    });

  // ============ category ============
  const categoryCmd = promptCmd.subcommand('category', '分类管理');

  categoryCmd
    .subcommand('list', '列出所有分类')
    .action(async () => {
      const categories = getAllCategories();
      console.log(`\n📂 所有分类（共 ${categories.length} 个）：\n`);
      categories.forEach((cat, index) => {
        const count = getAllPrompts().filter(p => p.category === cat).length;
        console.log(`  ${index + 1}. ${cat} (${count} 条提示词)`);
      });
      console.log('');
    });

  categoryCmd
    .subcommand('add <name>', '添加自定义分类')
    .action(async (args: { name: string }) => {
      try {
        addCustomCategory(args.name);
        console.log(`✅ 分类「${args.name}」已添加`);
      } catch (error) {
        console.log(`❌ 添加失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });

  categoryCmd
    .subcommand('remove <name>', '删除自定义分类')
    .action(async (args: { name: string }) => {
      const builtin = ['开发', '测试', '文档', '效率'];
      if (builtin.includes(args.name)) {
        console.log('❌ 系统预置分类不可删除');
        return;
      }
      try {
        removeCustomCategory(args.name);
        console.log(`✅ 分类「${args.name}」已删除`);
      } catch (error) {
        console.log(`❌ 删除失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });

  // ============ export ============
  promptCmd
    .subcommand('export [path]', '导出提示词库到 JSON 文件')
    .action(async (args: { path?: string }) => {
      const json = exportToJSON();
      const filePath = args.path || `prompts-backup-${new Date().toISOString().slice(0, 10)}.json`;
      try {
        fs.writeFileSync(filePath, json, 'utf-8');
        console.log(`✅ 已导出到: ${filePath}`);
      } catch (error) {
        console.log(`❌ 导出失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });

  // ============ import ============
  promptCmd
    .subcommand('import <path> [mode]', '从 JSON 文件导入提示词')
    .action(async (args: { path: string; mode?: string }) => {
      const mode = args.mode === 'overwrite' ? 'overwrite' : 'merge';
      try {
        const content = fs.readFileSync(args.path, 'utf-8');
        const result = importFromJSON(content, mode);
        console.log(`✅ ${result.message}`);
      } catch (error) {
        console.log(`❌ 导入失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    });

  // ============ alias（别名管理已抽离至 ./alias 模块） ============

  console.log('[dsh-invoke] ✅ 命令注册完成');
}

