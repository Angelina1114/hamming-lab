import { useState } from 'react';
import { type Bit, K4, N7, PARITY_CHECKS, codewords74, codewords84, correctionCapability, flipBit, minimumDistance, vecAdd } from '../../core';
import { useMessage } from '../../lib/store';
import { M, Tex } from '../../components/Tex';
import { BitRow } from '../../components/Bits';
import { LegalBars, ParityLab } from '../../components/ParityLab';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** ℓ = 3 checks, 7 positions, 4 data bits */
const L = PARITY_CHECKS.length;
const N = N7;
const K = K4;
/** 16 codewords out of 2⁷ = 128 strings */
const CODEWORDS = codewords74().length;
const D_MIN = minimumDistance(codewords74().map((x) => x.codeword)).dmin;
const T = correctionCapability(D_MIN);
/** SECDED (8,4): d_min = 4 ≥ T + DETECT + 1, so it corrects T and also detects DETECT errors */
const DETECT = minimumDistance(codewords84().map((x) => x.codeword)).dmin - 1 - T;
/** two checks: 2² − 1 failure patterns for k + 2 positions */
const TWO = { patterns: 2 ** (L - 1) - 1, positions: K + L - 1 };

/* ------------------------------------------------------------------ */
/* 標題頁                                                              */
/* ------------------------------------------------------------------ */

/** Lesson 1 in six parts: tag, chapter name (as in the web sidebar), one plain line on what it answers */
const AGENDA: [string, string, string][] = [
  ['導論', '', '雜訊會翻轉位元；一個 parity bit 只能發現錯'],
  ['第 1 章', '編碼', `位置編號寫成二進位，分配 ${L} 個檢查：Hamming(${N},${K})`],
  ['第 2 章', 'H 與 G', `發送端怎麼算出要送的 ${N} 個位元，接收端怎麼檢查`],
  ['第 3 章', 'Syndrome 解碼', '接收端看哪幾個檢查失敗，就知道該翻哪一位'],
  ['第 4 章', '能力與極限', `為什麼只保證修 ${T} 位；${L} 個檢查的 ${2 ** L} 種結果剛好用完`],
  ['第 5 章', 'SECDED', `錯 ${DETECT} 個時回報，不要改錯`],
];

