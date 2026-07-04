# C端用户游玩动线接口说明

本文档说明 C 端用户从浏览路线、加入路线、单人/组队游玩、恢复进度到完成路线的推荐接口调用顺序。

## 1. 路线浏览阶段

### 1.1 已发布路线列表

```http
POST /api/Route/Published
```

用途：

- C 端首页或路线列表页展示可玩的路线卡片。
- 只用于浏览，不创建用户进度。

### 1.2 路线详情

```http
GET /api/Route/Detail?id={routeId}
```

用途：

- 展示路线标题、介绍、封面、难度、预计时长等信息。
- 只用于浏览，不创建用户进度。

## 2. 组队准备阶段

如果用户选择单人游玩，可以跳过本阶段。

### 2.1 创建队伍

```http
POST /api/Team/Create
```

用途：

- 用户作为队长创建队伍。
- 请求中传入 `routeId`、`teamName`、`maxMembers` 等字段。

### 2.2 加入队伍

```http
POST /api/Team/Join
```

用途：

- 用户通过 `teamId` 或 `inviteCode` 加入队伍。

### 2.3 查看我的队伍

```http
GET /api/Team/MyTeams
```

用途：

- 查询当前用户已加入的队伍。
- 用户可以选择已有队伍继续游玩。

### 2.4 查看队伍详情

```http
GET /api/Team/Get?teamId={teamId}
```

用途：

- 展示队员、队长、邀请码、队伍状态。

说明：

- 组队路线允许任意有效队员开始，不限制只有队长开始。

## 3. 明确加入路线阶段

### 3.1 加入/开始路线

```http
POST /api/Gameplay/JoinRoute
```

单人请求示例：

```json
{
  "routeId": "123"
}
```

组队请求示例：

```json
{
  "routeId": "123",
  "teamId": "456"
}
```

用途：

- 明确表示用户正式加入或开始路线。
- 单人模式创建或返回 `user_route_progress`。
- 组队模式创建或返回 `team_route_progress`，同时创建或返回个人进度。
- 写入 `user_route_activity = join_route`。
- 组队首次开始时，队伍状态从 `组队中` 进入 `已开始`。
- 重复调用不会重复创建进度。

前端建议：

- 用户点击“开始路线 / 继续路线 / 加入路线”时，先调用该接口。
- 新前端不要再依赖 `Gameplay/Stages` 隐式创建进度。

## 4. 获取玩法节点阶段

### 4.1 获取路线节点

单人模式：

```http
GET /api/Gameplay/Stages?routeId={routeId}
```

组队模式：

```http
GET /api/Gameplay/Stages?routeId={routeId}&teamId={teamId}
```

用途：

- 获取路线下所有玩法节点。
- 返回每个节点的配置、交互类型、是否完成。
- 组队模式下同时返回个人和队伍两个维度的完成状态。

关键返回字段示例：

```json
{
  "stageId": "1001",
  "title": "第一关",
  "interactionType": 1,
  "solved": true,
  "mySolved": false,
  "teamSolved": true,
  "solvedByUserId": "888"
}
```

字段说明：

- `solved`：兼容旧前端。单人时表示个人是否完成，组队时表示队伍是否完成。
- `mySolved`：当前用户是否完成该节点。
- `teamSolved`：当前队伍是否完成该节点。
- `solvedByUserId`：组队模式下，首次代表队伍完成该节点的用户 ID。

## 5. 进度恢复阶段

### 5.1 我的路线进度

单人模式：

```http
GET /api/Gameplay/MyRouteProgress?routeId={routeId}
```

组队模式：

```http
GET /api/Gameplay/MyRouteProgress?routeId={routeId}&teamId={teamId}
```

用途：

- 用户中途退出后恢复进度。
- 前端进入玩法页前可调用该接口，决定跳转到哪个节点。
- 组队模式下返回个人进度和队伍进度。

关键返回字段示例：

```json
{
  "routeId": "123",
  "teamId": "456",
  "isTeamMode": true,
  "myStatus": 1,
  "teamStatus": 1,
  "currentStageId": "1003",
  "mySolvedCount": 1,
  "teamSolvedCount": 3,
  "totalStageCount": 5,
  "myTotalScore": 10,
  "teamTotalScore": 30,
  "myUsedClueCount": 0,
  "teamUsedClueCount": 1,
  "lastActivityAt": "2026-07-04T10:00:00Z",
  "stages": []
}
```

前端建议：

- 单人模式：使用 `currentStageId` 恢复到用户上次或下一个未完成节点。
- 组队模式：优先按队伍的 `currentStageId` 恢复。
- 节点列表中使用 `mySolved` 和 `teamSolved` 区分“我完成”和“队伍完成”。

## 6. 节点行为上报阶段

该接口用于弱业务行为，关键业务行为由后端自动记录。

### 6.1 记录路线行为

```http
POST /api/Gameplay/RecordActivity
```

单人请求示例：

```json
{
  "routeId": "123",
  "stageId": "1001",
  "activityType": 3,
  "durationSec": 0,
  "clientEventId": "enter-stage-1001-xxx"
}
```

组队请求示例：

```json
{
  "routeId": "123",
  "teamId": "456",
  "stageId": "1001",
  "activityType": 3,
  "durationSec": 0,
  "clientEventId": "enter-stage-1001-xxx"
}
```

建议前端上报的 `activityType`：

```text
2 = resume_route
3 = enter_stage
4 = leave_stage
9 = skip_stage
99 = other
```

不建议前端上报的 `activityType`：

