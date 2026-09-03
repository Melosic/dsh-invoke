# dsh-invoke

**English** | [中文](README.zh.md)

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![dsh plugin](https://img.shields.io/badge/dsh-plugin-4263eb.svg)
![Maintenance: paused](https://img.shields.io/badge/maintenance-paused-orange.svg)

Prompt Vault & Invoker for DeepSeek Harness

Prompt management & quick invocation for DeepSeek Harness.

dsh-invoke focuses on prompt management and invocation. It ships with one built-in example prompt as a reference template, and lets you freely add, edit, delete, view, search, and categorize your own prompts.

The plugin runs as a **Host + Client two-part plugin**: the Host side (Node) registers HTTP routes and DSH commands; the Client side (browser) injects a sidebar entry into Harness and mounts a React panel. The two communicate over the same-origin `/api/dsh-invoke/*`.

> **Project nature**: dsh-invoke is an independently maintained open-source community project built on the DeepSeek Harness plugin ecosystem. This project has no affiliation, cooperation, authorization, or endorsement relationship with DeepSeek.

> **Maintenance status**: This plugin depends on DeepSeek Harness (dsh), which is currently in [developer preview](https://github.com/deepseek-ai/deepseek-harness/blob/master/README.md) and evolves rapidly with potentially breaking changes. This project is therefore **paused for active maintenance** and may not work on the latest dsh. Maintenance resumes once the dsh repository stabilizes.

## Features

- **Sidebar GUI first**: add / edit / delete / view / search / category management, all visual.

- **Flexible panel modes**: opens as a side drawer by default so the chat stays visible — paste right after copying; switch to a centered dialog anytime. Close via mask click or `Esc`, and the mode is remembered per browser.

- **Quick invoke (copy to clipboard)**: click "Copy" → fill variables → copy → paste and send. Independent of Harness's internal DOM, 100% compatible.

- **Variable substitution**: Mustache-style `{{var}}` placeholders, filled interactively via a dialog on invoke. (Auto-extraction from the editor selection is planned — the extraction engine is ready, waiting for a selection API from the host.)

- **Category tree + live search**: left-hand category filter, top search box with real-time filtering (title / description / tags / body), with matched-keyword highlighting.

- **Hover preview**: hover any card or row for 250ms to read the full prompt body in a floating popup — no clicking needed, and the popup never blocks what you're about to click.

- **Compact / comfortable view toggle**: switch between the card grid and a dense single-line list from the search bar; the preference is remembered per browser.

- **Light / dark theme**: follows Harness's `data-ds-dark-theme` mechanism automatically, with in-panel manual override.

- **Two-layer storage merge**: user-level global storage + project-level storage, project-level wins.

- **Import / export**: batch JSON / YAML import (merge / overwrite modes), export backup.

- **Full command-line support**: `/prompt`, `/prompt-list`, `/alias` commands, plus `/<alias> [content]` quick invocation.

- **Alias quick invocation**: bind an alias to a prompt, then `/<alias> content` renders and copies it in one step (variables auto-filled; conflict detection and cascade delete included).

- **Usage stats & smart sorting**: ranked by a composite score of usage frequency and recency.

## Requirements

- Node.js >= 22.19 (follows the DeepSeek Harness engine requirement)

- DeepSeek Harness >= 0.1.0, < 0.2.0

## Quick Installation

The plugin is not published to npm or pnpm yet. The recommended way is to ask the AI inside DeepSeek Harness **Creator mode** (the cordis preset), pasting the repository link:

```text
Install this plugin https://github.com/Melosic/dsh-invoke
```

dsh pulls the plugin from GitHub and mounts it automatically. To mount manually, the plugin runs as a Cordis plugin — merge the following entry into your patch config (`cordis.patch.yml`):

```yaml
- insert:
    - id: dsh-invoke
      name: '@dsh-external/dsh-invoke'
      config:
        enabled: true
```

For source builds and local development, see [Contributing](CONTRIBUTING.md).

## Quick Start

1. Start Harness; the "Prompt Vault" entry button is injected into the sidebar automatically, directly above the Settings button.
2. Click the entry to open the panel. Browse prompts by clicking a category, or use the search box to locate one quickly.
3. Use a prompt: click "Copy" on a card → fill variables → click "Copy to clipboard" → paste it into the input and send.
4. Manage prompts: click "Add" to create a custom prompt, or use "Edit" / "Delete" on cards.

### Built-in Example Prompt

The plugin ships with one example prompt, usable directly or as a template:

| Field       | Value                                                     |
| ----------- | --------------------------------------------------------- |
| ID          | `code-review`                                             |
| Title       | 代码审查 (Code Review)                                        |
| Description | 审查代码中的潜在问题，包括逻辑错误、安全漏洞、性能问题                               |
| Category    | 开发 (Development)                                          |
| Tags        | `review` `quality` `security`                             |
| Body        | 请审查以下代码，重点关注：1. 逻辑错误 2. 安全漏洞 3. 性能问题（正文以 `{{code}}` 引用代码） |
| Variable    | `code` (text input, required)                             |

## Documentation

- [Command-Line Usage & Alias System](docs/en/guide/cli-and-alias.md) — `/prompt`, `/prompt-list`, `/alias`, `/<alias>` commands and alias rules

- [Data Storage](docs/en/guide/storage.md) — two-layer storage, merge strategy, storage format, cwd resolution, and prompt ID rules

- [Architecture & Security Model](docs/en/architecture-and-security.md) — Host + Client structure, source layout, three HTTP guards

- [FAQ](docs/en/faq.md) and [Version Compatibility](docs/en/faq.md#version-compatibility)

- [Roadmap](ROADMAP.md)

## Contributing

Issues and PRs are welcome. For local development, build commands, and the contribution workflow, see [Contributing](CONTRIBUTING.md).

## Community

- Discover more DeepSeek Harness plugins under the [dsh-plugin topic](https://github.com/topics/dsh-plugin).

- Report issues or share suggestions via [GitHub Issues](https://github.com/Melosic/dsh-invoke/issues).

## License

MIT License © 2026
