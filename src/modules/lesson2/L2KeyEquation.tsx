import { useState } from 'react';
import { type Bit, ALPHA_POW, DEFAULT_U, LOG, alphaPow, bitsToField, encodeCyclic, errorLocator, errorVector, fieldToBits, positionToExponent, syndromeL2, vecAdd } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, Misconceptions, ResetButton } from '../../components/Lesson';
import { AlgoSteps, BitStrip, Chapter, Checks } from '../../components/l2/Common';
import { ThreeObjects } from '../../components/l2/Field';
import { RelatedLinks } from '../../components/alg/Links';

const ID = 'l2-6';
const C = encodeCyclic(DEFAULT_U).codeword;

export default function L2KeyEquation() {
  const [pos, setPos] = useState(2);
  const r = vecAdd(C, errorVector([pos]));
  const S = syndromeL2(r);
  const S1 = bitsToField(S);
  const i = positionToExponent(pos);
  const sigma = errorLocator(S1);

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          查表把 syndrome 當成「代號」。代數解碼則把它當成「數」：在 finite field <M>{'\\mathrm{GF}(2^3)'}</M> 中，<span className="mono">111</span> 是 <M>{'\\alpha^5'}</M>，而指數 5 正是錯誤的次方。
        </p>
      }
      goals={[
        <>
          回顧 GF(8)：<M>{'\\alpha^3 = \\alpha + 1'}</M>，7 個非零元素都是 α 的次方（完整建構見 A3、A4）
        </>,
        <>
          把 syndrome 轉成 finite field 元素：<M>{'S = 111 = \\alpha^5'}</M>
        </>,
        <>
          寫出單一錯誤的 error-locator polynomial（錯誤定位多項式）<M>{'\\sigma(z) = 1 + S_1z'}</M>
        </>,
        '區分二進位餘數、finite field 元素、error-locator polynomial',
      ]}
      intuition={{
        title: '把 syndrome 當成一個「數」',
        body: (
          <div className="prose-lab">
            <p>
              代數基礎章（A3、A4）建立了 GF(8)：8 個 3 位元字串可以相加、相乘、相除，而且 7 個非零元素剛好都是 <M>{'\\alpha'}</M> 的次方。這一章直接使用這個結果：每個非零 syndrome 都有一個「指數」，而這個指數就是錯誤的次方。接下來把它寫成一個方程式——key equation。
            </p>
          </div>
        ),
      }}
      math={{
        title: 'GF(8)、syndrome 與 key equation',
        body: (
          <>
            <Card title="GF(8) 速查（由 α³ = α + 1 計算；推導過程見 A3、A4）">
              <div className="flex flex-wrap gap-1.5">
                {ALPHA_POW.map((a, i) => (
                  <span key={i} className={`rounded-lg border px-2 py-1 text-sm ${a === S1 ? 'border-amber-400 bg-amber-100 font-semibold' : 'border-slate-200'}`}>
                    <M>{i === 0 ? '1' : i === 1 ? '\\alpha' : `\\alpha^{${i}}`}</M> <span className="font-mono text-xs text-slate-500">{fieldToBits(a).join('')}</span>
                  </span>
                ))}
              </div>
              <div className="mt-3">
                <RelatedLinks links={[{ to: 'a-3', text: '從 irreducible polynomial 建構 GF(8)，逐步化簡 α 的次方' }, { to: 'a-4', text: 'α 為什麼走遍 7 個非零元素（primitive element）' }]} title="完整推導" />
              </div>
            </Card>
            <Derivation
              title="從 syndrome 到 error-locator polynomial"
              steps={[
                { title: '在 α 代入 r(x)', body: <Tex block>{'S_1 = r(\\alpha) = c(\\alpha) + e(\\alpha) = e(\\alpha),\\quad \\text{因為 } g(\\alpha)=0 \\Rightarrow c(\\alpha) = 0'}</Tex> },
                { title: '與餘數的關係', body: <Tex block>{'r(x) = q(x)g(x) + S(x) \\Rightarrow r(\\alpha) = S(\\alpha):\\ \\text{3 位元餘數直接就是 GF(8) 元素}'}</Tex> },
                { title: '單一錯誤', body: <Tex block>{'e(x) = x^i \\Rightarrow S_1 = \\alpha^i =: X\\quad(\\text{error locator（錯誤定位數）})'}</Tex> },
                {
                  title: 'Key equation（t = 1 的情形）',
                  body: (
                    <>
                      <Tex block>{'\\sigma(z) = \\prod_{\\ell}(1 + X_\\ell z) = 1 + Xz = 1 + S_1 z'}</Tex>
                      <p>一般 BCH code 的 key equation 是 <M>{'S(z)\\sigma(z) \\equiv \\Omega(z) \\pmod{z^{2t}}'}</M>；當 t = 1 時它化簡為 <M>{'\\sigma_1 = S_1'}</M>。</p>
                    </>
                  ),
                },
                { title: '目前的例子', body: <Tex block>{`S = ${S.join('')} = ${S1 ? `\\alpha^{${LOG[S1]}}` : '0'} \\;\\Rightarrow\\; \\sigma(z) = ${sigma.length > 1 ? `1 + \\alpha^{${LOG[S1]}}z` : '1'}`}</Tex> },
              ]}
            />
          </>
        ),
      }}
      algorithm={{
        title: '代數解碼的前兩步',
        body: (
          <AlgoSteps
            steps={[
              <>計算 syndrome 餘數 <M>{'S(x) = r(x) \\bmod g(x)'}</M>（3 位元）。</>,
              <>把 3 位元解讀成 GF(8) 元素 <M>{'S_1 = s_2\\alpha^2 + s_1\\alpha + s_0'}</M>。</>,
              <>
                建立 error-locator polynomial <M>{'\\sigma(z) = 1 + S_1z'}</M>。
              </>,
              <>下一章：用 Chien search 找 <M>{'\\sigma(z)'}</M> 的根。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: '選擇錯誤位置，觀察三種物件',
        body: (
          <Card title="點擊 codeword 中的任一位元，模擬單一錯誤" actions={<ResetButton onClick={() => setPos(2)} />}>
            <BitStrip bits={r} states={r.map((_, k) => (k === pos - 1 ? 'error' : 'normal'))} onToggle={(k) => setPos(k + 1)} />
            <p className="my-3 text-sm text-slate-600">
              錯誤在位置 {pos}，即 <M>{`x^{${i}}`}</M>。
            </p>
            <ThreeObjects S={S} />
          </Card>
        ),
      }}
      verify={{
        title: '驗證 finite field 計算',
        body: (
          <>
            <Checks
              items={[
                { label: <>元素表：1, α, …, α⁶ = {ALPHA_POW.map((a) => fieldToBits(a).join('')).join(' ')}</>, pass: ALPHA_POW.map((a) => fieldToBits(a).join('')).join(' ') === '001 010 100 011 110 111 101' },
                { label: <>α⁷ = 1</>, pass: alphaPow(7) === 1 },
                { label: <>7 個非零元素都是 α 的次方</>, pass: new Set(ALPHA_POW).size === 7 },
                { label: <>錯誤在 <M>{`x^{${i}}`}</M>：<M>{`S_1 = \\alpha^{${i}}`}</M>（目前 S = {S.join('')}）</>, pass: S1 === alphaPow(i) },
                { label: <>預設例子 S = 111 = α⁵</>, pass: bitsToField([1, 1, 1] as Bit[]) === alphaPow(5) },
              ]}
            />
            <Misconceptions
              items={[
                { wrong: '111 是二進位的 7，所以 α⁷？', right: '111 表示 α² + α + 1 這個元素，它等於 α⁵。指數要查表（或逐次相乘）得到。' },
                { wrong: 'S(x) 和 σ(z) 是同一個東西。', right: 'S(x) 是 x 的多項式（餘式）；S₁ 是 GF(8) 中的一個數；σ(z) 是以 S₁ 為係數、變數為 z 的多項式。' },
              ]}
            />
          </>
        ),
      }}
      related={[{ to: 'a-3', text: 'GF(8) 的完整建構（irreducible polynomial、quotient ring）' }, { to: 'a-4', text: 'α 的次方循環與 primitive element' }, { to: 'a-8', text: 'Minimal polynomial（最小多項式）：為什麼 g(x) = x³+x+1' }]}
      next={
        <p>
          <M>{'\\sigma(z) = 1 + \\alpha^5 z'}</M> 的根是多少？對單一錯誤可以直接算 <M>{'z = \\alpha^{-5}'}</M>，但一般情況下我們用 Chien search：把 7 個非零元素一個一個代進去試。
        </p>
      }
    />
  );
}
