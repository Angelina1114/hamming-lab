import { useMemo, useState } from 'react';
import { type BlockPlan, binomial, hammingK, pairCount, planBlocks, scalingTable, shortenedHamming, shortenedPositions, uncodedFailure } from '../../core';
import { M, Tex } from '../Tex';
import { Callout, Card, Segmented } from '../Lesson';
import { Checks } from './Common';

/** 6.28e-4 → "6.3 \times 10^{-4}"; 0.0736 → "7.4\%"; never rounds up to a misleading 100% */
export function probTex(x: number): string {
  if (x === 0) return '0';
  if (x > 0.999) return '> 99.9\\%';
  if (x >= 0.01) return `${(x * 100).toFixed(1)}\\%`;
  const e = Math.floor(Math.log10(x));
  const m = x / 10 ** e;
  return `${m.toFixed(1)} \\times 10^{${e}}`;
}

const planLabel = (b: BlockPlan) => {
  const full = b.fullBlocks > 0 ? `${b.fullBlocks} 塊 (${b.parentN}, ${b.parentK})` : '';
  const tail = b.tail > 0 ? `${full ? ' + ' : ''}1 塊縮短的 (${b.tail + b.r}, ${b.tail})` : '';
  return full + tail;
};

const LENGTHS = ['64', '120', '512', '4096'] as const;
const BERS = [
  { value: '1e-2', label: '10⁻²' },
  { value: '1e-3', label: '10⁻³' },
  { value: '1e-4', label: '10⁻⁴' },
  { value: '1e-6', label: '10⁻⁶' },
] as const;

