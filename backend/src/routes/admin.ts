import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { notFound, parse } from "../lib/errors";
import { ok } from "../lib/http";
import { requireAuth, requireRole } from "../middleware/auth";
import { notify } from "../services/notify";

// Minimal admin tooling so instructors can be verified (full admin panel = common workflow #2).
const r = Router();
r.use(requireAuth, requireRole("ADMIN"));

r.get("/instructors/pending", async (_req, res) => {
  ok(res, await prisma.user.findMany({
    where: { role: "INSTRUCTOR", isVerified: false },
    select: { id: true, name: true, email: true, headline: true, skills: true, createdAt: true },
  }));
});

r.patch("/instructors/:id/verify", async (req, res) => {
  const { approved } = parse(z.object({ approved: z.boolean() }), req.body);
  const id = String(req.params.id);
  const u = await prisma.user.findFirst({ where: { id, role: "INSTRUCTOR" } });
  if (!u) throw notFound("Instructor not found");
  const updated = await prisma.user.update({ where: { id }, data: { isVerified: approved }, select: { id: true, name: true, isVerified: true } });
  await notify(id, approved ? "Profile verified" : "Verification rejected",
    approved ? "You are now visible in search and bookable by learners." : "Your instructor application was not approved.");
  ok(res, updated);
});

export default r;
