import { useMemo, useState } from 'react';
import {
  H84,
  LAYOUT_84,
  codewords74,
  codewords84,
  correctionCapability,
  detectionCapability,
  differingPositions,
  encode74,
  encode84,
  hammingBound,
  matVec,
  minimumDistance,
  rank,
  weight,
  weightDistribution,
} from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitRow, BitString, MessageInput, RoleLegend } from '../components/Bits';
import { MatrixView } from '../components/MatrixView';
import { Bars } from '../components/Bars';
import { Callout, Card, Derivation, Expandable, FlowBar, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, Stat } from '../components/Lesson';

const ID = 'extended';
const C7 = codewords74();
const C8 = codewords84();

export default function M6Extended() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c7 = useMemo(() => encode74(message), [message]);
  const c8 = useMemo(() => encode84(message), [message]);
  const w7 = weight(c7);
  const md7 = useMemo(() => minimumDistance(C7.map((e) => e.codeword)), []);
  const md8 = useMemo(() => minimumDistance(C8.map((e) => e.codeword)), []);
  const wd7 = weightDistribution(C7.map((e) => e.codeword), 7).map((y, x) => ({ x, y }));
  const wd8 = weightDistribution(C8.map((e) => e.codeword), 8).map((y, x) => ({ x, y }));
  const hist8 = [...md8.histogram.entries()].sort((a, b) => a[0] - b[0]).map(([x, y]) => ({ x, y }));
  const [pair, setPair] = useState<[number, number]>([11, 15]);
  const diff7 = differingPositions(C7[pair[0]].codeword, C7[pair[1]].codeword);
  const diff8 = differingPositions(C8[pair[0]].codeword, C8[pair[1]].codeword);

  const rows = [
    { k: '碼長 n', a: '7', b: '8' },
    { k: '資訊位元 k', a: '4', b: '4' },
    { k: 'Codeword 個數 2ᵏ', a: '16', b: '16' },
    { k: '碼率 k/n', a: (4 / 7).toFixed(3), b: (4 / 8).toFixed(3) },
    { k: '最小距離 d_min（窮舉）', a: String(md7.dmin), b: String(md8.dmin) },
    { k: '保證修正 t', a: String(correctionCapability(md7.dmin)), b: String(correctionCapability(md8.dmin)) },
    { k: '保證偵測 d_min − 1', a: String(detectionCapability(md7.dmin)), b: String(detectionCapability(md8.dmin)) },
    { k: '同時修正 1 + 偵測 2', a: '✗', b: '✓（SECDED）' },
    { k: '完美碼？', a: hammingBound(7, 4, 1).equality ? '是' : '否', b: hammingBound(8, 4, 1).equality ? '是' : '否（144 < 256）' },
    { k: 'rank(H)', a: '3', b: String(rank(H84)) },
  ];

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>在 Hamming(7,4) codeword 後面再加一個「整體同位位元 Overall parity bit」，代價是 1 個位元，收穫是最小距離從 3 變成 4。</p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="兩個錯誤被「自信地修錯」怎麼辦？">
          <div className="prose-lab max-w-3xl">
            <p>
              第 3 章看到：Hamming(7,4) 遇到兩個錯誤時，Syndrome 不為 0，解碼器以為是單一錯誤，結果翻轉了第三個位元——錯誤從 2 個變成 3 個，而且<strong>沒有人知道</strong>。
              在記憶體、硬碟等系統中，「發現資料壞了」遠比「默默交出錯誤資料」好。我們希望至少能<strong>偵測</strong>到雙重錯誤。
            </p>
            <p>
              觀察：單一錯誤會改變 1 的總數的奇偶性，雙重錯誤不會。只要再記錄一次「整體奇偶」，就能分辨兩者。
            </p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="Extended Hamming(8,4)">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="定義">
              <Tex block>{'P_0 = c_1 \\oplus c_2 \\oplus \\cdots \\oplus c_7'}</Tex>
              <Tex block>{'[\\,P_1,P_2,D_1,P_4,D_2,D_3,D_4,\\ P_0\\,]'}</Tex>
              <p className="text-sm text-slate-600">
                本課程把 <M>{'P_0'}</M> 放在第 8 個位置，讓前 7 個位置與 Hamming(7,4) 完全相同（Syndrome 仍然指向位置 1–7）。新 codeword 的 8 個位元總和必為 0（偶數重量）。
              </p>
              <div className="mt-2">
                <RoleLegend overall />
              </div>
            </Card>
            <Card title="Parity-check matrix（4×8）">
              <MatrixView matrix={H84} colLabels={LAYOUT_84.map((p) => p.label)} rowLabels={['P1', 'P2', 'P4', '全']} highlightRows={[3]} rowHighlightClass="bg-overall-100 text-overall-800" />
              <p className="mt-2 text-sm text-slate-600">原本的 H 補一個零欄，再加上全 1 的一列（整體同位檢查）。<M>{`\\operatorname{rank} = ${rank(H84)}`}</M>，所以 code 的維度仍是 <M>{'8 - 4 = 4'}</M>。</p>
            </Card>
          </div>
          <Callout kind="info" title="[n, k, d] 記號">
            <Tex block>{'[7,4,3] \\;\\longrightarrow\\; [8,4,4]'}</Tex>
            <p>長度 +1（多了 P0）；資訊位元仍是 4 個（P0 由其他位元決定，不攜帶新資訊）；最小距離 +1。</p>
          </Callout>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="從 7 位元延伸到 8 位元">
          <LabGrid
            main={
              <Card title="改變資料，觀察 P0 如何計算" actions={<ResetButton onClick={resetMessage} />}>
                <div className="space-y-4">
                  <MessageInput message={message} onToggle={toggleBit} size="md" />
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">Hamming(7,4) codeword · 重量 {w7}（{w7 % 2 ? '奇數' : '偶數'}）</div>
                    <BitRow bits={c7} layout={LAYOUT_84.slice(0, 7)} size="sm" />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">Extended(8,4) codeword · 重量 {weight(c8)}（必為偶數）</div>
                    <BitRow bits={c8} layout={LAYOUT_84} gapBefore={7} />
                  </div>
                </div>
              </Card>
            }
            aside={
              <Derivation
                defaultOpen
                resetKey={message.join('')}
                steps={[
                  { title: '先做 Hamming(7,4) 編碼', body: <Tex block>{`c_{1..7} = ${c7.join('')}`}</Tex> },
                  { title: '把 7 個位元全部 XOR', body: <Tex block>{`P_0 = ${c7.join(' \\oplus ')} = ${c8[7]}`}</Tex> },
                  { title: '附加在最後', body: <Tex block>{`c = ${c7.join('')}\\,|\\,${c8[7]} = ${c8.join('')}`}</Tex> },
                  { title: '檢查', body: <Tex block>{`\\sum_{i=1}^{8} c_i = ${weight(c8)} \\equiv 0 \\pmod 2`}</Tex> },
                ]}
              />
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="比較：Hamming(7,4) vs Extended(8,4)">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card title="Hamming(7,4) codeword 重量分佈">
              <Bars data={wd7} xLabel="重量 w" yLabel="Codeword 數" highlight={(x) => Number(x) === 3} tooltipLabel={(x, y) => `${y} 個 codeword 重量為 ${x}`} />
            </Card>
            <Card title="Extended(8,4) codeword 重量分佈">
              <Bars data={wd8} xLabel="重量 w" yLabel="Codeword 數" highlight={(x) => Number(x) === 4} accent="#7638dc" tooltipLabel={(x, y) => `${y} 個 codeword 重量為 ${x}`} />
            </Card>
          </div>
          <p className="text-sm text-slate-600">
            奇數重量（3、7）的 codeword 加上 P0 = 1 後重量 +1；偶數重量的 codeword P0 = 0。所以 7 個重量 3 的 codeword 變成重量 4，與原本 7 個重量 4 的 codeword 合計 14 個。<strong>重量 3 消失了。</strong>
          </p>
          <Card title="全部 16 個 codeword 並排">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">m</th>
                    <th>Hamming(7,4)</th>
                    <th>wt</th>
                    <th>P0</th>
                    <th>Extended(8,4)</th>
                    <th>wt</th>
                  </tr>
                </thead>
                <tbody>
                  {C8.map((e, i) => (
                    <tr key={i} className={`border-t border-slate-100 ${e.message.join('') === message.join('') ? 'bg-amber-50' : ''}`}>
                      <td className="py-1 font-mono text-data-700">{e.message.join('')}</td>
                      <td>
                        <BitString bits={C7[i].codeword} />
                      </td>
                      <td className="font-mono">{weight(C7[i].codeword)}</td>
                      <td className="font-mono font-bold text-overall-600">{e.codeword[7]}</td>
                      <td>
                        <BitString bits={e.codeword} highlight={(j) => (j === 7 ? 'text-overall-600 font-bold' : undefined)} />
                      </td>
                      <td className="font-mono">{weight(e.codeword)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="窮舉驗證最小距離 = 4">
          <LabGrid
            main={
              <Card title="選兩個訊息，比較它們在兩種 code 中的距離">
                <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                  {[0, 1].map((slot) => (
                    <label key={slot} className="flex items-center gap-2">
                      <span className={`chip ${slot === 0 ? 'bg-data-100 text-data-700' : 'bg-overall-100 text-overall-700'}`}>{slot === 0 ? 'A' : 'B'}</span>
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-sm"
                        value={pair[slot]}
                        onChange={(ev) => {
                          const v = Number(ev.target.value);
                          setPair(slot === 0 ? [v, pair[1]] : [pair[0], v]);
                        }}
                      >
                        {C8.map((e, i) => (
                          <option key={i} value={i}>
                            m = {e.message.join('')}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
                <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-sm">
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                    <span className="text-xs text-slate-500">(7,4) A</span>
                    <BitString bits={C7[pair[0]].codeword} highlight={(j) => (diff7.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
                    <span className="text-xs text-slate-500">(7,4) B</span>
                    <BitString bits={C7[pair[1]].codeword} highlight={(j) => (diff7.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
                    <span className="text-xs text-slate-500">距離</span>
                    <span className="font-mono font-bold">{diff7.length}</span>
                  </div>
                  <div className="grid grid-cols-[90px_1fr] items-center gap-2 border-t border-slate-200 pt-2">
                    <span className="text-xs text-slate-500">(8,4) A</span>
                    <BitString bits={C8[pair[0]].codeword} highlight={(j) => (diff8.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
                    <span className="text-xs text-slate-500">(8,4) B</span>
                    <BitString bits={C8[pair[1]].codeword} highlight={(j) => (diff8.includes(j) ? 'text-fuchsia-600 font-bold' : undefined)} />
                    <span className="text-xs text-slate-500">距離</span>
                    <span className="font-mono font-bold">{diff8.length}</span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">試試 m = 1011 與 1111：在 (7,4) 中距離 3（奇數），P0 不同，所以延伸後距離變 4。</p>
              </Card>
            }
            aside={
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="(7,4) d_min（120 對）" value={md7.dmin} tone="indigo" />
                  <Stat label="(8,4) d_min（120 對）" value={md8.dmin} tone="emerald" />
                </div>
                <Card title="Extended(8,4)：所有 codeword 對的距離">
                  <Bars data={hist8} xLabel="距離 d" yLabel="Codeword 對數" highlight={(x) => x === md8.dmin} accent="#7638dc" height={180} />
                </Card>
                <Card title="所有 codeword 都滿足 H₈cᵀ = 0">
                  <p className="text-sm text-slate-600">
                    已檢查 16 個 codeword：{C8.every((e) => matVec(H84, e.codeword).every((b) => b === 0)) ? '全部通過 ✓' : '有失敗 ✗'}
                  </p>
                </Card>
              </>
            }
          />
          <Card title="比較總表">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">性質</th>
                    <th>Hamming(7,4)</th>
                    <th>Extended Hamming(8,4)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.k} className="border-t border-slate-100">
                      <td className="py-1.5 text-slate-600">{r.k}</td>
                      <td className="font-mono">{r.a}</td>
                      <td className="font-mono font-semibold">{r.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Misconceptions
            items={[
              { wrong: 'd_min = 4，所以 t = ⌊3/2⌋ = 1，Extended Hamming 沒有比較好。', right: '修正能力確實仍是 1，但多了「同時偵測 2 個錯誤」的能力：d_min = 4 ≥ t + s + 1 = 1 + 2 + 1。' },
              { wrong: 'P0 是第 5 個資訊位元。', right: 'P0 完全由其他 7 個位元決定，k 仍是 4。' },
            ]}
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="多一個位元，換來雙重錯誤偵測">
          <Callout kind="key" title="結論">
            <p>
              加入整體同位位元後，所有 codeword 的重量都是偶數，最小非零重量從 3 升到 4，因此 <M>{'d_{\\min} = 4'}</M>。距離 4 的 code 可以「修正 1 個錯誤並同時偵測 2 個錯誤」，下一章把它實作成 SECDED 解碼器。
            </p>
          </Callout>
          <Expandable title="證明：Extended Hamming(8,4) 的 d_min = 4">
            <p>1. 這是線性碼，所以 d_min = 最小非零 codeword 重量。</p>
            <p>2. 每個延伸 codeword <M>{"c' = (c, P_0)"}</M> 滿足 <M>{"\\mathrm{wt}(c') = \\mathrm{wt}(c) + P_0"}</M>，而 <M>{'P_0 \\equiv \\mathrm{wt}(c) \\pmod 2'}</M>，所以 <M>{"\\mathrm{wt}(c')"}</M> 必為偶數。</p>
            <p>3. 原 code 非零 codeword 重量 ≥ 3，因此 <M>{"\\mathrm{wt}(c') \\ge 3"}</M> 且為偶數 ⇒ <M>{"\\mathrm{wt}(c') \\ge 4"}</M>。</p>
            <p>4. 重量 4 的 codeword 確實存在（例如 1011 → {encode84([1, 0, 1, 1]).join('')}，重量 {weight(encode84([1, 0, 1, 1]))}），所以 d_min = 4。∎</p>
          </Expandable>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}
