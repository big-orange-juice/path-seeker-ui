# 双工语音对话 Demo

一个"能随时被打断、字幕跟着声音走"的 H5 语音对话最小实现。
链路：**浏览器采集/VAD → MiniMax ASR → DeepSeek 流式作答 → 按句切分 → MiniMax 流式 TTS → WebAudio 排期播放**。

- 想了解"豆包式打断"的原理，对照本仓库 `docs/53-c-user-exhibit-chat-realtime-audio-api.md` 阅读即可：那个接口是半双工（一问一答 + 锁步音频），本 demo 在它基础上补上了**上行麦克风链路**和**可取消的生成调度**。
- 零依赖：只用 Node 内置模块 + 浏览器原生 API，不需要构建步骤。

## 快速开始

```bash
cd demos/duplex-voice
node server/index.js          # 等价于 npm start
# 打开 http://localhost:5178
```

先把密钥填进 `config.json`（可以照着 `config.example.json` 比对）：

| 配置项 | 说明 |
| --- | --- |
| `server.port` / `server.host` | 监听地址，默认 `5178` / `0.0.0.0`。上生产建议 `host=127.0.0.1`，由 Nginx 对外 |
| `server.basePath` | 反向代理到子路径时填（如 `/path-seeker/duplex`）；用独立子域名就留空 |
| `deepseek.apiKey` | DeepSeek 密钥，`baseUrl` 默认 `https://api.deepseek.com`，模型默认 `deepseek-flash` |
| `minimax.apiKey` | MiniMax 密钥，`baseUrl` 默认 `https://api.minimax.cn` |
| `minimax.voiceId` | 音色 ID，例如 `male-qn-qingse`；在 MiniMax 控制台复制你想用的音色 |
| `minimax.ttsModel` | 合成模型，默认 `speech-2.8-turbo`；也可用 `speech-2.6-*` / `speech-02-*` |
| `minimax.asrModel` | 识别模型，默认 `asr-1.0`；`asrLanguage` 默认 `zh` |
| `minimax.format` | 默认 `mp3`；改成 `pcm` 会走"每个分片直接排期"的更低保真路径 |
| `minimax.subtitle` | 默认 `true`：请求 `subtitle_type: word_streaming`，流式分片会带 `data.subtitle.timestamped_words`（毫秒级词时间戳），前端据此做真正的逐词卡拉OK高亮；关掉则退回按播放进度估算 |
| `voice.*` | 浏览器端 VAD / 打断参数，服务端通过 `hello` 事件下发，改这里即可，不用动前端代码 |
| `mock.enabled` | 没有密钥时置 `true`：用正弦波假音频跑通"打断 + 字幕同步 + 排期播放"整条链路 |

实测（MiniMax `speech-2.8-turbo` + 克隆音色 + DeepSeek `deepseek-flash`，本机）：首字 0.4~0.8s，首音 0.7~1.5s，识别（2~3s 语音）约 0.9s。

### 调试入口

- 服务端：每轮失败会把原因打在启动终端（格式 `turn xxx 失败：...`）。
- 浏览器控制台：`window.__demo.state`（含 `debug.events` 与 `debug.lastProgress`）、`window.__demo.player.debug()`（timeline / 解码队列 / 声源数），排"没声音""字幕不动"时先看这两个。

> 密钥只存在于服务端进程内，浏览器拿不到；`config.json` 已在 `.gitignore` 里，不会被提交。

### 没有密钥先看效果

把 `config.json` 的 `mock.enabled` 改成 `true`，或在启动时加环境变量：

```bash
DEMO_MOCK=1 node server/index.js
```

mock 模式会用假文本 + PCM 正弦波替代真实模型，其它流程（切句、锁步音频、打断、字幕同步、排期播放）完全一致。

### 服务端链路冒烟（不开浏览器）

```bash
node scripts/check-providers.mjs   # 逐项验证 DeepSeek / 合成 / 音色归属 / 识别，并打印耗时
node scripts/smoke.mjs             # 连 SSE 发一轮，并在收到首段音频后主动打断
```

`check` 会输出首字延迟、首包延迟、音色是否在当前账号下、ASR 回环识别文本，是排查配置最快的入口。

## 打断是怎么做出来的

1. **本地先停，不等网络**：麦克风帧的能量超过阈值（播放期间用更高的 `bargeInRms` + 更长的判定窗口）→ 立即 `stop()` 所有已排期的 `AudioBufferSourceNode` 并清空缓冲队列，界面立刻安静；
2. **通知服务端取消**：同时 `POST /api/barge-in`，服务端 `AbortController.abort()` 掉在飞的 DeepSeek 请求和 MiniMax 合成请求（客户端断开连接同样会取消）；
3. **丢弃迟到分片**：客户端把 `turnKey` 置空并给播放器加 `blocked` 标记，打断前发出、打断后到达的 `audio.chunk` 一律丢弃；
4. **按播放位置回填上下文**（进阶但已实现）：客户端记录"实际开始播放过的句子"，用户说完后随下一轮 `/api/turn` 的 `heardText` 一起上传，服务端把它作为被打断的助手发言补进历史，模型因此知道用户到底听到了哪半句。

