"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, ChevronRightIcon, MaximizeIcon, MinusIcon, PlusIcon, ScanIcon, XIcon } from "lucide-react";

interface Shot { src: string; alt: string }
interface View { s: number; x: number; y: number }

// Obsidian подставляет имя файла в alt — такую «подпись» не показываем
const caption = (alt: string) => (/^pasted image|\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(alt.trim()) ? "" : alt.trim());

const MAX_SCALE = 8; // относительно натурального размера картинки
const STEP = 1.4;

/**
 * Делает картинки урока кликабельными и открывает их в полноэкранном просмотрщике:
 * колесо и щипок — приближение к точке, перетаскивание — панорама,
 * двойной клик — 100% / вписать, стрелки — соседние картинки.
 */
export function ImageZoom({ targetId }: { targetId: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState<{ path: string; shots: Shot[]; index: number } | null>(null);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const imgs = Array.from(root.querySelectorAll<HTMLImageElement>("img")).filter((img) => !img.closest("a"));
    const cleanups = imgs.map((img, i) => {
      let wrap = img.parentElement;
      if (!wrap?.classList.contains("zoomable")) {
        wrap = document.createElement("button");
        wrap.className = "zoomable";
        (wrap as HTMLButtonElement).type = "button";
        img.replaceWith(wrap);
        wrap.append(img);
      }
      wrap.setAttribute("aria-label", `Открыть изображение${caption(img.alt) ? `: ${caption(img.alt)}` : ""}`);
      const onClick = () => setOpen({ path: pathname, index: i, shots: imgs.map((m) => ({ src: m.currentSrc || m.src, alt: caption(m.alt) })) });
      wrap.addEventListener("click", onClick);
      return () => wrap.removeEventListener("click", onClick);
    });
    return () => cleanups.forEach((c) => c());
  }, [targetId, pathname]);

  // после перехода на другой урок просмотрщик просто не показывается
  if (!open || open.path !== pathname) return null;
  return createPortal(
    <Viewer key={open.index} shots={open.shots} index={open.index}
      onIndex={(index) => setOpen({ ...open, index })} onClose={() => setOpen(null)} />,
    document.body,
  );
}

