<script setup lang="ts">
import { computed, reactive, shallowRef } from 'vue';
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
  <div class="login-page min-h-screen">
    <div class="mx-auto grid min-h-screen w-full max-w-[1320px] gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:px-10 lg:py-10">
      <section class="flex flex-col justify-between rounded-[2rem] border border-[#1f1c16]/10 bg-[#201d18] px-6 py-7 text-[#f6efe3] shadow-[0_30px_80px_rgba(32,29,24,0.18)] sm:px-8 sm:py-8">
        <div class="space-y-5">
          <NuxtLink to="/" class="inline-flex items-center gap-3 text-sm text-[#f0e2ca]">
            <span class="flex h-10 w-10 items-center justify-center rounded-full bg-white/8 font-semibold tracking-[0.18em]">PS</span>
            返回 landing
          </NuxtLink>

          <div class="space-y-3">
            <p class="text-xs uppercase tracking-[0.3em] text-[#d8b581]">Admin Console</p>
            <h1 class="font-serif text-[2.7rem] font-semibold leading-[0.95] tracking-[-0.05em] sm:text-[4rem]">
              进入内容控制台，
              <br>
              开始编排路线与运营节奏
            </h1>
            <p class="max-w-xl text-sm leading-7 text-[#d4c7b7] sm:text-base">
              后台负责把场馆内容、谜题、路线、活动和复盘数据串成同一条工作链。登录后即可继续维护控制台内容。
            </p>
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-[#d8b581]">01</p>
            <p class="mt-2 text-sm leading-6 text-[#f6efe3]">主题路线可视化编排</p>
          </div>
          <div class="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-[#d8b581]">02</p>
            <p class="mt-2 text-sm leading-6 text-[#f6efe3]">AI 题目与剧情辅助生成</p>
          </div>
          <div class="rounded-[1.4rem] border border-white/10 bg-white/6 p-4">
            <p class="text-xs uppercase tracking-[0.24em] text-[#d8b581]">03</p>
            <p class="mt-2 text-sm leading-6 text-[#f6efe3]">运营效果持续复盘</p>
          </div>
        </div>
      </section>

      <section class="flex items-center">
        <form
          class="w-full rounded-[2rem] border border-[#1f1c16]/10 bg-white/76 p-6 shadow-[0_24px_64px_rgba(74,58,34,0.12)] backdrop-blur-sm sm:p-8"
          @submit.prevent="handleLogin">
          <div class="space-y-3">
            <p class="text-xs uppercase tracking-[0.3em] text-[#8c6b43]">Sign in</p>
            <h2 class="font-serif text-[2.15rem] font-semibold tracking-[-0.04em] text-[#201d18]">管理员登录</h2>
            <p class="text-sm leading-6 text-[#5d5449]">
              使用后台账号进入控制台。登录态会保存在 cookie 中，方便后续路由与接口统一校验。
            </p>
          </div>

          <div class="mt-8 space-y-5">
            <label class="block space-y-2">
              <span class="text-sm font-medium text-[#201d18]">账号</span>
              <UiInput v-model="form.account" placeholder="请输入管理员账号" class="login-input" />
            </label>

            <label class="block space-y-2">
              <span class="text-sm font-medium text-[#201d18]">密码</span>
              <UiInput v-model="form.password" type="password" placeholder="请输入登录密码" class="login-input" />
            </label>

            <p v-if="errorMessage" class="rounded-xl border border-[#d95555]/20 bg-[#d95555]/8 px-4 py-3 text-sm text-[#a23939]">
              {{ errorMessage }}
            </p>

            <UiButton type="submit" size="lg" class="login-submit w-full" :disabled="submitting">
              {{ submitting ? '登录中...' : '进入控制台' }}
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
    radial-gradient(circle at top left, rgba(214, 176, 125, 0.18), transparent 28%),
    radial-gradient(circle at 86% 12%, rgba(32, 29, 24, 0.08), transparent 24%),
    linear-gradient(180deg, #f9f4ed 0%, #f2ebe0 54%, #ece1d3 100%);
}

:deep(.login-input) {
  background: rgba(255, 255, 255, 0.82);
  border-color: rgba(32, 29, 24, 0.12);
  color: #201d18;
}

:deep(.login-input::placeholder) {
  color: #8d8477;
}

:deep(.login-submit) {
  background: #201d18;
  color: #f6efe3;
}

:deep(.login-submit:hover) {
  background: #15120f;
}
</style>
