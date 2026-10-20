import { Fragment, type ReactNode } from 'react';
import { type Bit, H74, LAYOUT_74, PARITY_CHECKS, codewords74, column, flipBit } from '../../core';
import { useMessage } from '../../lib/store';
import { M, Tex } from '../../components/Tex';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';

/* ------------------------------------------------------------------ */
/* Shared pieces                                                      */
/* ------------------------------------------------------------------ */

/** Keeps its place from the first step (so the slide never reflows) and fades in at its step. */
function Reveal({ on, className = '', children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <div aria-hidden={!on} className={`transition-opacity duration-500 ${on ? 'opacity-100' : 'invisible opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

function Box({ tone, title, children }: { tone: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className={`h-full rounded-2xl p-4 ${tone}`}>
      <div className="mb-1 text-xl font-bold">{title}</div>
      {children}
    </div>
  );
}

/** 'P1' → 'P_1' for KaTeX */
const sub = (label: string) => label.replace(/(\d)/, '_$1');

/* ------------------------------------------------------------------ */
/* 導論：為什麼需要錯誤更正碼                                          */
/* ------------------------------------------------------------------ */

/** the road through Lesson 1: chapter tag, then two short lines */
const ROAD: [string, ReactNode, ReactNode][] = [
  ['導論', '一個同位位元', '只能偵測'],
  ['第 1 章', '三個重疊檢查', 'Hamming(7,4)'],
  ['第 2 章', '寫成矩陣', 'G 與 H'],
  ['第 3 章', 'Syndrome', '指出錯誤位置'],
  [
    '第 4、5 章',
    <>
      最小距離 <M>{'d_{\\min}'}</M>
    </>,
    '漢明球、完美碼',
  ],
  ['第 6、7 章', '多一個位元', 'SECDED'],
];

function WhyCodesSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const hit = 1; // the noise flips D2
  const recv = flipBit(message, hit);
  const k = message.length;
  const schemes = [
    { name: '不編碼', n: k, legal: 2 ** k },
    { name: '加 1 個同位位元', n: k + 1, legal: 2 ** k },
    { name: 'Hamming(7,4)', n: LAYOUT_74.length, legal: codewords74().length },
  ];
  return (
    <div className="space-y-4 text-xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-rose-50 text-rose-950" title="問題：位元會被翻轉">
            <p>無線訊號干擾、記憶體裡的宇宙射線，都可能把 0 變 1、1 變 0。</p>
            <div className="my-3 flex items-center gap-3 font-mono text-3xl font-bold">
              <span>{message.join('')}</span>
              <span className="text-2xl font-normal text-rose-300">→</span>
              <span>
                {recv.map((b, i) => (
                  <span key={i} className={i === hit ? 'text-rose-600 underline decoration-4 underline-offset-4' : ''}>
                    {b}
                  </span>
                ))}
              </span>
            </div>
            <p className="text-lg text-slate-600">
              每個 {k} 位元字串都合法：<span className="mono">{recv.join('')}</span> 也是合法訊息，接收端完全看不出被改過。
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="目標：兩個層次">
            <ol className="space-y-2">
              <li className="rounded-xl border-l-4 border-sky-300 bg-white/70 px-3 py-2">
                <strong>① 偵測</strong> <span className="text-lg text-slate-500">detect</span>
                <div className="text-lg text-slate-600">知道「有錯」→ 丟掉、要求重送</div>
              </li>
              <li className="rounded-xl border-l-4 border-sky-600 bg-white/70 px-3 py-2">
                <strong>② 更正</strong> <span className="text-lg text-slate-500">correct</span>
                <div className="text-lg text-slate-600">知道「錯在哪」→ 直接翻回來</div>
              </li>
            </ol>
            <p className="mt-2 text-lg text-slate-600">更正比偵測難：要先「定位」錯誤。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-emerald-50 text-emerald-950" title="唯一的工具：冗餘">
            <p>
              <M>k</M> 個資訊位元編成 <M>{'n > k'}</M> 個位元：<M>{'2^n'}</M> 個字串只有 <M>{'2^k'}</M> 個合法，出錯後很難剛好又是合法字串。
            </p>
            <div className="mt-2 space-y-1.5 text-lg">
              {schemes.map((sc) => (
                <div key={sc.name}>
                  <div className="flex justify-between gap-2">
                    <span>{sc.name}</span>
                    <span className="font-mono">
                      {sc.legal} / {2 ** sc.n}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${(sc.legal / 2 ** sc.n) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Box>
        </Reveal>
      </div>
      <Reveal on={s.step >= 3}>
        <div className="flex items-stretch gap-1 rounded-2xl bg-slate-50 p-3">
          <span className="grid shrink-0 place-items-center text-lg font-bold tracking-widest text-slate-700 [writing-mode:vertical-rl]">路線</span>
          {ROAD.map(([tag, line1, line2], i) => (
            <Fragment key={tag}>
              {i > 0 && <span className="grid shrink-0 place-items-center text-slate-300">→</span>}
              <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-1.5 py-1.5">
                <div className="text-sm font-bold text-slate-500">{tag}</div>
                <div className="text-lg leading-snug">{line1}</div>
                <div className="text-lg leading-snug text-slate-600">{line2}</div>
              </div>
            </Fragment>
          ))}
        </div>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 第 1 章：Hamming(7,4) 編碼                                          */
/* ------------------------------------------------------------------ */

const SINGLE = ['D1', 'D2', 'D3', 'D4', 'P'];

function OverlapIdeaSlide({ s }: { s: Stepper }) {
  const r = PARITY_CHECKS.length; // 3 checks
  const n = LAYOUT_74.length; // 7 positions
  const k = n - r; // 4 information bits
  // r = 1 is the single parity bit of the first box; the table starts at 2 (not enough) and ends at 3 (exactly enough)
  const counts = [r - 1, r].map((x) => ({ r: x, patterns: 2 ** x - 1, positions: k + x }));
  // worked example: an error at position 5 fails exactly the checks in column 5 of H (P1 on top)
  const pos = 5;
  const pattern = column(H74, pos - 1);
  const read = [...PARITY_CHECKS.keys()].reverse(); // P4 P2 P1: the most significant bit first
  const eqs = PARITY_CHECKS.map((pc) => `${sub(pc.name)} = ${pc.dataTerms.map(sub).join(' \\oplus ')}`);
  return (
    <div className="space-y-4 text-xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.85fr_1fr_1fr]">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-slate-50" title="一個同位位元：只說奇偶">
            <div className="mb-2 inline-flex flex-col gap-1">
              <div className="flex gap-1">
                {SINGLE.map((l) => (
                  <span key={l} className={`grid h-9 w-11 place-items-center rounded-md border-2 text-base font-semibold ${l === 'P' ? 'border-parity-300 bg-parity-50 text-parity-700' : 'border-data-300 bg-data-50 text-data-700'}`}>
                    {l}
                  </span>
                ))}
              </div>
              <div className="rounded bg-slate-300 text-center text-sm font-semibold text-slate-700">1 個檢查管全部</div>
            </div>
            <p>一個檢查只回答一個是非題。</p>
            <p className="text-lg text-slate-600">錯在 D1 或錯在 P，結果都是同一句「失敗」：知道有錯，不知道在哪。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-sky-50 text-sky-950" title="想法：多個重疊的檢查">
            <p className="text-lg">每個位置要對到一種專屬的失敗組合（「全部通過」留給「沒有錯」）：</p>
            <table className="mt-1 w-full text-center">
              <thead>
                <tr className="text-sm text-slate-500">
                  <th className="font-normal">檢查數 r</th>
                  <th className="font-normal">
                    失敗組合 <M>{'2^r - 1'}</M>
                  </th>
                  <th className="font-normal">位置數 {k} + r</th>
                  <th />
                </tr>
              </thead>
              <tbody className="font-mono">
                {counts.map((c) => {
                  const ok = c.patterns >= c.positions;
                  return (
                    <tr key={c.r} className={`border-t border-sky-100 leading-6 ${ok ? 'font-bold' : ''}`}>
                      <td>{c.r}</td>
                      <td>{c.patterns}</td>
                      <td>{c.positions}</td>
                      <td className={ok ? 'text-emerald-600' : 'text-rose-500'}>{ok ? '✓' : '✗'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="text-lg text-slate-600">
              位置數 = {k} 個資訊 + <M>r</M> 個同位
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-amber-50 text-amber-950" title="怎麼重疊：位置寫成二進位">
            <p className="text-lg">
              1–{n} 的二進位剛好是 {n} 種非零組合：檢查 <M>{'P_b'}</M> 負責二進位含有 <M>b</M> 的位置。
            </p>
            <table className="w-full text-center text-lg">
              <tbody>
                <tr className="font-semibold text-parity-700">
                  <td />
                  {read.map((i) => (
                    <td key={i}>{PARITY_CHECKS[i].name}</td>
                  ))}
                  <td />
                </tr>
                <tr>
                  <td className="whitespace-nowrap text-left text-slate-600">位置 {pos} 錯</td>
                  {read.map((i) => (
                    <td key={i} className={pattern[i] ? 'text-rose-600' : 'text-emerald-700'}>
                      {pattern[i] ? '失敗' : '通過'}
                    </td>
                  ))}
                  <td />
                </tr>
                <tr className="font-mono text-2xl font-bold">
                  <td className="whitespace-nowrap text-left font-sans text-lg font-normal text-slate-600">讀成二進位</td>
                  {read.map((i) => (
                    <td key={i}>{pattern[i]}</td>
                  ))}
                  <td className="text-left text-xl font-normal">
                    <M>{`= ${pos}`}</M>
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="text-lg text-slate-600">失敗的檢查 = 位置的二進位</p>
          </Box>
        </Reveal>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Reveal on={s.step >= 3}>
          <Box tone="bg-parity-50" title={<span className="text-parity-700">同位位元放在位置 1、2、4（2 的冪次）</span>}>
            <p className="text-lg">二進位只有一個 1 → 每個同位位元只在一個檢查裡，直接用資訊位元算出：</p>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {eqs.map((e) => (
                <Tex key={e}>{e}</Tex>
              ))}
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 4}>
          <Box tone="bg-emerald-50 text-emerald-950" title={`結果：Hamming(${n},${k})`}>
            <p>
              <span className="font-semibold text-data-700">{k} 個資訊位元</span> + <span className="font-semibold text-parity-700">{r} 個同位位元</span>
            </p>
            <p>能找出並修正任何 1 個錯誤</p>
            <p className="text-lg text-slate-600">
              碼率 <M>{`R = ${k}/${n} \\approx ${(k / n).toFixed(2)}`}</M>（三重重複碼 <M>{'1/3'}</M>）
            </p>
          </Box>
        </Reveal>
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
            在 {message.length} 個資訊位元後面多送一個<strong>同位位元</strong> P，讓全部位元裡 1 的個數是偶數：
          </p>
          <Tex block>{`P = ${message.map((_, i) => `D_${i + 1}`).join(' \\oplus ')} = ${p}`}</Tex>
          <div className="text-center">
            <Word w={word} flips={[]} />
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
                {ones(two)} 個 1，偶數 → <strong className="text-rose-700">未偵測錯誤</strong>
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
          <p className="mt-2 text-lg text-slate-600">
            下一步：多用幾個<strong>互相重疊</strong>的檢查，讓「哪些檢查失敗」指出錯誤位置（第 1 章）。
          </p>
        </Box>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exports                                                            */
/* ------------------------------------------------------------------ */

export const INTRO_CH0_SLIDES: DeckSlide<null>[] = [
  { title: '導論：為什麼需要錯誤更正碼？', sub: '雜訊會翻轉位元：接收端要怎麼發現錯、甚至修好錯？', steps: () => 4, render: (s) => <WhyCodesSlide s={s} /> },
];

/** goes right before the 1／2／3 parity-bit experiment */
export const INTRO_CH0_PARITY_SLIDES: DeckSlide<null>[] = [
  { title: '導論：一個同位位元能做什麼？', sub: '能發現奇數個錯，卻找不到錯在哪', steps: () => 3, render: (s) => <ParityBitSlide s={s} /> },
];

export const INTRO_CH1_SLIDES: DeckSlide<null>[] = [
  { title: '第 1 章：Hamming(7,4) 編碼', sub: '怎麼讓接收端不只發現錯、還知道錯在哪？', steps: () => 5, render: (s) => <OverlapIdeaSlide s={s} /> },
];

