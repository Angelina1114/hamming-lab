import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  BookOpen,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  FlaskConical,
  HelpCircle,
  Lightbulb,
  ListOrdered,
  RotateCcw,
  Sigma,
  CheckCircle2,
  Wrench,
  ShieldAlert,
  XCircle,
  Info,
  Target,
  Route,
  ShieldCheck,
  MousePointerClick,
  ArrowRightCircle,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MODULES, moduleIndex } from '../lib/modules';

/* ------------------------------------------------------------------ */
/* Stage: Why → Definition → Calculation → Visualization → Experiment → Conclusion */
/* ------------------------------------------------------------------ */

export type StageKind =
  | 'why'
  | 'definition'
  | 'calculation'
  | 'visualization'
  | 'experiment'
  | 'conclusion'
  // Lesson 2 chapter structure
  | 'goals'
  | 'intuition'
  | 'math'
  | 'algorithm'
  | 'interactive'
  | 'verify'
  | 'next'
  // Algebra chapter structure (Why → What → How → Example → Connection)
  | 'what'
  | 'how'
  | 'example'
  | 'connection';

export const STAGES: Record<StageKind, { zh: string; en: string; icon: typeof HelpCircle; accent: string; dot: string }> = {
  why: { zh: '為什麼', en: 'Why', icon: HelpCircle, accent: 'text-sky-700 bg-sky-50 border-sky-200', dot: 'bg-sky-500' },
  definition: { zh: '定義', en: 'Definition', icon: BookOpen, accent: 'text-indigo-700 bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  calculation: { zh: '計算', en: 'Calculation', icon: Calculator, accent: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  visualization: { zh: '視覺化', en: 'Visualization', icon: Eye, accent: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200', dot: 'bg-fuchsia-500' },
  experiment: { zh: '實驗', en: 'Experiment', icon: FlaskConical, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  conclusion: { zh: '結論', en: 'Conclusion', icon: Lightbulb, accent: 'text-slate-800 bg-slate-100 border-slate-300', dot: 'bg-slate-700' },
  goals: { zh: '學習目標', en: 'Goals', icon: Target, accent: 'text-sky-700 bg-sky-50 border-sky-200', dot: 'bg-sky-500' },
  intuition: { zh: '直觀概念', en: 'Intuition', icon: Lightbulb, accent: 'text-teal-700 bg-teal-50 border-teal-200', dot: 'bg-teal-500' },
  math: { zh: '數學原理', en: 'Math', icon: BookOpen, accent: 'text-indigo-700 bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  algorithm: { zh: '逐步演算法', en: 'Algorithm', icon: Route, accent: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  interactive: { zh: '互動範例', en: 'Interactive', icon: MousePointerClick, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  verify: { zh: '結果驗證', en: 'Verification', icon: ShieldCheck, accent: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200', dot: 'bg-fuchsia-500' },
  next: { zh: '下一章', en: 'Next', icon: ArrowRightCircle, accent: 'text-slate-800 bg-slate-100 border-slate-300', dot: 'bg-slate-700' },
  what: { zh: '是什麼', en: 'What', icon: BookOpen, accent: 'text-indigo-700 bg-indigo-50 border-indigo-200', dot: 'bg-indigo-500' },
  how: { zh: '怎麼算', en: 'How', icon: Calculator, accent: 'text-amber-700 bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  example: { zh: '範例', en: 'Example', icon: FlaskConical, accent: 'text-emerald-700 bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  connection: { zh: '連結', en: 'Connection', icon: Route, accent: 'text-fuchsia-700 bg-fuchsia-50 border-fuchsia-200', dot: 'bg-fuchsia-500' },
};

export const LESSON1_STAGES: StageKind[] = ['why', 'definition', 'calculation', 'visualization', 'experiment', 'conclusion'];
export const LESSON2_STAGES: StageKind[] = ['goals', 'intuition', 'math', 'algorithm', 'interactive', 'verify', 'next'];
export const ALGEBRA_STAGES: StageKind[] = ['why', 'what', 'how', 'example', 'connection'];
/** Lesson 1 reads situation → design → derivation → picture → experiment → conclusion: same stage kinds, its own names */
const LESSON1_LABELS: Partial<Record<StageKind, { zh: string; en: string }>> = {
  why: { zh: '情境', en: 'Situation' },
  definition: { zh: '設計', en: 'Design' },
  calculation: { zh: '推導', en: 'Derivation' },
  visualization: { zh: '圖解', en: 'Picture' },
  experiment: { zh: '實驗', en: 'Experiment' },
  conclusion: { zh: '結論', en: 'Conclusion' },
};
const isLesson1 = (moduleId: string) => {
  const m = MODULES.find((x) => x.id === moduleId);
  return !!m && !m.lesson && m.group !== 'algebra' && !m.advanced;
};
/** stage name as shown on a given page */
const stageLabel = (kind: StageKind, moduleId: string) => (isLesson1(moduleId) && LESSON1_LABELS[kind]) || STAGES[kind];

const orderOf = (k: StageKind) => (LESSON1_STAGES.includes(k) ? LESSON1_STAGES : LESSON2_STAGES.includes(k) ? LESSON2_STAGES : ALGEBRA_STAGES);

interface StageProps {
  kind: StageKind;
  moduleId: string;
  title: string;
  children: ReactNode;
}

export function Stage({ kind, moduleId, title, children }: StageProps) {
  const s = STAGES[kind];
  const name = stageLabel(kind, moduleId);
  const Icon = s.icon;
  return (
    <section id={`${moduleId}-${kind}`} data-stage={kind} className="scroll-mt-28">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`chip border ${s.accent}`}>
          <Icon className="h-3.5 w-3.5" />
          {orderOf(kind).indexOf(kind) + 1}. {name.zh} <span className="opacity-60">{name.en}</span>
        </span>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

/** Sticky progress bar of the teaching stages; highlights the stage in view. */
export function FlowBar({ moduleId, order = LESSON1_STAGES }: { moduleId: string; order?: StageKind[] }) {
  const STAGE_ORDER = order;
  const [active, setActive] = useState<StageKind>(order[0]);
  const listRef = useRef<HTMLOListElement>(null);
  // keep the highlighted chip visible when the bar is wider than the screen (phones); scrolls only the bar, never the page
  useEffect(() => {
    const ol = listRef.current;
    const a = ol?.querySelector<HTMLElement>('[data-on]');
    if (!ol || !a || ol.scrollWidth <= ol.clientWidth) return;
    const delta = a.getBoundingClientRect().left - ol.getBoundingClientRect().left;
    ol.scrollTo({ left: ol.scrollLeft + delta - (ol.clientWidth - a.offsetWidth) / 2, behavior: 'smooth' });
  }, [active]);
  useEffect(() => {
    // active stage = the last section whose top has scrolled past 40% of the viewport
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let current: StageKind = STAGE_ORDER[0];
      for (const k of STAGE_ORDER) {
        const el = document.getElementById(`${moduleId}-${k}`);
        if (el && el.getBoundingClientRect().top <= line) current = k;
      }
      // at the very bottom of the page, the last stage is active
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = STAGE_ORDER[STAGE_ORDER.length - 1];
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [moduleId]);
  return (
    <nav aria-label="教學流程" className="sticky top-14 z-20 -mx-4 mb-6 border-b border-slate-200 bg-slate-50/90 px-4 py-2 backdrop-blur lg:top-0 sm:-mx-6 sm:px-6">
      <ol ref={listRef} className="flex gap-1 overflow-x-auto text-xs [scrollbar-width:none]">
        {STAGE_ORDER.map((k, i) => {
          const s = STAGES[k];
          const name = stageLabel(k, moduleId);
          const on = k === active;
          return (
            <li key={k} className="flex shrink-0 items-center">
              <a
                href={`#${moduleId}-${k}`}
                data-on={on || undefined}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(`${moduleId}-${k}`)?.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${
                  on ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-200/70'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-white' : s.dot}`} />
                {name.zh}
                <span className={`hidden md:inline ${on ? 'text-slate-300' : 'text-slate-400'}`}>{name.en}</span>
              </a>
              {i < STAGE_ORDER.length - 1 && <ChevronRight className="mx-0.5 h-3 w-3 text-slate-300" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ------------------------------------------------------------------ */

export function ModuleHeader({ moduleId, children }: { moduleId: string; children?: ReactNode }) {
  const m = MODULES[moduleIndex(moduleId)];
  return (
    <header className="mb-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        {m.lesson === 2 ? `第二課 Lesson 2 · ${m.num}` : m.group === 'algebra' ? `代數基礎與循環碼 Algebra · ${m.num}` : m.advanced ? '進階數學 Advanced' : `第一課 Lesson 1 · ${m.num === '0' ? '導論' : `第 ${m.num} 章`}`}
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">{m.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{m.en}</p>
      {children && <div className="prose-lab mt-3">{children}</div>}
    </header>
  );
}

export function PrevNext({ moduleId }: { moduleId: string }) {
  const i = moduleIndex(moduleId);
  const prev = MODULES[i - 1];
  const next = MODULES[i + 1];
  return (
    <div className="mt-12 grid gap-3 border-t border-slate-200 pt-6 sm:grid-cols-2">
      {prev ? (
        <a href={`#/${prev.id}`} className="card group flex items-center gap-3 p-4 hover:border-slate-400">
          <ChevronLeft className="h-5 w-5 text-slate-400 group-hover:-translate-x-0.5" />
          <div>
            <div className="text-xs text-slate-400">上一頁 Previous</div>
            <div className="font-semibold text-slate-800">{prev.title}</div>
          </div>
        </a>
      ) : (
        <span />
      )}
      {next && (
        <a href={`#/${next.id}`} className="card group flex items-center justify-end gap-3 p-4 text-right hover:border-slate-400">
          <div>
            <div className="text-xs text-slate-400">下一頁 Next</div>
            <div className="font-semibold text-slate-800">{next.title}</div>
          </div>
          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:translate-x-0.5" />
        </a>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Panels & callouts                                                   */
/* ------------------------------------------------------------------ */

export function Card({ children, className = '', title, icon, actions }: { children: ReactNode; className?: string; title?: ReactNode; icon?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`card min-w-0 p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && (
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800">
              {icon}
              {title}
            </h3>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Space kept above a pinned LabGrid column, so it clears the sticky stage bar. */
const PIN_TOP = 56;

/**
 * Interactive area + math side panel. Stacks on small screens; side by side from xl.
 * Side by side, the shorter column is pinned while the taller one scrolls past, so a
 * short panel never leaves a hole (only when it fits on screen, or its bottom would hide).
 */
export function LabGrid({ main, aside }: { main: ReactNode; aside: ReactNode }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const [pin, setPin] = useState<'main' | 'aside' | null>(null);

  useEffect(() => {
    const a = mainRef.current;
    const b = asideRef.current;
    if (!a || !b || typeof ResizeObserver === 'undefined') return;
    const wide = window.matchMedia('(min-width: 1280px)');
    const measure = () => {
      const ha = a.offsetHeight;
      const hb = b.offsetHeight;
      const short = Math.min(ha, hb);
      const next = wide.matches && Math.abs(ha - hb) > 48 && short <= window.innerHeight - PIN_TOP - 16 ? (ha < hb ? 'main' : 'aside') : null;
      setPin(next);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(a);
    ro.observe(b);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,400px)] xl:items-start">
      <div ref={mainRef} className={`min-w-0 space-y-4 ${pin === 'main' ? 'xl:sticky' : ''}`} style={pin === 'main' ? { top: PIN_TOP } : undefined}>
        {main}
      </div>
      <aside ref={asideRef} className={`min-w-0 space-y-4 ${pin === 'aside' ? 'xl:sticky' : ''}`} style={pin === 'aside' ? { top: PIN_TOP } : undefined}>
        {aside}
      </aside>
    </div>
  );
}

type CalloutKind = 'info' | 'misconception' | 'key' | 'warning';

const CALLOUT: Record<CalloutKind, { cls: string; icon: typeof Info; label: string }> = {
  info: { cls: 'border-sky-200 bg-sky-50/70 text-sky-900', icon: Info, label: '說明' },
  misconception: { cls: 'border-rose-200 bg-rose-50/70 text-rose-900', icon: AlertTriangle, label: '常見錯誤觀念 Misconception' },
  key: { cls: 'border-emerald-200 bg-emerald-50/70 text-emerald-900', icon: Lightbulb, label: '重點' },
  warning: { cls: 'border-amber-300 bg-amber-50 text-amber-900', icon: ShieldAlert, label: '限制' },
};

export function Callout({ kind = 'info', title, children }: { kind?: CalloutKind; title?: string; children: ReactNode }) {
  const c = CALLOUT[kind];
  const Icon = c.icon;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${c.cls}`}>
      <div className="mb-1 flex items-center gap-1.5 font-semibold">
        <Icon className="h-4 w-4 shrink-0" />
        {title ?? c.label}
      </div>
      <div className="space-y-1.5 [&_p]:leading-relaxed">{children}</div>
    </div>
  );
}

/** One-sentence takeaway of a chapter: what the idea does in a real system (or why engineers need it). */
export function KeyPoint({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-emerald-900">
      <Lightbulb className="mt-1 h-4 w-4 shrink-0" />
      <p className="leading-relaxed">
        <strong className="mr-1.5">重點</strong>
        {children}
      </p>
    </div>
  );
}

/** Several misconception items in one collapsible box. */
export function Misconceptions({ items }: { items: { wrong: ReactNode; right: ReactNode }[] }) {
  return (
    <Callout kind="misconception">
      <ul className="space-y-2.5">
        {items.map((it, i) => (
          <li key={i}>
            <div className="flex gap-1.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
              <span className="line-through decoration-rose-300">{it.wrong}</span>
            </div>
            <div className="mt-0.5 flex gap-1.5 text-slate-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>{it.right}</span>
            </div>
          </li>
        ))}
      </ul>
    </Callout>
  );
}

/** Collapsible definition / proof. */
export function Expandable({ title, children, defaultOpen = false, icon }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; icon?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50" aria-expanded={open}>
        {icon ?? <Sigma className="h-4 w-4 text-indigo-500" />}
        <span className="flex-1">{title}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="space-y-2 border-t border-slate-100 px-4 py-3 text-sm leading-relaxed text-slate-700">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export interface DerivStep {
  title: string;
  body: ReactNode;
}

/**
 * Step-by-step derivation: reveals one step at a time so the page never shows
 * every formula at once.
 */
export function Derivation({ steps, title = '逐步數學推導 Step-by-step derivation', defaultOpen = false, resetKey }: { steps: DerivStep[]; title?: string; defaultOpen?: boolean; resetKey?: string }) {
  const [open, setOpen] = useState(defaultOpen);
  const [shown, setShown] = useState(1);
  useEffect(() => setShown((s) => Math.min(s, steps.length)), [steps.length]);
  useEffect(() => {
    if (resetKey !== undefined) setShown(1);
  }, [resetKey]);
  return (
    <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 bg-indigo-50/60 px-4 py-2.5 text-left text-sm font-semibold text-indigo-900 hover:bg-indigo-50" aria-expanded={open}>
        <ListOrdered className="h-4 w-4" />
        <span className="flex-1">{title}</span>
        <span className="text-xs font-normal text-indigo-500">{open ? `${shown}/${steps.length}` : `${steps.length} 步`}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 py-3">
          <ol className="space-y-3">
            {steps.slice(0, shown).map((s, i) => (
              <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-indigo-600 text-xs font-bold text-white">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-800">{s.title}</div>
                  <div className="mt-1 text-sm leading-relaxed text-slate-700">{s.body}</div>
                </div>
              </motion.li>
            ))}
          </ol>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
            <button className="btn-ghost" disabled={shown <= 1} onClick={() => setShown((s) => s - 1)}>
              <ChevronLeft className="h-4 w-4" /> 上一步
            </button>
            <button className="btn-primary" disabled={shown >= steps.length} onClick={() => setShown((s) => s + 1)}>
              下一步 <ChevronRight className="h-4 w-4" />
            </button>
            <button className="btn-ghost ml-auto" onClick={() => setShown(shown >= steps.length ? 1 : steps.length)}>
              {shown >= steps.length ? '收合' : '全部展開'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ResetButton({ onClick, label = '重設範例' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" className="btn-ghost" onClick={onClick}>
      <RotateCcw className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Decoder status badges                                               */
/* ------------------------------------------------------------------ */

export type DecodeStatus = 'ok' | 'corrected' | 'detected' | 'wrong';

const STATUS: Record<DecodeStatus, { cls: string; icon: typeof CheckCircle2; zh: string; en: string }> = {
  ok: { cls: 'bg-emerald-600 text-white', icon: CheckCircle2, zh: '正常', en: 'No error' },
  corrected: { cls: 'bg-sky-600 text-white', icon: Wrench, zh: '已修正', en: 'Corrected' },
  detected: { cls: 'bg-orange-500 text-white', icon: ShieldAlert, zh: '已偵測但無法修正', en: 'Detected, uncorrectable' },
  wrong: { cls: 'bg-rose-600 text-white', icon: XCircle, zh: '解碼錯誤', en: 'Decoding failure' },
};

export function StatusBadge({ status, large = false, zh, en }: { status: DecodeStatus; large?: boolean; zh?: string; en?: string }) {
  const s = STATUS[status];
  const Icon = s.icon;
  const enLabel = en ?? s.en;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-lg font-semibold shadow-sm ${s.cls} ${large ? 'px-3 py-1.5 text-sm' : 'px-2 py-0.5 text-xs'}`}>
      <Icon className={large ? 'h-4 w-4' : 'h-3.5 w-3.5'} />
      {zh ?? s.zh}
      {enLabel && <span className="font-normal opacity-80">{enLabel}</span>}
    </span>
  );
}

export function Stat({ label, value, sub, tone = 'slate' }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'slate' | 'emerald' | 'rose' | 'indigo' | 'amber' }) {
  const tones = {
    slate: 'text-slate-900',
    emerald: 'text-emerald-700',
    rose: 'text-rose-700',
    indigo: 'text-indigo-700',
    amber: 'text-amber-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-0.5 font-mono text-xl font-bold ${tones[tone]}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5" role="tablist" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1 text-sm font-medium transition-colors ${value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
