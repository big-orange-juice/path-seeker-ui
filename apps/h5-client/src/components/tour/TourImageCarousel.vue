<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import { useElementSize, usePreferredReducedMotion, useScroll } from '@vueuse/core'
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import type { ClientTourStop } from '@/types/clientCatalog'

const props = defineProps<{
  images: ClientTourStop['images']
  title: string
  previousLabel: string
  nextLabel: string
}>()

const images = computed(() => (props.images ?? []).filter(image => image.url))
const track = useTemplateRef<HTMLElement>('track')
const { width } = useElementSize(track)
const reducedMotion = usePreferredReducedMotion()
const { x } = useScroll(track, { behavior: computed(() => reducedMotion.value === 'reduce' ? 'auto' : 'smooth') })
const current = computed(() => Math.min(Math.max(0, Math.round(x.value / (width.value || 1))), Math.max(0, images.value.length - 1)))
const caption = computed(() => images.value[current.value]?.caption)

function move(delta: number) {
  x.value = Math.max(0, Math.min(current.value + delta, images.value.length - 1)) * width.value
}

watch(() => props.images, () => { x.value = 0 })
watch(width, (value, previous) => {
  if (previous > 0) x.value = Math.round(x.value / previous) * value
})
</script>

<template>
  <section v-if="images.length" class="tour-image-carousel" :aria-label="title">
    <div ref="track" class="carousel-track" tabindex="0" @keydown.left.prevent="move(-1)" @keydown.right.prevent="move(1)">
      <figure v-for="(image, index) in images" :key="image.id" class="carousel-slide" :aria-label="`${index + 1} / ${images.length}`">
        <img :src="image.url || ''" :alt="image.altText || title" :loading="index === 0 ? 'eager' : 'lazy'" draggable="false">
      </figure>
    </div>
    <div v-if="images.length > 1" class="carousel-navigation">
      <button type="button" :disabled="current === 0" :aria-label="previousLabel" @click="move(-1)"><ChevronLeft :size="18" aria-hidden="true" /></button>
      <span class="carousel-count" aria-live="polite">{{ current + 1 }} / {{ images.length }}</span>
      <button type="button" :disabled="current === images.length - 1" :aria-label="nextLabel" @click="move(1)"><ChevronRight :size="18" aria-hidden="true" /></button>
    </div>
    <p v-if="caption" class="carousel-caption">{{ caption }}</p>
  </section>
</template>

<style scoped>
.tour-image-carousel{margin:14px 0 16px}.carousel-track{display:flex;width:100%;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;border-radius:10px;background:#eaf1ec;overscroll-behavior-x:contain}.carousel-track::-webkit-scrollbar{display:none}.carousel-slide{flex:0 0 100%;min-width:0;margin:0;scroll-snap-align:start;scroll-snap-stop:always}.carousel-slide img{display:block;width:100%;height:210px;object-fit:contain}.carousel-navigation{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px}.carousel-navigation button{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--tour-line,#d4e0d9);border-radius:10px;background:var(--tour-selected,#edf5ef);color:var(--tour-lake,#183e43);cursor:pointer}.carousel-navigation button:disabled{opacity:.3;cursor:default}.carousel-navigation button:focus-visible,.carousel-track:focus-visible{outline:2px solid var(--tour-lake,#183e43);outline-offset:2px}.carousel-count{min-width:44px;color:var(--tour-muted,#7b8a80);font-size:12px;font-variant-numeric:tabular-nums;text-align:center}.carousel-caption{margin:6px 0 0;color:var(--tour-muted,#7b8a80);font-size:12px;line-height:1.6;text-align:center}
@media(max-width:760px){.carousel-slide img{height:180px}}
</style>
