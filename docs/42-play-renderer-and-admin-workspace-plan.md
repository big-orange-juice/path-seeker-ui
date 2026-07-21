# 42 · 四题型独立分流 + 编辑/模拟拆分计划

> 状态：**已定稿**（评审结论已写入 §3 / §16）  
> 日期：2026-07-21  
> 关联：`packages/game-renderer`、`apps/h5-client`、`apps/web-admin`  
> 前置讨论：共享渲染器「轻编辑耦合 / 重 play 复用」；后台编辑器与模拟器分离

---

## 1. 目标

### 1.1 产品目标

1. **题型唯一集合**：本项目只保留且只实现 4 种 `interactionType`：
   - `1` 线性答题
   - `6` 纹样拼图
   - `10` 找一找
   - `11` 解说导览
2. **物理删除其它类型**：`2/3/4/5/7/8/9` 及对应契约、映射、渲染器、文案、分支 **全部从本仓库删除**（后端已不再生成；前端不再兼容、不留 deprecated 死代码）。
3. **独立分流**：上述 4 种各自独立渲染/页面分流，不再存在「1–9 通用 puzzle 桶」。
4. **后台工作台重构**：
   - **编辑器**与**模拟器**分离
   - 编辑走普通 Form + 二层 Dialog + **单节点手动保存**
   - 保存成功 → **关闭 Dialog** → **刷新 detail**（Flow + 模拟器同步）
   - 模拟器按 H5 方式渲染，可交互，**不可提交/下一步**
5. **视觉约束（硬约束）**：
   - **H5 现有 play 渲染样式不做修改**（本计划不重做 H5 题面视觉）
   - **PC 预览（模拟器）内部渲染样式必须与 H5 play 一致**（同源组件 + 同源样式，只差外壳与提交能力）

### 1.2 非目标

- 不重做 H5 视觉体系（黑金 / cinema / 星空等）
- 不保留任何「扩展题型」兼容层或只读查看
- 不把后台 Form 控件塞进共享 play 渲染器
- 不在本阶段实现「iframe 真嵌 H5 整页」作为必须项（可作为后续增强）
- 不改后端 `interactionType` 编号语义（1/6/10/11 含义不变）
- 不改写对话 Agent 的前端路由策略（改节点仍由后端 agent 事件驱动，**保持现状**）

---

## 2. 背景与问题

### 2.1 当前结构

| 层 | 现状 |
| --- | --- |
| `contracts` + `adaptStage` | 共享字段契约与 config → `PuzzleDefinition`（仍含多题型） |
| `*Renderer` | play 交互 + 夹带 `studioMode` / `StudioField`；含 2–9 渲染器文件 |
| `GameplayPreviewHost` | 后台壳：预览 + studio 编辑字段 |
| H5 | `adaptStage` + `PuzzleRendererHost` / FindScan / Narration + 业务壳 |
| 后台 `RouteDetailDialog` | Flow + 手机框 studio + 对话三栏 |

### 2.2 核心痛点

1. **预览 ≠ H5**：手机框里混入 studio 编辑控件；编辑空间小，也看不出真 H5 效果。
2. **Flow 价值弱**：基本只负责点击加载节点。
3. **studio 落库不完整**：解说有保存链路；通用 `stage-draft` 未真正接好。
4. **题型面过宽**：仓库仍实现多题型，与后端「只产 1/6/10/11」不一致。
5. **数据源不一致**：后台预览偏 `detail.nodes`；H5 为 `Stages ⊕ nodes`（及 narration detail 等）。

---

## 3. 决策摘要（含评审定稿）

