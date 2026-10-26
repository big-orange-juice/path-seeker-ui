export interface AppUserRecord {
  id: string;
  userNo: string;
  nickname: string | null;
  phone: string | null;
  email: string | null;
  registerChannel: number;
  status: number;
  isDriver: boolean;
  driverPhone: string | null;
  registerTime: string;
  lastLoginTime: string | null;
}

export interface AppUserPage {
  list: AppUserRecord[];
  total: number;
  pageIndex: number;
  pageSize: number;
}

export interface DriverPermissionDraft {
  userId: string;
  isDriver: boolean;
  phone: string;
}
