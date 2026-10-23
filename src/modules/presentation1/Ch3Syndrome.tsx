import { useState, type ReactNode } from 'react';
import {
  type Bit,
  H74,
  LAYOUT_74,
  N7,
  PARITY_CHECKS,
  allVectors,
  codewords74,
  column,
  correctionCapability,
  decode74,
  encode74,
  hammingSyndromeXors,
  isCodeword74,
  isZeroVector,
  matchingColumn,
  matrixToTex,
  minimumDistance,
  simulate74,
  syndrome74,
  syndromeToPosition,
  unitVector,
  vecAdd,
  vecEquals,
  weight,
  zeroVector,
} from '../../core';
import { useMessage } from '../../lib/store';
import { M, Tex } from '../../components/Tex';
import { BitRow } from '../../components/Bits';
import { MatrixView, ColumnVector } from '../../components/MatrixView';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** 7 positions, 3 checkers = 3 warning lamps */
const N = N7;
const R = H74.length;
/** 3 lamps: 2³ states = the outputs of the 3-to-8 decoder; all but "all dark" name a position */
const STATES = 2 ** R;
const PATTERNS = STATES - 1;
/** the syndrome circuit (one XOR tree per lamp) and the flip stage (one XOR gate per position) */
const SYNDROME_XORS = hammingSyndromeXors(R);
const FLIP_XORS = N;

const CODE = codewords74();
const WORDS = CODE.map((x) => x.codeword);
const D_MIN = minimumDistance(WORDS).dmin;
/** the guaranteed correction capability ⌊(d_min − 1)/2⌋ */
const T = correctionCapability(D_MIN);

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
const POSITIONS = LAYOUT_74.map((p) => p.position);
/** reading the lamps as a binary number: P4 P2 P1, the most significant first */
const READ = [...LAMP.keys()].reverse();
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
const binText = (bits: readonly Bit[]) => `${READ.map((i) => bits[i]).join('')}₂`;
/** a lamp state as bits in H's row order (P1 first) from its binary value */
const lampBits = (v: number): Bit[] => Array.from({ length: R }, (_, i) => ((v >> i) & 1) as Bit);

/** column h_j of H for a 1-based position j */
const h = (j: number): Bit[] => column(H74, j - 1);
/** column vector as a KaTeX bmatrix */
const colTex = (v: readonly Bit[]) => matrixToTex(v.map((b) => [b]));
const bits = (v: readonly Bit[]) => v.join('');
/** the lamps as a labelled vector, named after the lamps: (s₁, s₂, s₄) = (1, 0, 1) */
const SUB_DIGIT: Record<string, string> = { '1': '₁', '2': '₂', '4': '₄' };
const lampVec = (v: readonly Bit[]) => `(${LAMP.map((l) => `s${SUB_DIGIT[l.slice(1)]}`).join(', ')}) = (${v.join(', ')})`;
const lampVecTex = (v: readonly Bit[]) => `(${LAMP.map((l) => `s_${l.slice(1)}`).join(', ')}) = (${v.join(', ')})`;
/** position j from the lamps: j = s₁ + 2s₂ + 4s₄ */
const POS_TEX = LAMP.map((l, i) => `${i ? `${2 ** i}` : ''}s_${l.slice(1)}`).join(' + ');

/**
 * What the syndrome decoder does with every error pattern of weight w.
 * The outcome never depends on which codeword was sent (s = Heᵀ, and the decoder adds back e_s),
 * so the all-zero codeword stands in for all 16.
 */
function decoderOutcomes(w: number) {
  const sent = zeroVector(N);
  const runs = allVectors(N)
    .filter((e) => weight(e) === w)
    .map((e) => simulate74(sent, e));
  return {
    total: runs.length,
    ok: runs.filter((o) => o.success).length,
    mis: runs.filter((o) => o.miscorrection).length,
    undetected: runs.filter((o) => o.undetected).length,
  };
}
const ONE = decoderOutcomes(1);
const TWO = decoderOutcomes(2);
const THREE = decoderOutcomes(3);

/** the running example of the chapter: noise flips position 5 (D2), as on the Syndrome page */
const EXAMPLE_POS = 5;
const EXAMPLE_E = unitVector(N, EXAMPLE_POS - 1);
const EXAMPLE_COL = h(EXAMPLE_POS);
/** the same noise on every codeword lights the same lamps */
const SAME_LAMPS = WORDS.filter((w) => vecEquals(syndrome74(vecAdd(w, EXAMPLE_E)), EXAMPLE_COL)).length;

