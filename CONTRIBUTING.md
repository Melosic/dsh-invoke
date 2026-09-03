# Contributing

Contributions — code, issues, or docs — are welcome. This guide covers local development setup, build commands, and the contribution workflow.

## Local Development / From Source

If you want to develop the plugin locally or run it without publishing to npm:

1. **Install DeepSeek Harness globally**:
   ```bash
   npm install -g @deepseek-ai/dsh
   ```

2. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/Melosic/dsh-invoke.git
   cd dsh-invoke
   npm install
   ```

3. **Build the plugin**:
   ```bash
   npm run build          # Host build (tsc -p tsconfig.json)
   npm run build:client   # Client build (build-client.mjs bundle + tsc -p tsconfig.client.json)
   ```

4. **Create a DSH profile** (skip if you already have one):
   ```bash
   dsh --profile web --help   # creates ~/.dsh/profiles/web/ on first run
   ```

5. **Link the plugin into the profile**:
   Edit `~/.dsh/profiles/web/package.json` and add `@dsh-external/dsh-invoke` to dependencies:
   ```json
   "dependencies": {
     "@dsh-external/dsh-invoke": "link:/absolute/path/to/dsh-invoke"
   }
   ```
   Then install the profile dependencies:
   ```bash
   dsh plugin --profile web install
   ```

6. **Add the plugin mount entry** to `~/.dsh/profiles/web/cordis.patch.yml`:
   ```yaml
   - insert:
       - id: dsh-invoke
         name: '@dsh-external/dsh-invoke'
         config:
           enabled: true
   ```

7. **Start Harness with the plugin**:
   ```bash
   dsh --profile web --port 8080
   ```

Open `http://127.0.0.1:8080/` in your browser. The **Prompt Vault** entry button should appear in the sidebar automatically, directly above the Settings button.

## Development Commands

```bash
npm install
npm run build          # Host build (tsc -p tsconfig.json)
npm run build:client   # Client build (build-client.mjs bundle + tsc -p tsconfig.client.json)
npm run test           # run Jest unit tests
```

## Contribution Workflow

Issues and PRs are welcome:

1. Fork this repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'feat: add amazing feature'` (follow Conventional Commits)
4. Push the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request