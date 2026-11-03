import { computed, onBeforeUnmount, onMounted, shallowRef } from 'vue';
import { resolveApiErrorMessage, useApiClient } from '@/composables/useApiClient';
import type { DriverLocation, DriverLocationSnapshot } from '@/types/driver-location';

export function useDriverLocations() {
  const { request } = useApiClient();
  const rows = shallowRef<DriverLocation[]>([]);
  const keyword = shallowRef('');
  const status = shallowRef('');
  const selectedId = shallowRef('');
  const pending = shallowRef(false);
  const error = shallowRef('');
  const updatedAt = shallowRef('');
  const now = shallowRef(Date.now());
  let serverOffset = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let controller: AbortController | undefined;
  let alive = true;
  const locations = computed(() => rows.value.map(row => {
    if (row.status === 'stopped') return row;
    const serverNow = now.value + serverOffset;
    const offline = !row.lastSeenAt || serverNow - Date.parse(row.lastSeenAt) > 60000;
    const stale = row.sampledAt && serverNow - Date.parse(row.sampledAt) > 30000;
    return { ...row, status: offline ? 'offline' as const : stale ? 'stale' as const : row.status };
  }));
  const filtered = computed(() => {
    const search = keyword.value.trim().toLowerCase();
    return locations.value.filter(row => (!status.value || row.status === status.value)
      && (!search || `${row.displayName} ${row.phone ?? ''} ${row.roomCode}`.toLowerCase().includes(search)));
  });
  const selected = computed(() => filtered.value.find(row => row.roomId === selectedId.value));

  async function refresh() {
    if (!alive || pending.value || document.hidden) return;
    pending.value = true;
    controller = new AbortController();
    try {
      const snapshot = await request<DriverLocationSnapshot>('/api/driver-locations', {
        signal: controller.signal, timeout: 10000, retry: 0,
      });
      if (!alive) return;
      rows.value = snapshot.list;
      serverOffset = Date.parse(snapshot.serverTime) - Date.now();
      updatedAt.value = new Date().toLocaleTimeString('zh-CN');
      error.value = '';
      if (!snapshot.list.some(row => row.roomId === selectedId.value)) selectedId.value = '';
    } catch (caught) {
      if (alive) error.value = resolveApiErrorMessage(caught, '车夫位置更新失败');
    } finally { pending.value = false; }
  }

  function visibilityChanged() { if (!document.hidden) void refresh(); }
  onMounted(() => {
    void refresh();
    timer = setInterval(() => { now.value = Date.now(); void refresh(); }, 3000);
    document.addEventListener('visibilitychange', visibilityChanged);
  });
  onBeforeUnmount(() => {
    alive = false;
    controller?.abort();
    clearInterval(timer);
    document.removeEventListener('visibilitychange', visibilityChanged);
  });
  return { keyword, status, selectedId, filtered, selected, pending, error, updatedAt, refresh };
}
