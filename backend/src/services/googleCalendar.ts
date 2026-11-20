/**
 * Google Calendar integration (Module 1 / Feature 2).
 *
 * - If GOOGLE_CLIENT_ID / SECRET / REFRESH_TOKEN are set -> real Google Calendar API
 *   (creates events, adds attendees, generates Google Meet links, sends invites).
 * - Otherwise -> MOCK mode with identical behaviour (fake ids + fake Meet links), so the
 *   whole system can be developed and demoed without a Google account.
 *
 * The database is the source of truth. Calendar failures are logged and never block a
 * booking: callers receive `null` and the slot is flagged as "not synced".
 */
import { randomBytes } from "node:crypto";
import { auth, calendar as gcal } from "@googleapis/calendar";
import { env, googleConfigured } from "../config/env";

export interface EventInput {
  title: string;
  description?: string | null;
  startsAt: Date;
  endsAt: Date;
  online: boolean;
  location?: string | null;
  attendees: string[];
}
export interface EventResult {
  eventId: string;
  meetLink: string | null;
}

const rand = (n: number) => {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  return Array.from(randomBytes(n), (b) => letters[b % 26]).join("");
};

function getClient() {
  const oauth = new auth.OAuth2(env.google.clientId, env.google.clientSecret);
  oauth.setCredentials({ refresh_token: env.google.refreshToken });
  return gcal({ version: "v3", auth: oauth });
}

export const calendarMode = (): "google" | "mock" => (googleConfigured ? "google" : "mock");

export async function createEvent(input: EventInput): Promise<EventResult | null> {
  try {
    if (!googleConfigured) {
      console.log(`[calendar:mock] create "${input.title}" ${input.startsAt.toISOString()}`);
      return {
        eventId: `mock_${randomBytes(8).toString("hex")}`,
        meetLink: input.online ? `https://meet.google.com/${rand(3)}-${rand(4)}-${rand(3)}` : null,
      };
    }
    const res = await getClient().events.insert({
      calendarId: env.google.calendarId,
      conferenceDataVersion: input.online ? 1 : 0,
      sendUpdates: "all",
      requestBody: {
        summary: input.title,
        description: input.description ?? undefined,
        location: input.location ?? undefined,
        start: { dateTime: input.startsAt.toISOString() },
        end: { dateTime: input.endsAt.toISOString() },
        attendees: input.attendees.map((email) => ({ email })),
        ...(input.online
          ? {
              conferenceData: {
                createRequest: {
                  requestId: randomBytes(8).toString("hex"),
                  conferenceSolutionKey: { type: "hangoutsMeet" },
                },
              },
            }
          : {}),
      },
    });
    const meetLink =
      res.data.hangoutLink ??
      res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
      null;
    return { eventId: res.data.id!, meetLink };
  } catch (err) {
    console.error("[calendar] createEvent failed:", (err as Error).message);
    return null;
  }
}

/** Replace the attendee list (called whenever someone books / cancels). */
export async function setAttendees(eventId: string | null, attendees: string[]): Promise<boolean> {
  if (!eventId) return false;
  try {
    if (!googleConfigured) {
      console.log(`[calendar:mock] attendees for ${eventId}: ${attendees.join(", ") || "(none)"}`);
      return true;
    }
    await getClient().events.patch({
      calendarId: env.google.calendarId,
      eventId,
      sendUpdates: "all",
      requestBody: { attendees: attendees.map((email) => ({ email })) },
    });
    return true;
  } catch (err) {
    console.error("[calendar] setAttendees failed:", (err as Error).message);
    return false;
  }
}

export async function deleteEvent(eventId: string | null): Promise<boolean> {
  if (!eventId) return false;
  try {
    if (!googleConfigured) {
      console.log(`[calendar:mock] delete ${eventId}`);
      return true;
    }
    await getClient().events.delete({ calendarId: env.google.calendarId, eventId, sendUpdates: "all" });
    return true;
  } catch (err) {
    console.error("[calendar] deleteEvent failed:", (err as Error).message);
    return false;
  }
}
