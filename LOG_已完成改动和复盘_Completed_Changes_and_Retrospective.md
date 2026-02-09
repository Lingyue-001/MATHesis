# LOG 已完成改动和复盘 / Completed Changes and Retrospective

职责说明：
- 本文件只记录“已完成改动、问题原因、实施过程、复盘结论”。
- 每条记录按事件组织，结构固定为：需求明确 -> 操作 -> 解决 -> 复盘。
- 待办与优先级不写在这里；请查 `NOTE_当前需求清单和待办_Current_Status_and_Todo.md`。

## [2025-01-26] GitHub Pages 部署问题修复
### 需求明确
- 解决 GitHub Pages 上样式丢失、子页面 404、渲染不完整。
- 保持 Eleventy 项目结构不变，支持 GitHub Actions 自动部署。

### 操作
- 在 Eleventy 生产环境加入 `pathPrefix`。
- 模板与脚本路径改为 `| url` 或 base-aware 拼接。
- 修正 CSS 字体/静态资源相对路径。
- 增加必要资源的 passthrough。
- 将 Pages 发布方式改为 GitHub Actions，并对齐产物目录 `dist`。

### 解决
- 部署路径前缀错位导致的 CSS/JS 404 消失。
- 构建产物与 Pages Source 对齐，页面可正确渲染。

### 复盘
- 项目站点不是根域名时，路径前缀必须统一处理。
- 发布方式、构建目录、路由前缀三者必须同时对齐。

## [2026-01-30] 搜索/转写/可视化交互与本地构建修复
### 需求明确
- 统一 Search/Transcriptions/About 的视觉节奏。
- Visualization 增加交互并修复 CSV 解析错位造成的“乱码”。
- 暂时取消卡片跳转，保留可视化主体可用。

### 操作
- CSV 解析从简单 `split(",")` 改为支持引号内逗号。
- 分页数据改为 Eleventy 规范引用（`pagination.data = "cards"`）。
- `cards` 数据迁移到 `src/data/cards.js` 以匹配 `dir.data`。
- 针对重复 `cardURL` 增加回退逻辑，避免输出冲突。
- 优化 hover/缩放交互，移除不稳定 idle 漂浮。

### 解决
- 可视化字段错位修复，节点文案显示恢复。
- 本地构建错误（分页数据找不到、重复 permalink）排除。
- 页面交互从“突变”改为平滑反馈。

### 复盘
- Eleventy 分页必须用数据键名，不应直接传数组。
- CSV 若用于生产展示，必须按 RFC 场景处理引号和逗号。
- 视觉动效应优先保证阅读稳定性。

## [2026-02-08] Transcriptions 旧项目（汉书律历志）复刻接入
### 需求明确
- 从旧项目迁入 `XML + 对应 HTML + 手稿图片`。
- 本阶段不重写逻辑，优先复刻旧页面效果并验证链路可跑通。

### 操作
- 导入文件：
  - `src/transcriptions/tei_hanshu/lingyue.xml`
  - `src/transcriptions/tei_hanshu/lingyue.html`
  - `assets/tei_hanshu/lingyue.jpeg`
- 在 `.eleventy.js` 增加 `addPassthroughCopy("src/transcriptions/tei_hanshu")`，保证 HTML 可直出访问。
- 将 `lingyue.html` 的 `fetch("TEI/...")` 改为 `fetch("./...")`。
- 删除 `loadTEI(...)` 行尾 `#...` 非 JS 注释，避免脚本中断。
- 将 `lingyue.xml` 中 `<graphic url>` 改为 `../../assets/tei_hanshu/lingyue.jpeg`。
- `src/transcriptions/index.md` 增加入口，直接指向 `{{ '/transcriptions/tei_hanshu/lingyue.html' | url }}`。

### 解决
- 修复 `Cannot GET /transcriptions/tei_hanshu/lingyue.html`。
- 恢复 XML 加载与图片调用，页面可按旧格式渲染。

