/**
 * Lesson 1 deck — chapter introductions for chapters 5, 6 and 7.
 *
 * Each intro states the chapter's question, walks through the reasoning and ends on the key result,
 * before the deck's existing figure / example slides. Every number shown is computed from the core.
 */
import { Fragment, type ReactNode } from 'react';
import {
  type Bit,
  type SecdedCase,
  H84,
  LAYOUT_84,
  allVectors,
  binomial,
  codewords74,
  codewords84,
  correctionCapability,
  decode74,
  encode74,
  encode84,
  flipBit,
  hammingBound,
  hammingDistance,
  isZeroVector,
  minimumDistance,
  rank,
  secdedDecode,
  sphereTerms,
  weightDistribution,
} from '../../core';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { M, Tex } from '../../components/Tex';
import { MatrixView } from '../../components/MatrixView';
import { useMessage } from '../../lib/store';

/* ------------------------------------------------------------------ */
/* Facts computed once from the core                                   */
/* ------------------------------------------------------------------ */

const C7 = codewords74().map((e) => e.codeword);
const C8 = codewords84().map((e) => e.codeword);
const MD7 = minimumDistance(C7);
const MD8 = minimumDistance(C8);
const HB7 = hammingBound(7, 4, 1);
const HB8 = hammingBound(8, 4, 1);
const TERMS7 = sphereTerms(7, 1);
const TERMS8 = sphereTerms(8, 1);
const RANK8 = rank(H84);

/** every 7-bit string is within distance 1 of exactly one Hamming(7,4) codeword */
const ONE_BALL_EACH = allVectors(7).every((w) => C7.filter((c) => hammingDistance(w, c) <= 1).length === 1);

/** all 2-error patterns of all 16 codewords, and how many of them land in ANOTHER codeword's radius-1 ball */
const TWO_ERR = (() => {
  let total = 0;
  let inOther = 0;
  C7.forEach((c, k) => {
    for (let i = 0; i < 7; i++)
      for (let j = i + 1; j < 7; j++) {
        const w = flipBit(flipBit(c, i), j);
        total++;
        if (C7.some((x, l) => l !== k && hammingDistance(w, x) <= 1)) inOther++;
      }
  });
  return { perWord: binomial(7, 2), total, inOther };
})();

const WD7 = weightDistribution(C7, 7);
const WD8 = weightDistribution(C8, 8);
const WEIGHTS = WD8.map((_, w) => w).filter((w) => (WD7[w] ?? 0) + WD8[w] > 0);
const minNonzeroWeight = (A: number[]) => A.findIndex((a, w) => w > 0 && a > 0);
const MINW7 = minNonzeroWeight(WD7);
const MINW8 = minNonzeroWeight(WD8);

/** 8-bit strings outside every radius-1 ball of Extended(8,4) (where a double error lands) */
const OUTSIDE8 = allVectors(8).filter((w) => C8.every((c) => hammingDistance(w, c) >= 2));
/** how many codewords each of those strings is at distance 2 from (the same number for all of them) */
const TIED = [...new Set(OUTSIDE8.map((w) => C8.filter((c) => hammingDistance(w, c) === 2).length))].join('／');

/** the 2×2 SECDED table, read off the real decoder: no error, single error at #5, error in P0, errors at #2 and #5 */
const BASE8 = encode84([1, 0, 1, 1]);
const DECISIONS = [[], [4], [7], [1, 4]].map((idx) => secdedDecode(idx.reduce<Bit[]>((w, i) => flipBit(w, i), BASE8)));
const caseAt = (sNonzero: boolean, q: Bit): SecdedCase | undefined => DECISIONS.find((r) => !isZeroVector(r.syndrome) === sNonzero && r.overallParity === q)?.case;

