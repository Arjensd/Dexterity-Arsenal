"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { CourseCard, PublicUser } from "@/lib/types";
import { Avatar, Card, CoverArt, EmptyState, Rating, Skeleton, Tabs } from "@/components/ui";

function Inner() {
  const q = useSearchParams().get("q") ?? "";
  const [tab, setTab] = useState<"instructors" | "courses">("instructors");
  const [instructors, setInstructors] = useState<PublicUser[] | null>(null);
  const [courses, setCourses] = useState<CourseCard[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setInstructors(null); setCourses(null); setError("");
    const qs = q ? `?q=${encodeURIComponent(q)}` : "";
    api<PublicUser[]>(`/instructors${qs}`).then(setInstructors).catch((e) => setError(e.message));
    api<CourseCard[]>(`/live-courses${qs}`).then(setCourses).catch((e) => setError(e.message));
  }, [q]);

  return (
    <div>
      <h1>Market Place</h1>
      <p className="mt-1 text-sub">{q ? <>Results for “<b>{q}</b>”</> : "Book a session with a verified expert or subscribe to a live course."}</p>
      <div className="mt-6 max-w-sm"><Tabs value={tab} onChange={setTab} tabs={[{ id: "instructors", label: `Instructors${instructors ? ` (${instructors.length})` : ""}` }, { id: "courses", label: `Live courses${courses ? ` (${courses.length})` : ""}` }]} /></div>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#b91c1c]">{error}</p>}

      {tab === "instructors" && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          {instructors === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-52" />)}
          {instructors?.length === 0 && <div className="sm:col-span-2"><EmptyState title="No instructors match" hint="Try a different skill or name." /></div>}
          {instructors?.map((u) => (
            <Link key={u.id} href={`/instructors/${u.id}`}>
              <Card className="h-full p-5 transition hover:-translate-y-1 hover:shadow-pop">
                <div className="flex items-center gap-4">
                  <Avatar name={u.name} size={64} />
                  <div className="min-w-0"><div className="truncate text-lg font-bold">{u.name}</div><div className="truncate text-sm font-semibold text-mute">{u.headline}</div><Rating avg={u.ratingAvg} count={u.ratingCount} size="sm" /></div>
                </div>
                <div className="mt-4 flex flex-wrap gap-1.5">{u.skills.slice(0, 5).map((s) => <span key={s} className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">{s}</span>)}</div>
                <div className="mt-4 text-sm font-bold text-primary">Book a session →</div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {tab === "courses" && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 2xl:grid-cols-3">
          {courses === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-72" />)}
          {courses?.length === 0 && <div className="sm:col-span-2"><EmptyState title="No live courses match" /></div>}
          {courses?.map((c) => (
            <Link key={c.id} href={`/courses/${c.id}`}>
              <Card className="h-full overflow-hidden p-4 transition hover:-translate-y-1 hover:shadow-pop">
                <CoverArt title={c.title} color={c.coverColor} skills={c.skills} className="aspect-[16/10] rounded-2xl" />
                <h3 className="mt-4 leading-snug">{c.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-sm text-sub"><Avatar name={c.instructor.name} size={22} /> {c.instructor.name}</div>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm text-sub">{c.classCount} live classes</span>
                  {c.fromPrice != null && <span className="font-extrabold text-primary">From ${c.fromPrice}<span className="text-xs font-semibold text-sub">/mo</span></span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MarketplacePage() { return <Suspense><Inner /></Suspense>; }
