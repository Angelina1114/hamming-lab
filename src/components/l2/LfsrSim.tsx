import { useMemo, useState } from 'react';
import { usePresenting } from '../../lib/presenting';
import { motion } from 'framer-motion';
import { type Bit, type LfsrKind, G_MSB, msbToTex, polyModMsb, runLfsr } from '../../core';
import { M, Tex } from '../Tex';
import { Segmented } from '../Lesson';
import { StepControls, useStepper, type Stepper } from './Stepper';
import { Mono } from './Common';

export const PHASES = ['讀入 bit', '計算 feedback', '左移（× x）', 'XOR feedback'] as const;

/** frame → (t, phase); frame 0 is the initial state */
export function lfsrFrame(frame: number, detailed: boolean): { t: number; phase: number } {
  if (frame === 0) return { t: -1, phase: 3 };
  if (!detailed) return { t: frame - 1, phase: 3 };
  return { t: Math.floor((frame - 1) / 4), phase: (frame - 1) % 4 };
}

export const lfsrTotalFrames = (len: number, detailed: boolean) => 1 + len * (detailed ? 4 : 1);

interface LfsrSimProps {
  kind: LfsrKind;
  input: Bit[];
  stepper?: Stepper;
  detailed?: boolean;
  large?: boolean;
  onInputToggle?: (i: number) => void;
  /** number of trailing input bits to render as "extra" (encoder fed with padding zeros) */
  extraTail?: number;
}

