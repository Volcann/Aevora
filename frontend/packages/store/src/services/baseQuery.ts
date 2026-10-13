import {
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query";
import { fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { CookieKeyEnum, EXCLUDED_SUBDOMAINS } from "../constants";
import { clearAuthCookies, getCookie, setCookie } from "../utils";
import type { AuthSessionPolicy, TokenRefreshResponse } from "./shared/types";

export const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
] as const;

const TOKEN_REFRESH_PATH = "/api/v1/auth/token/refresh/";
const TOKEN_REFRESH_LOCK_NAME = "aevora-auth-token-refresh";

let refreshPromise: Promise<boolean> | null = null;
let sessionPolicy: AuthSessionPolicy | undefined;

export function configureAuthSession(policy: AuthSessionPolicy): void {
  if (typeof window !== "undefined") sessionPolicy = policy;
}

function redirectToLogin() {
  clearAuthCookies();
  sessionPolicy?.onSignOut();
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login")
  ) {
    window.location.replace("/login");
  }
}

export const getBaseUrl = () => {
  if (typeof window !== "undefined") {
    const custom = localStorage.getItem("aevora_api_base_url");
    if (custom) return custom;
  }
  const defaultBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8002";

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const hostParts = hostname.split(".");
    let subdomain = null;

    if (
      hostParts.length > (hostname.includes("localhost") ? 1 : 2) &&
      hostParts[0] !== "localhost"
    ) {
      subdomain = hostParts[0];
    }

    if (subdomain && !EXCLUDED_SUBDOMAINS.includes(subdomain)) {
      try {
        const url = new URL(defaultBaseUrl);
        url.hostname = `${subdomain}.${url.hostname}`;
        return url.toString().replace(/\/$/, "");
      } catch {
        // Fallback
      }
    }
  }

  return defaultBaseUrl;
};

async function requestTokenRefresh(
  expectedAccessToken?: string,
): Promise<boolean> {
  if (
    typeof window !== "undefined" ||
    !sessionPolicy ||
    sessionPolicy.isLocked()
  ) {
    return false;
  }

  const refresh = async (): Promise<boolean> => {
    if (sessionPolicy?.isLocked()) return false;
    if (
      expectedAccessToken &&
      getCookie(CookieKeyEnum.ACCESS_TOKEN) !== expectedAccessToken
    ) {
      return true;
    }

    const refreshToken = getCookie(CookieKeyEnum.REFRESH_TOKEN);
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${getBaseUrl()}${TOKEN_REFRESH_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      if (!response.ok) return false;

      const { data } = (await response.json()) as TokenRefreshResponse;
      if (!data?.access) return false;

      if (
        sessionPolicy?.isLocked() ||
        getCookie(CookieKeyEnum.REFRESH_TOKEN) !== refreshToken
      ) {
        return false;
      }

      setCookie(CookieKeyEnum.ACCESS_TOKEN, data.access);
      if (data.refresh) setCookie(CookieKeyEnum.REFRESH_TOKEN, data.refresh);
      return true;
    } catch (error) {
      console.error("Unable to refresh authentication tokens.", error);
      return false;
    }
  };

  return "locks" in navigator
    ? navigator.locks.request(TOKEN_REFRESH_LOCK_NAME, refresh)
    : refresh();
}

export function refreshAuthTokens(
  expectedAccessToken?: string,
): Promise<boolean> {
  refreshPromise ??= requestTokenRefresh(expectedAccessToken).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

export const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const baseUrl = getBaseUrl();
  const rawBaseQuery = fetchBaseQuery({
    baseUrl,
    paramsSerializer: (params) => {
      return Object.entries(params)
        .filter(([_, v]) => v !== undefined && v !== null)
        .map(([k, v]) => {
          const encodedKey = encodeURIComponent(k);
          const encodedValue = encodeURIComponent(String(v)).replace(
            /%2C/g,
            ",",
          );
          return `${encodedKey}=${encodedValue}`;
        })
        .join("&");
    },
    prepareHeaders: (headers) => {
      const accessToken = getCookie(CookieKeyEnum.ACCESS_TOKEN);
      if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
      return headers;
    },
  });

  return rawBaseQuery(args, api, extraOptions);
};

export const baseQueryWithInterceptor = (
  endpoint: string,
): BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> => {
  return async (args, api, extraOptions) => {
    const modifiedArgs: string | FetchArgs =
      typeof args === "string"
        ? `${endpoint}${args}`
        : {
            ...args,
            url: `${endpoint}${args.url ?? ""}`,
          };

    const requestUrl =
      typeof modifiedArgs === "string" ? modifiedArgs : modifiedArgs.url;
    const isLoginRequest = requestUrl.startsWith("/auth/login/");
    const accessToken = getCookie(CookieKeyEnum.ACCESS_TOKEN);

    const hasAuthTokens = Boolean(
      accessToken || getCookie(CookieKeyEnum.REFRESH_TOKEN),
    );
    if (
      hasAuthTokens &&
      sessionPolicy?.isLocked() &&
      !sessionPolicy.isPublicRoute() &&
      !isLoginRequest
    ) {
      redirectToLogin();
      return {
        error: {
          status: 401,
          data: { detail: "Session is locked." },
        },
      };
    }

    let result = await baseQuery(modifiedArgs, api, extraOptions);

    if (result.error?.status === 401 && !isLoginRequest) {
      if (
        sessionPolicy &&
        !sessionPolicy.isPublicRoute() &&
        !sessionPolicy.isLocked() &&
        (await refreshAuthTokens(accessToken ?? undefined))
      ) {
        result = await baseQuery(modifiedArgs, api, extraOptions);
      } else if (typeof window !== "undefined") {
        const isPublicRoute =
          sessionPolicy?.isPublicRoute() ??
          PUBLIC_ROUTES.some((route) =>
            window.location.pathname.startsWith(route),
          );
        if (!isPublicRoute) redirectToLogin();
      }
    }

    return result;
  };
};
