import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env, googleConfigured, stripeConfigured } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error";
import { ok } from "./lib/http";
import authRoutes from "./routes/auth";
import instructorRoutes from "./routes/instructors";
import adminRoutes from "./routes/admin";
import notificationRoutes from "./routes/notifications";
import sessionRoutes from "./routes/sessions";
import liveCourseRoutes from "./routes/liveCourses";
import subscriptionRoutes, { stripeWebhook } from "./routes/subscriptions";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.clientUrl.split(","), credentials: true }));
if (env.nodeEnv !== "test") app.use(morgan("dev"));

// Stripe needs the raw body for signature verification - must come BEFORE express.json().
app.post("/api/subscriptions/webhook", express.raw({ type: "application/json" }), stripeWebhook);
app.use(express.json());

app.get("/api/health", (_req, res) =>
  ok(res, {
    status: "up",
    time: new Date().toISOString(),
    googleCalendar: googleConfigured ? "google" : "mock",
    payments: stripeConfigured ? "stripe" : "mock",
  }),
);

app.use("/api/auth", authRoutes);
app.use("/api/instructors", instructorRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/live-courses", liveCourseRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

app.use(notFoundHandler);
app.use(errorHandler);
