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
  <section class="grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
    <article class="rounded-[1.8rem] border border-[#1f1c16]/10 bg-white/72 p-6">
      <p class="text-xs uppercase tracking-[0.28em] text-[#8c6b43]">Business model</p>
      <h2 class="mt-3 font-serif text-[2.1rem] font-semibold tracking-[-0.04em] text-[#201d18]">收入结构不是单点收费，而是三条腿一起走</h2>
      <div class="mt-6 space-y-4">
        <div
          v-for="item in businessRows"
          :key="item.title"
          class="flex items-start gap-4 rounded-[1.3rem] border border-[#1f1c16]/8 bg-[#fbf7f0] p-4">
          <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#201d18] text-sm font-semibold text-[#f6efe3]">
            {{ item.share }}
          </div>
          <div>
            <h3 class="text-base font-semibold text-[#201d18]">{{ item.title }}</h3>
            <p class="mt-2 text-sm leading-6 text-[#5d5449]">{{ item.detail }}</p>
          </div>
        </div>
      </div>
    </article>

    <article class="rounded-[1.8rem] border border-[#1f1c16]/10 bg-[#201d18] p-6 text-[#f6efe3]">
      <div class="grid gap-6 lg:grid-cols-[0.74fr_1.26fr]">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-[#d8b581]">Roadmap</p>
          <h2 class="mt-3 font-serif text-[2rem] font-semibold tracking-[-0.04em]">从一个馆的 PMF，到全国复制的内容网络</h2>
          <div class="mt-6 space-y-3">
            <p v-for="line in visionLines" :key="line" class="text-sm leading-7 text-[#d4c7b7]">
              {{ line }}
            </p>
          </div>
        </div>

        <div class="space-y-4">
          <article
            v-for="stage in roadmapStages"
            :key="stage.phase"
            class="rounded-[1.3rem] border border-white/10 bg-white/6 p-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-[#d8b581]">{{ stage.phase }}</p>
                <h3 class="mt-2 text-lg font-semibold text-[#fff7ec]">{{ stage.target }}</h3>
              </div>
              <span class="rounded-full border border-white/10 px-3 py-1 text-xs text-[#f0e2ca]">{{ stage.time }}</span>
            </div>
            <p class="mt-3 text-sm leading-6 text-[#d4c7b7]">{{ stage.detail }}</p>
          </article>
        </div>
      </div>
    </article>
  </section>
</template>
