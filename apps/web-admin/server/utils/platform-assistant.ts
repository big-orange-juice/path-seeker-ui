import type { H3Event } from 'h3';
import { ADMIN_AUTH_COOKIE_KEY } from '~~/app/constants/admin-auth';

/**
 * 平台助手 SSE 透传。
 *
 * 与 server/api/chat/send.post.ts 同一写法（鉴权头、Last-Event-ID、错误归一、sendStream）：
 * 平台助手 /send 的事件格式与 B 端 Chat 完全一致（后端复用同一条 ChatSessionService 事件管道），
 * 因此这里不另发明协议，只是把目标路径参数化以便复用。
 */
const ADMIN_AUTH_STORE_COOKIE_KEY = 'admin-auth';

const normalizeAuthorization = (value: string | null | undefined) => {
  const token = String(value ?? '').trim();

  if (!token) {
    return '';
  }

  return /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
};

const parsePersistedToken = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return '';
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { token?: unknown };
    return typeof parsed.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
};

const resolveAuthorization = (event: H3Event) => {
  const headerAuthorization = normalizeAuthorization(getHeader(event, 'authorization'));
  const directToken = getCookie(event, ADMIN_AUTH_COOKIE_KEY);
  const persistedToken = parsePersistedToken(getCookie(event, ADMIN_AUTH_STORE_COOKIE_KEY));
  const cookieAuthorization = normalizeAuthorization(directToken || persistedToken);

  return headerAuthorization || cookieAuthorization;
};

/**
 * 把一段 POST 请求以 SSE 形式透传给后端（`path` 不含 /api 前缀，base 已含）。
 */
export const proxyBackendSse = async (event: H3Event, path: string, body: unknown) => {
  const config = useRuntimeConfig(event);
  const backendBaseUrl = String(config.backendBaseUrl ?? '').trim();

  if (!backendBaseUrl) {
    throw createError({
      statusCode: 500,
      message: '服务端未配置 backendBaseUrl。',
    });
  }

  const authorization = resolveAuthorization(event);
  const lastEventId = getHeader(event, 'last-event-id') || getHeader(event, 'Last-Event-ID');
  const normalizedBaseUrl = backendBaseUrl.endsWith('/') ? backendBaseUrl : `${backendBaseUrl}/`;
  const targetUrl = new URL(String(path).replace(/^\//, ''), normalizedBaseUrl);

  const headers: Record<string, string> = {
    accept: 'text/event-stream',
    'content-type': 'application/json',
  };

  if (authorization) {
    headers.authorization = authorization;
  }

  if (lastEventId) {
    headers['Last-Event-ID'] = lastEventId;
  }

  const upstream = await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });

  if (!upstream.ok) {
    const rawText = await upstream.text();
    let backendMessage = upstream.statusText || '平台助手流式请求失败';
    let backendCode: number | undefined;
    let backendTraceId: string | undefined;

    try {
      const parsed = JSON.parse(rawText) as {
        code?: number;
        message?: string | null;
        traceId?: string | null;
      };
      backendMessage = parsed.message || backendMessage;
      backendCode = parsed.code;
      backendTraceId = parsed.traceId ?? undefined;
    } catch {
      if (rawText.trim()) {
        backendMessage = rawText.trim().slice(0, 300);
      }
    }

    throw createError({
      statusCode: backendCode === 10002 ? 401 : upstream.status,
      message: backendMessage,
      data: {
        path,
        code: backendCode,
        message: backendMessage,
        traceId: backendTraceId,
      },
    });
  }

  if (!upstream.body) {
    throw createError({
      statusCode: 502,
      message: '上游未返回可读的事件流。',
    });
  }

  setResponseStatus(event, 200);
  setResponseHeader(event, 'Content-Type', 'text/event-stream; charset=utf-8');
  setResponseHeader(event, 'Cache-Control', 'no-cache, no-transform');
  setResponseHeader(event, 'Connection', 'keep-alive');
  setResponseHeader(event, 'X-Accel-Buffering', 'no');

  return sendStream(event, upstream.body);
};
