import { ADMIN_AUTH_REDIRECT_QUERY, ADMIN_CONSOLE_HOME_PATH, ADMIN_LOGIN_PATH, ADMIN_PUBLIC_PATHS } from '@/constants/admin-auth';
import { useAdminAuthStore } from '@/stores/adminAuth';

export default defineNuxtRouteMiddleware((to) => {
  const store = useAdminAuthStore();

  if (store.isAuthenticated && to.path === ADMIN_LOGIN_PATH) {
    const redirect = typeof to.query[ADMIN_AUTH_REDIRECT_QUERY] === 'string'
      ? to.query[ADMIN_AUTH_REDIRECT_QUERY]
      : ADMIN_CONSOLE_HOME_PATH;

    return navigateTo(redirect);
  }

  if (ADMIN_PUBLIC_PATHS.has(to.path)) {
    return;
  }

  if (store.isAuthenticated) {
    return;
  }

  return navigateTo({
    path: ADMIN_LOGIN_PATH,
    query: {
      [ADMIN_AUTH_REDIRECT_QUERY]: to.fullPath,
    },
  });
});
