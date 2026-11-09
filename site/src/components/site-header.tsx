"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { openSearch } from "@/hooks/use-progress";
import { ThemeToggle } from "./theme-toggle";
import { Kbd } from "@/components/ui/kbd";

const NAV = [
  { href: "/", label: "Разделы", match: (p: string) => p === "/" || p.startsWith("/l/") },
  { href: "/stats/", label: "Статистика", match: (p: string) => p.startsWith("/stats") },
  { href: "/settings/", label: "Настройки", match: (p: string) => p.startsWith("/settings") },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/85">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5 shrink-0" aria-label="На главную">
          <span className="brand-logo grid size-7 place-items-center font-display text-[12px] font-bold">
            1С
          </span>
          <span className="hidden font-display text-[14px] font-semibold uppercase tracking-[0.04em] sm:inline">
            <span className="text-muted-foreground">re:</span>start
          </span>
        </Link>

        <nav className="ml-1 flex items-center overflow-x-auto no-scrollbar sm:ml-2">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex h-14 items-center gap-1.5 px-2.5 text-[13px] whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                  active && "text-foreground",
                  "px-2 sm:px-2.5",
                )}
              >
                {item.label}
                {active && <motion.span layoutId="header-active" className="nav-active absolute inset-x-2.5 -bottom-px h-[3px]" transition={{ type: "spring", stiffness: 340, damping: 30 }} />}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={openSearch}
            aria-label="Поиск по конспекту"
            className="search-trigger flex h-8 items-center gap-2 border bg-card pl-2.5 pr-1.5 text-[13px] text-muted-foreground"
          >
            <SearchIcon className="size-3.5" />
            <span className="hidden lg:inline pr-6">Поиск по урокам</span>
            <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
          </button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
