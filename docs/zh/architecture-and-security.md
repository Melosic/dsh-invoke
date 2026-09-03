# 技术架构与安全模型

本页面向希望了解 dsh-invoke 内部实现的开发者：Host + Client 双端结构、源码结构，以及 HTTP API 的三道安全门。

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

## 安全模型

HTTP API（`/api/dsh-invoke/*`）统一经过三道请求安全门（见 `src/host/routes.ts`）：

| 安全门                                         | 覆盖范围             | 防御目标                         |
| ------------------------------------------- | ---------------- | ---------------------------- |
| Host 白名单（仅本机/局域网地址）                         | 全部请求             | DNS rebinding（攻击者域名重解析到本机回环） |
| 同源校验（`Sec-Fetch-Site` + `Origin` 与 Host 比对） | 写操作              | CSRF（恶意网页跨站 POST/PUT/DELETE） |
| cwd 白名单                                     | 显式指定 `?cwd=` 的请求 | 任意目录写入                       |

cwd 白名单按优先级分三档：注册表可用时要求为 dsh 已注册工作区（最强）；注册表不可用且已打开工作区时收紧为该工作区子树；两者皆不可用时放行已存在目录（文档化降级，该场景下会话 cwd 即工作区锚点，HTTP 面仍由前两道门覆盖）。请求体上限 10MB，存储写入采用原子替换 + `.bak` 备份。

## 源码结构

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
│       ├── panel-mode.ts   # 面板形态（抽屉/弹窗）偏好持久化
│       ├── WebviewPanel.tsx  # 主面板（React 18）
│       └── components/     # 卡片、表单、分类树、变量/导入对话框
└── tests/                  # Jest 单元测试
```

