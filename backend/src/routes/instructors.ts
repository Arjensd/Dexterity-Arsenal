import { Router } from "express";
import { prisma } from "../lib/prisma";
import { notFound } from "../lib/errors";
import { ok } from "../lib/http";
import { publicUser } from "../lib/util";

const r = Router();

// Only VERIFIED instructors appear in search (common workflow #2).
r.get("/", async (req, res) => {
  const q = String(req.query.q ?? "").trim().toLowerCase();
  const all = await prisma.user.findMany({
    where: { role: "INSTRUCTOR", isVerified: true },
    select: publicUser,
    orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
  });
  const list = q
    ? all.filter((u) =>
        [u.name, u.headline ?? "", ...u.skills].some((s) => s.toLowerCase().includes(q)),
      )
    : all;
  ok(res, list);
});

r.get("/:id", async (req, res) => {
  const instructor = await prisma.user.findFirst({
    where: { id: String(req.params.id), role: "INSTRUCTOR" },
    select: {
      ...publicUser,
      courses: {
        where: { status: "PUBLISHED" },
        select: { id: true, title: true, coverColor: true, plans: { select: { priceCents: true } } },
      },
    },
  });
  if (!instructor) throw notFound("Instructor not found");
  const { courses, ...rest } = instructor;
  ok(res, {
    ...rest,
    liveCourses: courses.map((c) => ({
      id: c.id, title: c.title, coverColor: c.coverColor,
      fromPrice: c.plans.length ? Math.min(...c.plans.map((p) => p.priceCents)) / 100 : null,
    })),
  });
});

export default r;
