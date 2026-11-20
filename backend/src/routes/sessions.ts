/**
 * MODULE 1 / FEATURE 2 - Session Scheduling & Calendar Integration
 *
 * Instructors publish availability slots (online via Google Meet, or offline at an address,
 * 1-on-1 or group). Learners can only book OPEN slots that still have capacity and do not
 * clash with anything else in their own calendar. Every slot is mirrored to Google Calendar.
 */
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { badRequest, conflict, forbidden, notFound, parse } from "../lib/errors";
import { ok } from "../lib/http";
import { advisoryLock, overlaps } from "../lib/util";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth";
import * as calendar from "../services/googleCalendar";
import { notify } from "../services/notify";
import type { AvailabilitySlot, SessionBooking } from "../generated/prisma/client";

const r = Router();

// ───────────────────────── helpers ─────────────────────────

type SlotWithBookings = AvailabilitySlot & { bookings: Pick<SessionBooking, "learnerId" | "status">[] };

/** Shape a slot for the API. Meet links are only revealed to the instructor / booked learners. */
function presentSlot(slot: SlotWithBookings, viewerId?: string) {
  const confirmed = slot.bookings.filter((b) => b.status === "CONFIRMED");
  const bookedByMe = !!viewerId && confirmed.some((b) => b.learnerId === viewerId);
  const isOwner = viewerId === slot.instructorId;
  const isPast = slot.startsAt <= new Date();
  const spotsLeft = Math.max(slot.capacity - confirmed.length, 0);
  const { bookings: _b, googleEventId: _g, meetLink, ...rest } = slot;
  return {
    ...rest,
    meetLink: isOwner || bookedByMe ? meetLink : null,
    bookedCount: confirmed.length,
    spotsLeft,
    isFull: spotsLeft === 0,
    isPast,
    bookedByMe,
    available: slot.status === "OPEN" && !isPast && spotsLeft > 0 && !bookedByMe && !isOwner,
  };
}

async function attendeeEmails(slotId: string) {
  const slot = await prisma.availabilitySlot.findUniqueOrThrow({
    where: { id: slotId },
    select: {
      instructor: { select: { email: true } },
      bookings: { where: { status: "CONFIRMED" }, select: { learner: { select: { email: true } } } },
    },
  });
  return [slot.instructor.email, ...slot.bookings.map((b) => b.learner.email)];
}

const fmt = (d: Date) => d.toUTCString().replace(":00 GMT", " UTC");

// ───────────────────────── calendar status ─────────────────────────

r.get("/calendar/status", (_req, res) => ok(res, { mode: calendar.calendarMode() }));

// ───────────────────────── instructor: manage availability ─────────────────────────

const createSlot = z
  .object({
    title: z.string().trim().min(2).max(100).default("Mentoring Session"),
    description: z.string().trim().max(500).optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    mode: z.enum(["ONLINE", "OFFLINE"]),
    format: z.enum(["ONE_ON_ONE", "GROUP"]).default("ONE_ON_ONE"),
    capacity: z.number().int().min(2).max(200).optional(),
    address: z.string().trim().min(3).max(200).optional(),
  })
  .superRefine((v, ctx) => {
    const mins = (v.endsAt.getTime() - v.startsAt.getTime()) / 60000;
    if (mins < 15) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Session must be at least 15 minutes" });
    if (mins > 8 * 60) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "Session cannot exceed 8 hours" });
    if (v.startsAt <= new Date()) ctx.addIssue({ code: "custom", path: ["startsAt"], message: "Start time must be in the future" });
    if (v.mode === "OFFLINE" && !v.address) ctx.addIssue({ code: "custom", path: ["address"], message: "Address is required for offline sessions" });
    if (v.format === "GROUP" && !v.capacity) ctx.addIssue({ code: "custom", path: ["capacity"], message: "Group sessions need a capacity (2 or more)" });
  });

