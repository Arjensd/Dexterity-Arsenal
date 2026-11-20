"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, CalendarDays, CalendarPlus, Crown, Home, LogOut, Search, Store, Repeat, GraduationCap } from "lucide-react";
import { Logo } from "./Logo";
import { Avatar, Badge, Button, cx } from "./ui";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { relative } from "@/lib/format";
import type { Notification } from "@/lib/types";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/marketplace", label: "Market Place", icon: Store },
  { href: "/sessions", label: "Sessions", icon: CalendarDays },
  { href: "/subscriptions", label: "Subscriptions", icon: Crown },
];
const INSTRUCTOR_NAV = [
  { href: "/instructor/availability", label: "My Availability", icon: CalendarPlus },
  { href: "/instructor/courses", label: "My Live Courses", icon: GraduationCap },
];

function useOutside(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [close]);
  return ref;
}

function Bell_() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; items: Notification[] }>({ unread: 0, items: [] });
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(close);

  const load = useCallback(() => { if (user) api<typeof data>("/notifications").then(setData).catch(() => {}); }, [user]);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const toggle = async () => {
    const next = !open; setOpen(next);
    if (next) { load(); if (data.unread) { await api("/notifications/read-all", { method: "POST" }); setData((d) => ({ ...d, unread: 0 })); } }
  };
  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} aria-label="Notifications" className="relative grid h-11 w-11 place-items-center rounded-full hover:bg-white/60">
        <Bell className="h-6 w-6 text-ink-900" />
        {data.unread > 0 && <span className="absolute right-1.5 top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="pop-in absolute right-0 top-14 z-50 w-[340px] rounded-3xl bg-white p-3 shadow-pop ring-1 ring-black/5">
          <div className="px-3 pb-2 pt-1 text-sm font-bold">Notifications</div>
          <div className="max-h-[360px] overflow-y-auto">
            {data.items.length === 0 && <p className="px-3 py-6 text-center text-sm text-sub">You&apos;re all caught up.</p>}
            {data.items.map((n) => (
              <div key={n.id} className="rounded-2xl px-3 py-2.5 hover:bg-surface">
                <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{n.title}</span><span className="text-[11px] text-mute">{relative(n.createdAt)}</span></div>
                <p className="mt-0.5 text-[13px] leading-snug text-sub">{n.body}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout, switchRole } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(close);
  if (!user) return <Link href="/login"><Button size="sm">Sign in</Button></Link>;
  const other = user.role === "INSTRUCTOR" ? "LEARNER" : "INSTRUCTOR";
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-label="Account menu" className="rounded-full"><Avatar name={user.name} size={46} /></button>
      {open && (
        <div className="pop-in absolute right-0 top-14 z-50 w-72 rounded-3xl bg-white p-3 shadow-pop ring-1 ring-black/5">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user.name} size={44} />
            <div className="min-w-0"><div className="truncate font-bold">{user.name}</div><div className="truncate text-xs text-sub">{user.email}</div></div>
          </div>
          <div className="px-2 pb-2"><Badge tone={user.role === "INSTRUCTOR" ? "primary" : "info"}>{user.role === "INSTRUCTOR" ? "Instructor" : user.role === "ADMIN" ? "Admin" : "Learner"}</Badge></div>
          {user.role !== "ADMIN" && (
            <button onClick={async () => { await switchRole(other); setOpen(false); router.push("/"); }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold hover:bg-primary-soft">
              <Repeat className="h-4 w-4 text-primary" /> Switch to {other === "INSTRUCTOR" ? "Instructor" : "Learner"}
            </button>
          )}
          <button onClick={() => { logout(); setOpen(false); router.push("/login"); }}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold text-danger hover:bg-danger/10">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const items = user?.role === "INSTRUCTOR" ? [...NAV, ...INSTRUCTOR_NAV] : NAV;
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href) || (href === "/marketplace" && (path.startsWith("/instructors") || path.startsWith("/courses"))));

  return (
    <div className="min-h-screen p-3 sm:p-6">
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1440px] flex-col overflow-hidden rounded-[36px] bg-white shadow-[0_30px_80px_-30px_rgb(108_58_237/0.35)]">
        {/* decorative hills from the design */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[420px] overflow-hidden">
          <div className="absolute -left-[12%] bottom-[-80%] h-[640px] w-[52%] rounded-full bg-gradient-to-b from-primary-light/80 to-[#ddd2ff]" />
          <div className="absolute left-[34%] bottom-[-84%] h-[620px] w-[56%] rounded-full bg-gradient-to-b from-primary-light/70 to-[#e3dbff]" />
          <div className="absolute -right-[6%] bottom-[-78%] h-[420px] w-[32%] rounded-full bg-gradient-to-b from-primary-light/60 to-[#ebe5ff]" />
        </div>

        <header className="relative z-30 flex items-center gap-4 px-6 py-5 lg:px-10">
          <Link href="/" className="shrink-0"><Logo size={42} /></Link>
          <form onSubmit={(e) => { e.preventDefault(); router.push(`/marketplace${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`); }}
            className="mx-auto hidden w-full max-w-[640px] items-center gap-3 rounded-full bg-ink-100 px-6 py-3.5 md:flex">
            <Search className="h-5 w-5 text-mute" />
            <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search" placeholder="Search for teachers, freelancers, courses…"
              className="w-full bg-transparent text-[15px] text-ink-900 placeholder:text-mute focus:outline-none" />
          </form>
          <div className="ml-auto flex items-center gap-3 md:ml-0">
            {user && <Bell_ />}
            <UserMenu />
          </div>
        </header>

        <div className="relative z-10 flex flex-1 flex-col gap-2 px-4 pb-24 sm:px-6 lg:flex-row lg:px-10">
          <nav aria-label="Main" className="lg:w-[250px] lg:shrink-0 lg:pt-12">
            <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-2">
              {items.map(({ href, label, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} aria-current={active(href) ? "page" : undefined}
                    className={cx("flex items-center gap-4 whitespace-nowrap rounded-2xl px-5 py-3.5 text-[17px] font-bold transition",
                      active(href) ? "bg-primary-light/60 text-primary" : "text-ink-900 hover:bg-primary-soft")}>
                    <Icon className="h-6 w-6" strokeWidth={2.2} /> {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <main className="min-w-0 flex-1 lg:pl-4 lg:pt-6">{children}</main>
        </div>
      </div>
    </div>
  );
}