function Viewer({ shots, index, onIndex, onClose }: { shots: Shot[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const shot = shots[index];
  const stageRef = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [minScale, setMinScale] = useState(1); // масштаб «вписать в экран», не больше 100%
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dist: number; s: number; cx: number; cy: number; x: number; y: number } | null>(null);
  const moved = useRef(false);

  const stageSize = () => {
    const r = stageRef.current?.getBoundingClientRect();
    return { w: r?.width ?? window.innerWidth, h: r?.height ?? window.innerHeight };
  };
  const fitFor = useCallback((nat: { w: number; h: number }) => {
    const { w, h } = stageSize();
    return Math.min(1, (w - 32) / nat.w, (h - 32) / nat.h);
  }, []);

  /** Держит картинку в кадре: маленькую — по центру, большую — без пустых полей. */
  const clamp = useCallback((v: View, nat = natural): View => {
    if (!nat) return v;
    const { w, h } = stageSize();
    const iw = nat.w * v.s, ih = nat.h * v.s;
    const x = iw <= w ? (w - iw) / 2 : Math.min(0, Math.max(w - iw, v.x));
    const y = ih <= h ? (h - ih) / 2 : Math.min(0, Math.max(h - ih, v.y));
    return { s: v.s, x, y };
  }, [natural]);

  const zoomAt = useCallback((next: number, px?: number, py?: number) => {
    setView((v) => {
      const { w, h } = stageSize();
      const s = Math.min(MAX_SCALE, Math.max(minScale, next));
      const cx = px ?? w / 2, cy = py ?? h / 2;
      return clamp({ s, x: cx - (cx - v.x) * (s / v.s), y: cy - (cy - v.y) * (s / v.s) });
    });
  }, [clamp, minScale]);

  const fit = useCallback(() => setView(clamp({ s: minScale, x: 0, y: 0 })), [clamp, minScale]);

  const onLoad = (img: HTMLImageElement) => {
    const nat = { w: img.naturalWidth, h: img.naturalHeight };
    const s = fitFor(nat);
    setNatural(nat);
    setMinScale(s);
    setView(clamp({ s, x: 0, y: 0 }, nat));
  };

  useEffect(() => {
    const onResize = () => {
      if (!natural) return;
      const s = fitFor(natural);
      setMinScale(s);
      setView((v) => clamp({ ...v, s: Math.max(s, v.s) }));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp, fitFor, natural]);

  useEffect(() => {
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const focused = document.activeElement as HTMLElement | null;
    return () => { document.documentElement.style.overflow = prevOverflow; focused?.focus?.(); };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") zoomAt(view.s * STEP);
      else if (e.key === "-" || e.key === "_") zoomAt(view.s / STEP);
      else if (e.key === "0") fit();
      else if (e.key === "1") zoomAt(1);
      else if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
      else if (e.key === "ArrowRight" && index < shots.length - 1) onIndex(index + 1);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view.s, zoomAt, fit, onClose, onIndex, index, shots.length]);

  // колесо: passive: false, чтобы не прокручивать страницу
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      setView((v) => {
        const s = Math.min(MAX_SCALE, Math.max(minScale, v.s * factor));
        const px = e.clientX - r.left, py = e.clientY - r.top;
        return clamp({ s, x: px - (px - v.x) * (s / v.s), y: py - (py - v.y) * (s / v.s) });
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clamp, minScale]);

  const local = (e: React.PointerEvent) => {
    const r = stageRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startGesture = () => {
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const [a, b] = pts;
      gesture.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), s: view.s, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, x: view.x, y: view.y };
    } else if (pts.length === 1) {
      gesture.current = { dist: 0, s: view.s, cx: pts[0].x, cy: pts[0].y, x: view.x, y: view.y };
    } else gesture.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 1) moved.current = false;
    setDragging(true);
    startGesture();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      const s = Math.min(MAX_SCALE, Math.max(minScale, g.s * (dist / Math.max(1, g.dist))));
      setView(clamp({ s, x: cx - (g.cx - g.x) * (s / g.s), y: cy - (g.cy - g.y) * (s / g.s) }));
      moved.current = true;
    } else {
      const dx = pts[0].x - g.cx, dy = pts[0].y - g.cy;
      if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
      setView((v) => clamp({ s: v.s, x: g.x + dx, y: g.y + dy }));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) setDragging(false);
    startGesture();
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const r = stageRef.current!.getBoundingClientRect();
    // вписано → 100% → 250% → снова вписано
    const target = view.s < 0.99 ? 1 : view.s < 2.49 ? 2.5 : minScale;
    zoomAt(target, e.clientX - r.left, e.clientY - r.top);
  };
  // клик по пустому полю (не по картинке и без перетаскивания) закрывает просмотр
  const onStageClick = (e: React.MouseEvent) => {
    if (moved.current || e.target !== e.currentTarget) return;
    onClose();
  };

  const percent = Math.round(view.s * 100);

  return (
    <div className="zoom-viewer fixed inset-0 z-[60] flex flex-col animate-in fade-in-0 duration-150" role="dialog" aria-modal="true" aria-label="Просмотр изображения">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 px-3 sm:px-4">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-white/60">
          {shots.length > 1 ? `${String(index + 1).padStart(2, "0")} / ${String(shots.length).padStart(2, "0")}` : "Изображение"}
        </span>
        {shot.alt && <span className="hidden min-w-0 flex-1 truncate text-sm text-white/80 sm:block">{shot.alt}</span>}
        <button type="button" className="zoom-btn ml-auto" onClick={onClose} aria-label="Закрыть (Esc)" title="Закрыть (Esc)" autoFocus>
          <XIcon className="size-5" />
        </button>
      </div>

      <div
        ref={stageRef}
        className="zoom-stage relative min-h-0 flex-1 overflow-hidden"
        data-dragging={dragging}
        data-pixel={view.s >= 2}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onClick={onStageClick}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={shot.src}
          alt={shot.alt}
          draggable={false}
          onLoad={(e) => onLoad(e.currentTarget)}
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: natural?.w, height: natural?.h,
            transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})`,
            visibility: natural ? "visible" : "hidden",
          }}
        />
        {shots.length > 1 && index > 0 && (
          <button type="button" className="zoom-btn zoom-bar absolute left-3 top-1/2 -translate-y-1/2" onClick={() => onIndex(index - 1)} aria-label="Предыдущее изображение (←)">
            <ChevronLeftIcon className="size-5" />
          </button>
        )}
        {shots.length > 1 && index < shots.length - 1 && (
          <button type="button" className="zoom-btn zoom-bar absolute right-3 top-1/2 -translate-y-1/2" onClick={() => onIndex(index + 1)} aria-label="Следующее изображение (→)">
            <ChevronRightIcon className="size-5" />
          </button>
        )}
      </div>

      <div className="flex shrink-0 justify-center px-3 py-3">
        <div className="zoom-bar flex items-center">
          <button type="button" className="zoom-btn" onClick={() => zoomAt(view.s / STEP)} disabled={view.s <= minScale + 0.001} aria-label="Отдалить (−)" title="Отдалить (−)">
            <MinusIcon className="size-4" />
          </button>
          <span className="zoom-level tabular-nums" aria-live="polite">{percent}%</span>
          <button type="button" className="zoom-btn" onClick={() => zoomAt(view.s * STEP)} disabled={view.s >= MAX_SCALE - 0.001} aria-label="Приблизить (+)" title="Приблизить (+)">
            <PlusIcon className="size-4" />
          </button>
          <span className="mx-1 h-5 w-px bg-white/15" />
          <button type="button" className="zoom-btn" onClick={() => zoomAt(1)} aria-label="Натуральный размер (1)" title="Натуральный размер, 100% (1)">
            <ScanIcon className="size-4" />
          </button>
          <button type="button" className="zoom-btn" onClick={fit} aria-label="Вписать в экран (0)" title="Вписать в экран (0)">
            <MaximizeIcon className="size-4" />
          </button>
        </div>
      </div>
      <p className="sr-only">Колесо мыши или щипок — приближение, перетаскивание — перемещение, двойной клик — быстрое приближение.</p>
    </div>
  );
}
