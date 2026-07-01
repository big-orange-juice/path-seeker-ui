<script setup lang="ts">
import type { LandingAudience, LandingStat } from '@/composables/useLandingContent';

interface Props {
  stats: LandingStat[];
  audiences: LandingAudience[];
}

defineProps<Props>();
</script>

<template>
  <section class="relative overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[#111114] px-6 py-10 shadow-[0_50px_140px_rgba(0,0,0,0.55)] sm:px-10 sm:py-14 lg:px-14 lg:py-16">
    <!-- ambient gold glow -->
    <div class="pointer-events-none absolute inset-0" aria-hidden="true">
      <div data-landing-parallax data-parallax-depth="40" class="absolute -left-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.16),transparent_65%)]" />
      <div data-landing-parallax data-parallax-depth="80" class="absolute -bottom-40 right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.10),transparent_68%)]" />
    </div>

    <div class="relative grid gap-10 lg:grid-cols-[1.12fr_0.88fr]">
      <div class="space-y-8">
        <div data-landing-hero class="space-y-5">
          <p class="flex items-center gap-3 text-xs uppercase tracking-[0.34em] text-[#c9a25f]">
            <span class="h-px w-8 bg-[#c9a25f]/60" />
            秘径寻踪 · Path Seeker
          </p>
          <h1 class="max-w-3xl font-display text-[2.9rem] font-semibold leading-[1.02] tracking-[-0.03em] text-[#f5eee0] sm:text-[4rem] lg:text-[5rem]">
            让每一座馆，
            <br>
            都藏着一段
            <br>
            <span class="text-[#d6b07d]">等你走进的故事</span>
          </h1>
          <p class="max-w-xl text-base leading-8 text-[#a79e8f] sm:text-lg">
            这里不是又一个导览页。它是一处安静的创作台——把展品、线索与叙事编织成一条可以亲自走过的路，让文化不再只是被观看，而是被经历。
          </p>
        </div>

        <div data-landing-hero class="flex flex-wrap gap-3">
          <NuxtLink
            to="/login"
            class="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#d6b07d] px-7 text-sm font-semibold text-[#141210] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(214,176,125,0.28)]">
            进入创作台
            <span class="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
          </NuxtLink>
          <a
            href="#platform-story"
            class="inline-flex h-12 items-center justify-center rounded-full border border-white/12 px-7 text-sm font-medium text-[#e8ded0] transition-colors duration-200 hover:border-[#d6b07d]/50 hover:text-[#fff8ee]">
            读一读它的故事
          </a>
        </div>

        <div data-landing-stagger class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="stat in stats"
            :key="stat.label"
            data-stagger-item
            class="rounded-[1.35rem] border border-white/[0.07] bg-white/[0.03] px-4 py-5 backdrop-blur-sm transition-colors duration-300 hover:border-[#d6b07d]/30">
            <p class="font-display text-[1.7rem] font-semibold tracking-[-0.03em] text-[#f7edda]">{{ stat.value }}</p>
            <p class="mt-2 text-sm font-medium text-[#d6b07d]">{{ stat.label }}</p>
            <p class="mt-2 text-sm leading-6 text-[#8f877a]">{{ stat.note }}</p>
          </article>
        </div>
      </div>

      <div data-landing-hero class="relative min-h-[440px] overflow-hidden rounded-[1.8rem] border border-white/[0.08] bg-[radial-gradient(circle_at_top,rgba(214,176,125,0.18),transparent_55%),linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-5">
        <div class="absolute inset-x-6 top-6 rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-center text-[11px] uppercase tracking-[0.28em] text-[#e2ceac] backdrop-blur-sm">
          一套内容 · 三种旅程
        </div>

        <div class="mt-16 space-y-4">
          <article
            v-for="audience in audiences"
            :key="audience.title"
            class="rounded-[1.4rem] border border-white/[0.07] bg-white/[0.04] px-5 py-5 backdrop-blur-sm transition-colors duration-300 hover:border-[#d6b07d]/30">
            <p class="text-xs uppercase tracking-[0.22em] text-[#c9a25f]">{{ audience.tagline }}</p>
            <div class="mt-3 flex items-start justify-between gap-3">
              <div>
                <h2 class="font-display text-[1.45rem] font-semibold tracking-[-0.03em] text-[#f4ecdd]">{{ audience.title }}</h2>
                <p class="mt-2 text-sm leading-6 text-[#98907f]">{{ audience.description }}</p>
              </div>
              <span class="shrink-0 rounded-full border border-[#d6b07d]/30 px-3 py-1 text-xs font-medium text-[#d6b07d]">{{ audience.pricing }}</span>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
