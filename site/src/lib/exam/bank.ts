"use client";

import { useCallback, useEffect, useState } from "react";
import { BASE_PATH } from "../assets";
import { parseBank } from "./data";
import type { ExamBank } from "./types";

/**
 * Банк вопросов не входит в публичную сборку. Локально он лежит в public/exam/bank.json,
 * на опубликованном сайте его загружают файлом — копия хранится в IndexedDB этого браузера.
 */
const DB = "re-1c-exam";
const STORE = "bank";

function idb<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction(STORE, mode);
      const req = run(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

export type BankSource = "build" | "import";
let cached: Promise<{ bank: ExamBank; source: BankSource } | null> | null = null;

async function load(): Promise<{ bank: ExamBank; source: BankSource } | null> {
  try {
    const r = await fetch(`${BASE_PATH}/exam/bank.json`);
    if (r.ok) return { bank: parseBank(await r.json()), source: "build" };
  } catch {}
  try {
    const stored = await idb<unknown>("readonly", (s) => s.get("bank"));
    if (stored) return { bank: parseBank(stored), source: "import" };
  } catch {}
  return null;
}

export async function importBank(file: File) {
  const bank = parseBank(JSON.parse(await file.text()));
  await idb("readwrite", (s) => s.put(bank, "bank"));
  cached = null;
  return bank;
}
export async function removeImportedBank() {
  await idb("readwrite", (s) => s.delete("bank"));
  cached = null;
}

export function useBank() {
  const [state, setState] = useState<{ status: "loading" | "missing" | "ready"; bank?: ExamBank; source?: BankSource }>({ status: "loading" });
  const reload = useCallback(() => {
    cached ??= load();
    void cached.then((res) => setState(res ? { status: "ready", ...res } : { status: "missing" }));
  }, []);
  useEffect(reload, [reload]);
  return { ...state, reload: () => { cached = null; reload(); } };
}
