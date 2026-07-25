<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { EChartsCoreOption } from 'echarts/core';
import Button from '@/components/shadcn/button/Button.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import DashboardChartCard from '@/components/dashboard/DashboardChartCard.vue';
import { useDashboard } from '@/composables/useDashboard';

definePageMeta({
  middleware: 'admin-auth',
});

const { data, pending, error, refresh } = useDashboard();

onMounted(() => {
  void refresh();
});

const overviewCards = computed(() => {
  const o = data.value.overview;
  return [
    { label: '用户总数', value: o?.userTotal ?? 0 },
    { label: '展品总数', value: o?.exhibitTotal ?? 0 },
    { label: '路线总数', value: o?.routeTotal ?? 0 },
    { label: '已发布路线', value: o?.publishedRouteTotal ?? 0 },
    { label: '游玩次数', value: o?.sessionTotal ?? 0 },
    { label: '已完成场次', value: o?.completedSessionTotal ?? 0 },
    {
      label: '完成率',
      value: o?.completionRate != null ? `${Number(o.completionRate).toFixed(1)}%` : '—',
    },
  ];
});

const chartTheme = {
  text: '#c8c2b6',
  axis: 'rgba(200, 194, 182, 0.35)',
  split: 'rgba(200, 194, 182, 0.08)',
  gold: '#d1b26f',
  sky: '#7eb8d4',
};

const routeStatsOption = computed<EChartsCoreOption | null>(() => {
  const rows = data.value.routeStats ?? [];
  if (!rows.length) return null;

  const titles = rows.map((item) => item.title || item.routeId || '未命名');
  /** 类目较多时默认只露出一段，拖拽底部条 / 滚轮缩放可浏览其余 */
  const defaultWindow = 8;
  const zoomEnd = titles.length > defaultWindow
    ? Math.max(12, Math.round((defaultWindow / titles.length) * 100))
    : 100;

  /** 水平标签截断，避免倾斜；完整名走 tooltip */
  const formatCategoryLabel = (value: string) => {
    const text = String(value ?? '');
    return text.length > 8 ? `${text.slice(0, 8)}…` : text;
  };

  return {
    color: [chartTheme.gold, chartTheme.sky],
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(18, 19, 22, 0.94)',
      borderColor: 'rgba(209, 178, 111, 0.25)',
      textStyle: { color: '#f2ebe0', fontSize: 12 },
    },
    legend: {
      data: ['开始', '完成'],
      top: 0,
      textStyle: { color: chartTheme.text, fontSize: 11 },
    },
    /** 水平 x 标签 + 精简缩放条，底部留白收紧 */
    grid: { left: 40, right: 16, top: 36, bottom: 48 },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'filter',
        start: 0,
        end: zoomEnd,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'filter',
        height: 16,
        bottom: 4,
        start: 0,
        end: zoomEnd,
        /** 不显示起止数值浮标，减少干扰 */
        showDetail: false,
        showDataShadow: true,
        brushSelect: false,
        realtime: true,
        borderColor: 'rgba(200, 194, 182, 0.18)',
        backgroundColor: 'rgba(200, 194, 182, 0.05)',
        fillerColor: 'rgba(209, 178, 111, 0.22)',
        handleSize: 14,
        handleStyle: {
          color: chartTheme.gold,
          borderColor: 'rgba(209, 178, 111, 0.85)',
          borderWidth: 1,
          shadowBlur: 0,
        },
        moveHandleSize: 0,
        dataBackground: {
          lineStyle: { color: 'rgba(200, 194, 182, 0.2)', width: 1 },
          areaStyle: { color: 'rgba(200, 194, 182, 0.06)' },
        },
        selectedDataBackground: {
          lineStyle: { color: chartTheme.gold, width: 1 },
          areaStyle: { color: 'rgba(209, 178, 111, 0.14)' },
        },
        emphasis: {
          handleStyle: {
            color: chartTheme.gold,
            borderColor: '#e8d5a3',
          },
        },
        textStyle: { color: 'transparent', fontSize: 0 },
      },
    ],
    xAxis: {
      type: 'category',
      data: titles,
      axisLabel: {
        color: chartTheme.text,
        fontSize: 11,
        interval: 0,
        hideOverlap: true,
        rotate: 0,
        margin: 10,
        formatter: formatCategoryLabel,
      },
      axisLine: { lineStyle: { color: chartTheme.axis } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLabel: { color: chartTheme.text, fontSize: 10 },
      splitLine: { lineStyle: { color: chartTheme.split } },
      axisLine: { show: false },
    },
    series: [
      {
        name: '开始',
        type: 'bar',
        barMaxWidth: 22,
        data: rows.map((item) => item.startCount ?? 0),
      },
      {
        name: '完成',
        type: 'bar',
        barMaxWidth: 22,
        data: rows.map((item) => item.completeCount ?? 0),
      },
    ],
  };
});

</script>

<template>
  <div class="mx-auto flex w-full max-w-[1400px] flex-col gap-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-sm text-muted-foreground">
          概览场次、完成率与路线表现
        </p>
      </div>
      <Button variant="outline" type="button" :disabled="pending" @click="refresh()">
        <AppIcon name="refresh-cw" class="h-4 w-4" :class="pending ? 'animate-spin' : ''" />
        刷新
      </Button>
    </div>

    <div
      v-if="error"
      class="rounded-[0.85rem] border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive"
    >
      {{ error.message || '看板数据加载失败。' }}
    </div>

    <section class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <div
        v-for="card in overviewCards"
        :key="card.label"
        class="warm-panel warm-outline rounded-xl border border-border/70 px-3 py-3"
      >
        <p class="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
          {{ card.label }}
        </p>
        <p class="mt-1.5 text-xl font-semibold tabular-nums text-foreground">
          <template v-if="pending && !data.overview">—</template>
          <template v-else>{{ card.value }}</template>
        </p>
      </div>
    </section>

    <section>
      <DashboardChartCard
        title="路线开始 / 完成"
        :option="routeStatsOption"
        empty-text="暂无路线统计"
        height-class="h-[340px]"
      />
    </section>
  </div>
</template>
