# Path Seeker · H5 Demo

纯 HTML / CSS / JS 的 C 端 H5 沉浸式演示，承接 `docs/03-h5-client-next-steps.md` 主链路，**不对接真实后端**，全部逻辑与样式仅存在于本目录。

## 如何打开

任意静态服务器即可，例如在本目录执行：

```bash
# Python
python3 -m http.server 5177

# 或 Node
npx --yes serve -p 5177
```

浏览器访问：`http://localhost:5177`

也可直接用浏览器打开 `index.html`（部分浏览器对本地 `video` / `file` 有限制，推荐用本地服务器）。

## 演示主链路

```
登录(游客) → 任务大厅 → 任务详情 → 开场剧情 → 章节地图
  → 展品观察 + 识别(拍照/扫码) → 播片 → 作答(选择题/拼图)
  → 章节结果 → 下一章 … → 终局结算 → 归档
```

## 能力对照（相对 next-steps）

| 能力 | Demo 表现 |
| --- | --- |
| 任务列表 / 筛选 | 大厅卡片 + 年龄/难度筛选，条件 localStorage 持久化 |
| 任务详情 / 开始 / 恢复 | 开始会话、继续当前任务 |
| 章节自由选择 | 章节地图可点选任意站 |
| 识别流程 | 拍照上传 / 模拟扫码 / 模拟失败与重试 |
| 播片衔接 | 使用 `assets/movie.mp4`，观看进度解锁作答，可跳过 |
| 题型 | 仅 **普通选择题** 与 **拼图** |
| 下一章节 | 答对后结果页默认进下一未完成章，可回章节地图 |
| Toast | 成功 / 失败 / 提示统一反馈 |
| 状态 | `js/store.js` 统一 session / 进度 / 归档 |

## 目录

```
apps/h5-demo/
  index.html
  css/styles.css
  js/
    data.js      # 演示任务数据
    store.js     # 状态与 localStorage
    toast.js     # 反馈
    puzzles.js   # 选择题 + 拼图
    router.js    # hash 路由
    pages.js     # 页面渲染
    app.js       # 入口
  assets/movie.mp4
```

## 说明

- 视觉对齐 `apps/h5-client` 的博物馆暗金风格（深底、暖金主色、卡片玻璃感）。
- 本 Demo **故意**使用本地 mock 数据；真实联调请继续在 `apps/h5-client` 进行。
- 不会修改 monorepo 其他包或应用。
