import { useMemo, useState } from 'react';
import {
  type Bit,
  LAYOUT_74,
  codewords74,
  codewords84,
  encode84,
  minimumDistance,
  secdedDecode,
  syndromeToPosition,
} from '../core';
import { useMessage } from '../lib/store';
import { M } from '../components/Tex';
import { MessageInput } from '../components/Bits';
import { StatusBadge } from '../components/Lesson';
import { Deck, type DeckSlide } from '../components/Deck';
import { CH0_SLIDES } from './presentation1/Ch0Intro';
import { CH1_SLIDES } from './presentation1/Ch1Encode';
import { CH2_SLIDES } from './presentation1/Ch2Matrices';
import { CH3_SLIDES } from './presentation1/Ch3Syndrome';
import { CH4_SLIDES } from './presentation1/Ch4Limits';
import { INTRO_CH6_SLIDES, INTRO_CH7_SLIDES } from './presentation1/IntroCh5to7';

type Ctx = null;
const LAYOUT_84 = [...LAYOUT_74.map((p) => p.label), 'P0'];

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

function ExtendedSlide() {
  const { message, toggleBit } = useMessage();
  const c8 = encode84(message);
  const d7 = useMemo(() => minimumDistance(codewords74().map((x) => x.codeword)).dmin, []);
  const d8 = useMemo(() => minimumDistance(codewords84().map((x) => x.codeword)).dmin, []);
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-end gap-6">
        <MessageInput message={message} onToggle={toggleBit} size="md" />
        <span className="text-3xl text-slate-300">→</span>
        <div className="flex gap-1.5">
          {c8.map((b, i) => (
            <div key={i} className={`flex w-11 flex-col items-center rounded-lg border-2 py-1 ${i === 7 ? 'border-overall-300 bg-overall-50' : LAYOUT_74[i].role === 'parity' ? 'border-parity-300 bg-parity-50' : 'border-data-300 bg-data-50'}`}>
              <span className="text-xs font-semibold text-slate-600">{LAYOUT_84[i]}</span>
              <span className="font-mono text-2xl font-bold">{b}</span>
            </div>
          ))}
        </div>
      </div>
      <p>
        在 Hamming(7,4) 後面多加一個<strong>整體同位位元</strong> <M>{'P_0 = c_1 \\oplus \\cdots \\oplus c_7'}</M>，讓全部 8 個位元有偶數個 1。
      </p>
      <table className="w-full text-xl">
        <thead>
          <tr className="text-left text-base text-slate-500">
            <th className="py-1" />
            <th>碼長</th>
            <th>
              <M>{'d_{\\min}'}</M>（窮舉計算）
            </th>
            <th>能做到</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-200">
            <td className="py-2 font-semibold">Hamming(7,4)</td>
            <td>7</td>
            <td className="font-mono">{d7}</td>
            <td>修 1 個（錯 2 個會被改錯）</td>
          </tr>
          <tr className="border-t border-slate-200">
            <td className="py-2 font-semibold">Extended(8,4)</td>
            <td>8</td>
            <td className="font-mono">{d8}</td>
            <td>修 1 個，同時偵測 2 個（SECDED）</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const SECDED_ROWS = [
  { kase: 'no-error', s: 's = 0', q: '偶', label: '沒有錯', status: 'ok' },
  { kase: 'single-corrected', s: 's ≠ 0', q: '奇', label: '單一錯誤 → 翻轉 s 指向的位置', status: 'corrected' },
  { kase: 'double-detected', s: 's ≠ 0', q: '偶', label: '兩個錯誤 → 只偵測，不修正', status: 'detected' },
  { kase: 'overall-corrected', s: 's = 0', q: '奇', label: 'P0 自己錯了 → 翻轉 P0', status: 'corrected' },
] as const;

function SecdedSlide() {
  const { message } = useMessage();
  const sent = encode84(message);
  const [e, setE] = useState<number[]>([2, 5]);
  const r = sent.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const res = secdedDecode(r);
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-slate-500">收到 r =</span>
        <div className="flex gap-1.5">
          {r.map((b, i) => {
            const flipped = e.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setE(flipped ? e.filter((j) => j !== i) : e.length < 3 ? [...e, i] : e)}
                aria-label={`${LAYOUT_84[i]} = ${b}${flipped ? '（已翻轉）' : ''}，點擊翻轉`}
                aria-pressed={flipped}
                className={`flex w-11 flex-col items-center rounded-lg border-2 py-1 ${flipped ? 'border-rose-500 bg-rose-50' : i === 7 ? 'border-overall-300 bg-overall-50' : 'border-slate-200 bg-white'}`}
              >
                <span className="text-xs font-semibold text-slate-600">{LAYOUT_84[i]}</span>
                <span className={`font-mono text-2xl font-bold ${flipped ? 'text-rose-600' : ''}`}>{b}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-8 text-2xl">
        <span>
          s = <span className="mono font-bold">({res.syndrome.join(',')})ᵀ</span>
          {res.syndrome.some(Boolean) && <span className="text-slate-500"> → 位置 {syndromeToPosition(res.syndrome)}</span>}
        </span>
        <span>
          q = {res.overallParity}（8 個位元裡 1 的個數是{res.overallParity ? '奇數' : '偶數'}）
        </span>
        <span className="text-slate-500">實際錯了 {e.length} 個</span>
      </div>
      <table className="w-full text-xl">
        <tbody>
          {SECDED_ROWS.map((row) => {
            const on = row.kase === res.case;
            return (
              <tr key={row.kase} className={`border-t border-slate-200 ${on ? 'bg-amber-100 font-bold' : ''}`}>
                <td className="py-2">{on ? '▶ ' : ''}{row.s}</td>
                <td>q {row.q}</td>
                <td>{row.label}</td>
                <td>
                  <StatusBadge status={row.status} large />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-lg text-slate-600">至多 2 個錯誤時保證判斷正確；錯 3 個就可能被當成單一錯誤而改錯。</p>
    </div>
  );
}

function SummarySlide() {
  return (
    <div className="space-y-4 text-2xl leading-relaxed">
      <ol className="list-decimal space-y-2 pl-8">
        <li>一個同位位元只能發現「奇數個錯」，找不到錯在哪。</li>
        <li>三個互相重疊的檢查：7 種失敗組合對上 7 個位置 → Hamming(7,4)。</li>
        <li>矩陣語言：c = mG，Hcᵀ = 0，code = ker H。</li>
        <li>Syndrome s = Heᵀ：單一錯誤時就是錯誤位置的二進位。</li>
        <li>
          <M>{'d_{\\min} = 3 \\Rightarrow t = 1'}</M>：保證修 1 個，錯 2 個會改錯。
        </li>
        <li>完美碼：每一種燈號都用到，沒有一種留給雙錯。</li>
        <li>多一個整體同位位元 → (8,4)，d_min = 4：SECDED 修 1 個、偵測 2 個。</li>
      </ol>
      <p className="text-lg text-slate-600">
        第二課：同一個 code 換成多項式與 GF(8) 的觀點，用 LFSR 編碼、用 Chien Search 解碼。
      </p>
    </div>
  );
}

// each chapter opens with its explanation slides (presentation1/*), then the live examples
const SLIDES: DeckSlide<Ctx>[] = [
  ...CH0_SLIDES,
  ...CH1_SLIDES,
  ...CH2_SLIDES,
  ...CH3_SLIDES,
  ...CH4_SLIDES,
  ...INTRO_CH6_SLIDES,
  { title: '第 6 章：實例：編碼成 8 個位元', sub: '多一個整體同位位元 P0', steps: () => 1, render: () => <ExtendedSlide /> },
  ...INTRO_CH7_SLIDES,
  { title: '第 7 章：實例：SECDED 解碼器', sub: '用 s 和 q 兩個訊號判斷四種情況', steps: () => 1, render: () => <SecdedSlide /> },
  { title: '總結', steps: () => 1, render: () => <SummarySlide /> },
];

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
