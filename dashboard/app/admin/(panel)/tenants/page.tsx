import type { Metadata } from "next";
import Header from "@/components/admin/Header";

export const metadata: Metadata = {
    title: "Tenants",
};

// Served at admin.rehletak.app/tenants. Blank until the tenants tools are built.
export default function AdminTenants() {
    return <Header title="Tenants" description="Create and manage the companies running on Rehletak, and send each one the invitation for its first staff account." />;
}
