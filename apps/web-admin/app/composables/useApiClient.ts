import { resolveHttpErrorMessage } from '@path-seeker/ts-shared';
import { useAdminAuthStore } from '@/stores/adminAuth';

const DEFAULT_AUTH_EXPIRED_MESSAGE = '未登录或登录已过期，请重新登录';

const pickAuthExpiredMessage = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const nestedData = record.data && typeof record.data === 'object'
    ? (record.data as Record<string, unknown>)
    : null;
  const directMessage = typeof record.message === 'string' ? record.message.trim() : '';
  const nestedMessage = typeof nestedData?.message === 'string' ? nestedData.message.trim() : '';
  const statusMessage = typeof record.statusMessage === 'string' ? record.statusMessage.trim() : '';

  return nestedMessage || directMessage || statusMessage;
};

/** 识别 10002 业务码或 HTTP 401，返回过期文案；非过期返回空串 */
const resolveAuthExpiredMessage = (payload: unknown, statusCode?: number) => {
  if (statusCode === 401) {
    return pickAuthExpiredMessage(payload) || DEFAULT_AUTH_EXPIRED_MESSAGE;
  }

  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const nestedData = record.data && typeof record.data === 'object'
    ? (record.data as Record<string, unknown>)
    : null;
  const candidateCode = nestedData?.code ?? record.code;

  if (candidateCode !== 10002) {
    return '';
  }

  return pickAuthExpiredMessage(payload) || DEFAULT_AUTH_EXPIRED_MESSAGE;
};

/**
 * 将 $fetch / ofetch 错误归一为带友好文案的 Error，
 * 同时保留 statusCode / data，便于上层按需读取。
 */
const toFriendlyRequestError = (error: unknown, fallback: string) => {
  const message = resolveHttpErrorMessage(error, fallback);
  const friendly = new Error(message) as Error & {
    statusCode?: number;
    statusMessage?: string;
    data?: unknown;
    cause?: unknown;
  };

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    if (typeof record.statusCode === 'number') {
      friendly.statusCode = record.statusCode;
    }
    if (typeof record.statusMessage === 'string') {
      friendly.statusMessage = record.statusMessage;
    }
    if ('data' in record) {
      friendly.data = record.data;
    }
  }

  friendly.cause = error;
  return friendly;
};

export const useApiClient = () => {
  const store = useAdminAuthStore();

  const request = async <T>(
    url: string,
    options?: Parameters<typeof $fetch<T>>[1],
  ): Promise<T> => {
    try {
      return await $fetch<T>(url, {
        ...options,
        async onResponseError(context) {
          const message = resolveAuthExpiredMessage(
            context.response._data,
            context.response.status,
          );

          if (message) {
            store.openSessionExpiredDialog(message);
          }

          if (typeof options?.onResponseError === 'function') {
            await options.onResponseError(context);
          }
        },
      });
    } catch (error) {
      const friendly = toFriendlyRequestError(error, '请求失败，请稍后重试');
      const message = resolveAuthExpiredMessage(friendly.data, friendly.statusCode);
      if (message) {
        store.openSessionExpiredDialog(message);
      }
      throw friendly;
    }
  };

  return {
    request,
  };
};

/** 页面 catch 中统一解析错误文案（兼容未走 useApiClient 的错误） */
export const resolveApiErrorMessage = (
  error: unknown,
  fallback = '请求失败，请稍后重试',
) => resolveHttpErrorMessage(error, fallback);
