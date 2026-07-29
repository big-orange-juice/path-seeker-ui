import { ADMIN_CONSOLE_HOME_PATH } from '@/constants/admin-auth';

export default defineNuxtRouteMiddleware(() => {
  return navigateTo(ADMIN_CONSOLE_HOME_PATH, { replace: true });
});
