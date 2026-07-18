<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import RouteCreateDialog from '@/components/routes/RouteCreateDialog.vue';
import RouteDataTable from '@/components/routes/RouteDataTable.vue';
import RouteDetailDialog from '@/components/routes/RouteDetailDialog.vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import {
  ROUTE_PUBLISH_STATUS_OPTIONS,
  useRouteLibrary,
} from '@/composables/useRouteLibrary';
import type { BuildRouteFromThemePayload, RouteDetailResponse, RouteRecord } from '@/types/route';
import type { MuseumResponse, MuseumResponseListTotalPageResult } from '@/types/museum';

definePageMeta({
  middleware: 'admin-auth',
});

const selectedMuseumId = shallowRef('');
const { request } = useApiClient();
const createDialogOpen = shallowRef(false);
const createSubmitting = shallowRef(false);
const createError = shallowRef('');
const actionPendingIds = shallowRef<string[]>([]);
const actionFeedback = shallowRef('');
const actionError = shallowRef('');
const confirmDialogOpen = shallowRef(false);
const confirmActionType = shallowRef<'publish' | 'delete'>('publish');
const confirmRecord = shallowRef<RouteRecord | null>(null);
const detailDialogOpen = shallowRef(false);
const detailPending = shallowRef(false);
const detailRecord = shallowRef<RouteRecord | null>(null);
const routeDetail = shallowRef<RouteDetailResponse | null>(null);

const { data: museumData, pending: museumPending } = useAsyncData(
  'route-library:museums',
  () => request<MuseumResponseListTotalPageResult<MuseumResponse>>('/api/museum-management/query', {
    method: 'POST',
    body: {
      pageIndex: 1,
      pageSize: 1000,
      keyword: null,
      status: null,
    },
  }),
  {
    default: () => ({
      list: [],
      pageIndex: 1,
      pageSize: 1000,
      total: 0,
      totalPages: 0,
    }),
  }
);

const museumOptions = computed(() =>
  (museumData.value.list ?? [])
    .filter((museum) => museum.id)
    .map((museum) => ({
      value: String(museum.id),
      label: [museum.museumCode, museum.name].filter(Boolean).join(' / ') || String(museum.id),
    }))
);

watch(
  museumOptions,
  (options) => {
    if (!options.length) {
      selectedMuseumId.value = '';
      return;
    }

    if (options.some((option) => option.value === selectedMuseumId.value)) {
      return;
    }

    selectedMuseumId.value = options[0]?.value ?? '';
  },
  { immediate: true }
);

const {
  filters,
  rows,
  pending,
  error,
  refresh,
  pageIndex,
  pageSize,
  sorting,
  total,
  totalPages,
  setPage,
  setPageSize,
  resetFilters,
  toggleSort,
  publishRoute,
  deleteRoute,
  fetchRouteDetail,
} = useRouteLibrary(() => selectedMuseumId.value);

const handleCreateManual = async (payload: BuildRouteFromThemePayload) => {
  createSubmitting.value = true;
  createError.value = '';

  try {
    await request<string>('/api/route/build-from-theme', {
      method: 'POST',
      body: payload,
    });
    createDialogOpen.value = false;
    await refresh();
  } catch (caughtError) {
    createError.value = caughtError instanceof Error ? caughtError.message : '主题路线创建失败。';
  } finally {
    createSubmitting.value = false;
  }
};

const handleChatRouteChanged = async (_routeId: string) => {
  actionFeedback.value = '';
  actionError.value = '';

  try {
    await refresh();
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(caughtError, '路线列表刷新失败。');
  }
};

const handleChatRoutePublished = async (routeId: string) => {
  actionFeedback.value = '路线已发布，列表已更新。';
  await handleChatRouteChanged(routeId);
};

const startRowAction = (routeId: string) => {
  if (actionPendingIds.value.includes(routeId)) {
    return;
  }

  actionPendingIds.value = [...actionPendingIds.value, routeId];
};

const finishRowAction = (routeId: string) => {
  actionPendingIds.value = actionPendingIds.value.filter((item) => item !== routeId);
};

