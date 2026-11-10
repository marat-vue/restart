import { createEmptyCard, fsrs, Rating, State, type Card, type Grade } from "ts-fsrs";
import type { ExamBank, ExamQuestion, ExamSettings, ExamState, StoredCard } from "./types";
import { dayKey } from "../date";

export { Rating, State };
export type { Grade };

const DAY = 86_400_000;
const startOfDay = (ts: number) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };

/** До экзамена интервалы не выходят за его дату: каждый вопрос успеет повториться. */
export function daysUntilExam(settings: ExamSettings, now = Date.now()) {
  if (!settings.examDate) return null;
  const exam = new Date(`${settings.examDate}T00:00:00`).getTime();
  return Math.round((exam - startOfDay(now)) / DAY);
}

export function scheduler(settings: ExamSettings, now = Date.now()) {
  const left = daysUntilExam(settings, now);
  return fsrs({
    request_retention: settings.retention,
    maximum_interval: left !== null && left > 1 ? left - 1 : 365,
    enable_fuzz: true,
    enable_short_term: true,
    // шаги короче, чем в Anki: ответ выбирается из вариантов, и минутный повтор узнаётся по картинке, а не вспоминается
    learning_steps: ["3m", "15m"],
    relearning_steps: ["10m"],
  });
}

export function toCard(c: StoredCard | undefined, now = Date.now()): Card {
  if (!c) return createEmptyCard(now);
  return {
    due: new Date(c.due), stability: c.s, difficulty: c.d, elapsed_days: c.ed, scheduled_days: c.sd,
    learning_steps: c.ls, reps: c.reps, lapses: c.lapses, state: c.st as State,
    ...(c.lr !== undefined ? { last_review: new Date(c.lr) } : {}),
  };
}
export function fromCard(c: Card): StoredCard {
  return {
    due: c.due.getTime(), s: c.stability, d: c.difficulty, ed: c.elapsed_days, sd: c.scheduled_days,
    ls: c.learning_steps, reps: c.reps, lapses: c.lapses, st: c.state as StoredCard["st"],
    ...(c.last_review ? { lr: c.last_review.getTime() } : {}),
  };
}

/** Вероятность вспомнить по кривой забывания FSRS. */
export function retrievability(c: StoredCard | undefined, at: number, f: ReturnType<typeof scheduler>) {
  if (!c || c.st === State.New) return 0;
  return f.get_retrievability(toCard(c), new Date(at), false);
}

/** Вероятность ответить верно: вспомнил — или угадал среди вариантов. */
export function correctChance(q: ExamQuestion, c: StoredCard | undefined, at: number, f: ReturnType<typeof scheduler>) {
  const r = retrievability(c, at, f);
  return r + (1 - r) / q.options.length;
}

/**
 * На экзамене 14 вопросов — по одному из каждой темы, сдано при 12 верных.
 * Вероятность сдачи — распределение Пуассона–Бернулли по средним шансам тем.
 */
export function passChance(topicChances: number[], need = 12) {
  let dist = [1];
  for (const p of topicChances) {
    const next = new Array(dist.length + 1).fill(0);
    dist.forEach((v, k) => { next[k] += v * (1 - p); next[k + 1] += v * p; });
    dist = next;
  }
  return dist.slice(need).reduce((a, b) => a + b, 0);
}

export function topicChances(bank: ExamBank, state: ExamState, at: number, f = scheduler(state.settings)) {
  return bank.topics.map((t) => {
    const qs = bank.questions.filter((q) => q.topic === t.id);
    return qs.reduce((a, q) => a + correctChance(q, state.cards[q.id], at, f), 0) / Math.max(1, qs.length);
  });
}

export const answerOf = (q: ExamQuestion, state: ExamState) => state.overrides[q.id] ?? q.answer;

export function newToday(state: ExamState, now = Date.now()) {
  const today = dayKey(now);
  return state.log.filter((e) => e.n && e.m === "r" && dayKey(e.t) === today).length;
}

export interface QueueOptions { topic?: number; now?: number }

/**
 * Очередь занятия: сначала самые «забытые» просроченные вопросы, новые вкраплены
 * через каждые несколько повторений. Новые идут вперемешку по темам —
 * чередование помогает различать похожие формулировки разных тем.
 */
