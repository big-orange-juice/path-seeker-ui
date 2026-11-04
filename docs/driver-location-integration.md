# 车夫后台定位与 B 端位置地图

2026-11-03 更新：Android 0.3.0 合并实时讲解收音，支付宝游客端改为从当前房间获取车夫坐标，取消本机定位回退。新增房间成员接口 `GET /TranslationRooms/{roomId}/location`，需要部署后端后再更新小程序，无新增数据库迁移。协议、角色分工及验收步骤见 [车夫讲解与跟随](driver-commentary-integration.md)。本页原有定位历史表与至少 24 小时留存说明继续适用。

## 本次交付边界

Android 车夫 APP → HTTPS API → PostgreSQL 定位历史及当前房间最新位置 → B 端高德地图。复用已有 `AppUser` 车夫权限和 `TranslationRooms` 房间，新增定位历史表 `driver_location_record`，每个采样至少保留 24 小时。

B 端入口：`/console/driver-locations`，导航名称「车夫位置」，仅 ADMIN 角色可访问位置列表。支持按手机号、昵称、房间码和定位状态筛选。点击房间或地图标记后，以 17 级缩放聚焦当前坐标，并绘制该房间最近 1 小时的轨迹；再次点击同一房间也会重新聚焦。可通过「查看完整轨迹」适配整段轨迹，通过「聚焦当前位置」回到最新点。地图保留已有标记并更新坐标，首次有数据时自动缩放，后续刷新不重置用户视野。

## 新增后端文件

后端根目录：`D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System`。

- `CulturalTourismSystem.Model/Request/DriverLocationRequest.cs`
- `CulturalTourismSystem.Model/Request/DriverLocationHistoryRequest.cs`
- `CulturalTourismSystem.Model/DataBase/DriverLocationRecord.cs`
- `CulturalTourismSystem.Service/Chat/TranslationRoomService.DriverLocations.cs`
- `CulturalTourismSystem.Service/Chat/DriverLocationStore.cs`
- `CulturalTourismSystem.Service/Chat/DriverLocationCleanupService.cs`
- `CulturalTourismSystem.WebApi/Controllers/DriverLocationsController.cs`
- `CulturalTourismSystem.ApiTests/DriverLocationTests.cs`
- `CulturalTourismSystem.ApiTests/DriverLocationStoreTests.cs`
- `doc/100-driver-location-history-ddl.sql`

服务作为现有 `TranslationRoomService` 的 partial 扩展；`ServiceRegistration.cs` 注册定位存储和后台过期清理服务。**部署前必须先执行新增 SQL 建表脚本**。

## 接口

沿用现有 `ApiResponse`：`code=0` 成功，`data` 是业务数据。所有主键和外键在客户端保留字符串，Android 使用 `JSONObject.getString`，不要转为浮点数。

| 方法 | 路径（均以 /api 开始） | 调用方 / 用途 |
| --- | --- | --- |
| POST | `/AppUser/Login` | APP 已有账号密码登录，platform=2 |
| POST | `/AppUser/RefreshToken` | 自动刷新令牌 |
| GET | `/TranslationRooms/host-permission` | 是否有车夫开房权限 |
| POST | `/TranslationRooms` | 复用现有创建接口，`sourceLanguage: "zh-CN"` |
| GET | `/TranslationRooms/{roomId}` | 恢复房间和二维码 |
| POST | `/TranslationRooms/{roomId}/close` | 关闭房间 |
| POST | `/DriverLocations/{roomId}` | 车夫上报当前房间最新位置 |
| POST | `/DriverLocations/{roomId}/heartbeat` | 维持连接状态，不能刷新坐标采样时间 |
| POST | `/DriverLocations/{roomId}/stop` | 停止共享并清除该房间坐标 |
| GET | `/DriverLocations` | ADMIN 查询当前有效车夫房间和最新位置 |
| GET | `/DriverLocations/history` | ADMIN 按车夫/房间、接收时间范围和游标分页查询持久化采样 |

新增接口均要求 Bearer 令牌。车夫身份取自令牌，每次上报/心跳校验账号状态、手机号绑定、车夫授权、房间归属及有效期；不接受客户端提供 userId 指定其他车夫。后台查询还要求 ADMIN，导游及 C 端账号不能查看位置。

