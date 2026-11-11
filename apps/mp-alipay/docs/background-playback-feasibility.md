# 息屏自动触发讲解：平台边界与可选方案

> 2026-11-10 校订：本文下方保留早期方案讨论，不能作为当前实现和官方能力的验收依据。`requiredBackgroundModes`、`InnerAudioContext.supportBackgroundPlay` 未在本次核对的支付宝官方配置/属性表中列出，现已从代码移除；它们不能保证当前段后台播放。“约 5 秒挂起”“后台必断”等描述也不能推广到全部版本和机型。当前已接入官方 `my.getBackgroundAudioManager()` 播放 HTTPS 景点音频，后台保留健康游客连接与状态订阅。用户已明确游客必须只用支付宝，因此原生游客端、电话及换宿主不属于本次交付路线。完整官方来源、当前修复、独立长流原型与待验收边界，以[2026-11-10 调研报告](../../../docs/alipay-screen-off-node-research-2026-11-10.md)为准。

## 结论

纯支付宝小程序**不能稳定做到**"手机息屏后，到站自动起播一段新的讲解音频"。

原因不是定位不够准，也不是范围判定写得不对，而是支付宝在小程序进入后台后会把 JS 运行时挂起：定时器、网络回调、WebSocket 和页面生命周期都会停。`app.json` 的 `requiredBackgroundModes: ["audio"]` 与 `InnerAudioContext.supportBackgroundPlay` 只能让**已经在播的那一条音频**继续，不能让"下一段"被 JS 起播，也不能让到站判定继续跑。

所以可选路线只有三类：

1. **不让它真正息屏**：常亮 + 极暗遮罩，做成"伪息屏"导览模式。今天就能上，代价是电量和发热。
2. **把判定和播放搬出小程序**：服务端到站引擎 + 到达事件 + 恢复补播；或服务端连续音频流；或原生客户端。
3. **接受限制，做兜底**：订阅消息提醒、司机手动触发、电话外呼、租借讲解机。

推荐组合是 **1 + 2**：常亮导览保证"能触发"，服务端到站保证"触发得准、漏了能补"，后台音频实验只作为可开关的省电模式，不作为承诺。

## 当前链路为什么在息屏时断

现状（见 [tour/index.js](../src/pages/tour/index.js) 与 [location.js](../src/services/location.js)）：

| 段 | 位置 | 息屏后 |
| --- | --- | --- |
| 车夫位置轮询 | `location.watch`：请求完成后 1 秒再查 | 定时器和请求回调停 |
| 路线纠偏与到站判定 | `onFix` 回调 → `nearbyCandidates` | 回调不再执行 |
| 提示卡倒计时 | `showArrivalPrompt` 的 `setTimeout` | 计时器停 |
| 入队与起播 | `enqueueCandidates` → `startNextSequence` → `InnerAudioContext.play` | JS 不执行，无法起播 |
| 当前讲解 | `supportBackgroundPlay = true` | 已在播的这条可以继续；播完后不会自动下一段 |

后台时间线大致是：

```text
按下电源键 / 切到后台
  → onHide
  → 数秒内 JS 被挂起（常见 5 秒左右，具体以支付宝版本与机型为准）
  → setInterval / setTimeout 不再回调，未完成请求不再回调，WebSocket 被断开
  → 原生音频层继续播放当前 src（若已开启后台播放）
  → 用户回到小程序
  → onShow，重新取点、重新稳定判定
```

社区里能直接对上的现象：

