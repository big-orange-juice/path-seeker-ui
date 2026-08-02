import { computed, readonly } from 'vue';
import { ADMIN_ROUTE_PREFIX } from '@/constants/admin-auth';
import { useAdminNavigation } from '@/composables/useAdminNavigation';
import { useAdminTipsStore } from '@/stores/adminTips';

export type AdminTipsStepId = 'guides' | 'routes' | 'museums' | 'collections' | 'operations' | 'users';

export interface AdminTipsStep {
  id: AdminTipsStepId;
  target: string;
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
}

const tipsSteps: AdminTipsStep[] = [
  {
    id: 'guides',
    target: `${ADMIN_ROUTE_PREFIX}/guides`,
    eyebrow: '第一步 · 导游管理',
    title: '先准备导游，再创建路线',
    description: '导游菜单是主题路线创建的前提。先创建或完善讲解形象，路线节点才能绑定对应的讲解风格。',
    note: '创建路线前，请先完成导游配置。',
  },
  {
    id: 'routes',
    target: `${ADMIN_ROUTE_PREFIX}/routes`,
    eyebrow: '第二步 · 主题路线',
    title: '在这里编排一条探索路线',
    description: '选择主题、添加站点和谜题，把博物馆内容组织成游客可以完成的探索旅程。',
  },
  {
    id: 'museums',
    target: `${ADMIN_ROUTE_PREFIX}/museums`,
    eyebrow: '菜单 · 博物馆',
    title: '先把场馆基础信息准备好',
    description: '维护博物馆的名称、楼层与设施信息，为路线中的站点提供准确的场馆背景。',
  },
  {
    id: 'collections',
    target: `${ADMIN_ROUTE_PREFIX}/collections`,
    eyebrow: '菜单 · 馆藏内容',
    title: '集中维护展品与故事素材',
    description: '管理展品资料和可讲述的内容，让路线节点有可靠的素材来源。',
  },
  {
    id: 'operations',
    target: `${ADMIN_ROUTE_PREFIX}/operations`,
    eyebrow: '菜单 · 运营分析',
    title: '从运营分析掌握整体表现',
    description: '查看路线、用户与游玩数据，了解哪些内容正在被游客使用。',
  },
  {
    id: 'users',
    target: `${ADMIN_ROUTE_PREFIX}/users`,
    eyebrow: '菜单 · 用户管理',
    title: '维护账号与使用权限',
    description: '管理后台账号、角色与状态，让每位协作者只看到需要使用的功能。',
  },
];

export const useAdminTipsGuide = () => {
  const tipsStore = useAdminTipsStore();
  const { navItems } = useAdminNavigation();
  const openState = useState<boolean>('admin-tips-guide-open', () => false);
  const stepIndexState = useState<number>('admin-tips-guide-step', () => 0);

  const visibleSteps = computed(() => tipsSteps.filter((step) => navItems.value.some((item) => item.to === step.target)));
  const currentStepIndex = computed(() => {
    const maxIndex = Math.max(visibleSteps.value.length - 1, 0);
    return Math.min(Math.max(stepIndexState.value, 0), maxIndex);
  });
  const currentStep = computed(() => visibleSteps.value[currentStepIndex.value] ?? null);
  const currentMenuLabel = computed(() => {
    const target = currentStep.value?.target;
    return navItems.value.find((item) => item.to === target)?.label || currentStep.value?.eyebrow || '菜单';
  });
  const stepCount = computed(() => visibleSteps.value.length);
  const isFirstStep = computed(() => currentStepIndex.value === 0);
  const isLastStep = computed(() => currentStepIndex.value >= Math.max(stepCount.value - 1, 0));

  const open = (stepId: AdminTipsStepId = 'guides') => {
    const requestedIndex = visibleSteps.value.findIndex((step) => step.id === stepId);
    stepIndexState.value = requestedIndex >= 0 ? requestedIndex : 0;
    openState.value = visibleSteps.value.length > 0;
  };

  const openOnFirstVisit = () => {
    if (tipsStore.shouldAutoOpen && visibleSteps.value.length > 0) {
      open();
    }
  };

  const openManually = () => {
    tipsStore.enableAutoOpen();
    open();
  };

  const close = () => {
    openState.value = false;
  };

  const dismiss = () => {
    tipsStore.disableAutoOpen();
    close();
  };

  const goNext = () => {
    if (isLastStep.value) {
      close();
      return;
    }

    stepIndexState.value = currentStepIndex.value + 1;
  };

  const goPrevious = () => {
    if (!isFirstStep.value) {
      stepIndexState.value = currentStepIndex.value - 1;
    }
  };

  return {
    isOpen: readonly(openState),
    currentStep,
    currentStepIndex,
    currentMenuLabel,
    stepCount,
    isFirstStep,
    isLastStep,
    open,
    openManually,
    openOnFirstVisit,
    close,
    dismiss,
    goNext,
    goPrevious,
  };
};
