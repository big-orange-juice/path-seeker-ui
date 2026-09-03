# 地点分层与古镇路线地图全链路改造执行方案

> 适用仓库：`web/path-seeker-ui`
>
> 涉及系统：后端 `CulturalTourismSystem`、B 端 `apps/web-admin`、C 端 `apps/h5-client`
>
> 关联文档：`docs/64-real-coordinate-map-frontend-modification-plan.md`
>
> 初版日期：2026-08-28
>
> 更新日期：2026-08-29
>
> 核心决策：本期继续使用现有 Vue 3 H5 主链路，不迁移原生小程序；古镇地图使用腾讯地图 JavaScript API GL，定位只作为辅助能力，不承担强制自动到站与防作弊。

## 1. 文档目的

本文将“多展馆/古镇地点层级、展馆详情、古镇真实地图、路线创建与发布”拆解为可直接执行的数据库、后端、B 端和 C 端改造任务，并明确：

- 哪些现有代码保留；
- 后端现有地图与路线能力如何复用；
- B 端如何根据路线站点生成、审核和修正实际路线；
- 后端如何调用腾讯步行路线规划并固化发布版本；
- C 端如何只读取已发布几何并渲染；
- 哪些页面需要新增或重构；
- 地图 SDK 如何隔离；
- 地点、路线、地图和任务状态如何拆分；
- 后端需要补充哪些接口和字段；
- 浏览器定位如何降级；
- 每个阶段如何验收；
- 什么条件出现后才重新评估原生小程序地图。

本文是当前地图全链路实施的优先依据。`docs/64-real-coordinate-map-frontend-modification-plan.md` 仍保留其室内外地图并存、文化资产、坐标系和后台编辑原则；其中“小程序端同步”不属于本期交付范围。

本次更新以现有代码为基础，不把后端、B 端或 C 端假设为新项目。总体链路确定为：

    B 端配置路线站点
      -> 后端按相邻站点调用腾讯步行路线规划
      -> B 端预览并修正自动生成结果
      -> 后端校验并固化路线几何
      -> 沿用现有审核/上架工作流发布
      -> C 端按 routeId 获取已发布路线并直接渲染

## 2. 最终决策

### 2.1 本期采用的产品结构

    探索地点
      ├── 展馆
      │    └── 展馆详情
      │         ├── 展馆基础信息
      │         ├── 开放时间与地址
      │         ├── 馆内地图入口
      │         └── 现有路线瀑布流
      │
      └── 古镇
           └── 古镇地图
                ├── 古镇边界
                ├── 文化资产与服务设施
                ├── 悬浮路线控件
                ├── 路线选择浮层
                ├── 实际路线折线
                ├── 路线站点
                └── 可选的“定位到我”

地点类型决定首屏体验：

- 展馆以内容和路线发现为主，采用“详情在上、瀑布流在下”；
- 古镇以空间认知为主，进入后直接展示真实地图；
- 路线、文化资产详情、章节、谜题、问一问继续运行在现有 H5；
- `apps/mp-shell` 继续只承载 H5，不新增原生地图业务页。

### 2.2 本期不迁移小程序的理由

本期地图需求集中在：

- 显示腾讯底图；
- 显示古镇边界；
- 显示文化资产和服务设施 Marker；
- 点击悬浮路线控件选择路线；
- 在地图上绘制实际路线；
- 显示站点、起点和终点；
- 自动适配完整路线视野；
- 用户主动点击“定位到我”；
- 计算与目标点的大致距离。

上述能力均可由 Vue 3、腾讯地图 JavaScript API GL 和浏览器 Geolocation 完成。继续使用 H5 可以复用现有：

- 登录和请求层；
- Vue Router；
- Pinia；
- 路线卡、筛选和任务链路；
- 文化资产详情；
- 问一问、SSE 和音频能力；
- 当前主题和组件体系；
- H5 与小程序壳的现有部署方式。

### 2.3 本期明确不做

- 不重建 `apps/mp-wechat`；
- 不在 `apps/mp-shell` 新增原生地图页；
- 不实现后台持续定位；
- 不承诺锁屏或切后台后继续定位；
- 不使用 H5 GPS 自动完成任务；
- 不把 GPS 作为唯一到站凭证；
- 不实现偏航提醒或逐转向导航；
- 不在前端实现道路规划算法；
- 不用站点直线冒充真实步行路线；
- 不一次加载所有路线的完整几何；
- 不改造现有室内展厅图片地图协议；
- 不将地图供应商 SDK 对象写入业务接口或共享类型；
- 不把 WebService 签名密钥暴露在 H5 中。

## 3. 当前代码基线

### 3.1 当前运行架构

当前生产形态为：

    apps/mp-shell 原生小程序壳
      └── pages/index/index
           └── <web-view>
                └── apps/h5-client

`apps/mp-shell` 继续保持轻量壳职责。本期所有地点、展馆和古镇地图业务均在 `apps/h5-client` 内实现。

### 3.2 当前路线大厅

现有 `apps/h5-client/src/pages/ShellHallPage.vue` 已包含：

- 路线列表；
- 标题和导游筛选；
- 双列瀑布流；
- 骨架屏；
- 空状态；
- 刷新失败后保留旧数据。

现有 `MissionPreviewCard.vue` 继续作为展馆详情下方的路线卡，不在本期重写路线卡协议。

当前问题是路线大厅以单一场馆为前提：

- `useMissionStore.ts` 使用固定 `VITE_MUSEUM_ID`；
- `/shell/hall` 标题和底部导航写死为“展厅”；
- 路线筛选没有地点上下文；
- 多地点下无法明确路线归属。

### 3.3 当前户外地图

现有 `apps/h5-client/src/pages/OutdoorMapPage.vue` 只是占位实现：

- CSS 网格模拟底图；
- Marker 使用固定百分比和 `nth-of-type` 摆放；
- 没有真实地图 SDK；
- 没有路线选择；
- 没有路线几何；
- 没有用户定位；
- 页面同时承担加载、筛选、模拟渲染和详情卡，职责过重。

现有 `useOutdoorMapStore.ts` 已提供场景加载、资产类型筛选和区域筛选基础，可在拆分后继续演进。

### 3.4 当前共享地理类型

`packages/ts-shared/src/geo.ts` 已包含：

- `CoordinateSystem`；
- `GeoPoint`；
- 点、线、面 GeoJSON；
- 经纬度有效性检查；
- GeoJSON 解析；
- `GeoLocation`。

`packages/ts-shared/src/outdoor-map.ts` 已包含：

- `SiteAreaResponse`；
- `OutdoorMapMuseum`；
- `OutdoorMapAsset`；
- `OutdoorMapSceneResponse`。

当前缺少：

- 地点列表与地点详情协议；
- 服务设施图层；
- 路线地图详情；
- 路线站点；
- 路线几何；
- 地图页面模式；
- 定位结果和定位状态协议。

### 3.5 当前后端可直接复用的能力

后端代码位于：

    D:/workspace/amh/code/CulturalTourism/git_src/CulturalTourism_System

已经具备以下基础，不需要重新建模：

| 现有能力 | 代码/接口 | 本次用途 |
|---|---|---|
| 地点类型、中心点、坐标系、地图供应商、边界 | `Museum`、`MuseumResponse` | 区分展馆/古镇并初始化地图 |
| 古镇区域边界 | `MuseumSiteArea` | 绘制街区、片区或院落边界 |
| 文化资产真实位置 | `MuseumExhibitLocation` | 路线站点候选坐标和资产 Marker |
| 户外场景公开接口 | `GET /Map/Scene` | C 端加载古镇、区域和资产 |
| 路线容器及地点归属 | `PuzzleRoute.MuseumId` | 限定路线所属地点 |
| 有序路线节点 | `RouteStage.StageNo/SortOrder/RefExhibitId` | 推导路线站点顺序 |
| C 端已发布路线列表 | `POST /Route/Published` | 地图路线选择面板 |
| 路线详情 | `GET /Route/Detail` | 路线内容和节点摘要 |
| 路线审核与发布 | `/Route/SubmitAudit`、`/Route/Audit`、`/Route/Publish` | 将地图几何纳入既有工作流 |
| 路线数据权限 | `RouteDataPermissionPolicy`、`RouteWorkflowPolicy` | 限制谁能生成、编辑和发布路线 |

