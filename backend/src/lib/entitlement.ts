import { prisma } from "./prisma";
import { addMonths } from "./util";

/**
 * Keeps subscription periods honest. Runs lazily before any entitlement check.
 *  - Mock-billing subs whose period ended and are not cancelled are auto-renewed (simulates the monthly charge).
 *  - Subs flagged cancelAtPeriodEnd (or Stripe-managed ones that lapsed) are ended.
 * Stripe-managed renewals arrive through the webhook instead.
 */
export async function syncPeriods(where: { learnerId?: string; courseId?: string } = {}) {
  const now = new Date();
  const lapsed = await prisma.subscription.findMany({
    where: { ...where, status: "ACTIVE", currentPeriodEnd: { lte: now } },
  });
  for (const s of lapsed) {
    if (!s.cancelAtPeriodEnd && !s.stripeSubscriptionId) {
      let end = s.currentPeriodEnd!;
      while (end <= now) end = addMonths(end, 1);
      await prisma.subscription.update({
        where: { id: s.id },
        data: { currentPeriodStart: addMonths(end, -1), currentPeriodEnd: end },
      });
    } else {
      await prisma.subscription.update({ where: { id: s.id }, data: { status: "CANCELLED" } });
    }
  }
}

/** The learner's currently-entitled subscription for a course (with plan), or null. */
export async function getEntitlement(learnerId: string, courseId: string) {
  await syncPeriods({ learnerId, courseId });
  return prisma.subscription.findFirst({
    where: { learnerId, courseId, status: "ACTIVE", currentPeriodEnd: { gt: new Date() } },
    include: { plan: true },
    orderBy: { createdAt: "desc" },
  });
}
