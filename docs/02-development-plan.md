# 博物馆导览解密项目开发方案（前后端分仓 / .NET + MySQL + Microsoft Agent Framework）

## 1. 方案目标

| 目标 | 说明 |
| --- | --- |
| 对齐既定技术栈 | B 端基于 `Nuxt 4 + shadcn-vue`，C 端基于 `uni-app + Tailwind`，服务端基于 `.NET`，数据库暂定 `MySQL` |
| 明确两条服务线 | 一条是主业务 `ApiService`；另一条是项目自身 AI 辅助的 `AgentService` |
| 兼顾内容生产与游戏体验 | B 端提升内容配置效率，C 端重点做出沉浸感、揭秘感、游戏感 |
| 支撑长期演进 | 前端与服务端分仓，服务端内部用标准 `.sln` 管理 `ApiService` 与 `AgentService` |

## 2. 技术选型确认

| 端 / 层 | 选型 | 说明 |
| --- | --- | --- |
| B 端前台 | `Nuxt 4` | 用于管理后台、内容编辑、运营配置、预览发布 |
| B 端 UI | `shadcn-vue` | 统一中后台设计语言，兼顾可定制性与开发效率 |
| B 端样式 | `Tailwind CSS` | 与 `shadcn-vue` 搭配自然，适合高密度中后台界面 |
| C 端 | `uni-app` | 面向微信小程序主战场，后续可扩展多端 |
| C 端 UI | `Tailwind CSS` | 用原子类构建轻量游戏化界面 |
| ApiService | `ASP.NET Core Web API` | 承担内容、任务、用户、权限、运营等确定性业务 |
| ORM | `Entity Framework Core` | 适合实体建模、迁移管理、业务查询 |
| 数据库 | `MySQL` | 适合内容、题库、章节、会话、行为记录等关系数据 |
| MySQL Provider | `Pomelo.EntityFrameworkCore.MySql` | 当前 .NET 生态中常用的 MySQL EF Core Provider |
| 缓存 | `Redis` | 用于热点数据、任务进度、排行榜、短期状态 |
| 文件存储 | `OSS / COS / S3` | 存储馆藏图、音频、视频、分享海报、勋章素材 |
| AgentService | `Microsoft Agent Framework` | 负责项目自身 AI 辅助、Agent 编排、多 Agent 协作、人工介入节点 |

### 2.1 后端版本建议

| 项目 | 建议 |
| --- | --- |
| .NET 版本 | 若项目在 `2026-06-26` 之后启动，优先使用 `.NET 10 LTS` |
| 原因 | 微软官方支持策略显示：`.NET 10` 于 `2025-11-11` 发布，支持到 `2028-11-14`；`.NET 8` 支持到 `2026-11-10`，不适合作为今天的新项目长期基线 |
| ASP.NET Core | 与 .NET 主版本同步，建议直接使用 `ASP.NET Core 10` |
| EF Core | 与 .NET 主版本同步，避免跨大版本混用 |

## 3. 仓库与工程组织建议

| 项目 | 建议 |
| --- | --- |
| 前端仓库 | 独立管理 B 端与 C 端前端工程 |
| 服务端仓库 | 使用一个标准 `.NET solution` 管理 `ApiService` 和 `AgentService` |
| 原因 1 | 前端与服务端分仓后，依赖体系、构建链、发布节奏更清晰 |
| 原因 2 | `ApiService` 与 `AgentService` 同属 .NET 生态，放在一个 `.sln` 中更自然 |
| 原因 3 | Agent 与 API 服务可以共享 C# 基础设施、契约定义与公共组件 |

### 3.1 前端仓库建议目录结构

| 路径 | 说明 |
| --- | --- |
| `apps/admin-web` | B 端管理后台，`Nuxt 4 + shadcn-vue`，采用 Nuxt 推荐的 `app/` 目录结构 |
| `apps/mini-app` | C 端小程序，`uni-app + Tailwind` |
| `packages/ui-admin` | B 端 UI 二次封装 |
| `packages/ts-shared` | 前端通用工具、类型、常量 |
| `packages/game-renderer` | 谜题渲染协议与前端渲染逻辑 |
| `docs` | 前端说明、组件规范、联调说明 |