| 决策 | 结论 |
| --- | --- |
| 题型集合 | **仅** `1 / 6 / 10 / 11` |
| 其它类型 | **完全删除**（代码、类型、映射、组件、文案）；后端已不再生成 |
| 分流模型 | 4 路独立 `stageKind`；无 `puzzle` 大桶、无 unsupported 兼容业务 |
| 共享包定位 | **契约 + adapt + 纯 play 渲染**；删除 studio 职责 |
| 编辑 UI | 仅 web-admin Form Dialog；不共享进 renderer |
| 节点保存 | **单节点保存** → 关 Dialog → 刷新 detail（Flow + 模拟器）；无「保存并下一节点」 |
| 对话 Agent | **保持现状**；是否改节点由后端 agent 路由/事件决定，前端不改策略 |
| 模拟器范围 | 按节点类型同源预览：`1/6` 仅题面；`10` 含扫一扫+播片（若在其 render/链路内）；均 `canSubmit=false` |
| 节点组合体验 | **扫→播→答** 由路线节点序列拼出（如 `10 → 1 → 10 → 6`），**不是** 1/6 单节点内多 phase |
| H5 样式 | **冻结**：本计划不改 play 组件视觉 |
| PC 预览样式 | **与 H5 play 一致**；差异只允许在「设备外壳 / 预览条 / 禁提交」 |

口号：

> **轻编辑耦合，重 play 复用；契约共享，壳层分治；四型独立，预览同源；其余类型物理删除。**

---

## 4. 题型与独立分流

### 4.0 节点职责与路线组合（重要）

四种类型是 **独立节点**，各做一件事；用户体感上的「扫一扫 → 看播片 → 答题/拼图」来自 **路线上多个节点串联**，而不是 1/6 的 brief 里再嵌扫/播。

| 节点 | 用户在本站做什么 | 本站不包含 |
| --- | --- | --- |
| **10 找一找** | 扫一扫 + 看播片（完成后 Submit 本站） | 答题、拼图 |
| **1 线性答题** | **仅答题** | 扫一扫、播片 |
| **6 纹样拼图** | **仅拼图** | 扫一扫、播片 |
| **11 解说导览** | 听/看解说 | 扫一扫、播片、答题 |

典型任务编排示例：

```text
路线节点顺序：  10  →  1  →  10  →  6  →  …
用户连续体验：  扫+播 → 答题 → 扫+播 → 拼图 → …

即：找展品/看片（10）与闯关（1 或 6）拆成相邻节点，由 map 顺序推进。
```

含义：

1. **H5 `1` / `6` 的 brief = 纯关卡题面**（进入即答题/拼图），不走 locate → video → puzzle 三阶段。
2. **扫一扫、播片只属于 `10`**（及其 play 链路 / render）。
3. 后台 Flow 上看到的就是真实节点序列；模拟器 **只预览当前选中节点**，不把下一站 1/6「预演」进 10 的手机框。
4. 改造时若 H5 仍残留「1–9 也走 locate/video」的旧 phase，应 **按本模型收敛**：1/6 去掉扫/播 phase，仅保留题面（样式仍冻结在题面本身，只删错误 phase 壳）。

### 4.1 唯一合法表

| interactionType | 名称 | stageKind | 共享 play 组件 | H5 本站链路 | 后台编辑 | 后台模拟（当前节点） |
| --- | --- | --- | --- | --- | --- | --- |
| **1** | 线性答题 | `observe_choice` | `ObserveChoiceRenderer` | brief：**仅答题** → Submit | Form Dialog | 仅答题 play；禁提交 |
| **6** | 纹样拼图 | `image_puzzle` | `ImagePuzzleRenderer` | brief：**仅拼图** → Submit | Form Dialog | 仅拼图 play；禁提交 |
| **10** | 找一找 | `find_scan` | `FindScanRenderer`（扫/播在其链路内则一体） | brief：**扫一扫 → 播片** → Submit | Form Dialog | 扫+播 play；禁提交 |
| **11** | 解说导览 | `narration` | `NarrationRenderer` | narration 页（无扫/播） | Form Dialog（导游/语音相关） | 解说 play；禁提交 |

### 4.2 删除清单（硬删除，非 deprecated）

从本项目 **删除** 一切与下列 `interactionType` 相关的实现与引用：

