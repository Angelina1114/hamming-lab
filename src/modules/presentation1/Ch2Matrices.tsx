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
  matchingColumn,
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
import { MessageInput } from '../../components/Bits';
import { MatrixView, ColumnVector } from '../../components/MatrixView';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal, sub } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** 7 positions, 4 data bits, 3 checkers = 3 warning lamps */
const N = N7;
const K = K4;
const R = H74.length;
/** 3 lamps: 2³ states; all but "all dark" can name a position */
const STATES = 2 ** R;
const PATTERNS = STATES - 1;
const CODEWORDS = codewords74().length;
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
/** a lamp state as bits in H's row order (P1 first) from its binary value */
const lampBits = (v: number): Bit[] => Array.from({ length: R }, (_, i) => ((v >> i) & 1) as Bit);
/** reading the lamps as a binary number: P4 P2 P1, the most significant first */
const READ = [...LAMP.keys()].reverse();
const eqTex = (k: number) => `${sub(PARITY_CHECKS[k].name)} = ${PARITY_CHECKS[k].dataTerms.map(sub).join(' \\oplus ')}`;
/** 3 → '³', 4 → '₄': exponents and subscripts in plain text */
const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
const subs = (n: number) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)]);
/** 1.3 × 10³⁶ in plain text (speaker notes) */
const sciPlain = (x: number) => {
  const { mantissa, exponent } = sciParts(x);
  return `${mantissa} × 10${sup(exponent)}`;
};
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);

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
/** H design ④: the example read on the decoder slide */
const DEC_POS = TWIN_A;
/** H design ⑤: how many parity bits each check contains (parity at 1, 2, 4 versus at the last three positions) */
const STD_PARITY = PARITY_INDICES.map((i) => LAYOUT_74[i].position);
const ALT_PARITY = LAYOUT_74.slice(-R).map((p) => p.position);
const unknownsPerRow = (parity: number[]) => H74.map((row) => parity.filter((p) => row[p - 1] === 1).length);
/** G design ③: D4 wired exactly like D1 (row 4 = row 1), so two messages collide */
const G_COLLIDE: Matrix = G74.map((r, i) => (i === K - 1 ? [...G74[0]] : r));
const COLLIDE_MSGS = [unitVector(K, 0), unitVector(K, K - 1)];
const COLLIDE_WORDS = COLLIDE_MSGS.map((m) => vecMat(m, G_COLLIDE));
const HGT = matMul(H74, transpose(G74));
const G_LABELS = G74.map((_, j) => (
  <span key={j}>
    g<sub>{j + 1}</sub>
  </span>
));

/* ------------------------------------------------------------------ */
/* Shared pictures                                                     */
/* ------------------------------------------------------------------ */