### 3.2 服务端仓库建议目录结构

| 路径 | 说明 |
| --- | --- |
| `PathSeeker.Services.sln` | 标准 .NET Solution 入口 |
| `src/ApiService` | 主业务 API 服务 |
| `src/AgentService` | 基于 Microsoft Agent Framework 的 Agent 服务 |
| `src/SharedKernel` | 领域基础类、值对象、异常、基础枚举 |
| `src/BuildingBlocks` | 日志、缓存、认证、消息、基础设施封装 |
| `src/Contracts` | 服务端内部 DTO、命令、事件契约 |
| `src/OpenApi` | 导出的 OpenAPI 文档或生成脚本 |
| `src/Schemas` | 题型、主题、AI 输出等 JSON Schema |
| `tests/ApiService.Tests` | API 单元与集成测试 |
| `tests/AgentService.Tests` | Agent 工作流、工具、编排测试 |

### 3.3 服务端 `.sln` 组织建议

| 项目 | 说明 |
| --- | --- |
| `ApiService` | 对外业务 API，负责鉴权、内容管理、游戏进度、运营配置 |
| `AgentService` | 对外或内部 AI 服务，负责生成、审核、协作式 Agent 工作流 |
| `SharedKernel` | 领域基础抽象，避免 API 和 Agent 各自复制一套核心概念 |
| `BuildingBlocks` | 通用技术能力，如日志、OpenTelemetry、缓存、消息总线封装 |
| `Contracts` | C# 内部共享的命令、事件、DTO 定义 |

### 3.4 前端与服务端如何共享

| 共享对象 | 推荐方式 | 说明 |
| --- | --- | --- |
| API 协议 | `REST API` | 前端、Agent 与服务端统一通过 REST API 通信 |
| API 文档 | `OpenAPI` | 用于接口文档、联调和后端契约说明，不强制生成 SDK |
| 题型协议 | `JSON Schema` | 用于 B 端编辑、C 端渲染、Agent 输出约束、后端入库校验 |
| AI 输出结构 | `JSON Schema` | 保证 AgentService 输出可校验、可回写 |
| 枚举和配置 | `JSON / YAML` | 年龄段、难度、事件码、题型 code 不要多端各写一份 |
| Prompt 模板 | `Markdown / txt` | 便于版本化、复用、审计 |

### 3.5 为什么前端和 .NET 不直接共享实现代码

| 问题 | 结论 |
| --- | --- |
| 能否让前端和 `.NET` 直接共用一份实现代码 | 不建议，也不可持续 |
| 原因 1 | 前端是 `TypeScript` 运行时，服务端是 `C#/.NET` 运行时 |
| 原因 2 | `pnpm workspace` 与 `.sln / csproj` 是两套完全不同的工程体系 |
| 正确做法 | 共享“契约”和“资源”，而不是强行共享“实现代码” |

### 3.6 推荐仓库拆分

```text
path-seeker-frontend/
  apps/
    admin-web/
    mini-app/
  packages/
    ui-admin/
    ts-shared/
    game-renderer/
  docs/

path-seeker-services/
  PathSeeker.Services.sln
  src/
    ApiService/
    AgentService/
    SharedKernel/
    BuildingBlocks/
    Contracts/
    OpenApi/
    Schemas/
  tests/
    ApiService.Tests/
    AgentService.Tests/
```

## 4. 总体架构设计

