import { onBeforeUnmount, shallowRef, watch } from 'vue';
import { useApiClient } from '@/composables/useApiClient';
import {
  ROUTE_TASK_STATUS,
  type RouteBuildTaskItem,
  type RouteBuildTaskProgress,
  type RouteTaskDetailResponse,
  type RouteTaskSummaryResponse,
} from '@/types/route';

/**
 * 路线对话工作台右侧「创建进度」的数据源。
 *
 * 对话 SSE 只在流未断开时推送 ui.route.build.progress，弹窗关闭重开或后台任务
 * 继续跑的时候就收不到增量了，所以这里改成轮询 /api/Route/TaskStatus 的汇总接口，
 * 用固定节奏拿到「还在跑几个任务 / 整体百分比」。
 *
 * 边界：
 * - 只负责取数与归一化，不碰对话流，也不判断业务上该不该生成。
 * - 只要面板在前台且已有 routeId 就持续轮询，不做「看起来跑完了就停」的优化：
 *   后台任务往往在对话轮次结束后才入队，提前停会正好错过真正要看的进度。
 */

/** 轮询间隔；路线生成是分钟级任务，5 秒足够跟上进度又不会压任务接口 */
const POLL_INTERVAL_MS = 5000;

/** 子任务明细最多展示条数，避免右侧面板被长列表撑开 */
const MAX_TASK_ITEMS = 5;

interface UseRouteBuildTaskProgressOptions {
  /** 当前路线 ID；为空表示还没生成路线，不轮询 */
  routeId: () => string;
  /** 面板是否在前台展示；关闭弹窗后停止轮询 */
  active: () => boolean;
}

const normalizeText = (value: unknown) => String(value ?? '').trim();

const toCount = (value: unknown) => {
  const next = Number(value);
  return Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
};

/** 进度统一收成 0–100 整数；后端给不出数值时返回 null，表示「进度未知」而不是 0 */
const toPercent = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
};

/**
 * 是否仍是「在跑」的汇总状态。
 * 0=空闲 1=排队中 2=执行中 3=等待重试；缺字段时按未知处理（视为在跑）。
 */
const isBusySummaryStatus = (status: number | null | undefined) =>
  status == null || status !== ROUTE_TASK_STATUS.Idle;

/**
 * 单条子任务是否失败。
 * 后端 schema 里没有路线任务的失败状态码，沿用解说任务的做法：
 * errorCode / errorMessage 有值即失败，statusText 含关键字兜底。
 */
const isTaskFailed = (task: RouteTaskDetailResponse) =>
  Boolean(normalizeText(task.errorCode) || normalizeText(task.errorMessage))
  || /失败|错误/.test(normalizeText(task.statusText));

const resolveTaskLabel = (task: RouteTaskDetailResponse) =>
  normalizeText(task.statusText)
  || normalizeText(task.summary)
  || normalizeText(task.taskType)
  || '处理中';

const toTaskItem = (task: RouteTaskDetailResponse, index: number): RouteBuildTaskItem => ({
  key: normalizeText(task.taskId) || `task-${index}`,
  label: resolveTaskLabel(task),
  progressPercent: toPercent(task.progressPercent),
  failed: isTaskFailed(task),
});

/** 有子任务时取进度均值，否则沿用「仅排队记 0」的约定，避免排队阶段整块进度条空白 */
const resolveOverallPercent = (
  tasks: RouteTaskDetailResponse[],
  summary: RouteTaskSummaryResponse,
): number | null => {
  const percents = tasks
    .map((task) => toPercent(task.progressPercent))
    .filter((percent): percent is number => percent !== null);

  if (percents.length) {
    return Math.round(percents.reduce((sum, percent) => sum + percent, 0) / percents.length);
  }

  return isBusySummaryStatus(summary.taskStatus) ? 0 : null;
};

const resolveTone = (
  failedCount: number,
  executingTaskCount: number,
  summary: RouteTaskSummaryResponse,
): RouteBuildTaskProgress['tone'] => {
  if (failedCount > 0) {
    return 'failed';
  }

  if (executingTaskCount > 0 || isBusySummaryStatus(summary.taskStatus)) {
    return 'running';
  }

  return 'completed';
};

