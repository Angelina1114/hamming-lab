import { useState, type ReactNode } from 'react';
import { type Bit, type L2Method, DEFAULT_U, LOG, encodeCyclic, runLfsr, simulateL2, simulateSecdedL2 } from '../../core';
import { M } from '../../components/Tex';
import { Card, LabGrid, ResetButton, Segmented, StatusBadge } from '../../components/Lesson';
import type { BitState } from '../../components/Bits';
import { AlgoSteps, BitStrip, Chapter, Checks, L2Legend } from '../../components/l2/Common';
import { LfsrSim } from '../../components/l2/LfsrSim';
import { LongDivisionView } from '../../components/l2/Division';
import { LookupTable, XorView, correctedStates, outcomeStatus } from '../../components/l2/Decode';
import { AlphaCheck, ChienSim, ThreeObjects } from '../../components/l2/Field';
import { MessagePicker, toggleError } from '../../components/l2/Controls';

const ID = 'l2-13';
type Tab = 'lfsr' | 'division' | 'lookup' | 'chien' | 'xor' | 'compare';

const ERR_PRESETS: { label: string; errors: number[] }[] = [
  { label: '0 bit', errors: [] },
  { label: '1 bit', errors: [2] },
  { label: '2 bits', errors: [2, 7] },
  { label: '3 bits', errors: [4, 6, 7] },
];

