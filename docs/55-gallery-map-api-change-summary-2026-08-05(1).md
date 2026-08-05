# 展厅地图接口变更统计

## 1. 文档信息

| 项目 | 内容 |
|---|---|
| 统计日期 | 2026-08-05 |
| 所属模块 | 展厅地图、地图点位、点位文物关系 |
| API 控制器 | `GalleryMapController` |
| API 路由前缀 | `/api/GalleryMap` |
| 当前接口总数 | 15 |
| 今日新增接口 | 2 |
| 今日 Git 提交 | 无，当前修改尚未提交 |
| 最近地图功能提交 | `34ff616`，2026-08-04 15:24:40，关于地图部分的修改 |

## 2. 今日改动概览

2026-08-05 主要增加了点位和文物关系的事务型聚合创建、更新能力。

今日新增以下两个接口：

```http
POST /api/GalleryMap/CreateAnnotation
POST /api/GalleryMap/UpdateAnnotation
```

事务标注接口中的“文物”是指点位与已有 `museum_exhibit` 文物之间的关系记录，不会创建新的 `museum_exhibit` 主数据。

## 3. 今日代码变更

### 3.1 业务文件

| 文件 | 修改内容 |
|---|---|
| `CulturalTourismSystem.WebApi/Controllers/GalleryMapController.cs` | 新增事务创建标注和事务更新标注接口 |
| `CulturalTourismSystem.IService/IGalleryMapService.cs` | 新增 `CreateAnnotationAsync`、`UpdateAnnotationAsync` 服务定义 |
| `CulturalTourismSystem.Service/GalleryMapService.cs` | 新增事务、文物关系全量同步、校验和回滚逻辑 |
| `CulturalTourismSystem.Model/Request/GalleryMapRequests.cs` | 新增聚合标注请求，抽取可复用的文物关系请求项 |

### 3.2 代码量

按当前 Git 工作区业务文件差异统计：

| 指标 | 数量 |
|---|---:|
| 新增行 | 187 |
| 删除行 | 6 |
| 净增加 | 181 |

工作区中两个 `FolderProfile.pubxml.user` 文件也存在改动，但不属于本次地图业务修改，未计入上述业务统计。

## 4. 今日新增接口

### 4.1 事务创建标注

```http
POST /api/GalleryMap/CreateAnnotation
```

业务流程：

```text
开启事务
  -> 校验地图、点位和坐标
  -> 创建地图点位
  -> 校验所有系统文物
  -> 创建全部点位文物关系
  -> 全部成功后提交事务
```

任意一步失败，已创建的点位和文物关系全部回滚。

请求示例：

```json
{
  "galleryMapId": "地图ID",
  "sourcePointCode": "MANUAL-POINT-001",
  "markerType": 1,
  "xPercent": 23.370787,
  "yPercent": 15.513627,
  "title": "镶嵌十字纹方钺",
  "description": null,
  "sourcePayload": "{\"iconClass\":\"iconfont icon-big-dot\"}",
  "sortOrder": 1,
  "exhibits": [
    {
      "exhibitId": "系统文物ID",
      "sourceExhibitCode": "CI00000694",
      "sourceExhibitName": "镶嵌十字纹方钺",
      "sourceDetailUrl": "https://www.shanghaimuseum.net/mu/frontend/pg/article/id/CI00000694",
      "sourceImageUrl": "https://www.shanghaimuseum.net/mu/upload/example.jpg",
      "matchStatus": 1,
      "matchMethod": "manual",
      "sortOrder": 1
    }
  ]
}
```

成功后返回新建的点位 ID。

### 4.2 事务更新标注

```http
POST /api/GalleryMap/UpdateAnnotation
```

业务流程：

```text
开启事务
  -> 校验并更新地图点位
  -> 按 sourceExhibitCode 匹配已有文物关系
  -> 更新已有关系
  -> 创建新增关系
  -> 逻辑删除请求中未提交的旧关系
  -> 全部成功后提交事务
```

请求中的 `exhibits` 是更新后的完整文物集合，不是增量列表：

| 数据状态 | 处理方式 |
|---|---|
| 数据库已有，请求中存在 | 更新关系 |
| 数据库没有，请求中存在 | 新增关系 |
| 数据库已有，请求中不存在 | 逻辑删除关系 |

