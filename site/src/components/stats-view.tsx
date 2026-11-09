"use client";
import Link from "next/link";
import { useMemo } from "react";
import { useAppSelector, useHydrated } from "@/store/hooks";
import { activityByDay, streak } from "@/lib/stats";
import { dayKey, plural } from "@/lib/date";
import { CompletionBar, CompletionPct } from "./progress-bits";
import { cn } from "@/lib/utils";

interface Section { id: string; num: string | null; title: string; href: string; ids: string[] }
const WEEKS = 53;
const MONTHS = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
function Big({ value, label, sub }: { value: React.ReactNode; label: string; sub: string }) {
  return <div className="border-b border-r p-6"><div className="label">{label}</div>
    <div className="mt-4 font-display text-4xl font-semibold tabular-nums sm:text-5xl">{value}</div>
    <div className="mt-1 text-xs text-muted-foreground">{sub}</div></div>;
}
export function StatsView({ sections, total }: { sections: Section[]; total: number }) {
  const hydrated = useHydrated();
  const progress = useAppSelector((s) => s.progress);
  const validIds = useMemo(() => new Set(sections.flatMap((s) => s.ids)), [sections]);
  const data = useMemo(() => {
    const current = { ...progress, lessons: Object.fromEntries(Object.entries(progress.lessons).filter(([id]) => validIds.has(id))) };
    const activity = activityByDay(current);
    const completed = Object.values(current.lessons).filter((p) => p.c).length;
    const visited = Object.values(current.lessons).filter((p) => p.v).length;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - (today.getDay() + 6) % 7 - (WEEKS - 1) * 7);
    const weeks = Array.from({ length: WEEKS }, (_, w) => Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start); date.setDate(start.getDate() + w * 7 + d);
      return { key: dayKey(date.getTime()), date, count: activity.get(dayKey(date.getTime())) ?? 0, future: date > today };
    }));
    const max = Math.max(1, ...activity.values());
    return { completed, visited, weeks, max, streak: streak(activity) };
  }, [progress, validIds]);
  const v = (n: React.ReactNode) => hydrated ? n : "–";
  const levels = ["bg-muted", "bg-foreground/25", "bg-foreground/50", "bg-foreground/75", "bg-foreground"];
  return <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
    <div className="label">Ваш прогресс</div><h1 className="mt-3 text-5xl font-semibold uppercase sm:text-7xl">Статистика</h1>
    <div className="mt-12 grid border-l border-t sm:grid-cols-2 lg:grid-cols-4">
      <Big label="Изучено заметок" value={v(data.completed)} sub={`из ${total} · ${Math.round(data.completed / Math.max(1, total) * 100)}%`} />
      <Big label="Открыто заметок" value={v(data.visited)} sub="включая изученные" />
      <Big label="Осталось изучить" value={v(Math.max(0, total - data.completed))} sub="двигайтесь в своём темпе" />
      <Big label="Серия" value={v(data.streak)} sub={plural(data.streak, ["день подряд", "дня подряд", "дней подряд"])} />
    </div>
    <section className="mt-16">
      <div className="flex flex-wrap items-end justify-between gap-2"><h2 className="text-2xl font-semibold">Активность</h2><span className="label">Последние 12 месяцев</span></div>
      <p className="mt-2 text-sm text-muted-foreground">Каждая отметка «изучено» попадает в календарь.</p>
      <div className="mt-6 overflow-x-auto border p-5 thin-scrollbar">
        <div className="grid min-w-[640px] gap-[3px]" style={{ gridTemplateColumns: `repeat(${WEEKS}, minmax(0, 1fr))` }}>
          {data.weeks.map((col, i) => <div key={i} className="flex min-w-0 flex-col gap-[3px]">
            <div className="relative h-4"><span className="absolute left-0 top-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">{col[0].date.getDate() <= 7 ? MONTHS[col[0].date.getMonth()] : ""}</span></div>
            {col.map((d) => <div key={d.key} title={`${d.date.toLocaleDateString("ru")}: ${d.count} изучено`}
              className={cn("aspect-square w-full", d.future ? "bg-transparent" : !hydrated ? "bg-muted" : levels[d.count === 0 ? 0 : Math.min(4, Math.ceil(d.count / data.max * 4))])} />)}
          </div>)}
        </div>
        <div className="mt-4 flex items-center justify-end gap-1.5 font-mono text-[10px] text-muted-foreground">меньше{levels.map((c) => <span key={c} className={cn("size-[11px]", c)} />)}больше</div>
      </div>
    </section>
    <section className="mt-16"><h2 className="text-2xl font-semibold">По разделам</h2><div className="mt-6 border-t">
      {sections.map((s) => <Link key={s.id} href={s.href} className="group grid grid-cols-[2rem_1fr_3rem] items-center gap-4 border-b py-4 hover:bg-muted/40 sm:grid-cols-[2rem_minmax(0,20rem)_1fr_3rem]">
        <span className="font-mono text-xs text-faint">{s.num}</span><span className="font-medium">{s.title}</span>
        <CompletionBar ids={s.ids} className="hidden h-[3px] sm:block" /><CompletionPct ids={s.ids} className="text-right text-sm" />
      </Link>)}
    </div></section>
  </main>;
}
