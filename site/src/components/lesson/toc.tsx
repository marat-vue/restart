"use client";

import { useEffect, useState } from "react";
import type { TocItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Toc({ items }: { items: TocItem[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const onScroll = () => {
      let cur: string | null = null;
      for (const el of els) {
        if (el.getBoundingClientRect().top < 140) cur = el.id;
        else break;
      }
      setActive(cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [items]);

  if (!items.length) return null;

  return (
    <nav aria-label="Оглавление">
      <div className="label mb-4">На странице</div>
      <ul className="space-y-0.5 border-l">
        {items.map((i) => (
          <li key={i.id}>
            <a
              href={`#${i.id}`}
              className={cn(
                "-ml-px block border-l py-1 text-[13px] leading-snug text-muted-foreground transition-colors hover:text-foreground",
                i.depth === 3 ? "pl-7" : "pl-4",
                active === i.id ? "border-brand text-foreground" : "border-transparent",
              )}
            >
              {i.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
