import { shallowRef } from 'vue';
import { resolveHttpErrorMessage } from '@path-seeker/ts-shared';

export type ActionFeedbackTone = 'success' | 'error' | 'info';

export interface ActionFeedbackPayload {
  tone?: ActionFeedbackTone;
  title?: string;
  description?: string;
}

interface ActionFeedbackState {
  open: boolean;
  tone: ActionFeedbackTone;
  title: string;
  description: string;
}

const DEFAULT_TITLE: Record<ActionFeedbackTone, string> = {
  success: '操作成功',
  error: '操作失败',
  info: '提示',
};

const state = shallowRef<ActionFeedbackState>({
  open: false,
  tone: 'info',
  title: '',
  description: '',
});

const show = (payload: ActionFeedbackPayload | string) => {
  if (typeof payload === 'string') {
    state.value = {
      open: true,
      tone: 'info',
      title: DEFAULT_TITLE.info,
      description: payload,
    };
    return;
  }

  const tone = payload.tone || 'info';
  state.value = {
    open: true,
    tone,
    title: String(payload.title || DEFAULT_TITLE[tone]).trim() || DEFAULT_TITLE[tone],
    description: String(payload.description || '').trim(),
  };
};

const success = (description: string, title = DEFAULT_TITLE.success) => {
  show({ tone: 'success', title, description });
};

const error = (description: string, title = DEFAULT_TITLE.error) => {
  show({ tone: 'error', title, description });
};

/** 从 catch 错误统一弹失败 dialog */
const errorFrom = (caught: unknown, fallback = '请求失败，请稍后重试', title = DEFAULT_TITLE.error) => {
  error(resolveHttpErrorMessage(caught, fallback), title);
};

const close = () => {
  state.value = {
    ...state.value,
    open: false,
  };
};

/**
 * 全局 action 结果反馈（dialog）。
 * 状态模块级单例，任意页面/弹窗内调用都能压在业务 dialog 之上。
 */
export const useActionFeedback = () => ({
  state,
  show,
  success,
  error,
  errorFrom,
  close,
});
