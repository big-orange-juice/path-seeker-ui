# Chat Tools 操作说明（前端用）

> 适用范围：`ChatAgentTools` 中当前可用的全部 chat tool（**不含图片更新相关工具**）。
> 图片相关工具（`ListNarrationStageImages`、`AddNarrationStageImage`、`UpdateNarrationStageImage`、`DeleteNarrationStageImage`、`GenerateNarrationStageImage`、`GetAsyncImageTaskResult`）由前端图片模块单独处理，不在本文档范围。
>
> 版本日期：2026-08-14

## 通用约定

| 约定 | 说明 |
|---|---|
| 玩法类型 | `1`=观察选择题、`6`=纹样拼图、`11`=边走边听(AI语音解说)；**玩法10 已暂时停用** |
| 幂等键 | 所有写操作（创建/修改/删除/重排/生成）都必须带 `idempotencyKey`，用于防止重复提交 |
| 两段式确认 | 删除类、`MoveStage`、`PublishRoute` 首次调用**不带** `confirmationToken` 只返回确认事件；管理员确认后携带令牌再次调用才真正执行 |
| 并发控制 | `PatchStage`、`MoveStage`、`RewriteStageByAgent` 必须携带 `GetStageDetail` 返回的 `expectedUpdatedAt`，防止并发覆盖 |
| 发布状态 | `publishStatus`：`1`=草稿、`2`=已上架、`3`=已下架；只有 `isPublished=true` 才表示已上架 |
| 数量统计 | 问“共有多少件/共几件/数量”必须用 `CountExhibits`，**不得**用 `SearchExhibits` 的返回条数当总量 |
| 导游 ID | 用户按名称指定导游时，必须先调用 `SearchGuides` 查询，**禁止猜测导游 ID** |

---

## 一、文物检索与统计（3 个）

### 1. `SearchExhibits` — 搜索文物列表
按主题或关键词分页搜索文物，返回带真实 `exhibitId` 的精简候选摘要。

| 参数 | 必填 | 说明 |
|---|---|---|
| `keyword` | ✅ | 完整搜索主题，不要拆分近义词重复搜索 |
| `maxResults` | | 每页数量，建议 5-10，最多 20 |
| `museumId` | | 博物馆 ID，默认上海博物馆东馆 |
| `pageIndex` | | 页码，从 1 开始；翻页时必须保持 `keyword` 和 `maxResults` 不变 |

> 同一意图一轮只搜一次；只有管理员明确要求继续往后看时才递增 `pageIndex`。

### 2. `CountExhibits` — 统计文物数量
只返回计数，不返回列表。各条件为**与**关系；`keyword` 按名称或编码模糊匹配；`groupBy` 可按维度返回分组计数。

| 参数 | 必填 | 说明 |
|---|---|---|
| `museumId` | | 默认上海博物馆东馆 |
| `keyword` | | 名称或编码关键词，可空 |
| `dynasty` | | 朝代精确值，如“宋”；可空 |
| `category` | | 类别精确值，如“瓷器”；可空 |
| `material` | | 材质精确值，如“青铜”；可空 |
| `galleryBound` | | `true`=仅统计已绑定展厅（默认）；`null`=不限；`false`=仅未绑定 |
| `groupBy` | | 分组维度：`dynasty`、`category`、`material`、`galleryBound` |

### 3. `GetExhibitDetail` — 获取文物详情
按文物 ID 获取用于路线策划的精简基础资料和 AI 档案摘要（不返回 AI 原始响应等大字段）。

| 参数 | 必填 | 说明 |
|---|---|---|
| `exhibitId` | ✅ | 文物 ID |

---

## 二、路线管理（8 个）

### 4. `CreateRoute` — 创建草稿路线
| 参数 | 必填 | 说明 |
|---|---|---|
| `title` | ✅ | 路线标题 |
| `theme` | | 主题 |
| `museumId` | | 博物馆 ID |
| `idempotencyKey` | ✅ | 幂等键 |
| `routeType` | | 1=观察选择题、6=纹样拼图、11=边走边听；未指定默认 11；玩法10 未开放 |

### 5. `BuildPuzzleRouteFromTheme` — 按主题创建解谜路线
按主题创建解谜路线，并提交后台任务随机生成玩法 1/6 节点。返回 `routeId` 和 `taskId`。

