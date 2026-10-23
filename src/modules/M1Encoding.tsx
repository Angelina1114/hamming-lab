import { useMemo, useState } from 'react';
import { Shuffle, Trophy } from 'lucide-react';
import { type Bit, DATA_INDICES, H74, K4, LAYOUT_74, N7, PARITY_CHECKS, column, encode74ByParity, intToBits, isCodeword74 } from '../core';
import { useMessage } from '../lib/store';
import { Tex, M } from '../components/Tex';
import { BitRow, MessageInput, RoleLegend } from '../components/Bits';
import { Venn } from '../components/Venn';
import { CodeSizeTable, MessageSizeLab } from '../components/WhySevenFour';
import { Callout, Card, Derivation, Expandable, FlowBar, KeyPoint, LabGrid, Misconceptions, ModuleHeader, PrevNext, ResetButton, Stage, StatusBadge } from '../components/Lesson';

const ID = 'encode';

/** ℓ = 3 checks (P1, P2, P4) for n = 7 positions and k = 4 data bits */
const L = PARITY_CHECKS.length;
const positionsOf = (role: 'data' | 'parity') =>
  LAYOUT_74.filter((p) => p.role === role)
    .map((p) => p.position)
    .join('、');
const DATA_POS = positionsOf('data');
const PARITY_POS = positionsOf('parity');
const PARITY_NAMES = PARITY_CHECKS.map((pc) => pc.name).join('、');
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
const FAILED = READ.filter((i) => ERR_COL[i]).map((i) => PARITY_CHECKS[i].name);
const PASSED = READ.filter((i) => !ERR_COL[i]).map((i) => PARITY_CHECKS[i].name);
/** the first check over the whole codeword (its own parity bit included), and what it rearranges to */
const P1_SUM = `${PARITY_CHECKS[0].covered.map((i) => `c_${i + 1}`).join(' + ')} = 0`;
/** the three questions the chapter answers, and the stage that answers each */
const QUESTIONS: [string, string][] = [
  ['每個檢查管哪些位置', '設計'],
  ['parity bit 放在哪裡', '設計'],
  ['發送端怎麼只用 XOR 算出 parity bit', '推導'],
];

