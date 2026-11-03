# 寻迹车夫 Android APP

原生 Android Java 工程，当前版本 0.3.0（versionCode 3），包名 `com.pathseeker.driver`，支持 Android 8.0 及以上。默认后台 `https://www.omahaaigc.com/path-seeker/api`，可在连接配置中修改。无需 Android Studio 即可编译。

## 当前功能

- 使用已有 C 端账号和密码登录；由 B 端「C端用户管理」绑定手机号并授予车夫权限。
- 独立登录页，记住上次账号，已有登录直接进入行程页；设置中可以退出登录和修改连接配置。
- 登录后进入地图讲解控制台：全屏高德地图、顶部深色房间卡、底部麦克风和识别文字、游客提问及行程详情。地图显示方向箭头与精度圈，可拖动和回中；参考导航布局，但未接入逐路口导航或路径规划。
- 统一复用 `TranslationRooms` 房间创建、恢复、二维码、房间码和关闭接口。可在开房前选择讲话语言，默认简体中文；同一房间同时用于定位、实时讲解及游客加入。
- 麦克风前台服务采集 16kHz 单声道 PCM16，通过房主 WebSocket 上传到现有实时翻译服务。支持手动开始、暂停并等待服务端确认、继续讲解、网络中断有限重连；上传积压停止并提示，中断期间讲话不补传。
- 显示实际收音状态、输入音量、识别原文、收听人数与翻译错误。游客提问可查看翻译文字，收听前暂停麦克风，播放完毕后手动继续讲解，避免声音回录。
- 从可见页面启动 `location` 类型前台服务，运行期间通知栏持续提示，可从通知或页面停止共享。
- 高德连续定位期望间隔 3 秒；网络线程每轮完成后等待 3 秒上报有效新坐标，无新坐标时约 10 秒发送心跳。系统调度、网络耗时与卫星条件会影响实际频率。
- 定位数据明确标记 GCJ-02，拒绝模拟、超过 2 分钟、未来超过 30 秒和精度差于 500 米的坐标；断网时仅保留内存中的最新坐标。
- 配套后端将有效采样持久化到 PostgreSQL，按首次接收时间至少保存 24 小时。服务器须先执行 `doc/100-driver-location-history-ddl.sql` 并部署新代码，上报格式兼容当前 APK。
- 自动刷新登录令牌；令牌使用 Android Keystore 的 AES-GCM 密钥加密保存；权限、账号或房间无效时停止定位服务。
- 定位和麦克风使用独立前台服务，暂停收音不停止共享位置；结束房间同时停止两项服务。APP 内历史轨迹回放、开机启动和被强制停止后自启动不在此版本范围内。

## 命令行构建

已准备的工具放在 `.tools/`，不修改系统 PATH，不要求安装 Android Studio。

```powershell
./bootstrap.ps1
./build.ps1 -Variant All
```

