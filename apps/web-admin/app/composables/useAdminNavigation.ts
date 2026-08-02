import { computed } from 'vue';
import type { AppIconName } from '@/components/ui/AppIcon.vue';
import {
  ADMIN_CONSOLE_HOME_PATH,
  ADMIN_ROUTE_PREFIX
} from '@/constants/admin-auth';
import { useAdminAuthStore } from '@/stores/adminAuth';

export interface AdminNavItem {
  label: string;
  to: string;
  icon: AppIconName;
}

/** 全量菜单（管理员） */
export const adminNavItems: AdminNavItem[] = [
  { label: '运营分析', to: ADMIN_CONSOLE_HOME_PATH, icon: 'bar-chart-3' },
  { label: '博物馆', to: `${ADMIN_ROUTE_PREFIX}/museums`, icon: 'library-big' },
  {
    label: '馆藏内容',
    to: `${ADMIN_ROUTE_PREFIX}/collections`,
    icon: 'library'
  },
  { label: '导游管理', to: `${ADMIN_ROUTE_PREFIX}/guides`, icon: 'user-round' },
  { label: '主题路线', to: `${ADMIN_ROUTE_PREFIX}/routes`, icon: 'route' },
  { label: '用户管理', to: `${ADMIN_ROUTE_PREFIX}/users`, icon: 'user-round' },
];

/** 导游账号可见菜单（只保留业务必要入口） */
const guideNavItems: AdminNavItem[] = [
  { label: '导游管理', to: `${ADMIN_ROUTE_PREFIX}/guides`, icon: 'user-round' },
  { label: '主题路线', to: `${ADMIN_ROUTE_PREFIX}/routes`, icon: 'route' },
];

export const useAdminNavigation = () => {
  const authStore = useAdminAuthStore();

  const navItems = computed<AdminNavItem[]>(() => {
    if (authStore.isGuide) {
      return guideNavItems;
    }
    return adminNavItems;
  });

  return {
    navItems
  };
};
