# Windows 环境迁移与验证说明

本文件用于回答两个问题：

1. 这套工程迁移到新的 Windows 电脑前，需要先把哪些环境信息固化在仓库里。
2. 到新机器后，如何验证“路径变化没有把项目跑坏”。

## 本次已补到仓库里的环境锚点

- `.nvmrc`
  - 固定 Node 主版本为 `20`。
  - 依据是当前 GitHub Actions 构建使用 Node 20。
- `.env.example`
  - 汇总了仓库里实际用到的 `CTEXT_*`、`PORT`、`HOST` 等环境变量。
  - 注意：本项目当前**不会自动读取** `.env`，这个文件主要是模板和备忘录。
- `requirements.txt`
  - 固定 Python 侧目前唯一已确认依赖：`opencc-python-reimplemented==0.1.7`。
  - `generate_simp_trad_map.py` 的导入名是 `opencc`，对应的 pip 包名不是 `opencc`，而是 `opencc-python-reimplemented`。

## 当前可确认的版本信息

以下信息已能从仓库配置或本机环境确认：

- Node 目标版本：`20`
  - 来源：`.github/workflows/eleventy.yml`
- Eleventy 版本：锁文件解析为 `2.0.1`
- Playwright 版本：`^1.58.2`
- Python 版本：当前旧 Mac 可见的是 `Python 3.9.6`
- Python OpenCC 包：`opencc-python-reimplemented 0.1.7`
- 当前旧 Mac 上 Node 可执行文件位于：
  - `~/.nvm/versions/node/v20.19.1/bin/node`

## 不会随 Git 自动迁移的本地状态

这些内容即使仓库已同步，也不会自动跟着到新电脑：

- `.env`
  - 被 `.gitignore` 忽略。
- `tmp/`
  - 被 `.gitignore` 忽略。
  - 包括 `tmp/ctext_cache/`、`tmp/ctext_session/`、`tmp/ctext-static-build/`。
- 浏览器 `localStorage`
  - `src/transcriptions/tei_brhat/1r.html` 的本地编辑草稿保存在 `localStorage`。
  - `src/transcriptions/tei_hanshu/1a.html` 里保存过的 `ctextProxyOrigin` 也可能在 `localStorage`。

如果你还需要旧 Mac 浏览器里的 Brhat 草稿，这部分要单独导出；只迁移 Git 仓库本身不会带过去。

## 路径迁移结论

本次代码审计没有发现写死到旧 Mac 绝对路径的运行代码，例如：

- `/Users/...`
- `/opt/homebrew/...`
- `/usr/local/...`
- `C:\\...`

当前项目大多使用两类路径：

- 相对仓库根目录的路径
  - 例如 `process.cwd()` + `tmp/...`、`src/...`、`static/...`
- 相对网页路由的路径
  - 例如 `../../../css/style.css`、`../1r.xml`

因此：

- 仓库移动到 Windows 的任意目录，原则上不会因为“目录变了”而直接失效。
- 但命令应尽量从仓库根目录执行，尤其是缓存构建脚本和 CText middleware 相关脚本。

## Windows 新机器建议安装

建议基线：

- Node `20.x`
- npm `10.x` 或随 Node 20 自带版本
- Python `3.9+`
- Git

按需安装：

- Playwright 浏览器
  - 如果要跑 `CTEXT_FETCH_MODE=browser`，建议执行：
  - `npx playwright install chromium`

## Windows 迁移步骤

### 1. 拉取仓库

把仓库放到任意目录都可以，例如：

- `D:\Projects\eleventy-symbolic-math`
- `C:\work\eleventy-symbolic-math`

不要依赖旧 Mac 的目录结构。

### 2. 安装依赖

PowerShell 示例：

```powershell
npm ci
python -m pip install -r requirements.txt
npx playwright install chromium
```

如果你的 Python 启动命令是 `py`，则改为：

```powershell
py -m pip install -r requirements.txt
```

### 3. 如需环境变量，按模板配置

本仓库当前没有 `dotenv` 自动加载。

这意味着：

- `.env.example` 是模板，不是“放进去就自动生效”的配置文件。
- 本地要么手动 `set` / `$env:...` 导出变量，要么在部署平台里设置。

PowerShell 示例：

```powershell
$env:CTEXT_FETCH_MODE = "browser"
$env:CTEXT_PROXY_ORIGIN = "https://your-proxy.example.com"
npm run start
```

### 4. 做最小验证

先跑这组命令：

```powershell
node -v
npm -v
python --version
npm run test:ctext-stats-parser
npm run build
```

如果本地开发页也要验证，再执行：

```powershell
npm run start
```

另开一个终端窗口，如需独立 CText 代理：

```powershell
npm run start:ctext-proxy
```

## 迁移后如何判断是否正常

至少检查下面几项：

1. `npm run build` 能成功产出 `dist/` 或 `_site/`
2. `npm run test:ctext-stats-parser` 通过
3. `Transcriptions` 页面能打开两个入口
4. `Hanshu 1a` 页面能加载 XML、图片、节点命中摘要
5. `Brhat 1r` 页面能加载 XML、图片；若加 `?edit=1` 且本地是 `localhost`，可看到 `Editor` 按钮

## 额外说明：为什么有些文件名没有直接改成中文

这次我保留了几个业界约定文件名：

- `.nvmrc`
- `.env.example`
- `requirements.txt`

原因不是偏好英文，而是这些文件名一旦改成中文或自定义名字，很多工具或开发者默认习惯就不再适用。  
中文语义我放在：

- 本文件名
- 文件内注释
- README 入口

这样既保留可识别性，也不牺牲后续工具兼容性。
