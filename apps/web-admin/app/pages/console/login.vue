<script setup lang="ts">
import { computed, reactive, shallowRef, useTemplateRef } from 'vue';
import { ADMIN_AUTH_REDIRECT_QUERY, ADMIN_CONSOLE_HOME_PATH } from '@/constants/admin-auth';
import { useAdminAuthStore } from '@/stores/adminAuth';
import type { AdminLoginForm, AdminLoginPayload, AdminLoginResponse } from '@/types/auth';

definePageMeta({
  layout: 'marketing',
  middleware: 'admin-auth',
});

const route = useRoute();
const { request } = useApiClient();
const authStore = useAdminAuthStore();

const form = reactive<AdminLoginForm>({
  account: '',
  password: '',
});

const submitting = shallowRef(false);
const errorMessage = shallowRef('');
const rootRef = useTemplateRef<HTMLElement>('loginRoot');

const redirectTarget = computed(() => {
  const redirect = route.query[ADMIN_AUTH_REDIRECT_QUERY];
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : ADMIN_CONSOLE_HOME_PATH;
});

const highlights = [
  { index: '01', title: '路线', text: '继续编排场馆路线与故事节点。' },
  { index: '02', title: '谜题', text: '快速回到题型、提示与难度调整。' },
  { index: '03', title: '复盘', text: '根据反馈修正下一次发布节奏。' },
];

const quickNotes = [
  {
    eyebrow: '同一条工作线',
    title: '登录后，直接回到上一次停下的位置。',
    text: '场馆、路线、谜题和内容判断都会沿着同一条工作流继续接续。',
  },
  {
    eyebrow: '继续创作',
    title: '常用操作会更快回到手边。',
    text: '减少查找入口和页面切换，把注意力留给内容判断、发布节奏和现场体验。',
  },
];

useLandingMotion(rootRef);

