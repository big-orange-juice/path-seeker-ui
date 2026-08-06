<script setup lang="ts">
import { computed } from 'vue';
import { getInteractionTypeMeta } from '@path-seeker/game-renderer';
import AppIcon from '@/components/ui/AppIcon.vue';
import type {
  ChatExhibitSummary,
  ChatRouteBuildProgressState,
  ChatRouteDetailPayload,
} from '@/types/chat';

interface Props {
  routeDetail: ChatRouteDetailPayload | null;
  exhibits: ChatExhibitSummary[];
  buildProgress?: ChatRouteBuildProgressState | null;
  contextRouteId?: string;
  publishedHint?: string;
}

const props = withDefaults(defineProps<Props>(), {
  buildProgress: null,
  contextRouteId: '',
  publishedHint: '',
});

const routeTitle = computed(() =>
  String(props.routeDetail?.title || '').trim() || '尚未生成路线',
);

const routeTheme = computed(() =>
  String(props.routeDetail?.theme || '').trim() || '—',
);

const routeId = computed(() =>
  String(props.routeDetail?.id || props.contextRouteId || '').trim(),
);

const formatExhibitMeta = (exhibit: ChatExhibitSummary) =>
  [exhibit.dynasty, exhibit.category, exhibit.exhibitCode].filter(Boolean).join(' · ');

const progress = computed(() => props.buildProgress);

const progressPercent = computed(() => {
  const item = progress.value;

  if (!item || item.totalCount <= 0) {
    return 0;
  }

  // 与文案统一：按累计「已创建 / 总数」计算，避免 processed 与 created 口径不一致。
  const ratio = item.createdCount / item.totalCount;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
});

const interactionLabel = computed(() => {
  const type = progress.value?.interactionType;

  if (type == null || Number.isNaN(type)) {
    return '';
  }

  return getInteractionTypeMeta(type)?.label || `玩法 ${type}`;
});

const progressTone = computed(() => {
  const status = progress.value?.status;

  if (status === 'failed') {
    return 'failed';
  }

  if (status === 'completed') {
    return 'completed';
  }

  return 'running';
});
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col">
    <div class="border-b border-border/70 px-4 py-3">
      <p class="text-sm font-medium">
        生成结果
      </p>
      <p class="mt-0.5 text-xs text-muted-foreground">
        对话过程中的路线与文物摘要
      </p>
    </div>

    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      <section class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <AppIcon name="route" class="h-3.5 w-3.5" />
          当前路线
        </div>
        <div class="rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
          <p class="text-sm font-medium">
            {{ routeTitle }}
          </p>
          <dl class="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <div class="flex gap-2">
              <dt class="shrink-0">主题</dt>
              <dd class="min-w-0 break-words text-foreground/80">
                {{ routeTheme }}
              </dd>
            </div>
            <div v-if="routeId" class="flex gap-2">
              <dt class="shrink-0">编号</dt>
              <dd class="min-w-0 break-all text-foreground/80">
                {{ routeId }}
              </dd>
            </div>
          </dl>
          <p v-if="props.publishedHint" class="mt-2 text-xs text-emerald-400">
            {{ props.publishedHint }}
          </p>
        </div>
      </section>

      <section v-if="progress" class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <AppIcon name="sparkles" class="h-3.5 w-3.5" />
          站点生成
        </div>
        <div
          class="rounded-lg border px-3 py-3"
          :class="{
            'border-border/70 bg-muted/20': progressTone === 'running',
            'border-emerald-400/40 bg-emerald-400/10': progressTone === 'completed',
            'border-destructive/30 bg-destructive/5': progressTone === 'failed',
          }">
          <p
            class="text-sm"
            :class="{
              'text-foreground': progressTone === 'running',
              'text-emerald-500': progressTone === 'completed',
              'text-destructive': progressTone === 'failed',
            }">
            {{ progress.message }}
          </p>
          <dl class="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <div v-if="progress.exhibitName" class="flex gap-2">
              <dt class="shrink-0">文物</dt>
              <dd class="min-w-0 break-words text-foreground/80">
                {{ progress.exhibitName }}
              </dd>
            </div>
            <div v-if="interactionLabel" class="flex gap-2">
              <dt class="shrink-0">玩法</dt>
              <dd class="min-w-0 text-foreground/80">
                {{ interactionLabel }}
              </dd>
            </div>
            <div class="flex gap-2">
              <dt class="shrink-0">进度</dt>
              <dd class="min-w-0 text-foreground/80">
                已创建 {{ progress.createdCount }}/{{ progress.totalCount }}
                <template v-if="progress.failedCount > 0">
                  · 失败 {{ progress.failedCount }}
                </template>
              </dd>
            </div>
          </dl>
          <div class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              :class="{
                'bg-primary': progressTone === 'running',
                'bg-emerald-400': progressTone === 'completed',
                'bg-destructive': progressTone === 'failed',
              }"
              :style="{ width: `${progressPercent}%` }" />
          </div>
        </div>
      </section>

      <section class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <AppIcon name="library" class="h-3.5 w-3.5" />
          关联文物
        </div>
        <div v-if="!props.exhibits.length" class="rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
          对话中选中的文物会显示在这里。
        </div>
        <ul v-else class="space-y-2">
          <li
            v-for="(exhibit, index) in props.exhibits"
            :key="String(exhibit.id || index)"
            class="rounded-lg border border-border/70 px-3 py-2">
            <p class="text-sm text-foreground">
              {{ exhibit.name || '未命名文物' }}
            </p>
            <p
              v-if="formatExhibitMeta(exhibit)"
              class="mt-0.5 text-xs text-muted-foreground">
              {{ formatExhibitMeta(exhibit) }}
            </p>
            <p v-if="exhibit.id" class="mt-0.5 break-all text-xs text-muted-foreground/80">
              {{ exhibit.id }}
            </p>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