任意校验或数据库操作失败，点位修改和全部文物关系变更一起回滚。

请求示例：

```json
{
  "id": "点位ID",
  "galleryMapId": "地图ID",
  "sourcePointCode": "MANUAL-POINT-001",
  "markerType": 1,
  "xPercent": 25.5,
  "yPercent": 18.75,
  "title": "镶嵌十字纹方钺",
  "description": null,
  "sourcePayload": "{\"iconClass\":\"iconfont icon-big-dot\"}",
  "sortOrder": 1,
  "exhibits": [
    {
      "exhibitId": "系统文物ID",
      "sourceExhibitCode": "CI00000694",
      "sourceExhibitName": "镶嵌十字纹方钺",
      "sourceDetailUrl": "https://www.shanghaimuseum.net/mu/frontend/pg/article/id/CI00000694",
      "sourceImageUrl": "https://www.shanghaimuseum.net/mu/upload/example.jpg",
      "matchStatus": 1,
      "matchMethod": "manual",
      "sortOrder": 1
    }
  ]
}
```

## 5. 事务标注校验

两个事务标注接口执行以下校验：

- 地图必须存在且未被逻辑删除；
- 点位类型 `markerType` 必须为 `1`；
- `xPercent`、`yPercent` 必须在 `0` 到 `100` 之间；
- 同一地图内 `sourcePointCode` 不能重复；
- `exhibits` 至少包含一件文物；
- 来源文物编码不能为空；
- 来源文物名称不能为空；
- 同一请求内 `sourceExhibitCode` 不能重复；
- `exhibitId` 非空时，对应系统文物必须存在；
- `sourcePayload` 非空时必须是合法 JSON；
- `matchStatus` 必须在 `0` 到 `5` 之间。

## 6. 当前全部接口

### 6.1 地图接口

| 序号 | 方法 | 地址 | 权限 | 说明 |
|---:|---|---|---|---|
| 1 | `POST` | `/api/GalleryMap/PageList` | 公开 | 分页查询地图 |
| 2 | `GET` | `/api/GalleryMap/Get?id={地图ID}` | 公开 | 查询地图、点位和文物关系完整详情 |
| 3 | `POST` | `/api/GalleryMap/Create` | 需权限 | 创建地图 |
| 4 | `POST` | `/api/GalleryMap/Update` | 需权限 | 更新地图 |
| 5 | `POST` | `/api/GalleryMap/Delete` | 需权限 | 逻辑删除地图及其子数据 |

### 6.2 地图点位接口

| 序号 | 方法 | 地址 | 权限 | 说明 |
|---:|---|---|---|---|
| 6 | `GET` | `/api/GalleryMap/GetPoint?id={点位ID}` | 公开 | 查询点位及文物关系 |
| 7 | `POST` | `/api/GalleryMap/CreatePoint` | 需权限 | 创建点位 |
| 8 | `POST` | `/api/GalleryMap/UpdatePoint` | 需权限 | 更新点位 |
| 9 | `POST` | `/api/GalleryMap/DeletePoint` | 需权限 | 逻辑删除点位及其文物关系 |

### 6.3 事务标注接口

| 序号 | 方法 | 地址 | 权限 | 说明 |
|---:|---|---|---|---|
| 10 | `POST` | `/api/GalleryMap/CreateAnnotation` | 需权限 | 在一个事务中创建点位和文物关系 |
| 11 | `POST` | `/api/GalleryMap/UpdateAnnotation` | 需权限 | 在一个事务中更新点位并同步完整文物集合 |

### 6.4 点位文物关系接口

| 序号 | 方法 | 地址 | 权限 | 说明 |
|---:|---|---|---|---|
| 12 | `GET` | `/api/GalleryMap/GetPointExhibit?id={关系ID}` | 公开 | 查询点位文物关系 |
| 13 | `POST` | `/api/GalleryMap/CreatePointExhibit` | 需权限 | 创建点位文物关系 |
| 14 | `POST` | `/api/GalleryMap/UpdatePointExhibit` | 需权限 | 更新点位文物关系 |
| 15 | `POST` | `/api/GalleryMap/DeletePointExhibit` | 需权限 | 逻辑删除点位文物关系 |

## 7. 接口数量统计

