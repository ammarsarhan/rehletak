"use client";

import { useAdminSession } from "@/components/admin/admin-session";

// Served at admin.rehletak.app/ (the proxy maps the admin host onto app/admin).
// A placeholder until the admin tools exist.
export default function AdminHome() {
    const { admin } = useAdminSession();

    return (
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Welcome, {admin.firstName}</h1>
            <p className="text-sm text-neutral-500">The admin tools are coming next.</p>
        </div>
    );
}
