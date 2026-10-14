import { useState } from 'react';
import { type Bit, LOG, alphaPow, bitsToField, codewordsL2, errorVector, gf8Bits, gf8PolyTex, syndromeL2, vecAdd, wordAtAlpha } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, LabGrid, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { BitStrip, Checks, L2Legend } from '../../components/l2/Common';
import { AlphaCheck } from '../../components/l2/Field';

const ID = 'a-10';
const CODE = codewordsL2();
const TEACHER_R: Bit[] = [1, 1, 0, 1, 1, 1, 0];

export default function A10Syndrome() {
  const [ci, setCi] = useState(9); // u = 1001 → 1001110
  const [pos, setPos] = useState(2); // x⁵
  const c = CODE[ci].c;
  const e = errorVector(pos ? [pos] : []);
  const r = vecAdd(c, e);
  const S1 = wordAtAlpha(r);
  const i = S1 ? LOG[S1] : -1;
  const located = i >= 0 ? 7 - i : 0;
  const teacherS = wordAtAlpha(TEACHER_R);

  return (
    <AlgebraUnit
      id={ID}
      convention
      lead={<p>本章最後一步：把代數用在解碼上。因為每個 codeword 都滿足 <M>{'c(\\alpha) = 0'}</M>，接收字在 α 的值只剩下錯誤的貢獻——錯誤的位置就寫在它的指數裡。σ(z)、Chien Search 與 XOR 修正的完整操作在第二課 2-6 ~ 2-8。</p>}
      why={{
        title: '解碼就是「解方程」',
        body: (
          <Plain>
            <p>
              第一課用查表：Syndrome 等於 H 的哪一欄。有了 GF(8) 之後可以換個說法：Syndrome 是一個「數」 <M>{'S_1 = r(\\alpha)'}</M>，錯誤位置 <M>{'x^i'}</M> 滿足 <M>{'\\alpha^i = S_1'}</M>。把「找位置」寫成「解方程」，就能用 Chien Search 這種可以推廣到多錯誤 BCH Code的通用演算法。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: 'S₁ = r(α) = e(α)',
        body: (
          <>
            <Terms
              items={[
                { zh: 'Syndrome（GF(8) 版）', en: 'S₁ = r(α)', def: <>把接收字當多項式，代入 α。因為 <M>{'g(\\alpha) = 0'}</M>，它也等於 <M>{'r(x) \\bmod g(x)'}</M> 的 3 位元餘數（第二課 2-4）讀成 GF(8) 元素。</> },
                { zh: '錯誤定位數', en: 'Error locator X', def: <>單一錯誤 <M>{'e(x) = x^i'}</M> 時 <M>{'S_1 = \\alpha^i =: X'}</M>。指數 i 就是錯誤的次方，位置 = 7 − i。</> },
              ]}
            />
            <Derivation
              defaultOpen
              title="完整推導"
              steps={[
                { title: '接收字', body: <Tex block>{'r(x) = c(x) + e(x)'}</Tex> },
                { title: '代入 α', body: <Tex block>{'S_1 = r(\\alpha) = \\underbrace{c(\\alpha)}_{0\\ (\\text{A5, A9})} + e(\\alpha) = e(\\alpha)'}</Tex> },
                { title: '單一錯誤', body: <Tex block>{'e(x) = x^i \\Rightarrow S_1 = \\alpha^i'}</Tex> },
                { title: '取對數', body: <Tex block>{'i = \\log_\\alpha S_1,\\quad \\text{位置} = 7 - i\\quad(\\alpha^0,\\dots,\\alpha^6 \\text{ 兩兩相異，A4})'}</Tex> },
                {
                  title: '下一步（第二課）',
                  body: <p>寫成錯誤定位多項式 <M>{'\\sigma(z) = 1 + S_1 z'}</M>，用 Chien Search 找根（2-6、2-7），再用 XOR 修正（2-8）。</p>,
                },
              ]}
            />
          </>
        ),
      }}
      how={{
        title: '計算 S₁ = r(α)',
        body: (
          <Card
            title="選擇合法 codeword，再點一個位元製造錯誤（再點一次取消）"
            actions={
              <>
                <select className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm" value={ci} onChange={(ev) => setCi(Number(ev.target.value))}>
                  {CODE.map((x, k) => (
                    <option key={k} value={k}>
                      u = {x.u.join('')} → c = {x.c.join('')}
                    </option>
                  ))}
                </select>
                <ResetButton
                  onClick={() => {
                    setCi(9);
                    setPos(2);
                  }}
                />
              </>
            }
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-20 text-xs font-semibold text-slate-500">Codeword c</span>
                <BitStrip bits={c} size="sm" groups={false} showPos={false} />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="w-20 text-xs font-semibold text-slate-500">接收 r</span>
                <BitStrip bits={r} size="sm" groups={false} states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={(k) => setPos(pos === k + 1 ? 0 : k + 1)} />
              </div>
              <L2Legend />
            </div>
            <LabGrid
              main={
                <div className="mt-4 rounded-xl border border-slate-200 p-3">
                  <div className="mb-1 text-sm font-semibold">S₁ = r(α)，逐項相加</div>
                  <AlphaCheck word={r} name="r" />
                </div>
              }
              aside={
                <div className="mt-4 space-y-3">
                  <Card title="由 S₁ 找位置">
                    <div className="space-y-1 text-sm">
                      <div>
                        <M>{`S_1 = ${gf8PolyTex(S1)}`}</M>（{gf8Bits(S1)}）
                      </div>
                      {i >= 0 ? (
                        <>
                          <div>
                            <M>{`S_1 = \\alpha^{${i}} \\Rightarrow i = ${i}`}</M>
                          </div>
                          <div>
                            錯在 <M>{`x^{${i}}`}</M>，即從左數第 <strong>{located}</strong> 個 bit
                          </div>
                        </>
                      ) : (
                        <div>S₁ = 0：沒有偵測到錯誤</div>
                      )}
                    </div>
                  </Card>
                  <Checks
                    items={[
                      { label: <>c(α) = 0（選的是合法 codeword）</>, pass: wordAtAlpha(c) === 0 },
                      { label: <>S₁ = r(α) = e(α)</>, pass: S1 === wordAtAlpha(e) },
                      { label: <>S₁ 等於餘數 r(x) mod g(x) 讀成 GF(8) 元素</>, pass: S1 === bitsToField(syndromeL2(r)) },
                      { label: <>由指數找到的位置 = 實際錯誤位置</>, pass: located === pos },
                    ]}
                  />
                </div>
              }
            />
          </Card>
        ),
      }}
      example={{
        title: '老師的例子：c = 1001110，錯在 x⁵',
        body: (
          <Card>
            <div className="space-y-1 text-sm text-slate-700">
              <Tex block>{'r = 1101110,\\quad S_1 = r(\\alpha) = \\alpha^6 + \\alpha^5 + \\alpha^3 + \\alpha^2 + \\alpha'}</Tex>
              <Tex block>{`= ${[6, 5, 3, 2, 1].map((x) => gf8Bits(alphaPow(x))).join(' \\oplus ')} = ${gf8Bits(teacherS)} = \\alpha^{${LOG[teacherS]}}`}</Tex>
              <p>
                所以錯在 <M>{`x^{${LOG[teacherS]}}`}</M>，從左數第 {7 - LOG[teacherS]} 個 bit。上面的計算器預設就是這個例子。接下來在第二課：<M>{`\\sigma(z) = 1 + \\alpha^{${LOG[teacherS]}}z`}</M> 的 Chien Search（2-7）、XOR 修正為 1001110（2-8）。
              </p>
            </div>
          </Card>
        ),
      }}
      connection={{
        title: '本章的終點，也是第二課解碼的起點',
        body: (
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">
              同一個 Syndrome 有三種寫法：矩陣 <M>{'s = Hr^T'}</M>（第一課）、多項式 <M>{'S(x) = r(x) \\bmod g(x)'}</M>（第二課 2-4）、有限體 <M>{'S_1 = r(\\alpha)'}</M>（本單元）。三者的對照表在 2-4。多錯誤需要 BCH Code——把「一個根 α」推廣成「好幾組共軛根」，正是 A7、A8 的工具。
            </p>
          </Card>
        ),
        links: [
          { to: 'l2-4', text: '第二課：S(x) = e(x) mod g(x) 與 Syndrome 三種寫法對照' },
          { to: 'l2-6', text: '第二課：Key Equation σ(z) = 1 + S₁z' },
          { to: 'l2-7', text: '第二課：Chien Search 與查表的成本比較' },
          { to: 'l2-8', text: '第二課：XOR 更正與 ĉ(α) 驗證' },
        ],
        misconceptions: [
          { wrong: 'S₁ = 111 表示錯在第 7 個位置。', right: '111 = α²+α+1 = α⁵，表示錯在 x⁵（從左數第 2 個 bit）。要用 GF(8) 的對數，不是二進位數值。' },
          { wrong: 'r(α) 和 r(x) mod g(x) 是兩個不同的 Syndrome。', right: '因為 g(α) = 0，兩者是同一個元素：餘數的 3 個位元就是 r(α) 的 (α², α, 1) 座標。' },
          { wrong: '這個方法可以修正任意多個錯誤。', right: '只保證單一錯誤（Hamming Code t = 1）。兩個以上的錯誤見第二課 2-9、2-10。' },
        ],
      }}
    />
  );
}
