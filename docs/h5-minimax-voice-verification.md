# H5 MiniMax 语音输入

当前生产入口使用录音上传方案：`getUserMedia → AudioWorklet → 单声道 16kHz/16bit WAV → POST /api/ExhibitChat/transcribe → MiniMax ASR → 原有问答与 TTS`。

导航页、外部“问”入口、Chat 页和问答 store 共用 `useMinimaxVoiceRecognition` 的唯一控制器。同一时间只有一轮录音或上传，每轮资源独立；取消后的迟到授权和识别结果只属于旧会话。

## 操作与边界

- 导航页及外部“问”入口点击后打开问答弹层，并申请麦克风开始持续收音；首次允许权限后直接开始录音。
- 内容页麦克风为开关：点击开始，再次点击结束录音并上传，识别完成后自动发送问题。收音期间显示停止图标，连续波浪线随实际音量起伏。
- 关闭问答、切回文字模式、离开问答页面或切后台会取消本轮录音及待发送的识别结果，并释放麦克风。弹层放大为全页或收回弹层时继续收音。
- 录音启动期间允许再次点击取消等待；上传识别期间禁用重复开启，避免重复上传或发送。
- 短于 200ms 的有效音频不上传；录满 60 秒自动停止、释放麦克风并识别发送。
- 录音初始化等待上限 15 秒，上传等待上限 65 秒。权限、设备、短录音、网络、业务失败和空结果均结束等待，允许再次录音或文字提问。
- WAV 和 MiniMax 供应商密钥均不写入浏览器日志。诊断版本为 `minimax-voice-20261014`，只记录阶段事件及错误码。

## 后端

后端仓库：`D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System`。

`ExhibitChatController.Transcribe` 使用现有登录鉴权和 `exhibit-chat` 限流，只接收 WAV，最大请求 10MB。MiniMax 客户端注册为单例；模型为 `asr-1.0`，路径为 `/v1/speech_to_text`，语言为 `zh`。使用已有 MiniMax 服务器配置，优先读取 `MINIMAX_API_KEY`；H5 只发送自身登录令牌。

成功响应为 `{ "code": 0, "data": { "text": "识别文字" } }`。前端同时检查 HTTP 状态和业务 `code`，空文本不提交问题。

## 验证命令

```powershell
pnpm --filter @path-seeker/h5-client test
pnpm --filter @path-seeker/h5-client build
dotnet run --project outputs/minimax-asr/client-check/AsrClientCheck.csproj -p:NuGetAudit=false
node outputs/minimax-asr/probe-provider.mjs --round-trip
dotnet run --project outputs/minimax-asr/client-check/AsrClientCheck.csproj --no-build -- --live
```

回环脚本从已有后端配置读取密钥，不输出密钥；测试用语为“你好，请介绍一下这里的历史。”，只使用合成测试音频。C# 检查器直接编译后端实际 `MiniMaxSpeechToTextClient.cs`，验证成功响应、multipart 契约、供应商错误、HTTP 错误、空结果、无效 JSON 及取消。`--live` 使用回环脚本生成的音频调用真实 C# 客户端。

原后端 obj 目录权限异常时，可以使用工作区独立构建目录：

```powershell
dotnet build D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System/CulturalTourismSystem.WebApi/CulturalTourismSystem.WebApi.csproj -p:UseArtifactsOutput=true -p:ArtifactsPath=D:/workspace/amh/code/CulturalTourism/web/path-seeker-ui/outputs/minimax-asr/backend-artifacts -p:NuGetAudit=false -p:RestoreIgnoreFailedSources=true
```

## 发布与真机验收

2026-10-14 本次验证结果：H5 76/76 项测试通过；Vue/TypeScript 检查及 Vite 生产构建成功；WebAPI 全量构建成功（0 错误）；后端实际 C# 客户端 6 项契约/异常检查通过；Node 回环及 C# 实际客户端均成功识别“你好，请介绍一下这里的历史。”。

线上只读核对发现 `/path-seeker/client/ride` 仍加载 `index-MH8bkwKg.js`，包含 `browser-voice-20261014`，未包含 `minimax-voice-20261014` 或 `/ExhibitChat/transcribe`。录音 worklet URL 虽然返回 HTTP 200，响应内容没有 `voice-recording` 注册代码，不能视为录音脚本已发布。本地新构建入口为 `index-DT4WGKzJ.js`。

先发布含 `/api/ExhibitChat/transcribe` 的 WebAPI，再发布 H5 `dist` 全部内容，包含 `worklets/voice-recording.worklet.js`。保持 H5 的 API base URL 指向已发布的 WebAPI。部署后核对前端 bundle 包含 `minimax-voice-20261014`。仅发布 H5 或仅发布后端都不能完成此次切换。

2026-10-24 开关式收音变更：H5 81/81 项测试通过，Vue/TypeScript 检查及 Vite 生产构建成功。H5 构建脚本会为类型检查和 Vite 子进程将 `TEMP`、`TMP`、`TMPDIR` 指向 `apps/h5-client/node_modules/.cache/h5-build`，避免系统临时目录的 esbuild 清理权限错误；不修改系统环境变量。仍使用 `pnpm run build:h5-client` 构建。

前后端测试和供应商回环通过不代表已发布，也不能替代 Android Edge 真机验收。真机应验证导航页、Chat 页、外部“问”入口各提交一次，另测首次授权后直接开始、再次点击停止、关闭取消、弹层与全页切换不断音、波浪线随音量起伏、60 秒自动结束、上传中切后台、朗读时点击提问、有线耳机和蓝牙耳机。