现有 `MuseumService.GetOutdoorMapSceneAsync` 已完成：

- 场馆存在性检查；
- 区域与公开文化资产加载；
- 主位置选择；
- 视野范围过滤；
- 附件 URL 解析；
- 所有响应 ID 字符串化。

本期应扩展上述能力，不新增平行的“景区”主实体，也不复制一套独立路线业务。

### 3.6 当前后端与 B 端缺口

当前没有以下能力：

- 路线级地图几何实体；
- 路线分段几何及来源记录；
- 路线节点到实际地图站点的稳定映射；
- 腾讯步行路线规划客户端；
- 自动路线结果解压、拼接、去重和校验；
- B 端路线地图编辑与审核界面；
- 古镇路线发布前的地图完整性校验；
- C 端公开的 `GET /Map/Route`；
- 已发布路线几何版本和生成来源信息。

`apps/web-admin` 已有路线列表、路线详情 Dialog、节点流程图、节点编辑、审核和上架操作。地图编辑应作为现有路线详情的专用工作台接入，而不是再创建一套路线管理页面。

现有 `RouteDetailDialog.vue` 已经承担路线内容编排和预览，且采用固定高度 Dialog。本期在详情工具栏增加“路线地图”入口，打开独立的 `RouteMapEditorDialog.vue`；不把大地图长期塞进路线列表页，也不把地图编辑器嵌入节点编辑 Dialog。

## 4. 目标信息架构

### 4.1 一级入口

将用户侧“展厅”升级为“探索”。推荐路由：

    /venues

一级页面展示所有可访问地点，包括展馆、古镇和景区。

如果后端暂时继续使用 `museum` 命名，前端内部可以保留 `museumId`，用户文案统一使用“地点”“展馆”“古镇”，本期不要求后端整体改名为 `venue`。

### 4.2 地点分流

推荐路由：

    /venues/:venueId

地点详情页读取 `venueType` 后决定渲染：

    venueType = 展馆      -> MuseumVenuePage
    venueType = 古镇      -> AncientTownVenuePage
    venueType = 景区      -> 第一阶段按 AncientTownVenuePage 处理
    venueType 未知        -> 通用地点详情 + 路线列表降级

也可以使用明确路由：

    /museums/:museumId
    /museums/:museumId/map

本期推荐先保留现有 `/museums/:museumId/map`，减少旧链接改造范围；新增 `/venues` 和 `/venues/:venueId` 作为新的信息架构入口。

### 4.3 深链规则

保留并扩展：

    /museums/:museumId/map?routeId=...
    /museums/:museumId/map?assetId=...
    /museums/:museumId/assets/:assetId

语义：

- 只有 `museumId`：打开古镇地图自由浏览；
- 带 `routeId`：打开地图并预览指定路线；
- 带 `assetId`：打开地图并聚焦指定文化资产；
- 同时带 `routeId` 和 `assetId`：先加载路线，再聚焦路线中的指定站点；
- 参数无效：保留地图页面，显示可恢复错误，不跳到空白页。

所有 ID 必须始终按 `string` 处理，禁止 `Number(id)` 和 `parseInt(id)`。

## 5. 页面体验规格

### 5.1 探索地点页

页面职责：帮助用户选择要进入的展馆或古镇，不直接展示所有地点的全部路线。

地点卡至少展示：

- 地点名称；
- 地点类型；
- 封面；
- 城市或地址摘要；
- 路线数量；
- 文化资产数量，可选；
- 开放状态，可选；
- 最近游玩状态，可选。

启动分流：

    有进行中任务          -> 优先展示继续游玩入口
    分享链接带 routeId    -> 进入路线详情或对应地点
    链接带 museumId       -> 进入对应地点
    只有一个地点          -> 可以直接进入地点
    多地点且无上下文      -> 展示地点列表

### 5.2 展馆详情页

结构：

    展馆头部
      ├── 封面或建筑图
      ├── 展馆名称
      ├── 一句话介绍
      ├── 今日开放状态
      ├── 地址与开放时间
      ├── 展厅数与路线数
      └── 馆内地图 / 交通地址

    推荐路线
      ├── 路线数量
      ├── 筛选
      └── 现有路线瀑布流

体验约束：

- 顶部详情保持紧凑；
- 首屏或轻微滚动后必须露出第一张路线卡；
- 长介绍折叠，提供“展开介绍”；
- 路线卡不重复展示当前展馆名称；
- 当前进行中路线可在瀑布流前使用横向宽卡置顶；
- 地点详情加载失败时，如果路线接口可用，允许降级显示路线；
- 路线加载失败时，展馆详情仍然可查看。

### 5.3 古镇地图页

古镇地图以真实地图作为主体，不在地图上方堆叠长篇介绍。

默认层级：

    顶部导航
    地图全屏内容区
      ├── 古镇边界
      ├── 主要文化资产
      ├── 服务设施
      ├── 左侧悬浮“路线”控件
      ├── 右侧“定位到我”控件
      └── 当前资产或路线摘要卡

路线控件交互：

    点击“路线”
      -> 打开路线选择浮层
      -> 选择路线
      -> 按需请求路线地图详情
      -> 清除上一条路线
      -> 绘制实际路线
      -> 绘制编号站点
      -> 自动适配路线视野
      -> 收起或半收起路线浮层
      -> 底部展示当前路线摘要

路线控件必须包含文字，不只使用抽象图标。默认显示“路线 + 数量”，选中后显示“切换路线”或“当前路线”。

### 5.4 地图模式

本期采用三种模式：

    browse          自由浏览古镇和文化资产
    route-preview   预览选中路线
    asset-focus     聚焦指定文化资产

暂不实现：

    route-active
    station-arrived
    automatic-check-in

推荐类型：

```ts
export type OutdoorMapMode = "browse" | "route-preview" | "asset-focus"
```

模式规则：

| 模式 | 显示内容 | 主操作 |
|---|---|---|
| `browse` | 边界、重点资产、设施 | 选路线、选资产、定位到我 |
| `route-preview` | 一条路线、编号站点、起终点 | 查看路线详情、开始路线、切换路线 |
| `asset-focus` | 聚焦资产、位置摘要、周边点位 | 查看详情、返回全景、查看相关路线 |

## 6. 视觉与交互原则

### 6.1 品牌延续

地图底图来自腾讯，页面仍需保持现有 C 端黑金视觉：

- 顶部导航使用当前黑金主题；
- 路线控件使用金色边框和深色半透明背景；
- 路线浮层沿用现有 `ClientSheet` 视觉语言；
- 路线折线使用高对比品牌金；
- 起点、终点和普通站点具有不同形状，不只依赖颜色；
- 当前资产卡沿用文化资产详情的字体与间距；
- 地图本身不叠加星点、噪点和电影化背景效果。

地图页面唯一的强视觉表达是“路线像一条被点亮的金线”。其他控件保持克制。

### 6.2 移动端布局

- 路线控件距离左边缘至少 `16px`，避免与系统返回手势冲突；
- 点击热区不小于 `44px × 44px`；
- 路线面板优先使用底部 Sheet；
- 如果视觉必须从左侧展开，宽度不超过视口的 `84%`，右侧保留地图上下文；
- 面板打开时阻止点击穿透，但不销毁地图；
- 选择路线后自动收起到摘要状态；
- 底部摘要卡不能遮挡腾讯地图版权、比例尺或必要控件；
- 兼容安全区 `env(safe-area-inset-bottom)`。

### 6.3 动效

本期动效只服务结构变化：

- 路线控件按压反馈；
- 路线面板进入/退出；
- 选中路线后的摘要卡进入；
- Marker 选中态；
- 定位成功后的短暂脉冲。