const resolveActionErrorMessage = (caughtError: unknown, fallback: string) =>
  caughtError instanceof Error ? caughtError.message : fallback;

const confirmDialogTitle = computed(() => {
  return confirmActionType.value === 'publish' ? '确认发布路线' : '确认删除路线';
});

const confirmDialogDescription = computed(() => {
  const record = confirmRecord.value;
  const routeName = record?.title || record?.routeCode || record?.id || '当前路线';

  if (confirmActionType.value === 'publish') {
    return `确认发布“${routeName}”吗？发布后将按当前状态提交。`;
  }

  return `确认删除“${routeName}”吗？删除后不可恢复。`;
});

const confirmActionLabel = computed(() => {
  return confirmActionType.value === 'publish' ? '确认发布' : '确认删除';
});

const openConfirmDialog = (type: 'publish' | 'delete', record: RouteRecord) => {
  confirmActionType.value = type;
  confirmRecord.value = record;
  confirmDialogOpen.value = true;
};

const resetConfirmDialog = () => {
  confirmDialogOpen.value = false;
  confirmRecord.value = null;
};

const handleDetail = async (record: RouteRecord) => {
  actionFeedback.value = '';
  actionError.value = '';
  detailRecord.value = record;
  detailDialogOpen.value = true;
  detailPending.value = true;
  startRowAction(record.id);

  try {
    routeDetail.value = await fetchRouteDetail(record.id);
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(caughtError, '主题路线详情获取失败。');
  } finally {
    detailPending.value = false;
    finishRowAction(record.id);
  }
};

const refreshRouteRow = async (record: RouteRecord) => {
  actionFeedback.value = '';
  actionError.value = '';
  startRowAction(record.id);

  try {
    await refresh();
    actionFeedback.value = `已刷新“${record.title || record.routeCode || record.id}”。`;
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(caughtError, '主题路线刷新失败。');
  } finally {
    finishRowAction(record.id);
  }
};

const refreshRouteDetail = async (options?: { silent?: boolean }) => {
  const record = detailRecord.value;
  if (!record) {
    return;
  }

  const silent = Boolean(options?.silent);
  if (!silent) {
    detailPending.value = true;
  }

  actionError.value = '';

  try {
    routeDetail.value = await fetchRouteDetail(record.id);
  } catch (caughtError) {
    // 静默刷新失败不打断编辑页，仅在手动刷新时提示
    if (!silent) {
      actionError.value = resolveActionErrorMessage(caughtError, '主题路线详情刷新失败。');
    }
  } finally {
    if (!silent) {
      detailPending.value = false;
    }
  }
};

const handlePublish = async (record: RouteRecord) => {
  openConfirmDialog('publish', record);
};

const handleRemove = async (record: RouteRecord) => {
  openConfirmDialog('delete', record);
};

