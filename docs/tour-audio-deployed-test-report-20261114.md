# 持续讲解音频优化：部署后测试报告

测试日期：2026-11-14。时间以 UTC 为原始证据；北京时间为 UTC+8。

后续更新：用户开启优化并重启后的完整 A 线测试已完成，见 `docs/tour-audio-full-route-test-report-20261114.md`。两位游客均完成 18/18 站，持续音频约 20 分 56 秒；本文保留较早的全关闭基线及目录检查结果。

## 1. 验收结论

已完成本轮可独立执行的测试：公网探针及边界 55 项检查通过，正式房间业务补测 23 项检查通过，合计 78 项；后端主要回归 739 项通过、2 项数据库测试跳过，原生编码专项 86 项通过，小程序 631 项通过，没有自动化失败。公网探针持续流在无 JS 心跳情况下运行超过 15 分钟，第 60、300、900 秒的声音标记均经实际下载解码验证通过。

发现一个需要处理的业务内容问题：日语、韩语、粤语、西语共 36 个已返回章节没有音频地址。用户已确认线上四个优化开关全部关闭、码率 96k；本轮是旧路径基线。正式房间已完成双游客中文跟车、车夫语音插播、暂停隔离、切站、重连和关闭验证；服务器原生库、手机锁屏和并发容量尚未完成验证。因此结论为：**已覆盖的功能回归、正式业务基线和公网探针耐久通过；内容完整性与生产优化收益尚不能签收。**

本次测试覆盖部署后的公网 API、真实 MP3 下载与解码、探针会话生命周期、后端回归和支付宝小程序自动化。测试结论分开记录“线上行为已验证”“本地代码已验证”“缺少条件未验证”，不把接口连通等同于性能优化已在线生效。

## 2. 环境与范围

| 项目 | 实际环境 / 范围 |
| --- | --- |
| 公网 API | `https://www.omahaaigc.com/path-seeker/api` |
| 后端本地版本 | `ceead5f262852e8e35a6cdd2a8222001423e95e1`，提交说明 `ffmpeg性能优化` |
| 前端本地版本 | `ef2c1c4dbeb6487998aa035020d51390838f4c8b` |
| 本地运行环境 | Windows x64、.NET 10、Node.js 24.15.0、真实 FFmpeg / FFprobe |
| 原生编码测试 | Windows `libmp3lame.64.dll`；不代表已验证服务器实际原生动态库 |
| 公网测试账户 | 正常游客登录创建的临时测试身份；正式房间使用定位模拟程序中用户已配置的车夫账号，没有修改账号权限 |
| 公网测试并发 | 最多同时接收 2 条测试媒体流；没有执行正式业务容量压测 |
| 数据操作 | 创建 / 停止本轮探针及专用正式房间；两个测试游客创建 / 放弃行程；模拟位置上报；通过真实输入连接上传 8 秒公开路线讲解音频 |

没有可读取的线上版本标识，因而无法独立核对部署版本与本地提交完全一致。开关关闭状态由用户确认，未读取服务器有效配置。本地 `appsettings.json` 存在用户修改，本次未改写生产配置、发布文件或业务代码。

## 3. 本地自动化结果

| 测试组 | 通过 | 失败 | 跳过 | 说明 |
| --- | ---: | ---: | ---: | --- |
| 后端音频、翻译房间、车夫定位、音频探针回归 | 200 | 0 | 1 | 会话真实编码使用 FFmpeg；不包含本地 15 分钟 soak 用例 |
| 后端其他业务回归 | 539 | 0 | 1 | 排除上述测试组及需要单独运行 API 实例的 `ApiSmokeTests` |
| 原生编码模式：讲解会话、优化、媒体订阅 | 86 | 0 | 0 | `AUDIO_PROBE_NATIVE=true`，真实 LAME 编码与 FFmpeg 解码 |
| 支付宝小程序构建及自动化 | 631 | 0 | 0 | 执行 `pnpm test:mp-alipay`，包含服务端讲解、后台音频、插播、跟车、恢复等既有用例 |

