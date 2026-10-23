import { useState } from 'react';
import {
  type Bit,
  H74,
  LAYOUT_74,
  alphaPow,
  cyclicGenerator,
  cyclicIndexToStandardPosition,
  codewords74,
  cyclicWordToStandard,
  encodeNonSystematic,
  flipBit,
  gf8Bits,
  gf8PolyTex,
  hFromGF8,
  hammingSyndromeXors,
  inCyclicCode,
  intToBits,
  isCodeword74,
  matMul,
  matVec,
  syndromeTable,
  transpose,
  wordAtAlpha,
  xorNetworkGates,
} from '../../core';
import { cyclicShiftEscapes } from '../../core/engineering-g5';
import { M, Tex } from '../../components/Tex';
import { Card, LabGrid, ResetButton } from '../../components/Lesson';
import { MatrixView, ColumnVector } from '../../components/MatrixView';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { BitPolyEditor } from '../../components/alg/PolyViews';
import { Checks } from '../../components/l2/Common';
import { StepControls, useStepper } from '../../components/l2/Stepper';

const ID = 'a-9';
const HC = hFromGF8();
const GC = cyclicGenerator();
const COL_LABELS = ['α⁶', 'α⁵', 'α⁴', 'α³', 'α²', 'α', '1'];
const powTex = (e: number) => (e === 0 ? '1' : e === 1 ? '\\alpha' : `\\alpha^{${e}}`);
const SINGLE = syndromeTable(); // syndrome a single error at each position leaves in the divider register
const L1_CODE = codewords74().map((x) => x.codeword);
const L1_ESCAPES = cyclicShiftEscapes(L1_CODE); // Lesson 1 codewords that leave the code after one cyclic shift
const HC_XORS = xorNetworkGates(HC); // three parallel XOR trees of H_cyc
const L1_XORS = hammingSyndromeXors(3); // the same for Lesson 1's H

