import { useMemo, useState } from 'react';
import { Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type Bit,
  type Matrix,
  G74,
  H74,
  LAYOUT_74,
  encode74,
  encode74ByParity,
  PARITY_CHECKS,
  formatRowOp,
  kernelBasis,
  matMul,
  matVec,
  matrixToTex,
  rref,
  span,
  transpose,
  column,
  isZeroMatrix,
  bitsToString,
  codewords74,
  vecAdd,
  isZeroVector,
} from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { MessageInput, BitString } from '../components/Bits';
import { MatrixView, ColumnVector } from '../components/MatrixView';
import { RelatedLinks } from '../components/alg/Links';
import { LinAlgPrimer } from '../components/LinAlgPrimer';
import { Callout, Card, Derivation, Expandable, FlowBar, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Segmented, Stage, Stat } from '../components/Lesson';

const ID = 'matrix';

const PRESETS: Record<string, { label: string; m: Matrix }> = {
  H: { label: 'H（Hamming）', m: H74 },
  G: { label: 'G', m: G74 },
  dep: {
    label: '有相依列',
    m: [
      [1, 1, 0, 1, 0],
      [0, 1, 1, 0, 1],
      [1, 0, 1, 1, 1],
    ],
  },
  small: {
    label: '2×3 小例子',
    m: [
      [1, 0, 1],
      [0, 1, 1],
    ],
  },
};

const colLabels74 = LAYOUT_74.map((p) => p.label);
const CODEWORDS = codewords74();
const DEFAULT_PARTNER = CODEWORDS.findIndex((x) => x.message.join('') === '0110');

