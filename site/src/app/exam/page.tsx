import type { Metadata } from "next";
import { ExamHome } from "@/components/exam/pages";

export const metadata: Metadata = { title: "Экзамен 1С:Профессионал" };

export default function ExamPage() {
  return <ExamHome />;
}