> 打断要成立，必须打开浏览器的回声消除（`echoCancellation: true`，见 `public/js/mic.js`）。否则 TTS 的声音会被麦克风再次采到，VAD 会自己打断自己。外放音量很大时，可把 `voice.bargeInRms` 调高或改用耳机。

## 字幕为什么"跟得上"声音

- 服务端先按标点把 LLM 输出切成"可朗读短句"（首句放宽到 8 个字符 + 逗号，尽量早出声），**每句的文本和它的音频用同一个 `index` 绑定**；
- 音频走 `OrderedTtsPipeline`：允许提前向 MiniMax 发起下一句合成，但下发必须严格按 `index` 顺序，避免前端拼接错位；
- 气泡生命周期跟随"播放"而不是跟随"下发"：`turn.done` 只说明音频都发完了，此时可能还在解码/排队/播放，所以要用 `player.isBusy()`（含解码中的 MP3）判断；
- 前端用 WebAudio 时钟排期（`source.start(playhead)`），句与句之间自然衔接；
- MiniMax 返回的词级时间戳（`data.subtitle.timestamped_words`，单位 ms）驱动**逐词真实对齐**：当前词泛铜光、读过的词变亮；时间戳是逐帧变长的，所以每来一帧都要重建词表并补回进度；拿不到时间戳时退回"按句内播放进度等分估算"。

## 事件协议（SSE）

| 事件 | 方向 | 说明 |
| --- | --- | --- |
| `hello` | S→C | 音频格式、采样率、音色、VAD 参数、是否为 mock |
| `turn.start` | S→C | 新一轮开始，`source` 为 `voice` / `text` |
| `asr.start` / `asr.result` | S→C | 识别开始 / 识别文本与耗时 |
| `user.text` | S→C | 用户这一轮的最终文本 |
| `text.delta` | S→C | 第 `index` 句的文本已确定（用于渲染字幕） |
| `audio.chunk` | S→C | 第 `index` 句的音频分片（hex），`isFinal` 表示该句合成结束 |
| `interrupted` | S→C | 当前轮已被打断（用户插话或被新一轮顶掉） |
| `turn.done` / `error` | S→C | 本轮终态或错误 |
| `session.reset` | S→C | 历史已清空 |

上行接口：`GET /api/events?session=`、`POST /api/turn`（`text` 或 `audioBase64` + `heardText` + `turnKey`）、`POST /api/barge-in`、`POST /api/reset`。

## 目录结构

```
demos/duplex-voice
├── config.json / config.example.json   # 密钥与参数（config.json 不提交）
├── server
│   ├── index.js            # 静态托管 + SSE + REST，唯一入口
│   ├── orchestrator.js     # 一轮对话的编排与打断语义
│   ├── tts-pipeline.js     # 有序 TTS 流水线（提前合成、按序下发）
│   ├── segmenter.js        # 可朗读短句切分 + TTS 文本清洗
│   ├── minimax.js          # 识别 + 流式合成
│   ├── deepseek.js         # 流式对话
│   └── mock.js             # 无密钥时的假数据源
├── public
│   ├── index.html / styles.css / app.js
│   ├── js/mic.js           # 麦克风采集（AudioWorklet）
│   ├── js/turn-detector.js # VAD 切轮 + WAV 编码
│   ├── js/player.js        # WebAudio 排期播放 + 打断清空 + 播放进度
│   └── js/audio-utils.js
└── scripts/smoke.mjs
```

## 部署到服务器

和 `web-admin` 同一套做法：**Nginx 负责 TLS 与路由，Node 单实例跑在 127.0.0.1 后面**。零依赖、无构建步骤，把目录拷过去就能跑。

```
浏览器 --https--> Nginx(443, bigorange.site) --http--> Node(127.0.0.1:5178)
                                                            |-- MiniMax api.minimaxi.com
                                                            |-- DeepSeek api.deepseek.com
```

### 1. 服务器准备

- Node ≥ 20（`node -v`）。不够新就装 NodeSource 源或 nvm，不需要 `npm install`（无依赖）。
- 部署目录：`/usr/zhm/demo_tts`（与其它项目并列）。

### 2. 上传代码（不要把本地密钥传上去）

```bash
rsync -av --exclude node_modules --exclude config.json \
  demos/duplex-voice/ zhm@bigorange.site:/usr/zhm/demo_tts/
```

### 3. 服务器上的配置与密钥

配置优先级：环境变量 > `DEMO_CONFIG` 指定的文件 > 仓库内 `config.json`。推荐把配置放到仓库外并收紧权限：

```bash
cp /usr/zhm/demo_tts/config.example.json /etc/path-seeker/demo-tts.config.json
vi /etc/path-seeker/demo-tts.config.json        # 填两个 Key、voiceId，并把 server 段改成部署值
chmod 600 /etc/path-seeker/demo-tts.config.json
```

