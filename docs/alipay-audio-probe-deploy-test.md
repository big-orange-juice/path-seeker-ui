# 支付宝锁屏音频验证：部署与真机测试

最新补测结果和可直接填写的现场步骤见 [2026-11-11 现场验证操作表](alipay-field-validation-2026-11-11.md)，包含普通导览回归、真实 15 分钟服务端持续流、Android / iPhone 锁屏与异常测试。

本次已将验证功能接入现有 .NET WebAPI 和支付宝小程序。无需另建 Node 服务、数据库表、域名或购买音频服务；WebAPI 所在服务器需要 FFmpeg。

**交付边界：这是完整可部署的锁屏媒体能力验证入口，还不是正式的景点到站自动讲解。** 正式导览的 `serverTourAudio` 保持 `false`，`/TourAudioSessions` 业务控制器和完整服务端到站编排尚未完成。Android 和 iPhone 仍须按本说明分别实测；单元测试、HTTP 收到字节、播放器回调都不能替代锁屏实际出声。

## 1. 本次功能与原理

- 小程序入口：**我的 → 锁屏音频验证**，也可在开发者工具设置启动页 `pages/audio-probe/index`。
- 新控制器：`CulturalTourismSystem.WebApi/Controllers/AudioContinuityProbeController.cs`。
- 新服务：`CulturalTourismSystem.Service/Chat/AudioContinuityProbeService.cs`；已注册到现有 WebAPI。
- 手动模式：一条最长 20 分钟的 MP3 流，电脑随时插入一声、两声或三声提示音。
- 定时模式：同一条流在媒体开始后的第 60、300、900 秒由服务器自动插入提示音。
- 有限文件模式：真正的 30 秒 MP3 文件，有 `Content-Length`、支持 HTTP Range；第 0、10、20 秒分别为一声、两声、三声。
- 三种模式都在前台启动一次 `my.getBackgroundAudioManager()`。持续模式的静音间隔仍发送有效 MP3 帧，下一组声音由服务器直接编码到原连接。
- JS 每 5 秒发送一次诊断心跳，**不参与会话续期、排队或媒体生成**。心跳停了也不应阻止服务端插入音频。
- 返回前台不会重设音源或自动恢复系统面板暂停；连续流意外结束会保留错误，不靠重连掩盖中断。

因此，上一组声音播完后，持续模式不会结束媒体响应：它继续发送静音，等待后续声音。手机能否在锁屏、静音几分钟后继续解码并发声，正是本次要验证的条件。

## 2. 部署 WebAPI

后端源码目录：`D:\workspace\amh\code\CulturalTourism\git_src\CulturalTourism_System`。

### 2.1 安装并确认 FFmpeg

以 Ubuntu / Debian 为例：

```bash
sudo apt-get update
sudo apt-get install ffmpeg
/usr/bin/ffmpeg -hide_banner -encoders | grep libmp3lame
sudo -u www-data /usr/bin/ffmpeg -version
```

最后两条应能找到 `libmp3lame`，并且 WebAPI 运行用户有执行权限。其他发行版安装相应 FFmpeg 包；Windows 使用实际 `ffmpeg.exe` 绝对路径。

### 2.2 发布现有项目

沿用当前 WebAPI 发布流程即可。若服务器是 Linux x64，可以在后端仓库执行：

```powershell
dotnet publish CulturalTourismSystem.WebApi/CulturalTourismSystem.WebApi.csproj -c Release -r linux-x64 --self-contained false -o artifacts/audio-probe-webapi
```

把该次完整发布产物通过现有部署流程更新到服务器，保留生产配置、上传文件和密钥。仓库现有 systemd 文件使用目录 `/usr/zhm/ct_web_api/publish`，服务名为 `cultural-tourism-api`；以实际服务器配置为准。依赖 .NET 10 运行时。ARM 服务器使用相应 RID，别部署 x64 产物。

### 2.3 开启验证开关

