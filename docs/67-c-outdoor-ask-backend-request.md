# C 端户外「问一问」后端改动需求

## 背景

C 端（`apps/h5-client`）的「问一问」目前复用博物馆馆藏问答链路。户外行程页（`/ride`）也在用同一个入口，并在提问时带上当前路线与站点上下文：

```
【上下文】
routeId: <路线 id>
stageId: <站点 id>

【用户指令】
<用户问题>
```

实测这条链路在户外场景下**两种状态都不可用**：带上下文直接报错，不带上下文被拒答。下面记录证据与需要后端配合的部分。前端侧的语音播放改造已完成，不依赖这些改动。

## 实测证据

环境：开发后端 `http://127.0.0.1:8199/api`，游客身份。复现脚本见文末。

### 1. 带户外上下文 → HTTP 400

路线与站点 id 取自 C 端自己的接口（`/ClientCatalog/Catalog` + `/ClientCatalog/Route`），即截图里的「后海经典半日线 · 烟袋斜街」：

```
routeId: 610000000000001001
stageId: 610000000000003001
```

`POST /ExhibitChat/send` 返回：

```json
{"code":10001,"message":"上下文中的路线不存在或不属于当前博物馆"}
```

补充：`stageId` 缺失时前端会发占位符 `—`，这种请求返回的是另一条错误：

```json
{"code":10001,"message":"上下文中的路线或节点 ID 无效"}
```

也就是说占位符本身就会被判为非法节点 id。

### 2. 不带上下文 → 200，但拒答户外问题

`POST /ExhibitChat/send-with-audio`（无上下文）返回的第一句是：

```
抱歉，我只能解答当前博物馆馆藏文物相关问题。
你可以问我文物的年代、材质、工艺、故事或历史价值。
```

`sources` 事件下发的是馆藏文物条目（`exhibitId` / `name`），说明检索范围限定在文物。

### 3. 事件粒度（这条现状是好的，前端已经依赖）

同一接口实测的事件顺序：

```
720ms    sources
8047ms   audio.started {format: "mp3", encoding: "hex", sampleRate: 32000}
8047ms   text.delta   句1 22 字
8350ms   audio.delta  句1 结束：7 片 / 84141 字节 isFinal=true
8558ms   text.delta   句2 25 字
9038ms   audio.delta  句2 结束：7 片 / 106029 字节 isFinal=true
10710ms  audio.done / suggestions / done
```

结论：

- `text.delta` 每句一条，与以 `isFinal=true` 结尾的句子音频严格 1:1，前端据此按序号配对；
- `audio.delta` 没有 `index` 字段，同轮内靠到达顺序配对足够；
- **首句音频 8.0s 才出声**（含 LLM 与首句合成），是当前最大的体感问题。

## 需要后端改动

### A. 接受户外路线作为问一问上下文（阻断项）

`/ExhibitChat/send`、`/ExhibitChat/send-with-audio` 的上下文校验按「当前博物馆」限定，而户外路线属于 rickshaw 场景的目的地，不在该范围内。

期望二选一：

1. 上下文校验识别 routeId 的场景（rickshaw / museum），按对应目的地校验；或
2. 增加显式参数，例如 `scene: "rickshaw"` 或 `destinationId`，由前端在请求体里带上。

同时请明确 `stageId` 可选时的表示方式——建议允许整行省略，而不是让前端发 `—` 占位符（占位符会被判为非法 id）。

### B. 放开户外场景的回答范围与检索（阻断项）

system prompt 与 `sources` 检索都限定在馆藏文物。户外场景需要：

- system prompt 按场景切换（户外讲解 / 路线问答，而不是文物问答）；
- 检索范围扩到户外文化点（`/CulturalPlace/*`）与路线、站点讲解内容。

### C. 首句延迟（体验，纯调参）

首音 8s。demo 侧的切句策略是「首句只要 ≥8 字就允许在逗号处切开」，目的是尽快出声。如果生产侧切句参数可调，建议对齐；这不需要新接口。

### D. 真双工（本次不做，仅备忘）

`send-with-audio` 目前是「文字进、音频出」。前端已在**不上传音频**的前提下做到句子级无缝播放、逐句字幕跟读、以及播放期本地 VAD 的「说话即打断」。若后续要做真正的双工（语音上行 + ASR + 打断），需要新增音频上行接口，届时再单独立项。

## 前端已完成的适配（不需要后端配合）

- 句子级 WebAudio 排期播放：`playhead` 让后一句紧贴前一句，句间无 reload 空档，严格按句序释放。
- 逐句字幕跟读 + 句内进度条。
- 播放期「说话即打断」：只在有音频在播的窗口里用 AudioWorklet 取帧算 RMS，**音频不录制、不上传、不落盘**；判定开口即本地停播并 abort 本轮 SSE，气泡保留半截正文并标记「已被说话打断」。

## 复现脚本

| 脚本 | 用途 |
| --- | --- |
| `tmp/probe-sse-audio.mjs` | 观察 `send-with-audio` 的真实事件粒度与首音耗时 |
| `tmp/probe-ask-context-real.mjs` | 用真实户外 routeId / stageId 复现 400 |
| `tmp/probe-ask-context-scope.mjs` | 对比馆内 / 户外 id 作为上下文的结果 |

三个脚本都使用游客身份，只新建一个对话会话，不写其他业务数据。运行方式：

```powershell
node tmp/probe-ask-context-real.mjs http://127.0.0.1:8199/api 345536575083515904
```
