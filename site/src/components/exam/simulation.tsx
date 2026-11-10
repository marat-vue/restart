"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ClockIcon, XIcon } from "lucide-react";
import { shuffleOptions, type Shuffled } from "@/lib/exam/shuffle";
import { answerOf, rate, Rating } from "@/lib/exam/scheduler";
import type { ExamBank, ReviewEntry, StoredCard } from "@/lib/exam/types";
import { examFinished } from "@/store";
import { useAppDispatch, useAppStore } from "@/store/hooks";
import { cn } from "@/lib/utils";
import { Insights } from "./insights";
import { OptionList, QuestionBody, typing, useExam } from "./common";

const LIMIT = 30 * 60_000;
const PASS = 12;
interface Item { id: string; shuffled: Shuffled; pick: number | null }

/** Как на настоящем экзамене: 14 вопросов по одному из каждой темы, 30 минут, сдано при 12 верных. */
export function ExamSimulation({ bank }: { bank: ExamBank }) {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const exam = useExam();
  const byId = useMemo(() => new Map(bank.questions.map((q) => [q.id, q])), [bank]);
  const [items, setItems] = useState<Item[]>(() => {
    const s = store.getState().exam;
    return bank.topics.map((t) => {
      const all = bank.questions.filter((q) => q.topic === t.id);
      const pool = all.filter((q) => !s.suspended[q.id]);
      const list = pool.length ? pool : all;
      const q = list[Math.floor(Math.random() * list.length)];
      return { id: q.id, shuffled: shuffleOptions(q.options), pick: null };
    });
  });
  const [index, setIndex] = useState(0);
  const [started] = useState(Date.now);
  const [now, setNow] = useState(started);
  const [finished, setFinished] = useState<number | null>(null);

  const finish = useCallback(() => {
    if (finished !== null || !items.length) return;
    const at = Date.now();
    const s = store.getState().exam;
    const cards: Record<string, StoredCard> = {};
    const entries: ReviewEntry[] = [];
    for (const it of items) {
      const q = byId.get(it.id)!;
      if (it.pick === null) continue; // пропущенный вопрос ничего не говорит о памяти
      const ok = it.shuffled.order[it.pick] === answerOf(q, s);
      // ошибка на экзамене — сигнал, что вопрос забыт: возвращаем его в повторение
      if (!ok) cards[it.id] = rate(s, it.id, Rating.Again, at);
      entries.push({ q: it.id, t: at, r: ok ? 0 : Rating.Again, ok, ms: 0, m: "x" });
    }
    dispatch(examFinished({ attempt: { at, ms: at - started, items: items.map((it) => ({ q: it.id, a: it.pick === null ? null : it.shuffled.order[it.pick] })) }, cards, entries }));
    setFinished(at);
    setIndex(0);
    window.scrollTo({ top: 0 });
  }, [finished, items, store, byId, dispatch, started]);

  useEffect(() => {
    if (finished !== null) return;
    const t = setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at - started >= LIMIT) finish();
    }, 1000);
    return () => clearInterval(t);
  }, [finished, started, finish]);

  const choose = useCallback((i: number) => {
    if (finished !== null) return;
    setItems((list) => list.map((it, k) => (k === index ? { ...it, pick: i } : it)));
  }, [finished, index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.ctrlKey || e.altKey || e.metaKey) return;
      const n = Number(e.key);
      const len = items[index]?.shuffled.options.length ?? 0;
      if (finished === null && n >= 1 && n <= len) { e.preventDefault(); choose(n - 1); }
      else if (e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); setIndex((i) => Math.min(items.length - 1, i + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, index, finished, choose]);

  if (!items.length) return <main className="flex-1" />;
  const item = items[index];
  const q = byId.get(item.id)!;
  const correctOf = (it: Item) => it.shuffled.order.indexOf(answerOf(byId.get(it.id)!, exam));
  const score = items.filter((it) => it.pick !== null && it.pick === correctOf(it)).length;
  const answeredCount = items.filter((it) => it.pick !== null).length;
  const remaining = Math.max(0, LIMIT - (now - started));
  const clock = `${Math.floor(remaining / 60_000)}:${String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}`;
  const elapsed = finished !== null ? finished - started : 0;

  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-6 sm:px-6 sm:pt-10">
    <div className="flex items-center gap-3">
      <Link href="/exam/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" />Экзамен</Link>
      <span className="label hidden sm:inline">· Пробный экзамен</span>
      {finished === null && <span className={cn("ml-auto inline-flex items-center gap-1.5 font-mono text-sm tabular-nums", remaining < 5 * 60_000 && "text-destructive")}>
        <ClockIcon className="size-4" />{clock}
      </span>}
    </div>

    {finished !== null && <section className="mt-8 border p-6 sm:p-8">
      <div className="label">{score >= PASS ? "Сдано" : "Не сдано"}</div>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <span className={cn("font-display text-6xl font-semibold tabular-nums", score >= PASS ? "text-ok" : "text-destructive")}>{score}<span className="text-muted-foreground">/14</span></span>
        <span className="text-muted-foreground">нужно {PASS} · время {Math.floor(elapsed / 60_000)} мин {Math.floor(elapsed / 1000) % 60} с</span>
      </div>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        {score >= PASS ? "Хороший результат. Ошибки уже добавлены в повторение — пройдите их в ближайшем занятии." : "Ошибки добавлены в повторение. Пройдите их и попробуйте снова через пару дней."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => location.reload()} className="inline-flex h-9 items-center bg-foreground px-4 text-sm text-background hover:bg-foreground/90">Новый вариант</button>
        <Link href="/exam/session/" className="inline-flex h-9 items-center border px-4 text-sm hover:bg-muted">К повторению</Link>
      </div>
    </section>}

    <nav className="mt-6 grid grid-cols-7 gap-1 sm:grid-cols-14" aria-label="Вопросы экзамена">
      {items.map((it, k) => {
        const ok = finished !== null && it.pick === correctOf(it);
        return <button key={it.id} type="button" onClick={() => setIndex(k)} aria-current={k === index}
          className={cn("grid h-9 place-items-center border font-mono text-xs tabular-nums transition-colors",
            k === index && "border-foreground",
            finished === null && it.pick !== null && "bg-muted",
            finished !== null && (ok ? "border-ok/60 bg-ok/10 text-ok" : "border-destructive/60 bg-destructive/10 text-destructive"),
            k === index && finished !== null && (ok ? "border-ok" : "border-destructive"))}>
          {finished !== null ? (ok ? <CheckIcon className="size-3.5" /> : <XIcon className="size-3.5" />) : k + 1}
        </button>;
      })}
    </nav>

    <div className="mt-8" key={item.id}>
      <QuestionBody q={q} topic={bank.topics.find((t) => t.id === q.topic)?.title} />
      <div className="mt-7">
        <OptionList options={item.shuffled.options} onPick={choose} disabled={finished !== null}
          states={item.shuffled.options.map((_, i) => {
            if (finished === null) return i === item.pick ? "picked" : "idle";
            const c = correctOf(item);
            return i === c ? (i === item.pick ? "correct" : "missed") : i === item.pick ? "wrong" : "dim";
          })} />
      </div>
      <div className="mt-6 flex items-center gap-2">
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)} className="inline-flex h-9 items-center gap-1.5 border px-3 text-sm hover:bg-muted disabled:opacity-30"><ArrowLeftIcon className="size-4" />Назад</button>
        {index < items.length - 1
          ? <button type="button" onClick={() => setIndex(index + 1)} className="inline-flex h-9 items-center gap-1.5 border px-3 text-sm hover:bg-muted">Далее<ArrowRightIcon className="size-4" /></button>
          : null}
        {finished === null && <button type="button" onClick={finish}
          className={cn("ml-auto inline-flex h-9 items-center px-4 text-sm", answeredCount === items.length ? "bg-foreground text-background hover:bg-foreground/90" : "border hover:bg-muted")}>
          Завершить · {answeredCount}/{items.length}
        </button>}
      </div>
      {finished !== null && <div className="mt-6"><Insights q={q} bank={bank} /></div>}
    </div>
  </main>;
}
