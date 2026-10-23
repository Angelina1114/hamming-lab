import type { ReactNode } from 'react';
import {
  type Bit,
  DEFAULT_MESSAGE,
  H74,
  K4,
  N7,
  PARITY_CHECKS,
  allVectors,
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
  simulate74,
  vecEquals,
  weight,
  zeroVector,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** 7 positions, 4 data bits, 3 checkers = 3 warning lamps */
const N = N7;
const K = K4;
const R = H74.length;
/** 3 lamps: 2³ states, all dark = nothing to flip, the other 7 each name a position */
const STATES = 2 ** R;
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

/** what the decoder does with every double error (the sent codeword does not matter: s = Heᵀ) */
const TWO = (() => {
  const runs = allVectors(N)
    .filter((e) => weight(e) === 2)
    .map((e) => simulate74(zeroVector(N), e));
  return { total: runs.length, mis: runs.filter((o) => o.miscorrection).length };
})();

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

/** the Hamming family in lamp language, the same rows as the web page */
const FAMILY = [2, 3, 4, 5, 6, 7].map((r) => {
  const n = hammingN(r);
  const k = hammingK(r);
  return { r, states: 2 ** r, n, k, full: hammingBound(n, k, 1).equality };
});
const LONG = FAMILY[FAMILY.length - 1];

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
/** a lamp state as bits in H's row order (P1 first) from its binary value */
const lampBits = (v: number): Bit[] => Array.from({ length: R }, (_, i) => ((v >> i) & 1) as Bit);
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
/* 1. d_min = 3：A 走到 B 要 3 步                                       */
/* ------------------------------------------------------------------ */

/** The walk A → B, split into the half nearer A and the half nearer B. */
function PathFigure() {
  const node = (k: number) => {
    const st = PATH[k];
    const isA = k === 0;
    const isB = k === D_AB;
    const circle = isA ? 'bg-data-500 text-white' : isB ? 'bg-overall-500 text-white' : 'border-2 border-rose-500 bg-white text-rose-600';
    const label = isA ? '送出 A' : isB ? `B（翻 ${k} 位）` : `翻 ${k} 位（位置 ${posList(st.flipped)}）`;
    return (
      <div key={k} className="relative z-10 flex flex-col items-center gap-1">
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
      <PathFigure />
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
          <Box tone="bg-rose-50 text-rose-950" title="翻 2 位：可能跑到 B 那邊">
            <p>
              離 A {STEP2.dA}、離 B {STEP2.dB} → 燈亮，<strong>偵測得到</strong>；硬要更正就改錯。
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
/* 2. 2ʳ ≥ n + 1                                                       */
/* ------------------------------------------------------------------ */

function BoundSlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-sky-50 text-sky-950" title="燈號要分出幾種情況？">
          <p>更正 1 個錯，接收端只看燈號就要分出：</p>
          <ul className="mt-1 space-y-1 text-slate-700">
            <li>· 沒有錯：1 種（不動）</li>
            <li>· 錯在 n 個位置之一：n 種（翻那一位）</li>
          </ul>
          <p className="mt-2">r 盞燈只有 2ʳ 種燈號：</p>
          <div className="text-2xl">
            <Tex block>{'2^{r} \\ge n + 1'}</Tex>
          </div>
          <p className="text-slate-600">這是「更正 1 個錯」的極限。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-amber-50 text-amber-950" title="就是 Hamming Bound（t = 1）">
          <Tex block>{'2^{k}(1 + n) \\le 2^{n}'}</Tex>
          <p>兩邊同除以 2ᵏ：</p>
          <Tex block>{'1 + n \\le 2^{n-k} = 2^{r}'}</Tex>
          <p className="text-slate-600">n − k = 同位位元的個數 = 燈的盞數 r。</p>
          <p className="mt-2">
            Hamming({N},{K})：<M>{`2^{${R}} = ${STATES} = ${N} + 1`}</M>
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-emerald-50 text-emerald-950" title="第 1 章、第 2 章 ③ 見過了">
          <ul className="space-y-1 text-slate-700">
            <li>· 第 1 章：訊息為什麼是 {K} 個位元</li>
            <li>
              · 第 2 章 H 的設計 ③：{R} 盞燈最多分辨 {PATTERNS} 個位置
            </li>
          </ul>
          <table className="mt-2 w-full text-center font-mono">
            <thead>
              <tr className="text-base text-slate-500">
                <th className="py-0.5 font-sans font-normal">r 盞燈</th>
                <th className="font-normal">2ʳ</th>
                <th className="font-normal">n</th>
                <th className="font-normal">k</th>
              </tr>
            </thead>
            <tbody>
              {FAMILY.map((f) => (
                <tr key={f.r} className={`border-t border-emerald-200 ${f.r === R ? 'bg-emerald-100 font-bold' : ''}`}>
                  <td className="py-0.5">{f.r}</td>
                  <td>{f.states}</td>
                  <td>{f.n}</td>
                  <td>{f.k}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. 完美碼：每一種燈號都用到                                          */
/* ------------------------------------------------------------------ */

function PerfectSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4 text-lg">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-sky-50 text-sky-950" title={<>Hamming({N},{K})：<M>{`2^{${R}} = ${STATES} = ${N} + 1`}</M></>}>
          <div className="mt-2 grid grid-cols-4 gap-2 lg:grid-cols-8">
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
        </Box>
      </Reveal>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-emerald-50 text-emerald-950" title="等號成立 = 完美碼">
            <p>
              等號成立：全暗 = 不動，其餘 {PATTERNS} 種各翻一個位置，<strong>沒有一種浪費</strong>。
            </p>
            <p className="mt-1 text-slate-600">
              {HB.codewords} 個 codeword × {HB.volume} 種接收結果 = {HB.lhs} = 2<sup>{N}</sup>
              {IS_PARTITION ? '' : ' ✗'}：收到任何 {N} 位元字串，燈號都有明確的動作。
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-rose-50 text-rose-950" title="代價：沒有燈號能說「錯了兩個」">
            <p>
              翻 2 位：亮的是兩欄之和，不是全暗，就是某個「翻位置 j」→ 照著翻 → 改錯（{TWO.mis}/{TWO.total}）。
            </p>
            <p className="mt-1 font-semibold text-rose-800">→ 第 5 章 SECDED：多 1 個整體同位位元，接收端就能回報「錯了兩個」。</p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

export const CH4_SLIDES: DeckSlide<null>[] = [
  {
    title: `第 4 章：d_min = ${D_MIN}：A 走到 B 要 ${D_AB} 步`,
    sub: '雜訊每翻一位，收到的字就往前推一步',
    steps: () => 4,
    render: (s) => <PathSlide s={s} />,
    takeaway: (
      <>
        <Ph>翻 {T} 位仍離 A 最近，修得回來；</Ph>
        <Ph>翻 2 位只能偵測</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          雜訊每翻一位，收到的字就往前推一步
          <ul className={NOTES_SUB}>
            <li>
              A = m {bits(A_ENTRY.message)} 的 codeword {bits(A)}，B = m {bits(B_ENTRY.message)} 的 codeword {bits(B)}：差 {D_AB} 位（位置 {AB_DIFF.join('、')}）
            </li>
            <li>
              從 A 走到 B：先翻位置 {EXAMPLE_POS}（第 3 章的例子），再翻 {posList(PATH[D_AB].flipped.slice(1))}
            </li>
            <li>接收端看不到雜訊，只能猜「離收到的字最近的 codeword」：翻得少比翻得多常見</li>
          </ul>
        </li>
        <li>
          → 翻 {T} 位：離 A {STEP1.dA}、離 B {STEP1.dB} → 仍是 A 最近 → 修得回來
          <ul className={NOTES_SUB}>
            <li>
              第 3 章的燈號做的就是這件事：燈{lampText(STEP1.dec.syndrome)}，指向位置 {STEP1.dec.position}，翻回來是 A
            </li>
          </ul>
        </li>
        <li>
          → 翻 2 位：離 A {STEP2.dA}、離 B {STEP2.dB} → 跑到 B 那邊
          <ul className={NOTES_SUB}>
            <li>燈會亮：知道有錯（偵測）</li>
            <li>
              硬要更正：燈號指向位置 {STEP2.dec.position} → 改成 B（誤更正）
            </li>
            <li>說「可能」：這條路上是 B；對 Hamming(7,4)，每一種雙錯其實都會落在別人旁邊（網頁進階）</li>
          </ul>
        </li>
        <li>
          → d_min = {D_MIN}：窮舉 {MD.pairsChecked} 對，最近的一對也差 {D_MIN} 位
          <ul className={NOTES_SUB}>
            <li>
              任何 codeword 翻 {T} 位都還在自己這一側：t = ⌊({D_MIN} − 1)/2⌋ = {T}
            </li>
            <li>第 2 章 H 的設計 ①② 保證 d_min ≥ 3：翻 1、2 位燈一定亮，不可能變成另一個 codeword</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 4 章：2ʳ ≥ n + 1：r 盞燈要分辨 n + 1 種情況',
    sub: `要更正 1 個錯，${R} 盞燈能保護多長？`,
    steps: () => 3,
    render: (s) => <BoundSlide s={s} />,
    takeaway: (
      <>
        <Ph>更正 1 個錯：</Ph>
        <Ph>r 盞燈的 2ʳ 種燈號 ≥ n + 1 種情況</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          要更正 1 個錯，接收端得只看燈號，分出 n + 1 種情況
          <ul className={NOTES_SUB}>
            <li>沒錯 1 種（不動）＋錯在 n 個位置之一（翻那一位）</li>
            <li>r 盞燈只有 2ʳ 種狀態 → 2ʳ ≥ n + 1</li>
            <li>這只是「更正 1 個錯」的極限；要更正更多錯，情況更多（網頁進階）</li>
          </ul>
        </li>
        <li>
          → 和教科書的 Hamming Bound 是同一條
          <ul className={NOTES_SUB}>
            <li>2ᵏ(1 + n) ≤ 2ⁿ，兩邊同除以 2ᵏ → 1 + n ≤ 2ⁿ⁻ᵏ = 2ʳ</li>
            <li>
              Hamming({N},{K})：2<sup>{R}</sup> = {STATES} = {N} + 1，剛好相等
            </li>
          </ul>
        </li>
        <li>
          → 不是新概念，前面已經講過兩次
          <ul className={NOTES_SUB}>
            <li>第 1 章「為什麼訊息是 {K} 個位元？」：{R} 個同位位元 {PATTERNS} 種結果剛好用滿</li>
            <li>
              第 2 章 H 的設計 ③：{R} 盞燈最多分辨 {PATTERNS} 個位置
            </li>
            <li>
              多 1 盞燈 → {hammingN(R + 1)} 個位置；{LONG.r} 盞 → {LONG.n} 個
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 4 章：完美碼：每一種燈號都用到',
    sub: `Hamming(${N},${K})：${STATES} = ${N} + 1，等號成立`,
    steps: () => 3,
    render: (s) => <PerfectSlide s={s} />,
    takeaway: (
      <>
        <Ph>{STATES} 種燈號全部用到：</Ph>
        <Ph>沒有一種留給「錯了兩個」</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          Hamming({N},{K})：2<sup>{R}</sup> = {STATES} = {N} + 1，等號成立
          <ul className={NOTES_SUB}>
            <li>
              {STATES} 種燈號：全暗 = 不動，其餘 {PATTERNS} 種各翻一個位置
            </li>
          </ul>
        </li>
        <li>
          → 完美碼：每一種燈號都用到，沒有浪費
          <ul className={NOTES_SUB}>
            <li>
              {HB.codewords} 個 codeword × {HB.volume} 種接收結果 = {HB.lhs} = 2<sup>{N}</sup>：收到任何字串都有明確動作
            </li>
          </ul>
        </li>
        <li>
          → 代價：沒有一種燈號能說「錯了兩個」
          <ul className={NOTES_SUB}>
            <li>
              翻 2 位：燈號 = 兩欄之和，一定是某個「翻位置 j」→ 照翻 → 改錯（{TWO.mis}/{TWO.total}）
            </li>
            <li>第 5 章 SECDED：多 1 個整體同位位元，接收端就能回報「錯了兩個」</li>
          </ul>
        </li>
      </ul>
    ),
  },
];
