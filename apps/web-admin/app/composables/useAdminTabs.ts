import { computed } from 'vue';
import { adminNavItems, type AdminNavItem } from '@/composables/useAdminNavigation';

export interface AdminTabItem extends AdminNavItem {
  closable: boolean;
}

export function useAdminTabs() {
  const route = useRoute();
  const router = useRouter();
  const tabs = useState<AdminTabItem[]>('admin-tabs', () => [
    {
      ...adminNavItems[0]!,
      closable: false,
    },
  ]);

  const ensureTab = (path: string) => {
    const matched = adminNavItems.find((item) => item.to === path);
    if (!matched) {
      return;
    }

    const exists = tabs.value.some((item) => item.to === matched.to);
    if (!exists) {
      tabs.value = [
        ...tabs.value,
        {
          ...matched,
          closable: matched.to !== '/',
        },
      ];
    }
  };

  watch(
    () => route.path,
    (path) => {
      ensureTab(path);
    },
    { immediate: true },
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

    const fallback = nextTabs[nextTabs.length - 1] ?? adminNavItems[0];
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
