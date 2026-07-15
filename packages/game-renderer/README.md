# @path-seeker/game-renderer

共享题型契约与渲染实现，供 H5 / 后台预览（及后续小程序）复用。

## 分层

| 模块 | 职责 |
|------|------|
| `contracts.ts` | `PuzzleDefinition` / 答案草稿 / 预览 stage 外壳 |
| `adaptStage.ts` | **唯一** stage config → `PuzzleDefinition` 映射 |
| `PuzzleRendererHost` | 按 `templateType` 挂载真交互渲染器 |
| `GameplayPreviewHost` | 后台壳：1–9 走 Host 预览，10 找一找，11 解说工具 |

## 接入约定

- **C 端作答**：`adaptStageToPuzzle` → `PuzzleRendererHost`（可交互）
- **B 端预览**：同一 adapt + `previewMode`；不要再写平行 mock UI
- **应用 adapter**：只做 HTTP/会话/奖励/答案提交编码，不要复制题面字段映射

## 字段别名

后端 config 的别名（如 `left` / `left_items`）只在 `adaptStage` 内归一。  
渲染器组件只认 canonical `questionPayload`。
