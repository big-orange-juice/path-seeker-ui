<script setup lang="ts">
import { computed } from 'vue';
import type { CulturalPlaceArchive, CulturalPlaceExtra } from '@/types/cultural-place';

const props = defineProps<{ extras?: CulturalPlaceExtra[]; archive?: CulturalPlaceArchive | null }>();
const extraFields = computed(() => [...(props.extras ?? [])].sort((left, right) => left.sortOrder - right.sortOrder));
const textFields: Array<{ key: keyof CulturalPlaceArchive; label: string }> = [
  { key: 'formalName', label: '正式名称' },
  { key: 'era', label: '历史时期' },
  { key: 'establishedText', label: '始建时间' },
  { key: 'historicalEvolution', label: '历史沿革' },
  { key: 'backgroundStories', label: '故事与传说' },
  { key: 'culturalContext', label: '文化背景' },
  { key: 'architecturalFeatures', label: '建筑 / 景观特色' },
  { key: 'culturalSignificance', label: '文化价值' },
  { key: 'currentFunction', label: '当前用途' },
  { key: 'protectionLevel', label: '保护级别' },
  { key: 'visitingTips', label: '游览提示' },
];
const archiveFields = computed(() => textFields.map(field => ({ ...field, value: String(props.archive?.[field.key] ?? '').trim() })).filter(field => field.value));
const arrays: Array<{ key: keyof CulturalPlaceArchive; label: string }> = [
  { key: 'keyPersonTimeline', label: '人物与事件时间线' },
  { key: 'coreMemoryPoints', label: '核心记忆点' },
  { key: 'referenceSources', label: '参考来源' },
  { key: 'relationshipClues', label: '关联线索' },
];
const structuredSections = computed(() => arrays.map(field => ({ ...field, items: parseArray(props.archive?.[field.key]) })).filter(field => field.items.length));

function parseArray(value: unknown): unknown[] {
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

function formatItem(item: unknown): string {
  if (item == null) return '';
  if (typeof item !== 'object') return String(item);
  const labels: Record<string, string> = { title: '标题', description: '说明', period: '时期', phase: '阶段', person: '人物', name: '名称', persons: '人物', role: '身份', contribution: '贡献', category: '类别', url: '链接', targetHint: '关联对象', narrative: '关联说明', clueType: '关联类型', personName: '人物', eventName: '事件', siteName: '地点', confidence: '置信度' };
  return Object.entries(item).map(([key, value]) => `${labels[key] ?? key}：${Array.isArray(value) ? value.map(formatItem).join('；') : value && typeof value === 'object' ? formatItem(value) : String(value ?? '')}`).join('\n');
}

function extraValue(extra: CulturalPlaceExtra): string {
  return extra.valueType === 4 ? parseArray(extra.attrValue).map(formatItem).join('\n') : extra.attrValue ?? '未填写';
}
</script>

<template>
  <section class="space-y-3 border-t border-border/60 pt-4">
    <h3 class="text-base font-medium">补充资料</h3>
    <p v-if="!extraFields.length" class="text-sm text-muted-foreground">暂无补充资料，可在编辑中添加。</p>
    <dl v-else class="grid gap-4 sm:grid-cols-2">
      <div v-for="extra in extraFields" :key="extra.attrKey" class="space-y-1.5">
        <dt class="field-caption text-sm font-medium">{{ extra.attrKey }}<span v-if="extra.groupName" class="ml-2 text-xs text-muted-foreground">{{ extra.groupName }}</span></dt>
        <dd class="form-value whitespace-pre-wrap break-words text-sm">{{ extraValue(extra) }}</dd>
      </div>
    </dl>
  </section>
  <section class="space-y-4 border-t border-border/60 pt-4">
    <h3 class="text-base font-medium">景点深度档案</h3>
    <p v-if="!archiveFields.length && !structuredSections.length && !archive?.influenceLevel" class="text-sm text-muted-foreground">暂无深度档案，可在编辑中维护。</p>
    <div v-for="field in archiveFields" :key="field.key" class="space-y-1.5">
      <p class="field-caption text-sm font-medium">{{ field.label }}</p>
      <p class="form-value whitespace-pre-wrap break-words text-sm leading-6">{{ field.value }}</p>
    </div>
    <div v-if="archive?.influenceLevel" class="space-y-1.5"><p class="field-caption text-sm font-medium">影响等级</p><p class="text-sm">{{ ['未评级', '世界级', '国家级', '区域级', '一般'][archive.influenceLevel] ?? '未评级' }}</p></div>
    <section v-for="section in structuredSections" :key="section.key" class="space-y-2">
      <h4 class="field-caption text-sm font-medium">{{ section.label }}</h4>
      <div v-for="(item, index) in section.items" :key="index" class="rounded-lg border border-border/70 p-3">
        <p class="whitespace-pre-wrap break-words text-sm leading-6">{{ formatItem(item) }}</p>
      </div>
    </section>
  </section>
</template>
