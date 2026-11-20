import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/http";
import { requireAuth } from "../middleware/auth";

const r = Router();
r.use(requireAuth);

r.get("/", async (req, res) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { userId: req.user!.id, read: false } }),
  ]);
  ok(res, { unread, items });
});

r.post("/read-all", async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
  ok(res, { unread: 0 });
});

export default r;