前两组后端过滤条件互斥，共 739 项通过、2 项跳过。原生编码组与音频组重叠，不能累加成独立测试数。小程序自动化使用测试环境和模拟原生接口，不等同于手机锁屏验证。

跳过项：

- `DriverLocationStoreTests.PostgreSql_migration_writes_deduplication_restart_queries_and_retention_boundary`：没有配置 `DRIVER_LOCATION_TEST_CONNECTION_STRING`，未验证真实 PostgreSQL 持久化、重启和保留期限。
- `ChatVenueTests.Finished_run_persists_json_object_and_restores_venue_on_next_request`：没有配置 `CT_TEST_DB_CONNECTION_STRING`，未验证真实 PostgreSQL 临时表场景。

后端构建成功，仍有依赖解析、nullable 和 xUnit 分析器警告。本轮没有将既有警告当成新优化故障，也未修改无关代码。

已覆盖的关键行为包括：

- 共享开关关闭时 20 个调用分别解码，开启时同键并发只执行 1 次解码；这是本地测试计数，不是线上 FFmpeg 进程测量。
- 单游客取消、暂停、停止不影响其他游客；共享键按房间、语言、epoch、片段、格式、采样率及实际音频内容隔离。
- 缓存过期、容量淘汰、服务关闭、解码失败回退，以及正在播放的 PCM 引用仍然有效。
- 二进制音频分发保持 WebSocket 协议，慢订阅隔离，成员变更和语言过滤有效。
- 定位转换复用仍执行权限、成员和定位时效校验。
- 原生编码输出、48k / 64k / 96k 格式、原生库缺失时 FFmpeg 回退、背压与取消。
- 原有到站、插播、暂停、切站、重连、播放确认及缺失音频不能错误提交完成状态。

以上用例不是所有开关组合的正式房间端到端测试，也不是生产 Linux 原生库验收。

## 4. 公网音频与鉴权验证

### 4.1 已完成的行为检查

主脚本 35 项检查通过，补充边界脚本 20 项检查通过，均为 0 失败。主脚本记录了 34 次控制 / 查询请求，直接媒体下载另计；检查数量不等同于 HTTP 请求数量。

| 场景 | 实际结果 |
| --- | --- |
| 未登录创建 / 查询正式音频会话 | HTTP 401 |
| 无效正式媒体会话 / 缺少 ticket | HTTP 404 / 400，未泄漏音频 |
| 已登录但创建参数缺失 | HTTP 400 |
| CORS 预检 | HTTP 204，允许 authorization 请求头 |
| 正常游客登录 | 成功，用户 ID 为字符串 |
| 其他游客查询 / 删除探针 | HTTP 403 |
| 错误媒体 ticket / 控制令牌 | HTTP 403 |
| 媒体令牌用于控制、控制令牌用于媒体 | 均 HTTP 403 |
| HEAD 请求 | HTTP 200，保留 ready 状态，不提前消费播放 |
| 有限 MP3 范围请求 | HTTP 206，返回准确的 1024 字节 |
| 超出文件长度的范围请求 | HTTP 416，正确返回 `Content-Range: bytes */360490` |
| 持续流响应头 | audio/mpeg、no-store / no-transform、无压缩 Content-Encoding、Accept-Ranges: none |
| 同一探针重复媒体连接 | HTTP 409 |
| 停止另一游客探针 | 主测试流仍为 streaming |
| 同 requestId 重复触发 | 只入队一次 |
| 非法模式、marker、requestId 长度、心跳参数 | HTTP 400 |
| 同账户创建新探针 | 旧探针变成 replaced，旧媒体不能继续新建连接 |
| 客户端中断媒体连接 | 服务端变成 disconnected，无 error |
| 控制端停止会话 | HTTP 200，账户查询确认 stopped |

预期的 400 / 401 / 403 / 404 / 409 / 416 是负向测试通过条件，不能按普通 HTTP 成功率统计为故障。

### 4.2 真实音频校验

