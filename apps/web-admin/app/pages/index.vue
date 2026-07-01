<script setup lang="ts">
import { useTemplateRef } from 'vue';

definePageMeta({
  layout: 'marketing',
});

const rootRef = useTemplateRef<HTMLElement>('landingRoot');

const heroMetrics = [
  { value: '5', label: '路线模型', note: '线性、分支、寻宝、竞速、主题展。' },
  { value: '3 min', label: '生成一道题', note: '从展品到题面、提示与答案。' },
  { value: '1 套底座', label: '多种体验', note: '亲子、成人与外宾共享同一内容线。' },
];

const storyChapters = [
  {
    index: '01',
    eyebrow: '线索',
    title: '把展品变成可走进去的叙事。',
    body: '不是再做一页导览，而是把路线、谜题和节奏排成一段旅程。',
    detail: '观众看到的不是功能，而是一条自然展开的故事线。',
  },
  {
    index: '02',
    eyebrow: '创作',
    title: '让策展人自己完成编排。',
    body: '像排镜头一样组织节点，拖动、取舍、重写，都留在同一条工作线上。',
    detail: 'AI 负责提速，人负责判断。',
  },
  {
    index: '03',
    eyebrow: '复盘',
    title: '每次上线都能带回新的判断。',
    body: '完成率、停留点和路径偏移，会反过来修正下一版内容。',
    detail: '讲述不是一次性交付，而是持续打磨。',
  },
];

const modules = [
  {
    label: 'Route editor',
    title: '路线是一条连续工作流。',
    description: '节点、场景、转场和提示都在一处完成，不再散落在多个后台表单里。',
  },
  {
    label: 'AI engine',
    title: '生成不是堆词，而是补齐语境。',
    description: '在馆藏资料、规则和语气约束之后再生成，内容更稳，改写更快。',
  },
  {
    label: 'Operations',
    title: '运营判断回到内容本身。',
    description: '知道哪里慢、哪里难、哪里最动人，下一次就能更精准地改。',
  },
];

const journeyMoments = [
  { title: '起笔', text: '选一件展品，确定这段旅程从哪里开场。' },
  { title: '铺陈', text: '把故事节点、谜题难度和提示节奏排成一条线。' },
  { title: '落地', text: '发布到场馆现场，让真实反馈修正下一次讲述。' },
];

useLandingMotion(rootRef);
</script>

