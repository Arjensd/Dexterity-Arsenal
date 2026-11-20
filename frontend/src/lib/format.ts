const tz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export const timeZone = tz;

export const dateKey = (iso: string | Date) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const t = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
export const fmtTime = (iso: string) => t(new Date(iso));
export const fmtRange = (a: string, b: string) => {
  const x = new Date(a), y = new Date(b);
  const xs = t(x), ys = t(y);
  const xp = xs.slice(-2), yp = ys.slice(-2);
  return xp === yp && /AM|PM/i.test(xp) ? `${xs.slice(0, -3)} - ${ys}` : `${xs} - ${ys}`;
};
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
export const fmtDateLong = (iso: string) => new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const fmtDateTime = (iso: string) => `${fmtDate(iso)} · ${fmtTime(iso)}`;
export const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
export const rating = (n: number) => n.toFixed(1);

export function relative(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff), m = Math.round(abs / 60000), h = Math.round(m / 60), d = Math.round(h / 24);
  const s = m < 60 ? `${m} min` : h < 48 ? `${h} hr` : `${d} days`;
  return diff >= 0 ? `in ${s}` : `${s} ago`;
}

export const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
