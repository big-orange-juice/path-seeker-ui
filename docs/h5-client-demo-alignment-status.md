# H5 Client 对齐 Demo 进度总结

> 更新日期：2026-07-14  
> 范围：`apps/h5-client` 向 `apps/h5-demo` 路线任务体验对齐  
> 对照契约：`docs/schema.json`（公开 C 端接口）

---

## 1. 目标与原则

| 项 | 约定 |
| --- | --- |
| 主端 | `apps/h5-client`（Vue 3 + Vite + Pinia + Vue Router + Tailwind） |
| 体验基准 | `apps/h5-demo`（纯 HTML/CSS/JS 沉浸演示） |
| 架构 | **以 client 现有架构为主**，在 client 上实现 demo 内容 |
| 冲突 | **以 demo 为准**，彻底放弃冲突的 client 旧交互 |
| 数据 | **真实接口 only**，禁止 mock / 假任务 / 编造叙事 |
| 识别 / 播片 | 公开 schema **暂无完整对等接口** → **临时可跳过** |

一句话目标：

> 在 client 的 Vue 真接口架构上，复刻 demo 的「选站 → 线索 → 识别 → 播片 → 闯关 → 回路线」体验；流程与交互以 demo 为准，数据与工程以 client 为准。

---

## 2. 总体进度

| 维度 | 进度 | 说明 |
| --- | --- | --- |
| 主链路闸门 | ~85% | brief → 识别 → 播片 → 答题 → 结果 已通；识别/播片可跳过 |
| 真接口收口 | ~50% | Join / Stages / Submit / Hints 已用；MyRouteProgress / RouteResult 未接 |
| 视觉 / 星空 / cinema | ~80% | 黑金 + 星空 + 过场 + loading 已落地 |
| 字段严格跟 schema | ~40% | 仍有类型“多写”字段；缺字段隐藏未系统化 |
| 题型收敛（选择 + 拼图） | ~30% | 主路径仍挂多 template |
| 识别真接口 | 0% | 刻意等待公开 API |

**整体约 55%～60%。**  
可玩骨架与氛围已成形；联调收口与体验打磨是下半场。

---

## 3. 当前可走主链路

```text
登录
  → 大厅选路线
  → 任务详情（开始 / 接着玩）
  → 介绍 prologue
  → 路线选站 map
  → 线索 brief
  → 找一找 clue（可「跳过识别」）
  → 短片 video（可「跳过短片」/ 默认片）
  → 闯关 puzzle（Gameplay/Submit 真接口）
  → 本站结果 result → 回路线 map
  → … 多站循环
  → 通关 finale
```

配套能力：

- 本地章节闸门 `chapterProgress`（Pinia 持久化）
- 恢复路径按闸门决策（brief / video / puzzle / map / finale）
- 路由 cinema 过场 + 关键接口 cinema loading
- 全屏馆夜星空（常态慢、过场加速、播片中速）

---

## 4. 分阶段执行状态

### Phase A — 契约收口（schema）

| 任务 | 状态 | 备注 |
| --- | --- | --- |
| 按 schema 收紧列表/详情类型 | 未做 | client 类型仍含 schema 列表卡未保证字段 |
| `GET /api/Gameplay/MyRouteProgress` | 未做 | 应用作恢复权威源 |
| `GET /api/Gameplay/RouteResult` | 未做 | 终局应对齐该接口 |
| `POST /api/Gameplay/RecordActivity` | 未做 | 可选弱行为 |
| `GET /api/Exhibit/Get` | 未做 | 用 `refExhibitId` 补位置/媒体 |
| 禁止 mock / 假叙事 | 基本遵守 | 识别/播片为「跳过」，非模拟成功 |
| 不封装 TreasureHunt | 已遵守 | 见第 6 节 |

**进度：~15%**

### Phase B — 会话闸门与路由

| 任务 | 状态 | 关键位置 |
| --- | --- | --- |
| 路由 `.../brief`、`.../video` | 已完成 | `apps/h5-client/src/router/index.ts` |
| `clue` 改为找一找 | 已完成 | `ArtifactCluePage.vue` |
| `chapterProgress` | 已完成 | `types/mission.ts` + session adapter |
| `markChapterRecognized` / `markChapterVideoWatched` | 已完成 | `useMissionStore.ts` |
| 进入站 / 恢复路径多闸门 | 已完成 | `missionSessionAdapter.ts` |
| 识别/播片可跳过 | 已完成 | clue / video 页 |
| 完全禁止页面内隐式 Join | 部分 | 无会话时章节页仍可能 `startRemoteMission` |

**进度：~90%**

### Phase C — 主链路页面