上报示例（替换采样时间为实时 UTC）：

```json
{
  "longitude": 116.386,
  "latitude": 39.942,
  "accuracy": 12.5,
  "sampledAt": "2026-11-03T05:00:00Z",
  "coordinateSystem": "GCJ-02"
}
```

经纬度和精度必填且为有限数；精度范围 `(0,500]` 米，采样时间允许过去 2 分钟到未来 30 秒。每个有效采样先持久化再更新实时快照并返回成功。有效的乱序采样可写入历史，但不会覆盖最新位置；同一房间、同一采样时间重复上报只保留一条，不改写首次接收时间。数据库不可写时返回失败，APP 按原有机制重试；心跳不会写入虚构坐标。

历史查询示例：`GET /api/DriverLocations/history?roomId=123&pageSize=500`，或使用 `userId` 跨房间查询某位车夫。至少指定 `userId` 或 `roomId`，也可同时指定；二者及 `afterId` 必须为十进制 ID 字符串。`from`、`to` 是 UTC 接收时间，区间左闭右开，默认最近一个留存周期，查询区间长度不可超过配置的留存周期。每页默认 500，最多 2000 条。

响应包含 `list`、`hasMore`、`nextAfterId`、`from`、`to` 和 `retentionHours`。继续翻页传回相同 `from`、`to` 和 `nextAfterId` 作为 `afterId`。结果按记录 ID 升序分页。B 端通过同源代理 `/api/driver-locations/history` 获取选中房间的最近 1 小时记录，自动读取全部分页，再按采样时间排序并过滤窗口外的采样、无效坐标后绘线。时间窗口使用实时列表返回的服务端时间差校准，每 15 秒刷新；页面隐藏时暂停，切换房间或卸载时取消旧请求。无轨迹、只有一个点和加载失败均有提示；历史加载失败不影响实时点位展示。

## 刷新与状态

- 点击车夫列表或地图标记可聚焦该车夫并查看最近 1 小时轨迹；点击地图顶部的“总览全部车夫”可取消选中、清除搜索和状态筛选、收起个人轨迹，并自动调整地图范围展示全部有坐标的车夫。无坐标车夫仍显示在列表中，自动刷新不会持续重置地图视角。
- APP 期望每 1.5 秒获取新坐标，单线程在每轮请求完成后等待 1.5 秒再上报，弱网时实际间隔更长；无新坐标时在距上次上报或心跳达到 10 秒后发送心跳，通常约 10.5 秒。新频率需重新构建并安装 APK 后生效。
- B 端每 3 秒自动查询；请求不重叠，页面隐藏时暂停，恢复可见立即刷新，卸载页面取消请求。
- `online` 在线：有效采样在 30 秒内，连接心跳在 60 秒内。
- `stale` 定位过期：有位置但采样超过 30 秒。
- `offline` 离线：共享开始后，超过 60 秒未收到坐标/心跳。最后坐标仍保留，并用灰色标记。
- `waiting` 等待定位：APP 已发送心跳，但尚无有效坐标。
- `stopped` 未共享位置：尚未开启或已主动停止，坐标为空。
- 关闭、进入结束流程、过期房间和失去车夫授权的账号不返回到位置列表。

后台断连时页面提示保留旧数据，并按服务端时间差继续计算过期/离线，避免旧位置一直显示绿色在线。接收时间、采样时间和心跳时间互不混用。

## 数据变更与留存

新增 PostgreSQL 表 `driver_location_record`，包含雪花记录 ID、房间 ID、车夫 ID、经纬度、精度、坐标系、设备采样时间及服务端首次接收时间。房间和车夫 ID 使用外键，不设置级联删除；既有表及既有业务数据不做迁移。

- 留存按 `received_at` 起算，**至少 24 小时**，不按自然日零点删除。
- 服务启动 30 秒后清理一次，之后每小时清理；只删除严格早于留存截止时间的记录，刚满 24 小时的边界记录仍保留。正常清理周期下，实际保留约 24～25 小时；清理积压或服务停机可能使保留时间更长。
- 可配置 `DriverLocations:RetentionHours` 延长到 48、72 等小时，代码强制最低 24 小时。环境变量示例：`DriverLocations__RetentionHours=48`。
- 停止共享只清除实时快照；结束房间、服务重启或车夫权限撤销均不删除尚未过期的历史数据。管理员历史查询不依赖当前活跃房间，因此服务重启后仍可读取已入库的位置。
- 清理按批执行，每批最多 5000 条，每轮最多 20 批；失败记入日志，不影响正在运行的房间服务。

