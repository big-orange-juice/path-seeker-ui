# 翻译房间：收音与 ASR 修改清单

本文只列改动，不含排期。范围是「实时翻译-讲解房间」的房主采音、服务端切段与提交、ASR 调用、译音播放四条链路；游客侧问答、路线讲解不在范围内。

后端代码位于 `D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System`，前端代码位于本仓库。共用组件（切段器、提交器、TTS 格式）会同时影响 `/ExhibitChat/translate-realtime` 和其他语音入口，改前先确认影响面，见第 11 节。

## 1. 服务端：切段

`CulturalTourismSystem.Service/Chat/PcmSpeechSegmenter.cs`

- [ ] `PcmSpeechSegmenter.cs:32` 的固定阈值 `Math.Sqrt(energy / 320) < 400` 改为噪声底跟踪 + 双门限：
  - `_noise` 初值 120，仅在非语音帧更新：`_noise = _noise * 0.99 + rms * 0.01`；
  - 进入语音：`rms > Math.Max(280, _noise * 2.4)` 连续 2 帧；
  - 退出语音：`rms < Math.Max(200, _noise * 1.3)` 连续 20 帧。
- [ ] 加 240ms 预卷：保留最近 12 个 20ms 帧，首次判为语音时先把预卷写入 `_speech`，再写当前帧。现在 `PcmSpeechSegmenter.cs:34` 直接丢掉起始前的静音帧，起音会被削掉。
- [ ] 静音收段从 30 帧改为 20 帧（600ms → 400ms）。
- [ ] 最大段从 `128000` 字节改为 `96000` 字节（4s → 3s）。
- [ ] 强制切点不再固定切在第 3 秒：保留最近 15 帧（300ms）的 RMS，在窗口内取最低点切。
- [ ] 强制切时保留尾部 300ms（9600 字节）作为下一段开头，`SpeechAudioSegment` 增加 `bool HasOverlap`。
- [ ] 静音收段时只保留尾部 8 帧（160ms）静音，其余裁掉再送 ASR，减少尾静音导致的标点/幻觉。
- [ ] 最短段过滤：VAD 或上限产生的段小于 300ms（9600 字节）直接丢弃；`Flush()` 保持现状，短尾不丢。
- [ ] `SpeechAudioSegment` 增加 `StartSample`、`EndSample`、`Reason`（`silence` / `max_length` / `flush`），供去重和 gap 判断。
- [ ] 把帧长、静音帧数、最大段、预卷、重叠、最短段集中成常量，不再散落 `128000`、`30`、`400`。

建议常量：

```text
FrameBytes        = 640      // 20ms @ 16k mono s16le
SilenceFrames     = 20       // 400ms
MaxSegmentBytes   = 96000    // 3s
PrerollFrames     = 12       // 240ms
OverlapBytes      = 9600     // 300ms
MinSegmentBytes   = 9600     // 300ms
TailSilenceFrames = 8        // 160ms
```

## 2. 服务端：提交

`CulturalTourismSystem.Service/Chat/TranslationCommitter.cs`

- [ ] 构造函数增加源语言参数；拼接按语言处理：`zh`、`ja` 不加空格，其余加空格。`TranslationCommitter.cs:73` 现在无条件 `pending + " " + text`，中文专名被切开会翻错。
- [ ] 句末标点 + 停顿直接提交，不调 detector：

  ```csharp
  if (transcript.EndsWithPause && EndsWithTerminal(pending))
      // 直接 yield，reason = "punctuation"
  ```

  终止符取 `。！？!?；;`。
- [ ] `maxWait` 从 8s 改为 3s（`TranslationCommitter.cs:20`）。
- [ ] detector 单次预算从 2s 改为 600ms（`TranslationCommitter.cs:79-80`）。
- [ ] `duration >= 8` 兜底改为 6s；1800 字符上限保留（`TranslationCommitter.cs:91`）。
- [ ] 入口去重：新 transcript 开头与 `pending` 尾部做最长公共前后缀匹配时截掉，只对 `HasOverlap` 段生效；拉丁语系 ≥4 字符，CJK ≥2 字符。
- [ ] `TranslationCommit.Reason` 增加 `punctuation`；提交日志带 `waitMs`、`pendingChars`。
- [ ] `Split()` 保持不变。

## 3. 服务端：房间调度

`CulturalTourismSystem.Service/Chat/TranslationRoomService.cs`