const submitConfirmedAction = async () => {
  const record = confirmRecord.value;
  if (!record) {
    return;
  }

  actionFeedback.value = '';
  actionError.value = '';
  startRowAction(record.id);

  try {
    if (confirmActionType.value === 'publish') {
      await publishRoute({
        id: record.id,
        publishStatus: 2,
      });
      actionFeedback.value = `已发布“${record.title || record.routeCode || record.id}”。`;
    } else {
      await deleteRoute(record.id);
      actionFeedback.value = `已删除“${record.title || record.routeCode || record.id}”。`;
    }
    resetConfirmDialog();
  } catch (caughtError) {
    actionError.value = resolveActionErrorMessage(
      caughtError,
      confirmActionType.value === 'publish' ? '主题路线发布失败。' : '主题路线删除失败。'
    );
  } finally {
    finishRowAction(record.id);
  }
};
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div v-if="error" class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error.message || '主题路线数据加载失败。' }}
    </div>
    <div v-if="createError" class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ createError }}
    </div>
    <div v-if="actionError" class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ actionError }}
    </div>
    <div v-if="actionFeedback" class="rounded-[0.85rem] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
      {{ actionFeedback }}
    </div>

    <section class="warm-panel warm-outline rounded-[0.95rem] border border-border/70 px-4 py-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="w-[280px] space-y-2">
          <label class="text-sm font-medium text-foreground">所属博物馆</label>
          <Select :model-value="selectedMuseumId" :disabled="museumPending || !museumOptions.length" @update:model-value="selectedMuseumId = $event">
            <option v-for="option in museumOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="min-w-[260px] flex-1 space-y-2">
          <label class="text-sm font-medium text-foreground">关键词</label>
          <Input v-model="filters.keyword" placeholder="搜索路线标题、编码、主题" />
        </div>
        <div class="w-[160px] space-y-2">
          <label class="text-sm font-medium text-foreground">状态</label>
          <Select :model-value="String(filters.publishStatus)" @update:model-value="filters.publishStatus = Number($event)">
            <option v-for="option in ROUTE_PUBLISH_STATUS_OPTIONS" :key="option.value" :value="String(option.value)">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="flex flex-wrap items-end gap-2 xl:ml-auto">
          <Button :disabled="!selectedMuseumId || createSubmitting" @click="createDialogOpen = true">
            <AppIcon name="route" class="h-4 w-4" />
            新增路线
          </Button>
          <Button variant="outline" @click="resetFilters">
            重置筛选
          </Button>
          <Button variant="outline" @click="refresh()">
            刷新
          </Button>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3 px-1">
        <div class="min-w-0 truncate text-sm text-muted-foreground">
          共 {{ total }} 条，当前第 {{ pageIndex }} / {{ Math.max(totalPages, 1) }} 页
        </div>
        <div class="flex shrink-0 flex-nowrap items-center gap-2 text-sm text-muted-foreground">
          <span class="whitespace-nowrap">每页</span>
          <Select :model-value="String(pageSize)" class="w-[78px] shrink-0" @update:model-value="setPageSize(Number($event))">
            <option value="10">10</option>
            <option value="20">20</option>
            <option value="50">50</option>
          </Select>
          <Button variant="outline" class="shrink-0 whitespace-nowrap" :disabled="pageIndex <= 1 || pending" @click="setPage(pageIndex - 1)">
            上一页
          </Button>
          <Button variant="outline" class="shrink-0 whitespace-nowrap" :disabled="pageIndex >= Math.max(totalPages, 1) || pending" @click="setPage(pageIndex + 1)">
            下一页
          </Button>
        </div>
      </div>

      <RouteDataTable
        :rows="rows"
        :pending="pending"
        :sorting="sorting"
        :acting-ids="actionPendingIds"
        @sort="toggleSort"
        @detail="handleDetail"
        @publish="handlePublish"
        @refresh-row="refreshRouteRow"
        @remove="handleRemove" />
    </section>

    <RouteCreateDialog
      v-model:open="createDialogOpen"
      :museum-options="museumOptions"
      :default-museum-id="selectedMuseumId"
      :submitting="createSubmitting"
      @submit-manual="handleCreateManual"
      @route-changed="handleChatRouteChanged"
      @route-published="handleChatRoutePublished" />

    <RouteDetailDialog
      v-model:open="detailDialogOpen"
      :detail="routeDetail"
      :pending="detailPending"
      @refresh-silent="refreshRouteDetail({ silent: true })" />

    <Dialog v-model:open="confirmDialogOpen">
      <DialogContent class="max-w-[min(92vw,24rem)] rounded-xl border border-border bg-[#15171b] p-0 text-left">
        <DialogHeader class="space-y-2 px-5 pb-2 pt-4">
          <DialogTitle>{{ confirmDialogTitle }}</DialogTitle>
          <DialogDescription>{{ confirmDialogDescription }}</DialogDescription>
        </DialogHeader>

        <DialogFooter class="px-5 pb-4 pt-3">
          <Button variant="outline" type="button" @click="resetConfirmDialog">
            取消
          </Button>
          <Button
            :variant="confirmActionType === 'delete' ? 'secondary' : 'default'"
            type="button"
            :disabled="!confirmRecord || actionPendingIds.includes(confirmRecord.id)"
            @click="submitConfirmedAction">
            {{ confirmActionLabel }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
