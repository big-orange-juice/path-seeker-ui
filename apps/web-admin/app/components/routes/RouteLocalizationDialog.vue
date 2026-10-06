<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { Check, Languages, LoaderCircle } from 'lucide-vue-next';
import { TOUR_LANGUAGES } from '@path-seeker/ts-shared';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogFooter from '@/components/shadcn/dialog/DialogFooter.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import type { RouteRecord, RouteTranslationResponse } from '@/types/route';

const props = defineProps<{ open: boolean; record: RouteRecord | null }>();
const emit = defineEmits<{ 'update:open': [value: boolean]; created: [] }>();
const { request } = useApiClient();
const languages = TOUR_LANGUAGES.filter(language => language.value !== 'zh');
const selected = shallowRef<string[]>(languages.map(language => language.value));
const pending = shallowRef(false);
const results = shallowRef<string[]>([]);
const error = shallowRef('');
const sourceId = computed(() => (props.record?.locale || 'zh') === 'zh' ? props.record?.id : props.record?.sourceRouteId);
watch(() => props.open, open => { if (open) { selected.value = languages.map(language => language.value); results.value = []; error.value = ''; } });

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
      results.value = [...results.value, `${label}：${result.reused ? '已存在，已复用' : '草稿已创建'}，翻译任务 ${result.translationTaskId || '已排队'}`];
      selected.value = selected.value.filter(item => item !== locale);
      emit('created');
    }
  } catch (caught) { error.value = caught instanceof Error ? caught.message : '语言版本创建失败。'; }
  finally { pending.value = false; }
}
</script>

<template>
  <Dialog :open="open" @update:open="!pending && emit('update:open', Boolean($event))">
    <DialogContent class="flex max-w-[min(94vw,36rem)] flex-col overflow-hidden rounded-xl p-0 text-left">
      <DialogHeader class="shrink-0 border-b border-border/70 px-5 py-4 pr-12">
        <div class="flex items-center gap-3">
          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
            <Languages class="h-5 w-5" aria-hidden="true" />
          </div>
          <div class="min-w-0">
            <DialogTitle class="text-base font-semibold leading-6">多语言转换</DialogTitle>
            <p class="mt-0.5 break-words text-sm text-muted-foreground">{{ record?.title || '当前路线' }}</p>
          </div>
        </div>
      </DialogHeader>

      <div class="min-h-0 space-y-4 overflow-y-auto px-5 py-4">
        <DialogDescription class="text-sm leading-6 text-muted-foreground">
          基于中文路线创建并自动翻译目标语言草稿，保留站点顺序和地图。完成后可校对译文并提交审核。
        </DialogDescription>

        <fieldset :disabled="pending" class="min-w-0">
          <legend class="w-full pb-3">
            <span class="flex items-center justify-between gap-3">
              <span class="text-sm font-medium text-foreground">目标语言</span>
              <span class="text-xs text-muted-foreground" aria-live="polite">已选 {{ selected.length }} / {{ languages.length }}</span>
            </span>
          </legend>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <label
              v-for="language in languages"
              :key="language.value"
              class="relative min-w-0"
              :class="pending ? 'cursor-wait opacity-60' : 'cursor-pointer'"
            >
              <input
                type="checkbox"
                class="peer sr-only"
                :checked="selected.includes(language.value)"
                @change="toggle(language.value, ($event.target as HTMLInputElement).checked)"
              >
              <span class="flex items-center gap-2.5 rounded-lg border border-border bg-background/40 px-3 py-3 text-sm text-foreground transition-colors peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background peer-enabled:hover:border-primary/40">
                <span
                  class="flex h-4 w-4 shrink-0 items-center justify-center rounded border"
                  :class="selected.includes(language.value) ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/50 bg-background'"
                  aria-hidden="true"
                >
                  <Check v-if="selected.includes(language.value)" class="h-3 w-3" :stroke-width="3" />
                </span>
                <span class="min-w-0 break-words font-medium">{{ language.label }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div v-if="results.length" class="space-y-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5" role="status" aria-live="polite">
          <p v-for="result in results" :key="result" class="break-words text-xs leading-5 text-emerald-300">{{ result }}</p>
        </div>
        <p v-if="error || !sourceId" class="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm leading-5 text-destructive" role="alert">
          {{ error || '此路线没有可用的中文源版本。' }}
        </p>
      </div>

      <DialogFooter class="shrink-0 gap-2 border-t border-border/70 bg-background/30 px-5 py-3">
        <Button variant="outline" :disabled="pending" @click="emit('update:open', false)">关闭</Button>
        <Button :disabled="pending || !selected.length || !sourceId" class="shadow-none" @click="create">
          <LoaderCircle v-if="pending" class="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
          {{ pending ? '创建中…' : '创建语言版本' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
