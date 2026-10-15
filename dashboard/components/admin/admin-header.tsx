"use client";

import { useState } from "react";
import Logo from "@/components/ui/logo";
import Button from "@/components/ui/button";
import { useAdminSession } from "./admin-session";

export default function AdminHeader() {
    const { admin, signOut } = useAdminSession();
    const [signingOut, setSigningOut] = useState(false);

    return (
        <header className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4 sm:px-10">
            <div className="flex items-center gap-2.5">
                <Logo />
                <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">Admin</span>
            </div>
            <div className="flex items-center gap-4">
                <div className="hidden flex-col items-end text-sm sm:flex">
                    <span className="font-medium text-neutral-900">{admin.firstName} {admin.lastName}</span>
                    <span className="text-xs text-neutral-500">{admin.email}</span>
                </div>
                <Button variant="secondary" loading={signingOut} onClick={() => { setSigningOut(true); signOut(); }}>Sign out</Button>
            </div>
        </header>
    );
}
