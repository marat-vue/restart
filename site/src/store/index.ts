import { configureStore, createAction, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { normalizeProgress, type ProgressState } from "@/lib/progress-data";
import { emptyExam, normalizeExam } from "@/lib/exam/data";
import type { ExamAttempt, ExamSettings, ExamState, ReviewEntry, StoredCard } from "@/lib/exam/types";

export type { ProgressState } from "@/lib/progress-data";
export interface PersistedState { progress: ProgressState; exam: ExamState }
export const STORAGE_KEY = "re-1c:progress:v1";
export const EXAM_KEY = "re-1c:exam:v1";
export const hydrate = createAction<Partial<PersistedState> | null>("app/hydrate");
export const resetAll = createAction("app/reset");

const meta = createSlice({
  name: "meta", initialState: { hydrated: false }, reducers: {},
  extraReducers: (b) => b.addCase(hydrate, (s) => void (s.hydrated = true)),
});
const initialProgress: ProgressState = { lessons: {}, last: null };
const progress = createSlice({
  name: "progress", initialState: initialProgress,
  reducers: {
    visit: (s, a: PayloadAction<{ id: string; href: string; title: string }>) => {
      const now = Date.now();
      const p = (s.lessons[a.payload.id] ??= {});
      p.v ??= now;
      s.last = { ...a.payload, at: now };
    },
    setCompleted: (s, a: PayloadAction<{ ids: string[]; value: boolean }>) => {
      const now = Date.now();
      for (const id of a.payload.ids) {
        const p = (s.lessons[id] ??= {});
        if (a.payload.value) { p.c ??= now; p.v ??= now; }
        else delete p.c;
      }
    },
  },
  extraReducers: (b) => b
    .addCase(hydrate, (_, a) => normalizeProgress(a.payload?.progress) ?? initialProgress)
    .addCase(resetAll, () => initialProgress),
});

const toggle = (map: Record<string, true>, id: string) => { if (map[id]) delete map[id]; else map[id] = true; };
const exam = createSlice({
  name: "exam", initialState: emptyExam(),
  reducers: {
    /** card — новое состояние FSRS; без него ответ не меняет расписание */
    answered: (s, a: PayloadAction<{ entry: ReviewEntry; card?: StoredCard }>) => {
      if (a.payload.card) s.cards[a.payload.entry.q] = a.payload.card;
      s.log.push(a.payload.entry);
    },
    undone: (s, a: PayloadAction<{ id: string; card?: StoredCard }>) => {
      const i = s.log.findLastIndex((e) => e.q === a.payload.id);
      if (i >= 0) s.log.splice(i, 1);
      if (a.payload.card) s.cards[a.payload.id] = a.payload.card;
      else delete s.cards[a.payload.id];
    },
    examFinished: (s, a: PayloadAction<{ attempt: ExamAttempt; cards: Record<string, StoredCard>; entries: ReviewEntry[] }>) => {
      s.exams.push(a.payload.attempt);
      Object.assign(s.cards, a.payload.cards);
      s.log.push(...a.payload.entries);
    },
    settingsChanged: (s, a: PayloadAction<Partial<ExamSettings>>) => void Object.assign(s.settings, a.payload),
    overrideSet: (s, a: PayloadAction<{ id: string; answer: number | null }>) => {
      if (a.payload.answer === null) delete s.overrides[a.payload.id];
      else s.overrides[a.payload.id] = a.payload.answer;
    },
    noteSet: (s, a: PayloadAction<{ id: string; text: string }>) => {
      if (a.payload.text.trim()) s.notes[a.payload.id] = a.payload.text.slice(0, 5000);
      else delete s.notes[a.payload.id];
    },
    markToggled: (s, a: PayloadAction<string>) => toggle(s.marked, a.payload),
    suspendToggled: (s, a: PayloadAction<string>) => toggle(s.suspended, a.payload),
    cardReset: (s, a: PayloadAction<string>) => void delete s.cards[a.payload],
    examReset: (s) => ({ ...emptyExam(), settings: s.settings }),
  },
  // импорт старой резервной копии без поля exam не трогает прогресс экзамена
  extraReducers: (b) => b.addCase(hydrate, (s, a) => (a.payload && "exam" in a.payload ? normalizeExam(a.payload.exam) ?? emptyExam() : s)),
});

export const makeStore = () => configureStore({ reducer: { meta: meta.reducer, progress: progress.reducer, exam: exam.reducer } });
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
export const { visit, setCompleted } = progress.actions;
export const { answered, undone, examFinished, settingsChanged, overrideSet, noteSet, markToggled, suspendToggled, cardReset, examReset } = exam.actions;
export function selectPersisted(s: RootState): PersistedState { return { progress: s.progress, exam: s.exam }; }
