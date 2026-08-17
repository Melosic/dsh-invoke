# dsh-invoke

**[English](README.md)** | 中文

Prompt Vault & Invoker for DeepSeek Harness

提示词管理与快速调用插件 —— 一键召唤你的神级提示词。

dsh-invoke 是 DeepSeek Harness 的社区插件，专注于提示词的管理与调用。它内置一条示例提示词作为参考模板，并允许你自由添加、编辑、删除、查看、搜索和分类管理自己的提示词。

插件以 **Host + Client 双端结构**运行：Host 端（Node）注册 HTTP 路由与 DSH 命令，Client 端（浏览器）在 Harness 侧边栏注入入口并挂载 React 面板，两者通过同源 `/api/dsh-invoke/*` 通信。

## 特性

- **侧边栏 GUI 优先**：新增 / 编辑 / 删除 / 查看 / 搜索 / 分类管理，全部可视化完成
- **快速调用（复制到剪贴板）**：点击「复制」→ 填充变量 → 复制 → 手动粘贴发送，不依赖 Harness 内部 DOM，100% 兼容
- **变量替换**：支持 Mustache 风格占位符 `{{var}}`，调用时弹出对话框交互式填充。（编辑器选区自动提取为规划中功能：提取引擎已就绪，等待宿主开放选区 API）
- **分类树 + 实时搜索**：左侧分类筛选，顶部搜索框实时过滤（标题 / 描述 / 标签 / 正文），命中关键词高亮
- **悬停速览**：悬停卡片或列表行 250ms 即可浮窗阅读完整正文，无需点击展开；浮窗永不遮挡即将点击的按钮
- **紧凑 / 舒适视图切换**：搜索栏一键切换卡片网格与单行紧凑列表，偏好按浏览器记忆
- **亮 / 暗主题自适应**：跟随 Harness 的 `data-ds-dark-theme` 机制自动切换，支持面板内手动覆盖
- **双层存储合并**：用户级全局存储 + 项目级存储，项目级优先级更高
- **导入 / 导出**：JSON / YAML 批量导入（合并 / 覆盖两种模式）、导出备份
- **命令行完整支持**：`/prompt`、`/prompt-list`、`/alias` 命令，以及 `/<别名> [内容]` 快捷调用
- **别名快捷调用**：为提示词绑定别名后，`/<别名> 内容` 一键渲染并复制（变量自动填充，含冲突检测与级联删除）
- **使用统计与智能排序**：基于使用频次与最近使用时间的综合得分排序

## 环境要求

- Node.js >= 22.19（跟随 DeepSeek Harness 的引擎要求）
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

## 本地开发 / 从源码安装

如果你要在本地开发本插件，或未经 npm 发布即可运行：

1. **全局安装 DeepSeek Harness**：
   ```bash
   npm install -g @deepseek-ai/dsh
   ```

2. **克隆仓库并安装依赖**：
   ```bash
   git clone https://github.com/Melosic/dsh-invoke.git
   cd dsh-invoke
   npm install
   ```

3. **构建插件**：
   ```bash
   npm run build          # Host 端编译（tsc -p tsconfig.json）
   npm run build:client   # Client 端编译（tsdown / esbuild）
   ```

4. **创建 DSH profile**（已存在可跳过）：
   ```bash
   dsh --profile web --help   # 首次运行会生成 ~/.dsh/profiles/web/
   ```

5. **将插件 link 进 profile**：
   编辑 `~/.dsh/profiles/web/package.json`，将 `dsh-invoke` 加入 dependencies：
   ```json
   "dependencies": {
     "dsh-invoke": "link:/绝对路径/dsh-invoke"
   }
   ```
   然后安装 profile 依赖：
   ```bash
   dsh plugin --profile web install
   ```

6. **在 `~/.dsh/profiles/web/cordis.patch.yml` 添加插件挂载项**：
   ```yaml
   - insert:
       - id: dsh-invoke
         name: dsh-invoke
         config:
           enabled: true
   ```

7. **启动 Harness（加载插件）**：
   ```bash
   dsh --profile web --port 8080
   ```

浏览器打开 `http://127.0.0.1:8080/`，侧边栏会自动出现「Prompt Vault」入口按钮（位于「设置」按钮正上方）。

## 快速上手

1. 启动 Harness，侧边栏自动注入「Prompt Vault」入口按钮（位于「设置」按钮正上方）。
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
| 正文 | 请审查以下代码，重点关注：1. 逻辑错误 2. 安全漏洞 3. 性能问题（正文以 `{{code}}` 引用代码） |
| 变量 | `code`（文本输入，必填） |

## 命令行使用（可选）

大多数操作可通过侧边栏完成；命令行面向键盘流用户与降级场景。当前命令：

| 命令 | 说明 |
| --- | --- |
| `/prompt` | 列出所有提示词（含分类、内置标记、描述） |
| `/prompt-list` | 按分类分组列出所有提示词 |
| `/alias` | 列出所有已注册别名及其指向的提示词 |
| `/<别名> [内容]` | 快速调用别名指向的提示词：渲染后复制到剪贴板 |

