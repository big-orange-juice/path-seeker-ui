# 前端相关 Skills / MCP 参考清�?

## 1. 当前结论

| 项目 | 结论 |
| --- | --- |
| Nuxt 路由结构 | `apps/web-admin` 已切�?Nuxt 4 推荐�?`app/` 目录结构，和当前项目�?`nuxt` skill 对齐 |
| 动画方案 | 统一采用 `GSAP` |
| Skill 安装策略 | 你已明确由你自己手动安装，因此这里只记录“当前状态”和“还缺什么�?|
| MCP 策略 | 仅保留参考，不在本仓库内强行固化安装流程 |

## 2. 当前项目�?Skill 状�?

| 类别 | Skill | 当前状�?| 说明 |
| --- | --- | --- | --- |
| Nuxt | `nuxt` | 已具�?| 可指�?Nuxt 4、`app/` 目录、路由、数据获取与工程组织 |
| Vue | `vue-best-practices` | 已具�?| 适用�?`.vue` 文件、Composition API、组件拆分与状态组�?|
| GSAP | `gsap-core` | 已具�?| GSAP 基础动画能力 |
| GSAP | `gsap-frameworks` | 已具�?| 适用�?Vue / Nuxt 生命周期接入 |
| GSAP | `gsap-performance` | 已具�?| 用于性能优化与动画平滑度控制 |
| GSAP | `gsap-plugins` | 已具�?| 用于插件注册与能力扩�?|
| GSAP | `gsap-scrolltrigger` | 已具�?| 适用于滚动驱动与分段推进场景 |
| GSAP | `gsap-timeline` | 已具�?| 适用于串联剧情、线索解锁、结算动�?|
| GSAP | `gsap-utils` | 已具�?| 提供常用动画辅助工具 |

## 3. 当前还缺什�?

| 类别 | 状�?| 影响 |
| --- | --- | --- |
| Tailwind 专项 Skill | 缺少 | 写原子类和设�?token 时缺少专门的模式参考，但不影响开�?|
| shadcn-vue 专项 Skill | 缺少 | 后台组件装配、变体扩展、表单组合时少一层生态指�?|
| Nuxt 专属 MCP | 未在项目内固�?| 不影响代码编写，但少了一个面向官方文�?/ 最佳实践的实时辅助入口 |

## 4. 与当前项目的匹配判断

| 技术栈 | 当前匹配�?| 判断 |
| --- | --- | --- |
| `Nuxt 4 + app/` | �?| 已有 `nuxt` skill，且目录结构已对�?|
| `Vue 3 + Composition API` | �?| 已有 `vue-best-practices`，适配当前工程方向 |
| `GSAP` | �?| 已有完整 `gsap-*` skill 组，足够覆盖大多数动效开�?|
| `Tailwind` | �?| 代码可直接写，但缺少专项 skill 支持 |
| `shadcn-vue` | �?| 可以接入组件库，但缺少项目级专项 skill 指南 |

## 5. MCP 参�?

| 方向 | 价�?| 备注 |
| --- | --- | --- |
| Nuxt 官方 MCP | �?| 更适合查官方最新能力与 Nuxt 4 约定 |
| Browser / In-app Browser | �?| 适合联调后台页面、验证布局与交�?|
| 脚本执行类工�?| �?| 适合处理临时数据转换、协议校验、样例生�?|

## 6. 最终判�?

| 结论�?| 结果 |
| --- | --- |
| 当前 skill 目录是否基本符合项目 | 是，已经覆盖 `Nuxt + Vue + GSAP` 主干开�?|
| 是否还存在缺�?| 有，主要�?`Tailwind` �?`shadcn-vue` 两类专项 skill |
| 是否影响现在继续做项�?| 不影响，可以先继续初始化和开�?|
| 后续最值得补的方向 | `Tailwind skill`、`shadcn-vue skill`、`Nuxt 官方 MCP` |