| interactionType | 原名称（仅作删除对照） | 删除对象示例 |
| --- | --- | --- |
| 2 | 密符解锁 | `code_break` 契约 / `CodeBreakRenderer` / 映射 |
| 3 | 时序重构 | `sort` 契约 / `SortRenderer` / 映射 |
| 4 | 档案配对 | `match` 契约 / `MatchRenderer` / 映射 |
| 5 | 颜色寻宝 | `select` 契约 / `SelectRenderer` / 映射 |
| 7 | 听声配对 | 同上 match 分支 |
| 8 | 大家来找茬 | `clue_find` 契约 / `ClueFindRenderer` / 映射 |
| 9 | 影子归位 | 同上 match 分支 |

同步清理：

- `FIXED_PUZZLE_TEMPLATE_TYPES`、`PuzzlePayloadMap`、`PuzzleDefinition` 联合中的废弃成员
- `INTERACTION_TO_TEMPLATE_MAP` 中 2–5、7–9
- `INTERACTION_TYPE_META` 中非 1/6/10/11 条目
- H5 / admin / docs 中「扩展题型」文案与分支
- `PRIMARY_PUZZLE_TEMPLATES` 中若仍含 `select` 等，改为仅 `observe_choice` + `image_puzzle`（或按 kind 直接判断）

> 约定：后端已不再生成这些类型。若极端脏数据仍出现非法 `interactionType`，前端只做 **开发期断言 / 简短错误占位**，不提供业务级 unsupported 产品流，也不做只读查看。

### 4.3 分流 API 目标形态

```ts
/** 本项目仅 4 种；各自独立分流 */
export type StageKind =
  | "observe_choice" // 1
  | "image_puzzle"   // 6
  | "find_scan"      // 10
  | "narration"      // 11

export const SUPPORTED_INTERACTION_TYPES = [1, 6, 10, 11] as const
export type SupportedInteractionType = (typeof SUPPORTED_INTERACTION_TYPES)[number]

export function resolveStageKind(interactionType?: number | null): StageKind | null {
  switch (Number(interactionType || 0)) {
    case 1: return "observe_choice"
    case 6: return "image_puzzle"
    case 10: return "find_scan"
    case 11: return "narration"
    default: return null
  }
}
```

说明：

- **删除** `isPuzzleInteraction (1–9)` 及任何宽泛 puzzle 判断。
- `1` 与 `6` 在宿主层独立 kind（路由、表单、模拟器装配各自独立）。
- 共享包薄 Host 仅映射上述 4 kind；**default 分支不映射到任何题型**。

### 4.4 推荐组件入口

```text
StagePlaySurface（新，薄）
  ├─ kind=observe_choice → ObserveChoiceRenderer        // 仅答题
  ├─ kind=image_puzzle   → ImagePuzzleRenderer          // 仅拼图
  ├─ kind=find_scan      → FindScan 链路（扫 + 播一体） // 仅 10
  └─ kind=narration      → NarrationRenderer (mode=play)
```

- H5 与 PC 模拟器 **共用** `StagePlaySurface`（或等价 kind 映射）。
- `PuzzleRendererHost`：收缩为仅 1/6，或由 `StagePlaySurface` 完全取代后删除旧多题型分支。
- 删除：`studioMode`、`StudioField`、`GameplayPreviewHost` 编辑职责及相关组件。

### 4.5 模拟器范围（按节点类型，评审 + 组合模型修正）

模拟器 = **当前选中节点** 的 H5 同源 play，禁止提交/下一步。

| 选中节点 | 模拟器内容 |
| --- | --- |
| **1** | 仅答题题面（`ObserveChoiceRenderer`） |
| **6** | 仅拼图题面（`ImagePuzzleRenderer`） |
| **10** | **扫一扫 + 播片**（播片若在 10 的 render/brief 链路内则一体包含） |
| **11** | 仅解说 play |

明确 **不是**：

- 不是在 1/6 模拟器里预演「先扫再播再答」
- 不是把相邻的 10+1 合成一个预览会话（预览粒度 = 单节点；完整体验靠 Flow 顺序与真 H5 多站推进）

