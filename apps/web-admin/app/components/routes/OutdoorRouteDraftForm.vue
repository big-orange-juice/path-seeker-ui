<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { TOUR_LANGUAGES, type TourLocale } from '@path-seeker/ts-shared';
import Button from '@/components/shadcn/button/Button.vue';
import Input from '@/components/shadcn/input/Input.vue';
import Select from '@/components/shadcn/select/Select.vue';
import OutdoorStopPicker from '@/components/routes/OutdoorStopPicker.vue';
import { useCulturalPlaces } from '@/composables/useCulturalPlaces';
import type { BuildOutdoorRouteDraftResponse, RouteTranslationResponse } from '@/types/route';

const props = defineProps<{ museumId: string }>();
const emit = defineEmits<{ created: [routeId: string] }>();
const places = useCulturalPlaces(() => props.museumId);
const { request } = useApiClient();
const title = shallowRef('');
const theme = shallowRef('');
const locale = shallowRef<TourLocale>('zh');
const transportMode = shallowRef('rickshaw');
const estimatedMinutes = shallowRef('60');
const distanceMeters = shallowRef('');
const guideId = shallowRef('');
const selected = shallowRef<string[]>([]);
const saving = shallowRef(false);
const error = shallowRef('');
const createdId = shallowRef('');
const canCreate = computed(() => Boolean(props.museumId && title.value.trim() && selected.value.length >= 2));

watch(() => props.museumId, () => { selected.value = []; createdId.value = ''; });

async function create() {
  if (saving.value || !canCreate.value) return;
  saving.value = true;
  error.value = '';
  try {
    if (!createdId.value) {
      const result = await request<BuildOutdoorRouteDraftResponse>('/api/route/build-outdoor-draft', {
        method: 'POST', body: { museumId: props.museumId, title: title.value.trim(), theme: theme.value.trim() || null, locale: 'zh', transportMode: transportMode.value, placeIds: selected.value, guideId: guideId.value || null, estimatedMinutes: estimatedMinutes.value ? Number(estimatedMinutes.value) : null, distanceMeters: distanceMeters.value ? Number(distanceMeters.value) : null },
      });
      if (!result?.routeId) throw new Error('未获取到创建的路线，请刷新列表查看。');
      createdId.value = result.routeId;
      emit('created', result.routeId);
    }
    if (locale.value !== 'zh') {
      const translated = await request<RouteTranslationResponse>('/api/route/create-translation', { method: 'POST', body: { routeId: createdId.value, locale: locale.value } });
      if (translated?.routeId) emit('created', translated.routeId);
    }
    error.value = '';
  } catch (caught) { error.value = caught instanceof Error ? caught.message : '路线创建失败。'; }
  finally { saving.value = false; }
}
</script>

<template>
  <form class="space-y-4 overflow-auto p-5" @submit.prevent="create">
    <div class="grid grid-cols-2 gap-3"><label class="space-y-1 text-sm">路线标题<Input v-model="title" required maxlength="200" :disabled="saving || Boolean(createdId)" /></label><label class="space-y-1 text-sm">主题<Input v-model="theme" maxlength="200" :disabled="saving || Boolean(createdId)" /></label><label class="space-y-1 text-sm">路线语言<Select v-model="locale" :disabled="saving"><option v-for="language in TOUR_LANGUAGES" :key="language.value" :value="language.value">{{ language.label }}</option></Select></label><label class="space-y-1 text-sm">交通方式<Select v-model="transportMode" :disabled="saving || Boolean(createdId)"><option value="rickshaw">黄包车</option><option value="walk">步行</option><option value="mixed">混合接驳</option></Select></label><label class="space-y-1 text-sm">预计时长（分钟）<Input v-model="estimatedMinutes" type="number" min="1" :disabled="saving || Boolean(createdId)" /></label><label class="space-y-1 text-sm">里程（米）<Input v-model="distanceMeters" type="number" min="0" :disabled="saving || Boolean(createdId)" /></label></div>
    <p v-if="places.pending.value" class="text-sm text-muted-foreground">正在加载文化点…</p>
    <p v-if="places.error.value" class="text-sm text-destructive">{{ places.error.value }}</p>
    <OutdoorStopPicker v-model="selected" :places="places.records.value" :disabled="saving || Boolean(createdId)" />
    <p v-if="createdId" class="text-sm text-emerald-300">中文源路线已保存为草稿，可返回列表补充讲解后提交审核。</p>
    <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
    <div class="flex justify-end"><Button type="submit" :disabled="saving || !canCreate || (Boolean(createdId) && !error)">{{ saving ? '创建中…' : createdId && error ? '重试语言版本' : '创建路线草稿' }}</Button></div>
  </form>
</template>
