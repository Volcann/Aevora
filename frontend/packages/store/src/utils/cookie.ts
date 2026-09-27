import { CookieKeyEnum } from "../constants";

enum SameSiteEnum {
  LAX = "Lax",
  STRICT = "Strict",
  NONE = "None",
}

interface CookieOptions {
  days?: number;
  path?: string;
  secure?: boolean;
  sameSite?: SameSiteEnum | undefined;
}

const DEFAULT_COOKIE_OPTIONS = {
  days: 7,
  path: "/",
  secure: true,
  sameSite: "Lax",
};

export function setCookie(
  key: CookieKeyEnum | string,
  value: string,
  options: CookieOptions = DEFAULT_COOKIE_OPTIONS as CookieOptions,
) {
  if (typeof window === "undefined") return;

  const {
    days = DEFAULT_COOKIE_OPTIONS.days,
    path = DEFAULT_COOKIE_OPTIONS.path,
    secure = DEFAULT_COOKIE_OPTIONS.secure,
    sameSite = DEFAULT_COOKIE_OPTIONS.sameSite,
  } = options;

  let cookieString = `${encodeURIComponent(key)}=${encodeURIComponent(
    value,
  )}; path=${path}; SameSite=${sameSite}`;

  if (days !== 0) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    cookieString += `; expires=${expires}`;
  }

  if (secure && window.location.protocol === "https:") {
    cookieString += "; Secure";
  }

  document.cookie = cookieString;
}

export function getCookie(key: CookieKeyEnum | string): string | null {
  if (typeof window === "undefined") return null;

  const cookies = document.cookie
    .split("; ")
    .find((row) => row.split("=")[0] === encodeURIComponent(key));

  if (!cookies) return null;

  const value = cookies.split("=")[1];
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

export function getServerCookie(
  cookieStore: { get: (name: string) => { value: string } | undefined },
  key: CookieKeyEnum | string,
): string | null {
  return cookieStore.get(key)?.value ?? null;
}

export function removeCookie(key: CookieKeyEnum | string, path = "/") {
  setCookie(key, "", { days: -1, path });
}

export function clearAuthCookies(path = "/") {
  removeCookie(CookieKeyEnum.ACCESS_TOKEN, path);
  removeCookie(CookieKeyEnum.REFRESH_TOKEN, path);
}

export function clearAllCookies() {
  if (typeof window === "undefined") return;

  document.cookie.split(";").forEach((c) => {
    const cookiePair = c.trim();
    if (!cookiePair) return;
    const cookieName = decodeURIComponent(cookiePair.split("=")[0] ?? "");
    removeCookie(cookieName);
  });
}

export const SERVER_COOKIE_OPTIONS = {
  path: "/",
  httpOnly: false,
  secure: true,
  sameSite: "lax" as const,
};

export function createClearCookieOptions() {
  return {
    expires: new Date(0),
    ...SERVER_COOKIE_OPTIONS,
  };
}