---

## 5. 分层架构

```text
┌──────────────────────────────────────────────────────────┐
│  @path-seeker/game-renderer                              │
│  · contracts（仅 1/6/10/11）                              │
│  · adaptStage（仅 4 型合法映射）                          │
│  · StagePlaySurface + 4 个 play 渲染器                   │
│  · 纯 play：无 studio、无保存、无后台 Form               │
│  · 样式：以当前 H5 已用 play 样式为基准（冻结）           │
└───────────────────────────┬──────────────────────────────┘
                            │
           ┌────────────────┼────────────────┐
           ▼                                 ▼
    h5-client adapter                 web-admin
    会话/进度/Submit/下一步            节点 Form / 权限 / 保存 API
    页面壳（不改题面样式）             Flow 导航 + 模拟器宿主
           │                                 │
           ▼                          ┌──────┴──────┐
      真游玩页                        编辑器        模拟器
      （可提交）                      Form Dialog   StagePlaySurface
                                      单节点保存    同源样式 + 禁提交
                                      关窗+刷 detail
```

### 5.1 共享包职责（做）

- 4 型契约与 payload
- `adaptStage` / config 归一（仅 4 型）
- play 渲染组件与 kind 映射
- 答案草稿结构（H5 提交编码、模拟器本地试玩）

### 5.2 共享包职责（不做）

- 节点保存 / 节流草稿
- 导游选择弹窗、后台 API
- 审核流、权限
- 任何「编辑态控件」混入 play 树
- 任何 2–9 题型残留

### 5.3 应用 adapter 职责

| 端 | 负责 |
| --- | --- |
| H5 | Stages⊕nodes、会话、提示、Submit、结果页、页面壳 |
| Admin | 详情装配、Form 保存、`canSubmit=false` 预览、对话 Agent **保持现状** |

---

## 6. 视觉与一致性约束（关键）

### 6.1 H5：样式冻结

本计划范围内：

- **不修改** 4 个 play 渲染器在 H5 中已呈现的布局、字号、颜色、圆角、动效节奏（除非修 bug 且不影响观感）。
- **不修改** H5 页面壳的题面外围结构，除非仅为接入 `StagePlaySurface` 的最小替换（props 映射），视觉无 diff。

验收：H5 主路径截图对比（1/6/10/11）无明显视觉回归。

### 6.2 PC 预览：与 H5 play 同源

| 允许差异 | 不允许差异 |
| --- | --- |
| 外侧手机 chrome（灵动岛、边框、home 条） | 题面内部颜色 / 字号 / 间距 / 组件结构 |
| 顶部「预览模式」轻提示条 | 插入 `StudioField`、后台 Input、保存按钮 |
| 提交/下一步按钮隐藏或 disabled | 另写一套 admin-only 题面 DOM |
| 预览数据源装配差异（若 API 不同） | 用后台表格样式重皮题面 |

实现原则：

1. PC 模拟器 **直接挂载** 与 H5 相同的 play 组件（同一 package 导出）。
2. 不传 `studioMode`；不引入后台表单组件到题面内。
3. 模拟器 viewport 宽度对齐 H5 内容宽。
4. 共享渲染器 CSS self-contained；**禁止** admin 全局样式穿透改写题面 class。
5. 扫/播若在 render 链路内：模拟器必须带上，且样式同源。

### 6.3 样式所有权

```text
play 题面样式  → game-renderer（冻结基准 = 当前 H5 观感）
H5 页面壳      → h5-client
Admin 设备壳   → web-admin（仅 chrome）
Admin 表单     → web-admin（Dialog Form，与题面隔离）
```

---

## 7. 后台工作台信息架构

### 7.1 目标布局（`RouteDetailDialog`）

