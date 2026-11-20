# Dexterity Arsenal - Member 2 (Md. Jubair Hossain)

| Module | Feature | Status |
|---|---|---|
| Module 1 | **#2 Session Scheduling & Calendar Integration** | Backend + UI + Postman |
| Module 2 | **#2 Live Course Subscription Model** | Backend + UI + Postman |

```
dexterity-arsenal/
├── backend/    Node.js + Express + TypeScript + Prisma 7 + PostgreSQL
│   ├── prisma/ schema.prisma, seed.ts
│   ├── src/    routes/, services/ (Google Calendar, payments), middleware/, lib/
│   └── postman/  Dexterity-Arsenal.postman_collection.json  +  POSTMAN-GUIDE.md
└── frontend/   Next.js 15 (App Router) + TypeScript + Tailwind v4
```

---

## 1. Run it (about 5 minutes)

**You need:** Node.js 20+ (22 recommended) and PostgreSQL 14+.

### Step 1 - Create the database
```bash
psql -U postgres -c "CREATE DATABASE dexterity;"
```

### Step 2 - Backend
```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL if your Postgres password is not "postgres"
npm install
npm run setup                 # = prisma generate + prisma db push + seed demo data
npm run dev                   # API on http://localhost:4000
```
Check: open http://localhost:4000/api/health - you should see `{"success":true,...}`.

> `prisma generate` / `db push` download Prisma's engine on first run, so you need internet once.
> Prefer migration files? Use `npx prisma migrate dev --name init` instead of `db push`.

### Step 3 - Frontend (new terminal)
```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev                   # http://localhost:3000
```

### Demo accounts (all use password `Password123!`)
| Email | Role |
|---|---|
| learner@dexterity.test | Learner (Lina) |
| learner2@dexterity.test | Learner (Omar) |
| jubair@dexterity.test | Instructor - verified, has slots + the Full-Stack course |
| nusrat@dexterity.test / tanvir@dexterity.test | Instructors - verified |
| pending@dexterity.test | Instructor - **not** verified (for the admin demo) |
| admin@dexterity.test | Admin |

The login page has one-click buttons for Learner / Instructor / Admin.
Re-run `npm run seed` at any time to reset all demo data.

---

## 2. What was built (mapped to the requirements doc)

### Module 1 / Feature 2 - Session Scheduling & Calendar Integration
| Requirement | How it is implemented |
|---|---|
| Learners book 1-on-1 or group sessions | `ONE_ON_ONE` / `GROUP` slots with a capacity; `POST /sessions/slots/:id/book` |
| Online or offline | `ONLINE` (Google Meet link) or `OFFLINE` (address) - the "Session Type" panel in the design |
| Integrated with Google Calendar API | `services/googleCalendar.ts` creates the event + Meet link, adds/removes attendees on book/cancel, deletes on slot cancel |
| Availability updates dynamically; only open slots bookable | Slots carry `spotsLeft / isFull / available`; the UI greys out Full / Booked slots and refreshes after every booking |
| No double booking | Overlap checks (instructor-vs-instructor, learner-vs-learner, instructor-vs-own-bookings) + Postgres advisory locks so simultaneous requests cannot over-book |
| Notifications | In-app bell notifications for booking, cancellation, new subscriber, etc. |

### Module 2 / Feature 2 - Live Course Subscription Model
| Requirement | How it is implemented |
|---|---|
| Recurring monthly subscription | `Subscription` with 30-day periods; auto-renews unless cancelled |
| Live sessions, downloadable resources, priority Q&A | Gated per plan: classes (all plans), resources (`hasResources`), priority Q&A (`hasPriorityQA`) |
| Basic / Pro / Max tiers ($9.99 / $14.99 / $24.99 in the design) | `SubscriptionPlan` per course, instructor sets price + perks |
| Subscribe, upgrade/downgrade, cancel | `checkout`, `PATCH /:id/plan`, `cancel` (keeps access to period end), `resume` |
| Instructor tools | Schedule classes (auto Jitsi link), add resources, answer a priority-sorted Q&A queue, subscriber list + MRR |

### Things I added so your two features can run on their own
Minimal **auth** (register/login/JWT, swappable Learner <-> Instructor role), **instructor verification** by admin (only verified instructors are searchable), and **notifications**. Your teammates will replace/extend these with the full versions of the "common workflows"; the tables are intentionally small.

---

