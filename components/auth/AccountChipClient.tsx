"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleMark } from "@/components/auth/GoogleMark";

type Props = {
  learnerName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

export function AccountChipClient({ learnerName, email, avatarUrl }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const signedIn = Boolean(learnerName || email);

  function onGoogle() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const origin = window.location.origin;
      const next = pathname.startsWith("/") ? pathname : "/";
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) setError(oauthError.message);
    });
  }

  function onSignOut() {
    startTransition(async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.refresh();
    });
  }

  if (signedIn) {
    return (
      <div className="flex items-center gap-2">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 rounded-full border border-white/15"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs font-semibold">
            {(learnerName || email || "?").slice(0, 1).toUpperCase()}
          </div>
        )}
        <button
          type="button"
          onClick={onSignOut}
          disabled={pending}
          className="text-[12px] text-white/45 transition hover:text-white/80 disabled:opacity-50"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        onClick={onGoogle}
        disabled={pending}
        className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1f1f1f] transition hover:bg-white/90 disabled:opacity-50"
      >
        <GoogleMark size={14} />
        {pending ? "…" : "Sign in"}
      </button>
      {error ? (
        <p className="mt-1 max-w-[180px] text-right text-[11px] text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
