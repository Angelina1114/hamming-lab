import { useState } from 'react';
import { type Bit, DEFAULT_MESSAGE, K4, LAYOUT_74, PARITY_CHECKS, checkBitsFor, encode74, flipBit, hammingK, hammingN } from '../core';
import { M, Tex } from './Tex';
import { Card, Expandable, ResetButton, Segmented } from './Lesson';
import { usePresenting } from '../lib/presenting';

type K = '1' | '2' | '3' | '4';
/** a lamp pattern written as a number: most significant lamp first (P4 P2 P1) */
const bin = (v: number, l: number) => v.toString(2).padStart(l, '0');

/** Hamming(7,4): ℓ = 3 parity bits, 2^ℓ − 1 = 7 failure patterns, k = 4 data bits */
const L = PARITY_CHECKS.length;
const PATTERNS = 2 ** L - 1;

/** Fewer data bits: take the first n positions of the Hamming(7,4) layout (the dropped data bits are 0). */
function smallCode(k: number) {
  const l = checkBitsFor(k);
  const n = k + l;
  return { l, n, outcomes: 2 ** l - 1, wasted: 2 ** l - 1 - n, rate: k / n, perData: l / k };
}

/** the lamps of ℓ checks, most significant first: 'P4P2P1' */
const lampOrder = (l: number) =>
  PARITY_CHECKS.slice(0, l)
    .map((pc) => pc.name)
    .reverse()
    .join('');

const ONE = smallCode(1);
const MID = smallCode(K4 - 1);

