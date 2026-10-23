import { useMemo, useState, type ReactNode } from 'react';
import { Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type Bit,
  type Matrix,
  G74,
  H74,
  K4,
  N7,
  LAYOUT_74,
  DATA_INDICES,
  PARITY_INDICES,
  allVectors,
  encode74,
  encode74ByParity,
  PARITY_CHECKS,
  formatRowOp,
  hammingN,
  hammingParams,
  kernelBasis,
  matchingColumn,
  matMul,
  matVec,
  matrixToTex,
  minimumDistance,
  rank,
  rref,
  span,
  syndromeToPosition,
  transpose,
  column,
  isZeroMatrix,
  bitsToString,
  codewords74,
  unitVector,
  vecAdd,
  vecEquals,
  vecMat,
  isZeroVector,
} from '../core';
import { sciTex } from '../core/engineering-g1';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { MessageInput, BitString } from '../components/Bits';
import { MatrixView, ColumnVector } from '../components/MatrixView';
import { RelatedLinks } from '../components/alg/Links';
import { LinAlgPrimer, RankNullityPrimer } from '../components/LinAlgPrimer';
import { Callout, Card, Derivation, Expandable, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Segmented, Stage, Stat } from '../components/Lesson';

const ID = 'matrix';
/** links to the other Lesson 1 chapters, styled as on the other pages */
const LINK = 'font-semibold text-overall-700 hover:underline';

/* ------------------------------------------------------------------ */
/* Numbers on this page (computed from the core, never typed)          */
/* ------------------------------------------------------------------ */

/** 7 positions, 4 data bits, ℓ = 3 parity bits = 3 checkers = 3 lamps */
const N = N7;
const K = K4;
const L = H74.length;
/** 3 lamps: 2³ states, all but "all dark" can name a position */
const STATES = 2 ** L;
const PATTERNS = STATES - 1;
/** a lookup-table encoder stores one codeword per message */
const TABLE_ROWS = 2 ** K;
const ALL_WORDS = 2 ** N;
/** the long code of the same family: Hamming(127,120) */
const LONG = hammingParams(7);
const D_MIN = minimumDistance(codewords74().map((x) => x.codeword)).dmin;
const RANK_G = rank(G74);
const RANK_H = rank(H74);

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
/** the bit value each check is named after: 1, 2, 4 */
const LAMP_VALUES = PARITY_CHECKS.map((pc) => pc.bitValue).join('、');
const colLabels74 = LAYOUT_74.map((p) => p.label);
const POSITIONS = LAYOUT_74.map((p) => p.position);
const DATA_LABELS = DATA_INDICES.map((i) => LAYOUT_74[i].label);
const posList = (idx: readonly number[]) => idx.map((i) => LAYOUT_74[i].position).join('、');
const DATA_POS = posList(DATA_INDICES);
const PARITY_POS = posList(PARITY_INDICES);
/** the lamps that light when noise flips position pos (1-based) */
const lampsAt = (H: Matrix, pos: number) => matVec(H, unitVector(N, pos - 1));
/** a lamp state as bits in H's row order (P1 first) from its binary value */
const lampBits = (v: number): Bit[] => Array.from({ length: L }, (_, i) => ((v >> i) & 1) as Bit);
/** reading the lamps as a binary number: P4 P2 P1, the most significant first */
const READ = [...LAMP.keys()].reverse();
const READ_NAMES = READ.map((i) => LAMP[i]).join(' ');
/** the syndrome's components, named after the lamps: s_1, s_2, s_4 */
const S_TEX = LAMP.map((x) => `s_${x.slice(1)}`).join(', ');
const S_PLAIN = `(${LAMP.map((x) => `s${x.slice(1).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[Number(d)])}`).join(', ')})`;
/** a lamp state as a labelled vector: (s₁, s₂, s₄) = (0, 1, 1) */
const lampVec = (s: readonly Bit[]) => `${S_PLAIN} = (${s.join(', ')})`;
/** a lamp state as a number: 110₂ = 6 (P4 P2 P1 order) */
const lampNum = (s: readonly Bit[]) => `${READ.map((i) => s[i]).join('')}₂ = ${syndromeToPosition(s)}`;
/** 'P1' → 'P_1' for KaTeX */
const texName = (x: string) => x.replace(/(\d)/, '_$1');

/** G read by rows: the outputs each data line is wired to; by columns: the data bits each output XORs */
const G_ROW_OUTPUTS = G74.map((row) => row.flatMap((v, j) => (v ? [LAYOUT_74[j]] : [])));
const G_COL_INPUTS = LAYOUT_74.map((p) => column(G74, p.index).flatMap((v, i) => (v ? [`D${i + 1}`] : [])));
const G_LABELS = G74.map((_, i) => (
  <span key={i}>
    g<sub>{i + 1}</sub>
  </span>
));

/** H design ①: position ZERO_POS gets a column of zeros (no lamp watches it) */
const ZERO_POS = N;
const H_ZERO: Matrix = H74.map((r) => r.map((v, j) => (j === ZERO_POS - 1 ? 0 : v)));
/** H design ②: position TWIN_B gets the same column as TWIN_A */
const TWIN_A = N - 1;
const TWIN_B = N;
const H_TWIN: Matrix = H74.map((r) => r.map((v, j) => (j === TWIN_B - 1 ? r[TWIN_A - 1] : v)));
/** H design ④: the position read as a binary number in the example */
const READ_POS = TWIN_A;
/** H design ⑤: how many parity bits each check contains, for the parity bits at 1, 2, 4 and at the last three positions */
const STD_PARITY = PARITY_INDICES.map((i) => LAYOUT_74[i].position);
const ALT_PARITY = LAYOUT_74.slice(-L).map((p) => p.position);
const unknownsPerRow = (parity: number[]) => H74.map((row) => parity.filter((p) => row[p - 1] === 1).length);
const ALT_SOLVABLE = rank(ALT_PARITY.map((p) => column(H74, p - 1))) === L;
/** G design ③: wiring D4 exactly like D1 (row 4 = row 1) breaks ②, and two messages collide */
const G_COLLIDE: Matrix = G74.map((r, i) => (i === K - 1 ? [...G74[0]] : r));
const COLLIDE_MSGS = [unitVector(K, 0), unitVector(K, K - 1)];
const COLLIDE_WORDS = COLLIDE_MSGS.map((m) => vecMat(m, G_COLLIDE));

/** the picture: every message × every choice of the parity bits, and which of them the lamps let through */
const MESSAGES = allVectors(K);
const PARITY_CHOICES = allVectors(L);
/** the 7-bit word with data bits m and parity bits p (in P1, P2, P4 order) */
const wordOf = (m: readonly Bit[], p: readonly Bit[]): Bit[] => {
  const w: Bit[] = Array.from({ length: N }, () => 0 as Bit);
  DATA_INDICES.forEach((idx, i) => (w[idx] = m[i]));
  PARITY_INDICES.forEach((idx, b) => (w[idx] = p[b]));
  return w;
};
/** lamps of every cell, computed once */
const CELL_LAMPS = MESSAGES.map((m) => PARITY_CHOICES.map((p) => matVec(H74, wordOf(m, p))));

const PRESETS: Record<string, { label: string; m: Matrix }> = {
  H: { label: 'H（Hamming）', m: H74 },
  G: { label: 'G', m: G74 },
  dep: {
    label: '有相依列',
    m: [
      [1, 1, 0, 1, 0],
      [0, 1, 1, 0, 1],
      [1, 0, 1, 1, 1],
    ],
  },
  small: {
    label: '2×3 小例子',
    m: [
      [1, 0, 1],
      [0, 1, 1],
    ],
  },
};

const CODEWORDS = codewords74();
const DEFAULT_PARTNER = CODEWORDS.findIndex((x) => x.message.join('') === '0110');

/* ------------------------------------------------------------------ */
/* Small pictures                                                      */
/* ------------------------------------------------------------------ */

/**
 * The receiver's warning lamps: lit = that check failed.
 * Drawn in H's row order (P1, P2, P4), or with order="read" as P4 P2 P1 so they line up with the binary number.
 */
