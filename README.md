# Path Seeker UI

`Path Seeker UI` 是“秘径寻踪”项目的前端 monorepo，当前承载两类应用：

- `web-admin`：面向 B 端运营与内容编辑的后台原型。
- `mp-wechat`：面向 C 端游客的微信小程序端。

这个仓库当前重点在前端信息架构、页面原型和跨端工程组织，后端服务不在本仓库内。

## 项目概览

秘径寻踪的核心目标，是把传统博物馆导览升级为“主题探索 + 谜题解锁 + 故事反馈”的游戏化体验。前端拆成两端：

- 后台负责馆藏内容管理、谜题配置、主题路线编排和运营发布。
- 小程序负责任务进入、章节推进、谜题交互和奖励反馈。

目前仓库状态如下：

- `apps/web-admin` 已有较完整的后台信息架构展示页。
- `apps/mp-wechat` 仍处于基础脚手架阶段，首页还是默认示例页。
- `packages/*` 已预留共享 UI、通用 TS 能力和游戏渲染协议的位置。
- `docs/` 下保存了产品方案、开发规划和工程参考文档。

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
- `@nuxt/icon`

补充说明：

- 当前 `Nuxt` 配置为 `ssr: false`，更偏后台原型和交互型管理界面。
- 目录已采用 Nuxt 4 推荐的 `app/` 结构。

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
│  ├─ web-admin/     # Nuxt 4 后台原型
│  └─ mp-wechat/     # uni-app 微信小程序
├─ packages/
│  ├─ ui-admin/      # 后台 UI 二次封装入口
│  ├─ ts-shared/     # 通用 TS 类型与工具
│  └─ game-renderer/ # 谜题渲染协议与前端渲染能力预留
├─ docs/
│  ├─ 01-product-solution.md
│  ├─ 02-development-plan.md
│  └─ 03-frontend-skills-mcp-reference.md
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
- `pnpm`，仓库声明的包管理器版本为 `pnpm@11.7.0`

如果你使用 `corepack`，可以直接执行：

```bash
corepack enable
corepack prepare pnpm@11.7.0 --activate
```

### 2. 安装依赖

在仓库根目录执行：

```bash
pnpm install
```

Windows 也可以直接使用脚本：

```powershell
./scripts/install-all.ps1
```

macOS / Linux：

```bash
bash ./scripts/install-all.sh
```

### 3. 启动项目

启动后台原型：

```bash
pnpm dev:web-admin
```

启动小程序的 H5 调试版本：

```bash
pnpm dev:h5
```

启动微信小程序构建目标：

```bash
pnpm dev:mp-wexin
```

补充说明：

- 根脚本名称里保留了 `wexin` 这个历史拼写，但实际映射的是 `mp-weixin`。
- 如果你更习惯进入子应用目录，也可以直接使用各自 `package.json` 里的脚本。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev:web-admin` | 启动 Nuxt 后台开发环境 |
| `pnpm build:web-admin` | 构建后台 |
| `pnpm dev:h5` | 启动 uni-app 的 H5 调试 |
| `pnpm dev:mp-wexin` | 启动微信小程序目标 |
| `pnpm build:mp-wexin` | 构建微信小程序目标 |
| `pnpm typecheck` | 递归执行 workspace 类型检查 |

## 当前页面与模块

### `apps/web-admin`

当前后台已整理出一套围绕产品方案的页面骨架：

- `/`：后台概览，展示项目定位、业务模型、核心理念和整体流程。
- `/collections`：馆藏内容管理，强调内容资产化和录入优先级。
- `/puzzles`：谜题工坊，展示分龄出题策略和题型库。
- `/routes`：主题路线与剧本编排。
- `/operations`：运营发布、指标看板和 MVP 范围。

这部分更接近“产品方案可视化后台原型”，而不是已经接好后端的生产系统。

### `apps/mp-wechat`

当前仍是基础脚手架状态：

- 已完成 `uni-app` 工程初始化。
- 已配置多端脚本，包含 H5 与 `mp-weixin`。
- 首页目前仍是默认示例内容，业务页面尚未开始落地。

## 共享包说明

| 包名 | 用途 |
| --- | --- |
| `@path-seeker/ui-admin` | 后台通用 UI 组件和封装入口 |
| `@path-seeker/ts-shared` | 共享类型、常量和工具函数 |
| `@path-seeker/game-renderer` | 题型协议、渲染结构和跨端玩法渲染能力预留 |

## 文档索引

如果要继续补全业务背景或规划，优先看这些文档：

- `docs/01-product-solution.md`：产品方案与业务模型。
- `docs/02-development-plan.md`：前后端拆分、技术栈和阶段实施建议。
- `docs/03-frontend-skills-mcp-reference.md`：当前前端 skill / MCP 参考记录。

## 开发说明

- 本仓库仅覆盖前端工作区，不包含 `.NET` 后端服务实现。
- `web-admin` 当前更偏信息架构与页面原型，适合继续补数据模型、组件抽象和接口接入层。
- `mp-wechat` 当前更偏脚手架，可从任务首页、章节地图、谜题渲染三条主线继续推进。
- 如果需要共享协议，优先沉淀到 `packages/ts-shared` 或 `packages/game-renderer`，避免在两个应用里各自复制。