地图视野移动和缩放使用地图 SDK 自身能力，不用 GSAP 操作地图容器。支持 `prefers-reduced-motion`，降低非必要的浮层过渡。

## 7. 前端目录与组件拆分

### 7.1 推荐目录

    apps/h5-client/src/
      pages/
        VenueExplorerPage.vue
        VenueDetailPage.vue
        OutdoorMapPage.vue

      components/venue/
        VenueCard.vue
        VenueHero.vue
        VenueMeta.vue
        MuseumRouteSection.vue

      components/map/
        OutdoorMapCanvas.vue
        MapRouteControl.vue
        RouteSelectionPanel.vue
        RouteSelectionCard.vue
        CurrentRoutePreview.vue
        MapLocationControl.vue
        MapLayerControl.vue
        OutdoorAssetPopup.vue
        OutdoorMapStatus.vue

      composables/
        useTencentMap.ts
        useOutdoorRouteMap.ts
        useBrowserLocation.ts

      map/
        types.ts
        createMapAdapter.ts
        adapters/
          tencent.ts

      services/
        venue.ts
        outdoorMap.ts

      stores/
        useVenueStore.ts
        useOutdoorMapStore.ts

      utils/
        outdoorMapView.ts
        geoDistance.ts

### 7.2 页面职责

`VenueExplorerPage.vue`：

- 加载地点列表；
- 展示地点卡；
- 执行地点分流；
- 展示继续游玩入口。

`VenueDetailPage.vue`：

- 加载地点详情；
- 根据 `venueType` 组合展馆详情或古镇地图入口；
- 不直接实现地图 SDK。

`OutdoorMapPage.vue`：

- 读取路由参数；
- 组合地图画布、路线控件、面板和摘要卡；
- 协调 Store 和 composable；
- 不直接创建腾讯地图 Marker 或 Polyline。

### 7.3 地图组件职责

`OutdoorMapCanvas.vue`：

- 提供地图 DOM 容器；
- 调用地图 adapter；
- 响应场景、路线、聚焦资产和用户位置变化；
- 向父级上报资产点击、视野变化和地图就绪事件。

建议公开契约：

```ts
interface OutdoorMapCanvasProps {
  scene: OutdoorMapSceneResponse | null
  routeMap: OutdoorRouteMapResponse | null
  focusedAssetId: string | null
  userLocation: BrowserLocationResult | null
  layerState: OutdoorMapLayerState
}

interface OutdoorMapCanvasEmits {
  ready: []
  assetSelect: [assetId: string]
  stationSelect: [stationId: string]
  boundsChange: [bounds: MapBounds]
  error: [message: string]
}
```

`MapRouteControl.vue`：

- 展示悬浮路线按钮；
- 显示路线数量或当前状态；
- 只发出打开面板事件。

`RouteSelectionPanel.vue`：

- 展示路线列表、筛选、加载和错误状态；
- 使用 `v-model` 管理打开状态；
- 发出 `select-route`；
- 不直接操作地图。

`CurrentRoutePreview.vue`：

- 展示当前路线名称、站数、距离和预计时间；
- 提供“路线详情”“开始探索”“清除路线”；
- 不执行接口请求。

`MapLocationControl.vue`：

- 展示定位按钮及定位状态；
- 发出定位请求；
- 不直接调用 `navigator.geolocation`。

### 7.4 Composable 职责

`useTencentMap.ts`：

- 加载腾讯地图 SDK；
- 初始化和销毁地图；
- 保存不可深度代理的地图实例；
- 提供点、线、面和视野控制的统一动作；
- 隔离腾讯地图私有对象。

地图实例、Marker 实例和 Polyline 实例必须使用 `shallowRef` 或模块私有变量，不进入 Pinia 深度响应式状态。

`useOutdoorRouteMap.ts`：

- 加载指定路线地图详情；
- 处理请求版本和过期响应；
- 维护当前 `routeId`；
- 解析路线 GeoJSON；
- 提供选择、清除和恢复动作。

`useBrowserLocation.ts`：

- 管理权限状态；
- 单次请求高精度位置；
- 返回坐标、精度和错误；
- 集中处理 WGS84 到 GCJ-02 的转换；
- 本期不默认启动 `watchPosition`。

## 8. 地图适配层

### 8.1 适配目标

业务页面不能直接出现腾讯地图类名或私有类型。统一 adapter 建议提供：

```ts
export interface MapAdapter {
  mount(container: HTMLElement, options: MapMountOptions): Promise<void>
  destroy(): void
  setCenter(point: GeoPoint, zoom?: number): void
  setSceneBoundary(boundary: GeoJsonGeometry | null): void
  setAreaBoundaries(areas: SiteAreaResponse[]): void
  setAssets(assets: OutdoorMapAsset[]): void
  setFacilities(facilities: OutdoorMapFacility[]): void
  setRoute(route: OutdoorRouteMapResponse | null): void
  setUserLocation(location: BrowserLocationResult | null): void
  focusAsset(assetId: string): void
  fitPoints(points: GeoPoint[], options?: MapFitOptions): void
  getBounds(): MapBounds | null
}
```

### 8.2 SDK 加载

SDK 加载器必须：

- 全局只加载一次；
- 支持并发调用复用同一个 Promise；
- 加载失败可重试；
- 检查必要环境变量；
- 不在组件模板中硬编码 Key；
- 销毁页面时移除业务覆盖物和监听器；
- 不重复创建全局脚本标签。

建议新增环境变量：

    VITE_TENCENT_MAP_KEY=

JavaScript API Key 本身会出现在前端请求中，应在腾讯位置服务控制台配置授权域名、产品权限、调用额度和告警。WebService 的 SK 不得进入 H5 环境变量。

### 8.3 坐标系

地图展示统一使用 GCJ-02。

规则：

- 后端场景数据优先直接返回 GCJ-02；
- `coordinateSystem` 必须显式返回；
- WGS84 浏览器定位进入腾讯地图前集中转换；
- BD-09 数据必须先转换；
- 页面和组件不自行转换坐标；
- GeoJSON 坐标顺序始终是 `[longitude, latitude]`；
- 经纬度字段保持 `number`，业务 ID 保持 `string`。

## 9. 状态管理

### 9.1 `useVenueStore`

新增 Store，负责：

```ts
interface VenueState {
  venues: VenueSummary[]
  currentVenueId: string | null
  currentVenue: VenueDetail | null
  pending: boolean
  error: string | null
}
```

动作：

- `loadVenues()`；
- `loadVenue(venueId)`；
- `selectVenue(venueId)`；
- `clearVenue()`。

`VITE_MUSEUM_ID` 只保留为单地点部署兼容默认值，不再作为所有路线请求的唯一来源。

### 9.2 `useMissionStore` 改造

当前 `loadRouteCards()` 使用固定 `DEFAULT_MUSEUM_ID`，改为显式接收地点：

```ts
async function loadRouteCards(options: {
  museumId: string
  force?: boolean
})
```

或从 `useVenueStore.currentVenueId` 获取，但服务函数仍应接受显式 `museumId`，避免隐藏依赖。

缓存键必须包含：

    museumId + ageBand + difficulty + scaleType + keyword + guideName + guideId

切换地点时：

- 取消或忽略上一地点的路线请求；
- 清理 `guideId` 等可能跨地点残留的精确筛选；
- 保留通用年龄和难度筛选可选；
- 不显示上一地点的路线作为当前地点结果；
- 需要旧数据过渡时必须明确标注正在切换，不能静默混用。

### 9.3 `useOutdoorMapStore` 改造

建议状态：

```ts
interface OutdoorMapState {
  scene: OutdoorMapSceneResponse | null
  routes: OutdoorRouteSummary[]
  selectedRouteId: string | null
  selectedAssetId: string | null
  routeMap: OutdoorRouteMapResponse | null
  mode: OutdoorMapMode
  selectedAssetType: number | null
  selectedSiteAreaId: string | null
  layerState: OutdoorMapLayerState
  scenePending: boolean
  routesPending: boolean
  routeMapPending: boolean
  sceneError: string | null
  routesError: string | null
  routeMapError: string | null
}
```

