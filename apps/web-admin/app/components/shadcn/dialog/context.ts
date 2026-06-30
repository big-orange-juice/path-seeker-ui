import { computed, type ComputedRef, type InjectionKey, type Ref } from 'vue';

export interface DialogContextValue {
  open: Ref<boolean>;
  setOpen: (value: boolean) => void;
  titleId: ComputedRef<string>;
  descriptionId: ComputedRef<string>;
}

export const dialogContextKey: InjectionKey<DialogContextValue> = Symbol('dialog-context');

export const createDialogIds = () => {
  const baseId = `dialog-${crypto.randomUUID()}`;

  return {
    titleId: computed(() => `${baseId}-title`),
    descriptionId: computed(() => `${baseId}-description`),
  };
};