- [ ] `audio` 通道从 30 改为 10，并设 `BoundedChannelFullMode.DropOldest`；满时丢最旧，不再 `throw` 把房间打死（`TranslationRoomService.cs:246-253`）。
- [ ] 用 `SpeechAudioSegment.StartSample/EndSample` 检查连续性，跳变时向 `transcripts` 写 `IsGap = true`，避免跨缺失音频拼句。
- [ ] ASR 调用加重试：429 / 5xx 重试 2 次，退避 300ms、800ms；最终失败仍写 `IsGap`（`TranslationRoomService.cs:307`）。
- [ ] `TranslateAsync` 中 `TranslationRoomService.cs:395` 的 `HostAsync` 改为缓存：`TranslationRoomState` 增加 `HostCheckedAt`，60 秒内不重复查库；维护循环仍每 15 秒校验。
- [ ] `SaveTextAsync`（`TranslationRoomService.cs:528`）改为串行后台写队列，不阻塞 `CommitAsync` 处理下一段。
- [ ] 增加阶段耗时日志：段时长、ASR ms、提交等待 ms、翻译首 token、TTS 首包、队列深度、丢弃段数。
- [ ] 丢弃段时下发 `segment.dropped`，让客户端提示「已跳过一段」，不要只留静默。
- [ ] `language.error` 的 `skippedSequence` 保留；队列满时记录后继续下一段。

`CulturalTourismSystem.Service/Chat/TranslationRoomState.cs`

- [ ] 增加 `HostCheckedAt`、`DroppedSegments`（`TranslationRoomState.cs:56`）。
- [ ] `TranslationRoomLanguage` 增加 `InFlight = new SemaphoreSlim(2)`：同语言允许 2 个在生成、按序下发。先留字段，不启用也可以（`TranslationRoomState.cs:36-41`）。

## 4. 服务端：模型调用

`CulturalTourismSystem.Service/Chat/RealtimeTranslationAgent.cs`

- [ ] `CreateClient()`（`RealtimeTranslationAgent.cs:34`）每次 new 一个 `ChatClient`，改为字段缓存，或直接注入现成的单例 `IChatClient`；不要每段新建连接。
- [ ] 判边界的 `ChatOptions` 增加 `Temperature = 0`、`MaxOutputTokens = 200`；翻译流保持现状。
- [ ] 判边界仍只返回逐字前缀，不改写、不解释。

`CulturalTourismSystem.Service/Chat/MiniMaxSpeechToTextClient.cs`

- [ ] 解析响应里的 `duration`，返回给调用方，用于「时长/字数比」异常过滤（`MiniMaxSpeechToTextClient.cs:48-63`）。
- [ ] 单次请求加 30 秒超时（`CancellationTokenSource.CreateLinkedTokenSource`），不要只依赖房间生命周期。
- [ ] `stream=false` 保持。MiniMax 的 `stream=true` 是整段文件边算边推，不是连续识别，先不要接。

`CulturalTourismSystem.Service/Chat/MiniMaxStreamingTtsClient.cs`

- [ ] 不默认改 `RealtimeAudioFormat`。改 PCM 会同时影响支付宝播放层（只吃 mp3 文件）和所有语音入口；要做就另开一项，客户端一起改（`MiniMaxStreamingTtsClient.cs:120-130`、`:229-231`）。

## 5. H5：采音

[demos/duplex-translation/public/mic.js](../demos/duplex-translation/public/mic.js)

- [ ] 采集用独立的 16k 上下文：`new AudioContext({ sampleRate: 16000, latencyHint: 'interactive' })`；`sampleRate !== 16000` 时走低通 + 重采样。
- [ ] 约束增加 `sampleRate: { ideal: 16000 }`、`channelCount: { ideal: 1 }`、`latency: { ideal: 0.02 }`；AEC / NS / AGC 保留，真机再 A/B（`mic.js:2-4`）。
- [ ] `source -> highpass(80Hz, Q=0.7) -> worklet`，去掉低频轰鸣和手持噪声。
- [ ] 处理 `track.onended`、`navigator.mediaDevices.ondevicechange`，返回给调用方一个 `onEnded` 回调。
- [ ] `stop()` 里先 `port.postMessage('stop')`，等 worklet 回 `stopped` 后再 `release()`；保留 500ms 超时兜底。

[demos/duplex-translation/public/capture.worklet.js](../demos/duplex-translation/public/capture.worklet.js)

- [ ] 不再每 128 样本 `postMessage`；按 `Math.round(sampleRate * 0.02)` 聚合 20ms，用 transferable 发送：

  ```js
  this.port.postMessage({ frame: buffer }, [buffer.buffer])
  ```

