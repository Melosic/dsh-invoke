# Changelog

本项目的所有重要变更都会记录在此文件中，格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

## [0.2.1] - 2026-08-28

### 新增
- 侧边栏面板支持右侧抽屉 / 居中弹窗两种形态（默认抽屉，聊天区保持可见），点击遮罩或按 `Esc` 关闭，形态偏好按浏览器记忆

### 变更
- 侧边栏入口改为直连官方 `sidebar.footer.action` slot 注册，注册失败才降级 DOM 注入
- client 构建产物收敛为单文件，`dsh-invoke/client` 的运行时与类型导出路径随之对齐

## [0.2.0] - 2026-08-17

### 新增
- 侧边栏悬停速览：鼠标悬停提示词卡片时快速预览正文
- 紧凑 / 舒适列表视图切换，适配不同密度的信息浏览场景

### 修复
- 覆盖导入（overwrite）时清除已删除提示词的悬空别名，避免残留引用
- 存储数据加载失败时展示错误横幅，替代静默失败或崩溃

### 变更
- 存储读取改为浅拷贝，避免外部意外修改污染缓存
- 错误信息脱敏，不再向外暴露底层异常细节
- 补齐可访问性（aria-label / role）标注
- 新增版本驱动的 schema 迁移器，为后续存储结构演进做准备

### 移除
- 移除 Gist 同步相关占位代码

## [0.1.0]

### 新增
- 提示词库管理：分类、标签、变量、内置示例
- 用户级 / 项目级双层存储合并与优先级
- `/alias` 别名系统，快速调用提示词
- 侧边栏 GUI（WebviewPanel）

[0.2.1]: https://github.com/Melosic/dsh-invoke/releases/tag/v0.2.1
[0.2.0]: https://github.com/Melosic/dsh-invoke/releases/tag/v0.2.0
[0.1.0]: https://github.com/Melosic/dsh-invoke/releases/tag/v0.1.0