# 秘径寻踪前端 · 实现进度与计划

> 更新日期：2026-07-20  
> 范围：`apps/h5-client` 主链路、共享包、B 端配套能力  
> 对照基准：`docs/h5-client-demo-alignment-status.md`（2026-07-15 体验对齐总结）  
> 契约参考：`docs/schema.json`、`docs/01-product-solution.md`

---

## 1. 文档说明

本文在 **demo 体验对齐总结** 之上，汇总 **当前代码真实落地情况**，并给出：

1. **已完成进度**（可演示 / 可联调）
2. **未完成与临时策略**（含后端阻塞项）
3. **后续计划**（优先级与验收口径）

原则与对齐文档一致：

| 项 | 约定 |
| --- | --- |
| 主端 | `apps/h5-client`（Vue 3 + Vite + Pinia + Vue Router + Tailwind + GSAP） |
| 体验基准 | 原 `apps/h5-demo` 沉浸演示（当前工作区未检出 demo 源码，对齐结论仍以既有文档为准） |
| 架构 | **以 client 现有架构为主** 实现 demo 体验 |
| 冲突 | **以 demo 流程 / 交互为准** |
| 数据 | **真实公开 C 端接口 only**，禁止 mock 假任务 / 编造叙事 |
| 识别 / 播片门槛 | schema **暂无完整对等接口** → **临时可跳过** |

---

## 2. 总体进度一览

| 维度 | 进度 | 相对 07-15 变化 | 说明 |
| --- | --- | --- | --- |
| 主链路闸门 | **~95%** | ↑ | brief 三阶段同页；map 兼详情；无隐式 Join |
| 真接口收口 | **~90%** | ↑ | 列表改 Published；缓存 / 去重；Ask 接 ExhibitChat SSE |
| 视觉 / 星空 / cinema | **~90%** | 持平 | 黑金 token + 星空 + 关键 loading；路由切页不再压暗过场 |
| 字段严格跟 schema | **~75%** | 微升 | 列表/详情/Stages⊕nodes；Published 查询收紧 |
| 题型主路径（选择 + 拼图） | **~75%** | 微升 | 1~9 经 brief 闯关；扩展题型渲染器在包内齐备 |
| FAB / 问一问 | **~95%** | ↑ | 真接口会话 + SSE 流式；附带任务/站/展品上下文 |
| 识别真接口 | **~20%** | 持平 | FindScan UI 已接；真识物 API 仍待；可跳过 |
| type 10/11 分流 | **~90%** | 微升 | 11 独立解说页；10 播片后 Submit；强制跳过兜底 |
| 工程健壮性 | **~85%** | **新增** | 列表 TTL、Stages/Exhibit 缓存、Detail/Restore inflight 去重 |

**整体约 85%～90%。**  
P0 数据收口、P1 体验对齐、10/11 分流、Ask 真接口、本站页合并均已落地；**真识物 API 仍为最大阻塞项**。

---

## 3. 当前可走主链路

```text
登录（印章门：游客 / 账号 / 注册）
  → 展厅选路线（Published 列表 + 难度/规模/关键词筛选 + 主题卡片）
  → 路线 map（兼任务预览：封面 / meta / 站 pill / 开始探索 · 接着玩）
  → 介绍 prologue（有 stories 时；纵向 story beats）
  → 路线 map 选站（interactionType 标签 + sortOrder + 闸门状态）
  → 按 stageKind / interactionType 分流：
      · 11 解说 → narration（Narration/detail + 可选 generate-audio → Submit）
      · 10 找一找 → brief 页内：locate(扫一扫) → video → Submit 完成本站
      · 1~9 练习 → brief 页内：locate → video → puzzle(Submit)
  → 本站结果 result → 回路线 map
  → … 多站循环
  → 通关 finale（RouteResult → 写入收藏）
```

配套能力：

