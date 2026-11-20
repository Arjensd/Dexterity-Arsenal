"use client";
import { useCallback, useEffect, useState } from "react";
import { MapPin, Trash2, Users, Video } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { fmtDate, fmtRange } from "@/lib/format";
import type { Slot } from "@/lib/types";
import { Badge, Button, Card, cx, EmptyState, inputCls, Label, Skeleton, useToast } from "@/components/ui";

const today = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); };

export default function AvailabilityPage() {
  const { ready } = useRequireAuth(["INSTRUCTOR"]);
  const toast = useToast();
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "Mentoring Session", date: today(), start: "10:00", end: "11:00", mode: "ONLINE" as "ONLINE" | "OFFLINE", format: "ONE_ON_ONE" as "ONE_ON_ONE" | "GROUP", capacity: 5, address: "", description: "" });

  const load = useCallback(() => api<Slot[]>("/sessions/slots/mine").then(setSlots).catch((e) => toast("error", e.message)), [toast]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const r = await api<Slot & { calendarSynced: boolean; calendarMode: string }>("/sessions/slots", { method: "POST", body: {
        title: f.title, description: f.description || undefined,
        startsAt: new Date(`${f.date}T${f.start}`).toISOString(), endsAt: new Date(`${f.date}T${f.end}`).toISOString(),
        mode: f.mode, format: f.format, capacity: f.format === "GROUP" ? Number(f.capacity) : undefined, address: f.mode === "OFFLINE" ? f.address : undefined } });
      toast("success", r.calendarSynced ? `Slot published & added to Google Calendar (${r.calendarMode}).` : "Slot published (calendar sync failed - will not block bookings).");
      await load();
    } catch (err) { toast("error", (err as Error).message); } finally { setBusy(false); }
  };

  const remove = async (s: Slot) => {
    const n = s.bookedCount;
    if (!confirm(n ? `${n} learner(s) booked this slot. Cancelling will notify them. Continue?` : "Delete this slot?")) return;
    try { await api(`/sessions/slots/${s.id}`, { method: "DELETE" }); toast("success", "Slot removed."); await load(); } catch (err) { toast("error", (err as Error).message); }
  };

  const Seg = ({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (v: string) => void }) => (
    <div className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1">{options.map(([v, l]) => (
      <button type="button" key={v} onClick={() => onChange(v)} aria-pressed={value === v} className={cx("rounded-full py-2 text-sm font-bold", value === v ? "bg-white text-primary shadow-sm" : "text-sub")}>{l}</button>))}</div>
  );

  return (
    <div className="grid max-w-6xl gap-8 xl:grid-cols-[400px_1fr]">
      <div>
        <h1>My Availability</h1>
        <p className="mt-1 text-sub">Learners can only book the open slots you publish. Overlaps are blocked automatically.</p>
        <Card className="mt-6 p-6">
          <form onSubmit={create} className="space-y-4">
            <div><Label>Title</Label><input className={inputCls} required minLength={2} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-3"><Label>Date</Label><input type="date" className={inputCls} required min={today()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></div>
              <div><Label>From</Label><input type="time" className={inputCls} required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></div>
              <div><Label>To</Label><input type="time" className={inputCls} required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></div>
            </div>
            <div><Label>Session type</Label><Seg value={f.mode} onChange={(v) => setF({ ...f, mode: v as typeof f.mode })} options={[["ONLINE", "Google Meet"], ["OFFLINE", "Address"]]} /></div>
            {f.mode === "OFFLINE" && <div><Label>Address</Label><input className={inputCls} required value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} placeholder="Banani Road 11, Dhaka" /></div>}
            <div><Label>Format</Label><Seg value={f.format} onChange={(v) => setF({ ...f, format: v as typeof f.format })} options={[["ONE_ON_ONE", "1-on-1"], ["GROUP", "Group"]]} /></div>
            {f.format === "GROUP" && <div><Label>Capacity</Label><input type="number" min={2} max={200} className={inputCls} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></div>}
            <div><Label>Description (optional)</Label><input className={inputCls} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <Button type="submit" size="lg" className="w-full" loading={busy}>Publish slot</Button>
          </form>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 xl:mt-[88px]">Upcoming slots</h2>
        <div className="space-y-3">
          {slots === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}
          {slots?.length === 0 && <EmptyState title="No slots published" hint="Use the form to open your first time slot." />}
          {slots?.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-center text-primary"><div><div className="text-[10px] font-bold uppercase">{new Date(s.startsAt).toLocaleDateString([], { month: "short" })}</div><div className="text-xl font-extrabold leading-none">{new Date(s.startsAt).getDate()}</div></div></div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{s.title}</div>
                  <div className="text-sm text-sub">{fmtDate(s.startsAt)} · {fmtRange(s.startsAt, s.endsAt)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    {s.mode === "ONLINE" ? <Badge tone="info"><Video className="mr-0.5 h-3 w-3" /> Google Meet</Badge> : <Badge tone="warning"><MapPin className="mr-0.5 h-3 w-3" /> {s.address}</Badge>}
                    {s.format === "GROUP" ? <Badge tone="primary" dot={false}><Users className="mr-1 h-3 w-3" /> {s.bookedCount}/{s.capacity}</Badge> : null}
                    {s.isFull ? <Badge tone="danger">Full</Badge> : s.bookedCount ? <Badge tone="success">Booked</Badge> : <Badge tone="success">Available</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(s)} aria-label="Delete slot"><Trash2 className="h-4 w-4" /></Button>
              </div>
              {s.attendees && s.attendees.length > 0 && (
                <div className="mt-3 rounded-2xl bg-surface p-3 text-sm">
                  <div className="mb-1 text-xs font-bold uppercase text-mute">Attendees</div>
                  {s.attendees.map((a) => <div key={a.id}><b>{a.name}</b> <span className="text-sub">· {a.email}{a.note ? ` · “${a.note}”` : ""}</span></div>)}
                  {s.meetLink && <a className="mt-1 inline-block font-semibold text-primary underline" href={s.meetLink} target="_blank" rel="noreferrer">{s.meetLink}</a>}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