/** one row of the title figure: blue data cells, orange parity cells, an optional purple P0 */
function BitBar({ overall = false }: { overall?: boolean }) {
  const cells = [
    ...Array.from({ length: K }, (_, i) => ({ label: `D${i + 1}`, tone: 'border-data-300 bg-data-50 text-data-700' })),
    ...Array.from({ length: L }, () => ({ label: 'P', tone: 'border-parity-300 bg-parity-50 text-parity-700' })),
    ...(overall ? [{ label: 'P0', tone: 'border-overall-300 bg-overall-50 text-overall-700' }] : []),
  ];
  return (
    <div className="flex gap-1.5">
      {cells.map((c, i) => (
        <span key={i} className={`grid h-11 w-11 place-items-center rounded-lg border-2 font-mono text-lg font-bold ${c.tone}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

function TitleSlide() {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <ol className="space-y-2 text-xl">
        {AGENDA.map(([tag, name, text], i) => (
          <li key={tag} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-base font-bold text-white">{i}</span>
            <span>
              <strong>
                {tag}
                {name && ` ${name}`}
              </strong>
              <span className="block text-lg text-slate-600">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <figure className="space-y-5 rounded-2xl bg-slate-50 p-5 text-xl leading-relaxed">
        <div className="space-y-2">
          <BitBar />
          <p>
            <span className="text-data-700">{K} 個 data bit（資料位元）</span> + <span className="text-parity-700">{L} 個用來檢查的 parity bit</span> = {N} 個位元：
            <strong>Hamming({N},{K})</strong>，修好任何 {T} 個錯
          </p>
        </div>
        <div className="space-y-2">
          <BitBar overall />
          <p>
            再多 1 個 <span className="text-overall-700">overall parity bit（整體同位位元）</span>：<strong>SECDED</strong>，修 {T} 個、偵測 {DETECT} 個
          </p>
        </div>
      </figure>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 導論：雜訊會翻轉位元                                                */
/* ------------------------------------------------------------------ */

/** the noise flips D2 when the slide opens; any bit can be flipped live */
const FIRST_HIT = 1;

function WhyCodesSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const [flips, setFlips] = useState<number[]>([FIRST_HIT]);
  const recv = message.map((b, i) => (flips.includes(i) ? ((b ^ 1) as Bit) : b));
  const k = message.length;
  return (
    <div className="space-y-4 text-xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_0.9fr_1.1fr]">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-rose-50 text-rose-950" title="問題：位元會被翻轉">
            <p>無線訊號干擾、記憶體裡的宇宙射線，都可能把 0 變 1、1 變 0。</p>
            <div className="my-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-lg text-slate-500">送出</span>
                <BitRow bits={message} plain size="lg" showPositions={false} />
              </div>
              <div className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-lg text-rose-700">收到</span>
                <BitRow
                  bits={recv}
                  plain
                  size="lg"
                  showPositions={false}
                  states={recv.map((_, i) => (flips.includes(i) ? 'error' : 'normal'))}
                  onToggle={(i) => setFlips(flips.includes(i) ? flips.filter((j) => j !== i) : [...flips, i])}
                />
              </div>
            </div>
            <p className="text-lg text-slate-600">
              {flips.length === 0 ? (
                <>
                  接收端收到 <span className="mono">{recv.join('')}</span>：看起來一切正常。
                </>
              ) : (
                <>
                  每個 {k} 位元字串都合法：<span className="mono">{recv.join('')}</span> 也是合法訊息，接收端完全看不出被改過。
                </>
              )}
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="目標：兩個層次">
            <ol className="space-y-2">
              <li className="rounded-xl border-l-4 border-sky-300 bg-white/70 px-3 py-2">
                <strong>① 偵測</strong>
                <div className="text-lg text-slate-600">知道「有錯」→ 要求重送</div>
              </li>
              <li className="rounded-xl border-l-4 border-sky-600 bg-white/70 px-3 py-2">
                <strong>② 更正</strong>
                <div className="text-lg text-slate-600">知道「錯在哪」→ 直接翻回來</div>
              </li>
            </ol>
            <p className="mt-2 text-lg text-slate-600">更正比偵測難：要先「定位」錯誤。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-emerald-50 text-emerald-950" title="唯一的工具：redundancy（冗餘）">
            <p>多送幾個位元：合法的還是 {2 ** k} 個，字串總數變多，出錯後很難剛好又落在合法字串上。</p>
            <div className="mt-2">
              <LegalBars />
            </div>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 導論：mod 2、同位位元、要幾個檢查                                    */
/* ------------------------------------------------------------------ */

function FlipSumSlide() {
  const { message } = useMessage();
  const [e, setE] = useState<Bit[]>([0, 1, 0, 0]);
  const r = vecAdd(message, e);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 text-xl">
        <p>雜訊只會「翻轉」位元。把翻轉寫成「加 1」、不動寫成「加 0」：</p>
        <table className="font-mono text-2xl">
          <tbody>
            <tr>
              <th className="border-b border-r border-slate-300 px-4 py-1">+</th>
              <th className="border-b border-slate-300 px-4 py-1">0</th>
              <th className="border-b border-slate-300 px-4 py-1">1</th>
            </tr>
            {[0, 1].map((a) => (
              <tr key={a}>
                <th className="border-r border-slate-300 px-4 py-1">{a}</th>
                <td className="px-4 py-1 text-center">{a}</td>
                <td className="bg-rose-50 px-4 py-1 text-center font-bold text-rose-600">{1 - a}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          這就是 <strong>mod 2 的加法</strong>，也就是 <span className="whitespace-nowrap">exclusive OR（XOR，互斥或）</span>，寫成 <M>{'\\oplus'}</M>：<M>{'1 + 1 = 0'}</M>，不進位，每一位各自算。
        </p>
      </div>
      <div className="space-y-4 text-xl">
        <p>error vector（錯誤向量）e：是 1 的位置就是被翻轉的位元。</p>
        <BitRow bits={e} plain size="lg" states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={(i) => setE(flipBit(e, i))} />
        <Tex block>{`\\underbrace{${message.join('')}}_{c\\ (\\text{送出})} + \\underbrace{${e.join('')}}_{e\\ (\\text{錯誤})} = \\underbrace{${r.join('')}}_{r\\ (\\text{收到})}`}</Tex>
        <p className="text-lg text-slate-600">接收端只看得到 r。整門課的任務：只靠 r，找出 e。</p>
      </div>
    </div>
  );
}

function ParityBitSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const p = message.reduce<number>((a, b) => a ^ b, 0) as Bit;
  const word: Bit[] = [...message, p];
  const ones = (w: readonly Bit[]) => w.filter((b) => b === 1).length;
  const one = flipBit(word, 1);
  const two = flipBit(one, 3);
  const Word = ({ w, flips }: { w: readonly Bit[]; flips: number[] }) => (
    <span className="font-mono text-2xl font-bold tracking-wider">
      {w.map((b, i) => (
        <span key={i} className={flips.includes(i) ? 'text-rose-600 underline decoration-4 underline-offset-4' : i === w.length - 1 ? 'text-parity-600' : ''}>
          {b}
        </span>
      ))}
    </span>
  );
  return (
    <div className="grid grid-cols-1 gap-4 text-xl lg:grid-cols-3">
      <Reveal on={s.step >= 0}>
        <Box tone="bg-parity-50 text-parity-700" title="做法：湊成偶數個 1">
          <p className="text-slate-800">
            在 {message.length} 個 data bit D1–D{message.length} 後面多送一個 <strong>parity bit</strong> P，讓全部位元裡 1 的個數是偶數：
          </p>
          <Tex block>{`P = ${message.map((_, i) => `D_${i + 1}`).join(' \\oplus ')} = ${p}`}</Tex>
          <div className="flex justify-center gap-3 font-mono">
            {word.map((b, i) => (
              <span key={i} className={`flex flex-col items-center ${i === word.length - 1 ? 'text-parity-600' : 'text-slate-800'}`}>
                <span className="text-2xl font-bold">{b}</span>
                <span className="text-base">{i === word.length - 1 ? 'P' : `D${i + 1}`}</span>
              </span>
            ))}
          </div>
          <p className="mt-2 text-lg text-slate-600">接收端只做一件事：數 1 的個數。偶數 → 通過；奇數 → 一定有位元被翻轉過。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 1}>
        <Box tone="bg-sky-50 text-sky-950" title="能偵測：奇數個錯">
          <div className="space-y-3">
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <div className="text-lg text-slate-500">錯 1 個</div>
              <Word w={one} flips={[1]} />
              <div className="text-lg">
                {ones(one)} 個 1，奇數 → <strong className="text-sky-700">偵測到</strong>
              </div>
            </div>
            <div className="rounded-xl bg-white/70 px-3 py-2">
              <div className="text-lg text-slate-500">錯 2 個</div>
              <Word w={two} flips={[1, 3]} />
              <div className="text-lg">
                {ones(two)} 個 1，偶數 → <strong className="text-rose-700">undetected error（未偵測錯誤）</strong>
              </div>
            </div>
          </div>
          <p className="mt-2 text-lg text-slate-600">每翻一個位元，奇偶就換一次：錯奇數個抓得到，錯偶數個抓不到。</p>
        </Box>
      </Reveal>
      <Reveal on={s.step >= 2}>
        <Box tone="bg-rose-50 text-rose-950" title="不能更正：不知道錯在哪">
          <p>不管翻的是哪一個位元，檢查的結果都一樣：「失敗」。</p>
          <p className="mt-2">
            一個檢查只有「通過／失敗」兩種答案，卻要分辨 {word.length} 個可能出錯的位置，資訊不夠。
          </p>
        </Box>
      </Reveal>
    </div>
  );
}

/** the 1 / 2 / 3 parity-bit lab on the message picked in the toolbar */
function ParitySlide() {
  const { message } = useMessage();
  return <ParityLab message={message} />;
}

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

export const CH0_SLIDES: DeckSlide<null>[] = [
  {
    title: `Lesson 1 — Hamming(${N},${K})：從 parity bit（同位位元）到 SECDED`,
    sub: '第一課報告：導論與第 1–5 章',
    steps: () => 1,
    render: () => <TitleSlide />,
    takeaway: (
      <>
        多送 {L} 個有規律的位元，接收端就能自己找出並修好 {T} 個錯
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>題目：Hamming({N},{K})，從一個 parity bit 走到 SECDED</li>
        <li>要解決的事：雜訊會翻轉位元，接收端要自己發現、自己修好，不能問發送端</li>
        <li>
          左邊是路線：導論加五章，章名和網頁側欄相同
          <ul className={NOTES_SUB}>
            <li>每一章都依 情境 → 設計 → 推導 → 結論 展開，互動就放在它要驗證的結論旁邊</li>
            <li>G、H、syndrome 這些名字到第 2 章才說明，這裡只看說明行</li>
          </ul>
        </li>
        <li>
          右邊的位元條是整場的結論
          <ul className={NOTES_SUB}>
            <li>
              {K} 個 data bit + {L} 個 parity bit = {N}：只多 {L} 個位元，就修得好任何 {T} 個錯
            </li>
            <li>
              再加 1 個 overall parity bit P0：修 {T} 個，同時偵測 {DETECT} 個
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '導論：雜訊會翻轉位元',
    sub: '接收端要怎麼發現錯、甚至自己修好錯？',
    steps: () => 3,
    render: (s) => <WhyCodesSlide s={s} />,
    takeaway: <>位元會被雜訊翻轉；只有多送的 redundancy，能讓接收端發現並修好錯</>,
    notes: (
      <ul className={NOTES_UL}>
        <li>
          問題：位元會被翻轉
          <ul className={NOTES_SUB}>
            <li>無線干擾、記憶體裡的宇宙射線 → 0 變 1、1 變 0</li>
            <li>現場點一、兩個位元翻轉：收到的永遠是另一個合法的 {K} 位元訊息 → 接收端看不出來</li>
          </ul>
        </li>
        <li>
          → 目標分兩層
          <ul className={NOTES_SUB}>
            <li>偵測：知道「有錯」→ 丟掉、要求重送</li>
            <li>更正：知道「錯在哪」→ 直接翻回來；不能重送時（硬碟、記憶體、太空船）只能靠更正</li>
          </ul>
        </li>
        <li>
          → 唯一的工具：redundancy，多送位元讓合法字串變稀少
          <ul className={NOTES_SUB}>
            <li>
              不多送 {2 ** K} / {2 ** K}、多送 1 位 {2 ** K} / {2 ** (K + 1)}、多送 {N - K} 位（Hamming({N},{K})）{CODEWORDS} / {2 ** N}
            </li>
            <li>合法的越稀少，錯一位就越容易落在不合法的字串上</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '導論：翻轉 = 加 1（mod 2）',
    sub: 'r = c + e',
    steps: () => 1,
    render: () => <FlipSumSlide />,
    takeaway: <>翻轉就是加 1、不進位：收到的 r = 送出的 c + 錯誤 e</>,
    notes: (
      <ul className={NOTES_UL}>
        <li>雜訊只做一件事：翻轉 → 寫成「加 1」；不動 →「加 0」</li>
        <li>
          加法表：0 + 1 = 1、1 + 1 = 0 → mod 2 加法，也就是 XOR 閘，寫成 ⊕（下一頁的 P 就用它）
          <ul className={NOTES_SUB}>
            <li>不進位：每個位元是獨立的一條線，翻第 2 位不會影響第 1 位</li>
            <li>翻兩次等於沒翻：1 + 1 = 0，所以減法就是加法</li>
          </ul>
        </li>
        <li>error vector e：是 1 的位置就是被翻的位元</li>
        <li>r = c + e：接收端只看得到 r；整門課的任務是只靠 r 找出 e，再用 c = r + e 修回來</li>
        <li>這套算術叫 GF(2)：之後的檢查、矩陣都在裡面算</li>
      </ul>
    ),
  },
  {
    title: '導論：一個 parity bit 能做什麼？',
    sub: '能發現奇數個錯，卻找不到錯在哪',
    steps: () => 3,
    render: (s) => <ParityBitSlide s={s} />,
    takeaway: <>一個檢查只回答一個是非題：知道有錯，不知道錯在哪</>,
    notes: (
      <ul className={NOTES_UL}>
        <li>
          最便宜的 redundancy：多送 1 個 parity bit P，讓 1 的個數是偶數
          <ul className={NOTES_SUB}>
            <li>發送端：P = D1 ⊕ D2 ⊕ D3 ⊕ D4，幾個 XOR 閘就算得出來</li>
            <li>接收端：數 1 的個數，偶數通過、奇數有錯</li>
          </ul>
        </li>
        <li>
          → 能偵測奇數個錯
          <ul className={NOTES_SUB}>
            <li>錯 1 個 → 奇數 → 抓到；錯 2 個 → 奇偶又翻回來 → undetected error</li>
          </ul>
        </li>
        <li>
          → 不能更正
          <ul className={NOTES_SUB}>
            <li>
              不管翻哪一位，答案都是同一句「失敗」：1 個檢查只有 2 種答案，卻要分辨 {K + 1} 個位置
            </li>
            <li>工程上只能丟掉重送，像序列埠（UART）的 parity check</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '導論：要幾個 parity bit，才找得到錯？',
    sub: `1 個只能偵測；${L} 個重疊的檢查才能定位`,
    steps: () => 1,
    render: () => <ParitySlide />,
    takeaway: <>檢查要夠多、還要互相重疊：每個位置一種失敗組合，才指得出錯在哪</>,
    notes: (
      <ul className={NOTES_UL}>
        <li>同一份資料 m（跟著上方的範例），上方切換 1、2、3 個 parity bit；畫面先開在 {L} 個</li>
        <li>1 個：只知道有錯，{K + 1} 個位置都可能</li>
        <li>
          2 個：資料分兩半，只知道錯在哪一半
          <ul className={NOTES_SUB}>
            <li>
              扣掉「全部通過」只剩 {TWO.patterns} 種結果，卻有 {TWO.positions} 個位置 → 一定有位置共用
            </li>
          </ul>
        </li>
        <li>
          {L} 個（Hamming）：互相重疊，每個位置一種失敗組合 → 能定位、能修
          <ul className={NOTES_SUB}>
            <li>
              {L} 個檢查 → {2 ** L} 種結果，「全部通過」留給沒有錯，剩 {2 ** L - 1} 種剛好分給 {N} 個位置：整份報告只在這裡完整講這件事
            </li>
            <li>現場示範：翻一個位元 → 右表只剩一個位置；再翻第二個 → 接收端以為只錯一個，反而改錯一位（第 3 章）</li>
          </ul>
        </li>
      </ul>
    ),
  },
];
