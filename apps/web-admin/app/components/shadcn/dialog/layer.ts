import { computed, shallowRef, type ComputedRef, type Ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

/**
 * Dialog 全局层级栈。
 *
 * 多个 Dialog 同时 Teleport 到 body 且共用固定 z-index 时，
 * 底层 form 一旦重渲染会把遮罩重新挂到 DOM 末尾，盖住后开弹窗。
 * 这里按「打开顺序」递增 z-index，保证后开的永远在上。
 */
export const DIALOG_BASE_Z_INDEX = 1000;
export const DIALOG_Z_INDEX_STEP = 10;
/**
 * 大图预览层：须压过 Dialog 栈（基线 1000 + 步进），
 * 且低于系统反馈/登录过期（10500 / 11000）。
 */
export const IMAGE_LIGHTBOX_Z_INDEX = 9000;

interface DialogLayerEntry {
  id: string;
  zIndex: number;
}

/** 模块级栈：跨组件实例共享，不依赖 provide 树嵌套关系 */
const layerStack = shallowRef<DialogLayerEntry[]>([]);

const syncBodyScrollLock = () => {
  if (typeof document === 'undefined') {
    return;
  }
  document.body.style.overflow = layerStack.value.length > 0 ? 'hidden' : '';
};

export interface DialogLayerHandle {
  id: string;
  /** 当前层 z-index，未入栈时为基准值 */
  zIndex: Ref<number>;
  /** 是否为最顶层（仅顶层响应 Esc） */
  isTopmost: ComputedRef<boolean>;
  /** 打开时入栈，返回分配的 z-index */
  acquire: () => number;
  /** 关闭/卸载时出栈 */
  release: () => void;
}

/**
 * 为单个 Dialog 实例分配一层级句柄。
 * 每个 DialogContent 应持有独立 handle，open 时 acquire、close 时 release。
 */
export const createDialogLayerHandle = (): DialogLayerHandle => {
  const id = `dialog-layer-${uuidv4()}`;
  const zIndex = shallowRef(DIALOG_BASE_Z_INDEX);

  const isTopmost = computed(() => {
    const stack = layerStack.value;
    return stack.length > 0 && stack[stack.length - 1]?.id === id;
  });

  const acquire = () => {
    const existing = layerStack.value.find((entry) => entry.id === id);
    if (existing) {
      zIndex.value = existing.zIndex;
      return existing.zIndex;
    }

    const nextZ = DIALOG_BASE_Z_INDEX + layerStack.value.length * DIALOG_Z_INDEX_STEP;
    layerStack.value = [...layerStack.value, { id, zIndex: nextZ }];
    zIndex.value = nextZ;
    syncBodyScrollLock();
    return nextZ;
  };

  const release = () => {
    if (!layerStack.value.some((entry) => entry.id === id)) {
      return;
    }
    layerStack.value = layerStack.value.filter((entry) => entry.id !== id);
    // 保留本层 zIndex，供关闭动画期间仍压在下层之上，避免 leave 时闪到底层下面
    syncBodyScrollLock();
  };

  return {
    id,
    zIndex,
    isTopmost,
    acquire,
    release,
  };
};

/** 测试 / 调试用：当前栈深度 */
export const getDialogLayerDepth = () => layerStack.value.length;
