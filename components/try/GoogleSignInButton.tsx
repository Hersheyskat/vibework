"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { GoogleMark } from "@/components/auth/GoogleMark";

type Props = {
  next?: string;
  label?: string;
  className?: string;
};

export function GoogleSignInButton({
  next = "/",
  label = "Continue with Google",
  className = "btn google",
}: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onClick() {
    setError(null);
    startTransition(async () => {
      const supabase = createClient();
      const origin = window.location.origin;
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (oauthError) setError(oauthError.message);
    });
  }

  return (
    <div>
      <button
        type="button"
        className={className}
        onClick={onClick}
        disabled={pending}
      >
        <GoogleMark />
        {pending ? "Redirecting…" : label}
      </button>
      {error ? <p className="note">{error}</p> : null}
    </div>
  );
}
