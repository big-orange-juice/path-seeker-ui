import { onBeforeUnmount, shallowRef, watch, type MaybeRefOrGetter, toValue } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import type { CulturalPlaceDraft, CulturalPlaceRecord } from '@/types/cultural-place';

export function useCulturalPlaces(museumId: MaybeRefOrGetter<string | undefined>) {
  const { request } = useApiClient();
  const records = shallowRef<CulturalPlaceRecord[]>([]);
  const pending = shallowRef(false);
  const error = shallowRef('');
  let version = 0;

  async function refresh() {
    const current = ++version;
    const id = toValue(museumId);
    records.value = [];
    error.value = '';
    if (!id) { pending.value = false; return; }
    pending.value = true;
    try {
      const result = await request<CulturalPlaceRecord[]>('/api/cultural-place/list', { query: { museumId: id } });
      if (current === version) records.value = result;
    } catch (caught) { if (current === version) error.value = caught instanceof Error ? caught.message : '文化点加载失败。'; }
    finally { if (current === version) pending.value = false; }
  }

  async function save(draft: CulturalPlaceDraft) {
    await request(draft.id ? '/api/cultural-place/update' : '/api/cultural-place/create', { method: 'POST', body: draft });
    await refresh();
  }

  async function remove(id: string) {
    await request('/api/cultural-place/delete', { method: 'POST', body: { id } });
    await refresh();
  }

  watch(() => toValue(museumId), () => void refresh(), { immediate: true });
  onBeforeUnmount(() => { version += 1; });
  return { records, pending, error, refresh, save, remove };
}
