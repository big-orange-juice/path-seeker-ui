import type { AppIconName } from '@/components/ui/AppIcon.vue';

export interface AdminNavItem {
  label: string;
  to: string;
  icon: AppIconName;
}

export const adminNavItems: AdminNavItem[] = [
  { label: '产品概览', to: '/console', icon: 'bar-chart-3' },
  { label: '主体维护', to: '/museums', icon: 'library-big' },
  { label: '馆藏内容', to: '/collections', icon: 'library' },
  { label: '谜题工坊', to: '/puzzles', icon: 'puzzle' },
  { label: '主题路线', to: '/routes', icon: 'route' },
  { label: '运营发布', to: '/operations', icon: 'bar-chart-3' },
];
