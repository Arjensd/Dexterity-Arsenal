"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import type { CourseDetail, LiveClass, Question, Resource } from "@/lib/types";
import { Badge, Button, Card, EmptyState, inputCls, Label, Skeleton, Tabs, useToast } from "@/components/ui";

type Tab = "classes" | "resources" | "qa" | "subs";
interface Subs { count: number; monthlyRecurringRevenue: number; subscribers: { subscriptionId: string; learner: { name: string; email: string }; plan: string; renewsOrEnds: string; cancelAtPeriodEnd: boolean }[] }

export default function ManageCourse({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready } = useRequireAuth(["INSTRUCTOR"]);
  const toast = useToast();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [tab, setTab] = useState<Tab>("classes");
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const [res, setRes] = useState<{ items: Resource[] } | null>(null);
  const [qs, setQs] = useState<Question[] | null>(null);
  const [subs, setSubs] = useState<Subs | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [cf, setCf] = useState({ title: "", date: "", time: "20:00", dur: 60 });
  const [rf, setRf] = useState({ title: "", fileUrl: "" });

  const load = useCallback(async () => {
    try {
      setCourse(await api<CourseDetail>(`/live-courses/${id}`));
      const [a, b, c, d] = await Promise.all([
        api<LiveClass[]>(`/live-courses/${id}/classes`), api<{ items: Resource[] }>(`/live-courses/${id}/resources`),
        api<Question[]>(`/live-courses/${id}/questions`), api<Subs>(`/live-courses/${id}/subscribers`)]);
      setClasses(a); setRes(b); setQs(c); setSubs(d);
    } catch (e) { toast("error", (e as Error).message); }
  }, [id, toast]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => { try { await fn(); toast("success", ok); await load(); } catch (e) { toast("error", (e as Error).message); } };

  if (!course) return <Skeleton className="h-64 max-w-3xl" />;
  const unanswered = qs?.filter((q) => !q.answeredAt).length ?? 0;

  return (
    <div className="max-w-5xl">
      <Link href="/instructor/courses" className="text-sm font-semibold text-primary">← My live courses</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3"><h1>{course.title}</h1><Link href={`/courses/${id}`}><Badge tone="primary">View public page</Badge></Link></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><div className="text-sm text-sub">Active subscribers</div><div className="text-3xl font-extrabold">{subs?.count ?? "–"}</div></Card>
        <Card className="p-5"><div className="text-sm text-sub">Monthly recurring revenue</div><div className="text-3xl font-extrabold text-primary">{subs ? money(subs.monthlyRecurringRevenue) : "–"}</div></Card>
        <Card className="p-5"><div className="text-sm text-sub">Unanswered questions</div><div className="text-3xl font-extrabold">{unanswered}</div></Card>
      </div>

      <div className="mt-7"><Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "classes", label: "Live classes" }, { id: "resources", label: "Resources" }, { id: "qa", label: `Q&A${unanswered ? ` (${unanswered})` : ""}` }, { id: "subs", label: "Subscribers" }]} /></div>
      <div className="pt-5">
        {tab === "classes" && (<>
          <Card className="p-5"><form className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_1fr_90px_auto]" onSubmit={(e) => { e.preventDefault();
            run(() => api(`/live-courses/${id}/classes`, { method: "POST", body: { title: cf.title, startsAt: new Date(`${cf.date}T${cf.time}`).toISOString(), durationMin: Number(cf.dur) } }), "Class scheduled - subscribers notified."); setCf({ ...cf, title: "" }); }}>
            <div><Label>Title</Label><input className={inputCls} required value={cf.title} onChange={(e) => setCf({ ...cf, title: e.target.value })} /></div>
            <div><Label>Date</Label><input type="date" className={inputCls} required value={cf.date} onChange={(e) => setCf({ ...cf, date: e.target.value })} /></div>
            <div><Label>Time</Label><input type="time" className={inputCls} required value={cf.time} onChange={(e) => setCf({ ...cf, time: e.target.value })} /></div>
            <div><Label>Min</Label><input type="number" min={15} className={inputCls} value={cf.dur} onChange={(e) => setCf({ ...cf, dur: Number(e.target.value) })} /></div>
            <Button type="submit">Schedule</Button></form>
            <p className="mt-2 text-xs text-sub">A Jitsi Meet room link is generated automatically.</p></Card>
          <ul className="mt-4 space-y-3">{classes?.length === 0 && <EmptyState title="No upcoming classes" />}{classes?.map((c) => (
            <li key={c.id}><Card className="flex items-center gap-4 p-4"><div className="min-w-0 flex-1"><div className="font-bold">{c.title}</div><div className="text-sm text-sub">{fmtDateTime(c.startsAt)} · {c.durationMin} min</div><a className="text-xs font-semibold text-primary underline" href={c.meetingLink} target="_blank" rel="noreferrer">{c.meetingLink}</a></div>
              <Button variant="ghost" size="sm" aria-label="Delete class" onClick={() => run(() => api(`/live-courses/${id}/classes/${c.id}`, { method: "DELETE" }), "Class removed.")}><Trash2 className="h-4 w-4" /></Button></Card></li>))}</ul></>)}

        {tab === "resources" && (<>
          <Card className="p-5"><form className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]" onSubmit={(e) => { e.preventDefault(); run(() => api(`/live-courses/${id}/resources`, { method: "POST", body: { title: rf.title, fileUrl: rf.fileUrl } }), "Resource added."); setRf({ title: "", fileUrl: "" }); }}>
            <div><Label>Title</Label><input className={inputCls} required value={rf.title} onChange={(e) => setRf({ ...rf, title: e.target.value })} /></div>
            <div><Label>File URL</Label><input type="url" className={inputCls} required value={rf.fileUrl} onChange={(e) => setRf({ ...rf, fileUrl: e.target.value })} placeholder="https://…" /></div>
            <Button type="submit">Add</Button></form>
            <p className="mt-2 text-xs text-sub">Only plans with “downloadable resources” can open these links.</p></Card>
          <ul className="mt-4 space-y-3">{res?.items.length === 0 && <EmptyState title="No resources yet" />}{res?.items.map((r) => <li key={r.id}><Card className="p-4"><div className="font-bold">{r.title}</div><div className="truncate text-sm text-sub">{r.fileUrl}</div></Card></li>)}</ul></>)}

        {tab === "qa" && (qs?.length === 0 ? <EmptyState title="No questions yet" /> : (
          <ul className="space-y-3">{qs?.map((q) => (
            <li key={q.id}><Card className="p-5"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{q.body}</p>{q.isPriority && <Badge tone="warning"><Star className="mr-0.5 h-3 w-3" /> Priority</Badge>}</div>
              <div className="mt-1 text-xs text-mute">{q.learner.name} · {fmtDate(q.createdAt)}</div>
              {q.answer ? <div className="mt-3 rounded-2xl bg-primary-soft/60 p-4 text-sm"><b className="text-primary">Your answer:</b> {q.answer}</div> : (
                <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => api(`/live-courses/${id}/questions/${q.id}/answer`, { method: "PATCH", body: { answer: answers[q.id] } }), "Answer sent."); }}>
                  <input className={inputCls} required minLength={2} value={answers[q.id] ?? ""} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} placeholder="Type your answer…" /><Button type="submit">Reply</Button></form>)}
            </Card></li>))}</ul>))}

        {tab === "subs" && (subs?.count === 0 ? <EmptyState title="No subscribers yet" /> : (
          <Card className="overflow-x-auto p-2"><table className="w-full text-left text-sm"><thead><tr className="text-xs uppercase text-mute"><th className="p-3">Learner</th><th className="p-3">Plan</th><th className="p-3">Renews / ends</th></tr></thead>
            <tbody>{subs?.subscribers.map((s) => <tr key={s.subscriptionId} className="border-t border-ink-100"><td className="p-3"><b>{s.learner.name}</b><div className="text-xs text-sub">{s.learner.email}</div></td><td className="p-3">{s.plan}</td><td className="p-3">{fmtDate(s.renewsOrEnds)} {s.cancelAtPeriodEnd && <Badge tone="warning">Cancelling</Badge>}</td></tr>)}</tbody></table></Card>))}
      </div>
    </div>
  );
}
