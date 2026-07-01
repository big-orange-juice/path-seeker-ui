<script setup lang="ts">
import { useTemplateRef } from 'vue';

definePageMeta({
  layout: 'marketing',
});

const rootRef = useTemplateRef<HTMLElement>('landingRoot');
const {
  heroStats,
  marketSignals,
  painPoints,
  solutionPillars,
  capabilityRows,
  aiEngineSteps,
  audiences,
  businessRows,
  roadmapStages,
  visionLines,
} = useLandingContent();

useLandingMotion(rootRef);
</script>

<template>
  <div ref="landingRoot" class="landing-page">
    <header class="sticky top-0 z-30 border-b border-white/[0.05] bg-[#0b0c0f]/72 backdrop-blur-md">
      <div class="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-full border border-[#d6b07d]/30 bg-[#d6b07d]/10 text-sm font-semibold tracking-[0.14em] text-[#d6b07d]">
            PS
          </div>
          <div>
            <p class="font-display text-[0.95rem] font-semibold tracking-[0.02em] text-[#f4ecdd]">秘径寻踪</p>
            <p class="text-[11px] uppercase tracking-[0.24em] text-[#8c8375]">Path Seeker</p>
          </div>
        </div>

        <NuxtLink
          to="/login"
          class="inline-flex h-10 items-center justify-center rounded-full border border-white/12 px-5 text-sm font-medium text-[#e8ded0] transition-colors duration-200 hover:border-[#d6b07d]/50 hover:text-[#fff8ee]">
          管理员登录
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-5 pb-20 pt-8 sm:px-8 lg:px-10 lg:pb-28">
      <div data-landing-reveal>
        <LandingHeroSection :stats="heroStats" :audiences="audiences" />
      </div>

      <div data-landing-reveal>
        <LandingNarrativeSection
          :market-signals="marketSignals"
          :pain-points="painPoints"
          :solution-pillars="solutionPillars" />
      </div>

      <div data-landing-reveal>
        <LandingCapabilitySection
          :capability-rows="capabilityRows"
          :ai-engine-steps="aiEngineSteps"
          :audiences="audiences" />
      </div>

      <div data-landing-reveal>
        <LandingBusinessSection
          :business-rows="businessRows"
          :roadmap-stages="roadmapStages"
          :vision-lines="visionLines" />
      </div>

      <div data-landing-reveal>
        <section class="relative overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[#111114] px-6 py-14 text-center sm:px-10 sm:py-20">
          <div class="pointer-events-none absolute inset-0" aria-hidden="true">
            <div data-landing-parallax data-parallax-depth="50" class="absolute left-1/2 top-[-8rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.16),transparent_66%)]" />
          </div>
          <div class="relative mx-auto max-w-2xl space-y-6">
            <p class="text-xs uppercase tracking-[0.34em] text-[#c9a25f]">开始编排</p>
            <h2 class="font-display text-[2.2rem] font-semibold leading-[1.1] tracking-[-0.03em] text-[#f5eee0] sm:text-[3.2rem]">
              下一个故事，
              <br class="sm:hidden">
              等你写下第一笔
            </h2>
            <p class="mx-auto max-w-xl text-base leading-8 text-[#a49b8c]">
              登录创作台，把一件展品、一条线索、一段叙事，编织成一次值得被记住的相遇。
            </p>
            <div class="flex justify-center pt-2">
              <NuxtLink
                to="/login"
                class="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[#d6b07d] px-8 text-sm font-semibold text-[#141210] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(214,176,125,0.28)]">
                进入创作台
                <span class="transition-transform duration-200 group-hover:translate-x-0.5">→</span>
              </NuxtLink>
            </div>
          </div>
        </section>
      </div>
    </main>

    <footer class="border-t border-white/[0.05]">
      <div class="mx-auto flex w-full max-w-[1320px] flex-col items-center justify-between gap-3 px-5 py-8 text-xs text-[#7d766a] sm:flex-row sm:px-8 lg:px-10">
        <p>秘径寻踪 · Path Seeker — 让文化被经历，而非只是被观看。</p>
        <p class="tracking-[0.2em] text-[#8c8375]">文旅场景 · AI 解谜创作平台</p>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing-page {
  background:
    radial-gradient(circle at 12% -4%, rgba(214, 176, 125, 0.1), transparent 32%),
    radial-gradient(circle at 88% 6%, rgba(214, 176, 125, 0.06), transparent 30%),
    #0b0c0f;
}
</style>
