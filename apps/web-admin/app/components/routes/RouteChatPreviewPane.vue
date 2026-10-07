<script setup lang="ts">
import { computed } from 'vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type { RouteBuildTaskProgress } from '@/types/route';
import type {
  ChatExhibitSummary,
  ChatRouteDetailPayload,
} from '@/types/chat';

interface Props {
  routeDetail: ChatRouteDetailPayload | null;
  exhibits: ChatExhibitSummary[];
  /** 轮询得到的创建进度；无路线时为 null，由本组件区分「未生成」和「读取中」 */
  creationProgress?: RouteBuildTaskProgress | null;
  contextRouteId?: string;
  publishedHint?: string;
}

const props = withDefaults(defineProps<Props>(), {
  creationProgress: null,
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

const progress = computed(() => props.creationProgress);

/** 无 routeId 说明还没生成路线；有 routeId 但没快照只是轮询首次请求还没回来 */
const hasRoute = computed(() => Boolean(routeId.value));

const progressCardClass = computed(() => ({
  'border-border/70 bg-muted/20': progress.value?.tone === 'running',
  'border-emerald-400/40 bg-emerald-400/10': progress.value?.tone === 'completed',
  'border-destructive/30 bg-destructive/5': progress.value?.tone === 'failed',
}));

const progressTitleClass = computed(() => ({
  'text-foreground': progress.value?.tone === 'running',
  'text-emerald-500': progress.value?.tone === 'completed',
  'text-destructive': progress.value?.tone === 'failed',
}));

const progressBarClass = computed(() => ({
  'bg-primary': progress.value?.tone === 'running',
  'bg-emerald-400': progress.value?.tone === 'completed',
  'bg-destructive': progress.value?.tone === 'failed',
}));

/** 数据新鲜度；轮询是唯一的进度来源，让使用者能判断快照有多旧 */
const updatedAtText = computed(() => {
  const updatedAt = progress.value?.updatedAt;

  if (!updatedAt) {
    return '';
  }

  const date = new Date(updatedAt);
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
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

      <section class="space-y-2">
        <div class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <AppIcon name="sparkles" class="h-3.5 w-3.5" />
          创建进度
        </div>

        <div
          v-if="!hasRoute"
          class="rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
          路线生成后显示创建进度。
        </div>

        <div
          v-else-if="!progress"
          class="rounded-lg border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
          正在读取创建进度…
        </div>

        <div
          v-else
          class="rounded-lg border px-3 py-3"
          :class="progressCardClass">
          <div class="flex items-start justify-between gap-2">
            <p class="min-w-0 text-sm" :class="progressTitleClass">
              {{ progress.title }}
            </p>
            <span
              v-if="progress.tone === 'running'"
              class="mt-0.5 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
          </div>

          <p v-if="progress.meta" class="mt-0.5 text-xs text-muted-foreground">
            {{ progress.meta }}
          </p>

          <div
            v-if="progress.progressPercent !== null"
            class="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full transition-[width] duration-300"
              :class="progressBarClass"
              :style="{ width: `${progress.progressPercent}%` }" />
          </div>
          <p
            v-if="progress.progressPercent !== null"
            class="mt-1 text-xs text-muted-foreground">
            整体进度 {{ progress.progressPercent }}%
          </p>

          <p v-if="progress.errorMessage" class="mt-2 text-xs text-destructive">
            {{ progress.errorMessage }}
          </p>

          <ul v-if="progress.tasks.length" class="mt-2 space-y-1">
            <li
              v-for="task in progress.tasks"
              :key="task.key"
              class="flex items-center justify-between gap-2 text-xs">
              <span
                class="min-w-0 truncate"
                :class="task.failed ? 'text-destructive' : 'text-foreground/80'"
                :title="task.label">
                {{ task.label }}
              </span>
              <span
                v-if="task.progressPercent !== null"
                class="shrink-0 text-muted-foreground">
                {{ task.progressPercent }}%
              </span>
            </li>
          </ul>

          <p v-if="updatedAtText" class="mt-2 text-[11px] text-muted-foreground/70">
            更新于 {{ updatedAtText }}
          </p>
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
