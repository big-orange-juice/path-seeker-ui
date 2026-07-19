<script setup lang="ts">
import { computed } from 'vue';
import { getRouteStatusPresentation } from '@/constants/routeWorkflow';
import type { RouteRecord } from '@/types/route';

const props = defineProps<{
  record: Pick<
    RouteRecord,
    'publishStatus' | 'auditStatus' | 'auditRemark' | 'auditRequired'
  >;
}>();

const presentation = computed(() => getRouteStatusPresentation(props.record));
</script>

<template>
  <div class="inline-flex max-w-full flex-wrap items-center gap-1" :title="presentation.title">
    <span
      class="inline-flex rounded-full px-2 py-0.5 text-[11px]"
      :class="presentation.primaryClass">
      {{ presentation.primaryLabel }}
    </span>
    <span
      v-if="presentation.secondaryLabel"
      class="inline-flex rounded-full px-2 py-0.5 text-[11px]"
      :class="presentation.secondaryClass">
      {{ presentation.secondaryLabel }}
    </span>
  </div>
</template>
