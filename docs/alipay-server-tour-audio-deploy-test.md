# 支付宝正式持续讲解：部署与验收

> 空闲节目已按最新要求启用：从“中国陶瓷发展史·窦俊杰2小时精华游”提取 5 段真实中文音频，作为通用节目顺序循环，共约 18 分 16 秒，下载和完整 FFmpeg 解码均通过。配置清单与生效步骤见 [陶瓷空闲节目配置](alipay-idle-audio-ceramics-2026-11-11.md)。需同步本次后端配置并创建新媒体会话。

> 最新补充修复原生媒体时间推进但缺失 `Play` 回调时的播放状态同步，诊断版本为 `tour-audio-player-state-20261111`，小程序构建及 590 项测试通过，0 失败、0 跳过。该项仅需重新发布小程序；此前服务端到站修复若尚未部署，仍需同步发布 WebAPI。波形展示不能替代底层播放状态修复，也不能证明真机已经出声。

> 前一轮现场排查已修复部分服务端到站规则差异，并新增锁屏期间的定位质量、候选点和播放阶段诊断；后端相关 54 项测试通过。详细原因、证据与复测步骤见 [锁屏到站与延迟排查](alipay-arrival-latency-audit-2026-11-11.md)。下方 585 / 41 项为更早轮次统计。

> 2026-11-11 最新现场反馈修复已完成：RxJS 串行控制、错误状态与前台重连、按播放器时间同步节点、跟随时只读浏览、空闲节目配置、解码缓存与预取。**本轮必须重新发布 WebAPI 和支付宝小程序两端**，会话上限按最新要求设置为 **120 分钟**。小程序构建及 585 项测试通过，后端音频相关 41 项测试通过，均无失败、无跳过；详见 [现场问题修复与测试记录](alipay-tour-audio-field-fix-2026-11-11.md)。既有 Nginx 流式代理规则和 `/usr/bin/ffmpeg` 路径沿用，无数据库迁移。Android / iPhone 的实际锁屏连续出声仍须分别验收。

本次已实现正式业务链路：司机 APP 定位 → WebAPI 到站判断 → 真实路线音频队列 → 游客媒体会话 → 支付宝后台播放器。同一条 MP3 响应在节点之间继续发送静音；配置空闲节目后，空档改为播放节目，路线讲解优先插入并保留节目的续播位置。游客锁屏期间不需要小程序 JS、WebSocket、心跳或播放结束回调来编排节点。

这份文档取代此前“正式 `/TourAudioSessions` 尚未实现”的交付说明。独立 `AudioContinuityProbe` 仍保留，用于定位手机或代理层问题，正常游览不需要进入验证页。

代码和本地自动化测试不等于 Android / iPhone 真机验收。两个系统仍需分别验证支付宝在真实锁屏、长时间静音之后是否继续读取这条媒体连接。系统强制终止支付宝、网络断开、服务重启后，无法承诺在 JS 不运行时自动重建连接；回到小程序后跟随模式会有限次自动恢复，也可使用“重新连接”。原生播放器已缓存的音频不能由服务器撤回，到站后的实际出声仍可能落后于服务端切换。

## 1. 已接通的业务

- 使用真实发布路线、选定语言、导游章节、前后置音频；节点视频在连续流中提取音轨，手动观看视频仍使用原有视频组件。
- 司机坐标从 GCJ-02 转为 WGS84，按文化点圆形或多边形边界（包含内环）、站点半径、进出阈值判断；拒绝精度超过 65 米、超过 15 秒或明显来自未来的位置。
- 使用不同采样时间的位置累计至少 1.5 秒停留，防止同一坐标被轮询放大为新位置；短距离采样之间检查经过范围，忽略超过 120 米的跨点线段。
- 到站只入队一次；保留终点前序到访条件。已完成、排队、播放过或跳过的节点不会因 GPS 抖动反复插入。跟随模式不再显示“回到现在”；关闭内容页自动返回当前收听节点，不重排队列、不重新连接。旧手动定位流程仍保留原入口。
- 司机房间语音优先播放，路线讲解保留位置；游客问答、暂停、恢复、房间静音、额外音频、手动选站、预览、跳过和进度控制已接入。
- 游客 WebSocket 断开不移除有效媒体订阅；同语言重新入房保留原媒体连接。换语言、退出房间、换账号、结束行程和立即关闭房间会释放媒体会话。
- 前台每两秒读取服务端状态；息屏不依赖游客轮询或续租来编排音频。跟随期间内容页可浏览，播放区显示波形，不能手动播放、重播、拖动、切换导游或抢播视频；关闭跟随后恢复这些操作。
- 跟随期间打开内容或队列不锁住自动讲解，浏览其他节点不改变正在收听的节点。页面播放标题和进度按原生播放器时间匹配服务端媒体时间线；浏览页仍保留用户选择的内容。

