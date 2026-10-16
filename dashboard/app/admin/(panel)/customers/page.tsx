import type { Metadata } from "next";
import Header from "@/components/admin/Header";

export const metadata: Metadata = {
    title: "Customers",
};

// Served at admin.rehletak.app/customers. Blank until the customers tools are built.
export default function AdminCustomers() {
    return <Header title="Customers" description="Search for customers across every tenant by name, email or phone, and see which companies they've travelled with." />;
}
