import type { Metadata } from "next";
import { Suspense } from "react";
import { ExamSessionPage } from "@/components/exam/pages";

export const metadata: Metadata = { title: "Занятие · Экзамен" };

export default function SessionPage() {
  return <Suspense><ExamSessionPage /></Suspense>;
}
