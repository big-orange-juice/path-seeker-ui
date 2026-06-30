import { useApiClient } from '@/composables/useApiClient';
import type { UploadAttachment, UploadTarget } from '@/types/upload';

const uploadEndpointMap: Record<UploadTarget, string> = {
  image: '/api/uploads/image',
  file: '/api/uploads/file',
};

export const useUploadAttachment = () => {
  const { request } = useApiClient();

  const uploadAttachment = async (file: File, target: UploadTarget) => {
    const formData = new FormData();
    formData.append('file', file);

    return request<UploadAttachment>(uploadEndpointMap[target], {
      method: 'POST',
      body: formData,
    });
  };

  return {
    uploadAttachment,
  };
};