r.post("/slots", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const body = parse(createSlot, req.body);
  const me = req.user!;

  const slot = await prisma.$transaction(async (tx) => {
    await advisoryLock(tx, `user:${me.id}`);

    // 1. No overlap with my other active slots.
    const mySlots = await tx.availabilitySlot.findMany({
      where: { instructorId: me.id, status: "OPEN", startsAt: { lt: body.endsAt }, endsAt: { gt: body.startsAt } },
      select: { title: true, startsAt: true },
    });
    if (mySlots.length) {
      throw conflict(`This overlaps your existing slot "${mySlots[0].title}" (${fmt(mySlots[0].startsAt)})`);
    }
    // 2. No overlap with sessions I attend as a learner.
    const asLearner = await tx.sessionBooking.findFirst({
      where: { learnerId: me.id, status: "CONFIRMED", slot: { status: "OPEN", startsAt: { lt: body.endsAt }, endsAt: { gt: body.startsAt } } },
    });
    if (asLearner) throw conflict("This overlaps a session you have booked as a learner");

    return tx.availabilitySlot.create({
      data: {
        instructorId: me.id,
        title: body.title,
        description: body.description,
        startsAt: body.startsAt,
        endsAt: body.endsAt,
        mode: body.mode,
        format: body.format,
        capacity: body.format === "ONE_ON_ONE" ? 1 : body.capacity!,
        address: body.mode === "OFFLINE" ? body.address : null,
      },
    });
  });

  // Mirror to Google Calendar (generates the Meet link for online sessions).
  const event = await calendar.createEvent({
    title: `${slot.title} - ${me.name}`,
    description: slot.description,
    startsAt: slot.startsAt,
    endsAt: slot.endsAt,
    online: slot.mode === "ONLINE",
    location: slot.address,
    attendees: [me.email],
  });
  const saved = event
    ? await prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { googleEventId: event.eventId, meetLink: event.meetLink },
        include: { bookings: { select: { learnerId: true, status: true } } },
      })
    : { ...slot, bookings: [] };

  ok(res, { ...presentSlot(saved, me.id), calendarSynced: !!event, calendarMode: calendar.calendarMode() }, 201);
});

// My slots (instructor dashboard) incl. who booked.
r.get("/slots/mine", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const includePast = req.query.includePast === "true";
  const slots = await prisma.availabilitySlot.findMany({
    where: { instructorId: req.user!.id, status: "OPEN", ...(includePast ? {} : { endsAt: { gt: new Date() } }) },
    orderBy: { startsAt: "asc" },
    include: {
      bookings: {
        where: { status: "CONFIRMED" },
        select: { learnerId: true, status: true, note: true, learner: { select: { id: true, name: true, email: true } } },
      },
    },
  });
  ok(res, slots.map((s) => ({
    ...presentSlot(s, req.user!.id),
    attendees: s.bookings.map((b) => ({ ...b.learner, note: b.note })),
  })));
});

// Cancel a slot. Notifies and cancels every booked learner.
r.delete("/slots/:id", requireAuth, requireRole("INSTRUCTOR"), async (req, res) => {
  const id = String(req.params.id);
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id },
    include: { bookings: { where: { status: "CONFIRMED" } } },
  });
  if (!slot) throw notFound("Slot not found");
  if (slot.instructorId !== req.user!.id) throw forbidden("This is not your slot");

  if (slot.bookings.length === 0) {
    await prisma.availabilitySlot.delete({ where: { id } });
  } else {
    await prisma.$transaction([
      prisma.sessionBooking.updateMany({ where: { slotId: id, status: "CONFIRMED" }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
      prisma.availabilitySlot.update({ where: { id }, data: { status: "CANCELLED" } }),
    ]);
    await Promise.all(slot.bookings.map((b) =>
      notify(b.learnerId, "Session cancelled", `"${slot.title}" on ${fmt(slot.startsAt)} was cancelled by the instructor.`)));
  }
  await calendar.deleteEvent(slot.googleEventId);
  ok(res, { cancelled: true, learnersNotified: slot.bookings.length });
});

// ───────────────────────── learners: browse live availability ─────────────────────────

const listQuery = z.object({
  instructorId: z.string().uuid().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  mode: z.enum(["ONLINE", "OFFLINE"]).optional(),
  availableOnly: z.enum(["true", "false"]).optional(),
});

r.get("/slots", optionalAuth, async (req, res) => {
  const q = parse(listQuery, req.query);
  const now = new Date();
  const slots = await prisma.availabilitySlot.findMany({
    where: {
      status: "OPEN",
      instructorId: q.instructorId,
      mode: q.mode,
      startsAt: { gt: q.from && q.from > now ? q.from : now, ...(q.to ? { lt: q.to } : {}) },
    },
    orderBy: { startsAt: "asc" },
    include: { bookings: { select: { learnerId: true, status: true } } },
    take: 300,
  });
  let shaped = slots.map((s) => presentSlot(s, req.user?.id));
  if (q.availableOnly === "true") shaped = shaped.filter((s) => s.available);
  ok(res, shaped);
});

// ───────────────────────── learners: book / cancel ─────────────────────────

