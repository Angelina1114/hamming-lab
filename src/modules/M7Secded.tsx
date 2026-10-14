import { useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  type Bit,
  type SecdedCase,
  type SecdedOutcome,
  type ChannelOutcome,
  LAYOUT_74,
  LAYOUT_84,
  allVectors,
  encode84,
  flipBit,
  simulate74,
  simulate84,
  syndromeToPosition,
  weight,
  zeroVector,
  isZeroVector,
} from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitRow, MessageInput, RoleLegend, type BitState } from '../components/Bits';
import { Callout, Card, Derivation, Expandable, FlowBar, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Segmented, Stage, StatusBadge, type DecodeStatus } from '../components/Lesson';

const ID = 'secded';

const PRESETS: { label: string; idx: number[] }[] = [
  { label: '無錯誤', idx: [] },
  { label: '單一錯誤 #5', idx: [4] },
  { label: '單一錯誤在 P0 (#8)', idx: [7] },
  { label: '雙重錯誤 #2,#5', idx: [1, 4] },
  { label: '雙重錯誤 #3,#8', idx: [2, 7] },
  { label: '三重錯誤 #1,#2,#3', idx: [0, 1, 2] },
];

const errorFrom = (idx: number[]): Bit[] => idx.reduce((e, i) => flipBit(e, i), zeroVector(8));

const CASE_INFO: Record<SecdedCase, { title: string; action: string; status: DecodeStatus; s: string; q: string }> = {
  'no-error': { title: '沒有偵測到錯誤', action: '輸出接收字', status: 'ok', s: 's = 0', q: 'q = 0' },
  'single-corrected': { title: '前 7 位元單一錯誤', action: '翻轉 Syndrome 指出的位置', status: 'corrected', s: 's ≠ 0', q: 'q = 1' },
  'overall-corrected': { title: '整體同位位元 P0 出錯', action: '翻轉 P0', status: 'corrected', s: 's = 0', q: 'q = 1' },
  'double-detected': { title: '偵測到雙重錯誤', action: '回報錯誤，不做修正', status: 'detected', s: 's ≠ 0', q: 'q = 0' },
};

function secdedStatus(o: SecdedOutcome): DecodeStatus {
  if (o.result.case === 'double-detected') return 'detected';
  if (!o.success) return 'wrong';
  return o.errorWeight === 0 ? 'ok' : 'corrected';
}

function hammingStatus(o: ChannelOutcome): DecodeStatus {
  if (!o.success) return 'wrong';
  return o.errorWeight === 0 ? 'ok' : 'corrected';
}

