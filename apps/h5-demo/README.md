# Path Seeker · H5 Demo

纯 HTML / CSS / JS 的 C 端 H5 沉浸式演示，承接 `docs/03-h5-client-next-steps.md` 主链路，**不对接真实后端**，全部逻辑与样式仅存在于本目录。

## 如何打开

```bash
# 在本目录
python3 -m http.server 5177
# 或
npx --yes serve -p 5177
```

浏览器访问：`http://localhost:5177`（入口 `index.html`）

## 演示主链路

```
登录(游客) → 展厅选路线 → 任务详情 → 介绍 → 路线
  → 线索 → 识别(拍照/扫码) → 播片 → 作答(选择/拼图)
  → 本站结果 → 回路线 … → 通关徽章 → 收藏
```

## 能力对照（相对 next-steps）

| 能力 | Demo 表现 |
| --- | --- |
| 任务列表 / 筛选 | 展厅卡片 + 年龄/难度筛选，localStorage 持久化 |
| 任务详情 / 开始 / 恢复 | 开始会话、继续当前任务 |
| 章节自由选择 | 路线列表可点选任意站 |
| 识别流程 | 拍照上传 / 模拟扫码 / 模拟失败与重试 |
| 播片衔接 | `assets/movie.mp4`，进度解锁作答，可跳过 |
| 题型 | 仅 **普通选择题** 与 **拼图** |
| 下一章节 | 完成后回路线再选手动进下一站 |
| Toast | 成功 / 失败 / 提示统一反馈 |
| 状态 | `js/store.js` 统一 session / 进度 / 归档 |
| 导航 | 全局 FAB（展厅 / 探索 / 收藏 / 问） |
| 星空 | 独立漂移，切换与播片时加速 |

> `docs/03` 中「真接口联调 / 去 mock / 共享 UI」属于 `apps/h5-client`，不在本 Demo 职责内。

## 目录

```
apps/h5-demo/
  index.html
  css/styles.css
  js/
    data.js store.js toast.js puzzles.js router.js
    fx.js stars.js chrome.js
    pages.js app.js
  assets/movie.mp4
```

## 说明

- 本 Demo 使用本地 mock；真实联调请用 `apps/h5-client`。
- 不修改 monorepo 其他包。
