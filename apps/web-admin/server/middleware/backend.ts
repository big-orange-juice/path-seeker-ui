import { ADMIN_AUTH_COOKIE_KEY } from '~~/app/constants/admin-auth';

export default defineEventHandler((event) => {
  const authorization = getHeader(event, 'authorization') || getCookie(event, ADMIN_AUTH_COOKIE_KEY) || '';
  const cookie = getHeader(event, 'cookie');

  event.context.backendHeaders = {
    ...(authorization ? { authorization } : {}),
    ...(cookie ? { cookie } : {}),
  };
});
