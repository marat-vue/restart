import type { Metadata } from "next";
import { ExamTestPage } from "@/components/exam/pages";

export const metadata: Metadata = { title: "Пробный экзамен" };

export default function TestPage() {
  return <ExamTestPage />;
}
