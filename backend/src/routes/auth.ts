import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { conflict, parse, unauthorized } from "../lib/errors";
import { ok } from "../lib/http";
import { requireAuth, signToken } from "../middleware/auth";

const r = Router();

const register = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(6).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["LEARNER", "INSTRUCTOR"]).default("LEARNER"),
  headline: z.string().trim().max(120).optional(),
  skills: z.array(z.string().trim().min(1)).max(20).default([]),
});

const safeUser = {
  id: true, name: true, email: true, phone: true, role: true, headline: true, bio: true,
  avatarUrl: true, skills: true, isVerified: true, ratingAvg: true, ratingCount: true, createdAt: true,
} as const;

r.post("/register", async (req, res) => {
  const body = parse(register, req.body);
  if (await prisma.user.findUnique({ where: { email: body.email } })) {
    throw conflict("An account with this email already exists");
  }
  const user = await prisma.user.create({
    data: {
      name: body.name, email: body.email, phone: body.phone, role: body.role,
      headline: body.headline, skills: body.skills,
      passwordHash: await bcrypt.hash(body.password, 10),
    },
    select: safeUser,
  });
  ok(res, { user, token: signToken(user.id) }, 201);
});

r.post("/login", async (req, res) => {
  const { email, password } = parse(
    z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) }),
    req.body,
  );
  const found = await prisma.user.findUnique({ where: { email } });
  if (!found || !(await bcrypt.compare(password, found.passwordHash))) throw unauthorized("Invalid email or password");
  const user = await prisma.user.findUniqueOrThrow({ where: { id: found.id }, select: safeUser });
  ok(res, { user, token: signToken(user.id) });
});

r.get("/me", requireAuth, async (req, res) => {
  ok(res, await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id }, select: safeUser }));
});

// Roles are inter-swappable (functional requirement): a user can act as learner or instructor.
r.patch("/role", requireAuth, async (req, res) => {
  const { role } = parse(z.object({ role: z.enum(["LEARNER", "INSTRUCTOR"]) }), req.body);
  if (req.user!.role === "ADMIN") throw conflict("Admin accounts cannot switch roles");
  ok(res, await prisma.user.update({ where: { id: req.user!.id }, data: { role }, select: safeUser }));
});

r.patch("/profile", requireAuth, async (req, res) => {
  const data = parse(
    z.object({
      name: z.string().trim().min(2).optional(),
      phone: z.string().trim().min(6).optional(),
      headline: z.string().trim().max(120).optional(),
      bio: z.string().trim().max(1000).optional(),
      skills: z.array(z.string().trim().min(1)).max(20).optional(),
    }),
    req.body,
  );
  ok(res, await prisma.user.update({ where: { id: req.user!.id }, data, select: safeUser }));
});

export default r;
