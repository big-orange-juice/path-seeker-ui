# 支付宝正式持续讲解：部署与验收

> 2026-11-11 真机无声回归修复：已修复持续流重连误挂起、播放按钮误暂停空闲流、退房时重建媒体会话等小程序端问题。已发布正式 WebAPI 的环境，本轮只需重新构建、上传支付宝小程序。具体修复证据和原地测试顺序见 [无声回归修复与复测](alipay-tour-audio-silent-recovery-2026-11-11.md)。实际 Android / iPhone 出声及锁屏切站仍须真机确认。

本次已实现正式业务链路：司机 APP 定位 → WebAPI 到站判断 → 真实路线音频队列 → 游客媒体会话 → 支付宝后台播放器。同一条 MP3 响应在节点之间继续发送静音，新节点由服务器插入；游客锁屏期间不需要小程序 JS、WebSocket、心跳或播放结束回调来切换节点。

这份文档取代此前“正式 `/TourAudioSessions` 尚未实现”的交付说明。独立 `AudioContinuityProbe` 仍保留，用于定位手机或代理层问题，正常游览不需要进入验证页。

代码和本地自动化测试不等于 Android / iPhone 真机验收。两个系统仍需分别验证支付宝在真实锁屏、长时间静音之后是否继续读取这条媒体连接。系统强制终止支付宝、网络断开、服务重启后，无法承诺在 JS 不运行时自动重建连接；回到小程序可点击播放恢复。

## 1. 已接通的业务

- 使用真实发布路线、选定语言、导游章节、前后置音频；节点视频在连续流中提取音轨，手动观看视频仍使用原有视频组件。
- 司机坐标从 GCJ-02 转为 WGS84，按文化点圆形或多边形边界（包含内环）、站点半径、进出阈值判断；拒绝精度超过 65 米、超过 15 秒或明显来自未来的位置。
- 使用不同采样时间的位置累计至少 1.5 秒停留，防止同一坐标被轮询放大为新位置；短距离采样之间检查经过范围，忽略超过 120 米的跨点线段。
- 到站只入队一次；保留终点前序到访条件。已完成、排队、播放过或跳过的节点不会因 GPS 抖动反复插入。点击“回到现在”可重新依据当前位置排队。
- 司机房间语音优先播放，路线讲解保留位置；游客问答、暂停、恢复、房间静音、额外音频、手动选站、预览、跳过和进度控制已接入。
- 游客 WebSocket 断开不移除有效媒体订阅；同语言重新入房保留原媒体连接。换语言、退出房间、换账号、结束行程和立即关闭房间会释放媒体会话。
- 前台每两秒读取服务端状态；息屏不轮询、不续租也能排队播放。页面内容抽屉的临时切站锁在息屏时解除，用户明确开启的“锁定内容”仍然生效。

服务端区分“音频已播送”和“收听进度已确认”：息屏时可以继续播下一节点，到访记录也会保存；自动完成记录在返回前台后，使用播放器的媒体时间确认并写入。断线时尚未确认的节点允许重播，不把“写入 HTTP 响应”直接当成“游客已经听完”。缺失/失败的主体讲解和向前跳过的内容不会被自动标记完成。

## 2. 发布范围

需要重新发布 **WebAPI 和支付宝小程序两端**。此前已发布的探针版本不包含本次正式服务。

后端源码：`D:\workspace\amh\code\CulturalTourism\git_src\CulturalTourism_System`。

新增后端：

- `CulturalTourismSystem.WebApi/Controllers/TourAudioSessionsController.cs`
- `CulturalTourismSystem.Service/Chat/TourAudioSessionService.cs`
- `CulturalTourismSystem.Service/Chat/TourAudioSource.cs`
- `CulturalTourismSystem.Service/Chat/TourArrivalTracker.cs`

同时发布服务注册、房间同语言重连修复、请求模型和配置文件。使用正常项目发布产物，不要只复制控制器源码到 Linux。

### 2.1 后端配置

已直接写入 `CulturalTourismSystem.WebApi/appsettings.json`：

```json
"TourAudio": {
  "Enabled": true,
  "MaxSessions": 16,
  "MaxMinutes": 240,
  "MediaBaseUrl": "https://www.omahaaigc.com/",
  "FfmpegPath": "/usr/bin/ffmpeg"
}
```

`MediaBaseUrl` 用于解析相对媒体路径；完整 HTTPS 音频地址使用自身地址。音频地址必须可从服务器通过公网 HTTPS 访问，媒体下载和解码有大小、时长限制；当前上限为单文件 32 MiB、解码 30 分钟，长视频请先提取压缩音轨。系统语音占位或没有已生成文件的章节不能用于锁屏讲解，需要先生成对应语言的音频。

