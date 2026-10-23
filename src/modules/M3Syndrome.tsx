import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Cpu, Search } from 'lucide-react';
import {
  type Bit,
  H74,
  K4,
  LAYOUT_74,
  N7,
  PARITY_CHECKS,
  allVectors,
  codewords74,
  column,
  correctionCapability,
  encode74,
  flipBit,
  hammingSyndromeXors,
  isCodeword74,
  isZeroVector,
  matVec,
  matchingColumn,
  minimumDistance,
  simulate74,
  syndromeTableEntries,
  syndromeToPosition,
  unitVector,
  vecAdd,
  vecEquals,
  weight,
  zeroVector,
  matrixToTex,
} from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitRow, BitString, MessageInput, RoleLegend } from '../components/Bits';
import { MatrixView, ColumnVector } from '../components/MatrixView';
import { Venn } from '../components/Venn';
import { RelatedLinks } from '../components/alg/Links';
import { Callout, Card, Derivation, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, StatusBadge, type DecodeStatus } from '../components/Lesson';

const ID = 'syndrome';

/* ------------------------------------------------------------------ */
/* Numbers on this page (computed from the core, never typed)          */
/* ------------------------------------------------------------------ */

/** 7 positions, 4 data bits, 3 checkers = 3 lamps */
const N = N7;
const K = K4;
const R = H74.length;
/** 3 lamps: 2³ states (all dark = nothing to flip) = the outputs of the 3-to-8 decoder */
const STATES = 2 ** R;
const PATTERNS = STATES - 1;
/** the syndrome circuit: one XOR tree per lamp */
const SYNDROME_XORS = hammingSyndromeXors(R);
/** a general H needs a lamp pattern → position table with one row per lamp state */
const TABLE_ROWS = syndromeTableEntries(N, K);
/** the flip stage: one XOR gate per position */
const FLIP_XORS = N;
const ALL_ERRORS = 2 ** N;

const CODE = codewords74();
const WORDS = CODE.map((x) => x.codeword);
const D_MIN = minimumDistance(WORDS).dmin;
/** the guaranteed correction capability ⌊(d_min − 1)/2⌋ */
const T = correctionCapability(D_MIN);

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
const POSITIONS = LAYOUT_74.map((p) => p.position);
/** reading the lamps as a binary number: P4 P2 P1, the most significant first */
const READ = [...LAMP.keys()].reverse();
/** a lamp state as bits in H's row order (P1 first) from its binary value */
const lampBits = (v: number): Bit[] => Array.from({ length: R }, (_, i) => ((v >> i) & 1) as Bit);
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
const colTex = (v: readonly Bit[]) => matrixToTex(v.map((b) => [b]));
const binText = (bits: readonly Bit[]) => `${READ.map((i) => bits[i]).join('')}₂`;

/** the running example of the chapter: noise flips position 5 */
const EXAMPLE_POS = 5;
/** a lightest non-zero codeword used as an error pattern: positions 1, 2, 3 flipped leave the lamps dark */
const TRIPLE = [1, 2, 3];
const TRIPLE_WORD = TRIPLE.map((j) => unitVector(N, j - 1)).reduce((a, b) => vecAdd(a, b));
const TRIPLE_IS_CODEWORD = isCodeword74(TRIPLE_WORD);

/** the lamps written as a labelled vector: (s₁, s₂, s₄) = (1, 0, 1) */
const SVEC_TEX = `(${LAMP.map((l) => `s_${l.slice(1)}`).join(', ')})`;
const sVecTex = (bits: readonly Bit[]) => `${SVEC_TEX} = (${bits.join(', ')})`;
/** position j from the lamps: j = s₁ + 2s₂ + 4s₄ */
const POS_TEX = LAMP.map((l, i) => `${i ? `${2 ** i}` : ''}s_${l.slice(1)}`).join(' + ');

const errorFrom = (idx: number[]): Bit[] => idx.reduce((e, i) => flipBit(e, i), zeroVector(N));
const presetLabel = (idx: number[]) => (idx.length === 0 ? '無錯誤' : `${['', '單一錯誤', '兩個錯誤', '三個錯誤'][idx.length]}（位置 ${idx.map((i) => i + 1).join('、')}）`);
/** the two-error preset flips positions 1 and 5, the pair chapters 4 and 5 also use */
const PAIR = [1, EXAMPLE_POS];
const PRESETS = [[], [EXAMPLE_POS - 1], PAIR.map((j) => j - 1), TRIPLE.map((j) => j - 1)].map((idx) => ({ label: presetLabel(idx), idx }));

/** a link to another chapter of Lesson 1 */
const ChLink = ({ to, children }: { to: string; children: ReactNode }) => (
  <a href={`#/${to}`} className="font-semibold text-overall-700 hover:underline">
    {children}
  </a>
);

