# Data Storage

This page explains how dsh-invoke stores data: the two storage layers, how the project root and cwd are resolved, the merge strategy, and the storage format.

## Storage Layers

- **User-level (writable)**: `~/.dsh/prompts.user.json` (resolved via `@deepseek-ai/dsh-home-paths`)
- **Project-level (writable, higher priority)**: `.harness/prompts.json`
- **Aliases**: user-level `aliases.json` (global)

> Note: how the project root is resolved. In **command invocations** (`/prompt`, `/prompt-list`, `/<alias>`), project-level storage follows the invoking session's real working directory (`agent.session.header.cwd`). Over **HTTP** (`/api/dsh-invoke/*`), callers may pass an explicit `?cwd=` (or `cwd` in the JSON body); when omitted it falls back to the Host process working directory captured once at plugin load. `GET /api/dsh-invoke/workspace` reports the resolved root, the project storage path, and whether the directory is a registered dsh workspace. Imports (merge/overwrite) follow the same write-layer policy as creating prompts: project-level when a workspace exists, otherwise user-level.
>
> Prompt IDs: the sidebar UI generates UUIDs (`crypto.randomUUID`) when creating prompts. The HTTP API does **not** generate ids — direct `POST /api/dsh-invoke/prompts` calls must supply a unique `id` (400 otherwise).

## Merge Strategy

Project-level config takes priority over user-level; for a duplicate ID, the project-level prompt wins. When no workspace is open, only user-level storage is loaded.

## Storage Format

Example storage format:

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