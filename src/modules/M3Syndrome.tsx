import { useMemo, useState, type ReactNode } from 'react';
import { Cpu } from 'lucide-react';
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
  decode74,
  encode74,
  flipBit,
  hammingSyndromeXors,
  isCodeword74,
  isZeroVector,
  matVec,
  matchingColumn,
  minimumDistance,
  simulate74,
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
import { BitRow, BitString, MessageInput } from '../components/Bits';
import { MatrixView } from '../components/MatrixView';
import { RelatedLinks } from '../components/alg/Links';
import { Callout, Card, Derivation, FlowBar, KeyPoint, LabGrid, ModuleHeader, PrevNext, ResetButton, Stage, StatusBadge, type DecodeStatus } from '../components/Lesson';

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
/** column h_j of H for a 1-based position j */
const h = (j: number): Bit[] => column(H74, j - 1);

/** the running example of the chapter: noise flips position 5 */
const EXAMPLE_POS = 5;
/** the lamps written as a labelled vector: (s₁, s₂, s₄) */
const SVEC_TEX = `(${LAMP.map((l) => `s_${l.slice(1)}`).join(', ')})`;
/** position j from the lamps: j = s₁ + 2s₂ + 4s₄ */
const POS_TEX = LAMP.map((l, i) => `${i ? `${2 ** i}` : ''}s_${l.slice(1)}`).join(' + ');

/** two errors: the running position 5 plus position 1 (the pair chapters 4 and 5 also use) light the column of a third position */
const PAIR = [EXAMPLE_POS, 1];
const PAIR_SUM = vecAdd(h(PAIR[0]), h(PAIR[1]));
const PAIR_POS = syndromeToPosition(PAIR_SUM);
/** after the decoder flips PAIR_POS, how many bits are wrong */
const PAIR_AFTER = weight(decode74(PAIR.map((j) => unitVector(N, j - 1)).reduce((a, b) => vecAdd(a, b))).corrected);
/** a lightest non-zero codeword used as an error pattern: positions 1, 2, 3 flipped leave the lamps dark */
const TRIPLE = [1, 2, 3];
const TRIPLE_SUM = TRIPLE.map(h).reduce((a, b) => vecAdd(a, b));
const TRIPLE_WORD = TRIPLE.map((j) => unitVector(N, j - 1)).reduce((a, b) => vecAdd(a, b));
const TRIPLE_IS_CODEWORD = isCodeword74(TRIPLE_WORD);

const errorFrom = (idx: number[]): Bit[] => idx.reduce((e, i) => flipBit(e, i), zeroVector(N));
const presetLabel = (idx: number[]) => `${['', '單一錯誤', '兩個錯誤', '三個錯誤'][idx.length]}（位置 ${idx.map((i) => i + 1).join('、')}）`;
/** the presets of the "two or more errors" check: they set the page's shared e, so every widget above follows */
const PRESETS = [PAIR.map((j) => j - 1).sort((a, b) => a - b), TRIPLE.map((j) => j - 1), [EXAMPLE_POS - 1]].map((idx, k) => ({ label: `${k === 2 ? '回到' : ''}${presetLabel(idx)}`, idx }));
const EXAMPLE_E = errorFrom([EXAMPLE_POS - 1]);

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

