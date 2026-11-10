import type { Metadata } from "next";
import { ExamBankPage } from "@/components/exam/pages";

export const metadata: Metadata = { title: "Банк вопросов · Экзамен" };

export default function BankPage() {
  return <ExamBankPage />;
}
