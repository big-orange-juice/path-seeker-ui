# Path Seeker · H5 Demo

纯 HTML / CSS / JS 的 C 端 H5 沉浸式演示，承接 `docs/03-h5-client-next-steps.md` 主链路，**不对接真实后端**，全部逻辑与样式仅存在于本目录。

## 如何打开

```bash
# 在本目录
python3 -m http.server 5177
# 或
npx --yes serve -p 5177
```

浏览器访问：`http://localhost:5177`

| 入口 | 说明 |
| --- | --- |
| **`index.html`** | **主 Demo（合并版）** — 博物馆黑金 + 游戏感交互 |
| `index2.html` | 早期 v2 实验入口，与主版同源风格，可忽略 |

## 演示主链路

```
登录(游客) → 展厅选路线 → 任务详情 → 开场 → 路线图
  → 展品识别(拍照/扫码) → 播片 → 作答(选择/拼图)
  → 本站结果 → 下一站 … → 通关徽章 → 收藏
```

## 能力对照（相对 next-steps）

| 能力 | Demo 表现 |
| --- | --- |
| 任务列表 / 筛选 | 展厅卡片 + 年龄/难度筛选，localStorage 持久化 |
| 任务详情 / 开始 / 恢复 | 开始会话、继续当前任务 |
| 章节自由选择 | 路线节点图可点选任意站 |
| 识别流程 | 拍照上传 / 模拟扫码 / 模拟失败与重试 |
| 播片衔接 | `assets/movie.mp4`，进度解锁作答，可跳过 |
| 题型 | 仅 **普通选择题** 与 **拼图** |
| 下一章节 | 答对后默认进下一未完成站，可回路线图 |
| Toast | 成功 / 失败 / 提示统一反馈 |
| 状态 | `js/store.js` 统一 session / 进度 / 归档 |

> `docs/03` 中「真接口联调 / 去 mock / 共享 UI」属于 `apps/h5-client`，不在本 Demo 职责内。

## 设计合并要点

从 v1 / v2 吸取并统一到 `index`：

| 来源 | 保留 |
| --- | --- |
| v1 | 完整主链路、博物馆语境、识别失败重试、播片解锁、任务筛选与恢复 |
| v2 | 少文案、大触控、馆印开场、路线节点图、扫描 HUD、进度环、分数爆发、徽章结算 |

## 目录

```
apps/h5-demo/
  index.html       # 主入口（合并版）
  index2.html      # 兼容入口（可指向同一体验）
  css/styles.css   # 主样式
  css/styles2.css  # 与 styles.css 同步的副本
  js/
    data.js store.js toast.js puzzles.js router.js
    pages.js app.js      # 主逻辑
    pages2.js app2.js    # 与主逻辑同源的副本
  assets/movie.mp4
```

## 说明

- 本 Demo 使用本地 mock；真实联调请用 `apps/h5-client`。
- 不修改 monorepo 其他包。