const handleLogin = async () => {
  errorMessage.value = '';
  submitting.value = true;

  try {
    const account = form.account.trim();
    const payload: AdminLoginPayload = {
      username: account,
      password: form.password,
    };
    const response = await request<AdminLoginResponse | null>('/api/admin/login', {
      method: 'POST',
      body: payload,
    });

    authStore.applyLogin(response ?? {});

    if (!authStore.isAuthenticated) {
      throw new Error('登录成功，但未获取到有效 token。');
    }

    await navigateTo(redirectTarget.value);
  } catch (error) {
    if (error instanceof Error) {
      errorMessage.value = error.message || '登录失败，请检查账号和密码。';
    } else {
      errorMessage.value = '登录失败，请检查账号和密码。';
    }
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <div ref="loginRoot" class="login-page min-h-screen text-[#f4ecdd]">
    <header class="sticky top-0 z-30 border-b border-white/[0.06] bg-[#0b0c0f]/78 backdrop-blur-md">
      <div class="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
        <NuxtLink to="/" class="inline-flex items-center gap-2 text-sm text-[#a79e8f] transition-colors hover:text-[#f4ecdd]">
          <span>←</span>
          返回首页
        </NuxtLink>
        <p class="text-[11px] uppercase tracking-[0.28em] text-[#8f8778]">Admin sign in</p>
      </div>
    </header>

    <main class="flex min-h-[calc(100vh-73px)] items-center">
      <section class="relative w-full overflow-hidden">
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
          <div data-motion-parallax data-parallax-depth="42" class="absolute left-[-10rem] top-[-10rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.14),transparent_68%)]" />
          <div data-motion-parallax data-parallax-depth="60" class="absolute bottom-[-14rem] right-[-5rem] h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.09),transparent_70%)]" />
        </div>

        <div class="mx-auto grid w-full max-w-[1360px] gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:px-10 lg:py-12 xl:gap-16">
          <div class="flex flex-col justify-center">
            <p data-motion-hero class="text-xs uppercase tracking-[0.34em] text-[#c9a25f]">管理员入口</p>
            <h1 data-motion-hero class="mt-5 max-w-[8.4em] font-display text-[3rem] font-semibold leading-[0.96] tracking-[-0.05em] text-[#f5eee0] sm:text-[4.2rem] lg:text-[5.2rem]">
              回到这里，
              继续下一段路线。
            </h1>
            <p data-motion-hero class="mt-5 max-w-xl text-base leading-8 text-[#a59b8c] sm:text-lg">
              登录之后，继续管理场馆、内容与谜题，让当前路线、题型和发布节奏保持连贯。
            </p>

            <div class="mt-8 grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
              <div class="border-t border-white/[0.09]">
                <article
                  v-for="item in highlights"
                  :key="item.index"
                  data-motion-reveal
                  class="grid gap-3 border-b border-white/[0.08] py-4 sm:grid-cols-[72px_1fr] sm:gap-4">
                  <div>
                    <p class="font-display text-[1.7rem] font-semibold tracking-[-0.04em] text-[#d6b07d]">{{ item.index }}</p>
                    <p class="mt-1 text-xs uppercase tracking-[0.2em] text-[#8f8778]">{{ item.title }}</p>
                  </div>
                  <p class="max-w-sm text-sm leading-7 text-[#978f81]">{{ item.text }}</p>
                </article>
              </div>

              <div class="space-y-4 lg:pl-4">
                <article
                  v-for="item in quickNotes"
                  :key="item.title"
                  data-motion-reveal
                  class="border-t border-white/[0.08] pt-4">
                  <p class="text-xs uppercase tracking-[0.26em] text-[#c9a25f]">{{ item.eyebrow }}</p>
                  <h2 class="mt-3 max-w-[14em] font-display text-[1.5rem] font-semibold leading-[1.06] tracking-[-0.04em] text-[#f4ecdd] sm:text-[1.8rem]">
                    {{ item.title }}
                  </h2>
                  <p class="mt-3 max-w-xl text-sm leading-7 text-[#9e9587]">{{ item.text }}</p>
                </article>
              </div>
            </div>
          </div>

          <div class="relative flex items-center lg:justify-end">
            <form
              data-motion-reveal
              class="login-surface w-full max-w-[560px] rounded-[1.4rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-7 backdrop-blur-md sm:p-9"
              @submit.prevent="handleLogin">
              <div>
                <p class="text-xs uppercase tracking-[0.3em] text-[#c9a25f]">Sign in</p>
                <h2 class="mt-3 font-display text-[2rem] font-semibold tracking-[-0.04em] text-[#f5eee0]">管理员登录</h2>
                <p class="mt-3 text-sm leading-7 text-[#948c7d]">输入后台账号，继续管理当前内容工作线。</p>
              </div>

              <div class="mt-8 space-y-5">
                <label class="block space-y-2">
                  <span class="text-sm font-medium text-[#e8ded0]">账号</span>
                  <UiInput v-model="form.account" placeholder="请输入管理员账号" />
                </label>

                <label class="block space-y-2">
                  <span class="text-sm font-medium text-[#e8ded0]">密码</span>
                  <UiInput v-model="form.password" type="password" placeholder="请输入登录密码" />
                </label>

                <p v-if="errorMessage" class="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-[#e79a9a]">
                  {{ errorMessage }}
                </p>

                <UiButton type="submit" size="lg" class="login-submit h-12 w-full text-sm" :disabled="submitting">
                  {{ submitting ? '登录中...' : '进入创作台' }}
                </UiButton>
              </div>
            </form>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.login-page {
  background:
    radial-gradient(circle at 12% -2%, rgba(214, 176, 125, 0.1), transparent 32%),
    radial-gradient(circle at 88% 6%, rgba(214, 176, 125, 0.06), transparent 28%),
    #0b0c0f;
}

.login-surface {
  box-shadow: 0 36px 96px rgba(0, 0, 0, 0.34);
}

:deep(.login-submit) {
  background: #d6b07d;
  color: #141210;
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
}

:deep(.login-submit:hover:not(:disabled)) {
  transform: translateY(-1px);
  background: #e0bd8c;
  box-shadow: 0 18px 40px rgba(214, 176, 125, 0.28);
}
</style>