```text
┌────────────────────┬──────────────────────┬──────────────────┐
│ Flow 画布          │ 模拟器（当前节点）   │ 对话 / 辅助      │
│ · 顺序即体验骨架   │ · 1/6：仅题面        │ · Agent 保持现状 │
│ · 如 10→1→10→6     │ · 10：扫+播          │ · 后端事件驱动   │
│ · 单击选中 / 编辑  │ · 11：解说           │                  │
│                    │ · 禁提交/下一步      │                  │
└────────────────────┴──────────────────────┴──────────────────┘
```

Flow 的价值：展示真实节点序列（用户连续体验的骨架），而不只是「点一下加载预览」。

### 7.2 交互约定

1. **单击 Flow 节点**：切换模拟器当前 stage（加载预览数据）。
2. **双击节点 / 工具条「编辑」**：打开二层 Dialog 节点表单。
3. **Form 内编辑**：普通后台表单，字段可观、可双列。
4. **保存（单节点）**：
   - 点「保存」→ 调 stage / narration 更新 API
   - **成功后关闭 Dialog**
   - **刷新 detail**，使 **Flow + 模拟器** 同时更新
   - **不提供**「保存并继续下一节点」
5. **取消/关闭**：丢弃未保存草稿（脏数据可二次确认，实现阶段定）。
6. **模拟器试玩**：可交互；提交类操作禁用并提示「预览不可提交」。
7. **对话 Agent**：**保持现状**——前端不接管「是否允许 agent 改 config」的策略；后端 agent 路由到修改事件后，现有刷新 detail 机制继续即可。

### 7.3 节点编辑 Dialog（按 kind 拆表单）

| kind | 表单模块（建议） | 保存后 |
| --- | --- | --- |
| `observe_choice` | 标题、题干、选项、正确项、提示 | 关 Dialog + 刷 detail |
| `image_puzzle` | 标题、题干、网格、碎片/槽位、提示 | 同上 |
| `find_scan` | 标题、线索、位置/场景、提示 | 同上 |
| `narration` | 标题、场景、导游、时长、正文相关；生成语音可独立按钮 | 同上（语音任务可不关窗，实现阶段定） |

规则对齐 web-admin-ui：

- 编辑进 Dialog，主区不长期铺大表单
- 文案不出现接口路径 / schema / 实现备注
- 多 Tab Dialog 使用稳定高度（如 `h-[90vh]`）

### 7.4 自动保存

- **移除** 输入节流自动保存作为主路径。
- 解说 debounce 自动保存迁移为 Dialog 内手动保存；生成语音可保留独立按钮。

### 7.5 模拟器数据

1. 尽量对齐 H5 字段装配（nodes + 必要 stage 字段 + narration detail）。
2. Form **未保存修改不进模拟器**；仅保存成功并 refresh 后反映。
3. 不默认提供「保存前草稿预览」。

---

## 8. H5 侧改造边界

### 8.1 要做

- `resolveStageKind` 仅返回 4 kind 或 `null`
- 删除「扩展题型」文案与 2–9 分支
- **收敛 brief phase**：`1` / `6` 进入 brief 后 **直接题面**，去掉误挂在 1–9 上的 locate/video 阶段
- `10` 保留扫一扫 → 播片 → Submit 本站
- `11` 仍走 narration 页
- 组件入口可替换为 `StagePlaySurface`（题面替换须 **零视觉 diff**；删错误 phase 壳不算改题面样式）
- adapter / store 删除非 4 型逻辑与类型依赖

### 8.2 不做

- 不改 1/6/10/11 **play 题面**样式
- 不把 1/6 改回「单站内扫+播+答」
- 不把 admin Form 逻辑带回 H5

### 8.3 提交能力边界（对比模拟器）

| 能力 | H5 · 1/6 | H5 · 10 | H5 · 11 | Admin 模拟器（对应当前节点） |
| --- | --- | --- | --- | --- |
| 答题/拼图题面 | ✅ | — | — | 选中 1/6 时 ✅ |
| 扫一扫 + 播片 | — | ✅ | — | 选中 10 时 ✅ |
| 解说 play | — | — | ✅ | 选中 11 时 ✅ |
| 本地答案草稿 | ✅ | 视实现 | — | 可 |
| 服务端 Submit | ✅ | ✅ | ✅ | ❌ |
| 下一步 / 回 map | ✅ | ✅ | ✅ | ❌ |
| 生成语音 | — | — | ✅ | Form 内；不进题面编辑 |

