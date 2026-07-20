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
  {
    label: '运营发布',
    to: `${ADMIN_ROUTE_PREFIX}/operations`,
    icon: 'bar-chart-3'
  },
  { label: '主体维护', to: ADMIN_CONSOLE_HOME_PATH, icon: 'library-big' },
  {
    label: '馆藏内容',
    to: `${ADMIN_ROUTE_PREFIX}/collections`,
    icon: 'library'
  },
  { label: '主题路线', to: `${ADMIN_ROUTE_PREFIX}/routes`, icon: 'route' },
  { label: '导游管理', to: `${ADMIN_ROUTE_PREFIX}/guides`, icon: 'user-round' }
];

/** 导游账号可见菜单（只保留业务必要入口） */
const guideNavItems: AdminNavItem[] = [
  { label: '主题路线', to: `${ADMIN_ROUTE_PREFIX}/routes`, icon: 'route' },
  { label: '导游管理', to: `${ADMIN_ROUTE_PREFIX}/guides`, icon: 'user-round' }
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
