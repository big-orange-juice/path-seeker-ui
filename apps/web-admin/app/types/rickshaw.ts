export interface RickshawRecord {
  id: string;
  museumId: string | null;
  museumName?: string | null;
  vehicleNo: string;
  driverName?: string | null;
  driverPhone?: string | null;
  driverUserNo?: string | null;
  driverUserId?: string | null;
  remark?: string | null;
  status: number;
  qrToken?: string | null;
}

export interface RickshawDraft {
  id?: string;
  museumId: string;
  vehicleNo: string;
  driverName: string;
  driverPhone?: string;
  driverUserNo?: string;
  remark: string;
}

export interface RickshawPage {
  list: RickshawRecord[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface RickshawQr {
  rickshawId: string;
  vehicleNo: string;
  token: string;
  targetUrl: string;
  qrImageDataUri?: string | null;
}

export interface RickshawPerformance {
  rickshawId: string;
  vehicleNo: string;
  scanCount: number;
  uniqueUserCount: number;
  visitStartCount: number;
  routeCompleteCount: number;
  stopCompleteCount: number;
  totalDurationSeconds: number;
  avgDurationSeconds: number;
  completionRate: number;
}

export const RICKSHAW_STATUSES = [
  { value: 1, label: '启用' },
  { value: 2, label: '停用' },
  { value: 3, label: '维修' },
  { value: 4, label: '退役' },
];