| 系统 | 职责 |
| --- | --- |
| B 端管理后台 | 馆藏维护、谜题配置、分龄版本、主题编排、审核发布、数据看板 |
| ApiService | 提供馆藏、题库、主题、任务、进度、用户、奖励、运营配置能力 |
| 游戏运行服务 | 负责章节推进、线索解锁、提示策略、奖励结算、进度同步 |
| 用户与行为服务 | 登录、用户档案、勋章、成就、游玩记录、埋点采集 |
| 主业务 AI 接口层 | 暴露给 B 端的 AI 发起入口，如“生成题目”“改写剧情”“生成提示” |
| AgentService | 基于 `Microsoft Agent Framework` 负责 Agent 编排、生成、审核、回写、可观测 |
| C 端小程序 | 呈现剧情、地图、题型、奖励、结局与分享 |

### 4.1 为什么建议拆成“ApiService + AgentService”

| 层 | 主要对象 | 特点 |
| --- | --- | --- |
| ApiService | 馆藏、题库、主题、游戏会话、权限、奖励、运营配置 | 强业务约束、要求稳定、强调一致性 |
| AgentService | AI 生成、模型编排、人工审核、长任务、可观测、评测 | 变化快、试验性强、需要快速迭代 |
| 集成边界 | API、Webhook、任务表、消息队列 | 易于解耦，便于后续替换模型与编排策略 |

结论：不要把多步 AI 编排硬塞进 `ApiService` 控制器逻辑。更稳妥的方式是 `ApiService` 负责确定性业务，`AgentService` 负责不确定性 AI 工作流。

## 5. B 端开发方案

### 5.1 B 端前端推荐组合

| 模块 | 选型建议 | 说明 |
| --- | --- | --- |
| 框架 | `Nuxt 4` | 统一路由、页面组织和工程结构，并对齐官方推荐的 `app/` 路由目录 |
| 渲染策略 | 后台主应用默认 `CSR`，保留少量 SSR 能力 | 管理后台更重交互，默认 CSR 更轻便 |
| UI 组件 | `shadcn-vue` | 适合可定制中后台，不被重型组件库绑定 |
| 样式系统 | `Tailwind CSS` | 与 `shadcn-vue` 一体化最佳 |
| 状态管理 | `Pinia` | 适合用户态、筛选态、草稿态、编辑器状态 |
| 表单校验 | `vee-validate + zod` | 复杂配置表单、动态字段和嵌套 schema 更稳 |
| 网络层 | `useFetch / $fetch` + 统一 API 封装 | 与 Nuxt 配合自然 |
| 工具库 | `VueUse` | 提升筛选、节流、防抖、草稿体验 |

### 5.2 B 端模块拆分

| 一级模块 | 二级模块 | 说明 |
| --- | --- | --- |
| 登录与权限 | 登录、角色、馆权限、菜单权限 | 支持馆长、编辑、审核、运营角色 |
| 基础数据 | 博物馆、展厅、展柜、主题分类、标签 | 内容挂载基础设施 |
| 馆藏管理 | 馆藏列表、详情、图文、音视频、标签、线索点 | 平台内容核心 |
| 谜题工坊 | 题型模板、题目配置、分龄版本、提示规则 | 互动内容核心 |
| 主题编排 | 剧情背景、章节流、解锁条件、奖励配置 | 生成 C 端可玩副本 |
| 发布中心 | 草稿、审核、发布、版本记录、回滚 | 保证内容质量与可追溯 |
| 运营中心 | 节日活动、专题任务、二维码入口、分享配置 | 支撑活动运营 |
| 数据看板 | 通关率、卡点题、提示率、热门馆藏、年龄层分析 | 驱动迭代优化 |
| AI 工作台 | 出题草稿、剧情改写、标签建议、风险提示 | 作为 AgentService 的业务入口 |

## 6. C 端开发方案

### 6.1 C 端前端推荐组合

