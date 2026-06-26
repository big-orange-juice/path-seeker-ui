<script setup lang="ts">
import type { TableColumn } from '@/composables/useAdminContent';

interface Props {
  columns: TableColumn[];
  rows: Array<Record<string, string>>;
}

defineProps<Props>();
</script>

<template>
  <div class="overflow-x-auto">
    <table class="min-w-full border-separate border-spacing-0 text-left">
      <thead>
        <tr>
          <th
            v-for="column in columns"
            :key="column.key"
            class="border-b border-border px-3 py-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            {{ column.label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIndex) in rows" :key="rowIndex">
          <td
            v-for="column in columns"
            :key="column.key"
            class="border-b border-border/70 px-3 py-3 align-top text-sm leading-6 text-foreground/92"
          >
            {{ row[column.key] }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
