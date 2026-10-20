import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  type Bit,
  type L2Outcome,
  type L2Method,
  LOG,
  bitsToField,
  errorVector,
  polyModMsb,
  syndromeTable,
  G_MSB,
  vecAdd,
} from '../../core';
import { M } from '../Tex';
import { StatusBadge, type DecodeStatus } from '../Lesson';
import type { BitState } from '../Bits';
import { BitStrip } from './Common';
import { StepControls, useStepper, type Stepper } from './Stepper';
import { usePresenting } from '../../lib/presenting';

const aTex = (a: number) => (a === 0 ? '0' : LOG[a] === 0 ? '1' : LOG[a] === 1 ? '\\alpha' : `\\alpha^{${LOG[a]}}`);

/* ------------------------------------------------------------------ */
/* Syndrome lookup table                                               */
/* ------------------------------------------------------------------ */

export function lookupRows(convention: 'msb' | 'lsb') {
  if (convention === 'msb') return syndromeTable().map((r) => ({ position: r.position, exponent: r.exponent, syndrome: r.syndrome }));
  // alternative convention: leftmost bit = coefficient of x⁰, so position p ↔ x^{p−1}
  return Array.from({ length: 7 }, (_, k) => {
    const position = k + 1;
    const exponent = position - 1;
    const syndrome = polyModMsb(errorVector([7 - exponent]), G_MSB);
    return { position, exponent, syndrome };
  });
}

