# Path Seeker Frontend Monorepo

这是博物馆导览解密项目的前端仓库初始化骨架。

## 目录结构

```text
apps/
  admin-web/   # Nuxt 4 + shadcn-vue + Tailwind
  mini-app/    # uni-app + Tailwind

packages/
  ui-admin/        # 后台 UI 二次封装
  ts-shared/       # 通用 TS 工具、常量与类型
  game-renderer/   # 谜题渲染协议与前端渲染辅助
```

## 工作区命令

```bash
pnpm install
pnpm dev:admin
pnpm dev:mini
```

## 说明

- 当前仓库只初始化前端 monorepo 骨架。
- 前端与服务端通过 REST API 对接，不生成本地 SDK。
- `admin-web` 已对齐 Nuxt 4 推荐的 `app/` 目录结构，便于和项目级 Nuxt skill 保持一致。
- 详细方案见 `docs/02-development-plan.md`。