- 有限 MP3：文件 360,490 字节，单声道、44,100 Hz、96,000 bit/s，FFprobe 时长 30.040833 秒。
- 在第 0 / 10 / 20 秒分别解码出一声、两声、三声标记；有效脉冲 RMS 约 4030，静默采样 RMS 为 0。
- 手动流：不发送 JS 心跳，持续至服务端媒体时间 71.32 秒；第 65.98 秒发出新的两声标记，实际下载后成功解码。
- 手动流静默段 RMS 为 0，触发后脉冲测量为 `[4030, 4030, 0]`。这证明公网连接能够在静默后继续传输新音频。
- RMS 以解码后的 16 kHz、16 位单声道 PCM 计算，脉冲采样窗口 0.2 秒；阈值为声音大于 1000、静默小于 100。

测试客户端是本机 Node.js，未连接手机原生播放器。因此该结果不能证明支付宝 iOS / Android 锁屏后一定实际出声，也没有评价真人语音在低码率下的主观音质。

### 4.3 15 分钟无心跳耐久

主脚本运行时间：2026-11-14 06:06:50.630–06:23:22.198 UTC，即北京时间 14:06:50.630–14:23:22.198；包含前置鉴权、有限音频、手动流和 915 秒耐久阶段。

| 指标 | 实际结果 |
| --- | --- |
| 停止前服务端状态 | streaming |
| 服务端累计媒体时间 | 915.28 秒 |
| 实际 MP3 解码时长 | 915.35675 秒 |
| 最终接收字节数 | 10,984,281 字节，约 10.98 MB |
| 接收数据块数 | 23,302 |
| 首字节耗时 | 120 ms，指 HTTP 首数据到达，不是手机首音 |
| 最大相邻数据块接收间隔 | 154 ms |
| 大于 2 秒的接收间隔 | 0 次 |
| 最后 JS 心跳 | null，全程未发送 |
| 第 60 秒标记 | `[4030, 0, 0]`，一声通过 |
| 第 300 秒标记 | `[4030, 4030, 0]`，两声通过 |
| 第 900 秒标记 | `[4030, 4030, 4030]`，三声通过 |

结束由测试脚本主动停止。连续传输和远端定时生成的新声音均已验证，未观察到连接被代理空闲超时提前切断。数据块间隔来自本地 Node.js 读取，并非对播放器每个音频采样的连续性测量，也不构成服务端资源消耗结论。

### 4.4 测试数据清理

主脚本创建的 4 个探针和边界补充测试创建的 3 个探针均已执行删除并返回业务成功；主脚本 `unclosedSessions=0`，边界脚本 `cleanupFailures=0`。普通游客登录产生的测试身份没有账户删除接口，本轮没有清除这些账户记录。

### 4.5 正式跟车业务补测：全关闭基线

用户补充说明后，沿用后台 `CulturalTourismSystem.LocationSimulator` 的本地账号配置、登录参数和公共 API，通过可重复运行的控制台脚本创建专用房间。没有运行模拟程序中“先关闭账号已有房间”的逻辑；脚本确认返回房间是新建 waiting 房间且无听众后才继续，若发现旧房间就中止并保留它。

时间：2026-11-14 09:55:51.231–09:56:33.481 UTC，即北京时间 17:55:51.231–17:56:33.481。

- 专用房间 ID：`396991508831670272`；测试结束已关闭，历史邀请码不再用于后续测试。
- 路线：`2116113373455323136`，中文 A 线；两个独立游客，房间、路线、游览、站点 ID 全程按字符串传递。
- 23 项断言通过、0 失败；86 次 HTTP 控制 / 查询 / 定位请求，包含 22 次真实定位上报，另有媒体流和 WebSocket。
- 定位复用仓库 WGS84 → GCJ-02 转换，按约 1.8 秒间隔上报新鲜样本。本轮针对关键站点验证，不是完整 18 站、20 分钟道路回放。

