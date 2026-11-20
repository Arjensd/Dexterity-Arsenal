import { z, ZodError, ZodTypeAny } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (m: string, d?: unknown) => new HttpError(400, m, d);
export const unauthorized = (m = "Authentication required") => new HttpError(401, m);
export const forbidden = (m = "You do not have permission to do this") => new HttpError(403, m);
export const notFound = (m = "Not found") => new HttpError(404, m);
export const conflict = (m: string) => new HttpError(409, m);

/** Validate with zod, throwing a 422 with readable field errors. */
export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.output<S> {
  const r = schema.safeParse(data);
  if (!r.success) throw zodToHttp(r.error);
  return r.data;
}

export function zodToHttp(e: ZodError) {
  const details = e.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
  return new HttpError(422, "Validation failed", details);
}
