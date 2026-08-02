<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';
import { useAdminTipsGuide } from '@/composables/useAdminTipsGuide';

interface ViewportSize {
  width: number;
  height: number;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const {
  isOpen,
  currentStep,
  currentStepIndex,
  currentMenuLabel,
  stepCount,
  isFirstStep,
  isLastStep,
  openOnFirstVisit,
  close,
  dismiss,
  goNext,
  goPrevious,
} = useAdminTipsGuide();

const viewport = shallowRef<ViewportSize>({ width: 0, height: 0 });
const spotlight = shallowRef<SpotlightRect | null>(null);
const autoOpenChecked = shallowRef(false);

const cardStyle = computed(() => {
  const rect = spotlight.value;
  const width = Math.min(360, Math.max(viewport.value.width - 32, 280));
  const minTop = 16;
  const maxTop = Math.max(minTop, viewport.value.height - 330);

  if (!rect || viewport.value.width < 1024) {
    return {
      left: '50%',
      top: '50%',
      width: `${width}px`,
      transform: 'translate(-50%, -50%)',
    };
  }

  const preferredLeft = rect.left + rect.width + 18;
  const left = Math.min(preferredLeft, Math.max(16, viewport.value.width - width - 16));
  const top = Math.min(Math.max(rect.top - 8, minTop), maxTop);

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
  };
});

const updatePosition = () => {
  if (!import.meta.client) {
    return;
  }

  viewport.value = {
    width: window.innerWidth,
    height: window.innerHeight,
  };

  if (!isOpen.value || !currentStep.value) {
    spotlight.value = null;
    return;
  }

  const target = Array.from(document.querySelectorAll<HTMLElement>('[data-admin-nav]'))
    .find((element) => element.dataset.adminNav === currentStep.value?.target);

  if (!target || window.innerWidth < 1024) {
    spotlight.value = null;
    return;
  }

  const rect = target.getBoundingClientRect();
  spotlight.value = {
    top: Math.max(rect.top - 6, 8),
    left: Math.max(rect.left - 6, 8),
    width: rect.width + 12,
    height: rect.height + 12,
  };
};

const refreshPosition = async () => {
  await nextTick();
  window.requestAnimationFrame(updatePosition);
};

const handleKeydown = (event: KeyboardEvent) => {
  if (!isOpen.value) {
    return;
  }

  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    return;
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault();
    goNext();
  }

  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    goPrevious();
  }
};

watch([isOpen, currentStep], () => {
  void refreshPosition();
});

