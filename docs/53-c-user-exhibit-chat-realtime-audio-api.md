# C 端文物问答实时语音 API

## 1. 接口

```http
POST /api/ExhibitChat/send-with-audio
Authorization: Bearer <c-user-token>
Accept: text/event-stream
Content-Type: application/json
Last-Event-ID: <optional-event-id>

{
  "sessionId": "2076894321939976192",
  "clientMessageId": "b44aab81-f24e-4bcd-9c09-7cc8951c968c",
  "message": "大克鼎上的铭文讲了什么？",
  "enableAudio": true,
  "voiceId": "male-qn-qingse"
}
```

参数：

| 字段 | 必填 | 说明 |
|---|---:|---|
| `sessionId` | 是 | 当前用户拥有的活动 C 端会话 ID。 |
| `clientMessageId` | 是 | 本轮消息幂等键，最大 64 个字符。 |
| `message` | 是 | 用户问题，最大 2000 个字符。 |
| `enableAudio` | 是 | `true` 时同时返回 MiniMax 合成音频；`false` 时行为与原文字接口一致。 |
| `voiceId` | 条件必填 | `enableAudio=true` 时必须提供，支持系统音色或当前 MiniMax 账号有权使用的音色。 |

该接口沿用原 `/api/ExhibitChat/send` 的会话归属、并发锁、消息幂等、来源、建议和终态规则。原接口保持不变。

## 2. 返回事件

原有事件继续返回：

- `heartbeat`
- `sources`
- `text.delta`
- `suggestions`
- `done`
- `error`

开启音频后额外返回以下瞬态事件。音频事件不写入聊天事件回放表。

### 2.1 `audio.started`

第一段音频可用时发送：

```text
event: audio.started
data: {
  "type": "audio.started",
  "payload": {
    "voiceId": "male-qn-qingse",
    "format": "mp3",
    "encoding": "hex",
    "sampleRate": 32000
  }
}
```

### 2.2 `audio.delta`

```text
event: audio.delta
data: {
  "type": "audio.delta",
  "payload": {
    "audio": "fff3...",
    "encoding": "hex",
    "format": "mp3",
    "sampleRate": 32000,
    "durationMs": 1240,
    "isFinal": true
  }
}
```

`audio` 是 MiniMax HTTP 流式接口返回的十六进制音频数据。前端必须按事件顺序解码和入队，不得按网络请求完成顺序重排。终态事件可能只用于标记当前短句结束，此时 `audio` 可以是空字符串。

`isFinal=true` 表示当前送入 MiniMax 的一个可朗读短句已经合成完毕，不代表整条 AI 回复已经结束。

### 2.3 `audio.done`

```text
event: audio.done
data: {
  "type": "audio.done",
  "payload": {
    "voiceId": "male-qn-qingse"
  }
}
```

表示本轮所有语音分片均已从 MiniMax 返回。随后服务端发送原有 `done` 总终态。

### 2.4 `audio.error`

```text
event: audio.error
data: {
  "type": "audio.error",
  "payload": {
    "code": "audio_synthesis_failed",
    "message": "语音合成暂时不可用，文字回答不受影响"
  }
}
```

MiniMax 连接、音色权限或合成失败时发送。文字问答继续运行，最终仍会收到 `done` 或聊天自身的 `error`。

## 3. 事件顺序

开启音频时，文字和音频按可朗读短句锁步生产，典型顺序如下：

```text
heartbeat
sources
audio.started
text.delta
audio.delta
text.delta
audio.delta
suggestions
audio.done
done
```

服务端不会直接透传 LLM 的原始 token。它先按完整标点、短语标点和最大长度把增量切成可朗读短句，再为当前短句调用 MiniMax HTTP 流式合成接口。只有收到当前短句的首个 MiniMax 响应后，服务端才发送该短句的 `text.delta`，随后顺序发送对应的 `audio.delta`。当前短句以 `isFinal=true` 结束后，才处理下一短句。`suggestions`、`audio.done` 和 `done` 均在所有短句处理完成后返回。

当 `enableAudio=false` 时不启用上述等待逻辑，原始文字仍按现有 LLM 流实时返回。

## 4. 前端十六进制解码

```javascript
function hexToUint8Array(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}
```

前端需要维护一个串行播放队列。收到 `audio.delta` 后，将解码出的字节按顺序追加到当前 MP3 数据流或当前短句缓冲；当 `isFinal=true` 时提交该短句播放。不能为每个网络分片直接创建一个新的 `Audio` 元素，否则容易产生间隙或解码失败。

由于接口使用 POST，浏览器原生 `EventSource` 不能直接调用，应使用 `fetch` 读取 `response.body` 并解析 SSE，或使用现有项目的 POST SSE 客户端。

## 5. 配置

```json
{
  "MiniMax": {
    "BaseUrl": "https://api.minimaxi.com",
    "SynthesisPath": "/v1/t2a_v2",
    "RealtimeModel": "speech-2.8-turbo",
    "RealtimeAudioFormat": "mp3",
    "RealtimeSampleRate": 32000,
    "RealtimeBitrate": 128000
  }
}
```

生产环境通过 `MINIMAX_API_KEY` 注入密钥。服务端使用 `Authorization: Bearer <key>` 调用 MiniMax HTTP 接口，不会把供应商密钥返回给 C 端。

## 6. 当前边界

- 本接口解决的是“文本问题输入，文字与语音同时流式返回”。
- 当前没有增加麦克风音频上行、ASR、VAD、AEC 或用户开口自动打断。
- 客户端断开 SSE 会取消当前 LLM 和正在进行的 MiniMax HTTP 请求。
- 音频事件为瞬态事件，断线重连只回放持久化文字终态，不重新合成已完成音频。
- `clientMessageId` 重复请求不会重复调用模型；已完成 run 的回放不包含历史音频。

## 7. MiniMax 协议

实现采用 MiniMax 同步语音合成 HTTP：

1. 对每个可朗读短句调用 `POST https://api.minimaxi.com/v1/t2a_v2`。
2. 请求设置 `stream=true`、`output_format=hex`、音频格式为 `mp3`。
3. 请求设置 `stream_options.exclude_aggregated_audio=true`，避免最后一个事件重复返回完整音频。
4. 按 `text/event-stream` 逐行读取响应并立即转发 `data.audio`。
5. `data.status=1` 表示合成中，`data.status=2` 表示当前短句合成结束。

官方文档：

- https://platform.minimaxi.com/docs/api-reference/speech-t2a-http
