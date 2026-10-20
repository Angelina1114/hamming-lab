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
    ['有限體', 'GF(8) = GF(2³)', 'GF(128) = GF(2⁷)'],
    ['本原多項式 g(x)（即生成多項式）', SMALL.tex, LARGE.tex],
    ['g(x) 是本原多項式？（程式驗證）', Fs.primitive ? `是（α 的階 = ${Fs.order}）` : '否', Fl.primitive ? `是（α 的階 = ${Fl.order}）` : '否'],
    ['Hamming Code (n, k, d)', `(${ps.n}, ${ps.k}, ${ps.dmin})`, `(${pl.n}, ${pl.k}, ${pl.dmin})`],
    ['Extended Hamming (n, k, d)', `(${ps.nExt}, ${ps.kExt}, ${ps.dminExt})`, `(${pl.nExt}, ${pl.kExt}, ${pl.dminExt})`],
    ['Code Rate（Hamming）', `${ps.k}/${ps.n} ≈ ${pct(ps.rate)}`, `${pl.k}/${pl.n} ≈ ${pct(pl.rate)}`],
    ['Code Rate（Extended）', `${ps.kExt}/${ps.nExt} = ${pct(ps.rateExt)}`, `${pl.kExt}/${pl.nExt} = ${pct(pl.rateExt)}`],
    ['同位檢查矩陣 H（Parity-check Matrix）',`${ps.hRows} × ${ps.hCols}`, `${pl.hRows} × ${pl.hCols}`],
    ['Syndrome 位元數 / LFSR 暫存器', `${ps.m}`, `${pl.m}`],
    ['查表大小（單錯 Syndrome）', `${ps.n} 筆`, `${pl.n} 筆`],
    ['串列 Syndrome（LFSR）時脈數', `${ps.n}`, `${pl.n}`],
    ['平行 Syndrome（XOR tree）2 輸入 XOR 閘數', `${xorParallel(small)}`, `${xorParallel(big)}`],
  ];

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          7 位元的例子適合手算，但效率只有 57%。實際系統用更長的 Hamming Code：碼長變長，同位位元只多一點點，效率就逼近 100%。同樣的演算法（LFSR、Syndrome、GF 運算、Chien Search）原封不動地放大。
        </p>
      }
      goals={[
        <>
          掌握 Hamming 參數公式 <M>{'n = 2^m - 1,\\ k = n - m,\\ d_{\\min} = 3'}</M>（m = 同位位元數；第一課第 5 章記作 r）
        </>,
        '比較 GF(8) 與 GF(128) 範例的 Code Rate 與矩陣大小',
        '估計 Syndrome 計算、查表與 Chien Search 的成本',
        '區分串列與平行硬體架構',
        '用縮短碼配合任意資料長度：ECC 記憶體的 (72, 64)',
        '比較「切成小塊」與「用一個長的 Hamming Code」：省下的位元 vs. 修不好的機率',
        '認識 400ZR FEC 中的 Hamming 內碼，並和教學範例區分',
      ]}
      intuition={{
        title: '同位位元只隨 log n 成長',
        body: (
          <div className="prose-lab">
            <p>
              m 個同位位元可以產生 <M>{'2^m - 1'}</M> 種非零 Syndrome，每一種對應一個錯誤位置。所以碼長加倍，只需要多 1 個同位位元——這就是長 Hamming Code 效率極高的原因。代價是：每個 codeword 仍然只能更正 1 個錯誤，而 code 越長，同一個 codeword 裡出現 2 個錯誤的機率越高（下面的互動範例會算出實際的機率）。
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
            <Card title="Hamming Code 的 Code Rate 隨 m 增加（%）">
              <Bars data={rates} xLabel="同位位元數 m" yLabel="Code Rate %" highlight={(x) => x === 'm=3' || x === 'm=7'} tooltipLabel={(x, y) => `${x}：${y}%`} />
              <p className="text-xs text-slate-500">藍色長條是本章比較的兩個 code（m = 3 與 m = 7）。</p>
            </Card>
            <ShortenedCalc />
            <FailureModel />
          </>
        ),
      }}
      algorithm={{
        title: '硬體架構：串列 vs 平行',
        body: (
          <>
            <AlgoSteps
              steps={[
                <>
                  <strong>串列（Serial）</strong>：一個 m 級 LFSR，每個時脈吃 1 個 bit。n = 127 時需要 127 個時脈才得到 Syndrome；面積極小（7 個暫存器 + 回授 XOR）。適合低速或面積受限的電路。
                </>,
                <>
                  <strong>平行（Parallel）</strong>：直接計算 <M>{'s = Hr^T'}</M>，每個 Syndrome 位元是 r 中某些位元的 XOR（XOR tree）。一個時脈完成，但需要上表中的大量 XOR 閘。高速通訊（數百 Gb/s）每個時脈要處理很多位元，通常採用平行或部分平行架構。
                </>,
                <>
                  <strong>錯誤定位</strong>：單錯 Hamming Code 可用 m → n 的解碼器（查表 / 組合邏輯）一次完成；Chien Search 則逐一測試 n 個位置，平行化需複製多份乘法器。
                </>,
                <>
                  <strong>緩衝區（Buffer）</strong>：Syndrome 算完前，接收字要先暫存；串列架構的延遲約為 n 個時脈。
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
              <p className="mt-1 text-xs text-slate-500">每列 32 位元；藍色 = 120 個資訊位元，橘色 = 最後 7 個同位位元，⚡ = 錯誤（可點擊任一格移動錯誤）。</p>
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
                { label: <>x⁷ + x³ + 1 是本原多項式（α 的階 = 127）</>, pass: Fl.primitive && Fl.order === 127 },
                { label: <>Hamming(127,120) codeword 被 g(x) 整除</>, pass: big.syndrome(c).every((b) => b === 0) },
                { label: <>錯誤位置 {errPos} 被正確定位並更正</>, pass: dec.position === errPos && dec.corrected.join('') === c.join('') },
                { label: <>Extended Hamming(128,120) Code Rate = 120/128 = 93.75%</>, pass: pl.rateExt === 0.9375 },
                { label: <>Hamming(7,4) Code Rate = 4/7 ≈ 57.14%</>, pass: pct(ps.rate) === '57.14%' },
                { label: <>64 位元資料：縮短成 (71, 64)，加整體同位位元 = (72, 64)</>, pass: shortenedHamming(64).n === 71 && shortenedHamming(64).nSecded === 72 },
                {
                  label: <>p = 10⁻³ 時一塊 (7,4) 修不好的機率 = 1 − (1−p)⁷ − 7p(1−p)⁶ ≈ 2.09 × 10⁻⁵</>,
                  pass: Math.abs(blockFailureProb(7, 1, 1e-3) - (1 - 0.999 ** 7 - 7e-3 * 0.999 ** 6)) < 1e-15,
                },
                { label: <>120 位元：30 塊 (7,4) 共送 210 位元；1 塊 (127,120) 只送 127 位元</>, pass: planBlocks(120, 3, 1e-3).sent === 210 && planBlocks(120, 7, 1e-3).sent === 127 },
              ]}
            />
            <Card title="延伸閱讀：400ZR 的 CFEC 與 Hamming 內碼">
              <div className="space-y-2 text-sm text-slate-700">
                <p>
                  OIF 400ZR（資料中心互連用的 400 Gb/s 相干光模組）採用串接式 FEC（Concatenated FEC, CFEC）：外碼是硬判決的 staircase code，內碼是以<strong>軟判決（soft-decision）</strong>解碼的 Hamming Code。公開的業界簡報描述其參數為：
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>內碼：double-extended Hamming (128,119)，使用 Chase 演算法做軟判決解碼。</li>
                  <li>外碼：staircase code，元件碼參數 (255,239)，硬判決解碼。</li>
                  <li>
                    由這兩組參數計算的總額外負擔：<M>{'\\frac{255}{239}\\cdot\\frac{128}{119} - 1'}</M> ≈ <strong>{pct(overhead)}</strong>（簡報記載約 14.8%），淨編碼增益約 10.8 dB。
                  </li>
                </ul>
              </div>
              <div className="mt-3">
                <Callout kind="warning" title="不要把 400ZR 的內碼當成本課程的解碼器">
                  <p>
                    本課程是<strong>硬判決</strong>：接收端先把每個訊號判成 0 或 1，再用 Syndrome 更正一個錯誤。400ZR 的內碼解碼器拿到的是每個位元的<strong>可靠度</strong>（例如 LLR），Chase 演算法會翻轉最不可靠的幾個位元產生候選字，各自做 Hamming 解碼，再依可靠度挑出最可能的 codeword；它的目標是降低交給外碼的錯誤率，而不是保證「恰好更正 1 個錯」。兩者共用 Hamming Code 的代數結構，但實作、輸入資訊與效能都不同。
                  </p>
                  <p>此外 (128,119) 與本章的 (128,120) 參數也不同（多了一個同位位元）。精確的規格請以 OIF-400ZR 實作協議原文為準。</p>
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