### 复盘
- “复刻阶段”优先处理路径兼容，再考虑组件化重构。
- 迁移旧前端时优先检查三类路径：HTML 内 fetch、XML 内图像 URL、入口链接前缀。

## [2026-02-08] 文档体系重构（Note/Log 职责分离与命名）
### 需求明确
- note 只保留当前状态与待办优先级。
- log 只保留已完成改动与复盘。
- 文件名改为中英双语，降低使用门槛。

### 操作
- 重命名与整合：
  - `PROJECT_BACKLOG.md` -> `NOTE_当前需求清单和待办_Current_Status_and_Todo.md`
  - `CHANGELOG_2025-01-26.md` 与 `CHANGELOG_2026-01-30.md` 合并为 `LOG_已完成改动和复盘_Completed_Changes_and_Retrospective.md`
- 在 note/log 文件头新增职责声明。
- 更新 README 的引用路径。
- 新增 `AGENTS.md`，要求每次会话先阅读 note 与 log。

### 解决
- Note 与 Log 的语义边界明确，不再重复记录同类信息。
- 历史记录集中到单文件，按事件+时间可追溯。

### 复盘
- 文件名直接编码“用途 + 中英释义”，可显著降低认知成本。
- 一条事件一条记录能减少后期整理成本并提高检索效率。

## [2026-02-09] Lingyue 节点词命中原型（只高亮 + 统计）与纠偏
### 需求明确
- 在不改 TEI 渲染主结构的前提下，为 `lingyue` 页面加入“节点词命中高亮 + 日志统计”最小原型。
- 仅做命中可视化，不加超链接；先验证命中质量。

### 操作
- 仅在 `src/transcriptions/tei_hanshu/lingyue.html` 增量加入二次处理流程：
  - 渲染完成后加载 `src/data.json` 词条（`name/name_zh/name_zh_simple/name_en/name_sa/transliteration`）。
  - 对正文文本节点做命中高亮（跳过脚本/按钮/链接等区域）。
  - 输出统计日志（命中总数、命中词数、Top hits）并在页面显示简要命中摘要。
- 先后纠偏了三类规则：
  - **繁简混写漏匹配**：补入 `simp_to_trad_map.json` 参与词形变体生成，覆盖 `黄鐘` 这类混写场景。
  - **数字策略修正**：阿拉伯数字保持不匹配；将 `1-10` 的阿拉伯数字映射为汉字数字词（`一`到`十`）用于命中测试。
  - **标题排除**：大标题 `h1` 不参与匹配，避免视觉干扰。
- 高亮视觉从硬块样式改为更柔和的“下半段水彩笔”渐变，并调字色与 hover 反馈。

### 解决
- 页面可直接看到节点词命中（包括繁简混写词形），并可通过页面摘要与控制台复核命中情况。
- 解决了“黄钟只命中部分位置”与“汉字数字未命中”的两次核心问题。

### 复盘
- 原型阶段不能只依赖控制台，必须提供页面内可见反馈，否则容易误判“无变化”。
- 中文文本命中需要显式处理繁简/混写变体，否则局部漏匹配概率高。
- 数字语境是高风险区域，应先把“是否匹配阿拉伯数字、汉字数字如何放行”写成明确规则再扩展。

## [2026-02-09] Brhat 首次接入排障与转写页面统一规范
### 需求明确
- 新接入 `tei_brhat` 后页面出现 `Cannot GET /transcriptions/tei_brhat/1r.html`，需要定位并恢复访问。
- 在多文本并行接入时，确立文件组织和命名的一致性规则。
- 详细页 UI 要与站点全局样式一致，避免局部样式漂移。

### 操作
- 定位 404 根因链：
  - `.eleventy.js` 未将 `src/transcriptions/tei_brhat` 加入 passthrough。
  - `1r.html` 仍残留旧引用（加载 `lingyue.xml`）。
  - `1r.xml` 的 `<graphic url>` 仍指向 `assets/tei_hanshu/...`。