| 页面 | 状态 | 备注 |
| --- | --- | --- |
| 任务详情 | 部分 | 真接口有，UI 仍偏管理卡片 |
| 介绍 prologue | 部分 | 功能有，未完全 demo 纵向 story 气质 |
| 路线 map | 功能完成 | 选站、状态、闸门进入 |
| 线索 brief | 已完成 | 新页 `ChapterBriefPage.vue` |
| 识别 clue | 临时完成 | 跳过识别；无真识物 |
| 播片 video | 临时完成 | 默认 `movie.mp4` + 跳过 |
| 闯关 puzzle | 交互完成 | 去掉二次确认 Dialog；真 Submit |
| 本站结果 | 已完成 | ~1.8s 自动回路线 |
| 终局 finale | 部分 | 仍依赖本地 session，未用 RouteResult |

**进度：功能主链 ~70%；视觉 1:1 更低**

### Phase D — Shell / 视觉 / cinema

| 任务 | 状态 | 关键位置 |
| --- | --- | --- |
| 黑金 token + 面板 | 已完成 | `assets/styles/index.css` |
| 星空 canvas | 已完成 | `fx/starfieldEngine.ts` + `GalleryBackground.vue` |
| 路由 cinema 过场 | 已完成 | `router` + `useCinemaStore` |
| cinema 兼接口 loading | 已完成 | 开始/恢复/详情/提交 |
| 播片加速星空 | 已完成 | `ChapterVideoPage` → `setVideoPlaying` |
| 大厅/探索/收藏文案与结构 | 部分 | — |
| FAB 对齐 demo（含「问」） | 未做 | — |
| Auth 门页印章感 | 未做 | — |

**进度：~65%**

### Phase E — 识别二期（等后端）

| 任务 | 状态 |
| --- | --- |
| 公开识物 API 或开放 TreasureHunt | 等待后端 |
| 去掉「跳过识别」改为强制成功闸门 | 未做 |

**进度：0%（接口阻塞）**

---

## 5. 已落地代码地图

```text
apps/h5-client/src/
  App.vue                          # 星空背景 + 内容区 fx + CinemaStage
  assets/styles/index.css          # 馆夜黑金 token、gallery、cinema veil
  fx/
    starfieldEngine.ts             # 星空引擎
    routeCinema.ts                 # 路由过场效果选择
  stores/
    useCinemaStore.ts              # 过场 + loading（ref-count）
    useMissionStore.ts             # 闸门 + 真接口 + withLoading 包装
  adapters/
    missionSessionAdapter.ts       # chapterProgress / 进入与恢复路径
    gameplayMissionAdapter.ts      # Route/Stages → Mission 模型
  composables/
    useMissionChapterReady.ts      # 章节页会话就绪
  components/fx/
    GalleryBackground.vue
    CinemaStage.vue
  pages/
    ChapterBriefPage.vue           # 线索
    ArtifactCluePage.vue           # 找一找（可跳过）
    ChapterVideoPage.vue           # 短片（可跳过）
    ChapterMapPage.vue             # 路线选站
    PuzzlePage.vue                 # 闯关
    ChapterResultPage.vue          # 本站结果
    ...
  router/index.ts                  # brief/video + cinema before/afterEach
```

Demo 对照源：`apps/h5-demo/`（`js/pages.js` / `store.js` / `stars.js` / `fx.js` / `css/styles.css`）。

---

## 6. 接口与字段结论（schema.json）

### 6.1 扫描 / 识别

| 能力 | Schema | 本阶段策略 |
| --- | --- | --- |
| 拍照 AI 识物 | `TreasureHunt/CreatePhotoAttempt` + `PhotoAttempt` | **内部接口，不作为对外开放** → **不接** |
| 介绍视频门槛 | `TreasureHunt/Challenges` + `RecordIntroVideo` | 同上 → **不接** |
| 扫码作答 | `Gameplay/Submit` payload「扫码=码值」；`answerType=5` | 仅当节点配置为扫码题时可用，**不是**找展品主流程 |
| 公开找展品 API | **无** | 识别页提供 **跳过识别** |

### 6.2 已用 / 未用 C 端接口

| 接口 | 状态 |
| --- | --- |
| `AppUser/*` 登录注册游客 | 已用 |
| `Route/PageList`、`Route/Detail` | 已用 |
| `Gameplay/JoinRoute` | 已用 |
| `Gameplay/Stages` | 已用 |
| `Gameplay/Submit` | 已用 |
| `Gameplay/Hints`、`UnlockHint` | 已用 |
| `Gameplay/MyRouteProgress` | **未接** |
| `Gameplay/RouteResult` | **未接** |
| `Gameplay/RecordActivity` | **未接** |
| `Exhibit/Get` | **未接** |
| `TreasureHunt/*` | **刻意不接** |

