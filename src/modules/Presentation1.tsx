import { useMemo, useState } from 'react';
import {
  type Bit,
  G74,
  H74,
  LAYOUT_74,
  codewords74,
  codewords84,
  column,
  correctionCapability,
  decode74,
  encode74,
  encode84,
  matVec,
  minimumDistance,
  secdedDecode,
  syndromeToPosition,
} from '../core';
import { useMessage } from '../lib/store';
import { M, Tex } from '../components/Tex';
import { BitRow, MessageInput } from '../components/Bits';
import { MatrixView, ColumnVector } from '../components/MatrixView';
import { StatusBadge } from '../components/Lesson';
import { BallDiagram, CubeBall, PackingDiagram } from '../components/BoundFigures';
import { DistanceLine } from '../components/DistanceLine';
import { Deck, type DeckSlide } from '../components/Deck';
import type { Stepper } from '../components/l2/Stepper';
import { CH0_SLIDES } from './presentation1/Ch0Intro';
import { CH1_SLIDES } from './presentation1/Ch1Encode';
import { CH2_SLIDES } from './presentation1/Ch2Matrices';
import { INTRO_CH3_SLIDES, INTRO_CH4_SLIDES } from './presentation1/IntroCh3to4';
import { INTRO_CH5_SLIDES, INTRO_CH6_SLIDES, INTRO_CH7_SLIDES } from './presentation1/IntroCh5to7';

type Ctx = null;
const LAYOUT_84 = [...LAYOUT_74.map((p) => p.label), 'P0'];

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

function MatrixSlide({ s }: { s: Stepper }) {
  const { message, toggleBit } = useMessage();
  const c = encode74(message);
  const rows = message.flatMap((b, i) => (b ? [i] : []));
  const Hc = matVec(H74, c);
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-center gap-4">
        <MessageInput message={message} onToggle={toggleBit} size="md" />
        <span>
          <M>{`m = ${message.join('')}`}</M>，<M>{`c = mG = ${c.join('')}`}</M>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-base font-semibold text-slate-700">生成矩陣 G：把 m 裡是 1 的列加起來</div>
          <MatrixView matrix={G74} name="G =" colLabels={LAYOUT_74.map((p) => p.label)} rowLabels={['D1', 'D2', 'D3', 'D4']} highlightRows={rows} dimRows={[0, 1, 2, 3].filter((i) => !rows.includes(i))} />
        </div>
        {s.step >= 1 && (
          <div>
            <div className="mb-1 text-base font-semibold text-slate-700">同位檢查矩陣 H：每一列是一個檢查</div>
            <div className="flex flex-wrap items-center gap-3">
              <MatrixView matrix={H74} name="H =" colLabels={LAYOUT_74.map((p) => p.position)} rowLabels={['P1', 'P2', 'P4']} />
              <span className="text-2xl">·</span>
              <ColumnVector bits={c} label={<M>{'c^T ='}</M>} size="sm" />
              <span className="text-2xl">=</span>
              <ColumnVector bits={Hc} size="sm" cellClass="bg-emerald-50 text-emerald-700" />
            </div>
          </div>
        )}
      </div>
      <p className="text-lg text-slate-600">
        {s.step === 0 ? '編碼就是矩陣乘法 c = mG：把 m 裡是 1 的那幾列加起來。' : '合法 codeword 一定滿足 Hcᵀ = 0：三個檢查全部通過。第 j 欄正好是 j 的二進位（由下往上讀）。'}
      </p>
    </div>
  );
}

function SyndromeSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const [e, setE] = useState<number[]>([4]);
  const r = c.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const d = decode74(r);
  const col = d.position - 1;
  return (
    <div className="space-y-4 text-xl">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-slate-500">收到 r =</span>
        <BitRow bits={r} layout={LAYOUT_74} size="lg" states={r.map((_, i) => (e.includes(i) ? 'error' : 'normal'))} onToggle={(i) => setE(e.includes(i) ? e.filter((j) => j !== i) : [...e, i])} />
      </div>
      {s.step >= 1 && (
        <div className="flex flex-wrap items-center gap-4">
          <MatrixView matrix={H74} name="H" colLabels={LAYOUT_74.map((p) => p.position)} highlightCols={col >= 0 && s.step >= 2 ? [col] : []} />
          <span className="text-2xl">·</span>
          <ColumnVector bits={r} label={<M>{'r^T ='}</M>} size="sm" />
          <span className="text-2xl">=</span>
          <ColumnVector bits={d.syndrome} label={<M>{'s'}</M>} size="sm" cellClass="bg-amber-50 text-amber-800" />
        </div>
      )}
      {s.step >= 2 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-4">
          {d.position === 0 ? (
            <>
              s = 000：沒有發現錯誤。<StatusBadge status={e.length ? 'wrong' : 'ok'} zh={e.length ? '未偵測錯誤' : undefined} en={e.length ? 'Undetected error' : undefined} large />
            </>
          ) : (
            <>
              s 等於 H 的第 {d.position} 欄 <span className="mono">({column(H74, col).join(',')})ᵀ</span> → 翻轉位置 {d.position}（{LAYOUT_74[col].label}），得到 <strong className="mono">{d.corrected.join('')}</strong>
              {e.length === 1 ? <StatusBadge status="corrected" large /> : <StatusBadge status="wrong" zh="誤更正" en="Miscorrection" large />}
            </>
          )}
        </div>
      )}
      <p className="text-lg text-slate-600">
        {s.step === 0 && (e.length ? `紅色是被翻轉的 ${e.length} 個位元。接收端看不到紅色，只能用 r 計算 Syndrome。` : '這次沒有錯誤。接收端不知道這件事，只能用 r 計算 Syndrome。')}
        {s.step === 1 && 's = Hrᵀ = Heᵀ：codeword 的部分全部消掉，只剩錯誤。'}
        {s.step === 2 && '只錯一個時，s 就是錯誤位置那一欄 = 位置的二進位。錯兩個一定會改錯；錯三個以上可能改錯，也可能完全沒發現（第 4 章解釋原因）。'}
      </p>
    </div>
  );
}

function DistanceSlide() {
  const [d, setD] = useState(3);
  const md = useMemo(() => minimumDistance(codewords74().map((x) => x.codeword)), []);
  const t = correctionCapability(d);
  return (
    <div className="space-y-5 text-xl">
      <p>
        Hamming 距離 = 兩個字串有幾個位置不一樣。Hamming(7,4) 的 16 個 codeword 兩兩比較（{md.pairsChecked} 對），最近的一對距離是 <strong>{md.dmin}</strong>，所以 <M>{`d_{\\min} = ${md.dmin}`}</M>。
      </p>
      <label className="flex items-center gap-4">
        <span>
          設 <M>{'d_{\\min}'}</M> =
        </span>
        <input type="range" min={1} max={7} value={d} onChange={(ev) => setD(Number(ev.target.value))} className="w-64 accent-slate-900" aria-label="最小距離" />
        <span className="font-mono text-3xl font-bold">{d}</span>
      </label>
      <DistanceLine d={d} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sky-50 p-4">
          保證能修正 <M>{`t = \\lfloor (${d} - 1)/2 \\rfloor = ${t}`}</M> 個：錯 t 個以內，一定還在原本那個 codeword 的地盤。
        </div>
        <div className="rounded-2xl bg-amber-50 p-4">
          保證能偵測 <M>{`d_{\\min} - 1 = ${d - 1}`}</M> 個：錯不到 d_min 個，不可能剛好變成另一個 codeword。
        </div>
      </div>
    </div>
  );
}

function BoundSlide() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <BallDiagram />
      <div className="space-y-4">
        <PackingDiagram />
        <Tex block>{'2^k \\cdot V_2(n,t) \\le 2^n \\qquad 16 \\times 8 = 128 = 2^7'}</Tex>
      </div>
    </div>
  );
}

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
        <li>16 × 8 = 128：Hamming(7,4) 是完美碼，沒有多餘空間偵測雙錯。</li>
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
  { title: '第 2 章：實例：c = mG、Hcᵀ = 0', sub: 'G 負責編碼，H 負責檢查', steps: () => 2, render: (s) => <MatrixSlide s={s} /> },
  ...INTRO_CH3_SLIDES,
  { title: '第 3 章：實例：Syndrome 解碼', sub: 's = Hrᵀ = Heᵀ', steps: () => 3, render: (s) => <SyndromeSlide s={s} /> },
  ...INTRO_CH4_SLIDES,
  { title: '第 4 章：d_min 決定更正與偵測能力', sub: 'd_min 越大，每個 codeword 的地盤越大', steps: () => 1, render: () => <DistanceSlide /> },
  INTRO_CH5_SLIDES[0],
  { title: '第 5 章：漢明球', sub: 'n = 3 的立方體：沿著邊走的步數 = 距離', steps: () => 1, render: () => <CubeBall /> },
  { title: '第 5 章：Hamming Bound', sub: '球不能重疊，空間只有 2ⁿ 個字串', steps: () => 1, render: () => <BoundSlide /> },
  ...INTRO_CH5_SLIDES.slice(1),
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
