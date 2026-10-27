# 支付宝与微信小程序身份登录接入

## 1. 本次实现范围

支付宝原生工程 `apps/mp-alipay` 使用手动支付宝授权登录，AppID 为 `2021007110628321`。要求手机号时，用户先同意隐私说明，再点击“手机号授权登录”。原生按钮配置 `open-type="getAuthorize" scope="phoneNumber"`，在 `onGetAuthorize` 中调用 `my.getPhoneNumber`，随后调用 `my.getAuthCode({ scopes: ['auth_user'] })`。进入页面、恢复会话和游客浏览不会主动调用支付宝授权。要求手机号时，拒绝或缺少手机号授权结果不会消费平台登录 code。

2026-10-28 临时体验配置：前后端均已将 `RequirePhoneNumber` 开关关闭。登录页显示“支付宝授权登录”，仅调用 `my.getAuthCode`，不获取或提交手机号；后端仍校验支付宝授权码、换码响应签名与平台身份，返回 `isGuest=false` 的正式登录会话。普通账号可以输入房间码作为房客收听语音翻译。恢复方法见第 5 节；此开关不会按日期自动恢复。

“手动”指由用户点击发起，平台可复用既有授权，因此不保证每次登录都重新显示授权弹窗；授权界面与用户已授权状态由支付宝控制。

要求手机号时，支付宝客户端提交临时 code 和 `my.getPhoneNumber` 返回的完整签名字符串 `response`，不自行解析或提交明文手机号。后端换取平台身份并校验手机号 RSA2 签名；加密结果先验签再用服务端 AES 密钥解密。手机号用于关联已有业务账号及其车夫权限。关闭手机号开关时，按已验证的支付宝身份复用关联账号、升级游客或创建无手机号正式账号，不按手机号匹配账号；不授予车夫权限，也不修改既有关联账号权限。微信仍按既有 code 登录，不要求手机号。成功后签发原有寻迹 AccessToken、RefreshToken 和字符串 `userId`；不调用支付宝用户资料接口获取昵称或头像。

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

唯一约束分别保证同一平台、AppID、标识类型和用户标识只有一条关联，以及同一寻迹用户在同平台同 AppID 下只有一个关联。支付宝登录按经过验签的手机号匹配 `app_user.phone`，将 `app_user_external_identity.user_id` 指向该业务账号。旧版无手机号、无密码/用户名/邮箱的支付宝账号，可在重新授权时将身份映射关联到已有手机号账号；原账号及其历史保留，不自动迁移。重复手机号、已关联其他支付宝身份、已停用身份、已有手机号不一致等冲突均拒绝自动关联。不会因为手机号授权而修改 `is_driver` 或 `driver_phone`。

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
  "phoneResponse": "my.getPhoneNumber 返回的完整 response 字符串，包含 response、sign 等字段",
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
| `phoneResponse` | 支付宝要求手机号时必填，最多 16384 字符；平台签名结果，服务端验签并验证手机号，不能传明文手机号代替；关闭开关时客户端省略、服务端忽略该字段；微信省略 |
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
2. 服务端向平台换取身份并校验支付宝换码响应签名；要求手机号时额外校验手机号授权结果的 RSA2 签名。
3. 支付宝先按已验证手机号查找业务账号；匹配已有账号时，关联到该 `app_user`，沿用其 `is_driver`、`driver_phone`。旧版无手机号平台身份按上述规则重新关联，不合并游客或旧账号历史。
4. 没有匹配的手机号账号时，已有平台身份继续使用关联账号并补充手机号；首次授权且提供有效游客会话时，事务内检查游客状态后原地升级并添加身份关联，用户 ID 不变。
5. 没有匹配账号、平台身份及游客会话时，创建正式用户并添加平台身份关联。要求手机号时保存已验证手机号；关闭开关时不获取、不写入手机号。微信维持无手机号登录。
6. 签发 `isGuest=false` 的寻迹登录结果。

事务通过 PostgreSQL advisory lock 串行化同一平台身份和手机号的关联，并锁定目标用户行；唯一约束作为额外保护。事务失败会回滚用户创建/升级和身份写入。游客已被其他请求升级时不继续覆盖，也不绑定为另一个正式账号。

取消、拒绝授权或服务端登录失败会保留原会话。支付宝客户端收到游客过期响应后只刷新游客会话并提示再次点击授权，不自动复用一次性 code。退出登录或切换账号后返回的迟到结果不能覆盖当前会话。