服务代码在未配置时默认关闭；当前项目的 `appsettings.json` 已按本次要求配置为开启、并发 4 路、FFmpeg 路径 `/usr/bin/ffmpeg`。部署这份配置即可。若服务器保留了旧配置，或选择通过环境变量覆盖，执行：

```bash
sudo systemctl edit cultural-tourism-api
```

加入以下覆盖配置：

```ini
[Service]
Environment="AudioContinuityProbe__Enabled=true"
Environment="AudioContinuityProbe__MaxSessions=4"
Environment="TourAudio__FfmpegPath=/usr/bin/ffmpeg"
```

也可以将以下段落合并到实际生效的 `appsettings.Production.json`，不要替换整个文件：

```json
{
  "AudioContinuityProbe": { "Enabled": true, "MaxSessions": 4 },
  "TourAudio": { "FfmpegPath": "/usr/bin/ffmpeg" }
}
```

然后：

```bash
sudo systemctl daemon-reload
sudo systemctl restart cultural-tourism-api
sudo systemctl status cultural-tourism-api --no-pager
```

同一账号重新开始会结束旧轮；默认最多 4 个活动会话，最多允许配置 16 个。每个持续会话使用一个 FFmpeg 编码进程。会话保存在进程内，**本轮验证相关请求必须路由到同一个 WebAPI 实例**。多实例时请为这个路径指定一个实例，或使用覆盖创建、媒体、控制请求的一致路由；不能只依赖浏览器 Cookie 粘性，因为电脑控制页和手机播放器不共享 Cookie。重启会结束现有验证。

## 3. 反向代理必须允许持续音频

当前小程序 API 基址为 `https://www.omahaaigc.com/path-seeker/api`。验证继续使用同一域名。

Nginx 可在对应 HTTPS `server` 块添加以下专用 location。**先把 `EXISTING_WEBAPI_UPSTREAM` 换成现有 WebAPI 的实际上游地址**，例如现有配置里的 `127.0.0.1:5000`。这里不是新端口或新服务。现有部署若有不同的路径改写规则，保留其最终映射到 `/api/AudioContinuityProbe/...` 的行为。

```nginx
location ^~ /path-seeker/api/AudioContinuityProbe/ {
    proxy_pass http://EXISTING_WEBAPI_UPSTREAM/api/AudioContinuityProbe/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_request_buffering off;
    proxy_cache off;
    gzip off;
    proxy_read_timeout 1500s;
    proxy_send_timeout 1500s;
    send_timeout 1500s;
    access_log off;
}
```

```bash
sudo nginx -t
sudo systemctl reload nginx
curl -I https://www.omahaaigc.com/path-seeker/api/AudioContinuityProbe/control
```

控制页应该返回 HTTP 200 和 HTML 类型。仅打开控制页不代表编码器可用；需在小程序开始一轮验证。若还有 CDN、网关、WAF、IIS，也要允许至少 25 分钟的响应，不缓存、不合并缓冲 MP3 流。IIS/ASP.NET Core Module 的进程外托管还需调整请求超时。

媒体地址携带本轮临时播放票据，控制权限使用另一枚口令；不使用账号 JWT 作为媒体 URL 参数。不要把完整媒体 URL 写入访问日志或遥测。若 ASP.NET Core 请求日志处于 Information 级别，可在实际配置中将 `Logging:LogLevel:Microsoft.AspNetCore.Hosting.Diagnostics` 设置为 `Warning`，避免记录带票据的请求 URL。电脑控制链接的口令放在 `#` 片段中，打开后页面移除该片段，后续使用 `X-Probe-Control` 请求头。

## 4. 发布支付宝小程序体验版

在前端仓库 `D:/workspace/amh/code/CulturalTourism/web/path-seeker-ui` 执行：

```powershell
pnpm --filter @path-seeker/mp-alipay test
pnpm --filter @path-seeker/mp-alipay build
```

