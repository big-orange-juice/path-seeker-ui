# C 端馆藏文物多轮问答 API

> 对应实现：`ExhibitChatController`  
> 会话场景：`exhibit_qa`  
> 当前固定博物馆 ID：`345536575083515904`  
> 鉴权：全部接口要求 C 端 Bearer JWT

## 1. 创建会话

```http
POST /api/ExhibitChat/sessions
Authorization: Bearer <c-user-token>
Content-Type: application/json

{"title":"青铜器问答"}
```

前端不传 `museumId`。服务端从 `ExhibitChat:MuseumId` 读取固定馆别，并把它写入会话。

成功响应：

```json
{
  "code": 0,
  "message": "会话已创建",
  "data": {
    "id": "2076894321939976192",
    "museumId": "345536575083515904",
    "title": "青铜器问答",
    "messageCount": 0,
    "lastActiveAt": "2026-07-18T20:00:00+08:00",
    "status": 1
  }
}
```

## 2. 会话列表与历史

```http
GET /api/ExhibitChat/sessions
Authorization: Bearer <c-user-token>
```

只返回当前用户、`exhibit_qa` 场景、固定博物馆且状态为活动的会话。

```http
GET /api/ExhibitChat/history?sessionId=2076894321939976192
Authorization: Bearer <c-user-token>
```

助手消息的 `sources` 直接返回图片 URL：

```json
{
  "id": "2076894321939976194",
  "runId": "2076894321939976193",
  "sequenceNo": 2,
  "role": "assistant",
  "content": "大克鼎是西周晚期青铜礼器……【大克鼎】",
  "status": 1,
  "sources": [
    {
      "exhibitId": "345536575083515999",
      "name": "大克鼎",
      "formalName": "西周大克鼎",
      "imageUrl": "https://cdn.example.invalid/exhibits/dakedings.jpg"
    }
  ],
  "locations": [],
  "createdAt": "2026-07-18T20:01:00+08:00"
}
```

当助手回答涉及文物陈列位置时，`locations` 返回该次回答使用的位置快照，结构与 `exhibit.location` 事件中的 `payload.items` 相同。历史接口直接读取消息快照，不会因后续地图点位调整而改变旧消息内容。

## 3. 发送消息

```http
POST /api/ExhibitChat/send
Authorization: Bearer <c-user-token>
Accept: text/event-stream
Content-Type: application/json
Last-Event-ID: <optional-event-id>

{
  "sessionId": "2076894321939976192",
  "clientMessageId": "b44aab81-f24e-4bcd-9c09-7cc8951c968c",
  "message": "大克鼎上的铭文讲了什么？"
}
```

约束：

| 字段 | 约束 |
|---|---|
| `sessionId` | 必填，当前用户拥有的活动 C 端问答会话 |
| `clientMessageId` | 必填，最大 64 字符；推荐 UUID |
| `message` | 必填，最大 2000 字符 |

幂等范围为 `sessionId + userId + clientMessageId`。重复提交不会再次调用模型，只回放该 run 已持久化的事件。

## 4. SSE 事件

每条事件格式：

```text
id: <eventId>
event: <type>
data: <ExhibitChatEventResponse JSON>

```

### 4.1 `heartbeat`

```text
event: heartbeat
data: {"type":"heartbeat","payload":{"status":"started"}}
```

表示 run 已创建。该事件不持久化。

### 4.2 `sources`

```text
event: sources
data: {
  "type":"sources",
  "payload":{
    "items":[
      {
        "exhibitId":"345536575083515999",
        "name":"大克鼎",
        "formalName":"西周大克鼎",
        "imageUrl":"https://cdn.example.invalid/exhibits/dakedings.jpg"
      }
    ]
  }
}
```

该事件已持久化。客户端可以先显示来源卡片，再消费文本增量。

位置问题会在 `sources` 之后、`text.delta` 之前额外发送 `exhibit.location`。普通文物知识问题不发送该事件。

### 4.3 `exhibit.location`

```text
event: exhibit.location
data: {
  "type":"exhibit.location",
  "payload":{
    "intent":"exhibit_location",
    "items":[
      {
        "exhibitId":"345536575083515999",
        "exhibitName":"大克鼎",
        "showcaseNo":"青铜器-01",
        "status":"located",
        "gallery":{
          "galleryId":"345536575083515920",
          "galleryName":"中国古代青铜馆",
          "floorId":"345536575083515910",
          "floorName":"一楼",
          "floorLevel":1
        },
        "maps":[
          {
            "mapId":"2076894321939976200",
            "mapImageUrl":"https://cdn.example.invalid/gallery-map/bronze.jpg",
            "imageWidth":1920,
            "imageHeight":1080,
            "coordinateType":1,
            "contentHash":"sha256:example",
            "points":[
              {
                "pointId":"2076894321939976201",
                "title":"大克鼎",
                "xPercent":42.35,
                "yPercent":61.20
              }
            ]
          }
        ]
      }
    ]
  }
}
```