/** two-error example: the running position 5 plus position 1 (the pair chapters 4 and 5 use) light the column of a third position */
const PAIR: [number, number] = [EXAMPLE_POS, 1];
const PAIR_SUM = vecAdd(h(PAIR[0]), h(PAIR[1]));
const PAIR_POS = syndromeToPosition(PAIR_SUM);
/** after the decoder flips PAIR_POS, how many bits are wrong */
const PAIR_AFTER = weight(decode74(vecAdd(unitVector(N, PAIR[0] - 1), unitVector(N, PAIR[1] - 1))).corrected);

/** a lightest non-zero codeword used as an error pattern: positions 1, 2, 3 flipped leave the lamps dark */
const TRIPLE = [1, 2, 3];
const TRIPLE_SUM = TRIPLE.map(h).reduce((a, b) => vecAdd(a, b));
const TRIPLE_WORD = TRIPLE.map((j) => unitVector(N, j - 1)).reduce((a, b) => vecAdd(a, b));
const TRIPLE_IS_CODEWORD = isCodeword74(TRIPLE_WORD);

/* ------------------------------------------------------------------ */
/* Shared pictures                                                     */
/* ------------------------------------------------------------------ */

/**
 * The receiver's warning lamps: lit = that checker sees an odd number of 1s.
 * Drawn in H's row order (P1, P2, P4), or with `read` in reading order (P4, P2, P1) so that,
 * left to right, they spell the binary number of the position. With `onToggle` each lamp is a button.
 */
function Lamps({ bits: b, size = 'md', read = false, onToggle }: { bits: readonly Bit[]; size?: 'sm' | 'md'; read?: boolean; onToggle?: (i: number) => void }) {
  const d = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const order = read ? READ : [...LAMP.keys()];
  const lamp = (i: number) => <span className={`block ${d} rounded-full border-2 ${b[i] ? 'border-rose-500 bg-rose-400 shadow-[0_0_10px_3px_rgba(244,63,94,0.45)]' : 'border-slate-300 bg-slate-200'}`} />;
  return (
    <span className="inline-flex items-end gap-2 align-middle" role={onToggle ? 'group' : 'img'} aria-label={`警示燈${lampText(b)}`}>
      {order.map((i) => (
        <span key={LAMP[i]} className="inline-flex flex-col items-center gap-0.5">
          {onToggle ? (
            <button type="button" aria-pressed={!!b[i]} aria-label={`切換 ${LAMP[i]} 燈`} onClick={() => onToggle(i)} className="rounded-full hover:ring-2 hover:ring-sky-300">
              {lamp(i)}
            </button>
          ) : (
            lamp(i)
          )}
          <span className="text-sm font-semibold leading-none text-slate-500">{LAMP[i]}</span>
        </span>
      ))}
    </span>
  );
}

