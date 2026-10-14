import { useState } from 'react';
import { motion } from 'framer-motion';
import { Flag } from 'lucide-react';
import { type Bit, type SecdedL2Case, DEFAULT_U, combinations, encodeCyclic, encodeSecdedL2, simulateL2, simulateSecdedL2, weight } from '../../core';
import { M } from '../../components/Tex';
import { Callout, Card, ResetButton, StatusBadge, type DecodeStatus } from '../../components/Lesson';
import type { BitState } from '../../components/Bits';
import { AlgoSteps, BitStrip, Chapter, Checks, L2Legend } from '../../components/l2/Common';
import { MessagePicker, toggleError } from '../../components/l2/Controls';
import { RelatedLinks } from '../../components/alg/Links';
import { outcomeStatus } from '../../components/l2/Decode';

const ID = 'l2-11';

const CASES: { k: SecdedL2Case; s: string; q: string; zh: string; en: string; action: string; status: DecodeStatus }[] = [
  { k: 'no-error', s: 'S = 0', q: '偶 Even', zh: '沒有錯誤', en: 'No Error', action: '直接輸出', status: 'ok' },
  { k: 'single', s: 'S ≠ 0', q: '奇 Odd', zh: '單一錯誤', en: 'Single Error, Correct', action: '依 S 翻轉一個 bit', status: 'corrected' },
  { k: 'double', s: 'S ≠ 0', q: '偶 Even', zh: '雙重錯誤', en: 'Double Error Detected', action: '不更正，保留資料，設旗標', status: 'detected' },
  { k: 'overall', s: 'S = 0', q: '奇 Odd', zh: '總同位位元錯誤', en: 'Overall Parity Bit Error', action: '翻轉第 8 位（P）', status: 'corrected' },
];

const SCENARIOS: { label: string; errors: number[] }[] = [
  { label: '無錯誤', errors: [] },
  { label: '單一錯誤（位置 2）', errors: [2] },
  { label: '總同位位元錯誤（位置 8）', errors: [8] },
  { label: '雙重錯誤（位置 2、7）', errors: [2, 7] },
];