| 模块 | 选型建议 | 说明 |
| --- | --- | --- |
| 框架 | `uni-app` | 先承接微信小程序，兼顾后续多端复用 |
| UI 样式 | `Tailwind CSS` | 适合做轻游戏化、卡片化、章节化界面 |
| 小程序适配 | 推荐配合 `weapp-tailwindcss` | 保证原子类在微信小程序中稳定可用 |
| 状态管理 | `Pinia` | 管理任务进度、线索状态、奖励状态、会话状态 |
| 请求层 | 统一 request 封装 + 拦截器 | 处理 token、重试、弱网提示 |
| 缓存层 | `uni.setStorage` 二次封装 | 支撑进度缓存、资源缓存、弱网恢复 |
| 音频能力 | 小程序音频 API 封装 | 用于线索音效、剧情旁白、讲解语音 |

### 6.2 C 端核心模块

| 一级模块 | 二级模块 | 说明 |
| --- | --- | --- |
| 首页大厅 | 推荐主题、活动 Banner、年龄筛选、勋章入口 | 承接转化与第一印象 |
| 任务系统 | 任务详情、开场剧情、章节地图、终局结算 | 游戏主流程 |
| 谜题系统 | 动态题型渲染、答案校验、提示系统、反馈动效 | 交互核心 |
| 线索系统 | 线索板、文物卡、碎片收集、剧情档案 | 提升揭秘感 |
| 成长系统 | 勋章、称号、图鉴、任务完成记录 | 提升复玩和成就感 |
| 分享系统 | 结案海报、任务卡、成就分享图 | 提升传播能力 |
| 账户系统 | 微信登录、游客态、家庭协作记录 | 沉淀用户数据 |

### 6.3 C 端“游戏感”落地重点

| 体验目标 | 开发落点 | 说明 |
| --- | --- | --- |
| 沉浸感 | 剧情开场、章节地图、旁白、音效、档案式界面 | 让用户像进入一个任务世界 |
| 揭秘感 | 线索卡翻转、碎片收集、逐步揭示真相 | 不是单次答题，而是逐层接近答案 |
| 游戏感 | 关卡解锁、章节推进、奖励弹层、结案称号 | 形成明显的闯关感和完成感 |

## 7. ApiService 开发方案（.NET）

### 7.1 ApiService 推荐组合

| 模块 | 建议 |
| --- | --- |
| Web 框架 | `ASP.NET Core Web API` |
| ORM | `Entity Framework Core` |
| MySQL Provider | `Pomelo.EntityFrameworkCore.MySql` |
| 身份认证 | `JWT` + 后台管理侧 `RBAC` |
| 参数校验 | `FluentValidation` 或 `DataAnnotations + 统一校验管道` |
| 对象映射 | `Mapster` 或 `AutoMapper` |
| API 文档 | `Swagger / OpenAPI` |
| 后台任务 | `Hangfire` 或 `Quartz.NET` |
| 日志 | `Serilog` |
| 缓存访问 | `StackExchange.Redis` |

### 7.2 ApiService 模块建议

| 模块 | 说明 |
| --- | --- |
| `auth` | B 端登录、角色权限、token、审计日志 |
| `museum` | 博物馆、展厅、展柜、标签等基础数据 |
| `artifact` | 馆藏、媒体、知识标签、线索素材 |
| `puzzle` | 谜题模板、谜题配置、分龄版本、提示规则 |
| `theme` | 主题任务、章节、路线、终局、奖励 |
| `game-session` | 用户游玩进度、章节状态、答题记录、结算 |
| `reward` | 徽章、称号、图鉴卡、领取记录 |
| `analytics` | 埋点、漏斗、卡点分析、运营报表 |
| `ai-workbench` | 面向 B 端的 AI 请求入口、结果回收、调用日志 |
| `upload` | 媒资上传、鉴权、格式校验、缩略图处理 |

### 7.3 API 分层建议

| 层 | 用途 |
| --- | --- |
| Admin API | 给 B 端后台使用，偏配置、审核、内容编辑 |
| Mini API | 给 C 端小程序使用，偏读操作、答题、进度、奖励 |
| AI API | 给 B 端 AI 工作台和 AgentService 回调主业务结果使用 |
| Internal API | 给内部任务调度、数据处理、异步作业调用 |

## 8. 数据模型与协议建议

### 8.1 核心实体

