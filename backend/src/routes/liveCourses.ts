/**
 * MODULE 2 / FEATURE 2 - Live Course Subscription Model (course side)
 *
 * Instructors define a live course with up to three recurring tiers (Basic / Pro / Max),
 * schedule live classes, upload downloadable resources and answer questions.
 * Subscribed learners get: scheduled live sessions, downloadable resources (plans with
 * hasResources) and priority Q&A (plans with hasPriorityQA).
 */
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { forbidden, notFound, parse } from "../lib/errors";
import { ok } from "../lib/http";
import { publicUser } from "../lib/util";
import { getEntitlement, syncPeriods } from "../lib/entitlement";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import { notify } from "../services/notify";
import type { PlanTier } from "../generated/prisma/client";

const r = Router();

const TIER_ORDER: Record<PlanTier, number> = { BASIC: 0, PRO: 1, MAX: 2 };
const TIER_NAME: Record<PlanTier, string> = { BASIC: "Basic Plan", PRO: "Pro Plan", MAX: "Max Plan" };

const presentPlan = (p: { id: string; tier: PlanTier; name: string; priceCents: number; currency: string; hasResources: boolean; hasPriorityQA: boolean; features: string[] }) => ({
  ...p,
  price: p.priceCents / 100,
  interval: "month" as const,
});

async function ownedCourse(courseId: string, userId: string) {
  const c = await prisma.liveCourse.findUnique({ where: { id: courseId } });
  if (!c) throw notFound("Course not found");
  if (c.instructorId !== userId) throw forbidden("This is not your course");
  return c;
}

// ───────────────────────── schemas ─────────────────────────

const planInput = z.object({
  tier: z.enum(["BASIC", "PRO", "MAX"]),
  price: z.number().positive().max(10000),
  hasResources: z.boolean().default(false),
  hasPriorityQA: z.boolean().default(false),
  features: z.array(z.string().trim().min(1)).max(12).default([]),
});

const courseInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  whatYouGet: z.array(z.string().trim().min(1)).max(20).default([]),
  faqs: z.array(z.object({ q: z.string().trim().min(1), a: z.string().trim().min(1) })).max(20).default([]),
  skills: z.array(z.string().trim().min(1)).max(12).default([]),
  coverColor: z.enum(["violet", "indigo", "fuchsia", "sky", "emerald", "amber"]).default("violet"),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("PUBLISHED"),
  plans: z.array(planInput).min(1).max(3)
    .refine((p) => new Set(p.map((x) => x.tier)).size === p.length, "Each tier can only be used once"),
});

async function upsertPlans(courseId: string, plans: z.infer<typeof planInput>[]) {
  for (const p of plans) {
    const data = {
      name: TIER_NAME[p.tier], priceCents: Math.round(p.price * 100),
      hasResources: p.hasResources, hasPriorityQA: p.hasPriorityQA, features: p.features,
    };
    await prisma.subscriptionPlan.upsert({
      where: { courseId_tier: { courseId, tier: p.tier } },
      update: data,
      create: { courseId, tier: p.tier, ...data },
    });
  }
}

// ───────────────────────── browse ─────────────────────────

r.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const courses = await prisma.liveCourse.findMany({
    where: { status: "PUBLISHED", instructor: { isVerified: true } },
    orderBy: { createdAt: "desc" },
    include: { instructor: { select: publicUser }, plans: true, _count: { select: { classes: true } } },
  });
  const list = courses
    .filter((c) => !q || [c.title, c.description, ...c.skills, c.instructor.name].some((s) => s.toLowerCase().includes(q)))
    .map((c) => ({
      id: c.id, title: c.title, description: c.description.slice(0, 180), skills: c.skills, coverColor: c.coverColor,
      instructor: c.instructor,
      fromPrice: c.plans.length ? Math.min(...c.plans.map((p) => p.priceCents)) / 100 : null,
      classCount: c._count.classes,
    }));
  ok(res, list);
});

// Instructor's own courses (must be declared before "/:id").
r.get("/mine", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  await syncPeriods();
  const courses = await prisma.liveCourse.findMany({
    where: { instructorId: req.user!.id },
    orderBy: { createdAt: "desc" },
    include: { plans: true, _count: { select: { classes: true, resources: true } } },
  });
  const active = await prisma.subscription.groupBy({
    by: ["courseId"],
    where: { course: { instructorId: req.user!.id }, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    _count: true,
  });
  ok(res, courses.map((c) => ({
    ...c, plans: c.plans.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]).map(presentPlan),
    activeSubscribers: active.find((a) => a.courseId === c.id)?._count ?? 0,
  })));
});