function Lamps({ bits, size = 'md', order = 'rows' }: { bits: readonly Bit[]; size?: 'sm' | 'md'; order?: 'rows' | 'read' }) {
  const d = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  const lit = LAMP.filter((_, i) => bits[i]);
  const idx = order === 'read' ? READ : [...LAMP.keys()];
  return (
    <span className="inline-flex items-end gap-1.5 align-middle" role="img" aria-label={lit.length ? `警示燈亮：${lit.join('、')}` : '警示燈全暗'}>
      {idx.map((i) => (
        <span key={LAMP[i]} className="inline-flex flex-col items-center gap-0.5">
          <span className={`${d} rounded-full border-2 ${bits[i] ? 'border-rose-500 bg-rose-400 shadow-[0_0_8px_2px_rgba(244,63,94,0.45)]' : 'border-slate-300 bg-slate-200'}`} />
          <span className="text-[10px] font-semibold leading-none text-slate-500">{LAMP[i]}</span>
        </span>
      ))}
    </span>
  );
}

/** one line of a failure example: which flip, which lamps light, what the receiver concludes */
function LampResult({ label, bits, note }: { label: ReactNode; bits: readonly Bit[]; note?: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="flex items-center gap-2">
        <Lamps bits={bits} size="sm" />
        {note && <span className="font-semibold">{note}</span>}
      </div>
    </div>
  );
}

/** sender → noise → receiver, with the live example message; stacked with ↓ on phones, in a row with → from sm */
function Pipeline({ message }: { message: readonly Bit[] }) {
  const c = encode74(message);
  const arrow = (label?: string) => (
    <span className="relative flex items-center leading-none text-slate-400 sm:flex-col" aria-hidden={label ? undefined : true}>
      {label && <span className="absolute right-full mr-1 whitespace-nowrap text-[11px] font-semibold text-rose-500 sm:static sm:mr-0">{label}</span>}
      <span className="text-lg sm:hidden">↓</span>
      <span className="hidden text-lg sm:inline">→</span>
    </span>
  );
  const stop = (label: string, children: ReactNode) => (
    <span className="flex flex-col items-center gap-1">
      <span className="text-[11px] text-slate-500">{label}</span>
      {children}
    </span>
  );
  const machine = (tone: string, title: string, sub: ReactNode) => (
    <span className={`rounded-xl border-2 px-3 py-1.5 text-center ${tone}`}>
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-xs">{sub}</span>
    </span>
  );
  return (
    <div className="flex flex-col items-center justify-center gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:flex-wrap">
      {stop(`${K} 個 data bit`, <BitString bits={message} className="font-bold text-data-700" />)}
      {arrow()}
      {machine('border-data-300 bg-data-50 text-data-700', '發送端：encoder', <>接線圖 = G</>)}
      {arrow()}
      {stop(`送出 ${N} 個位元`, <BitString bits={c} className="font-bold" highlight={(j) => (LAYOUT_74[j].role === 'parity' ? 'text-parity-600' : 'text-data-600')} />)}
      {arrow('雜訊')}
      {machine('border-parity-300 bg-parity-50 text-parity-700', '接收端：檢查器', <>檢查電路 = H</>)}
      {arrow()}
      {stop(`${L} 盞警示燈`, <Lamps bits={matVec(H74, c)} size="sm" />)}
    </div>
  );
}

/**
 * Every message (rows) × every choice of P1, P2, P4 (columns): which 7-bit words the receiver lets through
 * when it requires the first `checks` lamps to stay dark. Each lamp halves what passes; with all three, one cell per row is left.
 */