<template>
  <div ref="landingRoot" class="landing-page text-[#f4ecdd]">
    <header class="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b0c0f]/78 backdrop-blur-md">
      <div class="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <div class="flex items-center gap-3">
          <div class="flex h-10 w-10 items-center justify-center rounded-full border border-[#d6b07d]/25 text-xs font-semibold tracking-[0.18em] text-[#d6b07d]">
            PS
          </div>
          <div>
            <p class="font-display text-[0.95rem] font-semibold tracking-[0.01em] text-[#f4ecdd]">秘径寻踪</p>
            <p class="text-[11px] uppercase tracking-[0.24em] text-[#8f8778]">Path Seeker</p>
          </div>
        </div>

        <NuxtLink
          to="/console/login"
          class="inline-flex h-10 items-center justify-center rounded-full border border-white/12 px-5 text-sm text-[#dfd4c5] transition-colors duration-200 hover:border-[#d6b07d]/45 hover:text-[#fff8ee]">
          管理员登录
        </NuxtLink>
      </div>
    </header>

    <main>
      <section class="relative overflow-hidden border-b border-white/[0.06]">
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
          <div data-motion-parallax data-parallax-depth="44" class="absolute left-[-8rem] top-[-10rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.16),transparent_68%)]" />
          <div data-motion-parallax data-parallax-depth="68" class="absolute bottom-[-16rem] right-[-6rem] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.09),transparent_70%)]" />
        </div>

        <div class="mx-auto grid min-h-[92vh] w-full max-w-[1360px] gap-14 px-5 py-14 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-20">
          <div class="relative flex flex-col justify-center py-4 lg:py-10">
            <p data-motion-hero class="text-xs uppercase tracking-[0.34em] text-[#c9a25f]">文化场景 · AI 叙事创作台</p>
            <h1 data-motion-hero class="mt-6 max-w-[8.5em] font-display text-[3.3rem] font-semibold leading-[0.96] tracking-[-0.05em] text-[#f5eee0] sm:text-[4.8rem] lg:text-[6.4rem]">
              让一座馆的内容，
              <span class="text-[#d6b07d]">慢慢展开</span>
              成一段旅程。
            </h1>
            <p data-motion-hero class="mt-6 max-w-xl text-base leading-8 text-[#a59b8c] sm:text-lg">
              从展品出发，把路线、谜题与运营判断连成一条清晰的内容工作线，让每一次到访都更完整。
            </p>

            <div data-motion-hero class="mt-10 flex flex-wrap gap-3">
              <NuxtLink
                to="/console/login"
                class="inline-flex h-12 items-center justify-center rounded-full bg-[#d6b07d] px-7 text-sm font-semibold text-[#141210] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#dec08e] hover:shadow-[0_18px_40px_rgba(214,176,125,0.28)]">
                进入创作台
              </NuxtLink>
              <a
                href="#landing-story"
                class="inline-flex h-12 items-center justify-center rounded-full border border-white/12 px-7 text-sm text-[#dfd4c5] transition-colors duration-200 hover:border-[#d6b07d]/45 hover:text-[#fff8ee]">
                继续下滑
              </a>
            </div>
          </div>

          <div class="relative flex items-end lg:justify-end">
            <div class="hero-rail w-full max-w-[440px]">
              <div class="border-t border-white/[0.09]">
                <article
                  v-for="metric in heroMetrics"
                  :key="metric.label"
                  data-motion-reveal
                  class="grid gap-3 border-b border-white/[0.08] py-5 sm:grid-cols-[110px_1fr] sm:gap-5">
                  <div>
                    <p class="font-display text-[2rem] font-semibold tracking-[-0.04em] text-[#f5eee0]">{{ metric.value }}</p>
                    <p class="mt-1 text-xs uppercase tracking-[0.22em] text-[#c9a25f]">{{ metric.label }}</p>
                  </div>
                  <p class="max-w-xs text-sm leading-7 text-[#978f81]">{{ metric.note }}</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="landing-story" class="border-b border-white/[0.06]">
        <div class="mx-auto grid w-full max-w-[1360px] gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-10 lg:py-24">
          <div class="lg:sticky lg:top-24 lg:self-start">
            <p class="text-xs uppercase tracking-[0.32em] text-[#c9a25f]">内容主张</p>
            <h2 class="mt-4 max-w-md font-display text-[2.4rem] font-semibold leading-[1.03] tracking-[-0.04em] text-[#f4ecdd] sm:text-[3.3rem]">
              把一座馆的内容，
              组织成可反复打磨的旅程。
            </h2>
            <p class="mt-5 max-w-md text-sm leading-8 text-[#9e9587] sm:text-base">
              从内容编排到现场体验，再到上线后的复盘，所有关键动作都围绕同一条工作线展开。
            </p>
            <div data-motion-rule class="mt-8 h-px w-full max-w-[260px] bg-gradient-to-r from-[#d6b07d]/70 to-transparent" />
          </div>

          <div class="space-y-20">
            <article
              v-for="chapter in storyChapters"
              :key="chapter.index"
              data-motion-scrub
              data-motion-y="104"
              class="story-row border-t border-white/[0.08] pt-6 lg:pt-8">
              <div class="grid gap-5 lg:grid-cols-[120px_1fr] lg:gap-8">
                <div>
                  <p class="font-display text-[1.9rem] font-semibold tracking-[-0.04em] text-[#d6b07d]">{{ chapter.index }}</p>
                  <p class="mt-2 text-xs uppercase tracking-[0.24em] text-[#8f8778]">{{ chapter.eyebrow }}</p>
                </div>
                <div>
                  <h3 class="max-w-3xl font-display text-[2rem] font-semibold leading-[1.06] tracking-[-0.04em] text-[#f5eee0] sm:text-[2.7rem]">
                    {{ chapter.title }}
                  </h3>
                  <p class="mt-4 max-w-2xl text-base leading-8 text-[#d8cebf]">{{ chapter.body }}</p>
                  <p class="mt-3 text-sm uppercase tracking-[0.16em] text-[#8f8778]">{{ chapter.detail }}</p>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="border-b border-white/[0.06]">
        <div class="mx-auto grid w-full max-w-[1360px] gap-14 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_0.95fr] lg:px-10 lg:py-24">
          <div>
            <p class="text-xs uppercase tracking-[0.32em] text-[#c9a25f]">平台结构</p>
            <h2 class="mt-4 max-w-[11em] font-display text-[2.4rem] font-semibold leading-[1.02] tracking-[-0.04em] text-[#f4ecdd] sm:text-[3.2rem]">
              一个后台，
              把创作和运营接在一起。
            </h2>
            <div class="mt-10 space-y-10">
              <article
                v-for="item in modules"
                :key="item.label"
                data-motion-reveal
                class="border-t border-white/[0.08] pt-5">
                <p class="text-xs uppercase tracking-[0.24em] text-[#8f8778]">{{ item.label }}</p>
                <h3 class="mt-3 text-[1.35rem] font-semibold tracking-[-0.02em] text-[#f1e8d9] sm:text-[1.6rem]">{{ item.title }}</h3>
                <p class="mt-3 max-w-xl text-sm leading-8 text-[#9e9587] sm:text-base">{{ item.description }}</p>
              </article>
            </div>
          </div>

          <div class="relative min-h-[540px] lg:min-h-[860px]">
            <div class="pointer-events-none absolute inset-0" aria-hidden="true">
              <div data-motion-parallax data-parallax-depth="52" class="absolute inset-x-8 top-10 h-[22rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.1),transparent_72%)] blur-2xl" />
            </div>

            <div class="showcase-stage lg:sticky lg:top-24">
              <div class="showcase-shell overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] px-6 py-6 backdrop-blur-md sm:px-7 sm:py-7">
                <div class="flex items-center justify-between border-b border-white/[0.08] pb-4">
                  <div>
                    <p class="text-xs uppercase tracking-[0.26em] text-[#c9a25f]">内容工作线</p>
                    <p class="mt-2 font-display text-[1.5rem] font-semibold tracking-[-0.03em] text-[#f5eee0]">从起点一路写到发布</p>
                  </div>
                  <span class="rounded-full border border-[#d6b07d]/25 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#d6b07d]">live flow</span>
                </div>

                <div data-motion-stagger class="mt-4 space-y-1">
                  <article
                    v-for="moment in journeyMoments"
                    :key="moment.title"
                    data-stagger-item
                    class="grid gap-3 border-b border-white/[0.08] py-5 last:border-b-0 sm:grid-cols-[96px_1fr]">
                    <p class="text-xs uppercase tracking-[0.22em] text-[#8f8778]">{{ moment.title }}</p>
                    <p class="text-sm leading-7 text-[#d8cebf] sm:text-base">{{ moment.text }}</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="relative overflow-hidden">
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
          <div data-motion-parallax data-parallax-depth="60" class="absolute left-1/2 top-[-8rem] h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.14),transparent_68%)]" />
        </div>

        <div class="mx-auto flex min-h-[72vh] w-full max-w-[1360px] items-center px-5 py-16 sm:px-8 lg:px-10 lg:py-24">
          <div class="max-w-3xl">
            <p data-motion-hero class="text-xs uppercase tracking-[0.34em] text-[#c9a25f]">现在开始</p>
            <h2 data-motion-hero class="mt-5 font-display text-[2.8rem] font-semibold leading-[1] tracking-[-0.05em] text-[#f5eee0] sm:text-[4rem] lg:text-[5rem]">
              下一个版本，
              <br>
              应该像作品一样被打磨。
            </h2>
            <p data-motion-hero class="mt-6 max-w-2xl text-base leading-8 text-[#a59b8c] sm:text-lg">
              登录之后，继续管理场馆、路线与谜题，把内容工作重新组织成一条更清楚的线。
            </p>
            <div data-motion-hero class="mt-10">
              <NuxtLink
                to="/console/login"
                class="inline-flex h-12 items-center justify-center rounded-full bg-[#d6b07d] px-8 text-sm font-semibold text-[#141210] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#dec08e] hover:shadow-[0_18px_40px_rgba(214,176,125,0.28)]">
                进入后台
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.landing-page {
  background:
    radial-gradient(circle at 10% -2%, rgba(214, 176, 125, 0.1), transparent 30%),
    radial-gradient(circle at 92% 8%, rgba(214, 176, 125, 0.06), transparent 28%),
    #0b0c0f;
}

.hero-rail {
  position: relative;
}

.hero-rail::before {
  content: '';
  position: absolute;
  inset: -2rem 12% auto 12%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(214, 176, 125, 0.22), transparent);
}

.story-row {
  will-change: transform, opacity;
}

.showcase-stage {
  position: relative;
}

.showcase-shell {
  box-shadow: 0 40px 110px rgba(0, 0, 0, 0.36);
}
</style>

