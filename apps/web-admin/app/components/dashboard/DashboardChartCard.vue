<script setup lang="ts">
import { onBeforeUnmount, onMounted, shallowRef, useTemplateRef, watch } from 'vue';
import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsCoreOption, EChartsType } from 'echarts/core';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  LegendComponent,
  TooltipComponent,
  CanvasRenderer,
]);

interface Props {
  title: string;
  option: EChartsCoreOption | null;
  emptyText?: string;
  heightClass?: string;
}

const props = withDefaults(defineProps<Props>(), {
  emptyText: '暂无数据',
  heightClass: 'h-[280px]',
});

const hostRef = useTemplateRef<HTMLDivElement>('chartHost');
const chart = shallowRef<EChartsType | null>(null);
let resizeObserver: ResizeObserver | null = null;

const hasSeriesData = (option: EChartsCoreOption | null) => {
  if (!option) return false;
  const series = option.series;
  if (!series) return false;
  const list = Array.isArray(series) ? series : [series];
  return list.some((item) => {
    const data = (item as { data?: unknown[] })?.data;
    return Array.isArray(data) && data.length > 0;
  });
};

const renderChart = () => {
  if (!hostRef.value) return;

  if (!hasSeriesData(props.option)) {
    chart.value?.clear();
    return;
  }

  if (!chart.value) {
    chart.value = echarts.init(hostRef.value, undefined, { renderer: 'canvas' });
  }

  chart.value.setOption(props.option as EChartsCoreOption, true);
  chart.value.resize();
};

const handleResize = () => {
  chart.value?.resize();
};

onMounted(() => {
  renderChart();
  window.addEventListener('resize', handleResize);
  resizeObserver = new ResizeObserver(handleResize);
  if (hostRef.value) {
    resizeObserver.observe(hostRef.value);
  }
});

watch(
  () => props.option,
  () => {
    renderChart();
  },
  { deep: true, flush: 'post' },
);

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  resizeObserver?.disconnect();
  resizeObserver = null;
  chart.value?.dispose();
  chart.value = null;
});
</script>

<template>
  <section class="warm-panel warm-outline flex min-h-0 flex-col rounded-[0.95rem] border border-border/70 px-4 py-4">
    <h3 class="mb-3 text-sm font-semibold text-foreground">
      {{ props.title }}
    </h3>
    <div v-if="!hasSeriesData(props.option)" :class="[props.heightClass, 'flex items-center justify-center text-sm text-muted-foreground']">
      {{ props.emptyText }}
    </div>
    <div v-show="hasSeriesData(props.option)" ref="chartHost" :class="[props.heightClass, 'w-full']" />
  </section>
</template>
