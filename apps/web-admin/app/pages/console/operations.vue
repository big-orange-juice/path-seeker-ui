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
  /** 类目较多时默认只露出一段，拖拽 / 缩放可浏览其余 */
  const defaultWindow = 8;
  const zoomEnd = titles.length > defaultWindow
    ? Math.max(12, Math.round((defaultWindow / titles.length) * 100))
    : 100;

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
    grid: { left: 40, right: 16, top: 36, bottom: 72 },
    dataZoom: [
      {
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'none',
        start: 0,
        end: zoomEnd,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
      },
      {
        type: 'slider',
        xAxisIndex: 0,
        filterMode: 'none',
        height: 18,
        bottom: 6,
        start: 0,
        end: zoomEnd,
        brushSelect: false,
        borderColor: 'rgba(200, 194, 182, 0.2)',
        backgroundColor: 'rgba(200, 194, 182, 0.06)',
        fillerColor: 'rgba(209, 178, 111, 0.18)',
        handleStyle: {
          color: chartTheme.gold,
          borderColor: chartTheme.gold,
        },
        moveHandleStyle: {
          color: chartTheme.gold,
        },
        dataBackground: {
          lineStyle: { color: 'rgba(200, 194, 182, 0.25)' },
          areaStyle: { color: 'rgba(200, 194, 182, 0.08)' },
        },
        selectedDataBackground: {
          lineStyle: { color: chartTheme.gold },
          areaStyle: { color: 'rgba(209, 178, 111, 0.12)' },
        },
        textStyle: { color: chartTheme.text, fontSize: 10 },
      },
    ],
    xAxis: {
      type: 'category',
      data: titles,
      axisLabel: {
        color: chartTheme.text,
        fontSize: 10,
        interval: 0,
        hideOverlap: false,
        rotate: 32,
        overflow: 'none',
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
        barMaxWidth: 18,
        data: rows.map((item) => item.startCount ?? 0),
      },
      {
        name: '完成',
        type: 'bar',
        barMaxWidth: 18,
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
