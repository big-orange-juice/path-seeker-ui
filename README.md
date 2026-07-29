# Path Seeker UI

`Path Seeker UI` 是「秘径寻踪」项目的前端 monorepo，当前承载多端应用：

- `web-admin`：面向 B 端运营与内容编辑的后台。
- `h5-client`：面向 C 端游客的 H5 客户端（主链路体验）。
- `mp-wechat`：面向 C 端游客的微信小程序端。
- `h5-demo`：纯静态沉浸演示，用于体验对齐参考。

本仓库重点在前端应用、共享协议与跨端工程组织；后端服务不在本仓库内。

## 项目概览

秘径寻踪的核心目标，是把传统博物馆导览升级为「主题探索 + 谜题解锁 + 故事反馈」的互动体验。前端按端拆分：

- 后台负责馆藏内容管理、谜题配置、主题路线编排和运营发布。
- H5 / 小程序负责任务进入、章节推进、谜题交互和奖励反馈。

目前仓库状态如下：

- `apps/web-admin`：Nuxt 后台，含路线编辑、馆藏、运营等控制台能力。
- `apps/h5-client`：Vue 3 H5 主客户端，对接真实公开 C 端接口。
- `apps/mp-wechat`：uni-app 微信小程序端。
- `apps/h5-demo`：静态 demo，作为 H5 体验对照基准。
- `packages/*`：共享类型、玩法运行时、题型渲染器、UI 与状态能力。
- `docs/`：产品方案、接口约定与对齐进度文档。

## 技术栈

### Workspace

- `pnpm workspace`
- `TypeScript`

### B 端后台：`apps/web-admin`

- `Nuxt 4`
- `Vue 3`
- `Pinia`
- `Tailwind CSS`
- `shadcn-vue`
- `@vueuse/nuxt`
- `@nuxt/image`

补充说明：

- 当前 `Nuxt` 配置为 `ssr: false`，更偏后台管理与交互型界面。
- 目录采用 Nuxt 4 推荐的 `app/` 结构。

### H5 客户端：`apps/h5-client`

- `Vue 3`
- `Vite`
- `Vue Router`
- `Pinia`
- `Tailwind CSS`
- `GSAP`

### 微信小程序端：`apps/mp-wechat`

- `uni-app`
- `Vue 3`
- `Pinia`
- `Tailwind CSS`
- `GSAP`

## 目录结构

```text
.
├─ apps/
│  ├─ web-admin/     # Nuxt 4 后台
│  ├─ h5-client/     # Vue 3 H5 主客户端
│  ├─ mp-wechat/     # uni-app 微信小程序
│  └─ h5-demo/       # 静态体验 demo
├─ packages/
│  ├─ ui/              # 共享 UI 组件
│  ├─ ts-shared/       # 共享 TS 类型与契约
│  ├─ game-renderer/   # 题型渲染器与预览
│  ├─ game-runtime/    # 会话 / 草稿 / 评分等运行时
│  ├─ client-state/    # 客户端通用状态（如 toast）
│  └─ tailwind-config/ # 共享 Tailwind 主题
├─ docs/
│  ├─ 01-product-solution.md
│  ├─ 32-chat-send-sse-api.md
│  ├─ 41-route-status-workflow.md
│  ├─ h5-client-demo-alignment-status.md
│  ├─ h5-client-progress-and-plan.md
│  └─ schema.json
├─ scripts/
│  ├─ install-all.ps1
│  └─ install-all.sh
├─ package.json
└─ pnpm-workspace.yaml
```

## 快速开始

### 1. 准备环境

请先确保本机已安装：

- `Node.js`
- `pnpm`（仓库声明版本：`pnpm@11.7.0`）

如果使用 `corepack`：

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

### 2. 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

Windows：

```powershell
./scripts/install-all.ps1
```

macOS / Linux：

```bash
bash ./scripts/install-all.sh
```

### 3. 启动项目

启动后台：

```bash
pnpm dev:web-admin
```

启动 H5 主客户端：

```bash
pnpm dev:h5-client
```

启动小程序 H5 调试：

```bash
pnpm dev:h5
```

启动微信小程序构建目标：

```bash
pnpm dev:mp-weixin
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev:web-admin` | 启动 Nuxt 后台开发环境 |
| `pnpm build:web-admin` | 构建后台 |
| `pnpm dev:h5-client` | 启动 H5 主客户端 |
| `pnpm build:h5-client` | 构建 H5 主客户端 |
| `pnpm typecheck:h5-client` | H5 客户端类型检查 |
| `pnpm dev:h5` | 启动 uni-app H5 调试 |
| `pnpm dev:mp-weixin` | 启动微信小程序目标 |
| `pnpm build:mp-weixin` | 构建微信小程序目标 |
| `pnpm typecheck` | 递归执行 workspace 类型检查 |

## 共享包说明

| 包名 | 用途 |
| --- | --- |
| `@path-seeker/ui` | 共享 UI 组件 |
| `@path-seeker/ts-shared` | 共享类型、枚举与契约 |
| `@path-seeker/game-renderer` | 题型渲染器、玩法预览宿主 |
| `@path-seeker/game-runtime` | 草稿、进度、评分等运行时逻辑 |
| `@path-seeker/client-state` | 客户端通用状态（如 toast） |
| `@path-seeker/tailwind-config` | 共享主题与 Tailwind 配置 |

## 文档索引

- `docs/01-product-solution.md`：产品方案与业务模型。
- `docs/schema.json`：公开 C 端接口契约参考。
- `docs/h5-client-demo-alignment-status.md`：H5 与 demo 体验对齐专项（07-15 切片）。
- `docs/h5-client-progress-and-plan.md`：H5 实现总进度、未完成项与后续计划。
- `docs/53-c-user-exhibit-chat-realtime-audio-api.md`：C 端问一问 send-with-audio（文字 + 后端合成语音 SSE）。
- `docs/32-chat-send-sse-api.md`：对话 / SSE 相关接口说明。
- `docs/41-route-status-workflow.md`：路线发布 / 审核状态动线。

## 开发说明

- 本仓库仅覆盖前端工作区，不包含后端服务实现。
- 跨端共享协议优先沉淀到 `packages/ts-shared`、`packages/game-renderer`、`packages/game-runtime`，避免在各应用内复制。
- H5 主链路以 `apps/h5-client` 为准；`apps/h5-demo` 仅作体验对照，不作为生产入口。
- 文件请使用 **UTF-8** 编码保存，避免中文再次出现乱码。
