import { useState } from 'react';
import { Radio, MousePointerClick, Layers, ListChecks } from 'lucide-react';
import { type Bit, type PositionInfo, sum, flipBit } from '../core';
import { Tex, M } from '../components/Tex';
import { BitRow } from '../components/Bits';
import { Callout, Card, Expandable, FlowBar, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, StatusBadge } from '../components/Lesson';
import { MODULES, type ModuleMeta } from '../lib/modules';
import { RelatedLinks } from '../components/alg/Links';

const ID = 'intro';

const PARITY_LAYOUT: PositionInfo[] = [
  ...[0, 1, 2, 3].map((i): PositionInfo => ({ index: i, position: i + 1, label: `d${i + 1}`, role: 'data' })),
  { index: 4, position: 5, label: 'p', role: 'parity' },
];

const PARTS = [
  { to: 'encode', tag: '第一課', title: 'Hamming Code 是什麼', desc: '編碼、矩陣 H 與 G、Syndrome、距離、Hamming Bound、SECDED', filter: (m: ModuleMeta) => !m.group && !m.lesson && m.id !== 'intro' },
  { to: 'a-0', tag: '代數基礎與循環碼', title: '為什麼需要 GF(8) 與 g(x)', desc: 'GF(2)、GF(8)、商環、本原元素、生成多項式、循環碼、最小多項式', filter: (m: ModuleMeta) => m.group === 'algebra' },
  { to: 'l2-1', tag: '第二課', title: '編碼與解碼演算法', desc: 'LFSR、長除法、Syndrome、Chien Search、誤更正、SECDED 實作', filter: (m: ModuleMeta) => m.lesson === 2 },
];

const VA: Bit[] = [1, 0, 1, 1];
const VB: Bit[] = [0, 1, 1, 0];

const SCHEMES = [
  { name: '不編碼 Uncoded', n: 4, k: 4, detect: 0, correct: 0, note: '任何錯誤都變成另一個「合法」訊息' },
  { name: '單一同位位元 Single parity', n: 5, k: 4, detect: 1, correct: 0, note: '知道「有錯」，不知道「錯在哪」' },
  { name: '三重重複碼 Repetition ×3', n: 12, k: 4, detect: 2, correct: 1, note: '每個位元送三次，多數決；代價很高' },
  { name: 'Hamming(7,4)', n: 7, k: 4, detect: 2, correct: 1, note: '只多 3 個位元，就能修正任一個錯誤' },
];