/** a labelled line of a narrow widget: the label above, the content below */
function Line({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-semibold text-slate-500">{label}</div>
      {children}
    </div>
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

/**
 * W1, next to "s = Heⱼᵀ = hⱼ": flip bits of r (the page's shared e) on the shared message and watch the lamps.
 * Both lines are checked live: the lamps equal the flipped column, and they stay the same for all 16 codewords.
 */
function FlipCheck({ message, onMessage, c, e, r, s, onFlip, onReset }: { message: readonly Bit[]; onMessage: (i: number) => void; c: readonly Bit[]; e: readonly Bit[]; r: readonly Bit[]; s: readonly Bit[]; onFlip: (i: number) => void; onReset: () => void }) {
  const flipped = e.flatMap((b, i) => (b ? [i] : []));
  const same = WORDS.filter((w) => vecEquals(matVec(H74, vecAdd(w, e)), s)).length;
  const He = flipped.length ? flipped.map((i) => `h_${i + 1}`).join(' + ') : '0';
  return (
    <Card title="動手翻位元：亮的燈 = H 的第 j 欄" actions={<ResetButton onClick={onReset} />}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <Line label="訊息 m">
            <MessageInput message={message} onToggle={onMessage} size="sm" />
          </Line>
          <Line label="送出 c">
            <BitString bits={c} className="text-base font-bold text-slate-500" />
          </Line>
        </div>
        <Line label="收到 r（點位元翻轉）">
          <BitRow bits={r} layout={LAYOUT_74} size="sm" states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={onFlip} />
        </Line>
        <div className="flex flex-wrap items-center gap-4">
          <MatrixView matrix={H74} name="H" size="sm" rowLabels={LAMP} colLabels={POSITIONS} highlightCols={flipped} colHighlightClass="bg-rose-100 text-rose-800" />
          <Lamps bits={s} />
        </div>
        <Tex block>{`s = Hc^{T} + He^{T} = 0 + ${He} = ${colTex(s)}`}</Tex>
        <ul className="space-y-1 text-sm text-slate-700">
          <li>
            {flipped.length === 1 ? (
              <>
                {vecEquals(s, h(flipped[0] + 1)) ? '✓' : '✗'} 亮的燈 = H 的第 {flipped[0] + 1} 欄
              </>
            ) : flipped.length === 0 ? (
              <>沒有翻：燈{lampText(s)}</>
            ) : (
              <>翻了 {flipped.length} 位：燈號 = {flipped.length} 欄之和</>
            )}
          </li>
          <li>
            {same === WORDS.length ? '✓' : '✗'} 換 m（c 跟著變），燈號不變：{same}/{WORDS.length}
          </li>
        </ul>
      </div>
    </Card>
  );
}

/**
 * W2, after "j = s₁ + 2s₂ + 4s₄": 3 lamps → read as binary → 3-to-8 decoder → output line j flips bit j.
 * The buttons set the page's shared e to a single flip (or none).
 */
function DecoderCircuit({ r, s, corrected, picked, onPick, status }: { r: readonly Bit[]; s: readonly Bit[]; corrected: readonly Bit[]; picked: number | null; onPick: (pos: number) => void; status: ReactNode }) {
  const value = syndromeToPosition(s);
  return (
    <Card title="解碼電路：燈號讀成二進位，第 j 條線翻第 j 位" icon={<Cpu className="h-4 w-4 text-emerald-600" />}>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-slate-500">雜訊只翻位置：</span>
        {[0, ...POSITIONS].map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={picked === p}
            onClick={() => onPick(p)}
            className={`rounded-md border px-2 py-0.5 text-xs ${picked === p ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
          >
            {p === 0 ? '無' : p}
          </button>
        ))}
      </div>
      <div className="flex flex-col items-center justify-center gap-x-2.5 gap-y-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:flex-wrap">
        <Stop label="收到 r">
          <BitString bits={r} className="text-sm font-bold" />
        </Stop>
        <Arrow />
        <Machine title={`${R} 個檢查器`} note={`${SYNDROME_XORS} 個 XOR 閘`} tone="border-parity-300 bg-parity-50 text-parity-700" />
        <Arrow />
        <Stop label={`${R} 盞燈`}>
          <Lamps bits={s} size="sm" read />
        </Stop>
        <Arrow />
        <Machine title={`${R}-to-${STATES} decoder`} note={<>讀成 {binText(s)} = {value}：第 {value} 條線是 1</>} tone="border-sky-300 bg-sky-50 text-sky-800" />
        <Arrow />
        <Machine title="翻轉" note={`${FLIP_XORS} 個 XOR 閘`} tone="border-emerald-300 bg-emerald-50 text-emerald-800" />
        <Arrow />
        <Stop label={<>輸出 <M>{'\\hat c'}</M></>}>
          <BitString bits={corrected} className="text-sm font-bold" highlight={(i) => (value && i === value - 1 ? 'text-emerald-600' : undefined)} />
        </Stop>
      </div>
      <div className="mt-3 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
        <ol className="grid min-w-0 grid-cols-2 gap-1 text-xs sm:grid-cols-4">
          {Array.from({ length: STATES }, (_, j) => {
            const target = matchingColumn(lampBits(j)) + 1; // the position whose column of H reads j
            return (
              <li key={j} className={`rounded-md border px-1.5 py-1 ${j === value ? 'border-rose-400 bg-rose-50 font-semibold text-rose-800' : 'border-slate-200 text-slate-500'}`}>
                <span className="font-mono">{j}</span>：{target === 0 ? '不接' : `翻位置 ${target}`}
              </li>
            );
          })}
        </ol>
        <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">
          <p>
            第 j 條線是 1，第 j 個 XOR 閘就把 r 的第 j 位翻過來；第 0 條線不接，燈全暗時 r 原樣送出。
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <span>{value === 0 ? <>燈全暗 → 不動</> : <>讀成 {binText(s)} = {value} → 翻位置 {value}（{LAYOUT_74[value - 1].label}）</>}</span>
            {status}
          </div>
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
  const [e, setE] = useState<Bit[]>(EXAMPLE_E);
  const out = useMemo(() => simulate74(c, e), [c, e]);
  const s = out.decoded.syndrome;
  const errIdx = e.flatMap((b, i) => (b ? [i] : []));
  const decoderIdx = out.decoded.position - 1;
  const flip = (i: number) => setE((x) => flipBit(x, i));

  const status: DecodeStatus = out.success ? (out.errorWeight === 0 ? 'ok' : 'corrected') : 'wrong';
  const badge = <StatusBadge status={status} large zh={status === 'wrong' ? (out.undetected ? 'Undetected error' : 'Miscorrection') : undefined} en={status === 'wrong' ? '' : undefined} />;

  /** every error pattern on the current codeword, grouped by how many bits it flips */
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

  const correctedStates = out.decoded.corrected.map((_, i) => {
    if (i === decoderIdx) return e[i] ? ('corrected' as const) : ('wrongfix' as const);
    return e[i] ? ('error' as const) : ('normal' as const);
  });
  const errorsAfter = weight(vecAdd(out.decoded.corrected, c));

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          雜訊翻了某一位，接收端只拿得到 r 和<ChLink to="matrix">第 2 章</ChLink> {R} 個檢查器的 {R} 盞燈。看燈號，能知道該翻哪一位嗎？
        </p>
      </ModuleHeader>
      <KeyPoint>亮的燈 = H 的第 j 欄 = 出錯的位置 j：接收端不必知道送了什麼，看燈就知道該翻哪一位。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title={`接收端只有 r 和 ${R} 盞燈`}>
          <Card title="接收端的處境">
            <ReceiverView c={c} e={e} r={out.received} s={s} />
            <p className="mt-3 text-sm leading-relaxed text-slate-700">要決定不動還是翻哪一位，只能靠燈號（目前：{lampText(s)}）：</p>
            <ol className="mt-2 grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-3">
              <li className="rounded-lg bg-slate-50 px-3 py-2">① 燈號跟送了哪個 codeword 有關嗎？</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">② 只翻位置 j，亮哪幾盞？</li>
              <li className="rounded-lg bg-slate-50 px-3 py-2">③ 電路怎麼翻回那一位？</li>
            </ol>
          </Card>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="Decoder（解碼器）的做法：只用 r，最多翻一位">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title={`用 r 重算 ${R} 個檢查：syndrome`}>
              <Tex block>{`s = Hr^{T} = ${SVEC_TEX}^{T}`}</Tex>
              <p className="text-sm leading-relaxed text-slate-600">
                在 r 上重做<ChLink to="matrix">第 2 章</ChLink>的 {R} 個檢查：<M>{LAMP.map((l) => `s_${l.slice(1)}`).join(', ')}</M> 就是 {LAMP.join('、')} 三盞燈（1 = 亮）。
              </p>
            </Card>
            <Card title="把雜訊寫成加法：r = c + e">
              <Tex block>{'r = c + e'}</Tex>
              <p className="text-sm leading-relaxed text-slate-600">
                <M>{'e_j'}</M>：只在位置 <M>j</M> 出錯。錯了幾位 = e 的 weight（重量）<M>{'\\mathrm{wt}(e)'}</M>。
              </p>
            </Card>
            <Card title="燈暗就不動，燈亮就只翻一位">
              <div className="space-y-2 text-sm leading-relaxed text-slate-600">
                <p>燈全暗 → r 原樣送出；燈亮 → 認定恰好翻了一位，把它翻回來。</p>
                <p>
                  只翻一位最常見，而且 Hamming({N},{K}) 只保證修 {T} 位（<ChLink to="distance">第 4 章</ChLink>）。
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
                      <M>{'Hc^{T} = 0'}</M>（<ChLink to="matrix">第 2 章</ChLink> <M>{'HG^{T} = 0'}</M>）：燈本來全暗。
                    </div>
                    <div className="rounded-xl border border-rose-300 bg-rose-50/60 p-3">
                      <div className="mb-1 font-bold text-rose-700">前提 ②：恰好翻了一位</div>
                      <M>{'e = e_j'}</M>：只有位置 j 被翻轉。
                    </div>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">第一步：燈只對雜訊起反應（只用前提 ①）</div>
                    <Tex block>{'s = Hr^{T} = H(c+e)^{T} = \\underbrace{Hc^{T}}_{=\\,0} + He^{T} = He^{T}'}</Tex>
                    <p>XOR 可以疊加，c 的部分是 0：燈號只取決於 e，跟送了哪個 codeword 無關。</p>
                  </div>

                  <div>
                    <div className="font-semibold text-slate-900">第二步：亮的燈就是第 j 欄（再加上前提 ②）</div>
                    <Tex block>{'s = He_j^{T} = h_j = H \\text{ 的第 } j \\text{ 欄}'}</Tex>
                    <p>
                      <M>{'e_j'}</M> 只有第 j 位是 1，H 乘上它只挑出第 j 欄：第 2 章「第 j 欄 = 位置 j 被哪幾盞燈盯著」在這裡得到證明。
                    </p>
                  </div>
                </div>
              </Card>
            }
            aside={
              <FlipCheck
                message={message}
                onMessage={toggleBit}
                c={c}
                e={e}
                r={out.received}
                s={s}
                onFlip={flip}
                onReset={() => {
                  resetMessage();
                  setE(EXAMPLE_E);
                }}
              />
            }
          />

          <Card title="第三步：讀燈號就知道翻哪一位">
            <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm leading-relaxed text-slate-700 md:grid-cols-2">
              <div className="min-w-0">
                <p>
                  <ChLink to="matrix">第 2 章</ChLink> H 的設計 ①② 讓 {N} 種單一錯誤點亮 {N} 種不同燈號、沒有全暗；設計 ④ 讓燈號讀成二進位就是 j：
                </p>
                <Tex block>{`j = ${POS_TEX}`}</Tex>
              </div>
              <div className="min-w-0">
                <p>
                  把位置 j 翻回來，就得到 decoder 的輸出 <M>{'\\hat c'}</M>：
                </p>
                <Tex block>{'\\hat c = r + e_j = c + e_j + e_j = c'}</Tex>
              </div>
            </div>
          </Card>

          <DecoderCircuit
            r={out.received}
            s={s}
            corrected={out.decoded.corrected}
            picked={errIdx.length === 0 ? 0 : errIdx.length === 1 ? errIdx[0] + 1 : null}
            onPick={(p) => setE(errorFrom(p ? [p - 1] : []))}
            status={badge}
          />

          <LabGrid
            main={
              <Card title="錯兩位以上：前提 ② 不成立">
                <div className="space-y-4 text-sm leading-relaxed text-slate-700">
                  <div>
                    <div className="font-semibold text-slate-900">錯兩位：燈號指向第三位</div>
                    <p>
                      燈號是兩欄之和 <M>{"h_j + h_{j'}"}</M>。兩欄不同，和不是 0；H 用上了全部 {PATTERNS} 種非零亮法，所以和一定是某一欄，又不是 <M>{'h_j'}</M> 或 <M>{"h_{j'}"}</M>，只能是第三欄：
                    </p>
                    <Tex block>{`h_${PAIR[0]} + h_${PAIR[1]} = ${colTex(h(PAIR[0]))} + ${colTex(h(PAIR[1]))} = ${colTex(PAIR_SUM)} = h_${PAIR_POS}`}</Tex>
                    <p>
                      decoder 把沒錯的位置 {PAIR_POS} 也翻掉 → {PAIR_AFTER} 個錯：<strong>miscorrection（誤更正）</strong>。
                    </p>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">錯三位：燈可能全暗</div>
                    <p>
                      錯誤本身是 codeword（<span className="mono">{TRIPLE_WORD.join('')}</span>
                      {TRIPLE_IS_CODEWORD ? '' : ' ✗'}）時：
                    </p>
                    <Tex block>{`h_${TRIPLE[0]} + h_${TRIPLE[1]} + h_${TRIPLE[2]} = ${colTex(TRIPLE_SUM)} = 0`}</Tex>
                    <p>燈全暗，decoder 毫無察覺：undetected error。</p>
                  </div>
                </div>
              </Card>
            }
            aside={
              <>
                <Card title="錯兩位、錯三位">
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {PRESETS.map((p) => (
                      <button key={p.label} type="button" className="btn-ghost !py-1 text-xs" onClick={() => setE(errorFrom(p.idx))}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="space-y-3 text-sm text-slate-700">
                    <div className="flex flex-wrap items-center gap-3">
                      <Lamps bits={s} />
                      {badge}
                    </div>
                    <Line label="收到 r">
                      <BitRow bits={out.received} layout={LAYOUT_74} size="sm" states={e.map((b) => (b ? 'error' : 'normal'))} />
                    </Line>
                    <Line label="decoder 輸出">
                      <BitRow bits={out.decoded.corrected} layout={LAYOUT_74} size="sm" states={correctedStates} />
                    </Line>
                    <p>
                      {out.decoded.position === 0 ? `燈全暗 → 不動` : `翻位置 ${out.decoded.position}`} → {errorsAfter === 0 ? '修好' : `錯 ${errorsAfter} 位`}
                    </p>
                    <p className="text-slate-600">
                      窮舉 {ALL_ERRORS} 種 e：錯 1 位 {stats[1].ok}/{stats[1].total} 修好；錯 2 位 {stats[2].mis}/{stats[2].total} miscorrection；錯 3 位 {stats[3].undetected} 種全暗、{stats[3].mis} 種 miscorrection。
                    </p>
                  </div>
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
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="Syndrome 解碼的能力與界限">
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Callout kind="key" title="結論">
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  燈只對雜訊起反應：<M>{'s = He^{T}'}</M>，不必知道送了哪個 codeword。
                </li>
                <li>只翻位置 j 時，亮的燈 = H 的第 j 欄。</li>
                <li>燈號讀成二進位就是 j；解碼電路把第 j 位翻回來。</li>
                <li>錯兩位時，燈號指向第三位，造成 miscorrection；錯誤本身是 codeword 時，燈全暗。</li>
                <li>
                  保證只到 {T} 位：原因在<ChLink to="distance">第 4 章</ChLink>，補救在<ChLink to="secded">第 5 章 SECDED</ChLink>。
                </li>
              </ul>
            </Callout>
            <Card>
              <RelatedLinks
                title="延伸"
                links={[
                  { to: 'a-10', text: '3 盞燈 = r(α) 一個值' },
                  { to: 'a-9', text: 'H 的欄 = GF(8) 的非零元素' },
                  { to: 'l2-9', text: '兩個錯誤一定造成 miscorrection' },
                  { to: 'l2-10', text: '有些錯誤完全看不見' },
                ]}
              />
            </Card>
          </div>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}
