"use client";

import { useSearchParams } from "next/navigation";
import { BankGate } from "./common";
import { ExamDashboard } from "./dashboard";
import { ExamSession, type PracticeSet } from "./session";
import { ExamSimulation } from "./simulation";
import { ExamBankView } from "./bank-view";

export function ExamHome() {
  return <BankGate>{(bank) => <ExamDashboard bank={bank} />}</BankGate>;
}

const SETS: PracticeSet[] = ["mistakes", "marked", "leeches", "topic"];
export function ExamSessionPage() {
  const params = useSearchParams();
  const t = Number(params.get("topic"));
  const topic = Number.isInteger(t) && t > 0 ? t : undefined;
  const practice = params.get("practice") as PracticeSet | null;
  const set = practice && SETS.includes(practice) ? practice : undefined;
  return <BankGate>{(bank) => <ExamSession key={`${set}-${topic}`} bank={bank} mode={set ? "practice" : "review"} topic={topic} set={set} />}</BankGate>;
}

export function ExamTestPage() {
  return <BankGate>{(bank) => <ExamSimulation bank={bank} />}</BankGate>;
}

export function ExamBankPage() {
  return <BankGate>{(bank) => <ExamBankView bank={bank} />}</BankGate>;
}
