<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import CulturalPlaceFormDialog from '@/components/museum-management/CulturalPlaceFormDialog.vue';
import { useCulturalPlaces } from '@/composables/useCulturalPlaces';
import type { CulturalPlaceDraft, CulturalPlaceRecord } from '@/types/cultural-place';

const props = defineProps<{ museumId: string; disabled?: boolean }>();
const places = useCulturalPlaces(() => props.museumId);
const keyword = shallowRef('');
const editing = shallowRef<CulturalPlaceRecord | null>(null);
const open = shallowRef(false);
const saving = shallowRef(false);
const error = shallowRef('');
const filtered = computed(() => places.records.value.filter(item => `${item.name} ${item.code} ${item.category || ''}`.includes(keyword.value.trim())));

function edit(record: CulturalPlaceRecord | null) { editing.value = record; error.value = ''; open.value = true; }
async function save(draft: CulturalPlaceDraft) {
  saving.value = true;
  error.value = '';
  try { await places.save(draft); open.value = false; }
  catch (caught) { error.value = caught instanceof Error ? caught.message : '文化点保存失败。'; }
  finally { saving.value = false; }
}
async function remove(record: CulturalPlaceRecord) {
  if (!window.confirm(`确认删除文化点「${record.name}」吗？`)) return;
  saving.value = true;
  error.value = '';
  try { await places.remove(record.id); }
  catch (caught) { error.value = caught instanceof Error ? caught.message : '删除失败。'; }
  finally { saving.value = false; }
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-3"><Input v-model="keyword" class="max-w-sm" placeholder="搜索名称、编码或分类" /><Button :disabled="disabled || saving || !museumId" @click="edit(null)">新增文化点</Button><Button variant="outline" :disabled="places.pending.value" @click="places.refresh">刷新</Button></div>
    <p v-if="places.error.value || (!open && error)" class="text-sm text-destructive">{{ places.error.value || error }}</p>
    <div class="overflow-x-auto rounded-lg border"><table class="w-full text-left text-sm"><thead class="bg-secondary/30 text-xs text-muted-foreground"><tr><th class="p-3">文化点</th><th class="p-3">分类</th><th class="p-3">经纬度</th><th class="p-3">停留时长</th><th class="p-3">状态</th><th class="p-3">操作</th></tr></thead><tbody><tr v-for="item in filtered" :key="item.id" class="border-t"><td class="p-3"><strong>{{ item.name }}</strong><p class="text-xs text-muted-foreground">{{ item.address }}</p></td><td class="p-3">{{ item.category || '—' }}</td><td class="p-3 text-xs">{{ item.longitude }}, {{ item.latitude }}</td><td class="p-3">{{ item.recommendedMinutes ?? '—' }} 分钟</td><td class="p-3">{{ item.status === 1 ? '启用' : '停用' }}</td><td class="p-3"><div class="flex gap-2"><Button size="sm" variant="outline" :disabled="disabled || saving" @click="edit(item)">编辑</Button><Button size="sm" variant="ghost" :disabled="disabled || saving" @click="remove(item)">删除</Button></div></td></tr><tr v-if="!filtered.length"><td colspan="6" class="p-6 text-center text-muted-foreground">{{ places.pending.value ? '正在加载…' : '暂无文化点' }}</td></tr></tbody></table></div>
    <CulturalPlaceFormDialog :open="open" :museum-id="museumId" :record="editing" :pending="saving" :error="error" @update:open="open = $event" @save="save" />
  </section>
</template>
