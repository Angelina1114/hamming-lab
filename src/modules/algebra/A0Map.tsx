import { useState, type ReactNode } from 'react';
import { type Bit, DEFAULT_U, LOG, chienSearch, encodeCyclic, errorLocator, errorVector, gf8Bits, minimalPolynomial, polyToTex, vecAdd, wordAtAlpha, matVec, hFromGF8 } from '../../core';
import { M } from '../../components/Tex';
import { Card, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain } from '../../components/alg/Unit';
import { ConceptMap } from '../../components/alg/ConceptMap';
import { MessagePicker } from '../../components/l2/Controls';

const ID = 'a-0';

export default function A0Map() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [pos, setPos] = useState(2);
  const c = encodeCyclic(u).codeword;
  const r = vecAdd(c, errorVector([pos]));
  const S1 = wordAtAlpha(r);
  const root = chienSearch(errorLocator(S1)).find((x) => x.isRoot);
  const g = minimalPolynomial(1).binary!;

  const journey: { to: string; title: string; body: ReactNode }[] = [
    { to: 'a-1', title: 'GF(2)', body: <>所有位元運算都 mod 2：<M>{'1 + 1 = 0'}</M>。</> },
    { to: 'a-3', title: '建構 GF(8)', body: <>取 <M>{'p(x) = x^3+x+1'}</M>（不可約），<M>{'\\alpha^3 = \\alpha + 1'}</M>。</> },
    { to: 'a-8', title: '最小多項式', body: <><M>{`(x+\\alpha)(x+\\alpha^2)(x+\\alpha^4) = ${polyToTex(g)}`}</M> = g(x)。</> },
    { to: 'a-5', title: '系統式編碼', body: <>u = {u.join('')} → <span className="mono font-bold">c = {c.join('')}</span>（LFSR 計算餘數）。</> },
    { to: 'a-9', title: 'Codeword 檢查', body: <><M>{`c(\\alpha) = 0`}</M>，等價於 <M>{`H_{\\text{cyc}}c^T = (${matVec(hFromGF8(), c).join(',')})^T`}</M>。</> },
    { to: 'a-10', title: '通道錯誤', body: <>錯在位置 {pos}（<M>{`x^{${7 - pos}}`}</M>）：r = <span className="mono">{r.join('')}</span>。</> },
    { to: 'a-10', title: 'Syndrome', body: <><M>{`S_1 = r(\\alpha) = \\alpha^{${LOG[S1]}}`}</M>（{gf8Bits(S1)}）。</> },
    { to: 'l2-7', title: 'Chien Search', body: <><M>{`\\sigma(z) = 1 + \\alpha^{${LOG[S1]}}z`}</M>，根 <M>{`z = \\alpha^{${root?.j}}`}</M> → 錯在 <M>{`x^{${root?.exponent}}`}</M> → 修正。</> },
  ];

  return (
    <AlgebraUnit
      id={ID}
      lead={
        <p>
          這一章原本是「進階：GF(8) 與循環碼」，現在擴充成完整的正式單元，放在第一課（線性代數觀點）與第二課（編碼與解碼演算法）之間。所有計算都由程式即時產生。
        </p>
      }
      why={{
        title: '明明線性代數已經能處理 Hamming Code，為什麼還需要這些？',
        body: (
          <Plain>
            <p>
              第一課用 GF(2) 上的矩陣 H、G 就完整建構了 Hamming(7,4)。這是對的，而且永遠是對的。這一章要說明的是：GF(8)、生成多項式、循環碼、最小多項式<strong>不是另一個 code</strong>，而是看同一個 code 的另一種方式，它多帶來三件事：
            </p>
            <ol className="ml-5 list-decimal space-y-1">
              <li><strong>更省的編碼器</strong>：整個 G 濃縮成一個多項式 g(x)，硬體是三個暫存器的 LFSR（A5，以及第二課 2-2）。</li>
              <li><strong>更聰明的解碼器</strong>：Syndrome 變成 GF(8) 中的一個數，錯誤位置就是它的指數；找位置 = 解方程（A10，以及第二課 2-6、2-7）。</li>
              <li><strong>可以推廣</strong>：「選哪些根」決定 code 的能力。多選幾組共軛根就得到能更正多個錯誤的 BCH Code（A7、A8）。</li>
            </ol>
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
          <Card>
            <ol className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[
                ['a-1', 'GF(2)', '先確認 Hamming Code 用的就是 GF(2)'],
                ['a-2', 'GF(8)', '為什麼需要一個 8 元素的體'],
                ['a-3', '不可約多項式・商環', 'α 到底是什麼'],
                ['a-4', '本原元素', '指數 = 位置'],
                ['a-5', '生成多項式', 'G 與 g(x) 的關係'],
                ['a-6', '循環碼・理想', '為什麼位移後還是 codeword'],
                ['a-7', 'Frobenius・陪集', '根成組出現'],
                ['a-8', '最小多項式', '為什麼 g(x) = x³+x+1'],
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
        ),
      }}
      example={{
        title: '一個例子走完整章',
        body: (
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
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        ),
      }}
      connection={{
        title: '與第一課、第二課的關係',
        links: [
          { to: 'matrix', text: '第一課：Hamming Code 的線性代數（本章的起點）' },
          { to: 'secded', text: '第一課：SECDED（d_min = 4）' },
          { to: 'a-1', text: '開始本章：GF(2)' },
          { to: 'l2-1', text: '第二課：完整的編碼／解碼流水線（本章的終點）' },
        ],
        misconceptions: [
          { wrong: '有了多項式方法，第一課的矩陣方法就過時了。', right: '兩者描述同一個 code（A9 證明）。矩陣適合分析，多項式適合硬體與推廣。' },
          { wrong: '要先學完抽象代數才能理解 Hamming Code。', right: '第一課完全不需要；本章只介紹「理解循環 Hamming Code所需」的最少抽象代數。' },
        ],
      }}
    />
  );
}