当前房间状态和实时快照仍由单实例内存房间服务维护；重启后原房间关闭，APP 需要重新开房并恢复共享，已保存的历史不受影响。本版本仍按**单个后端实例**部署。要水平扩容，需要统一房间路由/会话归属，而不仅是将坐标写入数据库。

安卓定位心跳维持暂停且无主持人连接的房间存活，但不延长原房间约 3 小时有效期，不改变现有语音讲解状态机。

1. 在业务 PostgreSQL 数据库执行 `doc/100-driver-location-history-ddl.sql`。脚本可重复执行，只新建定位表和索引，不回填此前内存位置。
2. 发布包含新增文件及服务注册的 WebApi 和依赖程序集；数据库缺表时不会将位置上报当作成功。
3. 构建并发布 B 端，沿用现有 `NUXT_BACKEND_BASE_URL`、高德 JS Key 和安全配置。Android Key 与 Web JS Key 属于不同平台，不能互换。
4. APP 上报契约不变；0.2.0 增加独立登录页与原生地图，默认 API 为 `https://www.omahaaigc.com/path-seeker/api`。历史数据持久化本身不要求升级 APK，使用新界面需安装新版。
5. 管理员先在 C 端用户管理中授权车夫，再进行真实账号、开房、息屏、断网及撤权验收，并查询历史确认入库。

无需为定位增加单独 WebSocket 或端口。0.3.0 小程序开启「跟随车夫」后通过新增房间坐标接口判定景点接近并排队，需要同步部署后端和更新小程序。B 端查看位置不等同于游客端息屏语音触发，支付宝挂起限制仍然存在。

### 本地 B 端联调地址

本地入口 `http://localhost:3000/path-seeker/admin/console/driver-locations` 通过 Nuxt 代理查询定位。APP 上报到线上时，本地 `NUXT_BACKEND_BASE_URL` 也应配置为 `https://www.omahaaigc.com/path-seeker/api/`，修改后重启开发服务，并使用对应环境的管理员账号登录。

本次故障核验：旧的本地 `http://127.0.0.1:8199/api/DriverLocations` 返回 404；线上 `https://www.omahaaigc.com/path-seeker/api/DriverLocations` 返回正常的未认证 401。线上网站根路径 `https://www.omahaaigc.com/api/DriverLocations` 也返回 404。Nuxt 代理返回的 `backendStatus: 404` 应结合实际 upstream 排查。

## 已执行的验证

- 定位、现有房间及车夫授权回归测试：42 项通过，覆盖入库失败、幂等重试、历史分页、服务重建、管理员访问及最短留存限制等。
- 隔离 PostgreSQL 18 集成测试：1 项通过，实际执行可重入建表脚本、写入与去重、重新连接查询、过滤分页及 24 小时清理边界。后端相关验证合计 43 项通过；未执行到业务数据库。
- B 端 Nuxt/Vue TypeScript 类型检查通过。
- Android 0.2.0 调试版、签名发布版构建成功；Android Lint 无错误及警告；两份 APK 均通过 apksigner 校验，证书 SHA1 与高德注册信息一致，发布签名与 0.1.0 保持一致。
- 本地 Nuxt 已重启并加载线上 API 地址；车夫位置页面返回 200，定位 BFF 的无令牌请求从旧后端 404 恢复为线上接口的正常 401。未使用真实管理员令牌执行位置列表验收，需在页面登录线上管理员账号后核对实时位置。
- 本机未连接 Android 真机，尚未执行安装、高德 Key 在线鉴权和长时间息屏定位验收；本批未部署线上后端或 B 端。

后端现有依赖审计及可空性警告、B 端已有重复自动导入警告仍存在，本批未修改相关依赖。

真实 PostgreSQL 验证使用专用连接环境变量 `DRIVER_LOCATION_TEST_CONNECTION_STRING`，测试会创建独立 schema，并在结束时回收。不要将该变量指向线上业务数据库。执行 `dotnet test --filter FullyQualifiedName~DriverLocationStoreTests`；未设置连接时该测试明确跳过。
