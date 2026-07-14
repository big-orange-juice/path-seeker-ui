# `/api/Chat/send` SSE 接口协议

## 1. 接口概述

`POST /api/Chat/send` 是后台管理员使用的 Agent Chat 流式接口，用于通过自然语言创建、编辑、预览和发布文旅路线。

该接口使用 SSE（Server-Sent Events）持续返回事件，不是普通的一次性 JSON 响应。一次请求通常会依次返回启动事件、文本增量、工具调用、UI 更新事件，最后以 `done` 或 `error` 结束。

接口地址：

```http
POST /api/Chat/send
```

响应类型：

```http
Content-Type: text/event-stream; charset=utf-8
```

## 2. 请求格式

### 2.1 请求头

```http
POST /api/Chat/send
Authorization: Bearer <admin-token>
Content-Type: application/json
Accept: text/event-stream
```

断线恢复时，可以传入最后收到的事件 ID：

```http
Last-Event-ID: 2076895560304037888
```

服务端会查询并回放该事件之后已经持久化的事件。

### 2.2 请求体

```json
{
  "sessionId": "2076894321939976192",
  "clientMessageId": "71d4949a-a05e-4a74-82ce-8057a22a83ed",
  "message": "我想创建一条关于宋朝的瓷器解说路线"
}
```

字段说明：

| 字段 | 类型 | 必填 | 约束 | 说明 |
|---|---|---:|---|---|
| `sessionId` | string | 是 | 有效长整型字符串 | Chat 会话 ID。使用字符串传输以避免 JavaScript 大整数精度丢失 |
| `clientMessageId` | string | 是 | 最大 64 字符 | 客户端消息幂等 ID。每条新消息必须使用新的 ID |
| `message` | string | 是 | 最大 20000 字符 | 用户输入内容 |

### 2.3 `clientMessageId` 幂等规则

服务端按以下字段判断是否为重复请求：

```text
sessionId + userId + clientMessageId
```

如果已经存在相同 `clientMessageId` 的 run，服务端不会再次执行 Agent，而是回放该 run 已持久化的事件，包括之前的失败事件。

因此：

- 网络重试且希望回放同一次执行时，继续使用原 `clientMessageId`。
- 用户主动重新执行一条失败消息时，必须生成新的 `clientMessageId`。
- 推荐使用 UUID，而不是简单的 `1`、`2`、`3`。

示例：

```javascript
const clientMessageId = crypto.randomUUID();
```

## 3. HTTP 响应头

成功建立流式响应后，服务端返回：

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache, no-transform
Connection: keep-alive
X-Accel-Buffering: no
```

`X-Accel-Buffering: no` 用于避免 Nginx 缓冲 SSE 数据。

## 4. SSE 原始格式

每一条事件都由以下内容组成：

```text
id: <eventId>
event: <type>
data: <ChatEventResponse JSON>

```

示例：

```text
id: 2076895560304037889
event: heartbeat
data: {"eventId":"2076895560304037889","sessionId":"2076894321939976192","runId":"352344449231228929","sequence":0,"type":"heartbeat","occurredAt":"2026-07-14T13:20:00.1234567+08:00","payload":{"status":"started"}}

