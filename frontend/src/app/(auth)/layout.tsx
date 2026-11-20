import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="absolute -right-32 -top-32 h-[480px] w-[480px] rounded-full bg-gradient-to-br from-primary-light/50 to-transparent" />
      <div aria-hidden className="absolute -bottom-48 -left-24 h-[460px] w-[460px] rounded-full bg-gradient-to-t from-primary-light/50 to-transparent" />
      <div className="relative w-full max-w-[460px]">
        <Link href="/" className="mb-8 flex justify-center"><Logo size={48} /></Link>
        <div className="rounded-[32px] bg-white p-8 shadow-pop sm:p-10">{children}</div>
        <p className="mt-6 text-center text-sm font-medium text-primary">Learn. Teach. Grow Together.</p>
      </div>
    </div>
  );
}
