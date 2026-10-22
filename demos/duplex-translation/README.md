# 持续语音实时翻译 Demo

语音链路按 `96-exhibit-chat-duplex-translation-api.md` 接入 `GET /api/ExhibitChat/translate-realtime` WebSocket。浏览器持续采集麦克风并上传 PCM，服务端负责语音切段、ASR、完整语义提交、翻译及可选朗读；录音和译文输出同时进行。文字输入仍使用文档 95 的 `POST /api/ExhibitChat/translate-with-audio` SSE 接口。

## 本地启动

需要 Node.js 20+，无第三方依赖，无构建步骤。

```powershell
cd demos/duplex-translation
# 尚无配置文件时复制；已有配置不要覆盖
Copy-Item config.example.json config.json
npm start
```

将 `config.json` 中 `apiBaseUrl` 改成真实后端地址。支持站点基址和带 `/api` 的基址，例如 `https://www.omahaaigc.com/path-seeker/api`，不会重复拼接 `/api`。

打开 http://localhost:5179/，无 Token 时自动游客登录，默认场馆为字符串 `610000000000000001`。连接与会话区域保持隐藏，Token 只保存在页面内存，不写入存储或日志。每次开始实时连接都会创建独立会话；刷新会重新登录并创建会话。

| 配置项 | 环境变量 | 默认值 |
| --- | --- | --- |
| `apiBaseUrl` | `TRANSLATION_API_BASE_URL` | `http://localhost:5000` |
| `host` | `TRANSLATION_HOST` | `127.0.0.1` |
| `port` | `TRANSLATION_PORT` | `5179` |
| `basePath` | `TRANSLATION_BASE_PATH` | 空字符串 |

环境变量优先。修改服务端或配置后需要重启 Node；修改页面后刷新即可。调试服务端可使用 `node --watch server/index.js`。

## 操作

1. 分别选择“讲话语言”和“翻译为”，支持八种语言独立组合；讲话语言留“自动识别”时不传 `sourceLanguage`，识别覆盖取决于后端 ASR 能力。
2. 可开启“朗读译文”，填写支持目标语言的音色。
3. 点击“开始聆听”，建立 WebSocket 并收到 `session.started` 后采集麦克风。持续讲话，无需等待上一段译文；译文朗读时录音仍继续。
4. “提交当前音频”发送缓存尾部 PCM 后发送 `input.flush`，继续录音，不强制提交未完成语义。
5. “结束讲话”停止录音，发送最后的 PCM，再发送 `input.end`。连接保持到 `session.done`，已排队朗读继续播放。
6. “停止当前朗读”仅停止本地已排队音频；后续新音频仍可播放，录音与翻译不受影响。
7. “取消连接”立即关闭 WebSocket、停止录音和朗读，剩余未处理内容会取消。

实时连接和文字翻译互斥；连接结束前锁定语言、音色等设置，避免同一连接中途混用参数。需要换方向时先结束讲话并等待处理完成，再选择语言、重新开始。

## 协议实现

- 同源 Node 服务代理 WebSocket Upgrade，上游支持 HTTP 或 HTTPS，沿用配置的 API 子路径。JWT 通过 `translation`、`bearer.<token>` 子协议发送，不放进 URL；只转发服务端协商的子协议。
- AudioWorklet 持续输出浮点采样，跨采样块重采样至 16kHz、单声道 `pcm_s16le`。每约 50ms 发送 1600 字节，不含 WAV 头；末尾不足 50ms 的采样在 flush/end 前发送。不使用前端 VAD 过滤或手工按语音段切分。
- 麦克风停止时先等待 Worklet 已发送采样送达，再提交尾包。收到单段 `done`、`error` 或音频事件均不会停录或取消前段输出。
- 识别序号与翻译序号分别处理。“最近识别原文”保留最近 12 段；翻译卡片使用 `translation.committed` 的原文和 `sourceFrom/sourceTo`，不按相同序号猜测原文。
- `text.delta` 追加当前翻译段；`translation.final` 替换该段增量，避免重复展示。`done` 仅完成当前段，`session.done` 才表示整个队列完成。
- MP3 按事件顺序合并到句末 `isFinal=true` 后串行解码并排期；后续段不重置播放器。语音合成失败保留译文，丢弃该段未完成音频缓存。
- 前一次请求完成后仍可能在朗读。此时提交新的文字翻译或开始新的实时连接，会保留前面的音频并将后续音频接在队尾，上一段播完才播放下一段；只有手动停止朗读、取消或离开页面才主动清空播放队列。网络或合成供给不及时仍可能产生等待间隔。
- 握手失败、协议格式不符、上传积压、意外断线或 `session.error` 会提示错误。断线不自动重连、不重传未确认 PCM；重新开始使用新会话。不能将单段完成误认为整条连接已完成。
- 后端单连接最长 30 分钟，ASR、语义提交与翻译各有有界队列。连续输入超过处理能力可能终止会话；界面分别显示识别、提交、完成及错误段数。

麦克风需要 localhost 或 HTTPS。推荐佩戴耳机，避免译文外放再次进入麦克风。自动识别语言和语义边界效果需要使用真实后端及现场声音验证。

## 线上部署

将整个 `demos/duplex-translation` 上传至服务器即可；新版采音模块已放在本目录，运行时无需旧 `duplex-voice` 目录。

配置示例：

```json
{
  "host": "127.0.0.1",
  "port": 5179,
  "basePath": "/duplex_translation",
  "apiBaseUrl": "https://www.omahaaigc.com/path-seeker/api"
}
```

启动：

```bash
cd /你的部署目录/duplex-translation
pm2 start server/index.js --name duplex-translation
pm2 save
```

在已有 HTTPS Nginx server 块中配置：

```nginx
location = /duplex_translation {
    return 301 /duplex_translation/;
}

location /duplex_translation/ {
    proxy_pass http://127.0.0.1:5179;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Sec-WebSocket-Protocol $http_sec_websocket_protocol;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 1900s;
    proxy_send_timeout 1900s;
    client_max_body_size 12m;
}
```

`proxy_pass` 末尾不要加 `/`，保留部署前缀。WebAPI 自身前面的反向代理也必须放行 WebSocket Upgrade 和子协议；不要记录包含凭据的 `Sec-WebSocket-Protocol`。只更新 Demo 这一层无法修复上游代理未开启 WebSocket 的问题。

```bash
sudo nginx -t
sudo systemctl reload nginx
pm2 restart duplex-translation
```

访问 `https://你的域名/duplex_translation/`。浏览器 Network → WS 中应看到 `translate-realtime` 返回 `101`，Frames 中先出现启动参数和 `session.started`，再出现二进制音频与 JSON 译文事件。页面底部事件日志不记录 Token。

## 验证

```powershell
npm test
```

测试使用本地假后端，覆盖游客初始化、字符串 ID、API 地址拼接、SSE、播放器、跨帧 PCM 重采样、尾包提交、WebSocket 子协议鉴权、持续上传、结束输入、积压保护、代理路径与二进制双向透传。真实 ASR、翻译、音色及线上代理需另行联调。
