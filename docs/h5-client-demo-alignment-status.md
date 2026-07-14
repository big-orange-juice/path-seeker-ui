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
| 主链路闸门 | ~90% | brief → 识别 → 播片 → 答题 → 结果 已通；无隐式 Join |
| 真接口收口 | ~85% | Join / Stages / Submit / Hints / MyRouteProgress / RouteResult / Exhibit / RecordActivity |
| 视觉 / 星空 / cinema | ~90% | 黑金 + 星空 + 过场；Auth 印章门、大厅卡、详情 art-hero |
| 字段严格跟 schema | ~70% | 列表卡收紧；无字段隐藏；Stages⊕nodes 合并 |
| 题型收敛（选择 + 拼图） | ~70% | 主路径标注；Answer/Select/Jigsaw 映射；扩展题型兼容 |
| FAB / 问 | ~90% | FAB 含「问」；浮层 + 全页 Ask；本地启发式回复 |
| 识别真接口 | 0% | 刻意等待公开 API |

**整体约 75%～80%。**  
P0 数据收口 + P1 体验对齐已落地；P2 等后端识物接口。

---

## 3. 当前可走主链路

```text
登录（印章门：游客 / 账号 / 注册）
  → 展厅选路线（今日路线 + 筛选 + 主题卡片）
  → 任务详情（art-hero · 接着玩 / 开始探索）
  → 介绍 prologue（纵向 story beats）
  → 路线选站 map
  → 线索 brief
  → 找一找 clue（可「跳过识别」）
  → 短片 video（展品片 / 默认片 + 跳过）
  → 闯关 puzzle（选择 / 拼图为主）
  → 本站结果 result → 回路线 map
  → … 多站循环
  → 通关 finale（RouteResult）
```

配套：

- FAB：展厅 / 探索 / 收藏 / **问**；任务中：路线 / 当前 / 展厅 / **问**
- 「问一问」浮层 + `/shell/ask` 全页；附带当前任务/站/展品上下文
- `MyRouteProgress` 恢复权威源；`RecordActivity` 弱行为（失败忽略）
- 无会话深链章节 → 回任务详情，**禁止隐式 Join**

---

## 4. 分阶段执行状态

### Phase A — 契约收口（schema）

| 任务 | 状态 | 备注 |
| --- | --- | --- |
| 按 schema 收紧列表/详情类型 | 已完成 | |
| `GET /api/Gameplay/MyRouteProgress` | 已完成 | |
| `GET /api/Gameplay/RouteResult` | 已完成 | |
| `POST /api/Gameplay/RecordActivity` | 已完成 | 进入节点 / 恢复；失败静默 |
| `GET /api/Exhibit/Get` | 已完成 | |
| Stages ⊕ Detail.nodes 合并 | 已完成 | |
| 禁止 mock / 假叙事 | 基本遵守 | |
| 不封装 TreasureHunt | 已遵守 | |

**进度：~95%**

### Phase B — 会话闸门与路由

| 任务 | 状态 | 关键位置 |
| --- | --- | --- |
| 路由 brief / video / ask | 已完成 | `router/index.ts` |
| `chapterProgress` 闸门 | 已完成 | |
| 识别/播片可跳过 | 已完成 | |
| 服务端进度恢复 | 已完成 | `MyRouteProgress` |
| **禁止页面内隐式 Join** | 已完成 | `useMissionChapterReady` / map / prologue |

**进度：~98%**

### Phase C — 主链路页面

| 页面 | 状态 | 备注 |
| --- | --- | --- |
| 登录 Auth | 已完成 | 印章门 + 游客/账号/注册 |
| 展厅 hall | 已完成 | 今日路线 HUD + 主题卡片轨 |
| 任务详情 | 已完成 | art-hero + 站 pill + 接着玩 |
| 介绍 prologue | 已完成 | 纵向 story beats |
| 路线 map | 功能完成 | |
| 线索 / 识别 / 播片 | 临时完成 | 跳过策略不变 |
| 闯关 puzzle | 已完成 | 主路径选择+拼图提示 |
| 本站结果 / 终局 | 已完成 | RouteResult |

**进度：~90%**

### Phase D — Shell / 视觉 / cinema

| 任务 | 状态 | 关键位置 |
| --- | --- | --- |
| 黑金 token + 星空 + cinema | 已完成 | |
| Auth 门页印章感 | 已完成 | `AuthPage.vue` |
| 大厅/收藏/探索文案 | 已完成 | 展厅 / 探索 / 收藏 |
| FAB 对齐 demo（含「问」） | 已完成 | `FloatingMissionFab` + `AskPanel` |
| Ask 浮层 + 全页 | 已完成 | `useAskStore` / `ShellAskPage` |

**进度：~90%**

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
  App.vue                          # 星空 + Ask 浮层 + Cinema
  assets/styles/index.css          # 馆夜 token、gate、mission-card、art-hero、ask
  stores/
    useMissionStore.ts             # 真接口 + 闸门 + RecordActivity
    useAskStore.ts                 # 问一问状态 / 启发式回复 / 附件上下文
  components/shell/
    FloatingMissionFab.vue         # 岛型 FAB + 「问」
    AskPanel.vue                   # 浮层 / 全页问一问
    MissionPreviewCard.vue         # 展厅主题卡片
  pages/
    AuthPage.vue                   # 印章门登录
    ShellHallPage.vue              # 展厅
    ShellPlayingPage.vue           # 探索
    ShellArchivePage.vue           # 收藏
    ShellAskPage.vue               # 问一问全页
    TaskDetailPage.vue             # art-hero 详情
    ProloguePage.vue / PuzzlePage.vue / FinalePage.vue / ...
  composables/
    useMissionChapterReady.ts      # 无隐式 Join；进入节点上报
