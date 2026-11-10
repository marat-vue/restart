"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightIcon, BugIcon, FlagIcon, LibraryIcon, RotateCcwIcon, TimerIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { buildQueue, daysUntilExam, forecast, isLeech, passChance, scheduler, statusOf, topicChances } from "@/lib/exam/scheduler";
import type { ExamBank } from "@/lib/exam/types";
import { examReset, settingsChanged } from "@/store";
import { useAppDispatch } from "@/store/hooks";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { dayKey, plural } from "@/lib/date";
import { cn } from "@/lib/utils";
import { practiceIds } from "./session";
import { useExam } from "./common";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub: string; accent?: boolean }) {
  return <div className="border-b border-r p-5 sm:p-6">
    <div className="label">{label}</div>
    <div className={cn("mt-3 font-display text-4xl font-semibold tabular-nums sm:text-5xl", accent && "text-brand-text")}>{value}</div>
    <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
  </div>;
}

function ActionLink({ href, icon: Icon, title, sub, disabled }: { href: string; icon: typeof TimerIcon; title: string; sub: string; disabled?: boolean }) {
  const body = <>
    <span className="continue-icon grid size-10 shrink-0 place-items-center border"><Icon className="size-4" /></span>
    <span className="min-w-0 flex-1"><span className="block font-medium">{title}</span><span className="label mt-0.5 block">{sub}</span></span>
    <ArrowRightIcon className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
  </>;
  if (disabled) return <div className="flex items-center gap-4 bg-background p-5 opacity-45">{body}</div>;
  return <Link href={href} className="continue-link group flex items-center gap-4 p-5">{body}</Link>;
}

