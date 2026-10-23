import { useState } from 'react';
import { Radio, MousePointerClick, Layers, ListChecks } from 'lucide-react';
import { type Bit, DEFAULT_MESSAGE, K4, N7, PARITY_CHECKS, codewords74, correctionCapability, flipBit, minimumDistance } from '../core';
import { Tex, M } from '../components/Tex';
import { BitRow } from '../components/Bits';
import { Callout, Card, Expandable, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage } from '../components/Lesson';
import { MODULES, type ModuleMeta } from '../lib/modules';
import { RelatedLinks } from '../components/alg/Links';
import { ParityLab } from '../components/ParityLab';

const ID = 'intro';

const PARTS = [
  { to: 'encode', tag: '第一課', title: 'Hamming Code 是什麼', desc: '編碼、H 與 G、Syndrome 解碼、能力與極限、SECDED', filter: (m: ModuleMeta) => !m.group && !m.lesson && m.id !== 'intro' },
  { to: 'a-0', tag: '代數基礎與循環碼', title: '從 GF(2) 走到 GF(8) 與生成多項式', desc: 'GF(2)、GF(8)、商環、本原元素、生成多項式、循環碼、最小多項式', filter: (m: ModuleMeta) => m.group === 'algebra' },
  { to: 'l2-1', tag: '第二課', title: '編碼與解碼演算法', desc: 'LFSR、長除法、Syndrome、Chien Search、誤更正、SECDED 實作', filter: (m: ModuleMeta) => m.lesson === 2 },
];

const SENT: Bit[] = [...DEFAULT_MESSAGE];
/** k = 4 data bits; Hamming(7,4) adds ℓ = 3 parity bits and corrects t = 1 error */
const K = K4;
const L = PARITY_CHECKS.length;
const T = correctionCapability(minimumDistance(codewords74().map((x) => x.codeword)).dmin);
/** a single parity bit: (k + 1, k); its 2^(k+1) strings, half of them legal */
const SINGLE_N = K + 1;
/** an example codeword of the single-parity code: the data 1011 plus its parity bit */
const SINGLE_EX = [...SENT, SENT.reduce<number>((a, b) => a ^ b, 0)].join('');
/** two checks: 2² − 1 failure patterns for k + 2 positions, and the number of ways to wire two checks over them */
const TWO_PATTERNS = 2 ** (L - 1) - 1;
const TWO_POSITIONS = K + L - 1;
const TWO_DESIGNS = 2 ** ((L - 1) * TWO_POSITIONS);

const ROUTE = [
  { kind: 'why', title: '雜訊會翻轉位元', desc: '沒有保護時，錯了也看不出來' },
  { kind: 'definition', title: '第一個想法：同位位元', desc: '多送一個位元，湊成偶數個 1' },
  { kind: 'calculation', title: '把翻轉寫成算式', desc: 'mod 2 加法與 r = c + e' },
  { kind: 'visualization', title: '四種做法比一比', desc: '多送幾個位元，換到什麼能力' },
  { kind: 'experiment', title: '要幾個同位位元？', desc: '1、2、3 個同位位元實際試試看' },
  { kind: 'conclusion', title: '重疊的檢查 = Hamming(7,4)', desc: '下一章的起點與課程地圖' },
] as const;

/** the parity-bit example: the data plus P, then one and two flipped bits */
const WITH_P: Bit[] = [...SENT, SENT.reduce<number>((a, b) => a ^ b, 0) as Bit];
const ERR_A = 1;
const ERR_B = 2;
const ONE_ERR = flipBit(WITH_P, ERR_A);
const TWO_ERR = flipBit(ONE_ERR, ERR_B);
const ones = (w: readonly Bit[]) => w.filter((b) => b === 1).length;
const countText = (w: readonly Bit[]) => `${ones(w)}（${ones(w) % 2 ? '奇數' : '偶數'}）`;

/** a word with its flipped bits in red and the parity bit (the 5th) in orange */
function Word({ w, flips = [] }: { w: readonly Bit[]; flips?: number[] }) {
  return (
    <>
      {w.map((b, i) => (
        <span key={i} className={flips.includes(i) ? 'text-rose-600' : i === K ? 'text-parity-600' : ''}>
          {i > 0 && ' '}
          {b}
        </span>
      ))}
    </>
  );
}

