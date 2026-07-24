import { computed, watch } from 'vue';
import { ADMIN_CONSOLE_HOME_PATH, ADMIN_ROUTE_PREFIX } from '@/constants/admin-auth';
import { useAdminNavigation, type AdminNavItem } from '@/composables/useAdminNavigation';
import { useAdminAuthStore } from '@/stores/adminAuth';

export interface AdminTabItem extends AdminNavItem {
  closable: boolean;
}

export function useAdminTabs() {
  const route = useRoute();
  const router = useRouter();
  const authStore = useAdminAuthStore();
  const { navItems } = useAdminNavigation();

  const defaultHome = computed(
    () => navItems.value[0] ?? { label: '主题路线', to: `${ADMIN_ROUTE_PREFIX}/routes`, icon: 'route' as const },
  );

  const tabs = useState<AdminTabItem[]>('admin-tabs', () => [
    {
      label: '运营分析',
      to: ADMIN_CONSOLE_HOME_PATH,
      icon: 'bar-chart-3',
      closable: false,
    },
  ]);

  const syncTabLabels = () => {
    const items = navItems.value;
    tabs.value = tabs.value
      .map((tab) => {
        const matched = items.find((item) => item.to === tab.to);
        if (!matched) {
          return tab;
        }

        return {
          ...tab,
          label: matched.label,
          icon: matched.icon,
          closable: matched.to !== items[0]?.to && matched.to !== ADMIN_CONSOLE_HOME_PATH,
        };
      })
      .filter((tab) => items.some((item) => item.to === tab.to));

    if (!tabs.value.length && defaultHome.value) {
      tabs.value = [{ ...defaultHome.value, closable: false }];
    }
  };

  const ensureTab = (path: string) => {
    const items = navItems.value;
    const matched = items.find((item) => item.to === path);
    if (!matched) {
      // 导游访问无权限页时，回到其首页
      if (authStore.isGuide && path.startsWith(ADMIN_ROUTE_PREFIX) && path !== defaultHome.value.to) {
        void router.replace(defaultHome.value.to);
      }
      return;
    }

    const exists = tabs.value.some((item) => item.to === matched.to);
    if (!exists) {
      tabs.value = [
        ...tabs.value,
        {
          ...matched,
          closable: matched.to !== items[0]?.to,
        },
      ];
      return;
    }

    syncTabLabels();
  };

  watch(
    () => route.path,
    (path) => {
      ensureTab(path);
    },
    { immediate: true },
  );

  watch(
    navItems,
    () => {
      syncTabLabels();
      ensureTab(route.path);
    },
  );

  const activeTab = computed(() => route.path);

  const closeTab = async (path: string) => {
    const nextTabs = tabs.value.filter((item) => item.to !== path);
    if (nextTabs.length === tabs.value.length) {
      return;
    }

    tabs.value = nextTabs;

    if (route.path !== path) {
      return;
    }

    const fallback = nextTabs[nextTabs.length - 1] ?? defaultHome.value;
    if (fallback) {
      await router.push(fallback.to);
    }
  };

  return {
    tabs,
    activeTab,
    closeTab,
  };
}