export default function A9HMatrix() {
  const build = useStepper(8, { interval: 900 });
  const built = build.step; // number of filled columns
  const [w, setW] = useState<Bit[]>(encodeNonSystematic([1, 0, 1, 1]));
  const terms = w.flatMap((b, k) => (b ? [6 - k] : []));
  let acc = 0;
  const accRows = terms.map((e) => {
    acc ^= alphaPow(e);
    return { e, v: alphaPow(e), acc };
  });
  const atAlpha = wordAtAlpha(w);
  const hw = matVec(HC, w);
  const HG = matMul(HC, transpose(GC));
  const std = cyclicWordToStandard(w);

  return (
    <AlgebraUnit
      id={ID}
      convention
      lead={<p>第一課的 H 是 GF(2) 矩陣，A5–A8 的條件是 GF(8) 方程 <M>{'c(\\alpha) = 0'}</M>。這一單元把兩者接起來：把每個 <M>{'\\alpha^i'}</M> 寫成 3 位元向量，一條 GF(8) 方程就攤開成三條 GF(2) 方程——也就是一個 3×7 的 H。</p>}
      takeaway={
        <>
          <M>{'c(\\alpha) = 0'}</M> 就是三條 parity check 都通過；H 的第 k 欄是第 k 個 bit 單獨翻轉時的 syndrome。
        </>
      }
      why={{
        title: '兩種語言，同一個 code',
        body: (
          <Plain>
            <p>
              先看接收端實際在做什麼。第一課的 H 有三列，每一列是一條 parity check：把它盯著的那幾個 bit 全部 XOR 起來，結果是 0 就代表這條檢查通過，三條檢查的輸出合起來就是 3 位元的 syndrome。所以「H 長什麼樣子」其實就是「檢查電路怎麼接線」：第 k 欄寫的是第 k 個 bit 接到哪幾條檢查，也就是這個 bit 單獨被雜訊翻轉時得到的 syndrome。
            </p>
            <p>
              到目前為止有兩套說法：線性代數說「<M>{'Hc^T = 0'}</M> 的 c 是 codeword」；finite field 說「<M>{'c(\\alpha) = 0'}</M> 的 c 是 codeword」。如果它們描述的是同一個 code，就應該能從其中一個<strong>推導</strong>出另一個。這一單元做的就是這個推導，也回答了整章的問題：GF(8) 不是取代線性代數，而是用更緊湊的方式寫出同一組方程。
            </p>
            <p>
              那為什麼不沿用第一課的 H 就好？第一課把第 j 欄排成 j 的二進位，好處是 syndrome 直接讀成錯誤位置的編號，不必換算；代價是這樣排出來的 code 不是 cyclic code：第一課的 {L1_CODE.length} 個 codeword 裡，有 {L1_ESCAPES} 個做一格 cyclic shift 後就不再是 codeword，A5、A6 的 LFSR encoder 和除法 register 都用不上。GF(8) 給出的排列是第 k 欄 = <M>{'\\alpha^{7-k}'}</M>，相鄰兩欄剛好差一個 α 倍，所以位移後仍是 codeword，同一組檢查就能改成幾個 register、一個時脈處理一個 bit（A10）。換來的代價是 syndrome 不再直接是位置編號，要多做一次「取對數」。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: '座標化：GF(8) 元素 = GF(2)³ 向量',
        body: (
          <>
            <Terms
              items={[
                { term: 'Basis α², α, 1', def: <>每個 GF(8) 元素唯一寫成 <M>{'a\\alpha^2 + b\\alpha + c'}</M>，對應向量 <M>{'(a, b, c)^T'}</M>。例如 <M>{'\\alpha^6 = \\alpha^2 + 1 \\leftrightarrow (1,0,1)^T'}</M>。</> },
                { term: '代入 α', def: <><M>{'c(\\alpha) = c_6\\alpha^6 + c_5\\alpha^5 + \\cdots + c_0'}</M>，每個 <M>{'c_i \\in \\{0,1\\}'}</M> 只決定「這一項要不要加」。</> },
                { term: '一條 GF(8) 方程 = 三條 GF(2) 方程', def: <>GF(8) 元素等於 0 ⇔ 三個座標都是 0。把 <M>{'c(\\alpha)'}</M> 的三個座標分開寫，就是 H 的三列；在電路上就是三棵 XOR 樹，各輸出 syndrome 的一個 bit。</> },
              ]}
            />
            <Card>
              <Tex block>{'c(\\alpha) = \\sum_{i=0}^{6} c_i\\,\\alpha^i = \\underbrace{\\big[\\,\\alpha^6\\ \\alpha^5\\ \\alpha^4\\ \\alpha^3\\ \\alpha^2\\ \\alpha\\ 1\\,\\big]}_{\\text{每一項寫成 3 位元直行}}\\begin{bmatrix}c_6\\\\ \\vdots\\\\ c_0\\end{bmatrix} = H_{\\text{cyc}}\\,c^T'}</Tex>
            </Card>
          </>
        ),
      }}
      how={{
        title: '逐欄建立 H_cyc',
        body: (
          <LabGrid
            main={
              <Card title="按「下一步」填入一欄" actions={<StepControls s={build} />}>
                <MatrixView
                  matrix={HC.map((row) => row.map((v, k) => (k < built ? v : 0) as Bit))}
                  name={<M>{'H_{\\text{cyc}} ='}</M>}
                  colLabels={COL_LABELS}
                  rowLabels={['α²', 'α', '1']}
                  highlightCols={built > 0 && built <= 7 ? [built - 1] : []}
                  cellClass={(_, k) => (k >= built ? 'text-slate-200' : undefined)}
                />
              </Card>
            }
            aside={
              <Card title="這一欄怎麼來">
                {built === 0 ? (
                  <p className="text-sm text-slate-600">從最左欄（<M>{'x^6'}</M> 的位置，對應 <M>{'\\alpha^6'}</M>）開始。</p>
                ) : (
                  (() => {
                    const k = Math.min(built, 7) - 1;
                    const e = 6 - k;
                    return (
                      <div className="space-y-2 text-sm">
                        <div>
                          第 {k + 1} 欄 = 位置 <M>{`x^{${e}}`}</M> 的係數 <M>{`c_{${e}}`}</M> 所乘的元素 <M>{powTex(e)}</M>
                        </div>
                        <Tex block>{`${powTex(e)} = ${gf8PolyTex(alphaPow(e))} \\;\\leftrightarrow\\; (${intToBits(alphaPow(e), 3).join(',')})^T`}</Tex>
                        <ColumnVector bits={intToBits(alphaPow(e), 3)} cellClass="bg-fuchsia-100 text-fuchsia-800" />
                        <p className="text-xs text-slate-600">
                          只讓這個 bit 出錯時，第二課 2-4 的除法 register 留下的餘數也是 <span className="mono font-semibold">{SINGLE[k].syndrome.join('')}</span>：這一欄就是「這個位置被翻轉時，三條檢查各自的反應」。
                        </p>
                        <p className="text-xs text-slate-500">（α 的次方表見 A4。）</p>
                      </div>
                    );
                  })()
                )}
              </Card>
            }
          />
        ),
      }}
      example={{
        title: 'c(α) = 0 ⇔ H_cyc cᵀ = 0',
        body: (
          <>
            <LabGrid
              main={
                <Card title="點擊位元改變 c（預設：m = 1011 的 nonsystematic codeword）" actions={<ResetButton onClick={() => setW(encodeNonSystematic([1, 0, 1, 1]))} />}>
                  <BitPolyEditor bits={w} onToggle={(i) => setW(flipBit(w, i) as Bit[])} />
                  <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="mb-1 text-xs font-semibold text-slate-500">GF(8) 觀點：c(α)</div>
                      <Tex block>{`c(\\alpha) = ${terms.map(powTex).join(' + ') || '0'}`}</Tex>
                      <table className="w-full text-sm">
                        <tbody className="font-mono">
                          {accRows.map((r, k) => (
                            <tr key={k} className="border-t border-slate-100">
                              <td className="py-0.5">
                                <M>{powTex(r.e)}</M>
                              </td>
                              <td>{gf8Bits(r.v)}</td>
                              <td className={k === accRows.length - 1 ? 'font-bold' : 'text-slate-500'}>累計 {gf8Bits(r.acc)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="mt-1 text-sm">
                        <M>{`c(\\alpha) = ${gf8PolyTex(atAlpha)}`}</M>（{gf8Bits(atAlpha)}）
                      </div>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <div className="mb-1 text-xs font-semibold text-slate-500">GF(2) 觀點：H_cyc cᵀ（選中的欄相加）</div>
                      <MatrixView matrix={HC} size="sm" colLabels={w.map((b) => `${b}`)} highlightCols={w.flatMap((b, k) => (b ? [k] : []))} />
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <M>{'H_{\\text{cyc}}c^T ='}</M>
                        <ColumnVector bits={hw} size="sm" cellClass="bg-emerald-50 text-emerald-800" />
                      </div>
                    </div>
                  </div>
                </Card>
              }
              aside={
                <Checks
                  items={[
                    { label: <>c(α) 的三個座標 = H_cyc cᵀ = ({hw.join(',')})</>, pass: intToBits(atAlpha, 3).join('') === hw.join('') },
                    { label: <>{atAlpha === 0 ? 'c(α) = 0：合法 codeword' : 'c(α) ≠ 0：不是 codeword'}</>, pass: (atAlpha === 0) === inCyclicCode(w) },
                    { label: <>H_cyc G_cycᵀ = 0（{HG.flat().every((x) => x === 0) ? '3×4 零矩陣' : '非零'}）</>, pass: HG.flat().every((x) => x === 0) },
                  ]}
                />
              }
            />
            <Card title="Equivalent code，不同座標：和第一課的 Hamming(7,4) 對照">
              <p className="text-sm text-slate-700">
                H_cyc 第 k 欄（k = 1…7）是 <M>{'\\alpha^{7-k}'}</M> 的係數（由上而下 <M>{'\\alpha^2, \\alpha, 1'}</M>）；第一課 H 第 j 欄是 j 的二進位（低位在上）。把 <M>{'\\alpha^{7-k}'}</M> 的係數讀成 <M>{'j = b_0 + 2b_1 + 4b_2'}</M>，兩欄就是同一組位元，只是上下順序相反。所以兩個 code 只差一個座標排列：
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[460px] text-center text-sm">
                  <tbody>
                    <tr>
                      <td className="py-1 text-left text-xs text-slate-500">Cyclic code 位置（左 = x⁶）</td>
                      {COL_LABELS.map((_, k) => (
                        <td key={k} className="font-mono">
                          x{['⁶', '⁵', '⁴', '³', '²', '', '⁰'][k]}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-1 text-left text-xs text-slate-500">欄 = αⁱ</td>
                      {COL_LABELS.map((l) => (
                        <td key={l}>{l}</td>
                      ))}
                    </tr>
                    <tr className="font-semibold text-overall-700">
                      <td className="py-1 text-left text-xs text-slate-500">第一課位置</td>
                      {COL_LABELS.map((_, k) => (
                        <td key={k}>
                          #{cyclicIndexToStandardPosition(k)}
                          <div className="text-[10px] font-normal text-slate-400">{LAYOUT_74[cyclicIndexToStandardPosition(k) - 1].label}</div>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-2">
                  目前的 c = <span className="mono">{w.join('')}</span> → 重新排列為 <span className="mono font-semibold">{std.join('')}</span>
                </div>
                <div className={`rounded-lg p-2 ${isCodeword74(std) === inCyclicCode(w) ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                  第一課 H·(排列後)ᵀ = ({matVec(H74, std).join(',')}) — {isCodeword74(std) ? '是第一課的 codeword' : '不是 codeword'}（與 c(α) {inCyclicCode(w) ? '= 0' : '≠ 0'} 一致）
                </div>
              </div>
            </Card>
            <Plain>
              <p>
                回到電路上讀這個例子：<M>{'H_{\\text{cyc}}c^T'}</M> 的三個位元就是三棵 XOR 樹的輸出，合法 codeword 讓三棵樹同時輸出 0。從合法 codeword 出發只點一個 bit 製造錯誤，輸出就變成那一欄的樣式——接收端正是靠這個樣式知道哪一個 bit 被翻轉了。
              </p>
              <p>
                上表也說明兩個 H 在硬體上的關係：把 7 條輸入線照「第一課位置」重新排列，再把三個輸出上下顛倒，H_cyc 的電路就變成第一課的電路。parallel 實作時 H_cyc 用 {HC_XORS} 個 XOR 閘，第一課的 H 也是 {L1_XORS} 個；換成 GF(8) 的排列只是重新接線，不多花任何一個閘。
              </p>
            </Plain>
          </>
        ),
      }}
      connection={{
        title: '這就是整章問題的答案',
        body: (
          <Card>
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <p>
                線性代數（H）與 finite field（<M>{'c(\\alpha)=0'}</M>）描述的是<strong>同一個 cyclic Hamming code</strong>。GF(8) 的價值在於它多出來的結構：code 是 g(x) 的倍數（可用 LFSR 編碼）、syndrome 是一個「數」 <M>{'S_1 = r(\\alpha)'}</M>（可以取對數、解方程）、根與 coset 讓我們能設計更強的 code（BCH）。H 的每一欄，也正是第二課 2-5 的 syndrome 查表。
              </p>
              <p>
                落到硬體上，結論很具體：用 GF(8) 設計出來的 code，檢查電路仍然只是三條 parity check；finite field 決定的是「哪個 bit 接到哪條檢查」，而它選出的循環排列，讓同一組檢查可以改用 LFSR 一個時脈一個 bit 地完成。
              </p>
              <p>下一單元 A10 把這個電路放到接收端，邊收 bit 邊算出 syndrome，並直接讀出錯誤位置。</p>
            </div>
          </Card>
        ),
        links: [
          { to: 'matrix', text: '第一課：H 與 G（標準排列）' },
          { to: 'l2-5', text: '第二課：Syndrome 查表 = H_cyc 的七個欄' },
          { to: 'a-10', text: '下一步：Syndrome 的 GF(8) 觀點 S₁ = r(α)' },
          { to: 'l2-2', text: '第二課：用 LFSR 實作 g(x) systematic encoding' },
        ],
        misconceptions: [
          { wrong: 'H_cyc 和第一課的 H 定義的 code 能力不同。', right: '它們的欄是同一組 7 個非零向量，只是順序不同（再加上列的上下順序），所以是 equivalent code：參數都是 [7,4,3]、能力相同，但 codeword 集合不同（差一個座標排列），矩陣不能混用。' },
          { wrong: '可以拿第一課的 H 檢查 m(x)g(x) 的 codeword。', right: '必須先做座標排列。上表顯示排列前後的對應；直接套用會得到錯的 syndrome。' },
          { wrong: 'c(α) = 0 只是一條方程，所以比 Hcᵀ = 0 的三條方程限制少。', right: 'GF(8) 元素有 3 個座標，一條 GF(8) 方程 = 三條 GF(2) 方程，限制完全相同。' },
        ],
      }}
    />
  );
}
