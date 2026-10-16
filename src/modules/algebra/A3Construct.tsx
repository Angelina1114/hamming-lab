import { useMemo, useState } from 'react';
import {
  type Bit,
  GF8_ELEMENTS,
  alphaPolyTex,
  alphaPowerTrace,
  checkFieldAxioms,
  evalGF2,
  factorGF2,
  flipBit,
  gf8Add,
  gf8Bits,
  gf8MulTrace,
  gf8PolyTex,
  isIrreducible,
  polyToTex,
  polysOfDegree,
  quotientRing,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, LabGrid, ResetButton, Segmented } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';
import { LongDivisionView } from '../../components/l2/Division';
import { OverflowViz } from '../../components/l2/LfsrSim';

const ID = 'a-3';
const CUBICS = polysOfDegree(3); // all monic cubics, low→high
const xBits = (v: number) => {
  // element of GF(2)[x]/(q) as polynomial in x
  if (v === 0) return '0';
  const t: string[] = [];
  if (v & 4) t.push('x^2');
  if (v & 2) t.push('x');
  if (v & 1) t.push('1');
  return t.join('+');
};

export default function A3Construct() {
  const [qi, setQi] = useState(CUBICS.findIndex((p) => p.join('') === '1101')); // x³+x+1
  const q = CUBICS[qi];
  const ring = useMemo(() => quotientRing(q), [q]);
  const axioms = checkFieldAxioms(ring, xBits);
  const irreducible = isIrreducible(q);
  const factors = factorGF2(q);

  const [mode, setMode] = useState<'pow' | 'add' | 'mul' | 'rem'>('pow');
  const [k, setK] = useState(4);
  const [a, setA] = useState(0b110);
  const [b, setB] = useState(0b011);
  const [dividend, setDividend] = useState<Bit[]>([1, 0, 1, 0, 0, 0, 0]); // x⁶ + x⁴
  const [key, setKey] = useState(0);

  const powTrace = alphaPowerTrace(k);
  const mulTrace = gf8MulTrace(a, b);

  return (
    <AlgebraUnit
      id={ID}
      lead={<p>上一單元把 GF(8) 的元素寫成 <M>{'a + b\\alpha + c\\alpha^2'}</M>，但乘法還沒定義：<M>{'\\alpha^2 \\cdot \\alpha = \\alpha^3'}</M> 不在這 8 個元素裡。我們需要一條「把 <M>{'\\alpha^3'}</M> 換掉」的規則——它來自一個不可約多項式。</p>}
      why={{
        title: '乘法會「溢出」，需要一條化簡規則',
        body: (
          <Plain>
            <p>
              兩個次數 ≤ 2 的多項式相乘，次數可能到 4。為了讓結果留在 8 個元素裡，我們規定一個三次多項式 <M>{'p(x)'}</M>，所有運算都「除以 <M>{'p(x)'}</M> 取餘數」——就像時鐘的時間要 mod 12 一樣，只是這次 mod 的是多項式。
            </p>
            <p>
              但不是隨便哪個三次多項式都可以。如果 <M>{'p(x)'}</M> 能分解，就會出現「兩個非零元素相乘等於 0」，除法就壞掉了。下面的實驗讓你親手驗證這件事。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: '多項式環、不可約多項式與商環',
        body: (
          <>
            <Terms
              items={[
                { zh: '多項式環 GF(2)[x]', en: 'Polynomial Ring', def: <>所有係數在 GF(2) 的多項式，可以相加、相乘（係數 mod 2），但一般不能相除。例如 <M>{'(x+1)^2 = x^2 + 1'}</M>。</> },
                { zh: '不可約多項式', en: 'Irreducible Polynomial', def: <>不能寫成兩個次數較低的多項式相乘。三次多項式若可分解，一定有一次因式 <M>{'x'}</M> 或 <M>{'x+1'}</M>，也就是有根 0 或 1。所以：<strong>三次多項式在 GF(2) 中沒有根 ⇔ 不可約</strong>。</> },
                { zh: '商環 GF(2)[x]/(p(x))', en: 'Quotient Ring', def: <>把「相差 <M>{'p(x)'}</M> 的倍數」的多項式視為同一個，只留下除以 <M>{'p(x)'}</M> 的餘數。三次 <M>{'p'}</M> 的餘數次數 ≤ 2，正好 8 種。</> },
                { zh: 'α = x 的等價類', en: 'Equivalence Class of x', def: <>α 就是商環裡的 <M>x</M>。因為 <M>{'p(x) \\equiv 0'}</M>，所以 <M>{'p(\\alpha) = \\alpha^3+\\alpha+1 = 0'}</M>，移項得 <M>{'\\alpha^3 = \\alpha + 1'}</M>（GF(2) 中減 = 加）。</> },
              ]}
            />
            <LabGrid
              main={
                <Card title="實驗：用不同的三次多項式取商，結果是不是體？" actions={<ResetButton onClick={() => setQi(CUBICS.findIndex((p) => p.join('') === '1101'))} />}>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {CUBICS.map((p, i) => (
                      <button key={i} onClick={() => setQi(i)} className={`chip border ${i === qi ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
                        <M>{polyToTex(p)}</M>
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-2">
                      <M>{`p(0) = ${evalGF2(q, 0)}`}</M>，<M>{`p(1) = ${evalGF2(q, 1)}`}</M>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      分解：<M>{factors.length > 1 ? factors.map((f) => `(${polyToTex(f)})`).join('') : polyToTex(q)}</M>
                    </div>
                    <div className={`rounded-lg p-2 font-semibold ${irreducible ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{irreducible ? '不可約 ✓' : '可約（有根）✗'}</div>
                  </div>
                  <div className="mt-3 overflow-x-auto">
                    <table className="mx-auto text-center font-mono text-[11px] sm:text-xs">
                      <thead>
                        <tr>
                          <th className="p-1">·</th>
                          {ring.elements.map((y) => (
                            <th key={y} className="p-1 text-slate-500">
                              {xBits(y)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ring.elements.map((x) => (
                          <tr key={x}>
                            <th className="p-1 text-slate-500">{xBits(x)}</th>
                            {ring.elements.map((y) => {
                              const v = ring.mul(x, y);
                              const zd = v === 0 && x && y;
                              return (
                                <td key={y} className={`rounded p-1 ${zd ? 'bg-rose-200 font-bold text-rose-800' : v === 1 ? 'bg-emerald-100' : ''}`}>
                                  {xBits(v)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              }
              aside={
                <>
                  <Checks title="這個商環是體嗎？" items={axioms.filter((x) => ['mul-inv', 'no-zero-div'].includes(x.key)).map((x) => ({ label: x.zh, pass: x.holds, detail: x.counterexample }))} />
                  <Card title="為什麼不可約 ⇒ 體？">
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                      <li>
                        若 <M>{'a(x)b(x) \\equiv 0'}</M>，則 <M>{'p \\mid ab'}</M>。<M>{'p'}</M> 不可約 ⇒ <M>{'p \\mid a'}</M> 或 <M>{'p \\mid b'}</M> ⇒ <M>a</M> 或 <M>b</M> 是 0。沒有零因子。
                      </li>
                      <li>
                        固定 <M>{'a \\ne 0'}</M>，<M>{'b \\mapsto ab'}</M> 是一對一的；8 個元素有限，所以也是映成，必有 <M>b</M> 使 <M>{'ab = 1'}</M>。
                      </li>
                      <li>
                        反之，若 <M>{'p = fg'}</M> 可分解，<M>{'f \\cdot g \\equiv 0'}</M> 就是零因子（表格中的紅格）。
                      </li>
                    </ol>
                  </Card>
                </>
              }
            />
          </>
        ),
      }}
      how={{
        title: 'GF(8) 計算器（每一步都化簡給你看）',
        body: (
          <Card
            actions={
              <>
                <Segmented
                  value={mode}
                  onChange={(v) => {
                    setMode(v);
                    setKey((x) => x + 1);
                  }}
                  options={[
                    { value: 'pow', label: '次方 αᵏ' },
                    { value: 'add', label: '加法' },
                    { value: 'mul', label: '乘法' },
                    { value: 'rem', label: '多項式取餘數' },
                  ]}
                />
                <ResetButton
                  onClick={() => {
                    setK(4);
                    setA(0b110);
                    setB(0b011);
                    setDividend([1, 0, 1, 0, 0, 0, 0]);
                    setKey((x) => x + 1);
                  }}
                />
              </>
            }
            title="選擇運算"
          >
            {mode === 'pow' && (
              <div className="space-y-3">
                <label className="block text-sm">
                  <span className="mr-2">k =</span>
                  <input type="range" min={0} max={14} value={k} onChange={(e) => { setK(Number(e.target.value)); setKey((x) => x + 1); }} className="w-48 accent-slate-900" />
                  <span className="ml-2 font-mono font-bold">{k}</span>
                </label>
                <Derivation
                  key={`p${key}`}
                  defaultOpen
                  title={`計算 α^${k}：每次乘上 α，遇到 α³ 就換成 α + 1`}
                  steps={powTrace.slice(1).map((st) => ({
                    title: `α^${st.k} = α · α^${st.k - 1}`,
                    body: st.reduced ? (
                      <Tex block>{`\\alpha \\cdot (${alphaPolyTex(st.shifted >> 1)}) = ${alphaPolyTex(st.shifted)} = ${alphaPolyTex(st.shifted & 0b111) === '0' ? '' : alphaPolyTex(st.shifted & 0b111) + ' + '}(\\alpha + 1) = ${gf8PolyTex(st.value)}\\quad [${gf8Bits(st.value)}]`}</Tex>
                    ) : (
                      <Tex block>{`\\alpha \\cdot (${alphaPolyTex(st.shifted >> 1)}) = ${gf8PolyTex(st.value)}\\quad [${gf8Bits(st.value)}]`}</Tex>
                    ),
                  }))}
                />
                {k === 0 && <p className="text-sm text-slate-600">α⁰ = 1（定義）。</p>}
              </div>
            )}
            {(mode === 'add' || mode === 'mul') && (
              <div className="space-y-3">
                <ElementPicker label="a" value={a} onChange={(v) => { setA(v); setKey((x) => x + 1); }} />
                <ElementPicker label="b" value={b} onChange={(v) => { setB(v); setKey((x) => x + 1); }} />
                {mode === 'add' ? (
                  <Derivation
                    key={`a${key}`}
                    defaultOpen
                    title="加法：同次項係數相加 mod 2"
                    steps={[
                      { title: '寫成多項式', body: <Tex block>{`(${gf8PolyTex(a)}) + (${gf8PolyTex(b)})`}</Tex> },
                      { title: '同次項合併，係數 mod 2', body: <Tex block>{`= ${gf8PolyTex(gf8Add(a, b))}`}</Tex> },
                      { title: '等價於三位元 XOR', body: <Tex block>{`${gf8Bits(a)} \\oplus ${gf8Bits(b)} = ${gf8Bits(gf8Add(a, b))}`}</Tex> },
                    ]}
                  />
                ) : (
                  <Derivation
                    key={`m${key}`}
                    defaultOpen
                    title="乘法：展開、合併、用 α³ = α+1 化簡"
                    steps={[
                      { title: '寫成多項式', body: <Tex block>{`(${gf8PolyTex(a)})(${gf8PolyTex(b)})`}</Tex> },
                      {
                        title: '分配律展開（先不合併）',
                        body: <Tex block>{mulTrace.terms.length ? mulTrace.terms.map((e) => (e === 0 ? '1' : e === 1 ? '\\alpha' : `\\alpha^{${e}}`)).join(' + ') : '0'}</Tex>,
                      },
                      { title: '同類項合併（係數 mod 2）', body: <Tex block>{`= ${alphaPolyTex(mulTrace.raw)}`}</Tex> },
                      ...mulTrace.reductions.map((r) => ({
                        title: `化簡 α^${r.power}`,
                        body: (
                          <Tex block>{`${r.power === 4 ? '\\alpha^4 = \\alpha\\cdot\\alpha^3 = \\alpha^2 + \\alpha' : '\\alpha^3 = \\alpha + 1'}\\;\\Rightarrow\\; ${alphaPolyTex(r.before)} = ${alphaPolyTex(r.after)}`}</Tex>
                        ),
                      })),
                      { title: '結果', body: <Tex block>{`= ${gf8PolyTex(mulTrace.result)}\\quad [${gf8Bits(mulTrace.result)}]`}</Tex> },
                    ]}
                  />
                )}
              </div>
            )}
            {mode === 'rem' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">任何 GF(2) 多項式除以 <M>{'p(x) = x^3+x+1'}</M> 的餘數，都是 GF(8) 中的一個元素（把 x 換成 α）。點擊位元修改被除數（最左邊 = x⁶）。</p>
                <div className="flex gap-1">
                  {dividend.map((v, i) => (
                    <button key={i} className="grid h-8 w-8 place-items-center rounded border border-slate-300 font-mono font-bold hover:border-slate-600" onClick={() => { setDividend(flipBit(dividend, i) as Bit[]); setKey((x) => x + 1); }}>
                      {v}
                    </button>
                  ))}
                </div>
                <LongDivisionView key={`r${key}`} dividend={dividend} />
              </div>
            )}
          </Card>
        ),
      }}
      example={{
        title: 'Hamming(7,4) 用的正是 x³ + x + 1',
        body: (
          <LabGrid
            main={
              <Card title="x³ ≡ x + 1：第二課 LFSR 的回授規則從這裡來">
                <OverflowViz />
              </Card>
            }
            aside={
              <Card>
                <p className="text-sm text-slate-700">
                  第二課的生成多項式 <M>{'g(x) = x^3 + x + 1'}</M> 與這裡的 <M>{'p(x)'}</M> 是同一個多項式。LFSR 的「溢出的 1 回授到 x 與 1 的位置」，在 GF(8) 裡的意思就是 <M>{'\\alpha^3 = \\alpha + 1'}</M>。
                </p>
                <Tex block>{'\\alpha^4 = \\alpha\\cdot\\alpha^3 = \\alpha(\\alpha+1) = \\alpha^2 + \\alpha'}</Tex>
                <Tex block>{'\\alpha^5 = \\alpha\\cdot\\alpha^4 = \\alpha^3 + \\alpha^2 = \\alpha^2 + \\alpha + 1'}</Tex>
              </Card>
            }
          />
        ),
      }}
      connection={{
        title: '從規則到結構',
        links: [
          { to: 'a-2', text: '上一步：GF(8) 的 8 個元素' },
          { to: 'a-4', text: '下一步：α 的次方會走遍所有非零元素' },
          { to: 'l2-2', text: '第二課：LFSR 的回授就是 x³ ≡ x + 1' },
          { to: 'l2-3', text: '第二課：多項式長除法（取餘數）' },
        ],
        misconceptions: [
          { wrong: '任何三次多項式都能用來建構 GF(8)。', right: '必須不可約。上面的實驗中選 x³+1 = (x+1)(x²+x+1)，就會出現 (x+1)(x²+x+1) = 0 的零因子。' },
          { wrong: 'α 是某個實數或複數。', right: 'α 是商環中 x 的等價類，唯一知道的性質是 α³ + α + 1 = 0。所有計算都靠這條規則化簡。' },
          { wrong: '沒有一次因式就一定不可約。', right: '這只對次數 2、3 成立。四次以上可能分解成兩個二次因式而沒有根，例如 (x²+x+1)² = x⁴+x²+1。' },
        ],
      }}
    />
  );
}

function ElementPicker({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-6 font-serif italic">{label}</span>
      {GF8_ELEMENTS.map((x) => (
        <button key={x} onClick={() => onChange(x)} className={`chip border ${x === value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
          <span className="font-mono">{gf8Bits(x)}</span>
        </button>
      ))}
      <span className="text-sm">
        = <M>{gf8PolyTex(value)}</M>
      </span>
    </div>
  );
}

