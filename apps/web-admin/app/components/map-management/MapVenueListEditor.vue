<script setup lang="ts">
import type { VenueDraft } from '@/types/map-management';

interface Props {
  venues: VenueDraft[];
  activeVenueId: string;
  pickingVenueId: string;
  draftPoint: { x: number; y: number } | null;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  addVenue: [];
  removeVenue: [targetId: string];
  selectVenue: [targetId: string];
  updateVenue: [payload: { targetId: string; patch: Partial<VenueDraft> }];
  beginPick: [targetId: string];
  confirmPick: [];
  cancelPick: [];
}>();
</script>

<template>
  <section class="space-y-2.5 rounded-[0.9rem] bg-[#0f1114] p-3.5">
    <div class="flex items-center justify-between gap-2.5">
      <div class="space-y-0.5">
        <h3 class="text-sm font-semibold text-foreground">展厅信息</h3>
        <p class="text-xs text-muted-foreground">维护当前楼层的展厅资料与地图坐标。</p>
      </div>
      <UiButton size="sm" variant="secondary" @click="emit('addVenue')">
        新增展厅
      </UiButton>
    </div>

    <div v-auto-animate class="grid gap-2.5 xl:grid-cols-2">
      <div
        v-for="venue in props.venues"
        :key="venue.id"
        class="rounded-xl bg-[#111318] p-2.5 transition"
        :class="props.activeVenueId === venue.id ? 'ring-1 ring-primary/40' : 'ring-1 ring-white/5'"
        @click="emit('selectVenue', venue.id)">
        <div class="grid gap-2.5 md:grid-cols-2">
          <div class="space-y-1.5">
            <label class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">展厅编码</label>
            <UiInput
              :model-value="venue.galleryCode"
              placeholder="例如：G-3-01"
              @update:model-value="emit('updateVenue', { targetId: venue.id, patch: { galleryCode: $event } })" />
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">展厅名称</label>
            <UiInput
              :model-value="venue.name"
              placeholder="例如：青铜馆"
              @update:model-value="emit('updateVenue', { targetId: venue.id, patch: { name: $event } })" />
          </div>

          <div class="space-y-1.5">
            <label class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">副标题</label>
            <UiInput
              :model-value="venue.subtitle"
              placeholder="例如：商周青铜专题"
              @update:model-value="emit('updateVenue', { targetId: venue.id, patch: { subtitle: $event } })" />
          </div>

          <div class="grid grid-cols-2 gap-1.5">
            <div class="space-y-1.5">
              <label class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">类别</label>
              <UiInput
                :model-value="String(venue.category)"
                type="number"
                placeholder="1-6"
                @update:model-value="emit('updateVenue', { targetId: venue.id, patch: { category: Number($event || 0) } })" />
            </div>
            <div class="space-y-1.5">
              <label class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">开放状态</label>
              <UiInput
                :model-value="String(venue.openStatus)"
                type="number"
                placeholder="1-3"
                @update:model-value="emit('updateVenue', { targetId: venue.id, patch: { openStatus: Number($event || 0) } })" />
            </div>
          </div>
        </div>

        <div class="mt-2.5 space-y-1.5">
          <label class="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">展厅描述</label>
          <UiTextarea
            :model-value="venue.description"
            rows="2"
            placeholder="描述当前展厅的主题与内容"
            @update:model-value="emit('updateVenue', { targetId: venue.id, patch: { description: $event } })" />
        </div>

        <div class="mt-2.5 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-1.5">
          <UiInput :model-value="venue.x === null ? '' : String(venue.x)" placeholder="X" disabled />
          <UiInput :model-value="venue.y === null ? '' : String(venue.y)" placeholder="Y" disabled />
          <UiButton type="button" variant="secondary" class="px-3" @click.stop="emit('beginPick', venue.id)">
            取点
          </UiButton>
          <UiButton v-if="props.venues.length > 1" variant="ghost" size="icon" @click.stop="emit('removeVenue', venue.id)">
            <UiAppIcon name="trash-2" class="h-4 w-4" />
          </UiButton>
        </div>

        <div
          v-if="props.pickingVenueId === venue.id"
          class="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs text-primary">
          <span>已进入取点</span>
          <span v-if="props.draftPoint">{{ props.draftPoint.x }}, {{ props.draftPoint.y }}</span>
          <UiButton size="sm" variant="secondary" :disabled="!props.draftPoint" @click.stop="emit('confirmPick')">
            确认
          </UiButton>
          <UiButton size="sm" variant="ghost" @click.stop="emit('cancelPick')">
            取消
          </UiButton>
        </div>
      </div>
    </div>
  </section>
</template>