首次运行需联网下载 JDK 17、Gradle 8.11.1、Android 命令行工具、API 35、Build Tools 35.0.0 及 Maven 依赖。下载压缩包核验官方校验值。`bootstrap.ps1` 会接受 Android SDK 许可；使用前请阅读 [Android SDK 许可](https://developer.android.com/studio/terms)。

输出：

- 调试版：`app/build/outputs/apk/debug/app-debug.apk`
- 发布版：`app/build/outputs/apk/release/app-release.apk`
- Android Lint：`app/build/reports/lint-results-debug.html`

`local.properties` 被 Git 忽略，格式如下；替换为本机 SDK 路径和高德 Android Key：

```properties
sdk.dir=D:/Android/sdk
amap.key=你的高德Android平台Key
```

SDK 由 Gradle 下载地图、定位、搜索合并包 `com.amap.api:3dmap-location-search:11.3.100_loc11.3.101_sea9.8.1`，无需手动放入 JAR，也不要再并列添加独立定位包，以免出现重复类。Key 会包含在 APK 中，并受高德平台配置的包名和签名证书限制。

讲解 WebSocket 使用 `com.squareup.okhttp3:okhttp:4.12.0`，由 Gradle 自动下载，无需额外手动安装收音或语音识别 SDK。语音识别与翻译继续由后台处理。

## 签名与高德 Key

运行 `./signing.ps1` 查看两个证书的 SHA1。此脚本只在证书不存在时创建证书，重建 APK 不改变已有证书。

| 高德字段 | 值 |
| --- | --- |
| PackageName | `com.pathseeker.driver` |
| 发布版安全码 SHA1 | `65:1F:11:5E:AD:09:3A:4B:C8:80:A3:8E:FB:E4:E4:C5:36:83:9D:FB` |
| 调试版安全码 SHA1 | `1C:23:37:72:F3:2D:34:2A:81:98:8A:FA:C4:01:67:6C:A2:70:E5:6F` |

**请将整个 `.signing/` 文件夹离线备份**，其中包含发布证书、调试证书和发布证书密码文件。不要提交到 Git，也不要删除后重新生成。丢失发布私钥后，无法以当前签名覆盖升级已安装的发布版；换证书还需要修改高德 Key 的 SHA1 绑定。

调试版与发布版包名相同，签名不同。两者切换需要先卸载旧版，会清除本地登录和配置；正式试用请优先安装发布版。

## 真机使用与验收

1. 部署同批后端代码及 B 端，管理员为已有账号绑定手机号并授予车夫权限。
2. 安装发布 APK，确认后台地址和高德 Key，使用已存在的账号密码登录。仅通过支付宝授权创建且没有密码的账号，需要先通过现有账号体系设置/绑定可用密码。
3. 登录后进入地图行程页，创建房间，点击「游客扫码」展示二维码或复制房间码。重新进入 APP 会核验已有房间，失效后可重新开房。
4. 点击开始共享，同意定位用途说明，授权精确位置及通知。服务从当前可见页面启动，不单独申请「始终允许」后台位置权限。
5. 打开手机系统定位，在厂商电池设置中允许后台运行/设为不限制，息屏步行或行驶 10～30 分钟，确认 B 端「车夫位置」持续更新。
6. 断网、进入室内再恢复，确认旧坐标不会被新心跳刷新采样时间，B 端依次显示定位过期/离线，并在收到新坐标后恢复在线。
7. 停止共享、关闭房间、撤销车夫权限分别验收；确认通知消失，B 端位置清除或房间退出列表。
8. 在实际使用的华为、小米、OPPO、vivo 等机型分别验证电池策略。系统强制停止、手动结束服务、重启、权限被撤销、极端省电模式均可能中断服务；重新打开 APP 后手动恢复共享。
9. 点击麦克风，阅读收音说明并授权录音；确认通知栏显示实时讲解、输入音量变化、说话后出现原文。游客用另一个账号加入房间，选语言并核对译文及声音。
10. 暂停时确认麦克风停止、尾段识别完成后可以继续；暂停不停止定位。断网恢复验证重连与界面提示，不补传断网期间讲话。
11. 游客提问后在 APP 查看和收听，确认麦克风先暂停，播完手动继续。锁屏 10～30 分钟分别验证持续收音和位置上报，接电话或被系统静音时不能继续显示正常收音。
12. 小程序导览开启「跟随车夫」，移动 APP 手机并保持游客手机不动，核对地图与到站排队；停止共享或关闭房间后必须停止自动触发。

APP 不依赖静音音频维持后台。未接入本批后端代码前，线上定位接口可能返回 404；本地构建成功不能代替部署和真机息屏验收。

本地 B 端与 APP 必须连接同一个后端实例。当前线上 API 位于 `/path-seeker/api`，网站根路径 `/api` 返回 404。本地 Nuxt 应设置 `NUXT_BACKEND_BASE_URL=https://www.omahaaigc.com/path-seeker/api/` 并重启开发服务；切换环境后需要使用目标环境管理员账号重新登录。

## 官方地址

- [Android 命令行工具及 Android Studio 下载](https://developer.android.com/studio#command-line-tools-only)
- [Android SDK Manager](https://developer.android.com/tools/sdkmanager)
- [Adoptium JDK 17](https://adoptium.net/temurin/releases/?version=17)
- [Gradle 发行包](https://gradle.org/releases/)
- [高德 Android 定位 SDK](https://lbs.amap.com/api/android-location-sdk/download)
- [高德控制台](https://console.amap.com/)
- [高德隐私政策](https://lbs.amap.com/pages/privacy/)

API 和后台部署说明见仓库 `docs/driver-location-integration.md`，房间收音与游客跟随协议见 `docs/driver-commentary-integration.md`。本轮需部署新增房间坐标读取接口并更新小程序；无需新增数据库表。现有定位历史表及最短 24 小时留存要求不变。游客小程序被支付宝挂起时无法保证按时查询位置或启动新音频。
