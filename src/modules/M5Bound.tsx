import { useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import {
  type Bit,
  bitsToInt,
  bitsToString,
  codewords74,
  codewords84,
  differingPositions,
  hammingBound,
  hammingDistance,
  knownPerfectFamily,
  partitionByNearest,
  sphereTerms,
  syndrome74,
} from '../core';
import { Tex, M } from '../components/Tex';
import { BitString } from '../components/Bits';
import { Callout, Card, Derivation, Expandable, FlowBar, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Segmented, Stage, Stat } from '../components/Lesson';

const ID = 'bound';

const CODES = {
  h74: { label: 'Hamming(7,4)', n: 7, words: codewords74().map((e) => e.codeword) },
  h84: { label: 'Extended(8,4)', n: 8, words: codewords84().map((e) => e.codeword) },
};
type CodeKey = keyof typeof CODES;

export default function M5Bound() {
  const [n, setN] = useState(7);
  const [k, setK] = useState(4);
  const [t, setT] = useState(1);
  const hb = hammingBound(n, k, t);
  const terms = sphereTerms(n, t);
  const family = hb.equality ? knownPerfectFamily(n, k, t) : null;

  const [codeKey, setCodeKey] = useState<CodeKey>('h74');
  const code = CODES[codeKey];
  const part = useMemo(() => partitionByNearest(code.words, code.n), [code]);
  const [sel, setSel] = useState(11);
  const [view, setView] = useState<'groups' | 'all'>('groups');
  const [hoverWord, setHoverWord] = useState<number | null>(null);

  const reset = () => {
    setN(7);
    setK(4);
    setT(1);
  };

  const center = code.words[sel];
  const groupWords = part.groups[sel];

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>長度 7 的二進位字串一共只有 128 個。每個 codeword 都需要一塊「地盤」來吸收錯誤——那麼最多能放幾個 codeword？這一章是整門課的重點。</p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="空間是有限的">
          <div className="prose-lab max-w-3xl">
            <p>
              若一個 code 要修正 <M>t</M> 個錯誤，那麼每個 codeword <M>c</M> 周圍「距離 ≤ t」的所有字串都必須被解碼回 <M>c</M>。不同 codeword 的這些區域不能重疊，否則某個接收字會不知道該解成誰。
              這些區域加起來不能超過整個空間 <M>{'\\mathbb{F}_2^n'}</M> 的大小 <M>{'2^n'}</M>。這個簡單的計數論證就是 <strong>Hamming Bound（球填充界 Sphere-packing bound）</strong>。
            </p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="漢明球與 Hamming Bound">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="漢明球 Hamming sphere">
              <Tex block>{'B(c,t) = \\{\\, x \\in \\mathbb{F}_2^n : d_H(x,c) \\le t \\,\\}'}</Tex>
              <p className="text-sm text-slate-600">離 c 最多 t 個位元不同的所有字串。注意這是一個<strong>有限集合</strong>，不是平面上的圓。</p>
            </Card>
            <Card title="球的體積 Volume">
              <Tex block>{'V_2(n,t) = |B(c,t)| = \\sum_{i=0}^{t} \\binom{n}{i}'}</Tex>
              <p className="text-sm text-slate-600">
                <M>{'\\binom{n}{i}'}</M> = 恰好錯 <M>i</M> 個位置的選法數。
              </p>
            </Card>
            <Card title="Hamming Bound">
              <Tex block>{'2^k \\cdot V_2(n,t) \\le 2^n'}</Tex>
              <p className="text-sm text-slate-600">
                等號成立的 code 稱為<strong>完美碼 Perfect code</strong>：球恰好鋪滿整個空間。
              </p>
            </Card>
          </div>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="調整 n、k、t，檢查 Hamming Bound">
          <LabGrid
            main={
              <Card title="參數" actions={<ResetButton onClick={reset} />}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Slider label="碼長 n（Codeword length）" value={n} min={1} max={24} onChange={(v) => { setN(v); setK(Math.min(k, v)); setT(Math.min(t, v)); }} />
                  <Slider label="維度 k（Dimension）" value={k} min={0} max={n} onChange={setK} />
                  <Slider label="修正半徑 t" value={t} min={0} max={n} onChange={setT} />
                </div>
                <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4">
                  <Tex block>{`V_2(${n},${t}) = ${terms.map((_, i) => `\\binom{${n}}{${i}}`).join(' + ')} = ${terms.join(' + ')} = ${hb.volume}`}</Tex>
                  <Tex block>{`2^{${k}} \\cdot ${hb.volume} = ${hb.codewords} \\times ${hb.volume} = ${hb.lhs.toLocaleString()} \\;${hb.equality ? '=' : hb.satisfied ? '<' : '>'}\\; 2^{${n}} = ${hb.rhs.toLocaleString()}`}</Tex>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>球所佔的比例 2ᵏ·V / 2ⁿ</span>
                    <span className="font-mono">{(hb.coverage * 100).toFixed(hb.coverage < 0.01 ? 4 : 1)}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                    <div className={`h-full rounded-full ${hb.equality ? 'bg-emerald-500' : hb.satisfied ? 'bg-data-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(100, hb.coverage * 100)}%` }} />
                  </div>
                </div>
              </Card>
            }
            aside={
              <>
                <Card>
                  {hb.equality ? (
                    <Verdict ok title="等號成立：完美碼參數">
                      {family ? <>已知例子：{family}</> : '等號成立是完美碼的必要條件；此參數是否真的存在完美碼需另外判斷。'}
                    </Verdict>
                  ) : hb.satisfied ? (
                    <Verdict ok title="滿足 Hamming Bound（嚴格不等）">
                      球沒有鋪滿空間，有 {(hb.rhs - hb.lhs).toLocaleString()} 個字串不在任何球中。注意：滿足界不代表這樣的 code 一定存在。
                    </Verdict>
                  ) : (
                    <Verdict ok={false} title="違反 Hamming Bound">
                      不可能存在長度 {n}、{hb.codewords} 個 codeword 且能修正 {t} 個錯誤的二元碼。
                    </Verdict>
                  )}
                  <div className="mt-3 text-sm text-slate-600">
                    給定 n = {n}, t = {t}，k 最大只能是 <strong>{Math.max(0, hb.maxK)}</strong>。
                  </div>
                </Card>
                <Card title="t = 1 的 Hamming Code家族">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-500">
                        <th>r</th>
                        <th>n = 2ʳ−1</th>
                        <th>k = n−r</th>
                        <th>2ᵏ(1+n)</th>
                        <th>2ⁿ</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono">
                      {[2, 3, 4, 5].map((r) => {
                        const nn = 2 ** r - 1;
                        const b = hammingBound(nn, nn - r, 1);
                        return (
                          <tr key={r} className={`border-t border-slate-100 ${nn === n && nn - r === k && t === 1 ? 'bg-emerald-50' : ''}`}>
                            <td className="py-1">{r}</td>
                            <td>{nn}</td>
                            <td>{nn - r}</td>
                            <td>{b.lhs.toLocaleString()}</td>
                            <td>{b.rhs.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-slate-500">
                    因為 <M>{'1 + n = 2^r'}</M>，所以 <M>{'2^{n-r}\\cdot 2^r = 2^n'}</M>：每一個 Hamming Code都是完美碼。
                  </p>
                </Card>
              </>
            }
          />
          <Derivation
            title="逐步推導：為什麼 Hamming(7,4) 剛好等號成立"
            steps={[
              { title: '計算球的大小', body: <Tex block>{'V_2(7,1) = \\binom{7}{0} + \\binom{7}{1} = 1 + 7 = 8'}</Tex> },
              { title: '直觀意義', body: <p>每個 codeword 的球 = 它自己（沒有錯）+ 7 種單一錯誤 = 8 個字串。</p> },
              { title: '16 個 codeword 的球加總', body: <Tex block>{'2^4 \\cdot 8 = 16 \\times 8 = 128'}</Tex> },
              { title: '和整個空間比較', body: <Tex block>{'2^7 = 128 \\quad\\Rightarrow\\quad 16 \\times (1 + 7) = 128 = 2^7'}</Tex> },
              { title: '結論', body: <p>球彼此不重疊（因為 d_min = 3 ≥ 2·1+1），而總大小恰好等於空間大小，所以它們<strong>完全覆蓋</strong>整個空間：每一個 7-bit 字串都恰好屬於一個球。</p> },
            ]}
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title={`真正的 ${2 ** code.n} 個字串分組`}>
          <Card
            title={`依最近 codeword 把全部 ${part.totalWords} 個 ${code.n}-bit 字串分組`}
            actions={
              <>
                <Segmented
                  value={codeKey}
                  onChange={(v) => {
                    setCodeKey(v);
                    setSel(11);
                  }}
                  options={[
                    { value: 'h74', label: 'Hamming(7,4)' },
                    { value: 'h84', label: 'Extended(8,4)' },
                  ]}
                />
                <Segmented
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'groups', label: '依 codeword 分組' },
                    { value: 'all', label: '依數值排列' },
                  ]}
                />
              </>
            }
          >
            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="字串總數 2ⁿ" value={part.totalWords} />
              <Stat label="唯一歸屬的字串" value={part.groups.reduce((a, g) => a + g.length, 0)} sub={`每組 ${[...new Set(part.groups.map((g) => g.length))].join('/')} 個`} tone="indigo" />
              <Stat label="平手（不屬於任何一組）" value={part.ties.length} tone={part.ties.length ? 'rose' : 'emerald'} />
              <Stat label="完全分割？" value={part.isPartition ? '是 ✓' : '否 ✗'} tone={part.isPartition ? 'emerald' : 'rose'} />
            </div>

            {view === 'groups' ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {part.groups.map((g, gi) => (
                  <button
                    key={gi}
                    onClick={() => setSel(gi)}
                    className={`rounded-xl border p-1.5 text-left transition-colors ${gi === sel ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-300' : 'border-slate-200 hover:border-slate-400'}`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] text-slate-500">
                      <span>#{gi}</span>
                      <span>{g.length} 個</span>
                    </div>
                    {g
                      .slice()
                      .sort((a, b) => hammingDistance(a, code.words[gi]) - hammingDistance(b, code.words[gi]))
                      .map((w) => {
                        const d = hammingDistance(w, code.words[gi]);
                        return (
                          <div key={bitsToString(w)} className={`font-mono text-[11px] leading-4 tracking-wider ${d === 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                            <BitString bits={w} highlight={(j) => (w[j] !== code.words[gi][j] ? 'text-rose-600 font-bold' : undefined)} />
                          </div>
                        );
                      })}
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <div className="grid w-max gap-0.5" style={{ gridTemplateColumns: `repeat(16, minmax(34px, 1fr))` }}>
                  {part.owner.map((o, w) => {
                    const isCenter = o >= 0 && bitsToInt(code.words[o]) === w;
                    const inSel = o === sel;
                    return (
                      <button
                        key={w}
                        onClick={() => o >= 0 && setSel(o)}
                        onMouseEnter={() => setHoverWord(w)}
                        onMouseLeave={() => setHoverWord(null)}
                        title={`${w.toString(2).padStart(code.n, '0')} → ${o >= 0 ? `Codeword #${o}` : '平手'}`}
                        className={`h-7 rounded text-[10px] font-semibold ${
                          o < 0 ? 'bg-rose-50 text-rose-400' : inSel ? (isCenter ? 'bg-emerald-600 text-white' : 'bg-emerald-200 text-emerald-900') : isCenter ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {o >= 0 ? `#${o}` : '?'}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  格子依字串的整數值 0, 1, …, {part.totalWords - 1} 排列（每列 16 個），格子內是它的最近 codeword 編號；深色格是 codeword 本身。
                  {hoverWord !== null && (
                    <span className="ml-1 font-mono text-slate-700">
                      目前：{hoverWord.toString(2).padStart(code.n, '0')}（= {hoverWord}）
                    </span>
                  )}
                  同一組的 8 個字串在數值上分散各處——漢明球並不是「一團相鄰的點」。
                </p>
              </div>
            )}
          </Card>
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="點選一個 codeword，查看它的接收結果">
          <LabGrid
            main={
              <Card title={`Codeword #${sel} = ${bitsToString(center)} 的漢明球（半徑 1）`}>
                <div className="mb-3 flex flex-wrap gap-1">
                  {code.words.map((_w, i) => (
                    <button key={i} onClick={() => setSel(i)} className={`chip border font-mono ${i === sel ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>
                      #{i}
                    </button>
                  ))}
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">接收字串 r</th>
                      <th>與 codeword 的距離</th>
                      <th>錯誤位置</th>
                      {codeKey === 'h74' && <th>Syndrome</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {groupWords
                      .slice()
                      .sort((a, b) => hammingDistance(a, center) - hammingDistance(b, center) || bitsToInt(a) - bitsToInt(b))
                      .map((w) => {
                        const pos = differingPositions(w, center);
                        return (
                          <tr key={bitsToString(w)} className="border-t border-slate-100">
                            <td className="py-1">
                              <BitString bits={w} highlight={(j) => (pos.includes(j) ? 'text-rose-600 font-bold' : undefined)} />
                            </td>
                            <td className="font-mono">{hammingDistance(w, center)}</td>
                            <td className="text-xs text-slate-600">{pos.length === 0 ? '（codeword 本身）' : pos.map((j) => `#${j + 1}`).join(', ')}</td>
                            {codeKey === 'h74' && <td className="font-mono text-xs">{syndrome74(w as Bit[]).join('')}</td>}
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
                {codeKey === 'h74' ? (
                  <p className="mt-3 text-xs text-slate-500">8 個接收結果的 Syndrome 恰好是 000 與 7 個不同的非零值：Syndrome 解碼就是在辨認「你在哪一個球的哪一格」。</p>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">
                    Extended(8,4) 每個球有 1 + 8 = 9 個字串，16 個球共 144 個；其餘 {part.ties.length} 個字串（距離 2）同時離好幾個 codeword 一樣近 → 無法唯一解碼。這正是 SECDED「偵測但不修正」的區域。
                  </p>
                )}
              </Card>
            }
            aside={
              <>
                <Misconceptions
                  items={[
                    { wrong: '漢明球就像平面上的圓，可以用圓形圖畫出來。', right: '漢明距離只計算「不同位元的個數」，不是歐氏距離。一個半徑 1 的球是 8 個離散字串，它們的數值彼此可以相差很遠（見「依數值排列」視圖）。' },
                    { wrong: '滿足 Hamming Bound 的參數一定有對應的 code。', right: 'Hamming Bound 是必要條件，不是充分條件。例如 (n,k,t) = (90,78,2) 滿足等號，但不存在這樣的完美碼。' },
                    { wrong: '完美碼表示能修正所有錯誤。', right: '完美碼只代表「每個字串都恰好在一個半徑 t 的球內」。超過 t 個錯誤仍會被解成錯的 codeword。' },
                  ]}
                />
                <Expandable title="為什麼球不重疊？">
                  <p>
                    若 <M>{'x \\in B(c,1)\\cap B(c\',1)'}</M>，則由三角不等式 <M>{"d(c,c') \\le d(c,x) + d(x,c') \\le 2"}</M>，與 <M>{'d_{\\min} = 3'}</M> 矛盾。
                  </p>
                </Expandable>
              </>
            }
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="Hamming(7,4) 是完美碼">
          <Callout kind="key" title="結論">
            <p>
              16 個半徑 1 的漢明球彼此不重疊（由 <M>{'d_{\\min}=3'}</M>），每個球 8 個字串，總共 <M>{'16 \\times 8 = 128 = 2^7'}</M>。上面的視覺化實際把 128 個字串依最近 codeword 分組，驗證了：<strong>沒有重疊、沒有遺漏</strong>。
              這代表 Hamming(7,4) 在「修正 1 個錯誤」這件事上已經沒有任何浪費——任何長度 7、能修正 1 個錯誤的二元碼最多只有 16 個 codeword。
            </p>
          </Callout>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

function Slider({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
        <span>{label}</span>
        <span className="font-mono text-base font-bold text-slate-900">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-slate-900" />
    </label>
  );
}

function Verdict({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <div className={`rounded-xl border p-3 ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
      <div className="flex items-center gap-1.5 font-semibold">
        {ok ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
        {title}
      </div>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
