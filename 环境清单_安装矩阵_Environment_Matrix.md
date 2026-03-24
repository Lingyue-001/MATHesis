# 环境清单 / 安装矩阵 / Environment Matrix

本文件的目标不是重复 README，而是把“整站运行所需环境”拆成三类：

1. 跨平台共享依赖
2. 当前旧 Mac 的已知实际环境
3. 迁移到新 Mac / 新 Windows 时的对应安装方式

## 1. 项目共享依赖真相源

以下文件是跨平台统一维护的真相源，不应拆成两套：

- `package.json`
- `package-lock.json`
- `.nvmrc`
- `requirements.txt`
- `.env.example`

更新原则：

- 新增 Node 依赖：更新 `package.json` 和 `package-lock.json`
- 新增 Python 依赖：更新 `requirements.txt`
- 新增本地环境变量：更新 `.env.example`
- 新增系统级依赖或安装步骤：同步更新本文件和 `setup` 脚本
- 新增必须通过的核心检查：同步更新 `scripts/verify-install.mjs`

## 2. 当前旧 Mac 已知实际环境基线

采样时间：`2026-03-22`

### 系统

- macOS `15.5`
- Git `2.39.5 (Apple Git-154)`

### Node / 前端工具链

- Node `v20.19.1`
- npm `10.8.2`
- Eleventy `2.0.1`
- Playwright package `1.58.2`

### Python

- Python `3.9.6`
- OpenCC Python package `opencc-python-reimplemented 0.1.7`

### 当前旧 Mac 的实际特点

- 当前 Node 由 `nvm` 路径提供：`~/.nvm/versions/node/v20.19.1/bin/node`
- 当前 shell 不一定自动带上该 PATH，所以仓库内脚本不应假设“每次 shell 都已正确注入 Node”
- 当前项目已经改为：
  - 通过 `.nvmrc` 固定目标 Node 主版本
  - 通过本地环境加载 helper 自动读取 `.env` / `.env.local`

## 3. 跨平台依赖分层

### A. 必须有，且整站基础运行依赖

- Git
- Node `20.x`
- npm `10.x`
- Python `3.9+`

### B. 项目安装后必须有

- `node_modules/` 通过 `npm ci` 生成
- Python 依赖通过 `pip install -r requirements.txt` 生成

### C. 仅部分链路需要，但建议装

- Playwright Chromium browser
  - 用于 `CTEXT_FETCH_MODE=browser`
  - 安装命令：`npx playwright install chromium`

### D. 本地状态，不会随 Git 迁移

- `.env`
- `.env.local`
- `tmp/`
- 浏览器 `localStorage`

## 4. 当前 Mac 特定项与 Windows 对应替代

### Node 版本管理器

- 当前旧 Mac 实际使用：`nvm`
- 自动化脚本统一选择：`fnm`

原因：

- `fnm` 同时支持 macOS 和 Windows
- 可以直接读取 `.nvmrc`
- 比“Mac 用 nvm、Windows 用另一套管理器”更适合做统一安装脚本

### 系统级安装入口

- macOS：`Homebrew`
- Windows：`winget`

### Python 启动命令

- macOS：`python3`
- Windows：优先 `py`，其次 `python`

### Shell 脚本类型

- macOS：`bash` 脚本
- Windows：`PowerShell` 脚本

## 5. 自动化脚本职责

### `scripts/setup-mac.sh`

负责：

- 安装 Homebrew（若缺失）
- 安装 `fnm` / `git` / `python`
- 按 `.nvmrc` 安装并切换 Node
- `npm ci`
- `pip install -r requirements.txt`
- `npx playwright install chromium`
- 若 `.env` 不存在，则从 `.env.example` 复制
- 运行 `scripts/verify-install.mjs`

### `scripts/setup-windows.ps1`

负责：

- 使用 `winget` 安装 `Git` / `Python` / `fnm`
- 按 `.nvmrc` 安装并切换 Node
- `npm ci`
- `pip install -r requirements.txt`
- `npx playwright install chromium`
- 若 `.env` 不存在，则从 `.env.example` 复制
- 运行 `scripts/verify-install.mjs`

### `scripts/verify-install.mjs`

负责：

- 检查 Node 版本是否匹配 `.nvmrc`
- 检查项目关键文件是否存在
- 检查 Python 和 `opencc` 导入是否正常
- 运行 `npm run test:ctext-stats-parser`
- 运行 `npm run build`

## 6. 本地环境变量加载策略

当前项目已新增本地环境自动加载 helper：

- `scripts/load-local-env.cjs`

加载规则：

- 本地 Node 脚本会尝试读取：
  - `.env`
  - `.env.local`
- shell 里已经存在的环境变量优先级最高，不会被覆盖
- `.env.local` 可以覆盖 `.env` 中同名键
- 部署平台上的环境变量注入逻辑不变

当前接入了本地环境加载的入口：

- `.eleventy.js`
- `server/ctextSearchMiddleware.js`
- `server/ctextProxyServer.js`
- `netlify/functions/ctext-search.js`
- `scripts/build-ctext-cache.mjs`
- `scripts/verify-install.mjs`

## 7. 推荐安装与验证顺序

### 新 Mac

```bash
bash scripts/setup-mac.sh
```

### 新 Windows

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-windows.ps1
```

### 只做验证

```bash
node scripts/verify-install.mjs
```

## 8. 当前边界

这些自动化脚本能把“整站环境安装 + 基础验证”尽量收敛到一套流程，但仍有边界：

- CText middleware 动态链路受外部站点和网络环境影响，不能承诺永远稳定
- 浏览器 `localStorage` 不会随脚本自动迁移
- 如果目标机器完全没有可用包管理器或被公司策略锁死，脚本可能仍需要人工协助
