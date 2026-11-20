"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cx } from "./ui";
import { dateKey } from "@/lib/format";

/** Month grid from the "Book a Session" design. Dates with open slots get a soft purple ring. */
export function Calendar({ month, onMonthChange, selected, onSelect, marked }: {
  month: Date; onMonthChange: (d: Date) => void; selected: string | null; onSelect: (key: string) => void; marked: Set<string>;
}) {
  const y = month.getFullYear(), m = month.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const todayKey = dateKey(new Date());
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const thisMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  return (
    <div className="w-full max-w-[360px]">
      <div className="mb-4 flex items-center justify-between">
        <button aria-label="Previous month" disabled={month <= thisMonthStart} onClick={() => onMonthChange(new Date(y, m - 1, 1))}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted disabled:opacity-30"><ArrowLeft className="h-5 w-5" /></button>
        <div className="text-base font-semibold">{month.toLocaleDateString([], { month: "long", year: "numeric" })}</div>
        <button aria-label="Next month" onClick={() => onMonthChange(new Date(y, m + 1, 1))}
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-muted"><ArrowRight className="h-5 w-5" /></button>
      </div>
      <div className="grid grid-cols-7 gap-y-1.5 text-center text-xs font-semibold text-mute">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="pb-1">{d}</div>)}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const has = marked.has(key), isSel = key === selected, past = key < todayKey;
          return (
            <button key={i} disabled={!has} onClick={() => onSelect(key)} aria-label={key} aria-pressed={isSel}
              className={cx("mx-auto grid h-10 w-10 place-items-center rounded-full text-[15px] font-semibold transition",
                isSel ? "bg-primary text-white shadow-[0_6px_16px_-6px_rgb(108_58_237/0.8)]"
                  : has ? "bg-primary-soft text-primary hover:bg-primary-light/40"
                  : cx("cursor-default", past ? "text-ink-300" : "text-ink-900/80"),
                key === todayKey && !isSel && "ring-1 ring-primary/40")}>
              {d}
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-sub">
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-primary-soft ring-1 ring-primary/30" /> Open slots</span>
        <span className="flex items-center gap-1.5"><i className="h-3 w-3 rounded-full bg-primary" /> Selected</span>
      </div>
    </div>
  );
}
