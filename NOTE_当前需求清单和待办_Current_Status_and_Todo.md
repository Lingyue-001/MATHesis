# NOTE 当前需求清单和待办 / Current Status and Todo

职责说明：
- 本文件只记录“当前状态、未解决问题、待办优先级、进行中需求”。
- 不记录已完成改动过程；已完成事项请查 `LOG_已完成改动和复盘_Completed_Changes_and_Retrospective.md`。

## 当前状态（Current Status）
- 站点基础：Eleventy 站点可用，Search / Transcriptions / Visualization / About 已有页面框架。
- Transcriptions：已接入 `src/transcriptions/tei_hanshu/1a.html` 与 `src/transcriptions/tei_hanshu/1a.xml` 的旧逻辑入口用于验证渲染链路。
- Transcriptions：`src/transcriptions/tei_brhat/` 已建立并可访问 `1r` 测试页。
- 数据现状：搜索使用 `src/data.json`，可视化使用 `static/*.csv`，存在双数据源并行。
- CText 检索现状：已新增 Netlify Functions 入口（`netlify/functions/ctext-search.js` + `netlify.toml` 重写 `/api/ctext/search`），Netlify 部署可直接走 middleware 逻辑；GitHub Pages 仍不提供该后端接口。
- CText 检索现状：本地可通过独立代理 `npm run start:ctext-proxy`（`server/ctextProxyServer.js`）复用浏览器态会话，并在页面用 `ctextProxyOrigin` 指向该代理做联调。
- CText 检索现状：`/transcriptions/tei_hanshu/1a/` 与 `/transcriptions/tei_brhat/1r/` 已作为规范入口；`*.html` 路由在 Netlify 侧重定向到目录路由，避免前端变量注入与路径解析不一致。
- Brhat 本地编辑器现状：`src/transcriptions/tei_brhat/1r.html` 支持本地草稿编辑模式，仅在 `localhost/127.0.0.1` 且 URL 带 `?edit=1` 时显示 `Editor` 按钮；编辑结果仅写入浏览器 `localStorage`，不会改动 XML 源文件。

## 紧急 TODO（下次继续）
- [ ] `Matched terms` 展示增强：
  - 每个匹配项显示对应 node 的英文名（中文后缀附英文）。
  - 合并同一 node 的繁简/异体命中，避免被拆成多个独立项。
  - 参考显示目标：`黃鐘 3 / 黄钟 2 / 黄鐘 1`（按同一 node 聚合统计并展示词形分布）。
  - 展开/收起交互动效优化：替换当前生硬开合，改为平滑过渡（高度/透明度/轻微位移），并保证快速点击时状态一致。
- [ ] CText 外部检索稳定性（高优先）：
  - 现状：在 `CTEXT_FETCH_MODE=browser` + 缓存 + 节流下，常见高亮词条检索已显著稳定。
  - 当前实现基线（2026-02-09）：
    - 文本/章节与次数统一从 `searchu=...&reqtype=stats` 统计页提取（避免普通结果页分页/模板噪音）。
    - 检索范围/条件/符合次数仍从 `searchu=...` 主结果页解析。
    - 同一节点在页面不同位置点击时，前端按归一化 `queryKey` 复用同一请求与结果（含 in-flight 去重）。
    - 后端默认缓存 TTL 已提升为 24 小时（可由 `CTEXT_CACHE_TTL_MS` 覆盖）。
    - 结果浮窗支持中英切换（当前已移除空白“检索内容 / Search details”标题行）。
  - 目标：把“可运行”提升为“可长期维护”，并降低对 HTML 模板的依赖。
  - 下一步：优先推进 JSON API 迁移；保留当前链路作为 fallback，并持续观察 `parseStatus` 中的上游风控信号。
  - 工程化待办：补齐“线上可控代理域名 + `ctextProxyOrigin` 默认注入”配置，去掉手动 debug URL 依赖。

## P0 高优先级待办（阻塞稳定性）
- [ ] 统一唯一数据源：明确 `src/data.json` 与 `static/*.csv` 的主从关系，避免数据漂移。
- [ ] 自动导出链路：补齐从 Neo4j 自动导出到 JSON/CSV 的脚本，并接入 `start/build` 前置步骤。
- [ ] 修复脚本可移植性：`generate_simp_trad_map.py` 去除绝对路径与失效输入路径引用。
- [ ] CText 接口治理升级：调研并改用对方 JSON API（替代 HTML 抓取解析）。
  - 目标：减少对 HTML 模板波动和风控页分流的耦合，提高长期稳定性与合规性。
  - 过渡策略：保留现有浏览器态抓取 + 缓存 + 节流作为 fallback，待 JSON API 字段映射稳定后再切主链路。

