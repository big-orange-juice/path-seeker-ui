export interface AdminProfile {
  name: string;
  account: string;
  role: string;
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
