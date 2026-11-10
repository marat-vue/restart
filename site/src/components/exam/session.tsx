"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftIcon, CheckIcon, EyeIcon, HelpCircleIcon, KeyboardIcon, Undo2Icon, XIcon } from "lucide-react";
import { shuffleOptions, type Shuffled } from "@/lib/exam/shuffle";
import { answerOf, buildQueue, formatInterval, isLeech, previewIntervals, rate, Rating, State, type Grade } from "@/lib/exam/scheduler";
import type { ExamBank, ExamQuestion, ExamSettings, ExamState, StoredCard } from "@/lib/exam/types";
import { answered, undone } from "@/store";
import { useAppDispatch, useAppStore } from "@/store/hooks";
import { Kbd } from "@/components/ui/kbd";
import { plural } from "@/lib/date";
import { cn } from "@/lib/utils";
import { Insights } from "./insights";
import { OptionList, QuestionBody, typing, useExam, type OptionState } from "./common";

export type PracticeSet = "mistakes" | "marked" | "leeches" | "topic";
interface Props { bank: ExamBank; mode: "review" | "practice"; topic?: number; set?: PracticeSet }
interface Current { id: string; shuffled: Shuffled; shownAt: number }
interface Done { id: string; prev?: StoredCard; shuffled: Shuffled; ok: boolean; requeued: boolean }
interface Run {
  queue: string[];
  /** «Доучка»: вопросы на коротких шагах и время, когда их показать снова */
  learning: [string, number][];
  history: Done[];
  current: Current | null;
  phase: "recall" | "answer" | "reveal" | "done";
  picked: number | null;
  ms: number;
  count: number;
  correct: number;
  started: number;
}

