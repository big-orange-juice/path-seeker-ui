import { computed, shallowRef } from 'vue';

interface ChromeMetrics {
  statusBarHeight: number;
  navHeight: number;
  navPaddingTop: number;
}

type MiniProgramWindow = typeof globalThis & {
  wx?: {
    getMenuButtonBoundingClientRect?: () => {
      height?: number;
    };
  };
};

function getCapsuleHeight() {
  const wxApi = (globalThis as MiniProgramWindow).wx;

  if (!wxApi?.getMenuButtonBoundingClientRect) {
    return 32;
  }

  try {
    return wxApi.getMenuButtonBoundingClientRect().height || 32;
  } catch {
    return 32;
  }
}

function createMetrics(): ChromeMetrics {
  const info = uni.getSystemInfoSync();
  const statusBarHeight = info.statusBarHeight || 24;
  const capsuleHeight = getCapsuleHeight();
  const navPaddingTop = statusBarHeight + 2;
  const navHeight = navPaddingTop + capsuleHeight + 6;

  return {
    statusBarHeight,
    navPaddingTop,
    navHeight
  };
}

const sharedMetrics = shallowRef<ChromeMetrics>(createMetrics());

export function useChromeMetrics() {
  const navStyle = computed(() => ({
    paddingTop: `${sharedMetrics.value.navPaddingTop}px`,
    height: `${sharedMetrics.value.navHeight}px`
  }));

  const pageInsetStyle = computed(() => ({
    paddingTop: 0,
    paddingBottom: 0
  }));

  return {
    metrics: sharedMetrics,
    navStyle,
    pageInsetStyle
  };
}
