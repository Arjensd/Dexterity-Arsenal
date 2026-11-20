"use client";
import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { initials } from "@/lib/format";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

// ───────── Button (Primary / Secondary / Outline from the style guide) ─────────
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
};
export function Button({ variant = "primary", size = "md", loading, className, children, disabled, ...p }: BtnProps) {
  const v = {
    primary: "bg-primary text-white hover:bg-[#5b2fd6] shadow-[0_8px_20px_-8px_rgb(108_58_237/0.7)]",
    secondary: "bg-primary-soft text-primary hover:bg-[#e0d7fc]",
    outline: "border border-primary text-primary bg-white hover:bg-primary-soft",
    ghost: "text-sub hover:bg-muted",
    danger: "bg-danger/10 text-danger hover:bg-danger/20",
  }[variant];
  const s = { sm: "h-9 px-4 text-sm", md: "h-11 px-6 text-[15px]", lg: "h-[52px] px-8 text-base" }[size];
  return (
    <button
      {...p}
      disabled={disabled || loading}
      className={cx("inline-flex items-center justify-center gap-2 rounded-full font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50", v, s, className)}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

// ───────── Badge (Live / Available / Upcoming / Full) ─────────
export function Badge({ tone = "primary", children, dot = true, className }: { tone?: "primary" | "success" | "warning" | "danger" | "info" | "neutral"; children: ReactNode; dot?: boolean; className?: string }) {
  const t = {
    primary: ["bg-primary-soft text-primary", "bg-primary"],
    success: ["bg-success/15 text-[#15803d]", "bg-success"],
    warning: ["bg-warning/15 text-[#b45309]", "bg-warning"],
    danger: ["bg-danger/10 text-[#b91c1c]", "bg-danger"],
    info: ["bg-info/10 text-[#1d4ed8]", "bg-info"],
    neutral: ["bg-muted text-sub", "bg-mute"],
  }[tone];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", t[0], className)}>
      {dot && <span className={cx("h-2 w-2 rounded-full", t[1])} />}
      {children}
    </span>
  );
}

export const Card = ({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p} className={cx("rounded-3xl bg-white shadow-card", className)}>{children}</div>
);

// ───────── Avatar (gradient initials) ─────────
const GRADS = ["from-[#6C3AED] to-[#A78BFA]", "from-[#6366F1] to-[#A78BFA]", "from-[#7C3AED] to-[#C084FC]", "from-[#4F46E5] to-[#8B5CF6]"];
export function Avatar({ name, size = 44, className }: { name: string; size?: number; className?: string }) {
  const g = GRADS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % GRADS.length];
  return (
    <div className={cx("grid shrink-0 place-items-center rounded-full bg-gradient-to-br font-bold text-white ring-2 ring-white", g, className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }} aria-label={name}>
      {initials(name)}
    </div>
  );
}

// ───────── Skill badge (right column in both designs) ─────────
const SKILL: Record<string, { bg: string; fg: string; label: string }> = {
  react: { bg: "#E0F7FE", fg: "#0891b2", label: "⚛" }, html: { bg: "#FDE8E1", fg: "#E44D26", label: "5" },
  python: { bg: "#E3EEF9", fg: "#3776AB", label: "Py" }, javascript: { bg: "#FEF6C7", fg: "#a16207", label: "JS" },
  "node.js": { bg: "#E6F4E3", fg: "#3f8a34", label: "N" }, figma: { bg: "#FCE7F3", fg: "#be185d", label: "F" },
  sql: { bg: "#E0E7FF", fg: "#4338ca", label: "SQL" }, pandas: { bg: "#EDE9FE", fg: "#6d28d9", label: "Pd" },
};
export function SkillBadge({ name }: { name: string }) {
  const s = SKILL[name.toLowerCase()] ?? { bg: "#EDE9FE", fg: "#6C3AED", label: name.slice(0, 2).toUpperCase() };
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg text-[11px] font-extrabold" style={{ background: s.bg, color: s.fg }}>{s.label}</span>
      <span className="text-[15px] font-semibold text-ink-900">{name}</span>
    </div>
  );
}

