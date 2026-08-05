<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import Dialog from '@/components/shadcn/dialog/Dialog.vue';
import DialogContent from '@/components/shadcn/dialog/DialogContent.vue';
import DialogDescription from '@/components/shadcn/dialog/DialogDescription.vue';
import DialogHeader from '@/components/shadcn/dialog/DialogHeader.vue';
import DialogTitle from '@/components/shadcn/dialog/DialogTitle.vue';
import AppIcon from '@/components/ui/AppIcon.vue';
import type {
  ExhibitAiArchive,
  ExhibitExtraResponse,
  ExhibitMediaResponse,
  ExhibitRecord
} from '@/types/museum';

interface Props {
  open: boolean;
  record: ExhibitRecord | null;
  galleryLabelById?: Record<string, string>;
}

interface DisplayField {
  label: string;
  value: string;
}

interface DisplayExtraGroup {
  groupName: string;
  items: Array<{
    label: string;
    value: string;
    chips: string[];
  }>;
}

interface TimelinePhase {
  phase?: string;
  period?: string;
  description?: string;
  persons?: Array<{
    name?: string;
    role?: string;
    contribution?: string;
  }>;
}

interface MemoryPoint {
  title?: string;
  category?: string;
  description?: string;
}

interface RelationshipClue {
  clueType?: string;
  personName?: string;
  eventName?: string;
  techniqueName?: string;
  motifName?: string;
  siteName?: string;
  targetHint?: string;
  confidence?: number;
  narrative?: string;
}

const props = withDefaults(defineProps<Props>(), {
  galleryLabelById: () => ({})
});

const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const groupNameMap: Record<string, string> = {
  basic: '基础补充',
  catalog: '目录属性',
  tags: '标签'
};

const knownArchiveKeys = new Set([
  'formalName',
  'era',
  'dimensions',
  'materialCraft',
  'excavationSite',
  'currentCollection',
  'formFunction',
  'originStory',
  'backgroundStories',
  'culturalContext',
  'historicalSignificance',
  'keyPersonTimeline',
  'coreMemoryPoints',
  'historicalValueSummary',
  'relationshipClues',
  'influenceLevel'
]);

const currentRecord = computed(() => props.record);

const formatValue = (value: unknown, fallback = '未填写') => {
  const text = String(value ?? '')
    .replace(/&nbsp;/g, '')
    .trim();
  return text || fallback;
};

const hasValue = (value: unknown) => formatValue(value, '') !== '';

const parseJsonArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (typeof value !== 'string' || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const parseJsonObject = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

const aiArchive = computed<Record<string, unknown> | null>(() => {
  const record = currentRecord.value as
    | (ExhibitRecord & {
        aiAchive?: ExhibitAiArchive | string | null;
        AIachive?: ExhibitAiArchive | string | null;
      })
    | null;

  return parseJsonObject(
    record?.aiArchive ?? record?.aiAchive ?? record?.AIachive ?? null
  );
});

const getArchiveString = (key: string) => {
  const archive = aiArchive.value;
  return archive ? formatValue(archive[key], '') : '';
};

const getGalleryName = (record: ExhibitRecord) =>
  props.galleryLabelById[record.galleryId ?? ''] ||
  (record.galleryId === '0' ? '未展览' : '未分配');

const basicFields = computed<DisplayField[]>(() => {
  const record = currentRecord.value;
  if (!record) {
    return [];
  }

  return [
    { label: '馆藏编码', value: formatValue(record.exhibitCode) },
    { label: '所属展厅', value: getGalleryName(record) },
    { label: '年代', value: formatValue(record.dynasty) },
    { label: '材质', value: formatValue(record.material) },
    { label: '类别', value: formatValue(record.category) },
    { label: '展柜号', value: formatValue(record.showcaseNo) },
    {
      label: '推荐停留时长',
      value:
        record.recommendedMinutes === null
          ? '未设置'
          : `${record.recommendedMinutes} 分钟`
    },
    {
      label: '重点状态',
      value: record.isHighlight === 1 ? '重点展品' : '普通馆藏'
    },
    // { label: '二维码', value: formatValue(record.qrCode, '未生成') },
    { label: '排序号', value: String(record.sortOrder ?? 0) }
  ];
});

const archiveTags = computed(() => {
  const tagExtra = currentRecord.value?.extraList.find(
    (item) => item.attrKey === 'tags'
  );
  return parseJsonArray<string>(tagExtra?.attrValue)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
});

const groupedExtras = computed<DisplayExtraGroup[]>(() => {
  const groups = new Map<string, DisplayExtraGroup['items']>();

  for (const item of currentRecord.value?.extraList ?? []) {
    if (item.attrKey === 'tags') {
      continue;
    }

    const rawGroupName = formatValue(item.groupName, '其他信息');
    const groupName = groupNameMap[rawGroupName] || rawGroupName;
    const chips =
      item.valueType === 4
        ? parseJsonArray<string>(item.attrValue)
            .filter((chip) => typeof chip === 'string')
            .map((chip) => chip.trim())
            .filter(Boolean)
        : [];
    const groupItems = groups.get(groupName) ?? [];

    groupItems.push({
      label: formatValue(item.attrKey, '未命名属性'),
      value: chips.length ? '' : formatValue(item.attrValue, '暂无内容'),
      chips
    });
    groups.set(groupName, groupItems);
  }

  return Array.from(groups.entries()).map(([groupName, items]) => ({
    groupName,
    items
  }));
});

const mediaItems = computed<ExhibitMediaResponse[]>(() =>
  [...(currentRecord.value?.mediaList ?? [])].sort(
    (left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0)
  )
);

const archiveSummaryFields = computed<DisplayField[]>(() => {
  const archive = aiArchive.value;
  if (!archive) {
    return [];
  }

  return [
    { label: '正式名称', value: getArchiveString('formalName') },
    { label: '时代', value: getArchiveString('era') },
    { label: '尺寸', value: getArchiveString('dimensions') },
    { label: '材质工艺', value: getArchiveString('materialCraft') },
    { label: '出土地/产地', value: getArchiveString('excavationSite') },
    { label: '当前收藏', value: getArchiveString('currentCollection') },
    { label: '器形与功能', value: getArchiveString('formFunction') },
    {
      label: '影响等级',
      value: hasValue(archive.influenceLevel)
        ? String(archive.influenceLevel)
        : ''
    }
  ].filter((item) => item.value);
});

const archiveRichSections = computed(() =>
  [
    { title: '来源故事', value: getArchiveString('originStory') },
    { title: '背景故事', value: getArchiveString('backgroundStories') },
    { title: '文化语境', value: getArchiveString('culturalContext') },
    { title: '历史意义', value: getArchiveString('historicalSignificance') }
  ].filter((item) => item.value)
);

const timelinePhases = computed(() =>
  parseJsonArray<TimelinePhase>(aiArchive.value?.keyPersonTimeline).filter(
    (item) =>
      item.phase || item.period || item.description || item.persons?.length
  )
);

const memoryPoints = computed(() =>
  parseJsonArray<MemoryPoint>(aiArchive.value?.coreMemoryPoints).filter(
    (item) => item.title || item.description
  )
);

const valueSummaries = computed(() =>
  parseJsonArray<string>(aiArchive.value?.historicalValueSummary)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
);

const relationshipClues = computed(() =>
  parseJsonArray<RelationshipClue>(aiArchive.value?.relationshipClues).filter(
    (item) => item.clueType || item.targetHint || item.narrative
  )
);

const archiveOtherFields = computed<DisplayField[]>(() => {
  const archive = aiArchive.value;
  if (!archive) {
    return [];
  }

  return Object.entries(archive)
    .filter(([key, value]) => !knownArchiveKeys.has(key) && hasValue(value))
    .map(([key, value]) => ({
      label: key,
      value: formatValue(
        typeof value === 'object' ? JSON.stringify(value) : value
      )
    }));
});

const hasArchiveContent = computed(() =>
  Boolean(
    archiveSummaryFields.value.length ||
    archiveRichSections.value.length ||
    timelinePhases.value.length ||
    memoryPoints.value.length ||
    valueSummaries.value.length ||
    relationshipClues.value.length ||
    archiveOtherFields.value.length
  )
);

/** 深度档案默认折叠，避免首屏信息过载（M-04） */
const showDeepArchive = shallowRef(false);

const closeDialog = () => emit('update:open', false);
const updateOpen = (...args: unknown[]) =>
  emit('update:open', Boolean(args[0]));
</script>

<template>
  <Dialog :open="props.open" @update:open="updateOpen">
    <DialogContent
      class="flex h-[92vh] max-w-[1320px] flex-col overflow-hidden p-0">
      <DialogHeader class="border-b border-border/70 px-5 py-4 pr-12">
        <div class="min-w-0">
          <DialogTitle
            class="truncate text-base font-semibold text-foreground">
            {{ currentRecord?.name || '馆藏详情' }}
          </DialogTitle>
          <DialogDescription
            class="mt-1 truncate text-xs text-muted-foreground"
            :title="currentRecord?.exhibitCode ? `编码：${currentRecord.exhibitCode}` : undefined">
            {{ currentRecord ? getGalleryName(currentRecord) : '未分配' }}
          </DialogDescription>
        </div>
      </DialogHeader>

      <div
        v-if="currentRecord"
        class="grid min-h-0 flex-1 gap-0 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside
          class="min-h-0 overflow-y-auto border-b border-border/70 bg-secondary/10 px-5 py-4 lg:border-b-0 lg:border-r lg:border-border/70">
          <div class="space-y-4">
            <div
              class="overflow-hidden rounded-lg border border-border/70 bg-background">
              <img
                v-if="currentRecord.imageUrl"
                :src="currentRecord.imageUrl"
                :alt="currentRecord.name || '馆藏图片'"
                class="h-[220px] w-full object-cover" />
              <div
                v-else
                class="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
                暂无馆藏图片
              </div>
            </div>

            <div class="grid gap-2">
              <div
                v-for="field in basicFields"
                :key="field.label"
                class="rounded-lg border border-border/70 bg-background/80 px-3 py-2.5">
                <p class="text-[11px] text-muted-foreground">
                  {{ field.label }}
                </p>
                <p class="mt-1 break-words text-sm text-foreground">
                  {{ field.value }}
                </p>
              </div>
            </div>

            <div
              v-if="archiveTags.length"
              class="rounded-lg border border-border/70 bg-background/80 px-3 py-3">
              <p class="text-[11px] text-muted-foreground">标签</p>
              <div class="mt-2 flex flex-wrap gap-2">
                <span
                  v-for="tag in archiveTags"
                  :key="tag"
                  class="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground">
                  {{ tag }}
                </span>
              </div>
            </div>
          </div>
        </aside>

        <section class="min-h-0 overflow-y-auto px-5 py-4">
          <div class="space-y-5">
            <section v-if="currentRecord.description" class="space-y-2">
              <h3 class="text-sm font-semibold text-foreground">馆藏描述</h3>
              <div
                class="rounded-lg border border-border/70 bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
                {{ currentRecord.description }}
              </div>
            </section>

            <section v-if="groupedExtras.length" class="space-y-3">
              <h3 class="text-sm font-semibold text-foreground">扩展属性</h3>
              <div class="space-y-3">
                <div
                  v-for="group in groupedExtras"
                  :key="group.groupName"
                  class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                  <p class="text-sm font-medium">
                    {{ group.groupName }}
                  </p>
                  <div class="mt-3 grid gap-3 md:grid-cols-2">
                    <div
                      v-for="item in group.items"
                      :key="`${group.groupName}:${item.label}`"
                      class="rounded-md bg-secondary/40 px-3 py-2.5">
                      <p class="text-xs text-muted-foreground">
                        {{ item.label }}
                      </p>
                      <div
                        v-if="item.chips.length"
                        class="mt-2 flex flex-wrap gap-2">
                        <span
                          v-for="chip in item.chips"
                          :key="chip"
                          class="rounded-full bg-background px-2.5 py-1 text-xs text-foreground">
                          {{ chip }}
                        </span>
                      </div>
                      <p
                        v-else
                        class="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">
                        {{ item.value }}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section v-if="mediaItems.length" class="space-y-3">
              <h3 class="text-sm font-semibold text-foreground">媒体资源</h3>
              <div class="grid gap-3 md:grid-cols-2">
                <article
                  v-for="item in mediaItems"
                  :key="`${item.mediaUrl}:${item.sortOrder}`"
                  class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                  <p class="text-sm font-medium">
                    {{ item.title || '未命名媒体' }}
                  </p>
                  <p class="mt-1 text-xs text-muted-foreground">
                    媒体资料
                  </p>
                  <a
                    v-if="item.mediaUrl"
                    :href="item.mediaUrl"
                    target="_blank"
                    rel="noreferrer"
                    class="mt-2 inline-block break-all text-sm text-sky-300 hover:text-sky-200">
                    打开媒体
                  </a>
                </article>
              </div>
            </section>

            <section
              v-if="hasArchiveContent"
              class="rounded-lg border border-border/60">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                @click="showDeepArchive = !showDeepArchive">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-foreground">
                    深度档案
                  </p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    整理档案、时间线、记忆点等扩展资料
                  </p>
                </div>
                <span class="shrink-0 text-xs text-muted-foreground">
                  {{ showDeepArchive ? '收起' : '展开' }}
                </span>
              </button>

              <div
                v-if="showDeepArchive"
                class="space-y-5 border-t border-border/60 px-4 py-4">
                <section v-if="archiveSummaryFields.length" class="space-y-3">
                  <h3 class="text-sm font-semibold text-foreground">整理档案</h3>
                  <div class="grid gap-3 md:grid-cols-2">
                    <div
                      v-for="field in archiveSummaryFields"
                      :key="field.label"
                      class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                      <p class="text-xs text-muted-foreground">{{ field.label }}</p>
                      <p
                        class="mt-1 whitespace-pre-wrap text-sm leading-6 text-foreground">
                        {{ field.value }}
                      </p>
                    </div>
                  </div>
                </section>

                <section v-if="timelinePhases.length" class="space-y-3">
                  <h3 class="text-sm font-semibold text-foreground">
                    关键人物时间线
                  </h3>
                  <div class="space-y-3">
                    <article
                      v-for="phase in timelinePhases"
                      :key="`${phase.phase}:${phase.period}`"
                      class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">
                          {{ phase.phase || '阶段' }}
                        </p>
                        <span
                          v-if="phase.period"
                          class="text-xs text-muted-foreground">
                          {{ phase.period }}
                        </span>
                      </div>
                      <p
                        v-if="phase.description"
                        class="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                        {{ phase.description }}
                      </p>
                      <div
                        v-if="phase.persons?.length"
                        class="mt-3 grid gap-2 md:grid-cols-2">
                        <div
                          v-for="person in phase.persons"
                          :key="`${phase.phase}:${person.name}:${person.role}`"
                          class="rounded-md bg-secondary/40 px-3 py-2.5">
                          <p class="text-sm font-medium">
                            {{ person.name || '未命名人物' }}
                          </p>
                          <p
                            v-if="person.role"
                            class="mt-1 text-xs text-muted-foreground">
                            {{ person.role }}
                          </p>
                          <p
                            v-if="person.contribution"
                            class="mt-2 text-sm leading-6 text-muted-foreground">
                            {{ person.contribution }}
                          </p>
                        </div>
                      </div>
                    </article>
                  </div>
                </section>

                <section v-if="memoryPoints.length" class="space-y-3">
                  <h3 class="text-sm font-semibold text-foreground">核心记忆点</h3>
                  <div class="grid gap-3 md:grid-cols-2">
                    <article
                      v-for="point in memoryPoints"
                      :key="`${point.title}:${point.category}`"
                      class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">
                          {{ point.title || '未命名记忆点' }}
                        </p>
                        <span
                          v-if="point.category"
                          class="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                          {{ point.category }}
                        </span>
                      </div>
                      <p
                        v-if="point.description"
                        class="mt-2 text-sm leading-6 text-muted-foreground">
                        {{ point.description }}
                      </p>
                    </article>
                  </div>
                </section>

                <section v-if="valueSummaries.length" class="space-y-3">
                  <h3 class="text-sm font-semibold text-foreground">价值摘要</h3>
                  <div
                    class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                    <ol class="space-y-2 text-sm leading-6 text-muted-foreground">
                      <li v-for="(item, index) in valueSummaries" :key="item">
                        {{ index + 1 }}. {{ item }}
                      </li>
                    </ol>
                  </div>
                </section>

                <section v-if="archiveRichSections.length" class="space-y-3">
                  <article
                    v-for="section in archiveRichSections"
                    :key="section.title"
                    class="space-y-2">
                    <h3 class="text-sm font-semibold text-foreground">
                      {{ section.title }}
                    </h3>
                    <div
                      class="rounded-lg border border-border/70 bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
                      <p class="whitespace-pre-wrap">{{ section.value }}</p>
                    </div>
                  </article>
                </section>

                <section v-if="relationshipClues.length" class="space-y-3">
                  <h3 class="text-sm font-semibold text-foreground">关联线索</h3>
                  <div class="space-y-3">
                    <article
                      v-for="(item, index) in relationshipClues"
                      :key="`${item.clueType}:${index}`"
                      class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                      <div class="flex flex-wrap items-center gap-2">
                        <p class="text-sm font-medium">
                          {{ item.clueType || '线索' }}
                        </p>
                        <span
                          v-if="item.confidence !== undefined"
                          class="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                          置信度 {{ item.confidence }}
                        </span>
                      </div>
                      <div
                        class="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span v-if="item.personName">
                          人物：{{ item.personName }}
                        </span>
                        <span v-if="item.eventName">
                          事件：{{ item.eventName }}
                        </span>
                        <span v-if="item.techniqueName">
                          工艺：{{ item.techniqueName }}
                        </span>
                        <span v-if="item.motifName">
                          题材：{{ item.motifName }}
                        </span>
                        <span v-if="item.siteName">地点：{{ item.siteName }}</span>
                      </div>
                      <p
                        v-if="item.targetHint"
                        class="mt-2 text-sm text-foreground">
                        {{ item.targetHint }}
                      </p>
                      <p
                        v-if="item.narrative"
                        class="mt-2 text-sm leading-6 text-muted-foreground">
                        {{ item.narrative }}
                      </p>
                    </article>
                  </div>
                </section>

                <section v-if="archiveOtherFields.length" class="space-y-3">
                  <h3 class="text-sm font-semibold text-foreground">
                    其他档案字段
                  </h3>
                  <div class="grid gap-3 md:grid-cols-2">
                    <div
                      v-for="field in archiveOtherFields"
                      :key="field.label"
                      class="rounded-lg border border-border/70 bg-background/70 px-4 py-3">
                      <p class="text-xs text-muted-foreground">{{ field.label }}</p>
                      <p
                        class="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                        {{ field.value }}
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </section>

            <section
              v-if="
                !hasArchiveContent &&
                !groupedExtras.length &&
                !mediaItems.length &&
                !currentRecord.description
              "
              class="rounded-lg border border-border/70 bg-background/70 px-4 py-10 text-center text-sm text-muted-foreground">
              暂无更多详情数据
            </section>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