### 6.3 Demo 字段 vs Schema（摘要）

| Demo 能力字段 | Schema | 前端策略 |
| --- | --- | --- |
| 路线 title/theme/时长/难度/年龄 | Route 有 | 已映射 |
| summary | `RouteDetail.intro` | 有则展示 |
| rewardTitle（详情） | 列表卡无保证；结算在 RouteResult | 详情可空 |
| prologue eyebrow | stories 无 eyebrow | 不编造 |
| objective / checklist / 观察文案 | 无一等字段，可能在 config | 有则显示，无则隐藏 |
| targetLocation | nodes 有 gallery/exhibit 名；Stages 可能无 | 需合并 Detail.nodes 或 Exhibit |
| video.src | 内部 introVideo 或 Exhibit 短视频 | 临时默认片 + 跳过 |
| recognized / videoWatched | 公开链无 | **本地闸门** |

---

## 7. Cinema 设计说明

Cinema **不只是路由转场**，也是 **接口 loading 语言**：

| 场景 | 表现 |
| --- | --- |
| 路由切换 | 内容压暗 → 星空斗转 → 新页升起 |
| 接口 loading | 同一 veil + 星空加速 + 底部金标文案 |
| 叠加 | ref-count：过场中再请求，veil 等到请求结束才收 |
| 过关 | `showScore(+N)` 分数闪现 |

当前包装了 cinema loading 的请求：

- 打开任务详情（无缓存时）
- 开启探索 `JoinRoute + Stages`
- 恢复进度
- 核验答案 `Submit`

列表筛选**不走**全屏 cinema（避免频繁闪屏）。

---

## 8. 临时策略（需在文档与产品上保持一致）

1. **识别**：无公开识物 API → UI 保留找一找节奏，提供「跳过识别」；禁止「模拟成功/失败」正式入口。  
2. **播片**：无稳定媒体 URL → 默认本地片 +「跳过短片」；`videoWatched` 本地标记。  
3. **闸门状态**：`recognized` / `videoWatched` 存在 Pinia 持久化会话；服务端 `solved` 会同步为已通关闸门。  
4. **答题**：始终走真实 `Gameplay/Submit`，分数与通关以接口为准。

后端一旦提供公开识物/播片门槛接口（或书面开放 TreasureHunt 给 C 端），应进入 Phase E，去掉临时跳过。

---

## 9. 下一步建议（按优先级）

### P0 — 联调与数据

1. 接入 `MyRouteProgress`，恢复以服务端为准  
2. 接入 `RouteResult`，终局徽章/分数/分享  
3. Adapter 严格字段：无则隐藏；收紧 `RouteCardResponse` 类型  
4. Stages ⊕ Detail.nodes 合并；可选 `Exhibit/Get` 补位置与短视频  

### P1 — 体验对齐 demo

5. 详情 / 大厅 / 登录页视觉与文案结构  
6. FAB +「问」面板  
7. 题型主路径收敛到选择 + 拼图  
8. 收紧页面内隐式 `startRemoteMission`  

### P2 — 后端就绪后

9. 真识别 / 真播片门槛，移除临时跳过  

---

## 10. 验收清单（当前阶段）

### 已可验收

- [x] 从大厅进入并走完一站：brief → 跳过识别 → 跳过/播片 → 真答题 → 结果回路线  
- [x] 多站闸门状态在 map 上可区分（待探索 / 已识别 / 待闯关 / 完成）  
- [x] 答对后不弹「前往下一章节」确认窗，进结果页后回路线  
- [x] 无 demo 式模拟识物成功按钮  
- [x] 黑金背景 + 星空 + 路由/loading cinema  

### 尚未验收

- [ ] 刷新后完全按服务端进度恢复（需 MyRouteProgress）  
- [ ] 终局数据完全来自 RouteResult  
- [ ] 页面展示零编造字段  
- [ ] 识别必须真实成功才能进播片  
- [ ] Shell/FAB/问 与 demo 视觉 1:1  

---

## 11. 相关路径速查

| 路径 | 说明 |
| --- | --- |
| `apps/h5-client/` | C 端 H5 主实现 |
| `apps/h5-demo/` | 体验基准（本地 mock，不对接后端） |
| `docs/schema.json` | 后端 OpenAPI |
| `docs/01-product-solution.md` | 产品方案 |
| 本文 `docs/04-h5-client-demo-alignment-status.md` | **当前对齐进度总结** |

---

## 12. 变更记录

| 日期 | 摘要 |
| --- | --- |
| 2026-07-14 | 初版：记录主链路闸门、可跳过识别/播片、黑金星空 cinema、接口缺口与后续优先级 |
