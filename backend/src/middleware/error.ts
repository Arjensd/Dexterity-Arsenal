import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../lib/errors";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res
      .status(err.status)
      .json({ success: false, error: { message: err.message, details: err.details } });
  }
  console.error(err);
  res.status(500).json({ success: false, error: { message: "Internal server error" } });
}
