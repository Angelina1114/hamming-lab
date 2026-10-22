import { useState, type ReactNode } from 'react';
import { type Bit, H74, K4, LAYOUT_74, N7, PARITY_CHECKS, checkBitsFor, column, decode74, encode74, encode74ByParity, hammingK, hammingN } from '../../core';
import { useMessage } from '../../lib/store';
import { M, Tex } from '../../components/Tex';
import { MessageInput } from '../../components/Bits';
import { Venn } from '../../components/Venn';
import { MessageSizeLab } from '../../components/WhySevenFour';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal, sub } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** 3 checks, 7 positions, 4 information bits */
const R = PARITY_CHECKS.length;
const N = N7;
const K = K4;
/** non-zero failure patterns of r checks: 2^r − 1 */
const PATTERNS = 2 ** R - 1;
/** one check fewer: 2² − 1 patterns for k + 2 positions */
const TWO = { r: R - 1, patterns: 2 ** (R - 1) - 1, positions: K + R - 1 };
/** positions each check watches (data bits + its own parity bit) */
const COVER = PARITY_CHECKS[0].covered.length;
const positionsOf = (role: 'data' | 'parity') =>
  LAYOUT_74.filter((p) => p.role === role)
    .map((p) => p.position)
    .join('、');
const DATA_POS = positionsOf('data');
const PARITY_POS = positionsOf('parity');
const bin = (j: number) => j.toString(2).padStart(R, '0');
/** names of the checks that watch position j (1-based) */
const watchers = (j: number) =>
  PARITY_CHECKS.filter((pc) => pc.covered.includes(j - 1))
    .map((pc) => pc.name)
    .join('、');
const eqText = (k: number) => `${PARITY_CHECKS[k].name} = ${PARITY_CHECKS[k].dataTerms.join(' ⊕ ')}`;
const coveredText = (k: number) => PARITY_CHECKS[k].covered.map((i) => i + 1).join('、');
/** worked examples: an error at position 5 (overlap slide), the coverage of position 6 */
const ERR_POS = 5;
const COVER_POS = 6;
/** k = 1 needs 2 checks: that code is the 3-fold repetition code */
const R_FOR_ONE = checkBitsFor(1);
const N_REPEAT = hammingN(R_FOR_ONE);
/** the next data length needs one more check; the next full Hamming Code */
const NEXT_R = checkBitsFor(K + 1);

/* ------------------------------------------------------------------ */
/* 第 1 章：Hamming(7,4) 編碼                                          */
/* ------------------------------------------------------------------ */

const SINGLE = ['D1', 'D2', 'D3', 'D4', 'P'];

function OverlapIdeaSlide({ s }: { s: Stepper }) {
  // r = 1 is the single parity bit of the first box; the table starts at 2 (not enough) and ends at 3 (exactly enough)
  const counts = [R - 1, R].map((x) => ({ r: x, patterns: 2 ** x - 1, positions: K + x }));
  // worked example: an error at position 5 fails exactly the checks in column 5 of H (P1 on top)
  const pattern = column(H74, ERR_POS - 1);
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
                  <th className="font-normal">位置數 {K} + r</th>
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
              位置數 = {K} 個資訊 + <M>r</M> 個同位
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-amber-50 text-amber-950" title="怎麼重疊：位置寫成二進位">
            <p className="text-lg">
              1–{N} 的二進位剛好是 {N} 種非零組合：檢查 <M>{'P_b'}</M> 負責二進位含有 <M>b</M> 的位置。
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
                  <td className="whitespace-nowrap text-left text-slate-600">位置 {ERR_POS} 錯</td>
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
                    <M>{`= ${ERR_POS}`}</M>
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
          <Box tone="bg-parity-50" title={<span className="text-parity-700">同位位元放在位置 {PARITY_POS}（2 的冪次）</span>}>
            <p className="text-lg">二進位只有一個 1 → 每個同位位元只在一個檢查裡，直接用資訊位元算出：</p>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {eqs.map((e) => (
                <Tex key={e}>{e}</Tex>
              ))}
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 4}>
          <Box tone="bg-emerald-50 text-emerald-950" title={`結果：Hamming(${N},${K})`}>
            <p>
              <span className="font-semibold text-data-700">{K} 個資訊位元</span> + <span className="font-semibold text-parity-700">{R} 個同位位元</span>
            </p>
            <p>能找出並修正任何 1 個錯誤</p>
            <p className="text-lg text-slate-600">
              碼率 <M>{`R = ${K}/${N} \\approx ${(K / N).toFixed(2)}`}</M>（三重重複碼 <M>{`1/${N_REPEAT}`}</M>）
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