---

## 9. 共享包瘦身清单

### 9.1 删除（硬删除）

| 项 | 动作 |
| --- | --- |
| `StudioField.vue` | 删除；admin Form 用 shadcn |
| `studioMode` / `update:content` | 从全部 renderer 移除 |
| `GameplayPreviewHost` | 删除或 admin 本地薄宿主替换后删除 |
| `RendererSurfaceMode = studio` | 删除 |
| `CodeBreakRenderer` / `SortRenderer` / `MatchRenderer` / `SelectRenderer` / `ClueFindRenderer` / `StoryBranchRenderer` / `MultiStepReasoningRenderer` | **删除文件** |
| 对应 payload / templateType | **从 contracts 删除** |
| `PuzzleRendererHost` 中多题型分支 | 删除；仅留 1/6 或整体替换为 `StagePlaySurface` |

### 9.2 保留并收紧

| 项 | 动作 |
| --- | --- |
| `contracts.ts` | **仅** 1/6/10/11 相关类型 |
| `adaptStage.ts` | **仅** 4 型映射；非法 type → `null` |
| `ObserveChoiceRenderer` | 纯 play（去 studio） |
| `ImagePuzzleRenderer` | 纯 play（去 studio） |
| `FindScanRenderer` | 纯 play（去 studio）；扫/播若在内则保留现状样式 |
| `NarrationRenderer` | 纯 play；语音入口由宿主在 play 外决定 |
| `INTERACTION_TYPE_META` | **仅** 1/6/10/11 |

### 9.3 README 更新

- 共享 = 契约 + adapt + 4 play 渲染
- C 端 / B 端模拟器共用 play
- B 端编辑不在本包
- 明确声明本包 **不包含** 其它 interactionType

---

## 10. 分阶段落地

### Phase 0 · 定稿对齐（0.5d）— **已完成评审**

- [x] 评审五项结论写入本文
- [x] 4 型白名单 + 其它类型硬删除
- [x] 模拟器：仅 10 含扫/播；1/6 仅题面
- [x] 单节点保存 → 关 Dialog → 刷 detail
- [x] Agent 保持现状
- [x] 节点组合模型：扫→播→答 = `10` 与 `1/6` 串联，非单站多 phase
- [ ] 可选：H5 四型截图基线（开工前）

### Phase 1 · 类型与分流硬删除 + brief 收敛（1–2d）

- [ ] `SUPPORTED_INTERACTION_TYPES` / `resolveStageKind` 仅 4 型
- [ ] 删除 2–9 契约、映射、renderer 文件与全仓引用
- [ ] H5 / admin 去掉扩展题型分支与文案
- [ ] H5：`1`/`6` brief **仅题面**；`10` 独享扫+播
- [ ] typecheck / 构建通过；非法 type 不静默映射

**验收**：仓库内无 2–9 实现；1/6 无扫播 phase；10 有扫播；四型路由正确。

### Phase 2 · 后台工作台拆分（2–4d）

- [ ] `RouteDetailDialog`：单击切换模拟器；编辑进 Dialog
- [ ] 4 套节点 Form
- [ ] 单节点手动保存 → 关 Dialog → 刷新 detail（Flow + 模拟器）
- [ ] 模拟器 play only（无 studio 编辑）
- [ ] 移除输入节流主保存路径
- [ ] Agent 面板与刷新链路保持现状

**验收**：Dialog 可改 1/6/10/11 并保存；保存后 Flow/模拟器更新；模拟器内无编辑控件。

### Phase 3 · 预览同源（1–2d）

