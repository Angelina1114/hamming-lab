import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Layers, Minus, Plus, XCircle } from 'lucide-react';
import {
  type Bit,
  DEFAULT_MESSAGE,
  H74,
  K4,
  LAYOUT_74,
  N7,
  PARITY_CHECKS,
  allVectors,
  bitsToInt,
  bitsToString,
  codewords74,
  column,
  codewords84,
  correctionCapability,
  decode74,
  detectionCapability,
  differingPositions,
  distanceMatrix,
  doubleErrorLandings,
  flipBit,
  flipPath,
  hammingBound,
  hammingDistance,
  hammingK,
  hammingN,
  hammingParams,
  isZeroVector,
  knownPerfectFamily,
  minimumDistance,
  nearestCodewords,
  parseBits,
  partitionByNearest,
  simulate74,
  sphereTerms,
  syndrome74,
  syndromeToPosition,
  vecAdd,
  vecEquals,
  weight,
  weightDistribution,
  zeroVector,
} from '../core';
import { Tex, M } from '../components/Tex';
import { BitRow, BitString } from '../components/Bits';
import { Bars } from '../components/Bars';
import { DistanceLine } from '../components/DistanceLine';
import { PathWalk, WarningLamps } from '../components/PathWalk';
import { BallDiagram, CubeBall, PackingDiagram } from '../components/BoundFigures';
import { RelatedLinks } from '../components/alg/Links';
import { Callout, Card, Derivation, Expandable, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Segmented, Stage, Stat } from '../components/Lesson';

const ID = 'distance';

/* ------------------------------------------------------------------ */
/* Numbers on this page (computed from the core, never typed)          */
/* ------------------------------------------------------------------ */

/** 7 positions, 4 data bits, ℓ = n − k = 3 parity bits = 3 lamps */
const N = N7;
const K = K4;
const L = H74.length;
/** 3 lamps: 2³ states, all dark = nothing to flip, the other 7 each name a position */
const STATES = 2 ** L;
const PATTERNS = STATES - 1;

const CODE = codewords74();
const WORDS = CODE.map((e) => e.codeword);
const MD = minimumDistance(WORDS);
const D_MIN = MD.dmin;
/** guaranteed correction ⌊(d_min − 1)/2⌋ and detection d_min − 1 */
const T = correctionCapability(D_MIN);
const DETECT = detectionCapability(D_MIN);
/** the bound for Hamming(7,4): 2ᵏ(1 + n) = 16 × 8 = 128 = 2ⁿ */
const HB = hammingBound(N, K, T);
const PARTITION = partitionByNearest(WORDS, N);
/** the long code of the same family (chapter 2's H design ③ points here) */
const LONG = hammingParams(7);

/**
 * What chapter 3's decoder does with every error of weight w. The outcome never depends on the
 * codeword sent (s = Heᵀ), so the all-zero codeword stands in for all 16.
 */
function decoderOutcomes(w: number) {
  const runs = allVectors(N)
    .filter((e) => weight(e) === w)
    .map((e) => simulate74(zeroVector(N), e));
  return { total: runs.length, ok: runs.filter((o) => o.success).length, mis: runs.filter((o) => o.miscorrection).length };
}
const ONE = decoderOutcomes(1);
const TWO = decoderOutcomes(2);

/** the lamps and the nearest-codeword guess agree on every received word */
const LAMPS_ARE_NEAREST = allVectors(N).every((w) => {
  const nr = nearestCodewords(w, WORDS);
  return nr.unique && vecEquals(WORDS[nr.nearest[0]], decode74(w).corrected);
});

/**
 * The A → B path (PathWalk computes the same pair): A = codeword of the default message, B = codeword of 1111;
 * d(A, B) = d_min (pinned in core.test). Chapter 4 keeps this fixed pair; it does not follow the shared message.
 */
const A_IDX = CODE.findIndex((e) => vecEquals(e.message, DEFAULT_MESSAGE));
const B_IDX = CODE.findIndex((e) => e.message.every((b) => b === 1));
const A = WORDS[A_IDX];
const B = WORDS[B_IDX];
const D_AB = hammingDistance(A, B);
const AB_DIFF = differingPositions(A, B).map((i) => i + 1);

/** all double errors: Hamming(7,4) puts every one next to another codeword, Extended(8,4) none */
const DOUBLE = doubleErrorLandings(WORDS);
const DOUBLE8 = doubleErrorLandings(codewords84().map((e) => e.codeword));

/** the minimum-weight shortcut: weight distribution, and the three columns h₁ + h₂ + h₃ = 0 behind the lightest codeword */
const WEIGHTS = weightDistribution(WORDS, N);
const MIN_WEIGHT = WEIGHTS.findIndex((a, w) => w > 0 && a > 0);
const TRIPLE = [1, 2, 3];
const TRIPLE_ZERO = isZeroVector(TRIPLE.map((j) => column(H74, j - 1)).reduce((a, b) => vecAdd(a, b)));

/** a codeword and its 7 single-flip neighbours: the 8 words the receiver can get when at most 1 bit flips */
const received = (c: readonly Bit[]): Bit[][] => [[...c], ...c.map((_, i) => flipBit(c, i))];
/** how many codewords light all 8 lamp states with their 8 received words */
const ALL_STATES_USED = WORDS.filter((c) => new Set(received(c).map((w) => bitsToString(syndrome74(w)))).size === STATES).length;

/** the Hamming family in lamp language: ℓ lamps, 2^ℓ states, n = 2^ℓ − 1 positions, all states used */
const FAMILY = [2, 3, 4, 5, 6, 7].map((l) => {
  const n = hammingN(l);
  const k = hammingK(l);
  return { l, states: 2 ** l, n, k, full: hammingBound(n, k, 1).equality };
});

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
/** reading the lamps as a binary number: P4 P2 P1, the most significant first */
const READ = [...LAMP.keys()].reverse();
const binText = (bits: readonly Bit[]) => `${READ.map((i) => bits[i]).join('')}₂`;

/* ------------------------------------------------------------------ */
/* Small pictures                                                      */
/* ------------------------------------------------------------------ */

