<script setup lang="ts">
import { computed, onMounted, reactive, shallowRef, useTemplateRef } from 'vue';
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

const redirectTarget = computed(() => {
  const redirect = route.query[ADMIN_AUTH_REDIRECT_QUERY];
  return typeof redirect === 'string' && redirect.startsWith('/') ? redirect : ADMIN_CONSOLE_HOME_PATH;
});

const highlights = [
  { index: '01', text: '像铺开地图一样，编排一条叙事路线' },
  { index: '02', text: '让 AI 读懂展品，生成谜题与剧情' },
  { index: '03', text: '在数据里回望，让下一次讲述更动人' },
];

const rootRef = useTemplateRef<HTMLElement>('loginRoot');

onMounted(async () => {
  if (!rootRef.value) {
    return;
  }

  const { gsap } = await import('gsap');
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (media.matches) {
    return;
  }

  gsap.context(() => {
    gsap.from('[data-login-reveal]', {
      y: 26,
      autoAlpha: 0,
      duration: 0.8,
      ease: 'power3.out',
      stagger: 0.1,
    });
  }, rootRef.value);
});

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
  <div ref="loginRoot" class="login-page min-h-screen">
    <div class="mx-auto grid min-h-screen w-full max-w-[1320px] gap-6 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-10">
      <section
        data-login-reveal
        class="relative flex flex-col justify-between overflow-hidden rounded-[2rem] border border-white/[0.06] bg-[#111114] px-7 py-8 shadow-[0_50px_130px_rgba(0,0,0,0.5)] sm:px-9 sm:py-10">
        <div class="pointer-events-none absolute inset-0" aria-hidden="true">
          <div class="absolute -left-20 -top-24 h-[22rem] w-[22rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.16),transparent_65%)]" />
          <div class="absolute -bottom-28 right-[-4rem] h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,rgba(214,176,125,0.08),transparent_68%)]" />
        </div>

        <div class="relative space-y-7">
          <NuxtLink to="/" class="inline-flex items-center gap-2 text-sm text-[#a49b8c] transition-colors hover:text-[#f4ecdd]">
            <span>←</span>
            返回首页
          </NuxtLink>

          <div class="space-y-4">
            <p class="flex items-center gap-3 text-xs uppercase tracking-[0.32em] text-[#c9a25f]">
              <span class="h-px w-8 bg-[#c9a25f]/60" />
              秘径寻踪 · 创作台
            </p>
            <h1 class="font-display text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.03em] text-[#f5eee0] sm:text-[3.4rem]">
              回到这里，
              <br>
              继续未完的故事
            </h1>
            <p class="max-w-md text-sm leading-8 text-[#a49b8c] sm:text-base">
              场馆、谜题、路线与那些等待被讲述的细节，都在这条工作线上等你。登录后，一切从上次停笔的地方继续。
            </p>
          </div>
        </div>

        <div class="relative mt-8 space-y-3">
          <div
            v-for="item in highlights"
            :key="item.index"
            class="flex items-center gap-4 rounded-[1.2rem] border border-white/[0.07] bg-white/[0.03] px-5 py-4">
            <span class="font-display text-base font-semibold text-[#d6b07d]">{{ item.index }}</span>
            <p class="text-sm leading-6 text-[#d8cfc0]">{{ item.text }}</p>
          </div>
        </div>
      </section>

      <section class="flex items-center">
        <form
          data-login-reveal
          class="w-full rounded-[2rem] border border-white/[0.07] bg-white/[0.03] p-7 shadow-[0_30px_80px_rgba(0,0,0,0.4)] backdrop-blur-sm sm:p-9"
          @submit.prevent="handleLogin">
          <div class="space-y-3">
            <p class="text-xs uppercase tracking-[0.3em] text-[#c9a25f]">Sign in</p>
            <h2 class="font-display text-[2rem] font-semibold tracking-[-0.03em] text-[#f4ecdd]">管理员登录</h2>
            <p class="text-sm leading-7 text-[#948c7d]">
              使用后台账号进入创作台。登录态会安全地保存在 cookie 中，方便后续统一校验。
            </p>
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
      </section>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  background:
    radial-gradient(circle at 14% -4%, rgba(214, 176, 125, 0.1), transparent 32%),
    radial-gradient(circle at 86% 8%, rgba(214, 176, 125, 0.06), transparent 30%),
    #0b0c0f;
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