export function MessageSizeLab() {
  const presenting = usePresenting();
  const [kStr, setK] = useState<K>(String(K4) as K);
  const [msg, setMsg] = useState<Bit[]>([...DEFAULT_MESSAGE]);
  const [flips, setFlips] = useState<number[]>([]);
  const k = Number(kStr);
  const { l, n, outcomes, wasted } = smallCode(k);
  const data = msg.slice(0, k);
  const sent = encode74([...data, ...Array<Bit>(K4 - k).fill(0)]).slice(0, n);
  const recv = sent.map((b, j) => (flips.includes(j) ? ((b ^ 1) as Bit) : b));
  // lamp pattern = XOR of the positions holding a 1 (column j of H is the binary of j)
  const lamps = recv.reduce<number>((acc, b, j) => (b ? acc ^ (j + 1) : acc), 0);
  const label = (pos: number) => LAYOUT_74[pos - 1].label;
  const fixed = lamps >= 1 && lamps <= n ? flipBit(recv, lamps - 1) : recv;
  const why =
    k === 1
      ? `${l} 個同位位元有 ${outcomes} 種「有錯」的結果，剛好對上 ${n} 個位置。其實 P1、P2 都會等於 D1：就是把資料重複送 ${n} 次。`
      : k < K4
        ? `如果只用 ${l - 1} 個同位位元，只有 ${2 ** (l - 1) - 1} 種結果，卻要分辨 ${k + l - 1} 個位置，不夠；所以還是得用 ${l} 個同位位元。${l} 個有 ${outcomes} 種結果，這裡只用到 ${n} 種，${wasted} 種浪費掉。`
        : `${l} 個同位位元的 ${outcomes} 種結果全部用上，一種都沒浪費：這就是 ${l} 個同位位元最多能保護的資料量。`;

  return (
    <Card
      title={`資料位元 1–${K4} 個：各要幾個同位位元？`}
      actions={
        <>
          <Segmented
            ariaLabel="資料位元數"
            value={kStr}
            onChange={(v) => {
              setK(v);
              setFlips([]);
            }}
            options={(['1', '2', '3', '4'] as K[]).map((v) => ({ value: v, label: `${v} 位元` }))}
          />
          <ResetButton
            onClick={() => {
              setMsg([...DEFAULT_MESSAGE]);
              setFlips([]);
            }}
          />
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-700">
        資料少於 {K4} 個位元也行：只用 Hamming({hammingN(L)},{K4}) 排列的前 <M>n</M> 個位置（少掉的資料位元當成 0、不送出去）。{!presenting && '用上面的按鈕切換資料有幾個位元，看要付幾個同位位元，也可以點 codeword 製造一個錯，確認它照樣能修正。'}
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <div>
            <div className="mb-1 text-xs text-slate-500">資料{!presenting && '（點擊切換）'}</div>
            <div className="flex gap-1.5">
              {data.map((b, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setMsg(msg.map((x, j) => (j === i ? ((1 - x) as Bit) : x)));
                    setFlips([]);
                  }}
                  aria-label={`D${i + 1} = ${b}，點擊切換`}
                  className="flex w-10 flex-col items-center rounded-lg border-2 border-data-300 bg-data-50 py-1"
                >
                  <span className="text-[10px] font-semibold text-data-700">D{i + 1}</span>
                  <span className="font-mono text-lg font-bold">{b}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 text-xs text-slate-500">
              送出的 codeword：{n} 個位元，其中 {l} 個是同位位元{!presenting && '（點擊製造錯誤）'}
            </div>
            <div className="flex flex-wrap gap-1 sm:gap-1.5">
              {recv.map((b, j) => {
                const parity = LAYOUT_74[j].role === 'parity';
                const flipped = flips.includes(j);
                return (
                  <button
                    key={j}
                    type="button"
                    onClick={() => setFlips(flipped ? flips.filter((x) => x !== j) : [...flips, j])}
                    aria-label={`位置 ${j + 1} ${LAYOUT_74[j].label} = ${b}${flipped ? '（已翻轉）' : ''}，點擊翻轉`}
                    aria-pressed={flipped}
                    className={`flex w-10 flex-col items-center rounded-lg border-2 py-1 ${flipped ? 'border-rose-500 bg-rose-50' : parity ? 'border-parity-300 bg-parity-50' : 'border-data-300 bg-data-50'}`}
                  >
                    <span className={`text-[10px] font-semibold ${parity ? 'text-parity-700' : 'text-data-700'}`}>{LAYOUT_74[j].label}</span>
                    <span className={`font-mono text-lg font-bold ${flipped ? 'text-rose-600' : ''}`}>{b}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" aria-live="polite">
            {lamps === 0 ? (
              flips.length === 0 ? (
                <>所有檢查都通過：沒有錯。</>
              ) : (
                <>所有檢查都通過，但其實錯了 {flips.length} 個（錯誤剛好互相抵銷）。</>
              )
            ) : lamps <= n ? (
              <>
                失敗的檢查讀成 {lampOrder(l)} = <span className="font-mono font-bold">{bin(lamps, l)}₂</span> = {lamps} → 指向位置 {lamps}（{label(lamps)}），翻回來得到{' '}
                <span className="font-mono font-bold">{fixed.join('')}</span>
                {flips.length === 1 ? (fixed.join('') === sent.join('') ? <span className="text-emerald-700">　✓ 修正成功</span> : null) : <span className="text-rose-700">　✗ 錯了不只一個：誤更正</span>}
              </>
            ) : (
              <>
                失敗的檢查讀成 {lampOrder(l)} = <span className="font-mono font-bold">{bin(lamps, l)}₂</span> = {lamps}，但這種結果<strong>沒有對應的位置</strong>（是浪費掉的那幾種）→ 知道有錯，而且一定錯了不只一個。
              </>
            )}
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <div className="mb-1 text-xs text-slate-500">
              {l} 個同位位元 → {outcomes} 種「有錯」的檢查結果（{lampOrder(l)}），分給 {n} 個位置
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: outcomes }, (_, i) => i + 1).map((p) => (
                <span
                  key={p}
                  className={`rounded-md border px-2 py-1 font-mono text-xs ${p === lamps ? 'ring-2 ring-amber-400' : ''} ${p <= n ? 'border-sky-300 bg-sky-50 text-sky-800' : 'border-dashed border-slate-300 text-slate-500'}`}
                >
                  {bin(p, l)}₂ → {p <= n ? label(p) : '沒用到'}
                </span>
              ))}
            </div>
          </div>
          <p className="text-sm text-slate-700">{why}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-1 pr-2">資料</th>
                  <th className="pr-2">code</th>
                  <th className="pr-2">同位位元</th>
                  <th className="pr-2">每個資料位元配幾個同位位元</th>
                  <th>浪費的結果</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {[1, 2, 3, 4].map((kk) => {
                  const c = smallCode(kk);
                  return (
                    <tr key={kk} className={`border-t border-slate-100 ${kk === k ? 'bg-amber-50' : ''}`}>
                      <td className="py-1 pr-2">{kk}</td>
                      <td className="pr-2">
                        ({c.n},{kk})
                      </td>
                      <td className="pr-2">{c.l}</td>
                      <td className="pr-2">{c.perData.toFixed(2)}</td>
                      <td>{c.wasted}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
        <p>
          <strong>
            {K4} 個資料位元剛好用滿 {PATTERNS} 種結果。
          </strong>
          資料少於 {K4} 個位元也能修正錯誤，但同位位元省不下來：{K4 - 2} 或 {K4 - 1} 個資料位元一樣要 {MID.l} 個同位位元，等於花一樣的成本送更少的資料。只有降到 1 個資料位元才省成 {ONE.l} 個同位位元，可是那時同位位元是資料的 {ONE.l} 倍。所以 {K4} 是「{L} 個同位位元最划算」的資料量：每個資料位元只要配 {(L / K4).toFixed(2)} 個同位位元，而且 {PATTERNS} 種檢查結果一種都沒浪費。
        </p>
      </div>
    </Card>
  );
}

/** Data lengths 1..12: how many parity bits ℓ, and whether the 2^ℓ − 1 outcomes are used up exactly (closed by default). */
export function CodeSizeTable() {
  const rows = Array.from({ length: 12 }, (_, i) => {
    const k = i + 1;
    const l = checkBitsFor(k);
    const n = k + l;
    const outcomes = 2 ** l - 1;
    return { k, l, n, outcomes, full: n === outcomes, rate: k / n };
  });
  // the next data length after k = 4 needs one more parity bit; the next code that uses its outcomes up
  const next = rows[K4];
  return (
    <Expandable title="資料更多的話呢？">
      <div className="space-y-2">
        <p>
          規則和上面一樣：<M>{'\\ell'}</M> 個同位位元有 <M>{'2^\\ell - 1'}</M> 種「有錯」的檢查結果，要分給 <M>{'n = k + \\ell'}</M> 個位置（<M>k</M> 個資料位元加 <M>{'\\ell'}</M> 個同位位元），所以必須
        </p>
        <Tex block>{'k + \\ell \\le 2^\\ell - 1'}</Tex>
        <p>
          {[2, 3, 4].map((l, i) => (
            <span key={l}>
              {i > 0 && '；'}
              {l === L ? (
                <strong>
                  <M>{`\\ell = ${l}`}</M> 時 <M>k</M> 最多 {hammingK(l)}
                </strong>
              ) : (
                <>
                  <M>{`\\ell = ${l}`}</M> 時 <M>k</M> 最多 {hammingK(l)}
                </>
              )}
            </span>
          ))}
          。資料超過 {K4} 個位元，就要第 {L + 1} 個同位位元。
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1 pr-3">
                資料位元 <M>k</M>
              </th>
              <th className="pr-3">
                同位位元 <M>{'\\ell'}</M>
              </th>
              <th className="pr-3">
                code <M>(n, k)</M>
              </th>
              <th className="pr-3">
                可用結果 <M>{'2^\\ell - 1'}</M>
              </th>
              <th className="hidden pr-3 sm:table-cell">碼率 k/n</th>
              <th>用滿了嗎</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((x) => (
              <tr key={x.k} className={`border-t border-slate-100 ${x.k === K4 ? 'bg-emerald-50' : ''}`}>
                <td className="py-1 pr-3">{x.k}</td>
                <td className="pr-3">{x.l}</td>
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
      <div className="space-y-1">
        <p>
          資料一多到 {next.k} 個，如果還用 {L} 個同位位元，<M>{`n = ${next.k} + ${L} = ${next.k + L}`}</M> 已經超過 {PATTERNS} 種結果，只好加到 {next.l} 個同位位元（<M>{`n = ${next.n}`}</M>），一直到 ({hammingN(next.l)},{hammingK(next.l)}) 才又剛好用滿。
        </p>
        <p>
          ({hammingN(L)},{K4}) 是最常用來入門的 Hamming Code，因為它是除了重複碼之外<strong>最小的完整 Hamming Code</strong>：小到可以手算、畫成 Venn 圖，又已經有「重疊檢查定位錯誤」的全部精神。實際系統用的是更長的版本：家族表與 Hamming Bound 見
          <a href="#/distance" className="mx-1 font-semibold text-overall-700 hover:underline">
            第 4 章
          </a>
          ，訊息更長時怎麼切、長度對不上怎麼辦見
          <a href="#/l2-12" className="mx-1 font-semibold text-overall-700 hover:underline">
            第二課 2-12
          </a>
          。
        </p>
      </div>
    </Expandable>
  );
}
