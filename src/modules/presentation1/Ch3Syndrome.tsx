import { useState, type ReactNode } from 'react';
import {
  type Bit,
  DATA_INDICES,
  H74,
  K4,
  LAYOUT_74,
  N7,
  PARITY_CHECKS,
  PARITY_INDICES,
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
  syndromeTableEntries,
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
import { StatusBadge } from '../../components/Lesson';
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
/** 3 lamps: 2³ states = the outputs of the 3-to-8 decoder; all but "all dark" name a position */
const STATES = 2 ** R;
const PATTERNS = STATES - 1;
/** the syndrome circuit (one XOR tree per lamp) and the flip stage (one XOR gate per position) */
const SYNDROME_XORS = hammingSyndromeXors(R);
const FLIP_XORS = N;
/** a general H needs a lamp pattern → position table with one row per lamp state */
const TABLE_ROWS = syndromeTableEntries(N, K);

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
 * Another common way to write H: data bits first, parity bits last (columns D1 D2 D3 D4 P1 P2 P4).
 * Same columns, other order: the lamps no longer read as the position.
 */
const SYS_ORDER = [...DATA_INDICES, ...PARITY_INDICES];
const H_SYS = H74.map((row) => SYS_ORDER.map((j) => row[j]));
const SYS_LABELS = SYS_ORDER.map((j) => LAYOUT_74[j].label);
/** 0-based column of H_SYS that equals the lamps, −1 when they are all dark */
const sysColumn = (v: readonly Bit[]) => (isZeroVector(v) ? -1 : H_SYS[0].findIndex((_, j) => H_SYS.every((row, i) => row[j] === v[i])));

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
/* 1. 接收端只看到 r                                                     */
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
          <p className="mt-3 text-lg text-slate-700">不知道 c、看不到 e：要決定翻哪一位，只能靠燈號。</p>
        </Box>
      </Reveal>
      <div className="space-y-5">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="把 r = c + e 代進去">
            <Tex block>{'s = Hr^{T} = H(c+e)^{T} = \\underbrace{Hc^{T}}_{=\\,0} + He^{T} = He^{T}'}</Tex>
            <ul className="space-y-1 text-lg text-slate-700">
              <li>· 檢查器只做 XOR，可以疊加：c 和 e 各算各的。</li>
              <li>
                · 送出的是 codeword：<M>{'Hc^{T} = 0'}</M>，燈本來全暗（第 2 章 <M>{'HG^{T} = 0'}</M>）。
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
              例：同樣翻位置 {EXAMPLE_POS}，{WORDS.length} 個 codeword 各送一次，燈號都是{lampText(EXAMPLE_COL)}（{SAME_LAMPS}/{WORDS.length}）。
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 亮的燈 = 第 j 欄 = 位置 j                                          */
/* ------------------------------------------------------------------ */

function ColumnSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4 text-xl">
      <Reveal on={s.step >= 0}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Box tone="bg-data-50 text-data-800" title="上一頁：燈只對雜訊起反應">
            <div className="text-2xl">
              <M>{'s = He^{T}'}</M>
            </div>
            <p className="text-lg text-slate-700">送出的是 codeword，Hcᵀ = 0 已經消掉：亮起來的每一盞，都是雜訊造成的。</p>
          </Box>
          <Box tone="bg-rose-50 text-rose-950" title="再加一個前提：恰好翻了一位">
            <div className="text-2xl">
              <M>{'e = e_j'}</M>
            </div>
            <p className="text-lg text-slate-700">
              只有位置 j 被翻轉。例：<M>{`e_${EXAMPLE_POS}`}</M> = <span className="font-mono">{bits(EXAMPLE_E)}</span>
            </p>
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
              <MatrixView matrix={H74} name="H" size="sm" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={[EXAMPLE_POS - 1]} colHighlightClass="bg-sky-200 text-sky-900" />
              <span>
                · <M>{`e_${EXAMPLE_POS}^{T}`}</M> =
              </span>
              <ColumnVector bits={EXAMPLE_COL} label={<M>{`h_${EXAMPLE_POS}`}</M>} size="sm" cellClass="bg-sky-200 text-sky-900" />
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
                例：位置 {EXAMPLE_POS} → <M>{lampVecTex(EXAMPLE_COL)}</M>
              </span>
              <Lamps bits={EXAMPLE_COL} />
            </div>
            <p className="mt-1 text-lg text-slate-700">
              第 2 章 H 的設計 ①②：{N} 欄非零、互不相同 → {N} 種單一錯誤，{N} 種不同燈號，沒有一種是全暗。
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. 讀燈號就知道翻哪一位                                               */
/* ------------------------------------------------------------------ */

function DecodeCircuitSlide({ s }: { s: Stepper }) {
  // the lamps can be clicked during the talk; they start on the running example (position 5)
  const [lamps, setLamps] = useState<Bit[]>(EXAMPLE_COL);
  const toggle = (i: number) => setLamps((v) => v.map((b, k) => (k === i ? ((b ^ 1) as Bit) : b)));
  const value = syndromeToPosition(lamps);
  const sysCol = sysColumn(lamps);
  const arrow = <span className="text-3xl text-slate-400">→</span>;
  const machine = (tone: string, title: string, note: ReactNode) => (
    <span className={`rounded-2xl border-2 px-3 py-1.5 text-center ${tone}`}>
      <span className="block text-lg font-bold">{title}</span>
      <span className="block text-base">{note}</span>
    </span>
  );
  return (
    <div className="space-y-3 text-xl">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-slate-50" title="一般的 H：拿燈號逐欄比對">
            <div className="my-2 flex flex-wrap items-center gap-3">
              <ColumnVector bits={lamps} label={<M>{'s ='}</M>} size="sm" cellClass="bg-fuchsia-100 text-fuchsia-800" />
              <span className="text-slate-400">vs.</span>
              <MatrixView matrix={H_SYS} name={<M>{'\\tilde H'}</M>} size="sm" colLabels={SYS_LABELS} rowLabels={LAMP} highlightCols={sysCol >= 0 ? [sysCol] : []} colHighlightClass="bg-fuchsia-200 text-fuchsia-900" />
            </div>
            <p className="text-lg text-slate-700">
              {sysCol < 0 ? (
                <>燈全暗：不用比。</>
              ) : (
                <>
                  資料位元排前面的 <M>{'\\tilde H'}</M>：{binText(lamps)} = {value}，第 {value} 欄卻是 {SYS_LABELS[value - 1]}。只能逐欄比對（到第 {sysCol + 1} 欄 {SYS_LABELS[sysCol]} 才對上），或存一張 {TABLE_ROWS} 格對照表。
                </>
              )}
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="Hamming 的 H：燈號直接讀成位置">
            <div className="my-2 flex flex-wrap items-center gap-4">
              <Lamps bits={lamps} read onToggle={toggle} />
              <span>
                {READ.map((i) => LAMP[i]).join(' ')} = <span className="font-mono font-bold">{binText(lamps)}</span> = {value}
              </span>
            </div>
            <Tex block>{`j = ${POS_TEX} = ${lamps.map((b, i) => `${b}\\cdot ${2 ** i}`).join(' + ')} = ${value}`}</Tex>
            <p className="text-lg text-slate-700">第 2 章 H 的設計 ④：第 j 欄 = j 的二進位。對照表變成「燈號 j → 位置 j」，不用存，也不用比。</p>
          </Box>
        </Reveal>
      </div>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-emerald-50 text-emerald-950" title="解碼電路：全部組合邏輯，一次算完">
          <div className="mt-1 flex items-center justify-between gap-2">
            {machine('border-slate-300 bg-white text-slate-700', '收到 r', `${N} 個位元`)}
            {arrow}
            {machine('border-parity-300 bg-parity-50 text-parity-700', `${R} 個檢查器`, `${SYNDROME_XORS} 個 XOR 閘`)}
            {arrow}
            <Lamps bits={lamps} size="sm" read onToggle={toggle} />
            {arrow}
            {machine('border-sky-300 bg-sky-50 text-sky-800', `${R}-to-${STATES} 解碼器`, `${STATES} 條輸出線`)}
            {arrow}
            {machine('border-emerald-300 bg-white text-emerald-800', '翻轉', `${FLIP_XORS} 個 XOR 閘`)}
          </div>
          <div className="mt-2 grid grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] items-center gap-4">
            <ol className="grid grid-cols-4 gap-1.5 text-base">
              {Array.from({ length: STATES }, (_, j) => {
                const target = matchingColumn(lampBits(j)) + 1; // output line j is wired to the position whose column of H reads j
                return (
                  <li key={j} className={`rounded-lg border-2 px-2 py-0.5 ${j === value ? 'border-rose-400 bg-rose-50 font-semibold text-rose-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                    <span className="font-mono">{j}</span>：{target === 0 ? '不接' : `翻位置 ${target}`}
                  </li>
                );
              })}
            </ol>
            <p className="text-lg text-slate-700">
              只有第 {value} 條線是 1：{value === 0 ? '它不接任何位置，r 原樣送出。' : <>第 {value} 個 XOR 閘做 <M>{`r_{${value}} \\oplus 1`}</M>，把那一位翻回來：<M>{'\\hat c = r + e_j = c'}</M>。</>}
            </p>
          </div>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. 實例：Syndrome 解碼                                                */
/* ------------------------------------------------------------------ */

function SyndromeSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const [e, setE] = useState<number[]>([EXAMPLE_POS - 1]);
  const r = c.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const d = decode74(r);
  const col = d.position - 1;
  const wrong = !vecEquals(d.corrected, c);
  return (
    <div className="grid grid-cols-1 gap-6 text-xl lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="space-y-5">
        <div>
          <div className="mb-1 text-lg text-slate-500">收到 r</div>
          <BitRow bits={r} layout={LAYOUT_74} size="lg" states={r.map((_, i) => (e.includes(i) ? 'error' : 'normal'))} onToggle={(i) => setE(e.includes(i) ? e.filter((j) => j !== i) : [...e, i])} />
          <p className="mt-2 text-lg text-slate-600">{e.length ? `紅色是雜訊翻轉的 ${e.length} 個位元：接收端看不到紅色，只看得到 r。` : '這次沒有錯，但接收端並不知道，照樣算燈號。'}</p>
        </div>
        <Reveal on={s.step >= 1}>
          <div className="flex items-center gap-3">
            <MatrixView matrix={H74} name="H" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={col >= 0 && s.step >= 2 ? [col] : []} />
            <span className="text-2xl">·</span>
            <ColumnVector bits={r} label={<M>{'r^T ='}</M>} size="sm" />
            <span className="text-2xl">=</span>
            <ColumnVector bits={d.syndrome} label={<M>{'s'}</M>} size="sm" cellClass="bg-amber-50 text-amber-800" />
          </div>
        </Reveal>
      </div>
      <div className="space-y-4">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-amber-50 text-amber-950" title="算燈號 s = Hrᵀ">
            <div className="flex flex-wrap items-center gap-4">
              <Lamps bits={d.syndrome} />
              <span className="text-lg">{lampText(d.syndrome)}</span>
            </div>
            <p className="mt-1 text-lg text-slate-600">s = Hrᵀ = Heᵀ：codeword 的部分全部消掉，燈只對雜訊起反應。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone={wrong ? 'bg-rose-50 text-rose-950' : 'bg-emerald-50 text-emerald-950'} title="讀燈號、翻回來">
            {d.position === 0 ? (
              <p className="text-lg">燈全暗：判定沒有錯，r 原樣送出。</p>
            ) : (
              <p className="text-lg">
                燈號 = H 的第 {d.position} 欄，讀成 {binText(d.syndrome)} = {d.position} → 翻轉位置 {d.position}（{LAYOUT_74[col].label}），得到 <strong className="font-mono">{d.corrected.join('')}</strong>
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {d.position === 0 ? (
                <StatusBadge status={e.length ? 'wrong' : 'ok'} zh={e.length ? '未偵測錯誤' : undefined} en={e.length ? 'Undetected error' : undefined} large />
              ) : e.length === 1 ? (
                <StatusBadge status="corrected" large />
              ) : (
                <StatusBadge status="wrong" zh="誤更正" en="Miscorrection" large />
              )}
              <span className="text-base text-slate-600">
                {e.length <= 1 ? (e.length ? '只錯一位：一定修好。' : '') : `錯 ${e.length} 位：超出「恰好翻一位」的前提。`}
              </span>
            </div>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. 錯兩個以上                                                         */
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
            兩欄不同，和不是 0；{PATTERNS} 種非零亮法全用上了，和一定是<strong>第三欄</strong>。解碼器把原本沒錯的位置 {PAIR_POS} 也翻掉 → {PAIR_AFTER} 個錯：<strong className="text-rose-700">誤更正</strong>（{TWO.mis}/{TWO.total} 種雙錯）。
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
            燈全暗，r 看起來是合法 codeword：<strong className="text-rose-700">未偵測錯誤</strong>（{THREE.undetected} 種）。其餘 {THREE.mis} 種三位錯誤被誤更正。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-emerald-50 text-emerald-950" title={`保證只到 ${T} 位`}>
          <p className="text-slate-700">
            解碼器永遠假設「最多翻了一位」：只錯一位 {ONE.ok}/{ONE.total} 修好，錯更多就不保證。
          </p>
          <ul className="mt-3 space-y-3">
            <li className="rounded-xl border-l-4 border-sky-400 bg-white px-3 py-2">
              <strong>第 4 章</strong>：極限剛好是 {T} 位，因為 codeword 之間至少差 <M>{`{d_{\\min} = ${D_MIN}}`}</M> 位。
            </li>
            <li className="rounded-xl border-l-4 border-emerald-500 bg-white px-3 py-2">
              <strong>第 5 章</strong>：SECDED，多一個同位位元，錯兩位時改成「偵測、不亂修」。
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
    title: '第 3 章：接收端只看到 r',
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
          接收端只有收到的 r 和 {R} 盞燈 s = Hrᵀ，也就是 Syndrome（徵狀）
          <ul className={NOTES_SUB}>
            <li>
              看不到 c，也看不到雜訊。例：翻了位置 {EXAMPLE_POS} → 燈{lampText(EXAMPLE_COL)}
            </li>
          </ul>
        </li>
        <li>
          → 把 r = c + e 代進 s = Hrᵀ
          <ul className={NOTES_SUB}>
            <li>檢查器只做 XOR，可以疊加；送出的是 codeword → Hcᵀ = 0（第 2 章 HGᵀ = 0）</li>
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
    title: '第 3 章：只翻一位時，亮的是哪幾盞燈',
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
          從上一頁的 s = Heᵀ 出發（Hcᵀ = 0 已經消掉）
          <ul className={NOTES_SUB}>
            <li>再加一個前提：雜訊恰好翻了一位 j，e = eⱼ（只有第 j 位是 1）</li>
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
    sub: '燈號讀成二進位，接上解碼器',
    steps: () => 3,
    render: (s) => <DecodeCircuitSlide s={s} />,
    takeaway: (
      <>
        <Ph>燈號讀成二進位、接上解碼器，</Ph>
        <Ph>就翻回那一位</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          知道「亮的燈 = 第 j 欄」，還要找出是哪一欄
          <ul className={NOTES_SUB}>
            <li>
              一般的 <M>{'\\tilde H'}</M>（同樣 {N} 欄，資料位元排前面）：{binText(EXAMPLE_COL)} = {EXAMPLE_POS}，第 {EXAMPLE_POS} 欄卻是 {SYS_LABELS[EXAMPLE_POS - 1]} → 只能逐欄比對，或存 {TABLE_ROWS} 格對照表
            </li>
          </ul>
        </li>
        <li>
          → Hamming 的 H：H 的設計 ④，第 j 欄 = j 的二進位
          <ul className={NOTES_SUB}>
            <li>
              燈照 {READ.map((i) => LAMP[i]).join(' ')} 排，由左讀到右就是位置：{binText(EXAMPLE_COL)} = {syndromeToPosition(EXAMPLE_COL)}，不用存表
            </li>
          </ul>
        </li>
        <li>
          → 解碼電路：全部組合邏輯，r 一進來一次算完
          <ul className={NOTES_SUB}>
            <li>
              {SYNDROME_XORS} 個 XOR 閘算燈號 → {R}-to-{STATES} 解碼器：第 j 條線翻第 j 位，第 0 條不接 → {FLIP_XORS} 個 XOR 閘翻轉
            </li>
            <li>可以點燈切換燈號，亮的輸出線跟著換</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 3 章：實例：Syndrome 解碼',
    sub: '算燈號 s = Hrᵀ，讀成位置，翻回來',
    steps: () => 3,
    render: (s) => <SyndromeSlide s={s} />,
    takeaway: (
      <>
        <Ph>算燈號、讀位置、翻回來：</Ph>
        <Ph>只錯一位一定修好</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          收到 r：紅色是雜訊翻的位元，接收端看不到紅色
          <ul className={NOTES_SUB}>
            <li>現場示範：點任何位元翻轉，0、1、2、3 個都可以試</li>
          </ul>
        </li>
        <li>→ 算燈號：s = Hrᵀ = Heᵀ，codeword 的部分全部消掉</li>
        <li>
          → 解碼：燈號讀成二進位就是位置，翻回來
          <ul className={NOTES_SUB}>
            <li>
              只錯一位一定修好（{ONE.ok}/{ONE.total}）；錯兩位以上：燈號指錯位置，甚至全暗（下一頁）
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 3 章：錯兩個以上',
    sub: '前提「恰好翻一位」不成立時，燈號會說錯話',
    steps: () => 3,
    render: (s) => <BeyondSlide s={s} />,
    takeaway: (
      <>
        <Ph>錯兩位會誤更正，</Ph>
        <Ph>錯三位可能全暗：</Ph>
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
              例：位置 {PAIR[0]}、{PAIR[1]} → 第 {PAIR_POS} 欄（{PAIR[0]} ⊕ {PAIR[1]} = {PAIR[0] ^ PAIR[1]}）→ 把原本沒錯的位置 {PAIR_POS} 也翻掉 → {PAIR_AFTER} 個錯：誤更正（{TWO.mis}/{TWO.total}）
            </li>
          </ul>
        </li>
        <li>
          → 錯三位：燈可能全暗
          <ul className={NOTES_SUB}>
            <li>
              錯誤本身是 codeword（例：{bits(TRIPLE_WORD)}）→ Heᵀ = 0：未偵測錯誤（{THREE.undetected} 種）；其餘 {THREE.mis} 種誤更正
            </li>
          </ul>
        </li>
        <li>
          → 解碼器永遠假設最多翻了一位，保證只到 {T} 位
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
