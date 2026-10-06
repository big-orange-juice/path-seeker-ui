import { computed } from 'vue';
import { useAdminNavigation } from '@/composables/useAdminNavigation';
import {
  createEmptyAssistantContext,
  type PlatformAssistantContext,
} from '@/composables/usePlatformAssistant';

/**
 * 从当前路由推导平台助手要提交的页面上下文（显式字段）。
 *
 * 设计依据 doc/b-admin-functional-optimization-plan.md §8：
 * 页面上下文以显式字段提交（当前路由、选中的 museumId / collectionId / routeId / stageId / guideId），
 * 后端用 IRouteDataPermissionService / IGuideDataPermissionService 重新核验后再裁剪，
 * **前端传入的上下文一律不视为已授权** —— 这里推导出的值只是"候选值"。
 *
 * 当前仓储里各业务页面的选中项都保存在组件内部（见 pages/console/*.vue），没有全局选中 store；
 * 已确认这些页面会把选中对象写进 URL 查询串（例如 maps.vue 的 museumId、guides.vue 跳转
 * pronunciation.vue 的 guideId、museums.vue 的 museumId），因此这里读取查询参数中显式出现的 ID：
 *   ?museumId=xx&collectionId=xx&routeId=xx&stageId=xx&guideId=xx
 * 页面自身若希望助手携带更多选中对象，只需把选中项写入查询串（或后续补一个全局选中 store）。
 */
export const usePlatformAssistantPageContext = () => {
  const route = useRoute();
  const { navItems } = useAdminNavigation();

  const readQuery = (key: string): string => {
    const value = route.query[key];

    if (Array.isArray(value)) {
      return String(value[0] ?? '').trim();
    }

    return String(value ?? '').trim();
  };

  const pageLabel = computed(() => {
    const exact = navItems.value.find((item) => item.to === route.path);

    if (exact) {
      return exact.label;
    }

    // 子路径（如 /console/maps?…）回落到最长的前缀匹配
    const prefixMatches = navItems.value
      .filter((item) => item.to && route.path.startsWith(`${item.to}/`))
      .sort((left, right) => right.to.length - left.to.length);
    const first = prefixMatches[0];

    return first?.label ?? '';
  });

  const context = computed<PlatformAssistantContext>(() => ({
    ...createEmptyAssistantContext(),
    pagePath: route.fullPath,
    pageLabel: pageLabel.value,
    museumId: readQuery('museumId'),
    collectionId: readQuery('collectionId') || readQuery('exhibitId'),
    routeId: readQuery('routeId'),
    stageId: readQuery('stageId'),
    guideId: readQuery('guideId'),
  }));

  return { context, pageLabel };
};