onMounted(() => {
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);
  window.addEventListener('keydown', handleKeydown);

  window.requestAnimationFrame(() => {
    if (autoOpenChecked.value) {
      return;
    }

    autoOpenChecked.value = true;
    openOnFirstVisit();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
  window.removeEventListener('keydown', handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="admin-tips">
      <div
        v-if="isOpen && currentStep"
        class="admin-tips fixed inset-0 z-[10000]"
        role="dialog"
        aria-modal="true"
        aria-label="后台菜单使用提示">
        <div
          v-if="!spotlight"
          class="absolute inset-0 bg-[#050608]/78 backdrop-blur-[1px]"
          aria-hidden="true" />

        <div
          v-else
          class="admin-tips__spotlight pointer-events-none fixed"
          :style="{
            top: `${spotlight.top}px`,
            left: `${spotlight.left}px`,
            width: `${spotlight.width}px`,
            height: `${spotlight.height}px`,
          }"
          aria-hidden="true" />

        <section class="admin-tips__card fixed" :style="cardStyle">
          <div class="flex items-start justify-between gap-3">
            <div class="flex min-w-0 items-center gap-2.5">
              <div class="admin-tips__icon flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                <UiAppIcon name="sparkles" class="h-4 w-4" />
              </div>
              <div class="min-w-0">
                <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary/80">{{ currentStep.eyebrow }}</p>
                <p class="mt-1 truncate text-xs text-muted-foreground">当前菜单：{{ currentMenuLabel }}</p>
              </div>
            </div>
            <button
              type="button"
              class="admin-tips__close inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground"
              aria-label="关闭菜单提示"
              title="关闭提示"
              @click="close">
              <UiAppIcon name="x" class="h-4 w-4" />
            </button>
          </div>

          <div class="mt-5">
            <h2 class="text-[1.1rem] font-semibold leading-7 tracking-tight text-foreground">{{ currentStep.title }}</h2>
            <p class="mt-2 text-sm leading-6 text-muted-foreground">{{ currentStep.description }}</p>
          </div>

          <div
            v-if="currentStep.id === 'guides' && currentStep.note"
            class="admin-tips__note mt-4 flex gap-2.5 rounded-lg px-3 py-2.5 text-sm leading-5">
            <UiAppIcon name="circle-alert" class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>{{ currentStep.note }}</span>
          </div>

          <div class="mt-5 flex items-center justify-between gap-3 border-t border-border/80 pt-4">
            <div class="flex min-w-0 items-center gap-2">
              <span class="text-xs tabular-nums text-muted-foreground">{{ currentStepIndex + 1 }} / {{ stepCount }}</span>
              <button
                type="button"
                class="admin-tips__dismiss inline-flex h-8 items-center rounded-md px-1.5 text-xs font-medium transition-colors"
                title="关闭自动提示"
                @click="dismiss">
                不再提示
              </button>
            </div>
            <div class="flex items-center gap-2">
              <button
                v-if="!isFirstStep"
                type="button"
                class="admin-tips__secondary inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors"
                @click="goPrevious">
                <UiAppIcon name="arrow-left" class="h-3.5 w-3.5" />
                上一步
              </button>
              <button
                type="button"
                class="admin-tips__primary inline-flex h-8 items-center gap-1 rounded-md px-3 text-xs font-semibold transition-colors"
                @click="goNext">
                {{ isLastStep ? '完成' : '下一步' }}
                <UiAppIcon v-if="!isLastStep" name="arrow-right" class="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.admin-tips__spotlight {
  border: 1px solid rgba(232, 201, 133, 0.95);
  border-radius: 0.55rem;
  box-shadow:
    0 0 0 9999px rgba(5, 6, 8, 0.76),
    0 0 0 4px rgba(209, 178, 111, 0.15),
    0 10px 28px rgba(0, 0, 0, 0.3);
}

.admin-tips__card {
  max-height: calc(100vh - 2rem);
  overflow-y: auto;
  border: 1px solid rgba(209, 178, 111, 0.3);
  border-radius: 0.8rem;
  background:
    linear-gradient(145deg, rgba(209, 178, 111, 0.1), transparent 42%),
    #14161a;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.04);
  padding: 1rem;
}

.admin-tips__icon {
  background: rgba(209, 178, 111, 0.14);
  color: hsl(var(--primary));
  box-shadow: inset 0 0 0 1px rgba(209, 178, 111, 0.2);
}

.admin-tips__close:hover {
  background: rgba(255, 255, 255, 0.06);
}

.admin-tips__note {
  border: 1px solid rgba(209, 178, 111, 0.24);
  background: rgba(209, 178, 111, 0.08);
  color: hsl(var(--foreground));
}

.admin-tips__secondary {
  color: hsl(var(--muted-foreground));
}

.admin-tips__secondary:hover {
  background: rgba(255, 255, 255, 0.06);
  color: hsl(var(--foreground));
}

.admin-tips__dismiss {
  color: hsl(var(--muted-foreground));
}

.admin-tips__dismiss:hover {
  color: hsl(var(--foreground));
  text-decoration: underline;
  text-underline-offset: 3px;
}

.admin-tips__primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.admin-tips__primary:hover {
  filter: brightness(1.08);
}

.admin-tips__close:focus-visible,
.admin-tips__secondary:focus-visible,
.admin-tips__dismiss:focus-visible,
.admin-tips__primary:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.admin-tips-enter-active,
.admin-tips-leave-active {
  transition: opacity 180ms ease;
}

.admin-tips-enter-from,
.admin-tips-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .admin-tips-enter-active,
  .admin-tips-leave-active {
    transition: none;
  }
}
</style>