| 参数 | 必填 | 说明 |
|---|---|---|
| `themeQuery` | ✅ | 主题查询词 |
| `title` | | 路线标题 |
| `museumId` | ✅ | 博物馆 ID |
| `pickCount` | ✅ | 选取文物数量（1-50） |
| `requiredChallengeCount` | ✅ | 必做节点数量；传 0 表示全部节点必做 |
| `difficulty` | ✅ | 难度 |
| `ageGroup` | ✅ | 年龄段 |
| `idempotencyKey` | ✅ | 幂等键 |

### 6. `GetPuzzleRouteBuildTask` — 查询解谜路线生成任务
| 参数 | 必填 | 说明 |
|---|---|---|
| `taskId` | ✅ | 后台生成任务 ID |

### 7. `ListRoutes` — 查询路线列表
| 参数 | 必填 | 说明 |
|---|---|---|
| `keyword` | | 关键词 |
| `pageIndex` | | 页码 |
| `pageSize` | | 每页数量（1-100） |

### 8. `SelectRoute` — 选择当前编辑路线
选择当前编辑路线并返回详情。选择后，后续节点操作默认作用于该路线。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |

### 9. `PreviewRoute` — 预览路线详情
| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |

### 10. `ValidateRouteDraft` — 发布前校验
只读校验，不发布。一次返回全部结构和配置问题；玩法 11 会逐节点校验解说词正文和对应音频是否生成完成。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |

### 11. `PublishRoute` — 发布路线
将路线发布为上架状态（成功后 `publishStatus=2`）。玩法 11 强制校验每个节点均包含已完成解说词和对应音频，缺失时必须向管理员说明具体节点和缺失内容。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `idempotencyKey` | | 幂等键 |
| `confirmationToken` | ⚠️ | **两段式确认**：首次调用不带令牌只返回确认事件，管理员确认后携带令牌再次调用 |

---

## 三、节点管理（14 个）

### 12. `AddStage` — 新增节点
| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `title` | ✅ | 节点标题 |
| `interactionType` | ✅ | 1=答题、6=拼图、11=AI语音解说；玩法10 未开放 |
| `exhibitId` | | 关联文物 ID |
| `config` | | 节点配置 JSON |
| `idempotencyKey` | ✅ | 幂等键 |
| `guideId` | | 仅玩法 11 使用；为空回退到会话已选导游；两者都没有时拒绝创建，需先选择导游 |

> 玩法 11：创建时只保存节点，不立即提交解说任务。全部节点创建、编辑、排序完成后必须调用 `FinalizeNarrationRoute` 统一提交。

### 13. `ListStages` — 分页查询节点
| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `keyword` | | 关键词 |
| `interactionType` | | 按交互类型过滤 |
| `exhibitId` | | 按关联文物过滤 |
| `pageIndex` | | 页码 |
| `pageSize` | | 每页数量（1-100） |
| `includeConfig` | | 是否返回节点配置 |

### 14. `GetStageDetail` — 获取节点详情
获取单个节点完整详情与并发更新时间。**修改前应先调用本工具**。

| 参数 | 必填 | 说明 |
|---|---|---|
| `stageId` | ✅ | 节点 ID |

### 15. `PatchStage` — 精确修改单个节点
按显式 `specified/value` 语义精确修改；可清空可空字段；**不能修改交互类型**。

| 参数 | 必填 | 说明 |
|---|---|---|
| `request.stageId` | ✅ | 节点 ID |
| `request.expectedUpdatedAt` | ✅ | 来自 `GetStageDetail` 的并发时间戳 |
| `request.title / subtitle / refPuzzleId / refExhibitId / unlockRule / isRequired / score / config / nextRule` | | 均为 `PatchValue` 结构（`specified` + `value`） |
| `idempotencyKey` | | 幂等键 |

### 16. `BatchPatchStages` — 批量精确修改节点
单事务执行；任一节点冲突则**全部回滚**。

| 参数 | 必填 | 说明 |
|---|---|---|
| `items` | ✅ | `ChatStagePatchRequest[]`，结构同 `PatchStage` |
| `idempotencyKey` | | 幂等键 |

