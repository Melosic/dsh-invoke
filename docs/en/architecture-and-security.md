# Architecture & Security Model

This page is for developers who want to understand dsh-invoke's internals: the Host + Client structure, the source layout, and the three guards protecting the HTTP API.

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

## Security Model

All HTTP routes (`/api/dsh-invoke/*`) pass through three request guards (see `src/host/routes.ts`):

| Guard | Scope | Protects against |
|---|---|---|
| Host allowlist (local/LAN addresses only) | All requests | DNS rebinding (attacker domain re-resolving to loopback) |
| Same-origin check (`Sec-Fetch-Site` + `Origin` vs Host) | Write operations | CSRF (malicious cross-site POST/PUT/DELETE) |
| cwd allowlist | Requests with explicit `?cwd=` | Arbitrary directory writes |

The cwd allowlist has three tiers by priority: registered dsh workspace when the registry is available (strongest); subtree of the initialized workspace when the registry is unavailable; any existing directory as a documented degradation when neither anchor exists (the HTTP surface remains covered by the first two guards). Request bodies are capped at 10MB, and storage writes use atomic replace with a `.bak` backup.

## Source Layout

```
dsh-invoke/
├── package.json
├── cordis.patch.yml        # plugin mount patch
├── tsconfig.json           # Host build
├── tsconfig.client.json    # Client build
├── src/
│   ├── index.ts            # Host plugin entry
│   ├── dsh-shims.d.ts      # host @dsh-commands type augmentation (declare module)
│   ├── host/
│   │   └── routes.ts       # HTTP route layer (CRUD API)
│   ├── client/
│   │   ├── index.tsx       # Browser entry (sidebar injection + mount)
│   │   └── api.ts          # fetch API wrapper
│   ├── storage/
│   │   ├── context.ts      # storage context (workspace/path config)
│   │   ├── manager.ts      # two-layer merge + CRUD + smart sorting
│   │   ├── alias-store.ts  # alias storage (CRUD + conflict detection + cascade delete)
│   │   └── safe-write.ts   # JSON atomic write (tmp + .bak backup)
│   ├── engine/
│   │   ├── template.ts     # variable substitution ({{var}})
│   │   ├── variable-resolver.ts  # variable extraction (experimental)
│   │   └── import-export.ts  # JSON / YAML import-export
│   ├── commands/
│   │   ├── prompt.ts       # main command registration
│   │   ├── alias.ts        # /alias listing + dynamic /<alias> command registration & invocation
│   │   └── clipboard.ts    # cross-platform clipboard copy (Node child_process)
│   ├── shared/
│   │   ├── host-messages.ts  # Host-side user-facing message dictionary
│   │   └── log.ts          # debug logging
│   └── ui/
│       ├── i18n.ts         # UI copy localization
│       ├── theme.ts        # theme adaptation (light/dark)
│       ├── panel-mode.ts   # panel mode (drawer/dialog) preference persistence
│       ├── icons.tsx       # Feather Icons inline SVG
│       ├── styles.ts       # design system (CSS variables)
│       ├── WebviewPanel.tsx  # main panel (React 18)
│       └── components/     # cards, forms, category tree, variable/import dialogs
└── tests/                  # Jest unit tests
```