动作：

- `loadScene(museumId)`；
- `loadRoutes(museumId)`；
- `selectRoute(routeId)`；
- `clearRoute()`；
- `focusAsset(assetId)`；
- `clearAssetFocus()`；
- `setLayerState()`；
- `resetForMuseum(museumId)`。

Store 不保存地图 SDK 实例。

## 10. 推荐接口契约

### 10.1 地点列表

推荐：

    POST /Museum/PageList

或新增面向 C 端的公开地点列表：

    GET /Museum/Published

推荐响应：

```ts
export interface VenueSummary {
  id: string
  venueType: number
  name: string
  description: string | null
  coverImageUrl: string | null
  addressText: string | null
  longitude: number | null
  latitude: number | null
  coordinateSystem: CoordinateSystem
  routeCount: number
  assetCount: number
  openStatus: number | null
}
```

### 10.2 地点详情

推荐：

    GET /Museum/Get?id={museumId}

需要补齐或确认：

- `venueType`；
- 封面；
- 简介；
- 地址；
- 开放时间；
- 联系方式，可选；
- 地图中心；
- 默认缩放级别；
- 坐标系；
- 地图供应商；
- 景区边界；
- 路线数量；
- 展厅或区域数量。

### 10.3 地图场景

保留：

    GET /Map/Scene?museumId=...

建议响应：

```ts
export interface OutdoorMapSceneResponse {
  museum: OutdoorMapMuseum | null
  areas: SiteAreaResponse[]
  assets: OutdoorMapAsset[]
  facilities: OutdoorMapFacility[]
}
```

地图首次加载不返回所有路线几何。

### 10.4 路线列表

复用：

    POST /Route/Published

请求必须带当前 `museumId`。地图路线面板可复用现有路线卡响应，但应避免拉取不必要的详情和媒体。

### 10.5 路线地图详情

新增 C 端公开接口：

    GET /Map/Route?routeId={routeId}

控制器可以沿用现有地图公开接口的 `[SkipPermission]` 方式，但 Service 必须校验路线处于已发布状态、当前时间在有效期内且路线地图已经确认。该接口只返回发布数据；B 端预览不得复用公开接口，避免未发布内容泄漏。

响应：

```ts
export interface OutdoorRouteMapResponse {
  routeId: string
  museumId: string
  title: string
  coordinateSystem: CoordinateSystem
  geometryGeoJson: string | null
  stations: OutdoorRouteStation[]
  distanceMeters: number | null
  estimatedMinutes: number | null
  geometryStatus: "ready" | "station_only" | "unavailable"
  geometryVersion: number
  generatedBy: "tencent_walking" | "manual" | "imported_track" | "mixed" | null
}

export interface OutdoorRouteStation {
  id: string
  routeId: string
  stageId: string | null
  assetId: string | null
  stationNo: number
  title: string
  longitude: number | null
  latitude: number | null
  entranceLongitude: number | null
  entranceLatitude: number | null
  triggerRadiusMeters: number | null
  completed?: boolean
}
```

约束：

- `routeId`、`museumId`、`stageId`、`assetId`、站点 `id` 一律是字符串；
- 路线几何必须代表实际可通行路线；
- 没有实际路线时返回 `station_only`，前端明确显示“仅展示站点顺序”；
- 不允许后端或前端把站点直线标记为实际步行路线；
- `geometryGeoJson` 只接受 `LineString` 或 `MultiLineString`；
- 无效 GeoJSON 返回可读状态，不返回半解析私有字段。

### 10.6 B 端路线地图接口

新增 `RouteMapController`，全部使用现有 `AdminOnly`、当前用户和路线数据权限：

| 接口 | 用途 |
|---|---|
| `GET /RouteMap/Get?routeId=...` | 读取草稿站点、分段、完整几何和校验状态 |
| `POST /RouteMap/SyncStations` | 从有序 `route_stage` 与资产主位置同步地图站点 |
| `POST /RouteMap/Generate` | 对选定或全部相邻站点分段调用腾讯步行算路 |
| `POST /RouteMap/SaveSegment` | 保存人工绘制或修正后的单段几何 |
| `POST /RouteMap/ImportTrack` | 可选，导入现场轨迹并形成候选几何 |
| `POST /RouteMap/Validate` | 执行坐标、拓扑、跨地点、路段连续性校验 |
| `POST /RouteMap/Confirm` | 运营人员确认当前几何可进入审核/发布 |

B 端 Nuxt server 增加一一对应的 `/api/route-map/*` 代理。代理层只做登录态透传、ID 字符串透传和响应解包，不在 Node 层调用腾讯 WebService，也不实现路线拼接。

### 10.7 腾讯步行算路调用边界

腾讯 Direction WebService 的步行模式只接受起点和终点，不接受与驾车模式等价的多途经点集合。因此一条多站点古镇路线必须按相邻站点分段计算：

