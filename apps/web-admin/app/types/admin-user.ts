/** 管理员列表项（AdminListItemResponse） */
export interface AdminUserRecord {
  id: string;
  username: string;
  realName: string;
  phone: string;
  email: string;
  roleId: string;
  roleCode: string;
  roleName: string;
  status: number;
  lastLoginTime: string;
  createdAt: string;
}

export interface AdminUserPageResult {
  list: AdminUserRecord[];
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AdminUserPageQuery {
  pageIndex: number;
  pageSize: number;
  keyword?: string | null;
  roleId?: string | null;
  /** 1=启用 2=禁用；null 表示全部 */
  status?: number | null;
}

export interface AdminRoleOption {
  id: string;
  roleCode: string;
  roleName: string;
  remark: string;
  status: number;
  permissions: string[];
}

export interface CreateAdminUserPayload {
  username: string;
  password: string;
  realName?: string | null;
  phone?: string | null;
  email?: string | null;
  roleId: string;
}

export interface UpdateAdminUserPayload {
  id: string;
  realName?: string | null;
  phone?: string | null;
  email?: string | null;
  roleId: string;
}

export interface AdminUserDraft {
  id: string;
  username: string;
  password: string;
  realName: string;
  phone: string;
  email: string;
  roleId: string;
}

export const ADMIN_USER_STATUS = {
  ENABLED: 1,
  DISABLED: 2,
} as const;

export const ADMIN_USER_STATUS_OPTIONS = [
  { label: '全部状态', value: 0 },
  { label: '启用', value: ADMIN_USER_STATUS.ENABLED },
  { label: '禁用', value: ADMIN_USER_STATUS.DISABLED },
] as const;

export function createEmptyAdminUserDraft(): AdminUserDraft {
  return {
    id: '',
    username: '',
    password: '',
    realName: '',
    phone: '',
    email: '',
    roleId: '',
  };
}

export function createAdminUserDraftFromRecord(record: AdminUserRecord): AdminUserDraft {
  return {
    id: String(record.id || ''),
    username: String(record.username || ''),
    password: '',
    realName: String(record.realName || ''),
    phone: String(record.phone || ''),
    email: String(record.email || ''),
    roleId: String(record.roleId || ''),
  };
}

export function getAdminUserStatusLabel(status?: number | null) {
  if (status === ADMIN_USER_STATUS.ENABLED) return '启用';
  if (status === ADMIN_USER_STATUS.DISABLED) return '禁用';
  return '未知';
}
