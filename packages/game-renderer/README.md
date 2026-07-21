# @path-seeker/game-renderer

共享关卡契约与纯 play 渲染实现，供 H5 与后台手机模拟器复用。

## 支持范围

本包只支持 4 种 `interactionType`：

| 类型 | 场景 | 共享组件 |
| --- | --- | --- |
| `1` | 观察选择 | `ObserveChoiceRenderer` |
| `6` | 纹样拼图 | `ImagePuzzleRenderer` |
| `10` | 找一找 | `FindScanRenderer` + `FindScanPlayChain`（扫→播） |
| `11` | 解说导览 | `NarrationRenderer` |

`1` 与 `6` 是题面类型，通过 `adaptStageToPuzzle` 生成 `PuzzleDefinition` 后由 `PuzzleRendererHost` 挂载。`10` 与 `11` 由 `StagePlaySurface` 按节点类型进入各自的 play 链路。其它 interactionType 不在本包中兼容或导出。

## 分层

| 模块 | 职责 |
| --- | --- |
| `contracts.ts` | 四型契约、答案草稿与预览 stage 外壳 |
| `adaptStage.ts` | 唯一的 stage config → 题面映射（仅 `1` / `6`）；非法 type → `null` |
| `PuzzleRendererHost` | 按题面模板挂载选择题或拼图渲染器 |
| `FindScanPlayChain` | 找一找扫一扫 → 观展短片共用链路 |
| `StagePlaySurface` | 按当前节点渲染四型 play；可交互，提交由 `canSubmit` 控制 |

## 接入约定

- **H5 与 B 端模拟器共用** `StagePlaySurface`（同源布局与黑金题面样式；不含 H5 星空背景）。
- **H5**：`StagePlaySurface` + 应用层会话/Submit/下一站（`canSubmit` 或 `#actions` 槽）。
- **后台模拟器**：`StagePlaySurface`（`canSubmit=false`）+ 设备外壳；可本地试玩，不提交。
- **后台编辑**：仅 Form Dialog，不进入 play 树。
- **应用 adapter**：只做 HTTP、会话、奖励和答案提交编码，不复制题面字段映射。

## 字段别名

后端 config 的别名（如 `left` / `left_items`）只在 `adaptStage` 内归一。渲染器组件只认 canonical `questionPayload`。