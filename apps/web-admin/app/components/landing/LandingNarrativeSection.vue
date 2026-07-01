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
  <section id="platform-story" class="space-y-8">
    <div class="max-w-3xl space-y-5">
      <p class="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-[#c9a25f]">
        <span class="h-px w-8 bg-[#c9a25f]/60" />
        我们为什么在做这件事
      </p>
      <h2 class="font-display text-[2.1rem] font-semibold leading-[1.12] tracking-[-0.03em] text-[#f4ecdd] sm:text-[2.8rem]">
        不是再造一个导览页，
        <br>
        而是把「讲述」重新交回给文化本身
      </h2>
      <p class="text-base leading-8 text-[#a49b8c]">
        文物静默无言，故事却从未消失。我们相信，一次好的相遇不必依赖漫长的定制，也不该被语言与形式所困——它只需要一处让创作自然发生的地方。
      </p>
      <div data-landing-rule class="h-px w-full max-w-md bg-gradient-to-r from-[#d6b07d]/60 to-transparent" />
    </div>

    <div data-landing-stagger class="grid gap-4 md:grid-cols-3">
      <article data-stagger-item class="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.03] p-6">
        <p class="text-xs uppercase tracking-[0.28em] text-[#c9a25f]">01 · 缘起</p>
        <div class="mt-5 space-y-5">
          <div v-for="item in marketSignals" :key="item.title" class="space-y-2">
            <h3 class="text-base font-semibold text-[#f0e8d9]">{{ item.title }}</h3>
            <p class="text-sm leading-7 text-[#948c7d]">{{ item.description }}</p>
          </div>
        </div>
      </article>

      <article data-stagger-item class="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.03] p-6">
        <p class="text-xs uppercase tracking-[0.28em] text-[#c9a25f]">02 · 转身</p>
        <div class="mt-5 space-y-5">
          <div v-for="item in painPoints" :key="item.title" class="space-y-2">
            <h3 class="text-base font-semibold text-[#f0e8d9]">{{ item.title }}</h3>
            <p class="text-sm leading-7 text-[#948c7d]">{{ item.description }}</p>
          </div>
        </div>
      </article>

      <article data-stagger-item class="relative overflow-hidden rounded-[1.6rem] border border-[#d6b07d]/25 bg-[linear-gradient(160deg,rgba(214,176,125,0.14),rgba(255,255,255,0.02))] p-6">
        <p class="text-xs uppercase tracking-[0.28em] text-[#e2ceac]">03 · 我们如何做</p>
        <div class="mt-5 space-y-5">
          <div v-for="item in solutionPillars" :key="item.title" class="space-y-2">
            <h3 class="text-base font-semibold text-[#fbf3e3]">{{ item.title }}</h3>
            <p class="text-sm leading-7 text-[#c3b69e]">{{ item.description }}</p>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
