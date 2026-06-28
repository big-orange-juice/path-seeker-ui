---
name: frontend-commenting
description: MUST be used for any task that adds, rewrites, reviews, localizes, or standardizes code comments in this repository's `apps/web-admin`, `apps/mp-wechat`, `packages/ts-shared`, or `packages/game-renderer`. Use immediately when requests mention 注释、中文注释、后台注释、小程序注释、共享类型注释、TSDoc、JSDoc、补注释、重写注释、注释规范， and prioritize this skill before writing module headers, interface comments, payload comments, store comments, composable comments, or inline comments in Vue, Nuxt, uni-app, and TypeScript files. Produce Chinese comments, explain intent and boundaries, and avoid trivial narration.
---

# Frontend Commenting

按下面的规则统一处理这个仓库里的注释。这个 skill 适用于后台、小程序和共享包；只要任务和“写注释 / 改注释 / 补中文注释 / 统一注释风格”有关，就优先使用它，而不是依赖通用注释习惯。

## 核心目标

- 用中文写注释。
- 解释“为什么这样写”或“这一层负责什么”，不要只复述代码表面动作。
- 让 `apps/web-admin`、`apps/mp-wechat`、`packages/*` 的注释风格保持一致。
- 让共享类型、渲染器协议、store、composable 的边界一眼可读。

## 必须遵守的规则

- 只给非显而易见的代码加注释。不要写“给变量赋值”这一类废话。
- 优先解释意图、边界、约束、数据来源、兼容原因、前后端映射关系。
- 注释默认简短，但在共享契约、复杂状态机、协议映射、渲染器 payload 这些位置可以写详细一点。
- 注释语言统一用中文，类型名、接口名、字段名、枚举值保持英文。
- 不要把注释写成产品文档；注释只服务于读代码的人。
- 如果代码已经足够清楚，宁可不写，也不要硬塞说明。

## 不同位置的注释策略

### 模块头注释

在这些场景优先加模块头注释：

- `packages/ts-shared` 的共享类型文件
- `packages/game-renderer` 的渲染器契约文件
- 复杂 `store` 文件
- 复杂 `composable` 文件
- 承担流程编排职责的页面或容器组件

模块头注释要回答三个问题：

- 这个文件解决什么问题。
- 它和后端 DTO、页面组件、渲染器之间的边界是什么。
- 哪些东西故意不放在这里。

### 类型 / 接口注释

这些类型优先写详细一点：

- 共享领域模型
- 渲染器 payload
- 会话快照
- 提交答案结构
- 结果聚合结构

接口注释重点写：

- 这个结构被谁消费。
- 它是前端归一化模型，还是 transport 层原始结构。
- 某些字段为什么是可选、为什么是字符串、为什么做了归一化。

### 字段注释

只给这些字段写字段级注释：

- 字段名本身不够表达语义
- 字段单位容易误解，比如秒 / 毫秒
- 字段是前后端约定中的特殊值
- 字段和业务状态有关，比如“是否解锁”“是否允许组队”

### 行内注释

行内注释只用于：

- 复杂条件分支
- 状态恢复逻辑
- adapter 映射逻辑
- 临时兼容逻辑
- 特别容易误改的地方

行内注释应尽量放在代码块上方，不要在每一行后面碎片化解释。

## 后台、小程序、共享包的具体要求

### `apps/web-admin`

后台代码里的注释重点解释：

- 页面为什么这样拆分。
- 表单字段和共享类型 / 后端字段的对应关系。
- 为什么某些数据在 `composable` 里而不是页面里。
- 审核、发布、筛选、预览这些中后台特有流程的边界。

避免：

- 给普通 UI 结构写注释。
- 给明显的 `computed` / `ref` 命名再重复解释一遍。

### `apps/mp-wechat`

小程序代码里的注释重点解释：

- 页面在主流程中的位置。
- 为什么当前状态要落本地缓存。
- 弱网、恢复、提示层级、章节推进这类流程约束。
- 渲染器和页面外壳之间的数据交接方式。

避免：

- 把交互文案说明写进代码注释里。
- 对每个生命周期或事件处理函数都机械加注释。

### `packages/ts-shared`

共享类型里的注释要更详细，因为这里天然是跨端边界。

重点解释：

- 为什么没有直接照搬 swagger DTO。
- 为什么要做 id / 时间 /状态归一化。
- 哪些模型是给页面层用，哪些是给 adapter 层用。
- 哪些字段故意不进入共享层。

### `packages/game-renderer`

渲染器契约里的注释重点解释：

- 固定题型为什么这样收敛。
- 每个 `templateType` 对应什么 renderer。
- payload 为什么这样设计。
- 渲染器输出的答案草稿和最终 transport payload 的区别。

## 注释写法示例

### 好的模块头注释

```ts
/**
 * 这个文件定义小程序运行时真正会复用的会话模型。
 *
 * 它不直接复刻后端会话 DTO，而是围绕“恢复游玩、展示进度、驱动章节推进”
 * 这三个前端需求做收敛。
 */
```

### 好的字段注释

```ts
/**
 * 时长单位固定为秒，避免和页面内动画或计时器的毫秒值混用。
 */
durationSec?: number | null
```

### 好的行内注释

```ts
// 这里先保留上次未提交的答案草稿，避免用户切出小程序后当前题面状态丢失。
lastPuzzleState = snapshot.lastPuzzleState
```

### 不好的注释

```ts
// 定义一个标题
const title = ref('路线详情')
```

```ts
// 循环数组
items.map(...)
```

## 自检清单

完成注释前，逐项检查：

- 注释是不是中文。
- 注释有没有解释意图，而不是复述代码动作。
- 共享层注释有没有明确说明边界和归一化原因。
- 小程序流程代码注释有没有说明恢复、提示、推进逻辑。
- 后台配置代码注释有没有说明字段映射和职责划分。
- 有没有明显的废话注释，如果有就删掉。