```

Demo 对照源：`apps/h5-demo/`（`js/pages.js` / `chrome.js` / `css/styles.css`）。

---

## 6. 接口与字段结论（schema.json）

### 6.1 扫描 / 识别

| 能力 | Schema | 本阶段策略 |
| --- | --- | --- |
| 拍照 AI 识物 | TreasureHunt（内部） | **不接**；跳过识别 |
| 介绍视频门槛 | TreasureHunt（内部） | **不接**；默认片 + 跳过 |
| 公开找展品 API | **无** | 临时跳过 |

### 6.2 已用 / 未用 C 端接口

| 接口 | 状态 |
| --- | --- |
| `AppUser/*` | 已用 |
| `Route/PageList`、`Route/Detail` | 已用 |
| `Gameplay/JoinRoute` | 已用（仅详情「开始/接着玩」） |
| `Gameplay/Stages` | 已用 |
| `Gameplay/Submit` | 已用 |
| `Gameplay/Hints`、`UnlockHint` | 已用 |
| `Gameplay/MyRouteProgress` | 已用 |
| `Gameplay/RouteResult` | 已用 |
| `Gameplay/RecordActivity` | 已用（弱行为） |
| `Exhibit/Get` | 已用 |
| `TreasureHunt/*` | **刻意不接** |

### 6.3 题型主路径

| interactionType | 映射 | 定位 |
| --- | --- | --- |
| 1 Answer | `observe_choice` | **主路径 · 选择** |
| 5 Select | `select` | **主路径 · 选择** |
| 6 Jigsaw | `image_puzzle` | **主路径 · 拼图** |
| 2/3/4/7/8/9 | code/sort/match/clue… | 兼容扩展，UI 标注非主路径 |

---

## 7. Cinema 设计说明

Cinema = 路由过场 + 关键接口 loading（ref-count）。

包装 cinema loading：详情、开启探索、恢复进度、提交答案、终局结算。  
列表筛选 / Exhibit 补全 / RecordActivity / Ask **不走**全屏 cinema。

---

## 8. 临时策略

1. **识别**：跳过识别；禁止模拟成功入口。  
2. **播片**：可播 URL 优先；否则默认片 + 跳过。  
3. **闸门**：`recognized` / `videoWatched` 本地；`solved` 跟服务端。  
4. **答题**：真实 Submit。  
5. **恢复**：MyRouteProgress 权威。  
6. **终局**：RouteResult 权威。  
7. **问一问**：本地启发式回复（无后端对话 API）；可附带任务/站上下文。  
8. **Join**：仅用户在详情点击开始/接着玩；深链无会话 → 回详情。

---

## 9. 下一步建议（按优先级）

### P0 / P1 — 已完成

1. ~~MyRouteProgress / RouteResult / 严格字段 / Stages⊕nodes / Exhibit~~  
2. ~~详情 / 大厅 / 登录视觉~~  
3. ~~FAB +「问」~~  
4. ~~题型主路径选择 + 拼图~~  
5. ~~收紧隐式 Join~~  
6. ~~RecordActivity~~  

### P2 — 后端就绪后

7. 真识别 / 真播片门槛，移除临时跳过  

### 可选打磨

8. Ask 接真实馆内助手 API（若后端提供）  
9. 地图 / 闯关页视觉再向 demo 1:1  
10. 记录行为类型与后端枚举书面确认  

---

## 10. 验收清单（当前阶段）

### 已可验收

- [x] 主链路 brief → 跳过识别 → 播片 → 真答题 → 结果回路线  
- [x] 多站闸门状态可区分  
- [x] 黑金 + 星空 + cinema  
- [x] 服务端进度恢复 + RouteResult 终局  
- [x] 印章门登录 / 展厅卡片 / 详情 art-hero  
- [x] FAB 含「问」；浮层与全页可用  
- [x] 无会话不隐式 Join  
- [x] 主路径题型为选择 + 拼图  

### 尚未验收

- [ ] 识别必须真实成功才能进播片  
- [ ] Ask 真接口（当前本地启发式）  
- [ ] 全页视觉与 demo 像素级 1:1  

---

## 11. 相关路径速查

| 路径 | 说明 |
| --- | --- |
| `apps/h5-client/` | C 端 H5 主实现 |
| `apps/h5-demo/` | 体验基准 |
| `docs/schema.json` | 后端 OpenAPI |
| `docs/01-product-solution.md` | 产品方案 |
| 本文 | **当前对齐进度总结** |

---

## 12. 变更记录

| 日期 | 摘要 |
| --- | --- |
| 2026-07-14 | 初版：主链路闸门、可跳过识别/播片、cinema、接口缺口 |
| 2026-07-14 | P0：MyRouteProgress / RouteResult / 严格字段 / Stages⊕nodes / Exhibit |
| 2026-07-14 | P1：Auth 印章门、展厅/详情视觉、FAB+问、隐式 Join 收紧、RecordActivity、题型主路径 |
