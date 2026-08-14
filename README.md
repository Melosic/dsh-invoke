# dsh-invoke

Prompt Vault & Invoker for DeepSeek Harness

提示词管理与快速调用插件 —— 一键召唤你的神级提示词。

dsh-invoke 是 DeepSeek Harness 的社区插件，专注于提示词的管理与调用。它内置一条示例提示词作为参考模板，并允许你自由添加、编辑、删除、查看、搜索和分类管理自己的提示词。

插件提供侧边栏图形界面（Feather Icons 图标库，风格简洁现代），让提示词管理像操作 Notion 数据库一样直观；同时保留完整的命令行支持，作为键盘流用户和特殊场景下的备用方案。

## 特性

- **侧边栏 GUI 优先**：新增 / 编辑 / 删除 / 查看 / 搜索 / 分类管理，全部可视化完成
- **快速调用（复制到剪贴板）**：点击「复制」→ 填充变量 → 复制 → 手动粘贴发送，不依赖 Harness 内部 DOM，100% 兼容
- **变量替换**：支持 Mustache 风格占位符 `{{var}}`，调用时弹出对话框交互式填充，并支持从编辑器选区自动提取变量（实验性）
- **分类树 + 实时搜索**：左侧分类筛选，顶部搜索框实时过滤（标题 / 描述 / 标签 / 正文）
- **亮 / 暗主题自适应**：跟随 Harness 的 `data-ds-dark-theme` 机制自动切换
- **双层存储合并**：用户级全局存储 + 项目级存储，项目级优先级更高
- **导入 / 导出**：JSON / YAML 批量导入（合并 / 覆盖两种模式）、导出备份
- **命令行完整支持**：`/prompt` 系列命令 + 别名系统 `/alias`
- **使用统计与智能排序**：基于使用频次与最近使用时间的综合得分排序

## 环境要求

- Node.js >= 18.x
- DeepSeek Harness >= 0.1.0，< 0.2.0

## 安装

```bash
npm install dsh-invoke
# 或
pnpm add dsh-invoke
```

在 Harness 中加载（`dsh.config.ts`）：

```typescript
import { defineConfig } from '@deepseek-ai/dsh';

export default defineConfig({
  plugins: ['dsh-invoke'],
  invoke: {
    storage: {
      projectPath: '.harness/prompts.json'
    }
  }
});
```

## 快速上手

1. 启动 Harness，侧边栏自动加载「Prompt Vault」面板。
2. 浏览提示词：点击分类筛选，或使用搜索框快速定位。
3. 使用提示词：点击卡片上的「复制」→ 填写变量 → 点击「复制到剪贴板」→ 粘贴到输入框发送。
4. 管理提示词：点击「新增」添加自定义提示词，点击卡片上的「编辑」或「删除」管理已有提示词。

### 内置示例提示词

插件内置一条示例提示词，可直接使用或作为模板：

| 字段 | 内容 |
| --- | --- |
| ID | `code-review` |
| 标题 | 代码审查 |
| 描述 | 审查代码中的潜在问题，包括逻辑错误、安全漏洞、性能问题 |
| 分类 | 开发 |
| 标签 | `review` `quality` `security` |
| 正文 | 请审查以下代码，重点关注逻辑错误、安全漏洞、性能问题（含 `{{code}}` 变量） |
| 变量 | `code`（文本输入，必填） |

## 命令行使用（可选）

大多数操作可通过侧边栏完成；命令行面向键盘流用户与降级场景。

| 命令 | 说明 |
| --- | --- |
| `/prompt list [category]` | 列出所有提示词，可按分类筛选 |
| `/prompt search <keyword>` | 搜索提示词 |
| `/prompt use <id>` | 使用指定提示词（交互式填变量后复制） |
| `/prompt add` | 交互式添加新提示词 |
| `/prompt edit <id>` | 编辑指定提示词 |
| `/prompt delete <id>` | 删除指定提示词 |
| `/prompt category list` | 列出所有分类 |
| `/prompt category add <name>` | 添加自定义分类 |
| `/prompt category remove <name>` | 删除自定义分类 |
| `/prompt export [path]` | 导出提示词库为 JSON/YAML 文件（按扩展名识别） |
| `/prompt import <path> [merge\|overwrite]` | 从 JSON/YAML 文件导入提示词 |
| `/alias list` | 列出所有别名 |
| `/alias set <alias> <id>` | 设置短别名（如 `/cr` 调用代码审查） |
| `/alias remove <alias>` | 删除别名 |

## 数据存储

- **用户级（可写）**：`~/.deepseek-harness/prompts.user.json`
- **项目级（可写，优先级高）**：`.harness/prompts.json`（可通过 `dsh.config.ts` 的 `invoke.storage.projectPath` 自定义）

### 合并策略

项目级配置优先级高于用户级，相同 ID 的提示词以项目级为准。若未打开工作区，则仅加载用户级存储。

存储格式示例：

```json
{
  "version": 1,
  "categories": ["开发", "测试", "文档", "效率"],
  "customCategories": ["AI辅助"],
  "prompts": [
    {
      "id": "code-review",
      "title": "代码审查",
      "description": "审查代码中的潜在问题",
      "category": "开发",
      "tags": ["review", "quality"],
      "body": "请审查以下代码：\n{{code}}",
      "variables": [{ "name": "code", "type": "text", "required": true }],
      "builtin": true,
      "usageCount": 0,
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-08-13T14:30:00Z"
    }
  ]
}
```

