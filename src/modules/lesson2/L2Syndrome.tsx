import { useState } from 'react';
import { type Bit, DEFAULT_U, G_MSB, encodeCyclic, flipBit, longDivision, msbToTex, polyModMsb, runLfsr, vecAdd } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, Misconceptions, ResetButton, Segmented } from '../../components/Lesson';
import { AlgoSteps, BitStrip, Chapter, Checks, L2Legend } from '../../components/l2/Common';
import { LongDivisionView } from '../../components/l2/Division';

const ID = 'l2-4';
const C = encodeCyclic(DEFAULT_U).codeword; // 1001110
const DEFAULT_R: Bit[] = [1, 1, 0, 1, 1, 1, 0];

export default function L2Syndrome() {
  const [r, setR] = useState<Bit[]>([...DEFAULT_R]);
  const [which, setWhich] = useState<'r' | 'e'>('r');
  const [key, setKey] = useState(0);
  const e = vecAdd(r, C);
  const Sr = polyModMsb(r, G_MSB);
  const Se = polyModMsb(e, G_MSB);
  const Sc = polyModMsb(C, G_MSB);

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          接收端收到 <span className="mono">1101110</span>。它不知道原本送的是什麼，但可以做一件事：除以 <M>{'g(x)'}</M>。合法 codeword 的餘數一定是 0——所以餘數不為 0 就是「症狀」。
        </p>
      }
      goals={[
        <>
          用長除法計算 <M>{'S(x) = r(x) \\bmod g(x)'}</M>
        </>,
        <>
          證明 <M>{'S(x) = e(x) \\bmod g(x)'}</M>：Syndrome 只取決於錯誤
        </>,
        '理解 S = 0 與 S ≠ 0 各代表什麼（以及不代表什麼）',
      ]}
      intuition={{
        title: '症狀，而不是病因',
        body: (
          <div className="prose-lab">
            <p>
              醫生看到發燒（症狀）時不知道病人原本的體溫，但知道「正常人的體溫在某個範圍」。同樣地，接收端不知道 <M>c</M>，但知道「所有合法 codeword 除以 <M>{'g(x)'}</M> 的餘數都是 0」。
            </p>
            <p>
              所以接收字的餘數完全是錯誤造成的：<strong>Syndrome 是錯誤的指紋</strong>，和送了哪個 codeword 無關。
            </p>
          </div>
        ),
      }}
      math={{
        title: '完整證明：S(x) = e(x) mod g(x)',
        body: (
          <>
          <Derivation
            defaultOpen
            title="證明（逐步展開）"
            steps={[
              { title: '通道模型', body: <Tex block>{'r(x) = c(x) + e(x)\\qquad(\\text{係數在 GF(2)，加法 = XOR})'}</Tex> },
              {
                title: 'Codeword 被 g(x) 整除',
                body: (
                  <>
                    <Tex block>{'c(x) = x^3u(x) + p(x),\\quad p(x) = x^3u(x) \\bmod g(x)'}</Tex>
                    <p>
                      寫 <M>{'x^3u(x) = q(x)g(x) + p(x)'}</M>，則 <M>{'c(x) = q(x)g(x) + p(x) + p(x) = q(x)g(x)'}</M>（因為 <M>{'p + p = 0'}</M>），所以 <M>{'c(x) \\bmod g(x) = 0'}</M>。
                    </p>
                  </>
                ),
              },
              {
                title: '「mod g(x)」對加法是線性的',
                body: (
                  <p>
                    若 <M>{'a = q_1 g + \\rho_1'}</M>、<M>{'b = q_2 g + \\rho_2'}</M>，則 <M>{'a + b = (q_1+q_2)g + (\\rho_1+\\rho_2)'}</M> 且 <M>{'\\deg(\\rho_1+\\rho_2) < 3'}</M>，由餘數唯一性得 <M>{'(a+b) \\bmod g = (a \\bmod g) + (b \\bmod g)'}</M>。
                  </p>
                ),
              },
              { title: '代入', body: <Tex block>{'S(x) = r(x) \\bmod g(x) = \\underbrace{c(x) \\bmod g(x)}_{=0} + e(x) \\bmod g(x) = e(x) \\bmod g(x)\\quad\\blacksquare'}</Tex> },
              {
                title: '用目前的數字檢查',
                body: <Tex block>{`r = ${r.join('')},\\ e = r \\oplus c = ${e.join('')}:\\quad r \\bmod g = ${Sr.join('')},\\quad e \\bmod g = ${Se.join('')}`}</Tex>,
              },
            ]}
          />
          <Card title="同一個 Syndrome，三種寫法">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">語言</th>
                    <th>Syndrome</th>
                    <th>為什麼只和錯誤有關</th>
                    <th>在哪裡學</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="py-1.5 font-semibold">矩陣（GF(2) 線性代數）</td>
                    <td><M>{'s = Hr^T'}</M></td>
                    <td><M>{'Hc^T = 0 \\Rightarrow s = He^T'}</M></td>
                    <td><a className="text-indigo-700 underline" href="#/syndrome">第一課第 3 章</a></td>
                  </tr>
                  <tr className="border-t border-slate-100 bg-amber-50/60">
                    <td className="py-1.5 font-semibold">多項式（本章）</td>
                    <td><M>{'S(x) = r(x) \\bmod g(x)'}</M></td>
                    <td><M>{'c(x) \\bmod g(x) = 0 \\Rightarrow S = e \\bmod g'}</M></td>
                    <td>2-4（這裡）</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-1.5 font-semibold">有限體 GF(8)</td>
                    <td><M>{'S_1 = r(\\alpha)'}</M></td>
                    <td><M>{'c(\\alpha) = 0 \\Rightarrow S_1 = e(\\alpha)'}</M></td>
                    <td><a className="text-indigo-700 underline" href="#/a-10">代數章 A10</a></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              三者是同一個量：餘數 S(x) 的 3 個係數就是 S₁ = r(α) 的 (α², α, 1) 座標，也等於 H_cyc rᵀ（<a className="text-indigo-700 underline" href="#/a-9">A9</a> 證明）。只是第一課的 H 用的是另一種位元排列。
            </p>
          </Card>
          </>
        ),
      }}
      algorithm={{
        title: 'Syndrome 計算演算法',
        body: (
          <AlgoSteps
            steps={[
              <>把接收字 r 的 7 個位元依序送入除法器 LFSR（或做長除法）。</>,
              <>7 個時脈後，暫存器內容就是 <M>{'S(x) = r(x) \\bmod g(x)'}</M>（3 位元）。</>,
              <>S = 000：r 是合法 codeword，判定「沒有偵測到錯誤」。</>,
              <>S ≠ 000：一定有錯誤；下一章用 S 找出錯誤位置。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: '計算 r(x) mod g(x) 與 e(x) mod g(x)',
        body: (
          <Card
            title="點擊接收字的位元可修改；切換觀察 r 或 e 的除法"
            actions={
              <>
                <Segmented
                  value={which}
                  onChange={(v) => {
                    setWhich(v);
                    setKey((k) => k + 1);
                  }}
                  options={[
                    { value: 'r', label: 'r(x) ÷ g(x)' },
                    { value: 'e', label: 'e(x) ÷ g(x)' },
                  ]}
                />
                <ResetButton
                  onClick={() => {
                    setR([...DEFAULT_R]);
                    setWhich('r');
                    setKey((k) => k + 1);
                  }}
                />
              </>
            }
          >
            <div className="mb-4 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-xs font-semibold text-slate-500">送出 c</span>
                <BitStrip bits={C} size="sm" groups={false} showPos={false} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-xs font-semibold text-slate-500">接收 r（可點）</span>
                <BitStrip
                  bits={r}
                  size="sm"
                  groups={false}
                  states={e.map((b) => (b ? 'error' : 'normal'))}
                  onToggle={(i) => {
                    setR(flipBit(r, i) as Bit[]);
                    setKey((k) => k + 1);
                  }}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-24 text-xs font-semibold text-slate-500">錯誤 e = r ⊕ c</span>
                <span className="mono font-semibold text-rose-700">{e.join('')}</span>
                <span className="text-sm">
                  <M>{`e(x) = ${msbToTex(e)}`}</M>
                </span>
              </div>
              <L2Legend />
            </div>
            <LongDivisionView key={key} dividend={which === 'r' ? r : e} />
            <div className="mt-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-3 text-sm">
              <M>{`S(x) = r(x) \\bmod g(x) = ${Sr.join('')}`}</M>，<M>{`e(x) \\bmod g(x) = ${Se.join('')}`}</M> {Sr.join('') === Se.join('') ? '— 完全相同 ✓' : ''}
            </div>
          </Card>
        ),
      }}
      verify={{
        title: '三個餘數',
        body: (
          <>
            <Checks
              items={[
                { label: <>c(x) mod g(x) = {Sc.join('')}</>, pass: Sc.every((b) => b === 0), detail: '合法 codeword 的餘數為 0' },
                { label: <>r(x) mod g(x) = {Sr.join('')}，與除法器 LFSR 獨立計算的結果相同</>, pass: runLfsr(r, 'divider').final.join('') === Sr.join('') },
                { label: <>e(x) mod g(x) = {Se.join('')}，與 r 的餘數相同</>, pass: Sr.join('') === Se.join('') },
                { label: <>預設例子 r = 1101110 的 Syndrome = 111</>, pass: longDivision(DEFAULT_R, G_MSB).remainder.join('') === '111' },
              ]}
            />
            <Misconceptions
              items={[
                { wrong: 'S = 000 代表傳輸完全正確。', right: 'S = 000 只代表 r 是某個合法 codeword。若錯誤 e(x) 本身被 g(x) 整除（例如 e = 0001011），錯誤就看不見（2-10）。' },
                { wrong: '要知道送出的 c 才能算 Syndrome。', right: 'S 只用到 r。我們在畫面上顯示 c 和 e，只是為了驗證 S(r) = S(e)。' },
              ]}
            />
          </>
        ),
      }}
      related={[{ to: 'a-10', text: 'S₁ = r(α)：Syndrome 的 GF(8) 觀點' }, { to: 'a-9', text: '為什麼 r(x) mod g(x) 就是 H_cyc rᵀ' }]}
      next={
        <p>
          我們得到 <span className="mono">S = 111</span>。但「111」要怎麼變成「錯在第 2 個 bit」？它不是二進位的 7，也不是 2。下一章逐一列出 7 種單一錯誤的 Syndrome，建立查表。
        </p>
      }
    />
  );
}