- [ ] admin 模拟器挂 `StagePlaySurface`（或等价），**按选中节点 kind 切换**
- [ ] 选中 10：模拟器呈现扫+播且与 H5 同源
- [ ] 选中 1/6：模拟器仅题面，**不出现**扫/播
- [ ] 选中 11：仅解说
- [ ] 禁提交/下一步
- [ ] admin 全局 CSS 不污染题面

**验收**：并排 H5 与 admin 模拟器，**同类型节点**观感一致。

### Phase 4 · 共享包去 studio + 收尾删除（1–2d）

- [ ] 删除 studio 相关 API 与组件
- [ ] 删除 `GameplayPreviewHost` 等后台编辑壳
- [ ] 全仓确认无 2–9 / studio 残留
- [ ] 更新 README 与相关 docs 题型表

**验收**：game-renderer 仅 4 play；H5 视觉无回归。

### Phase 5 · 数据对齐增强（可选）

- [ ] 模拟器数据装配进一步对齐 H5（Stages 字段等）
- [ ] 10 的扫/播若仍散落在 H5 页面壳：抽成可复用 play 链路供模拟器挂载
- [ ] preview 只读会话（若后端提供）

---

## 11. 关键文件（预期）

### 共享

- `packages/game-renderer/src/contracts.ts` — 砍到 4 型
- `packages/game-renderer/src/adaptStage.ts` — 砍到 4 型
- `packages/game-renderer/src/index.ts`
- `packages/game-renderer/src/components/PuzzleRendererHost.vue` — 收缩/替换
- `packages/game-renderer/src/components/GameplayPreviewHost.vue` — 删除
- `packages/game-renderer/src/components/StudioField.vue` — 删除
- `packages/game-renderer/src/components/renderers/ObserveChoiceRenderer.vue`
- `packages/game-renderer/src/components/renderers/ImagePuzzleRenderer.vue`
- `packages/game-renderer/src/components/renderers/FindScanRenderer.vue`
- `packages/game-renderer/src/components/renderers/NarrationRenderer.vue`
- **删除**：`CodeBreak` / `Sort` / `Match` / `Select` / `ClueFind` / `StoryBranch` / `MultiStepReasoning` 等 renderer
- `packages/game-renderer/README.md`
- `packages/game-runtime` 中依赖废弃 templateType 的分支

### H5（行为/分流，尽量不碰样式）

- `apps/h5-client/src/adapters/gameplayMissionAdapter.ts`
- `apps/h5-client/src/pages/ChapterBriefPage.vue`（入口映射）
- `apps/h5-client/src/pages/NarrationChapterPage.vue`（入口映射）
- `apps/h5-client/src/utils/puzzleLabels.ts` 等 meta
- 常量 / 类型中的扩展题型引用

### Admin

- `apps/web-admin/app/components/routes/RouteDetailDialog.vue`
- 新增：`AdminStageSimulator.vue`（薄宿主）
- 新增：4 套节点 Form Dialog
- stage / narration 保存 composable
- Agent 面板：**不改策略**，仅确保 detail 刷新仍可用

### 文档

- 本文
- `docs/h5-client-progress-and-plan.md` §6.3 题型表
- `docs/h5-client-demo-alignment-status.md` 题型表（若仍维护）

---

## 12. 验收清单

### 12.1 题型

- [ ] 仓库仅存在 1/6/10/11 业务实现
- [ ] 无 2–9 renderer / 契约 / 映射 / 产品文案
- [ ] 1/6/10/11 可走完整编辑 + 预览 + H5 主路径

### 12.2 架构

- [ ] 共享包无 studio 编辑面
- [ ] 后台编辑仅 Form Dialog + 单节点手动保存
- [ ] 保存后 Dialog 关闭且 Flow/模拟器随 detail 刷新
- [ ] 模拟器与编辑器分离
- [ ] Agent 行为与现网一致（前端未改策略）

### 12.3 视觉

- [ ] H5：1/6 题面样式不回归；10 扫播链路样式不回归；11 不回归
- [ ] Admin 模拟器与 **同类型** H5 play 一致
- [ ] 1/6 模拟器无扫/播 UI；10 模拟器有扫/播
- [ ] Admin 表单不出现在手机题面内

