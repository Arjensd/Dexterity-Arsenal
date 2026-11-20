export type Role = "LEARNER" | "INSTRUCTOR" | "ADMIN";
export type Tier = "BASIC" | "PRO" | "MAX";

export interface User {
  id: string; name: string; email: string; role: Role; headline?: string | null; bio?: string | null;
  skills: string[]; isVerified: boolean; ratingAvg: number; ratingCount: number; avatarUrl?: string | null;
}
export interface PublicUser {
  id: string; name: string; headline: string | null; bio: string | null; avatarUrl: string | null;
  skills: string[]; ratingAvg: number; ratingCount: number; isVerified: boolean;
}
export interface InstructorDetail extends PublicUser {
  liveCourses: { id: string; title: string; coverColor: string; fromPrice: number | null }[];
}

export interface Slot {
  id: string; instructorId: string; title: string; description: string | null;
  startsAt: string; endsAt: string; mode: "ONLINE" | "OFFLINE"; format: "ONE_ON_ONE" | "GROUP";
  capacity: number; address: string | null; meetLink: string | null; status: string;
  bookedCount: number; spotsLeft: number; isFull: boolean; isPast: boolean; bookedByMe: boolean; available: boolean;
  attendees?: { id: string; name: string; email: string; note: string | null }[];
}
export interface MyBooking {
  id: string; status: string; note: string | null; session: Slot;
  instructor: { id: string; name: string; headline: string | null; avatarUrl: string | null };
}

export interface Plan {
  id: string; tier: Tier; name: string; price: number; priceCents: number; currency: string;
  hasResources: boolean; hasPriorityQA: boolean; features: string[];
}
export interface CourseCard {
  id: string; title: string; description: string; skills: string[]; coverColor: string;
  instructor: PublicUser; fromPrice: number | null; classCount: number;
}
export interface CourseDetail {
  id: string; title: string; description: string; whatYouGet: string[]; faqs: { q: string; a: string }[];
  skills: string[]; coverColor: string; status: string; instructor: PublicUser; plans: Plan[];
  subscriberCount: number; isOwner: boolean;
  classes: { id: string; title: string; startsAt: string; durationMin: number }[];
  mySubscription: null | { id: string; planId: string; tier: Tier; planName: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean };
}
export interface MySubscription {
  id: string; status: string; isActive: boolean; state: "PENDING" | "ACTIVE" | "CANCELING" | "ENDED";
  currentPeriodStart: string | null; currentPeriodEnd: string | null; daysLeft: number; cancelAtPeriodEnd: boolean;
  plan: { id: string; tier: Tier; name: string; price: number; currency: string; hasResources: boolean; hasPriorityQA: boolean };
  course: { id: string; title: string; coverColor: string };
}
export interface LiveClass { id: string; title: string; description: string | null; startsAt: string; durationMin: number; meetingLink: string }
export interface Resource { id: string; title: string; description: string | null; fileUrl: string | null; fileType: string | null; locked: boolean }
export interface Question { id: string; body: string; isPriority: boolean; answer: string | null; answeredAt: string | null; createdAt: string; learner: { id: string; name: string } }
export interface Notification { id: string; title: string; body: string; read: boolean; createdAt: string }
