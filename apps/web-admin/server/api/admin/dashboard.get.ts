import type { ApiResponse } from '~~/app/types/api';
import type { DashboardResponse } from '~~/app/types/dashboard';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

const emptyDashboard = (): DashboardResponse => ({
  overview: null,
  routeStats: [],
  ageDistribution: [],
  stuckPuzzles: [],
  hotExhibits: [],
});

export default defineEventHandler(async (event): Promise<DashboardResponse> => {
  const response = await backendFetch<ApiResponse<DashboardResponse>>(event, '/Admin/Dashboard', {
    method: 'GET',
  });

  const data = unwrapApiResponse(response);
  if (!data) {
    return emptyDashboard();
  }

  return {
    overview: data.overview ?? null,
    routeStats: Array.isArray(data.routeStats)
      ? data.routeStats.map((item) => ({
          ...item,
          routeId: String(item.routeId ?? ''),
        }))
      : [],
    ageDistribution: Array.isArray(data.ageDistribution) ? data.ageDistribution : [],
    stuckPuzzles: Array.isArray(data.stuckPuzzles)
      ? data.stuckPuzzles.map((item) => ({
          ...item,
          puzzleId: String(item.puzzleId ?? ''),
        }))
      : [],
    hotExhibits: Array.isArray(data.hotExhibits)
      ? data.hotExhibits.map((item) => ({
          ...item,
          exhibitId: String(item.exhibitId ?? ''),
        }))
      : [],
  };
});
