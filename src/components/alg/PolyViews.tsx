import type { ReactNode } from 'react';
import { type Bit, type PolyMulTrace, expLabel, msbToTex } from '../../core';
import { M, Tex } from '../Tex';

/** 7 (or n) clickable bits with exponent labels, plus the live polynomial. */
export function BitPolyEditor({ bits, onToggle, highlight }: { bits: readonly Bit[]; onToggle?: (i: number) => void; highlight?: (i: number) => string | undefined }) {
  const n = bits.length;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {bits.map((b, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5">
            <span className="text-[11px] font-semibold text-slate-500">{expLabel(n - 1 - i)}</span>
            <button
              type="button"
              disabled={!onToggle}
              onClick={() => onToggle?.(i)}
              className={`grid h-10 w-10 place-items-center rounded-lg border-2 font-mono text-lg font-bold transition-colors ${b ? 'border-overall-400 bg-overall-50 text-overall-800' : 'border-slate-300 bg-white text-slate-400'} ${highlight?.(i) ?? ''} ${onToggle ? 'hover:-translate-y-0.5 hover:shadow' : ''}`}
            >
              {b}
            </button>
            <span className="text-[10px] text-slate-400">#{i + 1}</span>
          </div>
        ))}
      </div>
      <div className="text-lg">
        <M>{`${bits.join('')} \\;\\longleftrightarrow\\; ${msbToTex(bits)}`}</M>
      </div>
    </div>
  );
}

/** Partial products of a(x)·b(x), column counts, and the result mod 2 — revealed progressively. */
export function PolyMulTable({ t, revealed = Infinity, aName = 'a(x)', bName = 'b(x)', large = false }: { t: PolyMulTrace; revealed?: number; aName?: string; bName?: string; large?: boolean }) {
  const n = t.result.length;
  const shown = t.partials.slice(0, revealed);
  const done = revealed >= t.partials.length + 2;
  const countsShown = revealed >= t.partials.length + 1;
  const cell = large ? 'h-10 w-10 text-lg' : 'h-8 w-8 text-sm';
  const Row = ({ label, vals, cls }: { label: ReactNode; vals: (number | string | null)[]; cls?: (i: number) => string }) => (
    <div className="flex items-center">
      <div className="w-32 shrink-0 pr-2 text-right text-xs text-slate-500">{label}</div>
      {vals.map((v, i) => (
        <div key={i} className={`grid place-items-center font-mono font-bold ${cell} ${cls?.(i) ?? ''}`}>
          {v === null ? '' : v}
        </div>
      ))}
    </div>
  );
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
      <div className="w-max space-y-0.5">
        <Row label="次方" vals={Array.from({ length: n }, (_, i) => expLabel(n - 1 - i))} cls={() => '!text-[10px] !font-semibold text-slate-400'} />
        {shown.map((p, k) => (
          <Row
            key={k}
            label={
              <span>
                {aName}·{p.shift === 0 ? '1' : expLabel(p.shift)}
              </span>
            }
            vals={p.bits.map((b) => (b ? 1 : '·'))}
            cls={(i) => (p.bits[i] ? 'text-indigo-700' : 'text-slate-200')}
          />
        ))}
        {countsShown && (
          <Row label="同類項個數" vals={t.counts} cls={(i) => `border-t-2 border-slate-300 ${t.counts[i] >= 2 ? 'text-amber-600' : 'text-slate-700'}`} />
        )}
        {done && <Row label={<strong className="text-emerald-700">mod 2</strong>} vals={t.result} cls={() => 'rounded bg-emerald-50 text-emerald-800'} />}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {bName} 中每一個 1 產生一列「{aName} 乘上那一項」；同一欄的 1 是同類項，個數取 mod 2（橘色 = 2 個以上，會互相抵銷）。
      </div>
    </div>
  );
}

/** The expansion in symbols: distribute, combine with integer coefficients, then mod 2 */
export function PolyMulTex({ t, stage }: { t: PolyMulTrace; stage: number }) {
  const n = t.result.length;
  const terms = t.partials.flatMap((p) => p.bits.flatMap((b, i) => (b ? [n - 1 - i] : [])));
  const mono = (e: number) => (e === 0 ? '1' : e === 1 ? 'x' : `x^{${e}}`);
  const combined = t.counts
    .map((c, i) => ({ c, e: n - 1 - i }))
    .filter((x) => x.c > 0)
    .map((x) => (x.c === 1 ? mono(x.e) : `${x.c}${x.e === 0 ? '' : mono(x.e)}`))
    .join(' + ');
  return (
    <div className="space-y-1">
      <Tex block>{`(${msbToTex(t.a)})(${msbToTex(t.b)})`}</Tex>
      {stage >= 1 && <Tex block>{`= ${terms.map(mono).join(' + ') || '0'}`}</Tex>}
      {stage >= 2 && <Tex block>{`= ${combined || '0'}`}</Tex>}
      {stage >= 3 && <Tex block>{`\\equiv ${msbToTex(t.result)} \\pmod 2`}</Tex>}
    </div>
  );
}