`MaxSessions=16` 是该 WebAPI 实例的同时收听上限，并非房间人数上限。每位游客占用一个 FFmpeg 编码进程和约 48 kbps 下行（约 22 MB/小时）。增加人数前应根据机器 CPU、内存和带宽压测，再修改该值。

媒体会话、房间和音频队列目前保存在进程内；沿用单 WebAPI 实例部署。不要将这些请求随机分配给多个实例。进程重启后游客需要返回小程序重新开始收听；已有数据库游览进度保留。无需数据库结构迁移。

在 Linux 确认运行用户可执行 FFmpeg：

```bash
sudo -u www-data /usr/bin/ffmpeg -version
sudo systemctl restart cultural-tourism-api
sudo systemctl status cultural-tourism-api --no-pager
```

若 systemd 服务运行用户不同，第一条替换为实际用户。

### 2.2 Nginx

在 `www.omahaaigc.com` 的 HTTPS `server` 中加入以下两个 `location`。WebAPI 与 Nginx 同机且监听 8199 时，保留 `127.0.0.1:8199`。只有 API 在其他主机或容器网络时才替换上游。

```nginx
location = /path-seeker/api/TourAudioSessions {
    proxy_pass http://127.0.0.1:8199/api/TourAudioSessions;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 120s;
}

location ^~ /path-seeker/api/TourAudioSessions/ {
    proxy_pass http://127.0.0.1:8199/api/TourAudioSessions/;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    gzip off;
    proxy_read_timeout 18000s;
    proxy_send_timeout 30s;
    send_timeout 30s;
    access_log off;
}
```

媒体票据在 URL 查询参数里，所以这段不记录包含完整票据的访问日志。业务日志仍可按 `SessionId` 查询。上游若另有 CDN、网关或 WAF，也要对媒体路径禁用缓存、响应聚合并允许长连接。

```bash
sudo nginx -t
sudo systemctl reload nginx
```

已有 `AudioContinuityProbe` 代理可继续保留，但它不会覆盖新 `/TourAudioSessions` 路径。

### 2.3 小程序

`apps/mp-alipay/src/config.js` 中保持：

```js
apiBase: 'https://www.omahaaigc.com/path-seeker/api',
background: true,
backgroundAudio: true,
serverTourAudio: true,
```

以上 `serverTourAudio=true` 已在当前工作区保留。执行：

```powershell
pnpm --filter @path-seeker/mp-alipay build
```

支付宝开发者工具打开 `apps/mp-alipay/dist`，使用当前应用 `2021007110628321` 上传新的体验版。确认请求域名和音频下载域名配置允许 `https://www.omahaaigc.com`，并沿用现有后台音频声明。测试手机必须使用这次新体验版。

新建会话接口是 `POST /path-seeker/api/TourAudioSessions`，使用游客登录凭证。它需要真实的字符串 `roomId / visitId / routeId`；返回 `sessionId / mediaUrl / state`。音频 GET 使用返回的媒体票据，控制和状态接口仍要求游客登录。不要把媒体 URL 或游客凭证发到公开群。

## 3. 出发前原地测试

1. 司机 APP 登录、开房、开启位置共享，确认服务器能持续收到司机新定位。测试自动路线讲解时先暂停司机实时讲话，避免其按优先级持续占用音频。
2. 游客用支付宝加入同一房间，选择有已生成音频的语言和路线，开始行程；允许跟随司机，开启自动播放，关闭明确的“锁定内容”。
3. 开发工具或日志应看到创建 `/TourAudioSessions`，随后只有一条 `media.mp3` 长请求。不要通过“我的 → 锁屏音频验证”代替这一步。
4. 手动点击当前节点，确认听到真实讲解。打开/关闭内容、队列应不重新创建媒体 URL。暂停后应安静；恢复时重建媒体连接以清除暂停期间的静音缓冲，未确认的节点可能重播。
5. 提问一次并关闭问答，确认路线声音恢复。单独播放补充音频、手动观看视频并返回，确认不丢失持续讲解能力。
6. 切到其他应用再返回，确认房间重连没有让持续音频断掉。切换游客账号或退出房间后，旧连接必须停止。

若创建接口 404，检查新 WebAPI 和 Nginx 路径。若创建时报 FFmpeg 失败，检查配置与运行用户执行权限。若一直静音，先看状态的 `stageId / queue / error / driverSampledAt`：没有新鲜司机位置、主体音频缺失、自动播放关闭、锁定内容或司机正在讲话都会影响节点播放。