/** wording follows SECDED_ROWS in Presentation1.tsx */
const CASE_CELL: Record<SecdedCase, { label: string; cls: string }> = {
  'no-error': { label: '沒有錯', cls: 'border-emerald-300 bg-emerald-50 text-emerald-900' },
  'overall-corrected': { label: 'P0 自己錯了 → 翻轉 P0', cls: 'border-sky-300 bg-sky-50 text-sky-900' },
  'double-detected': { label: '兩個錯誤 → 只偵測，不修正', cls: 'border-amber-300 bg-amber-50 text-amber-900' },
  'single-corrected': { label: '單一錯誤 → 翻轉 s 指向的位置', cls: 'border-sky-300 bg-sky-50 text-sky-900' },
};

/* ------------------------------------------------------------------ */
/* Building blocks                                                     */
/* ------------------------------------------------------------------ */

type Tone = 'slate' | 'sky' | 'amber' | 'emerald' | 'rose' | 'parity' | 'overall';
const TONE: Record<Tone, { box: string; head: string }> = {
  slate: { box: 'bg-slate-50', head: 'text-slate-800' },
  sky: { box: 'bg-sky-50', head: 'text-sky-800' },
  amber: { box: 'bg-amber-50', head: 'text-amber-800' },
  emerald: { box: 'bg-emerald-50', head: 'text-emerald-800' },
  rose: { box: 'bg-rose-50', head: 'text-rose-800' },
  parity: { box: 'bg-parity-50', head: 'text-parity-700' },
  overall: { box: 'bg-overall-50', head: 'text-overall-700' },
};

/** One explanation block; hidden blocks keep their place so nothing moves when a step reveals them. */
function Box({ tone, title, show = true, children }: { tone: Tone; title: ReactNode; show?: boolean; children: ReactNode }) {
  return (
    <section className={`min-w-0 rounded-2xl p-5 transition-opacity duration-300 ${TONE[tone].box} ${show ? 'opacity-100' : 'invisible opacity-0'}`}>
      <h2 className={`mb-2 text-xl font-bold ${TONE[tone].head}`}>{title}</h2>
      <div className="space-y-2 text-lg text-slate-700">{children}</div>
    </section>
  );
}