- [小程序进入后台，多久之后被挂起？长连接多久之后被断开？](https://developers.alipay.com/portal/forum/post/65201013)
- [锁屏后 setTimeout 定时器不执行，不能获取定位](https://developers.alipay.com/portal/forum/post/53501024)
- [小程序 setInterval 在息屏和挂起的状态下不起作用](https://developers.alipay.com/portal/forum/post/17001024)
- [线上小程序，切至后台，息屏后，onUnload 未能执行](https://developers.alipay.com/portal/forum/post/218701022)

这些帖子只能说明现象，不能替代真机验收；本仓库 [location-validation.md](location-validation.md) 也明确写了"服务器持续收到车夫坐标不等于游客息屏仍能实时播放"。

## 平台能力核对

| 能力 | 接口/配置 | 能做什么 | 不能做什么 |
| --- | --- | --- | --- |
| 后台音频 | `requiredBackgroundModes: ["audio"]`、`InnerAudioContext.supportBackgroundPlay`、[音频播放 API](https://opendocs.alipay.com/mini/08ps3q) | 已起播的单条音频在后台/锁屏继续 | 不能唤起 JS 去起播下一条，不能维持轮询 |
| 后台音频配置差异 | `requiredBackgroundModes` 在部分构建链/基础库不被识别（如 [mpx 的支付宝差异表](https://raw.githubusercontent.com/didi/mpx/f97ba5800a7249387f260b0ce50d1838367f054c/.agents/skills/workspaces/mpx2skyline-workspace/iteration-8/skill-snapshots/mpx/references/ali/ali-json-reference.md) 列为不支持），实际开关以 `supportBackgroundPlay` 与真机为准 | 不能据此推断后台 JS 一定存活 | 不要把配置存在当成能力存在 |
| 背景音频管理器 | [`my.getBackgroundAudioManager`](https://opendocs.alipay.com/mini/07t7hw)、[概览](https://opendocs.alipay.com/mini/07t8lt) | 更接近系统播放器的后台播放、锁屏控制（含 onNext/onPrev） | 仍是"播什么"由 JS 决定；换曲、切歌依赖 JS 或系统控制 |
| 屏幕常亮 | [`my.setKeepScreenOn`](https://miniprogram.alipay.com/docs/miniprogram/mpdev/api_device_screen_setkeepscreenon) | 阻止自动锁屏，页面保持前台 | 阻止不了用户按电源键；耗电 |
| 屏幕亮度 | `my.getScreenBrightness` / `my.setScreenBrightness` | 配合黑色遮罩做"看起来像息屏" | 单独调亮度不阻止锁屏 |
| 定时器/网络 | `setTimeout` / `setInterval` / `my.request` | 前台正常 | 后台挂起后停 |
| WebSocket | `my.connectSocket` | 前台实时事件 | 后台被断开；心跳也救不回来 |
| 后台定位 | 无公开 API | —— | 小程序不能后台持续取点；当前方案本来就用车夫 APP 的位置 |
| 视频 | `video` 组件 | 前台播放 | 页面隐藏即暂停，无锁屏后台续播 |
| 订阅消息 | [`my.requestSubscribeMessage`](https://opendocs.alipay.com/mini/api/requestSubscribeMessage) | 服务端推送消息，用户点击后打开小程序 | 不能自动播放音频，必须用户点击 |
| 后台任务/Worker | 无 | —— | Worker 随小程序一起挂起 |

对比微信：微信在声明 `requiredBackgroundModes` 且播放背景音频时，官方允许小程序"在后台运行"，所以微信生态里"循环音频保活"有成功案例；支付宝的公开文档没有等价的"JS 继续运行"承诺，必须实测，不能照搬微信结论。参考：[微信运行机制](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/operating-mechanism.html)、[微信背景音频](https://developers.weixin.qq.com/miniprogram/dev/api/media/background-audio/wx.getBackgroundAudioManager.html)。

## 方案矩阵

"息屏能否自动出声"指用户按下电源键、屏幕全黑、小程序在后台的情况下。

| # | 方案 | 做法 | 息屏自动出声 | 工作量 | 风险 | 建议 |
| --- | --- | --- | --- | --- | --- | --- |
| A | 常亮 + 极暗遮罩（伪息屏） | `setKeepScreenOn(true)`，亮度调到接近 0，全屏黑色 `cover-view` 显示站名和时间 | 能（屏幕其实没灭） | 0.5–1 天 | 耗电、发热、用户误按电源键 | **先做** |
| B | 后台音频保活 | 循环播放一段真实环境音/底噪，开 `supportBackgroundPlay`，用 `onTimeUpdate` 当心跳 | 取决于 JS 是否被挂起，未证实 | 1 天实验 + 1 天接入 | 审核、耗电、音频焦点、可能根本无效 | **先做实验，不先上线** |
| C | 音频时间轴当心跳 | 用 `onTimeUpdate` 代替 `setInterval` | 同上，仍依赖 JS | 0.5 天 | 同上 | 只作为 B 的补充 |
| D | WSS 保活 | 长连接 + 15 秒心跳 + 重连 | 不能 | 1–2 天 | 后台必断，重连也来不及 | 只做事件通道，不做保活 |
| E | 服务端到站判定 | 车夫坐标进服务端，服务端算 geofence，落 `arrival` 事件 | 不能单独解决；但能去重、补播、降延迟 | 3–5 天 | 需要后端与路线几何一致 | **与 A 并行做** |
| F | 服务端连续音频流 | 客户端只播一条不断的长流，服务端在到站时把讲解混进流里 | 理论可行，待验证 | 2–4 周 | 直播流支持、延迟、流量、成本 | 想纯小程序真息屏，只有这条路值得试 |
| G | 订阅消息 | 到站时服务端推送，用户点击进入播放 | 不能自动，需点击 | 1–2 天 | 模板审核、一次性订阅额度、打扰 | 兜底与召回 |
| H | 电话外呼 TTS | 服务端拨打游客手机播放讲解 | 能 | 1 周 | 成本、延迟、打断、体验 | 高价值/无障碍兜底 |
| I | 原生游客端 | 复用 `driver-android` 的前台服务 + MediaPlayer | 能 | 3–4 周 | 分发、安装、账号 | 要承诺就必须走这条 |
| J | 蓝牙信标 / NFC | 到点触发 | 不能（后台不允许扫描；NFC 要碰） | —— | —— | 不做 |
| K | 支付宝 IoT / 讲解机 / 车端外放 | 场地设备或车上的蓝牙音箱播放，司机端触发 | 能 | 采购 | 成本、押金、卫生、多语言 | 重运营场景可行 |
| L | 换宿主：微信小程序播放 | 支付宝负责登录支付，微信小程序负责导览播放 | 微信后台音频更成熟，但仍受各自平台调度 | 2–4 周 | 双端维护、审核、账号打通 | 用户可接受微信入口时再评估 |
| M | 静音音频 / 常驻定时器 | 循环无声音频、永不停止的 interval | 不能保证，且违规 | 0 | 审核下架 | **不做** |
| N | 小程序插件 / Worker | 把逻辑放进插件或 Worker | 不能，随宿主挂起 | —— | —— | 不做 |
| O | 桌面小组件 / 快捷方式 | 缩短启动路径 | 不能保活 | 0.5 天 | —— | 只能改善启动体验 |
| P | 预下载 / 预热 | 提前缓存下一站音频 | 不解决触发，但缩短出声时间 | 1 天 | 流量 | 配合 A/E 做 |

## 三条真正可行的路线

### 路线 1：伪息屏（推荐先落地）

用户看到的是黑屏，系统层面小程序仍是前台，所以轮询、判定、起播全部照常。这是唯一"今天改、明天就能真机验收"的方案。

要点：

- `my.setKeepScreenOn({ keepScreenOn: true })` 只能阻止自动锁屏，**阻止不了电源键**。用户按下电源键后仍然会挂起，因此要在 `onHide` 记录"被动息屏"，回到前台走补播。
- 亮度调到 0 会让退出按钮看不见；建议 0.02–0.05，并在遮罩上放一个大面积的"轻触退出"，不要只放小按钮。
- 退出、切页、结束行程、关闭"附近讲解"时必须恢复原亮度并关闭常亮，否则会一直耗电。
- 遮罩用 `cover-view`，否则盖不住原生地图。
- 进入时明确提示："讲解模式会保持屏幕常亮，耗电会增加；可随时退出"。不要偷偷常亮。
- 这是"看起来息屏"，不是"真息屏"；对用户话术要诚实。

代码落点：

- 新增 `src/services/screen-awake.js`：`enable()` / `disable()` / `snapshot()`，内部保存原亮度，幂等。
- `config.js` 增加 `keepAwake: false`（灰度开关）。
- `pages/tour/index.js`：`enableNearbyGuidance()` 成功开启跟随后 `enable()`；`toggleLocation(false)`、`onUnload()`、结束行程时 `disable()`；`onShow()` 若仍在导航则重新 `enable()`。
- `pages/tour/index.axml`：在页面根部加一个 `cover-view` 遮罩，`a:if="{{sleepMode}}"`，显示站名、时间、"讲解进行中"和退出入口。
- `diag` 增加 `screen-awake`、`screen-off`、`screen-resume` 三个事件，记录 `hiddenAt`、`resumedAt`、`gapMs`，不记录坐标。

### 路线 2：服务端到站引擎 + 到达事件 + 补播（推荐并行）

把"到站"从"某一帧恰好进圈"变成"服务端的一条事实"。它不能唤醒挂起的小程序，但能解决四件事：

1. 客户端不用 1 秒轮询、不用重复算几何，省电、降延迟。
2. 事件可持久化，息屏/断网/进隧道漏掉的站点，回前台可以按顺序补播，不再永久丢失。
3. 司机可以在 APP 上手动点"播报下一站"，GPS 漂移或临时封路时有人兜底。
4. 多个游客、H5、小程序看到同一套判定结果，不会各算各的。

接口建议（复用现有房间鉴权）：

```text
GET  /TranslationRooms/{roomId}/arrivals?visitId=...&after={cursor}
     → { items: [{ id, spotId, at, distanceMeters, source, state }], nextCursor }

POST /TranslationRooms/{roomId}/arrivals/{id}/ack
     body: { state: "played" | "skipped" }

POST /TranslationRooms/{roomId}/narration/next        # 仅车夫/房主
     → 创建一条 source=manual 的 arrival

WS   /TranslationRooms/{roomId}/events
     → { type: "arrival", id, spotId, at, distanceMeters, source }
```

约束：

- `arrival` 以 `visitId + spotId` 幂等；同一站只产生一条，重复采样不重复推送。
- 响应不返回原始经纬度，只返回站点、距离、时间；保留 24 小时，与现有位置历史口径一致。
- 服务端判定复用 [geo-range.ts](../../../packages/ts-shared/src/geo-range.ts) 的常量和规则：精度上限、15 秒时效、圆形/多边形距离、线段穿越、停留、120 米线段上限。C# 侧重写时用现有 [circle-arrival.test.cjs](../tests/circle-arrival.test.cjs) 的用例对齐。
- 建议加"预判提前量"：按当前速度提前 `speed × 8s` 触发，先播 1–2 秒前奏/欢迎音，再进正文，解决"到站才开口"。
- 客户端保留本地判定作为低延迟快路径；服务端事件作为权威与补播来源，按 `spotId` 去重。
- 回前台补播策略：间隔小于 90 秒直接续队；超过 90 秒不自动连播，弹"你经过了 N 个站点"的补听卡，避免一回来突然外放。

客户端落点：

- 新增 `src/services/arrival-channel.js`：`start(roomId, visitId)` / `stop()` / `replay()`，持久化 `cursor`，按账号和行程隔离；WS 可用时收事件，不可用时 3–5 秒轮询，`onShow` 必拉一次。
- `pages/tour/index.js`：`onShow` 调 `replay()`；`nearbyCandidates` 命中后先查 `arrival-channel` 是否已处理；`enqueueCandidates` 成功后 `ack`；`onHide` 记录最后事件游标。
- 司机 APP：加一个"下一站讲解"按钮，调用 `narration/next`，这是最可靠的现场兜底。

### 路线 3：真正的后台出声（按商业需要选）

三条子路线，成本从低到高：

1. **服务端连续音频流（推荐先做 2 天 spike）**
   客户端从头到尾只播一条 `https://.../rooms/{code}/live.mp3`（或 HLS），服务端用 ffmpeg 把"环境底噪 + 到站讲解"混进同一条流。客户端不需要切歌、不需要 JS 判定，息屏后原生播放器继续拉流。
   需要验证：支付宝 `InnerAudioContext` / `BackgroundAudioManager` 能否长时间播放 chunked MP3 或 HLS；后台是否持续；断网重连；延迟（目标 < 2 秒）；流量（64 kbps 约 28 MB/小时，128 kbps 约 56 MB/小时）。
   如果播不了长流，这条就不成立，不要硬做。
2. **电话外呼 TTS**
   服务端在到站时拨打游客手机，播放预生成语音。屏幕锁着也能出声，不依赖支付宝。缺点是每站一次电话不现实，更适合"整段行程一个持续通话"或高端小团；成本、通话质量、打断导航都要算。
3. **原生游客端 / 讲解机**
   复用 `driver-android` 的前台服务、定位、OkHttp、MediaPlayer，做一个游客版；或者直接采购讲解机。要对外承诺"息屏也能播"，这是唯一不会被打脸的方案。

## 后台音频保活实验（先验证，再决定）

目的只有一个：回答"支付宝在播放后台音频时，JS 到底还跑不跑"。

实验配置（同一台手机、同一支付宝版本，各 30 分钟）：

| 组 | 音频 | 记录 |
| --- | --- | --- |
| 1 | 不播音频 | 1 秒定时器、HTTP 时间戳、WS pong |
| 2 | 循环真实环境音（非静音） | 同上 + 音频 `currentTime` |
| 3 | `BackgroundAudioManager` 循环 | 同上 |
| 4 | 正常讲解音频 | 同上 + 播完后是否自动下一段 |

判定：

- 定时器最大间隔 < 10 秒、HTTP 成功率 > 90%、音频位置持续前进，才算"JS 仍活"。
- 只有"音频前进但定时器停"说明只是原生层在播，保活不成立。
- 任一组在两台设备上不稳定，就不要把"省电导览"做成默认能力。

如果成立，正确的用法不是"循环无声音频"，而是**播放真实的环境音/街区底噪**，把它作为产品的一部分（音量很低、可关闭），并明确告知用户；同时保留常亮模式作为回退。

**不要**用静音文件、不要用 1 像素视频、不要用永不结束的定时器。这类做法既不能保证生效，也违反平台运营规范（[支付宝小程序运营规范](https://opendocs.alipay.com/b/0a8w4g)），本仓库 [arrival-trigger-improvement.md](arrival-trigger-improvement.md) 也已经把"静音音频、常驻定时器"列为不做项。

## 推荐实施顺序

| 阶段 | 内容 | 工期 | 验收 |
| --- | --- | --- | --- |
| P0 | 伪息屏导览模式（常亮 + 极暗 + 黑遮罩 + 退出恢复） | 0.5–1 天 | 息屏 30 分钟，经过 3 站全部触发；退出后亮度恢复 |
| P1 | 服务端到站引擎 + `arrival` 事件 + 补播 + 司机手动触发 | 3–5 天 | 事件延迟 p95 < 3 秒；息屏 10 分钟后回前台能补听；重复播放 0 |
| P2 | 后台音频保活实验（feature flag） | 1 天 | 四组配置 × iOS/Android × 30 分钟，形成结论 |
| P3 | 服务端音频流 spike | 2 天 | 连续播放 30 分钟、锁屏不断、延迟 < 2 秒；否则放弃 |
| P4 | 原生游客端 / 讲解机 / 电话外呼 | 按商务 | 真机锁屏 10–30 分钟 |

P0 与 P1 可以并行；P2 的结论决定 P0 是否升级为"省电模式"；P3 只在"必须纯小程序真息屏"时才投入。

## 验收口径

| 场景 | 指标 | 方法 |
| --- | --- | --- |
| 常亮导览 | 进圈到出声中位数 ≤ 3 秒 | `arrival-decision.latencyMs` |
| 常亮导览 | 30 分钟 0 漏播 | 人工记录经过站点与播放记录 |
| 常亮导览 | 电量与温度可接受 | 记录起始/结束电量、机身温度、机型 |
| 服务端到站 | 事件延迟 p95 ≤ 3 秒 | 服务端 `detectedAt` 与客户端 `receivedAt` |
| 补播 | 息屏 10 分钟回前台，按顺序补听 | 制造 2–3 个站点经过 |
| 后台实验 | 定时器最大间隔、HTTP 成功率、音频位置 | 实验页导出 JSON |
| 音频流 | 30 分钟不断流、延迟 < 2 秒 | 锁屏 + 切网 + 来电 |

iOS 与 Android 必须分开记录；模拟器、开发者工具不能替代真机。至少要覆盖一台 iPhone、一台华为/小米/OPPO/vivo。

## 合规与风险

- **审核**：后台音频能力要用于真实内容；常亮要说明用途；不得用静音、无内容音频或无休止定时器规避后台限制。
- **宣传**：不要在页面、销售材料写"息屏也能自动播报"，除非走原生客户端并完成真机验收。本仓库现有文档的表述是准确的，不要改回去。
- **电量与发热**：常亮是最大功耗项，极暗遮罩只能降低不能消除；要给用户开关和提示。
- **音频焦点**：实时讲解、景点音频、视频、来电、蓝牙耳机共用一条音频通道；保留现有 `audio` 的 owner 排他逻辑，任何新通道都要接进去，不能抢音。
- **隐私**：到站事件只存站点、时间、距离，不存原始轨迹；跨房间不可见。
- **降级**：任何新能力都要有"关掉后退回现有前台逻辑"的开关，不能把主流程绑死在实验能力上。

## 不做

- 不用静音音频、1 像素视频、常驻定时器维持后台。
- 不把 WSS 或心跳描述成保活手段。
- 不承诺纯小程序息屏实时触发。
- 不通过放大范围、篡改精度来"证明"触发率提升。
- 不在没有真机数据前默认开启常亮或后台音频。

## 参考资料

- [音频播放 API 概览](https://opendocs.alipay.com/mini/08ps3q)
- [my.getBackgroundAudioManager](https://opendocs.alipay.com/mini/07t7hw)
- [BackgroundAudioManager 概览](https://opendocs.alipay.com/mini/07t8lt)
- [my.setKeepScreenOn](https://miniprogram.alipay.com/docs/miniprogram/mpdev/api_device_screen_setkeepscreenon)
- [my.requestSubscribeMessage](https://opendocs.alipay.com/mini/api/requestSubscribeMessage)
- [支付宝小程序运营规范](https://opendocs.alipay.com/b/0a8w4g)
- [小程序进入后台，多久之后被挂起？长连接多久之后被断开？](https://developers.alipay.com/portal/forum/post/65201013)
- [锁屏后 setTimeout 定时器不执行，不能获取定位](https://developers.alipay.com/portal/forum/post/53501024)
- [小程序 setInterval 在息屏和挂起的状态下不起作用](https://developers.alipay.com/portal/forum/post/17001024)
- [微信小程序运行机制](https://developers.weixin.qq.com/miniprogram/dev/framework/runtime/operating-mechanism.html)
