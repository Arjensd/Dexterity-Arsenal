import { prisma } from "./prisma";

export const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) =>
  aStart < bEnd && aEnd > bStart;

export function addMonths(d: Date, n: number) {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Transaction-scoped advisory lock - serialises concurrent bookings for the same key. */
export async function advisoryLock(tx: Tx, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
}

export const publicUser = {
  id: true,
  name: true,
  headline: true,
  bio: true,
  avatarUrl: true,
  skills: true,
  ratingAvg: true,
  ratingCount: true,
  isVerified: true,
} as const;
