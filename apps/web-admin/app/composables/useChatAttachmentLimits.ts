import { computed } from 'vue'

export function useChatAttachmentLimits() {
  const { request } = useApiClient()
  const { data } = useAsyncData('chat-attachment-limits', () =>
    request<{ maxAttachmentsPerMessage: number }>('/api/chat/attachment-limits'))
  const maxAttachments = computed(() => data.value?.maxAttachmentsPerMessage ?? null)
  return { maxAttachments }
}
