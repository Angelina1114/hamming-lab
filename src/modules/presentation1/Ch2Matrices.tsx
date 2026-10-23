import type { ReactNode } from 'react';
import {
  type Bit,
  type Matrix,
  DATA_INDICES,
  G74,
  H74,
  K4,
  LAYOUT_74,
  N7,
  PARITY_CHECKS,
  PARITY_INDICES,
  codewords74,
  column,
  encode74,
  hammingN,
  hammingParams,
  isZeroMatrix,
  isZeroVector,
  matMul,
  matVec,
  rank,
  syndromeToPosition,
  transpose,
  unitVector,
  vecEquals,
  vecMat,
} from '../../core';
import { sciTex } from '../../core/engineering-g1';
import { sciParts } from '../../core/engineering-g5';
import { useMessage } from '../../lib/store';
import { M } from '../../components/Tex';
import { MatrixView, ColumnVector } from '../../components/MatrixView';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal, sub } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** 7 positions, 4 data bits, ℓ = 3 parity bits = 3 checkers = 3 warning lamps */
const N = N7;
const K = K4;
const L = H74.length;
/** 3 lamps: 2³ states; all but "all dark" can name a position */
const STATES = 2 ** L;
const PATTERNS = STATES - 1;
const CODEWORDS = codewords74().length;
/** G design ③: how many different codewords the 16 messages give */
const DISTINCT = new Set(codewords74().map((x) => x.codeword.join(''))).size;
const ALL_WORDS = 2 ** N;
/** a lookup-table encoder stores one codeword per message */
const TABLE_ROWS = 2 ** K;
/** the long code of the same family: Hamming(127,120) */
const LONG = hammingParams(7);
const RANK_G = rank(G74);
const RANK_H = rank(H74);

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
const POSITIONS = LAYOUT_74.map((p) => p.position);
const LABELS = LAYOUT_74.map((p) => p.label);
const DATA_LABELS = DATA_INDICES.map((i) => LAYOUT_74[i].label);
const posList = (idx: readonly number[]) => idx.map((i) => LAYOUT_74[i].position).join('、');
const DATA_POS = posList(DATA_INDICES);
const PARITY_POS = posList(PARITY_INDICES);
const roleText = (i: number) => (LAYOUT_74[i].role === 'parity' ? 'text-parity-700' : 'text-data-700');
/** the lamps that light when noise flips position pos (1-based) */
const lampsAt = (H: Matrix, pos: number) => matVec(H, unitVector(N, pos - 1));
/** reading the lamps as a binary number: P4 P2 P1, the most significant first */
const READ = [...LAMP.keys()].reverse();
const READ_NAMES = READ.map((i) => LAMP[i]).join(' ');
/** the lamps as a number: 「110₂ = 6」 (P4 P2 P1 order) */
const binText = (s: readonly Bit[]) => `${READ.map((i) => s[i]).join('')}₂ = ${syndromeToPosition(s)}`;
/** the lamps as a labelled vector: 「(s₁, s₂, s₄) = (0, 1, 1)」 */
const S_NAMES = `(${LAMP.map((x) => `s${x.slice(1).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}`).join(', ')})`;
const vecText = (s: readonly Bit[]) => `${S_NAMES} = (${s.join(', ')})`;
const eqTex = (k: number) => `${sub(PARITY_CHECKS[k].name)} = ${PARITY_CHECKS[k].dataTerms.map(sub).join(' \\oplus ')}`;
/** 3 → '³': exponents in plain text */
const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
/** 1.3 × 10³⁶ in plain text (speaker notes) */
const sciPlain = (x: number) => {
  const { mantissa, exponent } = sciParts(x);
  return `${mantissa} × 10${sup(exponent)}`;
};
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
/** a title phrase that wraps as a whole: no-break spaces, and a word joiner after each 、 */
const nobreak = (s: string) => s.replace(/ /g, '\u00a0').replace(/、/g, '、\u2060');
/** the message with only Dᵢ = 1, as a bit string: 「1000」 */
const unitText = (i: number) => unitVector(K, i).join('');

/** G read by rows (where each data line goes) and by columns (what each output wire XORs) */
const G_ROW_OUTPUTS = G74.map((row) => LAYOUT_74.filter((p) => row[p.index]).map((p) => p.label));
const G_COL_INPUTS = LAYOUT_74.map((p) => column(G74, p.index).flatMap((v, i) => (v ? [`D${i + 1}`] : [])));
const G_ROW_POS = G74.map((row) => LAYOUT_74.filter((p) => row[p.index]).map((p) => p.position));
/** worked examples: the D1 row of G, the P1 column of G, position 5 on the receiver slide (as in chapter 1) */
const EX_ROW = 0;
const EX_COL = PARITY_INDICES[0];
const EX_POS = 5;