被禁用、注销或逻辑删除的关联账号拒绝登录，不借平台登录绕过状态检查；注销后保留身份映射，不自动创建新号或恢复旧号。恢复/重新注册策略需要另行明确后再开放。

## 5. 服务端配置

在后端的私有配置文件、部署环境变量或密钥管理系统中配置，密钥不要写入小程序或提交到仓库。下面仅为占位示例：

```json
{
  "MiniProgramAuth": {
    "Alipay": {
      "AppId": "2021007110628321",
      "PrivateKeyPem": "-----BEGIN PRIVATE KEY-----\n应用私钥正文\n-----END PRIVATE KEY-----",
      "AlipayPublicKeyPem": "-----BEGIN PUBLIC KEY-----\n支付宝公钥正文\n-----END PUBLIC KEY-----",
      "IdentityField": "open_id",
      "RequirePhoneNumber": false,
      "EncryptKey": "开启手机号要求时必填：与开放平台接口内容加密配置一致的 Base64 AES 密钥"
    },
    "Wechat": {
      "AppId": "微信小程序 AppID",
      "AppSecret": "微信小程序 AppSecret"
    }
  }
}
```

对应环境变量名使用双下划线，如 `MiniProgramAuth__Alipay__PrivateKeyPem`、`MiniProgramAuth__Alipay__EncryptKey`、`MiniProgramAuth__Wechat__AppSecret`。

### 临时跳过手机号

- 小程序 `apps/mp-alipay/src/config.js`：`authOptions.requirePhoneNumber: false`，控制是否使用原生手机号授权按钮、调用手机号 API 和提交 `phoneResponse`。
- 后端 `MiniProgramAuth:Alipay:RequirePhoneNumber: false`，环境变量名为 `MiniProgramAuth__Alipay__RequirePhoneNumber`。后端独立控制是否要求和验证手机号，客户端请求不能覆盖此设置。
- 当前两端均已设为 `false`；需部署本次后端并重启 API，同时重新构建或上传小程序。跳过手机号期间不需要 AES 密钥，支付宝 AppID、应用私钥、支付宝公钥及身份校验仍然必需。
- 后续恢复：先补齐 AES 与平台加签配置，将两端开关均改为 `true`，重启 API 并重新构建小程序。两端省略此配置时均默认要求手机号。
- 无手机号的支付宝账号以后可按既有规则关联已有手机号账号；此开关不改变车夫权限检查、不合并账号历史，也不自动授予开房权限。

支付宝配置要求：

- 在正确 AppID 下启用平台要求的用户授权能力，配置与应用私钥配对的应用公钥。
- `PrivateKeyPem` 是本应用的私钥；`AlipayPublicKeyPem` 是支付宝平台公钥，用于响应验签。不要把应用公钥填成支付宝公钥。
- 当前实现为 **RSA2 公钥模式**，使用 PEM 格式私钥与公钥；支持真实换行和配置中转义的 `\n`。证书模式还需要证书序列号及相应验签流程，本次实现未覆盖。
- 默认严格读取返回的 `open_id`。如果该应用使用旧的 `user_id` 接入模式，联调确认后将 `IdentityField` 明确配置为 `user_id`。缺少指定字段时拒绝登录，不隐式回退；已有数据后不要随意切换，避免同一人生成不同关联。
- 当前对支付宝正式网关 `https://openapi.alipay.com/gateway.do` 调用 `alipay.system.oauth.token`，`grant_type=authorization_code`；没有额外拉取用户资料。
- 开启手机号要求时，需在该 AppID 下开通获取会员手机号能力，并同步隐私政策。获取手机号要求配置“接口内容加密方式”为 AES；在后端 `EncryptKey` 或环境变量 `MiniProgramAuth__Alipay__EncryptKey` 中填写同一个 Base64 AES 密钥，采用 AES-CBC、全零 IV 和 PKCS7 填充。密钥仅配置在开放平台和服务端，修改服务端配置后重启 API。
- 在该应用的开发设置中配置“接口加签方式”，并在“应用网关”中核对默认签名类型为 RSA2。`AlipayPublicKeyPem` 用于手机号结果验签。换取身份成功不代表手机号接口的加密、加签配置完整；平台回传 `app_id` 或对应用户标识时额外核对一致性。

### 手机号授权失败排查

`my.getPhoneNumber` 返回的外层 `response` 是包含签名信息的 JSON 字符串；其内部 `response` 可为字符串或对象。服务端按原始内容验签，不重新序列化对象。成功结果必须通过 RSA2 验签；对象形式的平台失败结果只能用于返回错误，不能用于确认手机号或关联账号。

