"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button, inputCls, Label } from "@/components/ui";

const DEMO = [
  { label: "Learner", email: "learner@dexterity.test" },
  { label: "Instructor", email: "jubair@dexterity.test" },
  { label: "Admin", email: "admin@dexterity.test" },
];

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e?: React.FormEvent, creds = { email, password }) => {
    e?.preventDefault(); setBusy(true); setError("");
    try { await login(creds.email, creds.password); router.replace(next); }
    catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <>
      <h1 className="text-[28px]">Welcome back</h1>
      <p className="mt-1 text-sub">Sign in to book sessions and manage subscriptions.</p>
      <form onSubmit={submit} className="mt-7 space-y-4">
        <div><Label>Email</Label><input className={inputCls} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></div>
        <div><Label>Password</Label><input className={inputCls} type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" /></div>
        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#b91c1c]">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Sign in</Button>
      </form>

      <div className="mt-6 rounded-2xl bg-primary-soft/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Demo accounts (seeded)</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button key={d.email} onClick={() => submit(undefined, { email: d.email, password: "Password123!" })}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-primary shadow-sm hover:bg-primary hover:text-white">{d.label}</button>
          ))}
        </div>
      </div>
      <p className="mt-6 text-center text-sm text-sub">New here? <Link href="/register" className="font-bold text-primary">Create an account</Link></p>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
