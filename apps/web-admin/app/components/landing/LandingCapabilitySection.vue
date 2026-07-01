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
  <section class="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
    <article class="rounded-[1.8rem] border border-[#1f1c16]/10 bg-white/75 p-6">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-[#8c6b43]">B 端控制台</p>
          <h2 class="mt-3 font-serif text-[2.1rem] font-semibold tracking-[-0.04em] text-[#201d18]">像编排剧本一样编排路线</h2>
        </div>
        <div class="rounded-full border border-[#1f1c16]/10 bg-[#f5f0e8] px-4 py-2 text-xs font-medium text-[#5c5247]">
          5 种路线模型 · 2 小时快速出线
        </div>
      </div>

      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <div
          v-for="item in capabilityRows"
          :key="item.title"
          class="rounded-[1.35rem] border border-[#1f1c16]/8 bg-[#fbf7f0] p-4">
          <h3 class="text-base font-semibold text-[#201d18]">{{ item.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-[#5d5449]">{{ item.description }}</p>
        </div>
      </div>
    </article>

    <article class="rounded-[1.8rem] border border-[#1f1c16]/10 bg-[#201d18] p-6 text-[#f6efe3]">
      <p class="text-xs uppercase tracking-[0.28em] text-[#d8b581]">AI Core Engine</p>
      <h2 class="mt-3 font-serif text-[2.1rem] font-semibold tracking-[-0.04em]">效率只是表层，真正的壁垒是内容理解</h2>
      <div class="mt-6 space-y-4">
        <div
          v-for="item in aiEngineSteps"
          :key="item.title"
          class="rounded-[1.25rem] border border-white/10 bg-white/6 p-4">
          <h3 class="text-base font-semibold text-[#fff7ec]">{{ item.title }}</h3>
          <p class="mt-2 text-sm leading-6 text-[#d4c7b7]">{{ item.description }}</p>
        </div>
      </div>
    </article>

    <article class="rounded-[1.8rem] border border-[#1f1c16]/10 bg-[#efe5d6] p-6 xl:col-span-2">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.28em] text-[#8c6b43]">Audience design</p>
          <h2 class="mt-3 font-serif text-[2.1rem] font-semibold tracking-[-0.04em] text-[#201d18]">同一套节点，按人群分层适配三种体验</h2>
        </div>
        <p class="max-w-xl text-sm leading-6 text-[#5d5449]">
          这也是平台思路成立的关键: 一个场馆内容底座，不只服务一个版本，而是面向亲子、成人、外宾持续复用与扩展。
        </p>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-3">
        <article
          v-for="audience in audiences"
          :key="audience.title"
          class="rounded-[1.4rem] border border-[#1f1c16]/10 bg-white/70 p-5">
          <p class="text-xs uppercase tracking-[0.22em] text-[#8c6b43]">{{ audience.tagline }}</p>
          <h3 class="mt-3 text-xl font-semibold tracking-[-0.03em] text-[#201d18]">{{ audience.title }}</h3>
          <p class="mt-3 text-sm leading-6 text-[#5d5449]">{{ audience.description }}</p>
          <div class="mt-4 inline-flex rounded-full bg-[#201d18] px-3 py-1 text-xs font-semibold text-[#f6efe3]">
            {{ audience.pricing }}
          </div>
        </article>
      </div>
    </article>
  </section>
</template>
