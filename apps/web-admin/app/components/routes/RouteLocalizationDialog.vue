<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { TOUR_LANGUAGES } from '@path-seeker/ts-shared';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import type { RouteRecord, RouteTranslationResponse } from '@/types/route';

const props = defineProps<{ open: boolean; record: RouteRecord | null }>();
const emit = defineEmits<{ 'update:open': [value: boolean]; created: [] }>();
const { request } = useApiClient();
const languages = TOUR_LANGUAGES.filter(language => language.value !== 'zh');
const selected = shallowRef<string[]>(['en', 'ru', 'es']);
const pending = shallowRef(false);
const results = shallowRef<string[]>([]);
const error = shallowRef('');
const sourceId = computed(() => (props.record?.locale || 'zh') === 'zh' ? props.record?.id : props.record?.sourceRouteId);
watch(() => props.open, open => { if (open) { selected.value = ['en', 'ru', 'es']; results.value = []; error.value = ''; } });

function toggle(value: string, checked: boolean) { selected.value = checked ? [...selected.value, value] : selected.value.filter(item => item !== value); }

async function create() {
  if (!sourceId.value || !selected.value.length || pending.value) return;
  pending.value = true;
  error.value = '';
  try {
    for (const locale of [...selected.value]) {
      const result = await request<RouteTranslationResponse>('/api/route/create-translation', { method: 'POST', body: { routeId: sourceId.value, locale } });
      if (!result?.routeId) throw new Error('语言版本创建失败，请重试。');
      const label = languages.find(language => language.value === locale)?.label || locale;
      results.value = [...results.value, `${label}：${result.reused ? '已存在，已复用' : '草稿已创建'}`];
      selected.value = selected.value.filter(item => item !== locale);
      emit('created');
    }
  } catch (caught) { error.value = caught instanceof Error ? caught.message : '语言版本创建失败。'; }
  finally { pending.value = false; }
}
</script>

<template>
  <Dialog :open="open" @update:open="!pending && emit('update:open', Boolean($event))"><DialogContent class="max-w-lg"><DialogHeader><DialogTitle>多语言转换 · {{ record?.title }}</DialogTitle></DialogHeader><p class="text-sm text-muted-foreground">以中文路线为源版本，保留停靠顺序和地图，创建目标语言草稿。补齐译文后可提交审核。</p><div class="flex flex-wrap gap-4"><label v-for="language in languages" :key="language.value" class="flex items-center gap-2 text-sm"><input type="checkbox" :checked="selected.includes(language.value)" :disabled="pending" @change="toggle(language.value, ($event.target as HTMLInputElement).checked)">{{ language.label }}</label></div><p v-for="result in results" :key="result" class="text-sm text-emerald-300">{{ result }}</p><p v-if="error || !sourceId" class="text-sm text-destructive">{{ error || '此路线没有可用的中文源版本。' }}</p><div class="flex justify-end gap-2"><Button variant="outline" :disabled="pending" @click="emit('update:open', false)">关闭</Button><Button :disabled="pending || !selected.length || !sourceId" @click="create">{{ pending ? '创建中…' : '创建语言版本' }}</Button></div></DialogContent></Dialog>
</template>
