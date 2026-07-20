import type { H3Event } from 'h3';
import {
  isTechnicalHttpMessage,
  resolveHttpStatusMessage,
} from '@path-seeker/ts-shared';
import { ADMIN_AUTH_COOKIE_KEY } from '~~/app/constants/admin-auth';

type BackendQueryValue = string | number | boolean | null | undefined;
type BackendJsonBody = object;
const ADMIN_AUTH_STORE_COOKIE_KEY = 'admin-auth';

interface BackendRequestOptions extends Omit<RequestInit, 'headers' | 'body'> {
  headers?: HeadersInit;
  query?: Record<string, BackendQueryValue>;
  body?: BodyInit | BackendJsonBody | null;
}

interface BackendErrorPayload {
  code?: number;
  message?: string | null;
  traceId?: string | null;
  [key: string]: unknown;
}

const resolveBackendErrorMessage = (
  payloadMessage: string | null | undefined,
  statusCode: number,
) => {
  const businessMessage = String(payloadMessage ?? '').trim();
  if (businessMessage && !isTechnicalHttpMessage(businessMessage)) {
    return businessMessage;
  }

  return resolveHttpStatusMessage(statusCode);
};

const createBackendBusinessError = (payload: BackendErrorPayload, fallbackStatusCode = 500) => {
  const statusCode = payload.code === 10002 ? 401 : fallbackStatusCode;
  const message = resolveBackendErrorMessage(payload.message, statusCode);

  return createError({
    statusCode,
    // h3：长文案用 message，勿用 statusMessage（会被当成 HTTP reason phrase）
    message,
    data: {
      code: payload.code,
      message: payload.message ?? message,
      traceId: payload.traceId,
    },
  });
};
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

const resolveCookieAuthorization = (event: H3Event) => {
  const directToken = getCookie(event, ADMIN_AUTH_COOKIE_KEY);
  const persistedToken = parsePersistedToken(getCookie(event, ADMIN_AUTH_STORE_COOKIE_KEY));

  return normalizeAuthorization(directToken || persistedToken);
};

const buildBackendUrl = (baseUrl: string, path: string, query?: BackendRequestOptions['query']) => {
  const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const url = new URL(normalizedPath, normalizedBaseUrl);

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined || value === '') {
      continue;
    }

    url.searchParams.set(key, String(value));
  }

  return url;
};

const parseBackendResponse = (rawText: string) => {
  if (!rawText) {
    return null;
  }

  try {
    return JSON.parse(rawText) as BackendErrorPayload;
  } catch {
    return rawText;
  }
};

const isBodyInitLike = (value: unknown): value is BodyInit => {
  return value instanceof Blob
    || value instanceof FormData
    || value instanceof URLSearchParams
    || value instanceof ArrayBuffer
    || ArrayBuffer.isView(value)
    || value instanceof ReadableStream
    || typeof value === 'string';
};

const normalizeRequestBody = (body: BackendRequestOptions['body']) => {
  if (body === null || body === undefined) {
    return { body: undefined, headers: {} as HeadersInit };
  }

  if (isBodyInitLike(body)) {
    return { body, headers: {} as HeadersInit };
  }

  return {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' } as HeadersInit,
  };
};

const toSerializableValue = (value: unknown): unknown => {
  if (value instanceof File) {
    return {
      name: value.name,
      type: value.type,
      size: value.size,
    };
  }

  if (value instanceof Blob) {
    return {
      type: value.type,
      size: value.size,
    };
  }

  if (value instanceof URLSearchParams) {
    return Object.fromEntries(value.entries());
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => toSerializableValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, toSerializableValue(item)])
    );
  }

  return value;
};

const maskAuthorization = (value: string) => {
  const normalized = String(value).trim();

  if (!normalized) {
    return normalized;
  }

  const [scheme, token = ''] = normalized.split(/\s+/, 2);

  if (!token) {
    return normalized;
  }

  if (token.length <= 12) {
    return `${scheme} ${token.slice(0, 3)}***${token.slice(-2)}`;
  }

  return `${scheme} ${token.slice(0, 6)}...${token.slice(-4)}`;
};

const serializeHeaders = (headers: HeadersInit) => {
  const resolved = headers instanceof Headers
    ? Object.fromEntries(headers.entries())
    : Array.isArray(headers)
      ? Object.fromEntries(headers)
      : headers;

  const nextHeaders = { ...(resolved as Record<string, unknown>) };
  const authorization = typeof nextHeaders.authorization === 'string' ? nextHeaders.authorization : '';

  if (authorization) {
    nextHeaders.authorization = maskAuthorization(authorization);
  }

  return nextHeaders;
};

const serializeParams = (
  query: BackendRequestOptions['query'],
  body: BackendRequestOptions['body']
) => {
  if (body instanceof FormData) {
    return {
      query: query ?? {},
      body: Object.fromEntries(
        Array.from(body.entries()).map(([key, value]) => [key, toSerializableValue(value)])
      ),
    };
  }

  return {
    query: query ?? {},
    body: toSerializableValue(body ?? null),
  };
};