| 能力 | 状态 |
| --- | --- |
| Shell Tab：展厅 / 探索 / 收藏 | 已完成 |
| FAB：展厅 / 探索 / 收藏 / **问**；任务中：路线 / 当前 / 展厅 / **问** | 已完成 |
| 「问一问」浮层 + `/shell/ask` 全页 | 已完成（**ExhibitChat 真接口 + SSE**） |
| `MyRouteProgress` 恢复权威源 | 已完成 |
| `RecordActivity` 弱行为（进入节点等，失败静默） | 已完成 |
| 无会话深链章节 → **回 map，禁止隐式 Join** | 已完成 |
| 强制跳过本站（识别未开放 / Submit 拒绝时本地放行） | 已完成（开发 / 联调兜底） |

### 相对对齐文档的结构演进（重要）

| 07-15 文档结构 | 当前实现 | 说明 |
| --- | --- | --- |
| 独立任务详情页 `TaskDetailPage` | **并入** `ChapterMapPage` | 旧 `/tasks/:routeId` → `/missions/:id/map` |
| 独立 clue / video / puzzle 三页 | **并入** `ChapterBriefPage` 三阶段 | 旧路径 redirect 到 `brief` |
| Ask 本地启发式回复 | **ExhibitChat** 会话 + SSE 流式 | `useAskStore` + `services/exhibitChat.ts` |
| 列表 `publishStatus=2` 过滤 | **Published 专用查询** | `PublishedRouteQueryRequest`，服务端已发布列表 |

---

## 4. 分模块进度

### 4.1 Phase A — 契约收口（schema）

| 任务 | 状态 | 备注 |
| --- | --- | --- |
| 按 schema 收紧列表/详情类型 | 已完成 | |
| `GET /api/Gameplay/MyRouteProgress` | 已完成 | 恢复权威 |
| `GET /api/Gameplay/RouteResult` | 已完成 | 终局权威 |
| `POST /api/Gameplay/RecordActivity` | 已完成 | 失败静默 |
| `GET /api/Exhibit/Get` | 已完成 | 有缓存 + 并发上限 |
| Stages ⊕ Detail.nodes 合并 | 已完成 | `gameplayMissionAdapter` |
| 已发布路线列表 | 已完成 | Published 查询，非客户端硬滤 publishStatus |
| 禁止 mock / 假叙事 | 基本遵守 | 播片无 URL 时用默认片（明示可跳过） |
| 不封装 TreasureHunt | 已遵守 | 识别仍跳过 |
| 列表 / Stages / Detail 缓存与去重 | 已完成 | TTL + inflight Map |

**进度：~95%**

### 4.2 Phase B — 会话闸门与路由

| 任务 | 状态 | 关键位置 |
| --- | --- | --- |
| 路由 brief / narration / result / finale | 已完成 | `router/index.ts` |
| 旧 clue/video/puzzle/task 兼容 redirect | 已完成 | |
| `chapterProgress` 闸门 | 已完成 | recognized / videoWatched / solved |
| 识别/播片可跳过 | 已完成 | |
| 整站强制跳过 | 已完成 | `forceSkipCurrentStage` |
| 服务端进度恢复 | 已完成 | `MyRouteProgress` + restore inflight |
| **禁止页面内隐式 Join** | 已完成 | `useMissionChapterReady` |

**进度：~98%**

### 4.3 Phase C — 主链路页面

| 页面 | 状态 | 备注 |
| --- | --- | --- |
| 登录 Auth | 已完成 | 印章门 + 游客/账号/注册 + token 刷新 |
| 展厅 hall | 已完成 | 筛选 Sheet + 主题卡片轨 + 骨架 |
| 探索 playing | 已完成 | 当前会话时间线 + 继续 / 清空本地会话 |
| 收藏 archive | 已完成 | 通关后徽章与成绩（本地归档条目） |
| 路线 map（含详情预览） | 已完成 | 无会话预览 + 有会话选站 |
| 介绍 prologue | 已完成 | 纵向 story beats |
| 本站 brief（找一找→短片→闯关） | 已完成 | 页内 phase：`locate` / `video` / `puzzle` |
| 解说 narration | 已完成 | detail + 生成语音 + 轮询 + Submit |
| 本站结果 / 终局 | 已完成 | RouteResult |

