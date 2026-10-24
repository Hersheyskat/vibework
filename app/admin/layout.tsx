import type { Metadata } from "next";
import { Suspense } from "react";
import { TryShell } from "@/components/try/TryShell";
import { HeaderAccount } from "@/components/try/HeaderAccount";
import { getHeaderSession } from "@/lib/auth/header-session";
import "./admin.css";

export const metadata: Metadata = {
  title: "Admin · VibeWork Try",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <TryShell
      roleBar="Admin"
      headerRight={
        <Suspense fallback={<span className="clock">…</span>}>
          <AdminHeaderSlot />
        </Suspense>
      }
    >
      {children}
    </TryShell>
  );
}

async function AdminHeaderSlot() {
  const s = await getHeaderSession();
  return (
    <HeaderAccount
      signedIn={s.signedIn}
      label={s.label}
      isAdmin={s.isAdmin}
    />
  );
}
