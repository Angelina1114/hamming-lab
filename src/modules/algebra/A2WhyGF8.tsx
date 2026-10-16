import { useState } from 'react';
import { motion } from 'framer-motion';
import { GF8_ELEMENTS, GF8_FIELD, H74, LAYOUT_74, checkFieldAxioms, column, gf8Add, gf8Bits, gf8PolyTex, gf8PowTex, zmod } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, LabGrid, ResetButton, Segmented } from '../../components/Lesson';
import { MatrixView } from '../../components/MatrixView';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { Checks } from '../../components/l2/Common';

const ID = 'a-2';
const Z8 = zmod(8);

export default function A2WhyGF8() {
  const [sel, setSel] = useState(5);
  const [other, setOther] = useState(3);
  const [table, setTable] = useState<'gf8' | 'z8'>('gf8');
  const [col, setCol] = useState(2);

  const S = table === 'gf8' ? GF8_FIELD : Z8;
  const label = (x: number) => (table === 'gf8' ? gf8Bits(x) : String(x));
  const axioms = checkFieldAxioms(S, label);

  return (
    <AlgebraUnit
      id={ID}
      lead={<p>GF(2) 的矩陣已經足以建構 Hamming(7,4)。那為什麼教科書還要大費周章建立一個有 8 個元素的體？這一單元先回答「為什麼」，再看 GF(8) 長什麼樣子。</p>}
      why={{
        title: '線性代數夠用了，為什麼還要 GF(8)？',
        body: (
          <>
            <Plain>
              <p>
                先誠實地說：<strong>只用 GF(2) 的矩陣，就能完整建構 Hamming(7,4)</strong>（第一課就是這樣做的）。GF(8) 不是「修好」什麼缺陷，而是提供一個<strong>額外的乘法結構</strong>。
              </p>
              <p>
                看看 H 的 7 個欄：剛好是 7 個不同的非零 3 位元向量。在 GF(2) 的觀點裡，它們只是 7 個向量，可以相加、但不能相乘。如果能把每個 3 位元向量當成一個「數」，可以相加<strong>也可以相乘、相除</strong>，那麼：
              </p>
              <ul className="ml-5 list-disc space-y-1">
                <li>
                  三條 GF(2) 檢查方程 <M>{'Hc^T = 0'}</M> 可以濃縮成<strong>一條</strong>方程 <M>{'c(\\alpha) = 0'}</M>（A9）。
                </li>
                <li>Codeword 可以寫成多項式，編碼變成多項式乘法、除法（A5；硬體 LFSR 見第二課 2-2）。</li>
                <li>解碼變成「解方程、找根」（A10，以及第二課 2-7 的 Chien Search），並能推廣到可更正多個錯誤的 BCH、Reed–Solomon Code。</li>
              </ul>
            </Plain>
          </>
        ),
      }}
      what={{
        title: 'GF(8) = GF(2³) 的元素',
        body: (
          <>
            <Terms
              items={[
                { zh: '擴張體', en: 'Extension Field', def: <>把 GF(2) 擴大成更大的體。GF(8) 的每個元素都寫成 <M>{'a + b\\alpha + c\\alpha^2'}</M>，其中 <M>{'a,b,c \\in \\mathrm{GF}(2)'}</M>。</> },
                { zh: '元素個數', en: 'Order of the Field', def: <>每個係數有 2 種選擇，共 <M>{'2^3 = 8'}</M> 個元素，所以叫 GF(8) 或 <M>{'\\mathrm{GF}(2^3)'}</M>。</> },
                { zh: '加法', en: 'Addition', def: <>係數逐項在 GF(2) 中相加 = 三位元 XOR。</> },
                { zh: 'α 是什麼？', def: <>暫時把 α 想成一個「新的符號」，滿足某個規則（A3 會揭曉是 <M>{'\\alpha^3 = \\alpha + 1'}</M>），讓乘法結果永遠留在這 8 個元素裡。</> },
              ]}
            />
            <Card title="GF(8) 元素表：點擊元素">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {GF8_ELEMENTS.map((x) => (
                  <button
                    key={x}
                    onClick={() => setSel(x)}
                    className={`rounded-xl border-2 p-2 text-left transition-colors ${x === sel ? 'border-overall-500 bg-overall-50' : 'border-slate-200 hover:border-slate-400'}`}
                  >
                    <div className="font-mono text-lg font-bold">{gf8Bits(x)}</div>
                    <div className="text-sm">
                      <M>{gf8PolyTex(x)}</M>
                    </div>
                  </button>
                ))}
              </div>
              <motion.div key={sel} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl bg-overall-50 p-3 text-sm">
                <div>
                  二進位 <span className="mono font-bold">{gf8Bits(sel)}</span> ↔ 多項式 <M>{gf8PolyTex(sel)}</M>
                </div>
                <div className="mt-1 text-slate-600">
                  三個位元依序是 <M>{'\\alpha^2,\\ \\alpha,\\ 1'}</M> 的係數：<M>{`${(sel >> 2) & 1}\\cdot\\alpha^2 + ${(sel >> 1) & 1}\\cdot\\alpha + ${sel & 1}`}</M>
                  {sel !== 0 && (
                    <>
                      。在 A4 會看到它也等於 <M>{gf8PowTex(sel)}</M>。
                    </>
                  )}
                </div>
              </motion.div>
            </Card>
          </>
        ),
      }}
      how={{
        title: 'GF(8) 不是「整數 mod 8」',
        body: (
          <LabGrid
            main={
              <Card
                title="比較兩種 8 元素結構的乘法表"
                actions={
                  <Segmented
                    value={table}
                    onChange={setTable}
                    options={[
                      { value: 'gf8', label: 'GF(8)' },
                      { value: 'z8', label: 'ℤ/8（整數 mod 8）' },
                    ]}
                  />
                }
              >
                <div className="overflow-x-auto">
                  <table className="mx-auto text-center font-mono text-xs sm:text-sm">
                    <thead>
                      <tr>
                        <th className="p-1">·</th>
                        {S.elements.map((y) => (
                          <th key={y} className="p-1 text-slate-500">
                            {label(y)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {S.elements.map((x) => (
                        <tr key={x}>
                          <th className="p-1 text-slate-500">{label(x)}</th>
                          {S.elements.map((y) => {
                            const v = S.mul(x, y);
                            const zeroDiv = v === 0 && x !== 0 && y !== 0;
                            return (
                              <td key={y} className={`rounded p-1 ${zeroDiv ? 'bg-rose-200 font-bold text-rose-800' : v === 1 ? 'bg-emerald-100 text-emerald-800' : ''}`} title={zeroDiv ? '零因子：兩個非零元素相乘得 0' : undefined}>
                                {label(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500">綠色 = 乘積為 1（找到反元素）；紅色 = 兩個非零元素相乘得 0（零因子）。</p>
              </Card>
            }
            aside={<Checks title={`${S.name} 是體嗎？`} items={axioms.filter((x) => ['mul-inv', 'no-zero-div', 'distrib', 'add-inv'].includes(x.key)).map((x) => ({ label: x.zh, pass: x.holds, detail: x.counterexample }))} />}
          />
        ),
      }}
      example={{
        title: 'Hamming 的 7 個欄 = GF(8) 的 7 個非零元素',
        body: (
          <LabGrid
            main={
              <Card title="點擊 H 的一欄（第一課的標準排列）" actions={<ResetButton onClick={() => setCol(2)} />}>
                <MatrixView
                  matrix={H74}
                  name="H ="
                  colLabels={LAYOUT_74.map((p) => p.label)}
                  highlightCols={[col]}
                  onCellClick={(_, j) => setCol(j)}
                />
                <p className="mt-3 text-sm text-slate-700">
                  第 {col + 1} 欄（由上而下）是 ({column(H74, col).join(', ')})。把它讀成 <M>{'1, \\alpha, \\alpha^2'}</M> 的係數，就是 GF(8) 元素 <M>{gf8PolyTex(col + 1)}</M>（3 位元寫作 <span className="mono">{gf8Bits(col + 1)}</span>）。
                </p>
                <p className="mt-2 text-sm text-slate-600">7 個欄剛好用完 GF(8) 的 7 個非零元素——這不是巧合，Hamming Code 的 H 就是「列出所有非零元素」。</p>
              </Card>
            }
            aside={
              <Card title="加法就是 XOR（自己選兩個元素）">
                <div className="flex flex-wrap gap-1">
                  {GF8_ELEMENTS.map((x) => (
                    <button key={x} onClick={() => setOther(x)} className={`chip border font-mono ${x === other ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
                      {gf8Bits(x)}
                    </button>
                  ))}
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <Tex block>{`(${gf8PolyTex(sel)}) + (${gf8PolyTex(other)}) = ${gf8PolyTex(gf8Add(sel, other))}`}</Tex>
                  <div className="font-mono">
                    {gf8Bits(sel)} ⊕ {gf8Bits(other)} = <strong>{gf8Bits(gf8Add(sel, other))}</strong>
                  </div>
                  <p className="text-xs text-slate-500">上面元素表選的是第一個元素（目前 {gf8Bits(sel)}）。乘法要等 A3 知道 α³ 是什麼才能算。</p>
                </div>
              </Card>
            }
          />
        ),
      }}
      connection={{
        title: '從 GF(2) 向量到 GF(8) 的數',
        links: [
          { to: 'a-1', text: '上一步：GF(2) 是 Hamming Code 本來的運算' },
          { to: 'a-3', text: '下一步：α 到底是什麼？用不可約多項式建構 GF(8)' },
          { to: 'a-9', text: '終點之一：把 H 的每一欄寫成 αⁱ，Hcᵀ = 0 變成 c(α) = 0' },
          { to: 'l2-6', text: '第二課：Syndrome 111 就是 GF(8) 元素 α⁵' },
        ],
        misconceptions: [
          { wrong: 'GF(8) 就是 {0,1,…,7} 做 mod 8 的運算。', right: 'ℤ/8 中 2·4 = 0、2 沒有反元素，不是體。GF(8) 的元素是 α 的多項式，加法是 XOR，乘法另有規則。' },
          { wrong: '有了 GF(8)，GF(2) 的矩陣方法就錯了。', right: '兩種方法描述的是等價的 code（只差一個座標排列，A9 會證明）。GF(8) 提供的是更多結構：乘法、根、多項式。' },
          { wrong: '3 位元字串 101 代表數字 5。', right: '在 GF(8) 中 101 代表 α² + 1。把它當成整數 5 去做乘法會得到錯的答案。' },
        ],
      }}
    />
  );
}
