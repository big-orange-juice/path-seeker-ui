import { computed, type ComputedRef, type InjectionKey, type Ref } from 'vue';
import { v4 as uuidv4 } from 'uuid';

export interface DialogContextValue {
  open: Ref<boolean>;
  setOpen: (value: boolean) => void;
  titleId: ComputedRef<string>;
  descriptionId: ComputedRef<string>;
}

export const dialogContextKey: InjectionKey<DialogContextValue> = Symbol('dialog-context');

export const createDialogIds = () => {
  const baseId = `dialog-${uuidv4()}`;

  return {
    titleId: computed(() => `${baseId}-title`),
    descriptionId: computed(() => `${baseId}-description`),
  };
};
