"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowLeftIcon, ChevronDownIcon, ImageIcon, SearchIcon } from "lucide-react";
import { answerOf, correctChance, isLeech, scheduler, statusOf, type CardStatus } from "@/lib/exam/scheduler";
import type { ExamBank } from "@/lib/exam/types";
import { cn } from "@/lib/utils";
import { Insights } from "./insights";
import { OptionList, QuestionBody, StatusBadge, useExam } from "./common";

type Filter = "all" | CardStatus | "leech" | "marked" | "disputed" | "notes" | "suspended";
const FILTERS: [Filter, string][] = [
  ["all", "Все"], ["new", "Новые"], ["learning", "Изучаются"], ["young", "Повторяются"], ["mature", "Выучены"],
  ["leech", "Трудные"], ["marked", "Отмеченные"], ["notes", "С заметкой"], ["disputed", "Спорные"], ["suspended", "Исключённые"],
];
const PAGE = 60;
const norm = (s: string) => s.toLowerCase().replace(/ё/g, "е");

export function ExamBankView({ bank }: { bank: ExamBank }) {
  const exam = useExam();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<number | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const q = useDeferredValue(query);
  const [now] = useState(Date.now);

  const list = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    return bank.questions.filter((x) => {
      if (topic !== null && x.topic !== topic) return false;
      const c = exam.cards[x.id];
      if (filter === "leech" && !isLeech(c)) return false;
      if (filter === "marked" && !exam.marked[x.id]) return false;
      if (filter === "notes" && !exam.notes[x.id]) return false;
      if (filter === "disputed" && !x.disputed && exam.overrides[x.id] === undefined) return false;
      if (filter === "suspended" && !exam.suspended[x.id]) return false;
      if (["new", "learning", "young", "mature"].includes(filter) && statusOf(c) !== filter) return false;
      if (!words.length) return true;
      const hay = norm(`${x.id} ${x.text} ${x.options.join(" ")} ${exam.notes[x.id] ?? ""}`);
      return words.every((w) => hay.includes(w));
    });
  }, [bank, exam, q, topic, filter]);
  const f = useMemo(() => scheduler(exam.settings), [exam.settings]);

  return <main className="mx-auto w-full max-w-[1100px] flex-1 px-4 py-8 sm:px-6 sm:py-12">
    <Link href="/exam/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" />Экзамен</Link>
    <h1 className="mt-4 text-4xl font-semibold uppercase sm:text-6xl">Банк вопросов</h1>

    <div className="mt-8 grid gap-3">
      <label className="flex h-10 items-center gap-2 border bg-card px-3 focus-within:border-foreground/60">
        <SearchIcon className="size-4 text-muted-foreground" />
        <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Поиск по вопросам, вариантам и заметкам"
          className="h-full flex-1 bg-transparent text-sm outline-none" aria-label="Поиск по банку вопросов" />
        <span className="font-mono text-xs text-muted-foreground tabular-nums">{list.length}</span>
      </label>
      <div className="flex flex-wrap gap-1.5">
        <select value={topic ?? ""} onChange={(e) => { setTopic(e.target.value ? Number(e.target.value) : null); setLimit(PAGE); }}
          className="h-8 max-w-full border bg-background px-2 text-sm" aria-label="Тема">
          <option value="">Все темы</option>
          {bank.topics.map((t) => <option key={t.id} value={t.id}>{t.id}. {t.title}</option>)}
        </select>
        {FILTERS.map(([k, l]) => <button key={k} type="button" onClick={() => { setFilter(k); setLimit(PAGE); }} aria-pressed={filter === k}
          className={cn("h-8 border px-2.5 text-sm transition-colors", filter === k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
      </div>
    </div>

    <div className="mt-6 border-t">
      {list.slice(0, limit).map((x) => {
        const c = exam.cards[x.id];
        const expanded = open === x.id;
        const answer = answerOf(x, exam);
        return <article key={x.id} className="border-b">
          <button type="button" onClick={() => setOpen(expanded ? null : x.id)} aria-expanded={expanded}
            className="grid w-full grid-cols-[3.5rem_1fr_auto] items-start gap-3 py-3.5 text-left hover:bg-muted/30">
            <span className="pt-0.5 font-mono text-xs text-brand-text">{x.id}</span>
            <span className="min-w-0">
              <span className={cn("block leading-snug", !expanded && "line-clamp-2")}>{x.text}</span>
              {!expanded && <span className="mt-1 block truncate text-sm text-muted-foreground">→ {x.options[answer]}</span>}
            </span>
            <span className="flex items-center gap-2">
              {x.images.length > 0 && <ImageIcon className="size-3.5 text-muted-foreground" aria-label="С картинкой" />}
              {c && c.st !== 0 && <span className="hidden font-mono text-[11px] text-muted-foreground tabular-nums sm:inline" title="Шанс ответить верно сейчас">{Math.round(correctChance(x, c, now, f) * 100)}%</span>}
              <StatusBadge card={c} className="hidden sm:inline-flex" />
              <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </span>
          </button>
          {expanded && <div className="pb-6 sm:pl-[4.25rem]">
            <QuestionBody q={x} topic={bank.topics.find((t) => t.id === x.topic)?.title} className="[&_h2]:hidden" />
            <div className="mt-4"><OptionList options={x.options} disabled states={x.options.map((_, i) => (i === answer ? "correct" : "dim"))} /></div>
            {c && <div className="mt-3 font-mono text-[11px] text-muted-foreground">повторений {c.reps} · забыт {c.lapses} раз · следующее {new Date(c.due).toLocaleDateString("ru")}</div>}
            <Insights q={x} bank={bank} />
          </div>}
        </article>;
      })}
      {list.length === 0 && <div className="py-12 text-center text-muted-foreground">Ничего не найдено</div>}
    </div>
    {list.length > limit && <button type="button" onClick={() => setLimit(limit + PAGE)} className="mt-6 w-full border py-3 text-sm hover:bg-muted">Показать ещё · осталось {list.length - limit}</button>}
  </main>;
}
