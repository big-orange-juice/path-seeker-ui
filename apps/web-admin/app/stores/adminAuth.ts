import { computed, shallowRef } from 'vue';
import {
  isAdminRole,
  isGuideRole,
  normalizeRoleCode,
  roleDisplayName,
  ROUTE_ROLE_ADMIN,
} from '@/constants/routeWorkflow';
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
  const roleCode = normalizeRoleCode(payload.roleCode || payload.roleName || '');
  const role = roleDisplayName(roleCode || payload.roleCode, payload.roleName);

  if (!name && !account) {
    return null;
  }

  return {
    name: name || account || '管理员',
    account: account || name || 'admin',
    role: role || '管理员',
    roleCode: roleCode || ROUTE_ROLE_ADMIN,
    adminId: String(payload.adminId ?? '').trim(),
  };
};

/** 兼容旧 cookie 里缺少 roleCode / adminId 的 profile */
const normalizeProfile = (value: AdminProfile | null | undefined): AdminProfile | null => {
  if (!value) {
    return null;
  }

  const roleCode = normalizeRoleCode(value.roleCode || value.role || '');
  return {
    name: value.name || value.account || '管理员',
    account: value.account || value.name || 'admin',
    role: roleDisplayName(roleCode, value.role),
    roleCode: roleCode || ROUTE_ROLE_ADMIN,
    adminId: String(value.adminId || '').trim(),
  };
};

export const useAdminAuthStore = defineStore(
  'admin-auth',
  () => {
    const token = shallowRef('');
    const profile = shallowRef<AdminProfile | null>(null);
    const sessionExpiredDialogOpen = shallowRef(false);
    const sessionExpiredMessage = shallowRef('未登录或登录已过期，请重新登录');

    const resolvedProfile = computed(() => normalizeProfile(profile.value));
    const isAuthenticated = computed(() => Boolean(token.value));
    const displayName = computed(() => resolvedProfile.value?.name || resolvedProfile.value?.account || '管理员');
    const roleCode = computed(() => normalizeRoleCode(resolvedProfile.value?.roleCode));
    const adminId = computed(() => String(resolvedProfile.value?.adminId || '').trim());
    const isAdmin = computed(() => isAdminRole(roleCode.value));
    // 仅当明确为导游角色时收敛菜单；未知角色按管理员能力展示，避免旧会话被误伤
    const isGuide = computed(() => isGuideRole(roleCode.value));

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
      roleCode,
      adminId,
      isAdmin,
      isGuide,
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
