import { computed, shallowRef } from 'vue';

export const useAdminTipsStore = defineStore(
  'admin-tips',
  () => {
    const autoOpenEnabled = shallowRef(true);
    const autoOpenPreferenceSet = shallowRef(false);

    const shouldAutoOpen = computed(() => !autoOpenPreferenceSet.value || autoOpenEnabled.value);

    const enableAutoOpen = () => {
      autoOpenEnabled.value = true;
      autoOpenPreferenceSet.value = true;
    };

    const disableAutoOpen = () => {
      autoOpenEnabled.value = false;
      autoOpenPreferenceSet.value = true;
    };

    return {
      autoOpenEnabled,
      shouldAutoOpen,
      enableAutoOpen,
      disableAutoOpen,
      autoOpenPreferenceSet,
    };
  },
  {
    persist: {
      storage: piniaPluginPersistedstate.cookies(),
      pick: ['autoOpenEnabled', 'autoOpenPreferenceSet'],
    },
  },
);
