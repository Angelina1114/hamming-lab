import { useMemo, useState } from 'react';
import {
  type Bit,
  G_MSB,
  GF8_ELEMENTS,
  alphaMultiplierXors,
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
  gfMultiplierNetlist,
  irreduciblePolys,
  isIrreducible,
  lfsrCost,
  maskDegree,
  maskWeight,
  orderOfX,
  polyToTex,
  polysOfDegree,
  primitivePolys,
  quotientRing,
  runLfsr,
  syndromeClocks,
} from '../../core';
import { minIrreducibleWeight } from '../../core/engineering-g2';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, LabGrid, ResetButton, Segmented } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';
import { LongDivisionView } from '../../components/l2/Division';
import { OverflowViz } from '../../components/l2/LfsrSim';

const ID = 'a-3';
const CUBICS = polysOfDegree(3); // all monic cubics, low→high
const P = 0b1011; // p(x) = x³ + x + 1
const P_MIRROR = 0b1101; // x³ + x² + 1
const BITS = maskDegree(P); // bits per GF(8) element = register stages
const NONZERO = GF8_ELEMENTS.length - 1;
const ALPHA_XORS = alphaMultiplierXors(P);
const MUL = gfMultiplierNetlist(BITS, P);
const ENC = lfsrCost(G_MSB);
const IRR3 = irreduciblePolys(3).length;
const PRIM3 = primitivePolys(3).length;
const REDUCIBLE_PERIOD = orderOfX(0b1001); // x³ + 1
const toMask = (p: readonly number[]) => p.reduce((acc, b, i) => acc | (b << i), 0); // low→high coefficients
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
  const period = orderOfX(toMask(q)); // LFSR wired from q: clocks until 001 comes back (0 = never)

  const [mode, setMode] = useState<'pow' | 'add' | 'mul' | 'rem'>('pow');
  const [k, setK] = useState(4);
  const [a, setA] = useState(0b110);
  const [b, setB] = useState(0b011);
  const [dividend, setDividend] = useState<Bit[]>([1, 0, 1, 0, 0, 0, 0]); // x⁶ + x⁴
  const [key, setKey] = useState(0);

  const powTrace = alphaPowerTrace(k);
  const mulTrace = gf8MulTrace(a, b);
  const divRun = runLfsr(dividend, 'divider');

  return (
    <AlgebraUnit
      id={ID}
      lead={<p>GF(8) 的加法已經有了，乘法卻還沒有定義：<M>{'\\alpha^2 \\cdot \\alpha = \\alpha^3'}</M> 不在這 {GF8_ELEMENTS.length} 個元素裡，{BITS} 個位元裝不下。我們需要一條「把 <M>{'\\alpha^3'}</M> 換掉」的規則，它來自一個 irreducible polynomial。</p>}
      takeaway={
        <>
          <M>{'p(x)'}</M> 是「乘以 α」電路的接線：<M>{'x^3+x+1'}</M> 只需移位加 {ALPHA_XORS} 個 XOR 閘。
        </>
      }
      why={{
        title: '乘法會「溢出」，需要一條化簡規則',
        body: (
          <Plain>
            <p>
              encoder 和 decoder 把一個 GF(8) 元素存成 {BITS} 個位元，分別是 <M>{'\\alpha^2,\\ \\alpha,\\ 1'}</M> 的係數。「乘以 α」把每一項的次方加一，在 register 裡就是 {BITS} 個位元往高位移一格。問題出在最高位：原本在 <M>{'\\alpha^2'}</M> 的位元被推成 <M>{'\\alpha^3'}</M>，{BITS} 個 register 沒有地方放它。一般的乘法也一樣，兩個次數 ≤ 2 的多項式相乘，次數可能到 4。
            </p>
            <p>
              為了讓結果留在 {GF8_ELEMENTS.length} 個元素裡，我們規定一個三次多項式 <M>{'p(x)'}</M>，所有運算都「除以 <M>{'p(x)'}</M> 取餘數」——就像時鐘的時間要 mod 12 一樣，只是這次 mod 的是多項式。在硬體上，這條規則就是 <strong>feedback 接線</strong>：<M>{'p(x) = x^3+x+1'}</M> 表示 <M>{'\\alpha^3 = \\alpha + 1'}</M>，被推出去的位元要送回存 α 和存 1 的兩個 register。存 1 的 register 原本移進來的是 0，直接接一條線就好；只有存 α 的那個要用 XOR 閘和原本的位元合併。所以「乘以 α」的電路只是移位加上 {ALPHA_XORS} 個 XOR 閘。整個過程只有移位和 XOR，不像整數運算要把進位（carry）一路往高位傳，每個輸出位元各自算完。
            </p>
            <p>
              但不是隨便哪個三次多項式都可以。如果 <M>{'p(x)'}</M> 能分解，就會出現「兩個非零元素相乘等於 0」的 zero divisor，除法就壞掉了。從電路來看，若 a、b 都不是 0 卻有 a · b = 0，「乘以常數 a」的電路就會把 b 和 0 這兩個不同的輸入都送到輸出 0：資訊被吃掉，無法從輸出反推回輸入。另一個後果在 A4 會更清楚：用 <M>{'x^3+1'}</M> 接出來的 shift register（移位暫存器），從 001 出發只要 {REDUCIBLE_PERIOD} 個時脈（clock）就回到 001，走不完 {NONZERO} 個非零狀態，codeword 不同的位置會拿到同一個標籤。下面的實驗讓你親手驗證這些事。
            </p>
            <p>
              那要選哪一個？{CUBICS.length} 個 monic（首一）三次多項式中只有 {IRR3} 個是 irreducible：<M>{'x^3+x+1'}</M> 與 <M>{'x^3+x^2+1'}</M>。它們都只有 {minIrreducibleWeight(3)} 項，這已經是最少：項數更少的三次多項式，不是沒有常數項（有根 0），就是項數為偶數（有根 1），都會分解。項數少，feedback 線就少。這 {PRIM3} 個也都是 primitive polynomial（本原多項式；A4 會說明這個性質），而且互為倒序（1011 ↔ 1101），乘以 α 都只要 {alphaMultiplierXors(P_MIRROR)} 個 XOR 閘，硬體成本相同。本網站選 <M>{'x^3+x+1'}</M> 是慣例，第二課的 generator polynomial g(x) 也是它。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: 'Polynomial ring、irreducible polynomial 與 quotient ring',
        body: (
          <>
            <Terms
              items={[
                { term: 'Polynomial ring GF(2)[x]', gloss: '多項式環', def: <>所有係數在 GF(2) 的多項式，可以相加、相乘（係數 mod 2），但一般不能相除。例如 <M>{'(x+1)^2 = x^2 + 1'}</M>。</> },
                { term: 'Irreducible polynomial', def: <>不能寫成兩個次數較低的多項式相乘。三次多項式若可分解，一定有一次因式 <M>{'x'}</M> 或 <M>{'x+1'}</M>，也就是有根 0 或 1。所以：<strong>三次多項式在 GF(2) 中沒有根 ⇔ irreducible</strong>。</> },
                { term: 'Quotient ring GF(2)[x]/(p(x))', gloss: '商環', def: <>把「相差 <M>{'p(x)'}</M> 的倍數」的多項式視為同一個，只留下除以 <M>{'p(x)'}</M> 的餘數。三次 <M>{'p'}</M> 的餘數次數 ≤ 2，正好 8 種。</> },
                { term: 'α = x 的 equivalence class', gloss: '等價類', def: <>α 就是 quotient ring 裡的 <M>x</M>。因為 <M>{'p(x) \\equiv 0'}</M>，所以 <M>{'p(\\alpha) = \\alpha^3+\\alpha+1 = 0'}</M>，移項得 <M>{'\\alpha^3 = \\alpha + 1'}</M>（GF(2) 中減 = 加）。</> },
              ]}
            />
            <LabGrid
              main={
                <Card title="實驗：用不同的三次多項式取商，結果是不是 field？" actions={<ResetButton onClick={() => setQi(CUBICS.findIndex((p) => p.join('') === '1101'))} />}>
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
                    <div className={`rounded-lg p-2 font-semibold ${irreducible ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{irreducible ? 'Irreducible ✓' : 'Reducible（可約）：有根 ✗'}</div>
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
                  <p className="mt-3 text-sm text-slate-700">
                    用 <M>{polyToTex(q)}</M> 接一個「乘以 x」的 shift register（{BITS} 個 register），從 001 出發：
                    {period === NONZERO ? (
                      <>要 {period} 個時脈才回到 001，中間走過全部 {NONZERO} 個非零狀態。</>
                    ) : period > 0 ? (
                      <>
                        只要 {period} 個時脈就回到 001，只走過 {period} 個狀態；位置 i 和 i + {period} 會拿到同一個標籤，syndrome 分不出錯在哪一格。
                      </>
                    ) : (
                      <>常數項是 0，x 本身就是 zero divisor，狀態永遠回不到 001。</>
                    )}
                  </p>
                </Card>
              }
              aside={
                <>
                  <Checks title="這個 quotient ring 是 field 嗎？" items={axioms.filter((x) => ['mul-inv', 'no-zero-div'].includes(x.key)).map((x) => ({ label: x.plain, pass: x.holds, detail: x.counterexample }))} />
                  <Card title="證明：p 是 irreducible ⇒ quotient ring 是 field">
                    <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
                      <li>
                        若 <M>{'a(x)b(x) \\equiv 0'}</M>，則 <M>{'p \\mid ab'}</M>。<M>{'p'}</M> 是 irreducible ⇒ <M>{'p \\mid a'}</M> 或 <M>{'p \\mid b'}</M> ⇒ <M>a</M> 或 <M>b</M> 是 0。沒有 zero divisor。
                      </li>
                      <li>
                        固定 <M>{'a \\ne 0'}</M>，<M>{'b \\mapsto ab'}</M> 是一對一的；8 個元素有限，所以也是映成，必有 <M>b</M> 使 <M>{'ab = 1'}</M>。
                      </li>
                      <li>
                        反之，若 <M>{'p = fg'}</M> 可分解，<M>{'f \\cdot g \\equiv 0'}</M> 就是 zero divisor（表格中的紅格）。
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
          <>
            <Plain>
              <p>
                計算器的四種運算，在晶片裡各對應一種小電路。「次方」每乘一次 α，就是上面那個 shift register 走一個時脈；「加法」是每個位元各用一個 XOR 閘，彼此不影響、也沒有進位。「乘法」可以做成 combinational circuit（組合電路）：{MUL.ands} 個 AND 閘算出部分積，再用 {MUL.xors} 個 XOR 閘把同次項合併，並依 <M>{'\\alpha^3 = \\alpha + 1'}</M> 把 <M>{'\\alpha^3, \\alpha^4'}</M> 折回低次，一個時脈內就有結果。「取餘數」則是第二課 2-3 的除法器 LFSR，一個時脈吃進一個位元。
              </p>
            </Plain>
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
                          title: '用 distributivity 展開（先不合併）',
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
                  <p className="text-sm text-slate-700">
                    第二課的除法器 LFSR 做的是同一件事：被除數一個時脈送進一個位元，{syndromeClocks(dividend.length)} 個時脈後，{ENC.flipFlops} 個 register 裡剩下 <span className="mono font-bold">{divRun.final.join('')}</span>，就是上面的餘數。接收端算 syndrome 時，也是讓 received word（收到的字）這樣流過 register。
                  </p>
                </div>
              )}
            </Card>
          </>
        ),
      }}
      example={{
        title: 'Hamming(7,4) 用的正是 x³ + x + 1',
        body: (
          <LabGrid
            main={
              <Card title="x³ ≡ x + 1：第二課 LFSR 的 feedback 規則從這裡來">
                <OverflowViz />
              </Card>
            }
            aside={
              <Card>
                <p className="text-sm text-slate-700">
                  第二課的 generator polynomial <M>{'g(x) = x^3 + x + 1'}</M> 與這裡的 <M>{'p(x)'}</M> 是同一個多項式。LFSR 的 feedback（溢出的 1 送回 x 與 1 的位置），在 GF(8) 裡的意思就是 <M>{'\\alpha^3 = \\alpha + 1'}</M>。
                </p>
                <Tex block>{'\\alpha^4 = \\alpha\\cdot\\alpha^3 = \\alpha(\\alpha+1) = \\alpha^2 + \\alpha'}</Tex>
                <Tex block>{'\\alpha^5 = \\alpha\\cdot\\alpha^4 = \\alpha^3 + \\alpha^2 = \\alpha^2 + \\alpha + 1'}</Tex>
                <p className="mt-2 text-sm text-slate-700">
                  放回電路裡看：第二課的 encoder 用 {ENC.flipFlops} 個 register、{ENC.xors} 個 XOR 閘。比「乘以 α」多出的 {ENC.xors - ALPHA_XORS} 個 XOR，是 data bit 進入 feedback 的入口；其餘的接線和這裡完全相同。換一個 <M>{'p(x)'}</M>，feedback 線就接到不同的 register，<M>{'p(x)'}</M> 有幾項，就決定要幾個 XOR 閘。
                </p>
              </Card>
            }
          />
        ),
      }}
      connection={{
        title: '從規則到結構',
        body: (
          <Plain>
            <p>
              回顧這一單元的設計：一個元素用 {BITS} 個位元表示，<M>{'p(x) = x^3+x+1'}</M> 規定溢出位元的 feedback 怎麼接。因為 <M>{'p'}</M> 是 irreducible，每個非零元素都有倒數，可以拿來除；因為它只有 {maskWeight(P)} 項，乘以 α 只要 {ALPHA_XORS} 個 XOR 閘。下一單元 A4 讓這個電路一直跑下去，看 α 的次方會走到哪裡。
            </p>
          </Plain>
        ),
        links: [
          { to: 'a-2', text: '上一步：GF(8) 的 8 個元素' },
          { to: 'a-4', text: '下一步：α 的次方會走遍所有非零元素' },
          { to: 'l2-2', text: '第二課：LFSR 的 feedback 就是 x³ ≡ x + 1' },
          { to: 'l2-3', text: '第二課：多項式長除法（取餘數）' },
        ],
        misconceptions: [
          { wrong: '任何三次多項式都能用來建構 GF(8)。', right: '必須是 irreducible。上面的實驗中選 x³+1 = (x+1)(x²+x+1)，就會出現 (x+1)(x²+x+1) = 0 的 zero divisor。' },
          {
            wrong: '選 x³ + x + 1 而不選 x³ + x² + 1，是因為後者不能用。',
            right: <>兩者都是 irreducible、都是 primitive polynomial，乘以 α 都只要 {alphaMultiplierXors(P_MIRROR)} 個 XOR 閘，硬體成本相同。選 x³ + x + 1 是慣例；換成另一個，得到的 GF(8) 結構相同，是 isomorphic（同構）的，只是每個元素的 {BITS} 位元寫法不同。</>,
          },
          { wrong: 'α 是某個實數或複數。', right: 'α 是 quotient ring 中 x 的 equivalence class，唯一知道的性質是 α³ + α + 1 = 0。所有計算都靠這條規則化簡。' },
          { wrong: '沒有一次因式就一定是 irreducible。', right: '這只對次數 2、3 成立。四次以上可能分解成兩個二次因式而沒有根，例如 (x²+x+1)² = x⁴+x²+1。' },
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

