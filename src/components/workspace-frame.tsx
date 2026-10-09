"use client";

import {
  Clapperboard,
  GitBranch,
  LayoutDashboard,
  Rows3,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

type WorkspacePage = "booking" | "schema" | "database";

const navigation = [
  { id: "booking" as const, label: "Cinema Booking", href: "/", icon: LayoutDashboard },
  { id: "schema" as const, label: "Schema Design", href: "/schema", icon: GitBranch },
  { id: "database" as const, label: "Database Explorer", href: "/database", icon: Rows3 },
];

export function WorkspaceFrame({ page, children }: { page: WorkspacePage; children: React.ReactNode }) {
  const [connection, setConnection] = useState<"checking" | "connected" | "offline">("checking");

  useEffect(() => {
    let active = true;
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => { if (active) setConnection(result.status === "ok" ? "connected" : "offline"); })
      .catch(() => { if (active) setConnection("offline"); });
    return () => { active = false; };
  }, []);

  return (
    <div className={`cinema-shell ${page === "booking" ? "cinema-shell-home" : ""}`}>
      <header className="topbar">
        <Link className="brand-lockup" href="/" aria-label="Cinema database home">
          <span className="brand-mark"><Clapperboard size={18} /></span>
          <span className="brand-type">cinema<span>/</span>db</span>
        </Link>
        {page === "booking" ? <>
          <div className="header-context"><span>YOUR CINEMA</span><span>FILMS · SHOWTIMES · SEATS</span></div>
          <nav className="top-nav" aria-label="Main navigation">
            <Link className="top-nav-link" href="/#movies"><Clapperboard size={15} /><span>Now Showing</span></Link>
            <Link className="top-nav-link" href="/schema"><GitBranch size={15} /><span>Schema</span></Link>
            <Link className="top-nav-link" href="/database"><Rows3 size={15} /><span>Database Explorer</span></Link>
          </nav>
        </> : <>
          <div className="header-context"><span>DATABASE FIELDNOTES</span><span>MYSQL / CINEMA BOOKING SYSTEM</span></div>
          <nav className="top-nav" aria-label="Main navigation">
            {navigation.map(({ id, label, href, icon: Icon }) => (
              <Link key={id} className="top-nav-link" href={href} aria-current={page === id ? "page" : undefined}>
                <Icon size={15} /><span>{label}</span>
              </Link>
            ))}
          </nav>
        </>}
        <div className={`db-status ${connection === "offline" ? "db-offline" : ""}`} role="status" aria-live="polite">
          <span className="status-dot" />
          <span>{connection === "connected" ? "MYSQL CONNECTED" : connection === "checking" ? "CHECKING MYSQL" : "MYSQL OFFLINE"}</span>
          <span className="status-separator">·</span><span>{connection === "connected" ? "LIVE DATA" : "NO LIVE DATA"}</span>
        </div>
      </header>
      <main className="workspace-main">{children}</main>
    </div>
  );
}
