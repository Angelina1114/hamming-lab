import { useState, type ReactNode } from 'react';
import { type Bit, H74, codewords74, correctionCapability, minimumDistance } from '../core';
import { useMessage } from '../lib/store';
import { M } from '../components/Tex';
import { Deck, type DeckSlide } from '../components/Deck';
import { CH0_SLIDES } from './presentation1/Ch0Intro';
import { CH1_SLIDES } from './presentation1/Ch1Encode';
import { CH2_SLIDES } from './presentation1/Ch2Matrices';
import { CH3_SLIDES } from './presentation1/Ch3Syndrome';
import { CH4_SLIDES } from './presentation1/Ch4Limits';
import { CH5_SLIDES } from './presentation1/Ch5Secded';
import { NOTES_UL } from './presentation1/parts';

type Ctx = null;

/* ------------------------------------------------------------------ */
/* 總結                                                                */
/* ------------------------------------------------------------------ */

/** 3 checkers = 3 warning lamps, 2³ lamp states; d_min and t computed from the 16 codewords */
const R = H74.length;
const STATES = 2 ** R;
const D_MIN = minimumDistance(codewords74().map((x) => x.codeword)).dmin;
const T = correctionCapability(D_MIN);

/** one line per part of Lesson 1, matching each chapter's 重點 */
const SUMMARY: [string, string, ReactNode][] = [
  ['導論', '', '雜訊會偷偷翻轉位元：多送有規律的冗餘位元，接收端才能發現錯，甚至自己修好。'],
  ['第 1 章', '編碼', `${R} 組互相重疊的檢查：每個位置被一組獨一無二的檢查盯著，錯在哪裡，失敗的組合就不同。`],
  ['第 2 章', 'H 與 G', `G 是發送端的編碼器接線圖，H 是接收端的 ${R} 盞警示燈：沒有雜訊時，燈全暗。`],
  ['第 3 章', 'Syndrome 解碼', '亮的燈 = H 的第 j 欄 = 出錯的位置 j：接收端看燈就知道該翻哪一位。'],
  [
    '第 4 章',
    '能力與極限',
    <>
      雜訊每翻一位就推一步：<M>{`d_{\\min} = ${D_MIN}`}</M> 保證翻 {T} 位修得回來；{R} 盞燈的 {STATES} 種狀態剛好用完。
    </>,
  ],
  ['第 5 章', 'SECDED', '多一盞燈數翻轉個數的奇偶：錯 1 個照樣修好，錯 2 個舉手回報，而不是悄悄改錯。'],
];

function SummarySlide() {
  return (
    <div className="space-y-4">
      <ol className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {SUMMARY.map(([tag, name, text], i) => (
          <li key={tag} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-base font-bold text-white">{i + 1}</span>
            <span className="text-lg leading-snug">
              <strong className="text-xl">
                {tag}
                {name && ` ${name}`}
              </strong>
              <span className="block text-slate-700">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="text-lg text-slate-600">第二課：同一個 code 換成多項式與 GF(8) 的觀點，用 LFSR 編碼、用 Chien Search 解碼。</p>
    </div>
  );
}

const SUMMARY_SLIDE: DeckSlide<Ctx> = {
  title: '總結',
  sub: '第一課：從發現錯、找出錯、修好錯，到知道什麼時候不該修',
  steps: () => 1,
  render: () => <SummarySlide />,
  takeaway: (
    <>
      <span className="whitespace-nowrap">多送幾個位元、看燈號：</span>
      <span className="whitespace-nowrap">發現錯、找出錯、修好錯，或回報</span>
    </>
  ),
  notes: (
    <ul className={NOTES_UL}>
      <li>導論：沒有冗餘，錯了也看不出來；一個同位位元只能發現錯</li>
      <li>第 1 章：{R} 組重疊的檢查，失敗的組合指出位置</li>
      <li>第 2 章：發送端用 G 造 codeword，接收端用 H 的 {R} 盞燈檢查；HGᵀ = 0：沒有雜訊時燈全暗</li>
      <li>第 3 章：亮的燈 = H 的第 j 欄 = 位置 j，燈號讀成二進位接上解碼器</li>
      <li>
        第 4 章：d_min = {D_MIN} → 保證修 {T} 位；{R} 盞燈的 {STATES} 種狀態用完 = 完美碼，沒有燈號留給「錯了兩個」
      </li>
      <li>第 5 章：多一盞燈 P0 數奇偶 → SECDED：錯 1 個修好、錯 2 個回報；伺服器記憶體用的就是這一套</li>
      <li>第二課預告：同一個 code 換成多項式與 GF(8)，LFSR 編碼、Chien Search 解碼</li>
    </ul>
  ),
};

// each chapter opens with its explanation slides, then the live examples (presentation1/*)
const SLIDES: DeckSlide<Ctx>[] = [...CH0_SLIDES, ...CH1_SLIDES, ...CH2_SLIDES, ...CH3_SLIDES, ...CH4_SLIDES, ...CH5_SLIDES, SUMMARY_SLIDE];

const MESSAGES = ['1011', '1001', '0110', '1111', '0001'];

export default function Presentation1() {
  const { message, setMessage } = useMessage();
  const [key, setKey] = useState(0);
  return (
    <Deck
      slides={SLIDES}
      ctx={null}
      label="第一課報告"
      exitHref="#/intro"
      resetKey={key}
      toolbar={
        <select
          aria-label="切換範例訊息"
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 font-mono"
          value={message.join('')}
          onChange={(e) => {
            setMessage(e.target.value.split('').map((x) => (x === '1' ? 1 : 0)) as Bit[]);
            setKey((k) => k + 1);
          }}
        >
          {[...new Set([message.join(''), ...MESSAGES])].map((m) => (
            <option key={m} value={m}>
              m = {m}
            </option>
          ))}
        </select>
      }
    />
  );
}