开发者工具导入 `apps/mp-alipay`，其 `mini.project.json` 指向 `dist`；已有工程直接重新编译上传。也可导入构建好的 `apps/mp-alipay/dist`。

本次配置：

```js
background: true,
backgroundAudio: true,
audioContinuityProbe: true,
serverTourAudio: false
```

确认支付宝后台已配置当前 HTTPS 域名的请求/音频相关合法域名要求。使用体验版在真实支付宝里测试，关闭开发者调试和 USB 调试连接；模拟器、电脑浏览器能播都不能判定手机通过。若提示当前客户端不支持后台音频 API，不会退回前台播放器冒充通过。

## 5. 真机测试流程

准备 Android、一台 iPhone 和一台电脑。两部手机使用不同游客账号，可并行测试；同一账号会替换上一轮。记录手机型号、系统版本、支付宝版本、小程序版本、网络类型和低电量模式。

### A. 有限文件对照（约 30 秒）

1. 从路线列表进入“我的”，先退出房间并结束已有讲解/问答，再打开“锁屏音频验证”。若仍提示占用，返回路线列表结束当前导览后重试。
2. 选择“有限文件对照”，点开始。前台应听到一声。
3. 立即按电源键真正锁屏。约第 10 秒听两声，第 20 秒听三声。
4. 记录是否出声，解锁后复制诊断记录，再结束本轮。播放器可能有少量启动缓冲，按开始收听的时间观察。

这个测试通过仅代表有限 MP3 后台播放可用，不证明后续未知节点能到达。

### B. 锁屏后由电脑随机插入新声音（关键测试）

1. 选择“手动触发”，开始并听到启动声音。
2. 把“复制另一设备控制链接”得到的链接传到电脑浏览器打开。不要在受测手机上打开控制页。
3. 按电源键锁屏，至少等待 60 秒。电脑上随机点击“声音 1 / 2 / 3”，记录点击时间和手机实际发声时间。每组约 3 秒，避免连点。
4. 再静音约 5 分钟重复。保持锁屏，到本轮第 15 分钟再次随机触发。整轮不超过 20 分钟。
5. 全程不要解锁、点击通知、锁屏媒体播放键或重新打开小程序。可以用另一设备录像，记录受测屏幕一直关闭和实际声音。
6. 在电脑下载服务器记录；最后再解锁受测手机，刷新记录、复制诊断记录并结束本轮。

手动模式未来的声音取决于电脑锁屏后随机选择，不会提前写进手机缓存。最有价值的记录是：`lastHeartbeatAt` 已不再更新，但电脑触发产生 `marker.queued`、`marker.emitted`，受测手机同时真实出声。若 JS 心跳一直继续，仍可记录该机型锁屏成功，但不能据此证明 JS 暂停时也能成功。

### C. 不用电脑的定时验证

选择“定时触发”，听到启动声后立即锁屏；服务器在媒体第 60、300、900 秒发出一声、两声、三声。最后一次需在第 15 分钟仍实际听见。这个测试方便复测，但不能替代 B 的随机触发排除预缓存验证。

### D. 边界测试

- Android、iPhone 分别重复 A/B/C；Wi-Fi 和蜂窝网络至少各做一轮 B。
- 静音间隔保留，不能用持续有声播放替代；单次至少测到第 15 分钟。
- 使用系统媒体面板暂停后回到页面，应保持暂停，不擅自续播。
- 断网、接电话、耳机拔插、省电模式分别记录结果。当前验证故意不自动重连；断流不应被解锁后补播掩盖。
- 点击结束或离开验证页会清理播放器和会话；仅锁屏触发 `onHide` 不会主动停流。
- 切换账号、取消启动、迟到的创建响应不会把旧轮音频重新播放。

## 6. 结果判断与日志