**进度：~92%**

### 4.4 Phase D — Shell / 视觉 / cinema

| 任务 | 状态 | 关键位置 |
| --- | --- | --- |
| 黑金 token + 星空 + cinema | 已完成 | `index.css` / starfield / CinemaStage |
| Auth 门页印章感 | 已完成 | `AuthPage.vue` |
| 大厅/收藏/探索文案 | 已完成 | 展厅 / 探索 / 收藏 |
| FAB 对齐 demo（含「问」） | 已完成 | `FloatingMissionFab` |
| Ask 浮层 + 全页 | 已完成 | `AskPanel` / `ShellAskPage` / `useAskStore` |
| 路由切换全屏压暗 | 已收敛 | 切页不再 cinema 压暗；关键接口仍可 ref-count loading |

**进度：~90%**

### 4.5 Phase E — 问一问（相对 07-15 已升级）

| 任务 | 状态 | 备注 |
| --- | --- | --- |
| 浮层 / 全页 UI | 已完成 | |
| 按路由附带任务/站/展品上下文 | 已完成 | 用户可主动去掉，切换不全量回填 |
| `POST /api/ExhibitChat/sessions` | 已完成 | |
| 历史消息拉取 | 已完成 | |
| SSE 流式发送 / 增量展示 | 已完成 | `createSseParser` + event 解析 |
| 来源展品 chips | 已完成 | done 事件 sources |

**进度：~95%**（产品侧若还有「馆内助手人设 / 多会话列表」可继续打磨）

### 4.6 Phase F — 识别二期（等后端）

| 任务 | 状态 |
| --- | --- |
| 公开识物 API 或开放 TreasureHunt | **等待后端** |
| 去掉「跳过识别」改为强制成功闸门 | 未做 |
| 拍照仅本地预览、不模拟成功 | 已遵守（选图后仍走跳过语义） |

**进度：0%（接口阻塞）**

### 4.7 共享包与 B 端（配套）

| 模块 | 进度 | 说明 |
| --- | --- | --- |
| `@path-seeker/game-renderer` | 高 | 选择/拼图/排序/配对/找线索/分支/推理/密码/找一找/解说等渲染器；Studio 编辑态 |
| `@path-seeker/game-runtime` | 高 | 草稿、进度、评分、会话推进 |
| `@path-seeker/ts-shared` | 中高 | 跨端契约与枚举 |
| `@path-seeker/ui` / `client-state` | 中高 | 共享 UI 与 toast 等 |
| `apps/web-admin` | 中高 | 路线 / 馆藏 / 地图 / 博物馆 / 讲解员 / 运营；Chat SSE 生成路线 |
| 微信小程序 `mp-wechat` | — | 当前工作区 **未检出**；README 仍保留规划位 |

---

## 5. 已落地代码地图（当前）