- 对应修复：
  - 增加 `addPassthroughCopy("src/transcriptions/tei_brhat")`。
  - `1r.html` 改为加载 `1r.xml`。
  - `1r.xml` 图片路径改为 `../../assets/tei_brhat/1r.jpg`。
- UI 统一修复：
  - 顶栏由局部 `legacy-*` 样式改为复用全局 `site-header/site-nav`。
  - 详细页返回交互收敛为常规 `Back` 按钮样式（无边框 + 轻微底部阴影）。

### 解决
- Brhat 页面恢复可访问、可加载 XML、可正确显示对应图片。
- 详细页顶栏与站点全局导航样式一致，减少跨页面视觉割裂。

### 复盘
- 新文本接入应先做“3项一致性检查”：
  - 目录是否在 Eleventy passthrough。
  - `html -> xml` 文件名是否一致。
  - `xml -> assets` 图片文件名/路径是否一致。
- XML 文件组按 text 分类、同一作品放在同组目录是可维护的；但必须保证 `XML-HTML-图片` 命名严格一致，否则很容易出现“能开页但内容错位/错图”的隐性故障。
- UI 层应坚持全局复用意识：对高复用、需一致的模块（header/nav/基础按钮）优先复用全局类和样式，避免局部复制导致后续维护分叉。

## [2026-02-09] CText 外部检索接入（单节点点击 + 右侧浮窗）与黄钟案例验证
### 需求明确
- 在 `lingyue` 详细转写页中，点击高亮节点词后触发外部检索，不跳转页面，在右侧浮窗返回结构化结果。
- 检索统一使用 CText 算书页面链接：`https://ctext.org/mathematics/zh?if=gb&searchu=<variant>`。
- 保证“单次只检索当前点击节点的全部变体”，并可通过 debug 追踪每个变体是否真实执行与解析成功。

### 操作
- 新增后端中间件 `server/ctextSearchMiddleware.js`，并在 `.eleventy.js` 注入开发服务器 middleware（兼容 `setServerOptions` / `setBrowserSyncConfig`）。
- 在 `src/transcriptions/tei_hanshu/lingyue.html` 中新增：
  - 高亮词点击后请求 `/api/ctext/search?q=...`；
  - 右侧浮窗展示结构化字段（检索范围/条件/符合次数/文本名/篇章名）；
  - debug 展示（attempts、source endpoint、query used、raw 提取线索）。
- 统一检索与手动 fallback 链接为 `?if=gb&searchu=`，并增加请求头（`Accept-Language`、`Referer`）提升返回模板一致性。
- 增加重试与诊断字段：
  - 单变体多次尝试（attempts）；
  - `parseStatus` 区分 `ok` / `ok_via_query_normalization` / `missing_result_header_after_retries` / `request_error`；
  - `markers` 与 `extracted` 用于判断是上游返回无结果块还是解析漏提取。
- 前端纠偏：
  - 修复 `hitCountDisplay is not defined`（冲突标记残留导致）；
  - 修复 `Number(null) === 0` 造成的“未解析误显示 0”；
  - 结果按 `符合次数` 降序显示，`0` 仅在真实数值时显示。

### 解决
- 黄钟节点（含 `黃鐘/钟` 场景）可稳定触发并返回结构化检索结果，作为当前可运行样本。
- 调试可见性显著增强：每个变体是否真正执行、是否解析成功、失败类别都可在前端 debug 明确观察。

### 复盘
- “同一 pipeline 下部分词成功、部分词失败”并不必然意味着流程分叉，常见根因是上游同端点返回模板不一致。
- 原型阶段必须把“请求是否成功”和“解析是否成功”拆分可视化，否则容易把解析空值误判为零命中。
- 对外部站点检索，先保证单一端点与可诊断状态，再做召回率优化；避免在排障期同时引入多端点策略导致因果混淆。
