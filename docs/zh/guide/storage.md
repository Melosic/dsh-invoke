# 数据存储

本页说明 dsh-invoke 的数据存储结构：双层存储层级、项目根目录与 cwd 的解析方式、合并策略，以及存储格式示例。

## 存储层级

- **用户级（可写）**：`~/.dsh/prompts.user.json`（由 `@deepseek-ai/dsh-home-paths` 解析）
- **项目级（可写，优先级高）**：`.harness/prompts.json`
- **别名**：用户级 `aliases.json`（全局）

> 注意：项目根目录的解析方式。**命令调用**（`/prompt`、`/prompt-list`、`/<别名>`）中，项目级存储跟随发起调用的会话真实工作目录（`agent.session.header.cwd`）。**HTTP**（`/api/dsh-invoke/*`）支持显式传 `?cwd=`（或 JSON body 中的 `cwd`）；未传时回落到插件加载时捕获的 Host 进程工作目录。`GET /api/dsh-invoke/workspace` 返回解析后的根目录、项目级存储路径，以及该目录是否为已注册的 dsh workspace。导入（merge/overwrite）与新增提示词遵循同一写入层级策略：有工作区写项目级，否则写用户级。
>
> 提示词 ID：侧边栏 UI 新建时自动生成 UUID（`crypto.randomUUID`）。HTTP API **不**生成 id——直接 `POST /api/dsh-invoke/prompts` 必须自带唯一 `id`，否则返回 400。

## 合并策略

项目级配置优先级高于用户级，相同 ID 的提示词以项目级为准。若未打开工作区，则仅加载用户级存储。

## 存储格式示例

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