function Bits({ bits, mark = [], markClass = 'text-rose-600', gapBefore }: { bits: readonly Bit[]; mark?: number[]; markClass?: string; gapBefore?: number }) {
  return (
    <span className="mono font-bold text-slate-900">
      {bits.map((b, i) => (
        <span key={i} className={`${mark.includes(i) ? markClass : ''} ${i === gapBefore ? 'ml-1.5' : ''}`}>
          {b}
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter 5: Hamming bound and perfect codes                           */
/* ------------------------------------------------------------------ */

function Ch5Question({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-slate-50 p-4 text-xl">
        長度 7 的二進位字串一共只有 <M>{`2^7 = ${HB7.rhs}`}</M> 個。要修正 t 個錯誤，每個 codeword 都需要一塊「地盤」：它錯了 t 個以內會變成的字串，都必須被解回它自己。地盤有多大？{HB7.rhs} 個字串裡最多放得下幾塊？
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Box tone="sky" title="① 漢明球：一塊地盤" show={s.step >= 1}>
          <Tex block>{'B(c,t) = \\{\\, x : d(x,c) \\le t \\,\\}'}</Tex>
          <p>所有和 c 最多差 t 個位元的長度 n 字串 x，也就是「c 錯了 t 個以內，可能變成的所有樣子」。</p>
          <p className="text-slate-600">它是有限個字串的集合，不是平面上的圓。</p>
        </Box>
        <Box tone="amber" title="② 體積：一塊地盤有幾個字串" show={s.step >= 2}>
          <Tex block>{'V_2(n,t) = |B(c,t)| = \\sum_{i=0}^{t} \\binom{n}{i}'}</Tex>
          <p>
            <M>{'\\binom{n}{i}'}</M>：從 n 個位置挑 i 個來錯的選法數。
          </p>
          <p>
            n = 7、t = 1：<M>{`V_2(7,1) = ${TERMS7.join(' + ')} = ${HB7.volume}`}</M>，就是 c 自己加上 {TERMS7[1]} 種單一錯誤。
          </p>
        </Box>
        <Box tone="emerald" title="③ Hamming Bound（球填充界）" show={s.step >= 3}>
          <p>
            兩顆球若共用一個字串，收到它就不知道該解成誰，所以球兩兩不相交（等價於第 4 章的 <M>{'d_{\\min} \\ge 2t+1'}</M>）。<M>{'2^k'}</M> 顆球、每顆 <M>{'V_2(n,t)'}</M> 個字串，全部要塞進 <M>{'2^n'}</M> 個字串裡：
          </p>
          <Tex block>{'2^k \\cdot V_2(n,t) \\le 2^n'}</Tex>
        </Box>
      </div>
    </div>
  );
}

function Ch5Perfect({ s }: { s: Stepper }) {
  const rel = HB7.equality ? '=' : HB7.satisfied ? '<' : '>';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Box tone="sky" title="代入 Hamming(7,4)">
        <p>n = 7、k = 4、t = 1：</p>
        <Tex block>{`2^{4} \\cdot V_2(7,1) = ${HB7.codewords} \\times ${HB7.volume} = ${HB7.lhs} ${rel} 2^{7}`}</Tex>
        <p>
          不等式兩邊<strong>剛好相等</strong>。{HB7.codewords} 顆球彼此不重疊（<M>{`d_{\\min} = ${MD7.dmin} \\ge 2\\cdot 1 + 1`}</M>），總大小又恰好等於整個空間。
        </p>
      </Box>
      <Box tone="emerald" title="完美碼（Perfect code）" show={s.step >= 1}>
        <p>
          等號成立 = 球恰好鋪滿空間：<strong>每一個 7 位元字串，都恰好離一個 codeword 距離 ≤ 1。</strong>
        </p>
        <p className="text-slate-600">窮舉 {HB7.rhs} 個字串：{ONE_BALL_EACH ? '每一個都恰好屬於 1 顆球 ✓' : '有字串不只屬於 1 顆球 ✗'}</p>
        <p>
          長度 7、能修 1 個錯的二元碼最多只有 {HB7.rhs} ÷ {HB7.volume} = {HB7.rhs / HB7.volume} 個 codeword：Hamming(7,4) 沒有任何浪費。
        </p>
      </Box>
      <Box tone="rose" title="代價：沒有空位留給「錯 2 個」" show={s.step >= 2}>
        <p>
          每個 codeword 錯 2 個有 <M>{`\\binom{7}{2} = ${TWO_ERR.perWord}`}</M> 種樣子，{HB7.codewords} 個 codeword 共 {HB7.codewords} × {TWO_ERR.perWord} = {TWO_ERR.total} 種，
          {TWO_ERR.inOther === TWO_ERR.total ? <strong>全部</strong> : <>其中 {TWO_ERR.inOther} 種</>}落在<strong>另一個</strong> codeword 的球裡：被「修」成錯的 codeword（誤更正），解碼器毫不知情。
        </p>
        <p className="font-semibold text-rose-800">所以 Hamming(7,4) 不能在修 1 個的同時偵測 2 個 → 第 6 章：多加 1 個位元。</p>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter 6: Extended Hamming(8,4)                                     */
/* ------------------------------------------------------------------ */

const DOUBLE_ERR = [2, 5]; // positions 3 and 6, the same pair the SECDED slide starts with

function Ch6Problem({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const r = DOUBLE_ERR.reduce<Bit[]>((w, i) => flipBit(w, i), c);
  const d = decode74(r);
  const wrongAfter = c.flatMap((b, i) => (d.corrected[i] !== b ? [i] : []));
  const c8 = encode84(message);
  const label = 'text-base text-slate-500';
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Box tone="rose" title="問題：2 個錯被默默改錯">
        <p>
          錯 2 個時 <M>{'s = h_i + h_j'}</M>：不是 0，而且一定等於 H 的<strong>另一欄</strong> <M>{'h_k'}</M>。解碼器以為只錯 1 個而翻轉第 k 位：錯誤變成 3 個，而且沒有人知道（誤更正）。
        </p>
        <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-2 rounded-xl bg-white/70 px-2 py-1.5">
          <span className={label}>送出 c</span>
          <Bits bits={c} />
          <span className={label}>收到 r</span>
          <span>
            <Bits bits={r} mark={DOUBLE_ERR} /> <span className={label}>位置 {DOUBLE_ERR.map((i) => i + 1).join('、')} 錯</span>
          </span>
          <span className={label}>解碼後</span>
          <span>
            <Bits bits={d.corrected} mark={wrongAfter} /> <span className={label}>改位置 {d.position}，錯 {wrongAfter.length} 個</span>
          </span>
        </div>
      </Box>
      <Box tone="overall" title="修法：整體同位位元 P0" show={s.step >= 1}>
        <p>每翻轉 1 個位元，1 的總數奇偶就變一次：錯 1 個奇偶改變，錯 2 個奇偶不變。所以再記一次「整體奇偶」：</p>
        <Tex block>{'P_0 = c_1 \\oplus c_2 \\oplus \\cdots \\oplus c_7'}</Tex>
        <p>放在第 8 位，8 個位元一定有偶數個 1；前 7 位和 Hamming(7,4) 完全一樣。</p>
        <p className="text-base">
          例：<Bits bits={c} /> → <Bits bits={c8} mark={[7]} markClass="text-overall-600" gapBefore={7} />
        </p>
      </Box>
      <Box tone="slate" title="H 多一列全 1" show={s.step >= 2}>
        <MatrixView matrix={H84} name={<M>{'H_8 ='}</M>} size="sm" colLabels={LAYOUT_84.map((p) => p.label)} rowLabels={['P1', 'P2', 'P4', '全']} highlightRows={[3]} rowHighlightClass="bg-overall-100 text-overall-700" />
        <p>原本的 H 補一個零欄（P0 不參加 P1、P2、P4 的檢查），再加一列全 1：8 個位元總和 = 0。</p>
        <p className="text-slate-600">
          <M>{`\\operatorname{rank} = ${RANK8}`}</M>，維度仍是 8 − {RANK8} = {8 - RANK8}：P0 不帶新資訊。
        </p>
      </Box>
    </div>
  );
}

function Ch6Distance({ s }: { s: Stepper }) {
  const t8 = correctionCapability(MD8.dmin);
  const cell = (A: number[], w: number, min: number, hi: string) => <td className={w === min ? `font-bold ${hi}` : ''}>{A[w] || '·'}</td>;
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Box tone="overall" title="為什麼 d_min 變成 4">
        <p>c 有奇數個 1 時 P0 = 1，偶數個時 P0 = 0。所以重量 3、7 的 codeword 各 +1，重量 0、4 的不變：</p>
        <table className="w-full text-center font-mono text-lg">
          <thead>
            <tr className="text-base text-slate-500">
              <th className="py-0.5 text-left font-sans font-normal">重量</th>
              {WEIGHTS.map((w) => (
                <th key={w} className="font-normal">
                  {w}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-overall-100">
              <td className="py-0.5 text-left font-sans text-base">(7,4)</td>
              {WEIGHTS.map((w) => (
                <Fragment key={w}>{cell(WD7, w, MINW7, 'text-rose-600')}</Fragment>
              ))}
            </tr>
            <tr className="border-t border-overall-100">
              <td className="py-0.5 text-left font-sans text-base">(8,4)</td>
              {WEIGHTS.map((w) => (
                <Fragment key={w}>{cell(WD8, w, MINW8, 'text-overall-700')}</Fragment>
              ))}
            </tr>
          </tbody>
        </table>
        <p>
          最小非零重量 {MINW7} → {MINW8}；線性碼的 d_min 就是最小非零重量，所以 <M>{`d_{\\min} = ${MD8.dmin}`}</M>。記作 <M>{'[n, k, d_{\\min}]'}</M>：<M>{`[7,4,${MD7.dmin}] \\to [8,4,${MD8.dmin}]`}</M>。
        </p>
      </Box>
      <Box tone="sky" title="換來：修 1 個，同時偵測 2 個" show={s.step >= 1}>
        <Tex block>{`d_{\\min} \\ge (\\text{修正數}) + (\\text{偵測數}) + 1`}</Tex>
        <p>
          要修 1 個、同時偵測 2 個：<M>{`d_{\\min} = ${MD8.dmin} \\ge 1 + 2 + 1`}</M>，剛好成立。
        </p>
        <p>
          <strong>錯 1 個：</strong>離原 codeword 1，離其他 ≥ 3 → 修回來。
        </p>
        <p>
          <strong>錯 2 個：</strong>離每個 codeword 都 ≥ 2 → 不在任何半徑 1 的球裡 → 知道有錯，但不修。
        </p>
      </Box>
      <Box tone="amber" title="付出：1 個位元" show={s.step >= 2}>
        <p>
          碼率 k/n：<M>{`\\tfrac{4}{7} \\approx ${(4 / 7).toFixed(3)} \\;\\to\\; \\tfrac{4}{8} = ${(4 / 8).toFixed(3)}`}</M>
        </p>
        <p>
          修正能力仍是 <M>{`t = \\lfloor (${MD8.dmin}-1)/2 \\rfloor = ${t8}`}</M>。
        </p>
        <p>不再是完美碼：每顆球有 {TERMS8.join(' + ')} = {HB8.volume} 個字串，</p>
        <Tex block>{`${HB8.codewords} \\times ${HB8.volume} = ${HB8.lhs} < ${HB8.rhs} = 2^8`}</Tex>
        <p>
          不屬於任何球的 {HB8.rhs} − {HB8.lhs} = {OUTSIDE8.length} 個字串，正是錯 2 個時會落進去的地方：偵測用的空間。
        </p>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Chapter 7: SECDED                                                   */
/* ------------------------------------------------------------------ */

function Ch7Signals({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Box tone="slate" title="SECDED 是什麼">
        <p>
          <strong>S</strong>ingle <strong>E</strong>rror <strong>C</strong>orrection, <strong>D</strong>ouble <strong>E</strong>rror <strong>D</strong>etection：修 1 個、偵測 2 個。
        </p>
        <p>
          ECC 記憶體（伺服器 DRAM）、快取都在用：單一位元錯誤最常見 → 自動修好；雙位元錯誤較少見，但一旦發生必須<strong>回報</strong>，絕不能默默交出錯誤資料。
        </p>
        <p className="text-slate-600">
          Extended(8,4) 的 <M>{`d_{\\min} = ${MD8.dmin}`}</M> 剛好做得到。
        </p>
      </Box>
      <Box tone="parity" title="訊號 1：Syndrome s" show={s.step >= 1}>
        <Tex block>{'s = H\\,(r_1,\\dots,r_7)^T'}</Tex>
        <p>只看前 7 個位元，和第 3 章一樣：只錯 1 個、且在位置 1–7 時，s 就是錯誤位置的二進位。</p>
        <p>
          s 不看 P0：只有 P0 錯時，<M>{'s = 0'}</M>。
        </p>
        <p className="text-slate-600">
          但 s 分不出錯了 1 個還是 2 個：錯 2 個時 <M>{'s'}</M> 也不是 0，一樣指向某個位置（第 6 章的誤更正）。
        </p>
      </Box>
      <Box tone="overall" title="訊號 2：整體同位 q" show={s.step >= 2}>
        <Tex block>{'q = r_1 + r_2 + \\cdots + r_8'}</Tex>
        <p>codeword 的 8 個位元有偶數個 1，每翻轉 1 個位元奇偶就變一次：</p>
        <Tex block>{'q = \\mathrm{wt}(e) \\bmod 2'}</Tex>
        <p>
          <strong>q = 1 ⇔ 奇數個位元被翻轉。</strong>q 說「錯了奇數還是偶數個」，s 說「錯在哪裡」。
        </p>
      </Box>
    </div>
  );
}

function DecisionGrid() {
  const head = 'grid place-items-center text-lg font-semibold text-slate-600';
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
      <div />
      <div className={head}>
        q = 0<span className="text-sm font-normal text-slate-500">偶數個錯</span>
      </div>
      <div className={head}>
        q = 1<span className="text-sm font-normal text-slate-500">奇數個錯</span>
      </div>
      {[false, true].map((sNonzero) => (
        <Fragment key={String(sNonzero)}>
          <div className={`${head} whitespace-nowrap pr-1`}>{sNonzero ? 's ≠ 0' : 's = 0'}</div>
          {([0, 1] as Bit[]).map((q) => {
            const k = caseAt(sNonzero, q);
            const info = k ? CASE_CELL[k] : null;
            return (
              <div key={q} className={`grid min-h-[6rem] place-items-center rounded-xl border-2 px-2 py-2 text-center text-lg font-semibold leading-snug ${info?.cls ?? 'border-slate-200'}`}>
                {info?.label ?? '—'}
              </div>
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

function Ch7Cases({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1fr_1.4fr]">
      <Box tone="sky" title="q = 1：恰好 1 個錯">
        <p>奇數個錯、又至多 2 個 → 只能是 1 個。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <M>{'s \\neq 0'}</M>：錯在前 7 位，s 指出位置 → 翻轉它。
          </li>
          <li>
            <M>{'s = 0'}</M>：前 7 位沒錯，錯的是 P0 自己 → 翻轉 P0。
          </li>
        </ul>
        <p className="text-slate-600">單一錯誤不論在哪一位，都修得好。</p>
      </Box>
      <Box tone="amber" title="q = 0：0 個或 2 個錯" show={s.step >= 1}>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <M>{'s = 0'}</M>：沒有錯。
          </li>
          <li>
            <M>{'s \\neq 0'}</M>：2 個錯 → 回報，不修正。
          </li>
        </ul>
        <p>
          2 個錯一定讓 s ≠ 0：都在前 7 位時 <M>{'s = h_i + h_j \\neq 0'}</M>（H 的第 i、j 欄不同）；其中一個是 P0 時 <M>{'s = h_i \\neq 0'}</M>。
        </p>
        <p className="text-slate-600">不修正，是因為這種字串離 {TIED} 個 codeword 都是距離 2，猜不出是哪一個。</p>
      </Box>
      <Box tone="slate" title="決策表" show={s.step >= 2}>
        <DecisionGrid />
        <p className="text-base text-slate-600">錯 3 個以上不在保證範圍：可能被當成 1 個錯而改錯。</p>
      </Box>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exports (deck order)                                                */
/* ------------------------------------------------------------------ */

export const INTRO_CH5_SLIDES: DeckSlide<null>[] = [
  { title: '第 5 章：Hamming Bound 與完美碼', sub: '7 個位元的空間，最多能放幾個 codeword？', steps: () => 4, render: (s) => <Ch5Question s={s} /> },
  { title: '第 5 章：Hamming(7,4) 是完美碼', sub: '代入 Hamming Bound：16 × 8 = 128，等號成立', steps: () => 3, render: (s) => <Ch5Perfect s={s} /> },
];

export const INTRO_CH6_SLIDES: DeckSlide<null>[] = [
  { title: '第 6 章：Extended Hamming(8,4)', sub: '錯了 2 個時，能不能至少「發現」？', steps: () => 3, render: (s) => <Ch6Problem s={s} /> },
  { title: '第 6 章：d_min 從 3 變成 4', sub: '多 1 個位元，換來什麼、付出什麼？', steps: () => 3, render: (s) => <Ch6Distance s={s} /> },
];

export const INTRO_CH7_SLIDES: DeckSlide<null>[] = [
  { title: '第 7 章：SECDED', sub: '修 1 個、偵測 2 個：解碼器要看哪兩個訊號？', steps: () => 3, render: (s) => <Ch7Signals s={s} /> },
  { title: '第 7 章：(s, q) 的四種組合', sub: '前提：至多 2 個錯誤', steps: () => 3, render: (s) => <Ch7Cases s={s} /> },
];
