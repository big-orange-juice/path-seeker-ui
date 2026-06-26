export interface AdminNavItem {
  label: string;
  to: string;
  icon: string;
}

export const adminNavItems: AdminNavItem[] = [
  { label: '产品概览', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: '馆藏内容', to: '/collections', icon: 'i-lucide-library' },
  { label: '谜题工坊', to: '/puzzles', icon: 'i-lucide-puzzle' },
  { label: '主题路线', to: '/routes', icon: 'i-lucide-route' },
  { label: '运营发布', to: '/operations', icon: 'i-lucide-bar-chart-3' },
];
