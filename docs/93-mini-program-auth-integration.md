# 支付宝与微信小程序身份登录接入

## 1. 本次实现范围

支付宝原生工程 `apps/mp-alipay` 增加手动授权登录，AppID 为 `2021007109685406`。用户先同意隐私说明，再点击“支付宝授权登录”，调用 `my.getAuthCode({ scopes: ['auth_user'] })`。进入页面、恢复会话和游客浏览不会主动调用支付宝授权。

“手动”指由用户点击发起，平台可复用既有授权，因此不保证每次登录都重新显示授权弹窗；授权界面与用户已授权状态由支付宝控制。

客户端只提交平台临时 code。后端向支付宝或微信校验 code，取得平台身份，再签发项目原有的寻迹 AccessToken、RefreshToken 和字符串 `userId`。不申请手机号，不调用支付宝用户资料接口获取昵称或头像；默认显示寻迹昵称，仍可在“我的”编辑。

后端代码已写入现有 `CulturalTourism_System` 工程；本仓库未包含可修改的微信小程序工程，微信部分提供相同后端入口和调用示例。当前保留原有账号密码、注册和游客接口，H5 使用方式继续兼容。

## 2. 数据库与身份规则

执行文件：[PostgreSQL DDL](./sql/2026-10-15-mini-program-identity.sql)。后端仓库中的同一脚本为 `doc/93-mini-program-identity-ddl.sql`。

新增表 `app_user_external_identity`，关联既有 `app_user`。不修改已有密码凭证 `user_auth`，不需要迁移现有 H5 用户。

| 字段 | 用途 |
| --- | --- |
| `id` | 后端生成的 bigint 主键，接口中需要传递时使用字符串 |
| `user_id` | 寻迹业务用户 ID，关联 `app_user.id` |
| `provider` | `alipay` 或 `wechat` |
| `app_id` | 服务端配置中选定的平台 AppID |
| `subject_type` | 支付宝 `open_id`/旧模式 `user_id`，微信 `openid` |
| `subject_id` | 平台返回的原始字符串标识 |
| `union_id` | 微信可选 `unionid`，仅保存，不据此自动合并 |
| `is_deleted` / 时间字段 | 停用标记和记录时间 |

唯一约束分别保证同一平台、AppID、标识类型和用户标识只有一条关联，以及同一寻迹用户在同平台同 AppID 下只有一个关联。支付宝与微信的同名或同值标识不代表同一个人，不能直接关联。当前不提供已有正式账号的跨平台绑定或合并接口；如以后需要，应增加登录后绑定且验证目标平台身份的独立流程。

注册渠道复用既有枚举：微信 `3`，游客 `5`，新增支付宝 `6`。`platform=4` 仍表示小程序终端，不用于区分支付宝和微信；平台来源保存在身份表。

脚本包含建表、索引、约束和字段说明，不修改现有业务行。发布前先在目标数据库的测试副本执行并核对；本次未连接或变更生产数据库。数据库升级先于后端部署，小程序最后发布。新增表不要由缺少约束的自动建表流程代替。

## 3. 统一接口

```http
POST /api/AppUser/MiniProgramLogin
Content-Type: application/json
```

按当前部署前缀，完整地址为：

```text
https://www.omahaaigc.com/path-seeker/api/AppUser/MiniProgramLogin
```

支付宝请求示例：

```json
{
  "provider": "alipay",
  "code": "my.getAuthCode 返回的 authCode",
  "guestAccessToken": "当前游客的有效 AccessToken，无游客会话可省略",
  "device": "Alipay/Android/设备型号",
  "langCode": "zh"
}
```

微信请求中的 `provider` 改为 `wechat`，`code` 使用 `wx.login` 返回值。

| 参数 | 规则 |
| --- | --- |
| `provider` | 必填，仅接受 `alipay`、`wechat` |
| `code` | 必填，最多 2048 字符；临时且一次性，不缓存、不自动重放 |
| `guestAccessToken` | 可选，最多 8192 字符；仅接受有效游客访问令牌，不接受普通账号令牌或 RefreshToken |
| `device` | 可选，最多 256 字符；当前 DTO 接收，沿用现有登录日志实现，不额外记录此字段 |
| `langCode` | 可选，最多 16 字符，新账号的语言偏好 |

