<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import RouteDataTable from '@/components/routes/RouteDataTable.vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import {
  ROUTE_AGE_GROUP_OPTIONS,
  ROUTE_AUDIT_STATUS_OPTIONS,
  ROUTE_PUBLISH_STATUS_OPTIONS,
  useRouteLibrary,
} from '@/composables/useRouteLibrary';
import type { MuseumResponse, MuseumResponseListTotalPageResult } from '@/types/museum';

definePageMeta({
  middleware: 'admin-auth',
});

const runtimeConfig = useRuntimeConfig();
const selectedMuseumId = shallowRef(String(runtimeConfig.public.museumId || '1').trim());
const { request } = useApiClient();

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
} = useRouteLibrary(() => selectedMuseumId.value);
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div v-if="error" class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
      {{ error.message || '主题路线数据加载失败。' }}
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
          <label class="text-sm font-medium text-foreground">年龄段</label>
          <Select :model-value="String(filters.ageGroup)" @update:model-value="filters.ageGroup = Number($event)">
            <option v-for="option in ROUTE_AGE_GROUP_OPTIONS" :key="option.value" :value="String(option.value)">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="w-[160px] space-y-2">
          <label class="text-sm font-medium text-foreground">发布状态</label>
          <Select :model-value="String(filters.publishStatus)" @update:model-value="filters.publishStatus = Number($event)">
            <option v-for="option in ROUTE_PUBLISH_STATUS_OPTIONS" :key="option.value" :value="String(option.value)">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="w-[160px] space-y-2">
          <label class="text-sm font-medium text-foreground">审核状态</label>
          <Select :model-value="String(filters.auditStatus)" @update:model-value="filters.auditStatus = Number($event)">
            <option v-for="option in ROUTE_AUDIT_STATUS_OPTIONS" :key="option.value" :value="String(option.value)">
              {{ option.label }}
            </option>
          </Select>
        </div>
        <div class="flex flex-wrap items-end gap-2 xl:ml-auto">
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
        @sort="toggleSort" />
    </section>
  </div>
</template>
