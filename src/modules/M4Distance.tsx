import { useMemo, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import {
  type Bit,
  LAYOUT_74,
  codewords74,
  correctionCapability,
  decode74,
  detectionCapability,
  differingPositions,
  distanceMatrix,
  flipBit,
  hammingDistance,
  minimumDistance,
  nearestCodewords,
  parseBits,
  vecAdd,
  weight,
} from '../core';
import { Tex, M } from '../components/Tex';
import { BitRow, BitString } from '../components/Bits';
import { Bars } from '../components/Bars';
import { Callout, Card, Derivation, Expandable, FlowBar, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, Stat } from '../components/Lesson';

const ID = 'distance';
const CODE = codewords74();
const WORDS = CODE.map((e) => e.codeword);

/** sequential single-hue ramp for distances 0..7 */
const distColor = (d: number) => {
  const L = 97 - d * 9.5;
  return { background: `hsl(224 76% ${L}%)`, color: L < 62 ? '#fff' : '#1e293b' };
};

export default function M4Distance() {
  // free-form comparison
  const [x, setX] = useState<Bit[]>(parseBits('1011101'));
  const [y, setY] = useState<Bit[]>(parseBits('1001001'));
  const diff = differingPositions(x, y);

  // codeword explorer
  const [pair, setPair] = useState<[number, number]>([11, 15]);
  const md = useMemo(() => minimumDistance(WORDS), []);
  const D = useMemo(() => distanceMatrix(WORDS), []);
  const histogram = [...md.histogram.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => ({ x: d, y: n }));

  // nearest-codeword decoding
  const [r, setR] = useState<Bit[]>(parseBits('0110111'));
  const near = useMemo(() => nearestCodewords(r, WORDS), [r]);
  const syn = decode74(r);
  const sorted = useMemo(() => near.distances.map((d, i) => ({ i, d })).sort((a, b) => a.d - b.d || a.i - b.i), [near]);

  // d_min slider
  const [dSlider, setDSlider] = useState(3);

  const resize = (delta: number) => {
    const n = Math.min(12, Math.max(3, x.length + delta));
    const fit = (v: Bit[]) => Array.from({ length: n }, (_, i) => (v[i] ?? 0) as Bit);
    setX(fit(x));
    setY(fit(y));
  };

  const A = WORDS[pair[0]];
  const B = WORDS[pair[1]];
  const pathDiff = differingPositions(A, B);
  const path = pathDiff.reduce<Bit[][]>((acc, j) => [...acc, flipBit(acc[acc.length - 1], j)], [A]);

  const selectCodeword = (i: number) => {
    if (i === pair[1]) return;
    setPair([pair[1], i]);
  };

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>前面我們用代數（Syndrome）解碼。這一章換成幾何觀點：把 codeword 想成空間中的點，用「差幾個位元」來量距離。</p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="為什麼 Hamming(7,4) 只能修正 1 個錯？">
          <div className="prose-lab max-w-3xl">
            <p>
              上一章看到：兩個錯誤會被「修」成錯的 codeword。原因是錯誤把接收字推得離另一個 codeword 比較近。要量化「近」，我們需要一個距離：
              <strong>兩個字串在幾個位置不同</strong>。codeword 之間最近的距離越大，錯誤就越難把一個 codeword「推」到另一個 codeword 的地盤。
            </p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="Hamming 距離與最小距離">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="Hamming distance">
              <Tex block>{'d_H(x,y) = \\left|\\{\\, i : x_i \\neq y_i \\,\\}\\right|'}</Tex>
              <p className="text-sm text-slate-600">在 GF(2) 中 <M>{'d_H(x,y) = \\mathrm{wt}(x+y)'}</M>。它是真正的度量（metric）：滿足三角不等式。後文常省略下標，把 <M>{'d_H'}</M> 簡寫成 <M>d</M>。</p>
            </Card>
            <Card title="Minimum distance">
              <Tex block>{'d_{\\min} = \\min_{c \\neq c\' \\in C} d_H(c, c\')'}</Tex>
              <p className="text-sm text-slate-600">所有<strong>不同</strong>的 codeword 對之間最小的距離。</p>
            </Card>
            <Card title="修正與偵測能力">
              <Tex block>{'t = \\left\\lfloor \\frac{d_{\\min}-1}{2} \\right\\rfloor'}</Tex>
              <p className="text-sm text-slate-600">
                保證可修正 <M>t</M> 個錯誤；保證可偵測 <M>{'d_{\\min}-1'}</M> 個錯誤。
              </p>
            </Card>
          </div>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="計算兩個字串的距離">
          <LabGrid
            main={
              <Card
                title="點擊位元修改 x、y"
                actions={
                  <>
                    <span className="text-xs text-slate-500">長度 n = {x.length}</span>
                    <button className="btn-ghost !p-1" onClick={() => resize(-1)} aria-label="縮短">
                      <Minus className="h-3 w-3" />
                    </button>
                    <button className="btn-ghost !p-1" onClick={() => resize(1)} aria-label="加長">
                      <Plus className="h-3 w-3" />
                    </button>
                    <ResetButton
                      onClick={() => {
                        setX(parseBits('1011101'));
                        setY(parseBits('1001001'));
                      }}
                    />
                  </>
                }
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-6 font-serif italic">x</span>
                    <BitRow bits={x} plain size="sm" onToggle={(i) => setX(flipBit(x, i))} states={x.map((_, i) => (diff.includes(i) ? 'diff' : 'normal'))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="w-6 font-serif italic">y</span>
                    <BitRow bits={y} plain size="sm" onToggle={(i) => setY(flipBit(y, i))} states={y.map((_, i) => (diff.includes(i) ? 'diff' : 'normal'))} />
                  </div>
                  <div className="flex items-center gap-3 border-t border-slate-100 pt-3">
                    <span className="w-6 text-sm">x+y</span>
                    <BitRow bits={vecAdd(x, y)} plain size="sm" showPositions={false} states={vecAdd(x, y).map((b) => (b ? 'diff' : 'muted'))} />
                  </div>
                </div>
              </Card>
            }
            aside={
              <>
                <Stat label={<M>{'d_H(x,y)'}</M>} value={diff.length} sub={`不同的位置：${diff.map((i) => i + 1).join(', ') || '無'}`} tone="indigo" />
                <Derivation
                  steps={[
                    { title: '逐位比較', body: <p>紫色標示 x 與 y 不同的位置：{diff.map((i) => i + 1).join(', ') || '（無）'}。</p> },
                    { title: '用 GF(2) 加法', body: <Tex block>{`x + y = ${vecAdd(x, y).join('')}`}</Tex> },
                    { title: '數 1 的個數', body: <Tex block>{`d_H(x,y) = \\mathrm{wt}(x+y) = ${weight(vecAdd(x, y))}`}</Tex> },
                  ]}
                />
              </>
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="Codeword Explorer：16 個 codeword 彼此的距離">
          <LabGrid
            main={
              <>
                <Card title="全部 16 個 Hamming(7,4) 合法 codeword（點擊兩個來比較）">
                  <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                    {CODE.map((e) => {
                      const sel = pair.indexOf(e.index);
                      return (
                        <button
                          key={e.index}
                          onClick={() => selectCodeword(e.index)}
                          className={`rounded-lg border px-2 py-1.5 text-left transition-colors ${
                            sel === 0 ? 'border-data-500 bg-data-50 ring-2 ring-data-300' : sel === 1 ? 'border-overall-500 bg-overall-50 ring-2 ring-overall-300' : 'border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          <div className="text-[10px] text-slate-400">
                            #{e.index} · m = {e.message.join('')}
                          </div>
                          <BitString bits={e.codeword} className="text-sm font-semibold" highlight={(j) => (LAYOUT_74[j].role === 'parity' ? 'text-parity-600' : 'text-data-700')} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <span className="chip bg-data-100 text-data-700">A #{pair[0]}</span>
                      <BitRow bits={A} plain size="sm" showPositions={false} states={A.map((_, i) => (pathDiff.includes(i) ? 'diff' : 'normal'))} />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="chip bg-overall-100 text-overall-700">B #{pair[1]}</span>
                      <BitRow bits={B} plain size="sm" showPositions={false} states={B.map((_, i) => (pathDiff.includes(i) ? 'diff' : 'normal'))} />
                    </div>
                    <div className="text-sm">
                      <M>{`d_H(A,B) = ${pathDiff.length}`}</M>
                      {pathDiff.length === md.dmin && <span className="ml-2 chip bg-amber-100 text-amber-800">這是最接近的一對之一</span>}
                    </div>
                  </div>
                </Card>
                <Card title="從 A 走到 B：每次翻一個位元">
                  <p className="mb-2 text-xs text-slate-500">這是一條 Hamming 空間中的最短路徑（每一步距離 1），不是平面上的直線。最右欄是該字串真正的最近 codeword。</p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="text-left text-xs text-slate-500">
                          <th className="py-1">步</th>
                          <th>字串</th>
                          <th>d<sub>H</sub>(·,A)</th>
                          <th>d<sub>H</sub>(·,B)</th>
                          <th>最近 codeword</th>
                        </tr>
                      </thead>
                      <tbody>
                        {path.map((w, k) => {
                          const nr = nearestCodewords(w, WORDS);
                          const owner = nr.nearest.length === 1 ? nr.nearest[0] : -1;
                          return (
                            <tr key={k} className="border-t border-slate-100">
                              <td className="py-1 font-mono text-slate-400">{k}</td>
                              <td>
                                <BitString bits={w} highlight={(j) => (k > 0 && pathDiff.slice(0, k).includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
                              </td>
                              <td className="font-mono">{hammingDistance(w, A)}</td>
                              <td className="font-mono">{hammingDistance(w, B)}</td>
                              <td>
                                {owner === pair[0] ? (
                                  <span className="chip bg-data-100 text-data-700">A</span>
                                ) : owner === pair[1] ? (
                                  <span className="chip bg-overall-100 text-overall-700">B</span>
                                ) : (
                                  <span className="chip bg-slate-100 text-slate-600">
                                    {owner >= 0 ? `#${owner}（距離 ${nr.minDistance}）` : `平手（距離 ${nr.minDistance}）`}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </>
            }
            aside={
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="比較的 codeword 對" value={md.pairsChecked} sub="C(16,2)" />
                  <Stat label={<M>{'d_{\\min}'}</M>} value={md.dmin} sub={`共 ${md.closestPairs.length} 對達到`} tone="indigo" />
                </div>
                <Card title="所有 codeword 對的距離分佈">
                  <Bars data={histogram} xLabel="距離 d" yLabel="Codeword 對數" highlight={(d) => d === md.dmin} tooltipLabel={(d, n) => `${n} 對 codeword 距離為 ${d}`} />
                  <p className="text-xs text-slate-500">藍色長條是最小距離。沒有任何一對距離是 1 或 2。</p>
                </Card>
                <Card title="16×16 距離矩陣（點擊格子選擇一對）">
                  <div className="overflow-x-auto">
                    <div className="grid w-max" style={{ gridTemplateColumns: 'repeat(16, 18px)' }}>
                      {D.map((row, i) =>
                        row.map((d, j) => {
                          const sel = (i === pair[0] && j === pair[1]) || (i === pair[1] && j === pair[0]);
                          return (
                            <button
                              key={`${i}-${j}`}
                              title={`d(#${i}, #${j}) = ${d}`}
                              onClick={() => i !== j && setPair([i, j])}
                              style={distColor(d)}
                              className={`h-[18px] w-[18px] text-[9px] font-semibold leading-[18px] ${sel ? 'outline outline-2 outline-offset-[-1px] outline-amber-500' : ''}`}
                            >
                              {d}
                            </button>
                          );
                        }),
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[10px] text-slate-500">
                    距離
                    {[0, 3, 4, 7].map((d) => (
                      <span key={d} style={distColor(d)} className="rounded px-1.5 py-0.5 font-semibold">
                        {d}
                      </span>
                    ))}
                    （顏色越深越遠）
                  </div>
                </Card>
              </>
            }
          />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="最近 codeword 解碼（Nearest-codeword decoding）">
          <LabGrid
            main={
              <Card
                title="點擊接收字串 r 的位元，觀察它與 16 個 codeword 的距離"
                actions={<ResetButton onClick={() => setR(parseBits('0110111'))} />}
              >
                <BitRow bits={r} layout={LAYOUT_74} onToggle={(i) => setR(flipBit(r, i))} />
                <div className="mt-4 space-y-1">
                  {sorted.map(({ i, d }) => {
                    const isNear = near.nearest.includes(i);
                    return (
                      <div key={i} className={`flex items-center gap-3 rounded-lg px-2 py-1 ${isNear ? 'bg-emerald-50' : ''}`}>
                        <span className="w-8 text-xs text-slate-400">#{i}</span>
                        <BitString bits={WORDS[i]} className="text-sm" highlight={(j) => (WORDS[i][j] !== r[j] ? 'text-fuchsia-600 font-bold' : undefined)} />
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${isNear ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{ width: `${(d / 7) * 100}%` }} />
                        </div>
                        <span className={`w-6 text-right font-mono text-sm ${isNear ? 'font-bold text-emerald-700' : 'text-slate-500'}`}>{d}</span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            }
            aside={
              <>
                <Card title="解碼結果">
                  <div className="space-y-2 text-sm">
                    <div>
                      最小距離 = <strong>{near.minDistance}</strong>，達到的 codeword：{near.nearest.map((i) => `#${i}`).join(', ')}
                    </div>
                    <div>
                      最近 codeword：<span className="mono font-semibold">{WORDS[near.nearest[0]].join('')}</span>
                      {near.unique ? '（唯一）' : '（不唯一！）'}
                    </div>
                    <div>
                      Syndrome 解碼結果：<span className="mono font-semibold">{syn.corrected.join('')}</span>
                    </div>
                    <div className={`rounded-lg px-2 py-1 text-xs ${syn.corrected.join('') === WORDS[near.nearest[0]].join('') ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
                      {syn.corrected.join('') === WORDS[near.nearest[0]].join('') ? '✓ 兩種解碼方法得到相同 codeword' : '✗ 兩種方法結果不同'}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    對 Hamming(7,4)，任何 7-bit 字串到最近 codeword 的距離都 ≤ 1 且最近 codeword 唯一（第 5 章會證明這件事）。所以 Syndrome 解碼 = 最近 codeword 解碼，但 Syndrome 只需要一次矩陣乘法，不必比較 16 次。
                  </p>
                </Card>
                <Misconceptions
                  items={[
                    { wrong: '最近 codeword 一定是送出的 codeword。', right: '只有錯誤數 ≤ t 時才保證。錯誤太多時，接收字可能更靠近另一個 codeword。' },
                    { wrong: 'd_min 是 codeword 之間的平均距離。', right: 'd_min 是「最壞情況」：最接近的那一對決定保證能力。' },
                  ]}
                />
              </>
            }
          />
          <Card title="為什麼距離越大，能保證修正越多錯誤？">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm">
                設 <M>{'d_{\\min}'}</M> =
              </span>
              <input type="range" min={1} max={8} value={dSlider} onChange={(e) => setDSlider(Number(e.target.value))} className="w-40 accent-slate-900" aria-label="最小距離" />
              <span className="font-mono text-lg font-bold">{dSlider}</span>
              <span className="text-sm text-slate-600">
                ⇒ <M>{`t = \\lfloor (${dSlider}-1)/2 \\rfloor = ${correctionCapability(dSlider)}`}</M>，可偵測 <M>{`${detectionCapability(dSlider)}`}</M> 個錯誤
              </span>
            </div>
            <DistanceLine d={dSlider} />
            <p className="mt-2 text-sm text-slate-600">
              兩個最接近的 codeword A、B 之間有一條長度 <M>{'d_{\\min}'}</M> 的路徑。以每個 codeword 為中心、半徑 <M>t</M> 的「地盤」只要滿足 <M>{'2t < d_{\\min}'}</M> 就不會重疊：
              錯 <M>t</M> 個以內的接收字一定比較靠近原本的 codeword。若 <M>{'2t \\ge d_{\\min}'}</M>，中間就會有字串同時屬於兩邊。
            </p>
          </Card>
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="d_min = 3 ⇒ 修正 1 個錯誤">
          <Callout kind="key" title="結論">
            <p>
              窮舉全部 {md.pairsChecked} 對 codeword 得到 <M>{`d_{\\min} = ${md.dmin}`}</M>，因此 <M>{`t = \\lfloor (3-1)/2 \\rfloor = 1`}</M>。我們在意「最接近的兩個 codeword」，因為它們是最容易被錯誤混淆的一對；整個 code 的保證能力由這最壞的一對決定。
            </p>
          </Callout>
          <Expandable title="定理證明：d_min ≥ 2t+1 ⇒ 最近 codeword 解碼可修正 t 個錯誤">
            <p>
              設送出 <M>c</M>、收到 <M>r</M>（這裡的 <M>d</M> 就是 <M>{'d_H'}</M>），錯誤數 <M>{'\\le t'}</M>，所以 <M>{'d(r,c) \\le t'}</M>。對任何其他 codeword <M>{"c'"}</M>，由三角不等式：
            </p>
            <Tex block>{"d(r,c') \\ge d(c,c') - d(r,c) \\ge (2t+1) - t = t+1 > t \\ge d(r,c)."}</Tex>
            <p>所以 <M>c</M> 是唯一的最近 codeword。∎</p>
          </Expandable>
          <Expandable title="線性碼的捷徑：d_min = 最小非零 codeword 重量">
            <p>
              因為 <M>{"d(c,c') = \\mathrm{wt}(c+c')"}</M> 而 <M>{"c+c'"}</M> 也是 codeword，只要檢查 15 個非零 codeword 的重量，不用比較 120 對。Hamming(7,4) 的重量分佈為 1 個重量 0、7 個重量 3、7 個重量 4、1 個重量 7。
            </p>
          </Expandable>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

/** A geodesic path A → B of length d with radius-t regions around both ends. */
function DistanceLine({ d }: { d: number }) {
  const t = correctionCapability(d);
  const W = 560;
  const pad = 40;
  const step = (W - 2 * pad) / d;
  const xs = Array.from({ length: d + 1 }, (_, k) => pad + k * step);
  return (
    <svg viewBox={`0 0 ${W} 90`} className="mt-3 w-full max-w-[600px]">
      <rect x={xs[0] - 12} y={28} width={t * step + 24} height={30} rx={15} fill="rgba(59,108,246,0.12)" stroke="#3b6cf6" strokeDasharray="4 3" />
      <rect x={xs[d] - t * step - 12} y={28} width={t * step + 24} height={30} rx={15} fill="rgba(139,85,240,0.12)" stroke="#8b55f0" strokeDasharray="4 3" />
      <line x1={xs[0]} x2={xs[d]} y1={43} y2={43} stroke="#cbd5e1" strokeWidth={2} />
      {xs.map((x, k) => {
        const end = k === 0 || k === d;
        const inA = k <= t;
        const inB = d - k <= t;
        return (
          <g key={k}>
            <circle cx={x} cy={43} r={end ? 9 : 6} fill={k === 0 ? '#3b6cf6' : k === d ? '#8b55f0' : inA && inB ? '#e11d48' : inA ? '#93b4fd' : inB ? '#c6a8fd' : '#fff'} stroke={end ? 'none' : '#64748b'} strokeWidth={1.5} />
            <text x={x} y={78} textAnchor="middle" fontSize={11} fill="#64748b">
              {k === 0 ? 'A' : k === d ? 'B' : `${k}`}
            </text>
          </g>
        );
      })}
      <text x={pad} y={18} fontSize={11} fill="#2a55e0">
        A 的半徑 {t} 地盤
      </text>
      <text x={W - pad} y={18} fontSize={11} fill="#7638dc" textAnchor="end">
        B 的半徑 {t} 地盤
      </text>
    </svg>
  );
}
