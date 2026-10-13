<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import type { RickshawQr, RickshawPerformance } from '@/types/rickshaw';

const props = defineProps<{ open: boolean; mode: 'qr' | 'performance'; vehicleNo: string; qr: RickshawQr | null; performance: RickshawPerformance | null; pending: boolean; error: string }>();
const emit = defineEmits<{ 'update:open': [open: boolean]; qr: [rotate: boolean]; performance: [from: string, to: string] }>();
const model = computed({ get: () => props.open, set: (open: boolean) => { if (!props.pending) emit('update:open', open); } });
const from = ref('');
const to = ref('');
watch(() => props.open, (open) => { if (open) { from.value = ''; to.value = ''; } });
const rotate = () => {
  if (!props.pending && window.confirm('重新生成会使已印刷的旧二维码失效，确认更换？')) emit('qr', true);
};
const metrics = computed(() => {
  const record = props.performance;
  return record ? [
    ['扫码次数', record.scanCount], ['扫码人数', record.uniqueUserCount],
    ['开始游览', record.visitStartCount], ['路线完成', record.routeCompleteCount],
    ['站点完成', record.stopCompleteCount], ['完成率', `${record.completionRate.toFixed(1)}%`],
    ['总时长（分钟）', (record.totalDurationSeconds / 60).toFixed(1)],
    ['平均时长（分钟）', (record.avgDurationSeconds / 60).toFixed(1)],
  ] : [];
});
</script>

<template>
  <Dialog v-model:open="model">
    <DialogContent class="max-w-xl rounded-xl p-5">
      <DialogTitle>{{ vehicleNo }} · {{ mode === 'qr' ? '二维码' : '绩效' }}</DialogTitle>
      <div v-if="mode === 'qr'" class="mt-4 space-y-4">
        <div v-if="qr" class="space-y-3">
          <img v-if="qr.qrImageDataUri" :src="qr.qrImageDataUri" :alt="`${vehicleNo}二维码`" class="mx-auto h-56 w-56 rounded-md bg-white p-2" />
          <p class="break-all text-xs text-muted-foreground">{{ qr.targetUrl }}</p>
          <a v-if="qr.qrImageDataUri" :href="qr.qrImageDataUri" :download="`${vehicleNo}-二维码.png`" class="inline-block text-sm text-primary underline">下载二维码</a>
        </div>
        <div class="flex gap-2">
          <Button variant="outline" :disabled="pending" @click="$emit('qr', false)">{{ pending ? '加载中…' : '获取二维码' }}</Button>
          <Button variant="outline" :disabled="pending || !qr" @click="rotate">更换二维码</Button>
        </div>
      </div>
      <div v-else class="mt-4 space-y-4">
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="$emit('performance', from, to)">
          <label class="grid min-w-0 flex-1 gap-1 text-sm">开始日期<Input v-model="from" type="date" :disabled="pending" /></label>
          <label class="grid min-w-0 flex-1 gap-1 text-sm">结束日期<Input v-model="to" type="date" :disabled="pending" /></label>
          <Button type="submit" :disabled="pending">{{ pending ? '查询中…' : '查询' }}</Button>
        </form>
        <p class="text-xs text-muted-foreground">按北京时间统计，未选择日期时显示今日数据。</p>
        <dl v-if="performance" class="grid grid-cols-2 gap-3 text-sm">
          <div v-for="[label, value] in metrics" :key="String(label)" class="rounded-md border border-border px-3 py-2"><dt class="text-muted-foreground">{{ label }}</dt><dd class="mt-1 font-medium">{{ value }}</dd></div>
        </dl>
        <p v-else-if="!pending && !error" class="text-sm text-muted-foreground">暂无绩效数据</p>
      </div>
      <p v-if="error" role="alert" class="mt-3 text-sm text-destructive">{{ error }}</p>
    </DialogContent>
  </Dialog>
</template>
