import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCw } from 'lucide-react';
import { GF8_ELEMENTS, LOG, alphaPolyTex, alphaPow, buildField, gf8Bits, gf8Mul, gf8Order, gf8PolyTex, gf8PowTex, intToBits, primitiveElements } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, LabGrid, ResetButton, Segmented } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';

const ID = 'a-4';

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
      lead={<p>在 A3 計算 α 的次方時，你可能注意到：α⁷ 又回到 1。這不是巧合——α 的次方剛好走遍 GF(8) 的所有非零元素。這個性質讓我們可以用「指數」來命名每個元素，也讓碼長剛好是 7。</p>}
      why={{
        title: '為什麼關心 α 的次方？',
        body: (
          <Plain>
            <p>
              如果每個非零元素都能寫成 <M>{'\\alpha^i'}</M>，那麼：
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                乘法變成指數相加：<M>{'\\alpha^i \\cdot \\alpha^j = \\alpha^{i+j}'}</M>（硬體上用查表就能乘）。
              </li>
              <li>
                7 個非零元素 <M>{'\\alpha^0, \\dots, \\alpha^6'}</M> 可以一對一對應到 codeword 的 7 個位置——位置 <M>{'x^i'}</M> 對應 <M>{'\\alpha^i'}</M>。這就是 Syndrome <M>{'S_1 = \\alpha^i'}</M> 能告訴我們錯誤位置的原因（第二課 2-6）。
              </li>
              <li>
                Hamming 碼長 <M>{'n = 2^3 - 1 = 7'}</M> 正是非零元素的個數。
              </li>
            </ul>
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
                { zh: '本原多項式', en: 'Primitive Polynomial', def: <>一個不可約多項式，而且它的根 α 是本原元素。<M>{'x^3 + x + 1'}</M> 就是本原多項式。</> },
                {
                  zh: 'Lagrange 定理：為什麼 α⁷ = 1？',
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
              <p className="mt-2 text-sm text-slate-600">本原元素共 {primitiveElements().length} 個。</p>
            </Card>
          </>
        ),
      }}
      how={{
        title: 'α 次方循環動畫',
        body: (
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
                      options={[2, 3, 6].map((b) => ({ value: String(b), label: <M>{`\\text{底數 } ${gf8PowTex(b)}`}</M> }))}
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
        ),
      }}
      example={{
        title: '對照：不可約 ≠ 本原（GF(16) 的例子）',
        body: (
          <Card
            title="GF(16) = GF(2)[x]/(p(x))：α 的次方會走遍 15 個非零元素嗎？"
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
              α 的乘法階 = {F16.order}（非零元素有 15 個）→ {F16.primitive ? '本原多項式 ✓' : '不是本原多項式：α 只走過 5 個元素就回到 1'}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              兩個多項式都不可約，都能建構 GF(16)；但只有本原多項式的根能當成「位置標籤」。在 GF(8) 不會遇到這個問題，因為 7 是質數。第二課 2-12 的 <M>{'x^7+x^3+1'}</M> 也經程式驗證為本原多項式。
            </p>
          </Card>
        ),
      }}
      connection={{
        title: '指數 = 位置',
        links: [
          { to: 'a-3', text: '上一步：用 α³ = α + 1 計算次方' },
          { to: 'a-5', text: '下一步：codeword 寫成多項式，g(x) 的根是 α' },
          { to: 'l2-6', text: '第二課：Syndrome 111 = α⁵ → 錯在 x⁵' },
          { to: 'l2-12', text: '第二課：GF(128) 與本原多項式 x⁷+x³+1' },
        ],
        misconceptions: [
          { wrong: 'α⁷ = 1 是因為「α 是 7 次單位根」所以 α = 1。', right: 'α ≠ 1；α⁷ = 1 但更小的次方都不是 1。α 的乘法階是 7。' },
          { wrong: '所有不可約多項式的根都是本原元素。', right: '在 GF(16) 中 x⁴+x³+x²+x+1 不可約，但它的根階數只有 5。本原是更強的條件。' },
          { wrong: '「α⁵」的 5 和二進位 101 有關。', right: 'α⁵ = α²+α+1 = 111。指數和三位元表示要透過上面的表格轉換。' },
        ],
      }}
    />
  );
}
