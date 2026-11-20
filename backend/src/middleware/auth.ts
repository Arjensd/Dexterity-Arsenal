import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { forbidden, unauthorized } from "../lib/errors";
import type { Role, User } from "../generated/prisma/client";

export type AuthUser = Pick<User, "id" | "name" | "email" | "role" | "isVerified">;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn } as jwt.SignOptions);

async function userFromHeader(req: Request): Promise<AuthUser | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as { sub: string };
    return await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, name: true, email: true, role: true, isVerified: true },
    });
  } catch {
    return null;
  }
}

/** Requires a valid Bearer token. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const user = await userFromHeader(req);
  if (!user) throw unauthorized("Missing or invalid token");
  req.user = user;
  next();
}

/** Attaches req.user when a valid token is present, otherwise continues anonymously. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = (await userFromHeader(req)) ?? undefined;
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!roles.includes(req.user.role)) {
      throw forbidden(`This action requires one of these roles: ${roles.join(", ")}`);
    }
    next();
  };