## 技术架构

```
用户交互层（UI / CLI）
        ↓
命令注册层（commands/）
├── prompt.ts     # 主命令注册
└── alias.ts      # 别名管理与冲突检测
        ↓
业务逻辑层（engine/ + storage/）
├── template.ts            # 模板渲染（{{var}} 替换）
├── variable-resolver.ts   # 变量提取与解析（含实验性自动提取）
├── import-export.ts       # JSON / YAML 导入导出
└── manager.ts             # 双层存储合并（user 全局 + user 项目）
        ↓
Harness API 适配层（adapter/）
└── harness-api.ts         # 隔离官方不稳定变更
        ↓
DeepSeek Harness 核心
```

设计要点：

- **GUI 优先**：侧边栏界面覆盖 90% 以上使用场景，命令行作为备用方案。
- **适配层隔离**：所有对 Harness 官方 API 的调用封装在 `adapter/harness-api.ts`。
- **降级优先**：UI 加载失败时自动回退至命令行，保证功能在任何环境下可用。
- **UI 集成方案（优先级从高到低）**：`ctx.ui.openPanel` / `ctx.ui.registerWebview` → iframe 嵌入 → 命令行降级。

## 项目结构

```
dsh-invoke/
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE
├── vendor/dsh-stub/          # @deepseek-ai/dsh 本地类型 stub（构建用）
├── src/
│   ├── index.ts              # 插件入口
│   ├── adapter/
│   │   └── harness-api.ts    # Harness API 适配层
│   ├── storage/
│   │   ├── context.ts        # 存储上下文（工作区/路径配置）
│   │   └── manager.ts        # 双层合并 + CRUD + 智能排序
│   ├── engine/
│   │   ├── template.ts       # 变量替换（{{var}}）
│   │   ├── variable-resolver.ts  # 变量提取（含实验性自动提取）
│   │   └── import-export.ts  # JSON / YAML 导入导出
│   ├── commands/
│   │   ├── prompt.ts         # 主命令注册
│   │   ├── alias.ts          # 别名管理与冲突检测
│   │   └── clipboard.ts      # 跨平台剪贴板复制
│   └── ui/
│       ├── theme.ts          # 主题适配（亮/暗色）
│       ├── icons.tsx         # Feather Icons 内联 SVG
│       ├── styles.ts         # 设计系统（CSS 变量）
│       ├── WebviewPanel.tsx  # 主面板（React 18）
│       └── components/       # 卡片、表单、分类树、变量/导入对话框
└── tests/                    # 待补充
```

## 开发

```bash
npm install
npm run build   # tsc 构建到 dist/
npm run test    # 运行测试（待补充）
npm run lint    # ESLint 检查（待补充）
```

> 说明：`@deepseek-ai/dsh` 由 Harness 运行时提供、未发布到 npm registry，本地构建通过 `vendor/dsh-stub` 提供类型声明满足依赖。

## 路线图

| 优先级 | 功能模块 | 状态 |
| --- | --- | --- |
| P0 | 核心 CRUD（增删改查） | 已完成 |
| P0 | 复制到剪贴板 + 变量填充 | 已完成 |
| P0 | 分类树管理 & 实时搜索 | 已完成 |
| P0 | 亮/暗主题自动适配 | 已完成 |
| P1 | 导入 / 导出 | 已完成（JSON / YAML） |
| P1 | 2 列网格卡片布局 | 已完成 |
| P1 | 变量替换（{{var}}） | 已完成 |
| P1 | 独立 Webview 图形界面 | 已完成 |
| P1 | 别名系统（含冲突检测） | 已完成 |
| P2 | 项目级自动加载与双层合并 | 已完成 |
| P2 | 使用统计与智能排序 | 已完成 |
| P2 | AI 辅助生成提示词（实验性） | 规划中 |
| P2 | GitHub Gist 云端同步 | 规划中 |

## 常见问题（FAQ）

**Q：复制到剪贴板后，能不能自动粘贴到输入框？**

A：当前版本为保证稳定性采用手动粘贴。待 Harness 官方开放输入框写入 API 后，会第一时间支持。

**Q：内置的示例提示词可以删除吗？**

A：可以。示例提示词与用户自定义提示词一样，支持编辑和删除。

**Q：项目级和用户级同时存在时，以哪个为准？**

A：项目级优先级更高，相同 ID 的提示词以项目级配置为准。

**Q：自动变量提取怎么用？为什么有时不生效？**

A：自动提取是实验性功能。使用前需在 Harness 编辑器中选中代码，然后点击「复制」。若当前版本不支持编辑器选区 API，或未选中代码，对话框会提示手动输入。

**Q：一定要用命令行吗？**

A：不需要。所有操作均可通过侧边栏图形界面完成，命令行仅为键盘流用户和降级场景提供的可选方案。

## 版本兼容性

本插件 v0.1.x 系列兼容 DeepSeek Harness >=0.1.0 <0.2.0。后续 Harness 发布主版本更新时，我们会及时跟进适配，请关注 GitHub Releases。

## 贡献

欢迎提交 Issue 和 PR：

1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`（遵循 Conventional Commits）
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## License

MIT License © 2026
