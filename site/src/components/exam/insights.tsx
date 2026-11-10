"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangleIcon, BookOpenIcon, BugIcon, FlagIcon, GitCompareArrowsIcon, PauseIcon, PencilLineIcon, RotateCcwIcon } from "lucide-react";
import { useSearchIndex } from "@/lib/assets";
import { relatedLessons } from "@/lib/exam/related";
import { answerOf, isLeech } from "@/lib/exam/scheduler";
import type { ExamBank, ExamQuestion } from "@/lib/exam/types";
import { cardReset, markToggled, noteSet, overrideSet, suspendToggled } from "@/store";
import { useAppDispatch } from "@/store/hooks";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useExam } from "./common";

function Block({ icon: Icon, title, tone, children }: { icon: typeof BookOpenIcon; title: string; tone?: "warn"; children: React.ReactNode }) {
  return <section className={cn("border-t py-4", tone === "warn" && "text-brand-text")}>
    <div className="label mb-2 flex items-center gap-2"><Icon className="size-3.5" />{title}</div>
    <div className="text-sm leading-relaxed">{children}</div>
  </section>;
}

/**
 * Всё, что помогает закрепить ответ: разбор из сборника, похожие вопросы с другим ответом,
 * уроки конспекта по теме, своя заметка-мнемоника и исправление спорного ответа.
 */
export function Insights(props: { q: ExamQuestion; bank: ExamBank; actions?: boolean }) {
  return <InsightsBody key={props.q.id} {...props} />;
}

function InsightsBody({ q, bank, actions = true }: { q: ExamQuestion; bank: ExamBank; actions?: boolean }) {
  const exam = useExam();
  const dispatch = useAppDispatch();
  const index = useSearchIndex();
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(exam.notes[q.id] ?? "");

  const answer = answerOf(q, exam);
  const related = useMemo(() => index ? relatedLessons(index, `${q.text} ${q.options[answer]}`) : [], [index, q, answer]);
  const similar = useMemo(() => (q.similar ?? []).map((id) => bank.questions.find((x) => x.id === id)).filter((x): x is ExamQuestion => !!x), [q, bank]);
  const card = exam.cards[q.id];

  return <div className="mt-2">
    {isLeech(card) && <Block icon={BugIcon} title="Трудный вопрос" tone="warn">
      Забыт уже {card.lapses} раз. Разберитесь, почему верен именно этот вариант, и запишите себе подсказку.
    </Block>}
    {q.disputed && !exam.overrides[q.id] && <Block icon={AlertTriangleIcon} title="Спорный ответ" tone="warn">
      {q.disputed}. Если считаете верным другой вариант, исправьте ответ ниже.
    </Block>}
    {q.comment && <Block icon={BookOpenIcon} title="Разбор из сборника"><p className="text-muted-foreground">{q.comment}</p></Block>}
    {similar.length > 0 && <Block icon={GitCompareArrowsIcon} title="Не перепутайте с похожими">
      <ul className="grid gap-2.5">
        {similar.map((s) => <li key={s.id} className="grid gap-0.5">
          <span className="text-muted-foreground"><span className="font-mono text-xs text-faint">№ {s.id}</span> {s.text}</span>
          <span>→ {s.options[answerOf(s, exam)]}</span>
        </li>)}
      </ul>
    </Block>}
    {related.length > 0 && <Block icon={BookOpenIcon} title="В конспекте">
      <ul className="flex flex-wrap gap-2">
        {related.map((r) => <li key={r.id}>
          <Link href={r.href} target="_blank" className="inline-flex items-center gap-2 border px-2.5 py-1.5 transition-colors hover:border-foreground/60 hover:bg-muted/50">
            <span className="font-medium">{r.title}</span><span className="text-xs text-muted-foreground">{r.section}</span>
          </Link>
        </li>)}
      </ul>
    </Block>}
    <Block icon={PencilLineIcon} title="Моя заметка">
      {editing || !exam.notes[q.id]
        ? <Textarea value={note} onChange={(e) => setNote(e.target.value)} onFocus={() => setEditing(true)}
            onBlur={() => { dispatch(noteSet({ id: q.id, text: note })); setEditing(false); }}
            placeholder="Подсказка, которая поможет вспомнить: почему верно именно это" className="min-h-16 text-sm" />
        : <button type="button" onClick={() => setEditing(true)} className="w-full whitespace-pre-line border-l-2 border-brand pl-3 text-left hover:bg-muted/40">{exam.notes[q.id]}</button>}
    </Block>
    {actions && <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-4 text-xs text-muted-foreground">
      <button type="button" onClick={() => dispatch(markToggled(q.id))} className={cn("inline-flex items-center gap-1.5 hover:text-foreground", exam.marked[q.id] && "text-brand-text")}>
        <FlagIcon className="size-3.5" />{exam.marked[q.id] ? "Отмечен" : "Отметить"}
      </button>
      <button type="button" onClick={() => dispatch(suspendToggled(q.id))} className={cn("inline-flex items-center gap-1.5 hover:text-foreground", exam.suspended[q.id] && "text-brand-text")}>
        <PauseIcon className="size-3.5" />{exam.suspended[q.id] ? "Исключён из занятий" : "Исключить из занятий"}
      </button>
      {card && <button type="button" onClick={() => dispatch(cardReset(q.id))} className="inline-flex items-center gap-1.5 hover:text-foreground">
        <RotateCcwIcon className="size-3.5" />Начать заново
      </button>}
      <label className="inline-flex items-center gap-1.5">
        Верный ответ:
        <select value={answer} onChange={(e) => {
          const v = Number(e.target.value);
          dispatch(overrideSet({ id: q.id, answer: v === q.answer ? null : v }));
        }} className="max-w-[16rem] border bg-background px-1.5 py-0.5 text-foreground">
          {q.options.map((o, i) => <option key={i} value={i}>{o.length > 48 ? `${o.slice(0, 46)}…` : o}{i === q.answer ? " · по сборнику" : ""}</option>)}
        </select>
      </label>
    </div>}
  </div>;
}
