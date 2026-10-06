import { useState } from '#imports';

/**
 * 平台助手抽屉开关。
 *
 * 顶栏按钮打开，抽屉内关闭；与窄屏导航抽屉（useAdminNavDrawer）同一套写法，
 * 用 useState 让顶栏与 layouts/default.vue 的挂载点共享状态。
 */
export const useAdminAssistantDrawer = () => {
  const open = useState<boolean>('admin-platform-assistant-open', () => false);

  const openAssistant = () => {
    open.value = true;
  };

  const closeAssistant = () => {
    open.value = false;
  };

  const toggleAssistant = () => {
    open.value = !open.value;
  };

  return {
    open,
    openAssistant,
    closeAssistant,
    toggleAssistant,
  };
};
