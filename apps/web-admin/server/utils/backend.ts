import type { H3Event } from 'h3';

type BackendQueryValue = string | number | boolean | null | undefined;
type BackendJsonBody = object;

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

const createBackendBusinessError = (payload: BackendErrorPayload, fallbackStatusCode = 500) =>
  createError({
    statusCode: payload.code === 10002 ? 401 : fallbackStatusCode,
    statusMessage: payload.message || (payload.code === 10002 ? '未登录或登录已过期，请重新登录' : '后端业务处理失败。'),
    data: {
      code: payload.code,
      message: payload.message,
      traceId: payload.traceId,
    },
  });

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
      statusMessage: '服务端未配置 backendBaseUrl。',
      data: { path },
    });
  }

  const { query, headers: optionHeaders, body: rawBody, ...requestOptions } = options;
  const normalizedBody = normalizeRequestBody(rawBody);
  const url = buildBackendUrl(backendBaseUrl, path, query);
  const response = await fetch(url, {
    ...requestOptions,
    body: normalizedBody.body,
    headers: {
      accept: 'application/json',
      ...event.context.backendHeaders,
      ...normalizedBody.headers,
      ...optionHeaders,
    },
  });

  const rawText = await response.text();
  const backendResponse = parseBackendResponse(rawText);

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

    throw createError({
      statusCode: backendCode === 10002 ? 401 : response.status,
      statusMessage: backendMessage || response.statusText || 'Backend request failed',
      data: {
        path,
        code: backendCode,
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
