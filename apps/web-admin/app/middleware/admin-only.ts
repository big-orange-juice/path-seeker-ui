import { ADMIN_ROUTE_PREFIX } from '@/constants/admin-auth';
import { useAdminAuthStore } from '@/stores/adminAuth';

export default defineNuxtRouteMiddleware(() => {
  const authStore = useAdminAuthStore();

  if (authStore.isGuide) {
    return navigateTo(`${ADMIN_ROUTE_PREFIX}/routes`, { replace: true });
  }
});