部署值的 `server` 段（也可以全部走环境变量）：

```json
"server": { "port": 5178, "host": "127.0.0.1", "basePath": "/demo_tts", "https": { "enabled": false } }
```

### 4. 启动进程

仓库里已带 `ecosystem.config.cjs`（`name: demo-tts`，`DEMO_BASE_PATH=/demo_tts`）：

```bash
cd /usr/zhm/demo_tts
pm2 start ecosystem.config.cjs
pm2 logs demo-tts --lines 30              # 看启动日志与每轮失败原因
pm2 save && pm2 startup                    # 开机自启
curl -s http://127.0.0.1:5178/demo_tts/api/health
```

不想用 pm2 就用 systemd 单元：`ExecStart=/usr/bin/node /usr/zhm/demo_tts/server/index.js`，`Environment=` 里同样支持 `DEMO_CONFIG=…`、`DEMO_HOST=127.0.0.1`、`DEMO_PORT=5178`、`DEMO_BASE_PATH=/demo_tts`。

### 5. 接 Nginx

把 `deploy/nginx.demo-tts.conf` 放到 `/etc/nginx/snippets/`，在 `www.bigorange.site` 的 443 server 块里和现有的 `path-seeker.conf` 并列 include：

```nginx
include /etc/nginx/snippets/path-seeker.conf;
include /etc/nginx/snippets/demo-tts.conf;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://www.bigorange.site/demo_tts/          # 期望 200/handler 能到 Node
curl -s https://www.bigorange.site/demo_tts/api/health # 期望 {"ok":true,...}
```

片段里已处理三件容易翻车的事：`proxy_buffering off`（SSE 不缓冲）、`client_max_body_size 12m`（上行整段 WAV）、`proxy_read_timeout 300s`（一轮对话 + SSE 心跳）。

### 6. 必须注意

- **麦克风一定要 HTTPS**：`getUserMedia` 只在 https 或 localhost 下可用；现在挂在 `https://www.bigorange.site/demo_tts/` 下即可直接用（证书复用现有域名）。
- **演示页没有登录态**：谁拿到地址都能消耗你的接口额度。Nginx 片段里预留了 `auth_basic` / IP 白名单 / `limit_req` 三行注释，上公网至少开一层；更稳妥的是只在内网或 VPN 里开放。
- **单实例**：会话状态（历史、打断目标）在进程内存里，pm2 保持 `instances: 1`；确实要多实例就得在 Nginx 上按 `ip_hash` 做粘性，否则一打断/连续追问就会串会话。
- **成本与风控**：MiniMax 按字符计费、DeepSeek 按 token 计费；建议先看 `scripts/check-providers.mjs` 的耗时，再给 `/api/turn` 加 `limit_req` 防刷，并在两家控制台设置额度告警。
- 子域名挂法（推荐给外部演示）：新增 `voice.xxx.com` 的 server 块，`server.basePath` 留空，把 `location /` 转发到 `127.0.0.1:5178`，证书用 certbot 申请。
### 排查

| 现象 | 检查点 |
| --- | --- |
| 页面能开、提问后长时间没声音 | SSE 被缓冲：`curl -N "https://www.bigorange.site/demo_tts/api/events?session=test"` 看事件是不是实时逐条出来；同时确认 Nginx 加了 `proxy_buffering off` |
| 手机打开没麦克风 | 是否 https；控制台是否有 `getUserMedia` 权限错误 |
| 长句提问报错 / 400 | Nginx `client_max_body_size` 是否为 12m（默认 1m） |
| 首音很慢 | 先在页面 HUD 看是识别、首字还是首音慢；再看服务器到 `api.minimaxi.com` / `api.deepseek.com` 的网络延迟 |
| 一说话就打断自己 | 外放回声：调高 `voice.bargeInRms`、`voice.bargeInHoldMs`，或让用户戴耳机 |

## 常见问题

- **手机打开没有麦克风**：`getUserMedia` 只在 `https` 或 `localhost` 下可用。手机测试建议开 `server.https`（配置自签证书）或用内网穿透，也可以在 Chrome 的 `chrome://flags/#unsafely-treat-insecure-origin-as-secure` 里临时放行你的内网地址。
- **一说话助手就停**：说明 AEC 没生效或阈值太低，调高 `voice.bargeInRms`、`voice.bargeInHoldMs`，并确认没有把扬声器音量开到最大。
- **识别结果为空**：`minimax.asrModel` / `asrLanguage` 与账号权限不符，或说话太短（小于 0.35s 会被丢弃）；事件日志里能看到原始错误。
- **首音延迟太高**：先看 HUD 的三个指标定位瓶颈（识别 / 首字 / 首音）。识别是"整段上传"模式，用户停顿判定（`silenceEndMs`）也会直接叠加到体感延迟上，可以适当调小。
- **想接别的模型**：`server/minimax.js`、`server/deepseek.js` 各只有一个导出函数，换供应商只需替换这两个文件；事件协议与前端都不用动。
