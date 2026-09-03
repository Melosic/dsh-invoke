# 贡献指南（中文）

欢迎为 dsh-invoke 贡献代码、Issue 或文档。本指南覆盖本地开发环境搭建、构建命令与贡献流程。

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

6. **在** **`~/.dsh/profiles/web/cordis.patch.yml`** **添加插件挂载项**：

   ```yaml
   - insert:
       - id: dsh-invoke
         name: '@dsh-external/dsh-invoke'
         config:
           enabled: true
   ```

7. **启动 Harness（加载插件）**：

   ```bash
   dsh --profile web --port 8080
   ```

浏览器打开 `http://127.0.0.1:8080/`，侧边栏会自动出现「Prompt Vault」入口按钮（位于「设置」按钮正上方）。

## 开发命令

```bash
npm install
npm run build          # Host 端编译（tsc -p tsconfig.json）
npm run build:client   # Client 端编译（tsc -p tsconfig.client.json）
npm run test           # 运行 Jest 单元测试
```

## 贡献流程

欢迎提交 Issue 和 PR：

1. Fork 本项目
2. 创建特性分支：`git checkout -b feature/amazing-feature`
3. 提交更改：`git commit -m 'feat: add amazing feature'`（遵循 Conventional Commits）
4. 推送分支：`git push origin feature/amazing-feature`
5. 提交 Pull Request

