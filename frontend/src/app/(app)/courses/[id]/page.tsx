"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, DollarSign, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime } from "@/lib/format";
import type { CourseDetail, Plan } from "@/lib/types";
import { Avatar, Badge, Button, Card, CoverArt, cx, EmptyState, Rating, Skeleton, SkillBadge, Tabs, useToast } from "@/components/ui";

type Tab = "about" | "get" | "faq" | "instructor";

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("about");
  const [planId, setPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api<CourseDetail>(`/live-courses/${id}`).then((c) => {
    setCourse(c);
    setPlanId((cur) => cur ?? c.mySubscription?.planId ?? c.plans.find((p) => p.tier === "PRO")?.id ?? c.plans[0]?.id ?? null);
  }).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load, user?.id]);

  if (error) return <EmptyState title="Course not found" hint={error} action={<Link href="/marketplace"><Button variant="outline">Back to marketplace</Button></Link>} />;
  if (!course) return <div className="space-y-4"><Skeleton className="h-60 w-full max-w-3xl" /><Skeleton className="h-40 w-full max-w-3xl" /></div>;

  const sub = course.mySubscription;
  const selected = course.plans.find((p) => p.id === planId) ?? null;
  const sameAsCurrent = !!sub && selected?.id === sub.planId;

  const proceed = async () => {
    if (!selected) return;
    if (!user) return router.push(`/login?next=/courses/${id}`);
    setBusy(true);
    try {
      if (sub && sameAsCurrent) return router.push(`/courses/${id}/space`);
      if (sub) {
        await api(`/subscriptions/${sub.id}/plan`, { method: "PATCH", body: { planId: selected.id } });
        toast("success", `You're now on the ${selected.name}.`);
        await load();
      } else {
        const r = await api<{ checkout: { mode: "mock" | "stripe"; url: string }; subscriptionId: string }>("/subscriptions/checkout", { method: "POST", body: { planId: selected.id } });
        if (r.checkout.mode === "stripe") window.location.href = r.checkout.url;
        else router.push(`/checkout/${r.subscriptionId}`);
      }
    } catch (e) { toast("error", (e as Error).message); }
    finally { setBusy(false); }
  };

  const cta = !user ? "Sign in to subscribe" : course.isOwner ? "This is your course" : sub ? (sameAsCurrent ? "Open course space" : `Switch to ${selected?.name}`) : "Proceed to Payment";

  return (
    <div className="grid gap-x-10 gap-y-8 xl:grid-cols-[1fr_330px]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-start gap-7">
          <div className="w-[190px] shrink-0 sm:w-[220px]"><CoverArt title={course.title} color={course.coverColor} skills={course.skills} /></div>
          <div className="min-w-0 flex-1 pt-2">
            <h1 className="max-w-md text-[30px] leading-[1.15] sm:text-[36px]">{course.title}</h1>
            <div className="mt-3 text-[15px] font-medium text-mute">Tutored By</div>
            <Link href={`/instructors/${course.instructor.id}`} className="mt-1.5 flex items-center gap-3 rounded-2xl hover:opacity-80">
              <Avatar name={course.instructor.name} size={52} />
              <div>
                <div className="font-bold">{course.instructor.name}</div>
                <div className="text-xs font-semibold text-mute">{course.instructor.headline}</div>
                <Rating avg={course.instructor.ratingAvg} count={course.instructor.ratingCount} size="sm" />
              </div>
            </Link>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="success">{course.subscriberCount} active subscribers</Badge>
              {course.status === "DRAFT" && <Badge tone="warning">Draft - not public</Badge>}
            </div>
          </div>
        </div>

        <div className="mt-8">
          <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "about", label: "About the course" }, { id: "get", label: "What you’ll get" }, { id: "faq", label: "FAQs" }, { id: "instructor", label: "About the Instructor" }]} />
          <div className="max-w-3xl pt-5 text-[17px] leading-[1.7] text-ink-900/90">
            {tab === "about" && (
              <>
                <p>{course.description}</p>
                {course.classes.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-3 text-base">Upcoming live classes</h3>
                    <ul className="space-y-2">
                      {course.classes.map((c) => (
                        <li key={c.id} className="flex items-center justify-between rounded-2xl bg-primary-soft/60 px-4 py-3 text-[15px]">
                          <span className="font-semibold">{c.title}</span><span className="text-sub">{fmtDateTime(c.startsAt)} · {c.durationMin} min</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
            {tab === "get" && (
              <ul className="space-y-3">
                {course.whatYouGet.length === 0 && <li className="text-sub">The instructor hasn&apos;t listed details yet.</li>}
                {course.whatYouGet.map((g) => <li key={g} className="flex gap-3"><Check className="mt-1.5 h-5 w-5 shrink-0 text-primary" />{g}</li>)}
              </ul>
            )}
            {tab === "faq" && (
              <div className="space-y-5">
                {course.faqs.length === 0 && <p className="text-sub">No FAQs yet.</p>}
                {course.faqs.map((f) => <div key={f.q}><div className="font-bold">{f.q}</div><p className="text-sub">{f.a}</p></div>)}
              </div>
            )}
            {tab === "instructor" && (
              <div className="flex gap-4"><Avatar name={course.instructor.name} size={64} /><div><div className="text-lg font-bold">{course.instructor.name}</div><p className="text-sub">{course.instructor.bio ?? "—"}</p>
                <Link href={`/instructors/${course.instructor.id}`} className="mt-2 inline-block font-bold text-primary">Book a 1-on-1 session →</Link></div></div>
            )}
          </div>
        </div>
      </div>

      {/* ── right rail: skills + plans ── */}
      <aside className="xl:border-l xl:border-ink-100 xl:pl-8">
        <div className="space-y-3.5">{course.skills.map((s) => <SkillBadge key={s} name={s} />)}</div>

        {sub && (
          <div className="mt-6 rounded-2xl bg-success/10 p-4 text-sm">
            <div className="font-bold text-[#15803d]">You&apos;re on the {sub.planName}</div>
            <div className="text-ink-700">{sub.cancelAtPeriodEnd ? "Ends" : "Renews"} {fmtDate(sub.currentPeriodEnd)}</div>
          </div>
        )}

        <div className="mt-6 space-y-3.5" role="radiogroup" aria-label="Subscription plans">
          {course.plans.map((p) => <PlanCard key={p.id} plan={p} selected={p.id === planId} current={p.id === sub?.planId} onSelect={() => setPlanId(p.id)} />)}
          {course.plans.length === 0 && <p className="text-sm text-sub">No plans available.</p>}
        </div>

        {selected && (
          <ul className="mt-4 space-y-1.5 rounded-2xl bg-surface p-4 text-[13px] text-ink-700">
            {selected.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>)}
            {!selected.hasResources && <li className="flex gap-2 text-mute"><Lock className="mt-0.5 h-4 w-4 shrink-0" />Downloadable resources (Pro &amp; up)</li>}
            {!selected.hasPriorityQA && <li className="flex gap-2 text-mute"><Lock className="mt-0.5 h-4 w-4 shrink-0" />Priority Q&amp;A (Max)</li>}
          </ul>
        )}

        <button onClick={proceed} disabled={busy || !selected || course.isOwner}
          className="mt-6 flex w-full items-center gap-4 rounded-full p-1 text-left transition disabled:opacity-50">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-primary text-white shadow-[0_10px_24px_-8px_rgb(108_58_237/0.9)]">
            {busy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <ArrowRight className="h-7 w-7" />}
          </span>
          <span className="text-[20px] font-bold leading-tight">{cta}</span>
        </button>
      </aside>
    </div>
  );
}

function PlanCard({ plan, selected, current, onSelect }: { plan: Plan; selected: boolean; current: boolean; onSelect: () => void }) {
  const [a, b] = plan.name.split(" ");
  return (
    <button role="radio" aria-checked={selected} onClick={onSelect}
      className={cx("relative flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left transition",
        selected ? "border-primary bg-primary text-white shadow-[0_14px_30px_-12px_rgb(108_58_237/0.85)]" : "border-ink-300 bg-white text-ink-700 hover:border-primary-light")}>
      <span className="text-[22px] font-bold leading-[1.1]">{a}<br />{b}</span>
      <span className={cx("ml-auto grid h-11 w-11 place-items-center rounded-full border-2", selected ? "border-white bg-white text-primary" : "border-ink-500/70")}><DollarSign className="h-5 w-5" strokeWidth={2.6} /></span>
      <span className="flex items-baseline">
        <span className="text-[30px] font-extrabold tabular-nums">{plan.price.toFixed(2)}</span>
        <span className={cx("ml-0.5 text-[12px] font-semibold", selected ? "text-white/85" : "text-sub")}>/month</span>
      </span>
      {current && <span className="absolute -top-2.5 right-4 rounded-full bg-success px-2.5 py-0.5 text-[10px] font-bold uppercase text-white">Current</span>}
    </button>
  );
}

