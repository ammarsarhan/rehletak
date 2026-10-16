import { Suspense } from "react";
import type { Metadata } from "next";
import Logs from "@/components/admin/logs/Logs";

export const metadata: Metadata = {
    title: "Audit logs",
};

// Served at admin.rehletak.app/logs: platform events.
export default function AdminLogs() {
    // Logs reads its filters from the URL, so it renders in the browser once the URL is known.
    return <Suspense><Logs scope="platform"/></Suspense>;
}
