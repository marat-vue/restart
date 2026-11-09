"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { motion, MotionConfig, useSpring, useTransform } from "motion/react";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion";

export function MotionPreferences({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

/** Главный экран: тихая сетка и небольшой геометрический знак вместо анимированного фона. */
export function HeroScene({ children }: { children: ReactNode }) {
  return <section className="hero-scene relative isolate overflow-hidden border-b">
    <div className="hero-backdrop grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
    <div className="hero-mark hidden md:grid" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => <i key={i} />)}
    </div>
    {children}
  </section>;
}

/** Появление при прокрутке; экспортированный HTML остаётся видимым без JavaScript. */
export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotionPreference();
  return <motion.div className={className} initial={false}
    whileInView={reduced ? { opacity: 1 } : { opacity: [0, 1], y: [14, 0] }}
    viewport={{ once: true, amount: 0.08 }}
    transition={{ duration: reduced ? 0 : 0.45, delay: reduced ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}>
    {children}
  </motion.div>;
}

export function SectionCard({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="section-card group relative flex min-h-60 flex-col border-b border-r p-6 sm:p-7">
    {children}
  </Link>;
}

export function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const reduced = useReducedMotionPreference();
  const current = useSpring(0, { stiffness: 65, damping: 24 });
  const display = useTransform(current, (n) => Math.round(n).toString() + suffix);
  useEffect(() => {
    if (reduced) current.jump(value); else current.set(value);
  }, [value, suffix, current, reduced]);
  return <span className="tabular-nums" aria-label={value + suffix}><motion.span aria-hidden="true">{display}</motion.span></span>;
}