export default function M7Secded() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c8 = useMemo(() => encode84(message), [message]);
  const c7 = c8.slice(0, 7);
  const [e, setE] = useState<Bit[]>(errorFrom([1, 4]));
  const [mode, setMode] = useState<'h84' | 'h74' | 'both'>('both');

  const o8 = useMemo(() => simulate84(c8, e), [c8, e]);
  const o7 = useMemo(() => simulate74(c7, e.slice(0, 7)), [c7, e]);
  const r = o8.result;
  const sZero = isZeroVector(r.syndrome);
  const st8 = secdedStatus(o8);
  const st7 = hammingStatus(o7);
  const flip = (i: number) => setE((x) => flipBit(x, i));

  const stats8 = useMemo(() => {
    const rows = Array.from({ length: 9 }, (_, w) => ({ w, total: 0, ok: 0, corrected: 0, detected: 0, wrong: 0 }));
    allVectors(8).forEach((err) => {
      const o = simulate84(c8, err);
      const row = rows[o.errorWeight];
      row.total++;
      const s = secdedStatus(o);
      if (s === 'ok') row.ok++;
      else if (s === 'corrected') row.corrected++;
      else if (s === 'detected') row.detected++;
      else row.wrong++;
    });
    return rows;
  }, [c8]);

  const stats7 = useMemo(() => {
    const rows = Array.from({ length: 8 }, (_, w) => ({ w, total: 0, ok: 0, corrected: 0, detected: 0, wrong: 0 }));
    allVectors(7).forEach((err) => {
      const o = simulate74(c7, err);
      const row = rows[o.errorWeight];
      row.total++;
      const s = hammingStatus(o);
      if (s === 'ok') row.ok++;
      else if (s === 'corrected') row.corrected++;
      else row.wrong++;
    });
    return rows;
  }, [c7.join('')]);

  const decisionTex = `s = (${r.syndrome.join(',')})^T,\\quad q = \\textstyle\\sum_{i=1}^{8} r_i = ${r.overallParity}`;

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          SECDED = <strong>S</strong>ingle <strong>E</strong>rror <strong>C</strong>orrection, <strong>D</strong>ouble <strong>E</strong>rror <strong>D</strong>etection。同時看兩個訊號——Syndrome <M>s</M> 與整體同位 <M>q</M>——就能區分四種情況。
        </p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="伺服器記憶體每天都在用的技術">
          <div className="prose-lab max-w-3xl">
            <p>
              ECC 記憶體（伺服器 DRAM）、快取、許多儲存控制器都使用 SECDED。理由很實際：單一位元錯誤最常見，應該自動修好；雙位元錯誤較少見，但一旦發生必須<strong>回報</strong>（例如讓作業系統停止使用該頁面），絕不能默默交出錯誤資料。
            </p>
            <p>Hamming(7,4) 做不到後者。Extended(8,4) 多出的整體同位位元，剛好提供分辨「1 個錯」與「2 個錯」所需的資訊。</p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="兩個訊號，四種判斷">
          <Card>
            <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-semibold">Syndrome（前 7 位元）</div>
                <Tex block>{'s = H\\,(r_1,\\dots,r_7)^T \\in \\mathbb{F}_2^3'}</Tex>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="font-semibold">整體同位檢查 Overall parity（全部 8 位元）</div>
                <Tex block>{'q = r_1 + r_2 + \\cdots + r_8 \\in \\mathbb{F}_2'}</Tex>
              </div>
            </div>
            <DecisionTable current={r.case} />
            <p className="mt-3 text-sm text-slate-600">
              直覺：奇數個錯誤讓 <M>{'q = 1'}</M>，偶數個錯誤讓 <M>{'q = 0'}</M>。若 <M>{'q = 0'}</M> 但 <M>{'s \\neq 0'}</M>，一定有錯但錯誤數是偶數——在「至多 2 個錯誤」的前提下就是 2 個。
            </p>
          </Card>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="計算 s 與 q">
          <LabGrid
            main={
              <Card title="點擊接收字的位元製造錯誤" actions={<ResetButton onClick={() => { resetMessage(); setE(errorFrom([1, 4])); }} />}>
                <div className="space-y-3">
                  <MessageInput message={message} onToggle={toggleBit} size="sm" />
                  <BitRow bits={o8.received} layout={LAYOUT_84} states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={flip} gapBefore={7} />
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Signal label="Syndrome s" value={`(${r.syndrome.join(', ')})`} sub={sZero ? '= 0' : `≠ 0，指向位置 ${syndromeToPosition(r.syndrome)}`} on={!sZero} />
                  <Signal label="Overall parity q" value={String(r.overallParity)} sub={r.overallParity ? '奇數個 1 → 奇數個錯誤' : '偶數個 1 → 偶數個錯誤（含 0）'} on={r.overallParity === 1} />
                </div>
              </Card>
            }
            aside={
              <Derivation
                defaultOpen
                resetKey={e.join('') + message.join('')}
                steps={[
                  { title: '接收字', body: <Tex block>{`r = c + e = ${c8.join('')} + ${e.join('')} = ${o8.received.join('')}`}</Tex> },
                  {
                    title: 'Syndrome（只用前 7 位）',
                    body: <Tex block>{`s = H\\,(${o8.received.slice(0, 7).join('')})^T = (${r.syndrome.join(',')})^T${sZero ? '' : ` \\Rightarrow ${r.syndrome[0]}+2\\cdot${r.syndrome[1]}+4\\cdot${r.syndrome[2]} = ${syndromeToPosition(r.syndrome)}`}`}</Tex>,
                  },
                  { title: '整體同位', body: <Tex block>{`q = ${o8.received.join('+')} = ${r.overallParity}`}</Tex> },
                  {
                    title: '套用決策表',
                    body: (
                      <p>
                        {CASE_INFO[r.case].s}、{CASE_INFO[r.case].q} ⇒ <strong>{CASE_INFO[r.case].title}</strong>：{CASE_INFO[r.case].action}
                        {r.correctedPosition > 0 && `（位置 ${r.correctedPosition}）`}。
                      </p>
                    ),
                  },
                ]}
              />
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="決策平面">
          <LabGrid
            main={
              <Card title="目前落在哪一格？">
                <DecisionGrid current={r.case} />
                <p className="mt-3 text-center text-sm text-slate-600">
                  <Tex>{decisionTex}</Tex>
                </p>
              </Card>
            }
            aside={
              <Card title="為什麼這四格能分開 0、1、2 個錯誤？">
                <ul className="space-y-2 text-sm text-slate-700">
                  <li>
                    <strong>0 個錯：</strong> <M>{'s = 0,\\ q = 0'}</M>。
                  </li>
                  <li>
                    <strong>1 個錯在位置 j ≤ 7：</strong> <M>{'s = h_j \\neq 0'}</M>，<M>{'q = 1'}</M>。
                  </li>
                  <li>
                    <strong>1 個錯在 P0：</strong> 前 7 位沒變，<M>{'s = 0'}</M>，<M>{'q = 1'}</M>。
                  </li>
                  <li>
                    <strong>2 個錯：</strong> <M>{'q = 0'}</M>（偶數）。若兩個都在前 7 位，<M>{'s = h_i + h_j \\neq 0'}</M>（欄兩兩相異）；若其中一個是 P0，<M>{'s = h_i \\neq 0'}</M>。總之 <M>{'s \\ne 0'}</M>。
                  </li>
                </ul>
              </Card>
            }
          />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="SECDED 實驗器：同一個錯誤，兩種解碼器">
          <Card
            title="錯誤情境"
            actions={
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'h84', label: 'Extended(8,4)' },
                  { value: 'h74', label: 'Hamming(7,4)' },
                  { value: 'both', label: '並排比較' },
                ]}
              />
            }
          >
            <div className="mb-3 flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button key={p.label} className={`btn-ghost !py-1 text-xs ${e.join('') === errorFrom(p.idx).join('') ? '!border-slate-900' : ''}`} onClick={() => setE(errorFrom(p.idx))}>
                  {p.label}
                </button>
              ))}
              <ResetButton onClick={() => { resetMessage(); setE(errorFrom([1, 4])); }} />
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
              <span>
                錯誤向量 e = <span className="mono font-semibold text-rose-600">{e.join('')}</span>（{weight(e)} 個錯誤）
              </span>
              <RoleLegend overall errors />
            </div>
          </Card>

          <div className={`grid grid-cols-1 gap-4 ${mode === 'both' ? 'lg:grid-cols-2' : ''}`}>
            {(mode === 'h84' || mode === 'both') && (
              <Card title="Extended Hamming(8,4) + SECDED 解碼器">
                <DecoderPanel
                  sent={c8}
                  received={o8.received}
                  error={e}
                  output={r.corrected}
                  flippedIdx={r.correctedPosition - 1}
                  layout8
                  onToggle={flip}
                />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="chip bg-slate-100 font-mono text-slate-700">s = {r.syndrome.join('')}</span>
                  <span className="chip bg-slate-100 font-mono text-slate-700">q = {r.overallParity}</span>
                  <span className="text-slate-500">→ {CASE_INFO[r.case].title}</span>
                </div>
                <motion.div key={st8 + e.join('')} initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3">
                  <StatusBadge status={st8} large zh={st8 === 'wrong' ? (r.case === 'no-error' ? '錯誤未被偵測' : '誤判 / 誤修正') : undefined} />
                </motion.div>
                <OutcomeNote weightE={weight(e)} status={st8} />
              </Card>
            )}
            {(mode === 'h74' || mode === 'both') && (
              <Card title="Hamming(7,4) Syndrome 解碼器（只看前 7 位元）">
                <DecoderPanel sent={c7} received={o7.received} error={e.slice(0, 7)} output={o7.decoded.corrected} flippedIdx={o7.decoded.position - 1} onToggle={flip} />
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  <span className="chip bg-slate-100 font-mono text-slate-700">s = {o7.decoded.syndrome.join('')}</span>
                  <span className="text-slate-500">→ {o7.decoded.position === 0 ? '判定無錯誤' : `翻轉位置 ${o7.decoded.position}`}</span>
                </div>
                <motion.div key={st7 + e.join('')} initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-3">
                  <StatusBadge status={st7} large zh={st7 === 'wrong' ? (o7.undetected ? '錯誤未被偵測' : '誤修正 Miscorrection') : undefined} />
                </motion.div>
                {e[7] === 1 && <p className="mt-2 text-xs text-slate-500">（第 8 位的錯誤在 Hamming(7,4) 中不存在，已忽略。）</p>}
                {weight(e.slice(0, 7)) === 2 && <p className="mt-2 text-sm text-rose-700">Hamming(7,4) 無法分辨「1 個錯」與「2 個錯」，於是把 2 個錯誤當成 1 個來修正。</p>}
              </Card>
            )}
          </div>

          <Callout kind="warning" title="保證只在「最多 2 個錯誤」時成立">
            <p>
              上述四種分類假設錯誤數 ≤ 2。若有 3 個以上的錯誤，SECDED 可能誤判或誤修正：例如預設「三重錯誤 #1,#2,#3」中，前 7 位的錯誤 1110000 本身是 Hamming codeword，所以 <M>{'s = 0'}</M>，而 3 是奇數使 <M>{'q = 1'}</M>，解碼器以為是 P0 出錯並「修正」它，結果仍是錯的。
            </p>
          </Callout>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <StatsTable title={`SECDED：對 ${c8.join('')} 窮舉全部 256 種錯誤`} rows={stats8} current={weight(e)} showDetected />
            <StatsTable title={`Hamming(7,4)：對 ${c7.join('')} 窮舉全部 128 種錯誤`} rows={stats7} current={weight(e.slice(0, 7))} />
          </div>
          <Misconceptions
            items={[
              { wrong: 'SECDED 可以修正 2 個錯誤。', right: '只能「偵測」2 個錯誤，並且刻意不修正——因為 d_min = 4 時，距離 2 的字串到兩個以上 codeword 一樣近，無從判斷。' },
              { wrong: 'q = 1 一定代表剛好 1 個錯誤。', right: 'q = 1 代表奇數個錯誤；只有在「錯誤數 ≤ 2」的假設下才等於 1 個。' },
              { wrong: 's = 0 就不用看 q。', right: 's = 0、q = 1 正是 P0 自己出錯的情況，需要修正 P0。' },
            ]}
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="從 Hamming 到 SECDED 的完整故事">
          <Callout kind="key" title="結論">
            <p>
              Hamming(7,4) 的 H 讓單一錯誤可定位（第 2–3 章）；<M>{'d_{\\min} = 3'}</M> 說明它恰好修正 1 個錯（第 4 章）；Hamming Bound 告訴我們它是完美碼、沒有多餘空間來偵測雙重錯誤（第 5 章）。
              加入 1 個整體同位位元得到 <M>{'d_{\\min} = 4'}</M>（第 6 章），SECDED 解碼器用 <M>{'(s, q)'}</M> 兩個訊號，在至多 2 個錯誤時保證：<strong>1 個錯必修正，2 個錯必偵測</strong>。窮舉表中第 1、2 列的結果正是這個保證。
            </p>
          </Callout>
          <Expandable title="與距離觀點的對應">
            <p>
              <M>{'d_{\\min} = 4'}</M> 時，半徑 1 的球不重疊；而距離 2 的字串到最近 codeword 的距離為 2，可能同時離好幾個 codeword 一樣近。SECDED 的「偵測到雙重錯誤」就是接收字落在這些球之外的區域（第 5 章 Extended(8,4) 視圖中的 112 個平手字串）。
            </p>
          </Expandable>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

