import { prisma } from "../lib/prisma";

/** In-app notification (the bell icon). Email delivery is another module (Nodemailer). */
export async function notify(userId: string, title: string, body: string) {
  try {
    await prisma.notification.create({ data: { userId, title, body } });
  } catch (e) {
    console.error("[notify] failed", (e as Error).message);
  }
}
