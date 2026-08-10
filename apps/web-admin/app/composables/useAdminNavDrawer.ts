import { shallowRef } from 'vue';

/** 窄屏导航抽屉开关（顶栏按钮打开，点遮罩 / 路由变化 / Esc 关闭） */
const open = shallowRef(false);

export const useAdminNavDrawer = () => {
  const openNav = () => {
    open.value = true;
  };

  const closeNav = () => {
    open.value = false;
  };

  const toggleNav = () => {
    open.value = !open.value;
  };

  return {
    open,
    openNav,
    closeNav,
    toggleNav,
  };
};
