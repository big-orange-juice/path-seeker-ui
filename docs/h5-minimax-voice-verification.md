# H5 MiniMax 语音输入

当前生产入口使用录音上传方案：`getUserMedia → AudioWorklet → 单声道 16kHz/16bit WAV → POST /api/ExhibitChat/transcribe → MiniMax ASR → 原有问答与 TTS`。

导航页、外部“问”入口、Chat 页和问答 store 共用 `useMinimaxVoiceRecognition` 的唯一控制器。同一时间只有一轮录音或上传，每轮资源独立；取消后的迟到授权和识别结果只属于旧会话。

## 操作与边界

- 按住申请麦克风并录音，松手上传，等待识别结果后自动发送问题。
- 第一次授权弹窗期间已经松手时，不自动录音或发送；允许权限后再次按住。
- 上滑取消、页面切后台或操作结束均释放录音轨道。导航松手交接给问答 store 后，来源组件卸载不取消上传；问答 store 负责切后台取消。
- 长按期间麦克风按钮保持可用，防止 busy 状态把正在持有的按钮禁用并破坏手势。
- 重复松手返回同一完成 Promise，只上传一次。短于 200ms 的有效音频不上传；最多保存 60 秒音频。
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

前后端测试和供应商回环通过不代表已发布，也不能替代 Android Edge 真机验收。真机应验证导航页、Chat 页、外部“问”入口各提交一次，另测首次授权、上滑取消、立即再次按住、上传中切后台、朗读时按住提问、有线耳机和蓝牙耳机。
