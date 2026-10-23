import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Layers } from 'lucide-react';
import {
  type Bit,
  type ChannelOutcome,
  type SecdedCase,
  type SecdedOutcome,
  DEFAULT_MESSAGE,
  H74,
  H84,
  K4,
  LAYOUT_74,
  LAYOUT_84,
  N7,
  N8,
  OVERALL_INDEX,
  PARITY_CHECKS,
  allVectors,
  codewords74,
  codewords84,
  correctionCapability,
  decode74,
  detectionCapability,
  differingPositions,
  doubleErrorLandings,
  encode74,
  encode84,
  extractMessage74,
  flipBit,
  flipPath,
  hammingBound,
  hammingDistance,
  isCodeword74,
  isZeroVector,
  matVec,
  minimumDistance,
  partitionByNearest,
  rank,
  secdedDecode,
  shortenedHamming,
  simulate74,
  simulate84,
  sphereTerms,
  syndromeToPosition,
  vecEquals,
  weight,
  weightDistribution,
  zeroVector,
} from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitRow, BitString, MessageInput, RoleLegend, type BitState } from '../components/Bits';
import { MatrixView } from '../components/MatrixView';
import { Bars } from '../components/Bars';
import { DistanceLine } from '../components/DistanceLine';
import { RelatedLinks } from '../components/alg/Links';
import { Callout, Card, Derivation, Expandable, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Segmented, Stage, Stat, StatusBadge, type DecodeStatus } from '../components/Lesson';

const ID = 'secded';

/* ------------------------------------------------------------------ */
/* Numbers on this page (computed from the core, never typed)          */
/* ------------------------------------------------------------------ */

/** Hamming(7,4): 7 positions, 4 data bits, ℓ = 3 parity bits = 3 lamps */
const N = N7;
const K = K4;
const L = H74.length;
const STATES = 2 ** L;
/** Extended(8,4): one more position (P0) and one more lamp, the 4th row of H₈ */
const NE = N8;
const RE = H84.length;
const RANK8 = rank(H84);
const P0 = LAYOUT_84[OVERALL_INDEX].label;
const P0_POS = LAYOUT_84[OVERALL_INDEX].position;

const C7 = codewords74();
const C8 = codewords84();
const W7 = C7.map((e) => e.codeword);
const W8 = C8.map((e) => e.codeword);
const MD7 = minimumDistance(W7);
const MD8 = minimumDistance(W8);
const D7 = MD7.dmin;
const D8 = MD8.dmin;
const T7 = correctionCapability(D7);
const T8 = correctionCapability(D8);
/** correct 1 and detect 2 at the same time needs d_min ≥ 1 + 2 + 1 */
const SECDED_NEED = 1 + 2 + 1;
const HB7 = hammingBound(N, K, T7);
const HB8 = hammingBound(NE, K, T8);
const RATE7 = K / N;
const RATE8 = K / NE;

/** What each decoder does with every error of weight w. The outcome never depends on the codeword sent (s and q only see e). */
function outcomes84(w: number) {
  const runs = allVectors(NE)
    .filter((e) => weight(e) === w)
    .map((e) => simulate84(zeroVector(NE), e));
  return { total: runs.length, ok: runs.filter((o) => o.success).length, detected: runs.filter((o) => o.result.case === 'double-detected').length };
}
function outcomes74(w: number) {
  const runs = allVectors(N)
    .filter((e) => weight(e) === w)
    .map((e) => simulate74(zeroVector(N), e));
  return { total: runs.length, mis: runs.filter((o) => o.miscorrection).length };
}
const ONE8 = outcomes84(1);
const TWO8 = outcomes84(2);
const TWO7 = outcomes74(2);
/** where the double errors land: next to another codeword (Hamming) or in between (Extended) */
const DOUBLE8 = doubleErrorLandings(W8);

/** chapter 4's path, now in the extended code: A = codeword of the shared default message, B = codeword of 1111 (pinned in core.test) */
const EXAMPLE_POS = 5;
const A_IDX = C8.findIndex((e) => vecEquals(e.message, DEFAULT_MESSAGE));
const B_IDX = C8.findIndex((e) => e.message.every((b) => b === 1));
const A = W8[A_IDX];
const B = W8[B_IDX];
const D_AB7 = hammingDistance(W7[A_IDX], W7[B_IDX]);
const D_AB = hammingDistance(A, B);
const AB_DIFF = differingPositions(A, B).map((i) => i + 1);
const PATH = flipPath(A, B, [EXAMPLE_POS - 1]).map((st) => {
  const dec = secdedDecode(st.word);
  const out = dec.corrected;
  return { ...st, dA: hammingDistance(st.word, A), dB: hammingDistance(st.word, B), dec, toA: !!out && vecEquals(out, A), toB: !!out && vecEquals(out, B) };
});
const MID = Math.floor(D_AB / 2);
const STEP1 = PATH[1];
const STEP_MID = PATH[MID];
/** the two flips that leave the word in the middle: the chapter's double-error example */
const PAIR = STEP_MID.flipped;

/** server memory: 64 data bits per word (pinned in scaling.test: r = 7, (127,120) → (71,64) → (72,64)) */
const WORD_BITS = 64;
const SERVER = shortenedHamming(WORD_BITS);
const SERVER_CHECK = SERVER.nSecded - SERVER.k;

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
/** reading the lamps as a binary number: P4 P2 P1, the most significant first */
const READ = [...LAMP.keys()].reverse();
const binText = (bits: readonly Bit[]) => `${READ.map((i) => bits[i]).join('')}₂`;
/** the 3 lamps as a labelled vector (s₁, s₂, s₄), named after P1, P2, P4 */
const S_NAMES = LAMP.map((name) => name.replace('P', 's_'));
const sVecTex = (bits: readonly Bit[]) => `(${S_NAMES.join(', ')}) = (${bits.join(', ')})`;
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
const posList = (idx: readonly number[]) => [...idx].sort((a, b) => a - b).map((i) => i + 1).join('、');
const fmt = (x: number) => x.toFixed(3);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/* ------------------------------------------------------------------ */
/* Small pictures                                                      */
/* ------------------------------------------------------------------ */

/** The receiver's lamps: the 3 of chapters 2–3 (s, in H's row order), and the 4th lamp q that watches all 8 positions. */
function Lamps({ s = [], q, size = 'md' }: { s?: readonly Bit[]; q?: Bit; size?: 'sm' | 'md' }) {
  const d = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  const one = (key: string, on: boolean, label: string, lit: string) => (
    <span key={key} className="inline-flex flex-col items-center gap-0.5">
      <span className={`${d} rounded-full border-2 ${on ? lit : 'border-slate-300 bg-slate-200'}`} />
      <span className="text-[10px] font-semibold leading-none text-slate-500">{label}</span>
    </span>
  );
  return (
    <span className="inline-flex items-end gap-1.5 align-middle" role="img" aria-label={[s.length ? `警示燈${lampText(s)}` : '', q === undefined ? '' : `第 ${RE} 盞燈${q ? '亮' : '暗'}`].filter(Boolean).join('，')}>
      {s.map((b, i) => one(LAMP[i], b === 1, LAMP[i], 'border-rose-500 bg-rose-400 shadow-[0_0_8px_2px_rgba(244,63,94,0.45)]'))}
      {q !== undefined && (
        <>
          {s.length > 0 && <span className="mx-0.5 h-5 w-px self-center bg-slate-300" aria-hidden />}
          {one('q', q === 1, P0, 'border-overall-600 bg-overall-500 shadow-[0_0_8px_2px_rgba(139,85,240,0.5)]')}
        </>
      )}
    </span>
  );
}

const CASE_INFO: Record<SecdedCase, { title: string; flips: string; action: string; status: DecodeStatus; s: string; q: string }> = {
  'no-error': { title: '沒有錯', flips: '沒有位元被翻轉', action: '原樣輸出', status: 'ok', s: 's = 0', q: 'q = 0' },
  'single-corrected': { title: `錯 1 個，在位置 1–${N}`, flips: '翻了 1 位', action: '翻轉 s 指出的位置', status: 'corrected', s: 's ≠ 0', q: 'q = 1' },
  'overall-corrected': { title: `錯 1 個，就是 ${P0} 自己`, flips: `前 ${N} 位沒翻，翻的是 ${P0}`, action: `翻轉 ${P0}`, status: 'corrected', s: 's = 0', q: 'q = 1' },
  'double-detected': { title: '錯 2 個', flips: '翻了偶數位，又不是 0 位', action: '回報，不修正', status: 'detected', s: 's ≠ 0', q: 'q = 0' },
};