/* ------------------------------------------------------------------ */
/* Small pictures                                                      */
/* ------------------------------------------------------------------ */

/**
 * The receiver's warning lamps: lit = that check failed.
 * Drawn in H's row order (P1, P2, P4), or with `read` in reading order (P4, P2, P1) so that,
 * left to right, they spell the binary number of the position.
 */
function Lamps({ bits, size = 'md', read = false }: { bits: readonly Bit[]; size?: 'sm' | 'md'; read?: boolean }) {
  const d = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  const order = read ? READ : [...LAMP.keys()];
  return (
    <span className="inline-flex items-end gap-1.5 align-middle" role="img" aria-label={`警示燈${lampText(bits)}`}>
      {order.map((i) => (
        <span key={LAMP[i]} className="inline-flex flex-col items-center gap-0.5">
          <span className={`${d} rounded-full border-2 ${bits[i] ? 'border-rose-500 bg-rose-400 shadow-[0_0_8px_2px_rgba(244,63,94,0.45)]' : 'border-slate-300 bg-slate-200'}`} />
          <span className="text-[10px] font-semibold leading-none text-slate-500">{LAMP[i]}</span>
        </span>
      ))}
    </span>
  );
}

/** points down while the circuit is stacked (phones), right once it runs across */
const Arrow = () => (
  <span className="text-lg leading-none text-slate-400" aria-hidden>
    <span className="sm:hidden">↓</span>
    <span className="hidden sm:inline">→</span>
  </span>
);

/** a stage of the decoding circuit: a box with its name and what it is made of */
function Machine({ title, note, tone = 'border-slate-300 bg-white text-slate-800' }: { title: ReactNode; note: ReactNode; tone?: string }) {
  return (
    <span className={`rounded-xl border-2 px-3 py-1.5 text-center ${tone}`}>
      <span className="block text-sm font-bold">{title}</span>
      <span className="block text-xs">{note}</span>
    </span>
  );
}

function Stop({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <span className="flex flex-col items-center gap-1">
      <span className="text-[11px] text-slate-500">{label}</span>
      {children}
    </span>
  );
}

