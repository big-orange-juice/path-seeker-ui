<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import CulturalPlaceFormDialog from '@/components/museum-management/CulturalPlaceFormDialog.vue';
import { useCulturalPlaces } from '@/composables/useCulturalPlaces';
import type { CulturalPlaceDraft } from '@/types/cultural-place';
import type { CreateRouteStagePayload } from '@/types/route';

const props = defineProps<{ open: boolean; routeId: string; museumId: string; nextOrder: number; canEdit: boolean }>();
const emit = defineEmits<{ 'update:open': [open: boolean]; created: [stageId: string] }>();
const { request } = useApiClient();
const places = useCulturalPlaces(() => props.open ? props.museumId : undefined);
const enabledPlaces = computed(() => places.records.value.filter(place => place.status === 1));
const title = shallowRef('');
const placeId = shallowRef('');
const saving = shallowRef(false);
const error = shallowRef('');
const placeFormOpen = shallowRef(false);
const placeSaving = shallowRef(false);
const placeError = shallowRef('');
const model = computed({ get: () => props.open, set: value => { if (!saving.value) emit('update:open', value); } });
watch(() => props.open, open => { if (open) { title.value = ''; placeId.value = ''; error.value = ''; } });
watch(placeId, id => { const place = enabledPlaces.value.find(item => item.id === id); if (place) title.value = place.name; });

async function savePlace(draft: CulturalPlaceDraft) {
  if (!props.canEdit || placeSaving.value || draft.museumId !== props.museumId) return;
  placeSaving.value = true;
  placeError.value = '';
  try {
    await places.save(draft);
    const created = places.records.value.find(item => item.code === draft.code);
    if (!created) throw new Error('景点已保存，请刷新后选择。');
    placeId.value = created.id;
    placeFormOpen.value = false;
  } catch (caught) {
    placeError.value = caught instanceof Error ? caught.message : '景点保存失败。';
  } finally { placeSaving.value = false; }
}

async function create() {
  if (saving.value || !props.canEdit || !props.routeId || !title.value.trim()) return;
  saving.value = true;
  error.value = '';
  try {
    const id = await request<string>('/api/route/stage-create', {
      method: 'POST',
      body: { routeId: props.routeId, stageNo: props.nextOrder, sortOrder: props.nextOrder,
        title: title.value.trim(), interactionType: 11, placeId: placeId.value || null,
        isRequired: 1, unlockRule: 1, score: 0, config: '{}' } satisfies CreateRouteStagePayload,
    });
    if (!id) throw new Error('未获取到新站点，请刷新路线后查看。');
    emit('created', id);
    emit('update:open', false);
  } catch (caught) { error.value = caught instanceof Error ? caught.message : '新增站点失败。'; }
  finally { saving.value = false; }
}
</script>

<template>
  <Dialog v-model:open="model">
    <DialogContent class="max-w-[440px] rounded-xl p-0">
      <DialogHeader class="border-b px-5 py-3 text-left">
        <DialogTitle>新增站点</DialogTitle>
        <DialogDescription>选择沿途景点，创建后补充解说和媒体内容。</DialogDescription>
      </DialogHeader>
      <form class="space-y-3 px-5 py-4" @submit.prevent="create">
        <label class="block space-y-1 text-sm">关联景点<Select v-model="placeId" :disabled="saving || places.pending.value"><option value="">不关联景点（开场或总结）</option><option v-for="place in enabledPlaces" :key="place.id" :value="place.id">{{ place.name }}</option></Select></label>
        <div class="flex justify-end"><Button type="button" size="sm" variant="outline" :disabled="!canEdit || saving || !museumId" @click="placeError = ''; placeFormOpen = true">新增景点</Button></div>
        <label class="block space-y-1 text-sm">站点名称<Input v-model="title" required maxlength="200" :disabled="saving" /></label>
        <p v-if="places.error.value || error" class="text-xs text-rose-300" role="alert">{{ error || places.error.value }}</p>
        <DialogFooter class="pt-2"><Button type="button" variant="outline" :disabled="saving" @click="model = false">取消</Button><Button type="submit" :disabled="saving || !canEdit || !title.trim()">{{ saving ? '创建中…' : '创建站点' }}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
  <CulturalPlaceFormDialog :open="placeFormOpen" :museum-id="museumId" :record="null" :pending="placeSaving" :error="placeError" entity-label="景点" @update:open="placeFormOpen = $event" @save="savePlace" />
</template>
