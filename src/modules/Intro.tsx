import { useState } from 'react';
import { Radio, MousePointerClick, Layers, ListChecks } from 'lucide-react';
import { type Bit, DEFAULT_MESSAGE, K4, N7, PARITY_CHECKS, codewords74, correctionCapability, flipBit, minimumDistance, vecAdd } from '../core';
import { Tex, M } from '../components/Tex';
import { BitRow } from '../components/Bits';
import { Callout, Card, Expandable, FlowBar, KeyPoint, ModuleHeader, PrevNext, ResetButton, Stage } from '../components/Lesson';
import { MODULES, type ModuleMeta } from '../lib/modules';
import { LegalBars, ParityLab } from '../components/ParityLab';

const ID = 'intro';

const PARTS = [
  { to: 'encode', tag: '第一課', title: 'Hamming code 是什麼', desc: '編碼、H 與 G、Syndrome 解碼、能力與極限、SECDED', filter: (m: ModuleMeta) => !m.group && !m.lesson && m.id !== 'intro' },
  { to: 'a-0', tag: '代數基礎與 cyclic codes', title: '從 GF(2) 走到 GF(8) 與 generator polynomial', desc: 'GF(2)、GF(8)、quotient ring、primitive element、generator polynomial、cyclic code、minimal polynomial', filter: (m: ModuleMeta) => m.group === 'algebra' },
  { to: 'l2-1', tag: '第二課', title: '編碼與解碼演算法', desc: '用多項式和移位暫存器電路做同一件事', filter: (m: ModuleMeta) => m.lesson === 2 },
];

const SENT: Bit[] = [...DEFAULT_MESSAGE];
/** k = 4 data bits; Hamming(7,4) adds ℓ = 3 parity bits and corrects t = 1 error */
const K = K4;
const L = PARITY_CHECKS.length;
const T = correctionCapability(minimumDistance(codewords74().map((x) => x.codeword)).dmin);
/** a single parity bit: (k + 1, k), e.g. the data 1011 plus its parity bit */
const SINGLE_N = K + 1;
/** ℓ = 1, 2, 3 checks: 2^ℓ − 1 failure patterns for k + ℓ positions */
const CHECK_COUNTS = [1, 2, L].map((l) => ({ l, patterns: 2 ** l - 1, positions: K + l }));
/** the number of ways to wire two checks over their k + 2 positions (all tried in parityDesign.test.ts) */
const TWO_DESIGNS = 2 ** (2 * (K + 2));

/** the parity-bit example: the data plus P, then one and two flipped bits */
const P_BIT = SENT.reduce<number>((a, b) => a ^ b, 0) as Bit;
const WITH_P: Bit[] = [...SENT, P_BIT];
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

