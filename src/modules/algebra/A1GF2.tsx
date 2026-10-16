import { useState } from 'react';
import { type Bit, GF2, H74, LAYOUT_74, characteristic, checkFieldAxioms, encode74, flipBit, matVec } from '../../core';
import { M, Tex } from '../../components/Tex';
import { BitCell, BitRow, MessageInput } from '../../components/Bits';
import { MatrixView } from '../../components/MatrixView';
import { Card, Derivation, LabGrid, ResetButton, Segmented } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';
import { StepControls, useStepper } from '../../components/l2/Stepper';

const ID = 'a-1';

export default function A1GF2() {
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(1);
  const [op, setOp] = useState<'add' | 'sub' | 'mul'>('add');
  const [m, setM] = useState<Bit[]>([1, 0, 1, 1]);
  const [flip, setFlip] = useState<number | null>(null);
  const charSteps = useStepper(3, { interval: 1000 });

  const c = encode74(m);
  const r = flip === null ? c : (flipBit(c, flip) as Bit[]);
  const s = matVec(H74, r);
  const axioms = checkFieldAxioms(GF2);
  const intRes = op === 'mul' ? a * b : op === 'add' ? a + b : a - b;
  const gfRes = op === 'mul' ? GF2.mul(a, b) : GF2.add(a, b); // subtraction = addition in GF(2)

  return (
    <AlgebraUnit
      id={ID}
      lead={<p>這一章要回答一個問題：「線性代數已經能處理 Hamming Code，為什麼還需要多項式、GF(8)、循環碼？」第一步，先把我們一直在用、卻沒有正式命名的運算規則說清楚——GF(2)。</p>}
      why={{
        title: 'Hamming Code 早就在用 GF(2)',
        body: (
          <Plain>
            <p>
              第一課計算同位位元時，我們寫 <M>{'P_1 = D_1 \\oplus D_2 \\oplus D_4'}</M>；檢查 codeword 時寫 <M>{'Hc^T = 0'}</M>。這些「加法」其實都不是普通加法：<M>{'1 + 1'}</M> 我們都當成 <M>0</M>。
            </p>
            <p>
              如果用普通加法，<M>{'Hc^T'}</M> 可能算出 2、3 這種數字，就沒辦法說「等於 0 代表合法」。所以 Hamming Code 從一開始就生活在一個只有 0 和 1、而且 <M>{'1 + 1 = 0'}</M> 的世界。這個世界有名字：<strong>GF(2)</strong>。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: 'GF(2)、體、特徵與模運算',
        body: (
          <>
            <Terms
              items={[
                { zh: '模運算', en: 'Modular Arithmetic', def: <>只看除以 2 的餘數：<M>{'3 \\equiv 1 \\pmod 2'}</M>。GF(2) 的加法與乘法就是「先照常算，再取 mod 2」。</> },
                { zh: '有限體', en: 'Finite Field / Galois Field', def: <>一個有限集合，可以做加、減、乘、除（除數不為 0），而且滿足交換律、結合律、分配律。GF(2) = <M>{'\\{0, 1\\}'}</M> 是最小的體。</> },
                { zh: '特徵', en: 'Characteristic', def: <>把 1 一直加，第一次得到 0 時加了幾次。GF(2) 中 <M>{'1 + 1 = 0'}</M>，特徵是 2。</> },
                { zh: '互斥或', en: 'XOR', def: <>GF(2) 的加法表與 XOR 真值表完全相同；乘法表與 AND 相同。</> },
              ]}
            />
            <Card title="GF(2) 真的是一個體嗎？（程式逐條窮舉檢查）">
              <Checks title="體的公理（Field Axioms）" items={axioms.map((x) => ({ label: x.zh, pass: x.holds, detail: x.counterexample }))} />
              <p className="mt-2 text-sm text-slate-600">
                特徵（由程式計算）：<strong>{characteristic(GF2)}</strong>。下一個單元會看到 <M>{'\\mathbb{Z}/8\\mathbb{Z}'}</M> 在同樣的檢查中失敗。
              </p>
            </Card>
          </>
        ),
      }}
      how={{
        title: 'GF(2) 計算器',
        body: (
          <LabGrid
            main={
              <Card
                title="點擊 a、b 切換 0/1，選擇運算"
                actions={
                  <>
                    <Segmented
                      value={op}
                      onChange={setOp}
                      options={[
                        { value: 'add', label: 'a + b' },
                        { value: 'sub', label: 'a − b' },
                        { value: 'mul', label: 'a · b' },
                      ]}
                    />
                    <ResetButton
                      onClick={() => {
                        setA(1);
                        setB(1);
                        setOp('add');
                      }}
                    />
                  </>
                }
              >
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex items-end gap-3">
                    <BitCell value={a} label="a" size="lg" onClick={() => setA((1 - a) as Bit)} />
                    <span className="pb-3 text-2xl text-slate-400">{op === 'add' ? '+' : op === 'sub' ? '−' : '·'}</span>
                    <BitCell value={b} label="b" size="lg" onClick={() => setB((1 - b) as Bit)} />
                  </div>
                  <div className="space-y-1 text-lg">
                    <div>
                      <Tex>{`\\text{整數運算：}\\ ${a} ${op === 'add' ? '+' : op === 'sub' ? '-' : '\\cdot'} ${b} = ${intRes}`}</Tex>
                    </div>
                    <div>
                      <Tex>{`\\text{取 mod 2：}\\ ${intRes} \\equiv ${gfRes} \\pmod 2`}</Tex>
                    </div>
                    <div className="text-sm text-slate-500">{op === 'mul' ? `= ${a} AND ${b}` : `= ${a} XOR ${b}`}</div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4 text-center text-sm">
                  {(['add', 'mul'] as const).map((o) => (
                    <table key={o} className="mx-auto">
                      <tbody>
                        <tr>
                          <td className="p-1.5 font-semibold">{o === 'add' ? '+' : '·'}</td>
                          <td className="p-1.5 font-semibold">0</td>
                          <td className="p-1.5 font-semibold">1</td>
                        </tr>
                        {[0, 1].map((x) => (
                          <tr key={x}>
                            <td className="p-1.5 font-semibold">{x}</td>
                            {[0, 1].map((y) => {
                              const on = x === a && y === b && (o === 'mul') === (op === 'mul');
                              return (
                                <td key={y} className={`rounded p-1.5 font-mono ${on ? 'bg-amber-100 font-bold' : ''}`}>
                                  {o === 'add' ? GF2.add(x, y) : GF2.mul(x, y)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ))}
                </div>
              </Card>
            }
            aside={
              <Card title="特徵 = 2：把 1 一直加">
                <StepControls s={charSteps} />
                <div className="mt-3 space-y-1 font-mono text-lg">
                  {['1', '1 + 1', '1 + 1 + 1'].slice(0, charSteps.step + 1).map((t, k) => {
                    let acc = 0;
                    for (let i = 0; i <= k; i++) acc = GF2.add(acc, 1);
                    return (
                      <div key={k} className={acc === 0 ? 'font-bold text-emerald-700' : ''}>
                        {t} = {acc} {acc === 0 && '← 第一次回到 0'}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-sm text-slate-600">
                  所以 <M>{'-1 = 1'}</M>：減法和加法完全一樣，<M>{'a - b = a + b'}</M>。
                </p>
              </Card>
            }
          />
        ),
      }}
      example={{
        title: 'Hamming(7,4) 的 Hcᵀ = 0 就是 GF(2) 線性代數',
        body: (
          <LabGrid
            main={
              <Card
                title="選訊息 → 編碼（第一課的標準排列），可再點一個位元製造錯誤"
                actions={
                  <ResetButton
                    onClick={() => {
                      setM([1, 0, 1, 1]);
                      setFlip(null);
                    }}
                  />
                }
              >
                <div className="flex flex-wrap items-end gap-4">
                  <MessageInput message={m} onToggle={(i) => setM(m.map((x, j) => (j === i ? ((1 - x) as Bit) : x)))} size="sm" />
                  <BitRow bits={r} layout={LAYOUT_74} size="sm" states={r.map((_, i) => (i === flip ? 'error' : 'normal'))} onToggle={(i) => setFlip(flip === i ? null : i)} />
                </div>
                <div className="mt-4">
                  <MatrixView matrix={H74} name="H" colLabels={r.map((x) => `r=${x}`)} highlightCols={r.flatMap((x, j) => (x ? [j] : []))} />
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  {H74.map((row, i) => {
                    const used = row.flatMap((h, j) => (h && r[j] ? [j] : []));
                    const total = used.length;
                    return (
                      <div key={i}>
                        <Tex>{`\\text{第 ${i + 1} 列：}\\ ${row.map((h, j) => (h ? `r_{${j + 1}}` : null)).filter(Boolean).join(' + ')} = ${row.flatMap((h, j) => (h ? [r[j]] : [])).join(' + ')} = ${total} \\equiv ${total % 2} \\pmod 2`}</Tex>
                      </div>
                    );
                  })}
                </div>
              </Card>
            }
            aside={
              <>
                <Card title="結果">
                  <div className="text-lg">
                    <M>{`Hr^T = (${s.join(', ')})^T`}</M>
                  </div>
                  <p className={`mt-1 text-sm ${s.some(Boolean) ? 'text-rose-700' : 'text-emerald-700'}`}>{s.some(Boolean) ? '不是 0：至少有一個同位檢查失敗（第一課第 3 章的 Syndrome）' : '全部是 0：合法 codeword'}</p>
                  <p className="mt-2 text-sm text-slate-600">如果把「mod 2」拿掉，整數結果會出現 2、4 這種數字，「= 0」就不再代表「同位檢查通過」。</p>
                </Card>
                <Derivation
                  title="一列的完整手算"
                  steps={[
                    { title: '選出 H 第 1 列為 1 的位置', body: <Tex block>{'(H r^T)_1 = r_1 + r_3 + r_5 + r_7'}</Tex> },
                    { title: '代入目前的位元', body: <Tex block>{`= ${r[0]} + ${r[2]} + ${r[4]} + ${r[6]}`}</Tex> },
                    { title: '整數相加再取 mod 2', body: <Tex block>{`= ${r[0] + r[2] + r[4] + r[6]} \\equiv ${(r[0] + r[2] + r[4] + r[6]) % 2} \\pmod 2`}</Tex> },
                  ]}
                />
              </>
            }
          />
        ),
      }}
      connection={{
        title: 'GF(2) 不是額外加入的工具',
        body: (
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">
              第一課所有的矩陣乘法、rank、kernel 都是「GF(2) 上的線性代數」。這一章接下來要做的，是把 GF(2) <strong>擴大</strong>成一個有 8 個元素的體 GF(8)，讓我們能用多項式和「根」來描述同一個 Hamming Code。
            </p>
          </Card>
        ),
        links: [
          { to: 'matrix', text: '第一課：c = mG、Hcᵀ = 0、rank 與 kernel 都在 GF(2) 中計算' },
          { to: 'syndrome', text: '第一課：Syndrome = Hrᵀ 的每一個分量都是 mod 2 加總' },
          { to: 'a-2', text: '下一步：為什麼要把 GF(2) 擴大成 GF(8)？' },
          { to: 'a-0', text: '回到概念地圖' },
        ],
        misconceptions: [
          { wrong: '1 + 1 = 2，只是我們「假裝」它是 0。', right: '在 GF(2) 中 1 + 1 就是 0，這是加法的定義，不是近似。2 這個符號根本不在集合裡。' },
          { wrong: '減法要特別處理正負號。', right: 'GF(2) 的特徵是 2，−1 = 1，所以 a − b = a + b。所有「減」都可以寫成 XOR。' },
          { wrong: 'XOR 和 GF(2) 加法是兩種不同的運算。', right: '它們的運算表完全相同；XOR 是 GF(2) 加法在電路裡的名字。' },
        ],
      }}
    />
  );
}

