import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-24">
      <div className="text-center">
        <div className="font-display text-[clamp(6rem,20vw,12rem)] font-semibold leading-none text-faint">404</div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">Такой страницы нет</h1>
        <p className="mt-2 text-muted-foreground">Возможно, урок переименовали или перенесли.</p>
        <Link href="/" className={buttonVariants({ size: "lg", className: "mt-8 px-5" })}>
          К разделам
        </Link>
      </div>
    </main>
  );
}
