import type { Bit } from '../core';
import type { ReactNode } from 'react';

interface MatrixViewProps {
  matrix: readonly (readonly Bit[])[];
  name?: ReactNode;
  rowLabels?: ReactNode[];
  colLabels?: ReactNode[];
  highlightRows?: number[];
  highlightCols?: number[];
  dimRows?: number[];
  /** extra classes per cell (overrides highlight colouring) */
  cellClass?: (i: number, j: number, v: Bit) => string | undefined;
  onCellClick?: (i: number, j: number) => void;
  size?: 'sm' | 'md';
  colHighlightClass?: string;
  rowHighlightClass?: string;
}

/** Bracketed matrix rendered as a CSS grid so rows / columns can be highlighted. */
export function MatrixView({
  matrix,
  name,
  rowLabels,
  colLabels,
  highlightRows = [],
  highlightCols = [],
  dimRows = [],
  cellClass,
  onCellClick,
  size = 'md',
  colHighlightClass = 'bg-fuchsia-100 text-fuchsia-800',
  rowHighlightClass = 'bg-amber-100 text-amber-900',
}: MatrixViewProps) {
  const m = matrix.length;
  const n = matrix[0]?.length ?? 0;
  const cs = size === 'sm' ? 24 : 30;
  const rl = rowLabels ? 1 : 0;
  const cl = colLabels ? 1 : 0;
  const template = `${rowLabels ? '30px ' : ''}7px repeat(${n}, ${cs}px) 7px`;
  const rowsTemplate = `${colLabels ? '18px ' : ''}repeat(${m}, ${cs}px)`;
  return (
    <div className="inline-flex max-w-full items-center gap-2 overflow-x-auto pb-1">
      {name && <div className="shrink-0 font-serif text-lg italic text-slate-700">{name}</div>}
      <div className="grid shrink-0" style={{ gridTemplateColumns: template, gridTemplateRows: rowsTemplate }}>
        {colLabels?.map((l, j) => (
          <div
            key={`c${j}`}
            style={{ gridColumn: rl + 2 + j, gridRow: 1 }}
            className={`grid place-items-center text-[10px] font-semibold leading-none ${highlightCols.includes(j) ? 'text-fuchsia-700' : 'text-slate-400'}`}
          >
            {l}
          </div>
        ))}
        {rowLabels?.map((l, i) => (
          <div
            key={`r${i}`}
            style={{ gridColumn: 1, gridRow: cl + 1 + i }}
            className={`grid place-items-center text-[10px] font-semibold ${highlightRows.includes(i) ? 'text-amber-700' : 'text-slate-400'}`}
          >
            {l}
          </div>
        ))}
        <span style={{ gridColumn: rl + 1, gridRow: `${cl + 1} / span ${m}` }} className="rounded-l-sm border-y-2 border-l-2 border-slate-500" />
        <span style={{ gridColumn: rl + 2 + n, gridRow: `${cl + 1} / span ${m}` }} className="rounded-r-sm border-y-2 border-r-2 border-slate-500" />
        {matrix.map((row, i) =>
          row.map((v, j) => {
            const hr = highlightRows.includes(i);
            const hc = highlightCols.includes(j);
            const extra = cellClass?.(i, j, v);
            return (
              <button
                type="button"
                key={`${i}-${j}`}
                disabled={!onCellClick}
                onClick={onCellClick ? () => onCellClick(i, j) : undefined}
                style={{ gridColumn: rl + 2 + j, gridRow: cl + 1 + i }}
                className={`m-px grid place-items-center rounded font-mono font-semibold transition-colors ${size === 'sm' ? 'text-xs' : 'text-sm'} ${
                  extra ?? (hc ? colHighlightClass : hr ? rowHighlightClass : v ? 'text-slate-900' : 'text-slate-300')
                } ${dimRows.includes(i) ? 'opacity-30' : ''} ${onCellClick ? 'cursor-pointer hover:ring-2 hover:ring-indigo-300' : 'cursor-default'}`}
              >
                {v}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}

/** Vertical column vector (for syndromes etc.). */
export function ColumnVector({ bits, cellClass = '', label, size = 'md' }: { bits: readonly Bit[]; cellClass?: string; label?: ReactNode; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-6 w-6 text-xs' : 'h-[30px] w-[30px] text-sm';
  return (
    <div className="inline-flex items-center gap-2">
      {label && <span className="font-serif italic text-slate-700">{label}</span>}
      <div className="flex items-stretch">
        <span className="w-[7px] rounded-l-sm border-y-2 border-l-2 border-slate-500" />
        <div className="flex flex-col">
          {bits.map((b, i) => (
            <div key={i} className={`m-px grid place-items-center rounded font-mono font-bold ${h} ${cellClass}`}>
              {b}
            </div>
          ))}
        </div>
        <span className="w-[7px] rounded-r-sm border-y-2 border-r-2 border-slate-500" />
      </div>
    </div>
  );
}