| 分类 | 数量 |
|---|---:|
| 地图接口 | 5 |
| 地图点位接口 | 4 |
| 事务标注接口 | 2 |
| 点位文物关系接口 | 4 |
| **合计** | **15** |

权限统计：

| 权限类型 | 数量 |
|---|---:|
| 公开查询接口 | 4 |
| 需要登录并通过权限过滤器的写接口 | 11 |
| **合计** | **15** |

## 8. 前端期望

### 8.1 展厅地图数据大页面

前端增加一个独立的“展厅地图数据”大页面，整体展示和交互方式参考上海博物馆官网展厅地图：

```text
https://www.shanghaimuseum.net/mu/frontend/pg/article/id/RI00004029
```

该页面不是普通表格管理页，应以展厅底图和地图点位为主要内容。建议页面结构如下：

```text
展厅选择/展厅标题
  -> 地图底图展示区域
  -> 地图上的文物点位和展览说明点位
  -> 点击点位后显示点位详情
  -> 管理状态下支持新增点位
```

页面应包含以下主要能力：

- 根据展厅选择或路由参数加载对应地图；
- 使用地图的 `imageUrl` 展示 OSS 底图；
- 按 `xPercent`、`yPercent` 在底图上定位点位；
- 地图缩放或容器尺寸变化时，点位位置保持正确；
- 区分文物点位和展览说明点位；
- 点击文物点位后展示点位标题和关联文物列表；
- 点击展览说明点位后展示说明标题和正文；
- 支持地图加载中、地图不存在、地图加载失败和空点位状态；
- 管理状态下显示新增点位入口；
- 普通浏览状态不显示编辑和删除操作。

页面初始化建议调用：

```http
POST /api/GalleryMap/PageList
GET  /api/GalleryMap/Get?id={地图ID}
```

`PageList` 用于根据展厅查询地图，`Get` 用于一次取得地图底图、全部点位和点位文物关系。

### 8.2 点位展示

地图点位使用绝对定位覆盖在底图之上，但业务数据保存百分比坐标，不保存当前浏览器中的像素坐标。

前端显示位置计算：

```text
left = xPercent / 100 * 当前地图渲染宽度
top  = yPercent / 100 * 当前地图渲染高度
```

点位类型：

| `markerType` | 类型 | 建议展示 |
|---:|---|---|
| 1 | 文物点位 | 圆点标记，点击后显示文物信息 |
| 2 | 展览说明点位 | 星形或说明标记，点击后显示标题和正文 |
| 99 | 未知点位 | 通用标记，供管理人员后续修正 |

点位应具有稳定的点击区域，地图缩放时不能改变底图布局，也不能因为标题长度导致点位偏移。

### 8.3 新增点位标注功能

前端增加“新增点位”功能。新增点位即在当前展厅地图中创建一个新的文物点位，并同时绑定一件或多件系统文物。

建议交互流程：

```text
进入展厅地图管理页面
  -> 点击“新增点位”
  -> 光标进入地图选点状态
  -> 用户点击底图目标位置
  -> 前端计算百分比坐标
  -> 打开点位编辑面板
  -> 填写点位标题并选择文物
  -> 提交事务标注接口
  -> 保存成功后刷新或局部追加点位
```

点击位置转换为百分比坐标：

```text
xPercent = (点击位置X - 地图左边界) / 地图渲染宽度 * 100
yPercent = (点击位置Y - 地图上边界) / 地图渲染高度 * 100
```

坐标计算必须以实际底图内容区域为基准。如果地图使用 `object-fit: contain`，需要扣除图片在容器中的上下或左右留白，不能直接使用外层容器宽高。

新增点位表单至少包含：

| 字段 | 必填 | 说明 |
|---|---|---|
| 地图 ID | 是 | 当前正在编辑的地图 |
| 点位编码 | 是 | 人工点位可生成 `MANUAL-{时间或序号}` |
| 点位类型 | 是 | 文物标注固定为 `1` |
| X 百分比 | 是 | 用户点击位置换算结果 |
| Y 百分比 | 是 | 用户点击位置换算结果 |
| 点位标题 | 是 | 默认可使用首件文物名称 |
| 系统文物 | 是 | 支持搜索并选择，至少一件 |
| 排序号 | 否 | 默认放在当前点位列表末尾 |

新增点位应优先调用事务接口：

```http
POST /api/GalleryMap/CreateAnnotation
```

