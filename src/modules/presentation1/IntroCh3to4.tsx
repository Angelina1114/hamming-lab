import type { ReactNode } from 'react';
import {
  type Bit,
  G74,
  H74,
  LAYOUT_74,
  codewords74,
  column,
  correctionCapability,
  detectionCapability,
  differingPositions,
  isZeroVector,
  minimumDistance,
  parseBits,
  unitVector,
  vecAdd,
  vecEquals,
  weight,
  weightDistribution,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { MatrixView, ColumnVector } from '../../components/MatrixView';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';

/* ------------------------------------------------------------------ */
/* Shared pieces                                                      */
/* ------------------------------------------------------------------ */

/** Keeps its place from the first step (so the slide never reflows) and fades in at its step. */
function Reveal({ on, className = '', children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <div aria-hidden={!on} className={`transition-opacity duration-500 ${on ? 'opacity-100' : 'invisible opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

function Box({ tone, title, children }: { tone: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className={`h-full rounded-2xl p-4 ${tone}`}>
      <div className="mb-2 text-xl font-bold">{title}</div>
      {children}
    </div>
  );
}

const N = LAYOUT_74.length;
const POSITIONS = LAYOUT_74.map((p) => p.position);
const CHECK_ROWS = ['P1', 'P2', 'P4'];
const CODE = codewords74();
const WORDS = CODE.map((x) => x.codeword);

/** column h_j of H for a 1-based position j */
const h = (j: number): Bit[] => column(H74, j - 1);
const bits = (v: readonly Bit[]) => v.join('');

/** a lightest non-zero codeword: positions 1, 2, 3 (why d_min = 3) */
const TRIPLE = [1, 2, 3];
const TRIPLE_SUM = TRIPLE.map(h).reduce((a, b) => vecAdd(a, b));
const TRIPLE_WORD = TRIPLE.map((j) => unitVector(N, j - 1)).reduce((a, b) => vecAdd(a, b));
const TRIPLE_ENTRY = CODE.find((x) => vecEquals(x.codeword, TRIPLE_WORD));
const TRIPLE_G_ROW = G74.findIndex((row) => vecEquals(row, TRIPLE_WORD));

/* ------------------------------------------------------------------ */
/* 第 4 章：Hamming 距離與最小距離                                      */
/* ------------------------------------------------------------------ */

const MD = minimumDistance(WORDS);
const NONZERO = WORDS.filter((w) => weight(w) > 0);
const MIN_WEIGHT = Math.min(...NONZERO.map(weight));
const WEIGHTS = weightDistribution(WORDS, N);

/** the distance example of the Distance page */
const X = parseBits('1011101');
const Y = parseBits('1001001');
const XY = vecAdd(X, Y);
const DIFF = differingPositions(X, Y);

/** c and c′ at distance 3; r₁ is one flip away from c (1 error), r₂ two flips away (2 errors) */
function NearestPicture() {
  const xs = [24, 104, 184, 264];
  const labels = [
    { x: xs[0], t: 'c', u: ['送出'], color: '#1f43b8' },
    { x: xs[1], t: 'r₁', u: ['錯 1 個'], color: '#be123c' },
    { x: xs[2], t: 'r₂', u: ['錯 2 個'], color: '#be123c' },
    { x: xs[3], t: 'c′', u: ['另一個', 'codeword'], color: '#622ab8' },
  ];
  return (
    <svg viewBox="0 0 300 118" className="my-2 w-full" role="img" aria-label="c 與 c′ 相距 3；r₁ 離 c 一步、離 c′ 兩步；r₂ 離 c 兩步、離 c′ 一步">
      <path d={`M${xs[0]} 26 V18 H${xs[3]} V26`} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      <text x={(xs[0] + xs[3]) / 2} y={13} textAnchor="middle" fontSize={14} fill="#475569">
        d(c, c′) = 3
      </text>
      <line x1={xs[0]} x2={xs[3]} y1={50} y2={50} stroke="#cbd5e1" strokeWidth={2} />
      {[0, 1, 2].map((k) => (
        <text key={k} x={(xs[k] + xs[k + 1]) / 2} y={43} textAnchor="middle" fontSize={12} fill="#94a3b8">
          1
        </text>
      ))}
      <circle cx={xs[0]} cy={50} r={10} fill="#3b6cf6" />
      <circle cx={xs[1]} cy={50} r={8} fill="#fff1f2" stroke="#e11d48" strokeWidth={2} />
      <circle cx={xs[2]} cy={50} r={8} fill="#fff1f2" stroke="#e11d48" strokeWidth={2} />
      <circle cx={xs[3]} cy={50} r={10} fill="#8b55f0" />
      {labels.map((l) => (
        <g key={l.t}>
          <text x={l.x} y={80} textAnchor="middle" fontSize={16} fontStyle="italic" fontWeight={700} fill={l.color}>
            {l.t}
          </text>
          {l.u.map((line, i) => (
            <text key={line} x={l.x} y={99 + 15 * i} textAnchor="middle" fontSize={13} fill="#64748b">
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

function DistanceIdeaSlide({ s }: { s: Stepper }) {
  const rows: [string, Bit[]][] = [
    ['x', X],
    ['y', Y],
    ['x + y', XY],
  ];
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-slate-50" title="距離與重量">
          <p>
            <strong>Hamming 距離</strong> <M>{'d(x,y)'}</M>：x、y 有幾個位置不同。
          </p>
          <p className="mt-1">
            <strong>重量</strong> <M>{'\\mathrm{wt}(x)'}</M>：x 裡有幾個 1。
          </p>
          <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
            {rows.map(([name, v], k) => (
              <div key={name} className="contents">
                <span className="text-right font-serif italic text-slate-500">{name}</span>
                <span className={`font-mono text-2xl tracking-[0.2em] ${k === 2 ? 'border-t border-slate-300 pt-1' : ''}`}>
                  {v.map((b, i) => (
                    <span key={i} className={DIFF.includes(i) ? 'font-bold text-fuchsia-600' : ''}>
                      {b}
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
          <Tex block>{`d(x,y) = \\mathrm{wt}(x+y) = ${weight(XY)}`}</Tex>
          <p className="text-slate-600">相同得 0、不同得 1（1 + 1 = 0）：x + y 的 1 就是不同的位置。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-sky-50" title={<span className="text-sky-900">最近 codeword 解碼</span>}>
          <p>收到 r，就猜離 r 最近的 codeword（錯得少比錯得多常見）。</p>
          <NearestPicture />
          <ul className="space-y-1 text-slate-600">
            <li>
              錯 1 個（<M>{'r_1'}</M>）：離 c 是 1，離 c′ 至少 <span className="whitespace-nowrap">3 − 1 = 2</span> → 仍是 c 最近。
            </li>
            <li>
              錯 2 個（<M>{'r_2'}</M>）：離 c′ 只有 1、離 c 有 2 → 被拉到 c′，即第 3 章的誤更正。
            </li>
          </ul>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box
          tone="bg-amber-50"
          title={
            <span className="text-amber-900">
              最小距離 <M>{'d_{\\min}'}</M>
            </span>
          }
        >
          <Tex block>{"d_{\\min} = \\min_{c \\neq c'} d(c, c')"}</Tex>
          <p>最接近的那一對最容易被錯誤混淆：整個 code 的保證能力由它決定。</p>
          <p className="mt-2 border-t border-amber-200 pt-2 text-slate-600">
            線性碼的捷徑：<M>{"d(c,c') = \\mathrm{wt}(c+c')"}</M>，而 <M>{"c+c'"}</M> 也是非零 codeword ⇒ <M>{'d_{\\min}'}</M> = 最小的非零 codeword 重量。Hamming(7,4)：不必比 {MD.pairsChecked} 對，看 {NONZERO.length} 個非零 codeword，最小重量 = {MIN_WEIGHT}。
          </p>
        </Box>
      </Reveal>
    </div>
  );
}

function DminFromHSlide({ s }: { s: Stepper }) {
  const t = correctionCapability(MD.dmin);
  const det = detectionCapability(MD.dmin);
  const claims: { step: number; w: number; ok: boolean; body: ReactNode }[] = [
    {
      step: 0,
      w: 1,
      ok: false,
      body: (
        <>
          沒有全 0 的欄，所以 <M>{'h_j \\neq 0'}</M>
        </>
      ),
    },
    {
      step: 1,
      w: 2,
      ok: false,
      body: (
        <>
          沒有兩欄相同，所以 <M>{'h_i + h_j \\neq 0'}</M>
        </>
      ),
    },
    {
      step: 2,
      w: 3,
      ok: isZeroVector(TRIPLE_SUM) && !!TRIPLE_ENTRY,
      body: (
        <>
          <M>{`h_${TRIPLE[0]} + h_${TRIPLE[1]} + h_${TRIPLE[2]} = 0`}</M>
        </>
      ),
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-slate-50" title="最小的非零重量是多少？">
          <p className="text-slate-600">
            <M>{'Hc^{T}'}</M> 就是把 c 裡「是 1 的位置」那幾欄加起來。所以<strong className="text-slate-900">有重量 w 的 codeword ⇔ H 有 w 欄加起來 = 0</strong>。
          </p>
          <div className="mt-3 space-y-2">
            {claims.map((c) => (
              <Reveal key={c.w} on={s.step >= c.step}>
                <div className={`rounded-xl border-l-4 bg-white px-3 py-2 ${c.ok ? 'border-emerald-500' : 'border-rose-400'}`}>
                  <strong className={c.ok ? 'text-emerald-700' : 'text-rose-700'}>
                    重量 {c.w}：{c.ok ? '存在' : '不可能'}
                  </strong>
                  <br />
                  {c.body}
                </div>
              </Reveal>
            ))}
          </div>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 0}>
        <Box tone="bg-sky-50" title={<span className="text-sky-900">H 的 7 欄</span>}>
          <div className="flex justify-center">
            <MatrixView
              matrix={H74}
              name="H"
              colLabels={POSITIONS}
              rowLabels={CHECK_ROWS}
              cellClass={(_i, j) => (s.step >= 2 && TRIPLE.includes(j + 1) ? 'bg-emerald-100 text-emerald-800' : undefined)}
            />
          </div>
          <Reveal on={s.step >= 2} className="mt-2">
            <div className="flex items-center justify-center gap-2 text-xl">
              <ColumnVector bits={h(TRIPLE[0])} size="sm" />
              <span>+</span>
              <ColumnVector bits={h(TRIPLE[1])} size="sm" />
              <span>+</span>
              <ColumnVector bits={h(TRIPLE[2])} size="sm" />
              <span>=</span>
              <ColumnVector bits={TRIPLE_SUM} size="sm" cellClass="bg-emerald-100 text-emerald-800" />
            </div>
            <p className="mt-2">
              所以 <span className="mono font-bold">{bits(TRIPLE_WORD)}</span> 是 codeword
              {TRIPLE_ENTRY && <>（m = {bits(TRIPLE_ENTRY.message)}{TRIPLE_G_ROW >= 0 && <>，即 G 的第 {TRIPLE_G_ROW + 1} 列</>}）</>}。重量 3 的 codeword 共 {WEIGHTS[3]} 個。
            </p>
          </Reveal>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 3}>
        <Box
          tone="bg-emerald-50"
          title={
            <span className="text-emerald-900">
              結論：<M>{`d_{\\min} = ${MIN_WEIGHT}`}</M>
            </span>
          }
        >
          <p>
            保證<strong>修正</strong> <M>{`t = \\lfloor (${MD.dmin}-1)/2 \\rfloor = ${t}`}</M> 個錯（錯 {t} 個仍離 c 最近）。
          </p>
          <p className="mt-1">
            保證<strong>偵測</strong> <M>{`d_{\\min} - 1 = ${det}`}</M> 個錯（錯 1、2 個時 <M>{'s \\neq 0'}</M>）。
          </p>
          <p className="mt-2 border-t border-emerald-200 pt-2 text-slate-600">
            但兩者不能同時做到：當成修正碼用時，錯 2 個會被誤更正。要「修 1 個、同時偵測 2 個」需要 <M>{'d_{\\min} = 4'}</M>（第 6、7 章）。
          </p>
          <p className="mt-1 text-slate-600">
            窮舉全部 {MD.pairsChecked} 對 codeword，也得到 <M>{`d_{\\min} = ${MD.dmin}`}</M>。
          </p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exports (deck order)                                               */
/* ------------------------------------------------------------------ */

export const INTRO_CH4_SLIDES: DeckSlide<null>[] = [
  {
    title: '第 4 章：Hamming 距離與最小距離',
    sub: '為什麼 Hamming(7,4) 保證修 1 個錯，卻修不了 2 個？',
    steps: () => 3,
    render: (s) => <DistanceIdeaSlide s={s} />,
  },
  {
    title: '第 4 章：從 H 讀出 d_min = 3',
    sub: '最小距離 = 最小的非零 codeword 重量，看 H 的欄就知道',
    steps: () => 4,
    render: (s) => <DminFromHSlide s={s} />,
  },
];