服务端区分“音频已播送”和“收听进度已确认”：息屏时可以继续播下一节点，到访记录也会保存；自动完成记录在返回前台后，使用播放器的媒体时间确认并写入。断线时尚未确认的节点允许重播，不把“写入 HTTP 响应”直接当成“游客已经听完”。缺失/失败的主体讲解和向前跳过的内容不会被自动标记完成。

## 2. 发布范围

需要重新发布 **WebAPI 和支付宝小程序两端**。此前部署过正式服务也需要更新：本轮新增了媒体时间线、空闲节目、缓存和编码参数，不能只上传小程序。

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
  "MaxMinutes": 120,
  "MediaBaseUrl": "https://www.omahaaigc.com/",
  "FfmpegPath": "/usr/bin/ffmpeg",
  "DecodedCacheMegabytes": 128,
  "DecodedCacheMinutes": 120,
  "IdleAudio": {
    "Enabled": true,
    "Items": [
      {
        "Title": "陶与瓷的区别",
        "Url": "https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/gameplay-assets/20260823/366817544696397824.mp3",
        "Language": "zh"
      },
      {
        "Title": "青瓷的出现：越窑青瓷",
        "Url": "https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/gameplay-assets/20260823/366817523339001856.mp3",
        "Language": "zh"
      },
      {
        "Title": "宋代五大名窑",
        "Url": "https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/gameplay-assets/20260823/366817543987560448.mp3",
        "Language": "zh"
      },
      {
        "Title": "名窑之外：哥窑与钧窑的缺憾",
        "Url": "https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/gameplay-assets/20260823/366817523099926528.mp3",
        "Language": "zh"
      },
      {
        "Title": "粉彩与珐琅彩",
        "Url": "https://omaha-wenlv.oss-cn-beijing.aliyuncs.com/gameplay-assets/20260823/366817553772871680.mp3",
        "Language": "zh"
      }
    ]
  }
}
```

`MediaBaseUrl` 用于解析相对媒体路径；完整 HTTPS 音频地址使用自身地址。音频地址必须可从服务器通过公网 HTTPS 访问，媒体下载和解码有大小、时长限制；当前上限为单文件 32 MiB、解码 30 分钟，长视频请先提取压缩音轨。系统语音占位或没有已生成文件的章节不能用于锁屏讲解，需要先生成对应语言的音频。

`MaxSessions=16` 是该 WebAPI 实例的同时收听上限，并非房间人数上限。每位游客占用一个 FFmpeg 编码进程和约 96 kbps 下行（约 43.2 MB/小时，120 分钟约 86.4 MB，不含协议开销）。增加人数前应根据机器 CPU、内存和带宽压测，再修改该值。

`MaxMinutes=120` 从媒体会话创建时开始计算；房间剩余有效期更短、关闭房间或结束行程时会提前结束。缓存为进程内共享的已解码音频缓存，128 MiB / 120 分钟限制不代表整个服务的内存上限，也不缓存游客的长媒体响应。空闲节目已启用上述 5 段中文音频；后续可继续向 `Items` 添加节目，每个会话取匹配语言和路线的前 32 项。未设置 `RouteId` 的节目适用于所有匹配语言的路线，详见 [当前节目配置](alipay-idle-audio-ceramics-2026-11-11.md)。

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
2. 游客用支付宝加入同一房间，选择有已生成音频的语言和路线，开始行程并开启“跟随车夫”。跟随期间播放区应显示波形和自动讲解状态。
3. 开发工具或日志应看到创建 `/TourAudioSessions`，随后只有一条 `media.mp3` 长请求。不要通过“我的 → 锁屏音频验证”代替这一步。
4. 司机进入有效节点范围，确认真实讲解自动播放。打开内容页并浏览其他节点：图文可查看，手动播放控件不可用，当前讲解不被打断；打开/关闭内容、队列不应更换媒体 URL。
5. 关闭“跟随车夫”后，确认内容页恢复播放、重播和进度操作，可播放刚浏览的节点，不必退出房间。暂停后应安静；恢复时重建媒体连接以清除旧缓冲。再开启跟随，确认自动讲解恢复。提问并关闭问答后路线可恢复；补充音频、手动视频在关闭跟随后测试。
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
| 内容只读 | 保持跟随，打开内容并切换图文节点 | 可浏览但不可手动播放，当前自动讲解不被抢占 |
| 关闭跟随 | 关闭跟随并播放刚才浏览的节点 | 无需退房，恢复手动播放；再次开启跟随后恢复只读波形 |
| 暂停与恢复 | 关闭跟随，前台手动暂停，等待、移动，再恢复 | 暂停期间不擅自恢复；恢复后按所选内容继续 |
| 问答抢占 | 讲解中提问，结束并关闭问答 | 问答与路线不重叠；路线可恢复 |
| 位置失效 | 关闭司机位置共享，等待超过 15 秒 | 不使用旧位置产生新到站；重新开启后依据新采样判定 |
| GPS 抖动/终点 | 在边界往返，再测试同坐标起终点 | 不重复排队；前序未到访时不触发终点 |
| 断网/重启 | 主动断网再恢复，或测试环境重启 API | 能看见连接错误；前台自动恢复或使用“重新连接”，不冒充锁屏无缝恢复 |
| 空闲节目 | 配置真实素材后，在节目中到站，等待讲解结束 | 路线优先播出，之后节目从被打断的位置续播；记录实际缓冲延迟 |
| 120 分钟 | 新建会话持续运行并记录到期时间 | 有效期与 120 分钟上限一致；到期后清楚提示重新连接，正常行程不因旧 50 分钟配置结束 |

每台手机记录：型号、系统版本、支付宝版本、小程序体验版时间、网络、锁屏时间、每个节点实际出声时间和会话 ID。请用另一台手机录制全过程，避免解锁查看状态反而唤醒 JS。

日志查询：

```bash
sudo journalctl -u cultural-tourism-api --since "30 minutes ago" --no-pager
```

重点匹配 `Tour arrival`、`Tour media connected`、`Tour media disconnected`、`Tour audio decode failed` 和对应会话 ID。服务器显示到站或已播送，只能证明服务端动作；必须另有游客手机在未解锁状态下实际出声的证据。

## 5. 自动化验证与回退

本轮小程序构建及 585 项测试通过，后端音频相关 41 项测试通过，均无失败、无跳过；后端包含真实 FFmpeg 媒体编码、空闲节目被到站打断后续播和持续 HTTP 用例。浏览器模拟 AXML 的 9 种界面组合通过。详见 [现场问题修复与测试记录](alipay-tour-audio-field-fix-2026-11-11.md)。自动化没有替代两小时真机运行，也没有证明所有原生事件顺序都无竞态。

后端正式测试：`CulturalTourismSystem.ApiTests/TourAudioSessionTests.cs`；小程序正式测试：`apps/mp-alipay/tests/server-tour-audio.test.cjs`。

测试覆盖一条持续媒体连接中两次司机位置触发、真实 FFmpeg 编码/解码、静音期间持续输出、无游客心跳/控制请求、鉴权和 HEAD、终点前序、圆形/多边形内环、暂停/问答优先级、预览不写进度、断线重排、旧流确认隔离、异步解码切站和缺失主体音频。

复跑命令：

```powershell
pnpm --filter @path-seeker/mp-alipay test
```

后端仓库：

```powershell
$env:AUDIO_PROBE_FFMPEG = 'C:\ffmpeg\ffmpeg0515\bin\ffmpeg.exe'
dotnet test CulturalTourismSystem.ApiTests/CulturalTourismSystem.ApiTests.csproj --no-restore --filter 'FullyQualifiedName~TourAudio|FullyQualifiedName~TranslationRoomMedia' -m:1 -nr:false
```

FFmpeg 路径换成本机实际路径。未提供该环境变量时真实编码用例会跳过；跳过不能视为媒体测试通过。完整测试统计和 TRX 见本轮交付记录。

回退时把小程序 `serverTourAudio` 改为 `false`，重新构建上传，恢复原有逐文件播放、前端到站调度；后台可再关闭 `TourAudio:Enabled`。只关闭后端开关而仍发布 `serverTourAudio=true` 会显示创建错误，代码不会静默回退并声称仍支持锁屏连续到站。数据库已有行程不需要回滚。
