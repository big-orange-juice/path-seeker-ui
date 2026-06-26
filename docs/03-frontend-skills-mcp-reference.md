# 前端相关 Skills / MCP 参考清单

## 1. 当前结论

| 项目 | 结论 |
| --- | --- |
| Nuxt 路由结构 | `apps/admin-web` 已切到 Nuxt 4 推荐的 `app/` 目录结构，和当前项目级 `nuxt` skill 对齐 |
| 动画方案 | 统一采用 `GSAP` |
| Skill 安装策略 | 你已明确由你自己手动安装，因此这里只记录“当前状态”和“还缺什么” |
| MCP 策略 | 仅保留参考，不在本仓库内强行固化安装流程 |

## 2. 当前项目级 Skill 状态

| 类别 | Skill | 当前状态 | 说明 |
| --- | --- | --- | --- |
| Nuxt | `nuxt` | 已具备 | 可指导 Nuxt 4、`app/` 目录、路由、数据获取与工程组织 |
| Vue | `vue-best-practices` | 已具备 | 适用于 `.vue` 文件、Composition API、组件拆分与状态组织 |
| GSAP | `gsap-core` | 已具备 | GSAP 基础动画能力 |
| GSAP | `gsap-frameworks` | 已具备 | 适用于 Vue / Nuxt 生命周期接入 |
| GSAP | `gsap-performance` | 已具备 | 用于性能优化与动画平滑度控制 |
| GSAP | `gsap-plugins` | 已具备 | 用于插件注册与能力扩展 |
| GSAP | `gsap-scrolltrigger` | 已具备 | 适用于滚动驱动与分段推进场景 |
| GSAP | `gsap-timeline` | 已具备 | 适用于串联剧情、线索解锁、结算动画 |
| GSAP | `gsap-utils` | 已具备 | 提供常用动画辅助工具 |

## 3. 当前还缺什么

| 类别 | 状态 | 影响 |
| --- | --- | --- |
| Tailwind 专项 Skill | 缺少 | 写原子类和设计 token 时缺少专门的模式参考，但不影响开发 |
| shadcn-vue 专项 Skill | 缺少 | 后台组件装配、变体扩展、表单组合时少一层生态指引 |
| Nuxt 专属 MCP | 未在项目内固化 | 不影响代码编写，但少了一个面向官方文档 / 最佳实践的实时辅助入口 |

## 4. 与当前项目的匹配判断

| 技术栈 | 当前匹配度 | 判断 |
| --- | --- | --- |
| `Nuxt 4 + app/` | 高 | 已有 `nuxt` skill，且目录结构已对齐 |
| `Vue 3 + Composition API` | 高 | 已有 `vue-best-practices`，适配当前工程方向 |
| `GSAP` | 高 | 已有完整 `gsap-*` skill 组，足够覆盖大多数动效开发 |
| `Tailwind` | 中 | 代码可直接写，但缺少专项 skill 支持 |
| `shadcn-vue` | 中 | 可以接入组件库，但缺少项目级专项 skill 指南 |

## 5. MCP 参考

| 方向 | 价值 | 备注 |
| --- | --- | --- |
| Nuxt 官方 MCP | 高 | 更适合查官方最新能力与 Nuxt 4 约定 |
| Browser / In-app Browser | 高 | 适合联调后台页面、验证布局与交互 |
| 脚本执行类工具 | 中 | 适合处理临时数据转换、协议校验、样例生成 |

## 6. 最终判断

| 结论项 | 结果 |
| --- | --- |
| 当前 skill 目录是否基本符合项目 | 是，已经覆盖 `Nuxt + Vue + GSAP` 主干开发 |
| 是否还存在缺口 | 有，主要缺 `Tailwind` 与 `shadcn-vue` 两类专项 skill |
| 是否影响现在继续做项目 | 不影响，可以先继续初始化和开发 |
| 后续最值得补的方向 | `Tailwind skill`、`shadcn-vue skill`、`Nuxt 官方 MCP` |