## 4. 正式现场验收：Android 和 iPhone 分别执行

准备连续三个有真实讲解和正确触发范围的节点 A、B、C。使用新行程，避免“已经完成/已排队/已跳过”的去重条件影响判断。两台游客手机使用不同账号；司机位置来自 APP，游客不必安装 APP。

| 步骤 | 操作 | 必须观察到 |
| --- | --- | --- |
| 前台基线 | 进入 A，播放讲解 | A 的真实音频正常，日志记录 A 到站 |
| 播放中锁屏 | A 播放中按电源键锁屏，断开 USB/调试器 | A 能继续播放 |
| 静音后新节点 | A 播完后屏幕保持关闭，再进入 B | 无任何手机操作，B 的真实音频自动响起 |
| 第二次触发 | B 播完，继续保持锁屏，进入 C | C 也自动响起，不能只验证一次切换 |
| 长时间静音 | 在节点外等待至少 5 分钟，再进入一个未触发节点 | 屏幕仍关闭时自动出声 |
| 长时间运行 | 连续运行至少 15 分钟，期间多次经过节点 | 媒体连接持续，节点不重复、不漏触发 |
| 回前台 | 解锁并返回游览 | 页面同步服务端节点、队列、到访和可确认的收听进度 |
| 暂停与恢复 | 前台手动暂停，等待、移动，再恢复 | 暂停期间不擅自恢复；恢复后按队列继续 |
| 问答抢占 | 讲解中提问，结束并关闭问答 | 问答与路线不重叠；路线可恢复 |
| 位置失效 | 关闭司机位置共享，等待超过 15 秒 | 不使用旧位置产生新到站；重新开启后依据新采样判定 |
| GPS 抖动/终点 | 在边界往返，再测试同坐标起终点 | 不重复排队；前序未到访时不触发终点 |
| 断网/重启 | 主动断网再恢复，或测试环境重启 API | 能看见连接错误；返回小程序点击播放恢复，不冒充锁屏无缝恢复 |

每台手机记录：型号、系统版本、支付宝版本、小程序体验版时间、网络、锁屏时间、每个节点实际出声时间和会话 ID。请用另一台手机录制全过程，避免解锁查看状态反而唤醒 JS。

日志查询：

```bash
sudo journalctl -u cultural-tourism-api --since "30 minutes ago" --no-pager
```

重点匹配 `Tour arrival`、`Tour media connected`、`Tour media disconnected`、`Tour audio decode failed` 和对应会话 ID。服务器显示到站或已播送，只能证明服务端动作；必须另有游客手机在未解锁状态下实际出声的证据。

## 5. 自动化验证与回退

本地验证：小程序 407 项通过；后端相关测试 128 项通过、1 项数据库环境用例跳过；最后的恢复缓冲修复另有 11 项针对性复测通过；正式 HTTP 连续媒体测试通过。具体范围与报告见 [本轮验证记录](alipay-server-tour-audio-validation-2026-11-11.md)。

后端正式测试：`CulturalTourismSystem.ApiTests/TourAudioSessionTests.cs`；小程序正式测试：`apps/mp-alipay/tests/server-tour-audio.test.cjs`。

测试覆盖一条持续媒体连接中两次司机位置触发、真实 FFmpeg 编码/解码、静音期间持续输出、无游客心跳/控制请求、鉴权和 HEAD、终点前序、圆形/多边形内环、暂停/问答优先级、预览不写进度、断线重排、旧流确认隔离、异步解码切站和缺失主体音频。

复跑命令：

```powershell
pnpm --filter @path-seeker/mp-alipay test
```

后端仓库：

```powershell
$env:AUDIO_PROBE_FFMPEG = 'C:\ffmpeg\ffmpeg0515\bin\ffmpeg.exe'
dotnet test CulturalTourismSystem.ApiTests/CulturalTourismSystem.ApiTests.csproj --no-restore --filter 'FullyQualifiedName~TourAudioSessionTests|FullyQualifiedName~TranslationRoomMediaTests' -m:1 -nr:false
```

FFmpeg 路径换成本机实际路径。未提供该环境变量时真实编码用例会跳过；跳过不能视为媒体测试通过。完整测试统计和 TRX 见本轮交付记录。

回退时把小程序 `serverTourAudio` 改为 `false`，重新构建上传，恢复原有逐文件播放、前端到站调度；后台可再关闭 `TourAudio:Enabled`。只关闭后端开关而仍发布 `serverTourAudio=true` 会显示创建错误，代码不会静默回退并声称仍支持锁屏连续到站。数据库已有行程不需要回滚。
