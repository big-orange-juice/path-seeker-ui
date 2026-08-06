import type { H3Event } from 'h3';
import type { ChatSendRequest } from '~~/app/types/chat';
import { ADMIN_AUTH_COOKIE_KEY } from '~~/app/constants/admin-auth';

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

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const backendBaseUrl = config.backendBaseUrl;

  if (!backendBaseUrl) {
    throw createError({
      statusCode: 500,
      message: '服务端未配置 backendBaseUrl。',
    });
  }

  const body = await readBody<ChatSendRequest>(event);
  const sessionId = String(body?.sessionId ?? '').trim();
  const clientMessageId = String(body?.clientMessageId ?? '').trim();
  const message = String(body?.message ?? '').trim();

  if (!sessionId || !clientMessageId || !message) {
    throw createError({
      statusCode: 400,
      message: '对话信息或消息内容不完整，请重试。',
    });
  }

  const authorization = resolveAuthorization(event);
  const lastEventId = getHeader(event, 'last-event-id') || getHeader(event, 'Last-Event-ID');
  const normalizedBaseUrl = backendBaseUrl.endsWith('/') ? backendBaseUrl : `${backendBaseUrl}/`;
  const targetUrl = new URL('Chat/send', normalizedBaseUrl);

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
    body: JSON.stringify({
      sessionId,
      clientMessageId,
      message,
    }),
  });

  if (!upstream.ok) {
    const rawText = await upstream.text();
    let backendMessage = upstream.statusText || 'Chat 流式请求失败';
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
});