/** Same L data bits, protected by Hamming Codes of different sizes. */
export function SplitVsLong() {
  const [len, setLen] = useState<(typeof LENGTHS)[number]>('120');
  const [ber, setBer] = useState<(typeof BERS)[number]['value']>('1e-3');
  const L = Number(len);
  const p = Number(ber);
  const rows = useMemo(() => scalingTable(L, p), [L, p]);
  const raw = uncodedFailure(L, p);
  const maxSent = Math.max(...rows.map((b) => b.sent));
  const first = rows[0];
  const last = rows[rows.length - 1];
  const saved = 1 - last.sent / first.sent;
  const worse = last.pAnyFail / first.pAnyFail;
  const limit = pairCount(L, last.r) / pairCount(L, first.r);
  const times = (x: number) => (x >= 10 ? x.toFixed(0) : x.toFixed(1));

  return (
    <Card title="訊息更長：切成很多小塊，還是用一個大的 Hamming code？">
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">資料長度 L</span>
          <Segmented ariaLabel="資料長度 L" value={len} onChange={setLen} options={LENGTHS.map((v) => ({ value: v, label: v }))} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">每個位元出錯的機率 p</span>
          <Segmented ariaLabel="每個位元出錯的機率 p" value={ber} onChange={setBer} options={BERS.map((b) => ({ value: b.value, label: b.label }))} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-1.5 pr-2">m</th>
              <th className="pr-2">怎麼切</th>
              <th className="pr-2">送出位元</th>
              <th className="pr-2">額外負擔</th>
              <th>至少一塊修不好</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-100 text-slate-500">
              <td className="py-1.5 pr-2">—</td>
              <td className="pr-2">不編碼</td>
              <td className="pr-2 font-mono">{L}</td>
              <td className="pr-2 font-mono">0%</td>
              <td>
                <M>{probTex(raw)}</M>
              </td>
            </tr>
            {rows.map((b) => (
              <tr key={b.r} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 font-mono">{b.r}</td>
                <td className="pr-2">{planLabel(b)}</td>
                <td className="pr-2">
                  <div className="flex items-center gap-2">
                    <span className="w-12 font-mono">{b.sent}</span>
                    <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 sm:block">
                      <span className="block h-full rounded-full bg-data-500" style={{ width: `${(b.sent / maxSent) * 100}%` }} />
                    </span>
                  </div>
                </td>
                <td className="pr-2 font-mono">{(b.overhead * 100).toFixed(1)}%</td>
                <td>
                  <M>{probTex(b.pAnyFail)}</M>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 1 && first.pAnyFail >= 0.5 && (
        <p className="mt-3 text-sm text-slate-700">
          這個通道太吵：連最短的 (7, 4) 都有 <M>{probTex(first.pAnyFail)}</M> 的機率至少一塊修不好。這時換長度沒有用，需要能修多個錯的 code。
        </p>
      )}
      {rows.length > 1 && first.pAnyFail < 0.5 && (
        <p className="mt-3 text-sm text-slate-700">
          同樣送 {L} 個 data bit：改用 m = {last.r}（{planLabel(last)}）比全部切成 (7, 4) 少送 <strong>{(saved * 100).toFixed(0)}%</strong> 的位元，但至少一塊修不好的機率從 <M>{probTex(first.pAnyFail)}</M> 變成 <M>{probTex(last.pAnyFail)}</M>（約 <strong>{times(worse)} 倍</strong>；p 越小，這個倍數越接近 {times(limit)}）。
        </p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        假設每個位元獨立、以機率 p 翻轉。每一塊 Hamming code 只能修 1 個錯，一塊裡有 2 個以上的錯就算「修不好」（decoder 會改錯或沒改對）。長度除不盡時，最後一塊用 shortened code（見上面「長度對不上」）。全部由程式即時計算。
      </p>
      <div className="mt-3">
        <Callout kind="key" title="取捨">
          <p>
            code 越長，parity bit 的比例越低（省頻寬），但一塊裡同時出現 2 個錯的機率越高。切換 p 會發現：<strong>倍數</strong>幾乎不隨 p 改變——p 很小時兩種做法修不好的機率都正比於 <M>{'p^2'}</M>（見上面「一塊修不好的機率」），改變的是<strong>絕對大小</strong>。所以真正要問的是「這個機率能不能接受」：p 很小時，就算用最長的 code，修不好的機率也可能小到可以接受，省下的頻寬就值得；p 很大、訊息又長時，連 (7, 4) 都常常有某塊修不好，這時該換的不是長度，而是能修多個錯的 code（BCH、Reed–Solomon、LDPC）。
          </p>
        </Callout>
      </div>
    </Card>
  );
}

const KS = ['4', '8', '16', '32', '64', '128'] as const;

/** Shortened Hamming Code for an arbitrary number of data bits. */
export function ShortenedCalc() {
  const [kStr, setKStr] = useState<(typeof KS)[number]>('64');
  const k = Number(kStr);
  const sp = shortenedHamming(k);
  const pos = useMemo(() => shortenedPositions(k), [k]);
  const removed = new Set(pos.removed);
  const small = sp.parentN <= 31;
  const cols = Array.from({ length: sp.parentN }, (_, i) => i + 1);
  const keptCols = pos.kept.map((j) => j.toString(2));

  return (
    <Card title="長度對不上：shortened Hamming code">
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          Hamming code 的資料長度只能是 <M>{'k = 2^m - m - 1'}</M>（4、11、26、57、120、247…）。要送剛好 <M>k</M> 個位元時，取最小的 <M>m</M> 使 <M>{'2^m - m - 1 \\ge k'}</M>，把多出來的 <M>{'\\Delta'}</M> 個 data bit <strong>固定成 0、不送出去</strong>：兩邊都知道它們是 0，所以不必傳。
        </p>
        <p>
          在 H 裡，這等於<strong>刪掉那 <M>{'\\Delta'}</M> 欄</strong>。剩下的欄仍然非零、兩兩相異，所以任一個單一錯誤仍然對應到唯一的一欄：shortened code 一樣能修 1 個錯（<M>{'d_{\\min} \\ge 3'}</M>），參數從 <M>{'(2^m - 1,\\ 2^m - m - 1)'}</M> 變成 <M>{'(2^m - 1 - \\Delta,\\ 2^m - m - 1 - \\Delta)'}</M>。
        </p>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500">Data bit 數 k</span>
        <Segmented value={kStr} onChange={setKStr} options={KS.map((v) => ({ value: v, label: v }))} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">需要的 parity bit 數 m</div>
          <div className="text-xl font-bold">{sp.r}</div>
          <div className="text-xs text-slate-500">
            <M>{`2^{${sp.r - 1}} - ${sp.r - 1} - 1 = ${hammingK(sp.r - 1)} < ${k} \\le ${sp.parentK} = 2^{${sp.r}} - ${sp.r} - 1`}</M>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="text-xs text-slate-500">
            從 ({sp.parentN}, {sp.parentK}) 刪掉 Δ = {sp.shortenedBy} 個 data bit
          </div>
          <div className="text-xl font-bold">
            ({sp.n}, {k})
          </div>
          <div className="text-xs text-slate-500">Code rate {(sp.rate * 100).toFixed(1)}%</div>
        </div>
        <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3">
          <div className="text-xs text-slate-500">
            再加 1 個 overall parity bit（SECDED，<a href="#/secded" className="underline">第一課第 5 章</a>；第二課 2-11）
          </div>
          <div className="text-xl font-bold">
            ({sp.nSecded}, {k})
          </div>
          <div className="text-xs text-slate-500">Code rate {(sp.rateSecded * 100).toFixed(1)}%</div>
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs text-slate-500">
          H 的 {sp.parentN} 欄（第 j 欄 = j 的二進位，最低位在上）：<span className="text-parity-600">橘色</span> = parity bit，<span className="text-data-600">藍色</span> = data bit，<span className="text-slate-400">灰色</span> = 縮短時刪掉的欄
        </div>
        <p className="mb-2 text-xs text-slate-500">
          這裡用<a href="#/matrix" className="underline">第一課第 2 章</a>的標準排列（parity bit 在 1, 2, 4, … 的位置），刪掉的是編號最大的 Δ 個 data bit 欄。下面互動範例的 cyclic Hamming(127,120) 用第二課的排列（parity bit 在最後 {sp.r} 位，位置 p 的欄是 <M>{'\\alpha^{n-p}'}</M>）。兩者只差在欄的順序，是 equivalent code（等價碼）；在 cyclic code 的排列裡，縮短 = 把最左邊、最高次的 Δ 個 data bit 固定為 0。
        </p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 p-2">
          <div className="grid w-max gap-[2px]" style={{ gridTemplateColumns: `repeat(${sp.parentN}, ${small ? 18 : 7}px)` }}>
            {Array.from({ length: sp.r }, (_, row) =>
              cols.map((j) => {
                const bit = (j >> row) & 1;
                const gone = removed.has(j);
                const parity = (j & (j - 1)) === 0;
                const tone = gone ? (bit ? 'bg-slate-300' : 'bg-slate-100') : parity ? (bit ? 'bg-parity-500 text-white' : 'bg-parity-100 text-parity-700') : bit ? 'bg-data-500 text-white' : 'bg-data-50 text-data-300';
                return (
                  <div
                    key={`${row}-${j}`}
                    title={`第 ${j} 欄${gone ? '（刪掉）' : ''}`}
                    className={`grid place-items-center rounded-[2px] font-mono text-[10px] font-bold ${small ? 'h-[18px]' : 'h-[7px]'} ${tone} ${gone && small ? 'line-through opacity-60' : ''}`}
                  >
                    {small ? bit : null}
                  </div>
                );
              }),
            )}
          </div>
        </div>
      </div>

      <div className="mt-3">
        <Checks
          items={[
            { label: <>保留 {pos.kept.length} 欄 = k + m = {k} + {sp.r}</>, pass: pos.kept.length === k + sp.r },
            { label: <>{sp.r} 個 parity bit 的欄（1, 2, 4, …）全部保留</>, pass: Array.from({ length: sp.r }, (_, i) => 2 ** i).every((j) => !removed.has(j)) },
            { label: <>保留的欄都非零、兩兩相異 → 單一錯誤仍可定位</>, pass: new Set(keptCols).size === keptCols.length && pos.kept.every((j) => j > 0) },
          ]}
        />
      </div>

      {k === 64 && (
        <div className="mt-3">
          <Callout kind="info" title="實例：電腦的 ECC 記憶體">
            <p>
              伺服器常用的 ECC 記憶體一次讀寫 72 位元：64 位元資料 + 8 個 parity bit。這正是上面的 (72, 64)：從 Hamming(127,120) 縮短成 (71, 64)，再加一個 overall parity bit，做到「修 1 個錯、偵測 2 個錯」。實際晶片常用 Hsiao 提出的變形 SECDED code（H 的欄都選奇數個 1，硬體更省），參數一樣是 (72, 64)。
            </p>
          </Callout>
        </div>
      )}
    </Card>
  );
}

/** The probability model behind SplitVsLong, with the L = 120 example worked out. */
export function FailureModel() {
  const L = 120;
  const short = planBlocks(L, 3, 0);
  const long = planBlocks(L, 7, 0);
  const a = pairCount(L, 3);
  const b = pairCount(L, 7);
  return (
    <Card title="一塊修不好的機率">
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          假設每個位元獨立、以機率 <M>p</M> 翻轉。一塊長度 <M>n</M> 的 Hamming code 只能修 1 個錯，所以「修不好」= 這塊裡有 2 個以上的錯：
        </p>
        <Tex block>{'P_{\\text{fail}}(n) = \\sum_{i \\ge 2} \\binom{n}{i} p^i (1-p)^{n-i} = 1 - (1-p)^n - np(1-p)^{n-1} \\;\\approx\\; \\binom{n}{2} p^2 \\quad (p \\text{ 很小})'}</Tex>
        <p>訊息切成好幾塊 <M>{'n_1, n_2, \\dots'}</M>，各塊獨立；只要有一塊修不好，訊息就錯了：</p>
        <Tex block>{'P_{\\text{any}} = 1 - \\prod_b \\bigl(1 - P_{\\text{fail}}(n_b)\\bigr) \\;\\approx\\; p^2 \\sum_b \\binom{n_b}{2}'}</Tex>
        <p>
          例：L = {L} 個 data bit。切成 {short.blocks} 塊 (7, 4)：<M>{`\\sum_b \\binom{n_b}{2} = ${short.blocks} \\times ${binomial(7, 2)} = ${a}`}</M>；用 {long.blocks} 塊 (127, 120)：<M>{`\\binom{127}{2} = ${b}`}</M>。
          所以 p 很小時，兩者修不好的機率比值趨近 <M>{`${b} / ${a} \\approx ${(b / a).toFixed(1)}`}</M>，<strong>跟 p 無關</strong>；p 只決定兩個機率本身有多小。下面「互動範例」的表格就是用這兩條式子（不取近似）算的。
        </p>
      </div>
    </Card>
  );
}
