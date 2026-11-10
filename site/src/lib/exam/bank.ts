"use client";

import { useEffect, useState } from "react";
import { BASE_PATH } from "../assets";
import { parseBank } from "./data";
import type { ExamBank } from "./types";

/** Общий банк вопросов публикуется вместе с сайтом: public/exam/bank.json. */
let cached: Promise<ExamBank> | null = null;

async function load(): Promise<ExamBank> {
  const r = await fetch(`${BASE_PATH}/exam/bank.json`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseBank(await r.json());
}

export function useBank() {
  const [state, setState] = useState<{ status: "loading" | "error" | "ready"; bank?: ExamBank }>({ status: "loading" });
  useEffect(() => {
    cached ??= load();
    void cached.then(
      (bank) => setState({ status: "ready", bank }),
      () => { cached = null; setState({ status: "error" }); },
    );
  }, []);
  return state;
}
