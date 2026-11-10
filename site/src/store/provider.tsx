"use client";

import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { EXAM_KEY, hydrate, makeStore, STORAGE_KEY, type AppStore, type PersistedState, type RootState } from "./index";

function read(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function load(): Partial<PersistedState> {
  const stored = read(STORAGE_KEY) as Partial<PersistedState> | null;
  return { progress: stored?.progress, exam: read(EXAM_KEY) as PersistedState["exam"] };
}

// Прогресс чтения и прогресс экзамена хранятся под разными ключами:
// история ответов растёт быстрее и не должна рисковать отметками уроков.
const SLICES = [
  { key: STORAGE_KEY, pick: (s: RootState) => s.progress, wrap: (v: unknown) => ({ progress: v }) },
  { key: EXAM_KEY, pick: (s: RootState) => s.exam, wrap: (v: unknown) => v },
];

/**
 * Redux-стор живёт только в браузере. Состояние читается из localStorage
 * после монтирования (чтобы не ломать гидрацию статического HTML) и
 * сохраняется обратно при каждом изменении с небольшой задержкой.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = useState<AppStore>(makeStore);

  useEffect(() => {
    store.dispatch(hydrate(load()));

    const timers = new Map<string, ReturnType<typeof setTimeout>>();
    let prev = SLICES.map((s) => s.pick(store.getState()));
    const save = (i: number) => {
      timers.delete(SLICES[i].key);
      try {
        localStorage.setItem(SLICES[i].key, JSON.stringify(SLICES[i].wrap(SLICES[i].pick(store.getState()))));
      } catch {}
    };
    const unsubscribe = store.subscribe(() => {
      const next = SLICES.map((s) => s.pick(store.getState()));
      next.forEach((v, i) => {
        if (v === prev[i]) return;
        clearTimeout(timers.get(SLICES[i].key));
        timers.set(SLICES[i].key, setTimeout(() => save(i), 250));
      });
      prev = next;
    });

    // синхронизация между вкладками
    const onStorage = (e: StorageEvent) => {
      if (!SLICES.some((s) => s.key === e.key)) return;
      store.dispatch(hydrate(load()));
      prev = SLICES.map((s) => s.pick(store.getState()));
    };
    const flush = () => {
      SLICES.forEach((s, i) => {
        if (!timers.has(s.key)) return;
        clearTimeout(timers.get(s.key));
        save(i);
      });
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("pagehide", flush);
    return () => {
      flush();
      unsubscribe();
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("pagehide", flush);
    };
  }, [store]);

  return <Provider store={store}>{children}</Provider>;
}
