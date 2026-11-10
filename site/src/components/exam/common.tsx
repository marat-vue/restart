"use client";

import { useRef, useState } from "react";
import { FileUpIcon, LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import { ImageZoom } from "@/components/lesson/image-zoom";
import { importBank, useBank, type BankSource } from "@/lib/exam/bank";
import { statusOf, type CardStatus } from "@/lib/exam/scheduler";
import type { ExamBank, ExamQuestion, StoredCard } from "@/lib/exam/types";
import { useAppSelector, useHydrated } from "@/store/hooks";
import { cn } from "@/lib/utils";

export const useExam = () => useAppSelector((s) => s.exam);

/** Показывает содержимое, когда банк вопросов загружен, иначе — форму загрузки файла. */
export function BankGate({ children }: { children: (bank: ExamBank, source: BankSource, reload: () => void) => React.ReactNode }) {
  const { status, bank, source, reload } = useBank();
  const hydrated = useHydrated();
  if (status === "loading" || !hydrated) {
    return <div className="grid flex-1 place-items-center py-32 text-muted-foreground"><LoaderIcon className="size-5 animate-spin" /></div>;
  }
  if (status === "missing" || !bank) return <BankImport onDone={reload} />;
  return <>{children(bank, source!, reload)}</>;
}

function BankImport({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const load = async (file: File) => {
    setBusy(true);
    try {
      const bank = await importBank(file);
      toast(`Загружено ${bank.questions.length} вопросов`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось прочитать файл");
    } finally { setBusy(false); }
  };
  return <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-12 sm:px-6 sm:py-16">
    <div className="label">Сертификация · 1С:Профессионал</div>
    <h1 className="mt-3 text-4xl font-semibold uppercase sm:text-6xl">Экзамен</h1>
    <p className="mt-6 max-w-xl leading-relaxed text-muted-foreground">
      Вопросы взяты из официального сборника фирмы «1С». Его нельзя распространять по сети,
      поэтому банк вопросов не публикуется вместе с сайтом. Загрузите свой файл: он сохранится
      только в этом браузере.
    </p>
    <button type="button" onClick={() => ref.current?.click()} disabled={busy}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) void load(f); }}
      className={cn("mt-10 flex w-full flex-col items-center gap-3 border border-dashed px-6 py-14 text-center transition-colors hover:border-foreground/60 hover:bg-muted/40", drag && "border-brand bg-brand/5")}>
      {busy ? <LoaderIcon className="size-6 animate-spin" /> : <FileUpIcon className="size-6" />}
      <span className="font-medium">Выберите или перетащите bank.json</span>
      <span className="text-sm text-muted-foreground">около 6,5 МБ · 961 вопрос</span>
    </button>
    <input ref={ref} type="file" accept="application/json,.json" className="hidden" aria-label="Загрузить банк вопросов"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) void load(f); e.target.value = ""; }} />
    <div className="mt-10 border-t pt-6 text-sm leading-relaxed text-muted-foreground">
      <div className="font-medium text-foreground">Где взять файл</div>
      <p className="mt-2">Соберите его из PDF-сборника скриптом в папке конспекта:</p>
      <pre className="mt-3 overflow-x-auto border bg-muted px-4 py-3 font-mono text-xs">python .tools/build_exam.py &quot;Сборник вопросов 1С-Профессионал 2021.pdf&quot;</pre>
      <p className="mt-3">Файл появится в <code className="font-mono text-xs">site/public/exam/bank.json</code>. При локальном запуске сайт подхватит его сам.</p>
    </div>
  </main>;
}

const STATUS: Record<CardStatus, { label: string; className: string }> = {
  new: { label: "новый", className: "border-border text-muted-foreground" },
  learning: { label: "изучается", className: "border-brand/60 text-brand-text" },
  young: { label: "повторяется", className: "border-foreground/40 text-foreground" },
  mature: { label: "выучен", className: "border-ok/60 text-ok" },
};
export function StatusBadge({ card, className }: { card?: StoredCard; className?: string }) {
  const s = STATUS[statusOf(card)];
  return <span className={cn("inline-flex h-5 items-center border px-1.5 font-mono text-[10px] uppercase tracking-wider", s.className, className)}>{s.label}</span>;
}

/** Формулировка вопроса и иллюстрации (кликабельны, открываются с зумом). */
export function QuestionBody({ q, topic, className }: { q: ExamQuestion; topic?: string; className?: string }) {
  const id = `q-images-${q.id.replace(".", "-")}`;
  return <div className={className}>
    <div className="label flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="text-brand-text">№ {q.id}</span>{topic && <span>{topic}</span>}
    </div>
    <h2 className="mt-3 whitespace-pre-line font-sans text-lg font-medium leading-snug sm:text-xl">{q.text}</h2>
    {q.images.length > 0 && <div id={id} className="mt-5 grid gap-3">
      {q.images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={src} alt={`Иллюстрация к вопросу ${q.id}`} className="max-h-[60vh] w-auto max-w-full border bg-white object-contain" />
      ))}
      <ImageZoom key={q.id} targetId={id} />
    </div>}
  </div>;
}

export type OptionState = "idle" | "correct" | "wrong" | "missed" | "dim" | "picked";

/** Список вариантов; номер слева совпадает с клавишей. */
export function OptionList({ options, states, onPick, disabled }: {
  options: string[]; states?: OptionState[]; onPick?: (i: number) => void; disabled?: boolean;
}) {
  return <ol className="grid gap-2">
    {options.map((o, i) => {
      const st = states?.[i] ?? "idle";
      return <li key={i}>
        <button type="button" disabled={disabled} onClick={() => onPick?.(i)}
          className={cn("group flex w-full items-start gap-3 border px-3.5 py-3 text-left transition-colors sm:px-4",
            st === "idle" && "hover:border-foreground/50 hover:bg-muted/50",
            st === "picked" && "border-foreground bg-muted",
            st === "correct" && "border-ok bg-ok/10",
            st === "missed" && "border-ok border-dashed bg-ok/5",
            st === "wrong" && "border-destructive bg-destructive/10",
            st === "dim" && "opacity-55",
            disabled && "cursor-default")}>
          <span className={cn("grid size-6 shrink-0 place-items-center border font-mono text-xs tabular-nums transition-colors",
            st === "idle" && "group-hover:border-foreground",
            st === "picked" && "border-foreground bg-foreground text-background",
            (st === "correct" || st === "missed") && "border-ok bg-ok text-background",
            st === "wrong" && "border-destructive bg-destructive text-background")}>{i + 1}</span>
          <span className="min-w-0 flex-1 pt-0.5 leading-snug">{o}</span>
        </button>
      </li>;
    })}
  </ol>;
}

/** Не перехватывать горячие клавиши, когда пользователь печатает. */
export const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};
