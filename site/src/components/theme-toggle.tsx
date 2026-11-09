"use client";

import { useTheme } from "next-themes";
import { MoonIcon, SunIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { flushSync } from "react-dom";
import { useRef } from "react";
import { useReducedMotionPreference } from "@/hooks/use-reduced-motion";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const reduced = useReducedMotionPreference();
  const busy = useRef(false);
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Сменить тему"
      className="theme-toggle"
      onClick={() => {
        const next = resolvedTheme === "dark" ? "light" : "dark";
        if (reduced || !document.startViewTransition || document.visibilityState !== "visible") {
          setTheme(next); return;
        }
        if (busy.current) return;
        busy.current = true;
        const transition = document.startViewTransition(() => flushSync(() => setTheme(next)));
        void transition.ready.then(() => {
          return document.documentElement.animate(
            { clipPath: ["inset(0 0 100% 0)", "inset(0 0 0 0)"] },
            { duration: 450, easing: "cubic-bezier(.7,0,.2,1)", pseudoElement: "::view-transition-new(root)" },
          ).finished;
        }).catch(() => {}).finally(() => { busy.current = false; });
      }}
    >
      <SunIcon className="hidden dark:block" />
      <MoonIcon className="dark:hidden" />
    </Button>
  );
}