/** a 7-bit word in a monospace run; the flipped positions in red */
function Word({ bits: b, flipped = [], muted = false }: { bits: readonly Bit[]; flipped?: readonly number[]; muted?: boolean }) {
  return (
    <span className={`font-mono text-2xl font-bold tracking-[0.12em] ${muted ? 'text-slate-400' : ''}`}>
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
/* 1. 接收端只有 r 和 3 盞燈                                             */
/* ------------------------------------------------------------------ */

function ReceiverSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const r = vecAdd(c, EXAMPLE_E);
  const syn = syndrome74(r);
  const row = (label: string, children: ReactNode) => (
    <div className="flex items-center gap-4">
      <span className="w-48 shrink-0 text-lg text-slate-600">{label}</span>
      {children}
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-2">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-slate-50" title="接收端的處境">
          <div className="mt-2 space-y-3">
            <div className="rounded-xl border-2 border-dashed border-slate-300 p-3">
              <div className="mb-1 text-lg font-bold text-slate-500">看不到</div>
              {row('發送端送出的 c', <Word bits={c} muted />)}
              {row('雜訊翻了哪一位 e', <Word bits={EXAMPLE_E} flipped={[EXAMPLE_POS - 1]} muted />)}
            </div>
            <div className="rounded-xl border-2 border-parity-300 bg-parity-50/60 p-3">
              <div className="mb-1 text-lg font-bold text-parity-700">看得到</div>
              {row('收到的 r = c + e', <Word bits={r} />)}
              {row(`${R} 盞警示燈 s = Hrᵀ`, <Lamps bits={syn} />)}
            </div>
          </div>
          <p className="mt-3 text-lg text-slate-700">
            <strong>decoder（解碼器）的規則</strong>：燈全暗 → 不動；燈亮 → 認定恰好翻了一位，把它翻回來。
          </p>
        </Box>
      </Reveal>
      <div className="space-y-5">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="把 r = c + e 代進去">
            <Tex block>{'s = Hr^{T} = H(c+e)^{T} = \\underbrace{Hc^{T}}_{=\\,0} + He^{T} = He^{T}'}</Tex>
            <ul className="space-y-1 text-lg text-slate-700">
              <li>· 檢查器只做 XOR，可以疊加：c 和 e 各算各的。</li>
              <li>
                · 前提 ①：送出的是 codeword，<M>{'Hc^{T} = 0'}</M>，燈本來全暗（第 2 章 <M>{'HG^{T} = 0'}</M>）。
              </li>
            </ul>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-emerald-50 text-emerald-950" title="燈只對雜訊起反應">
            <p>
              <M>{'s = He^{T}'}</M>：燈號只取決於雜訊，與送了哪個 codeword 無關。
            </p>
            <p className="mt-1 text-lg text-slate-600">
              例：同樣翻位置 {EXAMPLE_POS}，{WORDS.length} 個 codeword 各送一次，燈號都是 {lampText(EXAMPLE_COL)}（{SAME_LAMPS}/{WORDS.length}）。
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 位置 j 出錯時，亮的是哪幾盞燈（r 可以點，跟網頁的「動手翻位元」一樣）  */
/* ------------------------------------------------------------------ */

function ColumnSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  // the flipped position can be changed during the talk by clicking a bit of r; it starts on the running example
  const [j, setJ] = useState(EXAMPLE_POS);
  const e = unitVector(N, j - 1);
  const r = vecAdd(c, e);
  const hj = h(j);
  return (
    <div className="space-y-4 text-xl">
      <Reveal on={s.step >= 0}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <Box tone="bg-rose-50 text-rose-950" title="前提 ②：恰好翻了一位">
            <div className="text-2xl">
              <M>{'e = e_j'}</M>
            </div>
            <p className="text-lg text-slate-700">
              只有位置 j 被翻轉。例：<M>{`e_${j}`}</M> = <span className="font-mono">{bits(e)}</span>
            </p>
          </Box>
          <Box tone="bg-slate-50" title={<>收到 r = c + <M>{`e_${j}`}</M></>}>
            <div className="mt-2">
              <BitRow bits={r} layout={LAYOUT_74} states={r.map((_, i) => (i === j - 1 ? 'error' : 'normal'))} onToggle={(i) => setJ(i + 1)} />
            </div>
          </Box>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="推導">
            <div className="-my-2 text-2xl">
              <Tex block>{'s = He_j^{T} = h_j \\quad (H \\text{ 的第 } j \\text{ 欄})'}</Tex>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <MatrixView matrix={H74} name="H" size="sm" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={[j - 1]} colHighlightClass="bg-sky-200 text-sky-900" />
              <span>
                · <M>{`e_${j}^{T}`}</M> =
              </span>
              <ColumnVector bits={hj} label={<M>{`h_${j}`}</M>} size="sm" cellClass="bg-sky-200 text-sky-900" />
              <p className="min-w-0 flex-1 basis-44 text-lg text-slate-600">
                <M>{'e_j'}</M> 只有第 j 位是 1：H 乘上它，只挑出第 j 欄。
              </p>
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-emerald-50 text-emerald-950" title="位置 j 出錯時亮的燈 = H 的第 j 欄">
            <div className="my-2 flex flex-wrap items-center gap-4">
              <span className="text-lg">
                例：位置 {j} → <M>{lampVecTex(hj)}</M>
              </span>
              <Lamps bits={hj} />
            </div>
            <p className="mt-1 text-lg text-slate-700">
              第 2 章 H 的設計 ①②：{N} 種單一錯誤 → {N} 種不同燈號，沒有全暗。
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. 讀燈號就知道翻哪一位：解碼電路                                      */
/* ------------------------------------------------------------------ */

function DecodeCircuitSlide({ s }: { s: Stepper }) {
  // the lamps can be clicked during the talk; they start on the running example (position 5)
  const [lamps, setLamps] = useState<Bit[]>(EXAMPLE_COL);
  const toggle = (i: number) => setLamps((v) => v.map((b, k) => (k === i ? ((b ^ 1) as Bit) : b)));
  const value = syndromeToPosition(lamps);
  const arrow = <span className="text-3xl text-slate-400">→</span>;
  const machine = (tone: string, title: ReactNode, note: ReactNode) => (
    <span className={`rounded-2xl border-2 px-3 py-1.5 text-center ${tone}`}>
      <span className="block text-lg font-bold">{title}</span>
      <span className="block text-base">{note}</span>
    </span>
  );
  return (
    <div className="space-y-4 text-xl">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-emerald-50 text-emerald-950" title="解碼電路：r 一進來，一次算完">
          <div className="mt-2 flex items-center justify-between gap-2">
            {machine('border-slate-300 bg-white text-slate-700', '收到 r', `${N} 個位元`)}
            {arrow}
            {machine('border-parity-300 bg-parity-50 text-parity-700', `${R} 個檢查器`, `${SYNDROME_XORS} 個 XOR 閘`)}
            {arrow}
            <Lamps bits={lamps} size="sm" read onToggle={toggle} />
            {arrow}
            {machine('border-sky-300 bg-sky-50 text-sky-800', `${R}-to-${STATES} decoder`, `${R} 條線進、${STATES} 條線出`)}
            {arrow}
            {machine('border-emerald-300 bg-white text-emerald-800', '翻轉', `${FLIP_XORS} 個 XOR 閘`)}
            {arrow}
            {machine('border-slate-300 bg-white text-slate-700', <>輸出 <M>{'\\hat c'}</M></>, '修好的字')}
          </div>
        </Box>
      </Reveal>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="燈號讀成二進位">
            <div className="my-2 flex flex-wrap items-center gap-4">
              <Lamps bits={lamps} read onToggle={toggle} />
              <span>
                {READ.map((i) => LAMP[i]).join(' ')} = <span className="font-mono font-bold">{binText(lamps)}</span> = {value}
              </span>
            </div>
            <Tex block>{`j = ${POS_TEX} = ${lamps.map((b, i) => `${b}\\cdot ${2 ** i}`).join(' + ')} = ${value}`}</Tex>
            <p className="text-lg text-slate-700">第 2 章 H 的設計 ④：第 j 欄 = j 的二進位。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-white border-2 border-slate-200" title={`${STATES} 條輸出線：只有第 ${value} 條是 1`}>
            <ol className="mt-2 grid grid-cols-4 gap-1.5 text-base">
              {Array.from({ length: STATES }, (_, k) => {
                const target = matchingColumn(lampBits(k)) + 1; // output line k is wired to the position whose column of H reads k
                return (
                  <li key={k} className={`rounded-lg border-2 px-2 py-0.5 ${k === value ? 'border-rose-400 bg-rose-50 font-semibold text-rose-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <span className="font-mono">{k}</span>：{target === 0 ? '不接' : `翻位置 ${target}`}
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-lg text-slate-700">
              {value === 0 ? (
                '第 0 條線不接任何位置：r 原樣送出。'
              ) : (
                <>
                  第 {value} 個 XOR 閘把 r 的第 {value} 位 ⊕ 1，翻回來：<M>{`\\hat c = r + e_{${value}} = c`}</M>。
                </>
              )}
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. 錯兩位以上：前提 ② 不成立                                          */
/* ------------------------------------------------------------------ */

function BeyondSlide({ s }: { s: Stepper }) {
  const lampRow = (label: ReactNode, b: readonly Bit[]) => (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-lg text-slate-600">{label}</span>
      <Lamps bits={b} size="sm" />
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-rose-50 text-rose-950" title="錯兩位：燈號指向第三位">
          <div className="space-y-1.5">
            {lampRow(<>只翻位置 {PAIR[0]}</>, h(PAIR[0]))}
            {lampRow(<>只翻位置 {PAIR[1]}</>, h(PAIR[1]))}
            {lampRow(<>{PAIR[0]}、{PAIR[1]} 一起翻</>, PAIR_SUM)}
          </div>
          <Tex block>{`h_${PAIR[0]} + h_${PAIR[1]} = ${colTex(h(PAIR[0]))} + ${colTex(h(PAIR[1]))} = ${colTex(PAIR_SUM)} = h_${PAIR_POS}`}</Tex>
          <p className="text-slate-700">
            兩欄之和 ≠ 0，又 {PATTERNS} 種亮法全用上 → 一定是<strong>第三欄</strong>。decoder 把沒錯的位置 {PAIR_POS} 也翻掉 → {PAIR_AFTER} 個錯：<strong className="text-rose-700">miscorrection（誤更正）</strong>，{TWO.mis}/{TWO.total} 種雙錯都這樣。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-rose-50 text-rose-950" title="錯三位：燈可能全暗">
          <p className="text-slate-700">
            錯誤本身是 codeword（<span className="font-mono">{bits(TRIPLE_WORD)}</span>
            {TRIPLE_IS_CODEWORD ? '' : ' ✗'}）：
          </p>
          <Tex block>{`h_${TRIPLE[0]} + h_${TRIPLE[1]} + h_${TRIPLE[2]} = ${colTex(TRIPLE_SUM)}`}</Tex>
          <div className="mb-2 flex justify-center">
            <Lamps bits={TRIPLE_SUM} />
          </div>
          <p className="text-slate-700">
            燈全暗，r 看起來是合法 codeword：<strong className="text-rose-700">undetected error</strong>（{THREE.undetected} 種）。其餘 {THREE.mis} 種三位錯誤造成 miscorrection。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-emerald-50 text-emerald-950" title={`保證只到 ${T} 位`}>
          <p className="text-slate-700">
            只錯一位：{ONE.ok}/{ONE.total} 修好；錯更多就不保證。
          </p>
          <ul className="mt-3 space-y-3">
            <li className="rounded-xl border-l-4 border-sky-400 bg-white px-3 py-2">
              <strong>第 4 章</strong>：說明為什麼極限剛好是 {T} 位。
            </li>
            <li className="rounded-xl border-l-4 border-emerald-500 bg-white px-3 py-2">
              <strong>第 5 章</strong>：SECDED，多一個 parity bit，錯兩位時改成「偵測、不亂修」。
            </li>
          </ul>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

export const CH3_SLIDES: DeckSlide<null>[] = [
  {
    title: `第 3 章：接收端只有 r 和 ${R} 盞燈`,
    sub: '不知道送了什麼，也看不到雜訊：燈號能說什麼？',
    steps: () => 3,
    render: (s) => <ReceiverSlide s={s} />,
    takeaway: (
      <>
        <Ph>燈只對雜訊起反應：</Ph>
        <Ph>接收端不必知道送了什麼</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          接收端只有收到的 r 和 {R} 盞燈 s = Hrᵀ，也就是 syndrome
          <ul className={NOTES_SUB}>
            <li>
              看不到 c，也看不到雜訊。例：翻了位置 {EXAMPLE_POS} → 燈{lampText(EXAMPLE_COL)}
            </li>
            <li>decoder 的規則：燈全暗就不動；燈亮就認定恰好翻了一位，把它翻回來（只翻一位最常見）</li>
          </ul>
        </li>
        <li>
          → 把 r = c + e 代進 s = Hrᵀ
          <ul className={NOTES_SUB}>
            <li>檢查器只做 XOR，可以疊加；前提 ①：送出的是 codeword → Hcᵀ = 0（第 2 章 HGᵀ = 0）</li>
          </ul>
        </li>
        <li>
          → s = Heᵀ：燈號只取決於雜訊
          <ul className={NOTES_SUB}>
            <li>
              同樣翻位置 {EXAMPLE_POS}，{WORDS.length} 個 codeword 燈號都一樣（{SAME_LAMPS}/{WORDS.length}）：看燈就是在看雜訊
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 3 章：位置 j 出錯時，亮的是哪幾盞燈',
    sub: '從 s = Heᵀ 出發，再加上「恰好翻了一位」',
    steps: () => 3,
    render: (s) => <ColumnSlide s={s} />,
    takeaway: (
      <>
        <Ph>位置 j 出錯時亮的燈，</Ph>
        <Ph>就是 H 的第 j 欄</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          前提 ②：雜訊恰好翻了一位 j，e = eⱼ（只有第 j 位是 1）
          <ul className={NOTES_SUB}>
            <li>現場示範：點 r 的任一位，就改成翻那一位；H 標亮的欄、hⱼ 和燈號跟著換</li>
          </ul>
        </li>
        <li>
          → 推導：s = Heⱼᵀ = hⱼ
          <ul className={NOTES_SUB}>
            <li>eⱼ 只有第 j 位是 1：H 乘上它只挑出第 j 欄</li>
          </ul>
        </li>
        <li>
          → 位置 j 出錯時亮的燈，就是 H 的第 j 欄
          <ul className={NOTES_SUB}>
            <li>
              例：位置 {EXAMPLE_POS} → {lampVec(EXAMPLE_COL)} → {lampText(EXAMPLE_COL)}
            </li>
            <li>H 的設計 ①②：{N} 欄非零、互不相同 → 看燈就分得出是哪一位</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 3 章：讀燈號就知道翻哪一位',
    sub: '燈號讀成二進位，就是要翻的位置',
    steps: () => 3,
    render: (s) => <DecodeCircuitSlide s={s} />,
    takeaway: (
      <>
        <Ph>燈號讀成二進位就是 j，</Ph>
        <Ph>電路把第 j 位翻回來</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          解碼電路：r 一進來，一次算完
          <ul className={NOTES_SUB}>
            <li>
              {SYNDROME_XORS} 個 XOR 閘算燈號 → {R}-to-{STATES} decoder → {FLIP_XORS} 個 XOR 閘翻轉 → 輸出 ĉ
            </li>
          </ul>
        </li>
        <li>
          → 燈號讀成二進位就是位置（H 的設計 ④，第 j 欄 = j 的二進位）
          <ul className={NOTES_SUB}>
            <li>
              燈照 {READ.map((i) => LAMP[i]).join(' ')} 排，由左讀到右：{binText(EXAMPLE_COL)} = {syndromeToPosition(EXAMPLE_COL)}，不用存表
            </li>
          </ul>
        </li>
        <li>
          → {R}-to-{STATES} decoder：{STATES} 條輸出線只有第 j 條是 1，第 j 個 XOR 閘把第 j 位翻回來
          <ul className={NOTES_SUB}>
            <li>燈全暗 → 第 0 條線，不接任何位置，r 原樣送出</li>
            <li>可以點燈切換燈號，亮的輸出線跟著換</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 3 章：錯兩位以上：前提 ② 不成立',
    sub: '燈號會說錯話',
    steps: () => 3,
    render: (s) => <BeyondSlide s={s} />,
    takeaway: (
      <>
        <Ph>錯兩位：燈號指向第三位，</Ph>
        <Ph>錯三位：燈可能全暗；</Ph>
        <Ph>保證只到 {T} 位</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          錯兩位（位置 j、j′）：燈號是兩欄之和 hⱼ + hⱼ′
          <ul className={NOTES_SUB}>
            <li>
              兩欄不同 → 和不是 0；{PATTERNS} 種非零亮法全用上 → 和是某一欄，又不是 hⱼ、hⱼ′ → 第三欄
            </li>
            <li>
              例：位置 {PAIR[0]}、{PAIR[1]} → 第 {PAIR_POS} 欄（{PAIR[0]} ⊕ {PAIR[1]} = {PAIR[0] ^ PAIR[1]}）→ 把原本沒錯的位置 {PAIR_POS} 也翻掉 → {PAIR_AFTER} 個錯：miscorrection（{TWO.mis}/{TWO.total}）
            </li>
          </ul>
        </li>
        <li>
          → 錯三位：燈可能全暗
          <ul className={NOTES_SUB}>
            <li>
              錯誤本身是 codeword（例：{bits(TRIPLE_WORD)}）→ Heᵀ = 0：undetected error（{THREE.undetected} 種）；其餘 {THREE.mis} 種是 miscorrection
            </li>
          </ul>
        </li>
        <li>
          → 只錯一位 {ONE.ok}/{ONE.total} 修好，保證只到 {T} 位
          <ul className={NOTES_SUB}>
            <li>
              第 4 章：極限剛好是 {T} 位的原因（<M>{`d_{\\min} = ${D_MIN}`}</M>）；第 5 章：SECDED，錯兩位時能偵測
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
];