## P1 中优先级待办（质量与维护）
- [ ] 清理重复 edge：`src/data.json` 中重复关系需去重并补校验。
- [ ] 清理冗余代码：`src/js/filter.js` 未使用变量 `displayedName`。
- [ ] 文档补齐：完善数据导出命令、字段约束、更新流程。
- [ ] 复盘机制补全（未完成）：
  - 背景：此前已确认“改正错误后需要补反思”，但边界条件与 prompt 模板没有写清楚，导致后续执行口径不稳定。
  - 待补：新增可复用的“边界条件清单 + prompt 模板 + 触发时机”规范，并在 AGENTS/流程文档中固化。

## P2 体验优化待办（不阻塞主流程）
- [ ] 本地样式未生效问题复查：Search 分隔线、Filter 装饰线、Transcriptions 背景框与边距在 localhost 的一致性。
- [ ] 转写页面后续演进：在“已可用”的基础上，再评估是否把旧 HTML 渲染逻辑模块化到站内组件。
- [ ] 详细转写页返回按钮样式统一：使用常规 `Back` 按钮（无边框、带轻微底部阴影），不使用左侧悬浮箭头方案。
- [ ] 首页视觉风格优化（Hero）：
  - 保持黑底整页景深方向，继续微调象数主体尺度、中心层次、标题阴影风格与 CTA 对比度。
  - 目标：在保留现有品牌字体的前提下，提升首屏质感与可读性，减少“硬边”效果。
- [ ] Folio Tracker 状态页（讨论版，待后续实现）：
  - 目标：在 `Transcriptions index` 与详细页之间增加“状态总览 + gallery 预览”的串联层，支持 `Grid / Detail` 视图切换。
  - 已确认需求字段：
    - 自动：当前作品已有哪些 folio（以已有单页网页 + 手稿图片为准）、是否有转写、是否支持图片下载、是否有高分辨率外部 viewer（并注明来源）。
    - 手动：转写状态中的“定稿/进行中”（默认“进行中”，定稿需手动更新）。
  - 数据策略：采用“单一状态源（manifest）”供 index / tracker / detail 复用，避免三层页面重复维护。
  - 技术备注：此前最小版 tracker 试做已因 Liquid template 渲染问题; tag "set" not found回滚；后续需先明确 Eleventy 数据加载与模板语法边界，再分步恢复实现。
- [ ] Brhat annotate 独立工作台（待实现）：
  - 形态：单独页面（不混入正式阅读页），视觉风格与现有 Brhat transcription 页面一致。
  - 功能：保留 line images + 草稿编辑（可本地保存/导入导出），用于提升转写效率。
  - 数据流：页面编辑先生成草稿 patch（JSON），不直接写 XML 源文件。
  - 入库：通过独立 apply 脚本写回 XML，要求包含校验、自动备份、old/new diff。
  - 标记转换：支持把编辑时输入的可视化简写符号（如 `< >` 等约定）在写回时自动转换为对应 TEI/XML 标签（反向映射可配置）。
- [ ] 节点词命中的数字语境精细规则：在保留“阿拉伯数字默认不匹配”的基础上，为常用汉字数字建立语境过滤。
  - 参考思路：对常见序数/结构搭配词做正则过滤（例如 `一曰/二曰/三曰`、条目编号、枚举序号等），避免把结构词误判为概念节点命中。
  - 目标：保留象数语境中的有效数字词命中，降低格式性数字用法的误命中。

## 可实现但暂缓需求（Deferred but Feasible）
- [暂缓] 抽象统一 TEI 渲染层（`tei-renderer.js + tei.css`）：
  - 目标：任意 XML 一行初始化挂载；统一格式和交互可全局更新；同时支持按单个/部分 XML 打补丁。
  - 当前替代方案：继续使用“旧 HTML + 对应 XML + 资源路径修复 + passthrough copy”的接入模式（已在 `src/transcriptions/tei_hanshu/` 生效）。
  - 暂缓理由：
    - 当前优先级是先扩充可用转写样本并验证内容链路，不是立即重构渲染架构。
    - 现有方案改动面小、风险低，可快速接入新材料。
    - 统一渲染层需要先定义 TEI 支持子集与补丁边界，否则早期容易过度设计。

## 进行中方向（Roadmap）
- 中国材料方向：继续扩展文本节点与关系映射。
- 梵语手稿方向：扫描图、转写、译文并行；支持词形变化和片段检索；后续接 OCR post-correction。

## 已实现的简单功能（清单）
- [已实现] 详细转写页复用全局顶栏（`site-header/site-nav`）。
- [已实现] 详细转写页提供 `Back` 按钮（无边框 + 轻微底部阴影）。
- [已实现] 详细转写页末尾提供 `View XML` 入口。
- [已实现] 标题分隔线与 bibliography 顶部分隔线统一为 About 风格渐变线。
- [已实现] `1a` 页已接入“只高亮不加链接”的节点词命中原型（含页面内命中摘要与控制台统计）。
