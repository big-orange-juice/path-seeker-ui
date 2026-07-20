import { resolveHttpErrorMessage } from '@path-seeker/ts-shared';
import { useAdminAuthStore } from '@/stores/adminAuth';

const resolveAuthExpiredMessage = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const directCode = record.code;
  const nestedData = record.data && typeof record.data === 'object'
    ? (record.data as Record<string, unknown>)
    : null;
  const candidateCode = nestedData?.code ?? directCode;

  if (candidateCode !== 10002) {
    return '';
  }

  const directMessage = typeof record.message === 'string' ? record.message : '';
  const nestedMessage = typeof nestedData?.message === 'string' ? nestedData.message : '';
  const statusMessage = typeof record.statusMessage === 'string' ? record.statusMessage : '';

  return nestedMessage || directMessage || statusMessage || '未登录或登录已过期，请重新登录';
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
          const message = resolveAuthExpiredMessage(context.response._data);

          if (message) {
            store.openSessionExpiredDialog(message);
          }

          if (typeof options?.onResponseError === 'function') {
            await options.onResponseError(context);
          }
        },
      });
    } catch (error) {
      throw toFriendlyRequestError(error, '请求失败，请稍后重试');
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