官方依据：[腾讯位置服务路线规划 WebService](https://lbs.qq.com/service/webService/webServiceGuide/route/webServiceRoute)。当前文档中 `walking` 请求参数只有 `from`、`to` 等基础参数；`waypoints` 属于驾车规划能力，不能拿来生成古镇步行游线。

    站点 1 -> 站点 2
    站点 2 -> 站点 3
    站点 3 -> 站点 4

后端完成：

1. 读取站点入口坐标；
2. 对每一相邻站点调用 `walking`；
3. 解压腾讯返回的压缩 `polyline`；
4. 将腾讯的 `lat,lng` 转为内部 GeoJSON `[lng,lat]`；
5. 去除相邻分段的重复端点；
6. 保存每段结果及完整 `LineString`/`MultiLineString`；
7. 汇总距离和预计时长；
8. 返回 B 端预览，未经确认不得发布。

腾讯 WebService Key、SK、签名和配额配置只放在后端配置中。H5 的 JavaScript API Key 与后端 WebService Key 分开申请、分开限额、分开告警。

## 11. 路线地图数据与发布策略

### 11.1 数据库模型

不建议把完整路线几何直接塞进 `puzzle_route`，也不建议写入 `route_stage.config`。路线内容、站点位置、分段几何具有不同生命周期，应新增三张表。

#### `route_map`

一条业务路线对应一条当前地图草稿/确认记录：

```text
id                    bigint
route_id              bigint unique
museum_id             bigint
coordinate_system     smallint
geometry_geojson      jsonb null
geometry_status       smallint
source_type           smallint
distance_meters       integer null
estimated_minutes     integer null
geometry_version      integer
generation_status     smallint
last_error_code       varchar null
last_error_message    varchar null
confirmed_by          bigint null
confirmed_at          timestamptz null
generated_at          timestamptz null
created_at/updated_at/is_deleted
```

建议枚举：

- `geometry_status`：`0=unavailable`、`1=station_only`、`2=ready`；
- `source_type`：`1=tencent_walking`、`2=manual`、`3=imported_track`、`4=mixed`；
- `generation_status`：`0=idle`、`1=running`、`2=succeeded`、`3=partial_failed`、`4=failed`。

#### `route_map_station`

保存路线节点在地图上的物理站点。非物理内容节点可以没有站点记录：

```text
id                    bigint
route_map_id          bigint
route_id              bigint
stage_id              bigint null
exhibit_id            bigint null
station_no            integer
title                 varchar
longitude             numeric(10,7)
latitude              numeric(10,7)
coordinate_system     smallint
source_type           smallint
trigger_radius_meters numeric null
sort_order            integer
created_at/updated_at/is_deleted
```

坐标优先级：

1. B 端人工确认的站点入口坐标；
2. `MuseumExhibitLocation.IsPrimary=1` 的点坐标；
3. 同资产按 `SortOrder` 排序后的第一个有效点；
4. 没有有效坐标时标记站点缺失，不使用博物馆中心或随机坐标补齐。

#### `route_map_segment`

保存每两个相邻地图站点之间的实际路线：

```text
id                    bigint
route_map_id          bigint
from_station_id       bigint
to_station_id         bigint
segment_no            integer
source_type           smallint
geometry_geojson      jsonb null
distance_meters       integer null
estimated_minutes     integer null
provider_request_id   varchar null
status                smallint
error_code            varchar null
error_message         varchar null
created_at/updated_at/is_deleted
```

保留分段数据可以单独重算失败路段、人工替换古镇内部小巷，并明确一条完整路线为何是 `mixed`，避免每次修改一个站点都重算全部路段。

### 11.2 后端服务拆分

建议新增：

```text
CulturalTourismSystem.Model/
  DataBase/RouteMap.cs
  Request/RouteMapRequests.cs
  Response/RouteMapResponses.cs

CulturalTourismSystem.IRepository/
  IRouteMapRepository.cs

CulturalTourismSystem.Repository/
  RouteMapRepository.cs

CulturalTourismSystem.IService/
  IRouteMapService.cs
  ITencentDirectionClient.cs

CulturalTourismSystem.Service/
  RouteMapService.cs
  Maps/TencentDirectionClient.cs
  Maps/TencentPolylineCodec.cs
  Maps/GeoJsonRouteValidator.cs

CulturalTourismSystem.WebApi/Controllers/
  RouteMapController.cs
```

职责边界：

- `TencentDirectionClient` 只负责 HTTP、签名、超时、状态码和原始响应；
- `TencentPolylineCodec` 只负责官方压缩点串解压；
- `GeoJsonRouteValidator` 负责类型、坐标范围、点数、连续性和地点边界校验；
- `RouteMapService` 负责权限、站点同步、分段生成、拼接、确认和公开读取；
- Repository 负责三张路线地图表，不把第三方调用写进仓储层；
- `MapController.Route` 只暴露已经发布的 C 端快照。

腾讯调用必须使用 `IHttpClientFactory`，配置连接与总超时、有限重试、日志脱敏、调用量指标和失败熔断。不得记录 Key、SK 或用户精确位置。

### 11.3 B 端路线地图工作台

入口放在现有 `RouteDetailDialog.vue` 的工具栏，名称为“路线地图”。点击后打开固定高度 `RouteMapEditorDialog.vue`：

    h-[92vh]
    左侧约 68%：腾讯地图与路线编辑画布
    右侧约 32%：站点、路段和校验结果

工作台包含：

- 当前地点与路线只读摘要；
- 按顺序排列的物理站点列表；
- “从节点同步站点”；
- “生成全部缺失路段”；
- 单路段“重新生成”；
- 单路段切换为人工绘制；
- 地图点选调整站点入口；
- 撤销当前未保存绘制；
- 距离、预计时间、来源和失败原因；
- “检查路线”与“确认路线”；
- 已发布/待审核时的只读锁定状态。

交互遵循现有后台规则：

- 路线列表仍保持筛选、操作和数据列表，不增加大地图或统计横幅；
- 地图工作台使用独立 Dialog，不跳出路线审核上下文；
- 控件密度紧凑，操作按钮优先放在工具栏和路段行；
- 页面文案只描述业务状态，不显示 API 路径、Key、GeoJSON 或实现细节；
- 已上架路线沿用现有“内容不可编辑”，必须先下线再修改；
- 策展人修改并确认地图后仍需走现有提交审核流程。

建议新增 B 端文件：

```text
apps/web-admin/app/components/routes/RouteMapEditorDialog.vue
apps/web-admin/app/components/routes/RouteMapCanvas.vue
apps/web-admin/app/components/routes/RouteMapStationList.vue
apps/web-admin/app/components/routes/RouteMapSegmentList.vue
apps/web-admin/app/composables/useRouteMapEditor.ts
apps/web-admin/app/types/route-map.ts
apps/web-admin/server/api/route-map/get.get.ts
apps/web-admin/server/api/route-map/sync-stations.post.ts
apps/web-admin/server/api/route-map/generate.post.ts
apps/web-admin/server/api/route-map/save-segment.post.ts
apps/web-admin/server/api/route-map/validate.post.ts
apps/web-admin/server/api/route-map/confirm.post.ts
```

B 端地图 SDK 实例和覆盖物同样使用 `shallowRef` 或模块私有变量，不进入深层响应式状态。

### 11.4 自动生成与人工修正

古镇内部路线：

1. 优先根据相邻站点调用腾讯步行路线规划生成草稿；
2. 腾讯未收录或规划错误的小巷由 B 端人工绘制替换对应分段；
3. 可选导入现场 GPS 轨迹作为候选分段；
4. 运营人员预览、检查并确认后才进入审核和发布；
5. 只有站点顺序时采用 `station_only` 降级，不得标记为实际路线。

不推荐完全依赖腾讯公共路网自动生成古镇内部游线，因为公共路网可能不了解：

- 院落入口；
- 检票口；
- 私人区域；
- 单向游线；
- 临时封路；
- 夜间关闭；
- 主题路线的剧情顺序。

不得使用驾车 `waypoints` 代替古镇步行路线。驾车路线依据机动车路网，即使能够接收点集合，也不能代表游客可通行线路。

### 11.5 发布与版本规则

在现有 `PuzzleService`/`RouteAuthoringService` 发布校验中增加古镇地图校验，但不改变现有权限和审核状态机：

- 普通展馆路线不强制要求户外路线地图；
- `Museum.VenueType` 为古镇且路线启用地图展示时，必须存在 `route_map`；
- 所有必达物理站点必须有合法坐标；
- `geometry_status=ready` 时所有相邻站点必须存在有效分段；
- 几何必须为 GCJ-02 的 `LineString` 或 `MultiLineString`；
- 路线几何必须经过当前可编辑人确认；
- 修改站点顺序、站点坐标或路段后自动清除 `confirmed_at`；
- 策展人确认后提交审核，管理员审核通过后才能上架；
- 上架时递增 `geometry_version`，C 端按版本更新缓存；
- 下线后允许修改，再次上架重新校验并生成新版本。

不要求把腾讯原始响应永久保存；保留 `provider_request_id`、生成时间、来源、距离和必要的错误信息即可。避免将第三方冗余导航步骤耦合进业务表。

### 11.6 C 端绘制规则

- 同时只高亮一条主路线；
- 切换路线先清除旧折线和旧站点；
- 起点、终点和普通站点图标不同；
- 自动视野包含路线和必要边距；
- 选择路线后弱化无关资产；
- 清除路线后恢复自由浏览图层；
- `station_only` 使用明显虚线并显示“仅展示站点顺序”；
- `unavailable` 不绘制虚假线路，只展示路线摘要和站点列表。

## 12. H5 定位方案

### 12.1 定位策略

本期定位是可选增强能力：

    不授权定位     -> 仍可浏览地图、路线和资产
    授权成功       -> 显示当前位置和大致距离
    定位失败       -> 提供重试，不阻止其他功能
    精度不足       -> 提示当前位置可能存在偏差

不因定位失败隐藏服务端配置的文化资产和路线。

### 12.2 获取方式

第一优先使用浏览器标准 Geolocation：

```ts
navigator.geolocation.getCurrentPosition(success, fail, {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
})
```

要求：

- 正式环境必须 HTTPS；
- 只在用户点击“定位到我”后申请；
- 不在页面首次进入时自动弹权限；
- 读取并展示 `accuracy`；
- 转换为 GCJ-02 后再进入腾讯地图；
- 定位结果不写入 URL；
- 不默认长期持久化精确坐标；
- 如果需要上报后端，必须另行完成隐私和接口评审。

### 12.3 精度表达

建议：

| `accuracy` | UI 状态 |
|---:|---|
| `<= 30m` | 定位良好 |
| `30m - 80m` | 当前位置可能存在偏差 |
| `> 80m` | 定位不稳定，建议重新定位 |

这些阈值只用于 UI 提示，不用于本期任务判定。

### 12.4 不做自动到站

本期任务进入继续使用：

- 用户主动点击站点；
- 现场二维码；
- 路线章节流程；
- 服务端任务进度。

GPS 只辅助展示距离。不得因为距离计算小于某个值就直接完成章节或发放奖励。

## 13. 请求、缓存与性能

### 13.1 首屏请求

进入古镇地图：

    1. 加载地点详情（如未缓存）
    2. 加载 /Map/Scene
    3. 首屏渲染边界和重点资产
    4. 路线列表可空闲预取或在打开面板时加载
    5. 路线几何仅在选中路线时加载

### 13.2 请求缓存键

建议：

    scene:{museumId}:{assetType}:{siteAreaId}
    route-list:{museumId}:{filters}
    route-map:{routeId}

ID 必须保持原始字符串，不得数值化后作为缓存键。

### 13.3 并发与过期响应

- 地点切换时忽略旧地点响应；
- 快速切换路线时只接收最后一次路线详情；
- 使用请求版本号或 `AbortController`；
- SDK 未就绪前缓存业务绘制意图；
- 页面卸载后不再写 Store 的页面局部状态；
- 场景加载失败时地图仍显示明确错误面板。

### 13.4 Marker 与几何性能

- 首屏只显示重点资产；
- 服务设施通过图层开关控制；
- 选择路线后隐藏或弱化无关 Marker；
- Marker 使用稳定 `asset.id`；
- 路线坐标由后端做合理简化；
- 不在每次 Vue 更新时销毁并重建地图；
- 地图视野变化若需要请求，使用 `200-400ms` 防抖；
- 第一阶段不做大规模聚合前，需先以真实点位数量压测。

## 14. 路由与状态恢复

### 14.1 URL 是可分享的选择状态

地图选中路线后更新：

    ?routeId={routeId}

聚焦资产后更新：

    ?assetId={assetId}

URL 只保存业务 ID，不保存：

- 腾讯地图实例状态；
- 完整坐标数组；
- 用户精确位置；
- Token；
- WebService SK；
- 大型 GeoJSON。

### 14.2 返回恢复

从文化资产详情或任务页返回地图时：

- 根据 URL 恢复当前路线或资产；
- 路线几何从 Store 缓存恢复，缺失时重新请求；
- 地图中心和缩放可以保存在页面会话内；
- 不要求跨浏览器会话恢复精确视野；
- 任务进度重新读取服务端权威状态，不靠地图本地推断。

## 15. 具体文件改造清单

### 15.1 后端必改/新增

| 范围 | 改造内容 |
|---|---|
| `doc/66-route-map-ddl.sql` | 新增 `route_map`、`route_map_station`、`route_map_segment`、约束和索引 |
| `CulturalTourismSystem.Model` | 增加路线地图实体、请求、B/C 响应和枚举 |
| `CulturalTourismSystem.IRepository` / `Repository` | 增加路线地图三表仓储并注册 |
| `CulturalTourismSystem.IService` / `Service` | 增加路线地图服务、腾讯步行客户端、Polyline 解压和 GeoJSON 校验 |
| `CulturalTourismSystem.WebApi/Program.cs` | 注册 typed `HttpClient` 与路线地图服务 |
| `CulturalTourismSystem.WebApi/Controllers/RouteMapController.cs` | B 端同步、生成、保存、校验和确认接口 |
| `CulturalTourismSystem.WebApi/Controllers/MapController.cs` | 增加 C 端公开 `Route` 接口 |
| `PuzzleService` / `RouteAuthoringService` | 将古镇路线地图完整性纳入审核、发布和内容锁定 |
| `ErrorCodes.cs` | 增加站点缺坐标、腾讯算路失败、几何无效、路线未确认等错误码 |
| 后端配置 | 增加腾讯 WebService Key/SK、超时、重试、配额告警配置 |

后端实体继续使用 `long` 存储雪花 ID；所有 HTTP 请求与响应 DTO 使用 `string`，在服务边界通过现有 `ToLongIdRequired()` 等集中转换。

### 15.2 B 端必改/新增

| 文件 | 改造内容 |
|---|---|
| `apps/web-admin/app/components/routes/RouteDetailDialog.vue` | 增加“路线地图”入口及状态摘要 |
| `apps/web-admin/app/types/route.ts` | 路线详情增加地图状态摘要，所有 ID 保持字符串 |
| `apps/web-admin/app/components/routes/RouteMapEditorDialog.vue` | 新增固定高度路线地图工作台 |
| `apps/web-admin/app/components/routes/RouteMapCanvas.vue` | 腾讯地图、站点、分段、点选和绘制交互 |
| `apps/web-admin/app/components/routes/RouteMapStationList.vue` | 站点同步、缺失坐标和入口调整 |
| `apps/web-admin/app/components/routes/RouteMapSegmentList.vue` | 分段生成、失败重试、来源和人工替换 |
| `apps/web-admin/app/composables/useRouteMapEditor.ts` | 请求编排、脏状态、过期响应和保存流程 |
| `apps/web-admin/app/types/route-map.ts` | B 端路线地图契约 |
| `apps/web-admin/server/api/route-map/*` | 后端路线地图接口代理 |
| `apps/web-admin/nuxt.config.ts` / 环境配置 | 增加后台腾讯 JavaScript API Key |

### 15.3 C 端必改文件

| 文件 | 改造内容 |
|---|---|
| `apps/h5-client/src/pages/ShellHallPage.vue` | 从全局展厅路线大厅调整为地点上下文下的展馆路线区，或由新展馆详情页复用 |
| `apps/h5-client/src/pages/OutdoorMapPage.vue` | 重构为薄页面，移除 CSS 假地图，组合真实地图组件与路线控件 |
| `apps/h5-client/src/router/index.ts` | 新增地点列表/详情路由，保留地图深链，去除长期固定 `VITE_MUSEUM_ID` 依赖 |
| `apps/h5-client/src/stores/useMissionStore.ts` | 路线加载显式使用当前 `museumId`，缓存和筛选按地点隔离 |
| `apps/h5-client/src/stores/useOutdoorMapStore.ts` | 增加路线列表、路线详情、地图模式、独立错误和加载状态 |
| `apps/h5-client/src/services/outdoorMap.ts` | 统一场景、设施、路线地图详情请求，避免与 `gameplay.ts` 重复封装 |
| `apps/h5-client/src/components/shell/ShellTabBar.vue` | “展厅”调整为“探索” |
| `packages/ts-shared/src/outdoor-map.ts` | 补地点、设施、路线地图和站点类型 |
| `apps/h5-client/src/env.d.ts` | 增加 `VITE_TENCENT_MAP_KEY` |

### 15.4 C 端新增文件

按第 7 节目录创建，至少包括：

    apps/h5-client/src/pages/VenueExplorerPage.vue
    apps/h5-client/src/pages/VenueDetailPage.vue
    apps/h5-client/src/components/map/OutdoorMapCanvas.vue
    apps/h5-client/src/components/map/MapRouteControl.vue
    apps/h5-client/src/components/map/RouteSelectionPanel.vue
    apps/h5-client/src/components/map/CurrentRoutePreview.vue
    apps/h5-client/src/components/map/MapLocationControl.vue
    apps/h5-client/src/composables/useTencentMap.ts
    apps/h5-client/src/composables/useOutdoorRouteMap.ts
    apps/h5-client/src/composables/useBrowserLocation.ts
    apps/h5-client/src/map/types.ts
    apps/h5-client/src/map/createMapAdapter.ts
    apps/h5-client/src/map/adapters/tencent.ts
    apps/h5-client/src/services/venue.ts
    apps/h5-client/src/stores/useVenueStore.ts

### 15.5 必须保留的既有能力

以下能力不得因室外地图改造而移除：

- `apps/h5-client/src/utils/resolveExhibitLocationMap.ts`；
- `apps/h5-client/src/utils/exhibitLocationView.ts`；
- 展厅图片地图组件；
- `ChapterMapPage.vue` 当前任务流程；
- 现有文化资产详情路由；
- 问一问位置卡的室内分支；
- `apps/mp-shell` 的现有 WebView 壳。

## 16. 分阶段执行计划

### 阶段 A：契约与数据库

目标：先固定前后端共同依赖的数据结构，避免 B/C 端并行开发时反复改字段。

任务：

- 确定 `VenueType`、`CoordinateSystem`、地图状态和来源枚举；
- 编写 `66-route-map-ddl.sql`；
- 新增三张路线地图表、唯一约束、外键和索引；
- 增加后端实体与 B/C 响应 DTO；
- 增加 `packages/ts-shared/src/outdoor-map.ts` 的 C 端契约；
- 形成一份接口示例和错误码清单；
- 校验所有 HTTP 业务 ID 均为字符串。

完成标准：数据库可迁移、实体可编译、前后端类型评审通过。

### 阶段 B：后端路线地图主链路

目标：后端能够从现有路线节点生成、保存、校验和读取路线地图。

任务：

- 完成路线地图 Repository 和 Service；
- 实现从 `route_stage` 与资产主位置同步站点；
- 接入腾讯 walking Direction WebService；
- 实现 Polyline 解压、分段保存、拼接和距离汇总；
- 实现人工分段保存；
- 实现 `Validate`、`Confirm` 与错误码；
- 实现 B 端管理接口；
- 实现公开 `GET /Map/Route`；
- 将路线地图确认状态接入现有审核/发布校验；
- 增加调用超时、有限重试、日志脱敏、指标和配额告警。

完成标准：使用真实古镇路线可完成“同步站点—生成分段—确认—上架—公开读取”闭环。

### 阶段 C：B 端路线地图工作台

目标：运营人员能够生成、检查和修正自动路线。

任务：

- 在 `RouteDetailDialog` 增加地图状态和入口；
- 新增固定高度 `RouteMapEditorDialog`；
- 显示真实腾讯地图、站点和分段；
- 支持缺失路段批量生成和单段重试；
- 支持点选调整站点入口；
- 支持人工绘制替换错误分段；
- 显示分段来源、距离、状态和业务化错误提示；
- 实现脏状态、关闭确认和响应乱序保护；
- 接入“检查路线”和“确认路线”；
- 验证策展人、管理员、已审核和已上架的权限锁定。

完成标准：非技术运营人员可以独立完成一条古镇路线的地图发布准备，不需要手写坐标或 GeoJSON。

### 阶段 D：C 端地点上下文与展馆详情

目标：从固定单展馆改为运行时地点，并完成展馆“详情 + 路线瀑布流”。

任务：

- 新增地点列表/详情协议和 `useVenueStore`；
- 新增地点列表与详情分流；
- 将底部“展厅”改为“探索”；
- 路线查询显式使用当前 `museumId`；
- 保留 `VITE_MUSEUM_ID` 作为兼容默认值；
- 新增紧凑展馆 Hero、元信息和长介绍折叠；
- 复用现有 `MissionPreviewCard` 和筛选；
- 地点详情与路线列表独立加载和降级。

完成标准：两个地点的数据不会串线，展馆首屏可识别且轻微滚动即可看到路线。

### 阶段 E：C 端真实古镇场景地图

目标：用腾讯地图替换 CSS 假地图。

任务：

- 配置独立 H5 JavaScript API Key 和授权域名；
- 完成 SDK 加载器与 `MapAdapter`；
- 实现场景中心、古镇边界、区域和资产 Marker；
- 实现资产点击、聚焦和详情卡；
- 处理 SDK 失败、场景为空和无有效坐标；
- 完成 H5、微信 WebView、iOS、Android 真机验证。

完成标准：古镇边界和资产点位正确，页面卸载无残留实例，传统展馆和室内地图无回归。

### 阶段 F：C 端路线选择与渲染

目标：C 端只读取已发布路线几何并稳定渲染。

任务：

- 增加悬浮路线控件和路线选择面板；
- 按需调用 `GET /Map/Route`；
- 绘制实际线路、起终点和编号站点；
- 自动适配路线视野；
- 显示当前路线摘要、距离、时间和来源状态；
- 支持清除、切换和 `routeId` 深链恢复；
- 支持 `station_only` 和 `unavailable` 降级；
- 按 `routeId + geometryVersion` 缓存。

完成标准：快速切换无旧响应覆盖，同一时间只高亮一条路线，无几何时不伪装为真实路线。

### 阶段 G：辅助定位

目标：提供“定位到我”和大致距离，不承担任务判定。

任务：

- 用户点击后请求一次高精度定位；
- WGS84 集中转换为 GCJ-02；
- 显示位置与精度提示；
- 计算到选中资产或路线起点的大致距离；
- 覆盖拒绝、超时、系统关闭定位和重试；
- 确保定位结果不自动完成任务。

完成标准：拒绝或失败不影响地图与路线，不在首屏自动弹权限，不启动后台持续定位。

### 阶段 H：联调、现场复核与灰度

任务：

- 用真实古镇边界、资产、站点和路线完成全链路联调；
- 逐段现场复核路线，不只在办公室看地图；
- 验证腾讯未收录小巷的人工分段；
- 测试节点改序后确认状态自动失效；
- 测试审核、上架、下线、修改和重新发布；
- 测试 50、100、300 个 Marker 和长路线 GeoJSON；
- 测试腾讯超时、配额耗尽、弱网和重复请求；
- 测试微信 iOS、Android 和鸿蒙；
- 小范围灰度后再扩大入口。

## 17. 测试清单

### 17.1 后端与数据库

- 三张新表重复执行迁移不破坏既有数据；
- 路线、站点、分段的外键和软删除过滤正确；
- 同一路线只能有一个有效 `route_map`；
- 站点同步能够识别缺失资产位置和跨地点资产；
- 腾讯 Polyline 解压样例与官方坐标一致；
- 两段拼接时重复端点正确去除；
- 单段失败不会覆盖其他已确认人工分段；
- 超时、限流、无道路和无结果分别返回稳定错误码；
- 非路线所有人不能修改路线地图；
- 未发布路线不能通过公开 `GET /Map/Route` 读取；
- 节点改序或坐标变化后路线确认自动失效；
- 古镇路线地图未确认时不能上架；
- 下线修改后再次发布生成新的 `geometryVersion`。

### 17.2 B 端路线编辑

- 从节点同步站点顺序正确；
- 缺坐标站点有明确业务提示；
- 全部生成、单段重试和取消重复提交正确；
- 人工绘制只替换目标分段；
- 调整站点后相关分段标记待重新生成；
- 关闭存在未保存内容的 Dialog 会提示；
- 已审核、已上架和无编辑权限时完整只读；
- 策展人确认后仍需提交审核；
- 地图反复打开关闭不重复加载实例或泄漏监听；
- 页面不显示接口路径、Key、GeoJSON 等开发信息。

### 17.3 地点与路线

- 多地点列表正确；
- 展馆和古镇分流正确；
- 路线查询携带正确 `museumId`；
- 雪花 ID 没有精度丢失；
- 地点切换不串数据；
- 深链参数刷新后可恢复；
- 无效地点、路线和资产 ID 有明确错误。

### 17.4 C 端地图

- SDK 首次加载；
- SDK 并发加载；
- SDK 加载失败重试；
- 页面反复进入退出；
- 中心点和默认缩放；
- 古镇边界；
- 区域边界；
- Marker 点击；
- 聚焦资产；
- 图层切换；
- 路线切换；
- 路线视野适配；
- 无路线几何降级；
- 无有效坐标资产不导致地图崩溃。

### 17.5 定位

- 首次授权；
- 已授权；
- 拒绝授权；
- 系统关闭定位；
- 超时；
- 精度较差；
- WGS84 转 GCJ-02；
- 定位后回到路线全景；
- 页面退出后不继续无意义定位。

### 17.6 兼容与回归

- H5 普通浏览器；
- 微信 WebView；
- iOS 微信；
- Android 微信；
- 鸿蒙微信；
- 展馆路线瀑布流；
- 任务加入和恢复；
- 文化资产详情；
- 室内展厅地图；
- 问一问位置卡；
- 游玩中、归档和我的。

## 18. 验收标准

### 18.1 产品验收

- 一级入口能够清晰区分地点；
- 展馆详情上方信息足够但不压住路线；
- 古镇进入后地图成为首要内容；
- 路线控件易发现并包含文字；
- 选择路线后能立即看到实际线路；
- 路线面板关闭后仍保留当前路线摘要；
- 定位是增强能力，不是使用地图的门槛；
- 没有路线几何时不会误导用户。
- B 端能够从路线节点生成站点并审核实际路线；
- 腾讯自动规划错误的古镇小巷可以按分段人工修正；
- 未确认或审核未通过的路线地图不会出现在 C 端；
- 上架后 B 端与 C 端看到的路线版本一致。

### 18.2 技术验收

- 页面不直接依赖腾讯 SDK 私有对象；
- 地图实例不进入 Pinia 深度响应式状态；
- 所有业务 ID 按字符串透传；
- 坐标系显式且转换集中；
- 腾讯 WebService Key/SK 只存在后端，不进入 B/C 端包；
- 腾讯自动路线按相邻站点分段生成，不使用驾车途经点冒充步行路线；
- 路线确认状态与现有审核、上架和内容锁定一致；
- 地图场景、路线列表和路线几何按需加载；
- 快速切换地点和路线不存在响应乱序；
- 地图页面卸载后监听和覆盖物正确清理；
- 后端解决方案 `dotnet build` 通过；
- 路线地图 Service、Polyline 解压、GeoJSON 校验和发布规则测试通过；
- `pnpm --filter @path-seeker/web-admin type-check` 通过；
- `pnpm --filter @path-seeker/web-admin build` 通过；
- `pnpm --filter @path-seeker/h5-client type-check` 通过；
- `pnpm --filter @path-seeker/h5-client build` 通过；
- 关键真机测试通过。

## 19. 风险与应对

| 风险 | 影响 | 应对 |
|---|---|---|
| 腾讯步行规划不支持多途经点 | 无法一次生成整条古镇路线 | 后端按相邻站点分段调用，再拼接并保存 |
| 腾讯路网缺少古镇内部小巷 | 自动路线失败或绕行 | B 端按路段人工绘制或导入现场轨迹 |
| 自动路线未经运营确认 | 可能引导游客进入不可通行区域 | 生成结果只作为草稿，确认、审核后才能上架 |
| 节点顺序变化但几何未更新 | 业务路线与地图路线不一致 | 节点或站点变化自动清除确认状态并阻断发布 |
| 腾讯 WebService 超时或配额耗尽 | B 端无法自动生成新路段 | 有限重试、单段重试、人工绘制降级和配额告警 |
| 固定 `VITE_MUSEUM_ID` 未解除 | 多地点串数据 | C 端地点上下文阶段先完成，再开放多地点入口 |
| 腾讯 Key 域名未配置 | 正式环境地图失败 | 开发、测试、生产分 Key 并设置授权域名 |
| 坐标系混用 | 点位整体偏移 | 后端显式坐标系，adapter 集中转换，现场抽样验证 |
| Marker 过多 | 低端手机卡顿 | 重点资产优先、图层开关、视野加载、必要时聚合 |
| H5 定位不稳定 | 当前位置漂移 | 只做辅助定位，展示精度，不用于自动任务判定 |
| 路线面板遮挡地图 | 选择后看不到线路 | 选择后自动收起，保留底部摘要卡 |
| 页面返回丢失路线 | 体验割裂 | `routeId` 写入 URL，Store 缓存路线地图详情 |
| 地图 SDK 泄漏到业务层 | 将来难迁移 | 强制通过 `MapAdapter` 使用 |
| 新旧地图互相影响 | 室内地图回归 | 室内图片地图保持独立 renderer 和原协议 |

## 20. 重新评估原生小程序地图的触发条件

只有出现以下一项或多项明确需求，并经过 H5 真机验证后，才重新评估原生小程序地图：

- 需要长时间持续跟踪游客位置；
- 地图必须连续跟随游客移动；
- 必须自动或半自动判断到站；
- 从任务页返回地图必须无感恢复持续定位；
- 需要前后台或锁屏定位；
- 需要偏离路线提醒；
- GPS 变成任务完成或奖励发放的重要证据；
- 微信 WebView 在目标设备上持续定位明显不稳定；
- 需要只能由原生小程序地图提供的高级能力。

届时优先考虑“只迁移古镇地图页”，而不是整体重写 C 端。

## 21. 建议排期与依赖

以下为单名后端、单名 B/C 前端可部分并行的粗略估算，不包含腾讯商业授权审批和大规模现场采集：

| 阶段 | 主要角色 | 工作量 | 前置依赖 |
|---|---|---:|---|
| A 契约与数据库 | 后端 + 前端评审 | 2-4 个工作日 | 无 |
| B 后端路线地图主链路 | 后端 | 8-13 个工作日 | A |
| C B 端路线地图工作台 | B 端 | 8-13 个工作日 | A；可用 Mock 与 B 并行 |
| D C 端地点与展馆详情 | C 端 | 5-8 个工作日 | 地点接口确认 |
| E C 端真实古镇地图 | C 端 | 5-8 个工作日 | 地图 Key、`/Map/Scene` 数据 |
| F C 端路线选择与渲染 | C 端 | 4-7 个工作日 | B 的公开接口完成 |
| G 辅助定位 | C 端 | 2-4 个工作日 | E |
| H 联调、现场复核与灰度 | 全体 + 运营 | 5-10 个工作日 | B/C/E/F |

串行总量约 39-67 人日；合理并行后建议预留 5-8 周完成首个古镇生产闭环。

关键路径是：

    契约/DDL
      -> 后端分段生成与发布校验
      -> B 端运营确认一条真实路线
      -> C 端读取发布版本
      -> 现场逐段复核

不能等到 C 端完成后才准备真实坐标。首个试点古镇应在阶段 A 同时准备：地点中心与边界、至少 4 个站点入口坐标、1 条可人工核验的路线和腾讯控制台 Key。

## 22. 最终交付定义

本期完成后，B 端应达到：

    运营打开现有路线详情
      -> 进入“路线地图”工作台
      -> 从有序路线节点同步地图站点
      -> 自动生成相邻站点步行路段
      -> 人工修正腾讯未覆盖或不准确的路段
      -> 检查并确认路线
      -> 沿用现有审核和上架流程发布

后端应达到：

    保存站点、分段和完整几何
      -> 隔离腾讯 WebService 密钥
      -> 记录来源、距离、版本和确认状态
      -> 阻止未确认古镇路线发布
      -> 只向 C 端返回已发布路线版本

C 端应达到：

    用户进入“探索”
      -> 选择展馆或古镇

    进入展馆
      -> 查看展馆详情
      -> 浏览当前展馆路线瀑布流
      -> 进入现有任务链路

    进入古镇
      -> 查看真实地图和文化资产
      -> 点击悬浮路线控件
      -> 选择路线
      -> 地图绘制实际线路和站点
      -> 查看路线或文化资产详情
      -> 可选定位到当前用户
      -> 进入现有任务链路

技术上继续保持：

    apps/mp-shell
      -> web-view
      -> apps/h5-client

本期成功标准不是把地图做成导航 App，而是完成“多地点分层、展馆内容发现、古镇空间浏览和可信路线预览”，并为未来持续定位或原生地图迁移保留清晰边界。

最终业务闭环必须满足：同一条已发布古镇路线，在 B 端确认预览、后端公开响应和 C 端地图渲染中使用同一个 `geometryVersion`；任何节点、站点或分段修改都会使旧确认失效，避免内容路线和地图路线悄悄分叉。
