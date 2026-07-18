import type { AppIconName } from '@/components/ui/AppIcon.vue';
import { ADMIN_CONSOLE_HOME_PATH, ADMIN_ROUTE_PREFIX } from '@/constants/admin-auth';

export interface AdminNavItem {
  label: string;
  to: string;
  icon: AppIconName;
}

export const adminNavItems: AdminNavItem[] = [
  { label: '主体维护', to: ADMIN_CONSOLE_HOME_PATH, icon: 'library-big' },
  { label: '馆藏内容', to: `${ADMIN_ROUTE_PREFIX}/collections`, icon: 'library' },
  { label: '主题路线', to: `${ADMIN_ROUTE_PREFIX}/routes`, icon: 'route' },
  { label: '导游管理', to: `${ADMIN_ROUTE_PREFIX}/guides`, icon: 'user-round' },
  { label: '运营发布', to: `${ADMIN_ROUTE_PREFIX}/operations`, icon: 'bar-chart-3' },
];