export default function Intro() {
  // which of the 4 sent bits the noise flipped: drives the unprotected message and the error vector e
  const [flips, setFlips] = useState<number[]>([]);
  const toggle = (i: number) => setFlips((f) => (f.includes(i) ? f.filter((j) => j !== i) : [...f, i]));
  const errVec: Bit[] = SENT.map((_, i) => (flips.includes(i) ? 1 : 0));
  const raw = vecAdd(SENT, errVec);

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          這是一個 error-correcting code（ECC，錯誤更正碼）的數學實驗室：從多送一個 parity bit（同位位元）出發，走到能自己修好錯誤的 Hamming code。每章依{' '}
          <strong>情境 → 設計 → 推導 → 結論</strong> 展開，互動元件就放在它要驗證的結論後面。
        </p>
      </ModuleHeader>
      <KeyPoint>雜訊會偷偷翻轉位元：發送端多送幾個有規律的位元，接收端才能發現錯誤，甚至自己修好它。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Expandable title="怎麼使用這個實驗室？" icon={<MousePointerClick className="h-4 w-4 text-emerald-600" />}>
            <ul className="list-disc space-y-1 pl-5">
              <li>方塊狀的位元都可以點擊翻轉；藍色是 data bit，橘色是 parity bit，紫色是第 5 章的 overall parity bit。</li>
              <li>每個互動元件都有「重設範例」按鈕，預設訊息是 <span className="mono">{SENT.join('')}</span>。</li>
              <li>「逐步數學推導」區塊可以按「下一步」一步一步展開，避免一次看到太多公式。</li>
              <li>上方的流程列可以快速跳到「情境」「設計」「推導」「結論」各段。</li>
            </ul>
          </Expandable>
          <Expandable title="所有計算都是真的" icon={<Layers className="h-4 w-4 text-indigo-500" />}>
            <p>畫面上的編碼、解碼、矩陣乘法、rank、kernel、minimum distance 與 Hamming bound 都由獨立的 TypeScript 數學核心即時計算（並有窮舉單元測試驗證），不是預先寫好的答案。</p>
          </Expandable>
        </div>

        <Stage kind="why" moduleId={ID} title="雜訊會翻轉位元，接收端卻看不出來">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card icon={<Radio className="h-4 w-4 text-sky-600" />} title={`沒有保護的 ${K}-bit 訊息`}>
              <p className="mb-3 text-sm text-slate-600">
                你要傳送訊息 <span className="mono font-semibold">{SENT.join('')}</span>。點任一位元，模擬雜訊（記憶體裡的宇宙射線、無線訊號干擾）把它翻轉。
              </p>
              <div className="flex flex-wrap items-end gap-6">
                <BitRow bits={raw} plain states={raw.map((_, i) => (flips.includes(i) ? 'error' : 'normal'))} onToggle={toggle} />
                <ResetButton onClick={() => setFlips([])} />
              </div>
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700" aria-live="polite">
                {flips.length === 0 ? (
                  <>
                    接收端收到 <span className="mono">{raw.join('')}</span>，看起來一切正常。
                  </>
                ) : (
                  <>
                    接收端收到 <span className="mono font-bold text-rose-600">{raw.join('')}</span>：<strong>仍是合法的 {K}-bit 訊息，看不出來被改過。</strong>
                  </>
                )}
              </div>
            </Card>
            <Callout kind="info" title="目標與工具">
              <p>
                <strong>目標</strong>：偵測（知道有錯 → 要求重送），或更正（知道錯在哪 → 直接翻回來）。
              </p>
              <p>
                <strong>工具</strong>：redundancy（冗餘）。多送幾個位元，合法的還是 {2 ** K} 個，字串總數卻變多，錯一位就很難剛好又落在合法字串上：
              </p>
              <LegalBars />
            </Callout>
          </div>

          <Card title="翻轉 = 加 1（mod 2）：r = c + e">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="min-w-0 space-y-3 text-sm text-slate-600">
                <p>雜訊只會翻轉位元。把翻轉寫成「加 1」、不動寫成「加 0」：</p>
                <div className="flex flex-wrap items-center gap-4">
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
                    <div>加 0：不動</div>
                    <div className="text-rose-600">加 1：翻轉</div>
                  </div>
                </div>
                <p>
                  這就是 <strong>mod 2 的加法</strong>，也就是 exclusive OR（XOR，互斥或），寫成 <M>{'\\oplus'}</M>：<M>{'1+1=0'}</M>，翻兩次等於沒翻。這套算術叫 GF(2)，之後的檢查與矩陣都用它算；它為什麼是一個 field（體），見{' '}
                  <a href="#/a-1" className="font-semibold text-data-700 underline underline-offset-2">
                    A1
                  </a>
                  。
                </p>
                <p className="rounded-lg bg-amber-50 p-2 text-slate-700">
                  <strong>注意：不進位。</strong>每一位各自算，翻第 2 位不會影響第 1 位。
                </p>
              </div>
              <div className="min-w-0 space-y-3 text-sm text-slate-600">
                <p>把被翻轉的位置記成 error vector（錯誤向量）e（點 e 的位元，和上面的訊息連動）：</p>
                <BitRow bits={errVec} plain states={errVec.map((b) => (b ? 'error' : 'normal'))} onToggle={toggle} />
                <p>逐位相加，得到 received word（收到的字）r：</p>
                <Tex block>{`\\underbrace{${SENT.join('')}}_{c\\ \\text{(送出)}} + \\underbrace{${errVec.join('')}}_{e\\ \\text{(錯誤)}} = \\underbrace{${raw.join('')}}_{r\\ \\text{(收到)}}`}</Tex>
                <p>
                  因為 <M>{'1+1=0'}</M>，減法就是加法：<M>{'e = r + c'}</M>。接收端只看得到 <M>r</M>，任務是找出 <M>e</M>。
                </p>
              </div>
            </div>
          </Card>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="第一個想法：多送一個 parity bit">
          <Card title="parity bit：湊成偶數個 1">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="min-w-0 space-y-2 text-sm text-slate-700">
                <p>
                  在 {K} 個 data bit（資料位元）<M>{'D_1'}</M>–<M>{`D_${K}`}</M> 後面多送一個 parity bit <M>P</M>，讓 1 的個數是偶數，叫 even parity（偶同位）：
                </p>
                <Tex block>{`P = ${SENT.map((_, i) => `D_${i + 1}`).join(' \\oplus ')} = ${P_BIT}`}</Tex>
                <p>接收端只數 1 的個數：偶數 → 通過；奇數 → 一定有位元被翻轉過。</p>
                <p className="rounded-lg bg-amber-50 p-2 text-amber-900">錯偶數個照樣通過；抓到了也不知道是哪一位。</p>
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
                            {countText(row.w)}→ {odd ? '抓到' : 'undetected error（未偵測錯誤）'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
          <Card title="幾個名詞">
            <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
              <div>
                <dt className="font-semibold">
                  Code（碼）<M>{'C'}</M>
                </dt>
                <dd className="text-slate-600">被選為「合法」的那些 <M>n</M> 位元字串。</dd>
              </div>
              <div>
                <dt className="font-semibold">Codeword（碼字）</dt>
                <dd className="text-slate-600">
                  <M>C</M> 裡的字串；發送端只送 codeword。
                </dd>
              </div>
              <div>
                <dt className="font-semibold">
                  <M>{'(n,k)'}</M> code
                </dt>
                <dd className="text-slate-600">
                  <M>k</M> 個 data bit 編成 <M>n</M> 個位元，共 <M>{'2^k'}</M> 個 codeword；code rate（碼率）<M>{'k/n'}</M> = 資料佔的比例。
                </dd>
              </div>
            </dl>
            <p className="mt-3 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
              例：加一個 parity bit 是 <M>{`(${SINGLE_N},${K})`}</M> code，code rate <M>{`${K}/${SINGLE_N}`}</M>，<span className="mono">{WITH_P.join('')}</span> 是一個 codeword；第 1 章的 Hamming({N7},{K}) 是{' '}
              <M>{`n = ${N7},\\ k = ${K}`}</M>。
            </p>
          </Card>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="要幾個檢查，才找得到錯在哪？">
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <M>\ell</M> 個檢查各回答通過或失敗，一共 <M>{'2^\\ell'}</M> 種結果。「全部通過」留給沒有錯，剩 <M>{'2^\\ell - 1'}</M> 種要分給 <M>{`${K} + \\ell`}</M> 個位置（parity bit 自己也會錯），而且每個位置要有自己的失敗組合，所以檢查必須互相重疊。
            </p>
            <ul className="grid grid-cols-1 gap-2 md:grid-cols-3">
              {CHECK_COUNTS.map((c) => {
                const ok = c.patterns >= c.positions;
                return (
                  <li key={c.l} className={`rounded-xl border px-3 py-2 ${ok ? 'border-sky-300 bg-sky-50 text-sky-900' : 'border-orange-300 bg-orange-50 text-orange-900'}`}>
                    <strong>{c.l} 個檢查：</strong>
                    <M>{`2^{${c.l}} - 1 = ${c.patterns} ${ok ? '=' : '<'} ${c.positions}`}</M>
                    {ok ? ' 剛好夠' : ' 不夠'}
                    {c.l === 2 && <span className="block text-xs opacity-80">不管怎麼接都一樣（{TWO_DESIGNS} 種接法已全部驗證）</span>}
                  </li>
                );
              })}
            </ul>
          </div>
          <ParityLab />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title={`互相重疊的檢查，就是 Hamming(${N7},${K})`}>
          <Callout kind="key" title="結論">
            <ul className="list-disc space-y-1 pl-5">
              <li>沒有 redundancy 時，錯了也還是合法字串，接收端看不出來。</li>
              <li>
                翻轉就是 mod 2 加 1（XOR）：<M>{'r = c + e'}</M>，接收端只能靠 <M>r</M> 找出 <M>e</M>。
              </li>
              <li>一個 parity bit 只抓得到奇數個錯，也不知道錯在哪一位。</li>
              <li>
                <M>\ell</M> 個檢查只有 <M>{'2^\\ell - 1'}</M> 種「有錯」的結果：{N7} 個位置需要 {L} 個互相重疊的檢查，就是 Hamming({N7},{K})，只多送 {N7 - K} 位就能修好任何 {T} 個錯（第 1 章）。
              </li>
            </ul>
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