/** H design ①: position ZERO_POS gets a column of zeros; ②: position TWIN_B gets the column of TWIN_A */
const ZERO_POS = N;
const H_ZERO: Matrix = H74.map((r) => r.map((v, j) => (j === ZERO_POS - 1 ? 0 : v)));
const TWIN_A = N - 1;
const TWIN_B = N;
const H_TWIN: Matrix = H74.map((r) => r.map((v, j) => (j === TWIN_B - 1 ? r[TWIN_A - 1] : v)));
/** H design ④: the example read as a binary number */
const DEC_POS = TWIN_A;
/** H design ⑤: how many parity bits each check contains (parity at 1, 2, 4 versus at the last three positions) */
const STD_PARITY = PARITY_INDICES.map((i) => LAYOUT_74[i].position);
const ALT_PARITY = LAYOUT_74.slice(-L).map((p) => p.position);
const unknownsPerRow = (parity: number[]) => H74.map((row) => parity.filter((p) => row[p - 1] === 1).length);
/** G design ③ (notes only): D4 wired exactly like D1 (row 4 = row 1) breaks ②, and two messages collide */
const G_COLLIDE: Matrix = G74.map((r, i) => (i === K - 1 ? [...G74[0]] : r));
const COLLIDE_MSGS = [unitVector(K, 0), unitVector(K, K - 1)];
const COLLIDE_WORDS = COLLIDE_MSGS.map((m) => vecMat(m, G_COLLIDE));
const HGT = matMul(H74, transpose(G74));
const G_LABELS = G74.map((_, i) => (
  <span key={i}>
    g<sub>{i + 1}</sub>
  </span>
));

/* ------------------------------------------------------------------ */
/* Shared pictures                                                     */
/* ------------------------------------------------------------------ */

/**
 * The receiver's warning lamps: lit = that checker sees an odd number of 1s.
 * Drawn in H's row order (P1, P2, P4), or with order="read" as P4 P2 P1 so they line up with the binary number.
 */
function Lamps({ bits, size = 'md', order = 'rows' }: { bits: readonly Bit[]; size?: 'sm' | 'md' | 'lg'; order?: 'rows' | 'read' }) {
  const d = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  const idx = order === 'read' ? READ : [...LAMP.keys()];
  return (
    <span className="inline-flex items-end gap-2 align-middle" role="img" aria-label={`警示燈${lampText(bits)}`}>
      {idx.map((i) => (
        <span key={LAMP[i]} className="inline-flex flex-col items-center gap-0.5">
          <span className={`${d} rounded-full border-2 ${bits[i] ? 'border-rose-500 bg-rose-400 shadow-[0_0_10px_3px_rgba(244,63,94,0.45)]' : 'border-slate-300 bg-slate-200'}`} />
          <span className="text-sm font-semibold leading-none text-slate-500">{LAMP[i]}</span>
        </span>
      ))}
    </span>
  );
}

/** A 7-bit word, parity bits and data bits in their own colours. */
function Word({ bits, className = 'text-2xl' }: { bits: readonly Bit[]; className?: string }) {
  return (
    <span className={`font-mono font-bold tracking-[0.12em] ${className}`}>
      {bits.map((b, i) => (
        <span key={i} className={bits.length === N ? roleText(i) : 'text-data-700'}>
          {b}
        </span>
      ))}
    </span>
  );
}

/** a phrase of a takeaway that never breaks in the middle (the header box only fits ~17 characters a line) */
const Ph = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

/* ------------------------------------------------------------------ */
/* 1. 發送端與接收端（old p9 + p13）: the pipeline, the encoder, H's rows, H's columns */
/* ------------------------------------------------------------------ */

function SenderReceiverSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const exCol = column(H74, EX_POS - 1);
  const arrow = (label?: string) => (
    <span className="flex shrink-0 flex-col items-center leading-none text-slate-400">
      <span className={`h-5 text-base font-semibold text-rose-500 ${label ? '' : 'invisible'}`}>{label ?? '·'}</span>
      <span className="text-3xl">→</span>
    </span>
  );
  const stop = (label: string, children: ReactNode) => (
    <span className="flex flex-col items-center gap-1">
      <span className="text-base text-slate-500">{label}</span>
      {children}
    </span>
  );
  const machine = (tone: string, title: string, note: ReactNode) => (
    <span className={`rounded-2xl border-2 px-4 py-1.5 text-center ${tone}`}>
      <span className="block text-xl font-bold">{title}</span>
      <span className="block text-base">{note}</span>
    </span>
  );
  return (
    <div className="space-y-3 text-xl">
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-2">
        {stop("訊息 m", <Word bits={message} />)}
        {arrow()}
        {machine('border-data-300 bg-data-50 text-data-700', '發送端：encoder（編碼器）', <>接線圖 = G</>)}
        {arrow()}
        {stop(`送出 ${N} 個位元`, <Word bits={c} />)}
        {arrow('雜訊')}
        {machine('border-parity-300 bg-parity-50 text-parity-700', '接收端：檢查器', <>檢查電路 = H</>)}
        {arrow()}
        {stop(`${L} 盞警示燈`, <Lamps bits={matVec(H74, c)} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.55fr)_minmax(0,0.95fr)]">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-data-50 text-data-700" title="發送端：encoder">
            <p className="text-lg text-slate-700">
              {K} 條資料線進、{N} 條線出，每條輸出線是幾個 data bit 的 XOR。
            </p>
            <p className="mt-1 text-lg text-slate-600">這張接線圖是 generator matrix（生成矩陣）G（下一頁）。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-parity-50 text-parity-700" title="接收端：parity-check matrix（同位檢查矩陣）H">
            <table className="w-full text-left text-slate-800">
              <thead>
                <tr className="text-sm text-slate-500">
                  <th className="pr-2 font-normal">檢查器</th>
                  <th className="pr-2 font-normal">盯著的位置</th>
                  <th className="font-normal">
                    H 的這一列
                    <div className="flex gap-1">
                      {POSITIONS.map((p) => (
                        <span key={p} className="w-7 text-center">
                          {p}
                        </span>
                      ))}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PARITY_CHECKS.map((pc, k) => (
                  <tr key={pc.name} className="border-t border-parity-100">
                    <td className="py-0.5 pr-2 font-semibold text-parity-700">{pc.name}</td>
                    <td className="pr-2 font-mono text-lg">{pc.covered.map((j) => j + 1).join(', ')}</td>
                    <td>
                      <div className="flex gap-1">
                        {H74[k].map((b, j) => (
                          <span key={j} className={`grid h-7 w-7 place-items-center rounded-md font-mono text-lg font-bold ${s.step >= 2 && j === EX_POS - 1 ? 'ring-2 ring-sky-400' : ''} ${b ? 'bg-parity-100 text-parity-700' : 'bg-white text-slate-300'}`}>
                            {b}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-lg text-slate-700">
              盯著的位置加起來：0 → 燈暗，1 → 燈亮。{L} 盞燈合起來叫 syndrome（徵狀）<M>{`s = Hr^{T} = (${LAMP.map((x) => `s_${x.slice(1)}`).join(', ')})^{T}`}</M>
            </p>
            <p className="text-base text-slate-600">
              r = received word（收到的字）；<M>{'r^{T}'}</M> = transpose（轉置）：把 r 立成一欄
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-sky-50 text-sky-950" title="按欄讀：第 j 欄 hⱼ">
            <p className="text-lg text-slate-700">= 位置 j 被哪幾盞燈盯著</p>
            <div className="my-2">
              <Lamps bits={lampsAt(H74, EX_POS)} />
            </div>
            <p className="text-lg text-slate-700">
              位置 {EX_POS} 翻轉 → 第 {EX_POS} 欄 <M>{`h_${EX_POS}`}</M>：{vecText(exCol)}
            </p>
            <p className="mt-1 text-base text-slate-600">位置 j 翻轉，亮的就是第 j 欄（第 3 章證明）</p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 發送端：G 是 encoder 接線圖                                       */
/* ------------------------------------------------------------------ */

function GWiringSlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 items-start gap-5 text-xl lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-2">
        <MatrixView
          matrix={G74}
          name="G ="
          colLabels={LABELS}
          rowLabels={DATA_LABELS}
          cellClass={(i, j, v) => {
            if (s.step === 0 && i === EX_ROW) return v ? 'bg-amber-100 text-amber-900' : 'bg-amber-50 text-amber-300';
            if (s.step >= 1 && j === EX_COL) return v ? 'bg-sky-100 text-sky-900' : 'bg-sky-50 text-sky-300';
            return undefined;
          }}
        />
        <p className="max-w-[22rem] text-lg text-slate-600">
          第 i 列 <M>{'g_i'}</M> = 只有 <M>{'D_i = 1'}</M> 的訊息送出的 codeword
        </p>
      </div>
      <Reveal on={s.step >= 0}>
        <Box tone="bg-amber-50 text-amber-950" title={`按列讀：${K} 條資料線`}>
          <ul className="space-y-0.5 text-lg">
            {G_ROW_OUTPUTS.map((outs, i) => (
              <li key={i} className={i === EX_ROW ? 'font-semibold' : ''}>
                <span className="text-data-700">D{i + 1}</span> → {outs.join('、')}
              </li>
            ))}
          </ul>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-sky-50 text-sky-950" title={`按欄讀：${N} 條輸出線`}>
          <ul className="space-y-0.5 text-lg">
            {PARITY_INDICES.map((j) => (
              <li key={j} className={j === EX_COL ? 'font-semibold' : ''}>
                <span className="text-parity-700">{LABELS[j]}</span> = {G_COL_INPUTS[j].join(' ⊕ ')}
              </li>
            ))}
            <li>
              <span className="text-data-700">{DATA_LABELS.join('、')}</span>：直通的導線
            </li>
          </ul>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. G 的設計 ①：疊加                                                  */
/* ------------------------------------------------------------------ */

function SuperpositionSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const picked = message.flatMap((b, i) => (b ? [i] : []));
  const decomposition = picked.length > 1 ? `m = ${message.join('')} = ${picked.map(unitText).join(' + ')}` : `m = ${message.join('')}`;
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-2">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-sky-50 text-sky-950" title="例：拆成只有一個 1 的訊息">
          <div className="my-2 text-2xl">
            <M>{decomposition}</M>
          </div>
          <div className="space-y-1 rounded-xl bg-white/70 p-3 font-mono text-2xl">
            {picked.length === 0 && <div className="font-sans text-lg text-slate-500">訊息全 0 → c = 0000000</div>}
            {picked.map((i, k) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-5 text-right text-slate-400">{k ? '+' : ''}</span>
                <span className="w-10 font-sans text-lg text-slate-500">
                  g<sub>{i + 1}</sub>
                </span>
                <Word bits={G74[i]} />
              </div>
            ))}
            <div className="ml-[4.75rem] border-t border-slate-300" />
            <div className="flex items-center gap-3">
              <span className="w-5 text-right text-slate-400">=</span>
              <span className="w-10 font-sans text-lg font-semibold">c</span>
              <Word bits={c} />
            </div>
          </div>
          <p className="mt-2 text-lg text-slate-600">XOR 滿足疊加：訊息相加，codeword 也相加。哪幾個 data bit 是 1，就把 G 的那幾列加起來：<M>{'c = mG'}</M>。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-amber-50 text-amber-950" title="查表 vs. G">
          <table className="mt-2 w-full text-left text-lg">
            <thead>
              <tr className="text-base text-slate-500">
                <th className="pb-1 font-normal" />
                <th className="pb-1 font-normal">查表要存</th>
                <th className="pb-1 font-normal">G 只要</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-amber-100">
                <td className="py-2 font-semibold">{K} 個 data bit</td>
                <td>
                  <M>{`2^{${K}} = ${TABLE_ROWS}`}</M> 格
                </td>
                <td>{G74.length} 列</td>
              </tr>
              <tr className="border-t border-amber-100">
                <td className="py-2 font-semibold">如果有 {LONG.k} 個 data bit</td>
                <td>
                  <M>{`2^{${LONG.k}} \\approx ${sciTex(2 ** LONG.k)}`}</M> 格
                </td>
                <td className="font-bold text-emerald-700">{LONG.k} 列</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-lg text-slate-700">encoder 只是一組 XOR 接線，不用存表；data bit 越多，差別越大。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. G 的設計 ②③：系統碼；③ 由 ② 推出                                   */
/* ------------------------------------------------------------------ */

function SystematicSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  return (
    <div className="grid grid-cols-1 items-start gap-6 text-xl lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="space-y-2">
        <MatrixView
          matrix={G74}
          name="G ="
          colLabels={LABELS}
          rowLabels={DATA_LABELS}
          cellClass={(_, j, v) => (LAYOUT_74[j].role === 'data' ? (v ? 'bg-data-100 text-data-700' : 'bg-data-50 text-data-300') : undefined)}
        />
        <p className="max-w-[19rem] text-lg text-slate-600">
          位置 {DATA_POS} 那 {K} 欄：每欄只有一個 1
        </p>
      </div>
      <div className="space-y-4">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-data-50 text-data-700" title={`② 資料那 ${K} 欄是 identity matrix（單位矩陣）：systematic code（系統碼）`}>
            <p className="text-lg text-slate-700">位置 {DATA_POS} 是直通的導線：codeword 原封不動帶著訊息。</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl bg-white/80 px-3 py-2 text-lg text-slate-700">
              <span>
                c = <Word bits={c} className="text-xl" />
              </span>
              <span className="text-slate-400">→ 取位置 {DATA_POS} →</span>
              <span>
                <span className="font-mono text-xl font-bold text-data-700">{message.join('')}</span> = m
              </span>
            </div>
            <p className="mt-2 text-lg text-slate-600">接收端更正後直接取出這 {K} 位，不用反運算。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-emerald-50 text-emerald-900" title="③ 跟著 ② 成立：不同訊息 → 不同 codeword">
            <p className="text-lg text-slate-700">
              訊息不同，位置 {DATA_POS} 上的位元就不同，codeword 也就不同：{TABLE_ROWS} 種訊息送出 {DISTINCT} 個不同的 codeword，資訊沒有在編碼時遺失。
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. H 的設計 ①②：每一欄非零、互不相同                                   */
/* ------------------------------------------------------------------ */

function NonzeroDistinctSlide({ s }: { s: Stepper }) {
  const row = (label: ReactNode, bits: readonly Bit[], note?: ReactNode) => (
    <div className="flex items-center gap-4">
      <span className="w-44 text-lg text-slate-600">{label}</span>
      <Lamps bits={bits} size="sm" />
      {note && <span className="text-lg font-semibold">{note}</span>}
    </div>
  );
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-2">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-rose-50 text-rose-950" title="① 每一欄都不能是 0">
          <p className="text-lg text-slate-700">反例：把第 {ZERO_POS} 欄改成 0，沒有燈盯著位置 {ZERO_POS}</p>
          <div className="my-2">
            <MatrixView matrix={H_ZERO} name="H′ =" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={[ZERO_POS - 1]} colHighlightClass="bg-rose-200 text-rose-900" />
          </div>
          <div className="space-y-2">
            {row(<>H′：位置 {ZERO_POS} 被翻轉</>, lampsAt(H_ZERO, ZERO_POS), <span className="text-rose-700">{isZeroVector(lampsAt(H_ZERO, ZERO_POS)) ? '全暗：錯誤隱形' : ''}</span>)}
            {row(<>原本的 H</>, lampsAt(H74, ZERO_POS), <span className="text-emerald-700">抓得到</span>)}
          </div>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-amber-50 text-amber-950" title="② 每一欄都互不相同">
          <p className="text-lg text-slate-700">
            反例：第 {TWIN_B} 欄改成和第 {TWIN_A} 欄一樣
          </p>
          <div className="my-2">
            <MatrixView matrix={H_TWIN} name="H″ =" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={[TWIN_A - 1, TWIN_B - 1]} colHighlightClass="bg-amber-200 text-amber-900" />
          </div>
          <div className="space-y-2">
            {row(<>H″：位置 {TWIN_A} 被翻轉</>, lampsAt(H_TWIN, TWIN_A))}
            {row(
              <>H″：位置 {TWIN_B} 被翻轉</>,
              lampsAt(H_TWIN, TWIN_B),
              <span className="text-rose-700">{vecEquals(lampsAt(H_TWIN, TWIN_A), lampsAt(H_TWIN, TWIN_B)) ? '一樣：分不出是誰' : ''}</span>,
            )}
          </div>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. H 的設計 ③：3 盞燈看 7 個位置                                     */
/* ------------------------------------------------------------------ */

function SevenSlide({ s }: { s: Stepper }) {
  const more = [L + 1, LONG.m];
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-slate-50" title={`${L} 盞燈只有 2${sup(L)} = ${STATES} 種狀態`}>
          <div className="my-3 text-2xl">
            <M>{`2^{${L}} = ${STATES} = \\underbrace{1}_{\\text{全暗}} + \\underbrace{${PATTERNS}}_{\\text{亮法}}`}</M>
          </div>
          <p className="mt-2 text-lg text-slate-600">
            全暗留給「沒出錯」，剩 {PATTERNS} 種亮法：每個位置要一種專屬的（①②），最多 {PATTERNS} 個位置。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-emerald-50 text-emerald-950" title={`Hamming：${PATTERNS} 種全部用上`}>
          <div className="my-2 text-2xl">
            <M>{`\\text{位置數} = 2^{${L}} - 1 = ${PATTERNS}`}</M>
          </div>
          <p className="text-lg text-slate-700">要指出錯在哪一位，{L} 個檢查器能保護的長度已經到最大。</p>
          <p className="mt-1 text-lg text-slate-600">
            {PATTERNS} 個位置扣掉 {L} 個 parity bit，剩 {PATTERNS - L} 個 data bit。
          </p>
          <table className="mt-2 w-full text-left text-lg">
            <tbody>
              {more.map((l) => (
                <tr key={l} className="border-t border-emerald-100">
                  <td className="py-1">{l} 盞燈</td>
                  <td>
                    最多 <M>{`2^{${l}} - 1 = ${hammingN(l)}`}</M> 個位置
                  </td>
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
/* 7. H 的設計 ④：第 j 欄 = j 的二進位                                   */
/* ------------------------------------------------------------------ */

function BinarySlide({ s }: { s: Stepper }) {
  const lamps = column(H74, DEC_POS - 1);
  const value = syndromeToPosition(lamps);
  return (
    <div className="grid grid-cols-1 items-start gap-5 text-xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <Reveal on={s.step >= 0}>
        <div className="grid grid-cols-7 gap-1.5">
          {LAYOUT_74.map((p) => {
            const on = s.step >= 1 && p.position === DEC_POS;
            return (
              <div key={p.index} className={`flex flex-col items-center gap-1.5 rounded-xl border-2 bg-white py-2 ${on ? 'border-rose-400' : 'border-slate-200'}`}>
                <span className={`text-base font-semibold ${roleText(p.index)}`}>{p.label}</span>
                <ColumnVector bits={column(H74, p.index)} />
                <span className="text-2xl font-bold leading-none">{syndromeToPosition(column(H74, p.index))}</span>
                <span className="font-mono text-sm text-slate-500">{p.position.toString(2).padStart(L, '0')}₂</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-lg text-slate-600">
          {LAMP.join('、')} 各管二進位含 {PARITY_CHECKS.map((pc) => pc.bitValue).join('、')} 的位置 → 第 j 欄由上往下（{LAMP.join('、')}）是 j 的 {PARITY_CHECKS.map((pc) => pc.bitValue).join('、')} 位。
        </p>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-sky-50 text-sky-950" title="燈號讀成二進位 = 出錯位置">
          <div className="my-2 flex flex-wrap items-center gap-4">
            <Lamps bits={lamps} size="lg" order="read" />
            <span className="text-xl">
              {READ_NAMES} ={' '}
              <span className="font-mono text-2xl font-bold">{binText(lamps)}</span> → 位置 {value}
            </span>
          </div>
          <p className="mt-2 text-lg text-slate-700">欄的順序其實可以任意排：換順序只是重新編號，能力一樣。</p>
          <p className="mt-1 text-lg text-slate-600">選二進位順序，燈號直接就是位置，接收端不用查表。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 8. H 的設計 ⑤：parity bit 在 1、2、4                                 */
/* ------------------------------------------------------------------ */

function ParityPositionSlide({ s }: { s: Stepper }) {
  const std = unknownsPerRow(STD_PARITY);
  const alt = unknownsPerRow(ALT_PARITY);
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-2">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-parity-50 text-parity-700" title={`位置 ${PARITY_POS} 的欄只有一個 1`}>
          <div className="my-2">
            <MatrixView matrix={H74} name="H =" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={PARITY_INDICES.slice()} colHighlightClass="bg-parity-100 text-parity-800" />
          </div>
          <ul className="space-y-1 text-lg text-slate-800">
            {PARITY_CHECKS.map((pc, k) => (
              <li key={pc.name}>
                {std[k]} 個未知數 → <M>{eqTex(k)}</M>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-lg text-slate-600">{L} 組獨立的 XOR，同時算完，彼此不用等。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-slate-50" title={`對照：改放在最後的 ${ALT_PARITY.join('、')}`}>
          <div className="my-2">
            <MatrixView matrix={H74} name="H =" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={ALT_PARITY.map((p) => p - 1)} colHighlightClass="bg-rose-100 text-rose-800" />
          </div>
          <ul className="space-y-1 text-lg text-slate-800">
            {PARITY_CHECKS.map((pc, k) => (
              <li key={pc.name}>
                {pc.name} 那一列：<strong className="text-rose-700">{alt[k]}</strong> 個未知數
              </li>
            ))}
          </ul>
          <p className="mt-1 text-lg text-slate-600">parity bit 互相牽連：要先解聯立方程，才寫得出各自的公式。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 9. HGᵀ = 0：沒有雜訊，燈全暗（with the live c = mG → Hcᵀ demo）        */
/* ------------------------------------------------------------------ */

function HGtSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const Hc = matVec(H74, c);
  const ones = c.flatMap((b, j) => (b ? [j] : []));
  return (
    <div className="grid grid-cols-1 items-start gap-6 text-xl lg:grid-cols-[auto_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <MatrixView matrix={H74} name="H" size="sm" rowLabels={LAMP} />
          <span>·</span>
          <MatrixView matrix={transpose(G74)} name={<M>{'G^{T}'}</M>} size="sm" colLabels={G_LABELS} />
          <span>=</span>
          <MatrixView matrix={HGT} size="sm" rowLabels={LAMP} colLabels={G_LABELS} cellClass={() => 'bg-emerald-50 text-emerald-700'} />
        </div>
        <p className="max-w-[34rem] text-lg text-slate-700">
          第 i 欄 = 只有 <M>{'D_i = 1'}</M> 的訊息的 codeword <M>{'g_i'}</M>，送進 {L} 個檢查器。
        </p>
        <p className="max-w-[34rem] text-lg text-slate-600">
          {isZeroMatrix(HGT) ? (
            <>
              {HGT.length} × {HGT[0].length} 全是 0：每個 <M>{'g_i'}</M> 都讓 {L} 盞燈全暗。
            </>
          ) : (
            '✗ 不是零矩陣'
          )}
        </p>
      </div>
      <div className="space-y-4">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="疊加：任何 c = mG 都讓燈全暗">
            <div className="my-1 text-2xl">
              <M>{'Hc^{T} = H(mG)^{T} = (HG^{T})\\,m^{T} = 0'}</M>
            </div>
            <p className="text-lg text-slate-700">
              例：<M>{`c = ${c.join('')}`}</M>，是 1 的位置各點亮 H 的一欄（標色），逐列加起來：
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <MatrixView matrix={H74} size="sm" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={ones} colHighlightClass="bg-sky-200 text-sky-900" />
              <span className="text-slate-400">→</span>
              <ColumnVector bits={Hc} size="sm" cellClass="bg-emerald-50 text-emerald-700" />
              <Lamps bits={Hc} size="sm" />
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-emerald-50 text-emerald-900" title="反過來也對：怎麼造 = 怎麼驗">
            <div className="my-1 text-2xl font-bold">
              造得出的 {CODEWORDS} 個 codeword = 燈全暗的所有字串
            </div>
            <p className="text-lg text-slate-600">
              全部 {ALL_WORDS} 個 {N} 位元字串裡，一個不多、一個不少
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

export const CH2_SLIDES: DeckSlide<null>[] = [
  {
    title: '第 2 章：發送端與接收端',
    sub: '兩端各需要一個 XOR 電路：寫下來就是 G 和 H',
    steps: () => 3,
    render: (s) => <SenderReceiverSlide s={s} />,
    takeaway: (
      <>
        <Ph>G 是發送端怎麼造，</Ph>
        <Ph>H 是接收端怎麼驗：</Ph>
        <Ph>第 j 欄 = 位置 j 被哪幾盞燈盯著</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          第 1 章的 {L} 個 XOR 公式，做成硬體就是發送端的 encoder
          <ul className={NOTES_SUB}>
            <li>
              {K} 條資料線進、{N} 條線出；「哪條資料線接到哪條輸出線」記成 0/1 表格 = generator matrix G（下一頁細看）
            </li>
          </ul>
        </li>
        <li>
          → 接收端不知道原本送了什麼，只能檢查：{L} 個檢查器各做一組 XOR、各接一盞燈
          <ul className={NOTES_SUB}>
            <li>盯著的位置（含 parity bit 自己）記 1、沒盯著記 0 → H 的一列 = parity-check matrix；加起來 0 燈暗、1 燈亮</li>
            <li>
              {L} 盞燈合起來叫 syndrome s = Hrᵀ = {S_NAMES}ᵀ；r = received word，ᵀ（transpose）把 r 立成一欄，H 才能逐列去乘
            </li>
            <li>收到 codeword：每組都是偶數個 1 → 燈全暗（本章最後一頁證明 Hcᵀ = 0）</li>
          </ul>
        </li>
        <li>
          → 按欄讀：第 j 欄 hⱼ = 位置 j 被哪幾盞燈盯著
          <ul className={NOTES_SUB}>
            <li>
              例：位置 {EX_POS} → {vecText(column(H74, EX_POS - 1))}，{lampText(lampsAt(H74, EX_POS))}
            </li>
            <li>證明（r = c + eⱼ → s = hⱼ）留到第 3 章；H 的五個設計都從這句出發</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：發送端：G 是 encoder 接線圖',
    sub: `encoder 有 ${K} 條資料線、${N} 條輸出線：哪條接到哪條？`,
    steps: () => 2,
    render: (s) => <GWiringSlide s={s} />,
    takeaway: (
      <>
        <Ph>列 = 一條資料線接到哪；</Ph>
        <Ph>欄 = 一條輸出線是誰的 XOR</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          按列讀：第 i 列 gᵢ = 只有 Dᵢ = 1 的訊息送出的 codeword
          <ul className={NOTES_SUB}>
            <li>
              例：D{EX_ROW + 1} 那一列 {G74[EX_ROW].join('')} → D{EX_ROW + 1} 接到輸出 {G_ROW_POS[EX_ROW].join('、')}（{G_ROW_OUTPUTS[EX_ROW].join('、')}）
            </li>
          </ul>
        </li>
        <li>
          → 按欄讀：第 j 欄 = 第 j 條輸出線是哪幾個 data bit 的 XOR
          <ul className={NOTES_SUB}>
            <li>
              例：第 {EX_COL + 1} 欄 → {LABELS[EX_COL]} = {G_COL_INPUTS[EX_COL].join(' ⊕ ')}，就是第 1 章的公式
            </li>
            <li>資料欄只有一個 1：直通的導線</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 2 章：G 的設計 ①：疊加，只記 ${G74.length} 列`,
    sub: `${TABLE_ROWS} 種訊息，encoder 要存 ${TABLE_ROWS} 個 codeword 嗎？`,
    steps: () => 2,
    render: (s) => <SuperpositionSlide s={s} />,
    takeaway: (
      <>
        <Ph>XOR 可以疊加：</Ph>
        <Ph>記住 {G74.length} 列，</Ph>
        <Ph>就編得出全部 {CODEWORDS} 個 codeword</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          每個 parity bit 都是 data bit 的 XOR → 疊加：(m + m′) 編出來 = 各自編好再相加
          <ul className={NOTES_SUB}>
            <li>任何訊息都是幾個「只有一個 Dᵢ = 1」的訊息的和 → codeword 就是那幾個 gᵢ 的和：c = mG</li>
          </ul>
        </li>
        <li>
          → 和查表比
          <ul className={NOTES_SUB}>
            <li>
              查表：每種訊息存一個 codeword → 2{sup(K)} = {TABLE_ROWS} 格；如果有 {LONG.k} 個 data bit，要 2{sup(LONG.k)} ≈ {sciPlain(2 ** LONG.k)} 格，G 只要 {LONG.k} 列
            </li>
            <li>encoder 只是一組 XOR 接線，不用記憶體</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：G 的設計 ②③：資料原封不動',
    sub: '接收端修好錯以後，怎麼拿回訊息？',
    steps: () => 2,
    render: (s) => <SystematicSlide s={s} />,
    takeaway: (
      <>
        <Ph>資料原封不動帶著走，</Ph>
        <Ph>不同訊息一定得到不同 codeword</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          ② systematic code：G 的資料欄（位置 {DATA_POS}）每欄只有一個 1，合起來是 identity matrix
          <ul className={NOTES_SUB}>
            <li>這 {K} 條輸出線是直通導線 → 接收端更正後直接取出資料，不用反運算</li>
          </ul>
        </li>
        <li>
          → ③ 是 ② 的結果：訊息不同，資料位置就不同 → codeword 不同（rank G = {RANK_G}）
          <ul className={NOTES_SUB}>
            <li>
              反例（同時破壞 ②）：D{K} 接得和 D1 一樣 → {COLLIDE_MSGS[0].join('')} 和 {COLLIDE_MSGS[1].join('')} 都送出 {vecEquals(COLLIDE_WORDS[0], COLLIDE_WORDS[1]) ? COLLIDE_WORDS[0].join('') : '✗'}，沒有錯也分不出是誰
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：H 的設計 ①②：非零、互不相同',
    sub: '位置 j 出錯時亮的燈 = 第 j 欄：每一欄都要非零、互不相同',
    steps: () => 2,
    render: (s) => <NonzeroDistinctSlide s={s} />,
    takeaway: (
      <>
        <Ph>每一欄非零、互不相同：</Ph>
        <Ph>錯在哪，亮的燈就不同</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          ① 每一欄都不能是 0：第 j 欄全 0 = 沒有燈盯著位置 j
          <ul className={NOTES_SUB}>
            <li>
              反例：第 {ZERO_POS} 欄改成 0 → 位置 {ZERO_POS} 被翻轉時燈{lampText(lampsAt(H_ZERO, ZERO_POS))}，接收端以為沒事，錯誤隱形
            </li>
          </ul>
        </li>
        <li>
          → ② 每一欄都互不相同：兩欄一樣 = 兩個位置被同一組燈盯著
          <ul className={NOTES_SUB}>
            <li>
              反例：第 {TWIN_B} 欄改成和第 {TWIN_A} 欄一樣 → 位置 {TWIN_A} 或 {TWIN_B} 出錯都是 {lampText(lampsAt(H_TWIN, TWIN_B))}，分不出是誰
            </li>
            <li>真正的 H：{N} 欄都非零、兩兩不同 → 每個位置一種專屬的亮法</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 2 章：H 的設計 ③：${L} 盞燈看 ${PATTERNS} 個位置`,
    sub: `2${sup(L)} − 1 = ${PATTERNS}：最多就是 ${PATTERNS} 個，Hamming 全部用上`,
    steps: () => 2,
    render: (s) => <SevenSlide s={s} />,
    takeaway: (
      <>
        <Ph>
          {L} 盞燈只有 {PATTERNS} 種亮法：
        </Ph>
        <Ph>最多分辨 {PATTERNS} 個位置</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          {L} 盞燈 = 2{sup(L)} = {STATES} 種狀態；全暗留給「沒出錯」→ 剩 {PATTERNS} 種亮法
          <ul className={NOTES_SUB}>
            <li>①② 要求每個位置一種專屬亮法 → 最多 {PATTERNS} 個位置</li>
            <li>
              硬塞第 {PATTERNS + 1} 個位置：只能拿全暗（違反 ①）或拿別人的亮法（違反 ②）
            </li>
          </ul>
        </li>
        <li>
          → Hamming 把 {PATTERNS} 種全部用上：{L} 個 parity bit，位置數 2{sup(L)} − 1 = {PATTERNS}，剩 {PATTERNS} − {L} = {K} 個 data bit
          <ul className={NOTES_SUB}>
            <li>
              多一盞燈 → {hammingN(L + 1)} 個位置；{LONG.m} 盞 → {LONG.n} 個（第 4 章寫成 <M>{'2^{\\ell} \\ge n + 1'}</M>）
            </li>
            <li>這是「更正 1 個錯」的上限；只要偵測、不必指出位置，欄可以重複，code 可以更長</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：H 的設計 ④：第 j 欄 = j 的二進位',
    sub: '欄的順序可以任意排：Hamming 選了二進位順序',
    steps: () => 2,
    render: (s) => <BinarySlide s={s} />,
    takeaway: (
      <>
        <Ph>燈號讀成二進位，</Ph>
        <Ph>就是出錯位置的編號</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          ①②③ 只要求 {N} 欄是 {N} 種不同的非零亮法，沒規定順序
          <ul className={NOTES_SUB}>
            <li>
              {LAMP.join('、')} 各管二進位含 {PARITY_CHECKS.map((pc) => pc.bitValue).join('、')} 的位置 → 第 j 欄由上往下是 j 的 {PARITY_CHECKS.map((pc) => pc.bitValue).join('、')} 位
            </li>
          </ul>
        </li>
        <li>
          → {L} 盞燈照 {READ_NAMES} 讀成二進位，直接是出錯位置
          <ul className={NOTES_SUB}>
            <li>
              例：{lampText(column(H74, DEC_POS - 1))} → {binText(column(H74, DEC_POS - 1))} → 位置 {DEC_POS}
            </li>
            <li>換欄的順序 = 位置重新編號，能力一樣，只是要多一張「燈號 → 位置」對照表（教科書稱 equivalent code）</li>
            <li>二進位順序是工程上的選擇：不用查表</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 2 章：H 的設計 ⑤：${nobreak(`parity bit 在 ${PARITY_POS}`)}`,
    sub: '每個 parity bit 只出現在一條檢查裡',
    steps: () => 2,
    render: (s) => <ParityPositionSlide s={s} />,
    takeaway: (
      <>
        <Ph>每條檢查只含一個 parity bit：</Ph>
        <Ph>{L} 組 XOR 各算各的</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          位置 {PARITY_POS} 的二進位只有一個 1 → H 的這 {L} 欄是 identity column
          <ul className={NOTES_SUB}>
            <li>每條方程只有一個未知數 → 移項就用 data bit 算出，公式直接從 H 的那一列讀：第 1 章的 {L} 個公式</li>
            <li>encoder = {L} 組獨立的 XOR，同時算完，彼此不用等</li>
          </ul>
        </li>
        <li>
          → 對照：parity bit 改放在最後的 {ALT_PARITY.join('、')}（不是錯，只是比較麻煩）
          <ul className={NOTES_SUB}>
            <li>
              {L} 條方程分別有 {unknownsPerRow(ALT_PARITY).join('、')} 個未知數 → parity bit 互相牽連，要等彼此算完
            </li>
            <li>想同時算，得先解一次聯立方程（Gaussian elimination）：做得到，但公式不能再從 H 直接讀出來</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：HGᵀ = 0：沒有雜訊，燈全暗',
    sub: '發送端造的每個 codeword，接收端都放行嗎？',
    steps: () => 3,
    render: (s) => <HGtSlide s={s} />,
    takeaway: (
      <>
        <Ph>送出的每個 codeword，</Ph>
        <Ph>
          沒有雜訊時都讓 {L} 盞燈全暗
        </Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          HGᵀ 的第 i 欄 = 檢查器套在 gᵢ 上（gᵢ = 只有 Dᵢ = 1 的訊息的 codeword）
          <ul className={NOTES_SUB}>
            <li>
              {HGT.length} × {HGT[0].length} 全是 0：每個 gᵢ 都讓 {L} 盞燈全暗
            </li>
          </ul>
        </li>
        <li>
          → 疊加：任何 c = mG 都讓燈全暗，Hcᵀ = (HGᵀ)mᵀ = 0（也常寫成 GHᵀ = 0）
          <ul className={NOTES_SUB}>
            <li>現場示範：用上方選單換 m，c 裡是 1 的那幾欄 hⱼ 加起來永遠是 0</li>
          </ul>
        </li>
        <li>
          → 反過來也成立：燈全暗的字串都是發送端造得出的（課本寫成 C = {'{mG}'} = ker H）
          <ul className={NOTES_SUB}>
            <li>
              數個數：rank G = {RANK_G} → 造得出 2{sup(RANK_G)} = {2 ** RANK_G} 個；rank H = {RANK_H} → 燈全暗的字串構成 {N} − {RANK_H} = {N - RANK_H} 維，也是 {2 ** (N - RANK_H)} 個 → 相等
            </li>
            <li>燈全暗不代表沒有雜訊：雜訊若把一個 codeword 變成另一個，燈也全暗（第 3、4 章）</li>
          </ul>
        </li>
      </ul>
    ),
  },
];
