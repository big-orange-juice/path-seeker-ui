<script setup lang="ts">
import type { FloorMapRecord } from '@/types/map-management';

interface Props {
  maps: FloorMapRecord[];
}

defineProps<Props>();

const emit = defineEmits<{
  edit: [record: FloorMapRecord];
  remove: [record: FloorMapRecord];
}>();
</script>

<template>
  <div v-if="maps.length" class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
    <article
      v-for="record in maps"
      :key="record.id"
      class="group relative overflow-hidden rounded-[1.35rem] border border-border/70 bg-[#101317]">
      <div
        class="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.03]"
        :style="{ backgroundImage: `url(${record.mapImages[0] ?? ''})` }" />
      <div class="absolute inset-0 bg-gradient-to-b from-black/12 via-black/35 to-black/85" />

      <div class="relative flex min-h-[300px] flex-col justify-between p-5">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-2">
            <p class="text-[11px] uppercase tracking-[0.26em] text-white/68">Floor Management</p>
            <div class="flex items-end gap-3">
              <span class="text-3xl font-semibold tracking-tight text-white">{{ record.floorNumber }}</span>
              <h3 class="pb-1 text-base font-medium text-white/88">{{ record.floorName }}</h3>
            </div>
            <p class="text-xs text-white/70">层级 {{ record.floorLevel }} · 排序 {{ record.sortOrder }}</p>
          </div>
          <div class="rounded-full border border-white/18 bg-black/25 px-3 py-1 text-xs text-white/78">
            {{ record.venues.length }} 个展馆
          </div>
        </div>

        <div class="space-y-4">
          <p class="line-clamp-2 text-sm leading-6 text-white/74">
            {{ record.description || '未填写楼层描述。' }}
          </p>

          <div class="flex flex-wrap gap-2">
            <span
              v-for="name in record.includedVenueNames"
              :key="name"
              class="rounded-full border border-white/18 bg-black/28 px-2.5 py-1 text-xs text-white/88">
              {{ name }}
            </span>
          </div>

          <div class="flex items-center justify-between gap-3">
            <p class="text-xs text-white/65">{{ record.mapImages[0] ? '已配置地图底图' : '未配置地图底图' }}</p>
            <div class="flex items-center gap-2">
              <UiButton size="sm" variant="secondary" @click="emit('edit', record)">
                编辑
              </UiButton>
              <UiButton size="sm" variant="ghost" @click="emit('remove', record)">
                删除
              </UiButton>
            </div>
          </div>
        </div>
      </div>
    </article>
  </div>

  <div v-else class="warm-panel warm-outline rounded-[1.25rem] border border-dashed border-border/80 px-6 py-14 text-center">
    <p class="text-base font-medium text-foreground">还没有楼层地图</p>
    <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
      新增第一条楼层记录后，这里会展示楼层编码、名称、底图和展馆摘要。
    </p>
  </div>
</template>