/** The receiver's warning lamps in H's row order (P1, P2, P4): lit = that checker sees an odd number of 1s. */
function Lamps({ bits, size = 'md' }: { bits: readonly Bit[]; size?: 'sm' | 'md' | 'lg' }) {
  const d = size === 'sm' ? 'h-5 w-5' : size === 'lg' ? 'h-10 w-10' : 'h-7 w-7';
  return (
    <span className="inline-flex items-end gap-2 align-middle" role="img" aria-label={`警示燈${lampText(bits)}`}>
      {bits.map((b, i) => (
        <span key={LAMP[i]} className="inline-flex flex-col items-center gap-0.5">
          <span className={`${d} rounded-full border-2 ${b ? 'border-rose-500 bg-rose-400 shadow-[0_0_10px_3px_rgba(244,63,94,0.45)]' : 'border-slate-300 bg-slate-200'}`} />
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
/* 1. 發送端與接收端                                                     */
/* ------------------------------------------------------------------ */

function SenderReceiverSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
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
    <span className={`rounded-2xl border-2 px-4 py-2 text-center ${tone}`}>
      <span className="block text-xl font-bold">{title}</span>
      <span className="block text-base">{note}</span>
    </span>
  );
  return (
    <div className="space-y-4 text-xl">
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50 px-4 py-3">
        {stop(`${K} 個資料位元`, <Word bits={message} />)}
        {arrow()}
        {machine('border-data-300 bg-data-50 text-data-700', '發送端：編碼器', <>接線圖 = G</>)}
        {arrow()}
        {stop(`送出 ${N} 個位元`, <Word bits={c} />)}
        {arrow('雜訊')}
        {machine('border-parity-300 bg-parity-50 text-parity-700', '接收端：檢查器', <>檢查電路 = H</>)}
        {arrow()}
        {stop(`${R} 盞警示燈`, <Lamps bits={matVec(H74, c)} />)}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-data-50 text-data-700" title="發送端：怎麼造">
            <div className="my-1 text-3xl">
              <M>{'c = mG'}</M>
            </div>
            <p className="text-lg text-slate-700">
              {K} 條資料線進、{N} 條線出，每條輸出線是幾個資料位元的 XOR。
            </p>
            <p className="text-lg text-slate-600">
              G（{G74.length} × {N}）= 這張接線圖
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-parity-50 text-parity-700" title="接收端：怎麼驗">
            <div className="my-1 text-3xl">
              <M>{'Hc^{T} = 0'}</M>
            </div>
            <p className="text-lg text-slate-700">
              {R} 個檢查器各做一組 XOR、各接一盞燈；合法 codeword 讓燈全暗。
            </p>
            <p className="text-lg text-slate-600">
              H（{R} × {N}）= 這 {R} 個檢查器
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-emerald-50 text-emerald-800" title="同一個碼的兩個視角">
            <div className="my-1 text-3xl">
              <M>{'C = \\{mG\\} = \\ker H'}</M>
            </div>
            <p className="text-lg text-slate-700">
              發送端造得出的 {CODEWORDS} 個 codeword，正好是接收端放行的全部字串。
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 發送端：G 是編碼器接線圖                                            */
/* ------------------------------------------------------------------ */

function GWiringSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4 text-xl">
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
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
          <p className="text-lg text-slate-600">
            第 i 列 = 只按下 <M>{'D_i'}</M> 時送出的 codeword
          </p>
        </div>
        <Reveal on={s.step >= 0}>
          <Box tone="bg-amber-50 text-amber-950" title="按列讀：Dᵢ 接到哪些輸出">
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
          <Box tone="bg-sky-50 text-sky-950" title="按欄讀：輸出線 = 誰的 XOR">
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
      <p className="rounded-2xl bg-slate-50 px-4 py-2 text-lg text-slate-700">
        同一張接線圖：按下哪幾個開關，就把那幾列加起來 → <M>{'c = mG'}</M>。
      </p>
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
  const decomposition = picked.length ? `m = ${message.join('')} = ${picked.map((i) => `e_${i + 1}`).join(' + ')}` : `m = ${message.join('')}`;
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-2">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-sky-50 text-sky-950" title="XOR 可以疊加：訊息相加，codeword 也相加">
          <div className="my-2 text-2xl">
            <M>{decomposition}</M>
          </div>
          <div className="space-y-1 rounded-xl bg-white/70 p-3 font-mono text-2xl">
            {picked.length === 0 && <div className="font-sans text-lg text-slate-500">沒有按下任何開關 → c = 0000000</div>}
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
          <p className="mt-2 text-lg text-slate-600">
            只要記住 {K} 個單位訊息的 codeword（G 的 {G74.length} 列），任何訊息都拼得出來。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-amber-50 text-amber-950" title="查表 vs. 生成矩陣">
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
                <td className="py-2 font-semibold">
                  ({N},{K})
                </td>
                <td>
                  <M>{`2^{${K}} = ${TABLE_ROWS}`}</M> 格
                </td>
                <td>{G74.length} 列</td>
              </tr>
              <tr className="border-t border-amber-100">
                <td className="py-2 font-semibold">
                  ({LONG.n},{LONG.k})
                </td>
                <td>
                  <M>{`2^{${LONG.k}} \\approx ${sciTex(2 ** LONG.k)}`}</M> 格
                </td>
                <td className="font-bold text-emerald-700">{LONG.k} 列</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-lg text-slate-700">編碼器只是一組 XOR 接線，不用存表；碼越長，差別越大。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. G 的設計 ②③：系統碼、rank G = 4                                   */
/* ------------------------------------------------------------------ */

function SystematicSlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-2">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-data-50 text-data-700" title={`② 資料欄是 I${subs(K)}：系統碼`}>
          <div className="my-2">
            <MatrixView
              matrix={G74}
              name="G ="
              colLabels={LABELS}
              rowLabels={DATA_LABELS}
              cellClass={(_, j, v) => (LAYOUT_74[j].role === 'data' ? (v ? 'bg-data-100 text-data-700' : 'bg-white text-data-300') : undefined)}
            />
          </div>
          <p className="text-lg text-slate-700">
            位置 {DATA_POS} 是直通的導線：codeword 原封不動帶著訊息（Systematic Code）。
          </p>
          <p className="text-lg text-slate-600">接收端更正後，直接取出這 {K} 位，不用反運算。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-emerald-50 text-emerald-900" title={`③ rank G = ${RANK_G}：資訊不會遺失`}>
          <p className="text-lg text-slate-700">
            {G74.length} 列互相獨立 → 不同訊息一定得到不同 codeword。由 ② 就看得出：訊息不同，資料位置就不同。
          </p>
          <div className="mt-3 rounded-xl bg-white/80 p-3">
            <div className="text-lg font-semibold text-rose-700">
              反例：D{K} 接得和 D1 一樣（第 {K} 列 = 第 1 列）
            </div>
            <table className="mt-1 font-mono text-2xl">
              <tbody>
                {COLLIDE_MSGS.map((m, k) => (
                  <tr key={k}>
                    <td className="pr-3 font-sans text-lg text-slate-500">m = {m.join('')}</td>
                    <td className="pr-3 text-slate-400">→</td>
                    <td className="font-bold text-rose-700">{COLLIDE_WORDS[k].join('')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-lg text-slate-600">
              {vecEquals(COLLIDE_WORDS[0], COLLIDE_WORDS[1]) ? '同一個 codeword' : '✗'}（rank 只有 {rank(G_COLLIDE)}）：一個錯都沒有，也分不出原本是誰。
            </p>
          </div>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. 接收端：H 的每一列是一盞燈                                          */
/* ------------------------------------------------------------------ */

function HRowsSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const exCol = column(H74, EX_POS - 1);
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-slate-50" title="每個檢查器 = 一組 XOR = H 的一列">
          <table className="w-full text-left">
            <thead>
              <tr className="text-base text-slate-500">
                <th className="py-1 pr-3 font-normal">檢查器</th>
                <th className="pr-3 font-normal">盯著的位置</th>
                <th className="font-normal">
                  H 的這一列
                  <div className="mt-0.5 flex gap-1 text-sm">
                    {POSITIONS.map((p) => (
                      <span key={p} className="w-8 text-center">
                        {p}
                      </span>
                    ))}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {PARITY_CHECKS.map((pc, i) => (
                <tr key={pc.name} className="border-t border-slate-200">
                  <td className="py-1.5 pr-3 font-semibold text-parity-700">{pc.name}</td>
                  <td className="pr-3 font-mono text-lg">{pc.covered.map((j) => j + 1).join(', ')}</td>
                  <td>
                    <div className="flex gap-1">
                      {H74[i].map((b, j) => (
                        <span key={j} className={`grid h-8 w-8 place-items-center rounded-lg font-mono text-xl font-bold ${b ? 'bg-parity-100 text-parity-700' : 'bg-white text-slate-300'}`}>
                          {b}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-lg text-slate-600">盯著的位置（含同位位元自己）加起來：0 → 燈暗，1 → 燈亮。</p>
        </Box>
      </Reveal>
      <div className="space-y-4">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-parity-50 text-parity-700" title={`${R} 盞燈 = Syndrome（徵狀）`}>
            <div className="flex flex-wrap items-center gap-4 text-slate-800">
              <Lamps bits={matVec(H74, c)} />
              <span className="text-lg">
                <M>{'s = Hr^{T}'}</M>；收到合法 codeword：<M>{'Hc^{T} = 0'}</M>，燈全暗
              </span>
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-sky-50 text-sky-950" title="按欄讀：第 j 欄 = 位置 j 被哪幾盞燈盯著">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-lg">
                例：位置 {EX_POS} → <M>{`(${exCol.join(',')})^{T}`}</M>
              </span>
              <Lamps bits={lampsAt(H74, EX_POS)} />
            </div>
            <p className="mt-1 text-lg text-slate-600">只有位置 j 被翻轉，亮的就是第 j 欄的那幾盞（第 3 章證明）。</p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 6. H 的設計 ①②：每一欄非零、互不相同                                   */
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
/* 7. H 的設計 ③：r 盞燈最多看 2^r − 1 個位置                             */
/* ------------------------------------------------------------------ */

function SevenSlide({ s }: { s: Stepper }) {
  const more = [R + 1, LONG.m];
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-slate-50" title={`${R} 盞燈只有 2${sup(R)} = ${STATES} 種狀態`}>
          <div className="mt-2 grid grid-cols-4 gap-2">
            {Array.from({ length: STATES }, (_, v) => {
              const bits = lampBits(v);
              const owner = matchingColumn(bits) + 1;
              return (
                <div key={v} className={`flex flex-col items-center gap-1 rounded-xl border-2 bg-white p-2 ${owner === 0 ? 'border-emerald-300' : 'border-slate-200'}`}>
                  <Lamps bits={bits} size="sm" />
                  <span className={`text-lg font-semibold ${owner === 0 ? 'text-emerald-700' : 'text-slate-800'}`}>{owner === 0 ? '沒出錯' : `位置 ${owner}`}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-lg text-slate-600">
            全暗留給「沒出錯」，剩 {PATTERNS} 種亮法：每個位置要一種專屬的（①②），最多 {PATTERNS} 個位置。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-emerald-50 text-emerald-950" title={`Hamming：${PATTERNS} 種全部用上`}>
          <div className="my-2 text-2xl">
            <M>{`n = 2^{${R}} - 1 = ${PATTERNS}`}</M>
          </div>
          <p className="text-lg text-slate-700">要指出錯在哪一位，{R} 個檢查器能保護的長度已經到最大。</p>
          <p className="mt-1 text-lg text-slate-600">
            第 1 章的 <M>{'k + r \\le 2^r - 1'}</M>：{PATTERNS} 個位置扣掉 {R} 個同位位元，剩 {K} 個資訊位元。
          </p>
          <table className="mt-2 w-full text-left text-lg">
            <tbody>
              {more.map((r) => (
                <tr key={r} className="border-t border-emerald-100">
                  <td className="py-1">{r} 盞燈</td>
                  <td>
                    最多 <M>{`2^{${r}} - 1 = ${hammingN(r)}`}</M> 個位置
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
/* 8. H 的設計 ④：第 j 欄 = j 的二進位                                   */
/* ------------------------------------------------------------------ */

function BinarySlide({ s }: { s: Stepper }) {
  const lamps = column(H74, DEC_POS - 1);
  const value = syndromeToPosition(lamps);
  return (
    <div className="grid grid-cols-1 gap-5 text-xl lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Reveal on={s.step >= 0}>
          <div className="grid grid-cols-7 gap-1.5">
            {LAYOUT_74.map((p) => (
              <div key={p.index} className="flex flex-col items-center gap-1 rounded-xl border-2 border-slate-200 bg-white py-1.5">
                <span className={`text-sm font-semibold ${roleText(p.index)}`}>{p.label}</span>
                <ColumnVector bits={column(H74, p.index)} size="sm" />
                <span className="text-lg font-bold leading-none">{syndromeToPosition(column(H74, p.index))}</span>
                <span className="font-mono text-xs text-slate-500">{p.position.toString(2).padStart(R, '0')}₂</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-lg text-slate-600">
            <M>{'P_b'}</M> 管二進位含 b 的位置 → 第 j 欄由上往下是 j 的 1、2、4 位。
          </p>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="燈號讀成二進位 = 出錯位置">
            <div className="flex flex-wrap items-center gap-4">
              <Lamps bits={lamps} />
              <span className="text-lg">
                {READ.map((i) => LAMP[i]).join(' ')} ={' '}
                <span className="font-mono font-bold">
                  {READ.map((i) => lamps[i]).join('')}₂ = {value}
                </span>{' '}
                → 翻轉位置 {value}
              </span>
            </div>
          </Box>
        </Reveal>
      </div>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-slate-50" title={`硬體：${R}-to-${STATES} 解碼器（Decoder）`}>
          <ol className="mt-1 grid grid-cols-2 gap-1.5 text-lg">
            {Array.from({ length: STATES }, (_, j) => {
              const target = matchingColumn(lampBits(j)) + 1;
              return (
                <li key={j} className={`rounded-lg border-2 px-2 py-0.5 ${j === value ? 'border-rose-400 bg-rose-50 font-semibold text-rose-800' : 'border-slate-200 bg-white text-slate-600'}`}>
                  <span className="font-mono">{j}</span>：{target === 0 ? '沒出錯，不接' : `翻轉位置 ${target}`}
                </li>
              );
            })}
          </ol>
          <p className="mt-2 text-lg text-slate-600">欄的順序可以任意排：換順序 = 位置重新編號，是等價的碼。二進位順序讓燈號直接是位置，不用查表。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 9. H 的設計 ⑤：同位位元放在 1、2、4                                   */
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
          <p className="mt-1 text-lg text-slate-600">{R} 組獨立的 XOR，同時算完，彼此不用等。</p>
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
          <p className="mt-1 text-lg text-slate-600">同位位元互相牽連：要先解聯立方程，才寫得出各自的公式。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10. HGᵀ = 0：沒有雜訊，燈全暗                                          */
/* ------------------------------------------------------------------ */

function HGtSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4 text-xl">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <MatrixView matrix={H74} name="H" size="sm" rowLabels={LAMP} />
          <span>·</span>
          <MatrixView matrix={transpose(G74)} name={<M>{'G^{T}'}</M>} size="sm" colLabels={G_LABELS} />
          <span>=</span>
          <MatrixView matrix={HGT} size="sm" rowLabels={LAMP} colLabels={G_LABELS} cellClass={() => 'bg-emerald-50 text-emerald-700'} />
        </div>
        <div className="min-w-0 flex-1 basis-72 space-y-1">
          <p>
            第 (i, j) 格 = 檢查器 i 看 <M>{'g_j'}</M>（只按下 <M>{'D_j'}</M> 時送出的 codeword）。
          </p>
          <p className="text-lg text-slate-600">
            {isZeroMatrix(HGT) ? (
              <>
                {HGT.length} × {HGT[0].length} 全是 0：每個 <M>{'g_j'}</M> 都讓 {R} 盞燈全暗。
              </>
            ) : (
              '✗ 不是零矩陣'
            )}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="疊加：任何 c = mG 都讓燈全暗">
            <div className="my-1 text-2xl">
              <M>{'Hc^{T} = H(mG)^{T} = (HG^{T})\\,m^{T} = 0'}</M>
            </div>
            <p className="text-lg text-slate-700">送出的任何東西，途中沒有雜訊，接收端的燈全部不亮。</p>
            <p className="text-lg text-slate-600">
              轉置兩邊，也常寫成 <M>{'GH^{T} = 0'}</M>。
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-emerald-50 text-emerald-900" title="反過來也對：怎麼造 = 怎麼驗">
            <div className="my-1 text-2xl">
              <M>{'C = \\{mG\\} = \\ker H'}</M>
            </div>
            <p className="text-lg text-slate-700">
              燈全暗的 {N} 位元字串，正好是發送端造得出的 {CODEWORDS} 個 codeword。
            </p>
            <p className="text-lg text-slate-600">
              兩邊都是 <M>{`2^{${RANK_G}}`}</M> 個：rank G = {RANK_G}，dim ker H = {N} − {RANK_H} = {N - RANK_H}。
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 11. 實例：c = mG、Hcᵀ = 0                                             */
/* ------------------------------------------------------------------ */

function MatrixSlide({ s }: { s: Stepper }) {
  const { message, toggleBit } = useMessage();
  const c = encode74(message);
  const rows = message.flatMap((b, i) => (b ? [i] : []));
  const Hc = matVec(H74, c);
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-center gap-4">
        <MessageInput message={message} onToggle={toggleBit} size="md" />
        <span>
          <M>{`m = ${message.join('')}`}</M>，<M>{`c = mG = ${c.join('')}`}</M>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div>
          <div className="mb-1 text-lg font-semibold text-data-700">發送端 c = mG：把 m 裡是 1 的列加起來</div>
          <MatrixView matrix={G74} name="G =" colLabels={LABELS} rowLabels={DATA_LABELS} highlightRows={rows} dimRows={G74.map((_, i) => i).filter((i) => !rows.includes(i))} />
        </div>
        <Reveal on={s.step >= 1}>
          <div className="mb-1 text-lg font-semibold text-parity-700">接收端 Hcᵀ = {R} 盞燈：把 c 裡是 1 的欄加起來</div>
          <div className="flex flex-wrap items-center gap-3">
            <MatrixView matrix={H74} name="H =" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={c.flatMap((b, j) => (b ? [j] : []))} />
            <span className="text-2xl">·</span>
            <ColumnVector bits={c} label={<M>{'c^T ='}</M>} size="sm" />
            <span className="text-2xl">=</span>
            <span className="flex flex-col items-center gap-2">
              <ColumnVector bits={Hc} size="sm" cellClass="bg-emerald-50 text-emerald-700" />
              <Lamps bits={Hc} size="sm" />
            </span>
          </div>
        </Reveal>
      </div>
      <p className="text-lg text-slate-600">
        {s.step === 0 ? '發送端：編碼就是 c = mG，按下的開關各送出 G 的一列，疊加起來就是 c。' : `接收端：c 裡是 1 的位置各點亮 H 的一欄，疊加起來是 ${Hc.join('')}：${lampText(Hc)}。`}
      </p>
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
        <Ph>同一個碼的兩個視角</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          第 1 章的 {R} 個 XOR 公式，做成硬體就是發送端的編碼器
          <ul className={NOTES_SUB}>
            <li>
              {K} 條資料線進、{N} 條線出；每條輸出線是幾個資料位元的 XOR
            </li>
            <li>「哪條資料線接到哪條輸出線」記成 0/1 表格 = 生成矩陣 G，c = mG 就是「怎麼造」</li>
          </ul>
        </li>
        <li>
          → 接收端不知道原本送了什麼，只能檢查
          <ul className={NOTES_SUB}>
            <li>
              {R} 個檢查器各做一組 XOR、各接一盞警示燈 = 同位檢查矩陣 H
            </li>
            <li>合法 codeword 讓燈全暗：Hcᵀ = 0 就是「怎麼驗」</li>
          </ul>
        </li>
        <li>
          → 兩者描述同一個碼：發送端造得出的，正好是接收端放行的
          <ul className={NOTES_SUB}>
            <li>
              C = {'{mG}'} = ker H，一共 {CODEWORDS} 個 codeword（本章最後證明）
            </li>
            <li>接下來：先看 G 怎麼接、為什麼這樣接，再看 H 的每一盞燈</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：發送端：G 是編碼器接線圖',
    sub: '第 i 列 = Dᵢ 接到哪些輸出；第 j 欄 = 第 j 條輸出線的 XOR',
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
          按列讀：第 i 列 = 只按下 Dᵢ（訊息只有 Dᵢ = 1）時送出的 codeword
          <ul className={NOTES_SUB}>
            <li>
              例：D{EX_ROW + 1} 那一列 {G74[EX_ROW].join('')} → D{EX_ROW + 1} 接到輸出 {G_ROW_POS[EX_ROW].join('、')}（{G_ROW_OUTPUTS[EX_ROW].join('、')}）
            </li>
            <li>每一列就是「Dᵢ 這條線接到哪些輸出」</li>
          </ul>
        </li>
        <li>
          → 按欄讀：第 j 欄 = 第 j 條輸出線是哪幾個資料位元的 XOR
          <ul className={NOTES_SUB}>
            <li>
              例：第 {EX_COL + 1} 欄 ({column(G74, EX_COL).join(',')}) → {LABELS[EX_COL]} = {G_COL_INPUTS[EX_COL].join(' ⊕ ')}，就是第 1 章的公式
            </li>
            <li>資料欄只有一個 1：直通的導線</li>
            <li>按下哪幾個開關，就把那幾列加起來：c = mG</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 2 章：G 的設計 ①：疊加，只記 ${G74.length} 列`,
    sub: 'XOR 滿足疊加：訊息相加，codeword 也相加',
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
          每個同位位元都是資料位元的 XOR → 疊加：(m + m′) 編出來 = 各自編好再相加
          <ul className={NOTES_SUB}>
            <li>任何訊息都是幾個單位訊息 eᵢ 的和 → codeword 就是對應那幾個 gᵢ 的和</li>
            <li>
              只要記住 {K} 個單位訊息的 codeword = G 的 {G74.length} 列
            </li>
          </ul>
        </li>
        <li>
          → 和查表比
          <ul className={NOTES_SUB}>
            <li>
              查表：每種訊息存一個 codeword → 2{sup(K)} = {TABLE_ROWS} 格
            </li>
            <li>
              Hamming({LONG.n},{LONG.k})：查表要 2{sup(LONG.k)} ≈ {sciPlain(2 ** LONG.k)} 格，G 只要 {LONG.k} 列
            </li>
            <li>編碼器只是一組 XOR 接線，不用記憶體</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：G 的設計 ②③：資料原封不動',
    sub: `資料欄是單位矩陣；rank G = ${RANK_G}`,
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
          ② 系統碼（Systematic Code）：G 的資料欄（位置 {DATA_POS}）合起來是 I{subs(K)}
          <ul className={NOTES_SUB}>
            <li>這 {K} 條輸出線就是直通導線，codeword 裡原封不動帶著訊息</li>
            <li>
              接收端更正後，直接從位置 {DATA_POS} 取出資料，不用反運算
            </li>
          </ul>
        </li>
        <li>
          → ③ rank G = {RANK_G}：{G74.length} 列互相獨立
          <ul className={NOTES_SUB}>
            <li>不同訊息一定得到不同 codeword，資訊沒有在編碼時遺失</li>
            <li>由 ② 就看得出：訊息不同，資料位置上的位元就不同</li>
            <li>
              反例：D{K} 接得和 D1 一樣 → {COLLIDE_MSGS[0].join('')} 和 {COLLIDE_MSGS[1].join('')} 都送出 {COLLIDE_WORDS[0].join('')}
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：接收端：H 的每一列是一盞燈',
    sub: `${R} 個檢查器 = ${R} 盞警示燈 = Syndrome（徵狀）`,
    steps: () => 3,
    render: (s) => <HRowsSlide s={s} />,
    takeaway: (
      <>
        <Ph>每一列是一個檢查器、一盞燈；</Ph>
        <Ph>第 j 欄 = 位置 j 被哪幾盞燈盯著</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          接收端把第 1 章的 {R} 個檢查做成 {R} 個檢查器
          <ul className={NOTES_SUB}>
            <li>每個檢查器 = 一組 XOR，把盯著的位置（含同位位元自己）加起來</li>
            <li>盯著記 1、沒盯著記 0 → H 的一列</li>
          </ul>
        </li>
        <li>
          → {R} 個輸出 = {R} 盞警示燈，合起來叫 Syndrome（徵狀）s = Hrᵀ
          <ul className={NOTES_SUB}>
            <li>收到合法 codeword：每組都是偶數個 1 → Hcᵀ = 0，燈全暗</li>
          </ul>
        </li>
        <li>
          → 按欄讀：第 j 欄 = 位置 j 被哪幾盞燈盯著
          <ul className={NOTES_SUB}>
            <li>XOR 的一個輸入翻轉，輸出就翻轉；燈本來全暗 → 只有位置 j 被翻轉時，亮的就是第 j 欄的那幾盞</li>
            <li>
              例：位置 {EX_POS} → ({column(H74, EX_POS - 1).join(',')})ᵀ → {lampText(lampsAt(H74, EX_POS))}
            </li>
            <li>證明 Hrᵀ = Hcᵀ + Heⱼᵀ = hⱼ 留到第 3 章；接下來 H 的五個設計都從這句推出</li>
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
          ① 每一欄都不能是 0
          <ul className={NOTES_SUB}>
            <li>第 j 欄全 0 = 沒有燈盯著位置 j</li>
            <li>
              反例：第 {ZERO_POS} 欄改成 0 → 位置 {ZERO_POS} 被翻轉時燈{lampText(lampsAt(H_ZERO, ZERO_POS))}，接收端以為沒事，錯誤隱形
            </li>
          </ul>
        </li>
        <li>
          → ② 每一欄都互不相同
          <ul className={NOTES_SUB}>
            <li>兩欄一樣 = 兩個位置被同一組燈盯著</li>
            <li>
              反例：第 {TWIN_B} 欄改成和第 {TWIN_A} 欄一樣 → 位置 {TWIN_A} 或 {TWIN_B} 出錯都是 {lampText(lampsAt(H_TWIN, TWIN_B))}，分不出是誰
            </li>
            <li>
              真正的 H：{N} 欄都非零、兩兩不同 → 每個位置一種專屬的亮法
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 2 章：H 的設計 ③：${R} 盞燈看 ${PATTERNS} 個位置`,
    sub: `2${sup(R)} − 1 = ${PATTERNS}：最多就是 ${PATTERNS} 個，Hamming 全部用上`,
    steps: () => 2,
    render: (s) => <SevenSlide s={s} />,
    takeaway: (
      <>
        <Ph>
          {R} 盞燈只有 {PATTERNS} 種亮法：
        </Ph>
        <Ph>最多分辨 {PATTERNS} 個位置</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          {R} 盞燈 = 2{sup(R)} = {STATES} 種狀態
          <ul className={NOTES_SUB}>
            <li>
              全暗留給「沒出錯」→ 剩 {PATTERNS} 種亮法
            </li>
            <li>
              ①② 要求每個位置一種專屬亮法 → 最多 {PATTERNS} 個位置
            </li>
            <li>
              硬塞第 {PATTERNS + 1} 個位置：它只能拿全暗（違反 ①，錯誤隱形）或拿別人的亮法（違反 ②，分不出是誰）
            </li>
          </ul>
        </li>
        <li>
          → Hamming 把 {PATTERNS} 種全部用上：要指出錯在哪一位，{R} 個檢查器能保護的長度到頂了
          <ul className={NOTES_SUB}>
            <li>
              第 1 章的 k + r ≤ 2ʳ − 1 就是這件事：{PATTERNS} − {R} = {K} 個資訊位元
            </li>
            <li>
              多一盞燈 → {hammingN(R + 1)} 個位置；{LONG.m} 盞 → {LONG.n} 個（第 4 章）
            </li>
            <li>這是「更正 1 個錯」的上限：只要發現有錯、不必指出位置，欄只需非零、可以重複，碼可以更長</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：H 的設計 ④：第 j 欄 = j 的二進位',
    sub: '燈號讀成數字，就是位置的編號',
    steps: () => 3,
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
            <li>P_b 管二進位含 b 的位置 → 第 j 欄由上往下是 j 的 1、2、4 位</li>
          </ul>
        </li>
        <li>
          → {R} 盞燈讀成二進位（{READ.map((i) => LAMP[i]).join(' ')}），直接是出錯位置
          <ul className={NOTES_SUB}>
            <li>
              例：{lampText(column(H74, DEC_POS - 1))} → {READ.map((i) => column(H74, DEC_POS - 1)[i]).join('')}₂ = {syndromeToPosition(column(H74, DEC_POS - 1))} → 翻轉位置 {DEC_POS}
            </li>
          </ul>
        </li>
        <li>
          → 硬體：{R}-to-{STATES} 解碼器，第 j 條輸出線接去翻轉第 j 位
          <ul className={NOTES_SUB}>
            <li>第 0 條 = 沒出錯，不接</li>
            <li>欄的順序換掉 = 位置重新編號 → 等價的碼（Equivalent Code），能力一樣；只是燈號和位置之間要多一張對照表</li>
            <li>二進位順序是工程上的選擇，不是數學上的必要</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 2 章：H 的設計 ⑤：同位位元在 ${PARITY_POS}`,
    sub: '每個同位位元只出現在一條檢查裡',
    steps: () => 2,
    render: (s) => <ParityPositionSlide s={s} />,
    takeaway: (
      <>
        <Ph>每條檢查只含一個同位位元：</Ph>
        <Ph>{R} 組 XOR 各算各的</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          位置 {PARITY_POS} 的二進位只有一個 1 → H 的這 {R} 欄是單位欄
          <ul className={NOTES_SUB}>
            <li>每個同位位元只出現在一條檢查裡 → 每條方程只有一個未知數</li>
            <li>
              移項就用資料位元算出，公式直接從 H 的那一列讀：第 1 章的 {R} 個公式
            </li>
            <li>編碼器 = {R} 組獨立的 XOR，同時算完，彼此不用等</li>
          </ul>
        </li>
        <li>
          → 對照：同位位元改放在最後的 {ALT_PARITY.join('、')}（不是錯，只是比較麻煩）
          <ul className={NOTES_SUB}>
            <li>
              {R} 條方程分別有 {unknownsPerRow(ALT_PARITY).join('、')} 個未知數 → 照方程直接接線，同位位元互相牽連，要等彼此算完
            </li>
            <li>想同時算，得先解一次聯立方程（高斯消去），把同位位元改寫成資料位元的 XOR：做得到，但公式不能再從 H 直接讀出來</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：HGᵀ = 0：沒有雜訊，燈全暗',
    sub: '發送端怎麼造 = 接收端怎麼驗',
    steps: () => 3,
    render: (s) => <HGtSlide s={s} />,
    takeaway: (
      <>
        <Ph>送出的每個 codeword，</Ph>
        <Ph>
          沒有雜訊時都讓 {R} 盞燈全暗
        </Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          HGᵀ 的第 (i, j) 格 = 檢查器 i 套在 gⱼ 上
          <ul className={NOTES_SUB}>
            <li>gⱼ = 只按下 Dⱼ 時送出的 codeword</li>
            <li>
              {HGT.length} × {HGT[0].length} 全是 0：每個單位訊息的 codeword 都讓 {R} 盞燈全暗
            </li>
          </ul>
        </li>
        <li>
          → 疊加：任何訊息 = 單位訊息的和 → 任何 c = mG 都讓燈全暗
          <ul className={NOTES_SUB}>
            <li>Hcᵀ = H(mG)ᵀ = (HGᵀ)mᵀ = 0</li>
            <li>發送端送出的任何東西，只要途中沒有雜訊，接收端的燈全部不亮</li>
            <li>兩邊轉置也常寫成 GHᵀ = 0，是同一件事</li>
          </ul>
        </li>
        <li>
          → 反過來也成立：燈全暗的字串都是發送端造得出的
          <ul className={NOTES_SUB}>
            <li>
              rank G = {RANK_G} → {'{mG}'} 有 2{sup(RANK_G)} = {2 ** RANK_G} 個；rank H = {RANK_H} → ker H 是 {N} − {RANK_H} = {N - RANK_H} 維，也是 {2 ** (N - RANK_H)} 個
            </li>
            <li>一個包含在另一個裡、個數又一樣 → 相等：C = {'{mG}'} = ker H</li>
            <li>注意：燈全暗不代表沒有雜訊；雜訊若把一個 codeword 變成另一個，燈也全暗（第 4 章）</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 2 章：實例：c = mG、Hcᵀ = 0',
    sub: '發送端用 G 造，接收端用 H 驗',
    steps: () => 2,
    render: (s) => <MatrixSlide s={s} />,
    takeaway: (
      <>
        <Ph>發送端加 G 的列造出 c，</Ph>
        <Ph>接收端加 H 的欄：燈全暗</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          發送端：m 裡是 1 的位置 → 把 G 的那幾列加起來 = c
          <ul className={NOTES_SUB}>
            <li>現場示範：切換 D1–D{K}，被選到的列亮起來</li>
          </ul>
        </li>
        <li>
          → 接收端：c 裡是 1 的位置 → 把 H 的那幾欄加起來 = {R} 盞燈
          <ul className={NOTES_SUB}>
            <li>不管 m 是什麼，結果都是 0：燈全暗</li>
            <li>下一章：翻一個位元，看亮的燈怎麼指出位置</li>
          </ul>
        </li>
      </ul>
    ),
  },
];
