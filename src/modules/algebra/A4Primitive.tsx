import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCw } from 'lucide-react';
import {
  GF8_ELEMENTS,
  LOG,
  alphaPolyTex,
  alphaPow,
  buildField,
  gf8Bits,
  gf8Mul,
  gf8Order,
  gf8PolyTex,
  gf8PowTex,
  gfMultiplierNetlist,
  intToBits,
  irreduciblePolys,
  maskDegree,
  orderOfX,
  primitiveElements,
  primitivePolys,
} from '../../core';
import { constMulXors, logAntilogEntries, mulTableEntries } from '../../core/engineering-g2';
import { M, Tex } from '../../components/Tex';
import { Card, LabGrid, ResetButton, Segmented } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';

const ID = 'a-4';
const P = 0b1011; // p(x) = x³ + x + 1
const BITS = maskDegree(P); // bits per GF(8) element = register stages
const PERIOD = orderOfX(P); // clocks of the multiply-by-α register before 001 returns
const BASES = [2, 3, 6]; // α, α³, α⁴
const BASE_XORS = Object.fromEntries(BASES.map((b) => [b, constMulXors(b, P)]));
const CHEAPEST = Math.min(...BASES.map((b) => BASE_XORS[b]));
const MUL = gfMultiplierNetlist(BITS, P);
const P7 = 0b10001001; // x⁷ + x³ + 1 (Lesson 2-12)

