<script setup lang="ts">
import type { LandingAudience, LandingStat } from '@/composables/useLandingContent';

interface Props {
  stats: LandingStat[];
  audiences: LandingAudience[];
}

defineProps<Props>();
</script>

<template>
  <section class="overflow-hidden rounded-[2rem] border border-[#1f1c16]/10 bg-[#201d18] px-6 py-8 text-[#f6efe3] shadow-[0_40px_120px_rgba(32,29,24,0.18)] sm:px-8 sm:py-10 lg:px-12 lg:py-12">
    <div class="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div class="space-y-6">
        <div data-landing-hero class="space-y-3">
          <p class="text-xs uppercase tracking-[0.32em] text-[#d6b07d]">Path Seeker · B-Side Platform</p>
          <h1 class="max-w-3xl font-serif text-[2.8rem] font-semibold leading-[0.95] tracking-[-0.04em] sm:text-[4rem] lg:text-[5.3rem]">
            把场馆内容
            <br>
            组织成一场
            <br>
            可复制的解谜冒险
          </h1>
          <p class="max-w-2xl text-base leading-7 text-[#d8d1c7] sm:text-lg">
            面向博物馆、景区与文化空间的创作控制台。用更低门槛的路线编排、更高效率的 AI 生成和更完整的数据闭环，把一次性项目变成持续运营能力。
          </p>
        </div>

        <div data-landing-hero class="flex flex-wrap gap-3">
          <NuxtLink
            to="/login"
            class="inline-flex h-11 items-center justify-center rounded-full bg-[#d6b07d] px-6 text-sm font-semibold text-[#201d18] transition-transform duration-200 hover:-translate-y-0.5">
            登录控制台
          </NuxtLink>
          <a
            href="#platform-story"
            class="inline-flex h-11 items-center justify-center rounded-full border border-[#f6efe3]/18 px-6 text-sm font-medium text-[#f6efe3] transition-colors duration-200 hover:border-[#d6b07d]/50 hover:text-[#fff8ee]">
            查看平台摘要
          </a>
        </div>

        <div data-landing-hero class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <article
            v-for="stat in stats"
            :key="stat.label"
            class="rounded-[1.35rem] border border-white/8 bg-white/6 px-4 py-4 backdrop-blur-sm">
            <p class="text-[1.6rem] font-semibold tracking-[-0.04em] text-[#fff7ec]">{{ stat.value }}</p>
            <p class="mt-2 text-sm font-medium text-[#f1e0c6]">{{ stat.label }}</p>
            <p class="mt-2 text-sm leading-6 text-[#bcb3a6]">{{ stat.note }}</p>
          </article>
        </div>
      </div>

      <div data-landing-hero class="relative min-h-[420px] overflow-hidden rounded-[1.8rem] border border-white/10 bg-[radial-gradient(circle_at_top,rgba(214,176,125,0.28),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] p-5">
        <div class="absolute inset-x-6 top-6 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[#e9d9bf] backdrop-blur-sm">
          One platform, layered experiences
        </div>

        <div class="mt-16 space-y-4">
          <article
            v-for="audience in audiences"
            :key="audience.title"
            class="rounded-[1.4rem] border border-white/10 bg-[#f7f1e8] px-5 py-5 text-[#201d18]">
            <p class="text-xs uppercase tracking-[0.24em] text-[#8c6b43]">{{ audience.tagline }}</p>
            <div class="mt-3 flex items-start justify-between gap-3">
              <div>
                <h2 class="font-serif text-[1.5rem] font-semibold tracking-[-0.04em]">{{ audience.title }}</h2>
                <p class="mt-2 text-sm leading-6 text-[#5c5247]">{{ audience.description }}</p>
              </div>
              <span class="rounded-full bg-[#201d18] px-3 py-1 text-xs font-semibold text-[#f6efe3]">{{ audience.pricing }}</span>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>
