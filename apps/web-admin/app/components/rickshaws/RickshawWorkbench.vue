<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import { useDebounceFn } from '#imports';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import RickshawTable from './RickshawTable.vue';
import RickshawFormDialog from './RickshawFormDialog.vue';
import RickshawActivityDialog from './RickshawActivityDialog.vue';
import { useRickshawManagement } from '@/composables/useRickshawManagement';
import { useApiClient, resolveApiErrorMessage } from '@/composables/useApiClient';
import { useActionFeedback } from '@/composables/useActionFeedback';
import { RICKSHAW_STATUSES, type RickshawDraft, type RickshawRecord, type RickshawQr, type RickshawPerformance } from '@/types/rickshaw';
import type { MuseumResponse, MuseumResponseListTotalPageResult } from '@/types/museum';

const { keyword, museumId, status, pageIndex, rows, total, totalPages, pending, acting, error, refresh, save, updateStatus, generateQr, performance } = useRickshawManagement();
const { request } = useApiClient();
const feedback = useActionFeedback();
const destinations = shallowRef<{ id: string; name: string }[]>([]);
const destinationError = ref('');
const formOpen = ref(false);
const formError = ref('');
const draft = shallowRef<RickshawDraft>({ museumId: '', vehicleNo: '', driverName: '', remark: '' });
const activityOpen = ref(false);
const activityMode = ref<'qr' | 'performance'>('qr');
const selected = shallowRef<RickshawRecord | null>(null);
const qr = shallowRef<RickshawQr | null>(null);
const stats = shallowRef<RickshawPerformance | null>(null);
const activityError = ref('');
let destinationVersion = 0;

const loadDestinations = async (search = '') => {
  const version = ++destinationVersion;
  destinationError.value = '';
  try {
    const result = await request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
      method: 'POST', body: { pageIndex: 1, pageSize: 100, status: 1, keyword: search || undefined }, timeout: 30000, retry: 0,
    });
    if (version !== destinationVersion) return;
    destinations.value = result.list.filter(item => item.id && [2, 3, 4].includes(item.venueType ?? 0))
      .map(item => ({ id: item.id!, name: item.name || item.id! }));
    if (draft.value.id && !destinations.value.some(item => item.id === draft.value.museumId)) {
      destinations.value = [...destinations.value, { id: draft.value.museumId, name: selected.value?.museumName || draft.value.museumId }];
    }
  } catch (caught) {
    if (version === destinationVersion) destinationError.value = resolveApiErrorMessage(caught, '目的地加载失败');
  }
};
const searchDestinations = useDebounceFn(loadDestinations, 300);
onMounted(() => { void refresh(); void loadDestinations(); });

const openForm = (record?: RickshawRecord) => {
  if (acting.value) return;
  selected.value = record ?? null;
  draft.value = record ? { id: record.id, museumId: record.museumId || '', vehicleNo: record.vehicleNo, driverName: record.driverName || '', driverPhone: record.driverPhone || '', driverUserNo: record.driverUserNo || '', remark: record.remark || '' }
    : { museumId: museumId.value, vehicleNo: '', driverName: '', driverPhone: '', driverUserNo: '', remark: '' };
  formError.value = '';
  formOpen.value = true;
  void loadDestinations();
};
const submit = async (value: RickshawDraft) => {
  if (acting.value) return;
  formError.value = '';
  try {
    await save(value);
    formOpen.value = false;
    feedback.success('黄包车资料已保存');
    await refresh();
  } catch (caught) { formError.value = resolveApiErrorMessage(caught, '保存失败'); }
};
const changeStatus = async (record: RickshawRecord, nextStatus: number) => {
  if (acting.value || record.status === nextStatus) return;
  if (nextStatus === 4 && !window.confirm(`确认将 ${record.vehicleNo} 标记为退役？`)) return;
  try { await updateStatus(record.id, nextStatus); await refresh(); }
  catch (caught) { feedback.errorFrom(caught, '状态更新失败'); }
};
const fetchQr = async (rotate: boolean) => {
  if (!selected.value || acting.value) return;
  activityError.value = '';
  try { qr.value = await generateQr(selected.value.id, rotate); }
  catch (caught) { activityError.value = resolveApiErrorMessage(caught, '二维码加载失败'); }
};
const fetchPerformance = async (from?: string, to?: string) => {
  if (!selected.value || acting.value) return;
  activityError.value = '';
  if (from && to && from > to) { activityError.value = '开始日期不能晚于结束日期'; return; }
  try { stats.value = (await performance(selected.value.id, from, to))[0] ?? null; }
  catch (caught) { activityError.value = resolveApiErrorMessage(caught, '绩效加载失败'); }
};
const openActivity = (record: RickshawRecord, mode: 'qr' | 'performance') => {
  if (acting.value) return;
  selected.value = record;
  activityMode.value = mode;
  qr.value = null;
  stats.value = null;
  activityError.value = '';
  activityOpen.value = true;
  if (mode === 'qr') void fetchQr(false); else void fetchPerformance();
};
</script>

<template>
  <div class="admin-page-frame flex flex-col gap-4">
    <form class="warm-panel flex flex-wrap items-end gap-3 rounded-lg border border-border/70 p-4" @submit.prevent="refresh(1)">
      <label class="grid min-w-48 flex-1 gap-2 text-sm">关键词<Input v-model="keyword" placeholder="车号或车夫姓名" /></label>
      <label class="grid w-56 gap-2 text-sm">目的地
        <Select v-model="museumId" searchable @search="searchDestinations"><option value="">全部目的地</option><option v-for="item in destinations" :key="item.id" :value="item.id">{{ item.name }}</option></Select>
      </label>
      <label class="grid w-32 gap-2 text-sm">状态<Select v-model="status"><option value="">全部状态</option><option v-for="item in RICKSHAW_STATUSES" :key="item.value" :value="String(item.value)">{{ item.label }}</option></Select></label>
      <Button type="submit" variant="outline" :disabled="pending || acting">查询</Button>
      <Button type="button" :disabled="acting || pending" @click="openForm()">新增黄包车</Button>
    </form>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    <div v-if="destinationError" class="flex items-center gap-2 text-sm text-destructive">{{ destinationError }}<Button variant="outline" @click="loadDestinations()">重试目的地</Button></div>
    <RickshawTable :rows="rows" :disabled="acting || pending" @edit="openForm" @qr="openActivity($event, 'qr')" @performance="openActivity($event, 'performance')" @status="changeStatus" />
    <div class="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <span>{{ pending ? '加载中…' : `共 ${total} 辆，第 ${pageIndex} / ${totalPages} 页` }}</span>
      <div class="flex gap-2"><Button variant="outline" :disabled="pending || acting || pageIndex <= 1" @click="refresh(pageIndex - 1)">上一页</Button><Button variant="outline" :disabled="pending || acting || pageIndex >= totalPages" @click="refresh(pageIndex + 1)">下一页</Button></div>
    </div>
    <RickshawFormDialog v-model:open="formOpen" :initial="draft" :destinations="destinations" :pending="acting" :error="formError || destinationError" @save="submit" @search="searchDestinations" />
    <RickshawActivityDialog :key="`${selected?.id}:${activityMode}`" v-model:open="activityOpen" :mode="activityMode" :vehicle-no="selected?.vehicleNo || ''" :qr="qr" :performance="stats" :pending="acting" :error="activityError" @qr="fetchQr" @performance="fetchPerformance" />
  </div>
</template>
