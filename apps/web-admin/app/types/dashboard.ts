/** GET /api/Admin/Dashboard */

export interface DashboardOverview {
  userTotal: number;
  exhibitTotal: number;
  puzzleTotal: number;
  routeTotal: number;
  publishedRouteTotal: number;
  sessionTotal: number;
  completedSessionTotal: number;
  completionRate: number;
  badgeGrantTotal: number;
  teamTotal: number;
}

export interface DashboardRouteStat {
  routeId: string;
  title: string;
  startCount: number;
  completeCount: number;
  completionRate: number;
  avgDurationSec: number;
}

export interface DashboardAgeDistribution {
  /** 0=通用 1=4-6 2=6-10 3=10-15 4=15+ */
  ageGroup: number;
  startCount: number;
  completeCount: number;
  completionRate: number;
}

export interface DashboardStuckPuzzle {
  puzzleId: string;
  title: string;
  attemptCount: number;
  correctCount: number;
  correctRate: number;
}

export interface DashboardHotExhibit {
  exhibitId: string;
  name: string;
  solveCount: number;
}

export interface DashboardResponse {
  overview: DashboardOverview | null;
  routeStats: DashboardRouteStat[];
  ageDistribution: DashboardAgeDistribution[];
  stuckPuzzles: DashboardStuckPuzzle[];
  hotExhibits: DashboardHotExhibit[];
}

export const AGE_GROUP_LABELS: Record<number, string> = {
  0: '通用',
  1: '4-6 岁',
  2: '6-10 岁',
  3: '10-15 岁',
  4: '15+ 岁',
};
