<script setup lang="ts">
import type { LandingHighlight } from '@/composables/useLandingContent';

interface Props {
  marketSignals: LandingHighlight[];
  painPoints: LandingHighlight[];
  solutionPillars: LandingHighlight[];
}

defineProps<Props>();
</script>

<template>
  <section id="platform-story" class="grid gap-6 lg:grid-cols-[0.78fr_1.22fr]">
    <div class="space-y-4 rounded-[1.75rem] border border-[#1f1c16]/10 bg-white/70 p-6">
      <p class="text-xs uppercase tracking-[0.28em] text-[#8c6b43]">Market to product thesis</p>
      <h2 class="font-serif text-[2rem] font-semibold leading-tight tracking-[-0.04em] text-[#201d18] sm:text-[2.5rem]">
        不是再做一个导览页，
        <br>
        而是把“内容供给”变成“体验生产线”
      </h2>
      <p class="text-sm leading-7 text-[#5d5449] sm:text-base">
        PPT 里的主线非常明确：文旅数字化市场已经成熟，但互动解谜仍是供给不足的空白带。Path Seeker 要做的不是单次项目，而是一套让场馆内部可以持续生产、发布、复盘和复用体验内容的平台。
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
      <article class="rounded-[1.6rem] border border-[#1f1c16]/10 bg-[#efe5d6] p-5">
        <p class="text-xs uppercase tracking-[0.28em] text-[#8c6b43]">01 / 市场机会</p>
        <div class="mt-4 space-y-4">
          <div v-for="item in marketSignals" :key="item.title" class="space-y-2">
            <h3 class="text-base font-semibold text-[#201d18]">{{ item.title }}</h3>
            <p class="text-sm leading-6 text-[#5a5045]">{{ item.description }}</p>
          </div>
        </div>
      </article>

      <article class="rounded-[1.6rem] border border-[#1f1c16]/10 bg-[#f7f1e8] p-5">
        <p class="text-xs uppercase tracking-[0.28em] text-[#8c6b43]">02 / 核心痛点</p>
        <div class="mt-4 space-y-4">
          <div v-for="item in painPoints" :key="item.title" class="space-y-2">
            <h3 class="text-base font-semibold text-[#201d18]">{{ item.title }}</h3>
            <p class="text-sm leading-6 text-[#5a5045]">{{ item.description }}</p>
          </div>
        </div>
      </article>

      <article class="rounded-[1.6rem] border border-[#1f1c16]/10 bg-[#201d18] p-5 text-[#f6efe3]">
        <p class="text-xs uppercase tracking-[0.28em] text-[#d8b581]">03 / 双端方案</p>
        <div class="mt-4 space-y-4">
          <div v-for="item in solutionPillars" :key="item.title" class="space-y-2">
            <h3 class="text-base font-semibold text-[#fff7ec]">{{ item.title }}</h3>
            <p class="text-sm leading-6 text-[#d4c7b7]">{{ item.description }}</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