/** What the SECDED receiver ends up with at step k of the A → B walk. */
function PathResult({ k }: { k: number }) {
  const st = PATH[k];
  if (k === 0) return <span className="chip bg-emerald-100 text-emerald-800">收到 A</span>;
  if (st.dec.case === 'double-detected') return <span className="chip bg-orange-100 text-orange-800">回報：不修</span>;
  if (st.toA) return <span className="chip bg-emerald-100 text-emerald-800">修回 A ✓</span>;
  if (st.toB && k === D_AB) return <span className="chip bg-rose-100 text-rose-800">就是 B：看不出錯</span>;
  if (st.toB) return <span className="chip bg-rose-100 text-rose-800">改成 B ✗</span>;
  return <span className="chip bg-slate-100 text-slate-600">{st.dec.corrected?.join('')}</span>;
}

const pathAction = (k: number) => (PATH[k].dec.case === 'double-detected' ? '回報' : PATH[k].dec.correctedPosition ? `翻位置 ${PATH[k].dec.correctedPosition}` : '不動');
const pathRowTone = (k: number) => (k === 1 ? 'bg-emerald-50/60' : k === MID ? 'bg-orange-50/70' : '');
const pathWordTone = (st: (typeof PATH)[number]) => (j: number) => (st.flipped.includes(j) ? 'text-rose-600 font-bold' : j === OVERALL_INDEX ? 'text-overall-600' : undefined);

