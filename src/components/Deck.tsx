import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, Minimize, Pause, Play, X } from 'lucide-react';
import { useStepper, type Stepper } from './l2/Stepper';
import { PresentingContext } from '../lib/presenting';

/** One slide: how many animation steps it has, and how to draw a given step. */
export interface DeckSlide<C> {
  title: string;
  sub?: string;
  steps: (c: C) => number;
  render: (s: Stepper, c: C) => ReactNode;
}

interface DeckProps<C> {
  slides: DeckSlide<C>[];
  ctx: C;
  /** short label in the top bar, e.g. 「第一課報告」 */
  label: string;
  /** where the ✕ button goes */
  exitHref: string;
  /** deck-specific controls in the top bar (example pickers, toggles …) */
  toolbar?: ReactNode;
  /** change this to restart the current slide (e.g. after switching the example) */
  resetKey?: number;
}

/** Slide size the content is laid out at; the slide area is zoomed to fill whatever screen it is on. */
const DESIGN_W = 1180;
const DESIGN_H = 620;

/** Presentation shell shared by every lesson: top bar, keyboard, zoom-to-projector, fullscreen, step footer. */
export function Deck<C>({ slides, ctx, label, exitHref, toolbar, resetKey = 0 }: DeckProps<C>) {
  const [idx, setIdx] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [full, setFull] = useState(() => !!document.fullscreenElement);
  // switching the example restarts the current slide from its first step
  const [seenReset, setSeenReset] = useState(resetKey);
  if (seenReset !== resetKey) {
    setSeenReset(resetKey);
    setAtEnd(false);
  }

  const go = useCallback(
    (n: number, toEnd = false) => {
      setIdx(Math.max(0, Math.min(slides.length - 1, n)));
      setAtEnd(toEnd);
    },
    [slides.length],
  );

  const toggleFull = useCallback(() => {
    // fullscreen is optional: some viewers (embedded frames, phones) refuse it
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col bg-slate-100">
      <header className="z-30 flex flex-wrap items-center gap-2 bg-slate-900 px-3 py-2 text-white sm:px-5">
        <a href={exitHref} className="rounded-lg p-1.5 hover:bg-white/10" title="離開報告模式" aria-label="離開報告模式">
          <X className="h-5 w-5" />
        </a>
        <span className="text-sm font-bold">{label}</span>
        <span className="font-mono text-xs text-slate-400">
          {idx + 1}/{slides.length}
        </span>
        {/* a picker keeps focus after a choice, which would swallow the arrow keys: hand them back to the deck */}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs" onChange={(e) => e.target instanceof HTMLSelectElement && e.target.blur()}>
          {toolbar}
          <button className="rounded-md p-1.5 hover:bg-white/10" onClick={toggleFull} title="全螢幕 (F)" aria-label="全螢幕">
            {full ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </button>
        </div>
      </header>
      <SlideHost key={`${idx}-${resetKey}`} slides={slides} idx={idx} ctx={ctx} startAtEnd={atEnd} go={go} toggleFull={toggleFull} />
    </div>
  );
}

/** One slide with its own stepper (re-mounted per slide so frame counts never leak between slides). */
function SlideHost<C>({
  slides,
  idx,
  ctx,
  startAtEnd,
  go,
  toggleFull,
}: {
  slides: DeckSlide<C>[];
  idx: number;
  ctx: C;
  startAtEnd: boolean;
  go: (n: number, toEnd?: boolean) => void;
  toggleFull: () => void;
}) {
  const slide = slides[idx];
  const total = slide.steps(ctx);
  const s = useStepper(total, { interval: 1100, initial: startAtEnd ? total - 1 : 0 });

  // zoom the slide to the room between the bars: fill the width and keep a typical slide on one screen.
  // A taller one-step slide shrinks to fit when it opens, by at most 15% (beyond that it scrolls rather
  // than turn unreadable); stepped slides keep the base zoom so nothing jumps while steps appear.
  const mainRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  useLayoutEffect(() => {
    const el = mainRef.current;
    const box = contentRef.current;
    if (!el || !box) return;
    const fit = () => {
      const base = Math.max(0.7, Math.min(1.8, el.clientWidth / DESIGN_W, el.clientHeight / DESIGN_H));
      if (total > 1) return setZoom(base);
      // on narrow screens the slide reflows with the zoom, so measure at each candidate zoom and keep
      // the largest one that fits (falling back to the 15% floor, which then scrolls)
      let z = base;
      let best = base * 0.85;
      for (let pass = 0; pass < 4; pass++) {
        box.style.zoom = String(z);
        const natural = box.getBoundingClientRect().height / z;
        if (z * natural <= el.clientHeight + 1) {
          best = Math.max(best, z);
          break;
        }
        const next = Math.max(base * 0.85, Math.min(base, el.clientHeight / natural));
        if (Math.abs(next - z) < 0.005) break;
        z = next;
      }
      box.style.zoom = String(best);
      setZoom(best);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [total]);

  const forward = useCallback(() => {
    if (s.step < total - 1) s.next();
    else if (idx < slides.length - 1) go(idx + 1);
  }, [s, total, idx, go, slides.length]);
  const back = useCallback(() => {
    if (s.step > 0) s.prev();
    else if (idx > 0) go(idx - 1, true);
  }, [s, idx, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return; // leave browser shortcuts (⌘F, ⌘←, …) alone
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        forward();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        back();
      } else if (e.key === 'p' || e.key === 'P') s.toggle();
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(slides.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, back, s, toggleFull, go, slides.length]);

  return (
    <>
      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div ref={contentRef} style={{ zoom, maxWidth: DESIGN_W }} className="mx-auto px-4 py-4 sm:px-8">
          <motion.section initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{slide.title}</h1>
            {slide.sub && <p className="mt-1 text-lg text-slate-500">{slide.sub}</p>}
            {/* a lesson card reused as the whole slide drops its own frame: one frame per slide */}
            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:px-8 sm:py-6 [&>.card]:border-0 [&>.card]:p-0 [&>.card]:shadow-none [&_li]:text-pretty [&_p]:text-pretty">
              <PresentingContext.Provider value={true}>{slide.render(s, ctx)}</PresentingContext.Provider>
            </div>
          </motion.section>
        </div>
      </main>
      <footer className="z-30 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-5">
        <button className="btn-ghost !px-4 !py-2 text-base" onClick={back} disabled={idx === 0 && s.step === 0}>
          <ChevronLeft className="h-5 w-5" /> 上一步
        </button>
        <button className="btn-ghost !px-4 !py-2 text-base" onClick={s.toggle} disabled={total <= 1} aria-pressed={s.playing}>
          {s.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {s.playing ? '暫停' : '播放'}
        </button>
        <button className="btn-primary !px-4 !py-2 text-base" onClick={forward} disabled={idx === slides.length - 1 && s.step >= total - 1}>
          下一步 <ChevronRight className="h-5 w-5" />
        </button>
        <span className="ml-1 font-mono text-sm text-slate-500">
          步驟 {s.step + 1}/{total}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {slides.map((sl, k) => (
            <button key={k} onClick={() => go(k)} title={sl.title} className={`h-2.5 rounded-full transition-all ${k === idx ? 'w-6 bg-slate-900' : 'w-2.5 bg-slate-300 hover:bg-slate-500'}`} aria-label={`第 ${k + 1} 頁：${sl.title}`} />
          ))}
        </div>
      </footer>
    </>
  );
}
