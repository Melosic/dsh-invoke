# dsh-invoke

**English** | [中文](README.zh.md)

Prompt Vault & Invoker for DeepSeek Harness

A DeepSeek Harness community plugin for managing and invoking prompts — summon your best prompts with one click.

dsh-invoke focuses on prompt management and invocation. It ships with one built-in example prompt as a reference template, and lets you freely add, edit, delete, view, search, and categorize your own prompts.

The plugin runs as a **Host + Client two-part plugin**: the Host side (Node) registers HTTP routes and DSH commands; the Client side (browser) injects a sidebar entry into Harness and mounts a React panel. The two communicate over the same-origin `/api/dsh-invoke/*`.

## Features

- **Sidebar GUI first**: add / edit / delete / view / search / category management, all visual.
- **Quick invoke (copy to clipboard)**: click "Copy" → fill variables → copy → paste and send. Independent of Harness's internal DOM, 100% compatible.
- **Variable substitution**: Mustache-style `{{var}}` placeholders, filled interactively via a dialog on invoke, with experimental auto-extraction from the editor selection.
- **Category tree + live search**: left-hand category filter, top search box with real-time filtering (title / description / tags / body), with matched-keyword highlighting.
- **Light / dark theme**: follows Harness's `data-ds-dark-theme` mechanism automatically, with in-panel manual override.
- **Two-layer storage merge**: user-level global storage + project-level storage, project-level wins.
- **Import / export**: batch JSON / YAML import (merge / overwrite modes), export backup.
- **Full command-line support**: `/prompt`, `/prompt-list`, `/alias` commands.
- **Usage stats & smart sorting**: ranked by a composite score of usage frequency and recency.

## Requirements

- Node.js >= 18.x
- DeepSeek Harness >= 0.1.0, < 0.2.0

## Installation

The plugin mounts as a Cordis plugin. Give `cordis.patch.yml` to Harness's Cordis loader, or merge its content into your patch config:

```yaml
- insert:
    - id: dsh-invoke
      name: dsh-invoke
      config:
        enabled: true
```

Install dependencies:

```bash
npm install dsh-invoke
# or
pnpm add dsh-invoke
```

## Quick Start

1. Start Harness; the "Prompt Vault" entry button is injected into the sidebar automatically.
2. Click the entry to open the panel. Browse prompts by clicking a category, or use the search box to locate one quickly.
3. Use a prompt: click "Copy" on a card → fill variables → click "Copy to clipboard" → paste it into the input and send.
4. Manage prompts: click "Add" to create a custom prompt, or use "Edit" / "Delete" on cards.

### Built-in Example Prompt

The plugin ships with one example prompt, usable directly or as a template:

| Field | Value |
| --- | --- |
| ID | `code-review` |
| Title | 代码审查 (Code Review) |
| Description | 审查代码中的潜在问题，包括逻辑错误、安全漏洞、性能问题 |
| Category | 开发 (Development) |
| Tags | `review` `quality` `security` |
| Body | 请审查以下代码，重点关注逻辑错误、安全漏洞、性能问题（含 `{{code}}` 变量） |
| Variable | `code` (text input, required) |

## Command-Line Usage (Optional)

Most operations can be done via the sidebar; the command line targets keyboard-driven users and fallback scenarios. Current commands:

| Command | Description |
| --- | --- |
| `/prompt` | List all prompts (with category, built-in marker, description) |
| `/prompt-list` | List all prompts grouped by category |
| `/alias` | List all registered aliases and the prompts they point to |

## Data Storage

- **User-level (writable)**: `~/.dsh/prompts.user.json` (resolved via `@deepseek-ai/dsh-home-paths`)
- **Project-level (writable, higher priority)**: `.harness/prompts.json` (under the currently open workspace root)

### Merge Strategy

Project-level config takes priority over user-level; for a duplicate ID, the project-level prompt wins. When no workspace is open, only user-level storage is loaded.

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

## Technical Architecture

The plugin uses a **Host + Client** two-part structure, following DeepSeek Harness community plugin conventions:

