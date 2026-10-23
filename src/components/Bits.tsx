import { motion } from 'framer-motion';
import { Zap, Check, X } from 'lucide-react';
import type { Bit, BitRole, PositionInfo } from '../core';

export type BitState = 'normal' | 'error' | 'corrected' | 'wrongfix' | 'highlight' | 'dim' | 'diff' | 'muted';

const ROLE_STYLE: Record<BitRole | 'plain', string> = {
  data: 'bg-data-50 border-data-300 text-data-700',
  parity: 'bg-parity-50 border-parity-300 text-parity-700',
  overall: 'bg-overall-50 border-overall-300 text-overall-700',
  plain: 'bg-white border-slate-300 text-slate-800',
};

const ROLE_LABEL: Record<BitRole | 'plain', string> = {
  data: 'text-data-600',
  parity: 'text-parity-600',
  overall: 'text-overall-600',
  plain: 'text-slate-400',
};

const SIZE = {
  sm: 'h-8 w-8 text-base rounded-md',
  md: 'h-8 w-8 text-base rounded-md sm:h-11 sm:w-11 sm:text-xl sm:rounded-lg',
  lg: 'h-14 w-14 text-2xl rounded-xl',
};

interface BitCellProps {
  /** null renders as "?" (not yet computed) */
  value: Bit | null;
  role?: BitRole | 'plain';
  label?: string;
  sublabel?: string;
  state?: BitState;
  size?: keyof typeof SIZE;
  onClick?: () => void;
  title?: string;
}

export function BitCell({ value, role = 'plain', label, sublabel, state = 'normal', size = 'md', onClick, title }: BitCellProps) {
  const stateCls =
    state === 'error'
      ? '!bg-rose-50 !border-rose-500 !text-rose-700 ring-2 ring-rose-400/60'
      : state === 'corrected'
        ? '!bg-emerald-50 !border-emerald-500 !text-emerald-700 ring-2 ring-emerald-400/60'
        : state === 'wrongfix'
          ? '!bg-orange-50 !border-orange-500 !text-orange-700 ring-2 ring-orange-400/60'
        : state === 'highlight'
          ? 'ring-2 ring-slate-900/70 ring-offset-1'
          : state === 'diff'
            ? '!bg-fuchsia-50 !border-fuchsia-500 !text-fuchsia-700 ring-2 ring-fuchsia-400/50'
            : state === 'dim'
              ? 'opacity-30'
              : state === 'muted'
                ? '!bg-slate-50 !border-slate-200 !text-slate-400'
                : '';
  const interactive = !!onClick;
  return (
    <div className="flex flex-col items-center gap-1">
      {label !== undefined && <span className={`text-[11px] font-semibold leading-none ${ROLE_LABEL[role]}`}>{label}</span>}
      <motion.button
        type="button"
        disabled={!interactive}
        onClick={onClick}
        title={title}
        aria-label={`${label ?? 'bit'} = ${value ?? '?'}${interactive ? '，點擊翻轉' : ''}`}
        whileTap={interactive ? { scale: 0.88 } : undefined}
        className={`relative grid place-items-center border-2 font-mono font-bold transition-colors ${SIZE[size]} ${ROLE_STYLE[role]} ${stateCls} ${
          interactive ? 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md' : 'cursor-default'
        }`}
      >
        <motion.span key={String(value)} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.18 }}>
          {value ?? '?'}
        </motion.span>
        {state === 'error' && <Zap className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-rose-500 p-0.5 text-white" />}
        {state === 'corrected' && <Check className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-emerald-500 p-0.5 text-white" />}
        {state === 'wrongfix' && <X className="absolute -right-1.5 -top-1.5 h-4 w-4 rounded-full bg-orange-500 p-0.5 text-white" />}
      </motion.button>
      {sublabel !== undefined && <span className="text-[10px] leading-none text-slate-400">{sublabel}</span>}
    </div>
  );
}

interface BitRowProps {
  bits: readonly Bit[];
  layout?: PositionInfo[];
  states?: (BitState | undefined)[];
  size?: keyof typeof SIZE;
  onToggle?: (i: number) => void;
  showPositions?: boolean;
  plain?: boolean;
  /** insert a visual gap before this index (e.g. before P0) */
  gapBefore?: number;
}

export function BitRow({ bits, layout, states, size = 'md', onToggle, showPositions = true, plain = false, gapBefore }: BitRowProps) {
  return (
    <div className="flex flex-wrap items-end gap-1 sm:gap-2">
      {bits.map((b, i) => (
        <div key={i} className={gapBefore === i ? 'ml-2 border-l-2 border-dashed border-slate-300 pl-3 sm:ml-3' : ''}>
          <BitCell
            value={b}
            role={plain || !layout ? 'plain' : layout[i].role}
            label={layout ? layout[i].label : undefined}
            sublabel={showPositions ? (layout ? `#${layout[i].position}` : `${i + 1}`) : undefined}
            state={states?.[i] ?? 'normal'}
            size={size}
            onClick={onToggle ? () => onToggle(i) : undefined}
          />
        </div>
      ))}
    </div>
  );
}

/** The four information-bit switches D1..D4 (same names as in the codeword layout). */
export function MessageInput({ message, onToggle, size = 'lg' }: { message: readonly Bit[]; onToggle: (i: number) => void; size?: keyof typeof SIZE }) {
  return (
    <div className="flex items-end gap-2">
      {message.map((b, i) => (
        <BitCell key={i} value={b} role="data" label={`D${i + 1}`} size={size} onClick={() => onToggle(i)} />
      ))}
    </div>
  );
}

export function RoleLegend({ overall = false, errors = false }: { overall?: boolean; errors?: boolean }) {
  const items: [string, string][] = [
    ['bg-data-50 border-data-300', '資料位元（Data bit）'],
    ['bg-parity-50 border-parity-300', '同位位元（Parity bit）'],
  ];
  if (overall) items.push(['bg-overall-50 border-overall-300', '整體同位位元（Overall parity）']);
  if (errors) {
    items.push(['bg-rose-50 border-rose-500', '被翻轉的位元（Flipped）']);
    items.push(['bg-emerald-50 border-emerald-500', '解碼器修正（Corrected）']);
  }
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500">
      {items.map(([cls, text]) => (
        <span key={text} className="inline-flex items-center gap-1.5">
          <span className={`inline-block h-3.5 w-3.5 rounded border-2 ${cls}`} />
          {text}
        </span>
      ))}
    </div>
  );
}

/** Compact monospace bit string with optional per-index colouring. */
export function BitString({ bits, highlight, className = '' }: { bits: readonly Bit[]; highlight?: (i: number) => string | undefined; className?: string }) {
  return (
    <span className={`font-mono tracking-[0.15em] ${className}`}>
      {bits.map((b, i) => (
        <span key={i} className={highlight?.(i)}>
          {b}
        </span>
      ))}
    </span>
  );
}