- [ ] 增加丢帧计数（主线程处理不过来时），随帧上报。
- [ ] 输出通道继续清零。

[demos/duplex-translation/public/pcm.js](../demos/duplex-translation/public/pcm.js)

- [ ] `inputRate === 16000` 走直通快路径，不做插值。
- [ ] 降采样回退路径加二阶低通（截止 7.2kHz）再抽取，避免 48k → 16k 混叠。
- [ ] 复用 `packet` / `previous` 缓冲，不要每帧新建 `Float32Array`。

[apps/h5-client/src/composables/useTranslationRoom.ts](../apps/h5-client/src/composables/useTranslationRoom.ts)

- [ ] 拆成 `playbackContext` 和 `captureContext`；房主 `startSpeaking` 不再调 `unlockAudio()`，只建采集上下文，不建播放器（`useTranslationRoom.ts:231-260`）。
- [ ] `input` WebSocket 自动重连：`onclose` 后按 500ms / 1s / 2s 重试 3 次，重连成功重发 `input.start`；失败再提示「麦克风连接中断」（`useTranslationRoom.ts:247`）。
- [ ] `bufferedAmount > 96000`（3 秒）时提示「网络不稳，讲解可能延迟」，不要等到 256000 才关闭（`useTranslationRoom.ts:250`）。
- [ ] `speaking` 期间申请 `navigator.wakeLock.request('screen')`，`stopMicrophone` / `leave` 释放；`visibilitychange` 回到前台时 `captureContext.resume()`。
- [ ] 监听麦克风 `onEnded`，提示「麦克风被系统暂停，请重新开始讲解」，不要静默继续。
- [ ] `startSpeaking` 失败时清空 `speaking` 并保留具体原因。

## 6. H5：播放

[demos/duplex-translation/public/player.js](../demos/duplex-translation/public/player.js)

- [ ] 起播提前量从 30ms 改为 120ms：`start = Math.max(ctx.currentTime + 0.12, playhead)`（`player.js:78`）。
- [ ] 每个 buffer 加 5ms 淡入/淡出（`GainNode` 线性 ramp），消掉句间咔哒声。
- [ ] 积压处理（`player.js:70-73`）：`maxQueueSeconds` 当前由 `useTranslationRoom.ts:192` 配成 120，改为 8；超限不调用 `stop()` 整体清空，改为「跳到最新」：停掉已排期 source、清 pending、`playhead = 0`，通过回调通知 UI。
- [ ] 记录 underrun：`ctx.currentTime > playhead` 时记 `gapMs`，并重置 `playhead`。
- [ ] `flush()` 里 decode 失败只丢当前句，不影响后续段。
- [ ] `onended` 里同步 `onState(false)`，避免「正在播放」状态卡住。

## 7. H5：会话与 UI

[apps/h5-client/src/components/translation/TranslationRoomExperience.vue](../apps/h5-client/src/components/translation/TranslationRoomExperience.vue)

- [ ] 底部状态支持「已跳到最新」「网络不稳，正在缓冲」「麦克风被系统暂停」三种提示。
- [ ] 房主端锁屏或切后台时显示「请保持屏幕常亮」。

[packages/ts-shared/src/translation-room.ts](../packages/ts-shared/src/translation-room.ts)

- [ ] `RoomEventCursor` 放行 `segment.dropped`，不要在按 sequence 过滤时误伤（`translation-room.ts:21-38`）。
- [ ] `RoomTextFeed` 对 `segment.dropped` 不建 item，只触发提示。

[packages/ts-shared/src/translation-room-messages.ts](../packages/ts-shared/src/translation-room-messages.ts)

- [ ] 新增文案：`已跳过一段讲解`、`网络不稳，讲解可能延迟`、`麦克风被系统暂停`、`已跳到最新讲解`。

## 8. 支付宝

[apps/mp-alipay/src/services/translation-room.js](../apps/mp-alipay/src/services/translation-room.js)

- [ ] 确认支付宝基础库是否支持 `recorder.onFrameRecorded`；支持就改为帧回调持续上传，去掉 4s 文件段（`translation-room.js:86`、`:116`）。
- [ ] 不支持则房主入口引导到 H5 `/translation-room`，支付宝端只保留游客收听；4s 文件录音的段间空隙无法靠参数消除。
- [ ] `send(pcm.slice(offset, offset + 16000), true)` 改为直接传 `ArrayBuffer`，不要 base64 + `isBuffer`；现在这条路径的真机语义需要验证（`translation-room.js:92`）。
- [ ] `pendingUploads > 3` 不再 `close(true)`，改为丢最旧一段 + 提示，保持连接（`translation-room.js:94`）。
- [ ] `paths.length > 240` 的收听积压上限保持不变；超出时提示改为可恢复。