| 正式场景 | 结果 |
| --- | --- |
| 车夫登录 / 开房权限 / 新建房间 | 通过 |
| 两位游客加入、开始各自行程、创建正式音频会话 | 通过 |
| 跨游客状态访问 | HTTP 403，隔离通过 |
| 媒体 HEAD | HTTP 200，仍为 ready |
| 定位自动到站 | 两位游客均开始真实路线讲解，存在到站时间记录 |
| 暂停隔离 | 第一位内容位置停在 3.14 秒，4 秒暂停期间仍收到 52,350 字节；第二位继续讲解 |
| 恢复 / hold / release | 暂停与临时占用状态正确，讲解可继续 |
| 手动切站 / seek | 切到第二站，拖动到约 5 秒 |
| 主动断线后重连 | streamId 更新，保留所选第二站和已拖动位置，没有退回第一站 |
| 车夫语音输入 | 上传真实中文路线音频的前 8 秒，服务端返回识别及语音处理事件 |
| 同一 MP3 内插播 | timeline 出现 room 音频段，收到的重连 MP3 对应窗口 RMS 2459 / 2689，确认有实际声音数据 |
| 停止第二位游客 | 第一位正式流仍为 streaming |
| realign 后新定位到站 | 第三站再次自动开始路线音频 |
| 关闭房间 | 第一位正式会话变为 closed，媒体流由服务端结束 |
| 清理 | 两个音频会话停止、两个测试游览放弃、两个游客退出，均业务成功 |

| 媒体连接 | 首字节 | 最大接收间隔 | 超过 2 秒间隔 | 解码时长 |
| --- | ---: | ---: | ---: | ---: |
| 第一位首次连接 | 275 ms | 72 ms | 0 | 16.588 秒 |
| 第二位连接 | 188 ms | 1012 ms | 0 | 33.620 秒 |
| 第一位重连 | 175 ms | 1016 ms | 0 | 21.499 秒 |

三份 MP3 均成功解码，且含有非静音样本。约 1 秒的最大接收间隔需要在开关全部开启后的同场景中继续比较；本轮没有证据将其判为手机可听卡顿，也不能与探针的简单定时正弦信号直接比较。

本轮车夫和游客都使用中文，验证了实际语音输入和插播，没有验证中英等跨语言输出质量。每段完整路线讲解播完后的持久化确认、全路线遍历、正式流 15 分钟耐久仍不在本次短场景范围；前述 15 分钟证据属于独立探针。测试游览和模拟定位的历史数据库记录按既有保留策略存在，没有执行数据库删除。

## 5. 线上目录与内容检查

目录采样时间：2026-11-14 06:02:46 UTC，即北京时间 14:02:46。

- 33 次 API 请求均 HTTP 200、业务 code=0，覆盖游客登录、8 种语言目录、路线详情、路线明信片和活动行程查询。
- 8 个语言版本路线的路线 ID 均为字符串，已返回站点坐标都在合法经纬度范围内。
- 去重后的 184 个已提供媒体地址均 HEAD 200：55 张 JPEG、118 个 MP3、11 个 MP4。
- API 客户端观测耗时：最小 92 ms、中位数 194 ms、样本 P95 2965 ms、最大 3163 ms。样本仅 33 次，包含公网往返和不同接口，不能当作稳定容量指标或纯服务端处理耗时。
- 本轮媒体检查验证地址可访问和响应头，没有完整下载、解码所有 184 个文件。

### 5.1 发现：部分语言章节缺少音频地址

| 语言 | 返回章节数 | 有音频地址 | 缺少音频地址 |
| --- | ---: | ---: | ---: |
| 中文 zh | 18 | 18 | 0 |
| 英语 en | 19 | 19 | 0 |
| 俄语 ru | 18 | 18 | 0 |
| 法语 fr | 18 | 18 | 0 |
| 日语 ja | 13 | 0 | 13 |
| 韩语 ko | 18 | 14 | 4 |
| 粤语 yue | 18 | 10 | 8 |
| 西语 es | 18 | 7 | 11 |
| 合计 | 140 | 104 | 36 |

上述 36 章有文本但未返回章节音频地址，属于需要确认的内容完整性问题。184 个已有地址可访问，不代表所有应有音频都已发布。若上述语言属于上线验收范围，应补齐生成 / 发布状态后复查；目前没有证据表明该问题由本次音频优化引入。