r.get("/:id", optionalAuth, async (req, res) => {
  const id = String(req.params.id);
  const course = await prisma.liveCourse.findUnique({
    where: { id },
    include: {
      instructor: { select: publicUser },
      plans: true,
      classes: { where: { startsAt: { gt: new Date() } }, orderBy: { startsAt: "asc" }, take: 5, select: { id: true, title: true, startsAt: true, durationMin: true } },
      _count: { select: { resources: true } },
    },
  });
  const isOwner = course?.instructorId === req.user?.id;
  if (!course || (course.status !== "PUBLISHED" && !isOwner)) throw notFound("Course not found");

  const sub = req.user ? await getEntitlement(req.user.id, id) : null;
  const subscriberCount = await prisma.subscription.count({ where: { courseId: id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } } });
  const { plans, ...rest } = course;
  ok(res, {
    ...rest,
    plans: plans.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]).map(presentPlan),
    subscriberCount,
    isOwner,
    mySubscription: sub && {
      id: sub.id, planId: sub.planId, tier: sub.plan.tier, planName: sub.plan.name,
      currentPeriodEnd: sub.currentPeriodEnd, cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    },
  });
});

// ───────────────────────── instructor: create / edit ─────────────────────────

r.post("/", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const { plans, ...data } = parse(courseInput, req.body);
  const course = await prisma.liveCourse.create({ data: { ...data, instructorId: req.user!.id } });
  await upsertPlans(course.id, plans);
  const full = await prisma.liveCourse.findUniqueOrThrow({ where: { id: course.id }, include: { plans: true } });
  ok(res, { ...full, plans: full.plans.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]).map(presentPlan) }, 201);
});

r.patch("/:id", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const id = String(req.params.id);
  await ownedCourse(id, req.user!.id);
  const { plans, ...data } = parse(courseInput.partial().extend({ plans: courseInput.shape.plans.optional() }), req.body);
  await prisma.liveCourse.update({ where: { id }, data });
  if (plans) await upsertPlans(id, plans);
  const full = await prisma.liveCourse.findUniqueOrThrow({ where: { id }, include: { plans: true } });
  ok(res, { ...full, plans: full.plans.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]).map(presentPlan) });
});

// ───────────────────────── live classes ─────────────────────────

r.post("/:id/classes", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const id = String(req.params.id);
  const course = await ownedCourse(id, req.user!.id);
  const body = parse(
    z.object({
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().max(500).optional(),
      startsAt: z.coerce.date().refine((d) => d > new Date(), "Start time must be in the future"),
      durationMin: z.number().int().min(15).max(480).default(60),
      meetingLink: z.string().url().optional(),
    }),
    req.body,
  );
  const liveClass = await prisma.liveClass.create({
    data: {
      ...body, courseId: id,
      // Default to a Jitsi room (platform video provider); Module 1/F3 can replace this generator.
      meetingLink: body.meetingLink ?? `https://meet.jit.si/DexterityArsenal-${randomBytes(5).toString("hex")}`,
    },
  });
  await syncPeriods({ courseId: id });
  const subs = await prisma.subscription.findMany({ where: { courseId: id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } }, select: { learnerId: true } });
  await Promise.all(subs.map((s) => notify(s.learnerId, "New live class scheduled", `${course.title}: "${liveClass.title}" on ${liveClass.startsAt.toUTCString()}.`)));
  ok(res, { ...liveClass, subscribersNotified: subs.length }, 201);
});

r.delete("/:id/classes/:classId", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  await ownedCourse(String(req.params.id), req.user!.id);
  const { count } = await prisma.liveClass.deleteMany({ where: { id: String(req.params.classId), courseId: String(req.params.id) } });
  if (!count) throw notFound("Class not found");
  ok(res, { deleted: true });
});

// Subscribers (and the owner) can see meeting links.
r.get("/:id/classes", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const course = await prisma.liveCourse.findUnique({ where: { id } });
  if (!course) throw notFound("Course not found");
  const isOwner = course.instructorId === req.user!.id;
  if (!isOwner && !(await getEntitlement(req.user!.id, id))) throw forbidden("Subscribe to this course to access live classes");
  const past = req.query.past === "true";
  ok(res, await prisma.liveClass.findMany({
    where: { courseId: id, startsAt: past ? { lte: new Date() } : { gt: new Date(Date.now() - 60 * 60 * 1000) } },
    orderBy: { startsAt: past ? "desc" : "asc" },
  }));
});

