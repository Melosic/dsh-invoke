# dsh-invoke

Prompt Vault & Invoker for DeepSeek Harness

提示词管理与快速调用插件 —— 一键召唤你的神级提示词。

dsh-invoke 是 DeepSeek Harness 的社区插件，专注于提示词的管理与调用。它内置一条示例提示词作为参考模板，并允许你自由添加、编辑、删除、查看、搜索和分类管理自己的提示词。

插件以 **Host + Client 双端结构**运行：Host 端（Node）注册 HTTP 路由与 DSH 命令，Client 端（浏览器）在 Harness 侧边栏注入入口并挂载 React 面板，两者通过同源 `/api/dsh-invoke/*` 通信。

## 特性

- **侧边栏 GUI 优先**：新增 / 编辑 / 删除 / 查看 / 搜索 / 分类管理，全部可视化完成
- **快速调用（复制到剪贴板）**：点击「复制」→ 填充变量 → 复制 → 手动粘贴发送，不依赖 Harness 内部 DOM，100% 兼容
- **变量替换**：支持 Mustache 风格占位符 `{{var}}`，调用时弹出对话框交互式填充，并支持从编辑器选区自动提取变量（实验性）
- **分类树 + 实时搜索**：左侧分类筛选，顶部搜索框实时过滤（标题 / 描述 / 标签 / 正文），命中关键词高亮
- **亮 / 暗主题自适应**：跟随 Harness 的 `data-ds-dark-theme` 机制自动切换，支持面板内手动覆盖
- **双层存储合并**：用户级全局存储 + 项目级存储，项目级优先级更高
- **导入 / 导出**：JSON / YAML 批量导入（合并 / 覆盖两种模式）、导出备份
- **命令行完整支持**：`/prompt`、`/prompt-list`、`/alias` 命令
- **使用统计与智能排序**：基于使用频次与最近使用时间的综合得分排序

## 环境要求

- Node.js >= 18.x
- DeepSeek Harness >= 0.1.0，< 0.2.0

## 安装

本插件作为 Cordis 插件挂载。将 `cordis.patch.yml` 交给 Harness 的 cordis loader 读取，或将其内容并入你的 patch 配置：

```yaml
- insert:
    - id: dsh-invoke
      name: dsh-invoke
      config:
        enabled: true
```

安装依赖：

```bash
npm install dsh-invoke
# 或
pnpm add dsh-invoke
```

## 快速上手

1. 启动 Harness，侧边栏自动注入「Prompt Vault」入口按钮。
2. 点击入口打开面板。浏览提示词：点击分类筛选，或使用搜索框快速定位。
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

大多数操作可通过侧边栏完成；命令行面向键盘流用户与降级场景。当前命令：

| 命令 | 说明 |
| --- | --- |
| `/prompt` | 列出所有提示词（含分类、内置标记、描述） |
| `/prompt-list` | 按分类分组列出所有提示词 |
| `/alias` | 列出所有已注册别名及其指向的提示词 |

## 数据存储

- **用户级（可写）**：`~/.dsh/prompts.user.json`（由 `@deepseek-ai/dsh-home-paths` 解析）
- **项目级（可写，优先级高）**：`.harness/prompts.json`（当前打开工作区根目录下）

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

插件采用 **Host + Client 双端**结构，符合 DeepSeek Harness 社区插件规范：

```
             DeepSeek Harness
        ┌────────────────────┐
        │  Host 端（Node）    │
        │  src/index.ts       │
        │   ├─ host/routes.ts │◄── HTTP /api/dsh-invoke/*
        │   ├─ commands/*     │◄── DSH 命令 /prompt /alias
        │   ├─ storage/*      │── 双层存储合并
        │   └─ engine/*       │── 模板 / 导入导出
        └────────┬───────────┘
                 │ 同源 fetch
        ┌────────┴───────────┐
        │  Client 端（浏览器）│
        │  src/client/index.ts│── 侧边栏按钮注入 + 面板挂载
        │  src/client/api.ts │── fetch 封装
        │  src/ui/*          │── React 面板（深浅主题）
        └────────────────────┘
```

### 源码结构

```
dsh-invoke/
├── package.json
├── cordis.patch.yml        # 插件挂载补丁
├── tsconfig.json           # Host 端编译
├── tsconfig.client.json    # Client 端编译
├── src/
│   ├── index.ts            # Host 端插件入口
│   ├── host/
│   │   └── routes.ts       # HTTP 路由层（CRUD API）
│   ├── client/
│   │   ├── index.ts        # 浏览器入口（侧边栏注入 + 挂载）
│   │   └── api.ts          # fetch API 封装
│   ├── storage/
│   │   ├── context.ts      # 存储上下文（工作区/路径配置）
│   │   └── manager.ts      # 双层合并 + CRUD + 智能排序
│   ├── engine/
│   │   ├── template.ts     # 变量替换（{{var}}）
│   │   ├── variable-resolver.ts  # 变量提取（含实验性自动提取）
│   │   └── import-export.ts  # JSON / YAML 导入导出
│   ├── commands/
│   │   ├── prompt.ts       # 主命令注册
│   │   ├── alias.ts        # 别名管理与冲突检测
│   │   └── clipboard.ts    # 跨平台剪贴板复制（Node child_process）
│   └── ui/
│       ├── theme.ts        # 主题适配（亮/暗色）
│       ├── icons.tsx       # Feather Icons 内联 SVG
│       ├── styles.ts       # 设计系统（CSS 变量）
│       ├── WebviewPanel.tsx  # 主面板（React 18）
│       └── components/     # 卡片、表单、分类树、变量/导入对话框
└── tests/                  # Jest 单元测试
```

## 开发

```bash
npm install
npm run build          # Host 端编译（tsc -p tsconfig.json）
npm run build:client   # Client 端编译（tsc -p tsconfig.client.json）
npm run test           # 运行 Jest 单元测试
```

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
| P1 | 侧边栏 GUI（Host + Client） | 已完成 |
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