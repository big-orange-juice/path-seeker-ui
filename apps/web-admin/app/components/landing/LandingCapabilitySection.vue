<script setup lang="ts">
import type { LandingAudience, LandingHighlight } from '@/composables/useLandingContent';

interface Props {
  capabilityRows: LandingHighlight[];
  aiEngineSteps: LandingHighlight[];
  audiences: LandingAudience[];
}

defineProps<Props>();
</script>

<template>
  <section class="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
    <article class="rounded-[1.8rem] border border-white/[0.07] bg-white/[0.03] p-7">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-[#c9a25f]">创作台</p>
          <h2 class="mt-3 font-display text-[2rem] font-semibold tracking-[-0.03em] text-[#f4ecdd]">像铺开一张地图，编排一条故事线</h2>
        </div>
        <div class="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-[#b3ab9c]">
          五种路线 · 一个下午成形
        </div>
      </div>

      <div data-landing-stagger class="mt-7 grid gap-4 md:grid-cols-3">
        <div
          v-for="item in capabilityRows"
          :key="item.title"
          data-stagger-item
          class="rounded-[1.35rem] border border-white/[0.06] bg-white/[0.02] p-5 transition-colors duration-300 hover:border-[#d6b07d]/30">
          <h3 class="text-base font-semibold text-[#f0e8d9]">{{ item.title }}</h3>
          <p class="mt-2 text-sm leading-7 text-[#948c7d]">{{ item.description }}</p>
        </div>
      </div>
    </article>

    <article class="relative overflow-hidden rounded-[1.8rem] border border-[#d6b07d]/20 bg-[linear-gradient(165deg,rgba(214,176,125,0.12),rgba(255,255,255,0.015))] p-7">
      <p class="text-xs uppercase tracking-[0.28em] text-[#e2ceac]">内容引擎</p>
      <h2 class="mt-3 font-display text-[2rem] font-semibold tracking-[-0.03em] text-[#fbf3e3]">效率是表象，读懂文化才是底气</h2>
      <div data-landing-stagger class="mt-7 space-y-4">
        <div
          v-for="(item, index) in aiEngineSteps"
          :key="item.title"
          data-stagger-item
          class="flex gap-4 rounded-[1.25rem] border border-white/[0.08] bg-white/[0.04] p-5">
          <span class="font-display text-lg font-semibold text-[#d6b07d]">0{{ index + 1 }}</span>
          <div>
            <h3 class="text-base font-semibold text-[#fbf3e3]">{{ item.title }}</h3>
            <p class="mt-1.5 text-sm leading-7 text-[#c3b69e]">{{ item.description }}</p>
          </div>
        </div>
      </div>
    </article>

    <article class="rounded-[1.8rem] border border-white/[0.07] bg-white/[0.03] p-7 xl:col-span-2">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-[#c9a25f]">因人而异</p>
          <h2 class="mt-3 font-display text-[2rem] font-semibold tracking-[-0.03em] text-[#f4ecdd]">同一套节点，为不同的人讲不同的故事</h2>
        </div>
        <p class="max-w-xl text-sm leading-7 text-[#948c7d]">
          这正是它成立的关键：一座馆的内容底座，不必只服务一种人。它为孩子、为同伴、为远道而来的客人，各自铺一条恰如其分的路。
        </p>
      </div>

      <div data-landing-stagger class="mt-7 grid gap-4 lg:grid-cols-3">
        <article
          v-for="audience in audiences"
          :key="audience.title"
          data-stagger-item
          class="rounded-[1.4rem] border border-white/[0.06] bg-white/[0.02] p-6 transition-colors duration-300 hover:border-[#d6b07d]/30">
          <p class="text-xs uppercase tracking-[0.2em] text-[#c9a25f]">{{ audience.tagline }}</p>
          <h3 class="mt-3 font-display text-xl font-semibold tracking-[-0.02em] text-[#f0e8d9]">{{ audience.title }}</h3>
          <p class="mt-3 text-sm leading-7 text-[#948c7d]">{{ audience.description }}</p>
          <div class="mt-5 inline-flex rounded-full border border-[#d6b07d]/30 px-3 py-1 text-xs font-medium text-[#d6b07d]">
            {{ audience.pricing }}
          </div>
        </article>
      </div>
    </article>
  </section>
</template>
