import type { Metadata } from "next";
import { AdminSession } from "@/components/admin/admin-session";
import AdminHeader from "@/components/admin/admin-header";

// Every signed in admin page lives in this group, so each one is guarded by AdminSession without having to remember to.
export const metadata: Metadata = {
    title: "Admin",
    // Nothing behind the admin area belongs in search results.
    robots: {
        index: false,
        follow: false,
    },
};

export default function AdminPanelLayout({ children }: LayoutProps<"/admin">) {
    return (
        <AdminSession>
            <div className="flex min-h-screen flex-col">
                <AdminHeader />
                <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col p-6 sm:p-10">{children}</main>
            </div>
        </AdminSession>
    );
}