### 17. `UpdateStage` — 更新节点基础信息
更新节点标题、关联文物、交互类型或配置（普通模式，可整体覆盖）。

| 参数 | 必填 | 说明 |
|---|---|---|
| `stageId` | ✅ | 节点 ID |
| `title` | | 标题 |
| `interactionType` | | 交互类型 |
| `exhibitId` | | 关联文物 |
| `config` | | 配置 JSON |
| `idempotencyKey` | | 幂等键 |

### 18. `BatchUpdateStages` — 批量更新普通节点
拍照寻宝挑战内部节点**不能**使用此工具。

| 参数 | 必填 | 说明 |
|---|---|---|
| `items` | ✅ | `ChatStagePatchItemRequest[]`：StageId、Title、Subtitle、InteractionType、ExhibitId、Config、Score、IsRequired |
| `idempotencyKey` | | 幂等键 |

### 19. `ReorderStages` — 重排普通节点
按完整节点 ID 列表精确重排。拍照寻宝路线请用 `ReorderTreasureChallenges`。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `orderedStageIds` | ✅ | 完整有序的节点 ID 列表 |
| `idempotencyKey` | | 幂等键 |

### 20. `MoveStage` — 移动节点到其他路线
| 参数 | 必填 | 说明 |
|---|---|---|
| `stageId` | ✅ | 节点 ID |
| `targetRouteId` | ✅ | 目标路线 ID |
| `targetStageNo` | | 目标序号 |
| `expectedUpdatedAt` | ✅ | 并发时间戳 |
| `idempotencyKey` | | 幂等键 |
| `confirmationToken` | ⚠️ | **两段式确认**；玩法10 挑战节点禁止使用 |

### 21. `RewriteStageByAgent` — Agent 重写单个节点
在原交互类型内由 Agent 重写节点内容。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `stageId` | ✅ | 节点 ID |
| `expectedUpdatedAt` | ✅ | 并发时间戳 |
| `difficulty` | ✅ | 难度 |
| `requirement` | | 改写要求 |
| `idempotencyKey` | | 幂等键 |

### 22. `BatchRewriteStagesByAgent` — 批量 Agent 重写节点
逐项重写；继续处理其他项并汇总失败，重试时跳过成功项。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `items` | ✅ | `ChatStageRewriteRequest[]`：StageId、ExpectedUpdatedAt |
| `difficulty` | ✅ | 难度 |
| `requirement` | | 改写要求 |
| `idempotencyKey` | | 幂等键 |

### 23. `DeleteStage` — 删除节点
| 参数 | 必填 | 说明 |
|---|---|---|
| `stageId` | ✅ | 节点 ID |
| `idempotencyKey` | | 幂等键 |
| `confirmationToken` | ⚠️ | **两段式确认**：首次调用不传令牌只返回确认事件 |

### 24. `BatchDeleteStages` — 批量删除普通节点
拍照寻宝挑战请使用 `BatchDeleteTreasureChallenges`。

| 参数 | 必填 | 说明 |
|---|---|---|
| `stageIds` | ✅ | 节点 ID 列表 |
| `idempotencyKey` | | 幂等键 |
| `confirmationToken` | ⚠️ | **两段式确认** |

### 25. `BuildStagesByAgent` — 批量生成节点
让 Agent 为普通路线的一组文物批量生成节点。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `exhibitIds` | ✅ | 文物 ID 列表 |
| `gameplayType` | ✅ | 1=答题、6=拼图；拍照寻宝路线禁止使用 |
| `count` | ✅ | 生成数量 |
| `idempotencyKey` | | 幂等键 |

---

## 四、拍照寻宝挑战（routeType=10，4 个）

### 26. `ListTreasureChallenges` — 查询挑战编辑列表
| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 拍照寻宝路线 ID |

### 27. `BatchUpdateTreasureChallenges` — 批量修改挑战
事务性修改找寻标题/内容、练习标题/配置和必做状态。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `items` | ✅ | `TreasureChallengeEditItemRequest[]`：ChallengeId、FindTitle、FindContent、PracticeTitle、PracticeConfig、IsRequired |
| `idempotencyKey` | | 幂等键 |

