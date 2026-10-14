<script setup lang="ts">
import { computed } from 'vue';
import Button from '@/components/shadcn/button/Button.vue';
import { parseImageLinks, readString, targetTypeText } from '@/types/collection-import';
import type { CollectionImportCandidate, JsonValue } from '@/types/collection-import';

const props = defineProps<{
  candidates: CollectionImportCandidate[];
  selectedCandidateIds: string[];
  busy: boolean;
}>();

const emit = defineEmits<{
  toggle: [candidateId: string, checked: boolean];
  toggleAll: [checked: boolean];
  detail: [candidate: CollectionImportCandidate];
  confirm: [candidateId: string];
  skip: [candidateId: string];
}>();

const canConfirmCandidate = (candidate: CollectionImportCandidate) => candidate.status === 0 || candidate.status === 4;
const confirmableCandidates = computed(() => props.candidates.filter(canConfirmCandidate));
const allSelected = computed(() => confirmableCandidates.value.length > 0
  && confirmableCandidates.value.every(candidate => props.selectedCandidateIds.includes(candidate.id)));

const draftRecord = (candidate: CollectionImportCandidate): Record<string, JsonValue> | null => {
  const node = candidate.draft;
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return null;
  }
  return node as Record<string, JsonValue>;
};

const readDraftField = (candidate: CollectionImportCandidate, field: string): string => {
  const record = draftRecord(candidate);
  return readString(record?.[field]);
};

const candidateName = (candidate: CollectionImportCandidate): string =>
  readDraftField(candidate, 'name') || '（无名称）';

const candidateCode = (candidate: CollectionImportCandidate): string =>
  readDraftField(candidate, 'exhibitCode') || readDraftField(candidate, 'code') || '—';

const candidateImageCount = (candidate: CollectionImportCandidate): number =>
  parseImageLinks(candidate.imageLinks).resolved.length;

const candidateHasOverwrite = (candidate: CollectionImportCandidate): boolean => {
  if (candidate.targetId) {
    return true;
  }
  const node = candidate.overwrite;
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return false;
  }
  const fields = (node as Record<string, unknown>).fields;
  return Array.isArray(fields) && fields.length > 0;
};

</script>

<template>
  <div class="warm-panel warm-outline overflow-x-auto rounded-[0.95rem] border border-border/70">
    <table class="w-full min-w-[1040px] text-sm">
      <thead class="bg-secondary/40 text-xs text-muted-foreground">
        <tr>
          <th class="w-10 px-3 py-2 text-left">
            <input
              type="checkbox"
              class="h-4 w-4"
              :checked="allSelected"
              :disabled="busy || !confirmableCandidates.length"
              @change="emit('toggleAll', ($event.target as HTMLInputElement).checked)">
          </th>
          <th class="px-3 py-2 text-left">行号</th>
          <th class="px-3 py-2 text-left">对象</th>
          <th class="px-3 py-2 text-left">业务编码</th>
          <th class="px-3 py-2 text-left">匹配</th>
          <th class="px-3 py-2 text-left">差异</th>
          <th class="px-3 py-2 text-left">图片</th>
          <th class="px-3 py-2 text-left">状态</th>
          <th class="px-3 py-2 text-left">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="!candidates.length">
          <td colspan="9" class="px-3 py-6 text-center text-sm text-muted-foreground">
            没有候选条目。若刚解析完请点击"刷新候选"。
          </td>
        </tr>
        <tr v-for="candidate in candidates" :key="candidate.id" class="border-t">
          <td class="px-3 py-2">
            <input
              type="checkbox"
              class="h-4 w-4"
              :checked="selectedCandidateIds.includes(candidate.id)"
              :disabled="busy || !canConfirmCandidate(candidate)"
              @change="emit('toggle', candidate.id, ($event.target as HTMLInputElement).checked)">
          </td>
          <td class="px-3 py-2 text-muted-foreground">{{ candidate.rowNo }}</td>
          <td class="px-3 py-2">
            <p class="truncate">{{ candidateName(candidate) }}</p>
            <p class="text-xs text-muted-foreground">{{ targetTypeText(candidate.targetType) }}</p>
          </td>
          <td class="px-3 py-2 text-muted-foreground">{{ candidateCode(candidate) }}</td>
          <td class="px-3 py-2 text-xs">
            <template v-if="candidate.targetId">
              <span class="text-amber-200">命中既有对象</span>
              <span v-if="candidate.targetName" class="ml-1 text-muted-foreground">{{ candidate.targetName }}</span>
            </template>
            <span v-else class="text-muted-foreground">新建</span>
            <p v-if="candidate.matchEvidence" class="text-muted-foreground">{{ candidate.matchEvidence }}</p>
          </td>
          <td class="px-3 py-2 text-xs">
            <span v-if="candidateHasOverwrite(candidate)" class="text-amber-200">有覆盖差异</span>
            <span v-else class="text-muted-foreground">无</span>
            <span v-if="candidate.uncertainFields.length" class="ml-1 text-amber-200">
              · {{ candidate.uncertainFields.length }} 项待确认
            </span>
          </td>
          <td class="px-3 py-2 text-xs text-muted-foreground">{{ candidateImageCount(candidate) }} 张</td>
          <td class="px-3 py-2 text-xs">
            {{ candidate.statusText }}
            <p v-if="candidate.errorMessage" class="text-destructive">{{ candidate.errorMessage }}</p>
          </td>
          <td class="px-3 py-2">
            <div class="flex gap-1.5">
              <Button variant="ghost" size="sm" class="h-7 px-2 text-xs" @click="emit('detail', candidate)">
                差异详情
              </Button>
              <Button
                v-if="canConfirmCandidate(candidate)"
                variant="outline"
                size="sm"
                class="h-7 px-2 text-xs"
                :disabled="busy"
                @click="emit('confirm', candidate.id)">
                {{ candidate.status === 4 ? '重新确认' : '确认' }}
              </Button>
              <Button
                v-if="canConfirmCandidate(candidate)"
                variant="ghost"
                size="sm"
                class="h-7 px-2 text-xs"
                :disabled="busy"
                @click="emit('skip', candidate.id)">
                跳过
              </Button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
