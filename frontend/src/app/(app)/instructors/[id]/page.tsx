"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarCheck, CheckCheck, MapPin, Users, Video } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { dateKey, fmtDateLong, fmtRange, timeZone } from "@/lib/format";
import type { InstructorDetail, Slot } from "@/lib/types";
import { Avatar, Badge, Button, Card, cx, EmptyState, Rating, Skeleton, SkillBadge, useToast } from "@/components/ui";
import { Calendar } from "@/components/Calendar";

type ModeFilter = "ALL" | "ONLINE" | "OFFLINE";

export default function InstructorBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();

  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [mode, setMode] = useState<ModeFilter>("ALL");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState<Slot | null>(null);

  const loadSlots = useCallback(async () => {
    const to = new Date(Date.now() + 120 * 86_400_000).toISOString();
    setSlots(await api<Slot[]>(`/sessions/slots?instructorId=${id}&to=${to}`));
  }, [id]);

  useEffect(() => {
    api<InstructorDetail>(`/instructors/${id}`).then(setInstructor).catch((e) => setError(e.message));
    loadSlots().catch((e) => setError(e.message));
  }, [id, loadSlots, user?.id]);

  const filtered = useMemo(() => (slots ?? []).filter((s) => mode === "ALL" || s.mode === mode), [slots, mode]);
  const marked = useMemo(() => new Set(filtered.map((s) => dateKey(s.startsAt))), [filtered]);

  // Jump to the first date that has slots.
  useEffect(() => {
    if (!slots || selectedDate) return;
    const first = slots[0];
    if (first) { setSelectedDate(dateKey(first.startsAt)); setMonth(new Date(first.startsAt)); }
  }, [slots, selectedDate]);

  // Keep the selection valid when the filter changes.
  useEffect(() => {
    if (selectedDate && !marked.has(selectedDate)) {
      const next = [...marked].sort()[0] ?? null;
      setSelectedDate(next);
      if (next) setMonth(new Date(`${next}T12:00:00`));
    }
    setSlotId(null);
  }, [marked, selectedDate]);

  const daySlots = filtered.filter((s) => dateKey(s.startsAt) === selectedDate);
  const picked = daySlots.find((s) => s.id === slotId) ?? null;
  const isMe = user?.id === id;

  const book = async () => {
    if (!picked) return;
    setBusy(true);
    try {
      const r = await api<{ session: Slot }>(`/sessions/slots/${picked.id}/book`, { method: "POST", body: { note: note || undefined } });
      setConfirmed(r.session);
      toast("success", "Booking confirmed! It's on your calendar.");
      setSlotId(null); setNote("");
      await loadSlots();
    } catch (e) {
      toast("error", (e as Error).message);
      await loadSlots(); // someone else may have taken it - refresh live availability
    } finally { setBusy(false); }
  };

  if (error) return <EmptyState title="We couldn't load this profile" hint={error} action={<Link href="/marketplace"><Button variant="outline">Back to marketplace</Button></Link>} />;

  return (
    <div className="min-w-0">
      <div className="grid gap-x-10 gap-y-6 lg:grid-cols-[1fr_260px]">
        {/* ── profile header ── */}
        <div className="min-w-0">
        {instructor ? (
          <div className="flex flex-wrap items-center gap-6">
            <Avatar name={instructor.name} size={120} className="shadow-pop" />
            <div>
              <h1 className="text-[34px] leading-tight sm:text-[40px]">{instructor.name}</h1>
              <div className="text-xl font-semibold text-mute">{instructor.headline}</div>
              <div className="mt-2"><Rating avg={instructor.ratingAvg} count={instructor.ratingCount} /></div>
            </div>
          </div>
        ) : <Skeleton className="h-[120px] w-full max-w-lg" />}

        {instructor?.bio && <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-sub">{instructor.bio}</p>}
        </div>

        {/* ── skills (right of header, with divider - as in the design) ── */}
        <aside className="lg:border-l lg:border-ink-100 lg:pl-8">
          <div className="space-y-3.5">{instructor?.skills.map((s) => <SkillBadge key={s} name={s} />)}</div>
        </aside>
      </div>

        {/* ── booking widget ── */}
        <div className="mt-8">
          <div className="grid gap-x-10 gap-y-8 lg:grid-cols-[340px_1fr]">
          <div>
            {slots === null ? <Skeleton className="h-[330px] w-full max-w-[360px]" /> : (
              <Calendar month={month} onMonthChange={setMonth} selected={selectedDate} onSelect={(k) => { setSelectedDate(k); setSlotId(null); setConfirmed(null); }} marked={marked} />
            )}
            <p className="mt-3 text-xs text-sub">Times shown in your timezone ({timeZone()}).</p>
          </div>

          <div className="min-w-0">
            {slots === null ? <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full max-w-[300px]" />)}</div>
              : slots.length === 0 ? <EmptyState title="No open slots right now" hint="This instructor hasn't published availability yet. Check back soon." />
              : (
                <div className="grid gap-x-8 gap-y-6 md:grid-cols-[230px_minmax(0,300px)]">
                  {/* time pills */}
                  <div>
                    <div className="mb-3 text-sm font-semibold text-sub">{selectedDate ? fmtDateLong(`${selectedDate}T12:00:00`) : "Pick a date"}</div>
                    <ul className="space-y-3" aria-label="Available time slots">
                      {daySlots.map((s) => {
                        const unavailable = !s.available;
                        const on = s.id === slotId;
                        return (
                          <li key={s.id}>
                            <button disabled={unavailable} aria-pressed={on} onClick={() => { setSlotId(s.id); setConfirmed(null); }}
                              className={cx("flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-2xl border-2 px-4 py-3.5 text-left text-[15px] font-semibold transition",
                                on ? "border-primary bg-primary text-white shadow-[0_10px_24px_-10px_rgb(108_58_237/0.9)]"
                                  : unavailable ? "cursor-not-allowed border-ink-100 bg-ink-100/60 text-mute"
                                  : "border-ink-300 bg-white hover:border-primary hover:text-primary")}>
                              <span>{fmtRange(s.startsAt, s.endsAt)}</span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                {s.mode === "ONLINE" ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                                {unavailable && <span className="text-[11px] font-bold uppercase">{s.bookedByMe ? "Booked" : s.isFull ? "Full" : ""}</span>}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {selectedDate && daySlots.length === 0 && <li className="text-sm text-sub">No slots for this filter on this day.</li>}
                    </ul>
                  </div>

                  {/* session type + confirm */}
                  <div>
                    <h2 className="mb-4 text-[28px]">Session Type</h2>
                    <div className="flex flex-col gap-3">
                      <TypeChip active={mode === "ONLINE"} onClick={() => setMode(mode === "ONLINE" ? "ALL" : "ONLINE")} icon={<MeetIcon />} label="Google Meet" />
                      <TypeChip active={mode === "OFFLINE"} onClick={() => setMode(mode === "OFFLINE" ? "ALL" : "OFFLINE")} icon={<MapPin className="h-5 w-5 text-[#db2777]" />} label="Address" />
                    </div>

                    {picked && (
                      <div className="pop-in mt-5 rounded-3xl bg-primary-soft/70 p-4 text-sm">
                        <div className="font-bold text-ink-900">{picked.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sub">
                          {picked.format === "GROUP" ? <Badge tone="info"><Users className="mr-0.5 h-3 w-3" /> Group · {picked.spotsLeft} of {picked.capacity} spots left</Badge> : <Badge tone="success">1-on-1</Badge>}
                          {picked.mode === "OFFLINE" && picked.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{picked.address}</span>}
                          {picked.mode === "ONLINE" && <span>Meet link is shared after booking</span>}
                        </div>
                        {picked.description && <p className="mt-2 text-sub">{picked.description}</p>}
                        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} aria-label="Note for the instructor"
                          placeholder="What would you like to cover? (optional)" className="mt-3 w-full rounded-2xl border border-ink-300/60 bg-white px-4 py-2.5 text-sm focus:border-primary focus:outline-none" />
                      </div>
                    )}

                    <div className="mt-5">
                      {!user ? (
                        <Link href={`/login?next=/instructors/${id}`}><Button size="lg" className="w-full">Sign in to book</Button></Link>
                      ) : isMe ? (
                        <p className="rounded-2xl bg-muted px-4 py-3 text-sm text-sub">This is your own profile. <Link href="/instructor/availability" className="font-bold text-primary">Manage availability</Link></p>
                      ) : (
                        <Button size="lg" className="h-14 w-full text-[17px]" disabled={!picked} loading={busy} onClick={book}>
                          <CalendarCheck className="h-5 w-5" /> Confirm Booking <CheckCheck className="h-5 w-5" />
                        </Button>
                      )}
                    </div>

                    {confirmed && (
                      <div role="status" className="pop-in mt-5 rounded-3xl border border-success/30 bg-success/10 p-4 text-sm">
                        <div className="font-bold text-[#15803d]">You&apos;re booked for {fmtDateLong(confirmed.startsAt)}, {fmtRange(confirmed.startsAt, confirmed.endsAt)}.</div>
                        {confirmed.meetLink && <a href={confirmed.meetLink} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold text-primary underline">{confirmed.meetLink}</a>}
                        {confirmed.address && <div className="mt-1 text-ink-700">Location: {confirmed.address}</div>}
                        <div className="mt-2"><Link href="/sessions" className="font-bold text-primary">View my sessions →</Link></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
          </div>
          </div>
        </div>


      {instructor && instructor.liveCourses.length > 0 && (
        <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-6">
          <span className="text-sm font-bold uppercase tracking-wide text-sub">Also teaches live courses:</span>
          {instructor.liveCourses.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`} className="rounded-full bg-primary-soft px-4 py-2 text-sm font-semibold text-primary hover:bg-primary-light/40">
              {c.title}{c.fromPrice != null && <span className="ml-2 font-medium text-sub">from ${c.fromPrice}/mo</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeChip({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} aria-pressed={active}
      className={cx("flex items-center gap-3 rounded-2xl border-2 px-5 py-3 text-[17px] font-semibold transition w-full",
        active ? "border-primary bg-primary-soft text-primary" : "border-ink-300 bg-white hover:border-primary-light")}>
      {icon} {label}
    </button>
  );
}

const MeetIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
    <rect x="2" y="6" width="12" height="12" rx="2" fill="#00832d" />
    <path d="M14 10l6-4v12l-6-4z" fill="#0066da" />
    <path d="M2 6h6l-6 6z" fill="#ea4335" opacity=".9" /><path d="M2 18h6l-6-6z" fill="#2684fc" opacity=".9" />
  </svg>
);