| 实体 | 说明 |
| --- | --- |
| `museum` | 博物馆 |
| `exhibit_area` | 展厅/展区 |
| `artifact` | 馆藏/字画/文物 |
| `artifact_asset` | 图片、音频、视频、细节图 |
| `puzzle_template` | 题型模板 |
| `puzzle` | 谜题母题 |
| `puzzle_age_version` | 按年龄段细分后的题目版本 |
| `story_theme` | 主题任务 |
| `story_chapter` | 主题章节 |
| `chapter_puzzle_relation` | 章节和题目的关系 |
| `reward` | 勋章、称号、卡片等 |
| `user_game_session` | 用户一次游玩会话 |
| `user_puzzle_record` | 用户答题记录 |
| `event_log` | 埋点日志 |
| `ai_generation_task` | AI 任务单 |
| `ai_generation_result` | AI 生成结果、审核状态、回写记录 |

### 8.2 关键设计原则

| 原则 | 说明 |
| --- | --- |
| 题型配置 JSON 化 | 便于 B 端编辑、C 端渲染、服务端校验 |
| 年龄版本独立化 | 同一母题下允许不同年龄段分别维护 |
| 章节解锁规则可配置 | 支持完成条件、线索条件、顺序条件 |
| AI 结果可追溯 | 所有 AI 生成文案、题目、提示都要保留任务号和结果版本 |

### 8.3 题型协议建议

| 字段 | 说明 |
| --- | --- |
| `templateType` | 题型类型，如 `single_choice`、`sort`、`match`、`hotspot` |
| `questionPayload` | 题面配置 |
| `answerPayload` | 答案结构 |
| `hintPayload` | 分级提示规则 |
| `rewardPayload` | 过关奖励配置 |
| `mediaPayload` | 关联图片、音频、局部放大图等 |
| `uiSkin` | 题型视觉皮肤参数 |

## 9. 与当前技术栈配套的共享与协作方式

| 协作项 | 建议 |
| --- | --- |
| 前端共享代码 | 放在前端仓库 `packages/*`，供 `admin-web` 与 `mini-app` 直接复用 |
| API 对接 | 前端与 `ApiService`、`AgentService` 统一走 `REST API` |
| API 文档 | `ApiService` 输出 `OpenAPI` 作为接口文档与联调依据 |
| 题型 schema | 放在服务端仓库 `src/Schemas`，供 B 端、C 端、AgentService、后端共同校验 |
| 枚举与事件码 | 使用 `JSON / YAML` 保存，避免多端各写一份 |
| Prompt 模板 | 放在服务端仓库，由 AgentService 读取，便于版本管理和回溯 |
| .NET 内部共享 | 放在 `SharedKernel` 与 `BuildingBlocks` |
| 错误码 | 统一错误码，方便 B 端与 C 端做精确反馈 |
| Mock 数据 | 用共享 schema 生成 Mock，保证联调更顺畅 |

## 10. 项目自身 AI 辅助能力设计

### 10.1 适合这个项目的 AI 能力

| AI 能力 | 使用端 | 作用 |
| --- | --- | --- |
| AI 分龄出题草稿 | B 端 | 基于一件馆藏快速生成 4-6、6-10、10-15、15+ 的题目初稿 |
| AI 提示文案生成 | B 端 | 自动生成 1 级、2 级、3 级提示，降低编辑成本 |
| AI 剧情包装 | B 端 | 把主题路线改写成更有悬念感的任务叙事 |
| AI 讲解词生成 | B 端 / C 端 | 为馆藏生成更口语化、更适龄的讲解词 |
| AI 标签建议 | B 端 | 为馆藏自动提取可出题线索、故事点、关键词 |
| AI 风险审核辅助 | B 端 | 检查题目是否过难、表达是否不适龄、逻辑是否含混 |
| AI 运营分析 | 运营后台 | 自动总结高流失章节、常见卡点与优化建议 |

### 10.2 AI 接入原则

