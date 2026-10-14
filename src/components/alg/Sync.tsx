import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { type Bit, lfsrDivisionSync, msbToTex } from '../../core';
import { Tex } from '../Tex';
import { LfsrSim } from '../l2/LfsrSim';
import { StepControls, useStepper } from '../l2/Stepper';

const EXP = ['x³', 'x²', 'x', '1'];

function Row4({ label, bits, cls, note }: { label: string; bits: (Bit | string | null)[]; cls?: (i: number) => string; note?: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-24 shrink-0 text-right text-xs text-slate-500">{label}</span>
      {bits.map((b, i) => (
        <span key={i} className={`grid h-8 w-8 place-items-center rounded font-mono text-base font-bold ${cls?.(i) ?? ''}`}>
          {b === null ? '' : b}
        </span>
      ))}
      {note && <span className="ml-2 text-xs text-slate-500">{note}</span>}
    </div>
  );
}

/**
 * Long division (bring down one message bit at a time) on the left, premultiplied LFSR on the right.
 * One stepper drives both, so every click advances the division and the register together.
 */
export function SyncLfsrDivision({ u, large = false }: { u: Bit[]; large?: boolean }) {
  const steps = useMemo(() => lfsrDivisionSync(u), [u]);
  const s = useStepper(u.length + 1, { interval: 1500 });
  const k = s.step; // number of completed steps
  const cur = k > 0 ? steps[k - 1] : null;

  return (
    <div className="space-y-4">
      <StepControls s={s} label={cur ? `第 ${k} 步：輸入 u = ${cur.input}` : 'Step 0：暫存器 000'} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-700">左：GF(2) 多項式長除法（一次帶下一個位元）</div>
          <div className="space-y-1 overflow-x-auto">
            <Row4 label="" bits={EXP} cls={() => '!text-[11px] !font-semibold text-slate-400'} />
            <Row4 label="Step 0 餘數" bits={[null, 0, 0, 0]} cls={() => 'text-slate-500'} />
            {steps.slice(0, k).map((st, idx) => {
              const isCur = idx === k - 1;
              if (!isCur)
                return (
                  <Row4 key={idx} label={`Step ${st.k} 餘數`} bits={[null, ...st.next]} cls={() => 'text-slate-500'} />
                );
              return (
                <motion.div key={idx} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="space-y-1 rounded-xl bg-amber-50/70 p-2">
                  <Row4 label="× x（左移）" bits={st.shifted} cls={(i) => (i === 0 ? 'text-fuchsia-700' : 'text-slate-800')} note="舊餘數升一次方" />
                  <Row4 label={`+ u${['₁', '₂', '₃', '₄'][idx]}·x³`} bits={[st.input, 0, 0, 0]} cls={(i) => (i === 0 ? 'text-data-700' : 'text-slate-300')} note="帶下一個訊息位元" />
                  <Row4 label="=" bits={st.broughtDown} cls={(i) => `border-t border-slate-300 ${i === 0 ? 'bg-fuchsia-100 text-fuchsia-800' : ''}`} note={`最高位 = feedback = ${st.feedback}`} />
                  <Row4 label={`− ${st.feedback}·g(x)`} bits={st.subtract} cls={() => (st.feedback ? 'text-fuchsia-700' : 'text-slate-300')} note={st.feedback ? '消去 x³（減 = 加 = XOR）' : '最高位已是 0，不必減'} />
                  <Row4 label={`Step ${st.k} 餘數`} bits={[null, ...st.next]} cls={() => 'border-t border-slate-300 bg-emerald-100 text-emerald-800'} />
                </motion.div>
              );
            })}
          </div>
          {cur && (
            <div className={`mt-2 text-slate-700 ${large ? 'text-base' : 'text-sm'}`}>
              <Tex>{`R_{${cur.k}}(x) = \\big(x\\,R_{${cur.k - 1}}(x) + ${cur.input}\\cdot x^3\\big) \\bmod g(x) = ${msbToTex(cur.next)}`}</Tex>
            </div>
          )}
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
          <div className="mb-2 text-sm font-bold text-slate-700">右：LFSR 暫存器（預乘式，輸入 u）</div>
          <LfsrSim kind="encoder" input={u} stepper={s} detailed={false} large={large} />
        </div>
      </div>
      {cur && (
        <motion.div key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
          {[
            ['Input', String(cur.input)],
            ['Feedback', `${cur.input} ⊕ ${cur.prev[0]} = ${cur.feedback}`],
            ['Shift', `${cur.prev.join('')} → ${cur.lfsr.shifted.join('')}`],
            ['XOR Mask', cur.lfsr.mask.join('')],
            ['新狀態', cur.next.join('')],
          ].map(([a, b]) => (
            <div key={a} className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="text-[11px] font-semibold text-slate-500">{a}</div>
              <div className="font-mono font-bold">{b}</div>
            </div>
          ))}
        </motion.div>
      )}
      <p className="text-xs text-slate-500">
        兩邊每一步都相同：左邊「最高位」= 右邊 feedback；左邊減去的 g(x) 去掉首項 = 右邊的 XOR mask <span className="mono">011</span>；左邊的新餘數 = 右邊的新暫存器。（由 lfsrDivisionSync 與 runLfsr 分別計算，並有自動測試比對。）
      </p>
    </div>
  );
}
