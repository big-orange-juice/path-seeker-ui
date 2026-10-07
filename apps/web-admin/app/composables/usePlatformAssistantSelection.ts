import { onBeforeUnmount, useId, watch } from 'vue';
import type { PlatformAssistantContext } from '@/composables/usePlatformAssistant';

export type AssistantSelection = Partial<Pick<PlatformAssistantContext, 'museumId' | 'collectionId' | 'routeId' | 'stageId' | 'guideId'>>;

export const useAssistantSelections = () => useState<Record<string, { path: string; selection: AssistantSelection }>>('platform-assistant:selections', () => ({}));

export const usePlatformAssistantSelection = (readSelection: () => AssistantSelection) => {
  const route = useRoute();
  const selections = useAssistantSelections();
  const key = useId();
  watch([() => route.path, readSelection], ([path, selection]) => {
    selections.value = { ...selections.value, [key]: { path, selection } };
  }, { immediate: true, deep: true });
  onBeforeUnmount(() => {
    const next = { ...selections.value };
    delete next[key];
    selections.value = next;
  });
};