| 原则 | 说明 |
| --- | --- |
| AI 只做辅助，不直接发布 | 所有 AI 生成内容必须人工复核后才能上线 |
| 先做草稿生成，再做高风险能力 | 先从出题草稿、改写、标签建议切入，回报更高 |
| 保留输入输出记录 | 方便复盘效果、优化提示词、对比人工采纳率 |
| 模型解耦 | 在 `AgentService` 内部统一路由模型，不把模型耦合进前端页面 |
| API 与 Agent 解耦 | 多步 AI 工作流放入 `AgentService`，不塞进 `ApiService` 控制器逻辑 |

## 11. AgentService 开发方案（Microsoft Agent Framework）

### 11.1 为什么适合使用 Microsoft Agent Framework

| 能力 | 对本项目的价值 |
| --- | --- |
| .NET 原生支持 | 可直接融入当前 `.NET` 服务端体系，减少跨语言运维复杂度 |
| 多 Agent 与工作流编排 | 适合出题、提示、剧情、审核等多步骤协作流程 |
| Human-in-the-loop | 适合馆方编辑、教研、审核人员中途介入 |
| 可观测与生产化 | 适合生产级 Agent、工作流、遥测与治理能力 |
| Provider 灵活性 | 便于后续接 Azure OpenAI、OpenAI 等不同模型提供方 |

### 11.2 AgentService 职责边界

| 职责 | 说明 |
| --- | --- |
| 做什么 | AI 生成、AI 改写、工具调用、人工确认流、异步长任务编排 |
| 不做什么 | 不直接承担主业务鉴权、主业务事务写入、核心业务规则判定 |
| 与主业务关系 | 通过 API / Webhook / Queue 与 `ApiService` 集成 |

### 11.3 推荐的 Agent 能力模块

| 模块 | 说明 |
| --- | --- |
| `artifact-analyzer` | 从馆藏描述中抽取标签、线索点、知识点、故事素材 |
| `puzzle-generator` | 基于年龄段和题型生成题目草稿 |
| `hint-generator` | 为题目生成 1 级到 3 级提示 |
| `story-writer` | 生成主题开场、章节文案、结局揭晓文案 |
| `risk-reviewer` | 对题目和剧情做适龄性、歧义性、知识风险检查 |
| `ops-analyst` | 结合埋点与数据输出活动复盘建议 |

### 11.4 推荐的 Agent 工作流结构

| 节点 | 作用 |
| --- | --- |
| `load_artifact_context` | 读取馆藏基础信息与历史生成记录 |
| `extract_candidates` | 提取线索候选、标签候选、剧情候选 |
| `branch_by_task_type` | 按“出题 / 改写 / 审核 / 讲解词”路由到不同工作流 |
| `generate_draft` | 生成目标内容草稿 |
| `self_check` | 自检格式、年龄适配、逻辑完整性 |
| `human_review_gate` | 需要时中断并等待人工审核 |
| `write_back_result` | 将审核通过的结果回写 `ApiService` |
| `emit_trace` | 输出 trace、评估结果、调试信息 |

### 11.5 AgentService 技术建议

| 维度 | 建议 |
| --- | --- |
| 运行时 | `.NET 10` |
| 编程语言 | `C#` |
| Agent 框架 | `Microsoft Agent Framework` |
| 模型接入层 | 与具体模型 SDK 解耦，统一封装 provider adapter |
| 可观测 | 优先采用 `OpenTelemetry`，与服务端整体监控体系保持一致 |
| 状态存储 | Agent 状态、任务记录、审计日志可独立表或独立库保存 |
| 通信 | 与 `ApiService` 之间优先 API + 回调，复杂场景再引入消息队列 |

### 11.6 ApiService 与 AgentService 的协作方式

