import { useMemo, useState } from 'react';
import { Minus, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  type Bit,
  type Matrix,
  G74,
  H74,
  LAYOUT_74,
  encode74,
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
} from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { MessageInput, BitString } from '../components/Bits';
import { MatrixView, ColumnVector } from '../components/MatrixView';
import { RelatedLinks } from '../components/alg/Links';
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

export default function M2Matrices() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c = useMemo(() => encode74(message), [message]);
  const selectedRows = message.flatMap((b, i) => (b ? [i] : []));
  const selectedCols = c.flatMap((b, j) => (b ? [j] : []));
  const Hc = matVec(H74, c);
  const HGt = matMul(H74, transpose(G74));
  const [view, setView] = useState<'mG' | 'Hc' | 'HG'>('mG');

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>上一章的三個 XOR 方程其實是線性方程。寫成矩陣後，「編碼」變成矩陣乘法，「檢查」變成解齊次線性方程組，整個 code 就是一個<strong>向量子空間</strong>。</p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="為什麼要用矩陣？">
          <div className="prose-lab max-w-3xl">
            <p>
              逐條寫 XOR 方程在 7 個位元時還算容易，但當碼長變成 64、128、甚至上千位元時，我們需要一套能<strong>系統化計算</strong>與<strong>證明性質</strong>的語言。
              線性代數正好提供這套語言：秩 (rank)、核空間 (kernel)、基底 (basis) 都能直接回答「有多少個 codeword？」「哪些字串合法？」這類問題。
            </p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="生成矩陣 G 與同位檢查矩陣 H">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="Generator Matrix G（4×7）">
              <MatrixView matrix={G74} name="G =" colLabels={colLabels74} rowLabels={['d1', 'd2', 'd3', 'd4']} />
              <p className="mt-3 text-sm text-slate-600">
                第 <M>i</M> 列 = 只有 <M>d_i = 1</M> 時的 codeword。編碼：<M>{'c = mG'}</M>（<M>m</M> 是 1×4 列向量）。
              </p>
            </Card>
            <Card title="Parity-check Matrix H（3×7）">
              <MatrixView matrix={H74} name="H =" colLabels={LAYOUT_74.map((p) => p.position)} rowLabels={['P1', 'P2', 'P4']} />
              <p className="mt-3 text-sm text-slate-600">
                第 <M>j</M> 欄就是 <M>j</M> 的二進位（最低位在上）。第 <M>i</M> 列是第 <M>i</M> 個同位檢查。合法條件：<M>{'Hc^{T} = 0'}</M>。
              </p>
            </Card>
          </div>
          <Callout kind="info" title="同一個 code 的兩種描述">
            <Tex block>{'C = \\{\\, mG : m \\in \\mathbb{F}_2^4 \\,\\} = \\{\\, c \\in \\mathbb{F}_2^7 : Hc^{T} = 0 \\,\\} = \\ker H'}</Tex>
            <p>G 從「生成」的角度描述 code（列空間 row space），H 從「檢查」的角度描述 code（核空間 kernel）。</p>
          </Callout>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="即時矩陣乘法">
          <Card
            title="改變原始資料，三個式子同步更新"
            actions={
              <>
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'mG', label: <M>{'c = mG'}</M> },
                    { value: 'Hc', label: <M>{'Hc^T = 0'}</M> },
                    { value: 'HG', label: <M>{'HG^T = 0'}</M> },
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
                    <M>{'mG'}</M> = 把 <M>{'m_i = 1'}</M> 的那些列加起來（GF(2) 加法）。
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

            {view === 'HG' && (
              <div className="flex flex-wrap items-center gap-4">
                <MatrixView matrix={H74} name="H" size="sm" />
                <span>·</span>
                <MatrixView matrix={transpose(G74)} name={<M>{'G^T'}</M>} size="sm" />
                <span>=</span>
                <MatrixView matrix={HGt} size="sm" cellClass={() => 'text-emerald-700 bg-emerald-50'} />
                <p className="basis-full text-sm text-slate-600">
                  {isZeroMatrix(HGt) ? '✓ 結果是 3×4 零矩陣' : '✗ 不是零矩陣'}：每一列 G 的生成向量都滿足所有同位檢查。這與 m 無關，所以它<strong>保證了</strong>每一個 <M>{'c = mG'}</M> 都滿足 <M>{'Hc^T = 0'}</M>。
                </p>
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
              {
                title: '為什麼一定是 0？',
                body: (
                  <Tex block>{'Hc^T = H(mG)^T = H\\,G^T m^T = (HG^T)\\,m^T = 0\\cdot m^T = 0'}</Tex>
                ),
              },
            ]}
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="H 的欄 = 位置的二進位">
          <Card>
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
              由上往下讀是 <M>{'s_1, s_2, s_3'}</M>，數值為 <M>{'s_1 + 2s_2 + 4s_3'}</M>。這個設計在第 3 章會讓 Syndrome 直接「說出」錯誤位置。
            </p>
          </Card>
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="GF(2) 線性代數實驗區">
          <LinearAlgebraLab />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="Code = 核空間">
          <Callout kind="key" title="結論">
            <p>
              <M>{'\\operatorname{rank}(H) = 3'}</M>，由秩–零度定理 <M>{'\\operatorname{nullity}(H) = 7 - 3 = 4'}</M>，所以 <M>{'\\ker H'}</M> 是 4 維子空間，有 <M>{'2^4 = 16'}</M> 個元素——正好是 16 個 Hamming codeword。
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
                  列 m = {m}
                  <button className="btn-ghost !p-1" onClick={() => resize(-1, 0)} aria-label="減少列">
                    <Minus className="h-3 w-3" />
                  </button>
                  <button className="btn-ghost !p-1" onClick={() => resize(1, 0)} aria-label="增加列">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  欄 n = {n}
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

          <Card title="2. 高斯消去（GF(2) 版本） Gaussian elimination">
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
                {shownStep === res.steps.length && <div className="mt-1 text-xs text-indigo-700">簡化列梯形 RREF；樞紐欄 pivot columns 以藍色標示</div>}
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
          <Card title="秩–零度定理 Rank–Nullity Theorem">
            <Tex block>{`\\operatorname{rank}(A) + \\operatorname{nullity}(A) = n`}</Tex>
            <Tex block>{`${res.rank} + ${n - res.rank} = ${n}\\ \\checkmark`}</Tex>
          </Card>
          <Card title="核空間的基底 Basis of ker A">
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
            <p className="mt-2 text-xs text-slate-500">每個自由欄 free column 產生一個基底向量；基底向量的個數就是維度。</p>
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