export default function M2Matrices() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c = useMemo(() => encode74(message), [message]);
  const selectedRows = message.flatMap((b, i) => (b ? [i] : []));
  const selectedCols = c.flatMap((b, j) => (b ? [j] : []));
  const Hc = matVec(H74, c);
  const [partner, setPartner] = useState(DEFAULT_PARTNER);
  const c2 = CODEWORDS[partner].codeword;
  const m2 = CODEWORDS[partner].message;
  const cSum = vecAdd(c, c2);
  const HcSum = matVec(H74, cSum);
  const mSum = vecAdd(message, m2);
  const HGt = matMul(H74, transpose(G74));
  const [view, setView] = useState<'mG' | 'Hc'>('mG');
  const [primerTab, setPrimerTab] = useState(0);
  const goPrimer = (k: number) => {
    setPrimerTab(k);
    document.getElementById(`${ID}-definition`)?.scrollIntoView({ behavior: 'smooth' });
  };
  const PrimerLink = ({ k, label }: { k: number; label: string }) => (
    <button type="button" onClick={() => goPrimer(k)} className="font-semibold text-indigo-700 underline decoration-dotted underline-offset-2 hover:text-indigo-900">
      工具箱第 {k + 1} 頁「{label}」
    </button>
  );

  // H from the parity checks of chapter 1; G from encoding the unit messages
  const hRows = PARITY_CHECKS.map((pc) => Array.from({ length: 7 }, (_, j) => (pc.covered.includes(j) ? 1 : 0) as Bit));
  const hMatches = hRows.every((r, i) => r.join('') === H74[i].join(''));
  const unit = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((k) => (k === i ? 1 : 0) as Bit));
  const gRows = unit.map((e) => encode74ByParity(e));
  const gMatches = gRows.every((r, i) => r.codeword.join('') === G74[i].join(''));
  const rankG = rref(G74).rank;
  const rankH = rref(H74).rank;

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          上一章的三個 XOR 方程其實是線性方程。這一章的路線：先認識會用到的線性代數（核空間、秩……），再看生成矩陣 G 與同位檢查矩陣 H 怎麼從第 1 章的規則推出來，最後把兩者合起來，做實際的計算。
        </p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="為什麼要用矩陣？">
          <div className="prose-lab">
            <p>
              逐條寫 XOR 方程在 7 個位元時還算容易，但當碼長變成 64、128、甚至上千位元時，我們需要一套能<strong>系統化計算</strong>與<strong>證明性質</strong>的語言。
              線性代數正好提供這套語言：「有多少個 codeword？」是維度的問題，「哪些字串合法？」是解方程組的問題。
            </p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="線性代數工具箱：先認識會用到的概念">
          <p className="text-sm text-slate-600">用下面卡片頂端的選單挑一個概念（也可以按卡片底部的箭頭依序看）。每個概念都有一個即時計算的小例子，以及它在 Hamming(7,4) 裡扮演的角色。</p>
          <LinAlgPrimer tab={primerTab} onTab={setPrimerTab} />
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="G 與 H 怎麼來的">
          <Card title="同位檢查矩陣 H：把第 1 章的三個檢查寫成三列">
            <p className="mb-3 text-sm text-slate-600">
              第 1 章的偶同位規則是：每個檢查涵蓋的位置（包含同位位元自己）加起來 mod 2 等於 0。每一條檢查就是一條齊次線性方程，把「有涵蓋的位置記 1、沒涵蓋記 0」，就得到 H 的一列：
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 pr-3">檢查</th>
                    <th className="pr-3">涵蓋的位置</th>
                    <th className="pr-3">方程（mod 2）</th>
                    <th>H 的這一列</th>
                  </tr>
                </thead>
                <tbody>
                  {PARITY_CHECKS.map((pc, i) => (
                    <tr key={pc.name} className="border-t border-slate-100">
                      <td className="py-1.5 pr-3 font-semibold text-parity-600">{pc.name}</td>
                      <td className="pr-3 font-mono">{pc.covered.map((j) => j + 1).join(', ')}</td>
                      <td className="pr-3">
                        <M>{`${pc.covered.map((j) => `c_${j + 1}`).join(' + ')} = 0`}</M>
                      </td>
                      <td className="font-mono tracking-[0.15em]">{hRows[i].join('')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <MatrixView matrix={hRows} name="H =" colLabels={LAYOUT_74.map((p) => p.position)} rowLabels={['P1', 'P2', 'P4']} />
              <p className="min-w-0 flex-1 basis-60 text-sm text-slate-600">
                三條方程合起來就是 <M>{'Hc^{T} = 0'}</M>。{hMatches ? '✓ 和本站的 H 完全一致。' : '✗ 與 H74 不一致'}
              </p>
            </div>
          </Card>

          <Card title="反過來看每一欄：第 j 欄 = j 的二進位">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
              {LAYOUT_74.map((p) => (
                <div key={p.index} className="flex flex-col items-center gap-1 rounded-xl border border-slate-200 p-2">
                  <span className={`text-xs font-semibold ${p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}`}>{p.label}</span>
                  <ColumnVector bits={column(H74, p.index)} size="sm" />
                  <span className="text-[11px] text-slate-500">
                    = {p.position}
                    <span className="hidden sm:inline">（{p.position.toString(2).padStart(3, '0')}₂）</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-sm text-slate-600">
              第 j 欄記錄「位置 j 被哪些檢查涵蓋」：P1 涵蓋二進位最低位是 1 的位置、P2 涵蓋第二位是 1 的、P4 涵蓋第三位是 1 的。所以由下往上讀，第 j 欄正好是 j 的二進位（最低位在上）。這個設計在第 3 章會讓 Syndrome 直接「說出」錯誤位置。
            </p>
          </Card>

          <Card title="生成矩陣 G：把 4 個「只有一個 1」的訊息編碼">
            <p className="mb-3 text-sm text-slate-600">
              每個同位位元都是資訊位元的和，所以編碼是<strong>線性</strong>的：訊息相加，codeword 也相加。因此只要知道 4 個單位訊息 <M>{'e_1, \\dots, e_4'}</M> 的 codeword <M>{'g_i'}</M>，任何訊息的 codeword 都是它們的組合：
            </p>
            <Tex block>{'c = m_1 g_1 + m_2 g_2 + m_3 g_3 + m_4 g_4 = mG, \\qquad G = \\begin{pmatrix} g_1 \\\\ g_2 \\\\ g_3 \\\\ g_4 \\end{pmatrix}'}</Tex>
            <div className="overflow-x-auto">
              <table className="text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 pr-4">單位訊息</th>
                    <th className="pr-4">用第 1 章的規則算同位位元</th>
                    <th>codeword = G 的這一列</th>
                  </tr>
                </thead>
                <tbody>
                  {gRows.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="py-1.5 pr-4 font-mono">
                        <M>{`e_${i + 1}`}</M> = {unit[i].join('')}
                      </td>
                      <td className="pr-4 text-xs text-slate-600">{r.parities.map((p) => `${p.name} = ${p.value}`).join('，')}</td>
                      <td>
                        <BitString bits={r.codeword} className="font-bold" highlight={(j) => (LAYOUT_74[j].role === 'parity' ? 'text-parity-600' : 'text-data-600')} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <MatrixView matrix={gRows.map((r) => r.codeword)} name="G =" colLabels={colLabels74} rowLabels={['D1', 'D2', 'D3', 'D4']} />
              <p className="min-w-0 flex-1 basis-60 text-sm text-slate-600">{gMatches ? '✓ 和本站的 G 完全一致。' : '✗ 與 G74 不一致'}資訊位元的那 4 欄（D1–D4）剛好是單位矩陣：codeword 裡原封不動地帶著訊息。</p>
            </div>
          </Card>
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="G 與 H 合起來：同一個 code 的兩種描述">
          <Card title="HGᵀ = 0：G 的每一列都通過 H 的每一個檢查">
            <div className="flex flex-wrap items-center gap-4">
              <MatrixView matrix={H74} name="H" size="sm" />
              <span>·</span>
              <MatrixView matrix={transpose(G74)} name={<M>{'G^T'}</M>} size="sm" />
              <span>=</span>
              <MatrixView matrix={HGt} size="sm" cellClass={() => 'text-emerald-700 bg-emerald-50'} />
            </div>
            <p className="mt-3 text-sm text-slate-600">
              {isZeroMatrix(HGt) ? '✓ 結果是 3×4 零矩陣' : '✗ 不是零矩陣'}：第 (i, j) 格是「第 i 個檢查套在 <M>{'g_j'}</M> 上」的結果。這和訊息 m 無關，所以它保證每一個 codeword 都合法：
            </p>
            <Tex block>{'Hc^T = H(mG)^T = H\\,G^T m^T = (HG^T)\\,m^T = 0'}</Tex>
          </Card>

          <Card title="兩個集合其實相等：用維度證明">
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                G 從「生成」的角度描述 code（G 的<strong>列空間</strong>），H 從「檢查」的角度描述 code（H 的<strong>核空間</strong>）。上面的 <M>{'HG^T = 0'}</M> 只說明了「生成出來的都合法」，也就是 <M>{'\\{mG\\} \\subseteq \\ker H'}</M>。為什麼兩者剛好相等？比較維度：
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>
                  G 的 D1–D4 那 4 欄是單位矩陣，所以 G 的 4 列線性獨立，<M>{`\\dim\\{mG\\} = \\operatorname{rank} G = ${rankG}`}</M>（<PrimerLink k={3} label="基底與維度" />）。
                </li>
                <li>
                  H 的 P1、P2、P4 那 3 欄是單位矩陣，所以 rank H = {rankH}；由 Rank–Nullity Theorem <M>{`\\dim \\ker H = 7 - ${rankH} = ${7 - rankH}`}</M>（<PrimerLink k={5} label="秩與零度" />）。
                </li>
              </ul>
              <p>一個 {rankG} 維子空間包含在一個 {7 - rankH} 維子空間裡，維度又相同，兩者只能相等：</p>
            </div>
            <Callout kind="info" title="同一個 code 的兩種描述">
              <Tex block>{'C = \\{\\, mG : m \\in \\mathbb{F}_2^4 \\,\\} = \\{\\, c \\in \\mathbb{F}_2^7 : Hc^{T} = 0 \\,\\} = \\ker H'}</Tex>
            </Callout>
          </Card>

          <LabGrid
            main={
              <Card title="線性碼（Linear code）">
                <div className="space-y-2 text-sm text-slate-600">
                  <p>
                    <M>{'C = \\ker H'}</M> 是 <M>{'\\mathbb{F}_2^7'}</M> 的<strong>子空間</strong>。codeword 的集合是子空間的 code，稱為<strong>線性碼</strong>。在 GF(2) 裡純量只有 0 和 1，所以條件化簡成一句話：
                  </p>
                  <div className="rounded-lg bg-slate-50 p-2 text-center font-semibold text-slate-800">任兩個 codeword 相加，還是 codeword。</div>
                  <p>
                    記作 <M>{'[n,k]'}</M>：方括號表示線性，<M>k</M> 是子空間的維度，所以有 <M>{'2^k'}</M> 個 codeword。Hamming(7,4) 是 <M>{'[7,4]'}</M> 線性碼；之後常寫成 <M>{'[n,k,d]'}</M>，多記最小距離 <M>d</M>（第 4 章）。
                  </p>
                  <p>
                    為什麼成立：若 c、c′ 都是 codeword，<M>{"H(c+c')^{T} = Hc^{T} + Hc'^{T} = 0 + 0 = 0"}</M>。
                  </p>
                </div>
              </Card>
            }
            aside={
              <Card
                title="驗證：兩個 codeword 相加"
                actions={
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-xs"
                    value={partner}
                    onChange={(ev) => setPartner(Number(ev.target.value))}
                    aria-label="選擇第二個訊息 m′"
                  >
                    {CODEWORDS.map((x, k) => (
                      <option key={k} value={k}>
                        m′ = {x.message.join('')}
                      </option>
                    ))}
                  </select>
                }
              >
                <table className="w-full text-sm">
                  <tbody className="font-mono">
                    <tr>
                      <td className="py-0.5 pr-2 font-sans text-xs text-slate-500">c（m = {bitsToString(message)}）</td>
                      <td className="text-right"><BitString bits={c} /></td>
                    </tr>
                    <tr>
                      <td className="py-0.5 pr-2 font-sans text-xs text-slate-500">c′（m′ = {m2.join('')}）</td>
                      <td className="text-right"><BitString bits={c2} /></td>
                    </tr>
                    <tr className="border-t border-slate-300">
                      <td className="py-0.5 pr-2 font-sans text-xs font-semibold text-slate-700">c + c′</td>
                      <td className="text-right font-bold"><BitString bits={cSum} /></td>
                    </tr>
                  </tbody>
                </table>
                <ul className="mt-3 space-y-1 text-xs text-slate-600">
                  <li>
                    {isZeroVector(HcSum) ? '✓' : '✗'} <M>{`H(c+c')^{T} = (${HcSum.join(',')})^{T}`}</M>：還是 codeword
                  </li>
                  <li>
                    {encode74(mSum).join('') === cSum.join('') ? '✓' : '✗'} 而且正好是 <M>{"m + m'"}</M> = {mSum.join('')} 的 codeword：<M>{"(m+m')G = mG + m'G"}</M>
                  </li>
                </ul>
                <p className="mt-2 text-xs text-slate-500">c 跟著共用範例訊息 m 變化（可在下方「實驗」區修改）；c′ 從上方選單挑。</p>
              </Card>
            }
          />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="實例計算">
          <Card
            title="改變訊息 m：編碼與檢查同步更新"
            actions={
              <>
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'mG', label: <M>{'c = mG'}</M> },
                    { value: 'Hc', label: <M>{'Hc^T = 0'}</M> },
                  ]}
                />
                <ResetButton onClick={resetMessage} />
              </>
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <MessageInput message={message} onToggle={toggleBit} size="md" />
              <div className="text-sm text-slate-600">
                <M>{`m = (${message.join(',')})`}</M>，<M>{`c = ${c.join('')}`}</M>
              </div>
            </div>

            {view === 'mG' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <MatrixView matrix={G74} name="G" colLabels={colLabels74} rowLabels={message.map((b) => `m=${b}`)} highlightRows={selectedRows} dimRows={[0, 1, 2, 3].filter((i) => !selectedRows.includes(i))} />
                  <p className="mt-2 text-xs text-slate-500">
                    <M>{'mG'}</M> = 把 <M>{'m_i = 1'}</M> 的那些列加起來（mod 2）。
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 font-mono text-sm">
                  {selectedRows.length === 0 && <div className="text-slate-500">m = 0，沒有選到任何列 → c = 0000000</div>}
                  {selectedRows.map((i, k) => (
                    <div key={i} className="flex items-center gap-3">
                      <span className="w-6 text-right text-slate-400">{k === 0 ? '' : '+'}</span>
                      <span className="w-14 text-xs text-amber-700">row {i + 1}</span>
                      <BitString bits={G74[i]} />
                    </div>
                  ))}
                  <div className="my-1 ml-[5.5rem] border-t border-slate-300" />
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-right text-slate-400">=</span>
                    <span className="w-14 text-xs font-semibold text-slate-700">c</span>
                    <BitString bits={c} className="font-bold" highlight={(j) => (LAYOUT_74[j].role === 'parity' ? 'text-parity-600' : 'text-data-600')} />
                  </div>
                </div>
              </div>
            )}

            {view === 'Hc' && (
              <div className="flex flex-wrap items-center gap-4">
                <MatrixView matrix={H74} name="H" colLabels={c.map((b) => `c=${b}`)} highlightCols={selectedCols} />
                <span className="text-xl">·</span>
                <ColumnVector bits={c} label={<M>{'c^T ='}</M>} size="sm" />
                <span className="text-xl">=</span>
                <div className="rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="mb-1 text-xs text-slate-500">被選中的欄（c_j = 1）相加：</div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {selectedCols.map((j, k) => (
                      <span key={j} className="inline-flex items-center gap-1.5">
                        {k > 0 && <span className="text-slate-400">+</span>}
                        <ColumnVector bits={column(H74, j)} size="sm" cellClass="text-fuchsia-700" />
                      </span>
                    ))}
                    <span className="text-slate-400">=</span>
                    <ColumnVector bits={Hc} size="sm" cellClass="text-emerald-700 bg-emerald-50" />
                  </div>
                </div>
              </div>
            )}
          </Card>
          <Derivation
            resetKey={message.join('')}
            steps={[
              { title: '寫出 c = mG', body: <Tex block>{`c = (${message.join(',')})\\,${matrixToTex(G74)}`}</Tex> },
              {
                title: '列的線性組合',
                body: <Tex block>{`c = ${message.map((b, i) => `${b}\\cdot g_${i + 1}`).join(' + ')} = ${c.join('')}`}</Tex>,
              },
              { title: '檢查 Hcᵀ', body: <Tex block>{`Hc^T = ${matrixToTex(H74)} ${matrixToTex(c.map((b) => [b]))} = ${matrixToTex(Hc.map((b) => [b]))}`}</Tex> },
            ]}
          />
          <div className="pt-4">
            <h3 className="text-base font-bold text-slate-900">線性代數實驗區：換成任何矩陣</h3>
            <p className="text-sm text-slate-600">工具箱裡的高斯消去、秩、核空間與 Rank–Nullity Theorem，可以在任何 0/1 矩陣上試。預設是 H，按「有相依列」等按鈕換成其他例子。</p>
          </div>
          <LinearAlgebraLab />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="Code = 核空間">
          <Callout kind="key" title="結論">
            <p>
              <M>{'\\operatorname{rank}(H) = 3'}</M>，由 Rank–Nullity Theorem <M>{'\\operatorname{nullity}(H) = 7 - 3 = 4'}</M>，所以 <M>{'\\ker H'}</M> 是 4 維子空間，有 <M>{'2^4 = 16'}</M> 個元素——正好是 16 個 Hamming(7,4) codeword。
              「4 維」對應 4 個資訊位元，「16 個」對應 16 種可能的訊息。
            </p>
          </Callout>
          <Card>
            <RelatedLinks links={[{ to: 'a-5', text: 'Generator Matrix → Generator Polynomial g(x)' }, { to: 'a-9', text: '用 GF(8) 推導 H：一條方程 c(α) = 0' }, { to: 'a-1', text: '這些矩陣運算都在 GF(2) 中' }]} title="延伸：代數基礎與循環碼" />
          </Card>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

function LinearAlgebraLab() {
  const [A, setA] = useState<Matrix>(H74.map((r) => [...r]));
  const [step, setStep] = useState(-1); // −1 = show final RREF; k = after k-th op
  const res = useMemo(() => rref(A), [A]);
  const basis = useMemo(() => kernelBasis(A), [A]);
  const kernel = useMemo(() => span(basis, A[0].length), [basis, A]);
  const m = A.length;
  const n = A[0].length;
  const isH = A.length === 3 && A.every((r, i) => r.length === 7 && r.every((v, j) => v === H74[i][j]));

  const shownStep = step < 0 ? res.steps.length : step;
  const shownMatrix = shownStep === 0 ? A : res.steps[shownStep - 1].matrix;

  const resize = (dm: number, dn: number) => {
    const nm = Math.min(4, Math.max(1, m + dm));
    const nn = Math.min(8, Math.max(2, n + dn));
    setA(Array.from({ length: nm }, (_, i) => Array.from({ length: nn }, (_, j) => (A[i]?.[j] ?? 0) as Bit)));
    setStep(-1);
  };

  return (
    <LabGrid
      main={
        <>
          <Card
            title="1. 編輯矩陣 A（點擊元素切換 0/1）"
            actions={
              <>
                {Object.entries(PRESETS).map(([k, p]) => (
                  <button
                    key={k}
                    className="btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => {
                      setA(p.m.map((r) => [...r]));
                      setStep(-1);
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-6">
              <MatrixView
                matrix={A}
                name="A ="
                onCellClick={(i, j) => {
                  setA(A.map((r, a) => r.map((v, b) => (a === i && b === j ? ((1 - v) as Bit) : v))));
                  setStep(-1);
                }}
              />
              <div className="space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  列數 {m}
                  <button className="btn-ghost !p-1" onClick={() => resize(-1, 0)} aria-label="減少列">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button className="btn-ghost !p-1" onClick={() => resize(1, 0)} aria-label="增加列">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  欄數 n = {n}
                  <button className="btn-ghost !p-1" onClick={() => resize(0, -1)} aria-label="減少欄">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button className="btn-ghost !p-1" onClick={() => resize(0, 1)} aria-label="增加欄">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="2. 高斯消去（Gaussian elimination）：GF(2) 版本">
            <div className="flex flex-wrap items-center gap-4">
              <MatrixView
                matrix={shownMatrix}
                highlightCols={shownStep === res.steps.length ? res.pivotCols : []}
                colHighlightClass="bg-indigo-100 text-indigo-800"
                cellClass={(i) => {
                  const op = shownStep > 0 ? res.steps[shownStep - 1].op : null;
                  if (!op) return undefined;
                  const touched = op.kind === 'swap' ? [op.i, op.j] : [op.target];
                  return touched.includes(i) ? 'bg-amber-100 text-amber-900' : undefined;
                }}
              />
              <div className="min-w-[180px] flex-1 text-sm">
                <div className="text-xs text-slate-500">
                  步驟 {shownStep} / {res.steps.length}
                </div>
                <div className="mt-1 min-h-[28px]">
                  {res.steps.length === 0 ? '原始矩陣已是 RREF，不需要列運算' : shownStep === 0 ? '原始矩陣' : <Tex>{formatRowOp(res.steps[shownStep - 1].op)}</Tex>}
                </div>
                {shownStep === res.steps.length && <div className="mt-1 text-xs text-indigo-700">簡化列梯形（RREF）；樞紐欄（pivot columns）以藍色標示</div>}
                <div className="mt-2 flex gap-2">
                  <button className="btn-ghost" disabled={shownStep === 0} onClick={() => setStep(shownStep - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost" disabled={shownStep === res.steps.length} onClick={() => setStep(shownStep + 1 >= res.steps.length ? -1 : shownStep + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button className="btn-ghost text-xs" onClick={() => setStep(0)}>
                    從頭
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title={`3. 核空間 ker A 的全部元素（共 ${kernel.length} 個）`}>
            <div className="flex flex-wrap gap-1.5">
              {kernel.map((v) => (
                <span key={bitsToString(v)} className={`rounded-md border px-1.5 py-0.5 font-mono text-xs ${v.every((b) => b === 0) ? 'border-slate-200 text-slate-400' : 'border-indigo-200 bg-indigo-50 text-indigo-800'}`}>
                  {bitsToString(v)}
                </span>
              ))}
            </div>
            {isH && <p className="mt-2 text-xs text-emerald-700">✓ A = H：這 16 個向量正是 16 個 Hamming(7,4) codeword。</p>}
          </Card>
        </>
      }
      aside={
        <>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="秩 rank(A)" value={res.rank} sub="樞紐欄數" tone="indigo" />
            <Stat label="零度 nullity(A)" value={n - res.rank} sub="= dim ker A" tone="amber" />
            <Stat label="欄數 n" value={n} />
            <Stat label="|ker A|（元素個數）" value={kernel.length} sub={<M>{`2^{${n - res.rank}}`}</M>} tone="emerald" />
          </div>
          <Card title="Rank–Nullity Theorem">
            <Tex block>{`\\operatorname{rank}(A) + \\operatorname{nullity}(A) = n`}</Tex>
            <Tex block>{`${res.rank} + ${n - res.rank} = ${n}\\ \\checkmark`}</Tex>
          </Card>
          <Card title="核空間的基底（Basis of ker A）">
            {basis.length === 0 ? (
              <p className="text-sm text-slate-500">ker A = {'{0}'}，基底為空集合。</p>
            ) : (
              <div className="space-y-1">
                {basis.map((b, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <M>{`v_{${i + 1}} =`}</M>
                    <span className="mono">{bitsToString(b)}</span>
                    <span className="text-xs text-slate-400">（自由變數 x{res.freeCols[i] + 1} = 1）</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">每個自由欄（free column）產生一個基底向量；基底向量的個數就是維度。</p>
          </Card>
          <Misconceptions
            items={[
              { wrong: 'nullity(H) = 4，所以 ker H 有 4 個元素。', right: 'nullity 是維度。4 維的 GF(2) 向量空間有 2⁴ = 16 個元素（每個基底係數可選 0 或 1）。' },
              { wrong: 'ker H 的基底是唯一的。', right: '基底不唯一（例如 G 的 4 列也是一組基底），但基底向量的個數（維度）是唯一的。' },
            ]}
          />
          <Expandable title="為什麼 |ker A| = 2^nullity？">
            <p>
              設 <M>{'v_1,\\dots,v_d'}</M> 是 ker A 的基底，則每個元素可唯一寫成 <M>{'a_1v_1+\\cdots+a_dv_d'}</M>，其中 <M>{'a_i \\in \\{0,1\\}'}</M>。係數有 <M>{'2^d'}</M> 種選法，且由線性獨立性，不同係數給出不同向量。
            </p>
          </Expandable>
        </>
      }
    />
  );
}
