"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Crown, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";
import type { CourseCard, MyBooking, MySubscription, PublicUser } from "@/lib/types";
import { Avatar, Button, Card, CoverArt, Rating, Skeleton } from "@/components/ui";

export default function HomePage() {
  const { user, loading } = useAuth();
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);
  const [subs, setSubs] = useState<MySubscription[] | null>(null);
  const [instructors, setInstructors] = useState<PublicUser[] | null>(null);
  const [courses, setCourses] = useState<CourseCard[] | null>(null);

  useEffect(() => {
    api<PublicUser[]>("/instructors").then((r) => setInstructors(r.slice(0, 3))).catch(() => setInstructors([]));
    api<CourseCard[]>("/live-courses").then((r) => setCourses(r.slice(0, 3))).catch(() => setCourses([]));
    if (user) {
      api<MyBooking[]>("/sessions/bookings/mine?upcoming=true").then(setBookings).catch(() => setBookings([]));
      api<MySubscription[]>("/subscriptions").then(setSubs).catch(() => setSubs([]));
    }
  }, [user]);

  const next = bookings?.[0];
  const activeSubs = subs?.filter((s) => s.isActive) ?? [];

  return (
    <div className="max-w-5xl">
      <h1>{loading ? "Welcome" : user ? `Hi ${user.name.split(" ")[0]} 👋` : "Learn. Teach. Grow Together."}</h1>
      <p className="mt-1 max-w-xl text-sub">{user ? "Here's what's happening on your learning journey." : "Book 1-on-1 or group sessions with verified experts, and subscribe to live courses."}</p>

      <div className="mt-7 grid gap-5 md:grid-cols-2">
        <Link href="/marketplace">
          <Card className="flex items-center gap-5 p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-primary text-white"><CalendarDays className="h-8 w-8" /></div>
            <div className="flex-1"><div className="text-xl font-bold">Book a Session</div><div className="text-sub">Schedule 1-on-1 or group sessions with an expert.</div></div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary"><ArrowRight className="h-5 w-5" /></span>
          </Card>
        </Link>
        <Link href="/marketplace">
          <Card className="flex items-center gap-5 p-5 transition hover:-translate-y-0.5 hover:shadow-pop">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-secondary text-white"><Crown className="h-8 w-8" /></div>
            <div className="flex-1"><div className="text-xl font-bold">Join a Live Course</div><div className="text-sub">Weekly live classes, resources and priority Q&amp;A.</div></div>
            <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary-soft text-secondary"><ArrowRight className="h-5 w-5" /></span>
          </Card>
        </Link>
      </div>

      {user && (
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-center justify-between"><h3>Next session</h3><Link href="/sessions" className="text-sm font-bold text-primary">All sessions</Link></div>
            {bookings === null ? <Skeleton className="mt-3 h-16" /> : next ? (
              <div className="mt-3 flex items-center gap-3">
                <Avatar name={next.instructor.name} size={48} />
                <div><div className="font-bold">{next.session.title}</div><div className="text-sm text-sub">{fmtDateTime(next.session.startsAt)} · {next.instructor.name}</div></div>
              </div>
            ) : <p className="mt-3 text-sm text-sub">No upcoming sessions. <Link href="/marketplace" className="font-bold text-primary">Book one →</Link></p>}
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between"><h3>Active subscriptions</h3><Link href="/subscriptions" className="text-sm font-bold text-primary">Manage</Link></div>
            {subs === null ? <Skeleton className="mt-3 h-16" /> : activeSubs.length ? (
              <ul className="mt-3 space-y-2">{activeSubs.slice(0, 3).map((s) => <li key={s.id}><Link href={`/courses/${s.course.id}/space`} className="flex items-center justify-between rounded-2xl bg-primary-soft/50 px-4 py-2.5 hover:bg-primary-soft"><span className="font-semibold">{s.course.title}</span><span className="text-xs font-bold text-primary">{s.plan.name}</span></Link></li>)}</ul>
            ) : <p className="mt-3 text-sm text-sub">No active plans yet.</p>}
          </Card>
        </div>
      )}

      {user?.role === "INSTRUCTOR" && (
        <Card className="mt-5 flex flex-wrap items-center gap-4 bg-gradient-to-r from-primary to-primary-light p-5 text-white">
          <Sparkles className="h-8 w-8" /><div className="flex-1"><div className="text-lg font-bold">Instructor tools</div><div className="text-sm text-white/85">Publish availability slots and run your live courses.</div></div>
          <Link href="/instructor/availability"><Button variant="secondary" size="sm">Availability</Button></Link>
          <Link href="/instructor/courses"><Button variant="secondary" size="sm">Live courses</Button></Link>
        </Card>
      )}

      <h2 className="mb-4 mt-10">Top instructors</h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {instructors === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-36" />)}
        {instructors?.map((u) => (
          <Link key={u.id} href={`/instructors/${u.id}`}><Card className="p-5 transition hover:-translate-y-1 hover:shadow-pop">
            <Avatar name={u.name} size={56} /><div className="mt-3 font-bold">{u.name}</div><div className="text-sm text-mute">{u.headline}</div><div className="mt-1"><Rating avg={u.ratingAvg} count={u.ratingCount} size="sm" /></div>
          </Card></Link>
        ))}
      </div>

      <h2 className="mb-4 mt-10">Live courses</h2>
      <div className="grid gap-5 sm:grid-cols-3">
        {courses === null && [0, 1, 2].map((i) => <Skeleton key={i} className="h-56" />)}
        {courses?.map((c) => (
          <Link key={c.id} href={`/courses/${c.id}`}><Card className="p-4 transition hover:-translate-y-1 hover:shadow-pop">
            <CoverArt title={c.title} color={c.coverColor} skills={c.skills} className="aspect-[16/10] rounded-2xl" />
            <div className="mt-3 font-bold leading-snug">{c.title}</div>
            <div className="mt-1 text-sm font-bold text-primary">From ${c.fromPrice}/mo</div>
          </Card></Link>
        ))}
      </div>
    </div>
  );
}
