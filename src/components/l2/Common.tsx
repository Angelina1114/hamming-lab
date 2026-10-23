import { Fragment, type ReactNode } from 'react';
import { ArrowLeftRight, CheckCircle2, XCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { type Bit, expLabel } from '../../core';
import { BitCell, type BitState } from '../Bits';
import { M, Tex } from '../Tex';
import { Card, FlowBar, LESSON2_STAGES, ModuleHeader, PrevNext, Stage } from '../Lesson';
import { MODULES, moduleIndex } from '../../lib/modules';
import { RelatedLinks, type UnitLink } from '../alg/Links';

/* ------------------------------------------------------------------ */
/* Bit-order convention                                                */
/* ------------------------------------------------------------------ */

export function ConventionBanner({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`flex items-start gap-2 rounded-xl border-2 border-indigo-200 bg-indigo-50/70 text-indigo-900 ${compact ? 'px-3 py-1.5 text-xs' : 'mb-5 px-4 py-2.5 text-sm'}`}>
      <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0" />
      <span className="min-w-0">
        <strong>位元順序（代數章與第二課相同）：</strong>最左邊 = 最高次項。7 位元字串中，從左數第 <M>p</M> 個 bit（位置 <M>p</M>）是 <M>{'x^{7-p}'}</M> 的係數。例：<span className="mono">1001110</span> <M>{'= x^6+x^3+x^2+x'}</M>，「位置 2」= <M>{'x^5'}</M>。
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bit strip with exponent / position labels and text-based roles       */
/* ------------------------------------------------------------------ */

export type L2Role = 'info' | 'parity' | 'overall' | 'plain';

const ROLE_MAP: Record<L2Role, 'data' | 'parity' | 'overall' | 'plain'> = { info: 'data', parity: 'parity', overall: 'overall', plain: 'plain' };

/** default roles: first 4 = information, next 3 = parity, 8th = overall parity */
export const defaultRoles = (n: number): L2Role[] => Array.from({ length: n }, (_, i) => (i < 4 ? 'info' : i < 7 ? 'parity' : 'overall'));

interface BitStripProps {
  bits: readonly (Bit | null)[];
  roles?: L2Role[] | 'plain';
  states?: (BitState | undefined)[];
  onToggle?: (i: number) => void;
  showExp?: boolean;
  showPos?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** draw "u / p / P" group brackets under the strip */
  groups?: boolean;
  /** exponent of the leftmost bit (defaults to 6 for the 7-bit part) */
  topExp?: number;
}

export function BitStrip({ bits, roles, states, onToggle, showExp = true, showPos = true, size = 'md', groups, topExp }: BitStripProps) {
  const n = bits.length;
  const R: L2Role[] = roles === 'plain' ? Array(n).fill('plain') : roles ?? defaultRoles(n);
  const hi = topExp ?? Math.min(n, 7) - 1;
  const w = size === 'sm' ? 32 : size === 'lg' ? 56 : 44; // BitCell widths
  const showGroups = groups ?? roles !== 'plain';
  return (
    <div className="inline-block max-w-full overflow-x-auto pb-1">
      <div className="flex items-end gap-1.5">
        {bits.map((b, i) => {
          const isOverall = i >= 7;
          const e = hi - i;
          return (
            <div key={i} className={isOverall ? 'ml-1.5 border-l-2 border-dashed border-slate-300 pl-2.5' : ''} style={{ minWidth: w }}>
              <BitCell
                value={b}
                role={ROLE_MAP[R[i]]}
                label={showExp ? (isOverall ? 'P' : expLabel(e)) : undefined}
                sublabel={showPos ? `#${i + 1}` : undefined}
                state={states?.[i] ?? 'normal'}
                size={size}
                onClick={onToggle ? () => onToggle(i) : undefined}
                title={isOverall ? 'Overall parity bit' : `位置 ${i + 1}，${expLabel(e)} 的係數`}
              />
            </div>
          );
        })}
      </div>
      {showGroups && (
        <div className="mt-1 flex gap-1.5 text-[10px] font-semibold">
          {groupSpans(R).map((g, k) => (
            <div key={k} className={`border-t-2 pt-0.5 text-center ${g.role === 'info' ? 'border-data-300 text-data-600' : g.role === 'parity' ? 'border-parity-300 text-parity-600' : g.role === 'overall' ? 'ml-1.5 border-overall-300 pl-2.5 text-overall-600' : 'border-slate-200 text-slate-400'}`} style={{ width: g.len * w + (g.len - 1) * 6 }}>
              {g.role === 'info' ? 'Data bits u' : g.role === 'parity' ? 'Parity bits p' : g.role === 'overall' ? 'Overall parity' : ''}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function groupSpans(roles: L2Role[]) {
  const out: { role: L2Role; len: number }[] = [];
  roles.forEach((r) => {
    const last = out[out.length - 1];
    if (last && last.role === r) last.len++;
    else out.push({ role: r, len: 1 });
  });
  return out;
}

/** Legend: every colour also has a symbol/text. */
export function L2Legend({ overall = false, errors = true }: { overall?: boolean; errors?: boolean }) {
  const items: [string, ReactNode, string][] = [
    ['bg-data-50 border-data-300', 'Data bit', '下方標「Data bits u」'],
    ['bg-parity-50 border-parity-300', 'Parity bit', '下方標「Parity bits p」'],
  ];
  if (overall) items.push(['bg-overall-50 border-overall-300', 'Overall parity bit', '上方標「P」']);
  if (errors) {
    items.push(['bg-rose-50 border-rose-500', <>錯誤位元（Error bit）</>, '⚡ 符號']);
    items.push(['bg-emerald-50 border-emerald-500', <>已更正（Corrected bit）</>, '✓ 符號']);
    items.push(['bg-orange-50 border-orange-500', <>錯誤翻轉（Wrong flip）</>, '✗ 符號']);
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
      {items.map(([cls, text, sym], k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3.5 w-3.5 rounded border-2 ${cls}`} />
          <span>
            {text}
            <span className="text-slate-400">：{sym}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

/** compact monospace bit string with optional per-index classes */
export function Mono({ bits, cls, className = '' }: { bits: readonly (Bit | null)[]; cls?: (i: number) => string | undefined; className?: string }) {
  return (
    <span className={`font-mono tracking-[0.12em] ${className}`}>
      {bits.map((b, i) => (
        <span key={i} className={cls?.(i)}>
          {b ?? '·'}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Automatic verification list                                         */
/* ------------------------------------------------------------------ */

export function Checks({ items, title = '自動驗證（由程式即時計算）' }: { items: { label: ReactNode; pass: boolean; detail?: ReactNode }[]; title?: string }) {
  const all = items.every((i) => i.pass);
  return (
    <div className={`rounded-xl border p-3 ${all ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/60'}`}>
      <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
        <ShieldCheck className="h-4 w-4" />
        {title}
      </div>
      <ul className="space-y-1.5 text-sm">
        {items.map((it, k) => (
          <li key={k} className="flex gap-2">
            {it.pass ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />}
            <span className="sr-only">{it.pass ? '通過' : '不成立'}</span>
            <span>
              {it.label}
              {it.detail && <span className="ml-1 text-slate-500">{it.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* $…$ rich text (quiz, presentation captions)                         */
/* ------------------------------------------------------------------ */

export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const parts = text.split(/(\$[^$]+\$)/g);
  return (
    <span className={className}>
      {parts.map((p, k) => (p.startsWith('$') && p.endsWith('$') && p.length > 1 ? <Tex key={k}>{p.slice(1, -1)}</Tex> : <Fragment key={k}>{p}</Fragment>))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter template: Goals → Intuition → Math → Algorithm → Interactive → Verify → Next */
/* ------------------------------------------------------------------ */

interface ChapterProps {
  id: string;
  lead?: ReactNode;
  goals: ReactNode[];
  intuition: { title: string; body: ReactNode };
  math: { title: string; body: ReactNode };
  algorithm: { title: string; body: ReactNode };
  interactive: { title: string; body: ReactNode };
  verify: { title: string; body: ReactNode };
  next: ReactNode;
  /** links to related units (e.g. the algebra chapter) shown in the last section */
  related?: UnitLink[];
}

export function Chapter({ id, lead, goals, intuition, math, algorithm, interactive, verify, next, related }: ChapterProps) {
  const i = moduleIndex(id);
  const nextMod = MODULES[i + 1];
  return (
    <div>
      <ModuleHeader moduleId={id}>{lead}</ModuleHeader>
      <ConventionBanner />
      <FlowBar moduleId={id} order={LESSON2_STAGES} />
      <div className="space-y-12">
        <Stage kind="goals" moduleId={id} title="這一章你會學到">
          <Card>
            <ol className="grid gap-2 sm:grid-cols-2">
              {goals.map((g, k) => (
                <li key={k} className="flex gap-2 text-sm text-slate-700">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sky-600 text-[11px] font-bold text-white">{k + 1}</span>
                  <span>{g}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Stage>
        <Stage kind="intuition" moduleId={id} title={intuition.title}>
          {intuition.body}
        </Stage>
        <Stage kind="math" moduleId={id} title={math.title}>
          {math.body}
        </Stage>
        <Stage kind="algorithm" moduleId={id} title={algorithm.title}>
          {algorithm.body}
        </Stage>
        <Stage kind="interactive" moduleId={id} title={interactive.title}>
          {interactive.body}
        </Stage>
        <Stage kind="verify" moduleId={id} title={verify.title}>
          {verify.body}
        </Stage>
        <Stage kind="next" moduleId={id} title={nextMod ? `銜接：${nextMod.num} ${nextMod.title}` : '課程結束'}>
          <Card>
            <div className="text-sm leading-relaxed text-slate-700">{next}</div>
            {related && related.length > 0 && (
              <div className="mt-4">
                <RelatedLinks links={related} title="代數背景與相關單元" />
              </div>
            )}
            {nextMod && (
              <a href={`#/${nextMod.id}`} className="btn-primary mt-3">
                前往 {nextMod.num} <ArrowRight className="h-4 w-4" />
              </a>
            )}
          </Card>
        </Stage>
      </div>
      <PrevNext moduleId={id} />
    </div>
  );
}

/** Ordered algorithm description */
export function AlgoSteps({ steps }: { steps: ReactNode[] }) {
  return (
    <Card>
      <ol className="space-y-2">
        {steps.map((s, k) => (
          <li key={k} className="flex gap-3 text-sm text-slate-700">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-amber-500 text-xs font-bold text-white">{k + 1}</span>
            <div className="min-w-0 flex-1 pt-0.5">{s}</div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** a bit string followed by its polynomial */
export function BitsPoly({ bits, name }: { bits: readonly Bit[]; name?: string }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2">
      {name && <M>{name}</M>}
      <span className="mono font-semibold">{bits.join('')}</span>
      <span className="text-slate-400">↔</span>
      <M>{polyTexMsb(bits)}</M>
    </span>
  );
}

const polyTexMsb = (bits: readonly Bit[]) => {
  const n = bits.length;
  const t: string[] = [];
  bits.forEach((b, k) => {
    if (!b) return;
    const e = n - 1 - k;
    t.push(e === 0 ? '1' : e === 1 ? 'x' : `x^{${e}}`);
  });
  return t.length ? t.join(' + ') : '0';
};
