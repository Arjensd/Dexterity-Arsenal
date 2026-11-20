"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import type { Tier } from "@/lib/types";
import { Badge, Button, Card, CoverArt, cx, EmptyState, inputCls, Label, Skeleton, useToast } from "@/components/ui";

interface Mine { id: string; title: string; coverColor: string; skills: string[]; status: string; activeSubscribers: number; plans: { tier: Tier; price: number }[]; _count: { classes: number; resources: number } }
const COLORS = ["violet", "indigo", "fuchsia", "sky", "emerald", "amber"];
const DEFAULT_PLANS = {
  BASIC: { on: true, price: "9.99", resources: false, qa: false, features: "Weekly live classes, Class recordings" },
  PRO: { on: true, price: "14.99", resources: true, qa: false, features: "Everything in Basic, Downloadable resources" },
  MAX: { on: true, price: "24.99", resources: true, qa: true, features: "Everything in Pro, Priority Q&A" },
};

export default function InstructorCourses() {
  const { ready } = useRequireAuth(["INSTRUCTOR"]);
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<Mine[] | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ title: "", description: "", skills: "", whatYouGet: "", color: "violet" });
  const [plans, setPlans] = useState(DEFAULT_PLANS);

  const load = useCallback(() => api<Mine[]>("/live-courses/mine").then(setList).catch((e) => toast("error", e.message)), [toast]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const c = await api<{ id: string }>("/live-courses", { method: "POST", body: {
        title: f.title, description: f.description, coverColor: f.color,
        skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
        whatYouGet: f.whatYouGet.split("\n").map((s) => s.trim()).filter(Boolean),
        plans: (Object.keys(plans) as Tier[]).filter((t) => plans[t].on).map((t) => ({ tier: t, price: Number(plans[t].price), hasResources: plans[t].resources, hasPriorityQA: plans[t].qa, features: plans[t].features.split(",").map((s) => s.trim()).filter(Boolean) })) } });
      toast("success", "Course published!"); router.push(`/instructor/courses/${c.id}`);
    } catch (err) { toast("error", (err as Error).message); setBusy(false); }
  };

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1>My Live Courses</h1><p className="mt-1 text-sub">Recurring subscription courses with Basic / Pro / Max tiers.</p></div>
        <Button onClick={() => setOpen(!open)}><Plus className="h-4 w-4" /> {open ? "Close" : "New live course"}</Button></div>

      {open && (
        <Card className="pop-in mt-6 p-6">
          <form onSubmit={create} className="space-y-4">
            <div><Label>Title</Label><input className={inputCls} required minLength={3} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Full-Stack Development Course" /></div>
            <div><Label>Description</Label><textarea className={`${inputCls} min-h-[110px]`} required minLength={10} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Skills (comma separated)</Label><input className={inputCls} value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} placeholder="React, Node.js" /></div>
              <div><Label>Cover colour</Label><div className="flex gap-2 pt-1">{COLORS.map((c) => <button type="button" key={c} aria-label={c} aria-pressed={f.color === c} onClick={() => setF({ ...f, color: c })} className={cx("h-9 w-9 rounded-full ring-offset-2", f.color === c && "ring-2 ring-primary")} style={{ background: { violet: "#6C3AED", indigo: "#6366F1", fuchsia: "#c026d3", sky: "#0ea5e9", emerald: "#10b981", amber: "#f59e0b" }[c] }} />)}</div></div>
            </div>
            <div><Label>What learners get (one per line)</Label><textarea className={`${inputCls} min-h-[80px]`} value={f.whatYouGet} onChange={(e) => setF({ ...f, whatYouGet: e.target.value })} /></div>

            <div><Label>Subscription tiers</Label>
              <div className="space-y-3">{(Object.keys(plans) as Tier[]).map((t) => (
                <div key={t} className={cx("rounded-2xl border-2 p-4", plans[t].on ? "border-primary-light bg-primary-soft/30" : "border-ink-100 opacity-60")}>
                  <div className="flex flex-wrap items-center gap-4">
                    <label className="flex items-center gap-2 font-bold"><input type="checkbox" checked={plans[t].on} onChange={(e) => setPlans({ ...plans, [t]: { ...plans[t], on: e.target.checked } })} className="h-4 w-4 accent-[#6C3AED]" />{t[0] + t.slice(1).toLowerCase()} Plan</label>
                    <div className="flex items-center gap-1"><span className="font-bold">$</span><input type="number" step="0.01" min="0.5" className={`${inputCls} !w-28 !py-2`} value={plans[t].price} onChange={(e) => setPlans({ ...plans, [t]: { ...plans[t], price: e.target.value } })} /><span className="text-sm text-sub">/month</span></div>
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={plans[t].resources} onChange={(e) => setPlans({ ...plans, [t]: { ...plans[t], resources: e.target.checked } })} className="accent-[#6C3AED]" /> Resources</label>
                    <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={plans[t].qa} onChange={(e) => setPlans({ ...plans, [t]: { ...plans[t], qa: e.target.checked } })} className="accent-[#6C3AED]" /> Priority Q&amp;A</label>
                  </div>
                  <input className={`${inputCls} mt-3 !py-2 text-sm`} value={plans[t].features} onChange={(e) => setPlans({ ...plans, [t]: { ...plans[t], features: e.target.value } })} aria-label={`${t} features`} />
                </div>))}</div></div>
            <Button type="submit" size="lg" loading={busy}>Publish course</Button>
          </form>
        </Card>
      )}

      <div className="mt-8 grid gap-5 sm:grid-cols-2">
        {list === null && [0, 1].map((i) => <Skeleton key={i} className="h-40" />)}
        {list?.length === 0 && <div className="sm:col-span-2"><EmptyState title="No live courses yet" hint="Create your first course and set your tier pricing." /></div>}
        {list?.map((c) => (
          <Link key={c.id} href={`/instructor/courses/${c.id}`}><Card className="flex gap-4 p-4 transition hover:-translate-y-1 hover:shadow-pop">
            <div className="w-24 shrink-0"><CoverArt title={c.title} color={c.coverColor} className="rounded-2xl" /></div>
            <div className="min-w-0"><div className="font-bold leading-snug">{c.title}</div>
              <div className="mt-1 flex flex-wrap gap-1.5"><Badge tone="success">{c.activeSubscribers} subscribers</Badge>{c.status === "DRAFT" && <Badge tone="warning">Draft</Badge>}</div>
              <div className="mt-2 text-xs text-sub">{c._count.classes} classes · {c._count.resources} resources · {c.plans.map((p) => `$${p.price}`).join(" / ")}</div></div>
          </Card></Link>
        ))}
      </div>
    </div>
  );
}
