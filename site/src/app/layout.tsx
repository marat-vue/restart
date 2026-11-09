import type { Metadata, Viewport } from "next";
import { Golos_Text, JetBrains_Mono, Tektur } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { StoreProvider } from "@/store/provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { CommandMenu } from "@/components/command-menu";
import { MotionPreferences } from "@/components/visual-effects";
import "./globals.css";

// Заголовки — строгий угловатый Tektur, текст — Golos Text (создан для удобного чтения кириллицы),
// код — JetBrains Mono. Все три шрифта с кириллицей и отдаются как статика.
const display = Tektur({ subsets: ["latin", "cyrillic"], weight: ["500", "600", "700"], variable: "--font-tektur", display: "swap" });
const body = Golos_Text({ subsets: ["latin", "cyrillic"], weight: ["400", "500", "600"], variable: "--font-golos", display: "swap" });
const code = JetBrains_Mono({ subsets: ["latin", "cyrillic"], weight: ["400", "500"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: { default: "re:start — конспект по 1С", template: "%s · re:start" },
  description:
    "Конспект по разработке на 1С:Предприятие: конфигурирование, встроенный язык, запросы, СКД и управляемые формы. Поиск и прогресс обучения.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#232528" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" suppressHydrationWarning className={`antialiased ${display.variable} ${body.variable} ${code.variable}`}>
      <body className="min-h-dvh flex flex-col">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <StoreProvider>
            <MotionPreferences>
              <TooltipProvider delay={300}>
                <SiteHeader />
                <div className="flex-1 flex flex-col">{children}</div>
                <CommandMenu />
                <Toaster position="bottom-center" />
              </TooltipProvider>
            </MotionPreferences>
          </StoreProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
