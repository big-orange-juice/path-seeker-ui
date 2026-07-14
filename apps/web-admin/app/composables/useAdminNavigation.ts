import type { AppIconName } from '@/components/ui/AppIcon.vue';
import { ADMIN_CONSOLE_HOME_PATH } from '@/constants/admin-auth';

export interface AdminNavItem {
  label: string;
  to: string;
  icon: AppIconName;
}

export const adminNavItems: AdminNavItem[] = [
  { label: '产品概览', to: ADMIN_CONSOLE_HOME_PATH, icon: 'bar-chart-3' },
  { label: '主体维护', to: `${ADMIN_CONSOLE_HOME_PATH}/museums`, icon: 'library-big' },
  { label: '馆藏内容', to: `${ADMIN_CONSOLE_HOME_PATH}/collections`, icon: 'library' },
  { label: '主题路线', to: `${ADMIN_CONSOLE_HOME_PATH}/routes`, icon: 'route' },
  { label: '运营发布', to: `${ADMIN_CONSOLE_HOME_PATH}/operations`, icon: 'bar-chart-3' },
];
