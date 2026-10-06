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
  // 典藏导入：全部后台账号可用，不做角色分档（设计文档 §4）
  {
    label: '典藏导入',
    to: `${ADMIN_ROUTE_PREFIX}/collection-import`,
    icon: 'file-spreadsheet'
  },
  { label: '地图管理', to: `${ADMIN_ROUTE_PREFIX}/maps`, icon: 'map' },
  { label: '导游管理', to: `${ADMIN_ROUTE_PREFIX}/guides`, icon: 'user-round' },
  { label: '主题路线', to: `${ADMIN_ROUTE_PREFIX}/routes`, icon: 'route' },
  { label: '发音词典', to: `${ADMIN_ROUTE_PREFIX}/pronunciation`, icon: 'megaphone' },
  { label: '用户管理', to: `${ADMIN_ROUTE_PREFIX}/users`, icon: 'user-round' },
];

// 「景区区域」（/console/site-areas）暂不开放入口：区域数据没有接入文化资产归属，C 端也没有消费方。
// 页面与 /api/site-area 代理保留，后续恢复时需要先补齐区域归属和地图图层。

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