export default function M1Encoding() {
  const { message, toggleBit, resetMessage } = useMessage();
  const enc = useMemo(() => encode74ByParity(message), [message]);
  const [focus, setFocus] = useState<number | null>(null);

  // "you are the encoder" challenge: the data bits are fixed, only the parity bits can be clicked
  const [challengeMsg, setChallengeMsg] = useState<Bit[]>([0, 1, 1, 0]);
  const [guess, setGuess] = useState<Bit[]>([0, 0, 0]);
  const challengeWord: Bit[] = useMemo(
    () =>
      LAYOUT_74.map((p) => {
        const k = PARITY_CHECKS.findIndex((pc) => pc.parityIndex === p.index);
        return k >= 0 ? guess[k] : challengeMsg[DATA_INDICES.indexOf(p.index as (typeof DATA_INDICES)[number])];
      }),
    [guess, challengeMsg],
  );
  const solved = isCodeword74(challengeWord);

  const pTex = (k: number) => {
    const p = enc.parities[k];
    return `${sub(p.name)} = ${p.terms.map((t) => sub(t.label)).join(' \\oplus ')} = ${p.terms.map((t) => t.value).join(' \\oplus ')} = ${p.value}`;
  };

  return (
    <div>
      <ModuleHeader moduleId={ID}>
        <p>
          把 {K4} 個 data bit <M>{'D_1D_2D_3D_4'}</M>（訊息 <M>m</M>）變成 {N7} 個位元的 codeword <M>c</M>。
        </p>
      </ModuleHeader>
      <KeyPoint>把位置編號寫成二進位來分配檢查：發送端只用 {L} 組 XOR 補上 parity bit；哪個位置出錯，失敗的檢查讀成二進位就是它的編號。</KeyPoint>
      <FlowBar moduleId={ID} />

      <div className="space-y-12">
        <Stage kind="why" moduleId={ID} title={`導論的 ${L} 個檢查，各管哪些位置？`}>
          <Card>
            <p className="text-sm leading-relaxed text-slate-700">
              <a href="#/intro" className="font-semibold text-overall-700 hover:underline">
                導論
              </a>
              的實驗：{L} 個互相重疊的檢查，才讓每個位置都有自己的失敗組合。這一章把它做成 Hamming({N7},{K4})，決定三件事：
            </p>
            <ol className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
              {QUESTIONS.map(([q, stage], i) => (
                <li key={q} className="flex items-baseline gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="font-bold text-slate-400">{'①②③'[i]}</span>
                  <span className="flex-1 text-slate-800">{q}</span>
                  <span className="shrink-0 text-xs text-slate-400">→ {stage}</span>
                </li>
              ))}
            </ol>
          </Card>
        </Stage>

        <Stage kind="definition" moduleId={ID} title={`位置寫成二進位，parity bit 放在 ${PARITY_POS}`}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <Card
              title={
                <span>
                  覆蓋表（Coverage table）：<M>{'P_b'}</M> 管二進位含有 <M>b</M> 的位置（<M>{`b = ${PARITY_CHECKS.map((pc) => pc.bitValue).join(', ')}`}</M>）
                </span>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[340px] text-center text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="py-1 text-left">位置 j</th>
                      {LAYOUT_74.map((p) => (
                        <th key={p.index} className={`rounded-t-md py-1 ${p.position === ERR_POS ? 'bg-rose-50' : ''} ${p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}`}>
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
                        <th key={p.index} className={`pb-1 font-mono ${p.position === ERR_POS ? 'bg-rose-50 font-bold text-rose-700' : 'font-normal'}`}>
                          {bin(p.position)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PARITY_CHECKS.map((pc, k) => (
                      <tr key={pc.name} onMouseEnter={() => setFocus(k)} onMouseLeave={() => setFocus(null)} className={`cursor-default border-t border-slate-100 ${focus === k ? 'bg-amber-50' : ''}`}>
                        <td className="py-1.5 text-left font-semibold text-parity-700">{pc.name}</td>
                        {LAYOUT_74.map((p) => {
                          const err = p.position === ERR_POS;
                          return (
                            <td key={p.index} className={`py-1.5 ${err ? 'bg-rose-50' : ''}`}>
                              {pc.covered.includes(p.index) ? <span className={`inline-block h-2.5 w-2.5 rounded-full ${err ? 'bg-rose-500' : 'bg-parity-500'}`} /> : <span className="text-slate-200">·</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-700">
                位置 {ERR_POS} = <span className="mono">{bin(ERR_POS)}</span>₂，由 {FAILED.join('、')} 管 → 它出錯時 {FAILED.join('、')} 失敗、{PASSED.join('、')} 通過 → 讀成 {LAMP_ORDER} ={' '}
                <span className="mono font-semibold text-rose-700">{bin(ERR_POS)}</span>₂ = {ERR_POS}。每一欄都一樣：<strong>失敗的檢查讀成二進位，就是出錯位置的編號</strong>，不用查表。
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
            <Card title="位置排列（Positional layout）">
              <Tex block>{`[\\,${LAYOUT_74.map((p) => sub(p.label)).join(',\\ ')}\\,]`}</Tex>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
                <li>位置 {PARITY_POS}（2 的冪次）放 parity bit：二進位只有一個 1，所以只在自己那組檢查裡，直接用 data bit 算。</li>
                <li>位置 {DATA_POS} 依序放 data bit：拿掉 parity bit 就是原訊息。</li>
                <li>Even parity：每組檢查（含 parity bit 自己）要有偶數個 1；全部通過 = 沒有錯。</li>
              </ul>
              <p className="mt-2 text-sm text-slate-500">
                <a href="#/matrix" className="mr-1 font-semibold text-overall-700 hover:underline">
                  第 2 章
                </a>
                把這些選擇寫成 H 與 G 的設計。
              </p>
              <div className="mt-3">
                <RoleLegend />
              </div>
            </Card>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">
            {N7} 欄剛好用完 {bin(1)}–{bin(2 ** L - 1)} 這 {2 ** L - 1} 個非零的 {L} 位元字串：導論算過，{L} 個 parity bit 最多配 {K4} 個 data bit。資料更少呢？
          </p>
          <MessageSizeLab />
          <CodeSizeTable />
        </Stage>

        <Stage kind="calculation" moduleId={ID} title={`用 mod 2 算出 ${L} 個 parity bit`}>
          <LabGrid
            main={
              <>
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
                <Card
                  title={`換你當 encoder（編碼器）：點 ${PARITY_NAMES}，讓 ${L} 個圓圈都變成偶數`}
                  actions={
                    <>
                      <button
                        className="btn-ghost"
                        onClick={() => {
                          let m: Bit[];
                          do m = intToBits(Math.floor(Math.random() * 2 ** K4), K4);
                          while (m.join('') === challengeMsg.join(''));
                          setChallengeMsg(m);
                          setGuess(Array<Bit>(L).fill(0));
                        }}
                      >
                        <Shuffle className="h-3.5 w-3.5" /> 新題目
                      </button>
                      <ResetButton
                        onClick={() => {
                          setChallengeMsg([0, 1, 1, 0]);
                          setGuess(Array<Bit>(L).fill(0));
                        }}
                      />
                    </>
                  }
                >
                  <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
                    <Venn
                      word={challengeWord}
                      onToggle={(i) => {
                        const k = PARITY_CHECKS.findIndex((pc) => pc.parityIndex === i);
                        if (k >= 0) setGuess((g) => g.map((b, j) => (j === k ? ((1 - b) as Bit) : b)));
                      }}
                    />
                    <div className="space-y-3 text-sm text-slate-600">
                      <p>
                        data bit 固定為 <span className="mono font-semibold text-data-600">{challengeMsg.join('')}</span>，只能點 parity bit。每一格是一個位置，它在哪幾個圓裡，就是它的二進位。
                      </p>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="mono text-lg font-bold text-slate-900">{challengeWord.join('')}</span>
                        {solved ? (
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white">
                            <Trophy className="h-4 w-4" /> 正確！這是合法 codeword
                          </span>
                        ) : (
                          <StatusBadge status="detected" zh="還有圓圈是奇數" en="Not a codeword yet" />
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </>
            }
            aside={
              <>
                <Derivation
                  defaultOpen
                  resetKey={message.join('')}
                  steps={[
                    {
                      title: '寫下 even parity 條件',
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
                <Misconceptions
                  items={[
                    {
                      wrong: '每個 parity bit 只檢查 data bit，自己不算在內。',
                      right: (
                        <>
                          {PARITY_CHECKS[0].name} 也在圓 {PARITY_CHECKS[0].name} 裡：<M>{P1_SUM}</M>，移項才得到 <M>{EQS[0]}</M>。
                        </>
                      ),
                    },
                  ]}
                />
              </>
            }
          />
        </Stage>

        <Stage kind="conclusion" moduleId={ID} title={`發送端 ${L} 組 XOR 閘，接收端 ${L} 盞警示燈`}>
          <Callout kind="key" title="結論">
            <ul className="list-disc space-y-1 pl-5">
              <li>
                發送端只用 XOR：
                {EQS.map((e, i) => (
                  <span key={e}>
                    {i > 0 && '、'}
                    <M>{e}</M>
                  </span>
                ))}
                。
              </li>
              <li>
                位置寫成二進位，<M>{'P_b'}</M> 管含有 <M>b</M> 的位置；parity bit 放在 {PARITY_POS}，data bit 放在 {DATA_POS}。
              </li>
              <li>
                位置 <M>j</M> 出錯 → 失敗的檢查讀成 {LAMP_ORDER}，就是 <M>j</M>。
              </li>
              <li>
                每組檢查（含 parity bit 自己）都是偶數個 1；{L} 個 parity bit 剛好配 {K4} 個 data bit。
              </li>
              <li>
                {L} 組檢查都是線性的：
                <a href="#/matrix" className="mx-1 font-semibold text-overall-700 hover:underline">
                  第 2 章
                </a>
                寫成 G 與 H，也就是 {L} 盞警示燈。
              </li>
            </ul>
          </Callout>
        </Stage>
      </div>
      <PrevNext moduleId={ID} />
    </div>
  );
}