/** What the receiver can and cannot see: c and e stay hidden, only r and the lamps reach it. */
function ReceiverView({ c, e, r, s }: { c: readonly Bit[]; e: readonly Bit[]; r: readonly Bit[]; s: readonly Bit[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
        <div className="mb-2 font-bold text-slate-500">接收端看不到</div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 shrink-0 text-xs">發送端送出的 c</span>
            <BitString bits={c} className="text-base font-bold text-slate-400" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 shrink-0 text-xs">雜訊翻了哪幾位 e</span>
            <BitString bits={e} className="text-base font-bold text-slate-400" highlight={(i) => (e[i] ? 'text-rose-500' : undefined)} />
          </div>
        </div>
      </div>
      <div className="rounded-xl border-2 border-parity-300 bg-parity-50/60 p-3 text-sm text-slate-700">
        <div className="mb-2 font-bold text-parity-700">接收端看得到</div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 shrink-0 text-xs">收到的 r = c + e</span>
            <BitString bits={r} className="text-base font-bold" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-36 shrink-0 text-xs">
              {R} 個檢查器 → {R} 盞燈
            </span>
            <Lamps bits={s} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pick the flipped position: Hrᵀ = Hcᵀ + Heⱼᵀ = 0 + hⱼ, checked live on the shared message. */
function SingleFlipCheck({ c }: { c: readonly Bit[] }) {
  const [pos, setPos] = useState(EXAMPLE_POS);
  const e = unitVector(N, pos - 1);
  const r = vecAdd(c, e);
  const Hc = matVec(H74, c);
  const hj = column(H74, pos - 1);
  const s = matVec(H74, r);
  const sameLamps = WORDS.filter((w) => vecEquals(matVec(H74, vecAdd(w, e)), s)).length;
  const fixed = vecAdd(r, e);
  return (
    <Card title="即時驗證：雜訊只翻位置 j">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">j =</span>
        {POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={pos === p}
            onClick={() => setPos(p)}
            className={`rounded-md border px-2 py-0.5 text-xs ${pos === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
          >
            {p}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody className="font-mono">
          <tr>
            <td className="py-0.5 pr-2 font-sans text-xs text-slate-500">送出 c（codeword）</td>
            <td className="text-right">
              <BitString bits={c} />
            </td>
          </tr>
          <tr>
            <td className="py-0.5 pr-2 font-sans text-xs text-slate-500">
              雜訊 <M>{`e_${pos}`}</M>
            </td>
            <td className="text-right">
              <BitString bits={e} highlight={(i) => (e[i] ? 'font-bold text-rose-600' : 'text-slate-400')} />
            </td>
          </tr>
          <tr className="border-t border-slate-300">
            <td className="py-0.5 pr-2 font-sans text-xs font-semibold text-slate-700">收到 r</td>
            <td className="text-right font-bold">
              <BitString bits={r} />
            </td>
          </tr>
        </tbody>
      </table>
      <Tex block>{`s = Hc^{T} + He_${pos}^{T} = ${colTex(Hc)} + ${colTex(hj)} = ${colTex(s)}`}</Tex>
      <ul className="space-y-1.5 text-sm text-slate-700">
        <li className="flex flex-wrap items-center gap-2">
          <Lamps bits={s} size="sm" />
          <span>
            {vecEquals(s, hj) ? '✓' : '✗'} 亮的燈 = H 的第 {pos} 欄
          </span>
        </li>
        <li>
          {syndromeToPosition(s) === pos ? '✓' : '✗'} 讀成二進位（{READ.map((i) => LAMP[i]).join(' ')}）：<span className="mono font-semibold">{binText(s)}</span> = {syndromeToPosition(s)}
        </li>
        <li>
          {sameLamps === WORDS.length ? '✓' : '✗'} 換成其他 codeword 送出、同樣翻位置 {pos}：{sameLamps}/{WORDS.length} 次燈號都一樣
        </li>
        <li>
          {vecEquals(fixed, c) ? '✓' : '✗'} 翻回位置 {pos}：<M>{`r + e_${pos} = ${fixed.join('')} = c`}</M>
        </li>
      </ul>
    </Card>
  );
}

/**
 * 3 lamps → read as binary → 3-to-8 decoder → output line j flips bit j.
 * The buttons flip a single position (or none) so the reader can watch the lit output line move.
 */
function DecoderCircuit({ r, s, corrected, picked, onPick }: { r: readonly Bit[]; s: readonly Bit[]; corrected: readonly Bit[]; picked: number | null; onPick: (pos: number) => void }) {
  const value = syndromeToPosition(s);
  return (
    <Card title="Hamming 的 H：燈號直接接上 decoder" icon={<Cpu className="h-4 w-4 text-emerald-600" />}>
      <p className="mb-3 text-sm leading-relaxed text-slate-700">
        <ChLink to="matrix">第 2 章</ChLink> H 的設計 ④ 讓第 j 欄就是 j 的二進位，所以那張「燈號 → 位置」的對照表變成「燈號 j → 位置 j」，根本不用存：{R} 盞燈讀成二進位，直接接上一個 {R}-to-{STATES} decoder，第 j 條輸出線去翻轉第 j 位。
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">雜訊只翻：</span>
        {[0, ...POSITIONS].map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={picked === p}
            onClick={() => onPick(p)}
            className={`rounded-md border px-2 py-0.5 text-xs ${picked === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
          >
            {p === 0 ? '沒有' : `位置 ${p}`}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center justify-center gap-x-2.5 gap-y-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:flex-wrap">
        <Stop label="收到 r">
          <BitString bits={r} className="text-sm font-bold" />
        </Stop>
        <Arrow />
        <Machine title={`${R} 個檢查器`} note={`${R} 棵 XOR 樹，共 ${SYNDROME_XORS} 個 XOR 閘`} tone="border-parity-300 bg-parity-50 text-parity-700" />
        <Arrow />
        <Stop label={`${R} 盞燈，由左讀到右`}>
          <Lamps bits={s} size="sm" read />
        </Stop>
        <Arrow />
        <Machine title={`${R}-to-${STATES} decoder`} note={<>讀成 {binText(s)} = {value}：第 {value} 條線是 1</>} tone="border-sky-300 bg-sky-50 text-sky-800" />
        <Arrow />
        <Machine title="翻轉" note={`每個位置一個 XOR 閘，共 ${FLIP_XORS} 個`} tone="border-emerald-300 bg-emerald-50 text-emerald-800" />
        <Arrow />
        <Stop label="輸出 ĉ">
          <BitString bits={corrected} className="text-sm font-bold" highlight={(i) => (value && i === value - 1 ? 'text-emerald-600' : undefined)} />
        </Stop>
      </div>
      <div className="mt-3 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <div className="min-w-0">
          <div className="mb-1 text-xs font-semibold text-slate-500">
            {STATES} 條輸出線各接到哪裡
          </div>
          <ol className="grid grid-cols-2 gap-1 text-xs sm:grid-cols-4">
            {Array.from({ length: STATES }, (_, j) => {
              const target = matchingColumn(lampBits(j)) + 1; // the position whose column of H reads j
              return (
                <li key={j} className={`rounded-md border px-1.5 py-1 ${j === value ? 'border-rose-400 bg-rose-50 font-semibold text-rose-800' : 'border-slate-200 text-slate-500'}`}>
                  <span className="font-mono">{j}</span>：{target === 0 ? '沒出錯，不接' : `翻轉位置 ${target}`}
                </li>
              );
            })}
          </ol>
        </div>
        <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">
          <p>
            翻轉用的也是 XOR：第 j 個 XOR 閘的兩個輸入是 <M>{'r_j'}</M> 和第 j 條輸出線。那條線是 1，<M>{'r_j \\oplus 1'}</M> 就把那一位翻過來；其餘的線都是 0，位元原樣通過。燈全暗時只有第 0 條線是 1，它不接任何位置，r 整個原樣送出。
          </p>
          <p className="text-slate-600">
            整個 decoder 是組合邏輯：{SYNDROME_XORS} 個 XOR 閘算燈號、一個 {R}-to-{STATES} decoder、{FLIP_XORS} 個 XOR 閘翻轉。r 一進來，一次就算完，不用存表，也不用逐欄比對。
          </p>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export default function M3Syndrome() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c = useMemo(() => encode74(message), [message]);
  const [e, setE] = useState<Bit[]>(errorFrom([EXAMPLE_POS - 1]));
  const out = useMemo(() => simulate74(c, e), [c, e]);
  const s = out.decoded.syndrome;
  const match = matchingColumn(s);
  const errIdx = e.flatMap((b, i) => (b ? [i] : []));
  const decoderIdx = out.decoded.position - 1;

  const status: DecodeStatus = out.success ? (out.errorWeight === 0 ? 'ok' : 'corrected') : 'wrong';

  // animated column scan: walks through H's columns until it finds the syndrome
  const [scan, setScan] = useState(-1);
  const sKey = s.join('');
  useEffect(() => {
    if (match < 0) {
      setScan(-1);
      return;
    }
    setScan(0);
    let k = 0;
    const id = window.setInterval(() => {
      k++;
      setScan(k);
      if (k >= match) window.clearInterval(id);
    }, 220);
    return () => window.clearInterval(id);
  }, [sKey, match]);
  const scanDone = match >= 0 && scan >= match;

  const stats = useMemo(() => {
    const rows = Array.from({ length: N + 1 }, (_, w) => ({ w, total: 0, ok: 0, mis: 0, undetected: 0 }));
    allVectors(N).forEach((err) => {
      const o = simulate74(c, err);
      const row = rows[o.errorWeight];
      row.total++;
      if (o.success) row.ok++;
      else if (o.undetected) row.undetected++;
      else row.mis++;
    });
    return rows;
  }, [c]);

  const receivedStates = c.map((_, i) => (e[i] ? ('error' as const) : 'normal' as const));
  const correctedStates = out.decoded.corrected.map((_, i) => {
    if (i === decoderIdx) return e[i] ? ('corrected' as const) : ('error' as const);
    if (e[i] && i !== decoderIdx) return 'error' as const;
    return 'normal' as const;
  });
  const errorsAfter = weight(vecAdd(out.decoded.corrected, c));

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          雜訊翻轉了某一位，接收端卻看不到雜訊，也不知道發送端送了哪個 codeword。它手上只有收到的 {N} 個位元 r，和<ChLink to="matrix">第 2 章</ChLink>的 {R} 個檢查器點亮的 {R} 盞警示燈。這一章回答：燈亮了，接收端能從燈號知道什麼？又要怎麼把錯的那一位翻回來？
        </p>
      </ModuleHeader>
      <KeyPoint>亮的燈 = H 的第 j 欄 = 出錯的位置 j：接收端不必知道送了什麼，看燈就知道該翻哪一位。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title={`接收端只有 r 和 ${R} 盞燈`}>
          <Card title="接收端的處境">
            <ReceiverView c={c} e={e} r={out.received} s={s} />
            <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
              <p>
                燈號是接收端唯一的線索（目前的例子：{lampText(s)}）。它要靠這 {R} 盞燈決定「不動」還是「翻轉某一位」，而且最好做成一個電路，收到就立刻決定。要做到這件事，得先回答三個問題：
              </p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>燈號會不會因為送的 codeword 不同而不同？如果會，接收端不知道 c，就讀不懂燈號。</li>
                <li>雜訊翻了位置 j 時，亮的是哪幾盞燈？</li>
                <li>從燈號到「該翻哪一位」，電路要怎麼接？</li>
              </ol>
              <p className="text-slate-600">
                「設計」一節先定下 decoder 的做法；前兩個問題在「推導」一節用一條等式回答，第三個在「圖解」一節接成電路。
              </p>
            </div>
          </Card>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="Decoder 的做法：只用 r，最多翻一位">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title={`用 r 重算 ${R} 個檢查：syndrome`}>
              <Tex block>{`s = Hr^{T} = ${SVEC_TEX}^{T}`}</Tex>
              <div className="space-y-2 text-sm leading-relaxed text-slate-600">
                <p>
                  接收端手上只有 r，就把發送端用的 {R} 個檢查（同一張 H，<ChLink to="matrix">第 2 章</ChLink>）在 r 上再做一次。每個檢查的輸出是一盞警示燈，分量照燈命名：<M>{LAMP.map((l) => `s_${l.slice(1)}`).join(', ')}</M> 是 {LAMP.join('、')} 那盞燈，1 = 燈亮 = 那個檢查看到奇數個 1。合起來就是第 2 章的 <strong>syndrome</strong>。
                </p>
                <p className="text-slate-500">硬體上是 {R} 棵 XOR 樹：r 一進來，燈就亮好了。</p>
              </div>
            </Card>
            <Card title="把雜訊寫成加法：r = c + e">
              <Tex block>{'r = c + e'}</Tex>
              <div className="space-y-2 text-sm leading-relaxed text-slate-600">
                <p>
                  用 error vector <M>e</M> 記錄雜訊翻了哪幾位：第 <M>j</M> 位是 1，表示位置 <M>j</M> 被翻轉；錯了幾位 = <M>{'\\mathrm{wt}(e)'}</M>。只在位置 <M>j</M> 出錯的 error vector 記作 <M>{'e_j'}</M>。
                </p>
                <p>
                  翻轉一位就是加 1（1 + 1 = 0），所以雜訊寫得成加法，和檢查器的 XOR 是同一種運算：推導一節就靠這點把 c 和 e 拆開。e 只用來分析，接收端看不到它。
                </p>
              </div>
            </Card>
            <Card title="燈暗就不動，燈亮就只翻一位">
              <div className="space-y-2 text-sm leading-relaxed text-slate-600">
                <p>decoder 的決策規則：燈全暗 → r 原樣送出；燈亮 → 認定雜訊只翻了一位，把那一位翻回來。</p>
                <p>
                  雜訊不多時，只翻一位遠比同時翻兩位常見，所以每個燈號都先當成「只翻了一位」來解讀；Hamming({N},{K}) 也只保證修 {T} 位（<ChLink to="distance">第 4 章</ChLink>）。
                </p>
                <p>
                  要翻哪一位，靠 <M>{'h_j'}</M>：H 的第 <M>j</M> 欄，也就是「位置 <M>j</M> 被哪幾盞燈盯著」。下一節證明：只翻位置 <M>j</M> 時，亮的燈就是 <M>{'h_j'}</M>。
                </p>
              </div>
            </Card>
          </div>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="位置 j 出錯時，亮的燈就是 H 的第 j 欄">
          <LabGrid
            main={
              <Card title="兩個前提，一條等式">
                <div className="space-y-4 text-sm leading-relaxed text-slate-700">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded-xl border border-data-300 bg-data-50/60 p-3">
                      <div className="mb-1 font-bold text-data-700">前提 ①：送出的是 codeword</div>
                      發送端用 G 造出 c，<ChLink to="matrix">第 2 章</ChLink>的 <M>{'HG^{T} = 0'}</M> 保證 <M>{'Hc^{T} = 0'}</M>：沒有雜訊時燈全暗。燈本來是暗的，亮起來的每一盞都是雜訊造成的。
                    </div>
                    <div className="rounded-xl border border-rose-300 bg-rose-50/60 p-3">
                      <div className="mb-1 font-bold text-rose-700">前提 ②：恰好翻了一位</div>
                      雜訊只翻了位置 j，其餘 {N - 1} 位都沒動：<M>{'e = e_j'}</M>。這就是決策規則的假設；不成立時會怎樣，見實驗一節。
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">第一步：燈只對雜訊起反應（只用前提 ①）</div>
                    <Tex block>{'s = Hr^{T} = H(c+e)^{T} = \\underbrace{Hc^{T}}_{=\\,0} + He^{T} = He^{T}'}</Tex>
                    <p>
                      檢查器只做 XOR，可以疊加，所以 r 拆成 c 和 e 之後，兩部分各算各的。c 的部分是 0，剩下的只有雜訊：<strong>燈號只取決於雜訊 e，與送了哪個 codeword 無關</strong>。不管發送端送的是 {WORDS.length} 個 codeword 中的哪一個，同樣的雜訊點亮同樣的燈，所以接收端不需要知道 c。
                    </p>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">第二步：只翻一位，亮的燈就是第 j 欄（再加上前提 ②）</div>
                    <Tex block>{'s = He_j^{T} = h_j = H \\text{ 的第 } j \\text{ 欄}'}</Tex>
                    <p>
                      從第一步的 <M>{'s = He^{T}'}</M> 接著算：<M>{'e_j'}</M> 只有第 j 位是 1，H 乘上它只挑出第 j 欄。用燈來說：<strong>位置 j 出錯時亮起來的燈，剛好就是 H 的第 j 欄</strong>。第 2 章「第 j 欄 = 位置 j 被哪幾盞燈盯著」在這裡得到證明。
                    </p>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">第三步：看燈就知道翻哪一位</div>
                    <p>
                      第 2 章 H 的設計 ①② 讓 {N} 欄都不是 0、又互不相同，所以 {N} 種單一錯誤點亮 {N} 種不同的燈號，沒有一種是全暗：接收端看燈就分得出是哪一位。H 的設計 ④ 讓第 j 欄就是 j 的二進位，燈號直接讀成數字：
                    </p>
                    <Tex block>{`j = ${POS_TEX}`}</Tex>
                    <p>把位置 j 翻回來，雜訊就被抵消（1 + 1 = 0）：</p>
                    <Tex block>{'\\hat c = r + e_j = c + e_j + e_j = c'}</Tex>
                    <p className="text-slate-600">
                      兩個前提少一個，結論就不成立：沒有前提 ①，燈號混進了 c；沒有前提 ②，燈號是好幾欄的和（實驗一節）。
                    </p>
                  </div>
                </div>
              </Card>
            }
            aside={<SingleFlipCheck c={c} />}
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="從燈號到該翻的那一位">
          <LabGrid
            main={
              <Card title="通用做法：拿燈號逐欄比對 H" icon={<Search className="h-4 w-4 text-fuchsia-600" />}>
                <p className="mb-3 text-sm leading-relaxed text-slate-700">
                  只知道「亮的燈 = 第 j 欄」，接收端還得找出是哪一欄。通用的做法是拿燈號和 H 的 {N} 欄逐一比對，或存一張 {TABLE_ROWS} 格的「燈號 → 位置」對照表。任何 H 都能這樣解；欄沒有照二進位排的 H，只能這樣解。下面把這個做法套在本章的 H 上：
                </p>
                <div className="flex flex-wrap items-center gap-5">
                  <ColumnVector bits={s} label="s =" cellClass={match >= 0 ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-emerald-50 text-emerald-700'} />
                  <ArrowRight className="h-5 w-5 text-slate-300" />
                  <MatrixView
                    matrix={H74}
                    name="H"
                    rowLabels={LAMP}
                    colLabels={LAYOUT_74.map((p) => `#${p.position}`)}
                    cellClass={(_i, j) => (scanDone && j === match ? 'bg-fuchsia-500 text-white' : scan === j && !scanDone ? 'bg-slate-200 text-slate-900' : undefined)}
                  />
                </div>
                <motion.div key={sKey + String(scanDone)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  {match < 0 ? (
                    <span>
                      <M>{'s = 0'}</M>：燈全暗，所有檢查都通過，不用比對，decoder 判定「沒有錯誤」。
                    </span>
                  ) : scanDone ? (
                    <span>
                      <M>{sVecTex(s)}</M> 等於 H 的第 <strong>{match + 1}</strong> 欄：比了 {match + 1} 欄才找到，該翻位置 {match + 1}（{LAYOUT_74[match].label}）。Hamming 的 H 不用比：燈號讀成二進位 {binText(s)} 就是 {syndromeToPosition(s)}（下方電路）。
                    </span>
                  ) : (
                    <span className="text-slate-500">比對第 {scan + 1} 欄…</span>
                  )}
                </motion.div>
              </Card>
            }
            aside={
              <Card title="Venn 圖：變奇數的圓圈 = 亮的燈">
                <Venn word={out.received} errorIdx={errIdx} onToggle={(i) => setE((x) => flipBit(x, i))} />
                <p className="text-center text-xs text-slate-500">
                  紅色虛線圓圈為奇數（檢查失敗、燈亮）：<M>{sVecTex(s)}</M>。
                </p>
              </Card>
            }
          />
          <DecoderCircuit
            r={out.received}
            s={s}
            corrected={out.decoded.corrected}
            picked={errIdx.length === 0 ? 0 : errIdx.length === 1 ? errIdx[0] + 1 : null}
            onPick={(p) => setE(errorFrom(p ? [p - 1] : []))}
          />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="錯誤注入實驗">
          <LabGrid
            main={
              <Card
                title={`點擊 received word 的任意位元製造傳輸錯誤（0–${N} 個）`}
                actions={
                  <ResetButton
                    onClick={() => {
                      resetMessage();
                      setE(errorFrom([EXAMPLE_POS - 1]));
                    }}
                  />
                }
              >
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button key={p.label} className="btn-ghost !py-1 text-xs" onClick={() => setE(errorFrom(p.idx))}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  <Row label="原始資料 m">
                    <MessageInput message={message} onToggle={toggleBit} size="sm" />
                  </Row>
                  <Row label="發送 codeword c">
                    <BitRow bits={c} layout={LAYOUT_74} size="sm" />
                  </Row>
                  <Row label={<>Error vector e <span className="text-slate-400">wt = {weight(e)}</span></>}>
                    <BitRow bits={e} plain size="sm" states={e.map((b) => (b ? 'error' : 'muted'))} onToggle={(i) => setE((x) => flipBit(x, i))} showPositions={false} />
                  </Row>
                  <Row label="Received word r = c + e（可點擊）">
                    <BitRow bits={out.received} layout={LAYOUT_74} states={receivedStates} onToggle={(i) => setE((x) => flipBit(x, i))} />
                  </Row>
                  <Row label={`${R} 盞燈 s = Hrᵀ`}>
                    <Lamps bits={s} />
                  </Row>
                  <Row label="Decoder 輸出（修正後）">
                    <BitRow bits={out.decoded.corrected} layout={LAYOUT_74} states={correctedStates} size="sm" />
                  </Row>
                </div>
                <div className="mt-4">
                  <RoleLegend errors />
                </div>
              </Card>
            }
            aside={
              <>
                <Card title="Decoder 的判斷">
                  <div className="space-y-2 text-sm">
                    <div>
                      Syndrome <M>{'s = Hr^T'}</M>：<M>{sVecTex(s)}</M>，{lampText(s)}
                    </div>
                    <div>
                      {out.decoded.position === 0 ? (
                        <>燈全暗 → 判定沒有錯誤，不做修改。</>
                      ) : (
                        <>
                          燈號讀成 {binText(s)} = {out.decoded.position} → 判定錯誤在位置 <strong>{out.decoded.position}</strong>（{LAYOUT_74[decoderIdx].label}），將其翻轉。
                        </>
                      )}
                    </div>
                    <div>
                      解出資料 <span className="mono font-semibold">{out.decoded.message.join('')}</span>，原始資料 <span className="mono font-semibold">{message.join('')}</span>
                    </div>
                    <div className="pt-1">
                      <StatusBadge
                        status={status}
                        large
                        zh={status === 'wrong' ? (out.undetected ? 'Undetected error' : 'Miscorrection') : undefined}
                        en={status === 'wrong' ? '' : undefined}
                      />
                    </div>
                  </div>
                  {out.errorWeight >= 2 && (
                    <div className="mt-3">
                      <Callout kind="warning" title={`${out.errorWeight} 個錯誤：前提 ②「恰好翻了一位」不成立`}>
                        {out.undetected ? (
                          <p>
                            這次的 error vector <span className="mono">{e.join('')}</span> 本身就是一個 codeword，所以 <M>{'He^T = 0'}</M>：燈全暗，r 看起來是合法的 codeword，decoder 完全沒有察覺。
                          </p>
                        ) : (
                          <p>
                            燈號是 {errIdx.length} 欄之和，剛好等於 H 的第 {out.decoded.position} 欄。decoder 以為只錯一位，
                            {e[decoderIdx] ? <>翻轉了位置 {out.decoded.position}（這一位確實錯了，但其餘錯誤還在）</> : <strong>把原本沒錯的位置 {out.decoded.position} 也翻掉</strong>}
                            ，結果錯誤變成 {errorsAfter} 個。
                          </p>
                        )}
                        <ul className="list-disc space-y-1 pl-5">
                          <li className={out.miscorrection && out.errorWeight === 2 ? 'font-semibold' : undefined}>
                            錯兩位（位置 <M>j</M> 和 <M>{"j'"}</M>）：燈號是 <M>{"h_j + h_{j'}"}</M>。兩欄不同，和不是 0；H 又用上了全部 {PATTERNS} 種非零亮法，所以這個和一定是 H 的某一欄。它也不會是 <M>{'h_j'}</M> 或 <M>{"h_{j'}"}</M>（那樣另一欄就是 0），所以是<strong>第三欄</strong>：decoder 把原本沒錯的那一位也翻掉 → miscorrection。
                          </li>
                          <li className={out.undetected ? 'font-semibold' : undefined}>
                            錯三位：如果錯誤本身就是一個 codeword（例如 <span className="mono">{TRIPLE_WORD.join('')}</span>{TRIPLE_IS_CODEWORD ? '' : '✗'}），燈全暗 → undetected error；其他的三位錯誤也會造成 miscorrection。
                          </li>
                        </ul>
                        <p>
                          保證只到 {T} 個錯的原因在
                          <a href="#/distance" className="mx-1 font-semibold text-overall-700 hover:underline">
                            第 4 章
                          </a>
                          （<M>{`d_{\\min} = ${D_MIN}`}</M>），補救方法在
                          <a href="#/secded" className="mx-1 font-semibold text-overall-700 hover:underline">
                            第 5 章 SECDED
                          </a>
                          。
                        </p>
                      </Callout>
                    </div>
                  )}
                </Card>
                <Derivation
                  resetKey={e.join('') + message.join('')}
                  steps={[
                    { title: 'Received word', body: <Tex block>{`r = c + e = ${c.join('')} + ${e.join('')} = ${out.received.join('')}`}</Tex> },
                    { title: '計算 syndrome', body: <Tex block>{`s = Hr^T = ${matrixToTex(H74)}${matrixToTex(out.received.map((b) => [b]))} = ${colTex(s)}`}</Tex> },
                    {
                      title: '等於 He^T（被翻轉位置的欄相加）',
                      body:
                        errIdx.length === 0 ? (
                          <Tex block>{'He^T = 0'}</Tex>
                        ) : (
                          <Tex block>{`He^T = ${errIdx.map((j) => colTex(column(H74, j))).join(' + ')} = ${colTex(s)}`}</Tex>
                        ),
                    },
                    {
                      title: '解碼決策',
                      body:
                        out.decoded.position === 0 ? (
                          <p>s = 0，輸出 r。</p>
                        ) : (
                          <Tex block>{`j = ${POS_TEX} = ${out.decoded.position} \\Rightarrow \\hat c = r + e_{${out.decoded.position}} = ${out.decoded.corrected.join('')}`}</Tex>
                        ),
                    },
                  ]}
                />
              </>
            }
          />
          <Card title="0 ~ 3 個錯誤時，這個 decoder 表現如何？">
            <p className="text-sm text-slate-700">
              對 codeword <span className="mono">{c.join('')}</span> 窮舉全部 {ALL_ERRORS} 種 error vector（即時計算）：1 個錯誤 <strong>{stats[1].ok}/{stats[1].total}</strong> 全部修好；2 個錯誤 <strong>{stats[2].mis}/{stats[2].total}</strong> 造成 miscorrection（誤更正）；3 個錯誤中有 <strong>{stats[3].undetected}</strong> 種燈全暗（undetected error），其餘 {stats[3].mis} 種造成 miscorrection。
            </p>
            <div className="mt-3">
              <RelatedLinks
                title="兩個以上的錯誤：原因在第 4 章，補救方法在第 5 章，詳細分析在第二課"
                links={[
                  { to: 'distance', text: `Minimum distance ${D_MIN}：保證只修 ${T} 個錯的原因` },
                  { to: 'secded', text: 'SECDED：多一個位元，雙錯就能被偵測' },
                  { to: 'l2-9', text: '兩個錯誤一定造成 miscorrection（含窮舉表）' },
                  { to: 'l2-10', text: '三個錯誤：有些錯誤完全看不見' },
                ]}
              />
            </div>
          </Card>
          <Misconceptions
            items={[
              { wrong: 'syndrome ≠ 0 時，解碼結果一定正確。', right: '只有在「恰好翻了一位」時才正確。兩個錯誤的燈號也是某一欄，decoder 會翻錯位元。' },
              { wrong: 'syndrome = 0（燈全暗）代表沒有錯誤。', right: `燈全暗只代表 r 是某個 codeword。若錯誤本身是非零 codeword（例如 ${TRIPLE_WORD.join('')}，weight（重量）為 ${weight(TRIPLE_WORD)}），燈照樣全暗，錯誤無法被發現。` },
              { wrong: '要知道原本的 c 才能算 syndrome。', right: 's = Hrᵀ 只用到 r；而且 s = Heᵀ 與 c 無關：燈只對雜訊起反應。' },
            ]}
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="Syndrome 解碼的能力與界限">
          <Callout kind="key" title="結論">
            <p>
              接收端不知道送了什麼，只看 {R} 盞燈。燈只對雜訊起反應（<M>{'s = He^{T}'}</M>）；只翻一位時，亮的燈就是 H 的第 j 欄，讀成二進位就是 j，解碼電路把那一位翻回來。
            </p>
            <p>
              代價：decoder <strong>永遠</strong>假設最多翻了一位：燈亮就翻一位，燈暗就不動。錯兩位時，燈號指向第三個位置，decoder 會「自信地」把原本沒錯的位置也翻掉（miscorrection）；錯誤本身是 codeword 時，燈全暗。極限剛好是 {T} 個錯的原因，要用 Hamming distance（漢明距離）來看（
              <a href="#/distance" className="font-semibold text-overall-700 hover:underline">
                第 4 章
              </a>
              ）；怎麼補救，見 SECDED（
              <a href="#/secded" className="font-semibold text-overall-700 hover:underline">
                第 5 章
              </a>
              ）。
            </p>
          </Callout>
          <Card>
            <RelatedLinks links={[{ to: 'a-10', text: 'Syndrome 的 GF(8) 觀點：3 盞燈 = r(α) 一個值' }, { to: 'a-9', text: 'H 的欄 = GF(8) 的非零元素' }]} title="延伸：代數基礎與 cyclic codes" />
          </Card>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-center gap-1 sm:grid-cols-[170px_1fr] sm:gap-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
