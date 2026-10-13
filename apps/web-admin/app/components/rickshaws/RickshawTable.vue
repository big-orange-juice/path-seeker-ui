<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue';
import Select from '@/components/shadcn/select/Select.vue';
import { RICKSHAW_STATUSES, type RickshawRecord } from '@/types/rickshaw';

defineProps<{ rows: RickshawRecord[]; disabled: boolean }>();
defineEmits<{
  edit: [record: RickshawRecord];
  qr: [record: RickshawRecord];
  performance: [record: RickshawRecord];
  status: [record: RickshawRecord, status: number];
}>();
</script>

<template>
  <div class="warm-panel overflow-x-auto rounded-lg border border-border/70">
    <table class="w-full text-left text-sm">
      <thead class="border-b border-border text-muted-foreground">
        <tr><th class="px-4 py-3">车号</th><th class="px-4 py-3">目的地</th><th class="px-4 py-3">车夫</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="border-b border-border/50 last:border-0">
          <td class="px-4 py-3 font-medium">{{ row.vehicleNo }}</td>
          <td class="px-4 py-3">{{ row.museumName || '—' }}</td>
          <td class="px-4 py-3">{{ row.driverName || '未分配' }}</td>
          <td class="w-32 px-4 py-3">
            <Select :model-value="String(row.status)" :disabled="disabled" @update:model-value="$emit('status', row, Number($event))">
              <option v-for="item in RICKSHAW_STATUSES" :key="item.value" :value="String(item.value)">{{ item.label }}</option>
            </Select>
          </td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap gap-2">
              <Button variant="outline" :disabled="disabled" @click="$emit('edit', row)">编辑</Button>
              <Button variant="outline" :disabled="disabled" @click="$emit('qr', row)">二维码</Button>
              <Button variant="outline" :disabled="disabled" @click="$emit('performance', row)">绩效</Button>
            </div>
          </td>
        </tr>
        <tr v-if="!rows.length"><td colspan="5" class="px-4 py-8 text-center text-muted-foreground">暂无黄包车</td></tr>
      </tbody>
    </table>
  </div>
</template>
