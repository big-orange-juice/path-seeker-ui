# H5 问一问 · MiniMax TTS 反向代理

> 适用范围：`apps/h5-client` 语音模式（MiniMax T2A）  
> 相关代码：`src/services/minimaxTts.ts`、`vite.config.ts` 中 `/minimax-tts` 代理

## 背景

语音合成默认请求同源路径：

```http
POST /minimax-tts/v1/t2a_v2
```

| 环境 | 谁处理该路径 | 说明 |
| --- | --- | --- |
| 本地 `pnpm dev:h5-client` | Vite dev server | `vite.config.ts` 已代理到 `https://api.minimaxi.com` |
| 本地 `vite preview` | Vite preview | 同上 |
| **生产静态部署**（nginx 等） | **必须自行配置反代** | 未配置时常见 `POST …/minimax-tts/…` → **405 Not Allowed** |

浏览器不能稳定直连 MiniMax（CORS）；生产也**不要**把 `VITE_MINIMAX_TTS_BASE_URL` 设成 `https://api.minimaxi.com` 指望前端直连。

## 环境变量

见 `apps/h5-client/.env.example`：

| 变量 | 说明 |
| --- | --- |
| `VITE_MINIMAX_API_KEY` | MiniMax API Key（当前会打进前端包，仅适合内测） |
| `VITE_MINIMAX_TTS_BASE_URL` | 留空则走同源 `/minimax-tts`；一般生产也留空，靠 nginx 转发 |
| `VITE_MINIMAX_TTS_MODEL` | 默认 `speech-2.8-turbo` |
| `VITE_MINIMAX_TTS_VOICE_ID` | 默认 `male-qn-qingse` |

## 生产 Nginx 配置

在托管 H5 静态资源的 `server` 块中增加（与 Vite 代理语义一致：`/minimax-tts` → `https://api.minimaxi.com`，去掉前缀）：

```nginx
# MiniMax T2A：浏览器 POST /minimax-tts/v1/t2a_v2
# → https://api.minimaxi.com/v1/t2a_v2
location /minimax-tts/ {
    proxy_pass https://api.minimaxi.com/;
    proxy_ssl_server_name on;
    proxy_set_header Host api.minimaxi.com;
    proxy_set_header Authorization $http_authorization;
    proxy_set_header Content-Type $http_content_type;
    proxy_http_version 1.1;
    # TTS 响应可能较大，按需放宽
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    client_max_body_size 2m;
}
```

完整示例（静态站 + TTS 反代）：

```nginx
server {
    listen 8101;
    server_name _;

    root /path/to/h5-client/dist;
    index index.html;

    # SPA history fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    location /minimax-tts/ {
        proxy_pass https://api.minimaxi.com/;
        proxy_ssl_server_name on;
        proxy_set_header Host api.minimaxi.com;
        proxy_set_header Authorization $http_authorization;
        proxy_set_header Content-Type $http_content_type;
        proxy_http_version 1.1;
        proxy_read_timeout 120s;
        proxy_send_timeout 120s;
        client_max_body_size 2m;
    }
}
```

修改后执行：

```bash
nginx -t && nginx -s reload
```

### 期望链路

```text
浏览器
  → POST http://<host>:<port>/minimax-tts/v1/t2a_v2
  → nginx 转发
  → POST https://api.minimaxi.com/v1/t2a_v2
```

### 故障对照

| 现象 | 常见原因 |
| --- | --- |
| `405 Not Allowed` | 静态站未配置 `/minimax-tts/` 反代，POST 打到了静态文件服务 |
| `502` / `504` | 出网访问 `api.minimaxi.com` 失败，或超时过短 |
| CORS 报错且 URL 已是 minimaxi 域名 | 误配了前端直连 base URL，应改回同源 + 反代 |
| 业务错误码 / `未配置 API Key` | 构建时未注入 `VITE_MINIMAX_API_KEY` |

## 安全说明

- 当前为 **浏览器携带 Key + 网关转发**，Key 会出现在前端构建产物中，**仅适合内测**。
- 正式环境应改为 **服务端代理 TTS**，Key 只放在服务端，前端只调自家 API。