不建议前端先调用 `CreatePoint`，再逐条调用 `CreatePointExhibit`。分步调用可能出现点位创建成功、文物关系创建失败的半完成状态；`CreateAnnotation` 能保证点位和全部文物关系同时成功或同时回滚。

新增成功后，接口返回点位 ID。前端可以使用以下任一种方式更新页面：

- 使用返回的点位 ID 调用 `GetPoint`，将新点位局部追加到地图；
- 重新调用 `Get`，刷新整张地图及全部点位。

### 8.4 点位编辑预留

虽然本轮前端核心需求是新增点位，但页面结构应为后续编辑能力预留入口，包括：

- 拖拽点位调整坐标；
- 修改点位标题；
- 增加或移除关联文物；
- 修改文物排序；
- 删除点位。

完整编辑应调用：

```http
POST /api/GalleryMap/UpdateAnnotation
```

`UpdateAnnotation` 的 `exhibits` 是保存后的完整文物列表。前端提交时必须包含所有需要保留的文物；未提交的旧关系会被逻辑删除。

### 8.5 前端验收标准

- 能选择展厅并显示对应 OSS 地图底图；
- 能正确显示文物点位和展览说明点位；
- 桌面端和移动端缩放后点位仍位于正确位置；
- 点击文物点位能看到关联文物；
- 点击展览说明点位能看到完整标题和正文；
- 管理人员能进入新增点位模式；
- 点击底图后能得到正确的百分比坐标；
- 能搜索并绑定至少一件系统文物；
- 新增成功后无需刷新整个浏览器即可看到新点位；
- 新增失败时地图上不保留虚假的临时点位；
- 重复提交时应禁用保存按钮，避免产生重复请求；
- 普通用户不能看到管理操作入口；
- 后端事务失败时，前端应展示错误信息并保留当前表单内容。

当前已完成地图展示和标注所需的后端接口。本章节描述的是前端后续实现和验收范围，当前仓库本次修改未包含前端页面代码。

### 8.6 文物展厅归属一致性

点位文物关系接口会根据 `mapPointId -> galleryMapId -> galleryId` 解析目标展厅，并在同一事务中校验和同步 `museum_exhibit.gallery_id`：

- 文物的 `gallery_id` 为 `0` 时，创建或更新关系会自动写入目标展厅 ID；
- 文物已经属于目标展厅时允许保存；
- 文物属于其他展厅时拒绝保存，并回滚本次关系变更；
- 更新关系切换文物后，旧文物没有其他有效点位关系时，将旧文物的 `gallery_id` 置为 `0`；
- 逻辑删除关系后，文物仍有其他有效点位关系时保留 `gallery_id`；删除最后一条有效关系时将其置为 `0`，不使用 `NULL`；
- `CreateAnnotation`、`UpdateAnnotation` 复用相同规则，任一文物校验失败时整个标注事务回滚；
- 删除点位或地图导致关系级联逻辑删除时，也会按相同规则清理已无有效关系的文物归属。

涉及接口：

```http
POST /api/GalleryMap/CreatePointExhibit
POST /api/GalleryMap/UpdatePointExhibit
POST /api/GalleryMap/DeletePointExhibit
POST /api/GalleryMap/CreateAnnotation
POST /api/GalleryMap/UpdateAnnotation
```

## 9. 验证结果

已执行 WebApi 构建：

```powershell
dotnet build CulturalTourismSystem.WebApi\CulturalTourismSystem.WebApi.csproj --no-restore
```

验证结果：

- 构建错误：0；
- `git diff --check`：通过；
- 未连接实际数据库执行 HTTP 集成测试；
- 未对生产数据库产生读写；
- 现有依赖安全告警及项目原有可空性告警仍然存在，本次修改未新增编译告警。

## 10. 相关文件

- `CulturalTourismSystem.WebApi/Controllers/GalleryMapController.cs`
- `CulturalTourismSystem.IService/IGalleryMapService.cs`
- `CulturalTourismSystem.Service/GalleryMapService.cs`
- `CulturalTourismSystem.Model/Request/GalleryMapRequests.cs`
- `CulturalTourismSystem.Model/Response/GalleryMapResponses.cs`
- `CulturalTourismSystem.Model/DataBase/MuseumGalleryMap.cs`
- `doc/52-shanghai-museum-gallery-map-ddl.sql`
