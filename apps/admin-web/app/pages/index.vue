<template>
  <main class="min-h-screen px-6 py-10">
    <section class="mx-auto max-w-6xl rounded-[32px] border border-amber-950/10 bg-white/75 p-8 shadow-[0_20px_80px_rgba(44,24,16,0.08)] backdrop-blur">
      <p class="text-sm font-semibold uppercase tracking-[0.3em] text-amber-700">
        Path Seeker Admin
      </p>
      <h1 class="mt-4 text-4xl font-black tracking-tight text-stone-900">
        博物馆导览解密后台
      </h1>
      <p class="mt-4 max-w-3xl text-base leading-7 text-stone-700">
        当前已切换到 Nuxt 4 推荐的 app 目录结构。后续这里将承载馆藏管理、谜题工坊、
        主题编排、AI 工作台与运营数据看板。
      </p>

      <div class="mt-8 grid gap-4 md:grid-cols-3">
        <article class="rounded-2xl bg-stone-900 p-5 text-stone-50">
          <p class="text-xs uppercase tracking-[0.24em] text-amber-300">Module</p>
          <h2 class="mt-2 text-xl font-bold">馆藏管理</h2>
          <p class="mt-2 text-sm text-stone-300">录入文物、图像、故事和可出题线索。</p>
        </article>
        <article class="rounded-2xl bg-amber-600 p-5 text-white">
          <p class="text-xs uppercase tracking-[0.24em] text-amber-100">Module</p>
          <h2 class="mt-2 text-xl font-bold">谜题工坊</h2>
          <p class="mt-2 text-sm text-amber-50">围绕年龄段快速编排谜题、提示和奖励。</p>
        </article>
        <article class="rounded-2xl bg-white p-5 text-stone-900 ring-1 ring-stone-200">
          <p class="text-xs uppercase tracking-[0.24em] text-stone-500">Module</p>
          <h2 class="mt-2 text-xl font-bold">主题编排</h2>
          <p class="mt-2 text-sm text-stone-600">配置章节、路线、解锁条件与结局反馈。</p>
        </article>
      </div>
    </section>
  </main>
</template>
