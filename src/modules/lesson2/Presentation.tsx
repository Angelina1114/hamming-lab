import { useMemo, useState } from 'react';
import {
  type Bit,
  type L2Method,
  DEFAULT_U,
  LOG,
  bitsToField,
  encodeCyclic,
  hammingParams,
  simulateL2,
  simulateSecdedL2,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { StatusBadge } from '../../components/Lesson';
import { Deck, type DeckSlide } from '../../components/Deck';
import { BitStrip, ConventionBanner, L2Legend } from '../../components/l2/Common';
import { FlowDiagram, flowSequence } from '../../components/l2/FlowDiagram';
import { LfsrSim, OverflowViz, lfsrTotalFrames } from '../../components/l2/LfsrSim';
import { LongDivisionView, divisionTotalFrames } from '../../components/l2/Division';
import { ChienSim, GF8Table, AlphaCheck, chienTotalFrames } from '../../components/l2/Field';
import { DecodeReport, LookupTable, XorView, xorTotalFrames } from '../../components/l2/Decode';
import { L2_PRESETS, toggleError } from '../../components/l2/Controls';

interface Ctx {
  u: Bit[];
  errors: number[];
  setErrors: (e: number[]) => void;
  secded: boolean;
  method: L2Method;
}

type Slide = DeckSlide<Ctx>;

const SECDED_ROWS = [
  ['S = 0', '偶（Even）', 'No error', 'ok'],
  ['S ≠ 0', '奇（Odd）', 'Single error → correct', 'corrected'],
  ['S ≠ 0', '偶（Even）', 'Double error → do not correct', 'detected'],
  ['S = 0', '奇（Odd）', 'Overall parity bit error', 'corrected'],
] as const;

const SLIDES: Slide[] = [
  {
    title: 'Lesson 2 — Hamming code 編碼、解碼與錯誤更正',
    sub: 'From Encoding to Error Correction',
    steps: () => 1,
    render: (_s, c) => {
      const enc = encodeCyclic(c.u);
      return (
        <div className="space-y-6 text-2xl">
          <ConventionBanner />
          <div className="rounded-2xl border-2 border-slate-200 bg-white p-6">
            <div className="text-base text-slate-500">統一範例</div>
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <div className="text-base text-slate-500">Generator polynomial（生成多項式）</div>
                <M>{'g(x) = x^3 + x + 1'}</M> = <span className="mono">1011</span>
              </div>
              <div className="rounded-xl bg-data-50 p-4">
                <div className="text-base text-slate-500">訊息</div>
                <M>u</M> = <span className="mono font-bold">{c.u.join('')}</span> → <M>{'x^3u(x)'}</M> = <span className="mono">{enc.shifted.join('')}</span>
              </div>
              <div className="rounded-xl bg-parity-50 p-4">
                <div className="text-base text-slate-500">編碼結果</div>
                <M>p</M> = <span className="mono font-bold text-parity-600">{enc.parity.join('')}</span>，<M>c</M> = <span className="mono font-bold">{enc.codeword.join('')}</span>
              </div>
            </div>
          </div>
        </div>
      );
    },
  },
  {
    title: '2-1 完整編碼與解碼流程',
    steps: (c) => flowSequence(c.secded).length,
    render: (s, c) => <FlowDiagram u={c.u} errors={c.errors} secded={c.secded} method={c.method} stepper={s} large />,
  },
  {
    title: '2-2 LFSR（linear feedback shift register，線性回授移位暫存器）',
    sub: 'x³u(x) mod g(x)；feedback（回授）= input ⊕ R₂；R₂′ = R₁、R₁′ = R₀ ⊕ fb、R₀′ = fb',
    steps: (c) => lfsrTotalFrames(c.u.length, true),
    render: (s, c) => <LfsrSim kind="encoder" input={c.u} stepper={s} detailed large />,
  },
  {
    title: '2-2 為什麼 000 → 011？',
    sub: 'x³ ≡ x + 1 (mod g(x))',
    steps: () => 1,
    render: () => <OverflowViz large />,
  },
  {
    title: '2-3 GF(2) 多項式長除法',
    steps: () => divisionTotalFrames(7),
    render: (s, c) => <LongDivisionView dividend={encodeCyclic(c.u).shifted} stepper={s} large />,
  },
  {
    title: '2-4 Syndrome（徵狀）：S(x) = r(x) mod g(x)',
    sub: '餘式只和錯誤有關',
    steps: () => divisionTotalFrames(7),
    render: (s, c) => {
      const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
      return (
        <div className="space-y-4">
          <ReceivedRow c={c} />
          <LongDivisionView dividend={o.r} stepper={s} large />
        </div>
      );
    },
  },
  {
    title: '2-5 Syndrome 查表',
    sub: 'Syndrome 是錯誤特徵值，不是位置的二進位',
    steps: () => 1,
    render: (_s, c) => {
      const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
      return (
        <div className="space-y-4">
          <ReceivedRow c={c} />
          <div className="text-2xl">
            S = <span className="mono font-bold">{o.decode.syndrome.join('')}</span> → {o.decode.position ? `位置 ${o.decode.position}` : '無錯誤'}
          </div>
          <LookupTable highlightPos={o.decode.position || undefined} large />
        </div>
      );
    },
  },
  {
    title: '2-6 GF(8) 與 key equation（關鍵方程式）',
    sub: 'α³ = α + 1，σ(z) = 1 + S₁z',
    steps: () => 8,
    render: (s, c) => {
      const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
      return (
        <div className="space-y-4">
          <GF8Table large revealed={Math.min(s.step + 1, 7)} highlight={s.step >= 7 ? o.decode.field : undefined} />
          {s.step >= 7 && (
            <div className="text-2xl">
              <M>{`S = ${o.decode.syndrome.join('')} = S_1`}</M>，<M>{o.decode.field ? `\\sigma(z) = 1 + \\alpha^{${LOG[o.decode.field]}}z` : '\\sigma(z) = 1'}</M>
            </div>
          )}
        </div>
      );
    },
  },
  {
    title: '2-7 Chien search',
    sub: '依序代入 z = α⁰ … α⁶',
    steps: () => chienTotalFrames,
    render: (s, c) => {
      const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
      return <ChienSim S1={bitsToField(o.decode.syndrome)} stepper={s} large />;
    },
  },
  {
    title: '2-8 XOR（exclusive OR，互斥或）更正與驗證',
    steps: () => xorTotalFrames,
    render: (s, c) => {
      const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
      return (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <XorView r={o.r} e={o.decode.estimatedError} stepper={s} large />
          {s.step >= 7 && <AlphaCheck word={o.decode.corrected} large />}
        </div>
      );
    },
  },
  {
    title: '2-9 兩個錯誤：Miscorrection（誤更正）',
    sub: '更正後合法 ≠ 還原正確',
    steps: () => 1,
    render: (_s, c) => <FixedScenario u={c.u} method={c.method} initial={[2, 7]} max={2} />,
  },
  {
    title: '2-10 三個錯誤：Undetected error（未偵測錯誤）',
    sub: 'e(x) = g(x) ⇒ S = 0',
    steps: () => 1,
    render: (_s, c) => <FixedScenario u={c.u} method={c.method} initial={[4, 6, 7]} max={3} />,
  },
  {
    title: '2-11 SECDED',
    sub: '只在「至多兩個錯誤」時保證',
    steps: () => 1,
    render: (_s, c) => <SecdedSlide u={c.u} />,
  },
  {
    title: '2-12 小型範例 vs 實際參數',
    steps: () => 1,
    render: () => {
      const a = hammingParams(3);
      const b = hammingParams(7);
      const rows: [string, string, string][] = [
        ['Finite field / g(x)', 'GF(8), x³+x+1', 'GF(128), x⁷+x³+1'],
        ['Hamming', `(${a.n},${a.k},3)`, `(${b.n},${b.k},3)`],
        ['Extended', `(${a.nExt},${a.kExt},4)`, `(${b.nExt},${b.kExt},4)`],
        ['Code rate', `4/7 ≈ ${(a.rate * 100).toFixed(2)}%`, `120/128 = ${(b.rateExt * 100).toFixed(2)}%（Ext.）`],
        ['H 大小', `${a.hRows}×${a.hCols}`, `${b.hRows}×${b.hCols}`],
      ];
      return (
        <div className="space-y-4">
          <table className="w-full text-2xl">
            <tbody>
              {rows.map(([k, x, y]) => (
                <tr key={k} className="border-t border-slate-200">
                  <td className="py-3 text-slate-500">{k}</td>
                  <td className="font-mono">{x}</td>
                  <td className="font-mono font-bold">{y}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-lg text-slate-600">400ZR 的 inner code（內碼）是 double-extended Hamming(128,119)，用 soft decision（軟判決）的 Chase 演算法解碼；本課的 syndrome 解碼則是 hard decision（硬判決）。</p>
        </div>
      );
    },
  },
  {
    title: '2-13 現場實驗',
    sub: '0–3 個錯誤時，decoder（解碼器）怎麼判斷？',
    steps: () => 1,
    render: (_s, c) => {
      const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
      return <DecodeReport o={o} method={c.method} large onToggle={(i) => c.setErrors(toggleError(c.errors, i + 1, 3))} />;
    },
  },
  {
    title: '總結',
    steps: () => 1,
    render: () => (
      <div className="space-y-3 text-2xl leading-relaxed">
        <Tex block>{'c(x) = x^3u(x) + \\big(x^3u(x) \\bmod g(x)\\big)\\;\\to\\; S(x) = e(x) \\bmod g(x) \\;\\to\\; S_1 = \\alpha^i \\;\\to\\; \\hat c = r \\oplus x^i'}</Tex>
        <ul className="list-disc space-y-1 pl-8">
          <li>1 個錯誤：保證更正（d_min = 3，t = 1）</li>
          <li>2 個錯誤：miscorrection</li>
          <li>3 個錯誤：可能成為 undetected error（e ∈ C）</li>
          <li>SECDED：再加 1 個 bit，雙錯必偵測</li>
        </ul>
      </div>
    ),
  },
];

/* ------------------------------------------------------------------ */

function ReceivedRow({ c }: { c: Ctx }) {
  const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <span className="text-lg text-slate-500">r =</span>
      <BitStrip bits={o.r} size="lg" groups={false} states={o.e.map((b) => (b ? 'error' : 'normal'))} onToggle={(i) => c.setErrors(toggleError(c.errors, i + 1, 3))} />
    </div>
  );
}

function FixedScenario({ u, method, initial, max }: { u: Bit[]; method: L2Method; initial: number[]; max: number }) {
  const [errors, setErrors] = useState(initial);
  const o = simulateL2(u, errors, method);
  return (
    <div className="space-y-3">
      <DecodeReport o={o} method={method} large onToggle={(i) => setErrors(toggleError(errors, i + 1, max))} />
      <L2Legend />
    </div>
  );
}

function SecdedSlide({ u }: { u: Bit[] }) {
  const [errors, setErrors] = useState<number[]>([2, 7]);
  const so = simulateSecdedL2(u, errors);
  const r = so.result;
  const idx = ['no-error', 'single', 'double', 'overall'].indexOf(r.case);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-lg text-slate-500">r =</span>
        <BitStrip bits={so.r8} size="lg" groups={false} states={so.e.map((b) => (b ? 'error' : 'normal'))} onToggle={(i) => setErrors(toggleError(errors, i + 1, 3))} />
      </div>
      <div className="flex flex-wrap gap-6 text-2xl">
        <span>
          S = <span className="mono font-bold">{r.syndrome.join('')}</span>
        </span>
        <span>q = {r.parity}（{r.parity ? '奇' : '偶'}）</span>
      </div>
      <table className="w-full text-xl">
        <tbody>
          {SECDED_ROWS.map(([s, q, label, st], k) => (
            <tr key={label} className={`border-t border-slate-200 ${k === idx ? 'bg-amber-100 font-bold' : ''}`}>
              <td className="py-2">{k === idx ? '▶ ' : ''}{s}</td>
              <td>{q}</td>
              <td>{label}</td>
              <td>
                <StatusBadge status={st} large />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {r.uncorrectable && <div className="rounded-xl bg-orange-500 px-4 py-2 text-xl font-bold text-white">⚑ Uncorrectable Error：不更正，保留接收資料</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export default function Presentation() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [errors, setErrors] = useState<number[]>([2]);
  const [secded, setSecded] = useState(false);
  const [method, setMethod] = useState<L2Method>('chien');
  const [exampleKey, setExampleKey] = useState(0);
  const ctx: Ctx = useMemo(() => ({ u, errors, setErrors, secded, method }), [u, errors, secded, method]);
  const restart = () => setExampleKey((k) => k + 1);

  return (
    <Deck
      slides={SLIDES}
      ctx={ctx}
      label="第二課報告"
      exitHref="#/l2-1"
      resetKey={exampleKey}
      toolbar={
        <>
          <select
            aria-label="切換範例"
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1"
            value={L2_PRESETS.find((p) => p.errors.join() === errors.join())?.key ?? 'custom'}
            onChange={(e) => {
              const p = L2_PRESETS.find((x) => x.key === e.target.value);
              if (p) setErrors(p.errors);
              restart();
            }}
          >
            {L2_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
            <option value="custom" disabled>
              自訂錯誤
            </option>
          </select>
          <select
            aria-label="切換訊息"
            className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 font-mono"
            value={u.join('')}
            onChange={(e) => {
              setU(e.target.value.split('').map((x) => (x === '1' ? 1 : 0)) as Bit[]);
              restart();
            }}
          >
            {['1001', '1011', '0110', '1111', '0001'].map((m) => (
              <option key={m} value={m}>
                u = {m}
              </option>
            ))}
          </select>
          <button className={`rounded-md border px-2 py-1 ${method === 'chien' ? 'border-white' : 'border-slate-600'}`} onClick={() => setMethod(method === 'chien' ? 'lookup' : 'chien')}>
            {method === 'chien' ? 'Chien' : 'Lookup'}
          </button>
          <button
            className={`rounded-md border px-2 py-1 ${secded ? 'border-overall-300 text-overall-300' : 'border-slate-600'}`}
            onClick={() => {
              setSecded(!secded);
              if (secded) setErrors((x) => x.filter((p) => p <= 7));
              restart();
            }}
          >
            SECDED {secded ? 'ON' : 'OFF'}
          </button>
        </>
      }
    />
  );
}
