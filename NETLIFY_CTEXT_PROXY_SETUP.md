# Netlify CText Middleware Setup

这个文档只讲你本人要做的操作。

## 1. Netlify 项目配置（必须）
在 Netlify 项目 `Site configuration -> Build & deploy` 里确认：

- Build command: `NODE_ENV=production npm run build`
- Publish directory: `dist`

函数目录来自仓库 `netlify.toml`：`netlify/functions`。

## 2. 触发部署（必须）
- 代码 push 到主分支后，等待 Netlify deploy 成功。
- 如果 deploy 失败，先看日志里是否仍显示 `publish: /opt/build/repo/dist` 且目录不存在；若存在，说明 Build command 没生效。

## 3. 先单测函数（必须）
在浏览器打开（把域名换成你的）：

`https://<your-netlify-site>.netlify.app/.netlify/functions/ctext-search?q=一&debug=1`

预期：返回 JSON，不是 HTML 页面。

## 4. 页面联调
### 情况 A：页面也在 Netlify（同域）
直接在页面 URL 加：

`?ctextDebug=1&ctextSource=middleware`

### 情况 B：页面在 GitHub Pages，middleware 在 Netlify（跨域）
在页面 URL 加：

`?ctextDebug=1&ctextSource=middleware&ctextProxy=https://<your-netlify-site>.netlify.app`

## 5. 失败时的快速判断
- 如果看到 `Source: middleware` 但卡片全空：
  - 先看 debug 里的 `parseStatus`。
- 如果直接报错 `JSON.parse unexpected character`：
  - 你拿到的是 HTML 不是 JSON，说明函数请求被改写到网页路由或上游返回非 JSON。
- 如果函数 URL 打不开：
  - 先确认 deploy 成功，再确认你访问的是 `/.netlify/functions/ctext-search` 不是 `/api/ctext/search`。
