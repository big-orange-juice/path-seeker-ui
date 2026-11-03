export type DriverLocationStatus = 'online' | 'stale' | 'offline' | 'waiting' | 'stopped';

export interface DriverLocation {
  userId: string;
  roomId: string;
  displayName: string;
  phone: string | null;
  roomCode: string;
  roomStatus: string;
  status: DriverLocationStatus;
  longitude: number | null;
  latitude: number | null;
  accuracy: number | null;
  sampledAt: string | null;
  receivedAt: string | null;
  lastSeenAt: string | null;
  coordinateSystem: 'GCJ-02';
}

export interface DriverLocationSnapshot {
  serverTime: string;
  list: DriverLocation[];
}

export const driverStatusLabels: Record<DriverLocationStatus, string> = {
  online: '在线', stale: '定位过期', offline: '离线', waiting: '等待定位', stopped: '未共享位置',
};
