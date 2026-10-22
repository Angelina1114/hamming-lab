import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shuffle, Trophy } from 'lucide-react';
import { type Bit, LAYOUT_74, PARITY_CHECKS, encode74ByParity, intToBits, isCodeword74 } from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitCell, BitRow, MessageInput, RoleLegend } from '../components/Bits';
import { Venn } from '../components/Venn';
import { CodeSizeTable, MessageSizeLab } from '../components/WhySevenFour';
import { Callout, Card, Derivation, Expandable, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, StatusBadge } from '../components/Lesson';

const ID = 'encode';
const BUILD_STEPS = ['放入資訊位元', '計算 P1', '計算 P2', '計算 P4', '完成 codeword'];

export default function M1Encoding() {
  const { message, toggleBit, resetMessage } = useMessage();
  const enc = useMemo(() => encode74ByParity(message), [message]);
  const [focus, setFocus] = useState<number | null>(null);
  const [build, setBuild] = useState(0);

  // "you are the encoder" challenge
  const [challengeMsg, setChallengeMsg] = useState<Bit[]>([0, 1, 1, 0]);
  const [guess, setGuess] = useState<Bit[]>([0, 0, 0]);
  const challengeWord: Bit[] = useMemo(() => {
    const w: Bit[] = [guess[0], guess[1], challengeMsg[0], guess[2], challengeMsg[1], challengeMsg[2], challengeMsg[3]];
    return w;
  }, [guess, challengeMsg]);
  const solved = isCodeword74(challengeWord);

  // word shown in the build animation
  const buildWord: (Bit | null)[] = enc.codeword.map((b, i) => {
    if (LAYOUT_74[i].role === 'data') return b;
    const k = PARITY_CHECKS.findIndex((pc) => pc.parityIndex === i);
    return build >= k + 1 ? b : null;
  });

  const pTex = (k: number) => {
    const p = enc.parities[k];
    return `${p.name.replace(/(\d)/, '_$1')} = ${p.terms.map((t) => t.label.replace(/(\d)/, '_$1')).join(' \\oplus ')} = ${p.terms.map((t) => t.value).join(' \\oplus ')} = ${p.value}`;
  };

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>把 4 個資訊位元 <M>{'D_1D_2D_3D_4'}</M> 變成 7 個位元的 codeword。關鍵是：3 個同位位元各自檢查一組<strong>互相重疊</strong>的位置。</p>
      </ModuleHeader>
      <KeyPoint>發送端只用 XOR 算出 3 個同位位元：3 組檢查互相重疊，讓每個位置都被一組獨一無二的檢查盯著，錯在哪裡，失敗的組合就不同。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title="一個檢查不夠，那就三個，但要「重疊」">
          <div className="prose-lab">
            <p>
              導論中我們看到：一個同位位元只能告訴我們「有沒有奇數個錯誤」。Hamming 的想法是讓每個位置都被一組<strong>不同的</strong>同位檢查覆蓋。
              錯誤發生時，「哪些檢查失敗」就像一串二進位數字，直接寫出錯誤的位置。
            </p>
            <p>
              要讓這件事成立，最自然的安排是：把位置編號 1 到 7 寫成二進位，檢查 <M>{'P_b'}</M> 負責「二進位表示中含有 <M>b</M>」的所有位置（<M>{'b = 1, 2, 4'}</M>）。
            </p>
          </div>
        </Stage>

        <Stage kind="definition" moduleId={ID} title="標準位置排列與偶同位">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="位置排列（Positional layout）">
              <Tex block>{'[\\,P_1,\\ P_2,\\ D_1,\\ P_4,\\ D_2,\\ D_3,\\ D_4\\,]'}</Tex>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>位置 1, 2, 4（2 的冪次）放同位位元（Parity bits）。</li>
                <li>位置 3, 5, 6, 7 依序放資訊位元（Information bits）。</li>
                <li>偶同位（Even parity）：每個檢查涵蓋的位元（含同位位元本身）總和 mod 2 為 0，也就是有偶數個 1。</li>
              </ul>
              <p className="mt-2 text-sm text-slate-500">
                同位位元放在 1、2、4 的理由，
                <a href="#/matrix" className="mx-1 font-semibold text-overall-700 hover:underline">
                  第 2 章
                </a>
                會從 H 的設計說明。
              </p>
              <div className="mt-3">
                <RoleLegend />
              </div>
            </Card>
            <Card title="覆蓋表（Coverage table）：滑過列可高亮">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[340px] text-center text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="py-1 text-left">位置 j</th>
                      {LAYOUT_74.map((p) => (
                        <th key={p.index} className={`py-1 ${p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}`}>
                          {p.position}
                          <div className="text-[10px] font-normal">{p.label}</div>
                        </th>
                      ))}
                    </tr>
                    <tr className="text-[11px] text-slate-400">
                      <th className="pb-1 text-left font-normal">二進位</th>
                      {LAYOUT_74.map((p) => (
                        <th key={p.index} className="pb-1 font-mono font-normal">
                          {p.position.toString(2).padStart(3, '0')}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PARITY_CHECKS.map((pc, k) => (
                      <tr
                        key={pc.name}
                        onMouseEnter={() => setFocus(k)}
                        onMouseLeave={() => setFocus(null)}
                        className={`cursor-default border-t border-slate-100 ${focus === k ? 'bg-amber-50' : ''}`}
                      >
                        <td className="py-1.5 text-left font-semibold text-parity-700">{pc.name}</td>
                        {LAYOUT_74.map((p) => (
                          <td key={p.index} className="py-1.5">
                            {pc.covered.includes(p.index) ? <span className="inline-block h-2.5 w-2.5 rounded-full bg-parity-500" /> : <span className="text-slate-200">·</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                例：位置 5 = <span className="mono">101</span>₂，含有 1 與 4，所以被 P1 與 P4 檢查。
              </p>
            </Card>
          </div>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title="用 mod 2 計算三個同位位元">
          <LabGrid
            main={
              <Card title="點擊 D1–D4 改變原始資料" actions={<ResetButton onClick={resetMessage} />}>
                <div className="flex flex-wrap items-end gap-6">
                  <MessageInput message={message} onToggle={toggleBit} />
                  <div className="text-2xl text-slate-300">→</div>
                  <BitRow bits={enc.codeword} layout={LAYOUT_74} states={LAYOUT_74.map((p) => (focus !== null && !PARITY_CHECKS[focus].covered.includes(p.index) ? 'dim' : 'normal'))} />
                </div>
                <div className="mt-5 space-y-2">
                  {PARITY_CHECKS.map((pc, k) => (
                    <div
                      key={pc.name}
                      onMouseEnter={() => setFocus(k)}
                      onMouseLeave={() => setFocus(null)}
                      className={`rounded-lg border px-3 py-2 transition-colors ${focus === k ? 'border-parity-300 bg-parity-50' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <Tex>{pTex(k)}</Tex>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-600">
                  訊息 <span className="mono font-semibold text-data-600">{message.join('')}</span> 編碼為合法 codeword{' '}
                  <span className="mono font-semibold">{enc.codeword.join('')}</span>。
                </p>
              </Card>
            }
            aside={
              <Derivation
                defaultOpen
                resetKey={message.join('')}
                steps={[
                  { title: '寫下偶同位條件', body: <Tex block>{'c_1 + c_3 + c_5 + c_7 = 0'}</Tex> },
                  { title: '代入位置名稱', body: <Tex block>{'P_1 + D_1 + D_2 + D_4 = 0'}</Tex> },
                  { title: '移項（mod 2 中減法 = 加法）', body: <Tex block>{'P_1 = D_1 + D_2 + D_4'}</Tex> },
                  { title: '同理得到 P2、P4', body: <Tex block>{'\\begin{aligned}P_2 &= D_1 + D_3 + D_4\\\\ P_4 &= D_2 + D_3 + D_4\\end{aligned}'}</Tex> },
                  {
                    title: `代入目前的資料 ${message.join('')}`,
                    body: (
                      <div className="space-y-1">
                        {[0, 1, 2].map((k) => (
                          <Tex key={k} block>
                            {pTex(k)}
                          </Tex>
                        ))}
                      </div>
                    ),
                  },
                  { title: '組合成 codeword', body: <Tex block>{`c = [P_1,P_2,D_1,P_4,D_2,D_3,D_4] = ${enc.codeword.join('')}`}</Tex> },
                ]}
              />
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="Venn 圖：每個圓圈都必須有偶數個 1">
          <LabGrid
            main={
              <Card title="三個同位檢查的集合關係">
                <Venn word={enc.codeword} focusCircle={focus} onFocusCircle={setFocus} />
                <p className="mt-2 text-center text-xs text-slate-500">每個區域恰好對應一個位置：在哪些圓圈內 ⇔ 位置的二進位表示含哪些 1、2、4。</p>
              </Card>
            }
            aside={
              <Card title="逐步組裝 codeword">
                <div className="mb-3 flex flex-wrap gap-1">
                  {BUILD_STEPS.map((s, i) => (
                    <button key={s} onClick={() => setBuild(i)} className={`chip border ${build === i ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500'}`}>
                      {i + 1}. {s}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {buildWord.map((b, i) => {
                    const k = PARITY_CHECKS.findIndex((pc) => pc.parityIndex === i);
                    const justComputed = k >= 0 && build === k + 1;
                    const involved = build >= 1 && build <= 3 && PARITY_CHECKS[build - 1].covered.includes(i);
                    return (
                      <BitCell
                        key={i}
                        value={b}
                        role={LAYOUT_74[i].role}
                        label={LAYOUT_74[i].label}
                        size="sm"
                        state={justComputed ? 'highlight' : build >= 1 && build <= 3 && !involved ? 'dim' : 'normal'}
                      />
                    );
                  })}
                </div>
                <motion.div key={build} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 min-h-[48px] text-sm text-slate-700">
                  {build === 0 && <p>先把 D1–D4 放進位置 3, 5, 6, 7。同位位元暫時未知（?）。</p>}
                  {build >= 1 && build <= 3 && <Tex>{pTex(build - 1)}</Tex>}
                  {build === 4 && (
                    <p>
                      完成！合法 codeword <span className="mono font-bold">{enc.codeword.join('')}</span>。
                    </p>
                  )}
                </motion.div>
                <div className="mt-3 flex gap-2">
                  <button className="btn-ghost" disabled={build === 0} onClick={() => setBuild((b) => b - 1)}>
                    <ChevronLeft className="h-4 w-4" /> 上一步
                  </button>
                  <button className="btn-primary" disabled={build === 4} onClick={() => setBuild((b) => b + 1)}>
                    下一步 <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </Card>
            }
          />
        </Stage>

        <Stage kind="experiment" moduleId={ID} title="換你當編碼器">
          <LabGrid
            main={
              <Card
                title="點擊 Venn 圖中的 P1、P2、P4，讓三個圓圈都變成偶數"
                actions={
                  <>
                    <button
                      className="btn-ghost"
                      onClick={() => {
                        let m: Bit[];
                        do m = intToBits(Math.floor(Math.random() * 16), 4);
                        while (m.join('') === challengeMsg.join(''));
                        setChallengeMsg(m);
                        setGuess([0, 0, 0]);
                      }}
                    >
                      <Shuffle className="h-3.5 w-3.5" /> 新題目
                    </button>
                    <ResetButton
                      onClick={() => {
                        setChallengeMsg([0, 1, 1, 0]);
                        setGuess([0, 0, 0]);
                      }}
                    />
                  </>
                }
              >
                <p className="mb-1 text-sm text-slate-600">
                  資訊位元已固定為 <span className="mono font-semibold text-data-600">{challengeMsg.join('')}</span>。只有同位位元可以點擊。
                </p>
                <Venn
                  word={challengeWord}
                  onToggle={(i) => {
                    const k = [0, 1, 3].indexOf(i);
                    if (k >= 0) setGuess((g) => g.map((b, j) => (j === k ? ((1 - b) as Bit) : b)));
                  }}
                />
                <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
                  <span className="mono text-lg font-bold">{challengeWord.join('')}</span>
                  {solved ? (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white">
                      <Trophy className="h-4 w-4" /> 正確！這是合法 codeword
                    </span>
                  ) : (
                    <StatusBadge status="detected" zh="還有圓圈是奇數" en="Not a codeword yet" />
                  )}
                </div>
              </Card>
            }
            aside={
              <>
                <Misconceptions
                  items={[
                    { wrong: '同位位元只檢查資訊位元，自己不算在內。', right: '偶同位的條件是「整個圓圈（含同位位元本身）有偶數個 1」，所以 P1 = D1⊕D2⊕D4。' },
                    { wrong: '⊕ 就是一般加法，1⊕1 = 2。', right: '這裡的加法是 mod 2：1 + 1 = 2 ≡ 0，不進位，只在乎奇偶。' },
                    {
                      wrong: '同位位元一定放在資料後面。',
                      right:
                        '不一定。第一課把同位位元放在位置 1, 2, 4，資訊位元原封不動地放在 3, 5, 6, 7：G 的第 3, 5, 6, 7 欄正好組成單位矩陣 I₄，所以它本來就是系統碼（systematic code），接收端拿掉同位位元就是原訊息。第二課的 [D | P]（c = u‖p）只是把資訊位元排在一起，兩者只差座標的排列，是等價的 code。',
                    },
                  ]}
                />
                <Expandable title="為什麼每個位置都被不同的檢查組合覆蓋？">
                  <p>位置 1–7 的二進位表示 001, 010, …, 111 恰好是所有非零的 3 位元字串，而且兩兩不同。位置 j 被 P_b 覆蓋 ⇔ j 的二進位表示含有 b（b = 1, 2, 4 依序對應最低位、第二位、第三位），因此「覆蓋 j 的檢查集合」就是 j 的二進位表示——不同位置自然得到不同的集合。</p>
                </Expandable>
              </>
            }
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title="編碼 = 三個 mod 2 線性方程">
          <Callout kind="key" title="結論">
            <p>
              Hamming(7,4) 的編碼只用到 XOR：<M>{'P_1 = D_1\\oplus D_2\\oplus D_4'}</M>、<M>{'P_2 = D_1\\oplus D_3\\oplus D_4'}</M>、<M>{'P_4 = D_2\\oplus D_3\\oplus D_4'}</M>。
              這三個式子對資料是<strong>線性</strong>的——下一章我們把它們寫成矩陣，用線性代數來理解整個 code。
            </p>
          </Callout>
          <MessageSizeLab />
          <CodeSizeTable />
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}
