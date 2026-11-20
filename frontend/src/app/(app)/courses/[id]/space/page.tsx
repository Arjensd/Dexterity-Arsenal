"use client";
import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileText, Lock, Radio, Send, Star, Video } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { fmtDate, fmtDateTime, relative } from "@/lib/format";
import type { CourseDetail, LiveClass, Question, Resource } from "@/lib/types";
import { Badge, Button, Card, EmptyState, inputCls, Skeleton, Tabs, useToast } from "@/components/ui";

type Tab = "classes" | "resources" | "qa";

export default function CourseSpace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready } = useRequireAuth();
  const toast = useToast();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [tab, setTab] = useState<Tab>("classes");
  const [classes, setClasses] = useState<LiveClass[] | null>(null);
  const [res, setRes] = useState<{ canDownload: boolean; upgradeHint: string | null; items: Resource[] } | null>(null);
  const [qs, setQs] = useState<Question[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState("");

  const load = useCallback(async () => {
    try {
      const c = await api<CourseDetail>(`/live-courses/${id}`); setCourse(c);
      const [a, b, d] = await Promise.all([
        api<LiveClass[]>(`/live-courses/${id}/classes`),
        api<typeof res>(`/live-courses/${id}/resources`),
        api<Question[]>(`/live-courses/${id}/questions`),
      ]);
      setClasses(a); setRes(b); setQs(d);
    } catch (e) { setDenied((e as Error).message); }
  }, [id]);
  useEffect(() => { if (ready) load(); }, [ready, load]);

  const ask = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      const q = await api<Question>(`/live-courses/${id}/questions`, { method: "POST", body: { body: text } });
      toast("success", q.isPriority ? "Question sent with priority ⭐" : "Question sent to your instructor.");
      setText(""); setQs(await api<Question[]>(`/live-courses/${id}/questions`));
    } catch (err) { toast("error", (err as Error).message); } finally { setBusy(false); }
  };

  if (denied) return <EmptyState title="Subscribe to unlock the course space" hint={denied} action={<Link href={`/courses/${id}`}><Button>View plans</Button></Link>} />;
  if (!course) return <Skeleton className="h-64 w-full max-w-3xl" />;
  const sub = course.mySubscription;
  const next = classes?.[0];
  const soon = next && new Date(next.startsAt).getTime() - Date.now() < 15 * 60_000;

  return (
    <div className="max-w-4xl">
      <Link href={`/courses/${id}`} className="text-sm font-semibold text-primary">← {course.title}</Link>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1>Course space</h1>
        {sub && <Badge tone="primary">{sub.planName}</Badge>}
        {course.isOwner && <Badge tone="info">Instructor preview</Badge>}
      </div>

      {next && (
        <Card className="mt-6 flex flex-wrap items-center gap-4 bg-gradient-to-r from-primary to-primary-light p-6 text-white">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20"><Radio className="h-7 w-7" /></div>
          <div className="min-w-0 flex-1"><div className="text-xs font-bold uppercase tracking-wide text-white/80">Next live class · {relative(next.startsAt)}</div>
            <div className="text-xl font-bold">{next.title}</div><div className="text-sm text-white/85">{fmtDateTime(next.startsAt)} · {next.durationMin} min</div></div>
          <a href={next.meetingLink} target="_blank" rel="noreferrer"><Button variant="secondary" className={soon ? "" : "opacity-90"}><Video className="h-4 w-4" /> {soon ? "Join now" : "Open link"}</Button></a>
        </Card>
      )}

      <div className="mt-7">
        <Tabs<Tab> value={tab} onChange={setTab} tabs={[{ id: "classes", label: "Live classes" }, { id: "resources", label: "Resources" }, { id: "qa", label: "Q&A" }]} />
        <div className="pt-5">
          {tab === "classes" && (classes === null ? <Skeleton className="h-24" /> : classes.length === 0 ? <EmptyState title="No classes scheduled yet" hint="You'll be notified when your instructor schedules the next one." /> : (
            <ul className="space-y-3">{classes.map((c) => (
              <li key={c.id}><Card className="flex flex-wrap items-center gap-4 p-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary-soft text-center text-primary"><div><div className="text-[10px] font-bold uppercase">{new Date(c.startsAt).toLocaleDateString([], { month: "short" })}</div><div className="text-lg font-extrabold leading-none">{new Date(c.startsAt).getDate()}</div></div></div>
                <div className="min-w-0 flex-1"><div className="font-bold">{c.title}</div><div className="text-sm text-sub">{fmtDateTime(c.startsAt)} · {c.durationMin} min</div></div>
                <a href={c.meetingLink} target="_blank" rel="noreferrer"><Button size="sm" variant="outline">Join link</Button></a>
              </Card></li>))}</ul>
          ))}

          {tab === "resources" && (res === null ? <Skeleton className="h-24" /> : (
            <>
              {!res.canDownload && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warning/10 px-5 py-4">
                  <span className="text-sm font-semibold text-[#b45309]"><Lock className="mr-1.5 inline h-4 w-4" />{res.upgradeHint}</span>
                  <Link href={`/courses/${id}`}><Button size="sm">Upgrade plan</Button></Link>
                </div>
              )}
              {res.items.length === 0 ? <EmptyState title="No resources yet" /> : (
                <ul className="space-y-3">{res.items.map((r) => (
                  <li key={r.id}><Card className="flex items-center gap-4 p-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-secondary-soft text-secondary"><FileText className="h-6 w-6" /></div>
                    <div className="min-w-0 flex-1"><div className="font-bold">{r.title}</div><div className="text-xs uppercase text-mute">{r.fileType ?? "file"}</div></div>
                    {r.locked ? <Badge tone="neutral" dot={false}><Lock className="mr-1 h-3 w-3" /> Pro or Max</Badge>
                      : <a href={r.fileUrl!} target="_blank" rel="noreferrer"><Button size="sm" variant="secondary"><Download className="h-4 w-4" /> Download</Button></a>}
                  </Card></li>))}</ul>
              )}
            </>
          ))}

          {tab === "qa" && (
            <>
              <form onSubmit={ask} className="mb-5 space-y-3">
                <textarea className={`${inputCls} min-h-[96px] resize-y`} required minLength={5} maxLength={1500} value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask your instructor a question…" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-sub">{sub?.tier === "MAX" ? "⭐ Your questions are answered with priority" : "Upgrade to Max for priority answers"}</span>
                  <Button type="submit" size="sm" loading={busy}><Send className="h-4 w-4" /> Ask</Button>
                </div>
              </form>
              {qs === null ? <Skeleton className="h-24" /> : qs.length === 0 ? <EmptyState title="No questions yet" /> : (
                <ul className="space-y-3">{qs.map((q) => (
                  <li key={q.id}><Card className="p-5">
                    <div className="flex items-start justify-between gap-3"><p className="font-semibold">{q.body}</p>{q.isPriority && <Badge tone="warning"><Star className="mr-0.5 h-3 w-3" /> Priority</Badge>}</div>
                    <div className="mt-1 text-xs text-mute">{q.learner.name} · {fmtDate(q.createdAt)}</div>
                    {q.answer ? <div className="mt-3 rounded-2xl bg-primary-soft/60 p-4 text-sm"><b className="text-primary">Instructor:</b> {q.answer}</div> : <div className="mt-3"><Badge tone="neutral">Awaiting answer</Badge></div>}
                  </Card></li>))}</ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
