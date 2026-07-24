export const ADMIN_AUTH_COOKIE_KEY = 'ps_admin_token';
export const ADMIN_AUTH_REDIRECT_QUERY = 'redirect';
export const ADMIN_ROUTE_PREFIX = '/console';
export const ADMIN_LOGIN_PATH = `${ADMIN_ROUTE_PREFIX}/login`;
/** 控制台默认首页：运营分析 */
export const ADMIN_CONSOLE_HOME_PATH = `${ADMIN_ROUTE_PREFIX}/operations`;

export const ADMIN_PUBLIC_PATHS = new Set([ADMIN_LOGIN_PATH]);