r.post("/slots/:id/book", requireAuth, async (req, res) => {
  const slotId = String(req.params.id);
  const { note } = parse(z.object({ note: z.string().trim().max(300).optional() }), req.body ?? {});
  const me = req.user!;

  const booking = await prisma.$transaction(async (tx) => {
    // Serialise concurrent requests: first on the slot (capacity), then on the learner (clashes).
    await advisoryLock(tx, `slot:${slotId}`);
    await advisoryLock(tx, `user:${me.id}`);

    const slot = await tx.availabilitySlot.findUnique({ where: { id: slotId } });
    if (!slot) throw notFound("Slot not found");
    if (slot.status !== "OPEN") throw conflict("This slot has been cancelled");
    if (slot.startsAt <= new Date()) throw conflict("This slot has already started or passed");
    if (slot.instructorId === me.id) throw badRequest("You cannot book your own slot");

    const confirmed = await tx.sessionBooking.count({ where: { slotId, status: "CONFIRMED" } });
    if (confirmed >= slot.capacity) throw conflict("This slot is fully booked");

    const existing = await tx.sessionBooking.findUnique({ where: { slotId_learnerId: { slotId, learnerId: me.id } } });
    if (existing?.status === "CONFIRMED") throw conflict("You have already booked this slot");

    // Clash with another session I'm attending?
    const clash = await tx.sessionBooking.findFirst({
      where: { learnerId: me.id, status: "CONFIRMED", slotId: { not: slotId },
        slot: { status: "OPEN", startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } } },
      include: { slot: { select: { title: true, startsAt: true } } },
    });
    if (clash) throw conflict(`Time clash with your booking "${clash.slot.title}" (${fmt(clash.slot.startsAt)})`);

    // Clash with a slot I'm hosting?
    const hosting = await tx.availabilitySlot.findFirst({
      where: { instructorId: me.id, status: "OPEN", startsAt: { lt: slot.endsAt }, endsAt: { gt: slot.startsAt } },
    });
    if (hosting) throw conflict(`Time clash with a slot you are hosting ("${hosting.title}")`);

    return existing
      ? tx.sessionBooking.update({ where: { id: existing.id }, data: { status: "CONFIRMED", note, cancelledAt: null } })
      : tx.sessionBooking.create({ data: { slotId, learnerId: me.id, note } });
  });

  const slot = await prisma.availabilitySlot.findUniqueOrThrow({
    where: { id: slotId },
    include: { bookings: { select: { learnerId: true, status: true } }, instructor: { select: { id: true, name: true } } },
  });
  const synced = await calendar.setAttendees(slot.googleEventId, await attendeeEmails(slotId));
  await Promise.all([
    notify(me.id, "Booking confirmed", `${slot.title} with ${slot.instructor.name} on ${fmt(slot.startsAt)}.`),
    notify(slot.instructorId, "New booking", `${me.name} booked "${slot.title}" on ${fmt(slot.startsAt)}.`),
  ]);

  ok(res, { booking, session: presentSlot(slot, me.id), calendarSynced: synced }, 201);
});

r.get("/bookings/mine", requireAuth, async (req, res) => {
  const upcomingOnly = req.query.upcoming === "true";
  const bookings = await prisma.sessionBooking.findMany({
    where: { learnerId: req.user!.id, status: "CONFIRMED", ...(upcomingOnly ? { slot: { endsAt: { gt: new Date() } } } : {}) },
    orderBy: { slot: { startsAt: "asc" } },
    include: {
      slot: { include: { bookings: { select: { learnerId: true, status: true } }, instructor: { select: { id: true, name: true, headline: true, avatarUrl: true } } } },
    },
  });
  ok(res, bookings.map((b) => ({
    id: b.id, status: b.status, note: b.note, createdAt: b.createdAt,
    session: presentSlot(b.slot, req.user!.id),
    instructor: b.slot.instructor,
  })));
});

r.patch("/bookings/:id/cancel", requireAuth, async (req, res) => {
  const id = String(req.params.id);
  const booking = await prisma.sessionBooking.findUnique({ where: { id }, include: { slot: { include: { instructor: true } } } });
  if (!booking) throw notFound("Booking not found");
  if (booking.learnerId !== req.user!.id) throw forbidden("This is not your booking");
  if (booking.status === "CANCELLED") throw conflict("Booking is already cancelled");
  if (booking.slot.startsAt <= new Date()) throw conflict("You cannot cancel a session that has already started");

  const updated = await prisma.sessionBooking.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: new Date() } });
  await calendar.setAttendees(booking.slot.googleEventId, await attendeeEmails(booking.slotId));
  await notify(booking.slot.instructorId, "Booking cancelled", `${req.user!.name} cancelled "${booking.slot.title}" on ${fmt(booking.slot.startsAt)}. The spot is open again.`);
  ok(res, updated);
});

export default r;
