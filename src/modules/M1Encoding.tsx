import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Shuffle, Trophy } from 'lucide-react';
import { type Bit, H74, K4, LAYOUT_74, N7, PARITY_CHECKS, column, encode74ByParity, intToBits, isCodeword74 } from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitCell, BitRow, MessageInput, RoleLegend } from '../components/Bits';
import { Venn } from '../components/Venn';
import { CodeSizeTable, MessageSizeLab } from '../components/WhySevenFour';
import { Callout, Card, Derivation, Expandable, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, StatusBadge } from '../components/Lesson';

const ID = 'encode';
const BUILD_STEPS = ['放入資料位元', '計算 P1', '計算 P2', '計算 P4', '完成 codeword'];

/** ℓ = 3 checks (P1, P2, P4) for n = 7 positions and k = 4 data bits */
const L = PARITY_CHECKS.length;
const positionsOf = (role: 'data' | 'parity') =>
  LAYOUT_74.filter((p) => p.role === role)
    .map((p) => p.position)
    .join('、');
const DATA_POS = positionsOf('data');
const PARITY_POS = positionsOf('parity');
/** 'P1' → 'P_1' for KaTeX */
const sub = (label: string) => label.replace(/(\d)/, '_$1');
const EQS = PARITY_CHECKS.map((pc) => `${sub(pc.name)} = ${pc.dataTerms.map(sub).join(' \\oplus ')}`);
/** worked example: an error at position 5 fails the checks in column 5 of H, read P4 P2 P1 */
const ERR_POS = 5;
const ERR_COL = column(H74, ERR_POS - 1);
const READ = [...PARITY_CHECKS.keys()].reverse();
/** the order a binary position is written in: 'P4P2P1' */
const LAMP_ORDER = READ.map((i) => PARITY_CHECKS[i].name).join('');
const bin = (j: number) => j.toString(2).padStart(L, '0');
const ERR_WATCHERS = PARITY_CHECKS.filter((pc) => pc.covered.includes(ERR_POS - 1));

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
        <p>
          把 {K4} 個資料位元 <M>{'D_1D_2D_3D_4'}</M>（訊息 <M>m</M>）變成 {N7} 個位元的 codeword <M>c</M>。關鍵是：{L} 個同位位元各自檢查一組
          <strong>互相重疊</strong>的位置。
        </p>
      </ModuleHeader>
      <KeyPoint>發送端只用 XOR 算出 {L} 個同位位元：{L} 組檢查互相重疊，讓每個位置都被一組獨一無二的檢查盯著，錯在哪裡，失敗的組合就不同。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title={`一個檢查不夠，那就 ${L} 個，但要「重疊」`}>
          <Card title={`發送端算 ${L} 個 XOR，接收端重算 ${L} 組檢查`}>
            <div className="grid grid-cols-1 gap-3 text-sm leading-relaxed text-slate-700 md:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-data-300 bg-data-50/60 p-3">
                <div className="mb-1 font-bold text-data-700">發送端：多算 {L} 個同位位元</div>
                導論的一個同位位元只能說「有沒有奇數個錯」，說不出錯在哪。這一章讓發送端多算 {L} 個同位位元，每個都是幾個資料位元的 XOR：
                <div className="my-2 flex flex-wrap gap-x-5 gap-y-1">
                  {EQS.map((e) => (
                    <Tex key={e}>{e}</Tex>
                  ))}
                </div>
                {L} 個式子只用到資料位元、互不依賴，硬體上是 {L} 組 XOR 閘同時算完。
              </div>
              <div className="min-w-0 rounded-xl border border-parity-300 bg-parity-50/60 p-3">
                <div className="mb-1 font-bold text-parity-700">接收端：重算 {L} 組檢查</div>
                收到 {N7} 個位元後，接收端把同樣 {L} 組位置各數一次 1 的個數：就是下面 Venn 圖的 {L} 個圓，每個圓裡要有偶數個 1。每組檢查不是通過就是失敗；{L} 組都通過，就當作沒有錯。這{' '}
                {L} 組檢查，到了第 2 章就是接收端的 {L} 盞警示燈。
              </div>
            </div>
            <div className="mt-3 grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
              <p className="text-sm leading-relaxed text-slate-700">
                關鍵在「每個位置歸哪幾組檢查管」。Hamming 把位置編號 1–{N7} 寫成二進位，讓檢查 <M>{'P_b'}</M> 管二進位含有 <M>b</M> 的位置（
                <M>{'b = 1, 2, 4'}</M>）。於是位置 <M>j</M> 出錯時，失敗的檢查剛好是 <M>j</M> 的二進位裡的那幾個 1：把 P4、P2、P1 的「失敗／通過」讀成 1／0，
                <strong>失敗的檢查就拼出錯誤位置的編號</strong>
                ，接收端不用查表。
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3">
                <table className="text-center text-sm">
                  <tbody>
                    <tr className="font-semibold text-parity-700">
                      <td />
                      {READ.map((i) => (
                        <td key={i} className="px-1.5 sm:px-3">
                          {PARITY_CHECKS[i].name}
                        </td>
                      ))}
                      <td />
                    </tr>
                    <tr>
                      <td className="whitespace-nowrap pr-2 text-left sm:pr-3 text-slate-600">位置 {ERR_POS} 出錯</td>
                      {READ.map((i) => (
                        <td key={i} className={`whitespace-nowrap px-1.5 sm:px-3 ${ERR_COL[i] ? 'text-rose-600' : 'text-emerald-700'}`}>
                          {ERR_COL[i] ? '失敗' : '通過'}
                        </td>
                      ))}
                      <td />
                    </tr>
                    <tr className="font-mono font-bold">
                      <td className="whitespace-nowrap pr-2 text-left sm:pr-3 font-sans font-normal text-slate-600">讀成二進位</td>
                      {READ.map((i) => (
                        <td key={i} className="px-1.5 sm:px-3">
                          {ERR_COL[i]}
                        </td>
                      ))}
                      <td className="whitespace-nowrap pl-2 text-left font-normal">
                        <M>{`= ${bin(ERR_POS)}_2 = ${ERR_POS}`}</M>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </Stage>

        <Stage kind="definition" moduleId={ID} title={`位置寫成二進位，同位位元放在 ${PARITY_POS}`}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card title="位置排列（Positional layout）">
              <Tex block>{'[\\,P_1,\\ P_2,\\ D_1,\\ P_4,\\ D_2,\\ D_3,\\ D_4\\,]'}</Tex>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>
                  <M>{'P_b'}</M> 管二進位含有 <M>b</M> 的位置：每個位置被一組不同的檢查管到，錯在哪裡，失敗的組合就不同（第 2 章 H 的設計 ②）；而且失敗的組合讀成二進位，就直接是出錯位置的編號（H 的設計 ④）。
                </li>
                <li>位置 {PARITY_POS}（2 的冪次）放同位位元：它們的二進位只有一個 1，所以每個同位位元只在自己那一組檢查裡，可以直接用資料位元算出來（第 2 章 H 的設計 ⑤）。</li>
                <li>位置 {DATA_POS} 依序放資料位元（Data bits）：資料原封不動，接收端拿掉同位位元就是原訊息（第 2 章 G 的設計 ②）。</li>
                <li>偶同位（Even parity）：每組檢查涵蓋的位元（含同位位元本身）總和 mod 2 為 0，也就是有偶數個 1。沒有錯時每組都通過，所以「全部通過」留給「沒有錯」，接收端把它當作沒有錯（但錯誤剛好讓每組都回到偶數個 1 時，也會全部通過，見第 3 章）。</li>
              </ul>
              <p className="mt-2 text-sm text-slate-500">
                這幾個選擇在
                <a href="#/matrix" className="mx-1 font-semibold text-overall-700 hover:underline">
                  第 2 章
                </a>
                會寫成 H 與 G 的設計，再看換成別的做法會壞在哪裡。
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
                      <th className="pb-1 text-left font-normal leading-tight">
                        二進位
                        <div className="font-mono text-[10px]">{LAMP_ORDER}</div>
                      </th>
                      {LAYOUT_74.map((p) => (
                        <th key={p.index} className="pb-1 font-mono font-normal">
                          {bin(p.position)}
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
                例：位置 {ERR_POS} = <span className="mono">{bin(ERR_POS)}</span>₂，含有 {ERR_WATCHERS.map((pc) => pc.bitValue).join(' 與 ')}，所以被{' '}
                {ERR_WATCHERS.map((pc) => pc.name).join(' 與 ')} 檢查。
              </p>
              <div className="mt-3">
                <Expandable title="每個位置的檢查組合 = 它的二進位編號">
                  <p>
                    位置 1–{N7} 的二進位 {bin(1)}, {bin(2)}, …, {bin(N7)} 恰好是所有非零的 {L} 位元字串，而且兩兩不同。位置 <M>j</M> 被 <M>{'P_b'}</M> 覆蓋 ⇔ <M>j</M> 的二進位含有{' '}
                    <M>b</M>（<M>{'b = 1, 2, 4'}</M> 依序對應最低位、第二位、第三位），因此「覆蓋 <M>j</M> 的檢查集合」就是 <M>j</M> 的二進位：不同位置自然得到不同的集合。
                  </p>
                </Expandable>
              </div>
            </Card>
          </div>
        </Stage>

        <Stage kind="calculation" moduleId={ID} title={`用 mod 2 計算 ${L} 個同位位元`}>
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
                  {
                    title: '寫下偶同位條件',
                    body: <Tex block>{'c_1 + c_3 + c_5 + c_7 = 0'}</Tex>,
                  },
                  {
                    title: '代入位置名稱',
                    body: <Tex block>{'P_1 + D_1 + D_2 + D_4 = 0'}</Tex>,
                  },
                  {
                    title: '移項（mod 2 中減法 = 加法）',
                    body: <Tex block>{'P_1 = D_1 + D_2 + D_4'}</Tex>,
                  },
                  {
                    title: '同理得到 P2、P4',
                    body: <Tex block>{'\\begin{aligned}P_2 &= D_1 + D_3 + D_4\\\\ P_4 &= D_2 + D_3 + D_4\\end{aligned}'}</Tex>,
                  },
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
                  {
                    title: '組合成 codeword',
                    body: <Tex block>{`c = [P_1,P_2,D_1,P_4,D_2,D_3,D_4] = ${enc.codeword.join('')}`}</Tex>,
                  },
                ]}
              />
            }
          />
        </Stage>

        <Stage kind="visualization" moduleId={ID} title="Venn 圖：每個圓圈都必須有偶數個 1">
          <LabGrid
            main={
              <Card title={`${L} 個同位檢查的集合關係`}>
                <Venn word={enc.codeword} focusCircle={focus} onFocusCircle={setFocus} />
                <p className="mt-2 text-center text-xs text-slate-500">每個區域恰好對應一個位置：在哪些圓圈內 ⇔ 位置的二進位表示含哪些 1、2、4。</p>
              </Card>
            }
            aside={
              <Card title="逐步組裝 codeword">
                <div className="mb-3 flex flex-wrap gap-1">
                  {BUILD_STEPS.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => setBuild(i)}
                      className={`chip border ${build === i ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-500'}`}
                    >
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
                  {build === 0 && <p>先把 D1–D4 放進位置 {DATA_POS}。同位位元暫時未知（?）。</p>}
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
                title={`點擊 Venn 圖中的 ${PARITY_CHECKS.map((pc) => pc.name).join('、')}，讓 ${L} 個圓圈都變成偶數`}
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
                  資料位元已固定為 <span className="mono font-semibold text-data-600">{challengeMsg.join('')}</span>
                  。只有同位位元可以點擊。
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
              <Misconceptions
                items={[
                  {
                    wrong: '同位位元只檢查資料位元，自己不算在內。',
                    right: '偶同位的條件是「整個圓圈（含同位位元本身）有偶數個 1」，所以 P1 = D1⊕D2⊕D4。',
                  },
                  {
                    wrong: '⊕ 就是一般加法，1⊕1 = 2。',
                    right: '這裡的加法是 mod 2：1 + 1 = 2 ≡ 0，不進位，只在乎奇偶。',
                  },
                  {
                    wrong: '同位位元一定放在資料後面。',
                    right: `不一定。第一課把同位位元放在位置 ${PARITY_POS}，資料位元原封不動地放在 ${DATA_POS}：接收端拿掉同位位元就是原訊息，所以它本來就是系統碼（systematic code；第 2 章 G 的設計 ②）。第二課把資料位元排在前面、同位位元排在後面（[D | P]），兩者只差位置的排列，是等價的 code。`,
                  },
                ]}
              />
            }
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title={`發送端 ${L} 組 XOR 閘，接收端 ${L} 盞警示燈`}>
          <Callout kind="key" title="結論">
            <p>
              Hamming({N7},{K4}) 的編碼只用到 XOR：
              {EQS.map((e, i) => (
                <span key={e}>
                  {i > 0 && '、'}
                  <M>{e}</M>
                </span>
              ))}
              。發送端就是 {L} 組 XOR 閘。接收端把同樣 {L} 組位置再 XOR 一次，每組接一盞<strong>警示燈</strong>：沒有錯時燈全暗；位置 <M>j</M> 出錯時，亮的燈按 P4、P2、P1
              讀成二進位，就是 <M>j</M>。
            </p>
            <p>
              這 {L} 個式子對資料是<strong>線性</strong>
              的：下一章把發送端的接線寫成 G、接收端的警示燈寫成 H。
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
