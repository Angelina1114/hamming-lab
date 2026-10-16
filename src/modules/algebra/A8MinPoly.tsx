import { useMemo, useState } from 'react';
import {
  type Bit,
  allMinimalPolynomials,
  alphaPow,
  gf8Bits,
  gf8PolyTex,
  gf8PowTex,
  gfPolyEval,
  gfPolyTex,
  minimalPolynomial,
  polyMulTrace,
  polyToMsb,
  polyToTex,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, LabGrid, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';
import { PolyMulTable } from '../../components/alg/PolyViews';

const ID = 'a-8';
const SUP = '⁰¹²³⁴⁵⁶';
const powTex = (e: number) => (e === 0 ? '1' : e === 1 ? '\\alpha' : `\\alpha^{${e}}`);

export default function A8MinPoly() {
  const [s, setS] = useState(1);
  const mp = useMemo(() => minimalPolynomial(s), [s]);
  const all = allMinimalPolynomials();
  const toMsb = (p: number[]) => polyToMsb(p as Bit[], p.length);
  // (x+1)(x³+x+1) then × (x³+x²+1), shown as two multiplications
  const t1 = polyMulTrace(toMsb(all[0].binary!), toMsb(all[1].binary!));
  const t2 = polyMulTrace(t1.result, toMsb(all[2].binary!));

  return (
    <AlgebraUnit
      id={ID}
      lead={<p>A7 告訴我們：α、α²、α⁴ 必須一起當根。把這三個因式乘起來，GF(8) 的係數會神奇地全部化簡成 0 或 1——得到一個 GF(2) 多項式。它就是 α 的最小多項式，也就是 Hamming Code 的生成多項式。</p>}
      why={{
        title: '我們要找「以 α 為根的 GF(2) 多項式」',
        body: (
          <Plain>
            <p>
              codeword 是 GF(2) 多項式（係數是位元），而我們要求每個 codeword 滿足 <M>{'c(\\alpha) = 0'}</M>。所以 <M>{'g(x)'}</M> 也必須是 GF(2) 多項式、以 α 為根。在所有這種多項式中，次數最小的那一個能讓 code 的維度 <M>{'k = 7 - \\deg g'}</M> 最大——它就是<strong>最小多項式</strong>。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: '最小多項式（Minimal Polynomial）',
        body: (
          <Terms
            items={[
              { zh: '最小多項式 m_β(x)', en: 'Minimal Polynomial', def: <>以 β 為根、係數在 GF(2)、首項係數為 1、次數最小的多項式。</> },
              { zh: '共軛元素連乘', en: 'Product over Conjugates', def: <><M>{'m_\\beta(x) = \\prod_{\\gamma \\in \\{\\beta, \\beta^2, \\beta^4, \\dots\\}} (x + \\gamma)'}</M>：把 β 的所有共軛元素當根乘起來。</> },
              { zh: 'Frobenius 不變性：係數只能是 0/1', en: 'Frobenius Invariance', def: <>對 <M>{'m_\\beta'}</M> 做 Frobenius 只會把共軛元素互相交換，所以多項式不變；每個係數 <M>a</M> 都滿足 <M>{'a^2 = a'}</M>，只能是 0 或 1。</> },
              { zh: '整除性', en: 'Divisibility', def: <>任何以 β 為根的 GF(2) 多項式都被 <M>{'m_\\beta(x)'}</M> 整除，而且 <M>{'m_\\beta'}</M> 不可約。</> },
            ]}
          />
        ),
      }}
      how={{
        title: 'Minimal Polynomial 推導器',
        body: (
          <LabGrid
            main={
              <Card title="選擇 GF(8) 的非零元素 β = αˢ" actions={<ResetButton onClick={() => setS(1)} />}>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map((e) => (
                    <button key={e} onClick={() => setS(e)} className={`chip border ${e === s ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
                      {e === 0 ? '1' : `α${SUP[e]}`} <span className="font-mono text-[10px] opacity-70">{gf8Bits(alphaPow(e))}</span>
                    </button>
                  ))}
                </div>
                <ol className="space-y-1.5 text-sm">
                  <li>
                    <strong>1. 元素</strong>：<M>{`\\beta = ${powTex(s)} = ${gf8PolyTex(alphaPow(s))}`}</M> <span className="font-mono">{gf8Bits(alphaPow(s))}</span>
                  </li>
                  <li>
                    <strong>2. Frobenius 共軛</strong>：<M>{mp.coset.map(powTex).join(' \\to ') + ` \\to ${powTex(mp.coset[0])}`}</M>
                  </li>
                  <li>
                    <strong>3. Cyclotomic Coset</strong>：<M>{`C_{${Math.min(...mp.coset)}} = \\{${mp.coset.join(', ')}\\}`}</M>
                  </li>
                  <li>
                    <strong>4. 最小多項式</strong>：<M>{`m_\\beta(x) = ${mp.coset.map((e) => `(x + ${powTex(e)})`).join('')} = ${mp.binary ? polyToTex(mp.binary) : gfPolyTex(mp.poly)}`}</M>
                  </li>
                </ol>
                <div className="mt-3">
                  <Derivation
                    key={s}
                    defaultOpen
                    title="5. 逐步乘開並在 GF(8) 中化簡"
                    steps={mp.steps.map((st, k) => ({
                      title: `第 ${k + 1} 步：乘上 (x + ${['1', 'α', 'α²', 'α³', 'α⁴', 'α⁵', 'α⁶'][mp.coset[k]]})`,
                      body: (
                        <div className="space-y-1">
                          <Tex block>{`(${gfPolyTex(st.left)})(${gfPolyTex(st.factor)})`}</Tex>
                          <div className="space-y-0.5 text-xs">
                            {st.rawTerms
                              .map((terms, deg) => ({ terms, deg }))
                              .reverse()
                              .filter((x) => x.terms.length > 0)
                              .map(({ terms, deg }) => (
                                <div key={deg}>
                                  <Tex>{`${deg === 0 ? '\\text{常數項}' : deg === 1 ? 'x' : `x^{${deg}}`}:\\ ${terms.map(powTex).join(' + ')} = ${gf8PowTex(st.product[deg])}${terms.length > 1 ? `\\quad (${terms.map((e) => gf8Bits(alphaPow(e))).join(' \\oplus ')} = ${gf8Bits(st.product[deg])})` : ''}`}</Tex>
                                </div>
                              ))}
                          </div>
                          <Tex block>{`= ${gfPolyTex(st.product)}`}</Tex>
                        </div>
                      ),
                    }))}
                  />
                </div>
              </Card>
            }
            aside={
              <>
                <Card title="根的驗證：m_β(γ) 對所有非零 γ">
                  <table className="w-full text-sm">
                    <tbody>
                      {[0, 1, 2, 3, 4, 5, 6].map((e) => {
                        const v = gfPolyEval(mp.poly, alphaPow(e));
                        const isConj = mp.coset.includes(e);
                        return (
                          <tr key={e} className={`border-t border-slate-100 ${isConj ? 'bg-overall-50' : ''}`}>
                            <td className="py-1">
                              <M>{`m_\\beta(${powTex(e)})`}</M>
                            </td>
                            <td>
                              <M>{`= ${gf8PowTex(v)}`}</M>
                            </td>
                            <td className="text-xs">{v === 0 ? '✓ 根' : ''}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
                <Checks
                  items={[
                    { label: '所有係數都在 GF(2)', pass: mp.binary !== null },
                    { label: '每個共軛元素都是根', pass: mp.rootsOk },
                    { label: `次數 = 陪集大小 = ${mp.coset.length}`, pass: mp.poly.length - 1 === mp.coset.length },
                  ]}
                />
              </>
            }
          />
        ),
      }}
      example={{
        title: 'x⁷ − 1 = (x+1)(x³+x+1)(x³+x²+1)',
        body: (
          <>
            <Card>
              <p className="text-sm text-slate-700">
                每個非零元素都滿足 <M>{'\\beta^7 = 1'}</M>，所以都是 <M>{'x^7 - 1'}</M> 的根。把三個陪集的最小多項式乘起來，就得到 <M>{'x^7 - 1'}</M>（GF(2) 中 <M>{'-1 = +1'}</M>）：
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {all.map((m) => (
                  <div key={m.exp} className="rounded-lg bg-slate-50 p-2 text-sm">
                    <M>{`C_{${m.coset[0]}}=\\{${m.coset.join(',')}\\}`}</M>
                    <div>
                      <M>{polyToTex(m.binary!)}</M>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <LabGrid
              main={
                <Card title="驗算（真正的 GF(2) 多項式乘法）">
                  <div className="space-y-3">
                    <PolyMulTable t={t1} aName="(x+1)" bName="x³+x+1" />
                    <PolyMulTable t={t2} aName="上式" bName="x³+x²+1" />
                  </div>
                  <Tex block>{`= ${polyToTex([...t2.result].reverse() as Bit[])}`}</Tex>
                </Card>
              }
              aside={
                <Card title="為什麼 g(x) = m_α(x)？">
                  <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                    <li>要求 <M>{'c(\\alpha) = 0'}</M> ⇔ <M>{'m_\\alpha(x) \\mid c(x)'}</M>（最小多項式的整除性）。</li>
                    <li>
                      所以 code = <M>{'m_\\alpha'}</M> 的所有倍數，<M>{'g(x) = m_\\alpha(x) = x^3+x+1'}</M>，<M>{'k = 7 - 3 = 4'}</M>。
                    </li>
                    <li>
                      <M>{'g'}</M> 必須整除 <M>{'x^7 - 1'}</M>（A6）——它確實是因式之一。
                    </li>
                    <li>
                      若改用 <M>{'m_{\\alpha^3} = x^3+x^2+1'}</M>，得到另一個等價的 Hamming Code；若用 <M>{'(x+1)m_\\alpha'}</M>，得到 [7,3,4] 的偶重量子碼。BCH Code 就是「多選幾個陪集」。
                    </li>
                  </ul>
                </Card>
              }
            />
          </>
        ),
      }}
      connection={{
        title: '從抽象的根回到具體的 g(x)',
        links: [
          { to: 'a-7', text: '上一步：共軛元素與陪集' },
          { to: 'a-9', text: '下一步：c(α) = 0 寫成矩陣就是 H' },
          { to: 'a-5', text: '回顧：g(x) 如何用來編碼' },
          { to: 'l2-2', text: '第二課：LFSR 的接線由 g(x) 的係數決定' },
        ],
        misconceptions: [
          { wrong: 'α 的最小多項式是 x − α。', right: 'x − α 的係數不在 GF(2)。在 GF(2) 中，α 的最小多項式必須同時包含 α² 與 α⁴，是三次的 x³+x+1。' },
          { wrong: '每個元素的最小多項式都不同。', right: '共軛元素共用同一個最小多項式：α、α²、α⁴ 都是 x³+x+1 的根。' },
          { wrong: '1 的最小多項式是 1。', right: '元素 1 = α⁰ 的最小多項式是 x + 1（以 1 為根），對應陪集 C₀ = {0}。' },
        ],
      }}
    />
  );
}
