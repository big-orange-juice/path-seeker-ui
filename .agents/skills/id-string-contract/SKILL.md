---
name: id-string-contract
description: MUST be used when tasks touch backend or mini-program data contracts involving 主键、ID、int64、long、雪花 ID、路由参数、query/body id 透传、schema 类型映射。 Enforce string-based handling for large identifiers across B-end and C-end code.
---

# ID String Contract

这个 skill 适用于 `apps/web-admin`、`apps/mp-wechat`、共享类型、server api proxy，以及任何会读写后端主键的代码。

## 核心规则

- 后端返回的主键、外键、附件 ID、楼层 ID、主体 ID、场馆 ID、设施 ID，只要存在超过 JS 安全整数范围的风险，一律按 `string` 处理。
- 不要在前端、BFF、uni-app、小程序、Nuxt 页面、composable、store、组件中把这类 ID 转成 `number`。
- 不要对路由参数、query 参数、body 里的主键使用 `Number(...)`、`parseInt(...)` 之类的转换。
- 发送给后端时，主键相关字段继续使用 `string` 透传；即使 schema 标注为 `int64`，也优先保持字符串，避免 JS 精度截断。

## 适用范围

- URL path 中的 `id`
- query 中的 `museumId`、`floorId`、`galleryId`、`facilityId`
- request body 中的主键和外键
- 上传文件返回的附件 ID
- 列表项主键、详情主键、选中态主键、缓存 key 中引用的业务 ID

## 实施规则

- TypeScript 类型中，所有高风险 ID 字段优先定义为 `string` 或 `string | null`。
- 前端状态层和组件 props 中，主键统一保持 `string`。
- server proxy 读取 `getRouterParam`、`getQuery`、`readBody` 后，主键直接原样透传，不再转 number。
- 只有明确属于数值计算语义的字段，例如经纬度、面积、排序号、层级、数量，才继续使用 `number`。

## 自检清单

- 是否把 `int64` 主键写成了 `number`
- 是否出现 `Number(id)`、`parseInt(id)`、`Number(query.xxx)` 这类主键转换
- 是否把附件 ID、楼层 ID、主体 ID、场馆 ID、设施 ID 当成 number 发给后端
- B 端和 C 端是否使用了同一套 string ID 约定
