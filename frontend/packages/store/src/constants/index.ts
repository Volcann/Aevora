export const DEFAULT_PAGE_SIZE = 10;

export const EXCLUDED_SUBDOMAINS = [
  "www",
  "admin",
  "stage-admin",
  "localhost",
  "app",
  "stage",
];

export enum CookieKeyEnum {
  ACCESS_TOKEN = "access_token",
  REFRESH_TOKEN = "refresh_token",
  USER_ID = "user_id",
  THEME = "theme",
}