后端现有用例验证“缺失必需音频不能把该站错误标记为完成”，但不能弥补真实内容缺失。各语言站点数量也不完全相同，是否符合路线运营安排需要业务确认，不能仅据此认定接口错误。

## 6. 配置与容量结论的边界

本地配置观察值：

| 配置 | 本地值 | 线上能否确认 |
| --- | --- | --- |
| `TourAudio:MaxSessions` | 128 | 未读取服务器有效配置 |
| `SharedDecodeEnabled` | false | 用户确认 false |
| `BinaryRoomAudioEnabled` | false | 用户确认 false |
| `SharedLocationEnabled` | false | 用户确认 false |
| `NativeEncoderEnabled` | false | 用户确认 false |
| `NativeLibraryPath` | 空 | 未确认 |
| `OutputBitrate` | 96k | 用户确认 96k，探针输出实测为 96 kbps |

根据用户确认，本轮新增优化路径未启用，所得结果作为全关闭基线保存。下一轮由用户开启四个开关后重测；建议保持 96k 不变，便于比较开关带来的影响。环境变量、服务器配置文件及部署覆盖都可能改变有效值，下一轮仍需确认服务实际加载的配置和编码器路径，尤其要区分原生编码成功和自动回退到 FFmpeg。

`MaxSessions=128` 是允许的会话上限，不是“服务器已验证能承载 128 人”。本轮没有服务器 CPU、RSS、GC、FFmpeg 进程数、共享解码命中率和队列监控数据，也没有足够的正式房间负载，不能给出 8 核服务器的可靠人数或 CPU 改善百分比。

## 7. 尚未完成的验收条件

| 项目 | 缺少条件 / 后续方法 |
| --- | --- |
| 正式业务扩展场景 | 已完成第 4.5 节短流程；跨语言、整段讲解播放完成确认、全路线及正式流长期运行仍需扩展验证 |
| 线上新优化确实启用 | 本轮明确关闭；下一轮全部开启后重复相同脚本，结合版本信息和共享解码 / 编码路径日志确认实际执行路径 |
| 实际服务器原生编码 | 核对系统架构、LAME 库版本；验证实际加载及失败回退 |
| 真机后台 / 锁屏 | 支付宝 iOS、Android 分别执行静默 60 秒后随机触发、15 分钟定时音频、来电 / 耳机 / 网络切换 |
| 生产容量 | 在隔离测试实例或约定窗口分级进行 16、32、64、128 人测试，同步记录 CPU、RSS、GC、带宽、首音、解码队列和进程数 |
| PostgreSQL 集成 | 使用专门测试数据库补跑两项跳过用例 |
| 多语言音频完整性 | 确认上述 36 章是否应发布音频，补齐后复查 |

因此，本次结论只能用于已覆盖功能范围，不应表述为“全部业务和 128 人容量已经验收通过”。

## 8. 复现与证据

所有路径相对前端仓库 `D:/workspace/amh/code/CulturalTourism/web/path-seeker-ui`，报告中的原始结果不保存登录 accessToken / refreshToken 或媒体票据。

| 证据 | 路径 |
| --- | --- |
| 公网主脚本 | `outputs/tour-audio-optimization/deployed-audit.mjs` |
| 公网主结果 | `outputs/tour-audio-optimization/deployed-20261114/results.json` |
| 汇总与文件校验 | 同目录 `summary.json`、`sha256.json` |
| 公网边界脚本 / 结果 | `outputs/tour-audio-optimization/deployed-boundaries.mjs`、`outputs/tour-audio-optimization/deployed-20261114/boundaries.json` |
| 目录及媒体原始结果 | `outputs/tour-audio-optimization/deployed-20261114/catalog-results.json` |
| 实际收到的 MP3 | 同目录 `finite.mp3`、`manual.mp3`、`companion.mp3`、`scheduled-15min.mp3` |
| FFmpeg 回归 | `outputs/tour-audio-optimization/results/ffmpeg-regression-20261114.trx` |
| 其他后端业务回归 | `outputs/tour-audio-optimization/results/business-regression-20261114.trx` |
| 原生编码回归 | `outputs/tour-audio-optimization/results/native-session-regression-20261114.trx` |
| 小程序构建和测试日志 | `outputs/tour-audio-optimization/results/mp-alipay-regression-20261114.log` |
| 正式业务控制台脚本 | `outputs/tour-audio-optimization/formal-room-audit.mjs` |
| 正式业务基线 / 实际音频 | `outputs/tour-audio-optimization/formal-baseline-20261114/results.json` 及同目录 3 份接收 MP3 |
| 正式插播音频验证及 SHA-256 | `outputs/tour-audio-optimization/formal-baseline-20261114/audio-verification.json` |

