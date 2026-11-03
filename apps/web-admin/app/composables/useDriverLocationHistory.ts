import { computed, onBeforeUnmount, onMounted, shallowRef, watch, type Ref } from 'vue';
import { resolveApiErrorMessage, useApiClient } from '@/composables/useApiClient';
import type { DriverLocation, DriverLocationHistory, DriverLocationRecord } from '@/types/driver-location';

export function useDriverLocationHistory(selected: Readonly<Ref<DriverLocation | undefined>>, getServerTime = Date.now) {
  const { request } = useApiClient();
  const records = shallowRef<DriverLocationRecord[]>([]);
  const pending = shallowRef(false);
  const error = shallowRef('');
  const windowEnd = shallowRef(getServerTime());
  const from = computed(() => new Date(windowEnd.value - 3600000).toISOString());
  const to = computed(() => new Date(windowEnd.value).toISOString());
  const points = computed(() => records.value.filter(record => {
    const sampledAt = Date.parse(record.sampledAt);
    return record.roomId === selected.value?.roomId && record.coordinateSystem === 'GCJ-02'
      && Number.isFinite(record.longitude) && Math.abs(record.longitude) <= 180
      && Number.isFinite(record.latitude) && Math.abs(record.latitude) <= 90
      && sampledAt >= windowEnd.value - 3600000 && sampledAt < windowEnd.value;
  }).sort((first, second) => Date.parse(first.sampledAt) - Date.parse(second.sampledAt)));
  let controller: AbortController | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  let alive = true;

  async function refresh() {
    const roomId = selected.value?.roomId;
    if (!alive || !roomId || pending.value || document.hidden) return;
    const activeController = new AbortController();
    controller = activeController;
    pending.value = true;
    error.value = '';
    windowEnd.value = getServerTime();
    const query = { roomId, from: from.value, to: to.value, pageSize: 2000 };
    const collected = new Map<string, DriverLocationRecord>();
    const cursors = new Set<string>();
    let afterId: string | undefined;
    try {
      while (true) {
        const page = await request<DriverLocationHistory>('/api/driver-locations/history', {
          query: { ...query, ...(afterId ? { afterId } : {}) },
          signal: activeController.signal, timeout: 10000, retry: 0,
        });
        if (!alive || activeController.signal.aborted || controller !== activeController) return;
        for (const record of page.list) collected.set(record.id, record);
        if (!page.hasMore) break;
        if (!page.nextAfterId || cursors.has(page.nextAfterId)) throw new Error('轨迹分页异常，请重试');
        afterId = page.nextAfterId;
        cursors.add(afterId);
      }
      records.value = [...collected.values()];
    } catch (caught) {
      if (alive && !activeController.signal.aborted && controller === activeController) {
        error.value = resolveApiErrorMessage(caught, '轨迹加载失败');
      }
    } finally {
      if (controller === activeController) pending.value = false;
    }
  }

  watch(() => selected.value?.roomId, () => {
    controller?.abort();
    controller = undefined;
    pending.value = false;
    records.value = [];
    error.value = '';
    void refresh();
  }, { immediate: true, flush: 'sync' });

  function visibilityChanged() { if (!document.hidden) void refresh(); }
  onMounted(() => {
    timer = setInterval(() => { void refresh(); }, 15000);
    document.addEventListener('visibilitychange', visibilityChanged);
  });
  onBeforeUnmount(() => {
    alive = false;
    controller?.abort();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visibilityChanged);
  });
  return { points, pending, error, from, to, refresh };
}
