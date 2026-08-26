# 真实经纬度地图前端改造方案

> 适用仓库：web/path-seeker-ui
>
> 对应后端方案：CulturalTourism_System/doc/64-real-coordinate-map-execution-plan.md
>
> 目标：在保留现有展厅图片地图的基础上，为古镇、历史街区和遗址类场馆增加真实经纬度地图，并将建筑、店铺、古桥、古井等对象按文化资产级别展示。

## 1. 前端现状

本仓库是 TypeScript monorepo，主要涉及：

    apps/web-admin  Nuxt 4 + Vue 3，B 端内容和地图管理
    apps/h5-client  Vue 3 + Vite，C 端 H5 主链路
    apps/mp-wechat  uni-app，小程序端
    packages/*      跨端类型、运行时和 UI 能力

当前后台 apps/web-admin 已有两套地图相关实现：

- app/pages/console/maps.vue：楼层/展厅地图入口；
- app/components/map-management/*：楼层背景图和展厅图片坐标；
- app/components/gallery-map/*：展厅图片上的文物点位；
- app/utils/gallery-map-geometry.ts：图片点位几何处理；
- app/types/gallery-map.ts：xPercent/yPercent 协议类型。

当前 H5 位置能力主要面向展厅图片地图：

- src/utils/exhibitLocationView.ts：根据 maps[] 和百分比点位生成弹层；
- src/utils/resolveExhibitLocationMap.ts：按 galleryId 查询展厅地图；
- src/types/exhibitChat.ts：位置卡只包含 gallery 和 maps；
- src/components/shell/AskLocationCard.vue：问一问中的位置卡；
- src/pages/ChapterMapPage.vue：路线章节地图；
- src/services/gameplay.ts：路线、文物和展厅地图请求。

本次改造的关键不是把 xPercent/yPercent 改名，而是新增室外地图模型，与室内图片地图并存。

## 2. 前端改造原则

### 2.1 室内和室外地图并存

统一位置展示模型，但保留两类 renderer：

    IndoorPlanMapRenderer   展厅图片 + xPercent/yPercent
    OutdoorGeoMapRenderer   真实地图 + longitude/latitude/GeoJSON

现有展厅组件继续处理室内地图，不改造成经纬度组件。

### 2.2 文化资产而不是只有“展品”

前端类型逐步由 Exhibit 扩展为“文化资产视图”，但保留旧字段兼容：

    assetType = 1  实物文物
    assetType = 2  历史建筑
    assetType = 3  店铺/商号
    assetType = 4  景观遗产
    assetType = 5  古桥/牌坊/码头等
    assetType = 6  街巷空间
    assetType = 7  展览空间
    assetType = 8  服务设施

页面标题、图标、信息分组和位置文案根据 assetType 切换，详情页继续复用已有媒体、AI 档案、标签、路线和收藏能力。

### 2.3 坐标系显式化

前端不能默认所有经纬度都是同一坐标系。接口返回：

    type CoordinateSystem = 'WGS84' | 'GCJ02' | 'BD09'

第一期建议后端返回已经适配当前地图供应商的展示坐标，同时保留 coordinateSystem 字段。坐标转换集中在地图适配层，不散落在页面组件中。

### 2.4 地图 SDK 隔离

地图供应商只允许出现在 adapter 层：

    src/map/adapters/amap.ts
    src/map/adapters/tencent.ts
    src/map/adapters/baidu.ts
    src/map/createMapAdapter.ts

页面只依赖统一接口，避免把具体 SDK 的 Marker、Overlay 或实例对象泄漏到业务类型中。

## 3. 一期目标与非目标

### 3.1 一期目标

- 后台可维护场馆地图配置；
- 后台可维护景区区域树；
- 后台可创建和编辑建筑、店铺等文化资产；
- 后台可在真实地图上标注点、绘制建筑范围和设置入口；
- H5 可打开景区地图并查看资产；
- H5 可进入建筑/店铺的文化资产详情；
- H5 的问一问位置卡同时支持室内和室外位置；
- 路线地图可以显示室外文化资产目标；
- 小程序端至少能使用同一场景接口和统一位置类型。

### 3.2 一期非目标

- 不改造现有展厅图片点位协议；
- 不实现前端道路规划算法；
- 不在前端保存地图供应商密钥；
- 不实现离线地图瓦片；
- 不把所有页面一次性重命名为 HeritageAsset；
- 不用浏览器 GPS 位置替代后端资产位置事实。

## 4. 建议目录结构

建议增加以下共享结构。若 H5 和小程序需要分别适配 SDK，可将 adapter 实现放到各应用，协议和纯函数放到 packages/ts-shared。

    packages/ts-shared/src/
      geo.ts
      heritage-asset.ts
      outdoor-map.ts

    apps/web-admin/app/types/
      heritage-asset.ts
      outdoor-map.ts
      site-area.ts

    apps/web-admin/app/components/outdoor-map/
      OutdoorMapCanvas.vue
      OutdoorMapToolbar.vue
      OutdoorMapAssetMarker.vue
      OutdoorMapGeometryEditor.vue
      OutdoorMapLocationForm.vue
      OutdoorMapLayerPanel.vue

    apps/web-admin/app/components/site-area-management/
      SiteAreaTree.vue
      SiteAreaFormDialog.vue
      SiteAreaMapEditor.vue

    apps/h5-client/src/types/
      heritageAsset.ts
      outdoorMap.ts

    apps/h5-client/src/components/map/
      OutdoorMapView.vue
      OutdoorMapMarker.vue
      OutdoorMapPopup.vue
      MapLayerSwitcher.vue
      MapLocationPermissionPrompt.vue

    apps/h5-client/src/services/
      outdoorMap.ts
      heritageAsset.ts

    apps/h5-client/src/utils/
      exhibitLocationView.ts
      outdoorMapView.ts

## 5. 共享 TypeScript 协议

### 5.1 地理类型

建议在 packages/ts-shared 中定义纯数据类型：

    export type CoordinateSystem = 'WGS84' | 'GCJ02' | 'BD09'

    export interface GeoPoint {
      longitude: number
      latitude: number
    }

    export type GeoJsonGeometry =
      | { type: 'Point'; coordinates: [number, number] }
      | { type: 'LineString'; coordinates: [number, number][] }
      | { type: 'Polygon'; coordinates: [number, number][][] }
      | { type: 'MultiPoint'; coordinates: [number, number][] }
      | { type: 'MultiLineString'; coordinates: [number, number][][] }
      | { type: 'MultiPolygon'; coordinates: [number, number][][][] }

    export interface GeoLocation {
      id: string
      locationType: number
      coordinateSystem: CoordinateSystem
      point: GeoPoint | null
      geometry: GeoJsonGeometry | null
      locationName: string | null
      entranceName: string | null
      isPrimary: boolean
      accuracyMeters: number | null
      sourceType: number
    }

coordinates 统一使用 [longitude, latitude]，不要在前端内部使用 [latitude, longitude]。

### 5.2 文化资产类型

在现有 apps/web-admin/app/types/museum.ts 和 H5 对应类型中增加：

    export interface HeritageAssetSummary {
      id: string
      museumId: string
      assetType: number
      assetTypeName?: string | null
      name: string
      imageUrl: string | null
      siteAreaId: string | null
      locationStatus: string
      primaryLocation: GeoLocation | null
    }

现有 ExhibitResponse、ExhibitRecord、ExhibitDraft 增加：

    assetType: number
    siteAreaId: string | null
    parentExhibitId: string | null
    publicStatus: number
    constructionYearText: string | null
    currentFunction: string | null
    protectionLevel: string | null
    addressText: string | null
    locations: GeoLocation[]

galleryId 继续保留为 string | null。不能把建筑资产的区域 ID 错误放入 galleryId。

### 5.3 景区区域

    export interface SiteAreaResponse {
      id: string
      museumId: string
      parentAreaId: string | null
      areaCode: string
      name: string
      areaType: number
      description: string | null
      center: GeoPoint | null
      boundaryGeoJson: GeoJsonGeometry | null
      assetCount?: number
      sortOrder: number
    }

### 5.4 地图场景聚合

    export interface OutdoorMapSceneResponse {
      museum: {
        id: string
        name: string
        venueType: number
        center: GeoPoint | null
        boundary: GeoJsonGeometry | null
        coordinateSystem: CoordinateSystem
        mapProvider: number | null
      }
      areas: SiteAreaResponse[]
      assets: OutdoorMapAsset[]
      facilities: OutdoorMapFacility[]
      routes: OutdoorMapRouteOverlay[]
    }

    export interface OutdoorMapAsset {
      id: string
      assetType: number
      name: string
      shortDescription?: string | null
      point: GeoPoint | null
      geometry: GeoJsonGeometry | null
      entrance: GeoPoint | null
      iconKey: string
      visited?: boolean
      locked?: boolean
      distanceMeters?: number | null
    }

地图页面优先使用聚合接口，详情页再请求完整资产信息，避免地图首次加载携带所有媒体和 AI 档案。

## 6. 后台改造

### 6.1 场馆基础信息

涉及文件：

- apps/web-admin/app/types/museum.ts
- apps/web-admin/app/pages/console/museums.vue
- apps/web-admin/app/components/museum-management/MuseumManagementForm.vue
- apps/web-admin/app/components/museum-management/MuseumManagementDialog.vue
- apps/web-admin/app/components/museum-management/MuseumManagementDetailDialog.vue
- apps/web-admin/server/api/museum-management/query.post.ts
- apps/web-admin/server/api/museum-management/index.post.ts
- apps/web-admin/server/api/museum-management/[id].put.ts

新增表单：场馆类型、坐标系、地图供应商、地图中心点、默认缩放级别、景区整体边界。

地图选点应返回统一 GeoPoint，表单保存前不转换字段名。地图供应商转换应由 adapter 或后端完成。

### 6.2 景区区域管理

新增后台页面或工作区：

    apps/web-admin/app/pages/console/site-areas.vue
    apps/web-admin/app/components/site-area-management/SiteAreaTree.vue
    apps/web-admin/app/components/site-area-management/SiteAreaFormDialog.vue
    apps/web-admin/app/components/site-area-management/SiteAreaMapEditor.vue

交互：

1. 左侧显示区域树；
2. 右侧显示当前区域中心和边界；
3. 支持新增同级、子级区域；
4. 支持绘制、编辑和清除边界；
5. 显示区域内文化资产数量；
6. 删除区域前提示未迁移资产。

新增后台 proxy：

    apps/web-admin/server/api/site-area/query.post.ts
    apps/web-admin/server/api/site-area/index.post.ts
    apps/web-admin/server/api/site-area/[id].get.ts
    apps/web-admin/server/api/site-area/[id].put.ts
    apps/web-admin/server/api/site-area/[id].delete.ts

### 6.3 文化资产管理

现有入口：

- apps/web-admin/app/pages/console/collections.vue
- apps/web-admin/app/composables/useExhibitManagement.ts
- apps/web-admin/app/components/collections/CollectionExhibitDialog.vue
- apps/web-admin/app/components/collections/CollectionExhibitTable.vue
- apps/web-admin/app/components/collections/CollectionExhibitDetailDialog.vue

修改内容：

- 页面标题从“馆藏”扩展为“文物/文化资产”；
- 增加资产类型和景区区域筛选；
- 建筑和店铺不强制选择展厅；
- galleryId 为空时不显示“未分配展厅”错误提示；
- 建筑/店铺表单显示专属字段；
- 详情页增加位置状态和“在景区地图中查看”；
- 列表增加资产类型、所属区域和位置状态列。

建议使用配置驱动字段：

    const assetTypeFields: Record<number, FieldConfig[]> = {
      1: artifactFields,
      2: buildingFields,
      3: shopFields,
    }

不要在模板中复制三份完整表单。

### 6.4 室外地图管理入口

现有入口：

- apps/web-admin/app/pages/console/maps.vue
- apps/web-admin/app/components/map-management/MapManagementDialog.vue
- apps/web-admin/app/components/map-management/MapManagementWorkspace.vue
- apps/web-admin/app/components/map-management/MapVenueEditor.vue
- apps/web-admin/app/components/gallery-map/GalleryMapWorkspace.vue

建议将导航项从“展厅地图”调整为：

    地图管理
      ├── 景区地图
      ├── 楼层/展厅地图
      └── 展厅文物点位

现有 maps.vue 继续作为室内地图页面；新增：

    apps/web-admin/app/pages/console/outdoor-map.vue
    apps/web-admin/app/components/outdoor-map/OutdoorMapWorkspace.vue

室外编辑器支持：

    标注点：店铺、古井、入口、讲解点
    绘制线：街巷、河道、游览线
    绘制面：建筑、院落、区域

编辑资产位置时，右侧面板显示资产名称、位置类型、经度、纬度、坐标系、入口名称、是否主位置、采集精度和数据来源。

地图编辑过程中使用本地草稿，点击保存才调用接口；绘制过程中的 GeoJSON 不直接修改资产详情。

## 7. H5 用户端改造

### 7.1 新增场景地图页面

新增：

    apps/h5-client/src/pages/OutdoorMapPage.vue
    apps/h5-client/src/components/map/OutdoorMapView.vue
    apps/h5-client/src/components/map/OutdoorMapMarker.vue
    apps/h5-client/src/components/map/OutdoorMapPopup.vue

路由建议：

    /museums/:museumId/map
    /museums/:museumId/assets/:assetId

如果当前产品没有独立场馆路由，可以先使用 /map?museumId=... 和 /heritage-assets/:assetId。

地图页面状态：

    浏览：查看区域和文化资产
    筛选：按建筑/店铺/景观/设施筛选
    探索：显示已探索、未探索和可触发目标
    导览：显示目标、距离和路线入口

### 7.2 地图图层

建议图层顺序：

    底图
    景区边界
    区域边界
    建筑面
    街巷线
    文化资产点
    推荐路线
    用户位置
    当前任务目标

缩放策略：

- 小于阈值时显示区域和聚合数量；
- 中等缩放显示资产 Marker；
- 大缩放显示建筑面、入口和讲解点；
- 地图移动或缩放结束后按 bounds 防抖请求；
- 资产列表和地图视图使用同一份场景数据。

### 7.3 文化资产详情页

新增或改造：

    apps/h5-client/src/pages/HeritageAssetDetailPage.vue
    apps/h5-client/src/components/heritage/HeritageAssetHeader.vue
    apps/h5-client/src/components/heritage/HeritageAssetFacts.vue
    apps/h5-client/src/components/heritage/HeritageAssetLocation.vue

资产类型展示：

| 类型 | 主要信息 |
|---|---|
| 实物文物 | 年代、材质、展厅、展柜号、文物档案 |
| 历史建筑 | 建造年代、风格、原始功能、保护级别、建筑范围、入口 |
| 店铺/商号 | 创办年代、行业、传统技艺、营业状态、营业时间、消费提示 |
| 景观遗产 | 历史沿革、环境信息、位置和周边资产 |

所有类型统一支持主图和媒体、AI 讲解、标签、收藏、路线关联、打卡状态和地图定位。

### 7.4 现有问一问位置卡

需要扩展：

- apps/h5-client/src/types/exhibitChat.ts
- apps/h5-client/src/utils/exhibitLocationView.ts
- apps/h5-client/src/utils/resolveExhibitLocationMap.ts
- apps/h5-client/src/components/shell/AskLocationCard.vue

现有 ExhibitChatLocationItem 增加：

    assetType: number | null
    assetTypeName: string | null
    siteArea: ExhibitChatLocationArea | null
    outdoorLocations: ExhibitChatOutdoorLocation[]

位置卡根据数据选择打开方式：

    只有室内位置      打开现有图片地图弹层
    只有室外位置      打开室外地图并聚焦资产
    室内和室外都有    展示“室外位置 / 室内展厅”切换
    多个室外位置      默认聚焦主位置，同时列出其他入口
    没有位置          显示明确的未录入状态

现有 toExhibitMapOverlayModel 只处理图片底图，保持其职责不变，新增：

    toOutdoorMapFocusModel(item)
    resolveExhibitLocationView(item)

由统一 resolver 决定打开 IndoorPlanMap 还是 OutdoorGeoMap。

### 7.5 路线章节地图

现有：

- apps/h5-client/src/pages/ChapterMapPage.vue
- apps/h5-client/src/services/gameplay.ts
- apps/h5-client/src/types/mission.ts
- apps/h5-client/src/adapters/gameplayMissionAdapter.ts

RouteNodeResponse 和 StagePlayResponse 增加：

    assetType?: number
    locationStatus?: string | null
    primaryLocation?: GeoLocation | null

章节地图根据场馆类型选择：

    传统博物馆：保留抽象章节节点和展厅定位
    古镇景区：显示真实地图目标、区域和建筑点位
    混合场馆：默认真实地图，室内目标打开平面图详情

路线节点仍以 refExhibitId 作为资产关联，不在前端路线配置中重复写经纬度。

## 8. 小程序端同步

小程序端不能依赖 H5 的 DOM 地图库实现。建议先统一协议和交互状态，再决定地图 SDK：

- 复用 packages/ts-shared 的 GeoPoint、GeoLocation、OutdoorMapSceneResponse；
- 在 apps/mp-wechat 实现 map 组件适配；
- 使用与后端坐标系一致的地图供应商；
- 位置卡文案和资产详情字段与 H5 保持一致；
- 小程序无法使用某个 GeoJSON 能力时，降级为主点 + 入口点展示；
- 不影响现有展厅图片地图。

## 9. API 封装

### 9.1 H5

在 apps/h5-client/src/services/outdoorMap.ts 增加：

    fetchOutdoorMapScene(params)
    fetchSiteAreas(museumId)
    fetchHeritageAsset(assetId)
    fetchHeritageAssetLocations(assetId)

复用 apps/h5-client/src/services/http.ts 的 request，不在地图服务中重新实现请求、鉴权和错误处理。

### 9.2 后台 Nuxt server proxy

新增：

    apps/web-admin/server/api/outdoor-map/scene.get.ts
    apps/web-admin/server/api/outdoor-map/site-areas.get.ts
    apps/web-admin/server/api/outdoor-map/locations.post.ts
    apps/web-admin/server/api/outdoor-map/locations/[id].put.ts
    apps/web-admin/server/api/outdoor-map/locations/[id].delete.ts

后台 proxy 统一转发到后端真实接口，调用方式参考 apps/web-admin/server/utils/backend.ts、server/api/gallery-map/* 和 server/api/exhibit/*。

### 9.3 推荐接口响应原则

- 地图场景接口返回轻量摘要；
- 详情接口返回完整媒体和扩展属性；
- 经度、纬度不转成字符串，保持 number；
- ID 继续保持 string，兼容雪花 ID；
- 空列表统一返回 []；
- GeoJSON 无效时返回空 geometry，并提供可读错误信息；
- 不把地图 SDK 私有字段放入公开协议。

## 10. 状态管理与性能

### 10.1 地图状态

建议新增 useOutdoorMapStore，负责当前 museum、地图中心和缩放、bounds、区域筛选、资产类型筛选、场景数据缓存、当前聚焦资产、用户授权和当前位置状态。

组件只负责展示和事件，不直接维护跨页面的地图数据。

### 10.2 请求策略

- 地图 bounds 变化使用 200-400ms 防抖；
- 取消过期请求，避免拖动地图时响应乱序；
- 相同 museumId + bounds + filters 短时缓存；
- 首屏只加载轻量点位；
- includeGeometry=true 只在较大缩放级别请求；
- 详情页媒体按需加载；
- 地图 Marker 使用稳定 key=asset.id，避免拖动时全部重建。

### 10.3 定位权限

用户位置是可选能力：

    拒绝权限：仍可浏览景区地图
    允许权限：显示当前位置和距离
    定位失败：显示“无法获取当前位置”，不影响资产浏览

不能因为 GPS 不可用而隐藏服务端已配置的资产位置。

## 11. 兼容策略

### 11.1 旧展厅地图

以下文件和类型继续保留：

- apps/web-admin/app/types/gallery-map.ts；
- apps/web-admin/app/utils/gallery-map-geometry.ts；
- apps/web-admin/app/components/gallery-map/*；
- apps/h5-client/src/utils/resolveExhibitLocationMap.ts；
- apps/h5-client/src/utils/exhibitLocationView.ts。

仅增加室外分支，不修改 xPercent/yPercent 字段语义。

### 11.2 旧文物数据

后端默认返回 assetType=1 时，前端继续按现有文物显示。缺失新字段时使用兼容默认值：

    assetType ?? 1
    publicStatus ?? 1
    locations ?? []

### 11.3 旧位置快照

聊天历史中的旧 locations 可能只有 gallery/maps。前端判断：

    存在 outdoorLocations：使用新室外位置
    不存在 outdoorLocations 但存在 maps：使用旧室内地图
    两者都不存在：按旧状态提示

不能要求历史消息重新请求当前资产位置，否则会造成历史位置漂移。

## 12. 测试方案

### 12.1 类型和构建

    pnpm typecheck
    pnpm --filter @path-seeker/web-admin typecheck
    pnpm typecheck:h5-client
    pnpm build:web-admin
    pnpm build:h5-client

### 12.2 后台用例

- 传统博物馆仍能打开楼层地图；
- 景区场馆可保存地图中心；
- 区域树可新增、编辑、删除；
- 建筑可不选展厅；
- 店铺可选择所属区域；
- 点、线、面位置均可保存；
- 多入口资产只有一个主位置；
- 坐标系和来源可以回显；
- 旧展厅图片点位功能无回归。

### 12.3 H5 用例

- 景区地图首次加载成功；
- 按资产类型筛选；
- 点击建筑面进入详情；
- 点击店铺进入文化资产详情；
- 用户拒绝定位后仍可浏览；
- 地图缩放和拖动不会重复叠加 Marker；
- 问一问可打开室外位置；
- 室内和室外位置同时存在时可切换；
- 历史聊天旧位置卡仍可打开室内地图；
- 路线目标可以聚焦真实坐标。

### 12.4 坐标测试

- WGS84 坐标展示正常；
- GCJ-02 和 BD-09 字段不会被误当 WGS84；
- [longitude, latitude] 顺序正确；
- 无效坐标能被接口错误提示拦截；
- GeoJSON Polygon 闭合后能正确显示；
- 空 geometry 不导致地图组件崩溃。

## 13. 实施顺序

1. 在 packages/ts-shared 增加地理和文化资产协议。
2. 扩展后台 museum.ts、H5 exhibitChat.ts 和相关服务类型。
3. 增加后台场馆地图配置和区域管理。
4. 新增后台室外地图编辑器，不改现有室内地图组件。
5. 扩展后台文物管理为文物/文化资产管理。
6. 增加 H5 室外地图服务、Store 和页面。
7. 改造 H5 位置卡和资产详情页。
8. 改造章节地图的真实资产目标展示。
9. 同步小程序协议和基础地图展示。
10. 使用一个古镇样例完成全链路验收。

## 14. 完成定义

前端改造完成需要同时满足：

- 室内图片地图和室外真实地图可以并存；
- 建筑和店铺不再被强制当成展厅文物；
- 建筑和店铺可以进入与文物同等级别的详情、媒体、AI 和路线能力；
- 后台可以维护区域、点、线、面和入口；
- H5 可以按地图范围展示和筛选文化资产；
- 聊天位置卡兼容旧室内快照并支持新室外位置；
- 小程序共享同一套业务协议；
- 现有传统博物馆和展厅地图功能无回归。