### 28. `ReorderTreasureChallenges` — 重排挑战
按完整挑战 ID 列表重排，并同步重排玩法 10 找寻节点。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `orderedChallengeIds` | ✅ | 完整有序的挑战 ID 列表 |
| `idempotencyKey` | | 幂等键 |

### 29. `BatchDeleteTreasureChallenges` — 批量删除挑战
删除挑战及其谜题和玩法 10 找寻节点。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `challengeIds` | ✅ | 挑战 ID 列表 |
| `idempotencyKey` | | 幂等键 |
| `confirmationToken` | ⚠️ | **两段式确认** |

---

## 五、导游（2 个）

### 30. `SearchGuides` — 查询可用导游
管理员可见全部导游；策展人可见管理员创建的导游和自己创建的导游。按名称指定导游前必须先调用本工具。

| 参数 | 必填 | 说明 |
|---|---|---|
| `keyword` | | 导游名称或关键词；为空返回最近的可用导游 |
| `maxResults` | | 最大返回数量（1-20） |

### 31. `SelectGuide` — 选择导游
按真实导游 ID 选择当前管理员自己的可用导游，并保存在当前会话上下文。

| 参数 | 必填 | 说明 |
|---|---|---|
| `guideId` | ✅ | 导游 ID（须先经 `SearchGuides` 查询，禁止猜测） |

---

## 六、解说词与音频（5 个）

### 32. `GenerateNarration` — 单节点生成解说词
为单个已有解说节点重新提交解说词正文异步生成任务，适用于路线结构稳定后的单节点重试或人工重做。正文完成后系统自动提交 TTS 音频任务。

> **新建整条玩法 11 路线时不要逐节点调用**，应在全部节点和排序完成后调用 `FinalizeNarrationRoute`。

| 参数 | 必填 | 说明 |
|---|---|---|
| `stageId` | ✅ | 解说节点 ID |
| `idempotencyKey` | | 幂等键 |

### 33. `FinalizeNarrationRoute` — 完成玩法 11 路线构建
必须在全部解说节点创建、编辑和排序完成后调用。系统按最终顺序收集全部节点并批量提交异步解说任务，正文完成后自动生成 TTS。

| 参数 | 必填 | 说明 |
|---|---|---|
| `routeId` | ✅ | 路线 ID |
| `idempotencyKey` | | 幂等键 |

### 34. `RegenerateNarrationAudio` — 仅重新生成音频
只使用节点当前已有的有效正文，单独重新提交 TTS 音频任务；不重新生成或修改解说词正文、不更换导游。仅当管理员明确要求重新生成音频/重新配音/重做语音时调用。

| 参数 | 必填 | 说明 |
|---|---|---|
| `stageId` | ✅ | 解说节点 ID |
| `idempotencyKey` | | 幂等键 |

### 35. `BatchGenerateNarrations` — 批量重新生成解说词正文
不生成音频、不提交 TTS 任务；单项失败不影响其他节点。

| 参数 | 必填 | 说明 |
|---|---|---|
| `stageIds` | ✅ | 解说节点 ID 列表 |
| `idempotencyKey` | | 幂等键 |

### 36. `SetNarrationStyle` — 更新解说节点风格设置
只更新导游、场景上下文和目标时长，不生成/重置解说词，不提交正文或音频任务。导游变化时保留正文并使旧音频失效；后续生成必须由管理员明确要求并调用独立工具。

| 参数 | 必填 | 说明 |
|---|---|---|
| `stageId` | ✅ | 解说节点 ID |
| `guideId` | | 导游 ID（为空回退会话已选导游） |
| `userStyleInput` | | 仅旧接口兼容字段，**不参与解说词生成** |
| `sceneContext` | | 场景上下文 |
| `targetDurationSeconds` | ✅ | 目标时长（10-600 秒） |
| `idempotencyKey` | | 幂等键 |

---

## 七、异步任务（1 个）

### 37. `GetAsyncTaskResult` — 统一查询异步任务
根据 `taskId` 自动识别并查询：解谜路线节点生成、解说词生成等异步任务进度和结果。`taskId` 省略时查询当前会话最近提交的异步任务。

| 参数 | 必填 | 说明 |
|---|---|---|
| `taskId` | | 异步任务 ID；不传时使用当前会话最近提交的任务 |

> 用户询问进度、结果、是否完成或失败原因时优先调用本工具。
