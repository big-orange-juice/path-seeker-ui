<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import DriverLocationMap from '@/components/driver-locations/DriverLocationMap.vue';
import DriverLocationList from '@/components/driver-locations/DriverLocationList.vue';
import { useDriverLocations } from '@/composables/useDriverLocations';
import { driverStatusLabels } from '@/types/driver-location';

const { keyword, status, selectedId, filtered, pending, error, updatedAt, refresh } = useDriverLocations();
</script>

<template>
  <div class="admin-page-frame grid gap-4">
    <div class="warm-panel grid gap-3 rounded-lg border border-border/70 p-4 sm:grid-cols-[minmax(180px,1fr)_144px_auto_auto] sm:items-center">
      <Input v-model="keyword" aria-label="搜索车夫" placeholder="手机号 / 昵称 / 房间码" />
      <Select v-model="status" aria-label="定位状态"><option value="">全部状态</option><option v-for="(label, value) in driverStatusLabels" :key="value" :value="value">{{ label }}</option></Select>
      <Button variant="outline" :disabled="pending" @click="refresh">刷新</Button>
      <span class="text-xs text-muted-foreground">{{ filtered.length }} 位 · {{ updatedAt ? `更新于 ${updatedAt}` : '等待更新' }}</span>
    </div>
    <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}{{ updatedAt ? '；当前显示上次获取的位置。' : '；尚未获取到车夫位置。' }}</p>
    <div class="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
      <DriverLocationList :rows="filtered" :selected-id="selectedId" :pending="pending" @select="selectedId = $event" />
      <DriverLocationMap :rows="filtered" :selected-id="selectedId" @select="selectedId = $event" />
    </div>
  </div>
</template>
