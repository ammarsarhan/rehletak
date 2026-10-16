import { Suspense } from "react";
import type { Metadata } from "next";
import Logs from "@/components/admin/logs/Logs";

export const metadata: Metadata = {
    title: "Tenant audit logs",
};

// Served at admin.rehletak.app/logs/tenant: only the events that touched a tenant.
export default function AdminTenantLogs() {
    // Logs reads its filters from the URL, so it renders in the browser once the URL is known.
    return <Suspense><Logs scope="tenant"/></Suspense>;
}