```text
apps/h5-client/src/
  App.vue                            # 星空 + Ask 浮层 + Cinema
  assets/styles/index.css            # 馆夜 token、gate、mission-card、art-hero、ask
  router/index.ts                    # Shell + mission 主链路；旧路径兼容
  adapters/
    gameplayMissionAdapter.ts        # Detail/Stages/Progress/Result 适配
    missionGameplayAdapter.ts        # 列表、Submit 结果、归档
    missionSessionAdapter.ts         # 会话恢复、进入路径、闸门
  stores/
    useMissionStore.ts               # 真接口 + 闸门 + 缓存 + 强制跳过
    useAskStore.ts                   # ExhibitChat 会话 / SSE / 附件上下文
    useAuthStore.ts / useCinemaStore.ts
  services/
    gameplay.ts                      # Join/Stages/Submit/Hints/Progress/Result/…
    exhibitChat.ts                   # 问一问真接口
    auth.ts / http.ts
  composables/
    useMissionChapterReady.ts        # 无隐式 Join；进入节点上报
  components/shell/
    FloatingMissionFab.vue
    AskPanel.vue / AskMarkdown.vue
    MissionPreviewCard.vue
    ShellTabBar.vue
  pages/
    AuthPage.vue
    ShellHallPage.vue / ShellPlayingPage.vue / ShellArchivePage.vue / ShellAskPage.vue
    ProloguePage.vue
    ChapterMapPage.vue               # 详情预览 + 选站枢纽
    ChapterBriefPage.vue             # 本站三阶段（1~10）
    NarrationChapterPage.vue         # 11 解说
    ChapterResultPage.vue / FinalePage.vue
```

---

## 6. 接口与字段结论

### 6.1 已用 C 端接口

| 接口 | 状态 |
| --- | --- |
| `AppUser/*`（登录 / 注册 / 游客 / 刷新 / 资料） | 已用 |
| 已发布路线列表（Published 查询） | 已用 |
| `Route/Detail` | 已用 |
| `Gameplay/JoinRoute` | 已用（仅 map「开始/接着玩」） |
| `Gameplay/Stages` | 已用 |
| `Gameplay/Submit` | 已用 |
| `Gameplay/Hints`、`UnlockHint` | 已用 |
| `Gameplay/MyRouteProgress` | 已用 |
| `Gameplay/RouteResult` | 已用 |
| `Gameplay/RecordActivity` | 已用（弱行为） |
| `Exhibit/Get` | 已用 |
| `Narration/detail`、`Narration/generate-audio` | 已用 |
| `ExhibitChat/sessions` + SSE send | 已用 |
| `TreasureHunt/*` | **刻意不接** |

### 6.2 扫描 / 识别 / 播片

| 能力 | Schema | 本阶段策略 |
| --- | --- | --- |
| 拍照 AI 识物 | TreasureHunt（内部）或公开 API 缺失 | **不接**；跳过识别 / 强制跳过本站 |
| 介绍视频门槛 | 无公开闸门 API | 可播 URL 优先；否则默认片 + 跳过 |
| 找一找 type 10 | FindScan UI + Submit | 播片后 Submit；跳过时 forceSkip |

### 6.3 题型主路径

| interactionType | stageKind | H5 链路 | 定位 |
| --- | --- | --- | --- |
| 1 Answer | puzzle | brief：扫一扫→播片→puzzle | **主路径 · 选择** |
| 5 Select | puzzle | 同上 | **主路径 · 选择** |
| 6 Jigsaw | puzzle | 同上 | **主路径 · 拼图** |
| 2/3/4/7/8/9 | puzzle | 同上 | 兼容扩展（渲染器包内已有） |
| 10 找一找 | find_scan | brief：扫一扫→播片→Submit | UI 已接；识物可跳过 |
| 11 解说导览 | narration | **无扫一扫/播片** → narration 页 | detail + 语音 + Submit |

---

## 7. 临时策略（仍有效）

1. **识别**：跳过识别；禁止「模拟识别成功」作为正式能力；开发联调可用「跳过本站」。
2. **播片**：可播 URL 优先；否则默认片 + 跳过。
3. **闸门**：`recognized` / `videoWatched` 本地；`solved` 跟服务端（及 forceSkip 本地放行）。
4. **答题**：真实 Submit；失败展示服务端文案。
5. **恢复**：MyRouteProgress 权威；本地 session 作壳。
6. **终局**：RouteResult 权威。
7. **问一问**：真实 ExhibitChat SSE（已不再是纯本地启发式）。
8. **Join**：仅用户在 map 点击开始/接着玩；深链无会话 → 回 map。
9. **强制跳过**：后端拒绝通用 Submit 时本地完成本站，避免卡死（联调 / 缺接口场景）。

