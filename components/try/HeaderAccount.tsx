"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleSignInButton } from "@/components/try/GoogleSignInButton";

type Props = {
  signedIn: boolean;
  label: string | null;
};

export function HeaderAccount({ signedIn, label }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return <GoogleSignInButton className="reset" label="Sign in" next="/" />;
  }

  return (
    <>
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
        onClick={() => {
          startTransition(async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            router.refresh();
          });
        }}
      >
        {pending ? "…" : "Sign out"}
      </button>
    </>
  );
}
