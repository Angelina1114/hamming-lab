import type { ReactNode } from 'react';
import {
  type Bit,
  DEFAULT_MESSAGE,
  H74,
  K4,
  N7,
  PARITY_CHECKS,
  codewords74,
  correctionCapability,
  decode74,
  differingPositions,
  flipPath,
  hammingBound,
  hammingDistance,
  hammingK,
  hammingN,
  isZeroVector,
  matchingColumn,
  minimumDistance,
  partitionByNearest,
  vecEquals,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** 7 positions, 4 data bits, ℓ = 3 parity bits = 3 warning lamps */
const N = N7;
const K = K4;
const L = H74.length;
/** 3 lamps: 2³ states, all dark = nothing to flip, the other 7 each name a position */
const STATES = 2 ** L;
const PATTERNS = STATES - 1;

const CODE = codewords74();
const WORDS = CODE.map((x) => x.codeword);
const MD = minimumDistance(WORDS);
const D_MIN = MD.dmin;
/** the guaranteed correction capability ⌊(d_min − 1)/2⌋ */
const T = correctionCapability(D_MIN);
/** the bound for Hamming(7,4): 16 codewords × 8 received words = 128 = 2⁷, every word exactly once */
const HB = hammingBound(N, K, T);
const IS_PARTITION = partitionByNearest(WORDS, N).isPartition;

/** chapter 3's running example: the noise flips position 5 first */
const EXAMPLE_POS = 5;
/** the A → B path, as on the web page: A = codeword of the default message, B = codeword of 1111 (pinned in core.test) */
const A_ENTRY = CODE.find((e) => vecEquals(e.message, DEFAULT_MESSAGE)) ?? CODE[0];
const B_ENTRY = CODE.find((e) => e.message.every((b) => b === 1)) ?? CODE[CODE.length - 1];
const A = A_ENTRY.codeword;
const B = B_ENTRY.codeword;
const D_AB = hammingDistance(A, B);
const AB_DIFF = differingPositions(A, B).map((i) => i + 1);
const PATH = flipPath(A, B, [EXAMPLE_POS - 1]).map((st) => {
  const dec = decode74(st.word);
  return { ...st, dA: hammingDistance(st.word, A), dB: hammingDistance(st.word, B), dec };
});
const STEP1 = PATH[1];
const STEP2 = PATH[2];
const STEP1_TO_A = vecEquals(STEP1.dec.corrected, A);
const STEP2_TO_B = vecEquals(STEP2.dec.corrected, B);

/** the Hamming family in lamp language (ℓ lamps → n = 2^ℓ − 1 positions), the same rows as the web page */
const FAMILY = [2, 3, 4, 5, 6, 7].map((l) => ({ l, n: hammingN(l), k: hammingK(l) }));

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
/** a lamp state as bits in H's row order (P1 first) from its binary value */
const lampBits = (v: number): Bit[] => Array.from({ length: L }, (_, i) => ((v >> i) & 1) as Bit);
const posList = (idx: readonly number[]) => idx.map((i) => i + 1).join('、');
const bits = (v: readonly Bit[]) => v.join('');

/* ------------------------------------------------------------------ */
/* Shared pictures                                                     */
/* ------------------------------------------------------------------ */

/** The receiver's warning lamps in H's row order (P1, P2, P4): lit = that checker sees an odd number of 1s. */
function Lamps({ bits: b, size = 'md' }: { bits: readonly Bit[]; size?: 'sm' | 'md' }) {
  const d = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  return (
    <span className="inline-flex items-end gap-2 align-middle" role="img" aria-label={`警示燈${lampText(b)}`}>
      {b.map((v, i) => (
        <span key={LAMP[i]} className="inline-flex flex-col items-center gap-0.5">
          <span className={`${d} rounded-full border-2 ${v ? 'border-rose-500 bg-rose-400 shadow-[0_0_10px_3px_rgba(244,63,94,0.45)]' : 'border-slate-300 bg-slate-200'}`} />
          <span className="text-sm font-semibold leading-none text-slate-500">{LAMP[i]}</span>
        </span>
      ))}
    </span>
  );
}

/** a 7-bit word in a monospace run; the flipped positions in red */
function Word({ bits: b, flipped = [] }: { bits: readonly Bit[]; flipped?: readonly number[] }) {
  return (
    <span className="font-mono text-2xl font-bold tracking-[0.12em]">
      {b.map((v, i) => (
        <span key={i} className={flipped.includes(i) ? 'text-rose-600' : undefined}>
          {v}
        </span>
      ))}
    </span>
  );
}

/** a phrase of a takeaway that never breaks in the middle (the header box only fits ~17 characters a line) */
const Ph = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

/* ------------------------------------------------------------------ */
/* 1. 最小距離 3：A 走到 B 要 3 步                                       */
/* ------------------------------------------------------------------ */

/** The walk A → B, split into the half nearer A and the half nearer B; the in-between words appear one step at a time. */
function PathFigure({ step }: { step: number }) {
  const node = (k: number) => {
    const st = PATH[k];
    const isA = k === 0;
    const isB = k === D_AB;
    const shown = isA || isB || k <= step;
    const circle = isA ? 'bg-data-500 text-white' : isB ? 'bg-overall-500 text-white' : 'border-2 border-rose-500 bg-white text-rose-600';
    const label = isA ? '送出 A' : isB ? `B（翻 ${k} 位）` : `翻 ${k} 位（位置 ${posList(st.flipped)}）`;
    return (
      <div key={k} aria-hidden={!shown} className={`relative z-10 flex flex-col items-center gap-1 transition-opacity duration-500 ${shown ? 'opacity-100' : 'invisible opacity-0'}`}>
        <span className={`grid h-9 w-9 place-items-center rounded-full text-lg font-bold ${circle}`}>{isA ? 'A' : isB ? 'B' : k}</span>
        <span className="text-lg font-semibold text-slate-700">{label}</span>
        <Word bits={st.word} flipped={st.flipped} />
        <span className="text-lg text-slate-600">
          離 A <strong className={st.dA < st.dB ? 'text-data-700' : 'font-normal'}>{st.dA}</strong>・離 B <strong className={st.dB < st.dA ? 'text-overall-700' : 'font-normal'}>{st.dB}</strong>
        </span>
      </div>
    );
  };
  const nearA = PATH.flatMap((st, k) => (st.dA < st.dB ? [k] : []));
  const nearB = PATH.flatMap((st, k) => (st.dB < st.dA ? [k] : []));
  return (
    <div className="relative grid grid-cols-2 gap-3">
      <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[3.1rem] h-0.5 bg-slate-300" aria-hidden />
      <div className="rounded-2xl bg-data-50/80 px-2 pb-2 pt-1.5">
        <div className="mb-1 text-center text-base font-semibold text-data-700">離 A 比較近</div>
        <div className="grid grid-cols-2">{nearA.map(node)}</div>
      </div>
      <div className="rounded-2xl bg-overall-50/80 px-2 pb-2 pt-1.5">
        <div className="mb-1 text-center text-base font-semibold text-overall-700">離 B 比較近</div>
        <div className="grid grid-cols-2">{nearB.map(node)}</div>
      </div>
    </div>
  );
}

function PathSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4 text-lg">
      <PathFigure step={s.step} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-emerald-50 text-emerald-950" title={`翻 ${T} 位：仍離 A 最近`}>
            <p>
              離 A {STEP1.dA}、離 B {STEP1.dB} → 接收端猜 A，<strong>修得回來</strong>。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Lamps bits={STEP1.dec.syndrome} size="sm" />
              <span>
                → 翻位置 {STEP1.dec.position} → {STEP1_TO_A ? 'A ✓' : bits(STEP1.dec.corrected)}
              </span>
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-rose-50 text-rose-950" title="翻 2 位：過了中線">
            <p>
              離 A {STEP2.dA}、離 B {STEP2.dB} → 燈會亮，<strong>只能偵測</strong>；硬要更正就改成 B。
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Lamps bits={STEP2.dec.syndrome} size="sm" />
              <span>
                → 翻位置 {STEP2.dec.position} → {STEP2_TO_B ? 'B ✗' : bits(STEP2.dec.corrected)}
              </span>
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 3}>
          <Box tone="bg-sky-50 text-sky-950" title={<M>{`d_{\\min} = ${D_MIN}`}</M>}>
            <p>
              窮舉 {MD.pairsChecked} 對 codeword：最近的一對也差 {D_MIN} 位。任何 codeword 翻 {T} 位，都還在自己這一側：
            </p>
            <Tex block>{`t = \\left\\lfloor \\tfrac{${D_MIN}-1}{2} \\right\\rfloor = ${T}`}</Tex>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 2^ℓ ≥ n + 1 與完美碼                                              */
