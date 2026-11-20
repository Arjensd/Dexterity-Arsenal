/**
 * Payment abstraction for subscriptions (Module 2 / Feature 2).
 * The full payment & receipt system is Module 3 / Feature 2 (another member) - this adapter
 * is the hook between the two:
 *   - STRIPE_SECRET_KEY set  -> real Stripe Checkout (mode=subscription) + webhooks
 *   - otherwise              -> MOCK checkout page in the frontend (/checkout/:id)
 */
import Stripe from "stripe";
import { env, stripeConfigured } from "../config/env";

export const paymentMode = (): "stripe" | "mock" => (stripeConfigured ? "stripe" : "mock");

let _stripe: Stripe | null = null;
export const stripe = () => (_stripe ??= new Stripe(env.stripe.secretKey));

export interface CheckoutInput {
  subscriptionId: string;
  courseId: string;
  courseTitle: string;
  planName: string;
  priceCents: number;
  currency: string;
  learnerEmail: string;
}

export async function createCheckout(i: CheckoutInput): Promise<{ mode: "stripe" | "mock"; url: string; sessionId?: string }> {
  if (!stripeConfigured) {
    return { mode: "mock", url: `${env.clientUrl}/checkout/${i.subscriptionId}` };
  }
  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    customer_email: i.learnerEmail,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: i.currency,
          unit_amount: i.priceCents,
          recurring: { interval: "month" },
          product_data: { name: `${i.courseTitle} - ${i.planName}` },
        },
      },
    ],
    metadata: { subscriptionId: i.subscriptionId },
    subscription_data: { metadata: { subscriptionId: i.subscriptionId } },
    success_url: `${env.clientUrl}/subscriptions?success=1`,
    cancel_url: `${env.clientUrl}/courses/${i.courseId}`,
  });
  return { mode: "stripe", url: session.url!, sessionId: session.id };
}

export async function setStripeCancelAtPeriodEnd(stripeSubscriptionId: string | null, value: boolean) {
  if (!stripeConfigured || !stripeSubscriptionId) return;
  await stripe().subscriptions.update(stripeSubscriptionId, { cancel_at_period_end: value });
}
