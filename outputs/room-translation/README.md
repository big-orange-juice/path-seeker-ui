# 黄包车房间实时翻译：交付与上线

> 最新授权流程见 [C 端用户车夫授权](./driver-permissions.md)：在「C端用户管理」中授予车夫权限，房间不再绑定车辆。本文后续车辆绑定说明为旧版交付记录。

## 已实现

- H5 `/translation-room`，支付宝 `pages/translation-room/index`。导航页顶部「实时讲解」进入；游客输入八位房间码或在支付宝内扫码。
- 后台黄包车编辑新增车夫手机号、车夫账号编号。首次绑定支付宝账号时，车夫先授权登录，在「我的」查看账号编号，管理员核实身份后填入手机号及账号编号并保存。
- 保存时把手机号关联到指定的现有正常账号，并保存 `driver_user_id`。房主接口核验当前登录用户、后台绑定的账号和手机号、车辆启用状态。仅填写相同手机号的新注册账号不会继承权限。
- 一间房每个源段只进行一次 ASR 和语义提交；每个活跃语言队列串行翻译及合成，同语言共享结果，不同语言并行。每位成员有独立起点、订阅版本和有界发送队列。
- 正常结束排空服务端输出，客户端播完剩余语音；立即关闭取消生成并要求客户端停播。游客退出只释放本人连接。房主断线暂停，60 秒内允许重新接入新轮次。
- 黄包车导航进入时不播放预录语音，不恢复旧的自动播放偏好；定位仍可展示附近景点，手动播放入口保留在侧边内容页。底部播放导航栏已移除。

## 数据库与部署顺序

1. 在 PostgreSQL 执行同目录 `97-translation-room-ddl.sql`。后端相同脚本位于 `doc/97-translation-room-ddl.sql`。脚本可重复执行，不自动给已有账号授予车夫权限。
2. 部署 WebAPI，继续使用现有 MiniMax ASR / TTS、翻译模型、Redis 和 PostgreSQL 配置。
3. 配置 `TranslationRooms:ClientUrl` 为正式 H5 房间地址，例如 `https://www.omahaaigc.com/path-seeker/client/translation-room`。环境变量名称是 `TranslationRooms__ClientUrl`。配置后创建房间时生成带 `roomCode` 的二维码；未配置时仍可用房间码。
4. 将 `nginx.translation-rooms.conf` 的 WebSocket location 合入现有 API 站点，按实际 WebAPI 端口调整 `proxy_pass`。保留现有 HTTP API 和 H5 SPA 的 history fallback 配置。示例不直接替换现有站点。
5. H5 的 `VITE_API_BASE_URL` 继续包含 `/api`。麦克风要求 HTTPS 或 localhost。支付宝后台配置相应 HTTPS 请求域名及 WSS WebSocket 域名，并发布新增页面。
6. 车夫授权登录，管理员编辑车辆保存手机号和账号编号。车夫进入实时讲解页面，选择已授权车辆和源语言，创建房间；游客选择目标语言并点击「开始收听」。

## 当前试点边界

- 单实例内存调度，最多 45 个活跃房间，每房 30 位成员、同时 3 种目标语言，房间自创建起有效期为 3 小时。系统翻译并发上限 12，每语言待处理队列 30 段，每连接发送队列 128 个事件。
- 服务重启会把未关闭房间标为 `server_restarted`；不恢复音频或输入。多实例部署需要按房间路由至同一实例，当前版本不能随机负载均衡。
- 支持中文、繁中、英语、日语、韩语、法语、德语、西班牙语，跟随后端现有翻译枚举，不向房间接口传俄语。
- 支付宝房主用已有原生 WAV 能力每 4 秒录一段，验证为 16 kHz / 单声道 / PCM16 后提取 PCM 上传。录音段之间存在设备相关间隙，属于分段准实时讲解；尚未验证真机无缝采音、锁屏及后台连续录音。
- 支付宝房主通过 `/events` 发送 `input.start` 后在同一连接上传 PCM；H5 使用独立 `/input`。游客的 `/events` 只接受心跳，不能上传语音。HTTP / WebSocket 鉴权都使用当前登录 Token，房主及游客均不传用户 ID。
- 游客每次接入从服务器确认的下一完整段开始。断网后显式重新收听，不自动补播旧音频；已完成原文和译文入库，本次尚未提供历史字幕游标恢复、回听和原声直播。
- 更换语言入口明确停止当前语音并重新加入；未实现旧语言播完后在下一段无缝切换。语言内部队列不会被后续新段打断。
- H5 收听积压超过 120 秒停止本机播放并提示重新接入；支付宝音频文件最多保留 240 份。H5 音频、支付宝录音和户外弱网仍需真机联调验证。

## 接口

| 方法 | 路径 | 权限 / 行为 |
| --- | --- | --- |
| GET | `/api/TranslationRooms/host-vehicles` | 当前账号获授权的启用车辆 |
| POST | `/api/TranslationRooms` | 房主创建；`rickshawId` 字符串、`sourceLanguage` |
| POST | `/api/TranslationRooms/join` | 当前游客加入；`code` 八位字符串、`targetLanguage` |
| GET | `/api/TranslationRooms/{roomId}` | 当前房主或已加入成员 |
| POST | `/api/TranslationRooms/{roomId}/leave` | 幂等退出当前成员 |
| POST | `/api/TranslationRooms/{roomId}/subscription` | 变更语言、确认新起点及版本 |
| POST | `/api/TranslationRooms/{roomId}/end` | 房主正常结束并排空 |
| POST | `/api/TranslationRooms/{roomId}/close` | 房主立即关闭 |
| WS | `/api/TranslationRooms/{roomId}/events` | 成员事件、心跳；房主可发送 `input.start` |
| WS | `/api/TranslationRooms/{roomId}/input` | 房主独占 PCM 输入 |

WebSocket 子协议为 `translation` 和 `bearer.<accessToken>`，服务器仅回显 `translation`。心跳每 15 秒，45 秒无响应释放连接；业务 ID 全部使用字符串。人数及语言分布只向房主返回。

## 验收

- 车夫、英语游客两位、日语游客一位，验证原文一致且英语只生成一次。
- 第 10 段生成时加入，验证从第 11 段开始，退出一位不打断其他游客。
- 车夫断网并恢复，验证旧轮次尾段先输出；正常结束播完、立即关闭停播。
- 后台禁用车辆或更换车夫授权，验证旧账号不能开始讲解，现有房间在维护周期内关闭。
- 两端进入导航和刷新时保持静音；侧栏手动播放正常，导航底部不再有播放栏。

自动检查日志位于本目录；后端日志位于其 `artifacts/translation-room-tests.log` 和 `artifacts/translation-room-build.log`。自动检查不代替真实设备和供应商联调。
