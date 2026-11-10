import type { ExamAttempt, ExamBank, ExamSettings, ExamState, ReviewEntry, StoredCard } from "./types";

export const DEFAULT_SETTINGS: ExamSettings = {
  newPerDay: 25,
  retention: 0.9,
  examDate: null,
  newOrder: "mixed",
  recallFirst: false,
  shuffle: true,
};
export const emptyExam = (): ExamState => ({ cards: {}, log: [], exams: [], settings: { ...DEFAULT_SETTINGS }, overrides: {}, notes: {}, marked: {}, suspended: {} });

const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const qid = (v: unknown): v is string => typeof v === "string" && /^\d{1,2}\.\d{1,3}$/.test(v);

function card(v: unknown): StoredCard | null {
  if (!record(v)) return null;
  const { due, s, d, ed, sd, ls, reps, lapses, st, lr } = v;
  if (![due, s, d, ed, sd, ls, reps, lapses].every(num) || ![0, 1, 2, 3].includes(st as number)) return null;
  if (lr !== undefined && !num(lr)) return null;
  return { due, s, d, ed, sd, ls, reps, lapses, st, ...(lr !== undefined ? { lr } : {}) } as StoredCard;
}
function entry(v: unknown): ReviewEntry | null {
  if (!record(v) || !qid(v.q) || !num(v.t) || !num(v.ms) || ![0, 1, 2, 3, 4].includes(v.r as number) || typeof v.ok !== "boolean" || !["r", "p", "x"].includes(v.m as string)) return null;
  return { q: v.q, t: v.t, r: v.r as ReviewEntry["r"], ok: v.ok, ms: v.ms, m: v.m as ReviewEntry["m"], ...(v.n === true ? { n: true as const } : {}) };
}
function attempt(v: unknown): ExamAttempt | null {
  if (!record(v) || !num(v.at) || !num(v.ms) || !Array.isArray(v.items)) return null;
  const items = v.items.filter((i): i is { q: string; a: number | null } => record(i) && qid(i.q) && (i.a === null || num(i.a)));
  return { at: v.at, ms: v.ms, items: items.map((i) => ({ q: i.q, a: i.a })) };
}
function map<T>(v: unknown, f: (x: unknown) => T | null): Record<string, T> {
  const out: Record<string, T> = {};
  if (record(v)) for (const [k, x] of Object.entries(v)) { const y = f(x); if (qid(k) && y !== null) out[k] = y; }
  return out;
}

/** Проверяет данные из localStorage и резервных копий; битые записи отбрасываются по одной. */
export function normalizeExam(value: unknown): ExamState | null {
  if (!record(value)) return null;
  const s = record(value.settings) ? value.settings : {};
  const settings: ExamSettings = {
    newPerDay: num(s.newPerDay) ? Math.max(0, Math.min(200, Math.round(s.newPerDay))) : DEFAULT_SETTINGS.newPerDay,
    retention: num(s.retention) ? Math.max(0.7, Math.min(0.99, s.retention)) : DEFAULT_SETTINGS.retention,
    examDate: typeof s.examDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s.examDate) ? s.examDate : null,
    newOrder: s.newOrder === "topic" ? "topic" : "mixed",
    recallFirst: s.recallFirst === true,
    shuffle: s.shuffle !== false,
  };
  return {
    cards: map(value.cards, card),
    log: Array.isArray(value.log) ? value.log.map(entry).filter((e): e is ReviewEntry => e !== null) : [],
    exams: Array.isArray(value.exams) ? value.exams.map(attempt).filter((e): e is ExamAttempt => e !== null) : [],
    settings,
    overrides: map(value.overrides, (x) => (num(x) && x >= 0 && x < 20 ? Math.floor(x) : null)),
    notes: map(value.notes, (x) => (typeof x === "string" && x.trim() ? x.slice(0, 5000) : null)),
    marked: map(value.marked, (x) => (x === true ? (true as const) : null)),
    suspended: map(value.suspended, (x) => (x === true ? (true as const) : null)),
  };
}

/** Проверяет загружаемый файл банка вопросов. */
export function parseBank(value: unknown): ExamBank {
  if (!record(value) || value.app !== "re-1c-exam" || value.version !== 1 || !Array.isArray(value.topics) || !Array.isArray(value.questions)) {
    throw new Error("Это не банк вопросов re:start");
  }
  for (const q of value.questions) {
    if (!record(q) || !qid(q.id) || !num(q.topic) || typeof q.text !== "string" || !Array.isArray(q.options) || !q.options.every((o) => typeof o === "string")
      || !num(q.answer) || q.answer < 0 || q.answer >= q.options.length || !Array.isArray(q.images) || !q.images.every((i) => typeof i === "string" && i.startsWith("data:image/"))) {
      throw new Error("Банк вопросов повреждён");
    }
  }
  return value as unknown as ExamBank;
}
