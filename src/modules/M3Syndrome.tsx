import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Search } from 'lucide-react';
import {
  type Bit,
  H74,
  LAYOUT_74,
  allVectors,
  column,
  encode74,
  flipBit,
  matchingColumn,
  simulate74,
  weight,
  zeroVector,
  matrixToTex,
} from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitRow, MessageInput, RoleLegend } from '../components/Bits';
import { MatrixView, ColumnVector } from '../components/MatrixView';
import { Venn } from '../components/Venn';
import { RelatedLinks } from '../components/alg/Links';
import { Callout, Card, Derivation, Expandable, FlowBar, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, StatusBadge, type DecodeStatus } from '../components/Lesson';

const ID = 'syndrome';

const PRESETS: { label: string; idx: number[] }[] = [
  { label: '無錯誤', idx: [] },
  { label: '單一錯誤（位置 5）', idx: [4] },
  { label: '兩個錯誤（位置 2, 5）', idx: [1, 4] },
  { label: '三個錯誤（位置 1, 2, 3）', idx: [0, 1, 2] },
];

const errorFrom = (idx: number[]): Bit[] => idx.reduce((e, i) => flipBit(e, i), zeroVector(7));

export default function M3Syndrome() {
  const { message, toggleBit, resetMessage } = useMessage();
  const c = useMemo(() => encode74(message), [message]);
  const [e, setE] = useState<Bit[]>(errorFrom([4]));
  const out = useMemo(() => simulate74(c, e), [c, e]);
  const s = out.decoded.syndrome;
  const match = matchingColumn(s);
  const errIdx = e.flatMap((b, i) => (b ? [i] : []));
  const decoderIdx = out.decoded.position - 1;

  const status: DecodeStatus = out.success ? (out.errorWeight === 0 ? 'ok' : 'corrected') : 'wrong';

  // animated column scan: walks through H's columns until it finds the syndrome
  const [scan, setScan] = useState(-1);
  const sKey = s.join('');
  useEffect(() => {
    if (match < 0) {
      setScan(-1);
      return;
    }
    setScan(0);
    let k = 0;
    const id = window.setInterval(() => {
      k++;
      setScan(k);
      if (k >= match) window.clearInterval(id);
    }, 220);
    return () => window.clearInterval(id);
  }, [sKey, match]);
  const scanDone = match >= 0 && scan >= match;

  const stats = useMemo(() => {
    const rows = Array.from({ length: 8 }, (_, w) => ({ w, total: 0, ok: 0, mis: 0, undetected: 0 }));
    allVectors(7).forEach((err) => {
      const o = simulate74(c, err);
      const row = rows[o.errorWeight];
      row.total++;
      if (o.success) row.ok++;
      else if (o.undetected) row.undetected++;
      else row.mis++;
    });
    return rows;
  }, [c]);

  const receivedStates = c.map((_, i) => (e[i] ? ('error' as const) : 'normal' as const));
  const correctedStates = out.decoded.corrected.map((_, i) => {
    if (i === decoderIdx) return e[i] ? ('corrected' as const) : ('error' as const);
    if (e[i] && i !== decoderIdx) return 'error' as const;
    return 'normal' as const;
  });

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>接收端只看得到 <M>r</M>，不知道原本的 <M>c</M>。Syndrome 的神奇之處在於：它只取決於錯誤 <M>e</M>，完全不需要知道送出的 codeword。</p>
      </ModuleHeader>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="接收端要如何找出錯誤？">
          <div className="prose-lab max-w-3xl">
            <p>
              傳送端送出合法 codeword <M>c</M>，通道加上錯誤 <M>e</M>，接收端得到 <M>{'r = c + e'}</M>。接收端手上只有 <M>r</M>。
              如果能從 <M>r</M> 算出某個「只與 <M>e</M> 有關」的量，就可以推測錯誤在哪裡——這個量就是 <strong>症狀值（Syndrome）</strong>。
            </p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="錯誤向量與 Syndrome">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card title="錯誤向量（Error vector）">
              <Tex block>{'r = c + e'}</Tex>
              <p className="text-sm text-slate-600">
                <M>e</M> 的第 <M>i</M> 位是 1，表示第 <M>i</M> 個位元被翻轉。錯誤個數 = <M>{'\\mathrm{wt}(e)'}</M>。
              </p>
            </Card>
            <Card title="Syndrome">
              <Tex block>{'s = Hr^{T} \\in \\mathbb{F}_2^{3}'}</Tex>
              <p className="text-sm text-slate-600">3 個同位檢查各自的結果：<M>{'s_i = 1'}</M> 代表第 <M>i</M> 個檢查失敗。</p>
            </Card>
            <Card title="關鍵等式">
              <Tex block>{'s = H(c+e)^{T} = \\underbrace{Hc^{T}}_{=0} + He^{T} = He^{T}'}</Tex>
              <p className="text-sm text-slate-600">Syndrome 與送出哪個 codeword 無關。</p>
            </Card>
          </div>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="單一錯誤時，Syndrome 就是 H 的某一欄">
          <div className="prose-lab max-w-3xl">
            <p>
              若只有第 <M>j</M> 個位元出錯，<M>{'e = e_j'}</M>（單位向量），則 <M>{'s = He_j^{T}'}</M> = <strong>H 的第 j 欄</strong>。
              因為 H 的第 j 欄就是 j 的二進位，<M>{'s_1 + 2s_2 + 4s_3 = j'}</M> 直接給出錯誤位置。H 的 7 個欄兩兩不同且非零，所以 7 種單一錯誤可以完全區分。
            </p>
          </div>
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="找出與 Syndrome 相同的那一欄">
          <LabGrid
            main={
              <Card title="H 的欄掃描（Column matching）" icon={<Search className="h-4 w-4 text-fuchsia-600" />}>
                <div className="flex flex-wrap items-center gap-5">
                  <ColumnVector bits={s} label="s =" cellClass={match >= 0 ? 'bg-fuchsia-100 text-fuchsia-800' : 'bg-emerald-50 text-emerald-700'} />
                  <ArrowRight className="h-5 w-5 text-slate-300" />
                  <MatrixView
                    matrix={H74}
                    name="H"
                    colLabels={LAYOUT_74.map((p) => `#${p.position}`)}
                    cellClass={(_i, j) => (scanDone && j === match ? 'bg-fuchsia-500 text-white' : scan === j && !scanDone ? 'bg-slate-200 text-slate-900' : undefined)}
                  />
                </div>
                <motion.div key={sKey + String(scanDone)} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                  {match < 0 ? (
                    <span>
                      <M>{'s = 0'}</M>：所有同位檢查都通過，解碼器判定「沒有錯誤」。
                    </span>
                  ) : scanDone ? (
                    <span>
                      <M>{`s = (${s.join(',')})^T`}</M> 等於 H 的第 <strong>{match + 1}</strong> 欄 ⇒ <M>{`${s[0]} + 2\\cdot${s[1]} + 4\\cdot${s[2]} = ${match + 1}`}</M>，解碼器翻轉位置 {match + 1}（{LAYOUT_74[match].label}）。
                    </span>
                  ) : (
                    <span className="text-slate-500">比對第 {scan + 1} 欄…</span>
                  )}
                </motion.div>
              </Card>
            }
            aside={
              <Card title="Venn 圖：失敗的圓圈 = Syndrome 中的 1">
                <Venn word={out.received} errorIdx={errIdx} onToggle={(i) => setE((x) => flipBit(x, i))} />
                <p className="text-center text-xs text-slate-500">
                  紅色虛線圓圈為奇數（檢查失敗）。<M>{`s = (${s.join(', ')})`}</M> 依序對應 P1、P2、P4。
                </p>
              </Card>
            }
          />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="錯誤注入實驗">
          <LabGrid
            main={
              <Card
                title="點擊「接收字」的任意位元製造傳輸錯誤（0–7 個）"
                actions={
                  <ResetButton
                    onClick={() => {
                      resetMessage();
                      setE(errorFrom([4]));
                    }}
                  />
                }
              >
                <div className="mb-4 flex flex-wrap gap-1.5">
                  {PRESETS.map((p) => (
                    <button key={p.label} className="btn-ghost !py-1 text-xs" onClick={() => setE(errorFrom(p.idx))}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="space-y-4">
                  <Row label="原始資料 m">
                    <MessageInput message={message} onToggle={toggleBit} size="sm" />
                  </Row>
                  <Row label="發送 codeword c">
                    <BitRow bits={c} layout={LAYOUT_74} size="sm" />
                  </Row>
                  <Row label={<>錯誤向量 e <span className="text-slate-400">wt = {weight(e)}</span></>}>
                    <BitRow bits={e} plain size="sm" states={e.map((b) => (b ? 'error' : 'muted'))} onToggle={(i) => setE((x) => flipBit(x, i))} showPositions={false} />
                  </Row>
                  <Row label="接收字 r = c + e（可點擊）">
                    <BitRow bits={out.received} layout={LAYOUT_74} states={receivedStates} onToggle={(i) => setE((x) => flipBit(x, i))} />
                  </Row>
                  <Row label="解碼器輸出（修正後）">
                    <BitRow bits={out.decoded.corrected} layout={LAYOUT_74} states={correctedStates} size="sm" />
                  </Row>
                </div>
                <div className="mt-4">
                  <RoleLegend errors />
                </div>
              </Card>
            }
            aside={
              <>
                <Card title="解碼器的判斷（Decoder decision）">
                  <div className="space-y-2 text-sm">
                    <div>
                      Syndrome <M>{`s = Hr^T = (${s.join(',')})^T`}</M>
                    </div>
                    <div>
                      {out.decoded.position === 0 ? (
                        <>s = 0 → 判定沒有錯誤，不做修改。</>
                      ) : (
                        <>
                          s ≠ 0 → 判定錯誤在位置 <strong>{out.decoded.position}</strong>（{LAYOUT_74[decoderIdx].label}），將其翻轉。
                        </>
                      )}
                    </div>
                    <div>
                      解出資料 <span className="mono font-semibold">{out.decoded.message.join('')}</span>，原始資料 <span className="mono font-semibold">{message.join('')}</span>
                    </div>
                    <div className="pt-1">
                      <StatusBadge
                        status={status}
                        large
                        zh={status === 'wrong' ? (out.undetected ? '未偵測錯誤' : '誤更正') : undefined}
                        en={status === 'wrong' ? (out.undetected ? 'Undetected error' : 'Miscorrection') : undefined}
                      />
                    </div>
                  </div>
                  {out.errorWeight >= 2 && (
                    <div className="mt-3">
                      <Callout kind="warning" title={`${out.errorWeight} 個錯誤：超出 Hamming(7,4) 的保證範圍`}>
                        {out.undetected ? (
                          <p>錯誤向量 e 本身是一個合法 codeword，所以 <M>{'He^T = 0'}</M>：r 仍然是合法 codeword，解碼器完全沒有察覺。</p>
                        ) : out.miscorrection ? (
                          <p>
                            Syndrome 剛好等於 H 的第 {out.decoded.position} 欄（= 錯誤位置所對應欄的和），解碼器以為只有一個錯誤，
                            {e[decoderIdx] ? <>翻轉了位置 {out.decoded.position}（這一位確實是錯的，但其餘錯誤仍在）</> : <strong>翻轉了原本正確的位元</strong>}
                            ，結果錯誤變成 {weight(out.decoded.corrected.map((b, i) => (b ^ c[i]) as Bit))} 個。
                          </p>
                        ) : (
                          <p>這次恰好解回正確 codeword，但這是巧合，不是保證。</p>
                        )}
                        <p className="font-semibold">普通 Hamming(7,4) 不保證能正確修正兩個以上的錯誤。</p>
                      </Callout>
                    </div>
                  )}
                </Card>
                <Derivation
                  resetKey={e.join('') + message.join('')}
                  steps={[
                    { title: '接收字', body: <Tex block>{`r = c + e = ${c.join('')} + ${e.join('')} = ${out.received.join('')}`}</Tex> },
                    { title: '計算 Syndrome', body: <Tex block>{`s = Hr^T = ${matrixToTex(H74)}${matrixToTex(out.received.map((b) => [b]))} = ${matrixToTex(s.map((b) => [b]))}`}</Tex> },
                    {
                      title: '等於 He^T（被翻轉位置的欄相加）',
                      body:
                        errIdx.length === 0 ? (
                          <Tex block>{'He^T = 0'}</Tex>
                        ) : (
                          <Tex block>{`He^T = ${errIdx.map((j) => matrixToTex(column(H74, j).map((b) => [b]))).join(' + ')} = ${matrixToTex(s.map((b) => [b]))}`}</Tex>
                        ),
                    },
                    {
                      title: '解碼決策',
                      body:
                        out.decoded.position === 0 ? (
                          <p>s = 0，輸出 r。</p>
                        ) : (
                          <Tex block>{`s_1 + 2s_2 + 4s_3 = ${out.decoded.position} \\Rightarrow \\hat c = r + e_{${out.decoded.position}} = ${out.decoded.corrected.join('')}`}</Tex>
                        ),
                    },
                  ]}
                />
              </>
            }
          />
          <Card title="0 ~ 3 個錯誤時，這個解碼器表現如何？">
            <p className="text-sm text-slate-700">
              對 codeword <span className="mono">{c.join('')}</span> 窮舉全部 128 種錯誤樣式（即時計算）：1 個錯誤 <strong>{stats[1].ok}/{stats[1].total}</strong> 全部修好；2 個錯誤 <strong>{stats[2].mis}/{stats[2].total}</strong> 被修錯；3 個錯誤中有 <strong>{stats[3].undetected}</strong> 種完全偵測不到。
            </p>
            <div className="mt-3">
              <RelatedLinks
                title="兩個以上的錯誤：詳細分析在第二課，補救方法在第 7 章"
                links={[
                  { to: 'l2-9', text: '兩個錯誤：為什麼一定誤更正（含 21 種情況的窮舉表）' },
                  { to: 'l2-10', text: '三個錯誤：為什麼有些錯誤完全看不見' },
                  { to: 'secded', text: 'SECDED：多一個位元，雙錯就能被偵測' },
                ]}
              />
            </div>
          </Card>
          <Misconceptions
            items={[
              { wrong: 'Syndrome ≠ 0 時，解碼結果一定正確。', right: '只有在「最多一個錯誤」的前提下才正確。兩個錯誤的 Syndrome 也是某一欄，解碼器會翻錯位元。' },
              { wrong: 'Syndrome = 0 代表沒有錯誤。', right: 'Syndrome = 0 只代表 r 是合法 codeword。若 e 本身是非零 codeword（例如重量 3 的 1110000），錯誤無法被發現。' },
              { wrong: '要知道原本的 c 才能算 Syndrome。', right: 's = Hrᵀ 只用到 r；而且 s = Heᵀ 與 c 無關。' },
            ]}
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="Syndrome 解碼的能力與界限">
          <Callout kind="key" title="結論">
            <p>
              H 的 7 個欄恰好是所有非零 3-bit 向量，因此每一個單一錯誤都有獨一無二的 Syndrome，可以被定位與修正。代價是：解碼器<strong>永遠</strong>假設至多一個錯誤，遇到兩個錯誤時會「自信地修錯」。
              要理解為什麼極限剛好是 1 個錯誤，我們需要「距離」的觀點（下一章）。
            </p>
          </Callout>
          <Card>
            <RelatedLinks links={[{ to: 'a-10', text: 'Syndrome 的 GF(8) 觀點：S₁ = r(α)' }, { to: 'a-9', text: 'H 的欄 = GF(8) 的非零元素' }]} title="延伸：代數基礎與循環碼" />
          </Card>
          <Expandable title="證明：單一錯誤一定被正確修正">
            <p>
              設 <M>{'e = e_j'}</M>。則 <M>{'s = He_j^T = h_j'}</M>（H 的第 j 欄）。因為 <M>{'h_1,\\dots,h_7'}</M> 兩兩相異且非零，解碼器找到的欄唯一且就是 <M>{'h_j'}</M>，翻轉位置 j 後得到 <M>{'r + e_j = c + e_j + e_j = c'}</M>。∎
            </p>
          </Expandable>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-center gap-1 sm:grid-cols-[170px_1fr] sm:gap-3">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