/* ------------------------------------------------------------------ */

function PerfectSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4 text-lg">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-sky-50 text-sky-950" title="燈號要分出 n + 1 種情況">
            <p>更正 1 個錯，接收端只看燈號就要分出：</p>
            <ul className="mt-1 space-y-1 text-slate-700">
              <li>· 沒有錯：1 種（不動）</li>
              <li>· 錯在 n 個位置之一：n 種（翻那一位）</li>
            </ul>
            <p className="mt-2">
              ℓ 個 parity bit = ℓ 盞警示燈，只有 <M>{'2^{\\ell}'}</M> 種亮法：
            </p>
            <div className="text-2xl">
              <Tex block>{'2^{\\ell} \\ge n + 1'}</Tex>
            </div>
            <p className="text-slate-600">這是「更正 1 個錯」的極限。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box
            tone="bg-emerald-50 text-emerald-950"
            title={
              <>
                Hamming({N},{K})：<M>{`2^{${L}} = ${STATES} = ${N} + 1`}</M>，等號成立
              </>
            }
          >
            <div className="mt-2 grid grid-cols-4 gap-2">
              {Array.from({ length: STATES }, (_, v) => {
                const b = lampBits(v);
                const owner = matchingColumn(b) + 1;
                return (
                  <div key={v} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-white px-1 py-2 ${owner === 0 ? 'border-emerald-300' : 'border-slate-200'}`}>
                    <Lamps bits={b} size="sm" />
                    <span className="text-base font-semibold text-slate-700">{owner === 0 ? '不動' : `翻位置 ${owner}`}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-2">
              {STATES} 種燈號全部用到，沒有一種浪費：<strong>perfect code（完美碼）</strong>。
            </p>
            <p className="mt-1 text-slate-600">
              {HB.codewords} 個 codeword × {HB.volume} 種接收結果 = {HB.lhs} = 2<sup>{N}</sup>
              {IS_PARTITION ? '' : ' ✗'}：收到任何 {N} 位元字串，燈號都有明確的動作。這就是教科書的 Hamming bound（球填充界）<M>{'2^{k}(1 + n) \\le 2^{n}'}</M> 取等號。
            </p>
          </Box>
        </Reveal>
      </div>
      <Reveal on={s.step >= 2}>
        <p className="rounded-2xl bg-rose-50 px-4 py-3 font-semibold text-rose-900">
          → 代價：{STATES} 種燈號都有主人，沒有一種留給「錯了兩個」。第 5 章多一盞燈。
        </p>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

export const CH4_SLIDES: DeckSlide<null>[] = [
  {
    title: `第 4 章：Minimum distance（最小距離）為 ${D_MIN}：A 走到 B 要 ${D_AB} 步`,
    sub: '雜訊每翻一位，received word 就往前推一步',
    steps: () => 4,
    render: (s) => <PathSlide s={s} />,
    takeaway: (
      <>
        <Ph>翻 {T} 位修得回來；</Ph>
        <Ph>翻 2 位燈會亮，</Ph>
        <Ph>但一更正就改成 B</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          雜訊每翻一位，received word 就往前推一步
          <ul className={NOTES_SUB}>
            <li>
              A = 訊息 {bits(A_ENTRY.message)} 的 codeword，B = 訊息 {bits(B_ENTRY.message)} 的 codeword：差 {D_AB} 位（位置 {AB_DIFF.join('、')}）
            </li>
            <li>接收端看不到雜訊，只能猜「離 received word 最近的 codeword」：翻得少比翻得多常見</li>
          </ul>
        </li>
        <li>
          → 翻 {T} 位（位置 {EXAMPLE_POS}，第 3 章的例子）：離 A {STEP1.dA}、離 B {STEP1.dB} → 仍是 A 最近 → 修得回來
          <ul className={NOTES_SUB}>
            <li>
              燈{lampText(STEP1.dec.syndrome)}，指向位置 {STEP1.dec.position}，翻回來是 A
            </li>
          </ul>
        </li>
        <li>
          → 翻 2 位（再翻位置 {posList(STEP2.flipped.slice(1))}）：離 A {STEP2.dA}、離 B {STEP2.dB} → 過了中線
          <ul className={NOTES_SUB}>
            <li>
              只偵測：燈會亮，知道有錯；硬要更正：燈號指向位置 {STEP2.dec.position} → 改成 B（miscorrection）
            </li>
            <li>對 Hamming({N},{K})，每一種雙錯都會落在別人旁邊（網頁進階）</li>
          </ul>
        </li>
        <li>
          → minimum distance {D_MIN}：窮舉 {MD.pairsChecked} 對，最近的一對也差 {D_MIN} 位
          <ul className={NOTES_SUB}>
            <li>
              t = ⌊({D_MIN} − 1)/2⌋ = {T}；第 2 章 H 的設計 ①② 保證至少 {D_MIN} 步：翻 1、2 位燈一定亮
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 4 章：Perfect code：${STATES} 種燈號剛好用完`,
    sub: '要更正 1 個錯，ℓ 盞燈要分辨 n + 1 種情況',
    steps: () => 3,
    render: (s) => <PerfectSlide s={s} />,
    takeaway: (
      <>
        <Ph>
          <M>{'2^{\\ell} \\ge n + 1'}</M>；
        </Ph>
        <Ph>
          ({N},{K}) 等號成立，
        </Ph>
        <Ph>{STATES} 種燈號沒有浪費</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          要更正 1 個錯，接收端只看燈號就要分出 n + 1 種情況
          <ul className={NOTES_SUB}>
            <li>沒錯 1 種（不動）＋錯在 n 個位置之一（翻那一位）</li>
            <li>
              ℓ 個 parity bit = ℓ 盞燈，只有 2<sup>ℓ</sup> 種狀態 → 2<sup>ℓ</sup> ≥ n + 1（ℓ = n − k）
            </li>
            <li>
              導論（要幾個 parity bit）、第 2 章 H 的設計 ③ 見過同一件事：ℓ = {FAMILY.map((f) => f.l).join(', ')} → n = {FAMILY.map((f) => f.n).join(', ')}（k = {FAMILY.map((f) => f.k).join(', ')}）
            </li>
          </ul>
        </li>
        <li>
          → Hamming({N},{K})：2<sup>{L}</sup> = {STATES} = {N} + 1，等號成立 = perfect code
          <ul className={NOTES_SUB}>
            <li>
              全暗 = 不動，其餘 {PATTERNS} 種各翻一個位置
            </li>
            <li>
              {HB.codewords} × {HB.volume} = {HB.lhs} = 2<sup>{N}</sup>：教科書的 Hamming bound 2<sup>k</sup>(1 + n) ≤ 2<sup>n</sup> 取等號
            </li>
          </ul>
        </li>
        <li>→ 代價：沒有一種燈號留給「錯了兩個」→ 第 5 章多一盞燈</li>
      </ul>
    ),
  },
];