### 12.4 交互与组合

- [ ] 模拟器可按当前节点试玩
- [ ] 模拟器无法服务端提交/下一步
- [ ] 单节点保存后 detail 刷新生效
- [ ] 路线 `10→1→10→6` 在 H5 上连续体验为：扫播→答→扫播→拼图

---

## 13. 风险与缓解

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 删 studio / 删题型时误改 play 样式 | H5 视觉回归 | 样式改动零容忍；删文件优先于改 class |
| 4 表单字段与后端 config 不一致 | 保存失败/预览空 | 以 `adaptStage` 可读字段为准；round-trip 校验 |
| 全仓引用清理不全 | typecheck 失败 / 运行时报错 | Phase 1 以 `rg` + typecheck 清零为门禁 |
| H5 旧逻辑仍让 1/6 走 locate/video | 与产品模型冲突 | Phase 1 强制 brief 按 type 分流；单测/手测 `10→1` |
| 10 扫/播散落在页面壳 | 模拟器难同源 | 抽 10 专用 play 链路组件，admin/H5 共用 |
| 误改 Agent 前端逻辑 | 与后端事件模型冲突 | Agent **保持现状**；只消费刷新事件 |

---

## 14. 建议默认实现选择

1. **先做 Phase 1–3**（硬删除 + 工作台拆分 + 预览同源），再 Phase 4 清 studio 残留。  
2. **PC 预览优先「同组件」**，不做 iframe 整页 H5。  
3. **1 与 6 宿主独立 kind**，组件层薄映射即可。  
4. **删除优先于兼容**：不为 2–9 留类型别名或 re-export。  
5. **H5 样式冻结** 写入 PR 说明：play 渲染器 class/style 变更需单独审批。

---

## 15. 一句话结论

> 本项目 **只实现 1 / 6 / 10 / 11** 且职责分离：**10 = 扫+播，1/6 = 仅关卡，11 = 解说**；「扫→播→答」靠路线节点串联（如 `10→1→10→6`）。共享层纯 play 同源；后台 Form 单节点保存（关窗刷 detail）+ 按节点类型模拟；Agent 保持现状；H5 题面样式冻结。

---

## 16. 评审结论（已定稿）

| # | 原问题 | 结论 |
| --- | --- | --- |
| 1 | 历史 `2/3/4/5/7/8/9` 如何处理？ | **完全 drop**。后端已不再生成；前端 **删除全部相关代码**，不留兼容/只读。 |
| 2 | 模拟器是否包含扫一扫/播片？ | **仅节点 10**：扫+播若在 10 的 play 链路内则模拟器包含。**1/6 不含扫播**。 |
| 3 | 是否需要「保存并下一节点」？ | **不需要**。单节点保存成功 → **关闭 Dialog** → **刷新 detail**（Flow + 模拟器）。 |
| 4 | 对话 Agent 与 Form 主从？ | **非前端决策**。由后端 agent 路由到修改事件；前端 **保持现状**。 |
| 5 | `5` 等是否可能加回？ | **否**。除 1/6/10/11 外 **全部删除**，本项目不再包含其它类型。 |
| 6 | 1/6 brief 是否含扫/播？ | **否**。1/6 **仅答题/拼图**。扫+播只属于 **10**。用户连续体验由节点序列组成（例：`10 → 1 → 10 → 6` ⇒ 扫播→答→扫播→拼图）。 |

---

## 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-07-21 | 初稿：四型独立分流 + 编辑/模拟拆分 + H5 样式冻结/PC 同源预览 |
| 2026-07-21 | 评审定稿：硬删除非 4 型；扫/播在 render 内则入模拟器；单节点保存关窗刷 detail；Agent 保持现状 |
| 2026-07-21 | 修正节点模型：1/6 仅关卡；扫+播仅 10；连续体验靠 `10→1→10→6` 等序列 |