/** One codeword and its 8 received words (0 or 1 flip): 8 different lamp states, one action each. */
function ReceivedOutcomes() {
  const [sel, setSel] = useState(A_IDX);
  const center = WORDS[sel];
  const rows = received(center);
  const distinct = new Set(rows.map((w) => bitsToString(syndrome74(w)))).size;
  return (
    <Card title={`送出一個 codeword，最多翻 ${T} 位：${rows.length} 種接收結果`}>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <span className="mr-1 text-xs text-slate-500">送出 m =</span>
        {CODE.map((e) => (
          <button
            key={e.index}
            type="button"
            aria-pressed={e.index === sel}
            onClick={() => setSel(e.index)}
            className={`chip border font-mono ${e.index === sel ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}
          >
            {e.message.join('')}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto overflow-y-hidden">
        <table className="w-full min-w-[300px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-2">收到的 r</th>
              <th className="pr-2">
                {L} 盞警示燈（讀成 {READ.map((i) => LAMP[i]).join('')}）
              </th>
              <th>接收端</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => {
              const pos = differingPositions(w, center);
              const s = syndrome74(w);
              return (
                <tr key={bitsToString(w)} className="border-t border-slate-100">
                  <td className="py-1 pr-2">
                    <BitString bits={w} className="font-semibold" highlight={(j) => (pos.includes(j) ? 'text-rose-600 font-bold' : undefined)} />
                  </td>
                  <td className="pr-2">
                    <span className="inline-flex flex-wrap items-center gap-x-2">
                      <WarningLamps s={s} size="sm" />
                      <span className="font-mono text-xs text-slate-500">{binText(s)}</span>
                    </span>
                  </td>
                  <td className={`text-xs font-semibold ${pos.length === 0 ? 'text-emerald-700' : 'text-slate-700'}`}>{isZeroVector(s) ? '不動' : `翻位置 ${syndromeToPosition(s)}`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-slate-700">
        {rows.length} 種接收結果點亮 <strong>{distinct} 種不同燈號</strong>，沒有重複也沒有剩下；{ALL_STATES_USED}/{WORDS.length} 個 codeword 都是。
      </p>
    </Card>
  );
}

/** a link to another chapter of Lesson 1, in the page's link style */
function ChLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a href={`#/${to}`} className="font-semibold text-overall-700 hover:underline">
      {children}
    </a>
  );
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

export default function M4Limits() {
  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          第 3 章：翻 {T} 位修得好，翻 2 位會造成 miscorrection。這一章找出分界在哪，以及 {L} 盞燈的極限。
        </p>
      </ModuleHeader>
      <KeyPoint>
        雜訊每翻一位，就把 received word 往前推一步：<M>{`d_{\\min} = ${D_MIN}`}</M> 保證翻 {T} 位修得回來，而 {L} 盞燈的 {STATES} 種狀態剛好用完。
      </KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="第 3 章留下的兩個問題">
          <Card>
            <div className="grid grid-cols-1 items-center gap-4 lg:grid-cols-2">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Stat label={`翻 ${T} 位（全部 ${ONE.total} 種）`} value={`${ONE.ok}/${ONE.total}`} sub="修好" tone="emerald" />
                <Stat label={`翻 2 位（全部 ${TWO.total} 種）`} value={`${TWO.mis}/${TWO.total}`} sub="Miscorrection" tone="rose" />
              </div>
              <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                <li>
                  <strong>能保證什麼？</strong>分界線在哪，由什麼決定？
                </li>
                <li>
                  <strong>能做多長？</strong>位置再多，{L} 盞燈還分得出是哪一位錯嗎？
                </li>
              </ul>
            </div>
          </Card>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="接收端猜最近的 codeword：從 A 走到 B">
          <Card>
            <div className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm leading-relaxed text-slate-700 lg:grid-cols-2">
              <div className="space-y-2">
                <p>
                  接收端只看到 r。雜訊翻得越少越常見，所以它猜<strong>離 r 最近的 codeword</strong>，稱為 <strong>nearest-codeword decoding（最近 codeword 解碼）</strong>。
                </p>
                <p className="text-slate-600">
                  第 3 章的 {L} 盞燈就是它的快速版：全部 {2 ** N} 個 received word 都驗證過{LAMPS_ARE_NEAREST ? ' ✓' : ' ✗'}（逐一比較的工具在進階）。
                </p>
              </div>
              <div className="space-y-2">
                <p>
                  兩個字串的 <strong>Hamming distance（漢明距離）</strong>是它們有幾個位置不同，也就是雜訊至少要翻幾位。x + y 的 1 正好落在不同的位置：
                </p>
                <Tex block>{'d(x,y) = \\left|\\{\\, j : x_j \\neq y_j \\,\\}\\right| = \\mathrm{wt}(x+y)'}</Tex>
              </div>
            </div>
          </Card>
          <PathWalk
            messageA={CODE[A_IDX].message}
            messageB={CODE[B_IDX].message}
            intro={
              <>
                A = {CODE[A_IDX].message.join('')} 的 codeword，B = {CODE[B_IDX].message.join('')} 的 codeword，差 {D_AB} 位（位置 {AB_DIFF.join('、')}）。雜訊從 A 出發，每翻一位走一步。
              </>
            }
          />
          <Callout kind="info" title={`分界在中點 ${D_AB / 2} 步`}>
            <p>
              翻 {T} 位仍離 A 最近，修得回來；翻 {T + 1} 位已過中線，燈會亮，但硬要更正就變成 B：miscorrection。
            </p>
          </Callout>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title={`Minimum distance（最小距離）${D_MIN} 與 ${L} 盞燈的極限`}>
          <h3 className="text-base font-bold text-slate-800">
            能保證什麼：最近的兩個 codeword 也隔 {D_MIN} 步
          </h3>
          <LabGrid
            main={
              <Card>
                <div className="space-y-2 text-sm leading-relaxed text-slate-700">
                  <p>
                    A、B 不是特例：{WORDS.length} 個 codeword 兩兩比較（{MD.pairsChecked} 對），最近的一對也差 {D_MIN} 位，稱為 <strong>minimum distance</strong>：
                  </p>
                  <Tex block>{`d_{\\min} = \\min_{c \\neq c'} d(c, c') = ${D_MIN}`}</Tex>
                  <p>
                    任何 codeword 翻 {T} 位，離原本 {T}、離其他至少 {D_MIN} − {T} = {D_MIN - T}，所以一定修得回來。
                  </p>
                  <p className="text-slate-600">
                    只偵測的話，翻 1 到 {DETECT} 位燈都會亮：<M>{`d_{\\min} - 1 = ${DETECT}`}</M>。一般的 <M>{'d_{\\min}'}</M> 見進階。
                  </p>
                </div>
              </Card>
            }
            aside={
              <Card title={`${D_MIN} 步從哪來`}>
                <p className="text-sm leading-relaxed text-slate-700">
                  H 的設計 ① 沒有全 0 欄、② 沒有兩欄相同：翻 1、2 位時燈一定亮。燈全暗才是 codeword，所以 codeword 之間至少隔 {D_MIN} 步。
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  見<ChLink to="matrix">第 2 章</ChLink>；用 H 的欄讀出 <M>{'d_{\\min}'}</M>，見進階「Linear code 的捷徑」。
                </p>
              </Card>
            }
          />

          <h3 className="pt-4 text-base font-bold text-slate-800">
            能做多長：perfect code（完美碼），{STATES} 種燈號剛好用完
          </h3>
          <LabGrid
            main={
              <Card>
                <div className="space-y-2 text-sm leading-relaxed text-slate-700">
                  <p>
                    更正 1 個錯，燈號要分出 n + 1 種情況：沒錯，或錯在 n 個位置之一。ℓ 盞燈（<M>{'\\ell = n - k'}</M> 個 parity bit）只有 <M>{'2^{\\ell}'}</M> 種亮法，所以
                  </p>
                  <Tex block>{'\\underbrace{2^{\\ell}}_{\\ell\\text{ 盞燈的狀態數}} \\;\\ge\\; \\underbrace{n + 1}_{\\text{要分辨的情況數}}'}</Tex>
                  <p className="text-slate-600">
                    <ChLink to="encode">第 1 章</ChLink>、<ChLink to="matrix">第 2 章 H 的設計 ③</ChLink>已經數過，這裡寫成不等式。
                  </p>
                  <p>
                    這是更正 1 個錯的極限，教科書稱為 <strong>Hamming bound</strong>：
                  </p>
                  <Tex block>{'2^{k}(1 + n) \\le 2^{n} \\iff 1 + n \\le 2^{n-k} = 2^{\\ell}'}</Tex>
                  <p className="text-slate-600">一般形式與 Hamming ball（漢明球）見進階。</p>
                  <p>
                    Hamming({N},{K})：<M>{`2^{${L}} = ${STATES} = ${N} + 1`}</M>，等號成立。
                  </p>
                </div>
              </Card>
            }
            aside={
              <Card title="Hamming code 家族：每多 1 盞燈，長度約翻倍">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th className="py-1 pr-2">ℓ 盞燈</th>
                        <th className="pr-2">
                          <M>{'2^{\\ell}'}</M> 種燈號
                        </th>
                        <th className="pr-2">
                          <M>{'n = 2^{\\ell} - 1'}</M>
                        </th>
                        <th className="pr-2">
                          <M>{'k = n - \\ell'}</M>
                        </th>
                        <th>燈號全部用到</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {FAMILY.map((f) => (
                        <tr key={f.l} className={`border-t border-slate-100 ${f.l === L ? 'bg-emerald-50 font-semibold' : ''}`}>
                          <td className="py-1 pr-2">{f.l}</td>
                          <td className="pr-2">{f.states}</td>
                          <td className="pr-2">{f.n}</td>
                          <td className="pr-2">{f.k}</td>
                          <td className={`font-sans text-xs ${f.full ? 'text-emerald-700' : 'text-rose-700'}`}>{f.full ? `✓ ${f.states} = ${f.n} + 1` : '✗'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  {LONG.m} 盞燈保護 {LONG.n} 個位置，其中 {LONG.k} 個是資料；第二課 2-12 把 ℓ 記作 m。
                </p>
              </Card>
            }
          />
          <LabGrid
            main={<ReceivedOutcomes />}
            aside={
              <>
                <Card title="等號成立 = perfect code">
                  <p className="text-sm leading-relaxed text-slate-700">
                    等號成立的 code 稱為 <strong>perfect code</strong>：{HB.codewords} 個 codeword × {HB.volume} 種接收結果 = {HB.lhs}，正是全部 <M>{`2^{${N}}`}</M> 個 {N} 位元字串，{PARTITION.isPartition ? '每個恰好出現一次 ✓' : '✗ 有重複或遺漏'}。
                  </p>
                </Card>
                <Callout kind="warning" title="代價：perfect 不代表什麼錯都修得好">
                  <p>
                    翻 2 位時，亮的是兩欄之和，只能是 {PATTERNS} 種「翻位置 j」之一：沒有一種燈號留給「錯了兩個」。decoder 照著翻，{TWO.mis}/{TWO.total} 都是 miscorrection。
                  </p>
                </Callout>
              </>
            }
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title={`修 ${T} 位的保證，${STATES} 種燈號剛好用完`}>
          <Callout kind="key" title="結論">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>能保證什麼</strong>：codeword 之間至少隔 <M>{`d_{\\min} = ${D_MIN}`}</M> 步，翻 {T} 位一定修得回來。
              </li>
              <li>翻 {T + 1} 位燈會亮，但最近的已經是別的 codeword：硬要更正就是 miscorrection。</li>
              <li>
                <strong>能做多長</strong>：更正 1 個錯需要 <M>{'2^{\\ell} \\ge n + 1'}</M>，{L} 盞燈最多保護 {PATTERNS} 個位置。
              </li>
              <li>Hamming({N},{K}) 剛好等號成立（perfect code），沒有燈號留給「錯了兩個」→ 第 5 章 SECDED 多一盞燈。</li>
            </ul>
          </Callout>
          <Misconceptions
            items={[
              {
                wrong: (
                  <>
                    <M>{'2^{\\ell} \\ge n + 1'}</M> 是任何 code 的長度上限。
                  </>
                ),
                right: '它只管更正 1 個錯。只偵測不必分出位置，code 可以更長；要修更多錯，上限更緊（見進階）。',
              },
            ]}
          />
          <Card>
            <RelatedLinks
              title="延伸"
              links={[
                { to: 'secded', text: '多 1 個位元，錯 2 位就能被偵測' },
                { to: 'l2-9', text: '兩個錯誤一定造成 miscorrection：原因與窮舉表' },
                { to: 'l2-12', text: '更長的 Hamming code 與 shortened code（縮短碼）' },
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
/* 進階 (collapsed): the full distance toolkit, Hamming spheres and the general bound */
/* ------------------------------------------------------------------ */

function Advanced() {
  return (
    <section id={`${ID}-advanced`} className="scroll-mt-28 space-y-4 border-t border-slate-200 pt-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="chip border border-slate-300 bg-white text-slate-700">
          <Layers className="h-3.5 w-3.5" />
          進階 <span className="opacity-60">Advanced</span>
        </span>
        <h2 className="text-lg font-bold text-slate-900 sm:text-xl">Distance 與 Hamming bound 的完整工具</h2>
      </div>
      <p className="text-sm text-slate-600">主線只用一條路和 {L} 盞燈。這裡收著完整的 distance 工具、Hamming ball，以及要更正 t 個錯時的 Hamming bound。</p>

      <h3 className="pt-2 text-base font-bold text-slate-800">Distance 的完整工具</h3>
      <div className="space-y-2">
        <Expandable title={`錯 2 位的精確情形：${DOUBLE.total} 種全部落在別人旁邊`}>
          <DoubleErrorFact />
        </Expandable>
        <Expandable title="計算任兩個字串的 distance">
          <DistanceCalculator />
        </Expandable>
        <Expandable title={`${WORDS.length} 個 codeword 彼此的 distance：路徑、distance 分佈與 distance 矩陣`}>
          <CodewordExplorer />
        </Expandable>
        <Expandable title={`Nearest-codeword decoding：和 ${WORDS.length} 個 codeword 一一比較`}>
          <NearestDecoder />
        </Expandable>
        <Expandable
          title={
            <>
              一般的 <M>{'d_{\\min}'}</M>：保證修正 t 個、偵測 <M>{'d_{\\min} - 1'}</M> 個
            </>
          }
        >
          <DminSlider />
        </Expandable>
        <Expandable
          title={
            <>
              定理證明：<M>{'d_{\\min} \\ge 2t+1'}</M> ⇒ nearest-codeword decoding 可修正 t 個錯誤
            </>
          }
        >
          <p>
            設送出 <M>c</M>、收到 <M>r</M>，錯誤數 <M>{'\\le t'}</M>，所以 <M>{'d(r,c) \\le t'}</M>。對任何其他 codeword <M>{"c'"}</M>，由 triangle inequality：
          </p>
          <Tex block>{"d(r,c') \\ge d(c,c') - d(r,c) \\ge (2t+1) - t = t+1 > t \\ge d(r,c)."}</Tex>
          <p>所以 <M>c</M> 是唯一的最近 codeword。∎</p>
        </Expandable>
        <Expandable
          title={
            <>
              Linear code 的捷徑：<M>{'d_{\\min}'}</M> = 最小非零 codeword weight
            </>
          }
        >
          <p>
            因為 <M>{"d(c,c') = \\mathrm{wt}(c+c')"}</M> 而 <M>{"c+c'"}</M> 也是 codeword，只要檢查 {WORDS.length - 1} 個非零 codeword 的 weight，不用比較 {MD.pairsChecked} 對。Hamming(7,4) 的 weight distribution（重量分佈）：
            {WEIGHTS.flatMap((a, w) => (a ? [`${a} 個 weight ${w}`] : [])).join('、')}；最小非零 weight = {MIN_WEIGHT} = <M>{'d_{\\min}'}</M>。
          </p>
          <p>
            用 H 來看：<M>{'Hc^{T}'}</M> 是把 c 裡「是 1 的位置」那幾欄加起來，所以有 weight w 的 codeword ⇔ H 有 w 欄加起來 = 0。沒有全 0 的欄（H 的設計 ①）排除 weight 1，沒有兩欄相同（H 的設計 ②）排除 weight 2，而 <M>{`h_${TRIPLE.join(' + h_')} ${TRIPLE_ZERO ? '=' : '\\neq'} 0`}</M> 給出 weight {TRIPLE.length}：<M>{`d_{\\min} = ${D_MIN}`}</M>。
          </p>
        </Expandable>
      </div>

      <h3 className="pt-2 text-base font-bold text-slate-800">Hamming ball 與 Hamming bound 的一般形式</h3>
      <div className="space-y-2">
        <Expandable title="Hamming ball、ball 的 volume（體積）與一般形式 2ᵏ · V₂(n,t) ≤ 2ⁿ">
          <BallFigures />
        </Expandable>
        <Expandable title="調整 n、k、t，檢查 Hamming bound">
          <BoundExplorer />
        </Expandable>
        <Expandable title="真正的 2ⁿ 個字串分組：Hamming(7,4) 的 128 個、Extended(8,4) 的 256 個">
          <PartitionView />
        </Expandable>
        <Expandable title="Ball 不重疊的證明">
          <p>
            若 <M>{"x \\in \\mathrm{Ball}(c,1)\\cap \\mathrm{Ball}(c',1)"}</M>，則由 triangle inequality <M>{"d(c,c') \\le d(c,x) + d(x,c') \\le 2"}</M>，與 <M>{`d_{\\min} = ${D_MIN}`}</M> 矛盾。
          </p>
        </Expandable>
      </div>
    </section>
  );
}

function DoubleErrorFact() {
  return (
    <>
      <p>
        主線的 A → B 路徑說翻 2 位「可能」跑到別人那邊：光靠 <M>{`d_{\\min} = ${D_MIN}`}</M>，只保證得了這麼多。對 Hamming(7,4)，其實是「一定」：{WORDS.length} 個 codeword 各有 <M>{`\\binom{${N}}{2} = ${DOUBLE.perWord}`}</M> 種雙錯，共 {WORDS.length} × {DOUBLE.perWord} = {DOUBLE.total} 種；全部試過，每一個 received word 和<strong>另一個</strong> codeword 的 distance 都是 1（{DOUBLE.nearOther}/{DOUBLE.total}）。
      </p>
      <p>
        原因是 perfect code：每一個 {N} 位元字串都恰好離某個 codeword ≤ 1。翻 2 位的字離原本的 codeword 是 2，所以離它只有 1 的，一定是別人。不論用燈號還是比 distance，decoder 都會把它改成那個別人：雙錯一律造成 miscorrection（第 3 章的 {TWO.mis}/{TWO.total}）。
      </p>
      <p className="text-slate-600">
        不是每個 code 都這樣，extended Hamming code（延伸 Hamming 碼）就不同：Extended(8,4) 的 {DOUBLE8.total} 種雙錯裡，落在別人 distance 1 之內的有 {DOUBLE8.nearOther} 種。它們離每個 codeword 都至少 2，所以只能偵測、不會造成 miscorrection（第 5 章）。
      </p>
    </>
  );
}

/* ---------------- distance toolkit ---------------- */

/** sequential single-hue ramp for distances 0..7 */
const distColor = (d: number) => {
  const light = 97 - d * 9.5;
  return { background: `hsl(224 76% ${light}%)`, color: light < 62 ? '#fff' : '#1e293b' };
};

function DistanceCalculator() {
  const [x, setX] = useState<Bit[]>(parseBits('1011101'));
  const [y, setY] = useState<Bit[]>(parseBits('1001001'));
  const diff = differingPositions(x, y);
  const resize = (delta: number) => {
    const n = Math.min(12, Math.max(3, x.length + delta));
    const fit = (v: Bit[]) => Array.from({ length: n }, (_, i) => (v[i] ?? 0) as Bit);
    setX(fit(x));
    setY(fit(y));
  };
  return (
    <LabGrid
      main={
        <Card
          title="點擊位元修改 x、y"
          actions={
            <>
              <span className="text-xs text-slate-500">長度 n = {x.length}</span>
              <button className="btn-ghost !p-1" onClick={() => resize(-1)} aria-label="縮短">
                <Minus className="h-3 w-3" />
              </button>
              <button className="btn-ghost !p-1" onClick={() => resize(1)} aria-label="加長">
                <Plus className="h-3 w-3" />
              </button>
              <ResetButton
                onClick={() => {
                  setX(parseBits('1011101'));
                  setY(parseBits('1001001'));
                }}
              />
            </>
          }
        >
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="w-6 font-serif italic">x</span>
              <BitRow bits={x} plain size="sm" onToggle={(i) => setX(flipBit(x, i))} states={x.map((_, i) => (diff.includes(i) ? 'diff' : 'normal'))} />
            </div>
            <div className="flex items-center gap-3">
              <span className="w-6 font-serif italic">y</span>
              <BitRow bits={y} plain size="sm" onToggle={(i) => setY(flipBit(y, i))} states={y.map((_, i) => (diff.includes(i) ? 'diff' : 'normal'))} />
            </div>
            <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
              <span className="w-6 text-sm">x+y</span>
              <BitRow bits={vecAdd(x, y)} plain size="sm" showPositions={false} states={vecAdd(x, y).map((b) => (b ? 'diff' : 'muted'))} />
            </div>
          </div>
        </Card>
      }
      aside={
        <>
          <Stat label={<M>{'d(x,y)'}</M>} value={diff.length} sub={`不同的位置：${diff.map((i) => i + 1).join(', ') || '無'}`} tone="indigo" />
          <Derivation
            steps={[
              { title: '逐位比較', body: <p>紫色標示 x 與 y 不同的位置：{diff.map((i) => i + 1).join(', ') || '（無）'}。</p> },
              { title: '用 GF(2) 加法', body: <Tex block>{`x + y = ${vecAdd(x, y).join('')}`}</Tex> },
              { title: '數 1 的個數', body: <Tex block>{`d(x,y) = \\mathrm{wt}(x+y) = ${weight(vecAdd(x, y))}`}</Tex> },
            ]}
          />
          <p className="text-xs text-slate-500">
            <M>d</M> 是真正的 metric（度量），滿足 triangle inequality（三角不等式）；有些書記作 <M>{'d_H'}</M>。
          </p>
        </>
      }
    />
  );
}

function CodewordExplorer() {
  const [pair, setPair] = useState<[number, number]>([A_IDX, B_IDX]);
  const D = useMemo(() => distanceMatrix(WORDS), []);
  const histogram = [...MD.histogram.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => ({ x: d, y: n }));
  const PA = WORDS[pair[0]];
  const PB = WORDS[pair[1]];
  const pathDiff = differingPositions(PA, PB);
  const path = flipPath(PA, PB).map((st) => st.word);
  const selectCodeword = (i: number) => {
    if (i === pair[1]) return;
    setPair([pair[1], i]);
  };
  return (
    <LabGrid
      main={
        <>
          <Card title={`全部 ${WORDS.length} 個 Hamming(7,4) 合法 codeword（點擊兩個來比較）`}>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {CODE.map((e) => {
                const sel = pair.indexOf(e.index);
                return (
                  <button
                    key={e.index}
                    onClick={() => selectCodeword(e.index)}
                    className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                      sel === 0 ? 'border-data-500 bg-data-50 ring-2 ring-data-300' : sel === 1 ? 'border-overall-500 bg-overall-50 ring-2 ring-overall-300' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <div className="text-[10px] text-slate-400">
                      #{e.index} · m = {e.message.join('')}
                    </div>
                    <BitString bits={e.codeword} className="text-sm font-semibold" highlight={(j) => (LAYOUT_74[j].role === 'parity' ? 'text-parity-600' : 'text-data-700')} />
                  </button>
                );
              })}
            </div>
            <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-3">
                <span className="chip bg-data-100 text-data-700">A #{pair[0]}</span>
                <BitRow bits={PA} plain size="sm" showPositions={false} states={PA.map((_, i) => (pathDiff.includes(i) ? 'diff' : 'normal'))} />
              </div>
              <div className="flex items-center gap-3">
                <span className="chip bg-overall-100 text-overall-700">B #{pair[1]}</span>
                <BitRow bits={PB} plain size="sm" showPositions={false} states={PB.map((_, i) => (pathDiff.includes(i) ? 'diff' : 'normal'))} />
              </div>
              <div className="text-sm">
                <M>{`d(A,B) = ${pathDiff.length}`}</M>
                {pathDiff.length === MD.dmin && <span className="ml-2 chip bg-amber-100 text-amber-800">這是最接近的一對之一</span>}
              </div>
            </div>
          </Card>
          <Card title="從 A 走到 B：每次翻一個位元">
            <p className="mb-2 text-xs text-slate-500">這是一條 Hamming 空間中的最短路徑（每一步 distance 1），不是平面上的直線。最右欄是該字串真正的最近 codeword。</p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">步</th>
                    <th>字串</th>
                    <th>
                      <M>{'d(\\cdot,A)'}</M>
                    </th>
                    <th>
                      <M>{'d(\\cdot,B)'}</M>
                    </th>
                    <th>最近 codeword</th>
                  </tr>
                </thead>
                <tbody>
                  {path.map((w, k) => {
                    const nr = nearestCodewords(w, WORDS);
                    const owner = nr.nearest.length === 1 ? nr.nearest[0] : -1;
                    return (
                      <tr key={k} className="border-t border-slate-100">
                        <td className="py-1 font-mono text-slate-400">{k}</td>
                        <td>
                          <BitString bits={w} highlight={(j) => (k > 0 && pathDiff.slice(0, k).includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
                        </td>
                        <td className="font-mono">{hammingDistance(w, PA)}</td>
                        <td className="font-mono">{hammingDistance(w, PB)}</td>
                        <td>
                          {owner === pair[0] ? (
                            <span className="chip bg-data-100 text-data-700">A</span>
                          ) : owner === pair[1] ? (
                            <span className="chip bg-overall-100 text-overall-700">B</span>
                          ) : (
                            <span className="chip bg-slate-100 text-slate-600">{owner >= 0 ? `#${owner}（distance ${nr.minDistance}）` : `平手（distance ${nr.minDistance}）`}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      }
      aside={
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="比較的 codeword 對" value={MD.pairsChecked} sub={`C(${WORDS.length},2)`} />
            <Stat label={<M>{'d_{\\min}'}</M>} value={MD.dmin} sub={`共 ${MD.closestPairs.length} 對達到`} tone="indigo" />
          </div>
          <Card title="所有 codeword 對的 distance 分佈">
            <Bars data={histogram} xLabel="Distance d" yLabel="Codeword 對數" highlight={(d) => d === MD.dmin} tooltipLabel={(d, n) => `${n} 對 codeword 的 distance 為 ${d}`} />
            <p className="text-xs text-slate-500">藍色長條是 minimum distance。沒有任何一對的 distance 是 1 或 2。</p>
          </Card>
          <Card title={`${WORDS.length}×${WORDS.length} distance 矩陣（點擊格子選擇一對）`}>
            <div className="overflow-x-auto">
              <div className="grid w-max" style={{ gridTemplateColumns: `repeat(${WORDS.length}, 18px)` }}>
                {D.map((row, i) =>
                  row.map((d, j) => {
                    const sel = (i === pair[0] && j === pair[1]) || (i === pair[1] && j === pair[0]);
                    return (
                      <button
                        key={`${i}-${j}`}
                        title={`d(#${i}, #${j}) = ${d}`}
                        onClick={() => i !== j && setPair([i, j])}
                        style={distColor(d)}
                        className={`h-[18px] w-[18px] text-[9px] font-semibold leading-[18px] ${sel ? 'outline outline-2 outline-offset-[-1px] outline-amber-500' : ''}`}
                      >
                        {d}
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
              Distance
              {[0, 3, 4, 7].map((d) => (
                <span key={d} style={distColor(d)} className="rounded px-1.5 py-0.5 font-semibold">
                  {d}
                </span>
              ))}
              （顏色越深越遠）
            </div>
          </Card>
        </>
      }
    />
  );
}

function NearestDecoder() {
  const [r, setR] = useState<Bit[]>(parseBits('0110111'));
  const near = useMemo(() => nearestCodewords(r, WORDS), [r]);
  const syn = decode74(r);
  const sorted = useMemo(() => near.distances.map((d, i) => ({ i, d })).sort((a, b) => a.d - b.d || a.i - b.i), [near]);
  const same = syn.corrected.join('') === WORDS[near.nearest[0]].join('');
  return (
    <LabGrid
      main={
        <Card title={`點擊 received word r 的位元，觀察它與 ${WORDS.length} 個 codeword 的 distance`} actions={<ResetButton onClick={() => setR(parseBits('0110111'))} />}>
          <BitRow bits={r} layout={LAYOUT_74} onToggle={(i) => setR(flipBit(r, i))} />
          <div className="mt-4 space-y-1">
            {sorted.map(({ i, d }) => {
              const isNear = near.nearest.includes(i);
              return (
                <div key={i} className={`flex items-center gap-3 rounded-lg px-2 py-1 ${isNear ? 'bg-emerald-50' : ''}`}>
                  <span className="w-8 text-xs text-slate-400">#{i}</span>
                  <BitString bits={WORDS[i]} className="text-sm" highlight={(j) => (WORDS[i][j] !== r[j] ? 'text-fuchsia-600 font-bold' : undefined)} />
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${isNear ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ width: `${(d / N) * 100}%` }} />
                  </div>
                  <span className={`w-6 text-right font-mono text-sm ${isNear ? 'font-bold text-emerald-700' : 'text-slate-500'}`}>{d}</span>
                </div>
              );
            })}
          </div>
        </Card>
      }
      aside={
        <>
          <Card title="解碼結果">
            <div className="space-y-2 text-sm">
              <div>
                離 r 最近的 distance = <strong>{near.minDistance}</strong>，達到的 codeword：{near.nearest.map((i) => `#${i}`).join(', ')}
              </div>
              <div>
                最近 codeword：<span className="mono font-semibold">{WORDS[near.nearest[0]].join('')}</span>
                {near.unique ? '（唯一）' : '（不唯一！）'}
              </div>
              <div>
                Syndrome 解碼結果：<span className="mono font-semibold">{syn.corrected.join('')}</span>
              </div>
              <div className={`rounded-lg px-2 py-1 text-xs ${same ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{same ? '✓ 兩種解碼方法得到相同 codeword' : '✗ 兩種方法結果不同'}</div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              對 Hamming(7,4)，任何 {N} 位元字串到最近 codeword 的 distance 都 ≤ 1 且最近 codeword 唯一（本章「Perfect code」一節）。所以 syndrome 解碼 = nearest-codeword decoding，但 syndrome 只需要一次矩陣乘法，不必比較 {WORDS.length} 次。
            </p>
          </Card>
          <Misconceptions
            items={[
              { wrong: '最近 codeword 一定是送出的 codeword。', right: '只有錯誤數 ≤ t 時才保證。錯誤太多時，received word 可能更靠近另一個 codeword。' },
            ]}
          />
        </>
      }
    />
  );
}

function DminSlider() {
  const [d, setD] = useState(D_MIN);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm">
          設 <M>{'d_{\\min}'}</M> =
        </span>
        <input type="range" min={1} max={8} value={d} onChange={(e) => setD(Number(e.target.value))} className="w-40 accent-slate-900" aria-label="Minimum distance" />
        <span className="font-mono text-lg font-bold">{d}</span>
        <span className="text-sm text-slate-600">
          ⇒ <M>{`t = \\lfloor (${d}-1)/2 \\rfloor = ${correctionCapability(d)}`}</M>，可偵測 <M>{`${detectionCapability(d)}`}</M> 個錯誤
        </span>
      </div>
      <DistanceLine d={d} />
      <p className="mt-2 text-sm text-slate-600">
        兩個最接近的 codeword A、B 之間有一條長度 <M>{'d_{\\min}'}</M> 的路徑。以每個 codeword 為中心、半徑 <M>t</M> 的「地盤」只要滿足 <M>{'2t < d_{\\min}'}</M> 就不會重疊：錯 <M>t</M> 個以內時，received word 一定比較靠近原本的 codeword。若 <M>{'2t \\ge d_{\\min}'}</M>，中間就會有字串同時屬於兩邊。
      </p>
    </>
  );
}

/* ---------------- Hamming spheres and the general bound ---------------- */

function BallFigures() {
  return (
    <div className="space-y-4">
      <p>
        主線的「{HB.volume} 種接收結果」，一般化就是 <strong>Hamming ball</strong>：要更正 t 個錯，每個 codeword 周圍「錯 t 個以內」的所有字串都必須解回它自己。這些區域不能重疊，加起來也不能超過整個空間的 <M>{'2^n'}</M> 個字串。
      </p>
      <Card title="Hamming ball">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2 text-sm text-slate-600">
            <Tex block>{'\\mathrm{Ball}(c,t) = \\{\\, x \\in \\mathbb{F}_2^n : d(x,c) \\le t \\,\\}'}</Tex>
            <p>以 codeword c 為中心、半徑 t 的 ball：離 c 最多 t 個位元不同的所有字串，也就是「c 錯了 t 個以內的位元，可能變成的所有樣子」。</p>
            <p>注意這是一個<strong>有限集合</strong>，不是平面上的圓。n = 3 時可以畫出它真正的樣子（圖①）：每個字串是立方體的一個頂點，ball 就是從中心出發、沿著邊走 t 步以內能到的頂點。</p>
          </div>
          <CubeBall />
        </div>
      </Card>
      <Card title="Ball 的 volume">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2 text-sm text-slate-600">
            <Tex block>{'V_2(n,t) = |\\mathrm{Ball}(c,t)| = \\sum_{w=0}^{t} \\binom{n}{w}'}</Tex>
            <p>
              <M>{'\\binom{n}{w}'}</M> = 從 n 個位置裡挑 w 個來錯的選法數，也就是「離 c 恰好 w」的字串個數。把 w = 0, 1, …, t 加起來，就是 ball 裡的字串個數。
            </p>
            <p>n 大的時候畫不出立方體，就改成按「翻了幾位」一圈一圈排（圖②，n = 7）。</p>
          </div>
          <BallDiagram />
        </div>
      </Card>
      <Card title="Hamming bound（sphere-packing bound）">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="min-w-0 space-y-2 text-sm text-slate-600">
            <Tex block>{'2^k \\cdot V_2(n,t) \\le 2^n'}</Tex>
            <p>
              每個 codeword 需要一顆 <M>{'V_2(n,t)'}</M> 個字串的 ball（圖②），ball 之間不能重疊，而整個空間只有 <M>{'2^n'}</M> 個字串（圖③）。<M>{'2^k'}</M> 顆 ball 要全部放得下，就必須滿足上式。t = 1 時 <M>{'V_2(n,1) = 1 + n'}</M>，就是主線的 <M>{'2^{\\ell} \\ge n + 1'}</M>。
            </p>
            <p>等號成立的 code 稱為 <strong>perfect code</strong>：ball 恰好鋪滿整個空間（圖①的「兩顆 ball」就是最小的例子）。</p>
          </div>
          <PackingDiagram />
        </div>
      </Card>
    </div>
  );
}

function BoundExplorer() {
  const [n, setN] = useState(N);
  const [k, setK] = useState(K);
  const [t, setT] = useState(T);
  const hb = hammingBound(n, k, t);
  const terms = sphereTerms(n, t);
  const family = hb.equality ? knownPerfectFamily(n, k, t) : null;
  const reset = () => {
    setN(N);
    setK(K);
    setT(T);
  };
  return (
    <div className="space-y-4">
      <LabGrid
        main={
          <Card title="參數" actions={<ResetButton onClick={reset} />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Slider
                label="Code length n"
                value={n}
                min={1}
                max={24}
                onChange={(v) => {
                  setN(v);
                  setK(Math.min(k, v));
                  setT(Math.min(t, v));
                }}
              />
              <Slider label="Dimension k" value={k} min={0} max={n} onChange={setK} />
              <Slider label="修正半徑 t" value={t} min={0} max={n} onChange={setT} />
            </div>
            <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
              <Tex block>{`V_2(${n},${t}) = ${terms.map((_, i) => `\\binom{${n}}{${i}}`).join(' + ')} = ${terms.join(' + ')} = ${hb.volume}`}</Tex>
              <Tex block>{`2^{${k}} \\cdot ${hb.volume} = ${hb.codewords} \\times ${hb.volume} = ${hb.lhs.toLocaleString()} \\;${hb.equality ? '=' : hb.satisfied ? '<' : '>'}\\; 2^{${n}} = ${hb.rhs.toLocaleString()}`}</Tex>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs text-slate-500">
                <span>Ball 所佔的比例 2ᵏ·V / 2ⁿ</span>
                <span className="font-mono">{(hb.coverage * 100).toFixed(hb.coverage < 0.01 ? 4 : 1)}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full ${hb.equality ? 'bg-emerald-500' : hb.satisfied ? 'bg-data-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, hb.coverage * 100)}%` }} />
              </div>
            </div>
          </Card>
        }
        aside={
          <>
            <Card>
              {hb.equality ? (
                <Verdict ok title="等號成立：perfect code 參數">
                  {family ? <>已知例子：{family}</> : '等號成立是 perfect code 的必要條件；此參數是否真的存在 perfect code 需另外判斷。'}
                </Verdict>
              ) : hb.satisfied ? (
                <Verdict ok title="滿足 Hamming bound（嚴格不等）">
                  ball 沒有鋪滿空間，有 {(hb.rhs - hb.lhs).toLocaleString()} 個字串不在任何 ball 中。注意：滿足 bound 不代表這樣的 code 一定存在。
                </Verdict>
              ) : (
                <Verdict ok={false} title="違反 Hamming bound">
                  不可能存在長度 {n}、{hb.codewords} 個 codeword 且能修正 {t} 個錯誤的 binary code。
                </Verdict>
              )}
              <div className="mt-3 text-sm text-slate-600">
                給定 n = {n}, t = {t}，k 最大只能是 <strong>{Math.max(0, hb.maxK)}</strong>。
              </div>
            </Card>
            <Misconceptions
              items={[
                {
                  wrong: 'Hamming ball 就像平面上的圓：圖上靠得近的字串，distance 就比較近。',
                  right: `Hamming distance 只計算「不同位元的個數」，不是歐氏距離。一個半徑 1 的 ball 是 ${HB.volume} 個離散字串，它們的數值彼此可以相差很遠（見下一項「依數值排列」視圖）。圖②畫成同心圈只是按「翻幾位」分層，圈上的位置和角度沒有意義；真正的結構要看圖①的立方體（沿邊走的步數）。`,
                },
                { wrong: '滿足 Hamming bound 的參數一定有對應的 code。', right: 'Hamming bound 是必要條件，不是充分條件。例如 (n,k,t) = (90,78,2) 滿足等號，但不存在這樣的 perfect code。' },
                { wrong: 'perfect code 表示能修正所有錯誤。', right: 'perfect code 只代表「每個字串都恰好在一個半徑 t 的 ball 內」。超過 t 個錯誤仍會被解成錯的 codeword。' },
              ]}
            />
          </>
        }
      />
      <Derivation
        title="逐步推導：Hamming(7,4) 剛好等號成立"
        steps={[
          { title: '計算 ball 的大小', body: <Tex block>{`V_2(${N},${T}) = ${sphereTerms(N, T).map((_, i) => `\\binom{${N}}{${i}}`).join(' + ')} = ${sphereTerms(N, T).join(' + ')} = ${HB.volume}`}</Tex> },
          { title: '每顆 ball = 主線的接收結果', body: <p>每個 codeword 的 ball = 它自己（沒有錯）+ {N} 種單一錯誤 = {HB.volume} 個字串，也就是主線的 {HB.volume} 種接收結果。</p> },
          { title: `${HB.codewords} 個 codeword 的 ball 加總`, body: <Tex block>{`2^${K} \\cdot ${HB.volume} = ${HB.codewords} \\times ${HB.volume} = ${HB.lhs}`}</Tex> },
          { title: '和整個空間比較', body: <Tex block>{`2^${N} = ${HB.rhs} \\quad\\Rightarrow\\quad ${HB.codewords} \\times (1 + ${N}) = ${HB.lhs} = 2^${N}`}</Tex> },
          {
            title: '結論',
            body: (
              <p>
                ball 彼此不重疊（因為 <M>{`d_{\\min} = ${D_MIN} \\ge 2 \\cdot ${T} + 1`}</M>），而總大小恰好等於空間大小，所以它們<strong>完全覆蓋</strong>整個空間：每一個 {N} 位元字串都恰好屬於一個 ball。反過來說，任何長度 {N}、能修正 {T} 個錯誤的 binary code（二元碼）最多只有 {HB.rhs} ÷ {HB.volume} = {HB.rhs / HB.volume} 個 codeword：Hamming({N},{K}) 已經沒有任何浪費。
              </p>
            ),
          },
        ]}
      />
    </div>
  );
}

const CODES = {
  h74: { label: 'Hamming(7,4)', n: 7, words: WORDS },
  h84: { label: 'Extended(8,4)', n: 8, words: codewords84().map((e) => e.codeword) },
};
type CodeKey = keyof typeof CODES;

function PartitionView() {
  const [codeKey, setCodeKey] = useState<CodeKey>('h74');
  const code = CODES[codeKey];
  const part = useMemo(() => partitionByNearest(code.words, code.n), [code]);
  const [sel, setSel] = useState(A_IDX);
  const [view, setView] = useState<'groups' | 'all'>('groups');
  const [hoverWord, setHoverWord] = useState<number | null>(null);
  return (
    <Card
      title={`依最近 codeword 把全部 ${part.totalWords} 個 ${code.n}-bit 字串分組`}
      actions={
        <>
          <Segmented
            value={codeKey}
            onChange={(v) => {
              setCodeKey(v);
              setSel(A_IDX);
            }}
            options={[
              { value: 'h74', label: 'Hamming(7,4)' },
              { value: 'h84', label: 'Extended(8,4)' },
            ]}
          />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'groups', label: '依 codeword 分組' },
              { value: 'all', label: '依數值排列' },
            ]}
          />
        </>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="字串總數 2ⁿ" value={part.totalWords} />
        <Stat label="唯一歸屬的字串" value={part.groups.reduce((a, g) => a + g.length, 0)} sub={`每組 ${[...new Set(part.groups.map((g) => g.length))].join('/')} 個`} tone="indigo" />
        <Stat label="平手（不屬於任何一組）" value={part.ties.length} tone={part.ties.length ? 'rose' : 'emerald'} />
        <Stat label="完全分割？" value={part.isPartition ? '是 ✓' : '否 ✗'} tone={part.isPartition ? 'emerald' : 'rose'} />
      </div>

      {view === 'groups' ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
          {part.groups.map((g, gi) => (
            <button
              key={gi}
              onClick={() => setSel(gi)}
              className={`rounded-xl border p-1.5 text-left transition-colors ${gi === sel ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300' : 'border-slate-200 hover:border-slate-400'}`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                <span>#{gi}</span>
                <span>{g.length} 個</span>
              </div>
              {g
                .slice()
                .sort((a, b) => hammingDistance(a, code.words[gi]) - hammingDistance(b, code.words[gi]))
                .map((w) => {
                  const d = hammingDistance(w, code.words[gi]);
                  return (
                    <div key={bitsToString(w)} className={`font-mono text-[11px] leading-4 tracking-wider ${d === 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                      <BitString bits={w} highlight={(j) => (w[j] !== code.words[gi][j] ? 'text-rose-600 font-bold' : undefined)} />
                    </div>
                  );
                })}
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="grid w-max gap-0.5" style={{ gridTemplateColumns: 'repeat(16, minmax(34px, 1fr))' }}>
            {part.owner.map((o, w) => {
              const isCenter = o >= 0 && bitsToInt(code.words[o]) === w;
              const inSel = o === sel;
              return (
                <button
                  key={w}
                  onClick={() => o >= 0 && setSel(o)}
                  onMouseEnter={() => setHoverWord(w)}
                  onMouseLeave={() => setHoverWord(null)}
                  title={`${w.toString(2).padStart(code.n, '0')} → ${o >= 0 ? `codeword #${o}` : '平手'}`}
                  className={`h-7 rounded text-[10px] font-semibold ${
                    o < 0 ? 'bg-rose-50 text-rose-400' : inSel ? (isCenter ? 'bg-emerald-600 text-white' : 'bg-emerald-200 text-emerald-900') : isCenter ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {o >= 0 ? `#${o}` : '?'}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            格子依字串的整數值 0, 1, …, {part.totalWords - 1} 排列（每列 16 個），格子內是它的最近 codeword 編號；深色格是 codeword 本身。
            {hoverWord !== null && (
              <span className="ml-1 font-mono text-slate-700">
                目前：{hoverWord.toString(2).padStart(code.n, '0')}（= {hoverWord}）
              </span>
            )}
            同一組的 {part.groups[0].length} 個字串在數值上分散各處：Hamming ball 並不是「一團相鄰的點」。
          </p>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {codeKey === 'h74'
          ? `${part.groups.length} 組 × ${part.groups[0].length} 個 = ${part.totalWords}：沒有重疊、沒有遺漏。每一組就是主線那張表的 ${part.groups[0].length} 種接收結果。`
          : `Extended(8,4) 每個 ball 有 1 + ${code.n} = ${part.groups[0].length} 個字串，${part.groups.length} 個 ball 共 ${part.groups.reduce((a, g) => a + g.length, 0)} 個；其餘 ${part.ties.length} 個字串（distance 2）同時離好幾個 codeword 一樣近 → 無法唯一解碼。這正是 SECDED「偵測但不修正」的區域。`}
      </p>
    </Card>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-mono text-base font-bold text-slate-900">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-slate-900" />
    </label>
  );
}

function Verdict({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
      <div className="flex items-center gap-1.5 font-semibold">
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {title}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