const GRADES: { g: Grade; label: string; hint: string }[] = [
  { g: Rating.Again, label: "Угадал", hint: "ответ верный, но не знал" },
  { g: Rating.Hard, label: "Трудно", hint: "вспомнил с усилием" },
  { g: Rating.Good, label: "Хорошо", hint: "уверенно" },
  { g: Rating.Easy, label: "Легко", hint: "сразу и без сомнений" },
];
const shuffleIds = (ids: string[]) => {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

/** Наборы для практики без расписания: ошибки, отмеченные, трудные, вся тема. */
export function practiceIds(bank: ExamBank, s: ExamState, set: PracticeSet, topic?: number, now = Date.now()) {
  if (set === "marked") return bank.questions.filter((q) => s.marked[q.id]).map((q) => q.id);
  if (set === "leeches") return bank.questions.filter((q) => isLeech(s.cards[q.id])).map((q) => q.id);
  if (set === "topic") return bank.questions.filter((q) => q.topic === topic).map((q) => q.id);
  const last = new Map<string, boolean>();
  for (const e of s.log) if (e.t >= now - 30 * 86_400_000) last.set(e.q, e.ok);
  return [...last].filter(([, ok]) => !ok).map(([id]) => id);
}

/** Типичное время верного ответа — от него зависит подсказка оценки. */
function medianMs(s: ExamState) {
  const ms = s.log.filter((e) => e.ok && e.m === "r").slice(-200).map((e) => e.ms).sort((a, b) => a - b);
  return ms.length >= 10 ? ms[Math.floor(ms.length / 2)] : 15_000;
}

function show(run: Run, q: ExamQuestion, settings: ExamSettings, shuffled?: Shuffled): Run {
  return {
    ...run, picked: null, ms: 0,
    current: { id: q.id, shownAt: Date.now(), shuffled: shuffled ?? (settings.shuffle ? shuffleOptions(q.options) : { options: q.options, order: q.options.map((_, i) => i) }) },
    phase: settings.recallFirst ? "recall" : "answer",
  };
}

export function ExamSession({ bank, mode, topic, set }: Props) {
  const store = useAppStore();
  const dispatch = useAppDispatch();
  const exam = useExam();
  const byId = useMemo(() => new Map(bank.questions.map((q) => [q.id, q])), [bank]);
  const topicTitle = useMemo(() => new Map(bank.topics.map((t) => [t.id, t.title])), [bank]);

  const advance = useCallback((run: Run): Run => {
    const settings = store.getState().exam.settings;
    const learning = [...run.learning].sort((a, b) => a[1] - b[1]);
    // сначала созревшая «доучка», потом очередь; если осталась только доучка — не ждём срока
    if (learning.length && (learning[0][1] <= Date.now() || !run.queue.length)) {
      const [id] = learning.shift()!;
      return show({ ...run, learning }, byId.get(id)!, settings);
    }
    const [id, ...queue] = run.queue;
    if (id) return show({ ...run, queue }, byId.get(id)!, settings);
    return { ...run, current: null, phase: "done" };
  }, [store, byId]);

  const [run, setRun] = useState<Run>(() => {
    const s = store.getState().exam;
    const plan = mode === "review" ? buildQueue(bank, s, { topic }) : null;
    const queue = plan ? plan.queue : shuffleIds(practiceIds(bank, s, set ?? "mistakes", topic));
    return advance({ queue, learning: plan?.ahead ?? [], history: [], current: null, phase: "done", picked: null, ms: 0, count: 0, correct: 0, started: Date.now() });
  });
  const { current, phase, picked, ms } = run;

  const q = current ? byId.get(current.id)! : null;
  const correctShown = q && current ? current.shuffled.order.indexOf(answerOf(q, exam)) : -1;
  const ok = picked !== null && picked === correctShown;
  const card = current ? exam.cards[current.id] : undefined;
  const isNew = !card || card.st === State.New;

  const suggested: Grade = useMemo(() => {
    if (!ok) return Rating.Again;
    if (isNew) return Rating.Good;
    const m = medianMs(store.getState().exam);
    return ms < m * 0.5 ? Rating.Easy : ms > m * 2 ? Rating.Hard : Rating.Good;
  }, [ok, isNew, ms, store]);
  const intervals = useMemo(() => phase === "reveal" && current && mode === "review"
    ? previewIntervals(store.getState().exam, current.id, current.shownAt + ms) : null, [phase, current, mode, store, ms]);

  const reveal = useCallback(() => setRun((r) => (r.phase === "recall" ? { ...r, phase: "answer" } : r)), []);
  const pick = useCallback((i: number) => setRun((r) => (r.phase !== "answer" || !r.current ? r
    : { ...r, picked: i, ms: Math.min(300_000, Date.now() - r.current.shownAt), phase: "reveal" })), []);

  const grade = useCallback((g: Grade) => {
    if (run.phase !== "reveal" || !run.current) return;
    const id = run.current.id;
    const now = Date.now();
    const s = store.getState().exam;
    const prev = s.cards[id];
    let { learning, queue } = run;
    let requeued = false;
    if (mode === "review") {
      const next = rate(s, id, g, now);
      dispatch(answered({ entry: { q: id, t: now, r: g, ok, ms: run.ms, m: "r", ...(!prev || prev.st === State.New ? { n: true as const } : {}) }, card: next }));
      if (next.st !== State.Review && next.due - now < 6 * 3_600_000) learning = [...learning, [id, next.due]];
    } else {
      dispatch(answered({ entry: { q: id, t: now, r: 0, ok, ms: run.ms, m: "p" } }));
      if (!ok) { queue = [...queue.slice(0, 3), id, ...queue.slice(3)]; requeued = true; }
    }
    setRun(advance({
      ...run, queue, learning,
      history: [...run.history, { id, prev, shuffled: run.current.shuffled, ok, requeued }],
      count: run.count + 1, correct: run.correct + Number(ok),
    }));
    window.scrollTo({ top: 0 });
  }, [run, store, mode, dispatch, ok, advance]);

  const undo = useCallback(() => {
    const h = run.history.at(-1);
    if (!h) return;
    dispatch(undone({ id: h.id, card: mode === "review" ? h.prev : store.getState().exam.cards[h.id] }));
    let queue = run.queue;
    if (h.requeued) { const i = queue.indexOf(h.id); if (i >= 0) queue = queue.toSpliced(i, 1); }
    if (run.current) queue = [run.current.id, ...queue];
    setRun(show({
      ...run, queue, learning: run.learning.filter(([id]) => id !== h.id), history: run.history.slice(0, -1),
      count: run.count - 1, correct: run.correct - Number(h.ok),
    }, byId.get(h.id)!, store.getState().exam.settings, h.shuffled));
  }, [run, dispatch, mode, store, byId]);

  useEffect(() => {
    const options = current?.shuffled.options.length ?? 0;
    const onKey = (e: KeyboardEvent) => {
      if (typing(e) || e.altKey || e.metaKey) return;
      if ((e.ctrlKey && (e.key === "z" || e.key === "я")) || e.key === "Backspace") { e.preventDefault(); undo(); return; }
      if (e.ctrlKey) return;
      if (phase === "recall" && (e.key === " " || e.key === "Enter")) { e.preventDefault(); reveal(); return; }
      const n = Number(e.key);
      if (phase === "answer") {
        if (n >= 1 && n <= options) { e.preventDefault(); pick(n - 1); }
        else if (e.key === "0" || e.key === "?") { e.preventDefault(); pick(-1); }
      } else if (phase === "reveal") {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); grade(suggested); }
        else if (mode === "review" && ok && n >= 1 && n <= 4) { e.preventDefault(); grade(n as Grade); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, phase, ok, mode, suggested, pick, grade, undo, reveal]);

  const left = run.queue.length + run.learning.length + (current ? 1 : 0);
  const counts = useMemo(() => {
    const c = { fresh: 0, learn: run.learning.length, review: 0 };
    for (const id of run.queue) {
      const st = exam.cards[id]?.st ?? State.New;
      if (st === State.New) c.fresh++; else if (st === State.Review) c.review++; else c.learn++;
    }
    return c;
  }, [exam.cards, run.queue, run.learning]);

  const title = mode === "review" ? (topic ? `Тема ${topic}` : "Занятие")
    : set === "marked" ? "Отмеченные" : set === "leeches" ? "Трудные вопросы" : set === "topic" ? `Прогон темы ${topic}` : "Работа над ошибками";

  if (phase === "done") return <Finished run={run} title={title} mode={mode} onUndo={undo} />;
  const states: OptionState[] | undefined = phase === "reveal" && current ? current.shuffled.options.map((_, i) =>
    i === correctShown ? (i === picked ? "correct" : "missed") : i === picked ? "wrong" : "dim") : undefined;

  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
    <div className="flex items-center gap-3">
      <Link href="/exam/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeftIcon className="size-4" />Экзамен</Link>
      <span className="label hidden sm:inline">· {title}</span>
      <div className="ml-auto flex items-center gap-3 font-mono text-xs tabular-nums">
        {mode === "review" ? <>
          <span title="Новые" className="text-muted-foreground">{counts.fresh} нов.</span>
          <span title="Изучаемые" className="text-brand-text">{counts.learn} изуч.</span>
          <span title="Повторения" className="text-ok">{counts.review} повт.</span>
        </> : <span className="text-muted-foreground">осталось {left}</span>}
        <button type="button" onClick={undo} disabled={!run.history.length} title="Отменить последний ответ (Backspace)" aria-label="Отменить последний ответ"
          className="grid size-7 place-items-center border text-muted-foreground hover:text-foreground disabled:opacity-30"><Undo2Icon className="size-3.5" /></button>
      </div>
    </div>
    <div className="mt-3 h-0.5 bg-border"><div className="h-full bg-brand transition-[width] duration-500" style={{ width: `${run.count / Math.max(1, run.count + left) * 100}%` }} /></div>

    {q && current && <div className="mt-8 animate-rise" key={`${current.id}-${current.shownAt}`}>
      <QuestionBody q={q} topic={topicTitle.get(q.topic)} />
      {isLeech(card) && phase !== "reveal" && <div className="label mt-3 text-brand-text">трудный вопрос · забыт {card!.lapses} раз</div>}

      <div className="mt-7">
        {phase === "recall"
          ? <button type="button" onClick={reveal} className="flex w-full flex-wrap items-center justify-center gap-2 border border-dashed px-4 py-8 text-muted-foreground hover:border-foreground/60 hover:text-foreground">
              <EyeIcon className="size-4" />Вспомните ответ и откройте варианты <Kbd>Пробел</Kbd>
            </button>
          : <OptionList options={current.shuffled.options} states={states} onPick={pick} disabled={phase === "reveal"} />}
      </div>

      {phase === "answer" && <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => pick(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <HelpCircleIcon className="size-4" />Не знаю <Kbd>0</Kbd>
        </button>
        <span className="hidden items-center gap-1.5 text-xs text-faint sm:inline-flex"><KeyboardIcon className="size-3.5" />цифры — выбрать вариант</span>
      </div>}

      {phase === "reveal" && <>
        <div className={cn("mt-6 flex items-center gap-2 font-medium", ok ? "text-ok" : "text-destructive")}>
          {ok ? <CheckIcon className="size-4" /> : <XIcon className="size-4" />}
          {ok ? "Верно" : picked === -1 ? "Посмотрите правильный ответ" : "Неверно"}
          <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">{Math.round(ms / 1000)} с</span>
        </div>
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
          {mode === "review" && ok
            ? <div className="grid grid-cols-4 gap-px border bg-border">
                {GRADES.map(({ g, label, hint }) => <button key={g} type="button" onClick={() => grade(g)} title={hint}
                  className={cn("flex flex-col items-center gap-0.5 bg-background px-1 py-2.5 transition-colors hover:bg-muted", g === suggested && "bg-foreground text-background hover:bg-foreground/90")}>
                  <span className="text-sm font-medium">{label}</span>
                  <span className={cn("font-mono text-[11px] tabular-nums", g === suggested ? "text-background/70" : "text-muted-foreground")}>{intervals?.[g]} · {g}</span>
                </button>)}
              </div>
            : <button type="button" onClick={() => grade(Rating.Again)} className="flex w-full flex-wrap items-center justify-center gap-2 bg-foreground px-4 py-3 text-background hover:bg-foreground/90">
                Дальше {mode === "review" && intervals && <span className="font-mono text-xs text-background/70">повтор через {intervals[Rating.Again]}</span>}<Kbd className="ml-1">Enter</Kbd>
              </button>}
        </div>
        <Insights q={q} bank={bank} />
      </>}
    </div>}
  </main>;
}

function Finished({ run, title, mode, onUndo }: { run: Run; title: string; mode: Props["mode"]; onUndo: () => void }) {
  const exam = useExam();
  const [now] = useState(Date.now);
  const nextDue = Object.entries(exam.cards).filter(([id, c]) => c.st !== State.New && !exam.suspended[id]).reduce((m, [, c]) => Math.min(m, c.due), Infinity);
  const minutes = Math.max(1, Math.round((now - run.started) / 60_000));
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 sm:px-6">
    <div className="label">{title}</div>
    <h1 className="mt-3 text-4xl font-semibold uppercase sm:text-6xl">{run.count ? "Готово" : "Пока нечего повторять"}</h1>
    {run.count > 0 && <div className="mt-10 grid grid-cols-3 border-l border-t">
      {[
        [run.count, plural(run.count, ["ответ", "ответа", "ответов"])],
        [`${Math.round(run.correct / run.count * 100)}%`, "верно"],
        [minutes, plural(minutes, ["минута", "минуты", "минут"])],
      ].map(([v, l]) => <div key={String(l)} className="border-b border-r p-5"><div className="font-display text-3xl font-semibold tabular-nums sm:text-4xl">{v}</div><div className="label mt-2">{l}</div></div>)}
    </div>}
    <p className="mt-8 max-w-2xl text-muted-foreground">
      {mode === "review"
        ? Number.isFinite(nextDue) ? `Следующие вопросы подойдут ${nextDue <= now ? "уже сейчас" : `через ${formatInterval(nextDue - now)}`}. Регулярность важнее объёма: 15 минут каждый день дают больше, чем два часа раз в неделю.` : "Начните с новых вопросов на странице экзамена."
        : "Набор пройден. Вопросы с неверным ответом остаются в «Работе над ошибками»."}
    </p>
    <div className="mt-8 flex flex-wrap gap-2">
      <Link href="/exam/" className="inline-flex h-9 items-center gap-2 bg-foreground px-4 text-sm text-background hover:bg-foreground/90">К экзамену</Link>
      {run.history.length > 0 && <button type="button" onClick={onUndo} className="inline-flex h-9 items-center gap-2 border px-4 text-sm hover:bg-muted"><Undo2Icon className="size-4" />Отменить последний ответ</button>}
    </div>
  </main>;
}
