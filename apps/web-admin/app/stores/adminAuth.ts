import { computed, shallowRef } from 'vue';
import type { AdminLoginResponse, AdminProfile } from '@/types/auth';

const normalizeAuthorization = (value: string | null | undefined) => {
  const token = String(value ?? '').trim();

  if (!token) {
    return '';
  }

  return /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
};

const pickToken = (payload: AdminLoginResponse | null | undefined) => {
  if (!payload) {
    return '';
  }

  return normalizeAuthorization(
    payload.accessToken,
  );
};

const pickProfile = (payload: AdminLoginResponse | null | undefined): AdminProfile | null => {
  if (!payload) {
    return null;
  }

  const name = String(payload.realName || payload.username || payload.adminId || '').trim();
  const account = String(payload.username || payload.adminId || '').trim();
  const role = String(payload.roleName || payload.roleCode || '管理员').trim();

  if (!name && !account) {
    return null;
  }

  return {
    name: name || account || '管理员',
    account: account || name || 'admin',
    role: role || '管理员',
  };
};

export const useAdminAuthStore = defineStore(
  'admin-auth',
  () => {
    const token = shallowRef('');
    const profile = shallowRef<AdminProfile | null>(null);
    const sessionExpiredDialogOpen = shallowRef(false);
    const sessionExpiredMessage = shallowRef('未登录或登录已过期，请重新登录');

    const isAuthenticated = computed(() => Boolean(token.value));
    const displayName = computed(() => profile.value?.name || profile.value?.account || '管理员');

    const applyLogin = (payload: AdminLoginResponse) => {
      token.value = pickToken(payload);
      profile.value = pickProfile(payload);
      sessionExpiredDialogOpen.value = false;
    };

    const logout = () => {
      token.value = '';
      profile.value = null;
      sessionExpiredDialogOpen.value = false;
      sessionExpiredMessage.value = '未登录或登录已过期，请重新登录';
    };

    const openSessionExpiredDialog = (message?: string | null) => {
      sessionExpiredMessage.value = String(message || '未登录或登录已过期，请重新登录').trim();
      sessionExpiredDialogOpen.value = true;
    };

    const closeSessionExpiredDialog = () => {
      sessionExpiredDialogOpen.value = false;
    };

    return {
      token,
      profile,
      isAuthenticated,
      displayName,
      sessionExpiredDialogOpen,
      sessionExpiredMessage,
      applyLogin,
      logout,
      openSessionExpiredDialog,
      closeSessionExpiredDialog,
    };
  },
  {
    persist: {
      storage: piniaPluginPersistedstate.cookies(),
      pick: ['token', 'profile'],
    },
  },
);