前端工作区复现：

```powershell
node outputs/tour-audio-optimization/deployed-audit.mjs --soak
node outputs/tour-audio-optimization/deployed-boundaries.mjs
pnpm test:mp-alipay
```

正式房间脚本从定位模拟程序的 `settings.local.json` 读取已配置测试账号，密码和令牌仅驻留内存，不写入结果。使用唯一目录名保存下一轮，防止覆盖基线：

```powershell
$env:AUDIO_AUDIT_RUN='formal-enabled-20261114'
node outputs/tour-audio-optimization/formal-room-audit.mjs
node outputs/tour-audio-optimization/verify-formal-audio.mjs
```

该命令不会切换服务端配置；必须在用户完成开关启用和服务重启后再执行。原始 `deployed-20261114/summary.json` 对应前一次探针 / 回归采样，不包含后来补充的正式业务；正式业务证据以单独的 `formal-baseline-20261114` 为准。

主脚本包含约 70 秒手动静默验证以及 915 秒连续流；会创建新的游客测试身份和探针。重新执行会覆盖同目录结果，复测前应归档已有证据。

记录方法说明：本轮最初运行的脚本在最终清理时会重复调用已结束连接的收尾函数，使较早结束的 manual / companion 流的 `elapsedSeconds` 被等待长流的时间覆盖。测试脚本已修正为幂等收尾；本轮原始结果保留，不事后改写。较早结束流的正确墙钟时间见 `pre-finalization-snapshot.json`（manual 71.698 秒、companion 5.355 秒）；音频时长使用实际 MP3 解码结果。该记录问题不改变收到的字节、标记检查、断流计数或服务端状态。

后端工作区复现（先配置本机真实路径）：

```powershell
$env:AUDIO_PROBE_FFMPEG='C:\ffmpeg\ffmpeg0515\bin\ffmpeg.exe'
$env:AUDIO_PROBE_LAME='D:/workspace/amh/code/CulturalTourism/web/path-seeker-ui/outputs/tour-audio-optimization/naudio.lame/build/libmp3lame.64.dll'
$env:AUDIO_PROBE_NATIVE='false'
dotnet test CulturalTourismSystem.ApiTests/CulturalTourismSystem.ApiTests.csproj --filter '(FullyQualifiedName~TourAudio|FullyQualifiedName~TranslationRoom|FullyQualifiedName~DriverLocation|FullyQualifiedName~AudioContinuityProbe)&Category!=AudioProbeSoak'
dotnet test CulturalTourismSystem.ApiTests/CulturalTourismSystem.ApiTests.csproj --filter 'FullyQualifiedName!~TourAudio&FullyQualifiedName!~TranslationRoom&FullyQualifiedName!~DriverLocation&FullyQualifiedName!~AudioContinuityProbe&FullyQualifiedName!~ApiSmokeTests'
$env:AUDIO_PROBE_NATIVE='true'
dotnet test CulturalTourismSystem.ApiTests/CulturalTourismSystem.ApiTests.csproj --filter 'FullyQualifiedName~TourAudioSessionTests|FullyQualifiedName~TourAudioOptimizationTests|FullyQualifiedName~TranslationRoomMediaTests'
```

本轮实际使用 `--artifacts-path` 将构建文件隔离到前端 outputs 目录，并输出上述 TRX 文件。API 冒烟类的默认地址是 `http://localhost:8199`，没有启动对应 API 实例，因此未运行该类；公网行为由本报告的独立脚本验证。