该事件持久化。所有 ID 均为字符串；点位坐标为相对于底图宽高的百分比，前端使用 `left: xPercent%`、`top: yPercent%` 定位。`contentHash` 可用于判断底图版本是否变化。

位置状态：

| `status` | 含义 | 前端建议 |
|---|---|---|
| `located` | 有且只有一个有效地图点位 | 展示展厅、楼层、底图和点位 |
| `multiple_locations` | 存在多个有效地图点位 | 展示全部点位，不自行选取一个 |
| `gallery_only` | 已绑定展厅且存在地图，但未标注点位 | 展示展厅/楼层，提示暂无地图点位 |
| `map_unavailable` | 已绑定展厅，但展厅地图未录入 | 展示展厅/楼层/展柜号，不展示地图 |
| `unbound` | 文物尚未绑定有效展厅 | 提示陈列位置暂未录入 |

文物位置由服务端数据库查询生成，不由模型推断。纯位置问题直接使用服务端固定回答；“介绍大克鼎，它在哪里”这类混合问题才会把可信位置快照与馆藏资料一起交给模型组织语言。

正常位置问答事件顺序：

```text
heartbeat -> sources -> exhibit.location -> text.delta -> suggestions -> done
```

### 4.4 `text.delta`

```text
event: text.delta
data: {"type":"text.delta","payload":{"content":"大克鼎是西周晚期"}}
```

回答文本在服务端完成边界审查后按块发送。纯位置问题由服务端生成，混合知识问题由模型生成。文本增量本身不持久化，最终完整文本保存在历史消息中。

### 4.5 `suggestions`

```text
event: suggestions
data: {
  "type":"suggestions",
  "payload":{
    "items":[
      "这件文物最初有什么用途？",
      "它的纹饰有什么特点？",
      "还有哪些相关文物？"
    ]
  }
}
```

`suggestions` 是持久化的非终态事件，也是正常结束时 `done` 之前的最后一种事件。`items` 在生成成功时包含 2-4 条可直接作为下一条用户消息发送的问题；建议生成失败或内容过滤时返回空数组，客户端应隐藏建议区域。

### 4.6 `done`

```text
event: done
data: {
  "type":"done",
  "payload":{
    "assistantMessageId":"2076894321939976194",
    "sourceCount":1,
    "locationCount":1,
    "hasLocation":true,
    "refused":false
  }
}
```

`done` 是持久化终态事件。收到后客户端应结束 loading，并可按需重新拉取历史消息。

`locationCount` 是位置结果项数量；`hasLocation` 仅表示至少存在一个可绘制的地图点位。`gallery_only`、`map_unavailable` 和 `unbound` 的 `hasLocation` 均为 `false`。

### 4.7 `error`

```text
event: error
data: {
  "type":"error",
  "payload":{
    "code":"exhibit_chat_error",
    "message":"文物问答服务暂时不可用，请稍后重试"
  }
}
```

客户端不得展示供应商或内部异常，因为服务端不会透传这些信息。

## 5. 断线与重试

1. 同一次逻辑消息重试时继续使用原 `clientMessageId`。
2. 携带最后收到的 `Last-Event-ID`，服务端先回放其后的持久化事件。
3. `text.delta` 不回放；若重连时直接收到 `done`，客户端通过历史接口取得完整答案。
4. 用户主动重新提问时必须生成新的 `clientMessageId`。
5. 同一会话一次只允许一个运行任务，并发发送返回 HTTP 409。

## 6. 归档

```http
POST /api/ExhibitChat/archive
Authorization: Bearer <c-user-token>
Content-Type: application/json

{"id":"2076894321939976192"}
```

归档为逻辑状态变更，不物理删除消息和事件。归档会话不出现在默认列表中，仍可读取本人历史，但不能继续发送消息。

## 7. 固定拒答

文物静态陈列位置支持查询；设施位置、用户当前位置、路线或运营问题不会查询相关数据，也不会进入回答模型：

```text
抱歉，我只解答本馆馆藏文物及其已录入陈列位置的相关问题，暂不提供设施、路线或开放运营信息。
```

资料不足时不引用外部百科：

```text
目前馆藏资料中没有足够信息支持这个结论，我不能据此推测。
```