export function ExamDashboard({ bank }: { bank: ExamBank }) {
  const exam = useExam();
  const dispatch = useAppDispatch();
  const [confirm, setConfirm] = useState(false);
  const [now] = useState(Date.now);

  const data = useMemo(() => {
    const f = scheduler(exam.settings, now);
    const chances = topicChances(bank, exam, now, f);
    const left = daysUntilExam(exam.settings, now);
    const examAt = left !== null && left > 0 ? new Date(`${exam.settings.examDate}T09:00:00`).getTime() : null;
    const atExam = examAt ? topicChances(bank, exam, examAt, f) : null;
    const queue = buildQueue(bank, exam, { now });
    const topics = bank.topics.map((t, i) => {
      const qs = bank.questions.filter((q) => q.topic === t.id);
      const studied = qs.filter((q) => statusOf(exam.cards[q.id]) !== "new").length;
      const due = qs.filter((q) => { const c = exam.cards[q.id]; return c && c.st !== 0 && c.due <= now && !exam.suspended[q.id]; }).length;
      return { ...t, total: qs.length, studied, due, chance: chances[i] };
    });
    const days = new Set(exam.log.map((e) => dayKey(e.t)));
    const d = new Date(); if (!days.has(dayKey(d.getTime()))) d.setDate(d.getDate() - 1);
    let streak = 0; while (days.has(dayKey(d.getTime()))) { streak++; d.setDate(d.getDate() - 1); }
    const studied = bank.questions.filter((q) => statusOf(exam.cards[q.id]) !== "new").length;
    const mature = bank.questions.filter((q) => statusOf(exam.cards[q.id]) === "mature").length;
    const today = exam.log.filter((e) => dayKey(e.t) === dayKey(now));
    return {
      pass: passChance(chances), passAtExam: atExam ? passChance(atExam) : null, left,
      ready: chances.reduce((a, b) => a + b, 0) / chances.length,
      queue, topics, streak, studied, mature, today,
      forecast: forecast(exam, 14, now),
      mistakes: practiceIds(bank, exam, "mistakes", undefined, now).length,
      leeches: bank.questions.filter((q) => isLeech(exam.cards[q.id])).length,
      marked: Object.keys(exam.marked).length,
    };
  }, [bank, exam, now]);

  const total = bank.questions.length;
  const sessionSize = data.queue.queue.length + data.queue.ahead.length;
  const fmax = Math.max(1, ...data.forecast.map((x) => x.count));

  return <main className="flex-1">
    <section className="border-b">
      <div className="mx-auto max-w-[1200px] px-4 pb-12 pt-12 sm:px-6 sm:pt-16">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="hero-tag"><span className="accent-square" aria-hidden="true" />1С:Профессионал</span>
          <span className="label">{total} вопросов · {bank.topics.length} тем · интервальные повторения FSRS</span>
        </div>
        <h1 className="mt-6 font-display text-[clamp(2.6rem,7vw,5.5rem)] font-semibold uppercase leading-[0.95] tracking-[-0.02em]">
          <span className="hero-muted">Экзамен</span><br />по платформе
        </h1>
        <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">
          На экзамене 14 вопросов — по одному из каждой темы, 30 минут, сдано при 12 верных ответах.
          Система показывает вопрос как раз тогда, когда вы начинаете его забывать, и по кривой забывания
          оценивает шанс сдать экзамен прямо сейчас.
        </p>

        <div className="mt-10 grid border-l border-t sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Шанс сдать сегодня" value={pct(data.pass)} accent sub={data.passAtExam !== null ? `к экзамену без повторений: ${pct(data.passAtExam)}` : "12 из 14 верных"} />
          <Stat label="Готовность" value={pct(data.ready)} sub="средний шанс верного ответа" />
          <Stat label="Изучено" value={data.studied} sub={`из ${total} · выучено прочно ${data.mature}`} />
          <Stat label="Серия" value={data.streak} sub={plural(data.streak, ["день подряд", "дня подряд", "дней подряд"])} />
        </div>

        <div className="mt-8 grid gap-px border bg-border lg:grid-cols-[1.3fr_1fr]">
          <Link href="/exam/session/" className={cn("continue-link continue-primary group flex items-center gap-5 p-6", !sessionSize && "pointer-events-none opacity-60")}>
            <span className="min-w-0 flex-1">
              <span className="label block">{sessionSize ? "Занятие на сегодня" : "На сегодня всё"}</span>
              <span className="mt-1.5 block text-2xl font-semibold">{sessionSize ? "Начать повторение" : "Возвращайтесь завтра"}</span>
              <span className="mt-2 flex flex-wrap gap-x-4 font-mono text-xs text-muted-foreground">
                <span>{data.queue.due} к повторению</span><span>{data.queue.fresh} новых</span>
                {data.today.length > 0 && <span>сегодня отвечено {data.today.length}</span>}
              </span>
            </span>
            <ArrowRightIcon className="size-5 shrink-0 transition-transform group-hover:translate-x-1" />
          </Link>
          <div className="grid gap-px bg-border">
            <ActionLink href="/exam/test/" icon={TimerIcon} title="Пробный экзамен" sub="14 вопросов · 30 минут" />
            <ActionLink href="/exam/bank/" icon={LibraryIcon} title="Банк вопросов" sub="поиск, ответы и заметки" />
          </div>
        </div>
        <div className="mt-px grid gap-px border border-t-0 bg-border sm:grid-cols-3">
          <ActionLink href="/exam/session/?practice=mistakes" icon={RotateCcwIcon} title="Работа над ошибками" sub={`${data.mistakes} за 30 дней`} disabled={!data.mistakes} />
          <ActionLink href="/exam/session/?practice=leeches" icon={BugIcon} title="Трудные вопросы" sub={`${data.leeches} · забыты 4+ раз`} disabled={!data.leeches} />
          <ActionLink href="/exam/session/?practice=marked" icon={FlagIcon} title="Отмеченные" sub={`${data.marked} вопросов`} disabled={!data.marked} />
        </div>
      </div>
    </section>

    <div className="mx-auto max-w-[1200px] px-4 py-14 sm:px-6">
      <section>
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-2xl font-semibold">По темам</h2>
          <span className="label">шанс верного ответа на вопрос темы</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">На экзамене каждая тема даёт один вопрос, поэтому слабая тема бьёт по шансу сдать сильнее, чем кажется. Подтяните самые короткие полосы.</p>
        <div className="mt-6 border-t">
          {data.topics.map((t) => <div key={t.id} className="grid grid-cols-[2rem_1fr_auto] items-center gap-x-4 gap-y-2 border-b py-3.5 md:grid-cols-[2rem_minmax(0,22rem)_1fr_7rem_auto]">
            <span className="font-mono text-xs text-faint">{String(t.id).padStart(2, "0")}</span>
            <span className="min-w-0"><span className="block font-medium leading-snug">{t.title}</span>
              <span className="font-mono text-[11px] text-muted-foreground">{t.studied}/{t.total} изучено{t.due ? ` · ${t.due} к повторению` : ""}</span></span>
            <span className="col-span-3 col-start-2 flex items-center gap-3 md:col-span-1 md:col-start-auto" title={`Шанс верного ответа: ${pct(t.chance)}`}>
              <span className="h-1.5 flex-1 bg-muted"><span className="block h-full bg-brand transition-[width] duration-700" style={{ width: pct(t.chance) }} /></span>
              <span className="w-10 text-right font-mono text-xs tabular-nums">{pct(t.chance)}</span>
            </span>
            <span className="hidden md:block" />
            <span className="col-start-3 row-start-1 flex gap-1 md:col-start-auto md:row-start-auto">
              <Link href={`/exam/session/?topic=${t.id}`} className="inline-flex h-7 items-center border px-2.5 text-xs hover:bg-foreground hover:text-background">Учить</Link>
              <Link href={`/exam/session/?practice=topic&topic=${t.id}`} className="hidden h-7 items-center border px-2.5 text-xs hover:bg-muted sm:inline-flex" title="Все вопросы темы без влияния на расписание">Прогон</Link>
            </span>
          </div>)}
        </div>
      </section>

      <div className="mt-16 grid gap-12 lg:grid-cols-2">
        <section>
          <h2 className="text-2xl font-semibold">Нагрузка на две недели</h2>
          <p className="mt-2 text-sm text-muted-foreground">Сколько вопросов подойдёт к повторению в каждый день, без учёта новых.</p>
          <div className="mt-6 border p-5">
            <div className="flex h-36 items-end gap-[2px]" role="img" aria-label="Прогноз повторений по дням">
              {data.forecast.map((x, i) => {
                const d = new Date(x.day);
                return <div key={x.day} className="group relative flex h-full flex-1 flex-col justify-end" title={`${d.toLocaleDateString("ru", { day: "numeric", month: "long" })}: ${x.count}`}>
                  <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 whitespace-nowrap border bg-popover px-1.5 py-0.5 font-mono text-[11px] group-hover:block">{x.count}</span>
                  <span className={cn("block min-h-px w-full rounded-t-[4px] group-hover:opacity-80", i === 0 ? "bg-brand" : "bg-foreground/70")} style={{ height: `${x.count / fmax * 100}%` }} />
                </div>;
              })}
            </div>
            <div className="mt-2 flex gap-[2px] font-mono text-[10px] text-muted-foreground">
              {data.forecast.map((x, i) => <span key={x.day} className="flex-1 text-center">{i === 0 ? "сег" : WEEKDAYS[new Date(x.day).getDay()]}</span>)}
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold">Пробные экзамены</h2>
          <p className="mt-2 text-sm text-muted-foreground">Проверка в боевых условиях. Ошибки сразу возвращаются в повторение.</p>
          <div className="mt-6 border-t">
            {exam.exams.length === 0 && <div className="border-b py-6 text-sm text-muted-foreground">Попыток пока нет. Пройдите первый пробный экзамен, когда изучите хотя бы часть вопросов каждой темы.</div>}
            {[...exam.exams].reverse().slice(0, 6).map((a) => {
              const score = a.items.filter((it) => { const q = bank.questions.find((x) => x.id === it.q); return q && it.a === (exam.overrides[q.id] ?? q.answer); }).length;
              return <div key={a.at} className="flex items-center gap-4 border-b py-3">
                <span className={cn("font-display text-2xl font-semibold tabular-nums", score >= 12 ? "text-ok" : "text-destructive")}>{score}<span className="text-base text-muted-foreground">/14</span></span>
                <span className="text-sm">{score >= 12 ? "Сдано" : "Не сдано"}</span>
                <span className="ml-auto font-mono text-xs text-muted-foreground">{new Date(a.at).toLocaleDateString("ru", { day: "numeric", month: "short" })} · {Math.round(a.ms / 60_000)} мин</span>
              </div>;
            })}
          </div>
        </section>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-semibold">Настройки подготовки</h2>
        <div className="mt-6 border-t">
          <Row title="Дата экзамена" desc={data.left !== null && data.left > 0 ? `Осталось ${data.left} ${plural(data.left, ["день", "дня", "дней"])}. Интервалы не выходят за эту дату, чтобы каждый вопрос успел повториться.` : "Если указать дату, повторения будут распределены так, чтобы к ней всё было свежим."}>
            <div className="flex items-center gap-2">
              <input type="date" value={exam.settings.examDate ?? ""} min={dayKey()} onChange={(e) => dispatch(settingsChanged({ examDate: e.target.value || null }))}
                className="h-8 border bg-background px-2 text-sm" aria-label="Дата экзамена" />
              {exam.settings.examDate && <Button variant="ghost" size="sm" onClick={() => dispatch(settingsChanged({ examDate: null }))}>Сбросить</Button>}
            </div>
          </Row>
          <Row title="Новых вопросов в день" desc={`При ${exam.settings.newPerDay} в день весь банк будет пройден примерно за ${Math.ceil((total - data.studied) / Math.max(1, exam.settings.newPerDay))} дн. Каждый новый вопрос даёт ещё 5–8 повторений в следующие недели.`}>
            <div className="inline-flex border p-0.5">
              {[10, 25, 40, 60].map((n) => <button key={n} type="button" onClick={() => dispatch(settingsChanged({ newPerDay: n }))} aria-pressed={exam.settings.newPerDay === n}
                className={cn("px-3 py-1.5 text-sm tabular-nums", exam.settings.newPerDay === n ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{n}</button>)}
            </div>
          </Row>
          <Row title="Целевое запоминание" desc="С какой вероятностью вы должны помнить ответ к моменту повторения. Выше — надёжнее, но повторений больше. Для 12 из 14 разумно 90–93%.">
            <div className="inline-flex border p-0.5">
              {[0.85, 0.9, 0.93, 0.95].map((r) => <button key={r} type="button" onClick={() => dispatch(settingsChanged({ retention: r }))} aria-pressed={exam.settings.retention === r}
                className={cn("px-3 py-1.5 text-sm tabular-nums", exam.settings.retention === r ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{Math.round(r * 100)}%</button>)}
            </div>
          </Row>
          <Row title="Порядок новых вопросов" desc="Вперемешку по темам — лучше различаются похожие формулировки. По темам — проще начать, если тема совсем незнакома.">
            <div className="inline-flex border p-0.5">
              {([["mixed", "Вперемешку"], ["topic", "По темам"]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => dispatch(settingsChanged({ newOrder: k }))} aria-pressed={exam.settings.newOrder === k}
                className={cn("px-3 py-1.5 text-sm", exam.settings.newOrder === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
            </div>
          </Row>
          <Row title="Сначала вспомнить" desc="Варианты скрыты, пока вы не попробуете вспомнить ответ сами. Медленнее, но запоминается заметно прочнее.">
            <Switch checked={exam.settings.recallFirst} onCheckedChange={(v) => dispatch(settingsChanged({ recallFirst: v }))} aria-label="Сначала вспомнить ответ" />
          </Row>
          <Row title="Перемешивать варианты" desc="Чтобы запоминался ответ, а не его место в списке. Номера в вариантах вида «Варианты 1 и 2» пересчитываются автоматически.">
            <Switch checked={exam.settings.shuffle} onCheckedChange={(v) => dispatch(settingsChanged({ shuffle: v }))} aria-label="Перемешивать варианты" />
          </Row>
          <Row title="Банк вопросов" desc={`${bank.source}. Общий для всех, публикуется вместе с сайтом.`}>
            <span className="font-mono text-xs text-muted-foreground">{bank.questions.length} вопросов</span>
          </Row>
          <Row title="Сбросить подготовку" desc="Удалит историю ответов, расписание, попытки экзамена, отметки и заметки. Настройки сохранятся.">
            <Button variant="destructive" onClick={() => setConfirm(true)}><Trash2Icon />Сбросить</Button>
          </Row>
        </div>
      </section>
    </div>

    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent>
      <DialogHeader><DialogTitle>Сбросить подготовку к экзамену?</DialogTitle><DialogDescription>История ответов, расписание повторений, заметки и попытки будут удалены. Сначала можно сохранить резервную копию в «Настройках».</DialogDescription></DialogHeader>
      <DialogFooter><DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
        <Button onClick={() => { dispatch(examReset()); setConfirm(false); toast("Подготовка сброшена"); }}>Сбросить</Button>
      </DialogFooter>
    </DialogContent></Dialog>
  </main>;
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return <div className="grid gap-4 border-b py-6 md:grid-cols-[1fr_minmax(0,340px)] md:items-center md:gap-10">
    <div><div className="font-medium">{title}</div><div className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</div></div>
    <div className="flex items-center justify-start md:justify-end">{children}</div>
  </div>;
}