function Signal({ label, value, sub, on }: { label: string; value: string; sub: string; on: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${on ? 'border-orange-300 bg-orange-50' : 'border-emerald-200 bg-emerald-50'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-mono text-xl font-bold">{value}</div>
      <div className="text-xs text-slate-600">{sub}</div>
    </div>
  );
}

const ORDER: SecdedCase[] = ['no-error', 'overall-corrected', 'double-detected', 'single-corrected'];

function DecisionTable({ current }: { current: SecdedCase }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-1">Syndrome s</th>
            <th>Overall parity q</th>
            <th>判斷</th>
            <th>動作</th>
            <th>標示</th>
          </tr>
        </thead>
        <tbody>
          {(['no-error', 'single-corrected', 'overall-corrected', 'double-detected'] as SecdedCase[]).map((k) => {
            const c = CASE_INFO[k];
            return (
              <tr key={k} className={`border-t border-slate-100 ${k === current ? 'bg-amber-50' : ''}`}>
                <td className="py-2 font-mono">{c.s}</td>
                <td className="font-mono">{c.q}</td>
                <td className="font-medium">{c.title}</td>
                <td className="text-slate-600">{c.action}</td>
                <td>
                  <StatusBadge status={c.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DecisionGrid({ current }: { current: SecdedCase }) {
  const cell = (k: SecdedCase) => {
    const c = CASE_INFO[k];
    const on = k === current;
    const tone = c.status === 'ok' ? 'emerald' : c.status === 'corrected' ? 'sky' : 'orange';
    const cls = {
      emerald: on ? 'border-emerald-500 bg-emerald-50 ring-4 ring-emerald-200' : 'border-slate-200',
      sky: on ? 'border-sky-500 bg-sky-50 ring-4 ring-sky-200' : 'border-slate-200',
      orange: on ? 'border-orange-500 bg-orange-50 ring-4 ring-orange-200' : 'border-slate-200',
    }[tone];
    return (
      <motion.div key={k} animate={{ scale: on ? 1.02 : 1, opacity: on ? 1 : 0.55 }} className={`rounded-xl border-2 p-3 ${cls}`}>
        <StatusBadge status={c.status} />
        <div className="mt-2 text-sm font-semibold">{c.title}</div>
        <div className="text-xs text-slate-500">{c.action}</div>
      </motion.div>
    );
  };
  return (
    <div className="grid grid-cols-[auto_1fr_1fr] gap-2">
      <div />
      <div className="text-center text-xs font-semibold text-slate-500">q = 0（偶數個錯）</div>
      <div className="text-center text-xs font-semibold text-slate-500">q = 1（奇數個錯）</div>
      <div className="grid place-items-center text-xs font-semibold text-slate-500 [writing-mode:vertical-rl]">s = 0</div>
      {cell(ORDER[0])}
      {cell(ORDER[1])}
      <div className="grid place-items-center text-xs font-semibold text-slate-500 [writing-mode:vertical-rl]">s ≠ 0</div>
      {cell(ORDER[2])}
      {cell(ORDER[3])}
    </div>
  );
}

function DecoderPanel({
  sent,
  received,
  error,
  output,
  flippedIdx,
  layout8 = false,
  onToggle,
}: {
  sent: Bit[];
  received: Bit[];
  error: Bit[];
  output: Bit[] | null;
  flippedIdx: number;
  layout8?: boolean;
  onToggle: (i: number) => void;
}) {
  const layout = layout8 ? LAYOUT_84 : LAYOUT_74;
  const outStates: BitState[] | undefined = output?.map((_, i) => {
    if (i === flippedIdx) return error[i] ? 'corrected' : 'error';
    return error[i] ? 'error' : 'normal';
  });
  return (
    <div className="space-y-3">
      <PanelRow label="發送 c">
        <BitRow bits={sent} layout={layout} size="sm" showPositions={false} gapBefore={layout8 ? 7 : undefined} />
      </PanelRow>
      <PanelRow label="接收 r（可點擊）">
        <BitRow bits={received} layout={layout} size="sm" showPositions={false} states={error.map((b) => (b ? 'error' : 'normal'))} onToggle={onToggle} gapBefore={layout8 ? 7 : undefined} />
      </PanelRow>
      <PanelRow label="解碼輸出">
        {output ? (
          <BitRow bits={output} layout={layout} size="sm" showPositions={false} states={outStates} gapBefore={layout8 ? 7 : undefined} />
        ) : (
          <div className="rounded-lg border-2 border-dashed border-orange-400 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-800">拒絕輸出：偵測到無法修正的錯誤，請求重傳 / 回報系統</div>
        )}
      </PanelRow>
    </div>
  );
}

function PanelRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid items-center gap-1 sm:grid-cols-[110px_1fr]">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function OutcomeNote({ weightE, status }: { weightE: number; status: DecodeStatus }) {
  if (weightE <= 2) {
    return (
      <p className="mt-2 text-xs text-slate-500">
        {weightE === 0 && '沒有錯誤，解碼器原樣輸出。'}
        {weightE === 1 && '單一錯誤：保證被定位並修正。'}
        {weightE === 2 && '雙重錯誤：保證被偵測，解碼器不會亂改資料。'}
      </p>
    );
  }
  return (
    <p className="mt-2 text-xs text-rose-700">
      {weightE} 個錯誤超出保證範圍。{status === 'detected' ? '這次剛好被偵測到，但不是保證。' : '解碼器做出了錯誤的判斷。'}
    </p>
  );
}

function StatsTable({ title, rows, current, showDetected = false }: { title: string; rows: { w: number; total: number; ok: number; corrected: number; detected: number; wrong: number }[]; current: number; showDetected?: boolean }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[360px] text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1">wt(e)</th>
              <th>樣式數</th>
              <th className="text-emerald-700">正常</th>
              <th className="text-sky-700">已修正</th>
              {showDetected && <th className="text-orange-700">偵測未修正</th>}
              <th className="text-rose-700">錯誤判斷</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r) => (
              <tr key={r.w} className={`border-t border-slate-100 ${r.w === current ? 'bg-amber-50' : ''}`}>
                <td className="py-1">{r.w}</td>
                <td>{r.total}</td>
                <td className="text-emerald-700">{r.ok || '·'}</td>
                <td className="text-sky-700">{r.corrected || '·'}</td>
                {showDetected && <td className="text-orange-700">{r.detected || '·'}</td>}
                <td className="text-rose-700">{r.wrong || '·'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
