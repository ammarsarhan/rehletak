import { NextResponse, type NextRequest } from "next/server";

// One app, two hostnames. admin.rehletak.app is served from app/admin, everything else from app/staff.
// Locally, admin.local.rehletak.app and dashboard.local.rehletak.app do the same. Rewriting every path means /admin/* can't be
// reached from the staff hostname. This is routing only: the backend still enforces who can do what.
export function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const section = host.startsWith("admin.") ? "admin" : "staff";

  const url = request.nextUrl.clone();

  // The admin side has no home page of its own, so its root (where the logo and sign in land) opens on tenants.
  if (section === "admin" && url.pathname === "/") {
    url.pathname = "/tenants";
    return NextResponse.redirect(url);
  }

  url.pathname = `/${section}${url.pathname === "/" ? "" : url.pathname}`;

  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
