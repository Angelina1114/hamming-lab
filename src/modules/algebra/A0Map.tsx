import { useState, type ReactNode } from 'react';
import {
  type Bit,
  DEFAULT_U,
  G_MSB,
  LOG,
  alphaMultiplierXors,
  bchRedundancy,
  blockFailureProb,
  chienSearch,
  encodeCyclic,
  errorLocator,
  errorVector,
  gf8Bits,
  hFromGF8,
  hammingEncoderXors,
  hammingParams,
  lfsrCost,
  lfsrEncoderClocks,
  matVec,
  minimalPolynomial,
  msbToTex,
  polyToTex,
  syndromeClocks,
  syndromeTableEntries,
  vecAdd,
  wordAtAlpha,
} from '../../core';
import { sciTex } from '../../core/engineering-g1';
import { M } from '../../components/Tex';
import { Card, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain } from '../../components/alg/Unit';
import { ConceptMap } from '../../components/alg/ConceptMap';
import { MessagePicker } from '../../components/l2/Controls';

const ID = 'a-0';

/** g(x) = x⁷ + x³ + 1 (MSB-first), a primitive polynomial: it generates the cyclic Hamming(127,120) */
const G127: Bit[] = [1, 0, 0, 0, 1, 0, 0, 1];
const H7 = hammingParams(3);
const H127 = hammingParams(7);
const P_BIT = 1e-3;
const BCH2_T = 2; // BCH(127, ·) correcting 2 errors
const BCH3_T = 3; // BCH(255, ·) correcting 3 errors
const BCH2_K = 127 - bchRedundancy(7, BCH2_T);
const BCH3_K = 255 - bchRedundancy(8, BCH3_T);
const pct = (x: number) => `${Math.round(x * 100)}%`;

