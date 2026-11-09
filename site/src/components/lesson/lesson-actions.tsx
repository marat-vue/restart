"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import { CheckIcon, CircleIcon, MinusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppDispatch, useAppSelector, useHydrated } from "@/store/hooks";
import { setCompleted, visit } from "@/store";
import { cn } from "@/lib/utils";

export function LessonActions({ id, href, title, variant = "header" }: { id: string; href: string; title: string; variant?: "header" | "footer" }) {
  const dispatch = useAppDispatch();
  const hydrated = useHydrated();
  const done = useAppSelector((s) => Boolean(s.progress.lessons[id]?.c));
  useEffect(() => {
    if (hydrated && variant === "header") dispatch(visit({ id, href, title }));
  }, [hydrated, id, href, title, variant, dispatch]);
  const toggle = () => {
    dispatch(setCompleted({ ids: [id], value: !done }));
    toast(done ? "Отметка снята" : "Урок отмечен изученным");
  };
  if (variant === "footer") return (
    <div className={cn("flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between", !hydrated && "opacity-0")}>
      <div><div className="font-display text-lg font-semibold">{done ? "Урок изучен" : "Дочитали до конца?"}</div>
        <div className="mt-1 text-sm text-muted-foreground">Прогресс сохранится в вашем браузере.</div></div>
      <Button disabled={!hydrated} size="lg" variant={done ? "outline" : "default"} className="px-4" onClick={toggle}>
        {done ? <MinusIcon /> : <CheckIcon />}{done ? "Снять отметку" : "Отметить изученным"}
      </Button>
    </div>
  );
  return <Button disabled={!hydrated} variant={done ? "default" : "outline"} onClick={toggle} className="px-3.5">
    {done ? <CheckIcon /> : <CircleIcon />}{done ? "Изучено" : "Отметить изученным"}
  </Button>;
}