/** The circuit + state table for g(x) = x³ + x + 1. All values come from runLfsr. */
export function LfsrSim({ kind, input, stepper, detailed = true, large = false, onInputToggle, extraTail = 0 }: LfsrSimProps) {
  const presenting = usePresenting();
  const run = useMemo(() => runLfsr(input, kind, G_MSB), [input, kind]);
  const total = lfsrTotalFrames(input.length, detailed);
  const own = useStepper(total, { interval: detailed ? 900 : 1300 });
  const s = stepper ?? own;
  const { t, phase } = lfsrFrame(Math.min(s.step, total - 1), detailed);
  const st = t >= 0 ? run.steps[t] : null;

  // what the boxes display in this phase
  const regs: Bit[] = !st ? run.states[0] : phase <= 1 ? st.before : phase === 2 ? st.shifted : st.after;
  const doneUpTo = st ? (phase === 3 ? t : t - 1) : -1; // last fully applied step
  const meaningTex = (k: number) => {
    // state after k inputs
    const prefix = input.slice(0, k);
    const val = kind === 'encoder' ? polyModMsb([...prefix, 0, 0, 0], G_MSB) : polyModMsb([0, 0, 0, ...prefix], G_MSB);
    const pre = prefix.length ? msbToTex(prefix as Bit[]) : '0';
    return kind === 'encoder' ? `x^3\\,(${pre}) \\bmod g(x) = ${msbToTex(val)}` : `(${pre}) \\bmod g(x) = ${msbToTex(val)}`;
  };

  const caption = !st ? (
    <span>初始狀態 R₂R₁R₀ = 000。{!presenting && '按「下一步」開始逐 bit 輸入。'}</span>
  ) : phase === 0 ? (
    <span>
      第 {t + 1} 個時脈：讀入 bit <strong>{st.input}</strong>，更新前 R₂R₁R₀ = <span className="mono">{st.before.join('')}</span>
    </span>
  ) : phase === 1 ? (
    <span>
      {kind === 'encoder' ? (
        <Tex>{`\\text{feedback} = \\text{input} \\oplus R_2 = ${st.input} \\oplus ${st.before[0]} = ${st.feedback}`}</Tex>
      ) : (
        <Tex>{`\\text{feedback} = R_2 = ${st.feedback}`}</Tex>
      )}
    </span>
  ) : phase === 2 ? (
    <span>
      左移一格（每個係數升一次方 = 乘以 <M>x</M>）：<span className="mono">{st.before.join('')}</span> → <span className="mono">{st.shifted.join('')}</span>
      {kind === 'divider' ? `（R₀ 接收輸入 ${st.input}）` : '（R₀ 補 0）'}；原本的 R₂ 溢出成為 <M>x^3</M> 項
    </span>
  ) : (
    <span>
      依 <M>{'g(x)=x^3+x+1'}</M> 把 feedback 加到 <M>x</M> 與 <M>1</M> 的位置：<span className="mono">{st.shifted.join('')}</span> ⊕ <span className="mono">{st.mask.join('')}</span> = <strong className="mono">{st.after.join('')}</strong>
    </span>
  );

  return (
    <div className="space-y-4">
      {!stepper && <StepControls s={s} label={st ? `第 ${t + 1} 個 bit · ${PHASES[phase]}` : '初始'} />}

      {/* input tape */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500">輸入（由左至右，MSB 先）</span>
        <div className="flex gap-1">
          {input.map((b, i) => {
            const isExtra = i >= input.length - extraTail;
            const current = st && i === t;
            const used = i <= doneUpTo;
            return (
              <button
                key={i}
                type="button"
                disabled={!onInputToggle}
                onClick={() => onInputToggle?.(i)}
                className={`grid h-8 w-8 place-items-center rounded-md border-2 font-mono text-sm font-bold transition-colors ${
                  current ? 'border-amber-500 bg-amber-100 text-amber-900 ring-2 ring-amber-300' : used ? 'border-slate-200 bg-slate-50 text-slate-400' : isExtra ? 'border-dashed border-slate-300 text-slate-500' : 'border-data-300 bg-data-50 text-data-700'
                } ${onInputToggle ? 'cursor-pointer hover:border-slate-500' : ''}`}
                title={current ? '目前輸入' : used ? '已輸入' : '尚未輸入'}
              >
                {b}
              </button>
            );
          })}
        </div>
        {st && <span className="chip bg-amber-100 text-amber-800">▲ 目前輸入：第 {t + 1} 個 bit</span>}
      </div>

      <Circuit kind={kind} regs={regs} st={st} phase={phase} large={large} />

      <motion.div key={`${s.step}`} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`min-h-[52px] rounded-xl bg-slate-50 p-3 text-slate-700 ${large ? 'text-lg' : 'text-sm'}`}>
        {caption}
        {st && phase === 3 && (
          <div className="mt-1 text-slate-600">
            對應餘數：<Tex>{meaningTex(t + 1)}</Tex>
          </div>
        )}
      </motion.div>

      {/* state table */}
      <div className="overflow-x-auto">
        <table className={`w-full min-w-[460px] ${large ? 'text-base' : 'text-sm'}`}>
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1">時脈</th>
              <th>輸入</th>
              <th>更新前</th>
              <th>Feedback</th>
              <th>更新後 R₂R₁R₀</th>
              <th>多項式餘數</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100">
              <td className="py-1 font-mono text-slate-400">0</td>
              <td>—</td>
              <td>—</td>
              <td>—</td>
              <td className="font-mono font-semibold">000</td>
              <td className="text-slate-400">0</td>
            </tr>
            {run.steps.map((x, k) => {
              const visible = k <= doneUpTo || (k === t && phase >= 1);
              return (
                <tr key={k} className={`border-t border-slate-100 ${k === t ? 'bg-amber-50' : ''} ${visible ? '' : 'opacity-30'}`}>
                  <td className="py-1 font-mono text-slate-400">{k + 1}</td>
                  <td className="font-mono">{x.input}</td>
                  <td className="font-mono">{x.before.join('')}</td>
                  <td className="font-mono">{visible ? x.feedback : '?'}</td>
                  <td className="font-mono font-semibold">{k <= doneUpTo ? x.after.join('') : '???'}</td>
                  <td>{k <= doneUpTo ? <Tex>{msbToTex(x.after)}</Tex> : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Circuit({ kind, regs, st, phase, large }: { kind: LfsrKind; regs: Bit[]; st: ReturnType<typeof runLfsr>['steps'][number] | null; phase: number; large: boolean }) {
  const active = (p: number) => st !== null && phase === p;
  const BOX_W = 70;
  const xs = [150, 330, 510]; // R2, R1, R0 left edges
  const cy = 150;
  const fbVal = st?.feedback;
  const inVal = st?.input;
  const C = {
    idle: '#cbd5e1',
    input: '#d97706',
    fb: '#c026d3',
    shift: '#2a55e0',
  };
  const wire = (on: boolean, color: string) => ({ stroke: on ? color : C.idle, strokeWidth: on ? 3.5 : 2 });
  const tapOn = active(3) && st?.feedback === 1;
  const names = ['R₂', 'R₁', 'R₀'];
  const coef = ['x² 係數', 'x 係數', '1 係數'];

  return (
    <svg viewBox="0 0 660 250" className={`w-full ${large ? 'max-w-[900px]' : 'max-w-[680px]'}`} role="img" aria-label="g(x)=x³+x+1 的 LFSR 電路">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="#64748b" />
        </marker>
      </defs>

      {/* feedback bus: from the feedback node up, across, down into R0 and the x-tap */}
      <path d={`M70 ${cy - 16} V60 H625 V${cy}`} fill="none" {...wire(active(1) || active(3), C.fb)} />
      {/* x tap (g1 = 1) into XOR between R1 and R0 */}
      <path d={`M455 60 V${cy - 15}`} fill="none" {...wire(tapOn, C.fb)} markerEnd="url(#arr)" />
      {/* into R0 */}
      {kind === 'encoder' ? (
        <path d={`M625 ${cy} H${xs[2] + BOX_W + 2}`} fill="none" {...wire(active(3), C.fb)} markerEnd="url(#arr)" />
      ) : (
        <>
          <path d={`M625 ${cy} H${611}`} fill="none" {...wire(active(3), C.fb)} />
          <circle cx={597} cy={cy} r={14} fill="#fff" stroke={active(3) ? C.fb : '#64748b'} strokeWidth={2} />
          <text x={597} y={cy + 5} textAnchor="middle" fontSize={16} fill="#334155">⊕</text>
          <path d={`M583 ${cy} H${xs[2] + BOX_W + 2}`} fill="none" {...wire(active(2) || active(3), C.shift)} markerEnd="url(#arr)" />
          {/* divider input comes from below into the R0 XOR */}
          <path d={`M597 235 V${cy + 15}`} fill="none" {...wire(active(0) || active(2), C.input)} markerEnd="url(#arr)" />
          <text x={612} y={232} fontSize={12} fill={C.input}>input {inVal ?? ''}</text>
        </>
      )}

      {/* data path R0 → XOR → R1 → R2 → feedback node (leftward = shift toward higher powers) */}
      <path d={`M${xs[2]} ${cy} H469`} fill="none" {...wire(active(2), C.shift)} markerEnd="url(#arr)" />
      <path d={`M441 ${cy} H${xs[1] + BOX_W + 2}`} fill="none" {...wire(active(2) || tapOn, active(2) ? C.shift : C.fb)} markerEnd="url(#arr)" />
      <path d={`M${xs[1]} ${cy} H${xs[0] + BOX_W + 2}`} fill="none" {...wire(active(2), C.shift)} markerEnd="url(#arr)" />
      <path d={`M${xs[0]} ${cy} H${kind === 'encoder' ? 86 : 72}`} fill="none" {...wire(active(1) || active(2), active(1) ? C.fb : C.shift)} markerEnd="url(#arr)" />

      {/* XOR between R1 and R0 */}
      <circle cx={455} cy={cy} r={14} fill={tapOn ? '#fdf4ff' : '#fff'} stroke={tapOn ? C.fb : '#64748b'} strokeWidth={2} />
      <text x={455} y={cy + 5} textAnchor="middle" fontSize={16} fill="#334155">⊕</text>
      <text x={455} y={cy + 34} textAnchor="middle" fontSize={11} fill="#7638dc">g₁ = 1</text>
      <text x={275} y={cy + 34} textAnchor="middle" fontSize={11} fill="#94a3b8">g₂ = 0（無 XOR）</text>

      {/* feedback node */}
      {kind === 'encoder' ? (
        <>
          <circle cx={70} cy={cy} r={16} fill={active(1) ? '#fdf4ff' : '#fff'} stroke={active(1) ? C.fb : '#64748b'} strokeWidth={2} />
          <text x={70} y={cy + 6} textAnchor="middle" fontSize={18} fill="#334155">⊕</text>
          <path d={`M70 235 V${cy + 17}`} fill="none" {...wire(active(0) || active(1), C.input)} markerEnd="url(#arr)" />
          <text x={80} y={232} fontSize={12} fill={C.input}>input {inVal ?? ''}</text>
        </>
      ) : (
        <circle cx={70} cy={cy} r={5} fill={active(1) ? C.fb : '#64748b'} />
      )}
      <text x={20} y={52} fontSize={12} fill={C.fb} fontWeight={600}>
        feedback {fbVal !== undefined && phase >= 1 ? `= ${fbVal}` : ''}
      </text>

      {/* registers */}
      {xs.map((x, d) => {
        const changed = st && phase === 3 && st.after[d] !== st.before[d];
        return (
          <g key={d}>
            <text x={x + BOX_W / 2} y={cy - 40} textAnchor="middle" fontSize={14} fontWeight={700} fill="#334155">{names[d]}</text>
            <rect x={x} y={cy - 30} width={BOX_W} height={60} rx={10} fill={changed ? '#fdf4ff' : '#f8fafc'} stroke={changed ? C.fb : '#475569'} strokeWidth={2} />
            <motion.text
              key={`${d}-${regs[d]}-${phase}`}
              x={x + BOX_W / 2}
              y={cy + 11}
              textAnchor="middle"
              fontSize={30}
              fontWeight={800}
              fontFamily="ui-monospace, monospace"
              fill="#0f172a"
              initial={phase === 2 && st ? { x: 60, opacity: 0.2 } : { opacity: 0.4 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.45 }}
            >
              {regs[d]}
            </motion.text>
            <text x={x + BOX_W / 2} y={cy + 50} textAnchor="middle" fontSize={11} fill="#64748b">{coef[d]}</text>
          </g>
        );
      })}
      <text x={330} y={20} textAnchor="middle" fontSize={12} fill="#64748b">
        {kind === 'encoder' ? '預乘式 encoder：輸入從 x³ 端進入（已乘 x³）' : '除法器：輸入從 R₀（1 的位置）進入'}
      </text>
    </svg>
  );
}

/** Visual proof of x³ ≡ x + 1 (mod g): an overflowing x³ term folds back into x and 1. */
export function OverflowViz({ large = false }: { large?: boolean }) {
  const [stage, setStage] = useState(0);
  const slots = ['x³', 'x²', 'x', '1'];
  const values: (Bit | null)[][] = [
    [1, 0, 0, 0], // x³ present
    [1, 0, 1, 1], // add g(x) = x³ + x + 1 (subtracting = adding in GF(2))
    [0, 0, 1, 1], // x³ cancelled → x + 1
  ];
  const caption = [
    <>第一次輸入 1：預乘式電路把它放在 <M>x^3</M> 的位置——但 register 只有 <M>x^2, x, 1</M> 三格，<M>x^3</M> 「溢出」。</>,
    <>
      在 mod <M>{'g(x)'}</M> 的世界裡 <M>{'g(x) = x^3 + x + 1 \\equiv 0'}</M>，所以可以任意加上 <M>g(x)</M>（GF(2) 中加法 = 減法）。
    </>,
    <>
      <M>{'x^3 + (x^3 + x + 1) = x + 1'}</M>：<M>x^3</M> 抵消，以 feedback 加到 <M>x</M> 與 <M>1</M> 的位置 → register <strong className="mono">011</strong>。這就是 <M>{'x^3 \\equiv x + 1 \\pmod{g(x)}'}</M>。
    </>,
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        {slots.map((name, k) => {
          const v = values[stage][k];
          const overflow = k === 0;
          const fed = stage >= 1 && (k === 2 || k === 3);
          return (
            <div key={name} className="flex flex-col items-center gap-1">
              <span className={`text-xs font-semibold ${overflow ? 'text-rose-600' : 'text-slate-500'}`}>{overflow ? `${name}（溢出）` : name}</span>
              <motion.div
                key={`${k}-${stage}`}
                initial={{ scale: 0.85, opacity: 0.4 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`grid place-items-center rounded-xl border-2 font-mono font-bold ${large ? 'h-16 w-16 text-3xl' : 'h-12 w-12 text-2xl'} ${
                  overflow ? (v ? 'border-dashed border-rose-400 bg-rose-50 text-rose-700' : 'border-dashed border-slate-300 text-slate-300 line-through') : fed ? 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700' : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                {v}
              </motion.div>
            </div>
          );
        })}
        {stage === 1 && (
          <div className="pb-3 text-sm text-fuchsia-700">
            ⊕ <Mono bits={[1, 0, 1, 1]} /> = <M>{'g(x)'}</M>
          </div>
        )}
      </div>
      <div className={`${large ? 'text-lg' : 'text-sm'} text-slate-700`}>{caption[stage]}</div>
      <div className="flex gap-2">
        <button className="btn-ghost" disabled={stage === 0} onClick={() => setStage(stage - 1)}>
          上一步
        </button>
        <button className="btn-primary" disabled={stage === 2} onClick={() => setStage(stage + 1)}>
          下一步
        </button>
        <button className="btn-ghost" onClick={() => setStage(0)}>
          重設
        </button>
      </div>
    </div>
  );
}

/** Mode toggle helper used by the LFSR chapter and the playground */
export function LfsrModeToggle({ kind, onChange }: { kind: LfsrKind; onChange: (k: LfsrKind) => void }) {
  return (
    <Segmented
      value={kind}
      onChange={onChange}
      options={[
        { value: 'encoder', label: '預乘式 encoder（輸入 u）' },
        { value: 'divider', label: '除法器（輸入 x³u）' },
      ]}
    />
  );
}