export function LookupTable({ highlightPos, convention = 'msb', large = false }: { highlightPos?: number; convention?: 'msb' | 'lsb'; large?: boolean }) {
  const rows = lookupRows(convention);
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[480px] ${large ? 'text-lg' : 'text-sm'}`}>
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-1">錯誤位置（從左數）</th>
            <th>e(x)</th>
            <th>Syndrome S</th>
            <th>S 作為 GF(8) 元素</th>
            <th>S 讀成二進位數</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const asNumber = bitsToField(r.syndrome);
            const hi = r.position === highlightPos;
            return (
              <tr key={r.position} className={`border-t border-slate-100 ${hi ? 'bg-amber-100 font-semibold' : ''}`}>
                <td className="py-1.5">
                  {hi && '▶ '}位置 {r.position}
                </td>
                <td>
                  <M>{r.exponent === 0 ? '1' : r.exponent === 1 ? 'x' : `x^{${r.exponent}}`}</M>
                </td>
                <td className="font-mono font-bold">{r.syndrome.join('')}</td>
                <td>
                  <M>{aTex(asNumber)}</M>
                </td>
                <td className={asNumber === r.position ? 'text-emerald-700' : 'text-rose-600'}>
                  {asNumber} {asNumber === r.position ? '（剛好相同）' : '≠ 位置'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Column-by-column XOR correction                                     */
/* ------------------------------------------------------------------ */

export const xorTotalFrames = 8;

export function XorView({ r, e, stepper, large = false }: { r: Bit[]; e: Bit[]; stepper?: Stepper; large?: boolean }) {
  const own = useStepper(xorTotalFrames, { interval: 700 });
  const s = stepper ?? own;
  const done = Math.min(s.step, 7); // columns revealed
  const out = vecAdd(r, e);
  const cell = large ? 'h-12 w-12 text-2xl' : 'h-9 w-9 text-lg';
  const Row = ({ label, bits, kind }: { label: string; bits: (Bit | null)[]; kind: 'r' | 'e' | 'c' }) => (
    <div className="flex items-center gap-1">
      <span className={`w-16 shrink-0 text-right text-xs font-semibold ${kind === 'e' ? 'text-rose-600' : kind === 'c' ? 'text-emerald-700' : 'text-slate-500'}`}>{label}</span>
      {bits.map((b, i) => {
        const col = i === done - 1;
        const flip = kind === 'e' && b === 1;
        return (
          <motion.div
            key={`${kind}-${i}-${b}`}
            initial={kind === 'c' ? { opacity: 0, y: -8 } : false}
            animate={{ opacity: 1, y: 0 }}
            className={`grid place-items-center rounded-md border-2 font-mono font-bold ${cell} ${
              b === null ? 'border-dashed border-slate-200 text-slate-300' : flip ? 'border-rose-400 bg-rose-50 text-rose-700' : kind === 'c' ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-300 bg-white'
            } ${col ? 'ring-2 ring-amber-400' : ''}`}
          >
            {b === null ? '?' : b}
            {flip && <span className="sr-only">（翻轉）</span>}
          </motion.div>
        );
      })}
    </div>
  );
  return (
    <div className="space-y-2">
      {!stepper && <StepControls s={s} label={done === 0 ? '逐位 XOR' : `第 ${done} 位：${r[done - 1]} ⊕ ${e[done - 1]} = ${out[done - 1]}`} />}
      <div className="w-max max-w-full space-y-1 overflow-x-auto">
        <Row label="r" bits={r} kind="r" />
        <Row label="⊕ ê" bits={e} kind="e" />
        <div className="ml-[4.25rem] border-t-2 border-slate-400" />
        <Row label="= ĉ" bits={out.map((b, i) => (i < done ? b : null))} kind="c" />
      </div>
      <p className={`text-slate-600 ${large ? 'text-lg' : 'text-xs'}`}>ê 中為 1（紅框）的位置會被翻轉；其餘位置 b ⊕ 0 = b 保持不變。</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Decode report                                                       */
/* ------------------------------------------------------------------ */

export function outcomeStatus(o: L2Outcome): { status: DecodeStatus; zh?: string; en?: string } {
  if (o.errorCount === 0 && !o.detected) return { status: 'ok' };
  if (o.success) return { status: 'corrected' };
  if (o.undetected) return { status: 'wrong', zh: '未偵測錯誤', en: 'Undetected error' };
  return { status: 'wrong', zh: '誤更正', en: 'Miscorrection' };
}

export function receivedStates(e: Bit[]): BitState[] {
  return e.map((b) => (b ? 'error' : 'normal'));
}

export function correctedStates(e: Bit[], flippedPos: number): BitState[] {
  return e.map((b, i) => {
    if (i === flippedPos - 1) return b ? 'corrected' : 'wrongfix';
    return b ? 'error' : 'normal';
  });
}

export function DecodeReport({ o, method, large = false, onToggle }: { o: L2Outcome; method: L2Method; large?: boolean; onToggle?: (i: number) => void }) {
  const presenting = usePresenting();
  const d = o.decode;
  const st = outcomeStatus(o);
  const size = large ? 'lg' : 'sm';
  const root = d.chien.find((c) => c.isRoot);
  const Line = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="grid items-center gap-1 sm:grid-cols-[150px_1fr] sm:gap-3">
      <div className={`font-semibold text-slate-500 ${large ? 'text-base' : 'text-xs'}`}>{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
  return (
    <div className={`space-y-3 ${large ? 'text-lg' : 'text-sm'}`}>
      <Line label="原始 codeword c">
        <BitStrip bits={o.c} size={size} groups={false} />
      </Line>
      <Line label="錯誤向量 e">
        <BitStrip bits={o.e} roles="plain" size={size} showExp={false} states={o.e.map((b) => (b ? 'error' : 'muted'))} />
      </Line>
      <Line label={onToggle && !presenting ? '接收 r = c ⊕ e（點擊注入）' : '接收 r = c ⊕ e'}>
        <BitStrip bits={o.r} size={size} groups={false} states={receivedStates(o.e)} onToggle={onToggle} />
      </Line>
      <Line label="Syndrome S">
        <span className="mono font-bold">{d.syndrome.join('')}</span>
        <span className="ml-2">
          <M>{`= S_1 = ${aTex(d.field)}`}</M>
        </span>
      </Line>
      <Line label={method === 'lookup' ? '錯誤定位（查表）' : '錯誤定位（Chien）'}>
        {d.field === 0 ? (
          <span>S = 0 → 判定沒有錯誤</span>
        ) : method === 'lookup' ? (
          <span>
            查表：S = {d.syndrome.join('')} → 位置 {d.position}（<M>{`x^{${d.exponent}}`}</M>）
          </span>
        ) : (
          <span>
            <M>{`\\sigma(z) = 1 + ${aTex(d.field)}z`}</M>，根 <M>{`z=\\alpha^{${root?.j}}`}</M> → <M>{`i = ${root?.exponent}`}</M> → 位置 {d.position}
          </span>
        )}
      </Line>
      <Line label="更正後 ĉ = r ⊕ ê">
        <BitStrip bits={d.corrected} size={size} groups={false} states={correctedStates(o.e, d.position)} />
      </Line>
      <Line label="驗證 ĉ(α)">
        <span className={d.check === 0 ? 'text-emerald-700' : 'text-rose-700'}>
          <M>{`\\hat c(\\alpha) = ${aTex(d.check)}`}</M> {d.check === 0 ? '（是合法 codeword）' : ''}
        </span>
      </Line>
      <Line label="還原訊息 û">
        <span className="mono font-bold">{d.message.join('')}</span>
        <span className="ml-2 text-slate-500">原始 u = {o.u.join('')}</span>
        <span className={`ml-2 font-semibold ${o.success ? 'text-emerald-700' : 'text-rose-700'}`}>{o.success ? '✓ 相同' : '✗ 不同'}</span>
      </Line>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <StatusBadge status={st.status} large zh={st.zh} en={st.en} />
        <span className="chip border border-slate-200 bg-white text-slate-600">偵測到錯誤：{o.detected ? '是' : '否'}</span>
        <span className="chip border border-slate-200 bg-white text-slate-600">誤更正：{o.miscorrection ? '是' : '否'}</span>
        <span className="chip border border-slate-200 bg-white text-slate-600">錯誤數：{o.errorCount}</span>
      </div>
    </div>
  );
}
