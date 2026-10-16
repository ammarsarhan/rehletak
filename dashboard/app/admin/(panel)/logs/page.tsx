import type { Metadata } from "next";
import Header from "@/components/admin/Header";

export const metadata: Metadata = {
    title: "Audit logs",
};

// Served at admin.rehletak.app/audit-logs. Blank until the audit-logs tools are built.
export default function AdminAuditLogs() {
    return <Header title="Audit logs" description="A permanent, read-only record of every action taken by or on an admin, including who did it and when." />;
}