// ───────────────────────── downloadable resources ─────────────────────────

r.post("/:id/resources", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const id = String(req.params.id);
  await ownedCourse(id, req.user!.id);
  const body = parse(
    z.object({
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().max(300).optional(),
      fileUrl: z.string().url(),
      fileType: z.string().trim().max(20).optional(),
    }),
    req.body,
  );
  ok(res, await prisma.courseResource.create({ data: { ...body, courseId: id } }), 201);
});

r.get("/:id/resources", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const course = await prisma.liveCourse.findUnique({ where: { id } });
  if (!course) throw notFound("Course not found");
  const isOwner = course.instructorId === req.user!.id;
  const sub = isOwner ? null : await getEntitlement(req.user!.id, id);
  if (!isOwner && !sub) throw forbidden("Subscribe to this course to access resources");

  const canDownload = isOwner || sub!.plan.hasResources;
  const items = await prisma.courseResource.findMany({ where: { courseId: id }, orderBy: { createdAt: "desc" } });
  ok(res, {
    canDownload,
    upgradeHint: canDownload ? null : "Upgrade to a plan that includes downloadable resources",
    items: items.map((i) => ({ ...i, fileUrl: canDownload ? i.fileUrl : null, locked: !canDownload })),
  });
});

// ───────────────────────── Q&A (priority for Max-style plans) ─────────────────────────

r.post("/:id/questions", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const { body } = parse(z.object({ body: z.string().trim().min(5).max(1500) }), req.body);
  const course = await prisma.liveCourse.findUnique({ where: { id } });
  if (!course) throw notFound("Course not found");
  const sub = await getEntitlement(req.user!.id, id);
  if (!sub) throw forbidden("Subscribe to this course to ask questions");

  const q = await prisma.courseQuestion.create({
    data: { courseId: id, learnerId: req.user!.id, body, isPriority: sub.plan.hasPriorityQA },
  });
  await notify(course.instructorId, q.isPriority ? "Priority question" : "New question", `${req.user!.name} asked in "${course.title}".`);
  ok(res, q, 201);
});

r.get("/:id/questions", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const course = await prisma.liveCourse.findUnique({ where: { id } });
  if (!course) throw notFound("Course not found");
  const isOwner = course.instructorId === req.user!.id;
  if (!isOwner && !(await getEntitlement(req.user!.id, id))) throw forbidden("Subscribe to this course to view Q&A");

  const items = await prisma.courseQuestion.findMany({
    where: { courseId: id, ...(isOwner ? {} : { learnerId: req.user!.id }) },
    include: { learner: { select: { id: true, name: true } } },
  });
  // Instructor queue: unanswered first, then priority, then oldest.
  items.sort((a, b) =>
    Number(!!a.answeredAt) - Number(!!b.answeredAt) ||
    Number(b.isPriority) - Number(a.isPriority) ||
    a.createdAt.getTime() - b.createdAt.getTime());
  ok(res, items);
});

r.patch("/:id/questions/:qid/answer", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const id = String(req.params.id);
  await ownedCourse(id, req.user!.id);
  const { answer } = parse(z.object({ answer: z.string().trim().min(2).max(3000) }), req.body);
  const q = await prisma.courseQuestion.findFirst({ where: { id: String(req.params.qid), courseId: id } });
  if (!q) throw notFound("Question not found");
  const updated = await prisma.courseQuestion.update({ where: { id: q.id }, data: { answer, answeredAt: new Date() } });
  await notify(q.learnerId, "Your question was answered", "Your instructor replied in the course Q&A.");
  ok(res, updated);
});

// ───────────────────────── instructor: subscribers ─────────────────────────

r.get("/:id/subscribers", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const id = String(req.params.id);
  await ownedCourse(id, req.user!.id);
  await syncPeriods({ courseId: id });
  const subs = await prisma.subscription.findMany({
    where: { courseId: id, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    include: { learner: { select: { id: true, name: true, email: true } }, plan: { select: { tier: true, name: true, priceCents: true } } },
    orderBy: { createdAt: "desc" },
  });
  const mrr = subs.filter((s) => !s.cancelAtPeriodEnd).reduce((t, s) => t + s.plan.priceCents, 0) / 100;
  ok(res, { count: subs.length, monthlyRecurringRevenue: mrr, subscribers: subs.map((s) => ({
    subscriptionId: s.id, learner: s.learner, plan: s.plan.name, tier: s.plan.tier,
    renewsOrEnds: s.currentPeriodEnd, cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  })) });
});

export default r;
