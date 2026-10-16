import type { Metadata } from "next";
import Header from "@/components/admin/Header";

export const metadata: Metadata = {
    title: "Staff",
};

// Served at admin.rehletak.app/staff. Blank until the staff tools are built.
export default function AdminStaff() {
    return <Header title="Staff" description="Browse staff accounts across every tenant, see which company each belongs to, and review the access they've been given." />;
}