```
             DeepSeek Harness
        ┌────────────────────┐
        │  Host side (Node)  │
        │  src/index.ts       │
        │   ├─ host/routes.ts │◄── HTTP /api/dsh-invoke/*
        │   ├─ commands/*     │◄── DSH commands /prompt /alias
        │   ├─ storage/*      │── two-layer storage merge
        │   └─ engine/*       │── templates / import-export
        └────────┬───────────┘
                 │ same-origin fetch
        ┌────────┴───────────┐
        │  Client (browser)  │
        │  src/client/index.ts│── sidebar injection + panel mount
        │  src/client/api.ts │── fetch wrapper
        │  src/ui/*          │── React panel (light/dark)
        └────────────────────┘
```

### Source Layout

```
dsh-invoke/
├── package.json
├── cordis.patch.yml        # plugin mount patch
├── tsconfig.json           # Host build
├── tsconfig.client.json    # Client build
├── src/
│   ├── index.ts            # Host plugin entry
│   ├── host/
│   │   └── routes.ts       # HTTP route layer (CRUD API)
│   ├── client/
│   │   ├── index.ts        # Browser entry (sidebar injection + mount)
│   │   └── api.ts          # fetch API wrapper
│   ├── storage/
│   │   ├── context.ts      # storage context (workspace/path config)
│   │   └── manager.ts      # two-layer merge + CRUD + smart sorting
│   ├── engine/
│   │   ├── template.ts     # variable substitution ({{var}})
│   │   ├── variable-resolver.ts  # variable extraction (experimental)
│   │   └── import-export.ts  # JSON / YAML import-export
│   ├── commands/
│   │   ├── prompt.ts       # main command registration
│   │   ├── alias.ts        # alias management & conflict detection
│   │   └── clipboard.ts    # cross-platform clipboard copy (Node child_process)
│   └── ui/
│       ├── theme.ts        # theme adaptation (light/dark)
│       ├── icons.tsx       # Feather Icons inline SVG
│       ├── styles.ts       # design system (CSS variables)
│       ├── WebviewPanel.tsx  # main panel (React 18)
│       └── components/     # cards, forms, category tree, variable/import dialogs
└── tests/                  # Jest unit tests
```

## Development

```bash
npm install
npm run build          # Host build (tsc -p tsconfig.json)
npm run build:client   # Client build (tsc -p tsconfig.client.json)
npm run test           # run Jest unit tests
```

## Roadmap

| Priority | Module | Status |
| --- | --- | --- |
| P0 | Core CRUD (add/edit/delete/query) | Done |
| P0 | Copy to clipboard + variable fill | Done |
| P0 | Category tree management & live search | Done |
| P0 | Light/dark theme auto-adaptation | Done |
| P1 | Import / export | Done (JSON / YAML) |
| P1 | 2-column grid card layout | Done |
| P1 | Variable substitution ({{var}}) | Done |
| P1 | Sidebar GUI (Host + Client) | Done |
| P1 | Alias system (with conflict detection) | Done |
| P2 | Project-level auto-load & two-layer merge | Done |
| P2 | Usage stats & smart sorting | Done |
| P2 | AI-assisted prompt generation (experimental) | Planned |
| P2 | GitHub Gist cloud sync | Planned |

## FAQ

**Q: After copying to the clipboard, can it auto-paste into the input box?**

A: The current version uses manual paste for stability. Once Harness officially exposes an input-write API, we will support it right away.

**Q: Can the built-in example prompt be deleted?**

A: Yes. The example prompt supports edit and delete just like user-defined prompts.

**Q: If both project-level and user-level exist, which wins?**

A: Project-level takes priority; for a duplicate ID, the project-level config wins.

**Q: How do I use auto variable extraction? Why does it sometimes not work?**

A: Auto-extraction is experimental. Select code in the Harness editor first, then click "Copy". If the current version doesn't support the editor selection API, or no code is selected, the dialog will prompt for manual input.

**Q: Do I have to use the command line?**

A: No. All operations can be done through the sidebar GUI; the command line is an optional fallback for keyboard-driven users and degraded scenarios.

## Version Compatibility

The v0.1.x series is compatible with DeepSeek Harness >=0.1.0 <0.2.0. When Harness ships a major update, we will adapt promptly — follow the GitHub Releases page.

## Contributing

Issues and PRs are welcome:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'` (follow Conventional Commits)
4. Push the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

MIT License © 2026