| 现象 | 含义与处理 |
| --- | --- |
| 平台返回 `40001`，内部 `response` 为明文对象 | 核对“接口内容加密方式”及“应用网关”默认签名类型；未配置 AES 或未设置默认签名类型均可能触发该错误 |
| 未返回 `sign` | 核对“接口加签方式”和应用网关默认 RSA2 配置 |
| 签名不匹配 | 核对 AppID、支付宝平台公钥，并确认客户端完整透传 `my.getPhoneNumber` 的 `response` |
| 提示服务端解密尚未配置完成 | 在后端配置与平台一致的 `MiniProgramAuth__Alipay__EncryptKey`，重启 API |
| 平台返回 `40002` / `40003` / `20000` | 分别对应加密配置异常、授权失效、平台繁忙；按提示核对配置、重新授权或稍后重试 |

后端日志仅记录上述错误类别、响应类型及内容长度，不记录完整手机号授权结果、签名或密钥。`MiniProgramLogin` 的 HTTP 响应只含业务错误和 `traceId`，不包含请求中的 `phoneResponse`，不能据此判断平台原始授权结果结构。

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
2. 配置支付宝密钥和身份字段，核对前后端手机号开关一致。开启手机号要求时完成平台 AES 内容加密、接口加签与默认 RSA2 配置，服务端填写对应 AES 密钥；如需微信同时上线，配置微信 AppID/AppSecret。
3. 部署包含新接口的后端，核对 Swagger 中 `AppUser/MiniProgramLogin` 的请求和响应。
4. 构建并上传支付宝体验版。完成首次授权、取消授权、重复登录、游客升级、退出再授权及刷新令牌真机测试。
5. 检查授权前后的寻迹 `userId`：首次游客升级保持一致，已有平台账号登录返回其关联用户 ID。
6. 在测试环境模拟禁用/注销账号、错误 code、过期 code 和并发首次登录，确认没有重复用户或被绕过的状态检查。
7. 微信侧用实际小程序 `wx.login` 获取 code 验证同一接口，不用静态字符串或其他应用的 code。
8. 更新平台正式隐私政策及发布资料，声明手机号用于登录、关联已有账号和识别车夫权限；使用后台已授权手机号验证登录后的 `/TranslationRooms/host-permission` 返回 `canHost=true`，普通用户仍返回 `false`。

服务端没有配置密钥时会明确返回尚未配置完成。先发布后端再发布小程序，避免新入口请求尚不存在的接口。后端回退前核对线上小程序对新接口的依赖；数据库表包含身份映射，应保留，不能通过删表作为回退步骤。

## 8. 验证结果与边界

2026-10-28 验证：`pnpm test:mp-alipay` 通过 136 项测试；后端筛选 `MiniProgram`、`AppUserDriver` 与 `TranslationRoom` 通过 80 项测试；Web API 构建通过。新增覆盖跳过手机号后仍校验平台身份、正式登录与房客入房、授权取消与迟到结果隔离、恢复手机号要求、无手机号身份复用且不匹配车夫手机号账号。原有覆盖包括手机号字符串/原始对象/加密结果验签、篡改/缺失签名拒绝、两种签名类型字段、平台配置错误及缺少服务端 AES 的提示、已有车夫账号关联、旧版无手机号身份重新关联、身份冲突拒绝、微信与游客兼容、字符串 ID、授权取消及账号竞争。播放器另覆盖下一句预加载、预加载失败回退、暂停接句、超过 240 句收听清理及重复页面刷新抑制。

测试使用本地模拟平台响应与仓储，不包含真实平台 code 换码、数据库事务的实际执行或真机授权。未执行 DDL、未部署服务，也未提交平台审核。后端构建存在仓库已有依赖版本与安全告警，需按项目依赖维护流程单独处理。

## 9. 官方接口参考

- [支付宝 my.getAuthCode](https://opendocs.alipay.com/mini/api/openapi-authorize)
- [支付宝 my.getPhoneNumber](https://opendocs.alipay.com/mini/api/getphonenumber)
- [支付宝接口内容加密](https://opendocs.alipay.com/common/02mse3)
- [支付宝应用网关](https://opendocs.alipay.com/common/02qibh)
- [支付宝用户授权](https://opendocs.alipay.com/open/02ailc)
- [微信小程序登录凭证校验](https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html)

涉及权限范围、应用接入模式与审核要求，以对应 AppID 的当前平台配置和官方文档为准。
