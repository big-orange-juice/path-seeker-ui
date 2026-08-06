import { ADMIN_ROUTE_PREFIX } from '@/constants/admin-auth';
import { useAdminAuthStore } from '@/stores/adminAuth';

/**
 * 仅管理员可访问（如展厅地图）。
 * 导游账号直链访问时回退到其可用首页。
 */
export default defineNuxtRouteMiddleware(() => {
  const authStore = useAdminAuthStore();

  if (authStore.isGuide) {
    return navigateTo(`${ADMIN_ROUTE_PREFIX}/guides`, { replace: true });
  }
});
