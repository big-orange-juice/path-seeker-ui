<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import type { SiteAreaPageResult, SiteAreaResponse } from '@/types/site-area';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';

const config = useRuntimeConfig();
const { request } = useApiClient();
const museumId = shallowRef(String(config.public.museumId || '').trim());
const pending = shallowRef(false);
const error = shallowRef('');
const rows = shallowRef<SiteAreaResponse[]>([]);
const editing = shallowRef<SiteAreaResponse | null>(null);
const dialogOpen = shallowRef(false);
const form = reactive({ id: '', parentAreaId: '', areaCode: '', name: '', areaType: 1, description: '', boundaryGeoJson: '', centerLongitude: null as number | null, centerLatitude: null as number | null, sortOrder: 0 });
const totalAssets = computed(() => rows.value.reduce((sum, row) => sum + Number(row.assetCount || 0), 0));

async function load() {
  if (!museumId.value) return;
  pending.value = true; error.value = '';
  try { const result = await request<SiteAreaPageResult<SiteAreaResponse>>('/api/site-area/query', { method: 'POST', body: { museumId: museumId.value, pageIndex: 1, pageSize: 200 } }); rows.value = result.list || []; }
  catch (caught) { error.value = caught instanceof Error ? caught.message : '区域加载失败。'; }
  finally { pending.value = false; }
}
function openCreate(parentAreaId = '') { editing.value = null; Object.assign(form, { id: '', parentAreaId, areaCode: '', name: '', areaType: 1, description: '', boundaryGeoJson: '', centerLongitude: null, centerLatitude: null, sortOrder: 0 }); dialogOpen.value = true; }
function openEdit(row: SiteAreaResponse) { editing.value = row; Object.assign(form, { id: row.id || '', parentAreaId: row.parentAreaId || '', areaCode: row.areaCode || '', name: row.name || '', areaType: row.areaType, description: row.description || '', boundaryGeoJson: row.boundaryGeoJson || '', centerLongitude: row.centerLongitude, centerLatitude: row.centerLatitude, sortOrder: row.sortOrder }); dialogOpen.value = true; }
function updateNumber(field: 'centerLongitude' | 'centerLatitude' | 'sortOrder', value: string) { form[field] = (value === '' ? (field === 'sortOrder' ? 0 : null) : Number(value)) as never; }
async function save() { const body = { ...form, museumId: museumId.value, parentAreaId: form.parentAreaId || null, description: form.description || null, boundaryGeoJson: form.boundaryGeoJson || null }; await request(form.id ? `/api/site-area/${form.id}` : '/api/site-area', { method: form.id ? 'PUT' : 'POST', body }); dialogOpen.value = false; await load(); }
async function remove(row: SiteAreaResponse) { if (!row.id || !window.confirm(`确认删除区域“${row.name || ''}”？请先迁移其中的文化资产。`)) return; await request(`/api/site-area/${row.id}`, { method: 'DELETE' }); await load(); }
onMounted(load);
</script>

<template>
  <div class="flex min-h-full flex-col gap-4 p-4 md:p-5">
    <section class="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card px-4 py-4">
      <label class="grid min-w-64 gap-1.5 text-sm"><span class="text-muted-foreground">场馆 ID</span><Input v-model="museumId" placeholder="请输入场馆 ID" /></label>
      <Button :disabled="pending || !museumId" @click="load">{{ pending ? '查询中…' : '查询' }}</Button><Button @click="openCreate()">新增区域</Button><span class="ml-auto text-sm text-muted-foreground">{{ rows.length }} 个区域 · {{ totalAssets }} 个资产</span>
    </section>
    <p v-if="error" class="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{{ error }}</p>
    <section class="overflow-hidden rounded-xl border border-border bg-card">
      <table class="w-full text-sm"><thead class="bg-muted/50 text-left text-muted-foreground"><tr><th class="px-4 py-2.5">区域</th><th class="px-4 py-2.5">编码</th><th class="px-4 py-2.5">中心点</th><th class="px-4 py-2.5">资产数</th><th class="px-4 py-2.5 text-right">操作</th></tr></thead><tbody><tr v-for="row in rows" :key="row.id || row.areaCode || row.name" class="border-t border-border"><td class="px-4 py-3 font-medium">{{ row.name }}</td><td class="px-4 py-3 text-muted-foreground">{{ row.areaCode || '—' }}</td><td class="px-4 py-3 text-muted-foreground">{{ row.centerLongitude ?? '—' }}, {{ row.centerLatitude ?? '—' }}</td><td class="px-4 py-3">{{ row.assetCount }}</td><td class="px-4 py-3 text-right"><Button variant="ghost" @click="openCreate(row.id || '')">新增子级</Button><Button variant="ghost" @click="openEdit(row)">编辑</Button><Button variant="ghost" @click="remove(row)">删除</Button></td></tr><tr v-if="!pending && !rows.length"><td colspan="5" class="px-4 py-10 text-center text-muted-foreground">暂无区域数据</td></tr></tbody></table>
    </section>
    <Teleport to="body"><div v-if="dialogOpen" class="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"><form class="w-full max-w-2xl space-y-4 rounded-xl border border-border bg-background p-5" @submit.prevent="save"><div class="flex items-center justify-between"><h2 class="text-lg font-semibold">{{ editing ? '编辑区域' : '新增区域' }}</h2><button type="button" class="text-muted-foreground" @click="dialogOpen = false">关闭</button></div><div class="grid gap-3 md:grid-cols-2"><label class="grid gap-1.5 text-sm">名称<Input v-model="form.name" required /></label><label class="grid gap-1.5 text-sm">编码<Input v-model="form.areaCode" required /></label><label class="grid gap-1.5 text-sm">区域类型<Select :model-value="String(form.areaType)" @update:model-value="form.areaType = Number($event)"><option v-for="type in 6" :key="type" :value="type">类型 {{ type }}</option></Select></label><label class="grid gap-1.5 text-sm">排序<Input :model-value="String(form.sortOrder)" type="number" @update:model-value="updateNumber('sortOrder', $event)" /></label><label class="grid gap-1.5 text-sm">中心经度<Input :model-value="form.centerLongitude == null ? '' : String(form.centerLongitude)" type="number" step="0.000001" @update:model-value="updateNumber('centerLongitude', $event)" /></label><label class="grid gap-1.5 text-sm">中心纬度<Input :model-value="form.centerLatitude == null ? '' : String(form.centerLatitude)" type="number" step="0.000001" @update:model-value="updateNumber('centerLatitude', $event)" /></label></div><label class="grid gap-1.5 text-sm">说明<Textarea v-model="form.description" rows="3" /></label><label class="grid gap-1.5 text-sm">区域边界 GeoJSON<Textarea v-model="form.boundaryGeoJson" rows="5" placeholder="可填写 Polygon 或 MultiPolygon" /></label><div class="flex justify-end gap-2 border-t border-border pt-3"><Button type="button" variant="ghost" @click="dialogOpen = false">取消</Button><Button type="submit">保存</Button></div></form></div></Teleport>
  </div>
</template>