function PassGrid({ message }: { message: readonly Bit[] }) {
  const [checks, setChecks] = useState(String(L));
  const need = Number(checks);
  const pass = (lamps: readonly Bit[]) => lamps.slice(0, need).every((b) => b === 0);
  const passed = CELL_LAMPS.flat().filter(pass).length;
  const perRow = CELL_LAMPS[0].filter(pass).length;
  const mine = message.join('');
  const options = Array.from({ length: L + 1 }, (_, k) => ({
    value: String(k),
    label: k === 0 ? '不看燈' : k === L ? `${L} 盞全暗` : `${LAMP.slice(0, k).join('、')} 暗`,
  }));
  return (
    <Card title={`${MESSAGES.length} 種訊息 × ${PARITY_CHOICES.length} 種 parity bit 填法：接收端放行哪幾格？`} actions={<Segmented value={checks} onChange={setChecks} ariaLabel="要求哪幾盞燈保持暗" options={options} />}>
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div className="min-w-0 overflow-x-auto">
          <table className="border-separate border-spacing-[3px] text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="whitespace-nowrap pr-1 text-left text-[10px] font-normal leading-tight">
                  <span className="block text-right text-parity-600">{LAMP.join('')} →</span>
                  <span className="block text-data-700">D1–D4 ↓</span>
                </th>
                {PARITY_CHOICES.map((p) => (
                  <th key={p.join('')} className="font-mono font-normal text-parity-600">
                    {p.join('')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MESSAGES.map((m, i) => {
                const isMine = m.join('') === mine;
                const cw = encode74(m);
                return (
                  <tr key={m.join('')}>
                    <td className={`pr-1 font-mono ${isMine ? 'font-bold text-data-700' : 'text-slate-500'}`}>{m.join('')}</td>
                    {PARITY_CHOICES.map((p, b) => {
                      const ok = pass(CELL_LAMPS[i][b]);
                      const isCodeword = vecEquals(wordOf(m, p), cw);
                      return (
                        <td key={b} title={`${wordOf(m, p).join('')}：${ok ? '放行' : '有燈亮'}`} className={`h-4 w-7 rounded ${ok ? (isCodeword ? 'bg-emerald-500' : 'bg-emerald-200') : 'bg-slate-100'} ${isMine ? 'outline outline-1 outline-data-300' : ''}`} />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="min-w-0 space-y-3 text-sm leading-relaxed text-slate-700">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="放行的字串" value={`${passed} / ${ALL_WORDS}`} sub={need === 0 ? '全部放行' : `每一列剩 ${perRow} 格`} tone="emerald" />
            <Stat label="要求保持暗的燈" value={need} sub={need === 0 ? '—' : LAMP.slice(0, need).join('、')} />
          </div>
          <p>
            每一列是一組 data bit D1–D4，每一欄是一種 {LAMP.join('、')} 的填法，一格就是一個 {N} 位元字串；綠色 = 接收端的燈全暗、放行。按上方的按鈕，一盞一盞加上檢查：
          </p>
          <p>
            每多要求一盞燈保持暗，放行的字串就少一半：
            {Array.from({ length: L + 1 }, (_, k) => ALL_WORDS / 2 ** k).join(' → ')}
            。每一盞燈都是一個獨立的檢查，{L} 盞燈把 <M>{`2^{${N}}`}</M> 個字串砍成 <M>{`2^{${N} - ${L}} = ${ALL_WORDS / STATES}`}</M> 個。
          </p>
          <p>
            {L} 盞全暗時，每一列恰好剩一格（深綠），就是發送端用 G 編出來的那個 codeword：H 的設計 ⑤ 讓每條檢查只含一個 parity bit，{L} 盞燈正好把 {LAMP.join('、')} 各決定一次。接收端放行的 {ALL_WORDS / STATES} 個字串，就是發送端造得出的 {TABLE_ROWS} 個
            codeword。
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export default function M2Matrices() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c = useMemo(() => encode74(message), [message]);
  const selectedRows = message.flatMap((b, i) => (b ? [i] : []));
  const selectedCols = c.flatMap((b, j) => (b ? [j] : []));
  const Hc = matVec(H74, c);
  const [partner, setPartner] = useState(DEFAULT_PARTNER);
  const c2 = CODEWORDS[partner].codeword;
  const m2 = CODEWORDS[partner].message;
  const cSum = vecAdd(c, c2);
  const mSum = vecAdd(message, m2);
  const HGt = matMul(H74, transpose(G74));
  const [view, setView] = useState<'mG' | 'Hc'>('mG');
  // the toolbox sits in a closed 進階 block; a link to one of its pages opens the block (re-mounting it open) and scrolls there
  const [primerTab, setPrimerTab] = useState(0);
  const [primerOpens, setPrimerOpens] = useState(0);
  const goPrimer = (k: number) => {
    setPrimerTab(k);
    setPrimerOpens((n) => n + 1);
    requestAnimationFrame(() => document.getElementById(`${ID}-toolbox`)?.scrollIntoView({ behavior: 'smooth' }));
  };
  const PrimerLink = ({ k, label }: { k: number; label: string }) => (
    <button type="button" onClick={() => goPrimer(k)} className="font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900">
      工具箱第 {k + 1} 頁「{label}」
    </button>
  );

  // H from the parity checks of chapter 1; G from encoding the messages with only Dᵢ = 1
  const hRows = PARITY_CHECKS.map((pc) => Array.from({ length: N }, (_, j) => (pc.covered.includes(j) ? 1 : 0) as Bit));
  const hMatches = hRows.every((r, i) => r.join('') === H74[i].join(''));
  const single = Array.from({ length: K }, (_, i) => unitVector(K, i));
  const gRows = single.map((u) => encode74ByParity(u));
  const gMatches = gRows.every((r, i) => r.codeword.join('') === G74[i].join(''));
  const gDataIsIdentity = DATA_INDICES.every((idx, i) => vecEquals(column(G74, idx), unitVector(K, i)));

  // the example of superposition: m written as a sum of messages with a single 1
  const superTex =
    selectedRows.length <= 1
      ? `m = ${message.join('')} \\;\\Rightarrow\\; c = ${selectedRows.length ? `g_${selectedRows[0] + 1} = ` : ''}${c.join('')}`
      : `\\begin{gathered} m = ${message.join('')} = ${selectedRows.map((i) => single[i].join('')).join(' + ')} \\\\ \\Rightarrow\\; c = ${selectedRows.map((i) => `g_${i + 1}`).join(' + ')} = ${c.join('')} \\end{gathered}`;

  const ex = TWIN_A; // the worked column in the receiver card
  const exCol = column(H74, ex - 1);
  const readCol = column(H74, READ_POS - 1);

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          <a href="#/encode" className={LINK}>
            第 1 章
          </a>
          的編碼只用到 {L} 個 XOR 公式。真的做成電路時，兩端各需要一個：發送端要一個把 {K} 個 data bit 變成 {N} 個位元的 <strong>encoder</strong>，接收端要一個檢查這 {N} 個位元、點亮警示燈的<strong>檢查電路</strong>
          。這一章把兩個電路寫成兩個矩陣：generator matrix（生成矩陣）G 與 parity-check matrix（同位檢查矩陣）H，並從電路的角度說明它們的每一個設計換來了什麼。
        </p>
      </ModuleHeader>
      <KeyPoint>G 是發送端的 encoder 接線圖，H 是接收端的 {L} 盞警示燈：沒有雜訊時，送出的每個 codeword 都讓燈全暗。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="發送端要一個 encoder，接收端要一個檢查器">
          <Card title="兩端各一個 XOR 電路，寫下來就是兩個矩陣">
            <Pipeline message={message} />
            <div className="mt-3 grid grid-cols-1 gap-3 text-sm leading-relaxed text-slate-700 md:grid-cols-2">
              <div className="rounded-xl border border-data-300 bg-data-50/60 p-3">
                <div className="mb-1 font-bold text-data-700">發送端：怎麼造</div>
                拿到 {K} 個 data bit，要送出 {N} 個位元。第 1 章的 {L} 個公式（
                <M>{`${texName(PARITY_CHECKS[0].name)} = ${PARITY_CHECKS[0].dataTerms.map(texName).join(' \\oplus ')}`}</M>
                ……）就是這台 <strong>encoder</strong>
                ：每一條輸出線都是幾個 data bit 的 XOR。把「哪條資料線接到哪條輸出線」記成 0/1 表格，就是
                <strong>generator matrix G</strong>。
              </div>
              <div className="rounded-xl border border-parity-300 bg-parity-50/60 p-3">
                <div className="mb-1 font-bold text-parity-700">接收端：怎麼驗</div>
                收到 {N} 個位元，卻不知道原本送了什麼，只能檢查。{L} 個<strong>檢查器</strong>各做一組 XOR、各接一盞
                <strong>警示燈</strong>：每一組都是偶數個 1，燈全暗；有一組變成奇數，那盞燈就亮。把「每個檢查器盯著哪些位置」記成 0/1 表格，就是 <strong>parity-check matrix H</strong>。
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">兩個電路都只用 XOR，而 XOR 就是 GF(2) 的加法，所以電路可以一格不漏地寫成矩陣：編碼與檢查都變成矩陣乘法，code length（碼長）變成 {LONG.n} 甚至上千位元，算法也完全一樣。</p>
          </Card>

          <Card title="發送端：G 是 encoder 的接線圖">
            <p className="mb-3 text-sm text-slate-600">
              G 的第 i 列 <M>{'g_i'}</M>，就是只有 <M>{'D_i = 1'}</M> 的訊息（只按下第 i 個開關）送進 encoder 時送出的 codeword。用第 1 章的規則把這 {K} 個訊息各編一次：
            </p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <div className="min-w-0 flex-1 basis-[26rem] overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1 pr-4">只有 Dᵢ = 1 的訊息</th>
                      <th className="pr-4">用第 1 章的規則算 parity bit</th>
                      <th>codeword = G 的這一列</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gRows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="py-1.5 pr-4">
                          <span className="font-semibold text-data-700">D{i + 1}</span> = 1：
                          <span className="font-mono">{single[i].join('')}</span>
                        </td>
                        <td className="pr-4 text-xs text-slate-600">{r.parities.map((p) => `${p.name} = ${p.value}`).join('，')}</td>
                        <td>
                          <M>{`g_${i + 1} = `}</M>
                          <BitString bits={r.codeword} className="font-bold" highlight={(j) => (LAYOUT_74[j].role === 'parity' ? 'text-parity-600' : 'text-data-600')} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <MatrixView matrix={gRows.map((r) => r.codeword)} name="G =" colLabels={colLabels74} rowLabels={DATA_LABELS} />
                <p className="mt-1 text-xs text-slate-500">{gMatches ? '✓ 和本站的 G 完全一致。' : '✗ 與 G74 不一致'}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
              <div className="min-w-0 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-1 font-semibold text-slate-900">按列讀：Dᵢ 這條線接到哪些輸出</div>
                <ul className="space-y-0.5">
                  {G_ROW_OUTPUTS.map((outs, i) => (
                    <li key={i}>
                      <span className="font-semibold text-data-700">D{i + 1}</span> → 輸出 {outs.map((p) => p.position).join('、')}
                      <span className="text-slate-500">（{outs.map((p) => p.label).join('、')}）</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <div className="mb-1 font-semibold text-slate-900">按欄讀：第 j 條輸出線是哪幾個 data bit 的 XOR</div>
                <ul className="space-y-0.5">
                  {LAYOUT_74.map((p, j) => (
                    <li key={p.index}>
                      輸出 {p.position}（<span className={p.role === 'parity' ? 'text-parity-700' : 'text-data-700'}>{p.label}</span>） = {G_COL_INPUTS[j].join(' ⊕ ')}
                      {G_COL_INPUTS[j].length === 1 && <span className="text-slate-500">：直通的導線</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              兩種讀法是同一張接線圖：按列看，是 {K} 條資料線各接到哪幾條輸出；按欄看，是 {N} 條輸出線各是哪幾個 data bit 的 XOR。
            </p>
          </Card>

          <Card title="接收端：H 的每一列是一個檢查器">
            <p className="mb-3 text-sm text-slate-600">
              接收端把第 1 章的 {L} 個檢查做成 {L} 個<strong>檢查器</strong>
              ：每個檢查器是一組 XOR，把它盯著的位置（包含 parity bit 自己）全部加起來，結果是 0 燈不亮，結果是 1 燈亮。把「盯著的位置記 1、沒盯著記 0」，每個檢查器就是 H 的一列：
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 pr-3">檢查器</th>
                    <th className="pr-3">盯著的位置</th>
                    <th className="pr-3">燈不亮的條件（mod 2）</th>
                    <th className="pr-3">H 的這一列</th>
                    <th>收到合法 codeword 時</th>
                  </tr>
                </thead>
                <tbody>
                  {PARITY_CHECKS.map((pc, k) => (
                    <tr key={pc.name} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-semibold text-parity-600">{pc.name}</td>
                      <td className="pr-3 font-mono">{pc.covered.map((j) => j + 1).join(', ')}</td>
                      <td className="pr-3">
                        <M>{`${pc.covered.map((j) => `c_${j + 1}`).join(' + ')} = 0`}</M>
                      </td>
                      <td className="pr-3 font-mono tracking-[0.15em]">{hRows[k].join('')}</td>
                      <td className="text-xs text-slate-500">偶數個 1 → 燈不亮</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <MatrixView matrix={hRows} name="H =" colLabels={POSITIONS} rowLabels={LAMP} />
              <div className="min-w-0 flex-1 basis-72 space-y-2 text-sm text-slate-600">
                <p>
                  {L} 個檢查器的輸出就是 {L} 盞警示燈，合起來是一個 {L} 位元的訊號，叫做 <strong>syndrome（徵狀）</strong>：<M>{`s = Hr^{T} = (${S_TEX})^{T}`}</M>，r 是接收端收到的 {N} 個位元，<M>{S_TEX}</M> 依序是 {LAMP.join('、')} 三盞燈。收到合法的 codeword
                  時，每一組都是偶數個 1，燈全暗：
                  <M>{'Hc^{T} = 0'}</M>。{hMatches ? '（✓ 和本站的 H 完全一致。）' : '（✗ 與 H74 不一致）'}
                </p>
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-parity-300 bg-parity-50/60 p-3 text-sm leading-relaxed text-slate-700">
              <p>
                換個方向按欄讀：
                <strong>
                  H 的第 j 欄 <M>{'h_j'}</M> = 位置 j 被哪幾盞燈盯著
                </strong>
                。XOR 的輸入只要翻轉一個，輸出就跟著翻轉。送出的是 codeword，燈本來全暗，所以只有位置 j 被雜訊翻轉時，亮起來的正好是第 j 欄裡是 1 的那幾盞。
              </p>
              <div className="my-2 flex flex-wrap items-center gap-3">
                <span>
                  例：位置 {ex} 被翻轉，亮的是第 {ex} 欄：{lampVec(exCol)}
                </span>
                <Lamps bits={lampsAt(H74, ex)} />
              </div>
              <p>
                <a href="#/syndrome" className={LINK}>
                  第 3 章
                </a>
                會用 <M>{'r = c + e_j'}</M>（<M>{'e_j'}</M>：只在位置 j 出錯的 error vector）證明 <M>{'Hr^{T} = Hc^{T} + He_j^{T} = 0 + h_j'}</M>
                ，並用它解碼。下一節 H 的五個設計，都從這一句推出來。
              </p>
            </div>
          </Card>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="G 的三個設計，H 的五個設計">
          <p className="text-sm text-slate-600">發送端的 G 有三個設計，讓 encoder 只是幾條 XOR 接線、資料拿得回來；接收端的 H 有五個設計，讓燈號指得出錯在哪裡。每一個都先說它在電路上換來什麼，再看數學。</p>
          <LabGrid
            main={
              <Card title={`G 的設計 ①：XOR 可以疊加，encoder 只要記 ${K} 列`}>
                <div className="space-y-2 text-sm leading-relaxed text-slate-700">
                  <p>
                    {TABLE_ROWS} 種訊息，最直接的 encoder 是查表：每種訊息各存一個 {N} 位元的 codeword。可是每個 parity bit 都是 data bit 的 XOR，而 XOR 滿足<strong>疊加</strong>：兩個訊息逐位相加，編出來的 codeword 也跟著相加。任何訊息都拆得成幾個「只有一個{' '}
                    <M>{'D_i = 1'}</M>」的訊息，所以 G 的 {K} 列就拼得出任何 codeword：
                  </p>
                  <Tex block>{superTex}</Tex>
                  <p>
                    按下哪幾個開關，就把那幾列加起來：
                    <M>{`c = ${Array.from({ length: K }, (_, i) => `D_${i + 1} g_${i + 1}`).join(' + ')} = mG`}</M>
                    。這樣 encoder 只是一組 XOR 接線，不用存一張表；code 越長，省下的越多。
                  </p>
                </div>
              </Card>
            }
            aside={
              <>
                <Card
                  title="驗證：兩個訊息疊加"
                  actions={
                    <select className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs" value={partner} onChange={(ev) => setPartner(Number(ev.target.value))} aria-label="選擇第二個訊息 m′">
                      {CODEWORDS.map((x, k) => (
                        <option key={k} value={k}>
                          m′ = {x.message.join('')}
                        </option>
                      ))}
                    </select>
                  }
                >
                  <table className="w-full text-sm">
                    <tbody className="font-mono">
                      <tr>
                        <td className="py-0.5 pr-2 font-sans text-xs text-slate-500">c（m = {bitsToString(message)}）</td>
                        <td className="text-right">
                          <BitString bits={c} />
                        </td>
                      </tr>
                      <tr>
                        <td className="py-0.5 pr-2 font-sans text-xs text-slate-500">c′（m′ = {m2.join('')}）</td>
                        <td className="text-right">
                          <BitString bits={c2} />
                        </td>
                      </tr>
                      <tr className="border-t border-slate-300">
                        <td className="py-0.5 pr-2 font-sans text-xs font-semibold text-slate-700">c + c′</td>
                        <td className="text-right font-bold">
                          <BitString bits={cSum} />
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="mt-3 text-xs text-slate-600">
                    {vecEquals(encode74(mSum), cSum) ? '✓' : '✗'} 正好是 <M>{"m + m'"}</M> = {mSum.join('')} 的 codeword：
                    <M>{"(m+m')G = mG + m'G"}</M>
                  </p>
                  <p className="mt-2 text-xs text-slate-500">c 跟著共用範例訊息 m 變化（可在下方「實驗」區修改）；c′ 從上方選單挑。</p>
                </Card>
                <Card title="查表 vs. G：encoder 要存多少">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500">
                          <th className="py-1 pr-3 font-normal" />
                          <th className="pr-3 font-normal">查表：每種訊息一格</th>
                          <th className="font-normal">G：只存 {K} 列</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-slate-100">
                          <td className="py-1.5 pr-3 font-semibold">
                            Hamming({N},{K})
                          </td>
                          <td className="pr-3">
                            <M>{`2^{${K}} = ${TABLE_ROWS}`}</M> 格
                          </td>
                          <td>{G74.length} 列</td>
                        </tr>
                        <tr className="border-t border-slate-100">
                          <td className="py-1.5 pr-3 font-semibold">
                            Hamming({LONG.n},{LONG.k})
                          </td>
                          <td className="pr-3">
                            <M>{`2^{${LONG.k}} \\approx ${sciTex(2 ** LONG.k)}`}</M> 格
                          </td>
                          <td className="font-semibold text-emerald-700">{LONG.k} 列</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            }
          />

          <Card title="G 的設計 ②③：資料原封不動，不同訊息就不會撞在一起">
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">
                <div className="font-semibold text-slate-900">② 資料欄是 identity matrix（單位矩陣）：systematic code</div>
                <MatrixView matrix={G74} name="G =" colLabels={colLabels74} rowLabels={DATA_LABELS} cellClass={(_, j, v) => (LAYOUT_74[j].role === 'data' ? (v ? 'bg-data-100 text-data-700' : 'bg-data-50 text-data-300') : undefined)} />
                <p>
                  位置 {DATA_POS}（{DATA_LABELS.join('、')}）那 {K} 欄合起來是 <M>{`I_${K}`}</M>
                  {gDataIsIdentity ? '' : '（✗ 不是 identity matrix）'}：這 {K} 條輸出線都是直通的導線，codeword 原封不動地帶著訊息。接收端把錯誤更正之後，直接從位置 {DATA_POS} 取出資料，不需要任何反運算。
                </p>
              </div>
              <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">
                <div className="font-semibold text-slate-900">③ 跟著 ② 成立：不同訊息 → 不同 codeword</div>
                <p>
                  訊息不同，位置 {DATA_POS} 上的位元就不同，codeword 也就不同：G 的 {K} 列互相獨立，rank G = {RANK_G}（
                  <PrimerLink k={1} label="Span 與 dimension" />
                  ），資訊沒有在編碼時遺失。
                </p>
                <p>
                  反過來，要讓兩個訊息撞在一起，就得先破壞 ②。把 D{K} 接得和 D1 一模一樣（第 {K} 列換成第 1 列），D{K} 那一欄就不再是 identity column：
                </p>
                <table className="text-sm">
                  <tbody className="font-mono">
                    {COLLIDE_MSGS.map((m, k) => (
                      <tr key={k}>
                        <td className="py-0.5 pr-3">m = {m.join('')}</td>
                        <td className="pr-3 text-slate-400">→</td>
                        <td className="font-bold text-rose-700">{COLLIDE_WORDS[k].join('')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p>
                  {vecEquals(COLLIDE_WORDS[0], COLLIDE_WORDS[1]) ? '兩個 codeword 一模一樣' : '✗ 兩者不同'}
                  （這個壞掉的 G 只有 rank {rank(G_COLLIDE)}
                  ）：接收端就算一個錯都沒收到，也分不出原本是哪一個訊息。
                </p>
              </div>
            </div>
          </Card>

          <p className="text-sm text-slate-600">接收端看不到雜訊，只看得到燈。位置 j 出錯時亮的燈就是 H 的第 j 欄，所以每一欄怎麼選，直接決定接收端能知道什麼。① ② 各附上「改壞一欄」的反例，燈號由程式即時算出。</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="H 的設計 ①：每一欄都不能是 0">
              <p className="text-sm leading-relaxed text-slate-700">第 j 欄全是 0，代表沒有任何一盞燈盯著位置 j。它被雜訊翻轉時，燈完全不亮，接收端以為一切正常：錯誤直接隱形。</p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <MatrixView matrix={H_ZERO} name="H′ =" size="sm" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={[ZERO_POS - 1]} colHighlightClass="bg-rose-100 text-rose-800" />
                <div className="space-y-2 text-sm">
                  <LampResult label={<>H′：位置 {ZERO_POS} 被翻轉</>} bits={lampsAt(H_ZERO, ZERO_POS)} note={isZeroVector(lampsAt(H_ZERO, ZERO_POS)) ? <span className="text-rose-700">全暗：錯誤隱形</span> : null} />
                  <LampResult label={<>原本的 H：位置 {ZERO_POS} 被翻轉</>} bits={lampsAt(H74, ZERO_POS)} note={<span className="text-emerald-700">抓得到</span>} />
                </div>
              </div>
            </Card>
            <Card title="H 的設計 ②：每一欄都互不相同">
              <p className="text-sm leading-relaxed text-slate-700">兩欄一樣，代表兩個位置被同一組燈盯著。這兩個位置不管誰出錯，亮的燈都一模一樣，接收端分不出是誰錯，只能猜。</p>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <MatrixView matrix={H_TWIN} name="H″ =" size="sm" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={[TWIN_A - 1, TWIN_B - 1]} colHighlightClass="bg-rose-100 text-rose-800" />
                <div className="space-y-2 text-sm">
                  {[TWIN_A, TWIN_B].map((p) => (
                    <LampResult key={p} label={<>H″：位置 {p} 被翻轉</>} bits={lampsAt(H_TWIN, p)} />
                  ))}
                  <div className="font-semibold text-rose-700">{vecEquals(lampsAt(H_TWIN, TWIN_A), lampsAt(H_TWIN, TWIN_B)) ? `亮法一樣：分不出是 ${TWIN_A} 還是 ${TWIN_B}` : ''}</div>
                </div>
              </div>
            </Card>
          </div>

          <Card title={`H 的設計 ③：${L} 盞燈最多分辨 ${PATTERNS} 個位置`}>
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">
                <p>
                  ①② 合起來：每個位置都要分到一種「不是全暗」、而且別的位置沒用過的亮法。
                  {L} 盞燈只有 <M>{`2^{${L}} = ${STATES}`}</M> 種狀態，扣掉「全暗 = 沒出錯」剩 {PATTERNS} 種，所以最多分辨 {PATTERNS} 個位置。
                </p>
                <p>硬要多保護第 {PATTERNS + 1} 個位置，它的欄只剩兩種選擇：全暗（違反 ①，它出錯時錯誤隱形），或和某個位置一樣（違反 ②，兩者出錯時分不出是誰）。</p>
                <p>
                  Hamming 把 {PATTERNS} 種亮法全部用上，code length <M>{`n = 2^{${L}} - 1 = ${PATTERNS}`}</M>
                  ：要能指出是哪一位出錯，{L} 個檢查器能保護的長度已經到最大。第 1 章的 <M>{'k + \\ell \\le 2^{\\ell} - 1'}</M>（ℓ = parity bit 的個數）就是同一件事：{N} 個位置扣掉 {L} 個 parity bit，剩 {N - L} 個 data bit。
                </p>
                <p className="text-slate-600">
                  多一盞燈，能看的位置變成 <M>{`2^{${L + 1}} - 1 = ${hammingN(L + 1)}`}</M> 個；{LONG.m} 盞燈可以看 {LONG.n} 個位置（
                  <a href="#/distance" className={LINK}>
                    第 4 章
                  </a>
                  ）。
                </p>
              </div>
              <div className="grid min-w-0 grid-cols-2 gap-1.5 sm:grid-cols-4">
                {Array.from({ length: STATES }, (_, v) => {
                  const s = lampBits(v);
                  const owner = matchingColumn(s) + 1;
                  return (
                    <div key={v} className={`flex flex-col items-center gap-1 rounded-lg border p-2 ${owner === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200'}`}>
                      <Lamps bits={s} size="sm" />
                      <span className={`text-xs font-semibold ${owner === 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{owner === 0 ? '沒出錯' : `位置 ${owner}`}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card title="H 的設計 ④：第 j 欄 = j 的二進位">
            <div className="space-y-2 text-sm leading-relaxed text-slate-700">
              <p>
                ①②③ 只要求 {N} 欄是 {N} 種不同的非零亮法，並沒有規定誰排在哪。數學上欄的順序可以任意排：把 H 的欄換個順序，只是把 codeword 的位置重新編號，得到的是
                <strong>equivalent code</strong>，能修幾個錯、偵測幾個錯都一樣。
              </p>
              <p>
                Hamming 讓第 j 欄等於 j 的二進位（{LAMP[0]} 是最低位），是工程上的選擇：{L} 盞燈讀成二進位數字，就直接是出錯位置的編號，接收端不用存「燈號 → 位置」的對照表。第 1 章的規則（{LAMP.join('、')} 各管二進位含 {LAMP_VALUES}{' '}
                的位置），排出來正是這個樣子：
              </p>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1.5 sm:gap-3">
              {LAYOUT_74.map((p) => (
                <div key={p.index} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 p-2">
                  <span className={`text-xs font-semibold ${p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}`}>{p.label}</span>
                  <ColumnVector bits={column(H74, p.index)} size="sm" />
                  <span className="text-[11px] text-slate-500">
                    = {syndromeToPosition(column(H74, p.index))}
                    <span className="hidden sm:inline">（{p.position.toString(2).padStart(L, '0')}₂）</span>
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              <Lamps bits={readCol} order="read" />
              <span>
                例：位置 {READ_POS} 出錯，亮的是第 {READ_POS} 欄 {lampVec(readCol)}。照 {READ_NAMES} 讀成二進位：
                <span className="font-mono font-bold">{lampNum(readCol)}</span>
                ，正好是位置 {READ_POS}。
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-700">
              換成別的欄順序也解得出來，只是燈號和位置對不上，要多一張對照表。把 {L} 盞燈直接接上 decoder（解碼器）、翻回錯的那一位，是
              <a href="#/syndrome" className={`mx-1 ${LINK}`}>
                第 3 章
              </a>
              的事。
            </p>
          </Card>

          <Card title={`H 的設計 ⑤：parity bit 放在 ${PARITY_POS}`}>
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">
                <p>
                  位置 {PARITY_POS} 的二進位只有一個 1，所以 H 的這 {L} 欄都只有一個 1：每個 parity bit 只出現在一條檢查裡。每條 parity-check equation（同位檢查方程）只有一個未知數，移項就能只用 data bit 把它算出來，公式直接從 H 的那一列讀出來，也就是第 1 章的 {L} 個公式。所以 encoder 是 {L}{' '}
                  組獨立的 XOR，同時算完，彼此不用互相等。
                </p>
                <MatrixView matrix={H74} name="H =" size="sm" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={PARITY_INDICES.slice()} colHighlightClass="bg-parity-100 text-parity-700" />
                <ul className="space-y-0.5">
                  {PARITY_CHECKS.map((pc, k) => (
                    <li key={pc.name}>
                      {pc.name} 那一列只含 {unknownsPerRow(STD_PARITY)[k]} 個 parity bit → <M>{`${texName(pc.name)} = ${pc.dataTerms.map(texName).join(' \\oplus ')}`}</M>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="min-w-0 space-y-2 rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-700">
                <div className="font-semibold text-slate-900">如果改放在最後的 {ALT_PARITY.join('、')}</div>
                <MatrixView matrix={H74} name="H =" size="sm" colLabels={POSITIONS} rowLabels={LAMP} highlightCols={ALT_PARITY.map((p) => p - 1)} colHighlightClass="bg-rose-100 text-rose-800" />
                <p>
                  {L} 條檢查分別含 {unknownsPerRow(ALT_PARITY).join('、')} 個 parity bit：每條方程都有好幾個未知數。照方程直接接線，parity bit 彼此牽連，一個要等另一個算完；想讓它們同時算，得先用 Gaussian elimination（高斯消去）解一次聯立方程，把每個 parity bit 改寫成 data bit 的 XOR
                  {ALT_SOLVABLE ? '' : '（✗ 這幾欄甚至不獨立，解不出來）'}
                  。解完也做得到，只是公式不能再從 H 直接讀出來。
                </p>
              </div>
            </div>
          </Card>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="HGᵀ = 0：發送端造的，接收端都放行">
          <Card title="HGᵀ = 0：沒有雜訊時，燈全暗">
            <p className="mb-3 text-sm leading-relaxed text-slate-700">發送端送出的任何東西，只要途中沒有雜訊，接收端的 {L} 盞燈全部不亮。寫成矩陣，就是 H 乘上 G 的 transpose（轉置）等於零矩陣：</p>
            <div className="flex flex-wrap items-center gap-4">
              <MatrixView matrix={H74} name="H" size="sm" rowLabels={LAMP} />
              <span>·</span>
              <MatrixView matrix={transpose(G74)} name={<M>{'G^T'}</M>} size="sm" colLabels={G_LABELS} />
              <span>=</span>
              <MatrixView matrix={HGt} size="sm" rowLabels={LAMP} colLabels={G_LABELS} cellClass={() => 'text-emerald-700 bg-emerald-50'} />
              <div className="min-w-0 flex-1 basis-72 space-y-2 text-sm text-slate-600">
                <p>
                  第 i 欄是把 <M>{'g_i'}</M>（只有 <M>{'D_i = 1'}</M> 的訊息的 codeword）送進 {L} 個檢查器。
                  {isZeroMatrix(HGt) ? `結果是 ${HGt.length} × ${HGt[0].length} 零矩陣` : '✗ 不是零矩陣'}
                  ：每個 <M>{'g_i'}</M> 都讓每一盞燈保持暗。
                </p>
                <p>
                  再用疊加（G 的設計 ①）：任何訊息都是只有一個 <M>{'D_i = 1'}</M> 的訊息的和，所以任何 codeword 都讓燈全暗：
                </p>
                <Tex block>{'Hc^T = H(mG)^T = H\\,G^T m^T = (HG^T)\\,m^T = 0'}</Tex>
                <p>
                  兩邊取 transpose，同一件事也常寫成 <M>{'GH^{T} = 0'}</M>。
                </p>
              </div>
            </div>
          </Card>

          <Callout kind="info" title="發送端怎麼造 = 接收端怎麼驗">
            <Tex block>{`C = \\{\\, mG : m \\in \\mathbb{F}_2^{${K}} \\,\\} = \\{\\, c \\in \\mathbb{F}_2^{${N}} : Hc^{T} = 0 \\,\\} = \\ker H`}</Tex>
            <p>
              <M>{'\\mathbb{F}_2'}</M> 就是導論的 GF(2)（只有 0、1，加法 mod 2），<M>{`\\mathbb{F}_2^{${N}}`}</M> 就是全部 <M>{`2^{${N}}`}</M> 個 {N} 位元字串。左邊是發送端造得出的全部 codeword，右邊是接收端放行（燈全暗）的全部 {N} 位元字串。
              <M>{'HG^T = 0'}</M> 只說了「造出來的都會被放行」；反過來，放行的也一定造得出來：兩邊都是剛好 {2 ** RANK_G} 個，一個不多、一個不少。<M>{'c = mG'}</M> 與 <M>{'Hc^{T} = 0'}</M> 是同一個 code 的兩個視角。
            </p>
          </Callout>
          <Expandable title="進階：用 dimension（維度）證明兩者相等">
            <p>
              G 從「生成」的角度描述 code：code 是 G 各列的 span（生成空間），也就是 G 的 <strong>row space（列空間）</strong>；H 從「檢查」的角度描述 code：code 是 H 的 <strong>kernel</strong>。
              <M>{'HG^T = 0'}</M> 只說明了 <M>{'\\{mG\\} \\subseteq \\ker H'}</M>
              。兩者剛好相等，靠的是比較 dimension：
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                G 的 D1–D4 那 {K} 欄是 identity matrix，所以 G 的 {K} 列是 linearly independent（線性獨立），
                <M>{`\\dim\\{mG\\} = \\operatorname{rank} G = ${RANK_G}`}</M>（
                <PrimerLink k={1} label="Span 與 dimension" />
                ）。
              </li>
              <li>
                H 的 {LAMP.join('、')} 那 {L} 欄是 identity matrix，所以 rank H = {RANK_H}；由 rank–nullity theorem（秩–零度定理）<M>{`\\dim \\ker H = ${N} - ${RANK_H} = ${N - RANK_H}`}</M>（
                <PrimerLink k={2} label="Kernel" />
                ）。
              </li>
            </ul>
            <p>
              一個 {RANK_G} 維 subspace（子空間）包含在一個 {N - RANK_H} 維 subspace 裡，dimension 又相同，兩者只能相等（在 <M>{'\\mathbb{F}_2'}</M> 上就是：<M>{`2^{${RANK_G}}`}</M> 個元素的集合包含在 <M>{`2^{${N - RANK_H}}`}</M> 個元素的集合裡）。
            </p>
          </Expandable>
          <div id={`${ID}-toolbox`} className="scroll-mt-28">
            <Expandable key={primerOpens} defaultOpen={primerOpens > 0} title="進階：線性代數工具箱（矩陣乘向量、span 與 dimension、kernel）">
              <p className="text-slate-600">
                發送端造得出哪些字、接收端放行哪些字，線性代數各有一個名字：G 的 <strong>row space</strong> 與 H 的 <strong>kernel</strong>
                。工具箱整理這一章用到的幾個概念（頂端的選單切換），每個都有即時計算的小例子。
              </p>
              <LinAlgPrimer tab={primerTab} onTab={setPrimerTab} framed={false} />
            </Expandable>
          </div>

          <Card title="Linear code（線性碼）：兩個 codeword 疊加，燈照樣全暗">
            <div className="space-y-2 text-sm text-slate-600">
              <p>
                每個檢查器只做 XOR：兩個讓燈全暗的字疊加，每個檢查器看到的是「偶數個 1」加「偶數個 1」，還是偶數，燈照樣全暗。寫成算式：若 c、c′ 都是 codeword，<M>{"H(c+c')^{T} = Hc^{T} + Hc'^{T} = 0 + 0 = 0"}</M>。
              </p>
              <div className="rounded-lg bg-slate-50 p-2 text-center font-semibold text-slate-800">任兩個 codeword 相加，還是 codeword。</div>
              <p>
                所以 <M>{'C = \\ker H'}</M> 是 <M>{`\\mathbb{F}_2^{${N}}`}</M> 的 <strong>subspace</strong>；codeword 的集合是 subspace 的 code，稱為
                <strong>linear code</strong>。<M>k</M> 是 subspace 的 dimension，所以有 <M>{'2^k'}</M> 個 codeword；Hamming({N},{K}) 就是 <M>{`k = ${K}`}</M> 的 linear code，第 4 章再看它的 minimum distance <M>{'d_{\\min}'}</M>。
              </p>
            </div>
          </Card>
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="每多一盞燈，放行的字串就少一半">
          <PassGrid message={message} />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="實例計算：發送端造、接收端驗">
          <Card
            title="改變訊息 m：編碼與檢查同步更新"
            actions={
              <>
                <Segmented
                  value={view}
                  onChange={setView}
                  ariaLabel="切換發送端或接收端"
                  options={[
                    {
                      value: 'mG',
                      label: (
                        <>
                          發送端 <M>{'c = mG'}</M>
                        </>
                      ),
                    },
                    {
                      value: 'Hc',
                      label: (
                        <>
                          接收端 <M>{'Hc^T'}</M> = {L} 盞燈
                        </>
                      ),
                    },
                  ]}
                />
                <ResetButton onClick={resetMessage} />
              </>
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <MessageInput message={message} onToggle={toggleBit} size="md" />
              <div className="text-sm text-slate-600">
                <M>{`m = (${message.join(',')})`}</M>，<M>{`c = ${c.join('')}`}</M>
              </div>
            </div>

            {view === 'mG' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <MatrixView matrix={G74} name="G" colLabels={colLabels74} rowLabels={message.map((b, i) => `D${i + 1}=${b}`)} highlightRows={selectedRows} dimRows={G74.map((_, i) => i).filter((i) => !selectedRows.includes(i))} />
                  <p className="mt-2 text-xs text-slate-500">
                    發送端：<M>{'mG'}</M> = 把 <M>{'D_i = 1'}</M> 的那些列（按下的開關）加起來（mod 2）。
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 font-mono text-sm">
                  {selectedRows.length === 0 && <div className="text-slate-500">m = 0，沒有選到任何列 → c = 0000000</div>}
                  {selectedRows.map((i, k) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 text-right text-slate-400">{k === 0 ? '' : '+'}</span>
                      <span className="w-14 text-xs text-amber-700">
                        g<sub>{i + 1}</sub>
                      </span>
                      <BitString bits={G74[i]} />
                    </div>
                  ))}
                  <div className="my-1 ml-[5.5rem] border-t border-slate-300" />
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right text-slate-400">=</span>
                    <span className="w-14 text-xs font-semibold text-slate-700">c</span>
                    <BitString bits={c} className="font-bold" highlight={(j) => (LAYOUT_74[j].role === 'parity' ? 'text-parity-600' : 'text-data-600')} />
                  </div>
                </div>
              </div>
            )}

            {view === 'Hc' && (
              <div className="flex flex-wrap items-center gap-4">
                <MatrixView matrix={H74} name="H" colLabels={c.map((b) => `c=${b}`)} rowLabels={LAMP} highlightCols={selectedCols} />
                <span className="text-xl">·</span>
                <ColumnVector bits={c} label={<M>{'c^T ='}</M>} size="sm" />
                <span className="text-xl">=</span>
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="mb-1 text-xs text-slate-500">
                    接收端：被選中的欄（<M>{'c_j = 1'}</M>）相加：
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedCols.map((j, k) => (
                      <span key={j} className="inline-flex items-center gap-1.5">
                        {k > 0 && <span className="text-slate-400">+</span>}
                        <ColumnVector bits={column(H74, j)} size="sm" cellClass="text-fuchsia-700" />
                      </span>
                    ))}
                    <span className="text-slate-400">=</span>
                    <ColumnVector bits={Hc} size="sm" cellClass="text-emerald-700 bg-emerald-50" />
                    <span className="ml-2 inline-flex items-center gap-2">
                      <Lamps bits={Hc} />
                      <span className="text-xs font-semibold text-emerald-700">{isZeroVector(Hc) ? '燈全暗' : '有燈亮'}</span>
                    </span>
                  </div>
                </div>
              </div>
            )}
          </Card>
          <Derivation
            resetKey={message.join('')}
            steps={[
              {
                title: '發送端：寫出 c = mG',
                body: <Tex block>{`c = (${message.join(',')})\\,${matrixToTex(G74)}`}</Tex>,
              },
              {
                title: '列的 linear combination',
                body: <Tex block>{`c = ${message.map((b, i) => `${b}\\cdot g_${i + 1}`).join(' + ')} = ${c.join('')}`}</Tex>,
              },
              {
                title: '接收端：檢查 Hcᵀ',
                body: <Tex block>{`Hc^T = ${matrixToTex(H74)} ${matrixToTex(c.map((b) => [b]))} = ${matrixToTex(Hc.map((b) => [b]))}`}</Tex>,
              },
            ]}
          />
          <Expandable title="進階：rank、nullity（零度）與線性代數實驗區">
            <RankNullityPrimer />
            <div className="pt-3">
              <h3 className="text-base font-bold text-slate-900">線性代數實驗區：換成任何矩陣</h3>
              <p className="text-sm text-slate-600">Gaussian elimination、rank、kernel 與 rank–nullity theorem，可以在任何 0/1 矩陣上試。預設是 H，按「有相依列」等按鈕換成其他例子。</p>
            </div>
            <LinearAlgebraLab />
          </Expandable>
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="同一個 code：G 怎麼造，H 怎麼驗">
          <Callout kind="key" title="結論">
            <p>
              <strong>發送端</strong>：G 的 {K} 列就是 encoder 的接線圖，
              <M>{'c = mG'}</M>；XOR 可以疊加，所以只要記 {K} 列，不用存表；資料欄是 <M>{`I_${K}`}</M>，codeword 原封不動地帶著訊息，不同訊息也就一定送出不同的 codeword。
            </p>
            <p>
              <strong>接收端</strong>：H 的 {L} 列就是 {L} 個檢查器、{L} 盞警示燈，第 j 欄是位置 j 出錯時亮的燈。五個設計（非零、互不相同、用滿 {PATTERNS} 種亮法、二進位順序、parity bit 在 {PARITY_POS}
              ）讓每個位置都有一種專屬、能直接讀成位置編號的亮法，encoder 也只是 {L} 組各算各的 XOR。
            </p>
            <p>
              <M>{'HG^T = 0'}</M>：沒有雜訊時燈全暗；而且 {ALL_WORDS} 個字串裡，燈全暗的正好是造得出的 {2 ** RANK_G} 個：
              <M>{'C = \\{mG\\} = \\ker H'}</M>
              。下一章：燈亮了以後，接收端怎麼用它找出並修好錯誤。
            </p>
          </Callout>
          <Misconceptions
            items={[
              {
                wrong: '燈全暗，就代表傳輸途中沒有雜訊。',
                right: `燈全暗只代表收到的是某個 codeword。雜訊若剛好把一個 codeword 變成另一個（至少要翻 ${D_MIN} 個位元），燈照樣全暗（第 4 章）。`,
              },
              {
                wrong: 'H 的第 j 欄一定要是 j 的二進位，否則就不是 Hamming code。',
                right: '欄的順序可以任意排，排列後是 equivalent code，能力完全一樣；二進位順序只是讓燈號直接讀成位置。第二課把 Hamming code 寫成 cyclic code（循環碼），用的就是另一種排法。',
              },
              {
                wrong: 'G 和 H 描述兩個不同的 code。',
                right: `G 告訴發送端怎麼造、H 告訴接收端怎麼驗，描述的是同一組 ${2 ** RANK_G} 個 codeword：C = {mG} = ker H。`,
              },
            ]}
          />
          <Card>
            <RelatedLinks
              links={[
                {
                  to: 'a-5',
                  text: 'Generator matrix G → generator polynomial（生成多項式）：cyclic code 的 encoder',
                },
                { to: 'a-9', text: '用 GF(8) 推導 H：一條方程 c(α) = 0' },
                { to: 'a-1', text: '這些矩陣運算都在 GF(2) 中' },
              ]}
              title="延伸：代數基礎與 cyclic codes"
            />
          </Card>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

function LinearAlgebraLab() {
  const [A, setA] = useState<Matrix>(H74.map((r) => [...r]));
  const [step, setStep] = useState(-1); // −1 = show final RREF; k = after k-th op
  const res = useMemo(() => rref(A), [A]);
  const basis = useMemo(() => kernelBasis(A), [A]);
  const kernel = useMemo(() => span(basis, A[0].length), [basis, A]);
  const rows = A.length;
  const cols = A[0].length;
  const isH = A.length === 3 && A.every((r, i) => r.length === 7 && r.every((v, j) => v === H74[i][j]));

  const shownStep = step < 0 ? res.steps.length : step;
  const shownMatrix = shownStep === 0 ? A : res.steps[shownStep - 1].matrix;

  const resize = (dRows: number, dCols: number) => {
    const nr = Math.min(4, Math.max(1, rows + dRows));
    const nc = Math.min(8, Math.max(2, cols + dCols));
    setA(Array.from({ length: nr }, (_, a) => Array.from({ length: nc }, (_, b) => (A[a]?.[b] ?? 0) as Bit)));
    setStep(-1);
  };

  return (
    <LabGrid
      main={
        <>
          <Card
            title="1. 編輯矩陣 M（點擊元素切換 0/1）"
            actions={
              <>
                {Object.entries(PRESETS).map(([key, p]) => (
                  <button
                    key={key}
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => {
                      setA(p.m.map((r) => [...r]));
                      setStep(-1);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-6">
              <MatrixView
                matrix={A}
                name="M ="
                onCellClick={(a, b) => {
                  setA(A.map((r, x) => r.map((v, y) => (x === a && y === b ? ((1 - v) as Bit) : v))));
                  setStep(-1);
                }}
              />
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  列數 {rows}
                  <button className="btn-ghost !p-1" onClick={() => resize(-1, 0)} aria-label="減少列">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button className="btn-ghost !p-1" onClick={() => resize(1, 0)} aria-label="增加列">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  欄數 {cols}
                  <button className="btn-ghost !p-1" onClick={() => resize(0, -1)} aria-label="減少欄">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button className="btn-ghost !p-1" onClick={() => resize(0, 1)} aria-label="增加欄">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="2. Gaussian elimination：GF(2) 版本">
            <div className="flex flex-wrap items-center gap-4">
              <MatrixView
                matrix={shownMatrix}
                highlightCols={shownStep === res.steps.length ? res.pivotCols : []}
                colHighlightClass="bg-indigo-100 text-indigo-800"
                cellClass={(a) => {
                  const op = shownStep > 0 ? res.steps[shownStep - 1].op : null;
                  if (!op) return undefined;
                  const touched = op.kind === 'swap' ? [op.i, op.j] : [op.target];
                  return touched.includes(a) ? 'bg-amber-100 text-amber-900' : undefined;
                }}
              />
              <div className="min-w-[180px] flex-1 text-sm">
                <div className="text-xs text-slate-500">
                  步驟 {shownStep} / {res.steps.length}
                </div>
                <div className="mt-1 min-h-[28px]">{res.steps.length === 0 ? '原始矩陣已是 RREF，不需要 row operation（列運算）' : shownStep === 0 ? '原始矩陣' : <Tex>{formatRowOp(res.steps[shownStep - 1].op)}</Tex>}</div>
                {shownStep === res.steps.length && <div className="mt-1 text-xs text-indigo-700">RREF；pivot column 以藍色標示</div>}
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost" disabled={shownStep === 0} onClick={() => setStep(shownStep - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost" disabled={shownStep === res.steps.length} onClick={() => setStep(shownStep + 1 >= res.steps.length ? -1 : shownStep + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setStep(0)}>
                    從頭
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title={`3. Kernel ker M 的全部元素（共 ${kernel.length} 個）`}>
            <div className="flex flex-wrap gap-1.5">
              {kernel.map((v) => (
                <span key={bitsToString(v)} className={`rounded-md border px-1.5 py-0.5 font-mono text-xs ${v.every((b) => b === 0) ? 'border-slate-200 text-slate-400' : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}>
                  {bitsToString(v)}
                </span>
              ))}
            </div>
            {isH && (
              <p className="mt-2 text-xs text-emerald-700">
                ✓ M = H：這 {kernel.length} 個向量正是 {CODEWORDS.length} 個 Hamming({N},{K}) codeword。
              </p>
            )}
          </Card>
        </>
      }
      aside={
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="rank(M)" value={res.rank} sub="pivot column 數" tone="indigo" />
            <Stat label="nullity(M)" value={cols - res.rank} sub="= dim ker M" tone="amber" />
            <Stat label="欄數" value={cols} />
            <Stat label="|ker M|（元素個數）" value={kernel.length} sub={<M>{`2^{${cols - res.rank}}`}</M>} tone="emerald" />
          </div>
          <Card title="Rank–nullity theorem">
            <Tex block>{`\\operatorname{rank}(M) + \\operatorname{nullity}(M) = \\text{欄數}`}</Tex>
            <Tex block>{`${res.rank} + ${cols - res.rank} = ${cols}\\ \\checkmark`}</Tex>
          </Card>
          <Card title="ker M 的 basis">
            {basis.length === 0 ? (
              <p className="text-sm text-slate-500">ker M = {'{0}'}，basis 為空集合。</p>
            ) : (
              <div className="space-y-1">
                {basis.map((b, k) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <M>{`v_{${k + 1}} =`}</M>
                    <span className="mono">{bitsToString(b)}</span>
                    <span className="text-xs text-slate-400">（free variable x{res.freeCols[k] + 1} = 1）</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">每個 free column 產生一個 basis 向量；basis 向量的個數就是 dimension。</p>
          </Card>
          <Misconceptions
            items={[
              {
                wrong: `nullity(H) = ${N - RANK_H}，所以 ker H 有 ${N - RANK_H} 個元素。`,
                right: (
                  <>
                    nullity 是 dimension。{N - RANK_H} 維的 GF(2) vector space（向量空間）有 <M>{`2^{${N - RANK_H}} = ${2 ** (N - RANK_H)}`}</M> 個元素（每個 basis 係數可選 0 或 1）。
                  </>
                ),
              },
              {
                wrong: 'ker H 的 basis 是唯一的。',
                right: `ker H 的 basis 不唯一（例如 G 的 ${G74.length} 列也是一組 basis），但 basis 向量的個數（dimension）是唯一的。`,
              },
            ]}
          />
          <Expandable title="證明：|ker M| = 2^nullity">
            <p>
              設 ker M 的 basis 是 <M>{'v_1, v_2, \\dots'}</M>，共 nullity M 個向量，則每個元素可唯一寫成 <M>{'a_1v_1 + a_2v_2 + \\cdots'}</M>
              ，其中每個係數 <M>{'\\in \\{0,1\\}'}</M>。係數有 <M>{'2^{\\operatorname{nullity} M}'}</M> 種選法，且由 linear independence，不同係數給出不同向量。
            </p>
          </Expandable>
        </>
      }
    />
  );
}