const SCHEMES = [
  { name: '不編碼（Uncoded）', n: K, k: K, correct: 0, note: '任何錯誤都變成另一個「合法」訊息' },
  { name: '單一同位位元（Single parity）', n: SINGLE_N, k: K, correct: 0, note: '知道「有錯」，不知道「錯在哪」' },
  { name: '三重重複碼（Repetition ×3）', n: 3 * K, k: K, correct: 1, note: '每個位元送三次，多數決；代價很高' },
  { name: `Hamming(${N7},${K})`, n: N7, k: K, correct: T, note: `只多 ${N7 - K} 個位元，就能修正任一個錯誤` },
];

export default function Intro() {
  const [raw, setRaw] = useState<Bit[]>([...SENT]);
  const [rawFlips, setRawFlips] = useState<number[]>([]);
  const errVec: Bit[] = SENT.map((_, i) => (rawFlips.includes(i) ? 1 : 0));

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          這是一個給大學生的「錯誤更正碼（Error-Correcting Codes）」數學實驗室。導論從一個問題出發：雜訊會偷偷翻轉位元。接著一步一步看：多送一個同位位元能做到什麼、怎麼用算式描述錯誤、幾種做法的代價，最後動手找出 Hamming(7,4) 的關鍵想法。
          每一章都依照 <strong>情境 → 設計 → 推導 → 圖解 → 實驗 → 結論</strong> 的順序展開：先看發送端與接收端遇到什麼情境，再看做了哪些設計、各為了解決什麼，接著用數學推導，然後回到圖解與實驗，看式子在電路、警示燈上代表什麼，最後整理成結論。
        </p>
      </ModuleHeader>
      <KeyPoint>雜訊會偷偷翻轉位元：發送端多送幾個有規律的冗餘位元，接收端才能發現錯誤，甚至自己修好它。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Card icon={<ListChecks className="h-4 w-4 text-slate-500" />} title="這一章的路線">
          <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ROUTE.map((r, i) => (
              <li key={r.kind}>
                <button
                  type="button"
                  onClick={() => document.getElementById(`${ID}-${r.kind}`)?.scrollIntoView({ behavior: 'smooth' })}
                  className="flex h-full w-full gap-3 rounded-lg border border-slate-200 p-2 text-left hover:border-slate-400 hover:bg-slate-50"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{i + 1}</span>
                  <span className="text-sm">
                    <strong>{r.title}</strong>
                    <span className="block text-xs text-slate-500">{r.desc}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Expandable title="怎麼使用這個實驗室？" icon={<MousePointerClick className="h-4 w-4 text-emerald-600" />}>
              <ul className="list-disc space-y-1 pl-5">
                <li>方塊狀的位元都可以點擊翻轉；藍色是資料位元，橘色是同位位元，紫色是整體同位位元。</li>
                <li>每個實驗都有「重設範例」按鈕，預設訊息是 <span className="mono">{SENT.join('')}</span>。</li>
                <li>「逐步數學推導」區塊可以按「下一步」一步一步展開，避免一次看到太多公式。</li>
                <li>上方的流程列可以快速跳到「情境」「設計」「推導」「圖解」「實驗」「結論」各段。</li>
              </ul>
            </Expandable>
            <Expandable title="所有計算都是真的" icon={<Layers className="h-4 w-4 text-indigo-500" />}>
              <p>畫面上的編碼、解碼、矩陣乘法、秩、核空間、最小距離與 Hamming Bound 都由獨立的 TypeScript 數學核心即時計算（並有窮舉單元測試驗證），不是預先寫好的答案。</p>
            </Expandable>
          </div>
        </Card>

        <Stage kind="why" moduleId={ID} title="雜訊會翻轉位元，接收端卻看不出來">
          <Card icon={<Radio className="h-4 w-4 text-sky-600" />} title="實驗：沒有保護的 4-bit 訊息">
            <p className="mb-3 text-sm text-slate-600">
              你要傳送訊息 <span className="mono font-semibold">{SENT.join('')}</span>。點擊任一位元，模擬通道雜訊（例如記憶體中的宇宙射線、無線訊號干擾）把它翻轉。
            </p>
            <div className="flex flex-wrap items-end gap-6">
              <div>
                <div className="mb-1 text-xs text-slate-500">接收端收到的 4 個位元</div>
                <BitRow
                  bits={raw}
                  plain
                  states={raw.map((_, i) => (rawFlips.includes(i) ? 'error' : 'normal'))}
                  onToggle={(i) => {
                    setRaw((r) => flipBit(r, i));
                    setRawFlips((f) => (f.includes(i) ? f.filter((j) => j !== i) : [...f, i]));
                  }}
                />
              </div>
              <ResetButton
                onClick={() => {
                  setRaw([...SENT]);
                  setRawFlips([]);
                }}
              />
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {rawFlips.length === 0 ? (
                <>接收端收到 <span className="mono">{raw.join('')}</span>。看起來一切正常。</>
              ) : (
                <>
                  接收端收到 <span className="mono font-bold text-rose-600">{raw.join('')}</span>。這也是一個完全合法的 {K}-bit 訊息！
                  <strong> 接收端沒有任何辦法知道資料被改過。</strong>
                </>
              )}
            </div>
          </Card>
          <Callout kind="key" title="核心問題">
            <p>如果每一個 {K}-bit 字串都是合法訊息，那麼任何錯誤都只會把一個合法訊息變成另一個合法訊息。要偵測或修正錯誤，我們必須<strong>刻意加入冗餘（redundancy）</strong>，讓「合法」字串變得稀少。</p>
          </Callout>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="第一個想法：多送一個同位位元">
          <Card title="什麼是同位位元（parity bit）？">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-2 text-sm text-slate-700">
                <p>
                  在資料後面<strong>多加一個位元</strong>，專門用來「湊成偶數個 1」，這個多出來的位元就叫同位位元（偶同位，even parity）。
                </p>
                <p>
                  接收端收到後只做一件事：<strong>數 1 的個數</strong>。偶數 → 檢查通過；奇數 → 一定有位元被翻轉過。
                </p>
                <p className="rounded-lg bg-amber-50 p-2 text-amber-900">
                  弱點：翻轉 1 個位元，1 的個數會從偶數變奇數，所以抓得到；但翻轉 2 個，奇偶又變回來，檢查照樣通過。而且就算抓到了，也不知道是哪一個位元錯。
                </p>
              </div>
              <div className="min-w-0 rounded-xl border border-slate-200 p-3 text-sm">
                <table className="w-full text-center font-mono">
                  <tbody>
                    <tr className="text-xs text-slate-500">
                      <td className="py-1 text-left font-sans">資料</td>
                      <td>{SENT.join(' ')}</td>
                      <td className="font-sans">1 的個數</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-left font-sans text-slate-600">原本</td>
                      <td className="font-bold text-data-700">
                        <Word w={SENT} />
                      </td>
                      <td>{countText(SENT)}</td>
                    </tr>
                    <tr>
                      <td className="py-1 text-left font-sans text-slate-600">加上 P</td>
                      <td className="font-bold text-data-700">
                        <Word w={WITH_P} />
                      </td>
                      <td>{countText(WITH_P)} ✓</td>
                    </tr>
                    {[
                      { label: '錯 1 個', w: ONE_ERR, flips: [ERR_A] },
                      { label: '錯 2 個', w: TWO_ERR, flips: [ERR_A, ERR_B] },
                    ].map((row) => {
                      const odd = ones(row.w) % 2 === 1;
                      return (
                        <tr key={row.label}>
                          <td className="py-1 text-left font-sans text-slate-600">{row.label}</td>
                          <td className="font-bold">
                            <Word w={row.w} flips={row.flips} />
                          </td>
                          <td className={odd ? 'text-orange-700' : 'text-rose-700'}>
                            {countText(row.w)}→ {odd ? '抓到' : '未偵測錯誤'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
          <Card title="用同位位元認識幾個名詞">
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="font-semibold">Code <M>{'C'}</M></dt>
                <dd className="text-slate-600">長度 <M>n</M> 的二進位字串中，被選為「合法」的那些字串所成的集合。</dd>
              </div>
              <div>
                <dt className="font-semibold">Codeword</dt>
                <dd className="text-slate-600"><M>C</M> 的元素。發送端只會送出 codeword。</dd>
              </div>
              <div>
                <dt className="font-semibold">
                  <M>{'(n,k)'}</M> code
                </dt>
                <dd className="text-slate-600">
                  把 <M>k</M> 個資料位元編成 <M>n</M> 個位元；共有 <M>2^k</M> 個 codeword。碼率（Code rate）<M>{'k/n'}</M>：送出的位元裡有多少比例是真正的資料。
                </dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
              例：「在 {K} 個資料位元後面加一個同位位元」就是一個 <M>{`(${SINGLE_N},${K})`}</M> code。{SINGLE_N} 位元字串一共 <M>{`2^${SINGLE_N} = ${2 ** SINGLE_N}`}</M> 個，只有 1 的個數是偶數的 <M>{`2^${K} = ${2 ** K}`}</M> 個是 codeword（例如 {SINGLE_EX}），碼率 <M>{`${K}/${SINGLE_N}`}</M>。第 1 章的 Hamming({N7},{K}) 則是 <M>{`n = ${N7},\\ k = ${K}`}</M>。
            </p>
          </Card>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="把翻轉寫成算式：mod 2 與 r = c + e">
          <Card title="翻轉一個位元 = 加上 1">
            <p className="text-sm text-slate-600">
              上一段的同位檢查是「數 1 的個數，看奇偶」，其實就是把位元加起來、只看除以 2 的餘數。雜訊做的事也能寫成加法：它只會把某個位元<strong>翻轉</strong>（0 變 1、1 變 0）。如果把「翻轉」寫成「加 1」、「不動」寫成「加 0」，這套加法必須滿足：
            </p>
            <div className="my-3 flex flex-wrap items-center gap-4">
              <table className="font-mono text-sm">
                <tbody>
                  <tr>
                    <th className="border-b border-r border-slate-300 px-3 py-1">+</th>
                    <th className="border-b border-slate-300 px-3 py-1">0</th>
                    <th className="border-b border-slate-300 px-3 py-1">1</th>
                  </tr>
                  {[0, 1].map((a) => (
                    <tr key={a}>
                      <th className="border-r border-slate-300 px-3 py-1">{a}</th>
                      <td className="px-3 py-1 text-center">{a}</td>
                      <td className="bg-rose-50 px-3 py-1 text-center font-bold text-rose-600">{1 - a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-xs text-slate-500">
                <div>加 0 那一欄：不動</div>
                <div className="text-rose-600">加 1 那一欄：翻轉</div>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              也就是 XOR：翻兩次等於沒翻。換句話說，這就是 <strong>mod 2 的算術</strong>：照常加、照常乘，最後只看除以 2 的餘數（奇偶）——<M>{'1+1 = 2 \\equiv 0 \\pmod 2'}</M>，乘法 mod 2 剛好是 AND。這套算術記作 <strong>GF(2)</strong>（也寫作 <M>{'\\mathbb{F}_2'}</M>），之後所有的同位檢查與矩陣乘法都用它計算。（它為什麼被稱為「體（field）」、有什麼好處，在代數章節 A1 說明。）
            </p>
            <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-slate-700">
              <strong>注意：這不是二進位數字的加法。</strong>把 {SENT.join('')} 當成數字 {parseInt(SENT.join(''), 2)} 時，<M>{'1+1 = 10_2'}</M> 會進位到左邊。但在這裡每個位元是一個獨立的位置，雜訊翻轉第 2 位不會影響第 1 位，所以<strong>不進位</strong>：<M>{'1+1=0'}</M>，每一位各自 mod 2。
            </p>
            <p className="mt-2 text-sm text-slate-600">
              因為 <M>1+1=0</M>，<strong>減法就是加法</strong>：把同一個錯誤再加一次，就能把它抵銷。
            </p>
          </Card>
          <LabGrid
            main={
              <Card title="把「哪些位元被翻轉」記成錯誤向量 e">
                <p className="text-sm text-slate-600">
                  錯誤向量 <M>e</M> 在被翻轉的位置是 1、其他位置是 0。每一位各自做 GF(2) 加法，就得到收到的字 <M>r</M>。下面的值跟著最上面的實驗即時變化：
                </p>
                <Tex block>{`\\underbrace{${SENT.join('')}}_{c\\ \\text{(送出)}} + \\underbrace{${errVec.join('')}}_{e\\ \\text{(錯誤)}} = \\underbrace{${raw.join('')}}_{r\\ \\text{(收到)}}`}</Tex>
                <p className="text-sm text-slate-600">
                  一個之後會一直用到的結論：<M>{'x + y'}</M> 中的 1，恰好是 <M>x</M>、<M>y</M> <strong>不同</strong>的位置；所以 <M>{'x + y = 0 \\iff x = y'}</M>，而且 <M>{'e = r + c'}</M>。
                  接收端不知道 <M>c</M>，所以無法直接算出 <M>e</M>——Hamming Code 的任務就是在只看到 <M>r</M> 的情況下推出 <M>e</M>。
                </p>
              </Card>
            }
            aside={
              <Card>
                <RelatedLinks links={[{ to: 'a-1', text: '完整的 GF(2) 計算器、體與特徵、Hcᵀ = 0 也是 GF(2) 計算' }]} title="想多練習單一位元的運算？" />
              </Card>
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="四種做法比一比：多送幾個位元，換到什麼？">
          <p className="text-sm text-slate-600">
            同位位元只能發現有錯，不能修正。把它和其他做法放在一起比：多送的位元越多，能力不一定越好。注意最後一列：Hamming({N7},{K}) 只多送 {N7 - K} 個位元，就能修正任何一個錯——它是怎麼辦到的？下一段動手試。
          </p>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">方案</th>
                    <th className="py-2 pr-3">傳送位元 n</th>
                    <th className="py-2 pr-3">碼率 k/n</th>
                    <th className="py-2 pr-3">保證可修正</th>
                    <th className="py-2">說明</th>
                  </tr>
                </thead>
                <tbody>
                  {SCHEMES.map((s) => (
                    <tr key={s.name} className={`border-b border-slate-100 ${s.name.startsWith('Hamming') ? 'bg-emerald-50/60' : ''}`}>
                      <td className="py-2 pr-3 font-medium">{s.name}</td>
                      <td className="py-2 pr-3 font-mono">{s.n}</td>
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-data-500" style={{ width: `${(s.k / s.n) * 100}%` }} />
                          </div>
                          <span className="font-mono text-xs">{(s.k / s.n).toFixed(2)}</span>
                        </div>
                      </td>
                      <td className="py-2 pr-3 font-mono">{s.correct} 個錯誤</td>
                      <td className="py-2 text-slate-600">{s.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-slate-500">重複碼的「修正 1 個」是指每一組 3 個重複位元中最多錯 1 個。Hamming({N7},{K}) 用更少的冗餘達到同樣的單一錯誤更正能力。</p>
          </Card>
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="動手試：要幾個同位位元，才找得到錯在哪？">
          <ParityLab />
          <Misconceptions
            items={[
              { wrong: '同位檢查通過，就代表資料正確。', right: '只代表錯誤個數是偶數（包含 0）。兩個錯誤會互相抵銷，檢查照樣通過。' },
              { wrong: '偵測到錯誤就等於能修正錯誤。', right: '修正需要「定位」：知道是哪一個位元錯，才能把它翻回來。一個檢查只能回答一個是非題，指不出 n 個位置中的哪一個。' },
              {
                wrong: '加到兩個同位位元，就能定位錯誤。',
                right: `兩個檢查只有 ${TWO_PATTERNS + 1} 種結果，扣掉「全部通過」只剩 ${TWO_PATTERNS} 種，卻要分辨 ${TWO_POSITIONS} 個位置，一定有位置共用同一種結果。不管兩個檢查怎麼安排都一樣（${TWO_DESIGNS} 種安排已全部驗證過）。要定位 ${N7} 個位置，需要 ${L} 個檢查。`,
              },
            ]}
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="互相重疊的檢查，就是 Hamming(7,4)">
          <Callout kind="key" title="結論">
            <p>
              一個同位檢查只能回答「是否有奇數個錯」。如果使用<strong>多個彼此重疊的同位檢查</strong>，讓每個位置都被一組<em>獨特</em>的檢查覆蓋，那麼「哪些檢查失敗」就像一組座標，可以指出錯誤的位置。
              {L} 個檢查有 <M>{`2^${L} - 1 = ${2 ** L - 1}`}</M> 種非空組合，剛好對應 {N7} 個位置——這就是 Hamming({N7},{K})。
            </p>
          </Callout>
          <Card icon={<ListChecks className="h-4 w-4 text-slate-500" />} title="課程地圖（Roadmap）：三個部分">
            <ol className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {PARTS.map((p) => (
                <li key={p.to}>
                  <a href={`#/${p.to}`} className="flex h-full flex-col gap-1 rounded-lg border border-slate-200 p-3 hover:border-slate-400 hover:bg-slate-50">
                    <span className="text-xs font-bold text-slate-500">{p.tag}</span>
                    <span className="text-sm font-semibold">{p.title}</span>
                    <span className="text-xs text-slate-500">{p.desc}</span>
                    <span className="mt-auto pt-1 text-xs text-slate-400">{MODULES.filter(p.filter).length} 個單元 →</span>
                  </a>
                </li>
              ))}
            </ol>
          </Card>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}
