import { computed, shallowRef } from 'vue';

export function useRouteLibrary() {
  return {
    activeFilter: shallowRef<'all'>('all'),
    filteredRoutes: computed(() => [] as never[]),
    routes: shallowRef([] as never[]),
    searchQuery: shallowRef(''),
    stats: computed(() => [] as never[]),
  };
}