const formatLogValue = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2) ?? 'null';
  } catch {
    return String(value);
  }
};

const createLogSection = (label: string, value: unknown, isLast = false) => {
  const marker = isLast ? '└' : '├';
  const lines = formatLogValue(value).split('\n');

  return [
    `${marker}─ ${label}: ${lines[0] ?? ''}`,
    ...lines.slice(1).map((line) => `│  ${line}`),
  ];
};

const logBackendRequest = (payload: {
  targetUrl: string;
  method: string;
  headers: HeadersInit;
  params: unknown;
}) => {
  const lines = [
    '┌─ [backend-request]',
    `├─ method: ${payload.method}`,
    `├─ url: ${payload.targetUrl}`,
    ...createLogSection('headers', serializeHeaders(payload.headers)),
    ...createLogSection('params', payload.params, true),
  ];

  console.info(lines.join('\n'));
};

const logBackendResponse = (payload: {
  targetUrl: string;
  method: string;
  status: number;
  statusText: string;
  ok: boolean;
  headers: HeadersInit;
  body: unknown;
}) => {
  const lines = [
    `┌─ [backend-response] ${payload.ok ? 'OK' : 'ERROR'}`,
    `├─ method: ${payload.method}`,
    `├─ url: ${payload.targetUrl}`,
    `├─ status: ${payload.status}${payload.statusText ? ` ${payload.statusText}` : ''}`,
    ...createLogSection('headers', serializeHeaders(payload.headers)),
    ...createLogSection('body', toSerializableValue(payload.body), true),
  ];

  console.info(lines.join('\n'));
};

const resolveRequestAuthorization = (event: H3Event, headers: Record<string, string>) => {
  const headerAuthorization = normalizeAuthorization(headers.authorization);
  // GET / POST 等统一：优先请求头，否则回落 cookie（与前端同源代理一致）
  return headerAuthorization || resolveCookieAuthorization(event);
};

export const backendFetch = async <T>(
  event: H3Event,
  path: string,
  options: BackendRequestOptions = {}
): Promise<T> => {
  const config = useRuntimeConfig(event);
  const backendBaseUrl = config.backendBaseUrl;

  if (!backendBaseUrl) {
    throw createError({
      statusCode: 500,
      message: '服务端未配置 backendBaseUrl。',
      data: { path },
    });
  }

  const { query, headers: optionHeaders, body: rawBody, ...requestOptions } = options;
  const normalizedBody = normalizeRequestBody(rawBody);
  const url = buildBackendUrl(backendBaseUrl, path, query);
  const method = String(requestOptions.method || 'GET').toUpperCase();
  const headers: Record<string, string> = {
    accept: 'application/json',
    ...((event.context.backendHeaders as Record<string, string> | undefined) ?? {}),
    ...((optionHeaders as Record<string, string> | undefined) ?? {}),
    ...((normalizedBody.headers as Record<string, string> | undefined) ?? {}),
  };
  const authorization = resolveRequestAuthorization(event, headers);

  if (authorization) {
    headers.authorization = authorization;
  }

  logBackendRequest({
    targetUrl: url.toString(),
    method,
    headers,
    params: serializeParams(query, rawBody),
  });

  const response = await fetch(url, {
    ...requestOptions,
    method,
    body: normalizedBody.body,
    headers,
  });

  const rawText = await response.text();
  const backendResponse = parseBackendResponse(rawText);

  logBackendResponse({
    targetUrl: url.toString(),
    method,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: response.headers,
    body: backendResponse,
  });

  if (!response.ok) {
    const backendMessage =
      typeof backendResponse === 'object' && backendResponse
        ? (backendResponse as BackendErrorPayload).message
        : null;
    const backendCode =
      typeof backendResponse === 'object' && backendResponse
        ? (backendResponse as BackendErrorPayload).code
        : undefined;
    const backendTraceId =
      typeof backendResponse === 'object' && backendResponse
        ? (backendResponse as BackendErrorPayload).traceId
        : undefined;

    const statusCode = backendCode === 10002 ? 401 : response.status;
    const message = resolveBackendErrorMessage(backendMessage, statusCode);

    throw createError({
      statusCode,
      message,
      data: {
        path,
        code: backendCode,
        message: backendMessage || message,
        traceId: backendTraceId,
        backendStatus: response.status,
        backendStatusText: response.statusText,
        backendResponse,
      },
    });
  }

  return backendResponse as T;
};

export const unwrapApiResponse = <T>(response: {
  code: number;
  message: string | null;
  traceId: string | null;
  data?: T | null;
}) => {
  if (response.code !== 0) {
    throw createBackendBusinessError(response);
  }

  return response.data ?? null;
};
