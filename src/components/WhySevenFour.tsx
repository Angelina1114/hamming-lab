import { useState } from 'react';
import { type Bit, type Design, H74, LAYOUT_74, analyzeDesign, checkBitsFor, signature } from '../core';
import { M, Tex } from './Tex';
import { Card } from './Lesson';

const CHECKS = ['P1', 'P2', 'P4'];
const posName = (j: number) => `${j + 1}（${LAYOUT_74[j].label}）`;

const PRESETS: { label: string; make: () => Design }[] = [
  { label: 'Hamming 的安排', make: () => H74.map((r) => [...r]) },
  { label: 'P1 只管 3 個', make: () => H74.map((r, i) => r.map((v, j) => (i === 0 && j === 6 ? 0 : v)) as Bit[]) },
  { label: 'P1 只管 2 個', make: () => H74.map((r, i) => r.map((v, j) => (i === 0 && (j === 4 || j === 6) ? 0 : v)) as Bit[]) },
  { label: '每個只管自己', make: () => CHECKS.map((_, i) => Array.from({ length: 7 }, (_, j) => (j === [0, 1, 3][i] ? 1 : 0)) as Bit[]) },
];

/** Let the reader design the three checks and see which single errors become unlocatable. */
export function CoverageDesigner() {
  const [cover, setCover] = useState<Design>(() => H74.map((r) => [...r]));
  const a = analyzeDesign(cover);
  const clashOf = (j: number) => a.clashes.findIndex((g) => g.includes(j));
  const toggle = (i: number, j: number) => setCover(cover.map((row, r) => row.map((v, c) => (r === i && c === j ? ((1 - v) as Bit) : v))));

  return (
    <Card title="為什麼每個檢查剛好管 4 個位置？不能管 1、2、3 個嗎？">
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          要能修正，接收端必須從「哪些檢查失敗」反推出錯在哪裡。所以 7 個位置，每一個都要有<strong>自己專屬的一組檢查</strong>：
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>每個位置至少被一個檢查管到，不然它錯了，所有檢查都照樣通過，根本看不到。</li>
          <li>任兩個位置被管到的檢查組合不能一樣，不然錯在其中一個時分不出是誰。</li>
        </ul>
        <p>
          3 個檢查的非空組合只有 <M>{'2^3 - 1 = 7'}</M> 種：{'{P1}、{P2}、{P4}、{P1,P2}、{P1,P4}、{P2,P4}、{P1,P2,P4}'}。7 個位置剛好把這 7 種<strong>全部用掉，一種一個</strong>。其中含有 P1 的有 4 種（{'{P1}、{P1,P2}、{P1,P4}、{P1,P2,P4}'}），所以 P1 一定剛好管 4 個位置；P2、P4 也一樣。
        </p>
        <p>
          如果讓 P1 只管 1、2 或 3 個位置，含 P1 的組合就有幾種沒被用到，不被 P1 管的位置至少有 4 個，卻只剩 {'{P2}、{P4}、{P2,P4}'} 3 種組合可用，<strong>一定有兩個位置撞在一起，或有位置完全沒被檢查到</strong>。自己點下面的格子試試看。
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setCover(p.make())}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="mx-auto text-center text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="px-1 py-1 text-left">檢查</th>
              {LAYOUT_74.map((p) => (
                <th key={p.index} className={`px-1 py-1 ${p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}`}>
                  {p.position}
                  <div className="text-[10px] font-normal">{p.label}</div>
                </th>
              ))}
              <th className="px-1 py-1">管幾個</th>
            </tr>
          </thead>
          <tbody>
            {cover.map((row, i) => (
              <tr key={i}>
                <td className="px-1 py-1 text-left font-semibold text-parity-700">{CHECKS[i]}</td>
                {row.map((v, j) => (
                  <td key={j} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => toggle(i, j)}
                      aria-label={`${CHECKS[i]} 管位置 ${j + 1}（${LAYOUT_74[j].label}）`}
                      aria-pressed={v === 1}
                      className={`h-6 w-6 rounded-md border text-sm font-bold sm:h-8 sm:w-8 sm:text-base ${v ? 'border-parity-400 bg-parity-100 text-parity-700' : 'border-slate-200 bg-white text-slate-300'}`}
                    >
                      {v ? '●' : '·'}
                    </button>
                  </td>
                ))}
                <td className={`px-1 py-1 font-mono font-bold ${a.rowWeights[i] === 4 ? 'text-emerald-700' : 'text-orange-700'}`}>{a.rowWeights[i]}</td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 text-[11px]">
              <td className="px-1 py-1 text-left text-slate-500">失敗</td>
              {LAYOUT_74.map((p) => {
                const s = signature(cover, p.index);
                const none = !s.some(Boolean);
                const c = clashOf(p.index);
                return (
                  <td key={p.index} className={`px-1 py-1 font-semibold ${none ? 'text-rose-600' : c >= 0 ? 'text-orange-600' : 'text-emerald-700'}`}>
                    {none ? '無' : CHECKS.filter((_, i) => s[i]).map((x) => x.slice(1)).join(',')}
                  </td>
                );
              })}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <p className="mt-1 text-center text-xs text-slate-500">最下面一列「失敗」= 錯在這個位置時，哪幾個檢查會失敗（1 = P1、2 = P2、4 = P4）。</p>
      <div className={`mt-3 rounded-xl border p-3 text-sm ${a.locatesEverySingleError ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-orange-300 bg-orange-50 text-orange-900'}`}>
        {a.locatesEverySingleError ? (
          <>✓ 7 個位置各有一組不同的檢查，任何單一錯誤都能定位。每個檢查都剛好管 4 個位置。</>
        ) : (
          <ul className="space-y-1">
            {a.invisible.map((j) => (
              <li key={`i${j}`}>✗ 位置 {posName(j)} 沒有任何檢查管：錯在這裡，所有檢查照樣通過，完全看不到。</li>
            ))}
            {a.clashes.map((g) => (
              <li key={g.join()}>
                ✗ 位置 {g.map(posName).join('、')} 的檢查組合一樣：錯在其中一個時，分不出是誰。
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        網站的測試把所有「能定位每個單一錯誤」的安排都列出來檢查過（共 5040 種，就是 7 種組合的所有排列），每一種都是三個檢查各管 4 個位置。
      </p>
    </Card>
  );
}

/** Data lengths 1..12: how many check bits, and whether the outcomes are used up exactly. */
export function CodeSizeTable() {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const k = i + 1;
    const r = checkBitsFor(k);
    const n = k + r;
    const outcomes = 2 ** r - 1;
    return { k, r, n, outcomes, full: n === outcomes, rate: k / n };
  });
  return (
    <Card title="為什麼是 (7,4)？資料可以是別的長度嗎？">
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          可以！關鍵在上一題：r 個同位位元有 <M>{'2^r'}</M> 種檢查結果。扣掉「全部通過 = 沒有錯」，剩 <M>{'2^r - 1'}</M> 種要分給 n = k + r 個位置（k 個資訊位元加 r 個同位位元），所以必須
        </p>
        <Tex block>{'k + r \\le 2^r - 1'}</Tex>
        <p>
          r = 2 時 k 最多 1；<strong>r = 3 時 k 最多 4</strong>；r = 4 時 k 最多 11。所以 4 不是隨便選的：它是 3 個同位位元最多能保護的資料量，7 = 4 + 3 剛好用光全部 7 種結果。
        </p>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-3">資訊位元 k</th>
              <th className="pr-3">同位位元 r</th>
              <th className="pr-3">code (n, k)</th>
              <th className="pr-3">可用結果 2ʳ − 1</th>
              <th className="hidden pr-3 sm:table-cell">碼率 k/n</th>
              <th>用滿了嗎</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((x) => (
              <tr key={x.k} className={`border-t border-slate-100 ${x.k === 4 ? 'bg-emerald-50' : ''}`}>
                <td className="py-1 pr-3">{x.k}</td>
                <td className="pr-3">{x.r}</td>
                <td className="pr-3">
                  ({x.n},{x.k})
                </td>
                <td className="pr-3">{x.outcomes}</td>
                <td className="hidden pr-3 sm:table-cell">{(x.rate * 100).toFixed(0)}%</td>
                <td className="font-sans">
                  {x.full ? <span className="font-semibold text-emerald-700">✓ 用滿（完整）</span> : <span className="text-slate-500">剩 {x.outcomes - x.n} 種（縮短）</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 space-y-1 text-sm text-slate-700">
        <p>
          資料只有 1 個位元時用 (3,1)，其實就是三重重複；2、3 個位元也可以，但一樣要付 3 個同位位元，有些結果浪費掉。資料一多到 5 個，n = 8 已經超過 7 種結果，只好加到 4 個同位位元，一直到 (15,11) 才又剛好用滿。
        </p>
        <p>
          課本選 (7,4)，是因為它是除了重複碼之外<strong>最小的完整 Hamming Code</strong>：小到可以手算、畫成 Venn 圖，又已經有「重疊檢查定位錯誤」的全部精神。實際系統用的是更長的版本：家族表與 Hamming Bound 見
          <a href="#/bound" className="mx-1 font-semibold text-overall-700 hover:underline">
            第 5 章
          </a>
          ，訊息更長時怎麼切、長度對不上怎麼辦見
          <a href="#/l2-12" className="mx-1 font-semibold text-overall-700 hover:underline">
            第二課 2-12
          </a>
          。
        </p>
      </div>
    </Card>
  );
}