### 别名系统

- 在提示词卡片的「设置别名」按钮（链接图标）或别名徽标上打开设置弹窗，一个提示词可绑定一个别名。
- 别名规则：小写字母/数字/连字符，不能与保留命令（`prompt` / `prompt-list` / `alias` / `help` / `clear` / `exit`）或其他别名冲突，服务端统一校验。
- 调用规则：`/<别名> 内容` —— 命令后的文本用于填充变量；**单变量**提示词整个内容填入，**多变量**提示词按声明顺序用 `||` 分隔；缺少必填变量时会提示用法。
- 调用成功后渲染结果复制到系统剪贴板（剪贴板不可用时直接回显正文供手动复制），并累计使用次数。
- 删除提示词时自动级联删除其别名。
- 别名数据存储于用户级 `aliases.json`（不区分工作区）。

## 数据存储

- **用户级（可写）**：`~/.dsh/prompts.user.json`（由 `@deepseek-ai/dsh-home-paths` 解析）
- **项目级（可写，优先级高）**：`.harness/prompts.json`
- **别名**：用户级 `aliases.json`（全局）

> 注意：项目根目录的解析方式。**命令调用**（`/prompt`、`/prompt-list`、`/<别名>`）中，项目级存储跟随发起调用的会话真实工作目录（`agent.session.header.cwd`）。**HTTP**（`/api/dsh-invoke/*`）支持显式传 `?cwd=`（或 JSON body 中的 `cwd`）；未传时回落到插件加载时捕获的 Host 进程工作目录。`GET /api/dsh-invoke/workspace` 返回解析后的根目录、项目级存储路径，以及该目录是否为已注册的 dsh workspace。导入（merge/overwrite）与新增提示词遵循同一写入层级策略：有工作区写项目级，否则写用户级。
>
> 提示词 ID：侧边栏 UI 新建时自动生成 UUID（`crypto.randomUUID`）。HTTP API **不**生成 id——直接 `POST /api/dsh-invoke/prompts` 必须自带唯一 `id`，否则返回 400。

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

### 安全模型

HTTP API（`/api/dsh-invoke/*`）统一经过三道请求安全门（见 `src/host/routes.ts`）：

| 安全门 | 覆盖范围 | 防御目标 |
|---|---|---|
| Host 白名单（仅本机/局域网地址） | 全部请求 | DNS rebinding（攻击者域名重解析到本机回环） |
| 同源校验（`Sec-Fetch-Site` + `Origin` 与 Host 比对） | 写操作 | CSRF（恶意网页跨站 POST/PUT/DELETE） |
| cwd 白名单 | 显式指定 `?cwd=` 的请求 | 任意目录写入 |

cwd 白名单按优先级分三档：注册表可用时要求为 dsh 已注册工作区（最强）；注册表不可用且已打开工作区时收紧为该工作区子树；两者皆不可用时放行已存在目录（文档化降级，该场景下会话 cwd 即工作区锚点，HTTP 面仍由前两道门覆盖）。请求体上限 10MB，存储写入采用原子替换 + `.bak` 备份。

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
│   │   ├── manager.ts      # 双层合并 + CRUD + 智能排序
│   │   └── alias-store.ts  # 别名存储（CRUD + 冲突检测 + 级联删除）
│   ├── engine/
│   │   ├── template.ts     # 变量替换（{{var}}）
│   │   ├── variable-resolver.ts  # 变量提取（含实验性自动提取）
│   │   └── import-export.ts  # JSON / YAML 导入导出
│   ├── commands/
│   │   ├── prompt.ts       # 主命令注册
│   │   ├── alias.ts        # /alias 列表 + /<别名> 动态命令注册与调用链
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

## 常见问题（FAQ）

**Q：复制到剪贴板后，能不能自动粘贴到输入框？**

A：当前版本为保证稳定性采用手动粘贴。待 Harness 官方开放输入框写入 API 后，会第一时间支持。

**Q：内置的示例提示词可以删除吗？**

A：可以。示例提示词与用户自定义提示词一样，支持编辑和删除。

**Q：项目级和用户级同时存在时，以哪个为准？**

A：项目级优先级更高，相同 ID 的提示词以项目级配置为准。

**Q：自动变量提取怎么用？为什么有时不生效？**

A：自动提取为规划中功能，尚未接通：提取引擎已实现，但当前 Harness 网页端未暴露编辑器选区 API，因此对话框始终提示手动输入。待宿主提供选区访问后将自动生效。

**Q：一定要用命令行吗？**

A：不需要。所有操作均可通过侧边栏图形界面完成，命令行仅为键盘流用户和降级场景提供的可选方案。

## 版本兼容性

本插件 v0.2.x 系列兼容 DeepSeek Harness >=0.1.0 <0.2.0。后续 Harness 发布主版本更新时，我们会及时跟进适配，请关注 GitHub Releases。

## 贡献

欢迎提交 Issue 和 PR：

1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`（遵循 Conventional Commits）
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

## License

MIT License © 2026