export function buildQueue(bank: ExamBank, state: ExamState, { topic, now = Date.now() }: QueueOptions = {}) {
  const f = scheduler(state.settings, now);
  const pool = bank.questions.filter((q) => !state.suspended[q.id] && (topic === undefined || q.topic === topic));
  const due = pool
    .filter((q) => state.cards[q.id] && state.cards[q.id].st !== State.New && state.cards[q.id].due <= now)
    .map((q) => ({ q, r: retrievability(state.cards[q.id], now, f), learning: state.cards[q.id].st !== State.Review }))
    .sort((a, b) => Number(b.learning) - Number(a.learning) || a.r - b.r)
    .map((x) => x.q.id);

  const limit = Math.max(0, state.settings.newPerDay - newToday(state, now));
  const fresh = pool.filter((q) => !state.cards[q.id] || state.cards[q.id].st === State.New);
  let ordered = fresh;
  if (state.settings.newOrder === "mixed" && topic === undefined) {
    const byTopic = bank.topics.map((t) => fresh.filter((q) => q.topic === t.id));
    ordered = [];
    for (let i = 0; ordered.length < fresh.length; i++) for (const list of byTopic) if (list[i]) ordered.push(list[i]);
  }
  const news = ordered.slice(0, limit).map((q) => q.id);

  const queue: string[] = [];
  const gap = news.length ? Math.max(1, Math.floor(due.length / news.length)) : 0;
  let d = 0;
  for (const id of news) { queue.push(...due.slice(d, d + gap)); d += gap; queue.push(id); }
  queue.push(...due.slice(d));
  // «доучка», чей короткий шаг ещё не наступил: покажем в этом же занятии, когда подойдёт срок
  const ahead = pool
    .filter((q) => { const c = state.cards[q.id]; return c && (c.st === State.Learning || c.st === State.Relearning) && c.due > now && c.due - now < 3_600_000; })
    .map((q): [string, number] => [q.id, state.cards[q.id].due]);
  return { queue, ahead, due: due.length, fresh: news.length, freshLeft: fresh.length };
}

/** Сколько повторений придётся на каждый из ближайших дней. */
export function forecast(state: ExamState, days = 14, now = Date.now()) {
  const start = startOfDay(now);
  const out = Array.from({ length: days }, (_, i) => ({ day: start + i * DAY, count: 0 }));
  for (const [id, c] of Object.entries(state.cards)) {
    if (c.st === State.New || state.suspended[id]) continue;
    const i = Math.max(0, Math.floor((c.due - start) / DAY));
    if (i < days) out[i].count++;
  }
  return out;
}

export type CardStatus = "new" | "learning" | "young" | "mature";
export function statusOf(c: StoredCard | undefined): CardStatus {
  if (!c || c.st === State.New) return "new";
  if (c.st !== State.Review) return "learning";
  return c.sd >= 21 ? "mature" : "young";
}

/** «Пиявки» — вопросы, которые раз за разом забываются. */
export const isLeech = (c: StoredCard | undefined) => !!c && c.lapses >= 4;

export function rate(state: ExamState, id: string, grade: Grade, now = Date.now()) {
  const f = scheduler(state.settings, now);
  return fromCard(f.next(toCard(state.cards[id], now), new Date(now), grade).card);
}

/** Интервалы для кнопок оценки: «10 мин», «3 дн». */
export function previewIntervals(state: ExamState, id: string, now = Date.now()) {
  const f = scheduler(state.settings, now);
  const preview = f.repeat(toCard(state.cards[id], now), new Date(now));
  const out = {} as Record<Grade, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as Grade[]) out[g] = formatInterval(preview[g].card.due.getTime() - now);
  return out;
}

export function formatInterval(ms: number) {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return `${m} мин`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.round(ms / DAY);
  if (d < 31) return `${d} дн`;
  const mo = d / 30;
  return mo < 12 ? `${mo.toFixed(mo < 10 ? 1 : 0).replace(".0", "")} мес` : `${(d / 365).toFixed(1).replace(".0", "")} г`;
}