// ───────── Course cover art (stands in for the 3D illustration) ─────────
const COVERS: Record<string, string> = {
  violet: "from-[#3b1d9e] via-[#6C3AED] to-[#a78bfa]", indigo: "from-[#312e81] via-[#6366F1] to-[#a5b4fc]",
  fuchsia: "from-[#701a75] via-[#c026d3] to-[#f0abfc]", sky: "from-[#075985] via-[#0ea5e9] to-[#7dd3fc]",
  emerald: "from-[#065f46] via-[#10b981] to-[#6ee7b7]", amber: "from-[#92400e] via-[#f59e0b] to-[#fcd34d]",
};
export function CoverArt({ title, color = "violet", skills = [], className }: { title: string; color?: string; skills?: string[]; className?: string }) {
  const words = title.replace(/course|bootcamp/i, "").trim().split(" ");
  // Sizes use container-query units so the title scales with the cover (small thumbnails never clip).
  const big = { fontSize: "min(10.5cqw, 26px)" };
  return (
    <div className={cx("relative aspect-square overflow-hidden rounded-[28px] bg-gradient-to-br text-white", COVERS[color] ?? COVERS.violet, className)}
      style={{ containerType: "inline-size", padding: "min(6cqw, 20px)" }}>
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
      <div className="absolute -bottom-10 -left-6 h-36 w-36 rounded-full bg-black/10" />
      <div className="relative flex gap-1.5" style={{ fontSize: "min(4cqw, 11px)" }}>
        {skills.slice(0, 3).map((s) => (
          <span key={s} className="rounded-lg bg-white/20 px-[1.6em] py-[0.5em] font-bold leading-none backdrop-blur">{s}</span>
        ))}
      </div>
      <div className="absolute leading-[1.05]" style={{ left: "min(6cqw, 20px)", right: "min(6cqw, 20px)", bottom: "min(6cqw, 20px)" }}>
        <div className="truncate font-extrabold" style={big}>{words.slice(0, -1).join(" ") || words[0]}</div>
        {words.length > 1 && <div className="truncate font-extrabold italic text-primary-soft" style={big}>{words.slice(-1)}</div>}
      </div>
    </div>
  );
}

export const Rating = ({ avg, count, size = "md" }: { avg: number; count: number; size?: "sm" | "md" }) => (
  <div className={cx("flex items-center gap-1.5", size === "sm" ? "text-xs" : "text-[15px]")}>
    <span className="text-warning">★</span>
    <span className="font-bold text-ink-900">{avg ? avg.toFixed(1) : "New"}</span>
    {count > 0 && <span className="text-mute">({count.toLocaleString()} reviews)</span>}
  </div>
);

// ───────── Misc ─────────
export const Spinner = () => <Loader2 className="h-6 w-6 animate-spin text-primary" />;
export const Skeleton = ({ className }: { className?: string }) => <div className={cx("skeleton", className)} />;

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-primary-light/50 bg-primary-soft/40 px-6 py-12 text-center">
      <div className="text-lg font-semibold text-ink-900">{title}</div>
      {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-sub">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const Progress = ({ value }: { value: number }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-primary-soft">
    <div className="brand-gradient h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

export const inputCls = "w-full rounded-2xl border border-ink-300/70 bg-white px-4 py-3 text-[15px] text-ink-900 placeholder:text-mute focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10";
export const Label = ({ children }: { children: ReactNode }) => <label className="mb-1.5 block text-sm font-semibold text-ink-700">{children}</label>;

// ───────── Toasts ─────────
type Toast = { id: number; tone: "success" | "error" | "info"; text: string };
const ToastCtx = createContext<(tone: Toast["tone"], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], text: string) => {
    const id = Date.now() + Math.random();
    setList((l) => [...l, { id, tone, text }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex w-[min(92vw,380px)] flex-col gap-3" role="status" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className="pop-in pointer-events-auto flex items-start gap-3 rounded-2xl bg-white p-4 shadow-pop ring-1 ring-black/5">
            {t.tone === "success" ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" /> : t.tone === "error" ? <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-danger" /> : <Info className="mt-0.5 h-5 w-5 shrink-0 text-info" />}
            <p className="text-sm font-medium text-ink-900">{t.text}</p>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="flex flex-wrap gap-x-7 gap-y-2 border-b border-ink-100" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx("-mb-px border-b-[3px] pb-2.5 text-[15px] font-semibold transition", value === t.id ? "border-primary text-primary" : "border-transparent text-sub hover:text-ink-900")}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