function CoverageSlide() {
  return (
    <div className="space-y-5 text-xl">
      <p>
        把位置 1–{N} 寫成二進位。檢查 <M>{'P_b'}</M> 負責「二進位含有 b」的位置（b = 1, 2, 4），同位位元放在位置 {PARITY_POS}：
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-xl">
          <thead>
            <tr className="text-base text-slate-500">
              <th className="py-1 text-left">位置</th>
              {LAYOUT_74.map((p) => (
                <th key={p.index} className={p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}>
                  {p.position}
                  <div className="text-sm font-normal">{p.label}</div>
                </th>
              ))}
            </tr>
            <tr className="font-mono text-base text-slate-400">
              <th className="text-left font-sans font-normal">二進位</th>
              {LAYOUT_74.map((p) => (
                <th key={p.index} className="font-normal">
                  {bin(p.position)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PARITY_CHECKS.map((pc) => (
              <tr key={pc.name} className="border-t border-slate-100">
                <td className="py-2 text-left font-semibold text-parity-700">{pc.name}</td>
                {LAYOUT_74.map((p) => (
                  <td key={p.index}>{pc.covered.includes(p.index) ? <span className="inline-block h-4 w-4 rounded-full bg-parity-500" /> : <span className="text-slate-200">·</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-lg text-slate-600">
        每個位置被一組不同的檢查管到：錯在哪裡，「哪些檢查失敗」就不一樣。{R} 個檢查有 2<sup>{R}</sup> − 1 = {PATTERNS} 種組合，剛好給 {N} 個位置。
      </p>
    </div>
  );
}

function EncodeSlide({ s }: { s: Stepper }) {
  const { message, toggleBit } = useMessage();
  const enc = encode74ByParity(message);
  const shown = (i: number) => LAYOUT_74[i].role === 'data' || PARITY_CHECKS.findIndex((pc) => pc.parityIndex === i) < s.step;
  const eq = (k: number) => {
    const p = enc.parities[k];
    return `${sub(p.name)} = ${p.terms.map((t) => sub(t.label)).join(' \\oplus ')} = ${p.terms.map((t) => t.value).join(' \\oplus ')} = ${p.value}`;
  };
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-end gap-6">
        <MessageInput message={message} onToggle={toggleBit} />
        <span className="text-3xl text-slate-300">→</span>
        <div className="flex gap-1.5">
          {enc.codeword.map((b, i) => (
            <div key={i} className={`flex w-12 flex-col items-center rounded-lg border-2 py-1 ${LAYOUT_74[i].role === 'parity' ? 'border-parity-300 bg-parity-50' : 'border-data-300 bg-data-50'}`}>
              <span className={`text-xs font-semibold ${LAYOUT_74[i].role === 'parity' ? 'text-parity-700' : 'text-data-700'}`}>{LAYOUT_74[i].label}</span>
              <span className="font-mono text-2xl font-bold">{shown(i) ? b : '?'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {PARITY_CHECKS.map((_, k) =>
          k < s.step ? (
            <div key={k} className="rounded-xl bg-parity-50 px-4 py-2">
              <Tex>{eq(k)}</Tex>
            </div>
          ) : null,
        )}
      </div>
      <p className="text-lg text-slate-600">
        {s.step === 0 && `先把 ${K} 個資訊位元放進位置 ${DATA_POS}，再逐一算出 ${PARITY_CHECKS.map((pc) => pc.name).join('、')}：每個檢查管到的位元要有偶數個 1。`}
        {s.step > 0 && s.step <= R && `算出 ${PARITY_CHECKS[s.step - 1].name}：讓它管的 ${COVER} 個位置有偶數個 1。`}
        {s.step === R + 1 && (
          <>
            完成！訊息 {message.join('')} 編成 codeword <strong className="mono">{enc.codeword.join('')}</strong>。
          </>
        )}
      </p>
    </div>
  );
}

function VennSlide() {
  const { message } = useMessage();
  const c = encode74(message);
  const [e, setE] = useState<number[]>([]);
  const r = c.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const d = decode74(r);
  return (
    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
      <Venn word={r} errorIdx={e} onToggle={(i) => setE(e.includes(i) ? e.filter((j) => j !== i) : [...e, i])} />
      <div className="space-y-4 text-xl">
        <p>每個圓圈是一個檢查：圈裡必須有偶數個 1。</p>
        <div className="rounded-2xl bg-slate-50 p-4">
          {e.length === 0 && <>三個圓圈都是偶數個 1（綠色）：沒有錯。</>}
          {e.length > 0 && d.position > 0 && (
            <>
              只有位置 <strong>{d.position}（{LAYOUT_74[d.position - 1].label}）</strong>落在所有失敗的圓圈裡、又不在任何通過的圓圈裡：把它翻回來就修好了
              {e.length > 1 && <span className="text-rose-700">（但其實錯了 {e.length} 個，會改錯）</span>}。
            </>
          )}
          {e.length > 0 && d.position === 0 && <>三個圓圈又都變回偶數：錯誤剛好互相抵銷，看不出來。</>}
        </div>
        <p className="text-lg text-slate-600">紅色圓圈 = 奇數個 1（檢查失敗）。哪幾個圈失敗，就像座標一樣指出錯在哪裡。</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Exports                                                            */
/* ------------------------------------------------------------------ */

/** a phrase of a takeaway that never breaks in the middle (the header box only fits ~17 characters a line) */
const Ph = ({ children }: { children: ReactNode }) => <span className="whitespace-nowrap">{children}</span>;

export const CH1_SLIDES: DeckSlide<null>[] = [
  {
    title: '第 1 章：Hamming(7,4) 編碼',
    sub: '怎麼讓接收端不只發現錯、還知道錯在哪？',
    steps: () => 5,
    render: (s) => <OverlapIdeaSlide s={s} />,
    takeaway: (
      <>
        <Ph>{R} 個互相重疊的檢查，</Ph>
        <Ph>讓每個位置各有一種專屬的失敗組合</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          接續導論：一個同位位元只回答一個是非題
          <ul className={NOTES_SUB}>
            <li>錯在 D1 還是錯在 P，答案都是同一句「失敗」：知道有錯，不知道該翻哪一位</li>
          </ul>
        </li>
        <li>
          → 想法：用好幾個檢查，各管一部分位置，而且互相重疊
          <ul className={NOTES_SUB}>
            <li>每個位置要對到一種專屬的失敗組合；「全部通過」留給「沒有錯」</li>
            <li>
              {TWO.r} 個檢查：{TWO.patterns} 種組合，卻有 {TWO.positions} 個位置 → 不夠
            </li>
            <li>
              {R} 個檢查：{PATTERNS} 種組合，剛好 {N} 個位置
            </li>
          </ul>
        </li>
        <li>
          → 怎麼重疊：位置 1–{N} 寫成二進位，P_b 管二進位含 b 的位置
          <ul className={NOTES_SUB}>
            <li>
              例：位置 {ERR_POS} = {bin(ERR_POS)} → {watchers(ERR_POS)} 失敗，失敗的檢查讀回來就是 {ERR_POS}
            </li>
            <li>
              這 {R} 組檢查就是接收端的 {R} 盞警示燈（第 2 章）
            </li>
          </ul>
        </li>
        <li>
          → 同位位元放在 {PARITY_POS}：二進位只有一個 1，每個同位位元只出現在一組檢查裡
          <ul className={NOTES_SUB}>
            <li>發送端直接用資訊位元算出每個同位位元，{R} 個 XOR 互不依賴、可以同時算</li>
          </ul>
        </li>
        <li>
          → 結果：Hamming({N},{K})，{K} 個資訊 + {R} 個同位，能修任何 1 個錯
          <ul className={NOTES_SUB}>
            <li>
              碼率 {K}/{N} ≈ {(K / N).toFixed(2)}；三重重複碼一樣只修 1 個錯，碼率卻只有 1/{N_REPEAT}
            </li>
            <li>代價：錯 2 個就會改錯（第 3、4 章）</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 1 章：三個互相重疊的檢查',
    sub: 'P_b 管「二進位含有 b」的位置',
    steps: () => 1,
    render: () => <CoverageSlide />,
    takeaway: (
      <>
        <Ph>每個位置被一組獨特的檢查盯著：</Ph>
        <Ph>錯在哪，失敗的組合就不同</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          上面兩列：位置 1–{N} 和它的二進位；下面 {R} 列：每組檢查管哪些位置
        </li>
        <li>
          P_b 管「二進位含 b」的位置 → 每一欄的圓點，就是那個位置的二進位
          <ul className={NOTES_SUB}>
            <li>
              例：位置 {COVER_POS} = {bin(COVER_POS)} → 被 {watchers(COVER_POS)} 盯著
            </li>
          </ul>
        </li>
        <li>
          {N} 欄的圓點組合兩兩不同，也沒有空欄 → 錯在哪，失敗的檢查組合就不一樣
        </li>
        <li>
          每組檢查管 {COVER} 個位置（{COVER - 1} 個資訊 + 1 個同位）：發送端用 XOR 把它們湊成偶數個 1
        </li>
        <li>
          到了接收端，這 {R} 組檢查就是 {R} 盞警示燈（第 2 章）
        </li>
      </ul>
    ),
  },
  {
    title: '第 1 章：一步一步編碼',
    sub: '每個檢查管到的位元要有偶數個 1',
    steps: () => R + 2,
    render: (s) => <EncodeSlide s={s} />,
    takeaway: (
      <>
        <Ph>發送端只做 XOR：</Ph>
        <Ph>補上同位位元，</Ph>
        <Ph>讓每組檢查都有偶數個 1</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          先把 {K} 個資訊位元原封不動放進位置 {DATA_POS}，同位位元先空著
          <ul className={NOTES_SUB}>
            <li>資訊位元不改動：接收端拿掉同位位元就是原訊息</li>
          </ul>
        </li>
        {PARITY_CHECKS.map((_, k) => (
          <li key={k}>
            → {eqText(k)}：讓位置 {coveredText(k)} 湊成偶數個 1
            {k === R - 1 && (
              <ul className={NOTES_SUB}>
                <li>
                  {R} 個式子只用到資訊位元、互不依賴：硬體上是 {R} 組 XOR 同時算完
                </li>
              </ul>
            )}
          </li>
        ))}
        <li>
          → 完成：{N} 個位元送出去，每組檢查都是偶數個 1
          <ul className={NOTES_SUB}>
            <li>發送端的工作只有 XOR：沒有乘法、沒有查表</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 1 章：Venn 圖',
    sub: '每個圓圈都要有偶數個 1',
    steps: () => 1,
    render: () => <VennSlide />,
    takeaway: (
      <>
        <Ph>哪幾個圓圈變奇數，</Ph>
        <Ph>就像座標一樣圈出錯的那一格</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          {R} 個圓 = {R} 組檢查；圓圈切出的 {N} 個區域 = {N} 個位置
          <ul className={NOTES_SUB}>
            <li>一個區域在哪幾個圓裡 ⇔ 那個位置的二進位含 1、2、4 的哪幾個</li>
          </ul>
        </li>
        <li>規則：每個圓裡要有偶數個 1；全部綠色 = 合法 codeword</li>
        <li>
          現場示範：翻一個位元 → 包含它的圓變紅
          <ul className={NOTES_SUB}>
            <li>只有一格「在所有紅圈裡、又不在任何綠圈裡」：就是錯的位置，翻回來就修好</li>
          </ul>
        </li>
        <li>再翻第二個：紅圈的組合會指向第三個位置 → 改錯（第 4 章說明原因）</li>
        <li>
          接收端做的就是這件事：看 {R} 盞警示燈亮哪幾盞，就知道錯在哪（第 3 章）
        </li>
      </ul>
    ),
  },
  {
    title: '第 1 章：為什麼訊息是 4 個位元？',
    sub: 'k + r ≤ 2ʳ − 1：r = 3 時 k 最多 4',
    steps: () => 1,
    render: () => <MessageSizeLab />,
    takeaway: (
      <>
        <Ph>
          {R} 個同位位元的 {PATTERNS} 種失敗組合
        </Ph>
        <Ph>全部用上，</Ph>
        <Ph>剛好保護 {K} 個資訊位元</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>規則：r 個同位位元有 2ʳ − 1 種失敗組合，要分給 k + r 個位置 → k + r ≤ 2ʳ − 1</li>
        <li>
          r = {R}：k 最多 {K}；{R} 盞警示燈的 {PATTERNS} 種亮法，每一種都分給一個位置，沒有浪費
        </li>
        <li>
          資料少一點也能修錯，但同位位元省不下來
          <ul className={NOTES_SUB}>
            <li>
              k = {K - 2}、{K - 1} 仍要 {checkBitsFor(K - 1)} 個同位位元：同樣成本，送更少資料
            </li>
            <li>
              k = 1 只要 {R_FOR_ONE} 個，但那就是三重重複碼：同位位元是資料的 {R_FOR_ONE} 倍
            </li>
            <li>
              k = {K}：每個資訊位元只配 {(R / K).toFixed(2)} 個同位位元，最划算
            </li>
          </ul>
        </li>
        <li>
          資料更多：k = {K + 1} 就要第 {NEXT_R} 個同位位元，下一個剛好用滿的是 ({hammingN(NEXT_R)},{hammingK(NEXT_R)})（第 4 章）
        </li>
        <li>現場示範：切換資料位元數，翻一個位元，確認照樣能修</li>
      </ul>
    ),
  },
];