export default function A0Map() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [pos, setPos] = useState(2);
  const c = encodeCyclic(u).codeword;
  const r = vecAdd(c, errorVector([pos]));
  const S1 = wordAtAlpha(r);
  const root = chienSearch(errorLocator(S1)).find((x) => x.isRoot);
  const g = minimalPolynomial(1).binary!;

  const enc = lfsrCost(G_MSB);
  const journey: { to: string; title: string; body: ReactNode; hw: ReactNode }[] = [
    { to: 'a-1', title: 'GF(2)', body: <>所有位元運算都 mod 2：<M>{'1 + 1 = 0'}</M>。</>, hw: <>在電路裡，這個加法就是一個 XOR 閘。</> },
    { to: 'a-3', title: '建構 GF(8)', body: <>取 irreducible polynomial（不可約多項式）<M>{'p(x) = x^3+x+1'}</M>，<M>{'\\alpha^3 = \\alpha + 1'}</M>。</>, hw: <>這條化簡規則就是乘法電路的接線：乘以 α 只要移一格，再加 {alphaMultiplierXors(0b1011)} 個 XOR 閘。</> },
    { to: 'a-8', title: 'Minimal polynomial', body: <><M>{`(x+\\alpha)(x+\\alpha^2)(x+\\alpha^4) = ${polyToTex(g)}`}</M> = g(x)。</>, hw: <>g(x) 的係數決定 LFSR 的 feedback（回授）線接到哪幾個 register。</> },
    {
      to: 'a-5',
      title: 'Systematic encoding（系統式編碼）',
      body: <>u = {u.join('')} → <span className="mono font-bold">c = {c.join('')}</span>（LFSR 計算餘數）。</>,
      hw: <>發送端用 {enc.flipFlops} 個 register、{enc.xors} 個 XOR 閘，{lfsrEncoderClocks(H7.n, H7.k).message} 個時脈算完 parity bit；data bit（資料位元）原封不動送出。</>,
    },
    { to: 'a-9', title: 'Codeword 檢查', body: <><M>{`c(\\alpha) = 0`}</M>，等價於 <M>{`H_{\\text{cyc}}c^T = (${matVec(hFromGF8(), c).join(',')})^T`}</M>。</>, hw: <>送出去的 codeword 會讓三條 parity check（同位檢查）全部通過。</> },
    { to: 'a-10', title: '通道錯誤', body: <>錯在位置 {pos}（<M>{`x^{${7 - pos}}`}</M>）：r = <span className="mono">{r.join('')}</span>。</>, hw: <>雜訊在傳輸途中翻轉了一個位元，接收端拿到的是 r = c + e。</> },
    { to: 'a-10', title: 'Syndrome', body: <><M>{`S_1 = r(\\alpha) = \\alpha^{${LOG[S1]}}`}</M>（{gf8Bits(S1)}）。</>, hw: <>接收端用同樣 {enc.flipFlops} 個 register 的除法電路，每個時脈讀進一個位元；{syndromeClocks(H7.n)} 個時脈後留下的 {enc.flipFlops} 位元餘數，正好就是 S₁。</> },
    {
      to: 'l2-7',
      title: 'Chien search',
      body: <><M>{`\\sigma(z) = 1 + \\alpha^{${LOG[S1]}}z`}</M>，根 <M>{`z = \\alpha^{${root?.j}}`}</M> → 錯在 <M>{`x^{${root?.exponent}}`}</M> → 修正。</>,
      hw: <>電路逐一代入每個位置檢查，可以跟著輸出的資料流一個時脈查一個位置，查到就把那個位元翻回來。</>,
    },
  ];

  return (
    <AlgebraUnit
      id={ID}
      lead={
        <p>
          這一章原本是「進階：GF(8) 與 cyclic code（循環碼）」，現在擴充成完整的正式單元，放在第一課（線性代數觀點）與第二課（編碼與解碼演算法）之間。所有計算都由程式即時產生。
        </p>
      }
      takeaway={<>代數把查表換成計算：encoder 縮成幾個 register 加幾個 XOR 閘，decoder 直接算出錯誤位置。</>}
      why={{
        title: '矩陣方法夠用的地方，與它撐不住的地方',
        body: (
          <Plain>
            <p>
              第一課用 GF(2) 上的矩陣 H、G 就完整建構了 Hamming(7,4)。這是對的，而且永遠是對的。放到電路裡，encoder（編碼器）是 {hammingEncoderXors(3)} 個 XOR（exclusive OR，互斥或）閘；接收端算出 {H7.n - H7.k} 位元的 syndrome（徵狀）後查一張只有 {syndromeTableEntries(7, 4)} 格的表（第一課的排法甚至讓 syndrome 直接就是出錯位置的二進位），就知道要翻轉哪一個位元。
            </p>
            <p>
              實際的系統很少一次只送 7 個位元。code（碼）越長，redundancy（冗餘）占的比例越小：Hamming(7,4) 的 code rate（碼率）是 {H7.k}/{H7.n}，約 {pct(H7.rate)}；Hamming(127,120) 是 {H127.k}/{H127.n}，約 {pct(H127.rate)}，同樣的頻寬可以多送很多資料。代價是一個區塊裡同時出現兩個錯的機會變大：在每個位元各自以機率 <M>{'p = 10^{-3}'}</M> 翻轉的通道上，Hamming(7,4) 的 block error rate（區塊錯誤率，也就是一個區塊解不回來的機率）約 <M>{sciTex(blockFailureProb(H7.n, 1, P_BIT))}</M>，Hamming(127,120) 卻升到約 <M>{sciTex(blockFailureProb(H127.n, 1, P_BIT))}</M>；換成能更正 {BCH2_T} 個錯誤的 BCH(127,{BCH2_K}) code，降到約 <M>{sciTex(blockFailureProb(127, BCH2_T, P_BIT))}</M>。
            </p>
            <p>
              可是一旦要更正多個錯誤，矩陣加查表的做法就撐不住了。查表 decoder（解碼器）的表有 <M>{'2^{n-k}'}</M> 格：BCH(127,{BCH2_K}) 有 {bchRedundancy(7, BCH2_T)} 個 parity bit（同位位元），表要 {syndromeTableEntries(127, BCH2_K).toLocaleString('en-US')} 格；能更正 {BCH3_T} 個錯誤的 BCH(255,{BCH3_K}) 有 {bchRedundancy(8, BCH3_T)} 個 parity bit，表要 {syndromeTableEntries(255, BCH3_K).toLocaleString('en-US')} 格，每一格還得存一整個 error vector（錯誤向量）。編碼端也一樣：直接照 G 接成 parallel（平行）的 XOR 網路，光是 Hamming(127,120) 就要 {hammingEncoderXors(7)} 個 XOR 閘。
            </p>
            <p>
              這一章的 GF(8)、generator polynomial（生成多項式）、cyclic code、minimal polynomial（最小多項式），就是工程上的解法。它們<strong>不是另一種 code</strong>，而是看同一個 Hamming code 的另一種方式（這裡的 cyclic code 和第一課的 code 只差一個座標排列，A9 會證明兩者等價），它多帶來三件事：
            </p>
            <ol className="ml-5 list-decimal space-y-1">
              <li>
                <strong>更省的 encoder</strong>：整個 G 濃縮成一個多項式 g(x)，硬體是 linear feedback shift register（LFSR，線性回授移位暫存器；A5，以及第二課 2-2）。Hamming(7,4) 只要 {lfsrCost(G_MSB).flipFlops} 個 register（暫存器）和 {lfsrCost(G_MSB).xors} 個 XOR 閘，一個 register 就是一個 flip-flop（正反器），存一個位元；Hamming(127,120) 用 <M>{`g(x) = ${msbToTex(G127)}`}</M>，也只要 {lfsrCost(G127).flipFlops} 個 register 和 {lfsrCost(G127).xors} 個 XOR 閘。代價是一個時脈只處理一個位元，整個 codeword（碼字）要 {lfsrEncoderClocks(H127.n, H127.k).total} 個時脈；對本來就一個位元接一個位元送出的 serial（串列）線路，這剛好跟得上資料流。
              </li>
              <li><strong>更聰明的 decoder</strong>：syndrome 變成 GF(8) 中的一個數，錯誤位置就是它的指數；找位置 = 解方程，不必查表（A10，以及第二課 2-6、2-7）。</li>
              <li><strong>可以推廣</strong>：「選哪些根」決定 code 的能力。多選幾組 conjugate roots（共軛根）就得到能更正多個錯誤的 BCH code（A7、A8），decoder 仍然是用算的，不需要那張爆炸的表。</li>
            </ol>
            <p className="mt-3">
              這套方法也不只是課本上的例子：乙太網路（Ethernet）封包的 cyclic redundancy check（CRC，循環冗餘檢查）就是同一種多項式除法電路，快閃記憶體（flash）用 BCH code 保護資料，CD 和 QR code 用 Reed–Solomon code，它們都建立在這一章的 finite field（有限體）與多項式上。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: '概念地圖（可點擊）',
        body: <ConceptMap />,
      }}
      how={{
        title: '建議的學習順序',
        body: (
          <>
            <Plain>
              <p>
                學習順序大致跟著工程需求走：A1–A4 先打造一套「能用 XOR 閘和移位實作、而且可以做除法」的算術；A5–A8 用它決定 generator polynomial g(x)，也就是 LFSR 的接線；A9–A10 回到接收端，看 syndrome 怎麼直接算出錯誤位置。
              </p>
            </Plain>
            <Card>
              <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {[
                  ['a-1', 'GF(2)', '先確認 Hamming code 用的就是 GF(2)'],
                  ['a-2', 'GF(8)', '為什麼需要一個 8 元素的 field'],
                  ['a-3', 'Irreducible polynomial・quotient ring', 'α 到底是什麼'],
                  ['a-4', 'Primitive element', '指數 = 位置'],
                  ['a-5', 'Generator polynomial', 'G 與 g(x) 的關係'],
                  ['a-6', 'Cyclic code・ideal', '為什麼位移後還是 codeword'],
                  ['a-7', 'Frobenius・cyclotomic cosets', '根成組出現'],
                  ['a-8', 'Minimal polynomial', '為什麼 g(x) = x³+x+1'],
                  ['a-9', 'GF(8) 推導 H', '回到線性代數'],
                  ['a-10', 'Syndrome 的 GF(8) 觀點', 'S₁ = r(α)：錯誤位置 = 指數'],
                ].map(([to, t, d], k) => (
                  <li key={to}>
                    <a href={`#/${to}`} className="flex gap-3 rounded-lg border border-slate-200 p-2 hover:border-slate-400 hover:bg-slate-50">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-overall-100 text-xs font-bold text-overall-700">{k + 1}</span>
                      <span className="text-sm">
                        <strong>{t}</strong>
                        <span className="block text-xs text-slate-500">{d}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            </Card>
          </>
        ),
      }}
      example={{
        title: '一個例子走完整章',
        body: (
          <>
            <Card
              title="改變訊息或錯誤位置，每一步的值都會重新計算"
              actions={
                <>
                  <MessagePicker u={u} onChange={setU} size="sm" />
                  <select className="rounded-lg border border-slate-200 px-2 py-1 text-sm" value={pos} onChange={(e) => setPos(Number(e.target.value))} aria-label="錯誤位置">
                    {[1, 2, 3, 4, 5, 6, 7].map((p) => (
                      <option key={p} value={p}>
                        錯誤位置 {p}
                      </option>
                    ))}
                  </select>
                  <ResetButton
                    onClick={() => {
                      setU([...DEFAULT_U]);
                      setPos(2);
                    }}
                  />
                </>
              }
            >
              <ol className="space-y-2">
                {journey.map((j, k) => (
                  <li key={k} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-slate-900 text-xs font-bold text-white">{k + 1}</span>
                    <div className="flex-1 text-sm">
                      <a href={`#/${j.to}`} className="font-semibold text-overall-700 hover:underline">
                        {j.title}
                      </a>
                      <span className="ml-2 text-slate-700">{j.body}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{j.hw}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
            <Plain>
              <p>
                把每一步下面那行說明串起來，就是一條真實的傳輸鏈路：發送端的 LFSR 把 parity bit 接在資料後面送出；通道上的雜訊翻轉了位置 {pos} 的位元；接收端的 register 在 {syndromeClocks(H7.n)} 個時脈內算出 <M>{'S_1'}</M>，再逐一檢查每個位置，找到錯誤並把它翻回來。整個過程沒有查任何表，每一步都是用 XOR 閘和 register「算」出來的。
              </p>
            </Plain>
          </>
        ),
      }}
      connection={{
        title: '與第一課、第二課的關係',
        body: (
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">
              這一章做的事可以濃縮成一句話：把「錯誤位置」變成 GF(8) 裡可以計算的數。有了它，encoder 從一大片 XOR 網路縮成幾個 register 的 LFSR，decoder 從查表變成解方程；code 要多長、要能更正幾個錯，都變成「選哪一個 field（體）、選哪些根」的設計決策。第一課的矩陣是分析工具，這一章的代數是把它做成便宜電路的方法，第二課則把這些電路組成完整的編碼／解碼流程。下一單元 A1 先從最小的 finite field GF(2) 開始。
            </p>
          </Card>
        ),
        links: [
          { to: 'matrix', text: '第一課：Hamming code 的線性代數（本章的起點）' },
          { to: 'secded', text: '第一課：SECDED（d_min = 4）' },
          { to: 'a-1', text: '開始本章：GF(2)' },
          { to: 'l2-1', text: '第二課：完整的編碼／解碼流水線（本章的終點）' },
        ],
        misconceptions: [
          { wrong: '有了多項式方法，第一課的矩陣方法就過時了。', right: '兩者描述的是 equivalent code（等價碼）：只差一個座標排列（A9 證明）。矩陣適合分析，多項式適合硬體與推廣。' },
          { wrong: '要先學完抽象代數才能理解 Hamming code。', right: '第一課完全不需要；本章只介紹「理解 cyclic Hamming code 所需」的最少抽象代數。' },
          { wrong: 'LFSR 比 parallel 的 XOR 網路好，所以永遠該用 LFSR。', right: 'LFSR 是用時間換面積：一個時脈只處理一個位元。高速通訊每個時脈要處理很多位元時，常把同一個 g(x) 展開成 parallel 或部分 parallel 的電路；兩種做法算的是同一個除法。' },
        ],
      }}
    />
  );
}
