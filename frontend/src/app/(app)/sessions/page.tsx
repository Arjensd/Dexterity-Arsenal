"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Video } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { fmtDateLong, fmtRange, relative } from "@/lib/format";
import type { MyBooking } from "@/lib/types";
import { Avatar, Badge, Button, Card, EmptyState, Skeleton, Tabs, useToast } from "@/components/ui";

export default function SessionsPage() {
  const { ready } = useRequireAuth();
  const toast = useToast();
  const [items, setItems] = useState<MyBooking[] | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api<MyBooking[]>("/sessions/bookings/mine").then(setItems).catch((e) => toast("error", e.message)), [toast]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const cancel = async (b: MyBooking) => {
    if (!confirm(`Cancel "${b.session.title}"? The spot will be released.`)) return;
    setBusy(b.id);
    try { await api(`/sessions/bookings/${b.id}/cancel`, { method: "PATCH" }); toast("success", "Booking cancelled."); await load(); }
    catch (e) { toast("error", (e as Error).message); } finally { setBusy(null); }
  };

  const now = Date.now();
  const list = (items ?? []).filter((b) => (tab === "upcoming" ? new Date(b.session.endsAt).getTime() > now : new Date(b.session.endsAt).getTime() <= now));
  if (tab === "past") list.reverse();

  return (
    <div className="max-w-4xl">
      <h1>My Sessions</h1>
      <p className="mt-1 text-sub">Sessions you&apos;ve booked with instructors.</p>
      <div className="mt-6"><Tabs value={tab} onChange={setTab} tabs={[{ id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past" }]} /></div>

      <div className="mt-6 space-y-4">
        {items === null && [0, 1].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        {items && list.length === 0 && <EmptyState title={tab === "upcoming" ? "Nothing booked yet" : "No past sessions"} hint="Find an instructor and pick a time that works for you." action={<Link href="/marketplace"><Button>Find an instructor</Button></Link>} />}
        {list.map((b) => {
          const s = b.session, started = new Date(s.startsAt).getTime() <= now && tab === "upcoming";
          return (
            <Card key={b.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                <div className="text-center"><div className="text-[11px] font-bold uppercase">{new Date(s.startsAt).toLocaleDateString([], { month: "short" })}</div><div className="text-2xl font-extrabold leading-none">{new Date(s.startsAt).getDate()}</div></div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><h3>{s.title}</h3>
                  {started ? <Badge tone="primary">Live</Badge> : tab === "upcoming" ? <Badge tone="warning">Upcoming · {relative(s.startsAt)}</Badge> : <Badge tone="neutral">Completed</Badge>}
                </div>
                <div className="mt-0.5 text-sm text-sub">{fmtDateLong(s.startsAt)} · {fmtRange(s.startsAt, s.endsAt)}</div>
                <Link href={`/instructors/${b.instructor.id}`} className="mt-2 flex items-center gap-2 text-sm font-semibold hover:text-primary"><Avatar name={b.instructor.name} size={26} /> {b.instructor.name}</Link>
                <div className="mt-2 text-sm">
                  {s.mode === "ONLINE" ? <a className="inline-flex items-center gap-1.5 font-semibold text-primary underline" href={s.meetLink ?? "#"} target="_blank" rel="noreferrer"><Video className="h-4 w-4" /> {s.meetLink}</a>
                    : <span className="inline-flex items-center gap-1.5 font-semibold text-ink-700"><MapPin className="h-4 w-4 text-[#db2777]" /> {s.address}</span>}
                </div>
              </div>
              {tab === "upcoming" && !started && <Button variant="danger" size="sm" loading={busy === b.id} onClick={() => cancel(b)}>Cancel</Button>}
              {started && s.meetLink && <a href={s.meetLink} target="_blank" rel="noreferrer"><Button size="sm">Join</Button></a>}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