export default function A4Primitive() {
  const [base, setBase] = useState(2); // α
  const [k, setK] = useState(0);
  const [gf16, setGf16] = useState<'prim' | 'nonprim'>('nonprim');

  // the cycle of powers of the chosen base
  const cycle = useMemo(() => {
    const out = [1];
    for (;;) {
      const nx = gf8Mul(out[out.length - 1], base);
      if (nx === 1 || out.length > 8) break;
      out.push(nx);
    }
    return out;
  }, [base]);
  const cur = cycle[k % cycle.length];
  const prev = cycle[(k - 1 + cycle.length) % cycle.length];

  const F16 = useMemo(() => buildField(4, gf16 === 'prim' ? 0b10011 : 0b11111), [gf16]);

  // positions on the circle: α^0 … α^6 in order
  const R = 120;
  const pos = (e: number) => {
    const t = (e / 7) * 2 * Math.PI - Math.PI / 2;
    return { x: 160 + R * Math.cos(t), y: 160 + R * Math.sin(t) };
  };

  return (
    <AlgebraUnit
      id={ID}
      lead={<p>在 A3 計算 α 的次方時，你可能注意到：α⁷ 又回到 1。這不是巧合——α 的次方剛好走遍 GF(8) 的所有非零元素，A3 那 {BITS} 個暫存器從 001 出發，會不重複地走過全部 {PERIOD} 個非零狀態。每個狀態都能拿來替 codeword 的一個位置命名，這也讓碼長剛好是 {PERIOD}。</p>}
      takeaway={
        <>
          乘一次 α 就是 LFSR 走一個時脈；α 走遍 {PERIOD} 個非零狀態，每個位置才有自己的地址 <M>{'\\alpha^i'}</M>。
        </>
      }
      why={{
        title: '把「位置」變成可以計算的數',
        body: (
          <Plain>
            <p>
              解碼器算出 Syndrome 之後，真正要回答的是「錯在第幾格」。第一課的 H 用二進位 1…7 替位置編號，單一錯誤時 Syndrome 直接讀出位置，很好用；但這種編號只是一個計數器，「下一格」和 GF(8) 的乘法沒有關係。A9 會實際檢查：這樣排出來的碼不是循環碼，用不上只需要幾個暫存器的 LFSR 編碼器。
            </p>
            <p>
              所以改用另一種編號：位置 i 叫做 <M>{'\\alpha^i'}</M>，也就是 A3 的「乘以 α」電路從 001（也就是 1）出發、走 i 個時脈後的狀態。H 的每一欄改填對應的 <M>{'\\alpha^i'}</M>，仍然是全部 {PERIOD} 種非零的 {BITS} 位元組合，只是排列順序不同，所以一樣能定位任何單一錯誤；A9 會看到，這個順序正好讓碼變成循環碼。如果每個非零元素都能寫成 <M>{'\\alpha^i'}</M>，那麼：
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                乘法變成指數相加：<M>{'\\alpha^i \\cdot \\alpha^j = \\alpha^{i+j}'}</M>，指數 mod {PERIOD}。硬體或軟體只要一張 log 表、一張反 log 表，加上一個 mod {PERIOD} 的加法器就能乘（0 另外處理）。
              </li>
              <li>
                {PERIOD} 個非零元素 <M>{'\\alpha^0, \\dots, \\alpha^6'}</M> 可以一對一對應到 codeword 的 {PERIOD} 個位置——位置 <M>{'x^i'}</M> 對應 <M>{'\\alpha^i'}</M>。這就是 Syndrome <M>{'S_1 = \\alpha^i'}</M> 能告訴我們錯誤位置的原因（第二課 2-6）：Syndrome 本身就是錯誤位置的地址，查 log 表取出指數就得到 i。
              </li>
              <li>
                「下一格」就是乘以 α，也就是暫存器走一個時脈。接收字循環位移一格（乘以 x），它的 Syndrome 就剛好乘上 α；LFSR 編碼器的回授、第二課 2-7 的 Chien Search（每個時脈乘一次 α，換到下一個位置檢查），用的也都是這個小電路。
              </li>
              <li>
                Hamming 碼長 <M>{'n = 2^3 - 1 = 7'}</M> 正是非零元素的個數，也是這個暫存器回到起點之前走過的狀態數。
              </li>
            </ul>
            <p>
              指數表示法的價值在體變大時更明顯。GF(8) 的完整乘法表有 {mulTableEntries(3)} 格，log 與反 log 表合計 {logAntilogEntries(3)} 格，A3 的乘法電路（{MUL.ands} 個 AND 閘、{MUL.xors} 個 XOR 閘）也不貴；但以位元組（byte）為符號的 GF(2⁸)，例如 QR code 的 Reed–Solomon 碼，完整乘法表要 {mulTableEntries(8)} 格，log 與反 log 表只要 {logAntilogEntries(8)} 格。
            </p>
            <p>
              這一切的前提是 α 真的走遍所有非零元素：如果中途就回到 1，不同位置會拿到同一個地址。GF(8) 自動滿足（見下面的 Lagrange 定理），更大的體就不一定，範例會看到 GF(16) 的反例。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: '乘法階、本原元素、本原多項式',
        body: (
          <>
            <Terms
              items={[
                { zh: '乘法階', en: 'Multiplicative Order', def: <>使 <M>{'\\beta^k = 1'}</M> 的最小正整數 k。</> },
                { zh: '本原元素', en: 'Primitive Element', def: <>乘法階 = 非零元素個數（GF(8) 中是 7）的元素。它的次方會走遍所有非零元素。</> },
                {
                  zh: '本原多項式',
                  en: 'Primitive Polynomial',
                  def: (
                    <>
                      一個不可約多項式，而且它的根 α 是本原元素。<M>{'x^3 + x + 1'}</M> 就是本原多項式。用 m 次本原多項式接成的 LFSR，要走完全部 <M>{'2^m - 1'}</M> 個非零狀態才重複，輸出的序列稱為最長序列（maximal-length sequence，m-sequence）。
                    </>
                  ),
                },
                {
                  zh: 'Lagrange 定理與 α⁷ = 1',
                  def: (
                    <>
                      7 個非零元素在乘法下構成一個群。元素的階一定整除群的大小 7。7 是質數，所以除了 1 以外每個元素的階都是 7——包括 α。因此 <M>{'\\alpha^7 = 1'}</M>，而且 <M>{'\\alpha^1, \\dots, \\alpha^6 \\ne 1'}</M>。
                    </>
                  ),
                },
              ]}
            />
            <Card title="每個非零元素的乘法階（程式逐一相乘計算）">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">元素</th>
                      <th>多項式</th>
                      <th>= αⁱ</th>
                      <th>乘法階</th>
                      <th>本原？</th>
                    </tr>
                  </thead>
                  <tbody>
                    {GF8_ELEMENTS.filter((x) => x).map((x) => (
                      <tr key={x} className="border-t border-slate-100">
                        <td className="py-1 font-mono">{gf8Bits(x)}</td>
                        <td>
                          <M>{gf8PolyTex(x)}</M>
                        </td>
                        <td>
                          <M>{gf8PowTex(x)}</M>
                        </td>
                        <td className="font-mono">{gf8Order(x)}</td>
                        <td>{gf8Order(x) === 7 ? '✓' : '—（1 的階是 1）'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-sm text-slate-600">本原元素共 {primitiveElements().length} 個。表中的「乘法階」放到電路上就是：把「乘以這個元素」的電路從 001 出發一直走時脈，要走幾個時脈才回到 001。</p>
            </Card>
          </>
        ),
      }}
      how={{
        title: 'α 次方循環動畫',
        body: (
          <>
            <Plain>
              <p>
                按一次「乘上 α」，就是 A3 的「乘以 α」電路走一個時脈：{BITS} 個位元左移一格，溢出的位元回授到 α 與 1 的位置。從 001 出發，要 {PERIOD} 個時脈才回到 001，中間不重複地經過每一個非零狀態，這就是最長序列。通訊系統的擾碼器（scrambler）、測試用的虛擬隨機序列（pseudo-random sequence）也用同樣的電路，選本原多項式就是為了讓序列走最久才重複。
              </p>
            </Plain>
            <LabGrid
              main={
                <Card
                  title="按「乘上底數」，看元素在循環上前進"
                  actions={
                    <>
                      <Segmented
                        value={String(base)}
                        onChange={(v) => {
                          setBase(Number(v));
                          setK(0);
                        }}
                        options={BASES.map((b) => ({ value: String(b), label: <M>{`\\text{底數 } ${gf8PowTex(b)}`}</M> }))}
                      />
                      <button className="btn-primary" onClick={() => setK((x) => x + 1)}>
                        <RotateCw className="h-4 w-4" /> 乘上 {base === 2 ? 'α' : gf8Bits(base)}
                      </button>
                      <ResetButton onClick={() => setK(0)} />
                    </>
                  }
                >
                  <svg viewBox="0 0 320 320" className="mx-auto w-full max-w-[360px]">
                    {[0, 1, 2, 3, 4, 5, 6].map((e) => {
                      const p = pos(e);
                      const q = pos((e + LOG[base]) % 7);
                      return <line key={`l${e}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#e2e8f0" strokeWidth={1.5} />;
                    })}
                    {[0, 1, 2, 3, 4, 5, 6].map((e) => {
                      const p = pos(e);
                      const val = alphaPow(e);
                      const on = LOG[cur] === e;
                      return (
                        <g key={e}>
                          <circle cx={p.x} cy={p.y} r={26} fill={on ? '#ede4ff' : '#fff'} stroke={on ? '#7638dc' : '#94a3b8'} strokeWidth={on ? 3 : 1.5} />
                          <text x={p.x} y={p.y - 3} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
                            {e === 0 ? '1' : `α${'⁰¹²³⁴⁵⁶'[e]}`}
                          </text>
                          <text x={p.x} y={p.y + 13} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, monospace" fill="#64748b">
                            {gf8Bits(val)}
                          </text>
                        </g>
                      );
                    })}
                    <motion.circle r={8} fill="#7638dc" initial={{ cx: pos(0).x, cy: pos(0).y - 34 }} animate={{ cx: pos(LOG[cur]).x, cy: pos(LOG[cur]).y - 34 }} transition={{ type: 'spring', stiffness: 180, damping: 18 }} />
                    <text x={160} y={164} textAnchor="middle" fontSize={13} fill="#334155">
                      已乘 {k} 次
                    </text>
                  </svg>
                </Card>
              }
              aside={
                <>
                  <Card title="這一步的計算">
                    {k === 0 ? (
                      <p className="text-sm text-slate-600">從 1 出發。</p>
                    ) : (
                      <div className="space-y-1 text-sm">
                        <Tex block>{`(${gf8PolyTex(prev)}) \\cdot (${gf8PolyTex(base)}) = ${gf8PolyTex(cur)}`}</Tex>
                        <div className="font-mono">
                          {gf8Bits(prev)} → <strong>{gf8Bits(cur)}</strong>
                        </div>
                        {base === 2 && (prev & 4) !== 0 && (
                          <p className="text-xs text-slate-600">
                            左移後出現 α³，用 α³ = α + 1 回授：<M>{`${alphaPolyTex(prev << 1)} \\to ${gf8PolyTex(cur)}`}</M>
                          </p>
                        )}
                      </div>
                    )}
                    <p className="mt-2 text-xs text-slate-600">
                      {base === 2 ? (
                        <>
                          固定「乘以 α」的電路只要 {BASE_XORS[2]} 個 XOR 閘{BASE_XORS[2] === CHEAPEST ? '，是這三個底數中最少的' : ''}：α 是 <M>{'p(x)'}</M> 的根，乘以它的電路就是 <M>{'p(x)'}</M> 的回授接線。
                        </>
                      ) : (
                        <>
                          固定「乘以 <M>{gf8PowTex(base)}</M>」的電路需要 {BASE_XORS[base]} 個 XOR 閘；乘以 α 只要 {BASE_XORS[2]} 個，因為乘以 <M>{'p(x)'}</M> 的根 α，電路就是 <M>{'p(x)'}</M> 的回授接線。
                        </>
                      )}
                    </p>
                  </Card>
                  <Checks
                    items={[
                      { label: <>底數 {gf8Bits(base)} 的乘法階 = {cycle.length}</>, pass: cycle.length === 7 },
                      { label: <>走過的元素互不相同、都不為 0</>, pass: new Set(cycle).size === cycle.length && !cycle.includes(0) },
                      { label: <>第 {cycle.length} 次回到 1（循環長度整除 7）</>, pass: 7 % cycle.length === 0 },
                    ]}
                  />
                </>
              }
            />
          </>
        ),
      }}
      example={{
        title: '對照：不可約 ≠ 本原（GF(16) 的例子）',
        body: (
          <Card
            title={`GF(16) = GF(2)[x]/(p(x))：α 的次方會走遍 ${F16.size - 1} 個非零元素嗎？`}
            actions={
              <Segmented
                value={gf16}
                onChange={setGf16}
                options={[
                  { value: 'nonprim', label: 'x⁴+x³+x²+x+1' },
                  { value: 'prim', label: 'x⁴+x+1' },
                ]}
              />
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {F16.exp.map((v, i) => (
                <span key={i} className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs">
                  α{String(i).split('').map((d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]).join('')}: {intToBits(v, 4).join('')}
                </span>
              ))}
            </div>
            <p className={`mt-3 text-sm font-semibold ${F16.primitive ? 'text-emerald-700' : 'text-rose-700'}`}>
              α 的乘法階 = {F16.order}（非零元素有 {F16.size - 1} 個）→ {F16.primitive ? '本原多項式 ✓' : `不是本原多項式：α 只走過 ${F16.order} 個元素就回到 1`}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {F16.primitive ? (
                <>接成 {F16.m} 個暫存器的 LFSR，要走 {F16.order} 個時脈才重複，長度 {F16.size - 1} 的 codeword 每個位置都有不同的地址。</>
              ) : (
                <>
                  接成 {F16.m} 個暫存器的 LFSR，每 {F16.order} 個時脈就重複一次。拿它當長度 {F16.size - 1} 的循環碼的生成多項式 g(x)，位置 i 與 i + {F16.order} 的單一錯誤會算出同一個 Syndrome，解碼器分不出錯在哪一格；拿它當擾碼器，圖樣也很快就重複。
                </>
              )}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              兩個多項式都不可約，都能建構 GF(16)；但只有本原多項式的根能當成「位置標籤」。4 次的不可約多項式共 {irreduciblePolys(4).length} 個，其中只有 {primitivePolys(4).length} 個是本原多項式，設計時要從這幾個裡挑。在 GF(8) 不會遇到這個問題，因為 7 是質數。第二課 2-12 的 <M>{'x^7+x^3+1'}</M> 也經程式驗證為本原多項式：接成 {maskDegree(P7)} 個暫存器的 LFSR，要 {orderOfX(P7)} 個時脈才重複。
            </p>
          </Card>
        ),
      }}
      connection={{
        title: '指數 = 位置',
        body: (
          <Plain>
            <p>
              回顧：α 的次方就是「乘以 α」的移位暫存器在走時脈；本原表示它走遍所有非零狀態才重複；位置 <M>{'x^i'}</M> ↔ <M>{'\\alpha^i'}</M> 把「錯在第幾格」變成 GF(8) 裡一個可以相乘、可以解方程的數。下一單元 A5 把整個 codeword 寫成多項式，看生成多項式 g(x) 的根 α 如何讓每個 codeword 都滿足 <M>{'c(\\alpha) = 0'}</M>。
            </p>
          </Plain>
        ),
        links: [
          { to: 'a-3', text: '上一步：用 α³ = α + 1 計算次方' },
          { to: 'a-5', text: '下一步：codeword 寫成多項式，g(x) 的根是 α' },
          { to: 'l2-6', text: '第二課：Syndrome 111 = α⁵ → 錯在 x⁵' },
          { to: 'l2-12', text: '第二課：GF(128) 與本原多項式 x⁷+x³+1' },
        ],
        misconceptions: [
          { wrong: 'α⁷ = 1 是因為「α 是 7 次單位根」所以 α = 1。', right: 'α ≠ 1；α⁷ = 1 但更小的次方都不是 1。α 的乘法階是 7。' },
          {
            wrong: '所有不可約多項式的根都是本原元素。',
            right: <>在 GF(16) 中 x⁴+x³+x²+x+1 不可約，但它的根階數只有 {orderOfX(0b11111)}。本原是更強的條件；少了它，LFSR 的週期變短，位置標籤會重複。</>,
          },
          { wrong: '「α⁵」的 5 和二進位 101 有關。', right: 'α⁵ = α²+α+1 = 111。指數和三位元表示要透過上面的表格轉換。' },
        ],
      }}
    />
  );
}
