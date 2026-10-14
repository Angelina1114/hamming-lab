import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from 'lucide-react';

export interface Stepper {
  /** current frame, 0 … total − 1 */
  step: number;
  total: number;
  setStep: (n: number) => void;
  next: () => void;
  prev: () => void;
  reset: () => void;
  playing: boolean;
  toggle: () => void;
  setPlaying: (p: boolean) => void;
  atStart: boolean;
  atEnd: boolean;
}

/** Frame stepper with autoplay that can be paused. */
export function useStepper(total: number, { interval = 1300, initial = 0 }: { interval?: number; initial?: number } = {}): Stepper {
  const [step, setStepRaw] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const clamp = useCallback((n: number) => Math.max(0, Math.min(total - 1, n)), [total]);
  const setStep = useCallback((n: number) => setStepRaw(clamp(n)), [clamp]);

  // keep the frame valid when the number of frames changes (e.g. a different input)
  useEffect(() => setStepRaw((s) => clamp(s)), [clamp]);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setStepRaw((s) => {
        if (s >= total - 1) {
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, interval);
    return () => window.clearInterval(id);
  }, [playing, total, interval]);

  return {
    step,
    total,
    setStep,
    next: () => setStep(step + 1),
    prev: () => setStep(step - 1),
    reset: () => {
      setPlaying(false);
      setStepRaw(initial);
    },
    playing,
    toggle: () => {
      if (!playing && step >= total - 1) setStepRaw(0);
      setPlaying((p) => !p);
    },
    setPlaying,
    atStart: step <= 0,
    atEnd: step >= total - 1,
  };
}

export function StepControls({ s, label, large = false, extra }: { s: Stepper; label?: ReactNode; large?: boolean; extra?: ReactNode }) {
  const btn = large ? '!px-4 !py-2 text-base' : '';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={`btn-ghost ${btn}`} onClick={s.reset} title="重設">
        <RotateCcw className="h-4 w-4" />
        <span className="hidden sm:inline">重設</span>
      </button>
      <button type="button" className={`btn-ghost ${btn}`} onClick={s.prev} disabled={s.atStart} title="上一步">
        <ChevronLeft className="h-4 w-4" />
        上一步
      </button>
      <button type="button" className={`btn-ghost ${btn}`} onClick={s.toggle} title={s.playing ? '暫停' : '自動播放'} aria-pressed={s.playing}>
        {s.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {s.playing ? '暫停' : '播放'}
      </button>
      <button type="button" className={`btn-primary ${btn}`} onClick={s.next} disabled={s.atEnd} title="下一步">
        下一步
        <ChevronRight className="h-4 w-4" />
      </button>
      <span className={`ml-1 font-mono text-slate-500 ${large ? 'text-base' : 'text-xs'}`}>
        {s.step + 1} / {s.total}
      </span>
      {label && <span className={`text-slate-600 ${large ? 'text-base' : 'text-sm'}`}>{label}</span>}
      {extra}
    </div>
  );
}
