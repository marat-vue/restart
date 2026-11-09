"use client";
import { useRef, useState } from "react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { DownloadIcon, UploadIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppDispatch, useAppStore, useHydrated } from "@/store/hooks";
import { hydrate, resetAll, selectPersisted } from "@/store";
import { parseBackup } from "@/lib/progress-data";
import { dayKey } from "@/lib/date";
import { cn } from "@/lib/utils";

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return <div className="grid gap-4 border-b py-7 md:grid-cols-[1fr_minmax(0,320px)] md:items-center md:gap-10">
    <div><div className="font-medium">{title}</div><div className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</div></div>
    <div className="flex items-center justify-start md:justify-end">{children}</div>
  </div>;
}
export function SettingsView() {
  const hydrated = useHydrated();
  const dispatch = useAppDispatch();
  const store = useAppStore();
  const { theme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const exportData = () => {
    const blob = new Blob([JSON.stringify({ app: "re-1c", version: 1, exportedAt: new Date().toISOString(), ...selectPersisted(store.getState()) }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `re-1c-progress-${dayKey()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Резервная копия сохранена");
  };
  const importData = async (file: File) => {
    try {
      const progress = parseBackup(JSON.parse(await file.text()));
      dispatch(hydrate({ progress }));
      toast("Прогресс восстановлен из файла");
    } catch { toast.error("Не удалось прочитать резервную копию re:1c. Текущий прогресс сохранён."); }
  };
  return <main className={cn("mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 sm:py-16", !hydrated && "opacity-0")}>
    <div className="label">Параметры</div><h1 className="mt-3 text-5xl font-semibold uppercase sm:text-7xl">Настройки</h1>
    <h2 className="label mt-14">Оформление</h2>
    <div className="border-t"><Row title="Тема" desc="Молочно-белая или графитовая палитра.">
      <div className="inline-flex border p-0.5">
        {[["light", "Светлая"], ["dark", "Тёмная"], ["system", "Системная"]].map(([k, l]) =>
          <button key={k} onClick={() => setTheme(k)} aria-pressed={theme === k} className={cn("px-3 py-1.5 text-sm transition-colors", theme === k ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{l}</button>)}
      </div>
    </Row></div>
    <h2 className="label mt-14">Данные</h2>
    <div className="border-t">
      <Row title="Резервная копия" desc="Прогресс хранится в этом браузере. Экспортируйте его для переноса на другое устройство. При импорте отметки заменяются данными из файла.">
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportData}><DownloadIcon /> Экспорт</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><UploadIcon /> Импорт</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Загрузить резервную копию" className="hidden" onChange={(e) => {
            const f = e.target.files?.[0]; if (f) void importData(f); e.target.value = "";
          }} />
        </div>
      </Row>
      <Row title="Сбросить прогресс" desc="Удалит отметки изученных уроков и историю чтения. Сначала можно сохранить резервную копию.">
        <Button variant="destructive" onClick={() => setConfirm(true)}><Trash2Icon /> Сбросить всё</Button>
      </Row>
    </div>
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent>
      <DialogHeader><DialogTitle>Сбросить весь прогресс?</DialogTitle><DialogDescription>Отметки уроков и история чтения будут удалены. Рекомендуем сначала сделать экспорт.</DialogDescription></DialogHeader>
      <DialogFooter><DialogClose render={<Button variant="outline" />}>Отмена</DialogClose>
        <Button onClick={() => { dispatch(resetAll()); setConfirm(false); toast("Прогресс сброшен"); }}>Сбросить</Button>
      </DialogFooter>
    </DialogContent></Dialog>
    <div className="mt-14 border-t pt-6 text-sm leading-relaxed text-muted-foreground">re:1c · Конспект по 1С:Предприятию. Материалы загружаются из Markdown-файлов вашего конспекта.</div>
  </main>;
}
