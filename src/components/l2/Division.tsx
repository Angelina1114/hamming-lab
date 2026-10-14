import { Fragment, useMemo, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { type Bit, G_MSB, longDivision, msbToTex } from '../../core';
import { M, Tex } from '../Tex';
import { StepControls, useStepper, type Stepper } from './Stepper';
import { BitsPoly } from './Common';

export const divisionTotalFrames = (dividendLen: number, divisorLen = 4) => dividendLen - (divisorLen - 1) + 2;

interface Props {
  dividend: Bit[];
  divisor?: Bit[];
  stepper?: Stepper;
  large?: boolean;
  onToggle?: (i: number) => void;
}

/** Hand-style GF(2) long division; every row comes from longDivision(). */
export function LongDivisionView({ dividend, divisor = G_MSB, stepper, large = false, onToggle }: Props) {
  const res = useMemo(() => longDivision(dividend, divisor), [dividend, divisor]);
  const n = dividend.length;
  const d = divisor.length - 1;
  const total = res.steps.length + 2;
  const own = useStepper(total, { interval: 1300 });
  const s = stepper ?? own;
  const frame = Math.min(s.step, total - 1);
  const shown = Math.min(frame, res.steps.length); // steps applied
  const final = frame === total - 1;
  const cur = frame >= 1 && frame <= res.steps.length ? res.steps[frame - 1] : null;
  const cell = large ? 'h-10 w-10 text-xl' : 'h-8 w-8 text-base';
  const labelW = large ? 'w-28' : 'w-24';

  const row = (bits: (Bit | null)[], cls: (i: number) => string, label: ReactNode, key: string) => (
    <motion.div key={key} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center">
      <div className={`${labelW} shrink-0 pr-2 text-right text-xs text-slate-500`}>{label}</div>
      {bits.map((b, i) => (
        <div key={i} className={`grid place-items-center font-mono font-bold ${cell} ${cls(i)}`}>
          {b === null ? '' : b}
        </div>
      ))}
    </motion.div>
  );

  const quotientRow: (Bit | null)[] = Array.from({ length: n }, (_, i) => {
    const k = i - d; // quotient bit for step k sits above column k + d
    return k >= 0 && k < shown ? res.quotient[k] : null;
  });

  return (
    <div className="space-y-4">
      {!stepper && <StepControls s={s} label={final ? '完成：得到餘數' : cur ? `第 ${frame} 步 · ${cur.kind === 'xor' ? '對齊並 XOR' : '最高位為 0，除數右移'}` : '對齊被除數與除數'} />}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <BitsPoly bits={dividend} name="\text{被除數}" />
        <BitsPoly bits={divisor} name="g(x)" />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3">
        <div className="w-max space-y-0.5">
          {row(quotientRow, (i) => (quotientRow[i] === null ? '' : 'text-indigo-700'), '商 q', 'q')}
          <div className="flex">
            <div className={`${labelW}`} />
            <div className="border-t-2 border-slate-400" style={{ width: `${n * (large ? 2.5 : 2)}rem` }} />
          </div>
          {row(
            dividend,
            () => (frame === 0 ? 'text-slate-900' : 'text-slate-400'),
            '被除數',
            'dividend',
          )}
          {res.steps.slice(0, shown).map((st, k) => {
            const isLast = k === shown - 1;
            const aligned: (Bit | null)[] = Array.from({ length: n }, (_, i) => (i >= st.col && i <= st.col + d ? (st.kind === 'xor' ? divisor[i - st.col] : 0) : null));
            return (
              <Fragment key={k}>
                {row(
                  aligned,
                  () => (st.kind === 'xor' ? 'text-fuchsia-700' : 'text-slate-300'),
                  <span>⊕ {st.kind === 'xor' ? <>x<sup>{st.quotientExp}</sup>·g</> : '0'}</span>,
                  `a${k}`,
                )}
                {row(
                  st.after,
                  (i) => {
                    if (i <= st.col) return 'text-slate-300 border-t border-slate-400';
                    if (i <= st.col + d) return `border-t border-slate-400 ${isLast && !final ? 'bg-amber-100 text-amber-900 rounded' : 'text-slate-800'}`;
                    return 'text-slate-400 border-t border-slate-400';
                  },
                  <span className="text-slate-400">=</span>,
                  `r${k}`,
                )}
              </Fragment>
            );
          })}
          {final &&
            row(
              Array.from({ length: n }, (_, i) => (i >= n - d ? res.remainder[i - (n - d)] : null)),
              () => 'bg-emerald-100 text-emerald-800 rounded',
              <strong className="text-emerald-700">餘數</strong>,
              'rem',
            )}
        </div>
      </div>
      {onToggle && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          修改被除數：
          {dividend.map((b, i) => (
            <button key={i} className="grid h-7 w-7 place-items-center rounded border border-slate-300 font-mono font-bold text-slate-700 hover:border-slate-600" onClick={() => onToggle(i)}>
              {b}
            </button>
          ))}
        </div>
      )}

      <div className={`rounded-xl bg-slate-50 p-3 text-slate-700 ${large ? 'text-lg' : 'text-sm'}`}>
        {frame === 0 && (
          <span>
            把除數 <span className="mono">{divisor.join('')}</span> 對齊被除數最左邊。每一步只看「目前最高位」：是 1 就 XOR，是 0 就把除數右移一格。
          </span>
        )}
        {cur && cur.kind === 'xor' && (
          <span>
            最高位（第 {cur.col + 1} 欄，<M>{`x^{${n - 1 - cur.col}}`}</M>）是 1：商加上 <M>{`x^{${cur.quotientExp}}`}</M>，減去（= 加上）<M>{`x^{${cur.quotientExp}}g(x)`}</M>。
            <br />
            <Tex>{`${msbToTex(cur.before)} \\;\\oplus\\; ${msbToTex(cur.before.map((b, i) => (b ^ cur.after[i]) as Bit))} = ${msbToTex(cur.after)}`}</Tex>
          </span>
        )}
        {cur && cur.kind === 'skip' && (
          <span>
            第 {cur.col + 1} 欄（<M>{`x^{${n - 1 - cur.col}}`}</M>）已經是 0：商的 <M>{`x^{${cur.quotientExp}}`}</M> 係數為 0，除數右移一格，不做 XOR。
          </span>
        )}
        {final && (
          <span>
            最高位都消去後，剩下最後 {d} 位就是餘數：<strong className="mono">{res.remainder.join('')}</strong> <M>{`= ${msbToTex(res.remainder)}`}</M>，商 <span className="mono">{res.quotient.join('')}</span> <M>{`= ${msbToTex(res.quotient)}`}</M>。
          </span>
        )}
      </div>
    </div>
  );
}