## 3. Mock vs. real integrations
| Integration | Default (no setup) | Real mode |
|---|---|---|
| Google Calendar | **Mock** - fake event IDs + fake `meet.google.com` links, logged to the console | Fill `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` in `.env` (see below) |
| Payments | **Mock checkout page** (`/checkout/:id`); card `4242...` succeeds, `4000 0000 0000 0002` is declined | Set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`; users are redirected to Stripe Checkout and the webhook `/api/subscriptions/webhook` activates them |

`GET /api/health` tells you which mode is active (`googleCalendar`, `payments`).

**Getting Google credentials:** Google Cloud Console -> create a project -> enable *Google Calendar API* -> OAuth consent screen -> create an *OAuth client ID* (Web) with redirect `https://developers.google.com/oauthplayground` -> open the OAuth Playground, use your own client ID/secret (gear icon), authorise scope `https://www.googleapis.com/auth/calendar.events`, exchange the code, and copy the **refresh token**. Events are created on the calendar identified by `GOOGLE_CALENDAR_ID` (default `primary`).

---

## 4. Connecting the features with Postman - full walkthrough
See **`backend/postman/POSTMAN-GUIDE.md`** (step by step, with the expected result of every request).
Quick version: import `backend/postman/Dexterity-Arsenal.postman_collection.json`, start the backend, and run the folders **in order** (0 -> 1 -> 2 -> 3). Every request has automated tests and stores tokens / IDs in collection variables for the next request.

---

## 5. API cheat-sheet (base URL `http://localhost:4000/api`)
| Method & path | Who | Purpose |
|---|---|---|
| POST `/auth/register`, `/auth/login` · GET `/auth/me` · PATCH `/auth/role` | any | Auth + role swap |
| GET `/instructors`, `/instructors/:id` | public | Verified instructors |
| **POST `/sessions/slots`** | instructor | Publish availability (conflict-checked, Calendar event + Meet link) |
| GET `/sessions/slots/mine` | instructor | My slots + attendees |
| DELETE `/sessions/slots/:id` | instructor | Cancel slot (notifies booked learners) |
| **GET `/sessions/slots?instructorId=&from=&to=&mode=&availableOnly=`** | public | Live availability |
| **POST `/sessions/slots/:id/book`** | learner | Book (capacity + clash safe) |
| GET `/sessions/bookings/mine` · PATCH `/sessions/bookings/:id/cancel` | learner | My bookings / cancel |
| GET `/sessions/calendar/status` | public | `mock` or `google` |
| GET `/live-courses` · `/live-courses/:id` | public | Browse / detail with plans |
| POST `/live-courses` · PATCH `/live-courses/:id` | instructor | Create / edit course + tiers |
| POST/GET `/live-courses/:id/classes` | instructor / subscriber | Live classes (links hidden from non-subscribers) |
| POST/GET `/live-courses/:id/resources` | instructor / subscriber | Resources (locked unless plan allows) |
| POST/GET `/live-courses/:id/questions` · PATCH `.../:qid/answer` | subscriber / instructor | Q&A (priority first) |
| GET `/live-courses/:id/subscribers` | instructor | Subscribers + MRR |
| **POST `/subscriptions/checkout`** | learner | Choose a plan -> checkout URL |
| POST `/subscriptions/:id/confirm-mock` | learner | Mock payment (mock mode only) |
| GET `/subscriptions` · PATCH `/:id/plan` · POST `/:id/cancel` · POST `/:id/resume` | learner | Manage subscription |
| GET `/admin/instructors/pending` · PATCH `/admin/instructors/:id/verify` | admin | Verify instructors |
| GET `/notifications` · POST `/notifications/read-all` | any | The bell |

All responses: `{ "success": true, "data": ... }` or `{ "success": false, "error": { "message", "details?" } }`.

---

## 6. Troubleshooting
| Symptom | Fix |
|---|---|
| `Can't reach database server` | Postgres isn't running, or `DATABASE_URL` in `backend/.env` is wrong |
| `Missing required env var: DATABASE_URL` | You forgot `cp .env.example .env` |
| Frontend says "Cannot reach the server" | Backend isn't running on port 4000, or `NEXT_PUBLIC_API_URL` is wrong |
| CORS error in browser | `CLIENT_URL` in `backend/.env` must equal the frontend origin (default `http://localhost:3000`) |
| Postman: 401 everywhere | Run folder **0. Setup & Login** first |
| Postman: slot creation 409 | A previous run left a slot at that time - re-run (dates are random) or `npm run seed` to reset |
| Prisma "client not generated" | `npm run prisma:generate` |