---

## 8. 验收清单

### 8.1 已可验收

- [x] 主链路：登录 → 选路 → map 开始 → prologue → 选站 → brief/narration → 结果 → 终局
- [x] 多站闸门状态可区分（待找一找 / 待播片 / 待闯关 / 待收听 / 完成）
- [x] 黑金 + 星空 + 关键 cinema loading
- [x] 服务端进度恢复 + RouteResult 终局 + 收藏写入
- [x] 印章门登录 / 展厅卡片 / map 预览
- [x] FAB 含「问」；浮层与全页可用
- [x] 无会话不隐式 Join
- [x] 主路径题型为选择 + 拼图（扩展题型可渲染）
- [x] type 11 进入解说页，不经扫一扫/播片
- [x] type 11 拉 Narration/detail；无 audio 可生成语音
- [x] type 1~10 扫一扫成功后进入短片
- [x] type 10 播片后 Submit 完成本站
- [x] clue/video/puzzle 旧链兼容到 brief
- [x] Ask 真接口（会话 + SSE 流式）
- [x] 列表 / 详情 / Stages 缓存与请求去重

### 8.2 尚未验收 / 未完成

- [ ] 识别必须真实成功才能进播片（缺公开识物 API）
- [ ] 去掉全站「跳过识别 / 跳过本站」开发兜底（产品确认后收紧）
- [ ] 播片是否必须真实 URL（产品确认）
- [ ] 全页视觉与 demo 像素级 1:1
- [ ] 收藏与服务端成就 / 徽章同步（当前偏本地归档）
- [ ] 微信小程序端与 H5 主链路对齐（工作区未检出 mp）
- [ ] 行为类型与后端 `RecordActivity` 枚举书面确认

---

## 9. 未完成项明细

### 9.1 后端阻塞（P0 等待）

| 项 | 影响 | 依赖 |
| --- | --- | --- |
| 公开识物 / 扫一扫校验 API | type 10 与所有「先找展品」闸门无法强制 | 后端开放公开接口，或明确 C 端可用的 TreasureHunt 子集 |
| 播片完成上报是否权威 | 目前仅本地 `videoWatched` | 若产品要求「必须看完」，需接口或规则确认 |
| RecordActivity 枚举文档 | 弱行为语义可能漂移 | 与后端书面对齐 activityType |

### 9.2 产品 / 体验未完成（P1）

| 项 | 现状 | 目标 |
| --- | --- | --- |
| 视觉 1:1 demo | 气质对齐，非像素级 | 地图节点动效、闯关页节奏、FAB 微交互再贴 demo |
| 默认片策略 | 无 URL 用内置 movie | 确认是否允许默认片，或强制运营配置 videoUrl |
| 强制跳过入口 | 识别/短片/闯关均可跳过本站 | 正式环境是否隐藏或仅调试开关 |
| 收藏深度 | 通关本地徽章卡 | 是否拉取服务端历史通关列表 |
| Ask 体验 | 单会话流式可用 | 多会话列表、错误重试、离线提示打磨 |

### 9.3 工程 / 多端未完成（P2）

| 项 | 说明 |
| --- | --- |
| `apps/h5-demo` | 体验基准源码当前未在工作区；对齐靠历史文档 |
| `apps/mp-wechat` | 规划中的小程序端；需与 H5 共享 runtime/renderer |
| 自动化验收 | 主链路 e2e / 关键 adapter 单测仍可加强 |
| 字段契约持续收紧 | 列表与详情偶发冗余字段，继续向 schema 收敛 |

---

## 10. 后续计划

### 10.1 近期（联调与收口）

