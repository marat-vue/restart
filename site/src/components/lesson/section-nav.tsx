"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRightIcon } from "lucide-react";
import type { NavNode } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CompletionBar, CompletionText, LessonMark } from "../progress-bits";

export interface SectionLink {
  id: string;
  num: string | null;
  title: string;
  href: string;
}

function collectIds(n: NavNode): string[] {
  return n.kind === "lesson" ? [n.id] : (n.children ?? []).flatMap(collectIds);
}

function contains(n: NavNode, id: string): boolean {
  return n.id === id || (n.children ?? []).some((c) => contains(c, id));
}

function LessonLink({ node, active }: { node: NavNode; active: boolean }) {
  return (
    <Link
      href={node.href}
      data-active={active || undefined}
      className={cn(
        "group flex items-start gap-2.5 py-1.5 pl-2 pr-2 text-[13px] leading-snug text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
        active && "lesson-link-active",
      )}
    >
      <LessonMark id={node.id} className={cn("mt-px scale-90", active && "border-background/50")} />
      <span className="min-w-0 flex-1">{node.title}</span>
    </Link>
  );
}

function Group({ node, currentId }: { node: NavNode; currentId: string }) {
  const hasCurrent = useMemo(() => contains(node, currentId), [node, currentId]);
  const [open, setOpen] = useState(hasCurrent);
  const [prevHas, setPrevHas] = useState(hasCurrent);
  if (prevHas !== hasCurrent) {
    setPrevHas(hasCurrent);
    if (hasCurrent) setOpen(true);
  }
  const ids = useMemo(() => collectIds(node), [node]);

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-2 px-2 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted/60"
        aria-expanded={open}
      >
        <ChevronRightIcon className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-90")} />
        <span className="font-mono text-[10px] text-faint">{node.num}</span>
        <span className="min-w-0 flex-1 truncate">{node.title}</span>
        <CompletionText ids={ids} className="text-[10px] text-muted-foreground" />
      </button>
      {/* свёрнутые темы не рендерим вовсе — так статический HTML каждой страницы в разы легче */}
      {open && (
        <div className="ml-[13px] space-y-px border-l py-1 pl-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          {node.children?.map((c) =>
            c.kind === "lesson" ? <LessonLink key={c.id} node={c} active={c.id === currentId} /> : <Group key={c.id} node={c} currentId={currentId} />,
          )}
        </div>
      )}
    </div>
  );
}

export function SectionNav({ tree, sections, currentId }: { tree: NavNode | null; sections: SectionLink[]; currentId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const ids = useMemo(() => (tree ? collectIds(tree) : []), [tree]);

  // прокрутить к активному уроку
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>("[data-active]");
    if (el) setTimeout(() => el.scrollIntoView({ block: "center" }), 320);
  }, [currentId]);

  return (
    <div ref={ref} className="flex h-full flex-col">
      {tree && (
        <div className="border-b px-5 pb-4 pt-6">
          <Link href={tree.href} className="group block">
            <div className="label">Раздел {tree.num}</div>
            <div className="mt-1 font-display text-lg font-semibold group-hover:underline underline-offset-4 decoration-1">{tree.title}</div>
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <CompletionBar ids={ids} className="flex-1" />
            <CompletionText ids={ids} className="text-[11px]" />
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 py-3 thin-scrollbar">
        {tree?.children?.map((c) =>
          c.kind === "lesson" ? <LessonLink key={c.id} node={c} active={c.id === currentId} /> : <Group key={c.id} node={c} currentId={currentId} />,
        )}

        <div className="label mb-2 mt-8 px-2">Все разделы</div>
        <div className="space-y-px pb-6">
          {sections.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              className={cn(
                "flex items-center gap-2.5 px-2 py-1.5 text-[13px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                s.id === tree?.id && "text-foreground",
              )}
            >
              <span className="w-5 font-mono text-[10px] text-faint">{s.num}</span>
              {s.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
