"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "@/components/try/GoogleSignInButton";

type Props = {
  signedIn: boolean;
  label: string | null;
  /** Server-computed; never trust a client-only flag for data access. */
  isAdmin?: boolean;
};

export function HeaderAccount({ signedIn, label, isAdmin = false }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!signedIn) {
    return <GoogleSignInButton className="reset" label="Sign in" next="/" />;
  }

  function signOut() {
    setOpen(false);
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.refresh();
    });
  }

  return (
    <div className="relative flex items-center">
      {/* Desktop: ≥901px */}
      <div className="hidden min-[901px]:flex items-center gap-2">
        {isAdmin ? (
          <Link
            href="/admin/runs"
            className="reset admin-nav"
            aria-current={pathname?.startsWith("/admin") ? "page" : undefined}
          >
            Admin
          </Link>
        ) : null}
        <Link
          href="/me"
          className="reset"
          aria-current={pathname === "/me" ? "page" : undefined}
        >
          My days
        </Link>
        <span className="clock" title={label ?? undefined}>
          {label ?? "Signed in"}
        </span>
        <button
          type="button"
          className="reset"
          disabled={pending}
          onClick={signOut}
        >
          {pending ? "…" : "Sign out"}
        </button>
      </div>

      {/* Mobile / tablet: ≤900px — hamburger only */}
      <div className="flex min-[901px]:hidden items-center">
        <button
          type="button"
          className={`hdr-burger${open ? " open" : ""}`}
          aria-expanded={open}
          aria-controls={menuId}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        {open ? (
          <button
            type="button"
            className="hdr-backdrop"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        ) : null}
        <div
          id={menuId}
          className={`hdr-drawer${open ? " open" : ""}`}
          role="menu"
        >
          {label ? <div className="hdr-drawer-user">{label}</div> : null}
          {isAdmin ? (
            <Link
              href="/admin/runs"
              className="hdr-drawer-item"
              role="menuitem"
              onClick={() => setOpen(false)}
            >
              Admin
            </Link>
          ) : null}
          <Link
            href="/me"
            className="hdr-drawer-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            My days
          </Link>
          <Link
            href="/"
            className="hdr-drawer-item"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>
          <button
            type="button"
            className="hdr-drawer-item danger"
            role="menuitem"
            disabled={pending}
            onClick={signOut}
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}
