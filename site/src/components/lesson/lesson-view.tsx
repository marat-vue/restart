import Link from "next/link";
import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import { getContent, getNeighbours, getParents, readLesson, toNav } from "@/lib/content";
import { renderLesson } from "@/lib/markdown";
import type { ContentNode } from "@/lib/types";
import { Breadcrumbs } from "../breadcrumbs";
import { SectionNav, type SectionLink } from "./section-nav";
import { Toc } from "./toc";
import { LessonActions } from "./lesson-actions";
import { ArticleEnhancer } from "./article-enhancer";
import { DiagramEnhancer } from "./diagram-enhancer";
import { ImageZoom } from "./image-zoom";
import { ReadingProgress } from "./reading-progress";
import { MobileNav } from "./mobile-nav";
import { plural } from "@/lib/date";

export async function LessonView({ node }: { node: ContentNode }) {
  const parents = getParents(node);
  const { root } = getContent();
  const { title, html, toc, minutes } = await renderLesson(readLesson(node), node.rel);
  const { prev, next } = getNeighbours(node);

  const top = parents[0];
  const tree = top ? toNav(top) : null;
  const sections: SectionLink[] = root.map((r) => ({ id: r.id, num: r.num, title: r.title, href: r.href }));
  const nav = <SectionNav tree={tree} sections={sections} currentId={node.id} />;

  return (
    <>
      <ReadingProgress />
      <div className="mx-auto grid w-full max-w-[1440px] flex-1 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_260px]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] border-r lg:block">{nav}</aside>

        <main className="min-w-0 px-4 pb-24 pt-6 sm:px-8 lg:px-12 xl:px-16">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <MobileNav>{nav}</MobileNav>
          </div>

          <article className="mx-auto max-w-[760px]">
            <Breadcrumbs chain={parents} />
            <header className="mt-8 animate-rise">
              <div className="label flex items-center gap-3">
                <span>Урок {node.num}</span>
                <span className="accent-square" />
                <span>
                  {minutes} {plural(minutes, ["минута", "минуты", "минут"])} чтения
                </span>
              </div>
              <h1 className="mt-4 text-3xl font-semibold leading-[1.1] text-balance sm:text-[2.6rem]">{title ?? node.title}</h1>
              <div className="mt-7">
                <LessonActions id={node.id} href={node.href} title={node.title} />
              </div>
            </header>

            <div id="lesson-body" className="prose mt-10 animate-rise [animation-delay:80ms]" dangerouslySetInnerHTML={{ __html: html }} />
            <ArticleEnhancer targetId="lesson-body" />
            <DiagramEnhancer targetId="lesson-body" />
            <ImageZoom targetId="lesson-body" />

            <div className="mt-16 border-t pt-8">
              <LessonActions id={node.id} href={node.href} title={node.title} variant="footer" />
            </div>

            <nav className="mt-10 grid grid-cols-1 gap-px border bg-border sm:grid-cols-2">
              {prev ? (
                <Link href={prev.href} className="group flex flex-col gap-1.5 bg-background p-5 transition-colors hover:bg-foreground hover:text-background">
                  <span className="label flex items-center gap-2">
                    <ArrowLeftIcon className="size-3 transition-transform group-hover:-translate-x-1" /> Назад
                  </span>
                  <span className="line-clamp-2 font-medium leading-snug">{prev.title}</span>
                </Link>
              ) : (
                <span className="hidden bg-background sm:block" />
              )}
              {next ? (
                <Link href={next.href} className="group flex flex-col items-end gap-1.5 bg-background p-5 text-right transition-colors hover:bg-foreground hover:text-background">
                  <span className="label flex items-center gap-2">
                    Далее <ArrowRightIcon className="size-3 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="line-clamp-2 font-medium leading-snug">{next.title}</span>
                </Link>
              ) : (
                <span className="hidden bg-background sm:block" />
              )}
            </nav>
          </article>
        </main>

        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto py-10 pr-6 thin-scrollbar xl:block">
          <Toc items={toc} />
        </aside>
      </div>
    </>
  );
}