```

注意：

- `id:` 与 JSON 中的 `eventId` 相同。
- `event:` 与 JSON 中的 `type` 相同。
- `data:` 是完整事件 JSON，需要执行一次 `JSON.parse()`。
- 每条 SSE 事件以一个空行结束。
- 整个 HTTP 响应不是 JSON 数组，没有统一的 `[` 和 `]`。
- 一次 run 最终以 `done` 或 `error` 结束。

## 5. 通用事件结构

所有 `data:` JSON 都符合以下顶层结构：

```json
{
  "eventId": "2076895560304037889",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 1,
  "type": "tool.call.start",
  "occurredAt": "2026-07-14T13:20:00.1234567+08:00",
  "payload": {}
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `eventId` | string | 事件唯一 ID，同时作为 SSE 的 `id:` |
| `sessionId` | string | 当前 Chat 会话 ID |
| `runId` | string | 本次用户消息对应的 Agent run ID |
| `sequence` | number | 当前 run 内的持久化事件顺序号 |
| `type` | string | 事件类型，与 SSE 的 `event:` 相同 |
| `occurredAt` | string | ISO 8601 时间，可能使用 UTC `Z` 或时区偏移 `+08:00` |
| `payload` | object / array / string / null | 事件业务数据，具体结构由 `type` 决定 |

所有 ID 都应按字符串处理，不要转换成 JavaScript `Number`。

## 6. `sequence` 与持久化规则

事件分为临时事件和持久化事件。

### 6.1 临时事件

以下事件不会写入 `chat_event`：

- `heartbeat`
- `text.delta`
- run 创建前产生的 `startup_error`

临时事件通常具有：

```json
{
  "sequence": 0
}
```

临时事件不会通过 `Last-Event-ID` 或重复 `clientMessageId` 回放。

### 6.2 持久化事件

以下事件会写入 `chat_event`：

- `tool.call.start`
- `tool.call.result`
- 所有 `ui.*` 事件
- `confirmation.required`
- run 创建后的 `error`
- `done`

持久化事件的 `sequence` 从 `1` 开始，在单个 run 内递增。

## 7. 事件类型总览

当前接口定义了 13 种事件类型：

| `type` | 是否持久化 | 是否终止 | 用途 |
|---|---:|---:|---|
| `heartbeat` | 否 | 否 | 通知客户端 run 已启动 |
| `text.delta` | 否 | 否 | Agent 文本流增量 |
| `tool.call.start` | 是 | 否 | Agent 开始调用工具 |
| `tool.call.result` | 是 | 否 | Agent 工具调用完成 |
| `ui.exhibit.selected` | 是 | 否 | 返回搜索或选择的文物 |
| `ui.route.list.updated` | 是 | 否 | 路线列表发生变化 |
| `ui.route.detail.updated` | 是 | 否 | 路线详情或预览发生变化 |
| `ui.route.stage.updated` | 是 | 否 | 路线节点发生变化 |
| `ui.route.build.progress` | 是 | 否 | `BuildStagesByAgent` 按文物生成节点的实时进度 |
| `ui.route.build.complete` | 是 | 否 | 路线构建或发布完成 |
| `confirmation.required` | 是 | 否 | 高风险操作需要管理员确认 |
| `done` | 是 | 是 | 本次 run 成功完成 |
| `error` | 通常是 | 是 | 本次 run 失败、取消或启动失败 |

## 8. 事件详细格式

### 8.1 `heartbeat`

表示服务端已经创建 run，并开始处理消息。

```json
{
  "eventId": "2076895560304037889",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 0,
  "type": "heartbeat",
  "occurredAt": "2026-07-14T13:20:00.1234567+08:00",
  "payload": {
    "status": "started"
  }
}
```

前端建议：

- 显示“正在思考”或加载状态。
- 不要依赖该事件进行断线恢复，因为它不会持久化。

### 8.2 `text.delta`

Agent 返回的文本增量。

```json
{
  "eventId": "2076895560304037890",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 0,
  "type": "text.delta",
  "occurredAt": "2026-07-14T13:20:01.1234567+08:00",
  "payload": {
    "content": "好的，我先为您搜索宋朝瓷器相关文物。"
  }
}
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.content` | string | 本次新增的文本片段，不是完整回复 |

前端需要累计文本：

```javascript
assistantText += payload.content;
```

### 8.3 `tool.call.start`

Agent 开始调用服务端工具。

```json
{
  "eventId": "2076895560304037891",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 1,
  "type": "tool.call.start",
  "occurredAt": "2026-07-14T13:20:02.1234567+08:00",
  "payload": {
    "toolName": "SearchExhibits",
    "callId": "call_abc123"
  }
}
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.toolName` | string | 工具名称 |
| `payload.callId` | string | 工具调用 ID，用于和结果事件对应 |

当前可能出现的工具名称：

```text
SearchExhibits
GetExhibitDetail
CreateRoute
ListRoutes
SelectRoute
AddStage
ListStages
UpdateStage
DeleteStage
BuildStagesByAgent
SelectGuide
GenerateNarration
SetNarrationStyle
PreviewRoute
PublishRoute
```

建议状态文案：

| 工具 | 建议文案 |
|---|---|
| `SearchExhibits` | 正在搜索文物 |
| `GetExhibitDetail` | 正在读取文物资料 |
| `CreateRoute` | 正在创建路线 |
| `BuildStagesByAgent` | 正在生成路线节点 |
| `GenerateNarration` | 正在生成解说词 |
| `PublishRoute` | 正在发布路线 |

### 8.4 `tool.call.result`

工具调用完成。

```json
{
  "eventId": "2076895560304037892",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 2,
  "type": "tool.call.result",
  "occurredAt": "2026-07-14T13:20:03.1234567+08:00",
  "payload": {
    "callId": "call_abc123",
    "result": {
      "routeId": "2076896000000000001"
    }
  }
}
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.callId` | string | 对应 `tool.call.start.payload.callId` |
| `payload.result` | any | 工具返回值，不同工具的结构不同 |

前端一般不需要直接展示完整 `result`，可以等待对应的 `ui.*` 事件刷新界面。

### 8.5 `ui.exhibit.selected`

返回 Agent 搜索或选中的文物。

#### 8.5.1 搜索结果（当前主路径）

`SearchExhibits` 完成后，payload 是带查询上下文的对象，文物列表在 `exhibits` 字段中。列表项主键为 **`exhibitId`**（string 雪花 ID），不是 `id`。

```json
{
  "eventId": "2076949126167269376",
  "sessionId": "2076949070928285696",
  "runId": "352397961222819840",
  "sequence": 3,
  "type": "ui.exhibit.selected",
  "occurredAt": "2026-07-14T08:37:14.1833963+00:00",
  "payload": {
    "query": "商周青铜器 礼乐",
    "count": 10,
    "exhibits": [
      {
        "exhibitId": "345602164888047616",
        "museumId": "345536575083515904",
        "exhibitCode": "CI00159776",
        "name": "豫角",
        "dynasty": "西周",
        "category": "铜器",
        "material": "铜",
        "description": "角是祼酒器……",
        "imageAttachmentId": "348548050307911680",
        "showcaseNo": null,
        "recommendedMinutes": null,
        "coreMemoryPoints": null,
        "historicalValue": null
      }
    ]
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.query` | string | 本次搜索关键词 |
| `payload.count` | number | 返回文物条数（通常等于 `exhibits.length`） |
| `payload.exhibits` | array | 文物列表 |
| `payload.exhibits[].exhibitId` | string | 文物主键，按字符串处理 |
| `payload.exhibits[].name` | string | 文物名称 |
| `payload.exhibits[].museumId` | string / null | 所属博物馆 ID |
| `payload.exhibits[].exhibitCode` | string / null | 馆藏编号 |
| `payload.exhibits[].dynasty` | string / null | 朝代 |
| `payload.exhibits[].category` | string / null | 类别 |
| `payload.exhibits[].material` | string / null | 材质 |
| `payload.exhibits[].description` | string / null | 简介 |
| `payload.exhibits[].imageAttachmentId` | string / null | 封面附件 ID |
| `payload.exhibits[].showcaseNo` | string / null | 展柜号 |
| `payload.exhibits[].recommendedMinutes` | number / null | 推荐停留分钟 |
| `payload.exhibits[].coreMemoryPoints` | string / null | 记忆点 JSON 字符串或 null |
| `payload.exhibits[].historicalValue` | string / null | 历史价值 JSON 字符串或 null |

前端解析与侧栏展示建议（与 web-admin 实现对齐）：

```javascript
// 1) 单项映射：主键优先 exhibitId，回退 id
function mapExhibitItem(item) {
  if (!item || typeof item !== "object") return null;
  const id = item.exhibitId ?? item.id;
  const name = item.name;
  const normalizedId = id != null && String(id).trim() ? String(id) : null;
  const normalizedName = name != null && String(name).trim() ? String(name) : null;
  if (!normalizedId && !normalizedName) return null;
  return {
    id: normalizedId,
    name: normalizedName,
    dynasty: item.dynasty != null ? String(item.dynasty) : null,
    category: item.category != null ? String(item.category) : null,
    exhibitCode: item.exhibitCode != null ? String(item.exhibitCode) : null,
  };
}

// 2) payload 归一：主路径 exhibits，兼容数组 / { exhibit } / 单对象
function normalizeExhibits(payload) {
  if (Array.isArray(payload)) {
    return payload.map(mapExhibitItem).filter(Boolean);
  }
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["exhibits", "items", "list", "data"]) {
    if (Array.isArray(payload[key])) {
      return payload[key].map(mapExhibitItem).filter(Boolean);
    }
  }

  if (payload.exhibit && typeof payload.exhibit === "object") {
    const one = mapExhibitItem(payload.exhibit);
    return one ? [one] : [];
  }

  const one = mapExhibitItem(payload);
  return one ? [one] : [];
}

// 3) 侧栏副标题：朝代 · 类别 · 馆藏编码
// Vue 模板必须使用双花括号插值，例如 {{ formatExhibitMeta(exhibit) }}
// 不要写成单层 { ... }，否则会把表达式原文渲染到页面上。
function formatExhibitMeta(exhibit) {
  return [exhibit.dynasty, exhibit.category, exhibit.exhibitCode]
    .filter(Boolean)
    .join(" · ");
}
```

侧栏卡片建议展示：

| 行 | 内容 |
|---|---|
| 标题 | `name`，缺省「未命名文物」 |
| 副标题 | `formatExhibitMeta` → `dynasty · category · exhibitCode`（全空则不渲染该行） |
| 编号 | `id`（来自 `exhibitId`） |

#### 8.5.2 单件文物详情

查询单件文物详情时，payload 可能是 `{ exhibit, archive }` 对象：

```json
{
  "type": "ui.exhibit.selected",
  "payload": {
    "exhibit": {
      "exhibitId": "10001",
      "id": "10001",
      "name": "宋代影青瓷碗"
    },
    "archive": {
      "summary": "该器物具有典型宋代影青瓷特征"
    }
  }
}
```

#### 8.5.3 兼容形态

前端需要兼容以下形态，避免只认文档早期示例导致右侧列表为空：

| 形态 | 说明 |
|---|---|
| `{ query, count, exhibits: [...] }` | **当前主路径**。列表项主键优先 `exhibitId`，可回退 `id` |
| `[{ id, name }, ...]` 或 `[{ exhibitId, name }, ...]` | 顶层直接为文物数组（历史/简化示例） |
| `{ exhibit, archive? }` | 单件详情 |
| 顶层单文物对象 | 含 `exhibitId`/`id` 与 `name` |

不要假设 `payload` 一定是数组；也不要只读 `item.id` 而忽略 `item.exhibitId`。

### 8.6 `ui.route.list.updated`

路线列表发生变化。目前主要在创建草稿路线后发出。

```json
{
  "eventId": "2076895560304037894",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 4,
  "type": "ui.route.list.updated",
  "occurredAt": "2026-07-14T13:20:05.1234567+08:00",
  "payload": {
    "routeId": "2076896000000000001",
    "routeName": "商周礼乐——青铜器探索路线"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.routeId` | string | 路线 ID，按字符串处理 |
| `payload.routeName` | string / null | 路线展示名称；web-admin 侧栏「当前路线」标题可直接使用 |

前端建议：

- 刷新路线列表；
- 将新路线设为当前路线；
- 有 `routeName` 时立即更新侧栏标题，不必等待 `ui.route.detail.updated`；
- 仍可按 `routeId` 请求路线详情补齐主题等字段。

### 8.6.1 `ui.route.build.progress`

`BuildStagesByAgent` 按文物逐个生成节点时实时发出。节点开始生成、单个节点成功/失败、整批完成时都会持久化并立即推送。

字段使用 `interactionType`（对齐 `route_stage.interaction_type`），不是 `gameplayType`。

```json
{
  "type": "ui.route.build.progress",
  "payload": {
    "routeId": "2076896000000000001",
    "currentIndex": 2,
    "totalCount": 4,
    "processedCount": 1,
    "createdCount": 1,
    "failedCount": 0,
    "exhibitId": "345536575083515905",
    "exhibitName": "大克鼎",
    "interactionType": 6,
    "status": "running",
    "message": "正在创建第 2 个节点，共 4 个"
  }
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.routeId` | string | 当前路线 ID |
| `payload.currentIndex` | number | 当前文物序号，从 1 开始 |
| `payload.totalCount` | number | **本次** `BuildStagesByAgent` 调用的文物总数 |
| `payload.createdCount` | number | 本次调用已新增的 `route_stage` 数量 |
| `payload.interactionType` | number | 运行时交互类型 |
| `payload.status` | string | `running` / `succeeded` / `failed` / `completed` |
| `payload.stageIds` | string[] / null | 仅成功事件可能返回 |
| `payload.message` | string | 可直接展示的中文进度文案 |

前端建议（web-admin）：

- 同一 `runId + routeId` 下可能有多批工具调用，侧栏进度应按批累计 `createdCount / totalCount`；
- 进度汇总只放右侧「生成结果」面板，对话区仅保留 tool tag；
- tool tag 按 `toolName` 合并，展示 `已添加路线节点 ×N`（N 为调用次数）。

### 8.7 `ui.route.detail.updated`

当前路线详情发生变化，或者 Agent 返回路线预览结果。

```json
{
  "eventId": "2076895560304037895",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 5,
  "type": "ui.route.detail.updated",
  "occurredAt": "2026-07-14T13:20:06.1234567+08:00",
  "payload": {
    "id": "2076896000000000001",
    "title": "宋韵瓷华——宋朝瓷器解说路线",
    "theme": "宋朝瓷器",
    "status": 0
  }
}
```

该 payload 来自路线详情或路线预览响应，具体字段可能随路线响应模型扩展。

### 8.8 `ui.route.stage.updated`

路线节点发生创建、更新、删除、批量生成、解说生成或风格更新。

创建、更新或删除节点：

```json
{
  "type": "ui.route.stage.updated",
  "payload": {
    "routeId": "2076896000000000001",
    "stageId": "2076896100000000001"
  }
}
```

生成解说词：

```json
{
  "type": "ui.route.stage.updated",
  "payload": {
    "stageId": "2076896100000000001"
  }
}
```

设置解说风格：

```json
{
  "type": "ui.route.stage.updated",
  "payload": {
    "stageId": "2076896100000000001",
    "config": {
      "guide_id": 10001,
      "user_style_input": "轻松、有宋代文化氛围",
      "scene_context": "游客站在龙泉窑青瓷瓶展柜前",
      "target_duration_seconds": 90
    }
  }
}
```

批量 Agent 构建节点时，payload 由批量构建服务的返回模型决定，可能包含路线 ID、新增节点数量、节点列表和构建摘要。

前端建议收到该事件后重新请求节点分页接口，不要依赖 payload 一定包含完整节点数据。

### 8.9 `ui.route.build.complete`

路线构建或发布完成。目前主要由 `PublishRoute` 发出。

```json
{
  "eventId": "2076895560304037897",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 7,
  "type": "ui.route.build.complete",
  "occurredAt": "2026-07-14T13:20:08.1234567+08:00",
  "payload": {
    "routeId": "2076896000000000001",
    "published": true
  }
}
```

前端建议：

- 刷新路线详情；
- 刷新路线状态；
- 展示发布成功提示。

### 8.10 `confirmation.required`

删除节点、发布路线等高风险操作需要管理员确认。

```json
{
  "eventId": "2076895560304037898",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 8,
  "type": "confirmation.required",
  "occurredAt": "2026-07-14T13:20:09.1234567+08:00",
  "payload": {
    "requiresConfirmation": true,
    "confirmationToken": "d4ab895c7eca4e36af9b7ee950f11890",
    "operation": "PublishRoute",
    "arguments": {
      "routeId": 2076896000000000001
    }
  }
}
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.requiresConfirmation` | boolean | 当前固定为 `true` |
| `payload.confirmationToken` | string | 确认令牌，当前有效期约 10 分钟 |
| `payload.operation` | string | 高风险操作对应的工具名称 |
| `payload.arguments` | object | 待确认操作参数 |

当前可能需要确认的操作：

```text
DeleteStage
PublishRoute
```

前端收到事件后应保存 `confirmationToken`、`operation` 和 `arguments`，并显示确认弹窗。

### 8.11 `done`

本次 run 成功完成，是成功流的终止事件。

```json
{
  "eventId": "2076895560304037899",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 9,
  "type": "done",
  "occurredAt": "2026-07-14T13:20:10.1234567+08:00",
  "payload": {
    "assistantMessageId": "2076896200000000001",
    "routeId": "2076896000000000001",
    "routeVersion": null
  }
}
```

字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `payload.assistantMessageId` | string | 已落库的 assistant 消息 ID |
| `payload.routeId` | string / null | 本轮结束时当前选中的路线 ID |
| `payload.routeVersion` | number / null | 路线版本预留字段，当前实现返回 `null` |

收到 `done` 后，前端应：

1. 停止加载动画；
2. 将累计文本标记为完成；
3. 刷新会话历史；
4. 刷新当前路线和节点；
5. 结束本次 SSE 读取。

### 8.12 `error`

本次 run 失败、取消或启动失败，是失败流的终止事件。

Agent 执行错误：

```json
{
  "eventId": "2076895560304037900",
  "sessionId": "2076894321939976192",
  "runId": "352344449231228929",
  "sequence": 1,
  "type": "error",
  "occurredAt": "2026-07-14T13:20:11.1234567+08:00",
  "payload": {
    "code": "agent_error",
    "message": "Agent 执行失败的具体错误"
  }
}
```

客户端取消或连接断开：

```json
{
  "type": "error",
  "payload": {
    "code": "cancelled",
    "message": "运行已取消"
  }
}
```

run 创建前启动失败：

```json
{
  "eventId": "2076895560304037901",
  "sessionId": "2076894321939976192",
  "runId": "0",
  "sequence": 0,
  "type": "error",
  "occurredAt": "2026-07-14T13:20:12.1234567+08:00",
  "payload": {
    "code": "startup_error",
    "message": "启动失败原因"
  }
}
```

当前错误码：

| `payload.code` | 含义 |
|---|---|
| `agent_error` | Agent、模型、工具或历史消息处理过程中发生异常 |
| `cancelled` | 客户端断开、请求取消或 CancellationToken 被触发 |
| `startup_error` | run 和 assistant 占位消息创建前发生异常 |

收到 `error` 后，前端应：

- 停止加载状态；
- 将消息标记为失败；
- 显示 `payload.message`；
- 不再等待 `done`；
- 用户主动重试时生成新的 `clientMessageId`。

## 9. 一次完整成功流示例

创建宋朝瓷器路线时，事件顺序可能是：

```text
heartbeat
text.delta
tool.call.start          SearchExhibits
tool.call.result
ui.exhibit.selected
text.delta
tool.call.start          CreateRoute
tool.call.result
ui.route.list.updated
tool.call.start          AddStage
tool.call.result
ui.route.stage.updated
text.delta
done
```

简化后的原始 SSE：

```text
id: 1001
event: heartbeat
data: {"eventId":"1001","sessionId":"2001","runId":"3001","sequence":0,"type":"heartbeat","occurredAt":"2026-07-14T13:20:00+08:00","payload":{"status":"started"}}

id: 1002
event: text.delta
data: {"eventId":"1002","sessionId":"2001","runId":"3001","sequence":0,"type":"text.delta","occurredAt":"2026-07-14T13:20:01+08:00","payload":{"content":"我先搜索宋朝瓷器相关文物。"}}

id: 1003
event: tool.call.start
data: {"eventId":"1003","sessionId":"2001","runId":"3001","sequence":1,"type":"tool.call.start","occurredAt":"2026-07-14T13:20:02+08:00","payload":{"toolName":"SearchExhibits","callId":"call_1"}}

id: 1004
event: tool.call.result
data: {"eventId":"1004","sessionId":"2001","runId":"3001","sequence":2,"type":"tool.call.result","occurredAt":"2026-07-14T13:20:03+08:00","payload":{"callId":"call_1","result":{"total":5}}}

id: 1005
event: ui.exhibit.selected
data: {"eventId":"1005","sessionId":"2001","runId":"3001","sequence":3,"type":"ui.exhibit.selected","occurredAt":"2026-07-14T13:20:03+08:00","payload":{"query":"宋朝瓷器","count":1,"exhibits":[{"exhibitId":"5001","name":"宋代青瓷碗","dynasty":"宋","category":"瓷器"}]}}

id: 1006
event: done
data: {"eventId":"1006","sessionId":"2001","runId":"3001","sequence":4,"type":"done","occurredAt":"2026-07-14T13:20:10+08:00","payload":{"assistantMessageId":"6001","routeId":"7001","routeVersion":null}}

```

## 10. 失败流示例

```text
heartbeat
text.delta
tool.call.start
tool.call.result
error
```

或者在 Agent 产生任何输出前失败：

```text
heartbeat
error
```

如果 `error.sequence` 为 `1`，表示该错误是本次 run 的第一条持久化事件，不代表一定没有发送过临时 `heartbeat`。

## 11. 前端接入建议

浏览器原生 `EventSource` 只支持 GET，不适合该 POST 接口。建议使用 `fetch` 读取响应流，并配合 SSE parser 解析事件。

请求示例：

```javascript
const response = await fetch("/api/Chat/send", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "text/event-stream"
  },
  body: JSON.stringify({
    sessionId,
    clientMessageId: crypto.randomUUID(),
    message
  })
});

if (!response.ok) {
  throw new Error(`HTTP ${response.status}`);
}

// 使用 SSE parser 逐块解析 response.body。
```

事件处理示例：

```javascript
function handleChatEvent(sseEvent) {
  const event = JSON.parse(sseEvent.data);
  let payload = event.payload;

  // 兼容旧数据库回放出来的双重序列化 payload。
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      // 非 JSON 字符串保持原值。
    }
  }

  switch (event.type) {
    case "heartbeat":
      setLoading(true);
      break;

    case "text.delta":
      appendAssistantText(payload.content);
      break;

    case "tool.call.start":
      showToolStatus(payload.toolName, payload.callId);
      break;

    case "tool.call.result":
      completeToolStatus(payload.callId);
      break;

    case "ui.exhibit.selected":
      // payload 主路径：{ query, count, exhibits:[{ exhibitId, name, dynasty, category, exhibitCode, ... }] }
      // 兼容：顶层数组 / { exhibit, archive } / 单对象；主键优先 exhibitId。
      // 侧栏：normalizeExhibits(payload) + formatExhibitMeta(exhibit)
      updateExhibits(normalizeExhibits(payload));
      break;

    case "ui.route.list.updated":
      // payload: { routeId, routeName? }
      refreshRouteList();
      setCurrentRoute(payload.routeId, payload.routeName);
      break;

    case "ui.route.detail.updated":
      updateRouteDetail(payload);
      break;

    case "ui.route.stage.updated":
      refreshRouteStages(payload.routeId);
      break;

    case "ui.route.build.progress":
      // 侧栏累计进度；勿在对话流底部重复展示大卡片
      updateBuildProgress(payload);
      break;

    case "ui.route.build.complete":
      refreshRouteDetail(payload.routeId);
      break;

    case "confirmation.required":
      showConfirmationDialog(payload);
      break;

    case "done":
      setLoading(false);
      refreshHistory();
      break;

    case "error":
      setLoading(false);
      showError(payload.message);
      break;
  }
}
```

## 12. 旧数据 payload 兼容

标准事件中，`payload` 应当直接是对象或数组：

```json
{
  "payload": {
    "code": "agent_error",
    "message": "错误信息"
  }
}
```

旧的持久化事件可能回放成 JSON 字符串：

```json
{
  "payload": "{\"code\":\"agent_error\",\"message\":\"错误信息\"}"
}
```

在旧数据清理完成前，前端应对字符串类型的 `payload` 尝试再执行一次安全的 `JSON.parse()`。

## 13. 断线恢复与事件回放限制

使用 `Last-Event-ID` 或相同 `clientMessageId` 回放时，只能恢复持久化事件。

可以恢复：

- 工具调用开始和结果；
- UI 更新事件；
- 确认事件；
- `done`；
- run 创建后的 `error`。

不能恢复：

- `heartbeat`；
- `text.delta`；
- run 创建前的临时错误。

由于 `text.delta` 不持久化，断线后需要通过会话历史接口获取完整 assistant 文本：

```http
GET /api/Chat/history?sessionId=<sessionId>
```

## 14. 客户端状态机建议

客户端可以按以下状态管理一次 run：

```text
idle
  -> heartbeat
running
  -> text.delta / tool.call.* / ui.* / confirmation.required
running
  -> done
completed

running
  -> error
failed
```

终止规则：

- 收到 `done`：成功终止，不再等待其他事件。
- 收到 `error`：失败终止，不再等待 `done`。
- HTTP 连接断开但未收到终止事件：状态标记为未知，可使用 `Last-Event-ID` 或历史接口恢复。

