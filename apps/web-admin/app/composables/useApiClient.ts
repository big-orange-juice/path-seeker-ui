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

/**
 * 文件上传进度回调（0-100）。
 * 仅表示浏览器已把数据交给网络层，不代表服务端已落盘或解析完成。
 */
export type UploadProgressHandler = (percentage: number) => void;

/** 从 ofetch 的 progress 事件解析百分比；total 未知时返回 null 表示无法计算 */
const resolveUploadPercentage = (lengthComputable: boolean, loaded: number, total: number) => {
  if (!lengthComputable || !Number.isFinite(total) || total <= 0) {
    return null;
  }

  return Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
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

  /**
   * 带进度的文件上传。用于典藏导入等大文件场景，
   * 其余请求继续走 request，避免把进度逻辑散落到业务代码里。
   *
   * 说明：当前依赖的 ofetch 版本在 FetchOptions 类型里没有声明 onUploadProgress，
   * 运行时仍会透传给底层 fetch，因此这里做一次显式收窄断言；
   * 拿不到进度事件时回调不会被触发，调用方应把进度显示当作可选增强（而非唯一反馈）。
   */
  const upload = async <T>(
    url: string,
    formData: FormData,
    onProgress?: UploadProgressHandler,
  ): Promise<T> => await request<T>(url, {
    method: 'POST',
    body: formData,
    onRequest({ options: requestOptions }) {
      const target = requestOptions as unknown as Record<string, unknown>;
      target.onUploadProgress = (event: { lengthComputable?: boolean; loaded?: number; total?: number }) => {
        const percentage = resolveUploadPercentage(
          Boolean(event.lengthComputable),
          Number(event.loaded ?? 0),
          Number(event.total ?? 0),
        );
        if (percentage !== null) {
          onProgress?.(percentage);
        }
      };
    },
  });

  return {
    request,
    upload,
  };
};

/** 页面 catch 中统一解析错误文案（兼容未走 useApiClient 的错误） */
export const resolveApiErrorMessage = (
  error: unknown,
  fallback = '请求失败，请稍后重试',
) => resolveHttpErrorMessage(error, fallback);

/**
 * 识别服务端代理返回的"后端接口尚未实现"标记。
 *
 * 典藏导入与平台助手在写前端时后端控制器可能还没落地（当前仓库只有
 * ICollectionImportService / ICollectionSearchService 契约，没有对应 Controller），
 * 这时 Nuxt 代理会返回 501 + data.reason = 'backend_endpoint_missing'，
 * 页面据此给出明确提示而不是笼统的"请求失败"。
 */
export const BACKEND_ENDPOINT_MISSING_REASON = 'backend_endpoint_missing';

export interface ApiErrorPayload {
  statusCode?: number;
  statusMessage?: string;
  data?: unknown;
  message?: string;
}

export const isBackendEndpointMissing = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const record = error as ApiErrorPayload & { cause?: unknown };
  const candidates: unknown[] = [record.data, (record.cause as ApiErrorPayload | undefined)?.data];

  return candidates.some((candidate) => {
    if (!candidate || typeof candidate !== 'object') {
      return false;
    }
    const data = candidate as Record<string, unknown>;
    return data.reason === BACKEND_ENDPOINT_MISSING_REASON;
  });
};