| 场景 | ApiService | AgentService |
| --- | --- | --- |
| AI 出题 | 发起生成任务、保存任务单 | 生成题目草稿并回传 |
| AI 审核 | 提交待审核内容 | 输出风险点、修改建议、是否需人工介入 |
| AI 剧情改写 | 发起剧情包装任务 | 输出开场、章节、结案文案 |
| AI 运营复盘 | 提供数据摘要 | 输出优化建议与卡点分析 |

## 12. 发布、测试与运维建议

### 12.1 测试分层

| 层 | 建议 |
| --- | --- |
| 单元测试 | 重点覆盖题型解析、解锁规则、奖励规则、Agent 输出结构校验 |
| 集成测试 | 覆盖馆藏 -> 谜题 -> 主题 -> 发布 的关键链路 |
| 端到端测试 | 覆盖 B 端登录、内容编辑、主题发布、C 端游玩通关流程 |
| Agent 测试 | 覆盖出题、提示、剧情改写、审核流的节点级与工作流级测试 |
| 体验测试 | 重点测试剧情节奏、弱网恢复、音频播放、章节切换体验 |

### 12.2 运维建议

| 项目 | 建议 |
| --- | --- |
| 环境划分 | 开发、测试、预发、正式四套环境 |
| 内容发布 | 发布前先在预发环境跑一遍完整游玩预览 |
| AI / Agent 监控 | 统计调用量、失败率、平均耗时、人工采纳率、节点中断率 |
| 媒资管理 | 图片、音频、视频统一压缩与命名规范 |

## 13. MVP 范围建议

| 类别 | 建议范围 |
| --- | --- |
| 馆数量 | 单馆 |
| 主题数量 | 1-2 条精品主题任务 |
| 年龄层 | 先支持 `6-10`、`10-15` |
| 题型数量 | 单选、热点点击、排序、配对、密码解锁、剧情判断 |
| B 端能力 | 馆藏管理、谜题工坊、主题编排、审核发布、AI 草稿发起 |
| C 端能力 | 任务大厅、剧情开场、章节地图、动态题型、奖励页、结局页 |
| 主业务 AI 能力 | 分龄出题草稿、提示生成、剧情改写、标签建议 |
| Agent 端首期能力 | 出题 Agent、提示 Agent、剧情改写 Agent、人工审核中断节点 |

## 14. 分阶段实施建议

| 阶段 | 周期建议 | 目标 | 交付物 |
| --- | --- | --- | --- |
| 阶段 1 | 1-2 周 | 明确字段、题型协议、页面范围、前后端分仓和服务端 `.sln` 结构 | 原型、字段表、仓库结构、技术方案 |
| 阶段 2 | 2-4 周 | 完成 B 端基础后台、馆藏管理、基础权限、`ApiService` 骨架 | `admin-web` 与 `.NET ApiService` 基础版本 |
| 阶段 3 | 2-4 周 | 完成谜题工坊、主题编排、发布链路 | 可发布的内容平台 MVP |
| 阶段 4 | 3-5 周 | 完成 C 端主流程、动态题型、奖励结算 | `mini-app` MVP |
| 阶段 5 | 1-3 周 | 接入 `AgentService` 初版，打通 AI 草稿生成与人工审核链路 | `AgentService` 初版 |
| 阶段 6 | 2-3 周 | 联调、弱网优化、体验打磨、试运营 | 可试点上线版本 |

## 15. 结论

| 结论项 | 内容 |
| --- | --- |
| B 端定位 | 用 `Nuxt 4 + shadcn-vue` 做高效、可预览、可审核的内容生产平台 |
| C 端定位 | 用 `uni-app + Tailwind` 做轻量但有明显游戏感的小程序体验 |
| ApiService 定位 | 用 `.NET + MySQL` 承担稳定、确定性、强业务约束的核心服务 |
| AgentService 定位 | 用 `Microsoft Agent Framework` 承担多 Agent 工作流、人工介入和可观测编排 |
| 工程关键 | 前端与服务端分仓，服务端内部使用标准 `.sln` 管理 `ApiService` 与 `AgentService`，前后端通过 `OpenAPI + JSON Schema` 共享契约 |