客户端不提交 `openId`、`userId`、`unionId`、`appId` 或平台密钥来决定身份。AppID 固定从服务端配置选择，平台身份完全来自服务端换码结果。

成功返回沿用既有响应包装和登录结构：

```json
{
  "code": 0,
  "message": "登录成功",
  "data": {
    "userId": "9223372036854775806",
    "userNo": "U示例编号",
    "nickname": "漫游者",
    "avatarUrl": null,
    "preferredLang": "zh",
    "isGuest": false,
    "accessToken": "寻迹访问令牌",
    "refreshToken": "寻迹刷新令牌",
    "expiresIn": 7200
  }
}
```

示例的 `expiresIn` 仅用于说明结构，实际值取现有 JWT 配置。后续业务接口继续使用寻迹 `Authorization: Bearer ...`。平台的 AccessToken、微信 `session_key` 以及平台身份不会返回到小程序。

当前登录接口按服务端看到的远端 IP 每分钟限制 20 次；部署有反向代理时，需结合现有可信代理配置检查用户实际来源，避免所有访问被归到代理的单一 IP。

## 4. 游客升级与重复登录

1. 验证可选游客 AccessToken 的签名、有效期、角色和用户 ID；无效时返回 401，在消费平台 code 之前结束。
2. 服务端向平台换取身份，支付宝同时校验响应的 RSA2 签名。
3. 如果已有该平台身份关联，登录关联账号；不会把当前游客数据合并到它。
4. 如果首次授权且提供有效游客会话，在数据库事务内再次检查游客状态，将该 `app_user` 原地升级并添加身份关联。用户 ID 不变，原有本机和服务端记录继续使用同一账号。
5. 如果没有游客会话，创建不含手机号、邮箱和密码的正式用户，再添加身份关联。
6. 签发 `isGuest=false` 的寻迹登录结果。

事务通过 PostgreSQL advisory lock 串行化同一平台身份的创建，并锁定目标用户行；唯一约束作为额外保护。事务失败会回滚用户创建/升级和身份写入。游客已被其他请求升级时不继续覆盖，也不绑定为另一个正式账号。

取消、拒绝授权或服务端登录失败会保留原会话。支付宝客户端收到游客过期响应后只刷新游客会话并提示再次点击授权，不自动复用一次性 code。退出登录或切换账号后返回的迟到结果不能覆盖当前会话。

被禁用、注销或逻辑删除的关联账号拒绝登录，不借平台登录绕过状态检查；注销后保留身份映射，不自动创建新号或恢复旧号。恢复/重新注册策略需要另行明确后再开放。

## 5. 服务端配置

在后端的私有配置文件、部署环境变量或密钥管理系统中配置，密钥不要写入小程序或提交到仓库。下面仅为占位示例：

```json
{
  "MiniProgramAuth": {
    "Alipay": {
      "AppId": "2021007109685406",
      "PrivateKeyPem": "-----BEGIN PRIVATE KEY-----\n应用私钥正文\n-----END PRIVATE KEY-----",
      "AlipayPublicKeyPem": "-----BEGIN PUBLIC KEY-----\n支付宝公钥正文\n-----END PUBLIC KEY-----",
      "IdentityField": "open_id"
    },
    "Wechat": {
      "AppId": "微信小程序 AppID",
      "AppSecret": "微信小程序 AppSecret"
    }
  }
}
```

对应环境变量名使用双下划线，如 `MiniProgramAuth__Alipay__PrivateKeyPem`、`MiniProgramAuth__Wechat__AppSecret`。

支付宝配置要求：

- 在正确 AppID 下启用平台要求的用户授权能力，配置与应用私钥配对的应用公钥。
- `PrivateKeyPem` 是本应用的私钥；`AlipayPublicKeyPem` 是支付宝平台公钥，用于响应验签。不要把应用公钥填成支付宝公钥。
- 当前实现为 **RSA2 公钥模式**，使用 PEM 格式私钥与公钥；支持真实换行和配置中转义的 `\n`。证书模式还需要证书序列号及相应验签流程，本次实现未覆盖。
- 默认严格读取返回的 `open_id`。如果该应用使用旧的 `user_id` 接入模式，联调确认后将 `IdentityField` 明确配置为 `user_id`。缺少指定字段时拒绝登录，不隐式回退；已有数据后不要随意切换，避免同一人生成不同关联。
- 当前对支付宝正式网关 `https://openapi.alipay.com/gateway.do` 调用 `alipay.system.oauth.token`，`grant_type=authorization_code`；没有额外拉取用户资料。

