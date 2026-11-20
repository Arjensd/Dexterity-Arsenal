"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Button, cx, inputCls, Label } from "@/components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", phone: "", password: "", role: "LEARNER" as "LEARNER" | "INSTRUCTOR", headline: "", skills: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      await register({ name: f.name, email: f.email, phone: f.phone || undefined, password: f.password, role: f.role,
        headline: f.role === "INSTRUCTOR" ? f.headline || undefined : undefined,
        skills: f.role === "INSTRUCTOR" ? f.skills.split(",").map((s) => s.trim()).filter(Boolean) : [] });
      router.replace("/");
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  return (
    <>
      <h1 className="text-[28px]">Create your account</h1>
      <p className="mt-1 text-sub">Roles are swappable - you can switch any time.</p>
      <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-muted p-1.5" role="radiogroup" aria-label="Primary role">
        {(["LEARNER", "INSTRUCTOR"] as const).map((r) => (
          <button key={r} type="button" role="radio" aria-checked={f.role === r} onClick={() => setF({ ...f, role: r })}
            className={cx("rounded-full py-2.5 text-sm font-bold transition", f.role === r ? "bg-white text-primary shadow-sm" : "text-sub")}>
            {r === "LEARNER" ? "Learner" : "Instructor"}
          </button>
        ))}
      </div>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div><Label>Full name</Label><input className={inputCls} required minLength={2} value={f.name} onChange={set("name")} autoComplete="name" /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label>Email</Label><input className={inputCls} type="email" required value={f.email} onChange={set("email")} autoComplete="email" /></div>
          <div><Label>Phone</Label><input className={inputCls} type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" /></div>
        </div>
        <div><Label>Password</Label><input className={inputCls} type="password" required minLength={8} value={f.password} onChange={set("password")} placeholder="At least 8 characters" autoComplete="new-password" /></div>
        {f.role === "INSTRUCTOR" && (
          <>
            <div><Label>Headline</Label><input className={inputCls} value={f.headline} onChange={set("headline")} placeholder="e.g. Full-Stack Developer" /></div>
            <div><Label>Skills (comma separated)</Label><input className={inputCls} value={f.skills} onChange={set("skills")} placeholder="React, Node.js, Python" /></div>
            <p className="rounded-2xl bg-warning/10 px-4 py-3 text-xs font-medium text-[#b45309]">Instructors appear in search once an admin has verified them.</p>
          </>
        )}
        {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-medium text-[#b91c1c]">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
      <p className="mt-6 text-center text-sm text-sub">Already have an account? <Link href="/login" className="font-bold text-primary">Sign in</Link></p>
    </>
  );
}