export default function L2Secded() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [errors, setErrors] = useState<number[]>([2, 7]);
  const so = simulateSecdedL2(u, errors);
  const res = so.result;
  const plain = simulateL2(u, errors.filter((p) => p <= 7));
  const c7 = encodeCyclic(u).codeword;
  const c8 = encodeSecdedL2(u);
  const cur = CASES.find((c) => c.k === res.case)!;

  const outStates: BitState[] = so.e.map((b, i) => {
    if (res.uncorrectable) return b ? 'error' : 'normal';
    if (i === res.position - 1) return b ? 'corrected' : 'wrongfix';
    return b ? 'error' : 'normal';
  });

  const singles = [1, 2, 3, 4, 5, 6, 7, 8].map((p) => simulateSecdedL2(u, [p]));
  const doubles = combinations(8, 2).map((pp) => simulateSecdedL2(u, pp));
  const triples = combinations(8, 3).map((t) => simulateSecdedL2(u, t));
  const tripleWrong = triples.filter((t) => t.wrongDecision).length;

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          SECDED = <strong>S</strong>ingle <strong>E</strong>rror <strong>C</strong>orrection, <strong>D</strong>ouble <strong>E</strong>rror <strong>D</strong>etection。只多 1 個 bit，就能把「兩個錯誤被默默修錯」變成「兩個錯誤被明確回報」。
        </p>
      }
      goals={[
        '回顧：Extended Hamming(8,4) 與 SECDED 四種判斷（理論在第一課 M6、M7）',
        '把 SECDED 套到第二課的循環碼：Syndrome 改用 r(x) mod g(x)',
        '實作細節：雙錯時不更正、保留資料、設定 Uncorrectable Error 旗標',
        '理解保證只在「至多兩個錯誤」時成立',
      ]}
      intuition={{
        title: '同一套規則，換到循環碼上實作',
        body: (
          <div className="prose-lab max-w-3xl">
            <p>
              第一課已經證明：Syndrome 回答「像是錯在哪」，總同位位元回答「錯誤個數是奇數還是偶數」，兩者合起來就能分辨 0、1、2 個錯誤（<a className="text-indigo-700 underline" href="#/secded">M7 SECDED 實驗器</a>）。這一章不再重新推導，而是把同一套規則放到第二課的系統式循環碼上，並處理硬體真正要做的事：<strong>雙錯時輸出什麼、旗標怎麼設</strong>。
            </p>
          </div>
        ),
      }}
      math={{
        title: '和第一課的 SECDED 差在哪裡？',
        body: (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1">項目</th>
                    <th>第一課 M7</th>
                    <th>本章（循環碼）</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">7 位元 codeword 的排列</td>
                    <td>[P1, P2, D1, P4, D2, D3, D4]</td>
                    <td>u ‖ p（左 = x⁶，訊息在前 4 位）</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">Syndrome</td>
                    <td>
                      <M>{'s = Hr^T'}</M>，數值 = 位置
                    </td>
                    <td>
                      <M>{'S = r_{1..7}(x) \\bmod g(x)'}</M>，查表（2-5）得位置
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">總同位位元</td>
                    <td colSpan={2}>
                      第 8 位 <M>{'P = c_1 \\oplus \\cdots \\oplus c_7'}</M>，讓 8 個位元中 1 的個數為偶數（兩者相同）
                    </td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">四種判斷</td>
                    <td colSpan={2}>完全相同（為什麼互不重疊，見 M7「為什麼這四格能分開」）</td>
                  </tr>
                  <tr className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-600">本章新增</td>
                    <td colSpan={2}>雙錯時的輸出與旗標、和普通 Hamming 解碼器並排比較、窮舉驗證</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <RelatedLinks
                title="理論在第一課"
                links={[
                  { to: 'extended', text: 'Extended Hamming(8,4)：為什麼 d_min 從 3 變成 4' },
                  { to: 'secded', text: 'SECDED：四種判斷的推導與決策平面' },
                ]}
              />
            </div>
          </Card>
        ),
      }}
      algorithm={{
        title: 'SECDED 判斷表',
        body: (
          <>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">Syndrome</th>
                      <th>Overall Parity</th>
                      <th>判斷</th>
                      <th>動作</th>
                      <th>標示</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CASES.map((c) => (
                      <tr key={c.k} className={`border-t border-slate-100 ${c.k === res.case ? 'bg-amber-100' : ''}`}>
                        <td className="py-2 font-mono">{c.s}</td>
                        <td>{c.q}</td>
                        <td>
                          {c.k === res.case && '▶ '}
                          {c.zh} <span className="text-xs text-slate-500">{c.en}</span>
                        </td>
                        <td className="text-slate-600">{c.action}</td>
                        <td>
                          <StatusBadge status={c.status} zh={c.k === 'double' ? 'Uncorrectable' : undefined} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <AlgoSteps
              steps={[
                <>計算前 7 位的 Syndrome S 與 8 位的同位 q。</>,
                <>依上表判斷；單錯時用 2-5 的查表（或 Chien Search）找到位置並翻轉。</>,
                <>總同位錯誤時翻轉第 8 位，資料位元不受影響。</>,
                <>雙錯時：不更正、原樣保留接收資料、設定 Uncorrectable Error 旗標，交給上層處理（重傳、記錄、停用記憶體頁面…）。</>,
              ]}
            />
          </>
        ),
      }}
      interactive={{
        title: '四種情況互動展示',
        body: (
          <Card
            title="選擇情境，或點擊 8 位元中的任一位製造錯誤"
            actions={
              <ResetButton
                onClick={() => {
                  setU([...DEFAULT_U]);
                  setErrors([2, 7]);
                }}
              />
            }
          >
            <div className="mb-4 space-y-3">
              <MessagePicker u={u} onChange={setU} size="sm" />
              <div className="flex flex-wrap gap-1.5">
                {SCENARIOS.map((sc) => (
                  <button key={sc.label} className={`btn-ghost !py-1 text-xs ${sc.errors.join() === errors.join() ? '!border-slate-900 !bg-slate-900 !text-white' : ''}`} onClick={() => setErrors(sc.errors)}>
                    {sc.label}
                  </button>
                ))}
              </div>
              <L2Legend overall />
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-500">
                  送出：7 位元 codeword {c7.join('')} + 總同位 P = {c8[7]}（1 的個數 = {weight(c8)}，偶數）
                </div>
                <BitStrip bits={c8} />
              </div>
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-500">接收 r（點擊注入錯誤，最多 3 個）</div>
                <BitStrip bits={so.r8} states={so.e.map((b) => (b ? 'error' : 'normal'))} onToggle={(i) => setErrors(toggleError(errors, i + 1, 3))} groups={false} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className={`rounded-xl border-2 p-3 ${res.syndrome.some(Boolean) ? 'border-orange-300 bg-orange-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="text-xs text-slate-500">Syndrome（前 7 位）</div>
                <div className="font-mono text-2xl font-bold">{res.syndrome.join('')}</div>
                <div className="text-xs">{res.syndrome.some(Boolean) ? 'S ≠ 0' : 'S = 0'}</div>
              </div>
              <div className={`rounded-xl border-2 p-3 ${res.parity ? 'border-orange-300 bg-orange-50' : 'border-emerald-200 bg-emerald-50'}`}>
                <div className="text-xs text-slate-500">Overall Parity q（8 位）</div>
                <div className="font-mono text-2xl font-bold">{res.parity}</div>
                <div className="text-xs">{res.parity ? '奇 Odd' : '偶 Even'}（1 的個數 = {weight(so.r8)}）</div>
              </div>
              <motion.div key={res.case} initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="rounded-xl border-2 border-slate-900 p-3">
                <div className="text-xs text-slate-500">判斷</div>
                <div className="text-lg font-bold">{cur.zh}</div>
                <StatusBadge status={so.success ? cur.status : res.uncorrectable ? 'detected' : 'wrong'} zh={res.uncorrectable ? 'Uncorrectable Error' : !so.success ? '誤判' : undefined} />
              </motion.div>
            </div>
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold text-slate-500">解碼器輸出</div>
              <BitStrip bits={res.output} states={outStates} groups={false} />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${res.uncorrectable ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Flag className="h-4 w-4" /> Uncorrectable Error 旗標 = {res.uncorrectable ? 1 : 0}
                </span>
                <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold ${res.case !== 'no-error' ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <Flag className="h-4 w-4" /> Error Detected 旗標 = {res.case !== 'no-error' ? 1 : 0}
                </span>
                {res.uncorrectable && <span className="text-sm text-orange-800">接收資料原樣保留（未做任何翻轉），由上層決定如何處理。</span>}
              </div>
            </div>
            {so.errorCount >= 3 && (
              <div className="mt-3">
                <Callout kind="warning" title={`${so.errorCount} 個錯誤：超出 SECDED 的保證`}>
                  <p>四種判斷只在「至多 2 個錯誤」時可靠。現在的判斷是「{cur.zh}」，{so.success ? '剛好結果正確，但這不是保證。' : res.uncorrectable ? '剛好被當成雙錯偵測到，但這不是保證。' : '而且做出了錯誤的更正。'}</p>
                </Callout>
              </div>
            )}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div className="mb-1 font-semibold">同樣的錯誤，交給普通 Hamming(7,4)（只看前 7 位）：</div>
              <span className="mono">{plain.decode.corrected.join('')}</span>，訊息 <span className="mono">{plain.decode.message.join('')}</span>{' '}
              <StatusBadge status={outcomeStatus(plain).status} zh={outcomeStatus(plain).zh} />
            </div>
          </Card>
        ),
      }}
      verify={{
        title: '對目前訊息的窮舉驗證',
        body: (
          <>
            <Checks
              items={[
                { label: <>延伸 codeword {c8.join('')} 中 1 的個數為偶數</>, pass: weight(c8) % 2 === 0 },
                { label: <>8 種單錯（含位置 8 的 P）全部更正</>, pass: singles.every((x) => x.success) },
                { label: <>28 種雙錯全部判為「雙重錯誤」、不更正、資料保留</>, pass: doubles.every((x) => x.result.case === 'double' && x.result.uncorrectable && x.result.output.join('') === x.r8.join('')) },
                { label: <>超出保證的反例存在：56 種三錯中有 {tripleWrong} 種被誤判</>, pass: tripleWrong > 0, detail: '（說明保證只到 2 個錯誤）' },
              ]}
            />
            <Callout kind="misconception" title="SECDED 不能偵測所有多位元錯誤">
              <p>
                三個錯誤是奇數個，q = 1，看起來像單錯，解碼器會「更正」某一位；四個錯誤甚至可能讓 S = 0、q = 0（重量 4 的延伸 codeword）。SECDED 的承諾是：<strong>1 個錯必更正、2 個錯必偵測</strong>，僅此而已。
              </p>
            </Callout>
          </>
        ),
      }}
      next={
        <p>
          我們一直用 n = 7 的小例子。實際系統用的 Hamming 碼長得多，例如 GF(128) 上的 Hamming(127,120)。下一章比較小例子與實際參數的差距，並介紹硬體架構與 400ZR 光通訊中的 Hamming 內碼。
        </p>
      }
    />
  );
}
