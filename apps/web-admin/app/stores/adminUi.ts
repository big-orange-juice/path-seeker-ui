import { computed, shallowRef, watch } from 'vue';

/** UI 缩放两档：正常 / 放大 */
export type AdminUiScale = 'normal' | 'large';

export const ADMIN_UI_SCALE_LEVELS = ['normal', 'large'] as const satisfies readonly AdminUiScale[];

export const ADMIN_UI_SCALE_LABELS: Record<AdminUiScale, string> = {
  normal: '正常',
  large: '放大',
};

const SCALE_CLASS_PREFIX = 'admin-ui-scale-';
const LEGACY_CLASSES = ['admin-care-mode', `${SCALE_CLASS_PREFIX}small`] as const;

const isAdminUiScale = (value: unknown): value is AdminUiScale =>
  value === 'normal' || value === 'large';

/** 将缩放 class 挂到 html，覆盖 Teleport 到 body 的弹层 */
const applyUiScaleClass = (scale: AdminUiScale) => {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  for (const className of LEGACY_CLASSES) {
    root.classList.remove(className);
  }
  for (const level of ADMIN_UI_SCALE_LEVELS) {
    root.classList.toggle(`${SCALE_CLASS_PREFIX}${level}`, level === scale);
  }
  root.dataset.adminUiScale = scale;
};

/**
 * 后台全局 UI 偏好（与账号无关的展示设置）。
 * UI 缩放：正常 / 放大两档，顶栏 range 拖拽切换。
 */
export const useAdminUiStore = defineStore(
  'admin-ui',
  () => {
    const uiScale = shallowRef<AdminUiScale>('normal');

    /** 0=正常 1=放大，供 range input */
    const uiScaleIndex = computed(() => (uiScale.value === 'large' ? 1 : 0));

    const uiScaleLabel = computed(() => ADMIN_UI_SCALE_LABELS[uiScale.value]);

    const setUiScale = (scale: AdminUiScale) => {
      if (!isAdminUiScale(scale)) {
        return;
      }
      uiScale.value = scale;
    };

    /** range 拖拽：0=正常，1=放大 */
    const setUiScaleIndex = (value: number | string) => {
      const next = Math.round(Number(value));
      if (!Number.isFinite(next) || next <= 0) {
        uiScale.value = 'normal';
        return;
      }
      uiScale.value = 'large';
    };

    if (import.meta.client) {
      watch(
        uiScale,
        (scale) => {
          applyUiScaleClass(scale);
        },
        { immediate: true }
      );
    }

    return {
      uiScale,
      uiScaleIndex,
      uiScaleLabel,
      setUiScaleIndex,
      setUiScale,
    };
  },
  {
    persist: {
      storage: piniaPluginPersistedstate.cookies(),
      pick: ['uiScale'],
      // 旧 cookie 可能只有 uiScaleIndex / careMode
      afterHydrate: (ctx) => {
        const store = ctx.store as {
          setUiScale: (scale: AdminUiScale) => void;
        };
        const state = ctx.store.$state as {
          uiScale?: unknown;
          uiScaleIndex?: unknown;
          careMode?: unknown;
        };

        if (isAdminUiScale(state.uiScale)) {
          store.setUiScale(state.uiScale);
          return;
        }

        // 旧三档：0=小 1=正常 2=大 → 小/正常归正常，大归放大
        if (typeof state.uiScaleIndex === 'number' && Number.isFinite(state.uiScaleIndex)) {
          store.setUiScale(state.uiScaleIndex >= 2 ? 'large' : 'normal');
          return;
        }

        if (state.careMode === true) {
          store.setUiScale('large');
          return;
        }

        store.setUiScale('normal');
      },
    },
  }
);
