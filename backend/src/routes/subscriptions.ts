/**
 * MODULE 2 / FEATURE 2 - Live Course Subscription Model (learner billing side)
 *
 *   POST  /checkout            pick a plan  -> PENDING subscription + checkout URL
 *   POST  /:id/confirm-mock    mock payment -> ACTIVE (30-day period)       [mock mode only]
 *   GET   /mine                my subscriptions with computed state
 *   PATCH /:id/plan            upgrade / downgrade                          [mock mode only]
 *   POST  /:id/cancel          cancel at period end (access kept until then)
 *   POST  /:id/resume          undo a pending cancellation
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, forbidden, HttpError, notFound, parse } from "../lib/errors";
import { ok } from "../lib/http";
import { addMonths, advisoryLock } from "../lib/util";
import { getEntitlement, syncPeriods } from "../lib/entitlement";
import { requireAuth } from "../middleware/auth";
import { createCheckout, paymentMode, setStripeCancelAtPeriodEnd, stripe } from "../services/payment";
import { notify } from "../services/notify";
import { env } from "../config/env";
import type { Subscription, SubscriptionPlan, LiveCourse } from "../generated/prisma/client";

const r = Router();

type SubFull = Subscription & { plan: SubscriptionPlan; course: LiveCourse };

function presentSub(s: SubFull) {
  const now = Date.now();
  const end = s.currentPeriodEnd?.getTime() ?? 0;
  const isActive = s.status === "ACTIVE" && end > now;
  return {
    id: s.id, status: s.status, isActive,
    state: s.status === "PENDING" ? "PENDING" : !isActive ? "ENDED" : s.cancelAtPeriodEnd ? "CANCELING" : "ACTIVE",
    currentPeriodStart: s.currentPeriodStart, currentPeriodEnd: s.currentPeriodEnd,
    daysLeft: isActive ? Math.ceil((end - now) / 86_400_000) : 0,
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    plan: { id: s.plan.id, tier: s.plan.tier, name: s.plan.name, price: s.plan.priceCents / 100, currency: s.plan.currency, hasResources: s.plan.hasResources, hasPriorityQA: s.plan.hasPriorityQA },
    course: { id: s.course.id, title: s.course.title, coverColor: s.course.coverColor },
  };
}

const include = { plan: true, course: true } as const;

async function ownSub(req: Request) {
  const sub = await prisma.subscription.findUnique({ where: { id: String(req.params.id) }, include });
  if (!sub) throw notFound("Subscription not found");
  if (sub.learnerId !== req.user!.id) throw forbidden("This is not your subscription");
  return sub;
}

// ───────────────────────── Stripe webhook (mounted with a raw body in app.ts) ─────────────────────────

export async function stripeWebhook(req: Request, res: Response) {
  if (paymentMode() !== "stripe") return res.status(400).json({ success: false, error: { message: "Stripe is not configured" } });
  let event;
  try {
    event = stripe().webhooks.constructEvent(req.body, String(req.headers["stripe-signature"]), env.stripe.webhookSecret);
  } catch (e) {
    return res.status(400).json({ success: false, error: { message: `Webhook signature failed: ${(e as Error).message}` } });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object;
    const subId = s.metadata?.subscriptionId;
    if (subId && typeof s.subscription === "string") {
      const stripeSub = await stripe().subscriptions.retrieve(s.subscription);
      const sub = await prisma.subscription.update({
        where: { id: subId },
        data: {
          status: "ACTIVE", stripeSubscriptionId: stripeSub.id,
          currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
          currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        },
        include,
      });
      await notify(sub.learnerId, "Subscription active", `Welcome to ${sub.course.title} (${sub.plan.name}).`);
      await notify(sub.course.instructorId, "New subscriber", `Someone subscribed to "${sub.course.title}" (${sub.plan.name}).`);
    }
  } else if (event.type === "invoice.paid") {
    const inv = event.data.object;
    if (typeof inv.subscription === "string") {
      const stripeSub = await stripe().subscriptions.retrieve(inv.subscription);
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: stripeSub.id },
        data: { status: "ACTIVE", currentPeriodStart: new Date(stripeSub.current_period_start * 1000), currentPeriodEnd: new Date(stripeSub.current_period_end * 1000) },
      });
    }
  } else if (event.type === "customer.subscription.deleted") {
    await prisma.subscription.updateMany({ where: { stripeSubscriptionId: event.data.object.id }, data: { status: "CANCELLED" } });
  }
  res.json({ received: true });
}

// ───────────────────────── learner routes ─────────────────────────

r.use(requireAuth);

r.get("/payment-mode", (_req, res) => ok(res, { mode: paymentMode() }));

r.post("/checkout", async (req, res) => {
  const { planId } = parse(z.object({ planId: z.string().uuid() }), req.body);
  const me = req.user!;
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId }, include: { course: true } });
  if (!plan || plan.course.status !== "PUBLISHED") throw notFound("Plan not found");
  if (plan.course.instructorId === me.id) throw badRequest("You cannot subscribe to your own course");

  const sub = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `user:${me.id}`);
    await syncPeriods({ learnerId: me.id, courseId: plan.courseId });
    const active = await tx.subscription.findFirst({
      where: { learnerId: me.id, courseId: plan.courseId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    });
    if (active) throw conflict("You already have an active subscription to this course - use change-plan instead");
    // Abandon any earlier unpaid attempt.
    await tx.subscription.updateMany({ where: { learnerId: me.id, courseId: plan.courseId, status: "PENDING" }, data: { status: "CANCELLED" } });
    return tx.subscription.create({ data: { learnerId: me.id, courseId: plan.courseId, planId } });
  });

  const email = (await prisma.user.findUniqueOrThrow({ where: { id: me.id } })).email;
  try {
    const checkout = await createCheckout({
      subscriptionId: sub.id, courseId: plan.courseId, courseTitle: plan.course.title,
      planName: plan.name, priceCents: plan.priceCents, currency: plan.currency, learnerEmail: email,
    });
    if (checkout.sessionId) await prisma.subscription.update({ where: { id: sub.id }, data: { stripeCheckoutSessionId: checkout.sessionId } });
    ok(res, {
      subscriptionId: sub.id,
      checkout: { mode: checkout.mode, url: checkout.url },
      summary: { course: plan.course.title, plan: plan.name, price: plan.priceCents / 100, currency: plan.currency, interval: "month" },
    }, 201);
  } catch (e) {
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "CANCELLED" } });
    throw new HttpError(502, `Payment provider error: ${(e as Error).message}`);
  }
});

// Used by the mock checkout page to show what is being bought.
r.get("/:id", async (req, res) => ok(res, presentSub(await ownSub(req))));

r.post("/:id/confirm-mock", async (req, res) => {
  if (paymentMode() !== "mock") throw badRequest("Mock payments are disabled while Stripe is configured");
  const { cardNumber } = parse(z.object({ cardNumber: z.string().optional() }), req.body ?? {});
  const sub = await ownSub(req);
  if (sub.status === "ACTIVE") throw conflict("Subscription is already active");
  if (sub.status !== "PENDING") throw conflict("This checkout has expired - start a new one");
  if (cardNumber?.replace(/\s/g, "") === "4000000000000002") {
    throw new HttpError(402, "Your card was declined (mock test card 4000 0000 0000 0002)");
  }
  const now = new Date();
  const active = await prisma.subscription.update({
    where: { id: sub.id }, include,
    data: { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: addMonths(now, 1) },
  });
  await Promise.all([
    notify(active.learnerId, "Subscription active", `You're in! ${active.course.title} - ${active.plan.name} ($${active.plan.priceCents / 100}/month).`),
    notify(active.course.instructorId, "New subscriber", `${req.user!.name} subscribed to "${active.course.title}" (${active.plan.name}).`),
  ]);
  ok(res, presentSub(active));
});

r.get("/", async (req, res) => {
  await syncPeriods({ learnerId: req.user!.id });
  const subs = await prisma.subscription.findMany({
    where: { learnerId: req.user!.id, status: { not: "PENDING" } },
    include, orderBy: { createdAt: "desc" },
  });
  ok(res, subs.map(presentSub));
});

r.patch("/:id/plan", async (req, res) => {
  if (paymentMode() !== "mock") throw new HttpError(501, "Plan changes with Stripe are handled by the payments module");
  const { planId } = parse(z.object({ planId: z.string().uuid() }), req.body);
  const sub = await ownSub(req);
  if (!(await getEntitlement(sub.learnerId, sub.courseId))) throw conflict("Subscription is not active");
  const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
  if (!plan || plan.courseId !== sub.courseId) throw badRequest("That plan does not belong to this course");
  if (plan.id === sub.planId) throw conflict("You are already on this plan");
  const updated = await prisma.subscription.update({ where: { id: sub.id }, data: { planId, cancelAtPeriodEnd: false }, include });
  await notify(sub.learnerId, "Plan changed", `You are now on ${plan.name} for ${updated.course.title}.`);
  ok(res, presentSub(updated));
});

r.post("/:id/cancel", async (req, res) => {
  const sub = await ownSub(req);
  if (sub.status !== "ACTIVE") throw conflict("Only active subscriptions can be cancelled");
  if (sub.cancelAtPeriodEnd) throw conflict("Already scheduled to cancel");
  await setStripeCancelAtPeriodEnd(sub.stripeSubscriptionId, true);
  const updated = await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: true }, include });
  await notify(sub.learnerId, "Subscription cancelled", `You keep access to ${updated.course.title} until ${updated.currentPeriodEnd?.toDateString()}.`);
  ok(res, presentSub(updated));
});

r.post("/:id/resume", async (req, res) => {
  const sub = await ownSub(req);
  if (sub.status !== "ACTIVE" || !sub.cancelAtPeriodEnd) throw conflict("Nothing to resume");
  await setStripeCancelAtPeriodEnd(sub.stripeSubscriptionId, false);
  ok(res, presentSub(await prisma.subscription.update({ where: { id: sub.id }, data: { cancelAtPeriodEnd: false }, include })));
});

export default r;
