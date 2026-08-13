import { computed, onBeforeUnmount, reactive, shallowRef, watch } from 'vue'
import { useApiClient } from '@/composables/useApiClient'
import type {
  AffectedNarration,
  PronunciationBatch,
  PronunciationEntry,
  PronunciationEntryDraft,
  PronunciationGenerationDraft,
  PronunciationPage,
  RegenerationResult,
} from '@/types/tts-pronunciation'
import type { ApiResponse } from '@/types/api'

const unwrap = <T>(response: ApiResponse<T>) => response.data as T

export const usePronunciationManagement = () => {
  const { request } = useApiClient()
  const activeTab = shallowRef<'batches' | 'entries' | 'stale'>('entries')
  const pending = shallowRef(false)
  const error = shallowRef<Error | null>(null)
  const batches = shallowRef<PronunciationBatch[]>([])
  const entries = shallowRef<PronunciationEntry[]>([])
  const staleItems = shallowRef<AffectedNarration[]>([])
  const total = shallowRef(0)
  const selectedIds = shallowRef<string[]>([])
  const pageIndex = shallowRef(1)
  const pageSize = shallowRef(20)
  const filters = reactive({ scopeType: 0, museumId: '', guideId: '', batchId: '', status: -1, sourceType: '', keyword: '', routeId: '' })
  let requestVersion = 0

  const query = computed(() => ({
    ScopeType: filters.scopeType || undefined,
    MuseumId: filters.museumId.trim() || undefined,
    GuideId: filters.guideId.trim() || undefined,
    BatchId: filters.batchId.trim() || undefined,
    Status: filters.status >= 0 ? filters.status : undefined,
    SourceType: filters.sourceType.trim() || undefined,
    Keyword: filters.keyword.trim() || undefined,
    RouteId: filters.routeId.trim() || undefined,
    PageIndex: pageIndex.value,
    PageSize: pageSize.value,
  }))

  const refresh = async (silent = false) => {
    const currentVersion = ++requestVersion
    const currentTab = activeTab.value
    const currentQuery = { ...query.value }
    if (!silent) pending.value = true
    error.value = null
    try {
      const endpoint = currentTab === 'batches'
        ? '/api/tts-pronunciation/generation-batches'
        : currentTab === 'entries'
          ? '/api/tts-pronunciation/entries'
          : '/api/tts-pronunciation/stale-audio'
      const response = await request<ApiResponse<PronunciationPage<PronunciationBatch | PronunciationEntry | AffectedNarration>>>(endpoint, { query: currentQuery })
      if (currentVersion !== requestVersion) return
      const page = unwrap(response) ?? { items: [], total: 0 }
      total.value = page.total ?? 0
      if (currentTab === 'batches') batches.value = (page.items ?? []) as PronunciationBatch[]
      if (currentTab === 'entries') entries.value = (page.items ?? []) as PronunciationEntry[]
      if (currentTab === 'stale') staleItems.value = (page.items ?? []) as AffectedNarration[]
      selectedIds.value = []
    } catch (caught) {
      if (currentVersion !== requestVersion) return
      error.value = caught instanceof Error ? caught : new Error('数据加载失败。')
    } finally {
      if (!silent && currentVersion === requestVersion) pending.value = false
    }
  }

  let pollingTimer: ReturnType<typeof setInterval> | undefined
  const syncPolling = () => {
    if (pollingTimer) clearInterval(pollingTimer)
    pollingTimer = undefined
    if (activeTab.value === 'batches' && batches.value.some((item) => item.status === 0 || item.status === 1)) {
      pollingTimer = setInterval(() => {
        if (!pending.value) void refresh(true)
      }, 3000)
    }
  }

  watch([activeTab, pageIndex, pageSize], () => void refresh(), { immediate: true })
  watch(batches, syncPolling)
  onBeforeUnmount(() => pollingTimer && clearInterval(pollingTimer))

  const runAction = async (path: string, method: 'POST' | 'PUT' = 'POST', body?: object) => {
    const response = await request<ApiResponse<unknown>>(path, { method, body })
    await refresh()
    return response.data
  }

  return {
    activeTab, pending, error, batches, entries, staleItems, total, selectedIds, pageIndex, pageSize, filters,
    totalPages: computed(() => Math.ceil(total.value / pageSize.value)),
    refresh,
    resetFilters: () => Object.assign(filters, { scopeType: 0, museumId: '', guideId: '', batchId: '', status: -1, sourceType: '', keyword: '', routeId: '' }),
    saveEntry: (draft: PronunciationEntryDraft, id?: string) => runAction(id ? `/api/tts-pronunciation/entries/${id}` : '/api/tts-pronunciation/entries', id ? 'PUT' : 'POST', {
      ...draft, museumId: draft.scopeType === 2 ? draft.museumId.trim() || null : null,
      phrase: draft.phrase.trim(), pronunciation: draft.pronunciation.trim(), category: draft.category.trim() || null, remark: draft.remark.trim() || null,
    }),
    createBatch: (draft: PronunciationGenerationDraft) => runAction('/api/tts-pronunciation/generation-batches', 'POST', {
      scopeType: draft.scopeType,
      museumId: draft.scopeType === 2 ? draft.museumId.trim() || null : null,
      sourceType: draft.sourceType,
      guideId: draft.guideId.trim() || null,
      materialIds: draft.materialIds.split(/[\s,，]+/).map((item) => item.trim()).filter(Boolean),
      includeNarrations: draft.includeNarrations,
      text: draft.text.trim() || null,
      clientRequestId: crypto.randomUUID(),
    }),
    getEntryVersions: async (id: string) => unwrap(await request<ApiResponse<PronunciationEntry[]>>(`/api/tts-pronunciation/entries/${id}/versions`)) ?? [],
    getAffectedNarrations: async (id: string) => unwrap(await request<ApiResponse<AffectedNarration[]>>(`/api/tts-pronunciation/entries/${id}/affected-narrations`)) ?? [],
    publishEntry: (id: string) => runAction(`/api/tts-pronunciation/entries/${id}/publish`),
    rejectEntry: (id: string) => runAction(`/api/tts-pronunciation/entries/${id}/reject`),
    disableEntry: (id: string) => runAction(`/api/tts-pronunciation/entries/${id}/disable`),
    copyToGlobal: (id: string) => runAction(`/api/tts-pronunciation/entries/${id}/copy-to-global`),
    publishBatch: (id: string, entryIds: string[]) => runAction(`/api/tts-pronunciation/generation-batches/${id}/publish`, 'POST', { entryIds, clientRequestId: crypto.randomUUID() }),
    retryBatch: (id: string) => runAction(`/api/tts-pronunciation/generation-batches/${id}/retry`, 'POST', { clientRequestId: crypto.randomUUID() }),
    cancelBatch: (id: string) => runAction(`/api/tts-pronunciation/generation-batches/${id}/cancel`),
    regenerate: async (stageIds: string[]) => unwrap(await request<ApiResponse<RegenerationResult>>('/api/tts-pronunciation/stale-audio/regenerate', { method: 'POST', body: { stageIds } })),
  }
}
