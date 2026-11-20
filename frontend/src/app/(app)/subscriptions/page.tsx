"use client";
import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { fmtDate, money } from "@/lib/format";
import type { MySubscription } from "@/lib/types";
import { Badge, Button, Card, CoverArt, EmptyState, Progress, Skeleton, useToast } from "@/components/ui";

function Inner() {
  const { ready } = useRequireAuth();
  const toast = useToast();
  const success = useSearchParams().get("success");
  const [subs, setSubs] = useState<MySubscription[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => api<MySubscription[]>("/subscriptions").then(setSubs).catch((e) => toast("error", e.message)), [toast]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const act = async (s: MySubscription, action: "cancel" | "resume") => {
    setBusy(s.id);
    try {
      await api(`/subscriptions/${s.id}/${action}`, { method: "POST" });
      toast("success", action === "cancel" ? `Cancelled. You keep access until ${fmtDate(s.currentPeriodEnd!)}.` : "Subscription resumed.");
      await load();
    } catch (e) { toast("error", (e as Error).message); } finally { setBusy(null); }
  };

  const active = subs?.filter((s) => s.isActive) ?? [];
  const ended = subs?.filter((s) => !s.isActive) ?? [];

  return (
    <div className="max-w-4xl">
      <h1>My Subscriptions</h1>
      <p className="mt-1 text-sub">Live course plans you&apos;re subscribed to.</p>
      {success && <div role="status" className="pop-in mt-5 rounded-2xl bg-success/10 px-5 py-4 font-semibold text-[#15803d]">🎉 Payment received - your subscription is active.</div>}

      <div className="mt-7 space-y-5">
        {subs === null && [0, 1].map((i) => <Skeleton key={i} className="h-40 w-full" />)}
        {subs && active.length === 0 && <EmptyState title="No active subscriptions" hint="Subscribe to a live course for weekly live classes, resources and priority Q&A." action={<Link href="/marketplace"><Button>Browse live courses</Button></Link>} />}
        {active.map((s) => {
          const elapsed = 30 - s.daysLeft;
          return (
            <Card key={s.id} className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
              <div className="w-28 shrink-0"><CoverArt title={s.course.title} color={s.course.coverColor} className="rounded-2xl" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-xl">{s.course.title}</h3>
                  {s.state === "CANCELING" ? <Badge tone="warning">Cancels {fmtDate(s.currentPeriodEnd!)}</Badge> : <Badge tone="success">Active</Badge>}
                </div>
                <div className="mt-1 text-sub"><b className="text-primary">{s.plan.name}</b> · {money(s.plan.price)}/month</div>
                <div className="mt-3 max-w-sm">
                  <Progress value={(Math.max(elapsed, 1) / 30) * 100} />
                  <div className="mt-1.5 text-xs text-sub">{s.daysLeft} days left · {s.state === "CANCELING" ? "ends" : "renews"} {fmtDate(s.currentPeriodEnd!)}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:w-44 sm:flex-col">
                <Link href={`/courses/${s.course.id}/space`}><Button size="sm" className="w-full">Open course space</Button></Link>
                <Link href={`/courses/${s.course.id}`}><Button size="sm" variant="outline" className="w-full">Change plan</Button></Link>
                {s.state === "CANCELING"
                  ? <Button size="sm" variant="secondary" loading={busy === s.id} onClick={() => act(s, "resume")}>Resume</Button>
                  : <Button size="sm" variant="ghost" loading={busy === s.id} onClick={() => act(s, "cancel")}>Cancel plan</Button>}
              </div>
            </Card>
          );
        })}
      </div>

      {ended.length > 0 && (
        <div className="mt-10">
          <h3 className="mb-3 text-sub">Past subscriptions</h3>
          <div className="space-y-2">{ended.map((s) => (
            <div key={s.id} className="flex items-center justify-between rounded-2xl bg-surface px-5 py-3 text-sm">
              <span className="font-semibold">{s.course.title} · {s.plan.name}</span><Badge tone="neutral">Ended</Badge>
            </div>))}</div>
        </div>
      )}
    </div>
  );
}

export default function SubscriptionsPage() { return <Suspense><Inner /></Suspense>; }
