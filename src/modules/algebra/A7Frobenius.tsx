import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  GF8_ELEMENTS,
  alphaPow,
  cosetOrbit,
  cyclotomicCosets,
  encodeNonSystematic,
  frobenius,
  gf8Add,
  gf8Bits,
  gf8Mul,
  gf8PolyTex,
  gf8PowTex,
  gfPolyEval,
  intToBits,
  msbToTex,
  wordAtAlphaPower,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, LabGrid, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';
import { StepControls, useStepper } from '../../components/l2/Stepper';

const ID = 'a-7';
const CODE = Array.from({ length: 16 }, (_, i) => ({ m: intToBits(i, 4), c: encodeNonSystematic(intToBits(i, 4)) }));
const SUP = '⁰¹²³⁴⁵⁶';

export default function A7Frobenius() {
  const [start, setStart] = useState(1);
  const orbit = useMemo(() => cosetOrbit(start), [start]);
  const steps = useStepper(orbit.length + 1, { interval: 1000 });
  const [a, setA] = useState(3);
  const [b, setB] = useState(6);
  const [ci, setCi] = useState(11);
  const c = CODE[ci].c;

  const frobAdd = GF8_ELEMENTS.every((x) => GF8_ELEMENTS.every((y) => frobenius(gf8Add(x, y)) === gf8Add(frobenius(x), frobenius(y))));
  const frobMul = GF8_ELEMENTS.every((x) => GF8_ELEMENTS.every((y) => frobenius(gf8Mul(x, y)) === gf8Mul(frobenius(x), frobenius(y))));
  const frobBij = new Set(GF8_ELEMENTS.map(frobenius)).size === 8;

  const R = 115;
  const pt = (e: number) => {
    const t = (e / 7) * 2 * Math.PI - Math.PI / 2;
    return { x: 150 + R * Math.cos(t), y: 150 + R * Math.sin(t) };
  };
  const visited = orbit.slice(0, Math.min(steps.step + 1, orbit.length));
  const closed = steps.step >= orbit.length;

  return (
    <AlgebraUnit
      id={ID}
      lead={<p>每個 codeword 都滿足 <M>{'c(\\alpha) = 0'}</M>。這一單元發現：只要係數在 GF(2)，就<strong>自動</strong>還有 <M>{'c(\\alpha^2) = 0'}</M>、<M>{'c(\\alpha^4) = 0'}</M>。找出這些「免費附送」的根，就是設計 g(x) 的關鍵。</p>}
      why={{
        title: '一個根會帶出其他的根',
        body: (
          <Plain>
            <p>
              要知道 <M>{'g(x)'}</M> 應該長什麼樣子，我們需要知道「所有 codeword 共同的根」有哪些。A5 告訴我們 α 是根。但如果 α 是根而 α² 不是，那麼我們想要的 <M>{'g(x)'}</M> 就必須有係數在 GF(8) 中的因式 <M>{'(x + \\alpha)'}</M>——不是 GF(2) 多項式，無法用 0/1 位元表示。
            </p>
            <p>
              好消息：GF(2) 係數的多項式有個特性——如果 β 是根，β² 也一定是根。這個「平方」叫 Frobenius 映射，它把根分成一組一組的「共軛元素」。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: 'Frobenius 自同構、共軛元素與 Cyclotomic Cosets',
        body: (
          <>
            <Derivation
              defaultOpen
              title="為什麼 (a + b)² = a² + b²？"
              steps={[
                { title: '照常展開', body: <Tex block>{'(a+b)^2 = a^2 + ab + ba + b^2 = a^2 + 2ab + b^2'}</Tex> },
                { title: '特徵 2：任何元素加兩次都是 0', body: <Tex block>{'2ab = ab + ab = 0'}</Tex> },
                { title: '結論（「新生的夢」）', body: <Tex block>{'(a+b)^2 = a^2 + b^2'}</Tex> },
              ]}
            />
            <Terms
              items={[
                { zh: 'Frobenius 映射', en: 'Frobenius map φ(a) = a²', def: <>保持加法 <M>{'\\varphi(a+b) = \\varphi(a)+\\varphi(b)'}</M>、保持乘法 <M>{'\\varphi(ab) = \\varphi(a)\\varphi(b)'}</M>，而且一對一。</> },
                { zh: '自同構', en: 'Automorphism', def: <>從一個體到自己、保持加法和乘法的一對一映成。可以想成「重新命名元素但不改變運算結構」。</> },
                { zh: '共軛元素', en: 'Conjugates', def: <>β, β², β⁴, … 一直平方直到回到 β。它們在 GF(2) 多項式的眼中「無法區分」：是根就一起是根。</> },
                { zh: '分圓陪集', en: 'Cyclotomic Coset', def: <>只看指數：<M>{'\\alpha^i \\mapsto \\alpha^{2i}'}</M>，指數做 <M>{'i \\to 2i \\bmod 7'}</M>。例如 <M>{'C_1 = \\{1, 2, 4\\}'}</M>。</> },
              ]}
            />
            <LabGrid
              main={
                <Card title="Frobenius 表：a → a²">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {GF8_ELEMENTS.map((x) => (
                      <div key={x} className="rounded-lg border border-slate-200 p-2 text-center text-sm">
                        <M>{`${gf8PowTex(x)} \\mapsto ${gf8PowTex(frobenius(x))}`}</M>
                        <div className="font-mono text-xs text-slate-500">
                          {gf8Bits(x)} → {gf8Bits(frobenius(x))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                    自己驗證：a =
                    <select className="rounded border border-slate-200 px-1 font-mono" value={a} onChange={(e) => setA(Number(e.target.value))}>
                      {GF8_ELEMENTS.map((x) => (
                        <option key={x} value={x}>
                          {gf8Bits(x)}
                        </option>
                      ))}
                    </select>
                    b =
                    <select className="rounded border border-slate-200 px-1 font-mono" value={b} onChange={(e) => setB(Number(e.target.value))}>
                      {GF8_ELEMENTS.map((x) => (
                        <option key={x} value={x}>
                          {gf8Bits(x)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Tex block>{`(a+b)^2 = (${gf8PolyTex(gf8Add(a, b))})^2 = ${gf8PolyTex(frobenius(gf8Add(a, b)))},\\quad a^2 + b^2 = ${gf8PolyTex(frobenius(a))} + ${gf8PolyTex(frobenius(b))} = ${gf8PolyTex(gf8Add(frobenius(a), frobenius(b)))}`}</Tex>
                </Card>
              }
              aside={
                <Checks
                  title="Frobenius 是自同構（窮舉 64 組）"
                  items={[
                    { label: '保持加法 φ(a+b) = φ(a)+φ(b)', pass: frobAdd },
                    { label: '保持乘法 φ(ab) = φ(a)φ(b)', pass: frobMul },
                    { label: '一對一且映成（8 個像兩兩不同）', pass: frobBij },
                  ]}
                />
              }
            />
          </>
        ),
      }}
      how={{
        title: 'Cyclotomic Cosets 互動圖：i → 2i mod 7',
        body: (
          <LabGrid
            main={
              <Card
                title="選擇起始指數 i，按「下一步」一直乘以 2"
                actions={
                  <ResetButton
                    onClick={() => {
                      setStart(1);
                      steps.reset();
                    }}
                  />
                }
              >
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setStart(i);
                        steps.reset();
                      }}
                      className={`chip border ${i === start ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}
                    >
                      i = {i}
                    </button>
                  ))}
                </div>
                <StepControls s={steps} label={closed ? '回到起點，陪集完成' : `目前指數 ${visited[visited.length - 1]}`} />
                <svg viewBox="0 0 300 300" className="mx-auto mt-2 w-full max-w-[320px]">
                  <defs>
                    <marker id="cc-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
                      <path d="M0,0 L10,5 L0,10 z" fill="#7638dc" />
                    </marker>
                  </defs>
                  {visited.slice(0, -1).map((e, k) => {
                    const p = pt(e);
                    const q = pt(visited[k + 1]);
                    return <motion.line key={`${e}-${k}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#7638dc" strokeWidth={2.5} markerEnd="url(#cc-arr)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />;
                  })}
                  {closed && orbit.length > 1 && (() => {
                    const p = pt(orbit[orbit.length - 1]);
                    const q = pt(orbit[0]);
                    return <motion.line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#7638dc" strokeWidth={2.5} strokeDasharray="5 4" markerEnd="url(#cc-arr)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />;
                  })()}
                  {[0, 1, 2, 3, 4, 5, 6].map((e) => {
                    const p = pt(e);
                    const on = visited.includes(e);
                    return (
                      <g key={e}>
                        <circle cx={p.x} cy={p.y} r={22} fill={on ? '#ede4ff' : '#fff'} stroke={on ? '#7638dc' : '#cbd5e1'} strokeWidth={on ? 3 : 1.5} />
                        <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
                          {e === 0 ? '1' : `α${SUP[e]}`}
                        </text>
                        <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="#64748b">
                          {gf8Bits(alphaPow(e))}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                <div className="text-center text-sm">
                  {visited.map((e, k) => (
                    <span key={k}>
                      {k > 0 && ` → (×2 mod 7) → `}
                      <strong>{e}</strong>
                    </span>
                  ))}
                  {closed && ` → ${orbit[0]}`}
                </div>
              </Card>
            }
            aside={
              <Card title="所有陪集（程式計算）">
                <div className="space-y-2">
                  {cyclotomicCosets().map((cs) => (
                    <div key={cs[0]} className={`rounded-lg border p-2 text-sm ${cs.includes(start) ? 'border-overall-400 bg-overall-50' : 'border-slate-200'}`}>
                      <M>{`C_{${cs[0]}} = \\{${cs.join(', ')}\\}`}</M>
                      <div className="text-xs text-slate-500">
                        元素：<M>{cs.map((e) => (e === 0 ? '1' : `\\alpha^{${e}}`)).join(',\\ ')}</M>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  注意：<M>{'C_0 = \\{0\\}'}</M> 是指數 0，代表元素 <M>{'\\alpha^0 = 1'}</M>，不是零元素。
                </p>
              </Card>
            }
          />
        ),
      }}
      example={{
        title: 'Codeword 自動有三個根：c(α) = c(α²) = c(α⁴) = 0',
        body: (
          <LabGrid
            main={
              <Card title="選一個 codeword，計算 c(αʲ)，j = 0 … 6" actions={<ResetButton onClick={() => setCi(11)} />}>
                <select className="mb-3 rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm" value={ci} onChange={(e) => setCi(Number(e.target.value))}>
                  {CODE.map((x, i) => (
                    <option key={i} value={i}>
                      m = {x.m.join('')} → c = {x.c.join('')}
                    </option>
                  ))}
                </select>
                <div className="text-sm">
                  <M>{`c(x) = ${msbToTex(c)}`}</M>
                </div>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">j</th>
                      <th>c(αʲ)</th>
                      <th>陪集</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[0, 1, 2, 3, 4, 5, 6].map((j) => {
                      const v = wordAtAlphaPower(c, j);
                      return (
                        <tr key={j} className={`border-t border-slate-100 ${[1, 2, 4].includes(j) ? 'bg-overall-50' : ''}`}>
                          <td className="py-1 font-mono">{j}</td>
                          <td>
                            <M>{gf8PowTex(v)}</M> <span className="font-mono text-xs text-slate-400">{gf8Bits(v)}</span>
                          </td>
                          <td className="text-xs text-slate-500">{cosetOrbit(j).join(',')}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            }
            aside={
              <>
                <Derivation
                  defaultOpen
                  title="為什麼 c(α)=0 ⇒ c(α²)=0？"
                  steps={[
                    { title: '把 c(α) 平方', body: <Tex block>{'c(\\alpha)^2 = \\Big(\\sum_i c_i\\alpha^i\\Big)^2 = \\sum_i c_i^2 \\alpha^{2i}\\quad(\\text{Frobenius 保持加法})'}</Tex> },
                    { title: '關鍵：係數在 GF(2)', body: <Tex block>{'c_i \\in \\{0,1\\} \\Rightarrow c_i^2 = c_i'}</Tex> },
                    { title: '所以', body: <Tex block>{'c(\\alpha)^2 = \\sum_i c_i(\\alpha^2)^i = c(\\alpha^2) \\;\\Rightarrow\\; c(\\alpha^2) = 0^2 = 0'}</Tex> },
                    { title: '再做一次', body: <Tex block>{'c(\\alpha^4) = c(\\alpha^2)^2 = 0,\\quad c(\\alpha^8) = c(\\alpha) \\ (\\alpha^7 = 1)'}</Tex> },
                  ]}
                />
                <Card title="反例：係數不在 GF(2) 就不成立">
                  <p className="text-sm text-slate-700">
                    <M>{'f(x) = x + \\alpha'}</M>（係數 α 不是 0/1）：
                  </p>
                  <Tex block>{`f(\\alpha) = ${gf8PowTex(gfPolyEval([alphaPow(1), 1], alphaPow(1)))},\\quad f(\\alpha^2) = \\alpha^2 + \\alpha = ${gf8PowTex(gfPolyEval([alphaPow(1), 1], alphaPow(2)))}`}</Tex>
                </Card>
              </>
            }
          />
        ),
      }}
      connection={{
        title: '共軛元素決定了 g(x) 的次數',
        body: (
          <Card>
            <p className="text-sm text-slate-700">
              任何 GF(2) 係數、以 α 為根的多項式，也必須以 α²、α⁴ 為根，所以至少有三個因式 <M>{'(x+\\alpha)(x+\\alpha^2)(x+\\alpha^4)'}</M>——次數至少 3。下一單元把這三個因式乘開，會得到……<M>{'x^3 + x + 1'}</M>。
            </p>
          </Card>
        ),
        links: [
          { to: 'a-6', text: '上一步：循環碼是 R₇ 的理想' },
          { to: 'a-8', text: '下一步：用共軛元素算出最小多項式' },
          { to: 'a-4', text: '回顧：α 的次方循環' },
        ],
        misconceptions: [
          { wrong: '(a + b)² = a² + 2ab + b² 永遠成立，所以平方不保持加法。', right: '在特徵 2 中 2ab = 0，所以 (a+b)² = a² + b²。' },
          { wrong: 'C₀ = {0} 表示 GF(8) 的零元素。', right: '陪集是指數的集合；C₀ 代表 α⁰ = 1。零元素不是 α 的任何次方。' },
          { wrong: '任何多項式的根平方後都還是根。', right: '只有係數在 GF(2)（Frobenius 不動點）時才成立；x + α 就是反例。' },
        ],
      }}
    />
  );
}
