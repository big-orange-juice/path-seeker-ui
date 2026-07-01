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

export const useApiClient = () => {
  const store = useAdminAuthStore();

  const request = <T>(url: string, options?: Parameters<typeof $fetch<T>>[1]) =>
    $fetch<T>(url, {
      ...options,
      async onResponseError(context) {
        const message = resolveAuthExpiredMessage(context.response._data);

        if (message) {
          store.openSessionExpiredDialog(message);
        }
      },
    });

  return {
    request,
  };
};
