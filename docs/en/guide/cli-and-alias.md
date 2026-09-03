# Command-Line Usage & Alias System

This page covers dsh-invoke's command-line capabilities: the standard commands (`/prompt`, `/prompt-list`, `/alias`) and the alias quick-invocation system. Most operations can be done via the sidebar; the command line targets keyboard-driven users and fallback scenarios.

## Standard Commands

Current commands:

| Command | Description |
| --- | --- |
| `/prompt` | List all prompts (with category, built-in marker, description) |
| `/prompt-list` | List all prompts grouped by category |
| `/alias` | List all registered aliases and the prompts they point to |
| `/<alias> [content]` | Invoke the aliased prompt: renders it and copies to the clipboard |

## Alias System

- Open the alias dialog via the link-icon action on a prompt card (or by clicking the alias badge on the card). Each prompt can be bound to one alias.
- Alias rules: lowercase letters / digits / hyphens; must not collide with reserved commands (`prompt`, `prompt-list`, `alias`, `help`, `clear`, `exit`) or existing aliases. Validated server-side.
- Invocation: `/<alias> content` — the text after the command fills the template variables. A **single-variable** prompt receives the whole text; a **multi-variable** prompt splits it in declaration order using `||`. Missing required variables produce a usage hint.
- On success the rendered prompt is copied to the system clipboard (when the clipboard is unavailable, the body is echoed for manual copy) and the usage counter increments.
- Deleting a prompt cascades to delete its alias.
- Alias data lives in the user-level `aliases.json` (global, not workspace-scoped).