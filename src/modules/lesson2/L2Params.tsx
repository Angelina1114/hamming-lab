import { useMemo, useState } from 'react';
import { Shuffle, ExternalLink } from 'lucide-react';
import { type Bit, CyclicHamming, bitsToInt, blockFailureProb, buildField, hammingParams, planBlocks, randomBits, rng, shortenedHamming } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, ResetButton } from '../../components/Lesson';
import { Bars } from '../../components/Bars';
import { AlgoSteps, Chapter, Checks } from '../../components/l2/Common';
import { FailureModel, ShortenedCalc, SplitVsLong } from '../../components/l2/Scaling';

const ID = 'l2-12';
const SMALL = { m: 3, poly: 0b1011, tex: 'x^3 + x + 1' };
const LARGE = { m: 7, poly: 0b10001001, tex: 'x^7 + x^3 + 1' };

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;

export default function L2Params() {
  const Fs = useMemo(() => buildField(SMALL.m, SMALL.poly), []);
  const Fl = useMemo(() => buildField(LARGE.m, LARGE.poly), []);
  const ps = hammingParams(3);
  const pl = hammingParams(7);
  const small = useMemo(() => new CyclicHamming(SMALL.m, SMALL.poly), []);
  const big = useMemo(() => new CyclicHamming(LARGE.m, LARGE.poly), []);

  const [seed, setSeed] = useState(7);
  const [errPos, setErrPos] = useState(42);
  const u = useMemo(() => randomBits(120, rng(seed)), [seed]);
  const c = useMemo(() => big.encode(u), [big, u]);
  const r = useMemo(() => c.map((b, i) => (i === errPos - 1 ? ((b ^ 1) as Bit) : b)), [c, errPos]);
  const dec = useMemo(() => big.decode(r), [big, r]);
  const S = dec.syndrome;
  const exponent = Fl.log[bitsToInt(S)];

  const xorParallel = (code: CyclicHamming) => code.hRowWeights().reduce((a, w) => a + (w - 1), 0);
  const rates = [3, 4, 5, 6, 7, 8, 9, 10].map((m) => ({ x: `m=${m}`, y: Math.round(hammingParams(m).rate * 1000) / 10 }));

  // 400ZR CFEC component codes (public presentation): outer staircase (255,239), inner (128,119) Hamming
  const overhead = (255 / 239) * (128 / 119) - 1;

  const rows: [string, string, string][] = [
    ['Finite field', 'GF(8) = GF(2³)', 'GF(128) = GF(2⁷)'],
    ['Primitive polynomial g(x)（即 generator polynomial）', SMALL.tex, LARGE.tex],
    ['g(x) 是 primitive polynomial？（程式驗證）', Fs.primitive ? `是，α 的 order（階）= ${Fs.order}` : '否', Fl.primitive ? `是，α 的 order = ${Fl.order}` : '否'],
    ['Hamming code (n, k, d)', `(${ps.n}, ${ps.k}, ${ps.dmin})`, `(${pl.n}, ${pl.k}, ${pl.dmin})`],
    ['Extended Hamming (n, k, d)', `(${ps.nExt}, ${ps.kExt}, ${ps.dminExt})`, `(${pl.nExt}, ${pl.kExt}, ${pl.dminExt})`],
    ['Code rate（Hamming）', `${ps.k}/${ps.n} ≈ ${pct(ps.rate)}`, `${pl.k}/${pl.n} ≈ ${pct(pl.rate)}`],
    ['Code rate（Extended）', `${ps.kExt}/${ps.nExt} = ${pct(ps.rateExt)}`, `${pl.kExt}/${pl.nExt} = ${pct(pl.rateExt)}`],
    ['Parity-check matrix H', `${ps.hRows} × ${ps.hCols}`, `${pl.hRows} × ${pl.hCols}`],
    ['Syndrome 位元數 / LFSR register', `${ps.m}`, `${pl.m}`],
    ['查表大小（單錯 syndrome）', `${ps.n} 筆`, `${pl.n} 筆`],
    ['Serial syndrome（LFSR）時脈數', `${ps.n}`, `${pl.n}`],
    ['Parallel syndrome（XOR tree）2 輸入 XOR 閘數', `${xorParallel(small)}`, `${xorParallel(big)}`],
  ];

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          7 位元的例子適合手算，但效率只有 57%。實際系統用更長的 Hamming code：code length 變長，parity bit 只多一點點，效率就逼近 100%。同樣的演算法（LFSR、syndrome、GF 運算、Chien search）原封不動地放大。
        </p>
      }
      goals={[
        <>
          掌握 Hamming 參數公式 <M>{'n = 2^m - 1,\\ k = n - m,\\ d_{\\min} = 3'}</M>（m = parity bit 數；<a className="text-indigo-700 underline" href="#/distance">第一課第 4 章</a>記作 ℓ）
        </>,
        '比較 GF(8) 與 GF(128) 範例的 code rate（碼率）與矩陣大小',
        '估計 syndrome 計算、查表與 Chien search 的成本',
        '區分 serial（串列）與 parallel 硬體架構',
        '用 shortened code（縮短碼）配合任意資料長度：ECC（error-correcting code，錯誤更正碼）記憶體的 (72, 64)',
        '比較「切成小塊」與「用一個長的 Hamming code」：省下的位元 vs. 修不好的機率',
        '認識 400ZR FEC 中當作 inner code 的 Hamming code，並和教學範例區分',
      ]}
      intuition={{
        title: 'Parity bit 只隨 log n 成長',
        body: (
          <div className="prose-lab">
            <p>
              m 個 parity bit 可以產生 <M>{'2^m - 1'}</M> 種非零 syndrome，每一種對應一個錯誤位置。所以 code length 加倍，只需要多 1 個 parity bit——這就是長 Hamming code 效率極高的原因。代價是：每個 codeword 仍然只能更正 1 個錯誤，而 code 越長，同一個 codeword 裡出現 2 個錯誤的機率越高（下面的互動範例會算出實際的機率）。
            </p>
          </div>
        ),
      }}
      math={{
        title: '參數公式與比較',
        body: (
          <>
            <Card>
              <Tex block>{'n = 2^m - 1,\\quad k = 2^m - 1 - m,\\quad d_{\\min} = 3,\\quad R = \\frac{k}{n} = 1 - \\frac{m}{2^m - 1}\\;\\xrightarrow{m\\to\\infty}\\; 1'}</Tex>
              <Tex block>{'\\text{Extended: } (2^m,\\ 2^m - 1 - m,\\ 4),\\qquad H_{\\text{Hamming}} \\in \\mathbb{F}_2^{\\,m \\times (2^m - 1)}'}</Tex>
            </Card>
            <Card title="小型教學範例 vs 實際較大型範例（全部欄位由程式計算）">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">項目</th>
                      <th>教學範例</th>
                      <th>較大型範例</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(([k, a, b]) => (
                      <tr key={k} className="border-t border-slate-100">
                        <td className="py-1.5 text-slate-600">{k}</td>
                        <td className="font-mono">{a}</td>
                        <td className="font-mono font-semibold">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Card title="Hamming code 的 code rate 隨 m 增加（%）">
              <Bars data={rates} xLabel="Parity bit 數 m" yLabel="Code rate %" highlight={(x) => x === 'm=3' || x === 'm=7'} tooltipLabel={(x, y) => `${x}：${y}%`} />
              <p className="text-xs text-slate-500">藍色長條是本章比較的兩個 code（m = 3 與 m = 7）。</p>
            </Card>
            <ShortenedCalc />
            <FailureModel />
          </>
        ),
      }}
      algorithm={{
        title: '硬體架構：serial vs parallel',
        body: (
          <>
            <AlgoSteps
              steps={[
                <>
                  <strong>Serial</strong>：一個 m 級 LFSR，每個時脈吃 1 個 bit。n = 127 時需要 127 個時脈才得到 syndrome；面積極小（7 個 register + feedback XOR）。適合低速或面積受限的電路。
                </>,
                <>
                  <strong>Parallel</strong>：直接計算 <M>{'s = Hr^T'}</M>，每個 syndrome 位元是 r 中某些位元的 XOR（XOR tree）。一個時脈完成，但需要上表中的大量 XOR 閘。高速通訊（數百 Gb/s）每個時脈要處理很多位元，通常採用 parallel 或部分 parallel 架構。
                </>,
                <>
                  <strong>錯誤定位</strong>：單錯 Hamming code 可用 m → n 的 decoder（查表 / 組合邏輯）一次完成；Chien search 則逐一測試 n 個位置，做成 parallel 電路需複製多份乘法器。
                </>,
                <>
                  <strong>Buffer</strong>：syndrome 算完前，received word 要先暫存；serial 架構的延遲約為 n 個時脈。
                </>,
              ]}
            />
          </>
        ),
      }}
      interactive={{
        title: 'Hamming(127,120) 實際運算與長度取捨',
        body: (
          <div className="space-y-6">
            <Card
              title="隨機產生 120 位元訊息，在任意位置注入單一錯誤"
              actions={
                <>
                  <button className="btn-ghost" onClick={() => setSeed((s) => s + 1)}>
                    <Shuffle className="h-3.5 w-3.5" /> 新訊息
                  </button>
                  <ResetButton
                    onClick={() => {
                      setSeed(7);
                      setErrPos(42);
                    }}
                  />
                </>
              }
            >
              <label className="mb-3 block text-sm">
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>錯誤位置（從左數，1 = x¹²⁶ … 127 = x⁰）</span>
                  <span className="font-mono text-base font-bold text-slate-900">{errPos}</span>
                </div>
                <input type="range" min={1} max={127} value={errPos} onChange={(e) => setErrPos(Number(e.target.value))} className="w-full accent-slate-900" aria-label="錯誤位置" />
              </label>
              <div className="overflow-x-auto">
                <div className="grid w-max gap-[2px]" style={{ gridTemplateColumns: 'repeat(32, 14px)' }}>
                  {r.map((b, i) => {
                    const isErr = i === errPos - 1;
                    const isParity = i >= 120;
                    return (
                      <button
                        key={i}
                        title={`位置 ${i + 1}，x^${126 - i}${isErr ? '（錯誤）' : ''}`}
                        onClick={() => setErrPos(i + 1)}
                        className={`grid h-[14px] w-[14px] place-items-center rounded-[3px] font-mono text-[8px] font-bold ${
                          isErr ? 'bg-rose-500 text-white' : isParity ? (b ? 'bg-parity-500 text-white' : 'bg-parity-100 text-parity-700') : b ? 'bg-data-500 text-white' : 'bg-data-50 text-data-300'
                        }`}
                      >
                        {isErr ? '⚡' : b}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-1 text-xs text-slate-500">每列 32 位元；藍色 = 120 個 data bit，橘色 = 最後 7 個 parity bit，⚡ = 錯誤（可點擊任一格移動錯誤）。</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Syndrome（7 位元）</div>
                  <div className="font-mono text-xl font-bold">{S.join('')}</div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">GF(128) 元素</div>
                  <div className="text-xl font-bold">
                    <M>{`\\alpha^{${exponent}}`}</M>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">定位結果</div>
                  <div className="text-xl font-bold">位置 {dec.position}</div>
                  <div className={dec.corrected.join('') === c.join('') ? 'text-xs text-emerald-700' : 'text-xs text-rose-700'}>{dec.corrected.join('') === c.join('') ? '✓ 更正後 = 原 codeword' : '✗'}</div>
                </div>
              </div>
            </Card>
            <SplitVsLong />
          </div>
        ),
      }}
      verify={{
        title: '驗證與延伸：400ZR FEC',
        body: (
          <>
            <Checks
              items={[
                { label: <>x⁷ + x³ + 1 是 primitive polynomial（α 的 order = 127）</>, pass: Fl.primitive && Fl.order === 127 },
                { label: <>Hamming(127,120) codeword 被 g(x) 整除</>, pass: big.syndrome(c).every((b) => b === 0) },
                { label: <>錯誤位置 {errPos} 被正確定位並更正</>, pass: dec.position === errPos && dec.corrected.join('') === c.join('') },
                { label: <>Extended Hamming(128,120) 的 code rate = 120/128 = 93.75%</>, pass: pl.rateExt === 0.9375 },
                { label: <>Hamming(7,4) 的 code rate = 4/7 ≈ 57.14%</>, pass: pct(ps.rate) === '57.14%' },
                { label: <>64 位元資料：縮短成 (71, 64)，加 overall parity bit = (72, 64)</>, pass: shortenedHamming(64).n === 71 && shortenedHamming(64).nSecded === 72 },
                {
                  label: <>p = 10⁻³ 時一塊 (7,4) 修不好的機率 = 1 − (1−p)⁷ − 7p(1−p)⁶ ≈ 2.09 × 10⁻⁵</>,
                  pass: Math.abs(blockFailureProb(7, 1, 1e-3) - (1 - 0.999 ** 7 - 7e-3 * 0.999 ** 6)) < 1e-15,
                },
                { label: <>120 位元：30 塊 (7,4) 共送 210 位元；1 塊 (127,120) 只送 127 位元</>, pass: planBlocks(120, 3, 1e-3).sent === 210 && planBlocks(120, 7, 1e-3).sent === 127 },
              ]}
            />
            <Card title="延伸閱讀：400ZR 的 CFEC 與 Hamming inner code">
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  OIF 400ZR（資料中心互連用的 400 Gb/s 相干光模組）採用 concatenated FEC（CFEC，串接式 FEC）：outer code（外碼）是採用 hard decision（硬判決）的 staircase code，inner code 是以 <strong>soft decision（軟判決）</strong>解碼的 Hamming code。公開的業界簡報描述其參數為：
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Inner code：double-extended Hamming (128,119)，使用 Chase 演算法做 soft-decision 解碼。</li>
                  <li>Outer code：staircase code，component code（元件碼）參數 (255,239)，hard-decision 解碼。</li>
                  <li>
                    由這兩組參數計算的總額外負擔：<M>{'\\frac{255}{239}\\cdot\\frac{128}{119} - 1'}</M> ≈ <strong>{pct(overhead)}</strong>（簡報記載約 14.8%），淨編碼增益約 10.8 dB。
                  </li>
                </ul>
              </div>
              <div className="mt-3">
                <Callout kind="warning" title="不要把 400ZR 的 inner code 當成本課程的 decoder">
                  <p>
                    本課程用的是 <strong>hard decision</strong>：接收端先把每個訊號判成 0 或 1，再用 syndrome 更正一個錯誤。400ZR 的 inner code decoder 拿到的是每個位元的<strong>可靠度</strong>（例如 LLR），Chase 演算法會翻轉最不可靠的幾個位元產生候選字，各自做 Hamming 解碼，再依可靠度挑出最可能的 codeword；它的目標是降低交給 outer code 的 error rate（錯誤率），而不是保證「恰好更正 1 個錯」。兩者共用 Hamming code 的代數結構，但實作、輸入資訊與效能都不同。
                  </p>
                  <p>此外 (128,119) 與本章的 (128,120) 參數也不同（多了一個 parity bit）。精確的規格請以 OIF-400ZR 實作協議原文為準。</p>
                </Callout>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <a className="inline-flex items-center gap-1 text-indigo-700 underline" href="https://grouper.ieee.org/groups/802/3/B10K/public/18_09/lyubomirsky_b10k_01a_0918.pdf" target="_blank" rel="noreferrer">
                  IEEE 802.3 B10K（Lyubomirsky, 2018）<ExternalLink className="h-3 w-3" />
                </a>
                <a className="inline-flex items-center gap-1 text-indigo-700 underline" href="https://www.lightwaveonline.com/optical-tech/transmission/article/14280465/what-is-fec" target="_blank" rel="noreferrer">
                  Lightwave: What the FEC? <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </Card>
          </>
        ),
      }}
      next={
        <p>
          所有零件都齊了。下一章把它們組裝成一個完整的實驗室：輸入訊息、看 LFSR 編碼、注入 0–3 個錯誤、用兩種方法解碼、切換 SECDED，所有結果同步更新。
        </p>
      }
    />
  );
}
