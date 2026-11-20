/**
 * Demo data. WARNING: wipes all tables first. Run with:  npm run seed
 * Every account uses the password:  Password123!
 */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

const PASSWORD = "Password123!";
const DAY = 86_400_000;

/** Build a Date for "N days from today at HH:MM Asia/Dhaka (UTC+6)". */
function dhaka(dayOffset: number, hh: number, mm = 0) {
  const base = new Date(Date.now() + dayOffset * DAY);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hh - 6, mm));
}

async function main() {
  await prisma.$transaction([
    prisma.courseQuestion.deleteMany(), prisma.courseResource.deleteMany(), prisma.liveClass.deleteMany(),
    prisma.subscription.deleteMany(), prisma.subscriptionPlan.deleteMany(), prisma.liveCourse.deleteMany(),
    prisma.sessionBooking.deleteMany(), prisma.availabilitySlot.deleteMany(),
    prisma.notification.deleteMany(), prisma.user.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  type UserSeed = Omit<Parameters<typeof prisma.user.create>[0]["data"], "passwordHash">;
  const mk = (data: UserSeed) => prisma.user.create({ data: { ...data, passwordHash } as Parameters<typeof prisma.user.create>[0]["data"] });

  await mk({ name: "Platform Admin", email: "admin@dexterity.test", role: "ADMIN", isVerified: true });
  const learner = await mk({ name: "Lina Rahman", email: "learner@dexterity.test", phone: "01700000001", role: "LEARNER" });
  const learner2 = await mk({ name: "Omar Faruk", email: "learner2@dexterity.test", phone: "01700000002", role: "LEARNER" });

  const jubair = await mk({
    name: "Jubair Hossain Nahin", email: "jubair@dexterity.test", phone: "01700000010", role: "INSTRUCTOR", isVerified: true,
    headline: "Full-Stack Developer", ratingAvg: 4.9, ratingCount: 3284,
    bio: "8 years building production web apps. I mentor beginners into job-ready developers.",
    skills: ["React", "HTML", "Python", "JavaScript", "Node.js"],
  });
  const nusrat = await mk({
    name: "Nusrat Jahan", email: "nusrat@dexterity.test", phone: "01700000011", role: "INSTRUCTOR", isVerified: true,
    headline: "Data Scientist", ratingAvg: 4.8, ratingCount: 1210,
    bio: "Applied ML engineer. Love turning messy data into decisions.",
    skills: ["Python", "Pandas", "Machine Learning", "SQL"],
  });
  const tanvir = await mk({
    name: "Tanvir Ahmed", email: "tanvir@dexterity.test", phone: "01700000012", role: "INSTRUCTOR", isVerified: true,
    headline: "Product Designer", ratingAvg: 4.7, ratingCount: 642,
    bio: "Design systems, UX research and Figma power-user.",
    skills: ["Figma", "UX Research", "Design Systems"],
  });
  // Unverified instructor - used in the admin-verification Postman walkthrough.
  await mk({ name: "Pending Instructor", email: "pending@dexterity.test", role: "INSTRUCTOR", isVerified: false, headline: "Awaiting verification", skills: ["Go"] });

  // ── Availability slots: next 14 days ──
  for (let d = 1; d <= 14; d++) {
    const dow = new Date(Date.now() + d * DAY).getUTCDay(); // 5 = Fri (weekend in BD)
    const slots: Parameters<typeof prisma.availabilitySlot.create>[0]["data"][] = [];
    if (dow !== 5) {
      slots.push(
        { instructorId: jubair.id, title: "Code Review & Mentoring", startsAt: dhaka(d, 8), endsAt: dhaka(d, 10), mode: "ONLINE" },
        { instructorId: jubair.id, title: "Career Guidance Call", startsAt: dhaka(d, 10, 30), endsAt: dhaka(d, 12, 30), mode: "ONLINE" },
        { instructorId: jubair.id, title: "In-person Pair Programming", startsAt: dhaka(d, 16), endsAt: dhaka(d, 18), mode: "OFFLINE", address: "Banani Road 11, Dhaka" },
        { instructorId: jubair.id, title: "Evening Mentoring", startsAt: dhaka(d, 19), endsAt: dhaka(d, 21), mode: "ONLINE" },
      );
    }
    if (d % 3 === 0) {
      slots.push({ instructorId: jubair.id, title: "Live Workshop: Build a REST API", startsAt: dhaka(d, 22), endsAt: dhaka(d, 23, 30), mode: "ONLINE", format: "GROUP", capacity: 10 });
    }
    if (d % 2 === 0) {
      slots.push({ instructorId: nusrat.id, title: "Data Science Q&A", startsAt: dhaka(d, 15), endsAt: dhaka(d, 16), mode: "ONLINE" });
      slots.push({ instructorId: tanvir.id, title: "Portfolio Review", startsAt: dhaka(d, 14), endsAt: dhaka(d, 15, 30), mode: "OFFLINE", address: "Gulshan 2, Dhaka" });
    }
    for (const s of slots) {
      await prisma.availabilitySlot.create({
        data: {
          ...s, capacity: s.capacity ?? 1,
          googleEventId: `mock_seed_${Math.random().toString(16).slice(2)}`,
          meetLink: s.mode === "ONLINE" ? `https://meet.google.com/abc-${Math.random().toString(36).slice(2, 6)}-xyz` : null,
        },
      });
    }
  }

  // ── Live courses ──
  const plan = (tier: "BASIC" | "PRO" | "MAX", price: number, features: string[], hasResources: boolean, hasPriorityQA: boolean) => ({
    tier, name: `${tier[0]}${tier.slice(1).toLowerCase()} Plan`, priceCents: Math.round(price * 100), features, hasResources, hasPriorityQA,
  });

  const fullstack = await prisma.liveCourse.create({
    data: {
      instructorId: jubair.id, title: "Full-Stack Development Course", coverColor: "violet",
      description: "Master Full Stack Development in 8 weeks! Learn modern front-end and back-end technologies, build responsive web applications, work with databases, and deploy real-world projects. Perfect for aspiring developers who want practical, hands-on experience and the confidence to build complete web applications from scratch.",
      whatYouGet: ["Weekly live classes with screen-sharing and code-alongs", "Real-world projects deployed to production", "Direct feedback on your code", "Certificate of completion", "Access to a private community"],
      faqs: [
        { q: "Do I need prior experience?", a: "No. We start from HTML/CSS basics and ramp up quickly." },
        { q: "Can I switch plans later?", a: "Yes, upgrade or downgrade any time from your Subscriptions page." },
        { q: "What if I miss a live class?", a: "Recordings are shared with every subscriber after each class." },
      ],
      skills: ["React", "HTML", "Python", "JavaScript", "Node.js"],
      plans: { create: [
        plan("BASIC", 9.99, ["Weekly live classes", "Class recordings"], false, false),
        plan("PRO", 14.99, ["Everything in Basic", "Downloadable resources & source code"], true, false),
        plan("MAX", 24.99, ["Everything in Pro", "Priority Q&A with the instructor", "Monthly 1:1 code review"], true, true),
      ] },
    },
  });
  for (let i = 0; i < 6; i++) {
    await prisma.liveClass.create({ data: {
      courseId: fullstack.id, title: ["HTML & CSS Foundations", "JavaScript Deep Dive", "React Components & State", "Node.js & Express APIs", "PostgreSQL & Prisma", "Deploying to Production"][i],
      description: `Week ${i + 1} live session`, startsAt: dhaka(2 + i * 7, 20), durationMin: 90,
      meetingLink: `https://meet.jit.si/DexterityArsenal-fullstack-week${i + 1}`,
    } });
  }
  await prisma.courseResource.createMany({ data: [
    { courseId: fullstack.id, title: "Week 1 Slides & Starter Code", fileUrl: "https://example.com/resources/week1.zip", fileType: "zip" },
    { courseId: fullstack.id, title: "React Cheat Sheet", fileUrl: "https://example.com/resources/react-cheatsheet.pdf", fileType: "pdf" },
    { courseId: fullstack.id, title: "REST API Project Template", fileUrl: "https://example.com/resources/api-template.zip", fileType: "zip" },
  ] });

  await prisma.liveCourse.create({
    data: {
      instructorId: nusrat.id, title: "Data Science with Python", coverColor: "indigo",
      description: "A live, project-driven path from Python basics to your first machine-learning models. Clean data, explore it, visualise it and ship predictions.",
      whatYouGet: ["Live weekly cohort sessions", "Kaggle-style projects", "Model deployment walkthroughs"],
      faqs: [{ q: "Is maths required?", a: "High-school level is enough to begin." }],
      skills: ["Python", "Pandas", "Machine Learning"],
      plans: { create: [
        plan("BASIC", 12.99, ["Weekly live sessions"], false, false),
        plan("PRO", 19.99, ["Live sessions", "Notebooks & datasets"], true, false),
        plan("MAX", 29.99, ["Everything in Pro", "Priority Q&A"], true, true),
      ] },
      classes: { create: [{ title: "Intro to Pandas", startsAt: dhaka(4, 20), durationMin: 60, meetingLink: "https://meet.jit.si/DexterityArsenal-ds-1" }] },
    },
  });
  await prisma.liveCourse.create({
    data: {
      instructorId: tanvir.id, title: "UI/UX Design Bootcamp", coverColor: "fuchsia",
      description: "Learn user research, wireframing and high-fidelity design in Figma with live critique every week.",
      whatYouGet: ["Live design critiques", "Figma templates", "Portfolio feedback"],
      faqs: [], skills: ["Figma", "UX Research"],
      plans: { create: [
        plan("BASIC", 8.99, ["Weekly live critique"], false, false),
        plan("PRO", 13.99, ["Critique", "Figma template library"], true, false),
      ] },
      classes: { create: [{ title: "Design Thinking Kickoff", startsAt: dhaka(3, 19), durationMin: 75, meetingLink: "https://meet.jit.si/DexterityArsenal-ux-1" }] },
    },
  });

  console.log("Seeded. Accounts (password: " + PASSWORD + "):");
  console.log("  admin@dexterity.test | learner@dexterity.test | learner2@dexterity.test");
  console.log("  jubair@dexterity.test | nusrat@dexterity.test | tanvir@dexterity.test | pending@dexterity.test");
  void learner; void learner2;
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
