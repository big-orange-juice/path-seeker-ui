<script setup lang="ts">
import Button from '@/components/shadcn/button/Button.vue';
import type { MuseumRecord } from '@/types/museum';

interface Props {
  museums: MuseumRecord[];
  activeId?: string;
  pending?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  activeId: '',
  pending: false,
});

const emit = defineEmits<{
  detail: [record: MuseumRecord];
  edit: [record: MuseumRecord];
  remove: [record: MuseumRecord];
}>();

const formatNumber = (value: number | null, suffix = '') => {
  if (value === null || value === undefined) {
    return '未填写';
  }

  return `${value}${suffix}`;
};
</script>

<template>
  <div class="warm-panel warm-outline rounded-[0.95rem] border border-border/70">
    <div class="flex items-center justify-between border-b border-border/70 px-4 py-3">
      <div>
        <p class="text-sm font-semibold text-foreground">主体列表</p>
      </div>
      <div class="rounded-full bg-secondary/70 px-3 py-1 text-xs text-muted-foreground">
        共 {{ props.museums.length }} 条
      </div>
    </div>

    <div v-if="props.pending" class="px-4 py-8 text-center text-sm text-muted-foreground">
      正在加载主体数据...
    </div>

    <div v-else-if="!props.museums.length" class="px-4 py-8 text-center text-sm text-muted-foreground">
      当前没有主体数据，可以先在右侧创建第一条。
    </div>

    <div v-else class="divide-y divide-border/60">
      <article
        v-for="record in props.museums"
        :key="record.id"
        class="grid gap-2.5 px-4 py-3 transition-colors hover:bg-white/[0.02] md:grid-cols-[minmax(0,1fr)_170px]"
        :class="record.id === props.activeId ? 'bg-primary/6' : ''">
        <div class="space-y-2.5">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base font-semibold text-foreground">{{ record.name || '未命名主体' }}</h3>
            <span class="rounded-full border border-border/80 bg-secondary/80 px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              {{ record.museumCode || 'NO-CODE' }}
            </span>
            <span
              class="rounded-full px-2.5 py-1 text-[11px]"
              :class="record.status === 1 ? 'bg-emerald-500/12 text-emerald-300' : 'bg-white/8 text-muted-foreground'">
              {{ record.status === 1 ? '启用中' : '已停用' }}
            </span>
          </div>

          <p class="text-sm leading-6 text-muted-foreground">
            {{ record.address || '未填写地址' }}
          </p>

          <div class="grid gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2 xl:grid-cols-3">
            <p>开放时间：{{ record.openingHours || '未填写' }}</p>
            <p>闭馆日：{{ record.closedDay || '未填写' }}</p>
            <p>联系电话：{{ record.contactPhone || '未填写' }}</p>
            <p>地上层数：{{ formatNumber(record.floorsAbove, ' 层') }}</p>
            <p>地下层数：{{ formatNumber(record.floorsBelow, ' 层') }}</p>
            <p>展览面积：{{ formatNumber(record.exhibitionArea, ' m²') }}</p>
          </div>
        </div>

        <div class="flex items-end justify-end gap-2">
          <Button variant="ghost" size="sm" @click="emit('detail', record)">
            详情
          </Button>
          <Button variant="secondary" size="sm" @click="emit('edit', record)">
            编辑
          </Button>
          <Button variant="ghost" size="sm" @click="emit('remove', record)">
            删除
          </Button>
        </div>
      </article>
    </div>
  </div>
</template>
