export interface AdminProfile {
  name: string;
  account: string;
  /** 展示名：管理员 / 导游 等 */
  role: string;
  /** 后端角色码：ADMIN / CREATOR */
  roleCode: string;
  /** 后台账号 ID，用于归属判断 */
  adminId: string;
}

export interface AdminLoginForm {
  account: string;
  password: string;
}

export interface AdminLoginPayload {
  username: string;
  password: string;
}

export interface AdminLoginResponse {
  adminId?: string | null;
  accessToken?: string | null;
  username?: string | null;
  realName?: string | null;
  roleCode?: string | null;
  roleName?: string | null;
  expiresIn?: number;
  [key: string]: unknown;
}
