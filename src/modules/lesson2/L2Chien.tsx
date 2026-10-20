import { useState } from 'react';
import { DEFAULT_U, LOG, binomial, bitsToField, chienSearch, decodeL2, encodeCyclic, errorLocator, errorVector, syndromeL2, vecAdd } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, ResetButton, Segmented } from '../../components/Lesson';
import { AlgoSteps, BitStrip, Chapter, Checks } from '../../components/l2/Common';
import { ChienSim } from '../../components/l2/Field';
import { LookupTable } from '../../components/l2/Decode';

const ID = 'l2-7';
const C = encodeCyclic(DEFAULT_U).codeword;

const COST = [
  { n: 7, t: 1, label: 'Hamming(7,4)' },
  { n: 127, t: 1, label: 'Hamming(127,120)' },
  { n: 255, t: 2, label: 'BCH(255,239), t = 2' },
  { n: 1023, t: 3, label: 'BCH(1023,993), t = 3' },
];

export default function L2Chien() {
  const [pos, setPos] = useState(2);
  const [mode, setMode] = useState<'lookup' | 'chien'>('chien');
  const [key, setKey] = useState(0);
  const r = vecAdd(C, errorVector([pos]));
  const S = syndromeL2(r);
  const S1 = bitsToField(S);
  const dl = decodeL2(r, 'lookup');
  const dc = decodeL2(r, 'chien');
  const allAgree = [1, 2, 3, 4, 5, 6, 7].every((p) => {
    const rr = vecAdd(C, errorVector([p]));
    return decodeL2(rr, 'lookup').position === p && decodeL2(rr, 'chien').position === p;
  });

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          Chien Search 是一個「暴力但規律」的方法：把 <M>{'z = 1, \\alpha, \\alpha^2, \\dots, \\alpha^6'}</M> 依序代入 <M>{'\\sigma(z)'}</M>，哪個讓它等於 0，哪個就是根。硬體上每個時脈測一個，剛好對應一個位元位置。
        </p>
      }
      goals={[
        <>依序計算 <M>{'\\sigma(\\alpha^j)'}</M>，找出根</>,
        <>
          理解根與位置的關係：<M>{'z = \\alpha^{-i}'}</M> ⇒ 錯在 <M>{'x^i'}</M>
        </>,
        '確認 Lookup 與 Chien Search 得到相同結果',
        '比較兩種方法的用途與計算成本',
      ]}
      intuition={{
        title: '把每個候選位置都問一次',
        body: (
          <div className="prose-lab">
            <p>
              σ(z) 的設計是：如果錯誤在 <M>{'x^i'}</M>，那麼 <M>{'z = \\alpha^{-i}'}</M> 會讓 σ 變成 0。所以只要對每個可能的位置「問一次」：σ 在這裡是 0 嗎？答案是「是」的那個位置就是錯誤。
            </p>
            <p>
              GF(8) 只有 7 個非零元素，所以最多試 7 次。一般的 BCH Code 也一樣：n 個位置就試 n 次，而且每次的計算都很規律（乘以固定的 <M>{'\\alpha'}</M>），很適合硬體。
            </p>
          </div>
        ),
      }}
      math={{
        title: '為什麼根是 α 的負 i 次方？',
        body: (
          <Card>
            <Tex block>{'\\sigma(z) = 1 + Xz,\\quad X = \\alpha^i \\;\\Longrightarrow\\; \\sigma(X^{-1}) = 1 + X X^{-1} = 1 + 1 = 0'}</Tex>
            <Tex block>{'X^{-1} = \\alpha^{-i} = \\alpha^{7-i}\\quad(\\text{因為 } \\alpha^7 = 1)'}</Tex>
            <p className="text-sm text-slate-700">
              預設例子：<M>{'\\sigma(z) = 1 + \\alpha^5 z'}</M>。代入 <M>{'z = \\alpha^2'}</M>：<M>{'\\sigma(\\alpha^2) = 1 + \\alpha^{7} = 1 + 1 = 0'}</M>。所以 <M>{'\\alpha^{-i} = \\alpha^2 \\Rightarrow i = 5'}</M>，錯在 <M>{'x^5'}</M>，即從左數第 2 個 bit（位置 = 7 − i）。
            </p>
          </Card>
        ),
      }}
      algorithm={{
        title: 'Chien Search 演算法',
        body: (
          <AlgoSteps
            steps={[
              <>輸入 <M>{'\\sigma(z) = 1 + S_1z'}</M>。若 <M>{'S_1 = 0'}</M>，沒有根 → 沒有錯誤。</>,
              <>
                對 j = 0, 1, …, 6：計算 <M>{'\\sigma(\\alpha^j) = 1 + S_1\\alpha^j = 1 + \\alpha^{i+j}'}</M>（寫 <M>{'S_1 = \\alpha^i'}</M>，<M>i</M> 就是錯誤次方）。
              </>,
              <>
                找到 <M>{'\\sigma(\\alpha^j) = 0'}</M> 時，錯誤次方 <M>{'i = (7 - j) \\bmod 7'}</M>，位置 = 7 − i。
              </>,
              <>把錯誤次方交給更正邏輯（2-8）。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: '兩種模式：A. Syndrome Lookup　B. Key Equation + Chien Search',
        body: (
          <Card
            title="選擇錯誤位置，再切換兩種解碼模式"
            actions={
              <>
                <Segmented
                  value={mode}
                  onChange={(v) => {
                    setMode(v);
                    setKey((k) => k + 1);
                  }}
                  options={[
                    { value: 'lookup', label: 'A. Syndrome Lookup' },
                    { value: 'chien', label: 'B. Chien Search' },
                  ]}
                />
                <ResetButton
                  onClick={() => {
                    setPos(2);
                    setMode('chien');
                    setKey((k) => k + 1);
                  }}
                />
              </>
            }
          >
            <BitStrip
              bits={r}
              states={r.map((_, k) => (k === pos - 1 ? 'error' : 'normal'))}
              onToggle={(k) => {
                setPos(k + 1);
                setKey((x) => x + 1);
              }}
            />
            <p className="my-3 text-sm">
              <M>{`S = ${S.join('')} = S_1 = \\alpha^{${LOG[S1]}}`}</M>
            </p>
            {mode === 'chien' ? <ChienSim key={key} S1={S1} /> : <LookupTable highlightPos={dl.position} />}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className={`rounded-xl border-2 p-3 ${mode === 'lookup' ? 'border-slate-900' : 'border-slate-200'}`}>
                <div className="text-xs font-semibold text-slate-500">A. Syndrome Lookup</div>
                <div className="text-lg font-bold">位置 {dl.position}（<M>{`x^{${dl.exponent}}`}</M>）</div>
              </div>
              <div className={`rounded-xl border-2 p-3 ${mode === 'chien' ? 'border-slate-900' : 'border-slate-200'}`}>
                <div className="text-xs font-semibold text-slate-500">B. Chien Search</div>
                <div className="text-lg font-bold">位置 {dc.position}（<M>{`x^{${dc.exponent}}`}</M>）</div>
              </div>
            </div>
          </Card>
        ),
      }}
      verify={{
        title: '兩種方法一致嗎？成本差多少？',
        body: (
          <>
            <Checks
              items={[
                { label: <>目前例子：Lookup 位置 {dl.position} = Chien 位置 {dc.position}</>, pass: dl.position === dc.position && dl.position === pos },
                { label: <>7 種單一錯誤全部測試，兩種方法都找到正確位置</>, pass: allAgree },
                { label: <>預設例子：σ(α²) = 0，i = 5，位置 2</>, pass: chienSearch(errorLocator(bitsToField([1, 1, 1]))).find((c) => c.isRoot)?.j === 2 },
              ]}
            />
            <Card title="計算成本比較（以「要儲存/檢查的錯誤樣式數」估計）">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">Code</th>
                      <th>查表大小 Σ C(n,i), i ≤ t</th>
                      <th>Chien Search 代入次數</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COST.map((c) => {
                      let size = 0;
                      for (let k = 0; k <= c.t; k++) size += binomial(c.n, k);
                      return (
                        <tr key={c.label} className="border-t border-slate-100">
                          <td className="py-1.5">{c.label}</td>
                          <td className="font-mono">{size.toLocaleString()}</td>
                          <td className="font-mono">{c.n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>查表：一次查詢就有答案、延遲最低；但表格大小隨可更正的錯誤數爆炸，只適合單錯更正的短碼。</li>
                <li>Chien Search：每個位置做一次固定的 GF 乘法與加法，硬體規則、面積小，可擴展到多錯誤的 BCH / RS Code；代價是需要 n 個時脈（或平行化成多份電路）。</li>
                <li>Hamming Code（t = 1）兩種都可行；實務的 Hamming 解碼器通常直接用查表或組合邏輯，Chien Search 在這裡主要是為了理解 BCH 的一般方法。</li>
              </ul>
            </Card>
          </>
        ),
      }}
      related={[{ to: 'a-10', text: '代數背景：S₁ = r(α) 與錯誤定位數' }, { to: 'a-7', text: '共軛根與陪集（BCH 的基礎）' }]}
      next={
        <p>
          我們知道錯在第 2 個 bit。最後一步是真正「改回來」：產生錯誤向量 <span className="mono">0100000</span>，與 r 做 XOR，並驗證結果是合法 codeword。
        </p>
      }
    />
  );
}