微信配置要求：

- 使用微信小程序自身的 AppID 和 AppSecret；服务端调用 `https://api.weixin.qq.com/sns/jscode2session`。
- 检查有效的 `openid` 和 `session_key`，可选保存 `unionid`，不持久化 `session_key`。
- 微信平台是否返回 `unionid` 不影响登录；不要求手机号、昵称或头像权限。

两个平台按需独立配置；缺少另一平台配置不会影响已配置平台登录。服务端换码 HTTP 超时为 15 秒，关闭自动重定向和该客户端的默认请求日志，避免微信 URL 中的 AppSecret、code 被默认日志记录。不要额外开启该客户端的完整 URL/响应体记录。

## 6. 微信小程序调用示例

微信 `wx.login` 自身不等于一个用户授权弹窗。若产品要求“用户手动登录”，应在用户同意隐私说明并点击登录按钮后调用，而不是在启动时自动调用。以下代码展示流程，`requestMiniProgramLogin` 使用实际小程序项目已有的 HTTPS 请求封装：

```js
async function onWechatLoginTap() {
  if (!privacyAgreed || loginBusy) return;
  loginBusy = true;
  try {
    const authorization = await new Promise((resolve, reject) => {
      wx.login({ success: resolve, fail: reject });
    });
    if (!authorization.code) throw new Error('未取得微信登录凭证');
    const result = await requestMiniProgramLogin({
      provider: 'wechat',
      code: authorization.code,
      guestAccessToken: currentSession?.isGuest ? currentSession.accessToken : null,
      langCode: 'zh'
    });
    saveSession(result);
  } finally {
    loginBusy = false;
  }
}
```

实际微信工程还应处理账号切换、页面离开后的迟到结果、防重复点击和失效游客会话；支付宝工程已实现这些保护。不要把 `wx.login` 的 code 用于支付宝，也不要把服务端密钥放进请求体。

## 7. 部署、联调与回退

1. 在测试数据库执行 DDL，检查表、外键、唯一约束及已有账号查询不受影响。
2. 配置支付宝密钥和身份字段；如需微信同时上线，配置微信 AppID/AppSecret。
3. 部署包含新接口的后端，核对 Swagger 中 `AppUser/MiniProgramLogin` 的请求和响应。
4. 构建并上传支付宝体验版。完成首次授权、取消授权、重复登录、游客升级、退出再授权及刷新令牌真机测试。
5. 检查授权前后的寻迹 `userId`：首次游客升级保持一致，已有平台账号登录返回其关联用户 ID。
6. 在测试环境模拟禁用/注销账号、错误 code、过期 code 和并发首次登录，确认没有重复用户或被绕过的状态检查。
7. 微信侧用实际小程序 `wx.login` 获取 code 验证同一接口，不用静态字符串或其他应用的 code。
8. 更新平台正式隐私政策及发布资料，确认实际只使用身份标识，不声明手机号登录。

服务端没有配置密钥时会明确返回尚未配置完成。先发布后端再发布小程序，避免新入口请求尚不存在的接口。后端回退前核对线上小程序对新接口的依赖；数据库表包含身份映射，应保留，不能通过删表作为回退步骤。

## 8. 验证结果与边界

本次 `pnpm test:mp-alipay` 通过 47 项测试；新增后端 `MiniProgramIdentityTests` 通过 15 项测试；Web API 构建通过。覆盖 RSA2 请求签名/响应验签、篡改/缺失签名拒绝、支付宝旧身份字段显式配置、微信响应检查、字符串 ID、游客令牌验证及小程序授权取消/账号竞争。

测试使用本地模拟平台响应与仓储，不包含真实平台 code 换码、数据库事务的实际执行或真机授权。未执行 DDL、未部署服务，也未提交平台审核。后端构建存在仓库已有依赖版本与安全告警，需按项目依赖维护流程单独处理。

## 9. 官方接口参考

- [支付宝 my.getAuthCode](https://opendocs.alipay.com/mini/api/openapi-authorize)
- [支付宝用户授权](https://opendocs.alipay.com/open/02ailc)
- [微信小程序登录凭证校验](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)

涉及权限范围、应用接入模式与审核要求，以对应 AppID 的当前平台配置和官方文档为准。
