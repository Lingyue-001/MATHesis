# CText 调试尾巴快速指引（小白版）

这份文档是给日常使用看的，不是技术实现文档。

## 先记住这 4 个尾巴

1. `?ctextDebug=1`
- 用途：显示调试信息（例如当前走的是 `json` 还是 `middleware`）。
- 适合：你想知道“现在到底走了哪条链路”。

2. `?ctextRefresh=1`
- 用途：强制刷新，跳过 middleware 缓存。
- 适合：你刚改了逻辑或结果不对，怀疑是缓存导致旧结果。

3. `?ctextSource=json` 或 `?ctextSource=middleware`
- 用途：强制指定数据源。
- 适合：你要对比“线上方案（json）”和“本地方案（middleware）”。

4. `?ctextProxy=https://<你的 netlify 站点域名>`
- 用途：给 JSON 模式指定代理端点（Netlify Functions）。
- 适合：线上场景必须配置，避免浏览器直连第三方 API 跨域失败。

## 常用组合（可直接复制）

- 看调试信息：`?ctextDebug=1`
- 强制走 JSON API 并看调试：`?ctextDebug=1&ctextSource=json`
- 强制走 JSON + Netlify 代理：`?ctextDebug=1&ctextSource=json&ctextProxy=https://<your-netlify-site>`
- 强制走 middleware + 跳过缓存：`?ctextDebug=1&ctextSource=middleware&ctextRefresh=1`

## 我该看哪个文件？

1. 日常先看：`DEBUG_FLAGS_QUICKSTART.md`（本文件）
- 你想快速知道“这个尾巴干嘛用”时看这里。

2. 规范明细：`DEBUG_FLAGS_REFERENCE.md`
- 你想看完整参数表、默认值、标准说明时看这里。

3. 参数源头：`src/js/debugFlags.mjs`
- 你要新增/修改尾巴参数时改这里（单一来源）。

4. 页面调用位置：`src/transcriptions/tei_hanshu/1a.html`
- 你要看页面实际如何读这些参数时看这里。

5. 自动更新脚本：`scripts/generate-debug-flags-doc.mjs`
- 你要更新参数文档自动生成逻辑时看这里。

## 什么时候需要你手动操作？

- 平时不用手动操作，`npm run start` / `npm run build` 会自动更新参数文档。
- 只在你改了参数定义后，才需要关注文档是否同步更新。
