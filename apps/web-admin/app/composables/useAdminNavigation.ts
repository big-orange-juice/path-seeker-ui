import type { AppIconName } from '@/components/ui/AppIcon.vue';

export interface AdminNavItem {
  label: string;
  to: string;
  icon: AppIconName;
}

export const adminNavItems: AdminNavItem[] = [
  { label: '产品概览', to: '/', icon: 'bar-chart-3' },
  { label: '馆藏内容', to: '/collections', icon: 'library' },
  { label: '地图管理', to: '/maps', icon: 'map' },
  { label: '谜题工坊', to: '/puzzles', icon: 'puzzle' },
  { label: '主题路线', to: '/routes', icon: 'route' },
  { label: '运营发布', to: '/operations', icon: 'bar-chart-3' },
];