export default function Intro() {
  const [raw, setRaw] = useState<Bit[]>([1, 0, 1, 1]);
  const [rawFlips, setRawFlips] = useState<number[]>([]);
  const [parityErr, setParityErr] = useState<Bit[]>([0, 0, 0, 0, 0]);

  const parityWord: Bit[] = [1, 0, 1, 1, sum([1, 0, 1, 1])];
  const parityRecv = parityWord.map((b, i) => (b ^ parityErr[i]) as Bit);
  const parityCheck = sum(parityRecv);
  const nErr = parityErr.filter(Boolean).length;

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          這是一個給大學生的「錯誤更正碼 Error-Correcting Codes」數學實驗室。每一章都依照
          <strong>為什麼 → 定義 → 計算 → 視覺化 → 實驗 → 結論</strong> 的順序展開：先遇到問題，再動手操作，最後才用數學把觀察整理成定理。
        </p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="雜訊會悄悄改變你的資料">
          <Card icon={<Radio className="h-4 w-4 text-sky-600" />} title="實驗：沒有保護的 4-bit 訊息">
            <p className="mb-3 text-sm text-slate-600">
              你要傳送訊息 <span className="mono font-semibold">1011</span>。點擊任一位元，模擬通道雜訊（例如記憶體中的宇宙射線、無線訊號干擾）把它翻轉。
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
                  setRaw([1, 0, 1, 1]);
                  setRawFlips([]);
                }}
              />
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {rawFlips.length === 0 ? (
                <>接收端收到 <span className="mono">{raw.join('')}</span>。看起來一切正常。</>
              ) : (
                <>
                  接收端收到 <span className="mono font-bold text-rose-600">{raw.join('')}</span>。這也是一個完全合法的 4-bit 訊息！
                  <strong> 接收端沒有任何辦法知道資料被改過。</strong>
                </>
              )}
            </div>
          </Card>
          <Callout kind="key" title="核心問題">
            <p>如果每一個 4-bit 字串都是合法訊息，那麼任何錯誤都只會把一個合法訊息變成另一個合法訊息。要偵測或修正錯誤，我們必須<strong>刻意加入冗餘 (redundancy)</strong>，讓「合法」字串變得稀少。</p>
          </Callout>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="Code、Codeword 與 GF(2)">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card title="基本名詞">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="font-semibold">Code <M>{'C'}</M></dt>
                  <dd className="text-slate-600">長度 <M>n</M> 的二進位字串中，被選為「合法」的那些字串所成的集合。</dd>
                </div>
                <div>
                  <dt className="font-semibold">Codeword</dt>
                  <dd className="text-slate-600"><M>C</M> 的元素。傳送端只會送出 codeword。</dd>
                </div>
                <div>
                  <dt className="font-semibold">
                    <M>[n,k]</M> 線性碼 Linear code
                  </dt>
                  <dd className="text-slate-600">
                    把 <M>k</M> 個資訊位元編成 <M>n</M> 個位元；共有 <M>2^k</M> 個 codeword。碼率 Code rate <M>{'R = k/n'}</M>。
                  </dd>
                </div>
              </dl>
            </Card>
            <Card title="二元體 GF(2) (Binary field)">
              <p className="text-sm text-slate-600">所有運算都只在 <M>{'\\{0,1\\}'}</M> 中進行：</p>
              <Tex block>{'0+0=0,\\quad 0+1=1,\\quad 1+1=0 \\qquad (\\text{XOR})'}</Tex>
              <Tex block>{'a\\cdot b = a \\wedge b \\qquad (\\text{AND})'}</Tex>
              <p className="text-sm text-slate-600">因為 <M>1+1=0</M>，每個元素都是自己的負元：在 GF(2) 中<strong>減法就是加法</strong>。</p>
            </Card>
          </div>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="把 GF(2) 用在整串位元上">
          <LabGrid
            main={
              <Card title="向量加法：逐位 XOR">
                <Tex block>{`${VA.join('')} + ${VB.join('')} = ${VA.map((b, i) => b ^ VB[i]).join('')}`}</Tex>
                <p className="text-sm text-slate-600">
                  每一位各自做 GF(2) 加法。一個之後會一直用到的結論：<M>{'x + y'}</M> 中的 1，恰好是 <M>x</M>、<M>y</M> <strong>不同</strong>的位置；所以 <M>{'x + y = 0 \\iff x = y'}</M>。
                </p>
              </Card>
            }
            aside={
              <Card>
                <RelatedLinks links={[{ to: 'a-1', text: '完整的 GF(2) 計算器、體與特徵、為什麼 Hcᵀ = 0 是 GF(2) 計算' }]} title="想多練習單一位元的運算？" />
              </Card>
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="不同方案的代價與能力">
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
            <p className="mt-3 text-xs text-slate-500">重複碼的「修正 1 個」是指每一組 3 個重複位元中最多錯 1 個。Hamming(7,4) 用更少的冗餘達到同樣的單一錯誤修正能力。</p>
          </Card>
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="一個同位位元夠嗎？">
          <LabGrid
            main={
              <Card title="實驗：在 1011 後面加一個偶同位位元 (even parity bit)" actions={<ResetButton onClick={() => setParityErr([0, 0, 0, 0, 0])} />}>
                <p className="mb-3 text-sm text-slate-600">傳送 <span className="mono">1011</span> 加上同位位元 <span className="mono">1</span>（讓 1 的總數為偶數）。點擊位元製造錯誤。</p>
                <BitRow
                  bits={parityRecv}
                  layout={PARITY_LAYOUT}
                  states={parityErr.map((e) => (e ? 'error' : 'normal'))}
                  onToggle={(i) => setParityErr((e) => flipBit(e, i))}
                  showPositions={false}
                />
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="text-sm">
                    1 的總數 = <span className="font-mono font-bold">{parityRecv.filter(Boolean).length}</span>，檢查值 <M>{`\\sum r_i = ${parityCheck}`}</M>
                  </span>
                  {parityCheck === 0 ? (
                    nErr === 0 ? <StatusBadge status="ok" /> : <StatusBadge status="wrong" zh="未偵測到錯誤！" />
                  ) : (
                    <StatusBadge status="detected" />
                  )}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  {nErr === 0 && '試著翻轉一個位元。'}
                  {nErr === 1 && '偵測到錯誤了！但是…是哪一個位元錯？5 個位置都有可能，所以無法修正。'}
                  {nErr >= 2 && (nErr % 2 === 0 ? '偶數個錯誤讓同位檢查「恢復正常」：錯誤完全隱形。' : '奇數個錯誤會被偵測到，但同樣無法定位。')}
                </p>
              </Card>
            }
            aside={
              <Misconceptions
                items={[
                  { wrong: '同位檢查通過，就代表資料正確。', right: '只代表錯誤個數是偶數（包含 0）。兩個錯誤會互相抵銷。' },
                  { wrong: '偵測到錯誤就等於能修正錯誤。', right: '修正需要「定位」。一個檢查只能回答一個是非題，不足以指出 n 個位置中的哪一個。' },
                ]}
              />
            }
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="從「一個檢查」到「多個重疊的檢查」">
          <Callout kind="key" title="結論">
            <p>
              一個同位檢查只能回答「是否有奇數個錯」。如果使用<strong>多個彼此重疊的同位檢查</strong>，讓每個位置都被一組<em>獨特</em>的檢查覆蓋，那麼「哪些檢查失敗」就像一組座標，可以指出錯誤的位置。
              3 個檢查有 <M>{'2^3 - 1 = 7'}</M> 種非空組合，剛好對應 7 個位置——這就是 Hamming(7,4)。
            </p>
          </Callout>
          <Card icon={<ListChecks className="h-4 w-4 text-slate-500" />} title="課程地圖 Roadmap：三個部分">
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Expandable title="怎麼使用這個實驗室？" icon={<MousePointerClick className="h-4 w-4 text-emerald-600" />}>
              <ul className="list-disc space-y-1 pl-5">
                <li>方塊狀的位元都可以點擊翻轉；藍色是資訊位元，橘色是同位位元，紫色是整體同位位元。</li>
                <li>每個實驗都有「重設範例」按鈕，預設訊息是 <span className="mono">1011</span>。</li>
                <li>「逐步數學推導」區塊可以按「下一步」一步一步展開，避免一次看到太多公式。</li>
                <li>上方的流程列可以快速跳到 Why / Definition / … / Conclusion。</li>
              </ul>
            </Expandable>
            <Expandable title="所有計算都是真的" icon={<Layers className="h-4 w-4 text-indigo-500" />}>
              <p>畫面上的編碼、解碼、矩陣乘法、秩、核空間、最小距離與 Hamming Bound 都由獨立的 TypeScript 數學核心即時計算（並有窮舉單元測試驗證），不是預先寫好的答案。</p>
            </Expandable>
          </div>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}