| 优先级 | 事项 | 产出 |
| --- | --- | --- |
| P0 | 与后端确认识物方案与时间表 | 接口草案 or 明确继续跳过的发版策略 |
| P0 | 生产环境是否保留「跳过本站」 | 开关策略 / 环境变量约定 |
| P1 | 主链路真数据走查（1/5/6/10/11 各至少 1 条路线） | 验收记录与缺陷清单 |
| P1 | Ask 异常路径（断流、401、空回复） | 稳定文案与重试 |
| P1 | map / brief / narration 视觉与文案再贴 demo | UI 打磨 PR |

### 10.2 中期（体验完整度）

| 优先级 | 事项 | 产出 |
| --- | --- | --- |
| P1 | 真识别接入后：移除跳过识别，改为强制闸门 | type 10 闭环正式版 |
| P1 | 播片 URL 运营规范 + 无片降级策略产品确认 | 配置清单 |
| P2 | 收藏对接服务端进度/成就（若有） | 跨设备可见 |
| P2 | RecordActivity / 埋点字段书面化 | 文档补丁 |
| P2 | 扩展题型在真实路线上的可玩性抽检 | 2/3/4/7/8/9 体验笔记 |

### 10.3 远期（多端与运营）

| 优先级 | 事项 | 产出 |
| --- | --- | --- |
| P2 | 恢复 / 建设微信小程序端，复用 `game-renderer` + `game-runtime` | `mp-wechat` MVP |
| P2 | B 端路线生成（Chat SSE）与 C 端玩法字段双向校验 | 生成即可玩 |
| P3 | 像素级视觉与动效库沉淀 | 设计系统补充 |

### 10.4 建议里程碑

```text
M1  可演示发版（当前 ≈ 已达到）
    真接口主链路 + 可跳过识别 + Ask SSE + 10/11 分流

M2  馆内试运行
    生产关闭或限制强制跳过；配置齐全的 videoUrl；Ask 稳定
    （若识物 API 未就绪：明确「馆内试运行允许跳过识别」）

M3  正式闸门版
    真识物强制成功；去掉开发向跳过；收藏/成就跨端

M4  多端一致
    小程序与 H5 共享玩法运行时；运营后台一键生成可玩路线
```

---

## 11. 与 `h5-client-demo-alignment-status.md` 的关系

| 文档 | 角色 |
| --- | --- |
| `docs/h5-client-demo-alignment-status.md` | **体验对齐专项**：demo vs client 的原则、阶段任务、07-15 切片 |
| **本文** `docs/h5-client-progress-and-plan.md` | **总进度与计划**：在对齐基础上反映 **07-20 代码现状**、未完成项与后续里程碑 |

后续若只改对齐细节，优先更新 alignment 文档；若交付范围 / 里程碑变化，更新本文。两篇建议交叉引用，避免双源长期漂移。

---

## 12. 相关路径速查

| 路径 | 说明 |
| --- | --- |
| `apps/h5-client/` | C 端 H5 主实现 |
| `apps/web-admin/` | B 端管理与 Chat 生成 |
| `packages/game-renderer/` | 题型与找一找 / 解说渲染 |
| `packages/game-runtime/` | 会话 / 草稿 / 评分 |
| `docs/schema.json` | 公开 C 端契约 |
| `docs/01-product-solution.md` | 产品方案 |
| `docs/32-chat-send-sse-api.md` | B 端 Chat SSE |
| `docs/41-route-status-workflow.md` | 路线发布 / 审核动线 |
| `docs/h5-client-demo-alignment-status.md` | Demo 对齐专项 |
| `docs/h5-client-minimax-tts-proxy.md` | 问一问语音 MiniMax TTS：Vite 代理与生产 Nginx 反代 |
| 本文 | **实现进度 + 未完成 + 计划** |

---

## 13. 变更记录

| 日期 | 摘要 |
| --- | --- |
| 2026-07-20 | 初版：基于 alignment 文档 + 当前代码，汇总进度、未完成与 M1–M4 计划；记录 brief 合并、map 兼详情、Ask SSE、缓存去重等演进 |
