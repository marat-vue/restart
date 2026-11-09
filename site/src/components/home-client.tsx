"use client";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRightIcon, BookOpenIcon, ListTreeIcon } from "lucide-react";
import { useAppSelector, useHydrated } from "@/store/hooks";
import { useCompletion } from "@/hooks/use-progress";
import { activityByDay, streak } from "@/lib/stats";
import { plural } from "@/lib/date";
import { AnimatedNumber } from "@/components/visual-effects";

function Stat({ value, label, sub }: { value: React.ReactNode; label: string; sub: string }) {
  return <div className="home-stat min-w-0 border-l pl-4 first:border-l-0 first:pl-0 sm:pl-6 sm:first:pl-0">
    <div className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{value}</div>
    <div className="label mt-2 whitespace-nowrap">{label}</div><div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sub}</div>
  </div>;
}
export function HomeStats({ allIds }: { allIds: string[] }) {
  const hydrated = useHydrated();
  const { done, total } = useCompletion(allIds);
  const progress = useAppSelector((s) => s.progress);
  const days = useMemo(() => streak(activityByDay(progress)), [progress]);
  return <div className="flex gap-0">
    <Stat value={<AnimatedNumber value={hydrated ? done : 0} />} label="Изучено" sub={`из ${total} заметок`} />
    <Stat value={<AnimatedNumber value={hydrated ? Math.round(done / Math.max(1, total) * 100) : 0} suffix="%" />} label="Пройдено" sub="в своём темпе" />
    <Stat value={<AnimatedNumber value={hydrated ? days : 0} />} label="Серия" sub={plural(days, ["день подряд", "дня подряд", "дней подряд"])} />
  </div>;
}
export function ContinueCard() {
  const last = useAppSelector((s) => s.progress.last);
  return <div className="grid grid-cols-1 gap-px border bg-border sm:grid-cols-2">
    <Link href={last?.href ?? "/l/01/01/"} className="continue-link continue-primary group flex items-center gap-4 p-5">
      <span className="continue-icon grid size-10 shrink-0 place-items-center border"><BookOpenIcon className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="label block">{last ? "Продолжить чтение" : "Начать обучение"}</span>
        <span className="mt-1 block truncate font-medium">{last?.title ?? "Платформа 1С"}</span></span>
      <ArrowRightIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
    </Link>
    <Link href="/l/00/" className="continue-link group flex items-center gap-4 p-5">
      <span className="continue-icon grid size-10 shrink-0 place-items-center border"><ListTreeIcon className="size-4" /></span>
      <span className="min-w-0 flex-1"><span className="label block">Маршрут обучения</span><span className="mt-1 block font-medium">От первого справочника до junior+</span></span>
      <ArrowRightIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
    </Link>
  </div>;
}