export default function L2Playground() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [errors, setErrors] = useState<number[]>([2]);
  const [method, setMethod] = useState<L2Method>('chien');
  const [secded, setSecded] = useState(false);
  const [tab, setTab] = useState<Tab>('lfsr');
  const [encoded, setEncoded] = useState(true);
  const [k, setK] = useState(0);

  const enc = encodeCyclic(u);
  const e7 = errors.filter((p) => p <= 7);
  const o = simulateL2(u, e7, method);
  const other = simulateL2(u, e7, method === 'lookup' ? 'chien' : 'lookup');
  const so = simulateSecdedL2(u, errors);
  const d = o.decode;
  const st = outcomeStatus(o);
  const bump = () => setK((x) => x + 1);

  const recvBits = secded ? so.r8 : o.r;
  const recvStates: BitState[] = (secded ? so.e : o.e).map((b) => (b ? 'error' : 'normal'));
  const secdedOut: BitState[] = so.e.map((b, i) => (so.result.uncorrectable ? (b ? 'error' : 'normal') : i === so.result.position - 1 ? (b ? 'corrected' : 'wrongfix') : b ? 'error' : 'normal'));

  const Row = ({ label, children }: { label: string; children: ReactNode }) => (
    <div className="flex items-start justify-between gap-3 border-t border-slate-100 py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold">{children}</span>
    </div>
  );

  return (
    <Chapter
      id={ID}
      lead={<p>這是第二課所有工具的整合版。每一個數字都由同一套演算法即時計算：改訊息、改錯誤、改解碼方法，整個畫面同步更新。</p>}
      goals={[
        '獨立完成一次完整的編碼 → 錯誤注入 → 解碼 → 驗證',
        '比較 Syndrome Lookup 與 Key Equation + Chien Search',
        '在 0、1、2、3 個錯誤下預測解碼器的行為',
        '切換 SECDED，觀察雙錯如何被偵測',
      ]}
      intuition={{
        title: '先預測，再按下去',
        body: (
          <div className="prose-lab max-w-3xl">
            <p>建議的使用方式：每次改變錯誤之前，先寫下你預期的 Syndrome 與解碼結果，再對照右側摘要。預測錯了的地方，就是需要回頭複習的章節。</p>
          </div>
        ),
      }}
      math={{
        title: '這個實驗室用到的所有公式',
        body: (
          <Card>
            <ul className="space-y-1 text-sm text-slate-700">
              <li>編碼：<M>{'p(x) = x^3u(x) \\bmod g(x),\\ c = u\\,\\|\\,p'}</M>（2-2、2-3）</li>
              <li>通道：<M>{'r = c \\oplus e'}</M></li>
              <li>Syndrome：<M>{'S(x) = r(x) \\bmod g(x) = e(x) \\bmod g(x)'}</M>（2-4）</li>
              <li>定位：查表（2-5）或 <M>{'\\sigma(z) = 1 + S_1z,\\ \\sigma(\\alpha^{-i}) = 0'}</M>（2-6、2-7）</li>
              <li>更正與驗證：<M>{'\\hat c = r \\oplus \\hat e,\\ \\hat c(\\alpha) = 0'}</M>（2-8）</li>
              <li>SECDED：<M>{'(S, q)'}</M> 四種判斷（2-11）</li>
            </ul>
          </Card>
        ),
      }}
      algorithm={{
        title: '操作流程',
        body: (
          <AlgoSteps
            steps={[
              <>點擊四個位元輸入訊息，按「執行編碼」（或直接看 LFSR / 多項式除法分頁）。</>,
              <>點擊接收字的位元注入錯誤（最多 3 個），或用 0/1/2/3 bits 快速範例。</>,
              <>在分頁中逐步觀察：Syndrome 查表、Key Equation、Chien Search、XOR 更正。</>,
              <>右側摘要即時顯示：是否正確、是否偵測到錯誤、是否誤更正；切換 SECDED 比較。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: 'Hamming Code Playground',
        body: (
          <LabGrid
            main={
              <>
                <Card
                  title="1. 訊息與編碼"
                  actions={
                    <ResetButton
                      onClick={() => {
                        setU([...DEFAULT_U]);
                        setErrors([2]);
                        setMethod('chien');
                        setSecded(false);
                        setTab('lfsr');
                        setEncoded(true);
                        bump();
                      }}
                    />
                  }
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <MessagePicker
                      u={u}
                      onChange={(v) => {
                        setU(v);
                        setEncoded(false);
                        bump();
                      }}
                    />
                    <button
                      className="btn-primary"
                      onClick={() => {
                        setEncoded(true);
                        bump();
                      }}
                    >
                      執行編碼
                    </button>
                  </div>
                  <div className="mt-3">
                    {encoded ? (
                      <>
                        <div className="mb-1 text-xs text-slate-500">
                          codeword c = u ‖ p，p = {enc.shifted.join('')} mod 1011 = {enc.parity.join('')}
                          {secded && `，整體同位 P = ${so.c8[7]}`}
                        </div>
                        <BitStrip bits={secded ? so.c8 : enc.codeword} />
                      </>
                    ) : (
                      <p className="text-sm text-amber-700">訊息已改變，按「執行編碼」產生新 codeword。</p>
                    )}
                  </div>
                </Card>

                <Card
                  title="2. 通道：注入錯誤"
                  actions={
                    <>
                      {ERR_PRESETS.map((p) => (
                        <button key={p.label} className={`btn-ghost !py-1 text-xs ${p.errors.join() === errors.join() ? '!border-slate-900 !bg-slate-900 !text-white' : ''}`} onClick={() => setErrors(p.errors)}>
                          {p.label}
                        </button>
                      ))}
                    </>
                  }
                >
                  <div className="mb-1 text-xs text-slate-500">接收字 r（點擊任意位元翻轉，最多 3 個錯誤{secded ? '，含第 8 位 P' : ''}）</div>
                  <BitStrip bits={recvBits} states={recvStates} onToggle={(i) => setErrors(toggleError(errors, i + 1, 3))} groups={false} />
                  <div className="mt-2 text-sm">
                    錯誤向量 e = <span className="mono font-semibold text-rose-700">{(secded ? so.e : o.e).join('')}</span>
                  </div>
                  <div className="mt-2">
                    <L2Legend overall={secded} />
                  </div>
                </Card>

                <Card
                  title="3. 逐步觀察"
                  actions={
                    <Segmented
                      value={method}
                      onChange={(v) => {
                        setMethod(v);
                        bump();
                      }}
                      options={[
                        { value: 'lookup', label: '查表' },
                        { value: 'chien', label: 'Chien Search' },
                      ]}
                    />
                  }
                >
                  <div className="mb-3 overflow-x-auto">
                    <Segmented
                      value={tab}
                      onChange={(v) => {
                        setTab(v);
                        bump();
                      }}
                      options={[
                        { value: 'lfsr', label: 'LFSR' },
                        { value: 'division', label: '多項式除法' },
                        { value: 'lookup', label: 'Syndrome 查表' },
                        { value: 'chien', label: 'Key Eq. + Chien' },
                        { value: 'xor', label: 'XOR 與驗證' },
                        { value: 'compare', label: '方法比較' },
                      ]}
                    />
                  </div>
                  {tab === 'lfsr' && <LfsrSim key={`l${k}`} kind="encoder" input={u} detailed={false} />}
                  {tab === 'division' && (
                    <div className="space-y-4">
                      <div className="text-sm font-semibold text-slate-700">編碼：x³u(x) ÷ g(x)</div>
                      <LongDivisionView key={`d${k}`} dividend={enc.shifted} />
                      <div className="text-sm font-semibold text-slate-700">Syndrome：r(x) ÷ g(x)</div>
                      <LongDivisionView key={`s${k}`} dividend={o.r} />
                    </div>
                  )}
                  {tab === 'lookup' && (
                    <div className="space-y-2">
                      <div className="text-sm">
                        S = <span className="mono font-bold">{d.syndrome.join('')}</span> → {d.position ? `位置 ${d.position}` : '無錯誤'}
                      </div>
                      <LookupTable highlightPos={d.position || undefined} />
                    </div>
                  )}
                  {tab === 'chien' && (
                    <div className="space-y-3">
                      <ThreeObjects S={d.syndrome} />
                      <ChienSim key={`c${k}`} S1={d.field} />
                    </div>
                  )}
                  {tab === 'xor' && (
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                      <XorView key={`x${k}`} r={o.r} e={d.estimatedError} />
                      <AlphaCheck word={d.corrected} />
                    </div>
                  )}
                  {tab === 'compare' && (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[420px] text-sm">
                        <thead>
                          <tr className="text-left text-xs text-slate-500">
                            <th className="py-1">項目</th>
                            <th>Syndrome Lookup</th>
                            <th>Key Equation + Chien</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            const L = method === 'lookup' ? o : other;
                            const Cn = method === 'chien' ? o : other;
                            const rows: [string, string, string][] = [
                              ['Syndrome', L.decode.syndrome.join(''), Cn.decode.syndrome.join('')],
                              ['錯誤位置', L.decode.position ? `#${L.decode.position}` : '無', Cn.decode.position ? `#${Cn.decode.position}` : '無'],
                              ['更正後 ĉ', L.decode.corrected.join(''), Cn.decode.corrected.join('')],
                              ['還原 û', L.decode.message.join(''), Cn.decode.message.join('')],
                              ['所需運算', '1 次查表', `${Cn.decode.chien.length} 次 σ(αʲ) 計算`],
                            ];
                            return rows.map(([a, b, c]) => (
                              <tr key={a} className="border-t border-slate-100">
                                <td className="py-1.5 text-slate-600">{a}</td>
                                <td className="font-mono">{b}</td>
                                <td className="font-mono">{c}</td>
                              </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                      <p className="mt-2 text-xs text-emerald-700">{o.decode.corrected.join('') === other.decode.corrected.join('') ? '✓ 兩種方法結果完全相同' : '✗ 結果不同'}</p>
                    </div>
                  )}
                </Card>
              </>
            }
            aside={
              <>
                <Card
                  title="即時摘要"
                  actions={
                    <Segmented
                      value={secded ? 'on' : 'off'}
                      onChange={(v) => {
                        setSecded(v === 'on');
                        if (v === 'off') setErrors((x) => x.filter((p) => p <= 7));
                      }}
                      options={[
                        { value: 'off', label: '(7,4)' },
                        { value: 'on', label: 'SECDED' },
                      ]}
                    />
                  }
                >
                  <Row label="原始 codeword">
                    <span className="mono">{(secded ? so.c8 : o.c).join('')}</span>
                  </Row>
                  <Row label="接收字 r">
                    <span className="mono">{recvBits.join('')}</span>
                  </Row>
                  <Row label="錯誤向量">
                    <span className="mono text-rose-700">{(secded ? so.e : o.e).join('')}</span>
                  </Row>
                  <Row label="Syndrome">
                    <span className="mono">{(secded ? so.result.syndrome : d.syndrome).join('')}</span>
                    {!secded && d.field !== 0 && (
                      <span className="ml-1">
                        <M>{`=\\alpha^{${LOG[d.field]}}`}</M>
                      </span>
                    )}
                  </Row>
                  {secded && (
                    <Row label="Overall Parity q">
                      {so.result.parity}（{so.result.parity ? '奇' : '偶'}）
                    </Row>
                  )}
                  <Row label="錯誤定位結果">{secded ? (so.result.uncorrectable ? '雙錯：不定位' : so.result.position ? `位置 ${so.result.position}` : '無') : d.position ? `位置 ${d.position}` : '無'}</Row>
                  <Row label={secded && so.result.uncorrectable ? '解碼器輸出（未更正）' : '更正後 codeword'}>
                    <span className="mono">{(secded ? so.result.output : d.corrected).join('')}</span>
                  </Row>
                  <Row label="還原訊息">
                    <span className="mono">{(secded ? so.result.message : d.message).join('')}</span>
                  </Row>
                  <Row label="是否正確">{(secded ? so.success : o.success) ? '✓ 正確' : secded && so.result.uncorrectable ? '— 已標記不可信' : '✗ 錯誤'}</Row>
                  <Row label="是否偵測到錯誤">{(secded ? so.result.case !== 'no-error' : o.detected) ? '是' : '否'}</Row>
                  <Row label="是否誤更正">{(secded ? so.wrongDecision && so.result.case !== 'no-error' : o.miscorrection) ? '是 ⚠' : '否'}</Row>
                  <div className="mt-3">
                    {secded ? (
                      so.result.uncorrectable ? (
                        <StatusBadge status="detected" large zh="Uncorrectable Error" />
                      ) : so.success ? (
                        <StatusBadge status={so.errorCount ? 'corrected' : 'ok'} large />
                      ) : (
                        <StatusBadge status="wrong" large zh={so.result.case === 'no-error' ? '未偵測錯誤' : '誤判 / 誤更正'} />
                      )
                    ) : (
                      <StatusBadge status={st.status} large zh={st.zh} />
                    )}
                  </div>
                  {secded && (
                    <div className="mt-3">
                      <div className="mb-1 text-xs text-slate-500">SECDED 輸出</div>
                      <BitStrip bits={so.result.output} states={secdedOut} size="sm" groups={false} />
                    </div>
                  )}
                  {!secded && (
                    <div className="mt-3">
                      <div className="mb-1 text-xs text-slate-500">更正後（✓ 已更正、✗ 錯誤翻轉、⚡ 殘留錯誤）</div>
                      <BitStrip bits={d.corrected} states={correctedStates(o.e, d.position)} size="sm" groups={false} />
                    </div>
                  )}
                </Card>
              </>
            }
          />
        ),
      }}
      verify={{
        title: '實驗室自我檢查',
        body: (
          <Checks
            items={[
              { label: <>LFSR 最後狀態 {runLfsr(u, 'encoder').final.join('')} = 長除法餘數 {enc.parity.join('')}</>, pass: runLfsr(u, 'encoder').final.join('') === enc.parity.join('') },
              { label: <>Lookup 與 Chien Search 的更正結果相同</>, pass: o.decode.corrected.join('') === other.decode.corrected.join('') },
              { label: <>錯誤數 ≤ 1 時一定還原正確</>, pass: o.errorCount > 1 || o.success },
              { label: <>SECDED：錯誤數 = 2 時一定設旗標</>, pass: so.errorCount !== 2 || so.result.uncorrectable },
              { label: <>更正後的字永遠是合法 codeword（ĉ(α) = 0）</>, pass: d.check === 0 },
            ]}
          />
        ),
      }}
      next={<p>最後一章：整理整個第二課的觀念地圖，並用十種題型的互動測驗檢查自己是否真的會了。</p>}
    />
  );
}
