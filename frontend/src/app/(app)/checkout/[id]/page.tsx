"use client";
import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreditCard, Lock, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useRequireAuth } from "@/lib/auth";
import { money } from "@/lib/format";
import type { MySubscription } from "@/lib/types";
import { Button, Card, CoverArt, EmptyState, inputCls, Label, Skeleton, useToast } from "@/components/ui";

/** MOCK checkout. When STRIPE_SECRET_KEY is set on the backend, users are sent to Stripe instead. */
export default function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { ready } = useRequireAuth();
  const router = useRouter();
  const toast = useToast();
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [error, setError] = useState("");
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (ready) api<MySubscription>(`/subscriptions/${id}`).then(setSub).catch((e) => setError(e.message)); }, [ready, id]);

  const pay = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true);
    try {
      await api(`/subscriptions/${id}/confirm-mock`, { method: "POST", body: { cardNumber: card } });
      toast("success", "Payment successful - welcome aboard!");
      router.replace("/subscriptions?success=1");
    } catch (err) { toast("error", (err as Error).message); setBusy(false); }
  };

  if (error) return <EmptyState title="Checkout unavailable" hint={error} action={<Link href="/marketplace"><Button variant="outline">Back to marketplace</Button></Link>} />;
  if (!sub) return <Skeleton className="h-80 w-full max-w-3xl" />;
  if (sub.status === "ACTIVE") return <EmptyState title="Already active" hint="This subscription is already paid." action={<Link href="/subscriptions"><Button>My subscriptions</Button></Link>} />;

  return (
    <div className="mx-auto max-w-4xl">
      <h1>Complete your subscription</h1>
      <p className="mt-1 text-sub">Test mode - no real money is charged.</p>
      <div className="mt-7 grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card className="p-6">
          <div className="w-32"><CoverArt title={sub.course.title} color={sub.course.coverColor} /></div>
          <h2 className="mt-4 text-xl">{sub.course.title}</h2>
          <div className="mt-1 text-sub">{sub.plan.name}</div>
          <div className="mt-5 flex items-baseline justify-between border-t border-ink-100 pt-4">
            <span className="font-semibold">Billed monthly</span>
            <span className="text-3xl font-extrabold text-primary">{money(sub.plan.price)}</span>
          </div>
          <ul className="mt-4 space-y-1 text-sm text-sub">
            <li>• Cancel any time - access lasts until period end</li>
            <li>• Upgrade or downgrade from your Subscriptions page</li>
          </ul>
        </Card>
        <Card className="p-6">
          <form onSubmit={pay} className="space-y-4">
            <div><Label>Card number</Label>
              <div className="relative"><CreditCard className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-mute" />
                <input className={`${inputCls} pl-12 tabular-nums`} value={card} onChange={(e) => setCard(e.target.value)} inputMode="numeric" /></div></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Expiry</Label><input className={inputCls} defaultValue="12 / 30" /></div>
              <div><Label>CVC</Label><input className={inputCls} defaultValue="123" /></div>
            </div>
            <p className="rounded-2xl bg-primary-soft/60 px-4 py-3 text-xs text-sub">
              Try <b>4242 4242 4242 4242</b> for success or <b>4000 0000 0000 0002</b> to simulate a declined card.
            </p>
            <Button type="submit" size="lg" className="w-full" loading={busy}><Lock className="h-4 w-4" /> Pay {money(sub.plan.price)}</Button>
            <p className="flex items-center justify-center gap-1.5 text-xs text-mute"><ShieldCheck className="h-4 w-4" /> Secure mock checkout</p>
          </form>
        </Card>
      </div>
    </div>
  );
}