[apps/mp-alipay/src/core/room-pcm.js](../apps/mp-alipay/src/core/room-pcm.js)

- [ ] 如果改帧流，`wavPcm` 保留给旧的 4s 文件路径；裸 PCM 帧不要再走 WAV 解析。

## 9. 文档与测试

`D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System/doc/96-exhibit-chat-duplex-translation-api.md`

- [ ] 更新参数：静音 400ms、最大段 3s、提交上限 3s、detector 600ms。
- [ ] 更新 `reason` 枚举，增加 `punctuation`、`dropped`。
- [ ] 说明 `stream=true` 不是连续流式识别，不要写成「逐采样」。

`CulturalTourismSystem.ApiTests/PcmSpeechSegmenterTests.cs`

- [ ] `600ms` / `128000` 断言改成新参数。
- [ ] 增加噪声底测试：低幅噪声不触发 ASR；高幅噪声不把段无限拉长。
- [ ] 增加预卷和重叠断言。

`CulturalTourismSystem.ApiTests/TranslationCommitterTests.cs`

- [ ] 8s 等待改 3s。
- [ ] 增加「句末标点不调 detector」用例。
- [ ] 增加中文拼接不加空格用例。

`CulturalTourismSystem.ApiTests/DuplexTranslationTests.cs`、[demos/duplex-translation/tests/page.test.js](../demos/duplex-translation/tests/page.test.js)、[apps/h5-client/tests/translationRoom.test.ts](../apps/h5-client/tests/translationRoom.test.ts)

- [ ] 跟着新参数、`segment.dropped`、播放器跳段行为更新。

## 10. 工程性

- [ ] 把 `demos/duplex-translation/public/` 下的 `mic.js`、`pcm.js`、`player.js`、`capture.worklet.js` 移到 `apps/h5-client/src/audio/`，生产代码不要再从 demo 目录 import。
- [ ] `useTranslationRoom.ts:6-8` 的 import 一起改，并补单元测试。

## 11. 影响面

| 改动 | 影响 |
| --- | --- |
| `PcmSpeechSegmenter`、`TranslationCommitter` | 同时被 `/api/ExhibitChat/translate-realtime` 的 `DuplexTranslationSession` 使用，参数变化会一起生效；如需隔离，给构造函数加参数，房间链路传新值 |
| `MiniMaxStreamingTtsClient` 音频格式 | 影响所有语音入口，H5 问答、路线讲解、支付宝播放都可能不兼容；本次不改 |
| `RealtimeTranslationAgent` 客户端缓存 | 判边界与翻译共用，连接数下降，行为不变 |
| 共享文案与 `segment.dropped` | H5 与支付宝都要同步发布，旧客户端会忽略未知事件，不会报错 |

## 12. 验证

自动检查：

```powershell
pnpm --filter @path-seeker/h5-client test
pnpm --filter @path-seeker/h5-client build
pnpm --filter @path-seeker/mp-alipay test

# 在 D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System 下执行
dotnet test CulturalTourismSystem.ApiTests --filter "FullyQualifiedName~TranslationRoom|FullyQualifiedName~PcmSpeechSegmenter|FullyQualifiedName~TranslationCommitter"
```

真机检查：

- 连续讲 20 秒不换气，确认段数、字幕出现时间和句间是否还有整段空洞。
- 城市噪声下静音 5 秒，确认不产生 ASR 请求；正常说话时不被噪声底吞掉。
- 房主锁屏 30 秒再回来，确认收音恢复或给出明确提示，不是静默失败。
- 弱网下让游客侧积压超过 8 秒，确认跳到最新并提示，而不是越听越旧或直接断开。
- 同一段讲解对比修改前后的首字幕、首音、译文中断位置；服务端日志能看到段时长、ASR ms、提交等待、TTS 首包。

## 13. 本次不纳入

- MiniMax 换供应商或接第二家流式 ASR：需要单独验证中间结果、热词、标点和计费。
- TTS 改 16k PCM：带宽和支付宝播放层要一起改。
- 多实例房间路由、跨实例音频续传：与本次丝滑度无关。
