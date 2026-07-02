<script setup lang="ts" generic="TData, TValue">
import { computed } from 'vue';
import type { ColumnDef, SortingState } from '@tanstack/vue-table';
import {
  FlexRender,
  getCoreRowModel,
  useVueTable,
} from '@tanstack/vue-table';
import Table from '@/components/shadcn/table/Table.vue';
import TableBody from '@/components/shadcn/table/TableBody.vue';
import TableCell from '@/components/shadcn/table/TableCell.vue';
import TableHead from '@/components/shadcn/table/TableHead.vue';
import TableHeader from '@/components/shadcn/table/TableHeader.vue';
import TableRow from '@/components/shadcn/table/TableRow.vue';

interface Props {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  sorting?: SortingState;
  pending?: boolean;
  rowCount?: number;
  emptyText?: string;
  emptyRowCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  sorting: () => [],
  pending: false,
  rowCount: 0,
  emptyText: '暂无数据。',
  emptyRowCount: 5,
});

const table = useVueTable({
  get data() {
    return props.data;
  },
  get columns() {
    return props.columns;
  },
  state: {
    get sorting() {
      return props.sorting;
    },
  },
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,
});

const emptyRows = computed(() => Array.from({ length: Math.max(props.emptyRowCount - 1, 0) }, (_, index) => index));
</script>

<template>
  <div class="warm-panel warm-outline min-h-[360px] overflow-hidden rounded-[0.95rem] border border-border/70">
    <Table>
      <TableHeader>
        <TableRow v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id" class="hover:bg-transparent">
          <TableHead v-for="header in headerGroup.headers" :key="header.id">
            <FlexRender
              v-if="!header.isPlaceholder"
              :render="header.column.columnDef.header"
              :props="header.getContext()" />
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <template v-if="props.pending">
          <TableRow>
            <TableCell :colspan="props.columns.length" class="h-28 text-center text-muted-foreground">
              正在加载馆藏数据...
            </TableCell>
          </TableRow>
        </template>
        <template v-else-if="table.getRowModel().rows.length">
          <TableRow v-for="row in table.getRowModel().rows" :key="row.id">
            <TableCell v-for="cell in row.getVisibleCells()" :key="cell.id">
              <FlexRender :render="cell.column.columnDef.cell" :props="cell.getContext()" />
            </TableCell>
          </TableRow>
        </template>
        <template v-else>
          <TableRow>
            <TableCell :colspan="props.columns.length" class="h-20 text-center text-muted-foreground">
              {{ props.emptyText }}
            </TableCell>
          </TableRow>
          <TableRow v-for="rowIndex in emptyRows" :key="rowIndex" class="hover:bg-transparent">
            <TableCell
              v-for="columnIndex in props.columns.length"
              :key="columnIndex"
              class="h-14 text-muted-foreground/20">
              <span class="block h-2.5 w-full rounded bg-white/[0.03]"></span>
            </TableCell>
          </TableRow>
        </template>
      </TableBody>
    </Table>
  </div>
</template>
