<script setup lang="ts">
import { driverStatusLabels, type DriverLocation } from '@/types/driver-location';
defineProps<{ rows: DriverLocation[]; selectedId: string; pending: boolean }>();
defineEmits<{ select: [roomId: string] }>();
const formatTime = (value: string | null) => value ? new Date(value).toLocaleTimeString('zh-CN') : '—';
</script>

<template>
  <div class="max-h-[650px] overflow-auto rounded-lg border border-border/70 bg-background">
    <p v-if="!rows.length" class="p-5 text-sm text-muted-foreground">{{ pending ? '正在加载车夫位置…' : '暂无符合条件的在途房间' }}</p>
    <button v-for="row in rows" :key="row.roomId" type="button" class="grid w-full gap-1 border-b border-border/60 p-3 text-left text-sm last:border-b-0 hover:bg-muted/40" :class="row.roomId === selectedId ? 'bg-muted/60' : ''" :aria-pressed="row.roomId === selectedId" @click="$emit('select', row.roomId)">
      <span class="flex items-center justify-between gap-2"><strong class="truncate font-medium">{{ row.displayName || '车夫' }}</strong><span class="shrink-0 text-xs" :class="row.status === 'online' ? 'text-emerald-700' : 'text-muted-foreground'">{{ driverStatusLabels[row.status] }}</span></span>
      <span class="text-xs text-muted-foreground">{{ row.phone || '未绑定手机号' }} · 房间 {{ row.roomCode }}</span>
      <span class="text-xs text-muted-foreground">采样 {{ formatTime(row.sampledAt) }} · 精度 {{ row.accuracy === null ? '—' : `${Math.round(row.accuracy)} 米` }}</span>
      <span v-if="row.longitude !== null && row.latitude !== null" class="font-mono text-xs text-muted-foreground">{{ row.longitude.toFixed(6) }}, {{ row.latitude.toFixed(6) }}</span>
    </button>
  </div>
</template>
