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
    <header class="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
      <div class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-full bg-[#201d18] text-sm font-semibold tracking-[0.18em] text-[#f6efe3]">
          PS
        </div>
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-[#8c6b43]">Path Seeker</p>
          <p class="text-sm text-[#5c5247]">文旅场景 AI 解谜平台</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <NuxtLink
          to="/login"
          class="inline-flex h-10 items-center justify-center rounded-full border border-[#1f1c16]/10 bg-white/70 px-5 text-sm font-medium text-[#201d18] transition-colors duration-200 hover:bg-white">
          管理员登录
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-5 pb-14 sm:px-8 lg:px-10 lg:pb-20">
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
    </main>
  </div>
</template>

<style scoped>
.landing-page {
  background:
    radial-gradient(circle at top left, rgba(214, 176, 125, 0.18), transparent 28%),
    radial-gradient(circle at 85% 16%, rgba(32, 29, 24, 0.08), transparent 24%),
    linear-gradient(180deg, #f9f4ed 0%, #f2ebe0 56%, #eee4d7 100%);
}
</style>
