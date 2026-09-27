export const CACHE_TAGS = {
  USER: "User",
  AUTH: "Auth",
  CHAT: "Chat",
  AGENTS: "Agents",
  TOOLS: "Tools",
  CORE: "Core",
  NOTIFICATIONS: "Notifications",
} as const;

export interface ApiResponse<T = void> {
  success: boolean;
  status_code: number;
  message: string;
  data: T;
}

export interface BasePaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export type PaginatedResponse<T> = ApiResponse<BasePaginatedResponse<T>>;

export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface TokenRefreshData {
  access?: string;
  refresh?: string;
}

export type TokenRefreshResponse = ApiResponse<TokenRefreshData>;

export interface AuthSessionPolicy {
  isLocked: () => boolean;
  isPublicRoute: () => boolean;
  onSignOut: () => void;
}
