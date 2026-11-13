# 支付宝系统音频中断：通话优先、手动恢复

调研日期：2026-11-13。适用于支付宝原生小程序，已接入现有后台持续讲解及房间音频播放。

## 已核实的 GitHub 证据

1. 支付宝官方文档仓库 [AlipayDocs/open-docs](https://github.com/AlipayDocs/open-docs) 的 README 明确此仓库托管支付宝开放文档。
2. [my.onAudioInterruptionBegin](https://github.com/AlipayDocs/open-docs/blob/master/mini/api/基础API/多媒体/音频播放/my.onAudioInterruptionBegin.md) 用于监听“音频因为系统占用而被中断的开始事件”。文档列出的最低要求为基础库 1.23.4、支付宝客户端 10.1.87，IDE 不支持调试此 API，需要真机。
3. [my.onAudioInterruptionEnd](https://github.com/AlipayDocs/open-docs/blob/master/mini/api/基础API/多媒体/音频播放/my.onAudioInterruptionEnd.md) 明确说明：“在收到 onAudioInterruptionBegin 事件之后，小程序内的所有音频会暂停，收到此事件之后可再次播放成功。”结束事件表示允许重新播放，未要求开发者自动恢复。因此结束后保留手动恢复状态符合接口语义。
4. [官方文档 PR #1288](https://github.com/AlipayDocs/open-docs/pull/1288) 修改使用限制及真机调试说明。此次同时读取了当前 master 文档，未将 PR 中的待发布描述当作当前接口承诺。
5. [Cocos adapters PR #219](https://github.com/cocos-creator-packages/adapters/pull/219) 记录了微信通话在前台仍可持续、结束事件到通话结束才触发的问题，并将音频中断与整个游戏的前后台状态分离。该记录是微信平台的工程经验，不能证明支付宝的具体机型表现；本项目据此避免用 onShow 或 onHide 推断通话是否结束。

原始响应及文档副本保存在 `outputs/alipay-audio-interruption/`。GitHub API 查询达到限流后改为读取同一官方仓库的公开 raw 文档和 PR patch，未使用未核实的第三方接口替代支付宝能力。

## 实现行为

- 全局只注册一次支付宝音频中断开始、结束监听。接口缺失或注册同步失败时保留原有播放器行为，不导致小程序启动失败。
- 开始中断时立即暂停本地播放器，设置“系统仍占用”和“需要手动恢复”状态，并向持续讲解服务发送暂停命令。即使暂停请求失败，本地播放限制仍生效。
- 结束中断时仅解除“系统仍占用”，保留“需要手动恢复”。返回前台、正常状态轮询、问答结束、自动重连、迟到的原生 Play/TimeUpdate 均不能解除限制。
- 播放器限制覆盖普通音频、持续媒体、房间流式语音及视频迟到的播放事件。限制期间不为迟到的媒体结果创建新播放源，不把中断期间的原生音频错误显示为普通播放故障。
- 中断尚未结束时点击重新连接不会请求重新播放。结束后，游客点击重新连接或普通播放按钮才解除限制；跟随模式重连继续执行当前位置 realign 规则。
- 独立房间收听中断后保持暂停，可用房间的继续收听操作恢复。连续讲解模式暂停整个会话，不额外改变游客原先的车夫语音静音选择。
- 中断状态与账号、房间和播放器替换分离，停止旧播放器、退出房间或替换媒体源不能绕过尚未解除的系统中断限制。
- 诊断新增 `interruption.supported/active/resumeRequired/version`，活动会话的 `phase` 可为 `interrupted`，生命周期记录中断开始、结束及手动恢复。

## 能力边界

这些 API 反映系统音频中断，不提供可靠的来电号码、应用名称或“电话/微信语音消息”分类。文案统一显示其他应用占用音频，不能把所有中断都认定为微信通话。

上述保护以宿主实际发送通知为前提。设备未发开始通知、小程序进程被系统杀死、在通话已经进行时启动小程序等情况仍受系统和支付宝音频策略约束。`supported=true` 只说明两个注册方法存在且调用未同步失败，不代表这台设备已通过通话验证。微信普通语音消息是否触发系统中断，也必须真机验证。

没有引入原生 Android AudioManager、iOS AVAudioSession 或模拟电话状态的轮询；这些接口不属于支付宝小程序可以直接控制的权限范围。仍保留原有 Pause/Stop 通知作为辅助处理。

## 验证与发布

- 构建：`pnpm --filter @path-seeker/mp-alipay build`。
- 专项：在 `apps/mp-alipay` 运行 `node --test tests/audio-interruption.test.cjs tests/server-tour-audio.test.cjs`。
- 全量：在 `apps/mp-alipay` 运行 `node --test tests/*.test.cjs`。
- 真机分别验证 Android 与 iPhone：来电响铃、接通、挂断、拒接；微信语音/视频通话及普通语音消息；通话中返回小程序；通话结束不主动恢复；点击重连对齐当前位置；中断期间断网及房间解散。
- 在诊断中确认中断开始和结束记录。IDE 和模拟事件测试不能替代真实系统通知验收。

仅需发布新版支付宝小程序，不修改后端协议，不新增依赖。