/** The walk A → B in the extended code, one flipped bit per row: distances, the 4 lamps, what the SECDED receiver does (a table from sm, stacked rows on phones). */
function PathTable() {
  return (
    <>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-2">雜訊翻了</th>
              <th className="pr-2">收到的字</th>
              <th className="pr-2">離 A</th>
              <th className="pr-2">離 B</th>
              <th className="pr-2">{RE} 盞燈（s 與 q）</th>
              <th className="pr-2">接收端</th>
              <th>結果</th>
            </tr>
          </thead>
          <tbody>
            {PATH.map((st, k) => (
              <tr key={k} className={`border-t border-slate-100 ${pathRowTone(k)}`}>
                <td className="py-1.5 pr-2">
                  <span className="font-semibold text-slate-800">{k} 位</span>
                  <span className="block text-[11px] text-slate-500">{k === 0 ? '送出 A' : `位置 ${st.flipped.map((i) => i + 1).join('、')}`}</span>
                </td>
                <td className="pr-2">
                  <BitString bits={st.word} className="text-sm font-semibold" highlight={pathWordTone(st)} />
                </td>
                <td className={`pr-2 font-mono ${st.dA < st.dB ? 'font-bold text-data-700' : 'text-slate-500'}`}>{st.dA}</td>
                <td className={`pr-2 font-mono ${st.dB < st.dA ? 'font-bold text-overall-700' : 'text-slate-500'}`}>{st.dB}</td>
                <td className="pr-2">
                  <Lamps s={st.dec.syndrome} q={st.dec.overallParity} size="sm" />
                </td>
                <td className="pr-2 text-xs text-slate-700">{pathAction(k)}</td>
                <td>
                  <PathResult k={k} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="space-y-2 sm:hidden">
        {PATH.map((st, k) => (
          <li key={k} className={`rounded-xl border border-slate-200 px-3 py-2 text-sm ${pathRowTone(k)}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <span className="font-semibold text-slate-800">翻 {k} 位</span>
                <span className="ml-1.5 text-xs text-slate-500">{k === 0 ? '送出 A' : `位置 ${st.flipped.map((i) => i + 1).join('、')}`}</span>
              </span>
              <PathResult k={k} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <BitString bits={st.word} className="text-sm font-semibold" highlight={pathWordTone(st)} />
              <span className="text-xs text-slate-600">
                離 A <strong className={st.dA < st.dB ? 'text-data-700' : 'font-normal'}>{st.dA}</strong>・離 B <strong className={st.dB < st.dA ? 'text-overall-700' : 'font-normal'}>{st.dB}</strong>
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-700">
              <Lamps s={st.dec.syndrome} q={st.dec.overallParity} size="sm" />
              <span>→ 接收端{pathAction(k)}</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

/** Hamming(7,4) meets a double error: it flips a third bit, and the result is a valid codeword that no later check can flag. */
function SilentMiscorrection() {
  const { message } = useMessage();
  const c = encode74(message);
  const r = PAIR.reduce<Bit[]>((w, i) => flipBit(w, i), c);
  const d = decode74(r);
  const out = d.corrected;
  const outMsg = extractMessage74(out);
  const wrong = differingPositions(out, c);
  const label = 'w-28 shrink-0 text-xs text-slate-500';
  return (
    <Card title={`用 Hamming(${N},${K})：雜訊翻了位置 ${posList(PAIR)}`}>
      <div className="space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className={label}>送出 c（m = {message.join('')}）</span>
          <BitString bits={c} className="text-base font-bold" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={label}>收到 r</span>
          <BitString bits={r} className="text-base font-bold" highlight={(j) => (PAIR.includes(j) ? 'text-rose-600' : undefined)} />
          <Lamps s={d.syndrome} size="sm" />
          <span className="text-xs text-slate-600">
            {lampText(d.syndrome)} → 指向位置 {d.position}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={label}>解碼器輸出</span>
          <BitString bits={out} className="text-base font-bold" highlight={(j) => (wrong.includes(j) ? 'text-rose-600' : undefined)} />
          <Lamps s={matVec(H74, out)} size="sm" />
          <span className="text-xs text-slate-600">{isCodeword74(out) ? '燈全暗：合法 codeword' : '✗'}</span>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        解碼器以為只錯 1 位，去翻位置 {d.position}：錯誤從 2 個變成 {wrong.length} 個，交出去的是 <strong>m = {outMsg.join('')}</strong> 的 codeword。它本身就是合法的 codeword，再檢查一次燈也全暗，<strong>沒有任何記號說它被改過</strong>。
      </p>
      <div className="mt-3">
        <Stat label={`Hamming(${N},${K}) 翻 2 位（全部 ${TWO7.total} 種）`} value={`${TWO7.mis}/${TWO7.total}`} sub="全部被改成另一個 codeword" tone="rose" />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

const errorFrom = (idx: readonly number[]): Bit[] => idx.reduce<Bit[]>((e, i) => flipBit(e, i), zeroVector(NE));
const presetLabel = (idx: readonly number[]) => {
  if (idx.length === 0) return '無錯誤';
  if (idx.length === 1) return idx[0] === OVERALL_INDEX ? `單一錯誤在 ${P0}（位置 ${P0_POS}）` : `單一錯誤（位置 ${idx[0] + 1}）`;
  const pos = [...idx].sort((a, b) => a - b).map((i) => i + 1).join('、');
  return `${idx.length === 2 ? '兩個' : '三個'}錯誤（位置 ${pos}）`;
};
const TRIPLE = [0, 1, 2];
/** the triple-error preset: its first 7 bits are a Hamming(7,4) codeword, so s = 0 and q = 1 */
const TRIPLE_E7 = errorFrom(TRIPLE).slice(0, N);
/** triple preset + P0: weight 4, s = 0 and q = 0, so SECDED says "no error" (undetected) */
const QUAD = [...TRIPLE, OVERALL_INDEX];
const QUAD_E = errorFrom(QUAD);
const PRESETS = [[], [EXAMPLE_POS - 1], [OVERALL_INDEX], PAIR, [2, OVERALL_INDEX], TRIPLE].map((idx) => ({ idx, label: presetLabel(idx) }));
const DEFAULT_ERROR = errorFrom(PAIR);

function secdedStatus(o: SecdedOutcome): DecodeStatus {
  if (o.result.case === 'double-detected') return 'detected';
  if (!o.success) return 'wrong';
  return o.errorWeight === 0 ? 'ok' : 'corrected';
}

function hammingStatus(o: ChannelOutcome): DecodeStatus {
  if (!o.success) return 'wrong';
  return o.errorWeight === 0 ? 'ok' : 'corrected';
}

export default function M5Secded() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c7 = useMemo(() => encode74(message), [message]);
  const c8 = useMemo(() => encode84(message), [message]);
  const w7 = weight(c7);
  const [e, setE] = useState<Bit[]>(DEFAULT_ERROR);
  const [mode, setMode] = useState<'h84' | 'h74' | 'both'>('both');

  const o8 = useMemo(() => simulate84(c8, e), [c8, e]);
  const o7 = useMemo(() => simulate74(c7, e.slice(0, N)), [c7, e]);
  const r = o8.result;
  const sZero = isZeroVector(r.syndrome);
  const st8 = secdedStatus(o8);
  const st7 = hammingStatus(o7);
  const flip = (i: number) => setE((x) => flipBit(x, i));
  const resetAll = () => {
    resetMessage();
    setE(DEFAULT_ERROR);
  };

  const compareRows: { k: string; label: ReactNode; a: string; b: string }[] = [
    { k: 'n', label: '碼長 n', a: String(N), b: String(NE) },
    { k: 'k', label: '資料位元數 k', a: String(K), b: String(K) },
    { k: 'lamps', label: '接收端的燈', a: `${L} 盞`, b: `${RE} 盞（多 ${P0}）` },
    { k: 'rate', label: '碼率 k/n', a: fmt(RATE7), b: fmt(RATE8) },
    {
      k: 'dmin',
      label: (
        <>
          最小距離 <M>{'d_{\\min}'}</M>（窮舉）
        </>
      ),
      a: String(D7),
      b: String(D8),
    },
    { k: 't', label: '保證修正 t', a: String(T7), b: String(T8) },
    {
      k: 'detect',
      label: (
        <>
          只偵測、不修正時，保證偵測 <M>{'d_{\\min} - 1'}</M>
        </>
      ),
      a: String(detectionCapability(D7)),
      b: String(detectionCapability(D8)),
    },
    {
      k: 'secded',
      label: (
        <>
          同時修正 1 + 偵測 2（<M>{`d_{\\min} \\ge ${SECDED_NEED}`}</M>）
        </>
      ),
      a: D7 >= SECDED_NEED ? '✓' : '✗',
      b: D8 >= SECDED_NEED ? '✓（SECDED）' : '✗',
    },
    { k: 'two', label: '翻 2 位時', a: `誤更正（${TWO7.mis}/${TWO7.total}）`, b: `回報（${TWO8.detected}/${TWO8.total}）` },
    { k: 'perfect', label: '完美碼？', a: HB7.equality ? `是（${HB7.lhs} = ${HB7.rhs}）` : '否', b: HB8.equality ? '是' : `否（${HB8.lhs} < ${HB8.rhs}）` },
  ];

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          第 4 章的結尾：Hamming({N},{K}) 是完美碼，{L} 盞燈的 {STATES} 種狀態全部用掉，沒有一種能說「錯了兩個」；翻 2 位時，解碼器只能照著燈號翻，結果誤更正。這一章從伺服器的 ECC 記憶體出發：錯了兩個時，寧可回報，也不要誤更正。做法是多一盞燈。
        </p>
      </ModuleHeader>
      <KeyPoint>多一盞燈數翻轉個數的奇偶：錯 1 個照樣修好，錯 2 個就舉手回報，而不是悄悄誤更正。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="ECC 記憶體：寧可回報，也不要誤更正">
          <Card title="伺服器的 ECC 記憶體">
            <div className="space-y-2 text-sm leading-relaxed text-slate-700">
              <p>
                伺服器的記憶體整天都在讀寫，宇宙射線、電壓雜訊偶爾會翻轉其中一個位元。<strong>ECC 記憶體</strong>（Error-Correcting Code memory）每存一筆資料，就多存幾個檢查位元；讀出來的時候，記憶體控制器就是接收端：算燈號、修好錯，再把資料交給程式。
              </p>
              <p>翻 1 位最常見：當場修好，程式完全不知道。翻 2 位少見得多，但伺服器日夜在跑、記憶體又大，遲早會遇到。這時 Hamming({N},{K}) 會怎麼做？</p>
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <SilentMiscorrection />
            <div className="grid grid-cols-1 gap-4 lg:grid-rows-2">
              <div className="rounded-xl border border-rose-300 bg-rose-50/70 p-4 text-sm leading-relaxed text-rose-950">
                <div className="mb-1 font-bold text-rose-800">悄悄誤更正：沒有人知道</div>
                輸出是合法的 codeword，之後任何檢查都看不出來。錯的資料被當成正確的繼續計算、寫回硬碟、傳給別台機器，等發現時已經找不到源頭。
              </div>
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 text-sm leading-relaxed text-emerald-950">
                <div className="mb-1 font-bold text-emerald-800">舉手回報：系統還能補救</div>
                系統知道這一筆壞了：可以重讀一次、從磁碟或網路重新取得，或把這一頁記憶體標成壞頁不再使用；最壞也是停下來，而不是帶著錯的資料繼續跑。
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            要回報，接收端得分得出「錯 1 個」和「錯 2 個」。第 4 章已經看到：{L} 盞燈的 {STATES} 種狀態都有主人，翻 2 位亮出的燈號，和某個位置翻 1 位一模一樣。光靠這 {L} 盞燈做不到，所以要<strong>多一盞燈</strong>。修 1 個、偵測 2 個的碼叫 <strong>SECDED</strong>：<strong>S</strong>ingle <strong>E</strong>rror <strong>C</strong>orrection, <strong>D</strong>ouble <strong>E</strong>rror <strong>D</strong>etection。
          </p>
        </Stage>

        <Stage kind="definition" moduleId={ID} title={`多一盞燈：${P0}（整體同位位元）與 Extended Hamming(${NE},${K})`}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title={`第 ${RE} 盞燈：翻了奇數位還是偶數位`}>
              <div className="space-y-2 text-sm leading-relaxed text-slate-700">
                <p>
                  錯 1 個和錯 2 個，{L} 盞燈都不會全暗（s ≠ 0），亮法也都是 H 的某一欄：光看這 {L} 盞分不出來。兩者真正不同的是<strong>翻了幾位</strong>：每翻一位，1 的總數奇偶就變一次。翻 1 位變成奇數，翻 2 位又變回偶數。
                </p>
                <ul className="list-disc space-y-1.5 pl-5">
                  <li>
                    <strong>發送端</strong>：多送一個 {P0}（整體同位位元），讓全部 {NE} 個位元一定有偶數個 1。
                  </li>
                  <li>
                    <strong>接收端</strong>：第 {RE} 盞燈 q 看全部 {NE} 位，1 的個數是奇數就亮：翻奇數位亮，沒翻或翻偶數位暗。
                  </li>
                  <li>
                    <strong>放在第 {P0_POS} 位</strong>：前 {N} 位和 Hamming({N},{K}) 一模一樣，原本的 {L} 盞燈、第 2 章 H 的設計 ①–⑤、第 3 章「燈號讀成二進位、接上 {L}-to-{STATES} 解碼器」都不用改；第 {RE} 盞燈只是另外一棵 XOR 樹，由它決定解碼器的輸出要照翻、翻 {P0}，還是改成回報（四格見下）。
                  </li>
                  <li>
                    <strong>代價</strong>：每 {K} 個資料位元多送 1 位，碼率 <M>{`\\tfrac{${K}}{${N}} \\approx ${fmt(RATE7)} \\to \\tfrac{${K}}{${NE}} = ${fmt(RATE8)}`}</M>。
                  </li>
                </ul>
              </div>
            </Card>
            <Card title={`寫成數學：H 多一列全 1`}>
              <Tex block>{`P_0 = c_1 \\oplus c_2 \\oplus \\cdots \\oplus c_${N}`}</Tex>
              <Tex block>{`[\\,${LAYOUT_84.map((p) => p.label.replace(/(\d)/, '_$1')).join(',')}\\,]`}</Tex>
              <div className="mb-2">
                <RoleLegend overall />
              </div>
              <MatrixView matrix={H84} name={<M>{'H_8 ='}</M>} colLabels={LAYOUT_84.map((p) => p.label)} rowLabels={[...LAMP, P0]} highlightRows={[RE - 1]} rowHighlightClass="bg-overall-100 text-overall-800" />
              <p className="mt-2 text-sm text-slate-600">
                原本的 H 補一個零欄（{P0} 不參加 {LAMP.join('、')} 的檢查），再加一列全 1：第 {RE} 盞燈。<M>{`\\operatorname{rank} = ${RANK8}`}</M>，維度仍是 <M>{`${NE} - ${RANK8} = ${NE - RANK8}`}</M>：{P0} 由前 {N} 位決定，不帶新資訊。
              </p>
              <Tex block>{`\\begin{aligned} H_8\\,r^T &= \\begin{pmatrix} s \\\\ q \\end{pmatrix} \\\\ s &= H\\,(r_1,\\dots,r_${N})^T \\in \\mathbb{F}_2^${L} \\\\ q &= r_1 + \\cdots + r_${NE} \\in \\mathbb{F}_2 \\end{aligned}`}</Tex>
              <Tex block>{`(${N},${K}),\\ d_{\\min} = ${D7} \\;\\longrightarrow\\; (${NE},${K}),\\ d_{\\min} = ${D8}`}</Tex>
              <p className="text-sm text-slate-600">長度 +1（多了 {P0}）、資料位元仍是 {K} 個、最小距離 {D7} → {D8}（下一張卡片）。</p>
            </Card>
          </div>

          <Card title={`A 到 B 變成 ${D_AB} 步：雙錯停在正中間`}>
            <div className="space-y-2 text-sm leading-relaxed text-slate-700">
              <p>
                第 4 章的 A（m = {DEFAULT_MESSAGE.join('')}）和 B（m = {C8[B_IDX].message.join('')}）差 {D_AB7} 位。{D_AB7} 是奇數，兩者 1 的個數奇偶不同，所以 {P0} 也不同：在 ({NE},{K}) 裡它們差 {D_AB} 位（位置 {AB_DIFF.join('、')}）。雜訊從 A 出發，一樣先翻位置 {EXAMPLE_POS}：
              </p>
            </div>
            <div className="flex justify-center">
              <DistanceLine d={D_AB} nodeLabel={(k) => `翻 ${k} 位`} />
            </div>
            <div className="mt-3">
              <PathTable />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-3 text-sm leading-relaxed text-emerald-950">
                <div className="mb-1 font-bold text-emerald-800">翻 1 位：第 {RE} 盞燈亮 → 照樣修回 A</div>
                離 A {STEP1.dA}、離 B {STEP1.dB}。第 {RE} 盞燈亮（奇數位），{L} 盞燈（{lampText(STEP1.dec.syndrome)}）指向位置 {STEP1.dec.correctedPosition}，翻回來就是 A。
              </div>
              <div className="rounded-xl border border-orange-300 bg-orange-50/70 p-3 text-sm leading-relaxed text-orange-950">
                <div className="mb-1 font-bold text-orange-800">翻 2 位：停在正中間 → 回報</div>
                離 A {STEP_MID.dA}、離 B {STEP_MID.dB}，沒有哪一邊比較近。{L} 盞燈（{lampText(STEP_MID.dec.syndrome)}）不是全暗（s ≠ 0，有錯），第 {RE} 盞燈暗（翻了偶數位）：接收端知道錯的不只 1 位，不猜，回報。第 4 章同樣翻位置 {STEP_MID.flipped.map((i) => i + 1).join('、')} 時，字被推到 B：誤更正。
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              不只 A、B：{W8.length} 個 codeword 兩兩比較（{MD8.pairsChecked} 對），最近的一對也差 {D8} 位，<M>{`d_{\\min}: ${D7} \\to ${D8}`}</M>。{P0} 讓每個 codeword 都有偶數個 1，兩個 codeword 不同的位置也就是偶數個：原本差 {D7} 位的，{P0} 一定不同，補成 {D8} 位。翻 1 位時離原本的 codeword 1、離別人至少 {D8 - 1}，修得回來；翻 2 位時離每個 codeword 都至少 2（{DOUBLE8.total} 種雙錯，落在別人旁邊的 {DOUBLE8.nearOther} 種），不會被推到別人那邊，只會被偵測。
            </p>
          </Card>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title={`發送端算 ${P0}，接收端讀 ${RE} 盞燈`}>
          <LabGrid
            main={
              <Card title="改變資料，再點收到的位元製造錯誤" actions={<ResetButton onClick={resetAll} />}>
                <div className="space-y-4">
                  <MessageInput message={message} onToggle={toggleBit} size="md" />
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">
                      發送端：Hamming({N},{K}) codeword · {w7} 個 1（{w7 % 2 ? '奇數' : '偶數'}）
                    </div>
                    <BitRow bits={c7} layout={LAYOUT_84.slice(0, N)} size="sm" />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">
                      發送端：補上 {P0} = {c8[OVERALL_INDEX]} → ({NE},{K}) codeword · {weight(c8)} 個 1（必為偶數）
                    </div>
                    <BitRow bits={c8} layout={LAYOUT_84} size="sm" gapBefore={OVERALL_INDEX} />
                  </div>
                  <div className="border-t border-slate-100 pt-3">
                    <div className="mb-1 text-xs font-semibold text-slate-500">接收端：收到 r（可點擊）</div>
                    <BitRow bits={o8.received} layout={LAYOUT_84} states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={flip} gapBefore={OVERALL_INDEX} />
                  </div>
                </div>
              </Card>
            }
            aside={
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Signal
                    label={`${L} 盞燈 s（只看前 ${N} 位）`}
                    lamps={<Lamps s={r.syndrome} />}
                    value={binText(r.syndrome)}
                    sub={
                      sZero ? (
                        weight(e.slice(0, N)) === 0 ? `全暗：前 ${N} 位沒有錯` : `全暗：不指向任何位置，但前 ${N} 位其實錯了 ${weight(e.slice(0, N))} 個（錯誤本身是 codeword）`
                      ) : (
                        <>
                          <span className="whitespace-nowrap">
                            {READ.map((i) => LAMP[i]).join('')} = {binText(r.syndrome)} = {syndromeToPosition(r.syndrome)}
                          </span>
                          <br />
                          指向位置 {syndromeToPosition(r.syndrome)}
                        </>
                      )
                    }
                    on={!sZero}
                    tone="rose"
                  />
                  <Signal label={`第 ${RE} 盞燈 q（全部 ${NE} 位）`} lamps={<Lamps q={r.overallParity} />} value={String(r.overallParity)} sub={r.overallParity ? '亮：翻了奇數位' : '暗：翻了偶數位（含沒翻）'} on={r.overallParity === 1} tone="overall" />
                </div>
                <Derivation
                  defaultOpen
                  resetKey={e.join('') + message.join('')}
                  steps={[
                    { title: `發送端：先做 Hamming(${N},${K}) 編碼`, body: <Tex block>{`c_{1..${N}} = ${c7.join('')}`}</Tex> },
                    {
                      title: `把 ${N} 個位元全部 XOR，附加在最後`,
                      body: (
                        <>
                          <Tex block>{`P_0 = ${c7.join(' \\oplus ')} = ${c8[OVERALL_INDEX]}`}</Tex>
                          <Tex block>{`c = ${c7.join('')}\\,|\\,${c8[OVERALL_INDEX]} = ${c8.join('')}`}</Tex>
                          <Tex block>{`\\textstyle\\sum_{j=1}^{${NE}} c_j = ${weight(c8)} \\equiv 0 \\pmod 2`}</Tex>
                        </>
                      ),
                    },
                    { title: '接收端：收到 r = c + e', body: <Tex block>{`r = ${c8.join('')} + ${e.join('')} = ${o8.received.join('')}`}</Tex> },
                    {
                      title: `${L} 盞燈 s（只用前 ${N} 位）`,
                      body: (
                        <>
                          <Tex block>{`s = H\\,(${o8.received.slice(0, N).join('')})^T,\\quad ${sVecTex(r.syndrome)}`}</Tex>
                          {!sZero && <Tex block>{`${S_NAMES[0]} + 2${S_NAMES[1]} + 4${S_NAMES[2]} = ${r.syndrome[0]}+2\\cdot${r.syndrome[1]}+4\\cdot${r.syndrome[2]} = ${syndromeToPosition(r.syndrome)}`}</Tex>}
                        </>
                      ),
                    },
                    { title: `第 ${RE} 盞燈 q（全部 ${NE} 位）`, body: <Tex block>{`q = ${o8.received.join('+')} = ${r.overallParity}`}</Tex> },
                    {
                      title: '套進四格（下一節）',
                      body: (
                        <p>
                          {CASE_INFO[r.case].s}、{CASE_INFO[r.case].q} ⇒ <strong>{CASE_INFO[r.case].title}</strong>：{CASE_INFO[r.case].action}
                          {r.correctedPosition > 0 && `（位置 ${r.correctedPosition}）`}。
                        </p>
                      ),
                    },
                  ]}
                />
              </>
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="(s, q) 的四種組合">
          <LabGrid
            main={
              <Card title="目前落在哪一格？">
                <DecisionGrid current={r.case} />
                <p className="mt-3 text-center text-sm text-slate-600">
                  <Tex>{`${sVecTex(r.syndrome)},\\quad q = \\textstyle\\sum_{j=1}^{${NE}} r_j = ${r.overallParity}`}</Tex>
                </p>
                <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                  <p>
                    q 回答「翻了奇數還是偶數位」，s 回答「像是錯在哪」。前提是<strong>至多翻 2 位</strong>：
                  </p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>
                      <strong>q = 1</strong>：奇數、又至多 2 → 剛好 1 位。<M>{'s \\neq 0'}</M> 時 s 指出位置，翻回來；<M>{'s = 0'}</M> 代表前 {N} 位都沒翻，翻的是 {P0} 自己。
                    </li>
                    <li>
                      <strong>q = 0</strong>：0 位或 2 位。<M>{'s = 0'}</M> 是沒翻；<M>{'s \\neq 0'}</M> 是翻了 2 位 → <strong>回報，不修正</strong>。
                    </li>
                  </ul>
                </div>
              </Card>
            }
            aside={
              <Card title="這四格怎麼分開 0、1、2 個錯誤">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>
                    <strong>0 個錯：</strong> <M>{'s = 0,\\ q = 0'}</M>。
                  </li>
                  <li>
                    <strong>1 個錯在位置 j ≤ {N}：</strong> <M>{'s = h_j \\neq 0'}</M>（H 的設計 ①），<M>{'q = 1'}</M>。
                  </li>
                  <li>
                    <strong>1 個錯在 {P0}：</strong> 前 {N} 位沒變，<M>{'s = 0'}</M>，<M>{'q = 1'}</M>。
                  </li>
                  <li>
                    <strong>2 個錯：</strong> <M>{'q = 0'}</M>（偶數）。若兩個都在前 {N} 位（位置 j 與 j′），<M>{"s = h_j + h_{j'} \\neq 0"}</M>（H 的設計 ②：欄兩兩相異）；若其中一個是 {P0}，<M>{'s = h_j \\neq 0'}</M>（H 的設計 ①）。總之 <M>{'s \\ne 0'}</M>。
                  </li>
                </ul>
                <p className="mt-3 text-xs leading-relaxed text-slate-500">
                  四種情況落在四個不同的格子，所以接收端看 (s, q) 就知道是哪一種。少了 q，「1 個錯在位置 j」和「2 個錯、和是 <M>{'h_j'}</M>」亮的燈一模一樣：這就是第 3 章的誤更正。
                </p>
              </Card>
            }
          />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="SECDED 實驗器：同一個錯誤，兩種解碼器">
          <Card
            title="錯誤情境"
            actions={
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'h84', label: `Extended(${NE},${K})` },
                  { value: 'h74', label: `Hamming(${N},${K})` },
                  { value: 'both', label: '並排比較' },
                ]}
              />
            }
          >
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} type="button" className={`btn-ghost !py-1 text-xs ${e.join('') === errorFrom(p.idx).join('') ? '!border-slate-900' : ''}`} onClick={() => setE(errorFrom(p.idx))}>
                  {p.label}
                </button>
              ))}
              <ResetButton onClick={resetAll} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>
                錯誤向量 e = <span className="mono font-semibold text-rose-600">{e.join('')}</span>（{weight(e)} 個錯誤）
              </span>
              <RoleLegend overall errors />
            </div>
          </Card>

          <div className={`grid grid-cols-1 gap-4 ${mode === 'both' ? 'lg:grid-cols-2' : ''}`}>
            {(mode === 'h84' || mode === 'both') && (
              <Card title={`Extended Hamming(${NE},${K}) + SECDED 解碼器`}>
                <DecoderPanel sent={c8} received={o8.received} error={e} output={r.corrected} flippedIdx={r.correctedPosition - 1} layout8 onToggle={flip} />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Lamps s={r.syndrome} q={r.overallParity} size="sm" />
                  <span className="chip bg-slate-100 text-slate-700">
                    {READ.map((i) => LAMP[i]).join('')} = <span className="ml-1 font-mono">{binText(r.syndrome)}</span>
                  </span>
                  <span className="chip bg-slate-100 font-mono text-slate-700">q = {r.overallParity}</span>
                  <span className="text-slate-500">→ {CASE_INFO[r.case].title}</span>
                </div>
                <motion.div key={st8 + e.join('')} initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3">
                  <StatusBadge status={st8} large zh={st8 === 'wrong' ? (r.case === 'no-error' ? '未偵測錯誤' : '誤更正') : undefined} en={st8 === 'wrong' ? (r.case === 'no-error' ? 'Undetected error' : 'Miscorrection') : undefined} />
                </motion.div>
                <OutcomeNote weightE={weight(e)} status={st8} />
              </Card>
            )}
            {(mode === 'h74' || mode === 'both') && (
              <Card title={`Hamming(${N},${K}) Syndrome 解碼器（只看前 ${N} 位元）`}>
                <DecoderPanel sent={c7} received={o7.received} error={e.slice(0, N)} output={o7.decoded.corrected} flippedIdx={o7.decoded.position - 1} onToggle={flip} />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <Lamps s={o7.decoded.syndrome} size="sm" />
                  <span className="chip bg-slate-100 text-slate-700">
                    {READ.map((i) => LAMP[i]).join('')} = <span className="ml-1 font-mono">{binText(o7.decoded.syndrome)}</span>
                  </span>
                  <span className="text-slate-500">→ {o7.decoded.position === 0 ? '判定無錯誤' : `翻轉位置 ${o7.decoded.position}`}</span>
                </div>
                <motion.div key={st7 + e.join('')} initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3">
                  <StatusBadge status={st7} large zh={st7 === 'wrong' ? (o7.undetected ? '未偵測錯誤' : '誤更正') : undefined} en={st7 === 'wrong' ? (o7.undetected ? 'Undetected error' : 'Miscorrection') : undefined} />
                </motion.div>
                {e[OVERALL_INDEX] === 1 && <p className="mt-2 text-xs text-slate-500">（第 {P0_POS} 位的錯誤在 Hamming({N},{K}) 中不存在，已忽略。）</p>}
                {weight(e.slice(0, N)) === 2 && <p className="mt-2 text-sm text-rose-700">Hamming({N},{K}) 分不出「1 個錯」與「2 個錯」，於是把 2 個錯誤當成 1 個來修正。</p>}
              </Card>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label={`SECDED 翻 1 位（全部 ${ONE8.total} 種，含 ${P0}）`} value={`${ONE8.ok}/${ONE8.total}`} sub="修好" tone="emerald" />
            <Stat label={`SECDED 翻 2 位（全部 ${TWO8.total} 種）`} value={`${TWO8.detected}/${TWO8.total}`} sub="回報，不修正" tone="amber" />
            <Stat label={`Hamming(${N},${K}) 翻 2 位（全部 ${TWO7.total} 種）`} value={`${TWO7.mis}/${TWO7.total}`} sub="悄悄誤更正" tone="rose" />
          </div>

          <Callout kind="warning" title="保證只在「最多 2 個錯誤」時成立">
            <p>
              四種分類假設錯誤數 ≤ 2。若有 3 個以上的錯誤，保證就不成立。錯 3 個時會誤更正：例如「{presetLabel(TRIPLE)}」，前 {N} 位的錯誤 {TRIPLE_E7.join('')} 本身是 Hamming({N},{K}) 的 codeword{isCodeword74(TRIPLE_E7) ? '' : '（✗）'}，所以 <M>{'s = 0'}</M>，而 3 是奇數使 <M>{'q = 1'}</M>，解碼器以為是 {P0} 出錯並「修正」它，結果仍是錯的。錯 4 個時甚至可能根本沒發現（未偵測錯誤）：再多翻 {P0}（位置 {P0_POS}），錯誤 {QUAD_E.join('')} 的 <M>{'s = 0'}</M>、<M>{'q = 0'}</M>{secdedDecode(QUAD_E).case === 'no-error' ? '' : '（✗）'}，解碼器判定沒有錯，原樣輸出。
            </p>
          </Callout>
          <Misconceptions
            items={[
              { wrong: 'SECDED 可以修正 2 個錯誤。', right: `只能「偵測」2 個錯誤，並且刻意不修正：翻 2 位的字離好幾個 codeword 都是 2，猜不出送的是哪一個。` },
              { wrong: 'q = 1 一定代表剛好 1 個錯誤。', right: 'q = 1 代表奇數個錯誤；只有在「錯誤數 ≤ 2」的假設下才等於 1 個。' },
              { wrong: 's = 0 就不用看 q。', right: `s = 0、q = 1 正是 ${P0} 自己出錯的情況，需要修正 ${P0}。` },
            ]}
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="修 1 個、回報 2 個：伺服器記憶體的做法">
          <Card title={`實際系統：伺服器記憶體的 (${SERVER.nSecded},${SERVER.k}) SECDED`}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
              <div className="space-y-2 text-sm leading-relaxed text-slate-700">
                <p>
                  ECC 記憶體每次讀寫 {SERVER.k} 個資料位元。要更正 1 個錯，ℓ 盞燈得分出「沒錯」加上 n = {SERVER.k} + ℓ 個位置（第 4 章的 <M>{'2^{\\ell} \\ge n + 1'}</M>）：
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <Tex block>{`2^{${SERVER.r - 1}} = ${2 ** (SERVER.r - 1)} < ${SERVER.k} + ${SERVER.r - 1} + 1 = ${SERVER.k + SERVER.r}`}</Tex>
                  <Tex block>{`2^{${SERVER.r}} = ${2 ** SERVER.r} \\ge ${SERVER.k} + ${SERVER.r} + 1 = ${SERVER.k + SERVER.r + 1}`}</Tex>
                </div>
                <p>
                  所以要 {SERVER.r} 盞燈：Hamming({SERVER.parentN},{SERVER.parentK}) 只用其中 {SERVER.k} 個資料位置（其餘 {SERVER.shortenedBy} 個固定為 0、不送），得到 ({SERVER.n},{SERVER.k})；再加 1 個 {P0}，就是 <strong>({SERVER.nSecded},{SERVER.k})</strong>。判斷規則和本章的四格完全一樣：修 1 個、回報 2 個。
                </p>
                <p className="text-slate-600">
                  它不是完美碼：{SERVER.r} 盞燈的 {2 ** SERVER.r} 種狀態只用到 {SERVER.n + 1} 種。實際晶片常把 {P0} 併進檢查矩陣（例如 Hsiao 碼），參數同樣是 ({SERVER.nSecded},{SERVER.k})、修 1 個、偵測 2 個。縮短碼的做法見{' '}
                  <a href="#/l2-12" className="font-semibold text-overall-700 hover:underline">
                    第二課 2-12
                  </a>
                  。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2 self-start">
                <Stat label="每筆資料" value={`${SERVER.k} 位`} />
                <Stat label="檢查位元" value={`${SERVER.r} + 1 = ${SERVER_CHECK}`} sub={`${SERVER.r} 盞燈 + ${P0}`} tone="indigo" />
                <Stat label="多存的比例" value={pct(SERVER_CHECK / SERVER.k)} sub={`(${NE},${K}) 是 ${pct((NE - K) / K)}`} tone="emerald" />
                <Stat label="碼率 k/n" value={pct(SERVER.rateSecded)} sub={`(${NE},${K}) 是 ${pct(RATE8)}`} tone="emerald" />
              </div>
            </div>
          </Card>

          <Card title={`比較總表：Hamming(${N},${K}) 與 Extended Hamming(${NE},${K})`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">性質</th>
                    <th>
                      Hamming({N},{K})
                    </th>
                    <th>
                      Extended Hamming({NE},{K})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((row) => (
                    <tr key={row.k} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-600">{row.label}</td>
                      <td className="font-mono">{row.a}</td>
                      <td className="font-mono font-semibold">{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Callout kind="key" title="結論">
            <p>
              <strong>情境</strong>：ECC 記憶體翻 2 位時，Hamming({N},{K}) 會把它改成另一個合法的 codeword，之後任何檢查都看不出來，資料被悄悄毀掉。寧可回報，也不要誤更正。
            </p>
            <p>
              <strong>做法</strong>：多一個 {P0}（整體同位位元），放在第 {P0_POS} 位。第 {RE} 盞燈 q 說翻了奇數還是偶數位，原本的 {L} 盞燈 s 照舊指出位置。代價 1 個位元，換來 <M>{`d_{\\min}: ${D7} \\to ${D8}`}</M>：雙錯停在兩個 codeword 的正中間，不會被推到別人那邊。
            </p>
            <p>
              <strong>結果</strong>：至多 2 個錯時，翻 1 位一定修好（{ONE8.ok}/{ONE8.total}），翻 2 位一定回報（{TWO8.detected}/{TWO8.total}）。伺服器的 ({SERVER.nSecded},{SERVER.k}) 用的是同一套規則。
            </p>
          </Callout>
          <Misconceptions
            items={[
              {
                wrong: (
                  <>
                    <M>{`d_{\\min} = ${D8}`}</M>，所以 t = ⌊{D8 - 1}/2⌋ = {T8}，Extended Hamming 沒有比較好。
                  </>
                ),
                right: (
                  <>
                    修正能力確實仍是 {T8}，但多了「同時偵測 2 個錯誤」的能力：<M>{`d_{\\min} = ${D8} \\ge`}</M>（修正數）+（偵測數）+ 1 = 1 + 2 + 1。
                  </>
                ),
              },
              { wrong: `${P0} 是第 ${K + 1} 個資料位元。`, right: `${P0} 完全由其他 ${N} 個位元決定，k 仍是 ${K}。` },
            ]}
          />
          <Card>
            <RelatedLinks
              title="延伸"
              links={[
                { to: 'distance', text: `回顧：最小距離 ${D7} 與完美碼的代價` },
                { to: 'l2-11', text: 'SECDED 放到循環碼上：雙錯時的輸出與旗標' },
                { to: 'l2-12', text: `更長的 Hamming Code、縮短碼與 (${SERVER.nSecded},${SERVER.k})` },
              ]}
            />
          </Card>
        </Stage>

        <Advanced />
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces of the main line                                             */
/* ------------------------------------------------------------------ */

function Signal({ label, lamps, value, sub, on, tone }: { label: string; lamps: ReactNode; value: string; sub: ReactNode; on: boolean; tone: 'rose' | 'overall' }) {
  const lit = tone === 'rose' ? 'border-rose-300 bg-rose-50' : 'border-overall-300 bg-overall-50';
  return (
    <div className={`rounded-xl border p-3 ${on ? lit : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 flex items-center gap-3">
        {lamps}
        <span className="font-mono text-xl font-bold">{value}</span>
      </div>
      <div className="mt-1 text-xs text-slate-600">{sub}</div>
    </div>
  );
}

const GRID: [SecdedCase, SecdedCase][] = [
  ['no-error', 'overall-corrected'],
  ['double-detected', 'single-corrected'],
];

function DecisionGrid({ current }: { current: SecdedCase }) {
  const cell = (k: SecdedCase) => {
    const c = CASE_INFO[k];
    const on = k === current;
    const tone = c.status === 'ok' ? 'emerald' : c.status === 'corrected' ? 'sky' : 'orange';
    const cls = {
      emerald: on ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-200' : 'border-slate-200',
      sky: on ? 'border-sky-500 bg-sky-50 ring-4 ring-sky-200' : 'border-slate-200',
      orange: on ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-200' : 'border-slate-200',
    }[tone];
    return (
      <motion.div key={k} animate={{ scale: on ? 1.02 : 1, opacity: on ? 1 : 0.6 }} className={`min-w-0 rounded-xl border-2 p-3 ${cls}`}>
        <StatusBadge status={c.status} en="" />
        <div className="mt-2 text-sm font-semibold">{c.title}</div>
        <div className="text-xs text-slate-500">{c.flips}</div>
        <div className="mt-1 text-xs font-semibold text-slate-700">→ {c.action}</div>
      </motion.div>
    );
  };
  const head = 'text-center text-xs font-semibold text-slate-500';
  const side = 'grid place-items-center text-xs font-semibold text-slate-500 [writing-mode:vertical-rl]';
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2">
      <div />
      <div className={head}>q = 0（翻了偶數位）</div>
      <div className={head}>q = 1（翻了奇數位）</div>
      <div className={side}>s = 0（燈全暗）</div>
      {cell(GRID[0][0])}
      {cell(GRID[0][1])}
      <div className={side}>s ≠ 0（燈亮）</div>
      {cell(GRID[1][0])}
      {cell(GRID[1][1])}
    </div>
  );
}

function DecoderPanel({
  sent,
  received,
  error,
  output,
  flippedIdx,
  layout8 = false,
  onToggle,
}: {
  sent: Bit[];
  received: Bit[];
  error: Bit[];
  output: Bit[] | null;
  flippedIdx: number;
  layout8?: boolean;
  onToggle: (i: number) => void;
}) {
  const layout = layout8 ? LAYOUT_84 : LAYOUT_74;
  const gap = layout8 ? OVERALL_INDEX : undefined;
  const outStates: BitState[] | undefined = output?.map((_, i) => {
    if (i === flippedIdx) return error[i] ? 'corrected' : 'error';
    return error[i] ? 'error' : 'normal';
  });
  return (
    <div className="space-y-3">
      <PanelRow label="發送 c">
        <BitRow bits={sent} layout={layout} size="sm" showPositions={false} gapBefore={gap} />
      </PanelRow>
      <PanelRow label="接收 r（可點擊）">
        <BitRow bits={received} layout={layout} size="sm" showPositions={false} states={error.map((b) => (b ? 'error' : 'normal'))} onToggle={onToggle} gapBefore={gap} />
      </PanelRow>
      <PanelRow label="解碼輸出">
        {output ? (
          <BitRow bits={output} layout={layout} size="sm" showPositions={false} states={outStates} gapBefore={gap} />
        ) : (
          <div className="rounded-lg border-2 border-dashed border-orange-400 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">拒絕輸出：偵測到無法修正的錯誤，回報系統（重讀、重送或停用這一頁）</div>
        )}
      </PanelRow>
    </div>
  );
}

function PanelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-1 sm:grid-cols-[110px_1fr]">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function OutcomeNote({ weightE, status }: { weightE: number; status: DecodeStatus }) {
  if (weightE <= 2) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        {weightE === 0 && '沒有錯誤，解碼器原樣輸出。'}
        {weightE === 1 && '單一錯誤：保證被定位並修正。'}
        {weightE === 2 && '兩個錯誤：保證被偵測，解碼器不會亂改資料。'}
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-rose-700">
      {weightE} 個錯誤超出保證範圍。{status === 'detected' ? '這次剛好被偵測到，但不是保證。' : '解碼器做出了錯誤的判斷。'}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* 進階 (collapsed): weight and distance distributions, the proof, the exhaustive tables */
/* ------------------------------------------------------------------ */

function Advanced() {
  const outside = HB8.rhs - HB8.lhs;
  return (
    <section id={`${ID}-advanced`} className="scroll-mt-28 space-y-4 border-t border-slate-200 pt-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip border border-slate-300 bg-white text-slate-700">
          <Layers className="h-3.5 w-3.5" />
          進階 <span className="opacity-60">Advanced</span>
        </span>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">重量、距離與窮舉驗證</h2>
      </div>
      <p className="text-sm text-slate-600">主線只用一條 A → B 的路和 (s, q) 四格。這裡收著重量與距離的分佈、<M>{`d_{\\min} = ${D8}`}</M> 的證明，以及對全部錯誤向量的窮舉。</p>
      <div className="space-y-2">
        <Expandable title={`重量分佈：加上 ${P0} 後，重量 ${MD7.dmin} 消失了`}>
          <WeightView />
        </Expandable>
        <Expandable
          title={
            <>
              證明：Extended Hamming({NE},{K}) 的 <M>{`d_{\\min} = ${D8}`}</M>
            </>
          }
        >
          <p>
            1. 這是線性碼，所以 <M>{'d_{\\min}'}</M> = 最小非零 codeword 重量。
          </p>
          <p>
            2. 每個延伸 codeword <M>{'(c, P_0)'}</M> 滿足 <M>{'\\mathrm{wt}(c, P_0) = \\mathrm{wt}(c) + P_0'}</M>，而 <M>{'P_0 \\equiv \\mathrm{wt}(c) \\pmod 2'}</M>，所以 <M>{'\\mathrm{wt}(c, P_0)'}</M> 必為偶數。
          </p>
          <p>
            3. 原 code 非零 codeword 重量 ≥ {D7}，因此 <M>{`\\mathrm{wt}(c, P_0) \\ge ${D7}`}</M> 且為偶數 ⇒ <M>{`\\mathrm{wt}(c, P_0) \\ge ${D7 + (D7 % 2)}`}</M>。
          </p>
          <p>
            4. 重量 {D8} 的 codeword 確實存在（例如 {DEFAULT_MESSAGE.join('')} → {encode84(DEFAULT_MESSAGE).join('')}，重量 {weight(encode84(DEFAULT_MESSAGE))}），所以 <M>{`d_{\\min} = ${D8}`}</M>。∎
          </p>
        </Expandable>
        <Expandable title={`任兩個 codeword 在 (${N},${K}) 與 (${NE},${K}) 中的距離`}>
          <PairDistance />
        </Expandable>
        <Expandable
          title={
            <>
              同時修正 1 個、偵測 2 個需要 <M>{`d_{\\min} \\ge ${SECDED_NEED}`}</M>
            </>
          }
        >
          <p>
            要修正 t 個、同時偵測比 t 更多個錯誤，需要 <M>{'d_{\\min} \\ge (\\text{修正數}) + (\\text{偵測數}) + 1'}</M>。修 1 個、偵測 2 個：<M>{`d_{\\min} \\ge 1 + 2 + 1 = ${SECDED_NEED}`}</M>。
          </p>
          <p>
            用路徑來看：兩個最近的 codeword 隔 {D8} 步，各自的「修得回來」範圍是半徑 {T8}。翻 2 位的字離自己 2，離別人至少 {D8} − 2 = {D8 - 2}，不在任何人的半徑 {T8} 之內，所以不會被拉走，只會被偵測。Hamming({N},{K}) 只隔 {D7} 步：翻 2 位就落進別人的半徑 {T7}。
          </p>
          <p className="text-slate-600">
            只偵測、不修正的話，<M>{`d_{\\min} = ${D8}`}</M> 能偵測 {detectionCapability(D8)} 個錯；但同一個解碼器只要決定「翻 1 位就修」，偵測範圍就只剩 2 個。
          </p>
        </Expandable>
        <Expandable title={`${HB8.rhs} 個 ${NE} 位元字串：${HB8.codewords} 顆球之外的 ${outside} 個`}>
          <BallsOutside />
        </Expandable>
        <Expandable title={`窮舉：全部 ${2 ** NE} 種與 ${2 ** N} 種錯誤向量`}>
          <ExhaustiveTables />
        </Expandable>
      </div>
    </section>
  );
}

function WeightView() {
  const { message } = useMessage();
  const wd7 = weightDistribution(W7, N).map((y, x) => ({ x, y }));
  const wd8 = weightDistribution(W8, NE).map((y, x) => ({ x, y }));
  const oddWeights = weightDistribution(W7, N).flatMap((a, w) => (a && w % 2 ? [w] : []));
  const lifted = oddWeights.reduce((sum, w) => sum + weightDistribution(W7, N)[w], 0);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title={`Hamming(${N},${K}) codeword 重量分佈`}>
          <Bars data={wd7} xLabel="重量 w" yLabel="Codeword 數" highlight={(x) => Number(x) === D7} tooltipLabel={(x, y) => `${y} 個 codeword 重量為 ${x}`} />
        </Card>
        <Card title={`Extended(${NE},${K}) codeword 重量分佈`}>
          <Bars data={wd8} xLabel="重量 w" yLabel="Codeword 數" highlight={(x) => Number(x) === D8} accent="#7638dc" tooltipLabel={(x, y) => `${y} 個 codeword 重量為 ${x}`} />
        </Card>
      </div>
      <p>
        奇數重量（{oddWeights.join('、')}）的 codeword 加上 {P0} = 1 後重量 +1，共 {lifted} 個；偶數重量的 codeword {P0} = 0，重量不變。所以重量 {D7} 的 codeword 全部變成重量 {D8}，和原本重量 {D8} 的合計 {weightDistribution(W8, NE)[D8]} 個：<strong>重量 {D7} 消失了</strong>。
      </p>
      <Card title={`全部 ${C8.length} 個 codeword 並排`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1">m</th>
                <th>
                  Hamming({N},{K})
                </th>
                <th>wt</th>
                <th>{P0}</th>
                <th>
                  Extended({NE},{K})
                </th>
                <th>wt</th>
              </tr>
            </thead>
            <tbody>
              {C8.map((x, i) => (
                <tr key={i} className={`border-t border-slate-100 ${x.message.join('') === message.join('') ? 'bg-amber-50' : ''}`}>
                  <td className="py-1 font-mono text-data-700">{x.message.join('')}</td>
                  <td>
                    <BitString bits={W7[i]} />
                  </td>
                  <td className="font-mono">{weight(W7[i])}</td>
                  <td className="font-mono font-bold text-overall-600">{x.codeword[OVERALL_INDEX]}</td>
                  <td>
                    <BitString bits={x.codeword} highlight={(j) => (j === OVERALL_INDEX ? 'text-overall-600 font-bold' : undefined)} />
                  </td>
                  <td className="font-mono">{weight(x.codeword)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function PairDistance() {
  const [pair, setPair] = useState<[number, number]>([A_IDX, B_IDX]);
  const diff7 = differingPositions(W7[pair[0]], W7[pair[1]]);
  const diff8 = differingPositions(W8[pair[0]], W8[pair[1]]);
  const hist8 = [...MD8.histogram.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
  const allPass = W8.every((c) => isZeroVector(matVec(H84, c)));
  return (
    <LabGrid
      main={
        <Card title="選兩個訊息，比較它們在兩種 code 中的距離">
          <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
            {[0, 1].map((slot) => (
              <label key={slot} className="flex items-center gap-2">
                <span className={`chip ${slot === 0 ? 'bg-data-100 text-data-700' : 'bg-overall-100 text-overall-700'}`}>{slot === 0 ? 'A' : 'B'}</span>
                <select
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-sm"
                  value={pair[slot]}
                  onChange={(ev) => {
                    const v = Number(ev.target.value);
                    setPair(slot === 0 ? [v, pair[1]] : [pair[0], v]);
                  }}
                >
                  {C8.map((x, i) => (
                    <option key={i} value={i}>
                      m = {x.message.join('')}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
            <div className="grid grid-cols-[90px_1fr] items-center gap-2">
              <span className="text-xs text-slate-500">
                ({N},{K}) A
              </span>
              <BitString bits={W7[pair[0]]} highlight={(j) => (diff7.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
              <span className="text-xs text-slate-500">
                ({N},{K}) B
              </span>
              <BitString bits={W7[pair[1]]} highlight={(j) => (diff7.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
              <span className="text-xs text-slate-500">距離</span>
              <span className="font-mono font-bold">{diff7.length}</span>
            </div>
            <div className="grid grid-cols-[90px_1fr] items-center gap-2 border-t border-slate-200 pt-2">
              <span className="text-xs text-slate-500">
                ({NE},{K}) A
              </span>
              <BitString bits={W8[pair[0]]} highlight={(j) => (diff8.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
              <span className="text-xs text-slate-500">
                ({NE},{K}) B
              </span>
              <BitString bits={W8[pair[1]]} highlight={(j) => (diff8.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
              <span className="text-xs text-slate-500">距離</span>
              <span className="font-mono font-bold">{diff8.length}</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            預設是主線的 A、B：在 ({N},{K}) 中距離 {D_AB7}（奇數），{P0} 不同，所以延伸後距離變 {D_AB}。
          </p>
        </Card>
      }
      aside={
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat
              label={
                <>
                  ({N},{K}) <M>{'d_{\\min}'}</M>（{MD7.pairsChecked} 對）
                </>
              }
              value={D7}
              tone="indigo"
            />
            <Stat
              label={
                <>
                  ({NE},{K}) <M>{'d_{\\min}'}</M>（{MD8.pairsChecked} 對）
                </>
              }
              value={D8}
              tone="emerald"
            />
          </div>
          <Card title={`Extended(${NE},${K})：所有 codeword 對的距離`}>
            <Bars data={hist8} xLabel="距離 d" yLabel="Codeword 對數" highlight={(x) => x === D8} accent="#7638dc" height={180} />
          </Card>
          <Card title="所有 codeword 都滿足 H₈cᵀ = 0">
            <p className="text-sm text-slate-600">
              已檢查 {W8.length} 個 codeword：{allPass ? '全部通過 ✓' : '有失敗 ✗'}
            </p>
          </Card>
        </>
      }
    />
  );
}

function BallsOutside() {
  const terms = sphereTerms(NE, T8);
  const part = useMemo(() => partitionByNearest(W8, NE), []);
  const outside = allVectors(NE).filter((w) => W8.every((c) => hammingDistance(w, c) >= 2));
  const tied = [...new Set(outside.map((w) => W8.filter((c) => hammingDistance(w, c) === 2).length))].join('／');
  return (
    <>
      <p>
        每個 codeword 周圍「翻 {T8} 位以內」的球有 {terms.join(' + ')} = {HB8.volume} 個字串，{HB8.codewords} 顆球共 {HB8.lhs} 個，比全部 <M>{`2^{${NE}} = ${HB8.rhs}`}</M> 個少：
      </p>
      <Tex block>{`${HB8.codewords} \\times ${HB8.volume} = ${HB8.lhs} < ${HB8.rhs} = 2^{${NE}}`}</Tex>
      <p>
        所以 Extended({NE},{K}) 不是完美碼。不在任何球裡的 {HB8.rhs} − {HB8.lhs} = {outside.length} 個字串（依最近 codeword 分組時的平手字串：{part.ties.length} 個），每一個都離 {tied} 個 codeword 一樣是距離 2：正是翻 2 位時會落進去的地方，接收端看到它們就回報。
      </p>
      <p className="text-slate-600">
        Hamming({N},{K}) 的球剛好鋪滿（{HB7.lhs} = {HB7.rhs}），沒有留下這種空間：這就是第 4 章說的「沒有燈號留給錯了兩個」。逐格的分組圖在
        <a href="#/distance" className="mx-1 font-semibold text-overall-700 hover:underline">
          第 4 章
        </a>
        進階「真正的 2ⁿ 個字串分組」（切換到 Extended({NE},{K})）。
      </p>
    </>
  );
}

function ExhaustiveTables() {
  const { message } = useMessage();
  const c8 = useMemo(() => encode84(message), [message]);
  const c7 = useMemo(() => c8.slice(0, N), [c8]);
  const stats8 = useMemo(() => {
    const rows = Array.from({ length: NE + 1 }, (_, w) => ({ w, total: 0, ok: 0, corrected: 0, detected: 0, wrong: 0 }));
    allVectors(NE).forEach((err) => {
      const o = simulate84(c8, err);
      const row = rows[o.errorWeight];
      row.total++;
      const s = secdedStatus(o);
      if (s === 'ok') row.ok++;
      else if (s === 'corrected') row.corrected++;
      else if (s === 'detected') row.detected++;
      else row.wrong++;
    });
    return rows;
  }, [c8]);
  const stats7 = useMemo(() => {
    const rows = Array.from({ length: N + 1 }, (_, w) => ({ w, total: 0, ok: 0, corrected: 0, detected: 0, wrong: 0 }));
    allVectors(N).forEach((err) => {
      const o = simulate74(c7, err);
      const row = rows[o.errorWeight];
      row.total++;
      const s = hammingStatus(o);
      if (s === 'ok') row.ok++;
      else if (s === 'corrected') row.corrected++;
      else row.wrong++;
    });
    return rows;
  }, [c7]);
  return (
    <>
      <p>對目前的共用訊息 m = {message.join('')}，把每一種錯誤向量都試一次。wt(e) = 1、2 這兩列就是主線的保證：SECDED 翻 1 位全部修好、翻 2 位全部回報；Hamming 翻 2 位全部誤更正。</p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <StatsTable title={`SECDED：對 ${c8.join('')} 窮舉全部 ${2 ** NE} 種錯誤`} rows={stats8} showDetected />
        <StatsTable title={`Hamming(${N},${K})：對 ${c7.join('')} 窮舉全部 ${2 ** N} 種錯誤`} rows={stats7} />
      </div>
    </>
  );
}

function StatsTable({ title, rows, showDetected = false }: { title: string; rows: { w: number; total: number; ok: number; corrected: number; detected: number; wrong: number }[]; showDetected?: boolean }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1">wt(e)</th>
              <th>錯誤向量數</th>
              <th className="text-emerald-700">正常</th>
              <th className="text-sky-700">已修正</th>
              {showDetected && <th className="text-orange-700">回報未修正</th>}
              <th className="text-rose-700">錯誤判斷</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((row) => (
              <tr key={row.w} className={`border-t border-slate-100 ${row.w === 1 || row.w === 2 ? 'bg-amber-50/60' : ''}`}>
                <td className="py-1">{row.w}</td>
                <td>{row.total}</td>
                <td className="text-emerald-700">{row.ok || '·'}</td>
                <td className="text-sky-700">{row.corrected || '·'}</td>
                {showDetected && <td className="text-orange-700">{row.detected || '·'}</td>}
                <td className="text-rose-700">{row.wrong || '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
