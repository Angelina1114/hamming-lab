import { useState, type ReactNode } from 'react';
import {
  type Bit,
  type SecdedCase,
  DEFAULT_MESSAGE,
  H74,
  H84,
  K4,
  LAYOUT_84,
  N7,
  N8,
  OVERALL_INDEX,
  PARITY_CHECKS,
  allVectors,
  codewords74,
  codewords84,
  decode74,
  differingPositions,
  doubleErrorLandings,
  encode74,
  encode84,
  extractMessage74,
  flipBit,
  flipPath,
  hammingDistance,
  isCodeword74,
  isZeroVector,
  matVec,
  minimumDistance,
  secdedDecode,
  shortenedHamming,
  simulate74,
  simulate84,
  syndromeToPosition,
  vecEquals,
  weight,
  zeroVector,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { StatusBadge, type DecodeStatus } from '../../components/Lesson';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { useMessage } from '../../lib/store';
import { Box, NOTES_SUB, NOTES_UL, Reveal } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** Hamming(7,4): 7 positions, 4 data bits, 3 lamps; Extended(8,4): P0 at position 8 and a 4th lamp */
const N = N7;
const K = K4;
const R = H74.length;
const STATES = 2 ** R;
const NE = N8;
const RE = H84.length;
const P0 = LAYOUT_84[OVERALL_INDEX].label;
const P0_POS = LAYOUT_84[OVERALL_INDEX].position;
const RATE7 = K / N;
const RATE8 = K / NE;

const C7 = codewords74();
const C8 = codewords84();
const W7 = C7.map((e) => e.codeword);
const W8 = C8.map((e) => e.codeword);
const MD8 = minimumDistance(W8);
const D7 = minimumDistance(W7).dmin;
const D8 = MD8.dmin;

/** what each decoder does with every error of weight w (s and q only see e, so the zero codeword stands in for all 16) */
function outcomes84(w: number) {
  const runs = allVectors(NE)
    .filter((e) => weight(e) === w)
    .map((e) => simulate84(zeroVector(NE), e));
  return { total: runs.length, ok: runs.filter((o) => o.success).length, detected: runs.filter((o) => o.result.case === 'double-detected').length };
}
const ONE8 = outcomes84(1);
const TWO8 = outcomes84(2);
const TWO7 = (() => {
  const runs = allVectors(N)
    .filter((e) => weight(e) === 2)
    .map((e) => simulate74(zeroVector(N), e));
  return { total: runs.length, mis: runs.filter((o) => o.miscorrection).length };
})();
/** a double error sits at distance ≥ 2 from every codeword; how many codewords it is exactly 2 away from */
const DOUBLE8 = doubleErrorLandings(W8);
const OUTSIDE8 = allVectors(NE).filter((w) => W8.every((c) => hammingDistance(w, c) >= 2));
const TIED = [...new Set(OUTSIDE8.map((w) => W8.filter((c) => hammingDistance(w, c) === 2).length))].join('／');

/** chapter 4's A → B path, in the extended code (pinned in core.test): A = default message, B = 1111, position 5 flipped first */
const EXAMPLE_POS = 5;
const A_ENTRY = C8.find((e) => vecEquals(e.message, DEFAULT_MESSAGE)) ?? C8[0];
const B_ENTRY = C8.find((e) => e.message.every((b) => b === 1)) ?? C8[C8.length - 1];
const A = A_ENTRY.codeword;
const B = B_ENTRY.codeword;
const D_AB7 = hammingDistance(encode74(A_ENTRY.message), encode74(B_ENTRY.message));
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

/** the triple error that fools SECDED: positions 1, 2, 3 are a Hamming(7,4) codeword, so s = 0 and q = 1 */
const TRIPLE = [0, 1, 2];
const TRIPLE_RESULT = secdedDecode(TRIPLE.reduce<Bit[]>((w, i) => flipBit(w, i), [...A]));

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
const posList = (idx: readonly number[]) => [...idx].sort((a, b) => a - b).map((i) => i + 1).join('、');
const bits = (v: readonly Bit[]) => v.join('');
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/* ------------------------------------------------------------------ */
/* Shared pictures                                                     */
/* ------------------------------------------------------------------ */

/** The receiver's lamps: the 3 of chapters 2–3 (s) and, when given, the 4th lamp q that watches all 8 positions. */
function Lamps({ s = [], q, size = 'md' }: { s?: readonly Bit[]; q?: Bit; size?: 'sm' | 'md' }) {
  const d = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  const one = (key: string, on: boolean, label: string, lit: string) => (
    <span key={key} className="inline-flex flex-col items-center gap-0.5">
      <span className={`${d} rounded-full border-2 ${on ? lit : 'border-slate-300 bg-slate-200'}`} />
      <span className="text-sm font-semibold leading-none text-slate-500">{label}</span>
    </span>
  );
  const aria = [s.length ? `警示燈${lampText(s)}` : '', q === undefined ? '' : `第 ${RE} 盞燈${q ? '亮' : '暗'}`].filter(Boolean).join('，');
  return (
    <span className="inline-flex items-end gap-2 align-middle" role="img" aria-label={aria}>
      {s.map((b, i) => one(LAMP[i], b === 1, LAMP[i], 'border-rose-500 bg-rose-400 shadow-[0_0_10px_3px_rgba(244,63,94,0.45)]'))}
      {q !== undefined && (
        <>
          {s.length > 0 && <span className="mx-0.5 h-6 w-px self-center bg-slate-300" aria-hidden />}
          {one('q', q === 1, P0, 'border-overall-600 bg-overall-500 shadow-[0_0_10px_3px_rgba(139,85,240,0.5)]')}
        </>
      )}
    </span>
  );
}

/** a word in a monospace run: flipped positions in red, P0 in purple, a gap before P0 */
function Word({ bits: b, flipped = [], size = 'text-2xl' }: { bits: readonly Bit[]; flipped?: readonly number[]; size?: string }) {
  return (
    <span className={`font-mono font-bold tracking-[0.1em] ${size}`}>
      {b.map((v, i) => (
        <span key={i} className={`${flipped.includes(i) ? 'text-rose-600' : i === OVERALL_INDEX ? 'text-overall-600' : ''} ${i === OVERALL_INDEX ? 'ml-1.5' : ''}`}>
          {v}
        </span>
      ))}
    </span>
  );
}

/** a phrase of a takeaway that never breaks in the middle (the header box only fits ~17 characters a line) */
const Ph = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

const CASE_CELL: Record<SecdedCase, { label: string; where: string; action: string; status: DecodeStatus; cls: string }> = {
  'no-error': { label: '沒有錯', where: '', action: '原樣輸出', status: 'ok', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  'overall-corrected': { label: '錯 1 個', where: `就是 ${P0}`, action: `翻轉 ${P0}`, status: 'corrected', cls: 'border-sky-300 bg-sky-50 text-sky-900' },
  'double-detected': { label: '錯 2 個', where: '', action: '回報，不修正', status: 'detected', cls: 'border-orange-300 bg-orange-50 text-orange-900' },
  'single-corrected': { label: '錯 1 個', where: `在位置 1–${N}`, action: '翻轉 s 指的位置', status: 'corrected', cls: 'border-sky-300 bg-sky-50 text-sky-900' },
};

/* ------------------------------------------------------------------ */
/* 1. ECC 記憶體：寧可回報，也不要改錯                                 */
/* ------------------------------------------------------------------ */

function EccSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const r = PAIR.reduce<Bit[]>((w, i) => flipBit(w, i), c);
  const d = decode74(r);
  const out = d.corrected;
  const wrong = differingPositions(out, c);
  const label = 'text-base text-slate-500';
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-slate-50 text-slate-900" title={`Hamming(${N},${K}) 遇到 2 個錯`}>
          <p className="text-slate-700">伺服器記憶體整天在讀寫，雜訊偶爾翻轉位元：翻 1 位最常見，翻 2 位少見但遲早會遇到。</p>
          <div className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 rounded-xl bg-white/80 px-3 py-2">
            <span className={label}>送出 c</span>
            <Word bits={c} size="text-xl" />
            <span className={label}>收到 r</span>
            <span className="flex flex-wrap items-center gap-3">
              <Word bits={r} flipped={PAIR} size="text-xl" />
              <Lamps s={d.syndrome} size="sm" />
            </span>
            <span className={label}>解碼後</span>
            <span className="flex flex-wrap items-center gap-3">
              <Word bits={out} flipped={wrong} size="text-xl" />
              <Lamps s={matVec(H74, out)} size="sm" />
            </span>
          </div>
          <p className="mt-2 text-slate-700">
            雜訊翻位置 {posList(PAIR)}，燈號指向位置 {d.position}：解碼器去翻它，錯 {wrong.length} 位，交出 <span className="whitespace-nowrap">m = {bits(extractMessage74(out))}</span>。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-rose-50 text-rose-950" title="悄悄改錯：沒有人知道">
          <p>
            解碼後的字{isCodeword74(out) ? '' : ' ✗'}<strong>本身就是合法 codeword</strong>：再檢查一次，燈也全暗。
          </p>
          <p className="mt-2">錯的資料被當成正確的繼續計算、寫回硬碟，等發現時已經找不到源頭。</p>
          <p className="mt-2 font-semibold text-rose-800">
            {TWO7.mis}/{TWO7.total} 種雙錯，全部被改成另一個 codeword。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-emerald-50 text-emerald-950" title="寧可回報">
          <p>回報了，系統還能補救：重讀一次、重新取得，或把這一頁記憶體停用。</p>
          <p className="mt-2">
            要回報，就得分出「錯 1 個」和「錯 2 個」。但 {R} 盞燈的 {STATES} 種狀態都已經有主人（第 4 章）。
          </p>
          <p className="mt-2 font-semibold text-emerald-800">→ 多一盞燈：SECDED，修 1 個、偵測 2 個。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 多一盞燈 P0：(8,4)                                               */
/* ------------------------------------------------------------------ */

function ParitySlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c7 = encode74(message);
  const c8 = encode84(message);
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-overall-50 text-slate-900" title={`第 ${RE} 盞燈：翻了奇數還是偶數位`}>
          <p className="text-slate-700">每翻一位，1 的總數奇偶就變一次：翻 1 位變奇數，翻 2 位又變回偶數。</p>
          <Tex block>{`P_0 = c_1 \\oplus c_2 \\oplus \\cdots \\oplus c_${N}`}</Tex>
          <p className="text-slate-700">
            發送端補上 {P0}：{NE} 個位元一定有偶數個 1。
          </p>
          <p className="mt-1 text-base">
            <Word bits={c7} size="text-lg" /> → <Word bits={c8} flipped={[]} size="text-lg" />
          </p>
          <p className="mt-2 text-slate-700">
            接收端第 {RE} 盞燈 <M>{`q = r_1 + \\cdots + r_${NE}`}</M>：翻奇數位就亮。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-sky-50 text-sky-950" title={`放在第 ${P0_POS} 位，代價 1 位`}>
          <p>
            前 {N} 位和 Hamming({N},{K}) 一模一樣：{R} 盞燈、H 的設計 ①–⑤、{R}-to-{STATES} 解碼器都不用改。
          </p>
          <p className="mt-2">
            碼率 <M>{`\\tfrac{${K}}{${N}} \\approx ${RATE7.toFixed(3)} \\to \\tfrac{${K}}{${NE}} = ${RATE8.toFixed(3)}`}</M>
          </p>
          <Tex block>{`[${N},${K},${D7}] \\;\\to\\; [${NE},${K},${D8}]`}</Tex>
          <p className="text-slate-600">
            {P0} 由前 {N} 位決定，不帶新資訊：k 仍是 {K}。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-amber-50 text-amber-950" title={`A 到 B 變成 ${D_AB} 步`}>
          <p className="text-base text-slate-700">
            A、B 差 {D_AB7} 位（奇數）→ {P0} 也不同 → 差 {D_AB} 位（位置 {AB_DIFF.join('、')}）
          </p>
          <table className="mt-1 w-full text-base">
            <tbody>
              {PATH.map((st, k) => (
                <tr key={k} className={`border-t border-amber-200 ${k === MID ? 'bg-orange-100 font-semibold' : ''}`}>
                  <td className="py-0.5 pr-2 text-slate-600">{k === 0 ? 'A' : k === D_AB ? 'B' : `翻 ${k}`}</td>
                  <td className="pr-2">
                    <Word bits={st.word} flipped={st.flipped} size="text-base" />
                  </td>
                  <td className="whitespace-nowrap pr-2 font-mono">
                    {st.dA}·{st.dB}
                  </td>
                  <td className="whitespace-nowrap text-sm">{k === 0 ? '送出' : k === MID ? '回報' : st.toA ? '修回 A' : st.toB && k === D_AB ? '就是 B' : st.toB ? '改成 B' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-base text-slate-700">
            翻 2 位停在正中間（離 A {STEP_MID.dA}、離 B {STEP_MID.dB}）：不會被推到 B。窮舉 {MD8.pairsChecked} 對：<M>{`d_{\\min} = ${D8}`}</M>。
          </p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. (s, q) 的四種組合                                                */
/* ------------------------------------------------------------------ */

const GRID: [SecdedCase, SecdedCase][] = [
  ['no-error', 'overall-corrected'],
  ['double-detected', 'single-corrected'],
];

function DecisionGrid() {
  const head = 'grid place-items-center text-lg font-semibold text-slate-600';
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
      <div />
      <div className={head}>
        q = 0<span className="text-sm font-normal text-slate-500">偶數位</span>
      </div>
      <div className={head}>
        q = 1<span className="text-sm font-normal text-slate-500">奇數位</span>
      </div>
      {GRID.map((row, i) => (
        <RowCells key={i} side={i === 0 ? 's = 0' : 's ≠ 0'} row={row} head={head} />
      ))}
    </div>
  );
}

function RowCells({ side, row, head }: { side: string; row: [SecdedCase, SecdedCase]; head: string }) {
  return (
    <>
      <div className={`${head} whitespace-nowrap pr-1`}>{side}</div>
      {row.map((k) => {
        const c = CASE_CELL[k];
        return (
          <div key={k} className={`flex min-h-[6.5rem] flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center leading-snug ${c.cls}`}>
            <span className="text-lg font-semibold">{c.label}</span>
            {c.where && <span className="text-sm">{c.where}</span>}
            <span className="mt-1 text-base">→ {c.action}</span>
          </div>
        );
      })}
    </>
  );
}

function CasesSlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-[1fr_1fr_1.5fr]">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-sky-50 text-sky-950" title="q = 1：剛好 1 個錯">
          <p>奇數個錯、又至多 2 個 → 只能是 1 個。</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            <li>
              <M>{'s \\neq 0'}</M>：錯在前 {N} 位，s 指出位置 → 翻轉它。
            </li>
            <li>
              <M>{'s = 0'}</M>：前 {N} 位沒錯，錯的是 {P0} 自己 → 翻轉 {P0}。
            </li>
          </ul>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-orange-50 text-orange-950" title="q = 0：0 個或 2 個錯">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <M>{'s = 0'}</M>：沒有錯。
            </li>
            <li>
              <M>{'s \\neq 0'}</M>：2 個錯 → <strong>回報，不修正</strong>。
            </li>
          </ul>
          <p className="mt-1">
            2 個錯一定 <M>{'s \\neq 0'}</M>：<M>{'h_i + h_j \\neq 0'}</M>（設計 ②）；其中一個是 {P0} 時 <M>{'s = h_i \\neq 0'}</M>（設計 ①）。
          </p>
          <p className="mt-1 text-slate-600">不修：這種字離 {TIED} 個 codeword 都是 2，猜不出送的是哪一個。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-slate-50 text-slate-900" title="決策表">
          <DecisionGrid />
          <p className="mt-2 text-base text-slate-600">錯 3 個以上不在保證範圍：可能被當成 1 個錯而改錯。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. 實例：SECDED 解碼器                                              */
/* ------------------------------------------------------------------ */

/** one row of 8 bit cells (P0 set apart); clickable when onFlip is given */
function Cells({ word, flipped = [], onFlip }: { word: readonly Bit[]; flipped?: readonly number[]; onFlip?: (i: number) => void }) {
  return (
    <div className="flex gap-1.5">
      {word.map((b, i) => {
        const on = flipped.includes(i);
        const cls = `flex w-12 flex-col items-center rounded-lg border-2 py-1 ${i === OVERALL_INDEX ? 'ml-3' : ''} ${on ? 'border-rose-500 bg-rose-50' : i === OVERALL_INDEX ? 'border-overall-300 bg-overall-50' : 'border-slate-200 bg-white'}`;
        const body = (
          <>
            <span className="text-xs font-semibold text-slate-600">{LAYOUT_84[i].label}</span>
            <span className={`font-mono text-2xl font-bold ${on ? 'text-rose-600' : ''}`}>{b}</span>
          </>
        );
        return onFlip ? (
          <button key={i} type="button" onClick={() => onFlip(i)} aria-label={`${LAYOUT_84[i].label} = ${b}${on ? '（已翻轉）' : ''}`} aria-pressed={on} className={cls}>
            {body}
          </button>
        ) : (
          <span key={i} className={cls}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

function DecoderSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const sent = encode84(message);
  const [e, setE] = useState<number[]>([...PAIR]);
  const r = sent.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const res = secdedDecode(r);
  const ok = !!res.corrected && vecEquals(res.corrected, sent);
  const status: DecodeStatus = res.case === 'double-detected' ? 'detected' : !ok ? 'wrong' : e.length === 0 ? 'ok' : 'corrected';
  const cell = CASE_CELL[res.case];
  // the same error, seen by chapter 3's decoder: only the first 7 bits and 3 lamps
  const h7 = decode74(r.slice(0, N));
  const e7 = e.filter((i) => i < N);
  const h7Status: DecodeStatus = !vecEquals(h7.corrected, sent.slice(0, N)) ? 'wrong' : e7.length === 0 ? 'ok' : 'corrected';
  const tone = (st: DecodeStatus) => (st === 'wrong' ? 'bg-rose-50 text-rose-950' : st === 'detected' ? 'bg-orange-50 text-orange-950' : 'bg-emerald-50 text-emerald-950');
  const flip = (i: number) => setE(e.includes(i) ? e.filter((j) => j !== i) : e.length < 3 ? [...e, i] : e);
  return (
    <div className="space-y-5 text-xl">
      <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-4 gap-y-2">
        <span className="text-slate-500">送出 c</span>
        <Cells word={sent} />
        <span />
        <span className="text-slate-500">收到 r</span>
        <Cells word={r} flipped={e} onFlip={flip} />
        <span className="text-lg text-slate-600">
          實際錯了 {e.length} 個{e.length ? `（位置 ${posList(e)}）` : ''}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-overall-50 text-slate-900" title={`讀 ${RE} 盞燈`}>
            <div className="my-2">
              <Lamps s={res.syndrome} q={res.overallParity} />
            </div>
            <div className="space-y-1 text-lg">
              <div>
                s = <span className="font-mono font-bold">({res.syndrome.join(',')})ᵀ</span>
                <span className="text-slate-600">{isZeroVector(res.syndrome) ? '：全暗' : `：指向位置 ${syndromeToPosition(res.syndrome)}`}</span>
              </div>
              <div>
                q = <span className="font-mono font-bold">{res.overallParity}</span>
                <span className="text-slate-600">：翻了{res.overallParity ? '奇數' : '偶數'}位</span>
              </div>
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone={tone(status)} title={`SECDED：${cell.label}${cell.where ? `（${cell.where}）` : ''}`}>
            <p className="text-lg">→ {cell.action}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StatusBadge status={status} large zh={status === 'wrong' ? '誤判' : undefined} en="" />
            </div>
            <div className="mt-2 text-lg">
              {res.corrected ? <Word bits={res.corrected} flipped={differingPositions(res.corrected, sent)} size="text-xl" /> : <span className="font-semibold">拒絕輸出，回報系統</span>}
            </div>
            {e.length > 2 && <p className="mt-1 text-base text-slate-600">錯 {e.length} 個：超出保證範圍。</p>}
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone={tone(h7Status)} title={`同一個錯誤，Hamming(${N},${K})`}>
            <p className="text-lg">只看前 {N} 位和 {R} 盞燈：</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <Lamps s={h7.syndrome} size="sm" />
              <span className="text-lg">→ {h7.position ? `翻位置 ${h7.position}` : '不動'}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <StatusBadge status={h7Status} large zh={h7Status === 'wrong' ? (h7.position ? '誤更正' : '未偵測錯誤') : undefined} en="" />
              <Word bits={h7.corrected} flipped={differingPositions(h7.corrected, sent.slice(0, N))} size="text-xl" />
            </div>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. 實際系統：伺服器記憶體 (72,64)                                   */
/* ------------------------------------------------------------------ */

function ServerSlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-4 text-lg lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-sky-50 text-sky-950" title={`${SERVER.r} 盞燈才夠`}>
          <p>每次讀寫 {SERVER.k} 個資料位元。更正 1 個錯，r 盞燈要分出 {SERVER.k} + r + 1 種情況（第 4 章）：</p>
          <Tex block>{`2^{${SERVER.r - 1}} = ${2 ** (SERVER.r - 1)} < ${SERVER.k + SERVER.r}`}</Tex>
          <Tex block>{`2^{${SERVER.r}} = ${2 ** SERVER.r} \\ge ${SERVER.k + SERVER.r + 1}`}</Tex>
          <p className="text-slate-600">
            所以 r = {SERVER.r}。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-overall-50 text-slate-900" title={`縮短，再加 ${P0}`}>
          <p>
            Hamming({SERVER.parentN},{SERVER.parentK}) 只用 {SERVER.k} 個資料位置（其餘 {SERVER.shortenedBy} 個固定為 0、不送）：
          </p>
          <Tex block>{`(${SERVER.parentN},${SERVER.parentK}) \\to (${SERVER.n},${SERVER.k}) \\xrightarrow{+P_0} (${SERVER.nSecded},${SERVER.k})`}</Tex>
          <p>判斷規則就是這一章的四格：修 1 個、回報 2 個。</p>
          <p className="mt-1 text-slate-600">
            不是完美碼：{2 ** SERVER.r} 種燈號只用到 {SERVER.n + 1} 種。
          </p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-emerald-50 text-emerald-950" title={`代價：只多存 ${pct(SERVER_CHECK / SERVER.k)}`}>
          <table className="w-full text-center text-lg">
            <thead>
              <tr className="text-base text-slate-500">
                <th className="py-0.5" />
                <th className="font-normal">
                  ({NE},{K})
                </th>
                <th className="font-normal">
                  ({SERVER.nSecded},{SERVER.k})
                </th>
              </tr>
            </thead>
            <tbody className="font-mono">
              <tr className="border-t border-emerald-200">
                <td className="py-1 text-left font-sans text-base">檢查位元</td>
                <td>{NE - K}</td>
                <td>
                  {SERVER.r} + 1 = {SERVER_CHECK}
                </td>
              </tr>
              <tr className="border-t border-emerald-200">
                <td className="py-1 text-left font-sans text-base">多存</td>
                <td>{pct((NE - K) / K)}</td>
                <td className="font-bold">{pct(SERVER_CHECK / SERVER.k)}</td>
              </tr>
              <tr className="border-t border-emerald-200">
                <td className="py-1 text-left font-sans text-base">碼率</td>
                <td>{pct(RATE8)}</td>
                <td className="font-bold">{pct(SERVER.rateSecded)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2">記憶體每次讀寫 {SERVER.nSecded} 個位元：{SERVER.k} 個資料、{SERVER_CHECK} 個檢查。</p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

export const CH5_SLIDES: DeckSlide<null>[] = [
  {
    title: '第 5 章：ECC 記憶體：寧可回報，不要改錯',
    sub: `Hamming(${N},${K}) 遇到 2 個錯：改錯了，而且沒有人知道`,
    steps: () => 3,
    render: (s) => <EccSlide s={s} />,
    takeaway: (
      <>
        <Ph>改錯的資料看起來完全正常；</Ph>
        <Ph>回報了，系統才能補救</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          情境：伺服器的 ECC 記憶體，宇宙射線、電壓雜訊偶爾翻轉位元
          <ul className={NOTES_SUB}>
            <li>記憶體控制器就是接收端：讀出時算燈號、修好錯</li>
            <li>翻 1 位最常見，當場修好；翻 2 位少見，但伺服器日夜在跑，遲早會遇到</li>
            <li>
              例：雜訊翻位置 {posList(PAIR)}，{R} 盞燈指向第三個位置，解碼器去翻它 → 錯 3 位
            </li>
          </ul>
        </li>
        <li>
          → 悄悄改錯：解碼後是另一個合法 codeword，再檢查燈也全暗
          <ul className={NOTES_SUB}>
            <li>錯的資料被繼續計算、寫回硬碟，事後找不到源頭</li>
            <li>
              Hamming({N},{K}) 的 {TWO7.total} 種雙錯全部如此（{TWO7.mis}/{TWO7.total}）
            </li>
          </ul>
        </li>
        <li>
          → 寧可回報：系統可以重讀、重新取得，或停用那一頁記憶體
          <ul className={NOTES_SUB}>
            <li>要回報，就要分出錯 1 個和錯 2 個</li>
            <li>
              第 4 章：{R} 盞燈的 {STATES} 種狀態都有主人 → 多一盞燈
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 5 章：多一盞燈 ${P0}：(${NE},${K})`,
    sub: `第 ${RE} 盞燈數翻轉個數的奇偶`,
    steps: () => 3,
    render: (s) => <ParitySlide s={s} />,
    takeaway: (
      <>
        <Ph>第 {RE} 盞燈數奇偶；</Ph>
        <Ph>雙錯停在 A、B 正中間，</Ph>
        <Ph>不會被推過去</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          錯 1 個與錯 2 個，差在翻了幾位：每翻一位，1 的總數奇偶就變一次
          <ul className={NOTES_SUB}>
            <li>
              發送端多送 {P0} = c₁ ⊕ … ⊕ c{N}：{NE} 個位元一定有偶數個 1
            </li>
            <li>
              第 {RE} 盞燈 q 看全部 {NE} 位：翻奇數位亮，翻偶數位（含 0）暗
            </li>
          </ul>
        </li>
        <li>
          → {P0} 放在第 {P0_POS} 位：前 {N} 位和 Hamming({N},{K}) 一樣
          <ul className={NOTES_SUB}>
            <li>
              {R} 盞燈、第 2 章 H 的設計 ①–⑤、第 3 章的 {R}-to-{STATES} 解碼器都不用改
            </li>
            <li>
              代價 1 位：碼率 {K}/{N} ≈ {RATE7.toFixed(3)} → {K}/{NE} = {RATE8.toFixed(3)}；[{N},{K},{D7}] → [{NE},{K},{D8}]
            </li>
          </ul>
        </li>
        <li>
          → 第 4 章的 A → B 變成 {D_AB} 步
          <ul className={NOTES_SUB}>
            <li>
              A、B 差 {D_AB7} 位，是奇數 → {P0} 也不同 → 差 {D_AB} 位
            </li>
            <li>
              翻 1 位：離 A {STEP1.dA}、離 B {STEP1.dB} → 修回 A
            </li>
            <li>
              翻 2 位（位置 {PAIR.map((i) => i + 1).join('、')}）：離 A {STEP_MID.dA}、離 B {STEP_MID.dB} → 正中間 → 回報；第 4 章同樣兩位，字被推到 B
            </li>
            <li>
              窮舉 {MD8.pairsChecked} 對：d_min {D7} → {D8}；{DOUBLE8.total} 種雙錯，落在別人旁邊的 {DOUBLE8.nearOther} 種
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 5 章：(s, q) 的四種組合',
    sub: '前提：至多 2 個錯誤',
    steps: () => 3,
    render: (s) => <CasesSlide s={s} />,
    takeaway: (
      <>
        <Ph>q 說錯了奇數還是偶數個，</Ph>
        <Ph>s 說錯在哪：</Ph>
        <Ph>四格各有一個動作</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          前提：至多 2 個錯。q = 1 → 奇數 → 剛好 1 個
          <ul className={NOTES_SUB}>
            <li>s ≠ 0：錯在前 {N} 位，翻 s 指出的位置</li>
            <li>
              s = 0：前 {N} 位沒錯 → {P0} 自己錯 → 翻 {P0}
            </li>
          </ul>
        </li>
        <li>
          → q = 0 → 0 個或 2 個
          <ul className={NOTES_SUB}>
            <li>s = 0：沒錯；s ≠ 0：2 個 → 回報，不修</li>
            <li>
              2 個錯一定 s ≠ 0：hᵢ + hⱼ ≠ 0（設計 ② 欄互不相同）；其中一個是 {P0} 時 s = hᵢ ≠ 0（設計 ①）
            </li>
            <li>
              不修：這種字離 {TIED} 個 codeword 都是距離 2，猜不出是哪一個
            </li>
          </ul>
        </li>
        <li>
          → 決策表：四種情況落在四個不同的格子
          <ul className={NOTES_SUB}>
            <li>
              錯 3 個以上不保證：例如翻位置 {TRIPLE.map((i) => i + 1).join('、')}（本身是 Hamming codeword）→ s = {isZeroVector(TRIPLE_RESULT.syndrome) ? '0' : '≠ 0'}、q = {TRIPLE_RESULT.overallParity} → 以為是 {P0} 錯
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 5 章：實例：SECDED 解碼器',
    sub: 's 說錯在哪，q 說錯了奇數還是偶數個',
    steps: () => 3,
    render: (s) => <DecoderSlide s={s} />,
    takeaway: (
      <>
        <Ph>錯 1 個修好，錯 2 個回報；</Ph>
        <Ph>錯 3 個以上不保證</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          收到 r：紅色是雜訊翻的位元，接收端看不到紅色
          <ul className={NOTES_SUB}>
            <li>
              一開始翻位置 {posList(PAIR)}：上一頁停在正中間的那個雙錯
            </li>
            <li>現場示範：點任何位元翻轉，翻 1 位、翻 {P0}、翻 2 位、翻 3 位都可以試</li>
          </ul>
        </li>
        <li>
          → 讀 {RE} 盞燈：s = H(r₁…r{N})ᵀ，q = r₁ + … + r{NE}
        </li>
        <li>
          → 套進四格：修好、回報，或錯 3 個以上時誤判
          <ul className={NOTES_SUB}>
            <li>
              同一個錯誤，Hamming({N},{K}) 只看 {R} 盞燈：翻 2 位時一律改錯
            </li>
            <li>
              SECDED：翻 1 位 {ONE8.ok}/{ONE8.total} 修好（含 {P0}），翻 2 位 {TWO8.detected}/{TWO8.total} 回報
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: `第 5 章：實際系統：伺服器記憶體 (${SERVER.nSecded},${SERVER.k})`,
    sub: `${SERVER.k} 位元資料 + ${SERVER_CHECK} 個檢查位元`,
    steps: () => 3,
    render: (s) => <ServerSlide s={s} />,
    takeaway: (
      <>
        <Ph>同樣的四格規則，</Ph>
        <Ph>
          {SERVER.k} 位只多 {SERVER_CHECK} 位（{pct(SERVER_CHECK / SERVER.k)}）
        </Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          伺服器記憶體每次讀寫 {SERVER.k} 個資料位元
          <ul className={NOTES_SUB}>
            <li>
              更正 1 個錯（第 4 章）：2ʳ ≥ {SERVER.k} + r + 1 → r = {SERVER.r}（2<sup>{SERVER.r - 1}</sup> = {2 ** (SERVER.r - 1)} &lt; {SERVER.k + SERVER.r}，2<sup>{SERVER.r}</sup> = {2 ** SERVER.r} ≥ {SERVER.k + SERVER.r + 1}）
            </li>
          </ul>
        </li>
        <li>
          → 縮短，再加 {P0}：({SERVER.parentN},{SERVER.parentK}) 只用 {SERVER.k} 個資料位置 → ({SERVER.n},{SERVER.k}) → ({SERVER.nSecded},{SERVER.k})
          <ul className={NOTES_SUB}>
            <li>
              不用的 {SERVER.shortenedBy} 個資料位置固定為 0、不送（第二課 2-12）
            </li>
            <li>
              不是完美碼：{2 ** SERVER.r} 種燈號只用到 {SERVER.n + 1} 種；判斷規則同本章四格
            </li>
            <li>實際晶片常用 Hsiao 碼這類變形，把 {P0} 併進檢查矩陣，參數與能力相同</li>
          </ul>
        </li>
        <li>
          → 代價：每 {SERVER.k} 位多 {SERVER_CHECK} 位 = {pct(SERVER_CHECK / SERVER.k)}；({NE},{K}) 是 {pct((NE - K) / K)}
          <ul className={NOTES_SUB}>
            <li>
              碼率 {pct(SERVER.rateSecded)}（({NE},{K}) 是 {pct(RATE8)}）
            </li>
            <li>
              所以 ECC 記憶體每次讀寫 {SERVER.nSecded} 個位元
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
];
