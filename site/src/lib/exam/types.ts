/** Банк вопросов, собранный .tools/build_exam.py из PDF-сборника. */
export interface ExamTopic { id: number; title: string }
export interface ExamQuestion {
  /** «10.57» — номер темы и вопроса в сборнике */
  id: string;
  topic: number;
  text: string;
  options: string[];
  /** Индекс правильного варианта (с нуля) */
  answer: number;
  /** data URI картинок к вопросу */
  images: string[];
  /** Разбор ответа из примеров экзаменационных заданий */
  comment?: string;
  /** Почему правильность ответа под вопросом */
  disputed?: string;
  /** Вопросы с похожей формулировкой, которые легко перепутать */
  similar?: string[];
}
export interface ExamBank {
  app: "re-1c-exam";
  version: 1;
  title: string;
  source: string;
  builtAt: number;
  topics: ExamTopic[];
  questions: ExamQuestion[];
}

/** Состояние FSRS-карточки в компактном виде для localStorage. */
export interface StoredCard {
  due: number;
  s: number;
  d: number;
  /** elapsed_days, scheduled_days, learning_steps */
  ed: number;
  sd: number;
  ls: number;
  reps: number;
  lapses: number;
  st: 0 | 1 | 2 | 3;
  lr?: number;
}

/** Ответ на вопрос. m: r — повторение по расписанию, p — практика без расписания, x — пробный экзамен. */
export interface ReviewEntry {
  q: string;
  t: number;
  /** Оценка FSRS 1–4; 0 — ответ не повлиял на расписание */
  r: 0 | 1 | 2 | 3 | 4;
  ok: boolean;
  ms: number;
  m: "r" | "p" | "x";
  /** Карточка была новой */
  n?: true;
}

export interface ExamAttempt {
  at: number;
  ms: number;
  /** Выбранный вариант по исходной нумерации; null — без ответа */
  items: { q: string; a: number | null }[];
}

export interface ExamSettings {
  newPerDay: number;
  retention: number;
  /** YYYY-MM-DD */
  examDate: string | null;
  newOrder: "mixed" | "topic";
  /** Сначала вспомнить ответ, потом увидеть варианты */
  recallFirst: boolean;
  shuffle: boolean;
}

export interface ExamState {
  cards: Record<string, StoredCard>;
  log: ReviewEntry[];
  exams: ExamAttempt[];
  settings: ExamSettings;
  /** Исправленный пользователем правильный ответ */
  overrides: Record<string, number>;
  notes: Record<string, string>;
  marked: Record<string, true>;
  suspended: Record<string, true>;
}
