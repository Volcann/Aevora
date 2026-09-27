import { RouteEnum } from "@/types/routes";
import { CookieKeyEnum } from "@repo/store/constants";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_ROUTES = [
  RouteEnum.HOME,
  RouteEnum.LOGIN,
] as const;

function isPublicRoute(pathname: string) {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(CookieKeyEnum.ACCESS_TOKEN)?.value;
  const isPublic = isPublicRoute(pathname);

  if (!accessToken && !isPublic) {
    const res = NextResponse.redirect(new URL(RouteEnum.LOGIN, request.url));
    res.cookies.delete(CookieKeyEnum.ACCESS_TOKEN);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
