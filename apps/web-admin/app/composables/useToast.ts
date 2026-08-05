import { shallowRef } from 'vue';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
}

const DEFAULT_DURATION_MS = 2400;
const MAX_VISIBLE = 3;

const toasts = shallowRef<ToastItem[]>([]);
const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

const remove = (id: string) => {
  const timer = dismissTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    dismissTimers.delete(id);
  }

  toasts.value = toasts.value.filter((item) => item.id !== id);
};

const push = (message: string, tone: ToastTone = 'info', durationMs = DEFAULT_DURATION_MS) => {
  const text = String(message || '').trim();
  if (!text) {
    return '';
  }

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  toasts.value = [...toasts.value, { id, tone, message: text }].slice(-MAX_VISIBLE);

  if (durationMs > 0) {
    dismissTimers.set(
      id,
      setTimeout(() => {
        remove(id);
      }, durationMs),
    );
  }

  return id;
};

const success = (message: string, durationMs = DEFAULT_DURATION_MS) => push(message, 'success', durationMs);
const error = (message: string, durationMs = DEFAULT_DURATION_MS) => push(message, 'error', durationMs);
const info = (message: string, durationMs = DEFAULT_DURATION_MS) => push(message, 'info', durationMs);

/**
 * 轻量 toast，适合拖拽等不打断操作的反馈。
 */
export const useToast = () => ({
  toasts,
  push,
  success,
  error,
  info,
  remove,
});
