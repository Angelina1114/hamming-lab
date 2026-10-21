import { useMemo, useState } from 'react';
import {
  type Bit,
  allMinimalPolynomials,
  alphaPow,
  correctionCapability,
  cosetOrbit,
  gf8Bits,
  gf8PolyTex,
  gf8PowTex,
  gfPolyEval,
  gfPolyTex,
  lfsrCost,
  minimalPolynomial,
  msbToTex,
  polyMulTrace,
  polyToMsb,
  polyToTex,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, LabGrid, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';
import { PolyMulTable } from '../../components/alg/PolyViews';
import { cyclicCodeMenu, maskToMsb } from '../../core/engineering-g4';

const ID = 'a-8';
const SUP = '⁰¹²³⁴⁵⁶';
const powTex = (e: number) => (e === 0 ? '1' : e === 1 ? '\\alpha' : `\\alpha^{${e}}`);
// every non-trivial cyclic code of length 7: g(x) = a product of the factors of x⁷ − 1
const N7 = 7;
const MENU = cyclicCodeMenu(N7);
const byG = (g: number) => MENU.find((o) => o.g === g)!;
const HAM = byG(0b1011); // x³+x+1 = m_α
const MIRROR = byG(0b1101); // x³+x²+1 = m_{α³}
const EVEN = byG(0b11101); // (x+1)(x³+x+1)
const REP = byG(0b1111111); // (x³+x+1)(x³+x²+1) = 1 + x + … + x⁶
const maskTex = (p: number) => msbToTex(maskToMsb(p));
/** what a code with this d_min can do: correct t, and detect d − 1 − t while correcting */
const ability = (d: number) => {
  const t = correctionCapability(d);
  if (t === 0) return `偵測 ${d - 1} 個錯`;
  return d - 1 - t > t ? `更正 ${t} 個、同時偵測 ${d - 1 - t} 個` : `更正 ${t} 個錯`;
};

export default function A8MinPoly() {
  const [s, setS] = useState(1);
  const mp = useMemo(() => minimalPolynomial(s), [s]);
  const all = allMinimalPolynomials();
  const toMsb = (p: number[]) => polyToMsb(p as Bit[], p.length);
  // (x+1)(x³+x+1) then × (x³+x²+1), shown as two multiplications
  const t1 = polyMulTrace(toMsb(all[0].binary!), toMsb(all[1].binary!));
  const t2 = polyMulTrace(t1.result, toMsb(all[2].binary!));
  const mpMsb = mp.binary ? toMsb(mp.binary) : null;
  const mpCost = mpMsb ? lfsrCost(mpMsb) : null;

  return (
    <AlgebraUnit
      id={ID}
      lead={<p><M>{'(x+\\alpha)(x+\\alpha^2)(x+\\alpha^4)'}</M> 乘開之後，GF(8) 的係數會神奇地全部化簡成 0 或 1——得到一個 GF(2) 多項式。它就是 α 的最小多項式，也就是 Hamming Code 的生成多項式。</p>}
      takeaway={<>最小多項式是以 α 為根、次數最低的 GF(2) 多項式；當 g(x) 時暫存器最少、資料位元最多。</>}
      why={{
        title: '我們要找「以 α 為根的 GF(2) 多項式」',
        body: (
          <Plain>
            <p>
              A5 的編碼器是照 <M>{'g(x)'}</M> 接線的 LFSR：<M>{'g(x)'}</M> 有幾次，就要幾個暫存器、送幾個同位位元；最高次項以外的每個 1，都是一條回授線。所以「選 <M>{'g(x)'}</M>」不只是代數問題，選定的那一刻，電路大小和碼率（code rate）也一起定了。
            </p>
            <p>
              codeword 是 GF(2) 多項式（係數是位元），而我們要求每個 codeword 滿足 <M>{'c(\\alpha) = 0'}</M>。所以 <M>{'g(x)'}</M> 也必須是 GF(2) 多項式、以 α 為根。在所有這種多項式中，次數最小的那一個能讓 code 的維度 <M>{'k = 7 - \\deg g'}</M> 最大——它就是<strong>最小多項式</strong>。
            </p>
            <p>
              其他以 α 為根的 GF(2) 多項式也能當 <M>{'g(x)'}</M>，但它們都是最小多項式的倍數（下面的「整除性」），次數只會更高。例如多乘一個 <M>{'(x+1)'}</M>，就要多 {EVEN.flipFlops - HAM.flipFlops} 個暫存器、少送 {HAM.k - EVEN.k} 個資料位元。這樣做有時值得（它換來更大的 <M>{'d_{\\min}'}</M>，例題的表格會算給你看），但如果目標只是「以 α 為根、更正 {correctionCapability(HAM.dmin)} 個錯」，最小多項式就是最便宜的答案。
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
                {mpMsb && mpCost && (
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    若拿 <M>{'m_\\beta(x)'}</M> 當生成多項式，係數寫成 <span className="mono">{mpMsb.join('')}</span>：LFSR 需要 {mpCost.flipFlops} 個暫存器（= 次數 = 陪集大小），加上 {mpCost.xors} 個 XOR 閘；最高次項以外的每個 1 就是一條回授線。陪集越大，暫存器越多、同位位元也越多。
                  </p>
                )}
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
            <Card title={`長度 ${N7} 的循環碼：從 x⁷ − 1 的因式挑 g(x)`}>
              <p className="text-sm leading-relaxed text-slate-700">
                A6 說 <M>{'g(x)'}</M> 必須整除 <M>{'x^7 - 1'}</M>，所以上面三個最小多項式就是工程師的全部零件：長度 {N7} 的循環碼只有下面 {MENU.length} 種（扣掉 <M>{'g = 1'}</M> 完全不保護、<M>{'g = x^7 - 1'}</M> 只剩全 0 兩個極端）。每一種都能用同一種 LFSR 當編碼器，表中數字全部由程式計算。
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">g(x)</th>
                      <th>暫存器 = 同位位元</th>
                      <th>XOR 閘</th>
                      <th>碼率 k/n</th>
                      <th><M>{'d_{\\min}'}</M></th>
                      <th>能力</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MENU.map((o) => (
                      <tr key={o.g} className={`border-t border-slate-100 ${o.g === HAM.g ? 'bg-overall-50' : ''}`}>
                        <td className="py-1.5">
                          <M>{o.factors.length > 1 ? o.factors.map((f) => `(${maskTex(f)})`).join('') : maskTex(o.g)}</M>
                          {o.factors.length > 1 && (
                            <div className="text-xs text-slate-500">
                              <M>{`= ${maskTex(o.g)}`}</M>
                            </div>
                          )}
                        </td>
                        <td className="font-mono">{o.flipFlops}</td>
                        <td className="font-mono">{o.xors}</td>
                        <td className="font-mono">
                          {o.k}/{N7}
                        </td>
                        <td className="font-mono">{o.dmin}</td>
                        <td>{ability(o.dmin)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                <p>
                  Hamming Code 選的是 <M>{maskTex(HAM.g)}</M>：{HAM.flipFlops} 個暫存器、{HAM.xors} 個 XOR 閘，碼率 {HAM.k}/{N7}，{ability(HAM.dmin)}。再乘上 <M>{'(x+1)'}</M>，多 {EVEN.flipFlops - HAM.flipFlops} 個暫存器、{EVEN.xors - HAM.xors} 個 XOR 閘，碼率降到 {EVEN.k}/{N7}，換來的是 <M>{'d_{\\min}'}</M> 從 {HAM.dmin} 升到 {EVEN.dmin}，和第一課的 SECDED 一樣能{ability(EVEN.dmin)}。差別在於 SECDED 是多加一個整體同位位元、把碼長加長，資料位元仍是 {HAM.k} 個；這裡碼長固定為 {N7}，只好少送 {HAM.k - EVEN.k} 個資料位元。
                </p>
                <p>
                  兩個三次因式都乘上，就是把 {REP.k} 個 bit 重複送 {N7} 次的重複碼：<M>{`d_{\\min} = ${REP.dmin}`}</M>，但碼率只剩 {REP.k}/{N7}。（重複碼實際上直接複製 bit 就好，不需要 LFSR；這一列的暫存器與 XOR 閘是照同一種接法的成本。）
                </p>
                <p>
                  <M>{maskTex(HAM.g)}</M> 與 <M>{maskTex(MIRROR.g)}</M> 兩列的數字完全相同。後者的根 <M>{'\\alpha^3, \\alpha^6, \\alpha^5'}</M> 正是 <M>{'\\alpha^4, \\alpha, \\alpha^2'}</M> 的倒數，所以係數左右顛倒（<span className="mono">{HAM.gMsb.join('')}</span> ↔ <span className="mono">{MIRROR.gMsb.join('')}</span>）：LFSR 是鏡像接法，code 則是把每個 codeword 前後倒過來讀。兩者暫存器、XOR 閘與 <M>{'d_{\\min}'}</M> 都一樣，選哪一個只是約定。
                </p>
              </div>
            </Card>
          </>
        ),
      }}
      connection={{
        title: '從抽象的根回到具體的 g(x)',
        body: (
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">
              A7、A8 合起來是一條設計流程：先決定要哪些根（要更正幾個錯），Frobenius 把每個根擴成整個陪集，每個陪集的因式乘開是一個最小多項式，用到的最小多項式再相乘就是 <M>{'g(x)'}</M>；<M>{'g(x)'}</M> 的係數直接變成第二課 LFSR 的接線。Hamming Code 只要 α：陪集 <M>{`\\{${cosetOrbit(1).join(', ')}\\}`}</M> → <M>{maskTex(HAM.g)}</M> → {HAM.flipFlops} 個暫存器、{HAM.xors} 個 XOR 閘的編碼器（第二課 2-2）。下一單元 A9 換個方向，回到第一課的矩陣 H，看它和 <M>{'c(\\alpha) = 0'}</M> 是什麼關係。
            </p>
          </Card>
        ),
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
          { wrong: '選 x³+x+1 還是 x³+x²+1 當 g(x)，更正能力會不一樣。', right: <>兩者互為倒數多項式：LFSR 是鏡像接法，暫存器、XOR 閘與 <M>{'d_{\\min}'}</M> 都相同，只是 codeword 前後顛倒。</> },
        ],
      }}
    />
  );
}
