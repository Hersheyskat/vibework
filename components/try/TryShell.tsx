import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  roleBar?: string;
  headerRight?: ReactNode;
  /** When set, shows the workplace rail (play mode). */
  rail?: ReactNode;
  children: ReactNode;
};

export function TryShell({
  roleBar = "Vibe check any job",
  headerRight,
  rail,
  children,
}: Props) {
  return (
    <div className={rail ? "app" : "app solo"}>
      <header className="app-header">
        <Link href="/" className="logo">
          vibe<span>work</span> <span className="trytag">TRY</span>
        </Link>
        <div className="role">{roleBar}</div>
        <div className="hdr-r">{headerRight}</div>
      </header>
      {rail}
      <main className="pane-host">{children}</main>
    </div>
  );
}
