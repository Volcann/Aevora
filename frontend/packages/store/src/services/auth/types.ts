export interface UserProfile {
  id: string;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  theme_config?: Record<string, unknown>;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface LoginPayload {
  email?: string;
  username?: string;
  password?: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: UserProfile;
}

export interface LogoutPayload {
  refresh?: string;
}
