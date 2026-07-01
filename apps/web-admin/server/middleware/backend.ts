import type { H3Event } from 'h3';
import { ADMIN_AUTH_COOKIE_KEY } from '~~/app/constants/admin-auth';

const ADMIN_AUTH_STORE_COOKIE_KEY = 'admin-auth';

const normalizeAuthorization = (value: string | null | undefined) => {
  const token = String(value ?? '').trim();

  if (!token) {
    return '';
  }

  return /^bearer\s/i.test(token) ? token : `Bearer ${token}`;
};

const parsePersistedToken = (value: string | null | undefined) => {
  const raw = String(value ?? '').trim();

  if (!raw) {
    return '';
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as { token?: unknown };
    return typeof parsed.token === 'string' ? parsed.token : '';
  } catch {
    return '';
  }
};

const resolveCookieAuthorization = (event: H3Event) => {
  const directToken = getCookie(event, ADMIN_AUTH_COOKIE_KEY);
  const persistedToken = parsePersistedToken(getCookie(event, ADMIN_AUTH_STORE_COOKIE_KEY));

  return normalizeAuthorization(directToken || persistedToken);
};

export default defineEventHandler((event) => {
  const method = getMethod(event).toUpperCase();
  const headerAuthorization = normalizeAuthorization(getHeader(event, 'authorization'));
  const cookieAuthorization = resolveCookieAuthorization(event);
  const authorization = method === 'GET'
    ? headerAuthorization
    : cookieAuthorization || headerAuthorization;

  event.context.backendHeaders = {
    ...(authorization ? { authorization } : {}),
  };
});