/** 后端 taskStatusText 常为空或是「空闲」这类无信息量的词，这里统一补一句可读的状态 */
const resolveTitle = (
  tone: RouteBuildTaskProgress['tone'],
  statusText: string,
  hasTask: boolean,
) => {
  if (tone === 'failed') {
    return '创建任务失败';
  }

  if (statusText && statusText !== '空闲') {
    return statusText;
  }

  if (tone === 'running') {
    return '正在创建路线内容';
  }

  return hasTask ? '创建任务已结束' : '暂无进行中的创建任务';
};

const toProgressView = (
  summary: RouteTaskSummaryResponse | null | undefined,
): RouteBuildTaskProgress | null => {
  if (!summary) {
    return null;
  }

  const tasks = Array.isArray(summary.tasks) ? summary.tasks : [];
  const failedTasks = tasks.filter(isTaskFailed);
  const executingTaskCount = toCount(summary.executingTaskCount);
  const tone = resolveTone(failedTasks.length, executingTaskCount, summary);
  const routeBuildTaskCount = toCount(summary.routeBuildTaskCount);
  const assetGenerationTaskCount = toCount(summary.assetGenerationTaskCount);

  const metaParts = [`创建任务 ${routeBuildTaskCount}`, `素材任务 ${assetGenerationTaskCount}`];
  if (executingTaskCount > 0) {
    metaParts.push(`执行中 ${executingTaskCount}`);
  }
  if (failedTasks.length > 0) {
    metaParts.push(`失败 ${failedTasks.length}`);
  }

  return {
    title: resolveTitle(tone, normalizeText(summary.taskStatusText), tasks.length > 0),
    meta: metaParts.join(' · '),
    progressPercent: resolveOverallPercent(tasks, summary),
    tone,
    executingTaskCount,
    routeBuildTaskCount,
    assetGenerationTaskCount,
    errorMessage: failedTasks
      .map((task) => normalizeText(task.errorMessage))
      .find((message) => Boolean(message)) ?? '',
    // 失败任务优先露出，保证用户第一眼看到的就是出问题的那条
    tasks: [...failedTasks, ...tasks.filter((task) => !isTaskFailed(task))]
      .slice(0, MAX_TASK_ITEMS)
      .map(toTaskItem),
    updatedAt: Date.now(),
  };
};

export const useRouteBuildTaskProgress = (options: UseRouteBuildTaskProgressOptions) => {
  const { request } = useApiClient();

  const progress = shallowRef<RouteBuildTaskProgress | null>(null);

  let timer: ReturnType<typeof setInterval> | null = null;
  let inFlight = false;

  const stopPolling = () => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  };

  const fetchOnce = async () => {
    const routeId = normalizeText(options.routeId());

    if (!routeId || inFlight) {
      return;
    }

    inFlight = true;

    try {
      const summary = await request<RouteTaskSummaryResponse>('/api/route/task-status', {
        method: 'GET',
        query: { routeId },
      });

      // 请求期间可能已经切走路线或关闭面板，丢弃过期响应
      if (routeId !== normalizeText(options.routeId())) {
        return;
      }

      progress.value = toProgressView(summary);
    } catch {
      // 轮询失败不打断用户：保留上一次快照，下一个周期自动重试
    } finally {
      inFlight = false;
    }
  };

  const syncPolling = () => {
    if (!options.active() || !normalizeText(options.routeId())) {
      stopPolling();
      return;
    }

    if (timer) {
      return;
    }

    // 先立刻取一次，避免面板打开后空等一个轮询周期
    void fetchOnce();
    timer = setInterval(() => {
      void fetchOnce();
    }, POLL_INTERVAL_MS);
  };

  watch(
    () => [options.active(), options.routeId()] as const,
    ([active, routeId], previous) => {
      if (previous && previous[1] !== routeId) {
        // 换路线时清掉上一条的快照，避免右侧短暂串台
        progress.value = null;
        stopPolling();
      }

      if (!active) {
        stopPolling();
        return;
      }

      syncPolling();
    },
    { immediate: true },
  );

  onBeforeUnmount(stopPolling);

  return {
    progress,
  };
};
