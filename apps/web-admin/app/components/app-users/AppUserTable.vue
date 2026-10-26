<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue';
import type { AppUserRecord } from '@/types/app-user';

defineProps<{ rows: AppUserRecord[]; pending: boolean; disabled: boolean }>();
defineEmits<{ edit: [record: AppUserRecord] }>();
const statusLabel = (status: number) => ({ 1: '正常', 2: '禁用', 3: '注销' })[status] || '未知';
</script>

<template>
  <div class="warm-panel overflow-x-auto rounded-lg border border-border/70">
    <table class="w-full whitespace-nowrap text-left text-sm" :aria-busy="pending">
      <thead class="border-b border-border text-muted-foreground">
        <tr><th class="px-4 py-3">用户</th><th class="px-4 py-3">手机号</th><th class="px-4 py-3">状态</th><th class="px-4 py-3">是否车夫</th><th class="px-4 py-3">注册时间</th><th class="px-4 py-3">操作</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="border-b border-border/50 last:border-0">
          <td class="px-4 py-3"><div>{{ row.nickname || '未设置昵称' }}</div><div class="text-xs text-muted-foreground">{{ row.userNo }}</div></td>
          <td class="px-4 py-3">{{ row.phone || '未绑定' }}</td>
          <td class="px-4 py-3">{{ statusLabel(row.status) }}</td>
          <td class="px-4 py-3">{{ row.isDriver ? '是' : '否' }}</td>
          <td class="px-4 py-3">{{ new Date(row.registerTime).toLocaleString('zh-CN') }}</td>
          <td class="px-4 py-3"><Button variant="outline" :disabled="disabled || pending || (!row.isDriver && (row.status !== 1 || row.registerChannel === 5))" @click="$emit('edit', row)">车夫权限</Button></td>
        </tr>
        <tr v-if="!rows.length"><td colspan="6" class="px-4 py-8 text-center text-muted-foreground">{{ pending ? '加载中…' : '暂无C端用户' }}</td></tr>
      </tbody>
    </table>
  </div>
</template>