```text
1 = join_route
5 = submit_stage
6 = solve_stage
7 = fail_stage
8 = unlock_hint
10 = complete_route
12 = team_join_route
13 = team_complete_route
```

说明：

- 上述关键行为已经由后端业务接口自动写入。
- 前端重复上报时，可以通过 `clientEventId` 做幂等。

## 7. 节点提示阶段

### 7.1 获取节点提示

单人模式：

```http
GET /api/Gameplay/Hints?routeId={routeId}&stageId={stageId}
```

组队模式：

```http
GET /api/Gameplay/Hints?routeId={routeId}&stageId={stageId}&teamId={teamId}
```

用途：

- 获取当前节点的提示/线索列表。
- 单人模式读取个人解锁状态。
- 组队模式读取队伍共享解锁状态。

组队规则：

- 队员 A 解锁提示后，队员 B 再查询 `Hints` 时能看到该提示已解锁。
- 提示/线索按队伍共享。

### 7.2 解锁节点提示

```http
POST /api/Gameplay/UnlockHint
```

单人请求示例：

```json
{
  "routeId": "123",
  "stageId": "1001",
  "clueId": "2001"
}
```

组队请求示例：

```json
{
  "routeId": "123",
  "teamId": "456",
  "stageId": "1001",
  "clueId": "2001"
}
```

互动节点配置内 `hintId` 请求示例：

```json
{
  "routeId": "123",
  "teamId": "456",
  "stageId": "1001",
  "clueId": "h1",
  "hintId": "h1"
}
```

用途：

- 解锁当前节点提示。
- 自动写入 `user_route_activity = unlock_hint`。
- 继续写入 `visitor_event_log event_type = 5`，兼容后台统计和徽章逻辑。
- 组队模式下更新 `team_route_progress.extra`，全队共享提示状态。

## 8. 节点提交阶段

### 8.1 提交节点结果

单人模式：

```http
POST /api/Gameplay/Submit
```

请求示例：

```json
{
  "routeId": "123",
  "stageId": "1001",
  "payload": "用户答案",
  "durationSec": 60
}
```

组队模式：

```http
POST /api/Gameplay/Submit
```

请求示例：

```json
{
  "routeId": "123",
  "teamId": "456",
  "stageId": "1001",
  "payload": "用户答案",
  "durationSec": 60
}
```

用途：

- 提交当前节点交互结果。
- 成功时写个人 `user_stage_record`。
- 组队模式下写队伍 `team_stage_record`。
- 更新个人 `user_route_progress`。
- 组队模式下更新 `team_route_progress`。
- 自动写活动流水。

后端自动写入的活动：

```text
submit_stage
solve_stage
fail_stage
complete_route
team_complete_route
```

关键返回字段示例：

```json
{
  "success": true,
  "scoreGained": 10,
  "routeCompleted": false,
  "teamRouteCompleted": true,
  "nextStageId": "1002",
  "message": "达成！"
}
```

字段说明：

- `routeCompleted`：当前用户个人路线是否完成。
- `teamRouteCompleted`：当前队伍路线是否完成。
- 单人模式主要看 `routeCompleted`。
- 组队模式主要看 `teamRouteCompleted`，同时可展示个人贡献。

## 9. 推荐完整动线

### 9.1 单人游玩

```text
Route/Published
-> Route/Detail
-> Gameplay/JoinRoute
-> Gameplay/MyRouteProgress
-> Gameplay/Stages
-> Gameplay/RecordActivity enter_stage，可选
-> Gameplay/Hints，可选
-> Gameplay/UnlockHint，可选
-> Gameplay/Submit
-> Gameplay/MyRouteProgress
```

### 9.2 组队游玩

```text
Route/Published
-> Route/Detail
-> Team/Create 或 Team/Join
-> Team/Get 或 Team/MyTeams
-> Gameplay/JoinRoute，传 teamId
-> Gameplay/MyRouteProgress，传 teamId
-> Gameplay/Stages，传 teamId
-> Gameplay/RecordActivity enter_stage，可选，传 teamId
-> Gameplay/Hints，传 teamId
-> Gameplay/UnlockHint，传 teamId
-> Gameplay/Submit，传 teamId
-> Gameplay/MyRouteProgress，传 teamId
```

## 10. 前端接入注意事项

1. 新前端应先调用 `Gameplay/JoinRoute`，再进入玩法页。
2. 不建议继续依赖 `Gameplay/Stages` 隐式创建进度。
3. 组队玩法展示节点状态时，不要只看 `solved`。
4. 组队玩法应优先使用 `mySolved`、`teamSolved`、`solvedByUserId`。
5. 恢复进度不要依赖本地缓存，建议调用 `Gameplay/MyRouteProgress`。
6. 组队模式下，玩法接口需要持续透传 `teamId`。
7. `RecordActivity` 只用于弱行为。
8. 提交、完成、失败、解锁提示等关键行为不需要前端额外上报。

组队模式需要持续透传 `teamId` 的接口：

```text
Gameplay/JoinRoute
Gameplay/MyRouteProgress
Gameplay/Stages
Gameplay/Hints
Gameplay/UnlockHint
Gameplay/Submit
Gameplay/RecordActivity
```

## 11. 相关数据库脚本

本次改造需要先执行 DDL：

```text
doc/26-user-route-activity-team-progress-ddl.sql
```

说明：

- 项目当前未上线，不考虑历史数据迁移。
- DDL 创建 `user_route_activity`、`team_route_progress`、`team_stage_record` 三张表。
