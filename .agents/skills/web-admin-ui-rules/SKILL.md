---
name: web-admin-ui-rules
description: MUST be used for any `apps/web-admin` page or component task that adds or modifies backend management UI, including CRUD pages, filters, cards, lists, forms, dialogs, spacing, radius, copywriting, and interaction structure. Enforce tighter visual density than the current default, prefer create/edit flows in dialogs, and never surface user prompts, implementation notes, API paths, schema references, or agent instructions in page copy.
---

# Web Admin UI Rules

这个 skill 只用于 `apps/web-admin`。只要任务涉及后台页面、后台组件、CRUD 管理页、筛选区、表单区、列表区、弹窗、文案、圆角、间距，就先按这里的规则执行。

## 核心目标

- 后台界面要更克制、更紧凑，不走“大圆角 + 大留白”的展示型风格。
- 新增、编辑默认使用 dialog，不把大表单长期铺在页面主区域。
- 页面文案只服务后台使用者，不泄露提示词、实现说明、接口地址、schema 来源、代理链路、开发过程。
- 后台列表页默认只保留“查询条件 + action 组 + 数据列表”，不要额外堆大标题横幅、说明区、统计卡，除非用户明确要求。

## 视觉规则

### 圆角

- 后台默认圆角整体收一档。
- 大容器优先使用 `rounded-[1rem]` 或更小。
- 卡片、筛选区、列表项优先使用 `rounded-xl`、`rounded-lg`、`rounded-md`。
- 避免在后台继续新增 `rounded-[1.4rem]`、`rounded-[1.6rem]` 这一类偏展示化圆角，除非页面已有强约束必须保持。

### 间距

- 页面主容器、区块之间的 `gap` 优先使用 `gap-4`，复杂页面也尽量不要超过 `gap-5`。
- 面板内边距优先使用 `px-4 py-4`、`px-5 py-4`、`px-5 py-5`。
- 表单分组优先紧凑排布，能双列就双列，避免为了“呼吸感”无意义放大留白。
- 筛选区、统计卡、表格头、弹窗头的高度要压紧，不要做成营销页节奏。
- 列表卡片内部信息块之间的间距优先继续压紧，避免“字段不多但卡片很散”。

## 交互规则

### 查询条件

- Filter 区默认横向排列，桌面端不要做成“一个条件一整行”。
- 常见模式优先是：`关键词 + 状态 + action组` 同行或同一网格行解决。
- 只有字段很多、确实放不下时，才允许自动换行；但也要优先做紧凑布局。

### 新增 / 编辑

- 后台 CRUD 页默认使用 dialog 处理新增和编辑。
- 页面主区域优先展示：筛选、统计、列表、概览。
- 只有在任务明确要求“常驻侧栏编辑”或“分步工作台”时，才允许把表单常驻页面。
- Dialog 内表单也要保持紧凑，避免过高、过宽、过大圆角。
- 承载 Tab、工作台、分步编辑的 dialog 需要优先使用稳定高度，例如 `h-[90vh]`、`h-[92vh]`，不要只给 `max-h` 导致切换 Tab 时弹窗高度忽大忽小。

### 删除

- 删除动作允许继续使用轻量确认，例如 `window.confirm`，除非当前模块已有统一确认弹窗。
- 删除按钮视觉层级低于“新增 / 保存”。

### 详情

- 列表卡片优先展示摘要字段，不要把长简介、长说明直接铺在列表里。
- 长文本、完整资料、扩展字段优先放到“详情 dialog”中查看。

## 文案规则

- 不要把用户提示词写进页面。
- 不要把“根据 `/api/xxx`”“字段来自 schema”“通过 Nuxt server 代理”“当前接入了分页查询、创建、更新、删除”等实现说明写进页面。
- 不要把 agent、prompt、接口契约、开发备注当作 UI 文案输出。
- 页面描述只写后台用户真正关心的业务信息，例如“维护主体基础资料”“支持按状态筛选”“统一管理馆内楼层信息”。

## Nuxt 组件规则

- 在 `apps/web-admin` 中，如果依赖 Nuxt 自动注册组件，模板里必须使用 Nuxt 实际注册出的完整组件名，包含目录前缀。
- 例如 `components/museum-management/MuseumWorkbenchPanels.vue`，自动注册名应视为 `MuseumManagementMuseumWorkbenchPanels`，不能想当然简写成 `MuseumWorkbenchPanels`。
- 如果业务上更希望使用短组件名，就必须在 `<script setup>` 中显式 `import`，不要同时依赖“自动注册 + 自定义短名”。
- 新增组件后，尤其是放在多级目录下的组件，修改模板时先确认 `.nuxt/components.d.ts` 中的注册名，再决定是使用完整自动注册名，还是改成显式导入。

## 页面结构建议

后台 CRUD 页优先按这个顺序组织：

1. 查询条件：关键词、状态、业务筛选
2. Action 组：新增、批量操作、刷新、导出等
3. 数据列表：表格或卡片列表
4. Dialog：承载新增 / 编辑表单

只有在用户明确要求时，才增加：

- 页头大标题 / 说明横幅
- 统计卡
- 装饰性概览区

## 自检清单

- 圆角是否比当前默认更紧一些。
- 间距是否明显收敛，没有展示页式大留白。
- 新增 / 编辑是否进入 dialog，而不是常驻页面。
- 页面上是否出现提示词、接口路径、schema、代理实现、开发备注；如果有，删掉。
- 文案是否站在后台使用者视角，而不是开发者视角。
- 是否真的只保留了“查询条件 + action 组 + 数据列表”；如果出现 hero、stats、说明大卡，先判断是否属于冗余。
- 使用 Nuxt 自动引入组件时，组件名是否和 `.nuxt/components.d.ts` 中的注册名一致；如果不是，改成完整名或显式 import。
- 承载多 Tab 的 dialog 是否使用稳定高度；如果切换内容后弹窗会收缩，优先改成固定高度容器。
