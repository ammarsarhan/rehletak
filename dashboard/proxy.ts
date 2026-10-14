import { NextResponse, type NextRequest } from "next/server";

// One app, two hostnames. admin.rehletak.com is served from app/admin, everything else from app/staff.
// Locally, admin.localhost:3000 and localhost:3000 do the same. Rewriting every path means /admin/* can't be
// reached from the staff hostname. This is routing only: the backend still enforces who can do what.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const section = host.startsWith("admin.") ? "admin" : "staff";

  const url = request.nextUrl.clone();
  url.pathname = `/${section}${url.pathname === "/" ? "" : url.pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
