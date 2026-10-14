# H5 浏览器语音输入验收

本文保留此前 Web Speech API 的故障排查记录。当前业务入口已切换到 [MiniMax 录音上传方案](./h5-minimax-voice-verification.md)，以下浏览器识别说明用于历史排查及独立检测页。

## 控制边界

- 导航、Chat、外部“问”和问答 store 取得同一个全局控制器；同一页面生命周期内只有一个原生 SpeechRecognition 对象，结束后复用。
- 每次只能有一轮识别。stop/abort 后原生 end 未返回时保持占用，阻止其他入口和播放期收音抢占。
- 意外 aborted 只允许一次恢复，先等待 end 再 start；缺少 end 时退出当前提问，不创建新对象竞争麦克风。
- 首次操作只申请麦克风权限并立即停止授权探测的轨道。提示就绪后，用户再次按住才开始识别；授权完成不会自动发送或跳页。
- 页面内的手势控制器只清理自己持有的操作；松手交接到问答 store 后，来源页面卸载不取消结果。
- 导航入口报错不会在按住期间跳页；只在松手时交接到问答。
- 波形以 audiostart/audioend 为依据，start 请求发出不算已经收音。

## 诊断

Chat 出现语音错误后可点击“复制诊断”。版本标记为 `browser-voice-20261014`，包含浏览器标识、安全上下文、页面可见性、语言、原始错误码、事件顺序和耗时，不包含识别文本、音频、访问令牌或 URL 参数。未自动上传。

`start-request → engine-start → audio-start → result → stop-request → engine-end` 是一种正常顺序；部分事件的先后由浏览器决定。若只有启动和错误，应根据实际错误排查，不能从波形、按钮或模拟测试断言手机识别成功。

## 验证层级

1. 自动测试：首次授权、拒绝、设备占用、实例身份、多入口互斥、取消后延迟结束、迟到回调隔离、松手后结果交接、错误去重及超时释放。
2. 构建：H5 Vue/TypeScript 检查及 Vite 生产构建。
3. 发布：发布本次 H5 产物并核对线上脚本内的诊断版本；本地构建不代表已发布。
4. 真机：在出现问题的 Android Edge 上分别从导航、Chat 和外部“问”提问，检查只发送一次且文本正确；再验证上滑取消、立即再次按住、跳页、切后台、朗读中按住打断、首次授权、蓝牙耳机接入。

第 1、2 层通过不能代替第 4 层。若真机仍失败，必须先取得上述诊断事件并定位，不应继续凭猜测更改 continuous 或重试间隔。

## Android Edge 启动即中断的隔离检查

2026-10-14 真机日志显示：192ms `engine-start`，193ms `error:aborted` 和 `engine-end`；一次重启后 297ms 再次 `aborted`，298ms 结束。整个过程没有 `audio-start` 或 `result`，松手 `stop-request` 在 8829ms，前面没有应用的 `abort-request`。

这排除了此次失败由松手调用 stop 引起，也确认手机运行了带诊断的新版本。日志不能独自证明 Google 服务缺失、麦克风硬件故障或 Edge 的特定缺陷。Chromium Android 上游代码把 Android `ERROR_CLIENT` 映射为 Web Speech `ABORTED`；Edge 具体版本可能有不同实现，不能将上游映射视作该设备的原生错误码证明。

公开实现参考：https://github.com/chromium/chromium/blob/main/content/public/android/java/src/org/chromium/content/browser/SpeechRecognitionImpl.java

H5 发布后，独立检测页地址为 `/path-seeker/client/voice-check.html`。它不导入 Vue、业务 store、播放器或 AudioContext，不使用长按、不自动重试，也不访问业务后端。先关闭其他导览页面，再检查麦克风（获取后立即释放），然后点击一次开始识别并说话。复制结果不包含语音文本。

- 麦克风检查成功、独立识别仍在 audiostart 前 aborted：可将范围缩小到当前浏览器及系统识别路径，继续核查设备上的识别服务、权限和服务可用性。
- 独立识别返回 result、业务页失败：继续排查业务页的音频会话和资源竞争，不能归因于浏览器完全不支持。
- 麦克风检查失败：先依据实际权限或设备错误处理，不能当成 ASR 网络错误。

此检测页用于定位故障，不是对识别故障已修复的声明。
