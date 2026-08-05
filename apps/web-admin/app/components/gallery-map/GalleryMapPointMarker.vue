<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import type { GalleryMapPointRecord } from '@/types/gallery-map';

interface Props {
  point: GalleryMapPointRecord;
  selected?: boolean;
  picking?: boolean;
  draggable?: boolean;
  actionPending?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  selected: false,
  picking: false,
  draggable: false,
  actionPending: false,
});

const emit = defineEmits<{
  select: [point: GalleryMapPointRecord];
  move: [payload: { point: GalleryMapPointRecord; clientX: number; clientY: number }];
}>();

const dragging = shallowRef(false);
const moved = shallowRef(false);
const dragOrigin = shallowRef<{ clientX: number; clientY: number } | null>(null);

const markerLabel = computed(() => {
  if (props.point.markerType === 1) {
    return props.point.title || '文物点位';
  }

  if (props.point.markerType === 2) {
    return props.point.title || '展览说明点位';
  }

  return props.point.title || '未知点位';
});

const markerGlyph = computed(() => {
  if (props.point.markerType === 1) {
    return '●';
  }

  if (props.point.markerType === 2) {
    return '✦';
  }

  return '?';
});

const markerClass = computed(() => {
  if (props.point.markerType === 1) {
    return 'border-[#d9b875] bg-[#9d672e] text-[#fff4d2] shadow-[0_0_0_3px_rgba(217,184,117,0.16),0_6px_18px_rgba(0,0,0,0.45)]';
  }

  if (props.point.markerType === 2) {
    return 'border-[#9fc5cf] bg-[#315764] text-[#e4fbff] shadow-[0_0_0_3px_rgba(159,197,207,0.14),0_6px_18px_rgba(0,0,0,0.45)]';
  }

  return 'border-[#b4a6c6] bg-[#5e526d] text-[#f6efff] shadow-[0_0_0_3px_rgba(180,166,198,0.14),0_6px_18px_rgba(0,0,0,0.45)]';
});

const handlePointerDown = (event: PointerEvent) => {
  if (!props.draggable || props.picking || props.actionPending) {
    return;
  }

  const target = event.currentTarget as HTMLElement | null;
  target?.setPointerCapture(event.pointerId);
  dragging.value = true;
  moved.value = false;
  dragOrigin.value = {
    clientX: event.clientX,
    clientY: event.clientY,
  };
};

const handlePointerMove = (event: PointerEvent) => {
  const origin = dragOrigin.value;
  if (!dragging.value || !origin) {
    return;
  }

  if (Math.hypot(event.clientX - origin.clientX, event.clientY - origin.clientY) >= 4) {
    moved.value = true;
  }
};

const finishDrag = (event: PointerEvent) => {
  if (!dragging.value) {
    return;
  }

  const target = event.currentTarget as HTMLElement | null;
  if (target?.hasPointerCapture(event.pointerId)) {
    target.releasePointerCapture(event.pointerId);
  }

  dragging.value = false;
  dragOrigin.value = null;
  if (moved.value) {
    emit('move', {
      point: props.point,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }
};

const cancelDrag = () => {
  dragging.value = false;
  dragOrigin.value = null;
  moved.value = false;
};

const handleClick = () => {
  if (moved.value) {
    moved.value = false;
    return;
  }

  emit('select', props.point);
};
</script>

<template>
  <button
    type="button"
    class="absolute z-10 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-sm font-semibold transition-transform duration-150 hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1013]"
    :class="[
      markerClass,
      props.selected && 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-[#0e1013]',
      props.picking && 'pointer-events-none opacity-70',
      props.draggable && !props.picking && !props.actionPending && 'cursor-grab active:cursor-grabbing',
    ]"
    :style="{ left: `${props.point.xPercent}%`, top: `${props.point.yPercent}%` }"
    :aria-label="markerLabel"
    :title="props.draggable ? `${markerLabel}（可拖动调整位置）` : markerLabel"
    :disabled="props.picking || props.actionPending"
    @pointerdown.stop="handlePointerDown"
    @pointermove.stop="handlePointerMove"
    @pointerup.stop="finishDrag"
    @pointercancel.stop="cancelDrag"
    @click.stop="handleClick">
    <span aria-hidden="true">{{ markerGlyph }}</span>
  </button>
</template>
