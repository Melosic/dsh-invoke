# dsh-invoke

**[English](README.md)** | 中文

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![dsh plugin](https://img.shields.io/badge/dsh-plugin-4263eb.svg)
![Maintenance: paused](https://img.shields.io/badge/maintenance-paused-orange.svg)

Prompt Vault & Invoker for DeepSeek Harness

提示词管理与快速调用插件。

dsh-invoke 专注于提示词的管理与调用。它内置一条示例提示词作为参考模板，并允许你自由添加、编辑、删除、查看、搜索和分类管理自己的提示词。

插件以 **Host + Client 双端结构**运行：Host 端（Node）注册 HTTP 路由与 DSH 命令，Client 端（浏览器）在 Harness 侧边栏注入入口并挂载 React 面板，两者通过同源 `/api/dsh-invoke/*` 通信。

> **项目性质**：dsh-invoke 是独立维护的开源社区项目，构建于 DeepSeek Harness 的插件生态之上。本项目与深度求索公司（DeepSeek）不存在任何隶属、合作、授权或背书关系。

> **维护状态**：本插件依赖的 DeepSeek Harness（dsh）目前处于[开发者预览阶段](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.zh.md)，持续快速迭代并可能出现破坏性变更。本项目因此**暂停主动维护**，可能在最新的 dsh 上无法正常使用。待 dsh 官方仓库稳定后恢复更新。

## 特性

- **侧边栏 GUI 优先**：新增 / 编辑 / 删除 / 查看 / 搜索 / 分类管理，全部可视化完成

- **灵活的弹出形态**：默认以右侧抽屉打开（聊天区保持可见，复制后可直接粘贴），可一键切换为居中弹窗；点击遮罩或按 `Esc` 关闭，形态偏好按浏览器记忆

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

## 快速安装

本插件暂未发布到 npm / pnpm registry。最简单的方式是在 DeepSeek Harness 的**创造模式**（cordis preset）中直接让 AI 安装，附上仓库链接即可：

```text
帮我安装这个插件 https://github.com/Melosic/dsh-invoke
```

dsh 会从 GitHub 拉取本插件并自动完成挂载。手动挂载时，本插件作为 Cordis 插件，将以下条目并入你的 patch 配置（`cordis.patch.yml`）：

```yaml
- insert:
    - id: dsh-invoke
      name: '@dsh-external/dsh-invoke'
      config:
        enabled: true
```

从源码构建与本地开发步骤见[贡献指南](CONTRIBUTING.zh.md)。

## 快速上手

1. 启动 Harness，侧边栏自动注入「Prompt Vault」入口按钮（位于「设置」按钮正上方）。
2. 点击入口打开面板。浏览提示词：点击分类筛选，或使用搜索框快速定位。
3. 使用提示词：点击卡片上的「复制」→ 填写变量 → 点击「复制到剪贴板」→ 粘贴到输入框发送。
4. 管理提示词：点击「新增」添加自定义提示词，点击卡片上的「编辑」或「删除」管理已有提示词。

### 内置示例提示词

插件内置一条示例提示词，可直接使用或作为模板：

| 字段 | 内容                                                        |
| -- | --------------------------------------------------------- |
| ID | `code-review`                                             |
| 标题 | 代码审查                                                      |
| 描述 | 审查代码中的潜在问题，包括逻辑错误、安全漏洞、性能问题                               |
| 分类 | 开发                                                        |
| 标签 | `review` `quality` `security`                             |
| 正文 | 请审查以下代码，重点关注：1. 逻辑错误 2. 安全漏洞 3. 性能问题（正文以 `{{code}}` 引用代码） |
| 变量 | `code`（文本输入，必填）                                           |

## 文档

- [命令行使用与别名系统](docs/zh/guide/cli-and-alias.md)——`/prompt`、`/prompt-list`、`/alias`、`/<别名>` 命令与别名规则

- [数据存储](docs/zh/guide/storage.md)——双层存储、合并策略、存储格式、cwd 解析与提示词 ID 规则

- [技术架构与安全模型](docs/zh/architecture-and-security.md)——Host + Client 结构、源码结构、HTTP 三道安全门

- [常见问题（FAQ）](docs/zh/faq.md)与[版本兼容性](docs/zh/faq.md#版本兼容性)

- [路线图](ROADMAP.zh.md)

## 贡献

欢迎提交 Issue 和 PR。本地开发、构建命令与贡献流程详见[贡献指南](CONTRIBUTING.zh.md)。

## 社区

- 在 [dsh-plugin 话题](https://github.com/topics/dsh-plugin)下发现更多 DeepSeek Harness 插件。

- 欢迎通过 [GitHub Issues](https://github.com/Melosic/dsh-invoke/issues) 报告问题或提出建议。

## License

MIT License © 2026