| 现象 | 判断 / 下一步 |
| --- | --- |
| 前台有限文件都不响 | 检查后台音频 API、HTTPS 白名单、音量、媒体 GET 状态和编码器 |
| 有限文件锁屏能播，持续流前台不响 | 原生播放器协议、HTTP 分块或代理缓冲兼容性尚未通过 |
| 前台流能播，锁屏后只有已缓冲的旧声音 | 不能通过，检查静音处理、系统暂停、媒体连接生命周期 |
| 服务器持续发数据，手机不响 | 不能通过，服务器字节数不是声音证据 |
| 解锁后才响或需要点播放 | 不符合自动锁屏触发要求 |
| Android 通过而 iPhone 失败 | 不符合双端验收要求 |
| 两端锁屏 15 分钟后都收到电脑随机触发的新声音 | 具备继续接入服务端到站编排的媒体条件，仍需正式路线联调 |

持续模式状态中的 `mediaSeconds` 是服务器生产的 PCM 时间，`sentBytes` 是已写入 HTTP 响应的 MP3 字节数；均不是手机播放时间。有限文件走普通文件响应，其媒体秒数和发送字节不累计，使用文件响应/客户端记录判断；`streaming` 在此模式仅表示文件已被请求。

`js.*` 是客户端上报时间，`marker.emitted` 是新声音进入编码器时间，实际扬声器时间另记。事件最多保留最近 256 条，服务器记录仅在当前进程内保存；测试后立即下载，重启后会丢失。

每轮保存：设备信息、测试模式、开始/锁屏/触发/实际出声时间、三种声音是否对应、服务器 JSON、手机诊断 JSON。诊断导出不含媒体票据和控制口令。

## 7. 已有自动化验证的复现

2026-11-11 补测结果：小程序构建成功、全量测试 396 / 396 通过；后端音频短测试 14 / 14 通过，真实 15 分钟持续流测试 1 / 1 通过；房间和司机定位回归 101 项通过、1 项需要独立 PostgreSQL 连接的集成测试跳过。WebAPI 构建成功，仍有原项目既有的依赖与空值警告。以上没有包含 Android / iPhone 真机锁屏验收。

小程序全量测试：`pnpm --filter @path-seeker/mp-alipay test`。

后端普通测试与真实 FFmpeg/HTTP 测试：

```powershell
$env:AUDIO_PROBE_FFMPEG = 'C:\ffmpeg\ffmpeg0515\bin\ffmpeg.exe'
dotnet test CulturalTourismSystem.ApiTests/CulturalTourismSystem.ApiTests.csproj --filter FullyQualifiedName~AudioContinuityProbeTests -m:1 -nr:false
```

Linux 使用 `AUDIO_PROBE_FFMPEG=/usr/bin/ffmpeg dotnet test ...`。不设置该变量时，依赖真实 FFmpeg 的测试会明确跳过，其他测试继续运行。15 分钟用例额外要求 `AUDIO_PROBE_SOAK=true`，避免普通回归意外等待 15 分钟。测试使用临时本地 HTTP 服务和测试 JWT，不启动生产应用、不连接生产数据库。覆盖实际权限过滤器、媒体 HEAD、有限文件 Range、真实 MP3 解码、无心跳时动态插音和停止清理。

## 8. 关闭及后续正式接入

验证完后将 `AudioContinuityProbe__Enabled=false` 并重启 WebAPI，前端 `audioContinuityProbe=false` 后重新构建可隐藏入口。不要打开尚未完成的 `serverTourAudio`。

媒体验证两端通过后，正式链路还需要：司机 APP 锁屏持续上传位置 → 服务端按真实坐标做范围判断和节点去重/排队 → 将实际讲解或翻译音频编排进游客当前流 → 完成暂停、离房、网络中断恢复、实例路由和游览进度同步。司机位置未持续上传时，仅把范围判断搬到服务器也不能生成新的到站事件。

当前没有真机结果，不能标记“游客只用支付宝，Android 和 iPhone 息屏持续自动到站讲解”已验收。
