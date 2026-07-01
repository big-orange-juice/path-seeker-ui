<script setup lang="ts">
import type { LandingBusinessRow, LandingRoadmapStage } from '@/composables/useLandingContent';

interface Props {
  businessRows: LandingBusinessRow[];
  roadmapStages: LandingRoadmapStage[];
  visionLines: string[];
}

defineProps<Props>();
</script>

<template>
  <section class="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
    <article class="rounded-[1.8rem] border border-white/[0.07] bg-white/[0.03] p-7">
      <p class="text-xs uppercase tracking-[0.28em] text-[#c9a25f]">它如何生长</p>
      <h2 class="mt-3 font-display text-[2rem] font-semibold tracking-[-0.03em] text-[#f4ecdd]">让每一次讲述，都能一直延续下去</h2>
      <div data-landing-stagger class="mt-7 space-y-4">
        <div
          v-for="item in businessRows"
          :key="item.title"
          data-stagger-item
          class="flex items-start gap-4 rounded-[1.3rem] border border-white/[0.06] bg-white/[0.02] p-5">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-[#d6b07d]/30 bg-[#d6b07d]/10 text-xs font-semibold tracking-wide text-[#d6b07d]">
            {{ item.share }}
          </div>
          <div>
            <h3 class="text-base font-semibold text-[#f0e8d9]">{{ item.title }}</h3>
            <p class="mt-2 text-sm leading-7 text-[#948c7d]">{{ item.detail }}</p>
          </div>
        </div>
      </div>
    </article>

    <article class="relative overflow-hidden rounded-[1.8rem] border border-[#d6b07d]/20 bg-[linear-gradient(155deg,rgba(214,176,125,0.12),rgba(255,255,255,0.015))] p-7">
      <div class="grid gap-8 lg:grid-cols-[0.74fr_1.26fr]">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-[#e2ceac]">走向何方</p>
          <h2 class="mt-3 font-display text-[1.9rem] font-semibold leading-tight tracking-[-0.03em] text-[#fbf3e3]">从一座馆的相遇，走向一整片文化的地图</h2>
          <div class="mt-6 space-y-3">
            <p v-for="line in visionLines" :key="line" class="text-sm leading-8 text-[#c9bca4]">
              {{ line }}
            </p>
          </div>
        </div>

        <div data-landing-stagger class="space-y-4">
          <article
            v-for="stage in roadmapStages"
            :key="stage.phase"
            data-stagger-item
            class="rounded-[1.3rem] border border-white/[0.08] bg-white/[0.04] p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-[#e2ceac]">{{ stage.phase }}</p>
                <h3 class="mt-2 text-lg font-semibold text-[#fbf3e3]">{{ stage.target }}</h3>
              </div>
              <span class="rounded-full border border-white/12 px-3 py-1 text-xs text-[#d9caae]">{{ stage.time }}</span>
            </div>
            <p class="mt-3 text-sm leading-7 text-[#c3b69e]">{{ stage.detail }}</p>
          </article>
        </div>
      </div>
    </article>
  </section>
</template>
