import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Expand, Minimize, Pause, Play, X, Keyboard } from 'lucide-react';
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
import { useStepper, type Stepper } from '../../components/l2/Stepper';
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

interface Slide {
  title: string;
  sub?: string;
  steps: (c: Ctx) => number;
  render: (s: Stepper, c: Ctx) => ReactNode;
}

const SECDED_ROWS = [
  ['S = 0', '偶 Even', 'No Error', 'ok'],
  ['S ≠ 0', '奇 Odd', 'Single Error → Correct', 'corrected'],
  ['S ≠ 0', '偶 Even', 'Double Error → Do Not Correct', 'detected'],
  ['S = 0', '奇 Odd', 'Overall Parity Bit Error', 'corrected'],
] as const;

const SLIDES: Slide[] = [
  {
    title: 'Lesson 2 — Hamming Code 編碼、解碼與錯誤更正',
    sub: 'From Encoding to Error Correction',
    steps: () => 1,
    render: (_s, c) => {
      const enc = encodeCyclic(c.u);
      return (
        <div className="space-y-6 text-2xl">
          <ConventionBanner />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6">
              <div className="text-base text-slate-500">統一範例</div>
              <div className="mt-2 space-y-2">
                <div>
                  <M>{'g(x) = x^3 + x + 1'}</M> = <span className="mono">1011</span>
                </div>
                <div>
                  <M>u</M> = <span className="mono font-bold">{c.u.join('')}</span> → <M>{'x^3u(x)'}</M> = <span className="mono">{enc.shifted.join('')}</span>
                </div>
                <div>
                  <M>p</M> = <span className="mono font-bold text-parity-600">{enc.parity.join('')}</span>，<M>c</M> = <span className="mono font-bold">{enc.codeword.join('')}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-6 text-lg text-slate-600">
              <div className="mb-2 font-semibold text-slate-800">操作</div>
              <ul className="space-y-1">
                <li>→ / 空白鍵：下一步（動畫走完再換頁）</li>
                <li>←：上一步</li>
                <li>P：播放 / 暫停　F：全螢幕</li>
                <li>上方可切換範例、注入錯誤</li>
              </ul>
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
    title: '2-2 LFSR：x³u(x) mod g(x)',
    sub: 'feedback = input ⊕ R₂；R₂′ = R₁、R₁′ = R₀ ⊕ fb、R₀′ = fb',
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
    title: '2-4 Syndrome：S(x) = r(x) mod g(x)',
    sub: '點擊接收字注入錯誤',
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
    title: '2-6 GF(8) 與 Key Equation',
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
    title: '2-7 Chien Search',
    sub: '依序代入 z = α⁰ … α⁶',
    steps: () => chienTotalFrames,
    render: (s, c) => {
      const o = simulateL2(c.u, c.errors.filter((p) => p <= 7), c.method);
      return <ChienSim S1={bitsToField(o.decode.syndrome)} stepper={s} large />;
    },
  },
  {
    title: '2-8 XOR 更正與驗證',
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
    title: '2-9 兩個錯誤：Miscorrection',
    sub: '修正後合法 ≠ 還原正確',
    steps: () => 1,
    render: () => <FixedScenario initial={[2, 7]} max={2} />,
  },
  {
    title: '2-10 三個錯誤：Undetected Error',
    sub: 'e(x) = g(x) ⇒ S = 0',
    steps: () => 1,
    render: () => <FixedScenario initial={[4, 6, 7]} max={3} />,
  },
  {
    title: '2-11 SECDED',
    sub: '只在「至多兩個錯誤」時保證',
    steps: () => 1,
    render: () => <SecdedSlide />,
  },
  {
    title: '2-12 小型範例 vs 實際參數',
    steps: () => 1,
    render: () => {
      const a = hammingParams(3);
      const b = hammingParams(7);
      const rows: [string, string, string][] = [
        ['有限體 / p(x)', 'GF(8), x³+x+1', 'GF(128), x⁷+x³+1'],
        ['Hamming', `(${a.n},${a.k},3)`, `(${b.n},${b.k},3)`],
        ['Extended', `(${a.nExt},${a.kExt},4)`, `(${b.nExt},${b.kExt},4)`],
        ['Code Rate', `4/7 ≈ ${(a.rate * 100).toFixed(2)}%`, `120/128 = ${(b.rateExt * 100).toFixed(2)}%（Ext.）`],
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
          <p className="text-lg text-slate-600">400ZR 的內碼是軟判決（Chase）解碼的 double-extended Hamming(128,119)，與本課的硬判決 Syndrome 解碼不同。</p>
        </div>
      );
    },
  },
  {
    title: '2-13 現場實驗',
    sub: '點擊位元注入 0–3 個錯誤',
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
          <li>2 個錯誤：誤更正（Miscorrection）</li>
          <li>3 個錯誤：可能完全未偵測（e ∈ C）</li>
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

function FixedScenario({ initial, max }: { initial: number[]; max: number }) {
  const [errors, setErrors] = useState(initial);
  const o = simulateL2(DEFAULT_U, errors, 'chien');
  return (
    <div className="space-y-3">
      <DecodeReport o={o} method="chien" large onToggle={(i) => setErrors(toggleError(errors, i + 1, max))} />
      <L2Legend />
    </div>
  );
}

function SecdedSlide() {
  const [errors, setErrors] = useState<number[]>([2, 7]);
  const so = simulateSecdedL2(DEFAULT_U, errors);
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
  const [idx, setIdx] = useState(0);
  const [atEnd, setAtEnd] = useState(false);
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [errors, setErrors] = useState<number[]>([2]);
  const [secded, setSecded] = useState(false);
  const [method, setMethod] = useState<L2Method>('chien');
  const [full, setFull] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [exampleKey, setExampleKey] = useState(0);
  const ctx: Ctx = useMemo(() => ({ u, errors, setErrors, secded, method }), [u, errors, secded, method]);

  const go = useCallback((n: number, toEnd = false) => {
    setIdx(Math.max(0, Math.min(SLIDES.length - 1, n)));
    setAtEnd(toEnd);
  }, []);

  const toggleFull = useCallback(() => {
    // fullscreen is optional: some viewers (embedded frames, phones) refuse it
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // scale content to the projector: wider screens get larger content
  useEffect(() => {
    const fit = () => setZoom(Math.max(0.75, Math.min(1.6, Math.min(window.innerWidth / 1280, window.innerHeight / 820))));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const restart = () => setExampleKey((k) => k + 1);

  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-2 bg-slate-900 px-3 py-2 text-white sm:px-5">
        <a href="#/l2-1" className="rounded-lg p-1.5 hover:bg-white/10" title="離開報告模式">
          <X className="h-5 w-5" />
        </a>
        <span className="text-sm font-bold">報告模式</span>
        <span className="font-mono text-xs text-slate-400">
          {idx + 1}/{SLIDES.length}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
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
          <button className="rounded-md p-1.5 hover:bg-white/10" onClick={toggleFull} title="全螢幕 (F)">
            {full ? <Minimize className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
          </button>
        </div>
      </header>
      <SlideHost key={`${idx}-${exampleKey}`} idx={idx} ctx={ctx} startAtEnd={atEnd} zoom={zoom} go={go} toggleFull={toggleFull} />
    </div>
  );
}

/** One slide with its own stepper (re-mounted per slide so frame counts never leak between slides). */
function SlideHost({ idx, ctx, startAtEnd, zoom, go, toggleFull }: { idx: number; ctx: Ctx; startAtEnd: boolean; zoom: number; go: (n: number, toEnd?: boolean) => void; toggleFull: () => void }) {
  const slide = SLIDES[idx];
  const total = slide.steps(ctx);
  const s = useStepper(total, { interval: 1100, initial: startAtEnd ? total - 1 : 0 });

  const forward = useCallback(() => {
    if (s.step < total - 1) s.next();
    else if (idx < SLIDES.length - 1) go(idx + 1);
  }, [s, total, idx, go]);
  const back = useCallback(() => {
    if (s.step > 0) s.prev();
    else if (idx > 0) go(idx - 1, true);
  }, [s, idx, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        forward();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        back();
      } else if (e.key === 'p' || e.key === 'P') s.toggle();
      else if (e.key === 'f' || e.key === 'F') toggleFull();
      else if (e.key === 'Home') go(0);
      else if (e.key === 'End') go(SLIDES.length - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [forward, back, s, toggleFull, go]);

  return (
    <>
      <main className="flex-1 overflow-x-hidden">
        <div style={{ zoom }} className="mx-auto max-w-[1240px] px-4 py-6 sm:px-8">
          <motion.section initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{slide.title}</h1>
            {slide.sub && <p className="mt-1 text-lg text-slate-500">{slide.sub}</p>}
            <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">{slide.render(s, ctx)}</div>
          </motion.section>
        </div>
      </main>
      <footer className="sticky bottom-0 z-30 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-2 backdrop-blur sm:px-5">
        <button className="btn-ghost !px-4 !py-2 text-base" onClick={back} disabled={idx === 0 && s.step === 0}>
          <ChevronLeft className="h-5 w-5" /> 上一步
        </button>
        <button className="btn-ghost !px-4 !py-2 text-base" onClick={s.toggle} disabled={total <= 1} aria-pressed={s.playing}>
          {s.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          {s.playing ? '暫停' : '播放'}
        </button>
        <button className="btn-primary !px-4 !py-2 text-base" onClick={forward} disabled={idx === SLIDES.length - 1 && s.step >= total - 1}>
          下一步 <ChevronRight className="h-5 w-5" />
        </button>
        <span className="ml-1 font-mono text-sm text-slate-500">
          步驟 {s.step + 1}/{total}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {SLIDES.map((sl, k) => (
            <button key={k} onClick={() => go(k)} title={sl.title} className={`h-2.5 rounded-full transition-all ${k === idx ? 'w-6 bg-slate-900' : 'w-2.5 bg-slate-300 hover:bg-slate-500'}`} aria-label={`第 ${k + 1} 頁：${sl.title}`} />
          ))}
        </div>
        <span className="hidden items-center gap-1 text-xs text-slate-400 lg:flex">
          <Keyboard className="h-3.5 w-3.5" /> ← → 空白 · P · F
        </span>
      </footer>
    </>
  );
}
