<script setup lang="ts">
import { reactive, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import Textarea from '@/components/shadcn/textarea/Textarea.vue';
import ImageUpload from '@/components/ui/ImageUpload.vue';
import type { CulturalPlaceArchive, CulturalPlaceDraft, CulturalPlaceRecord } from '@/types/cultural-place';
import { useApiClient } from '@/composables/useApiClient';
import type { UploadAttachment } from '@/types/upload';

const props = withDefaults(defineProps<{ open: boolean; museumId: string; record: CulturalPlaceRecord | null; pending: boolean; error: string; requireCoordinates?: boolean; initialPosition?: { longitude: number; latitude: number; coordinateSystem: number } | null; entityLabel?: string }>(), { requireCoordinates: true, initialPosition: null, entityLabel: '文化点' });
const emit = defineEmits<{ 'update:open': [value: boolean]; save: [draft: CulturalPlaceDraft] }>();
const draft = reactive<CulturalPlaceDraft>({ museumId: '', code: '', name: '', category: '', address: '', description: '', recommendedMinutes: 10, longitude: null, latitude: null, coordinateSystem: 1, status: 1, coverAttachmentId: null, sortOrder: 0 });
const cover = shallowRef<string[]>([]);
const validationError = shallowRef('');
const metadataPending = shallowRef(false);
const metadataFailed = shallowRef(false);
const { request } = useApiClient();
let loadVersion = 0;
const archiveFields: Array<{ key: keyof CulturalPlaceArchive; label: string; rows?: number; placeholder?: string }> = [
  { key: 'formalName', label: '正式名称' },
  { key: 'era', label: '历史时期' },
  { key: 'establishedText', label: '始建时间' },
  { key: 'currentFunction', label: '当前用途' },
  { key: 'protectionLevel', label: '保护级别' },
  { key: 'historicalEvolution', label: '历史沿革', rows: 4 },
  { key: 'backgroundStories', label: '故事与传说', rows: 4 },
  { key: 'culturalContext', label: '文化背景', rows: 4 },
  { key: 'architecturalFeatures', label: '建筑 / 景观特色', rows: 4 },
  { key: 'culturalSignificance', label: '文化价值', rows: 4 },
  { key: 'visitingTips', label: '游览提示', rows: 3 },
];
const structuredFields: Array<{ key: keyof CulturalPlaceArchive; label: string; placeholder: string }> = [
  { key: 'keyPersonTimeline', label: '人物与事件时间线', placeholder: '[{"period":"历史时期","person":"相关人物","description":"事件经过"}]' },
  { key: 'coreMemoryPoints', label: '核心记忆点', placeholder: '[{"title":"记忆点标题","description":"说明"}]' },
  { key: 'referenceSources', label: '参考来源', placeholder: '[{"title":"资料名称","url":"https://..."}]' },
  { key: 'relationshipClues', label: '关联线索', placeholder: '[{"targetHint":"关联人物或地点","narrative":"关联说明"}]' },
];

function syncMetadata(record: CulturalPlaceRecord | null) {
  draft.extraList = (record?.extraList ?? []).map(item => ({ ...item }));
  draft.archive = { ...(record?.archive ?? {}) };
}

watch(() => props.record?.id, id => { if (props.open && id) draft.id = id; });

watch(() => props.open, open => {
  if (!open) return;
  validationError.value = '';
  const record = props.record;
  Object.assign(draft, { id: record?.id, museumId: props.museumId, code: record?.code || '', name: record?.name || '', category: record?.category || '', address: record?.address || '', description: record?.description || '', recommendedMinutes: record ? record.recommendedMinutes : 10, longitude: record?.longitude ?? props.initialPosition?.longitude ?? null, latitude: record?.latitude ?? props.initialPosition?.latitude ?? null, coordinateSystem: record?.coordinateSystem ?? props.initialPosition?.coordinateSystem ?? 1, status: record?.status ?? 1, coverAttachmentId: record?.coverAttachmentId ?? null, sortOrder: record?.sortOrder ?? 0 });
  cover.value = record?.coverUrl ? [record.coverUrl] : [];
  syncMetadata(record);
  const version = ++loadVersion;
  metadataPending.value = false;
  metadataFailed.value = false;
  if (record) {
    metadataPending.value = true;
    request<CulturalPlaceRecord>('/api/cultural-place/' + record.id).then(result => {
      if (version === loadVersion && props.open) syncMetadata(result);
    }).catch(caught => {
      if (version === loadVersion && props.open) {
        metadataFailed.value = true;
        validationError.value = caught instanceof Error ? caught.message : '补充资料加载失败，请关闭后重试。';
      }
    }).finally(() => { if (version === loadVersion) metadataPending.value = false; });
  }
});

function addExtra() {
  draft.extraList ??= [];
  draft.extraList.push({ attrKey: '', attrValue: '', valueType: 1, groupName: '', sortOrder: draft.extraList.length });
}

function setArchiveField(key: keyof CulturalPlaceArchive, value: string) {
  if (draft.archive) Object.assign(draft.archive, { [key]: value });
}

function uploaded(files: UploadAttachment[]) {
  if (files[0]?.fileUrl) { draft.coverAttachmentId = files[0].fileId; cover.value = [files[0].fileUrl]; }
}

function submit() {
  if (props.pending || metadataPending.value || metadataFailed.value) return;
  validationError.value = '';
  if ((draft.longitude == null) !== (draft.latitude == null)) {
    validationError.value = '经度与纬度必须同时填写或同时留空。';
    return;
  }
  for (const field of structuredFields) {
    const value = draft.archive?.[field.key];
    if (typeof value !== 'string' || !value.trim()) continue;
    try { if (Array.isArray(JSON.parse(value))) continue; } catch { }
    validationError.value = field.label + '必须为有效 JSON 数组。';
    return;
  }
  const keys = (draft.extraList ?? []).map(item => item.attrKey.trim().toLowerCase());
  if (keys.some(key => !key) || new Set(keys).size !== keys.length) {
    validationError.value = '补充属性名称不能为空或重复。';
    return;
  }
  emit('save', { ...draft, code: draft.code.trim(), name: draft.name.trim(), coverAttachmentId: cover.value.length ? draft.coverAttachmentId : null, extraList: draft.extraList?.map(item => ({ ...item, attrKey: item.attrKey.trim() })), archive: draft.archive ? { ...draft.archive } : null });
}
</script>

<template>
  <Dialog :open="open" @update:open="!pending && emit('update:open', Boolean($event))">
    <DialogContent class="flex h-[85vh] max-w-[min(96vw,1200px)] flex-col overflow-hidden p-0">
      <DialogHeader class="shrink-0 border-b border-border/70 px-6 py-4 pr-12"><DialogTitle>{{ record ? '编辑' : '新增' }}{{ entityLabel }}</DialogTitle></DialogHeader>
      <form class="flex min-h-0 flex-1 flex-col overflow-hidden" @submit.prevent="submit">
        <div class="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-1 text-sm">名称<Input v-model="draft.name" required maxlength="200" :disabled="pending" /></label>
          <label class="space-y-1 text-sm">编码<Input v-model="draft.code" required maxlength="64" :disabled="pending" /></label>
          <label class="space-y-1 text-sm">分类<Input :model-value="draft.category || ''" maxlength="64" :disabled="pending" @update:model-value="draft.category = $event" /></label>
          <label class="space-y-1 text-sm">建议停留（分钟）<Input :model-value="String(draft.recommendedMinutes ?? '')" type="number" min="0" :disabled="pending" @update:model-value="draft.recommendedMinutes = $event ? Number($event) : null" /></label>
          <label class="space-y-1 text-sm">经度<Input :model-value="String(draft.longitude ?? '')" type="number" step="any" min="-180" max="180" :required="requireCoordinates" :disabled="pending" @update:model-value="draft.longitude = $event ? Number($event) : null" /></label>
          <label class="space-y-1 text-sm">纬度<Input :model-value="String(draft.latitude ?? '')" type="number" step="any" min="-90" max="90" :required="requireCoordinates" :disabled="pending" @update:model-value="draft.latitude = $event ? Number($event) : null" /></label>
          <label class="space-y-1 text-sm">坐标系<Select :model-value="String(draft.coordinateSystem)" :disabled="pending" @update:model-value="draft.coordinateSystem = Number($event)"><option value="1">WGS84</option><option value="2">GCJ-02</option><option value="3">BD-09</option></Select></label>
          <label class="space-y-1 text-sm">排序<Input :model-value="String(draft.sortOrder)" type="number" :disabled="pending" @update:model-value="draft.sortOrder = Number($event)" /></label>
        </div>
        <label class="block space-y-1 text-sm">地址<Input :model-value="draft.address || ''" maxlength="500" :disabled="pending" @update:model-value="draft.address = $event" /></label>
        <label class="block space-y-1 text-sm">简介<Textarea :model-value="draft.description || ''" rows="4" :disabled="pending" @update:model-value="draft.description = $event" /></label>
        <fieldset class="space-y-1 text-sm" :disabled="pending">封面<ImageUpload v-model="cover" :multiple="false" @uploaded="uploaded" /></fieldset>
        <label v-if="record" class="block space-y-1 text-sm">状态<Select :model-value="String(draft.status)" :disabled="pending" @update:model-value="draft.status = Number($event)"><option value="1">启用</option><option value="2">停用</option></Select></label>
        <fieldset class="space-y-4 border-t border-border/70 pt-5" :disabled="pending || metadataPending">
          <legend class="text-base font-medium">补充资料</legend>
          <p v-if="metadataPending" class="text-sm text-muted-foreground">正在加载补充资料…</p>
          <p class="text-sm text-muted-foreground">可维护别名、开放时间、门票、设施等补充属性。</p>
          <div v-for="(extra, index) in draft.extraList" :key="index" class="space-y-3 rounded-lg border border-border/70 p-3">
            <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-1 text-sm">属性名称<Input v-model="extra.attrKey" required maxlength="100" /></label>
              <label class="space-y-1 text-sm">类型<Select :model-value="String(extra.valueType)" @update:model-value="extra.valueType = Number($event)"><option value="1">文本</option><option value="2">数值</option><option value="3">日期</option><option value="4">JSON 数组</option><option value="5">链接</option><option value="6">长文本</option></Select></label>
              <label class="space-y-1 text-sm">分组<Input :model-value="extra.groupName ?? ''" maxlength="100" @update:model-value="extra.groupName = $event" /></label>
              <label class="space-y-1 text-sm">排序<Input :model-value="String(extra.sortOrder)" type="number" @update:model-value="extra.sortOrder = Number($event)" /></label>
            </div>
            <label class="block space-y-1 text-sm">属性内容<Textarea :model-value="extra.attrValue ?? ''" rows="2" @update:model-value="extra.attrValue = $event" /></label>
            <Button type="button" variant="ghost" :disabled="pending || metadataPending" @click="draft.extraList?.splice(index, 1)">移除属性</Button>
          </div>
          <Button type="button" variant="outline" :disabled="pending || metadataPending || (draft.extraList?.length ?? 0) >= 100" @click="addExtra">添加属性</Button>
        </fieldset>
        <fieldset v-if="draft.archive" class="space-y-4 border-t border-border/70 pt-5" :disabled="pending || metadataPending">
          <legend class="text-base font-medium">景点深度档案</legend>
          <div class="grid gap-4 sm:grid-cols-2">
            <label v-for="field in archiveFields" :key="field.key" class="block space-y-1 text-sm" :class="field.rows ? 'sm:col-span-2' : ''">{{ field.label }}
              <Textarea v-if="field.rows" :model-value="String(draft.archive[field.key] ?? '')" :rows="field.rows" @update:model-value="setArchiveField(field.key, $event)" />
              <Input v-else :model-value="String(draft.archive[field.key] ?? '')" @update:model-value="setArchiveField(field.key, $event)" />
            </label>
            <label class="space-y-1 text-sm">影响等级<Select :model-value="String(draft.archive.influenceLevel ?? 0)" @update:model-value="draft.archive.influenceLevel = Number($event)"><option value="0">未评级</option><option value="1">世界级</option><option value="2">国家级</option><option value="3">区域级</option><option value="4">一般</option></Select></label>
          </div>
          <details class="rounded-lg border border-border/70 p-3">
            <summary class="cursor-pointer text-sm font-medium">结构化资料</summary>
            <div class="mt-4 space-y-4">
              <label v-for="field in structuredFields" :key="field.key" class="block space-y-1 text-sm">{{ field.label }}<Textarea :model-value="String(draft.archive[field.key] ?? '')" rows="3" :placeholder="field.placeholder" @update:model-value="setArchiveField(field.key, $event)" /></label>
            </div>
          </details>
        </fieldset>
        <p v-if="validationError || error" class="text-sm text-destructive" role="alert">{{ validationError || error }}</p>
        </div>
        <div class="flex shrink-0 justify-end gap-2 border-t border-border/70 px-6 py-4"><Button type="button" variant="outline" :disabled="pending" @click="emit('update:open', false)">取消</Button><Button type="submit" :disabled="pending || metadataPending || metadataFailed">{{ pending ? '保存中…' : '保存' }}</Button></div>
      </form>
    </DialogContent>
  </Dialog>
</template>
