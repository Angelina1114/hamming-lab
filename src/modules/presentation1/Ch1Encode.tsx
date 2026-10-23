import { useState, type ReactNode } from 'react';
import { type Bit, H74, K4, LAYOUT_74, N7, PARITY_CHECKS, column, decode74, encode74, encode74ByParity, hammingN } from '../../core';
import { useMessage } from '../../lib/store';
import { M, Tex } from '../../components/Tex';
import { MessageInput } from '../../components/Bits';
import { Venn } from '../../components/Venn';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, NOTES_SUB, NOTES_UL, Reveal, sub } from './parts';

/* ------------------------------------------------------------------ */
/* Numbers used on the slides and in the notes (computed, never typed) */
/* ------------------------------------------------------------------ */

/** ℓ = 3 checks, 7 positions, 4 data bits */
const L = PARITY_CHECKS.length;
const N = N7;
const K = K4;
/** positions each check watches (data bits + its own parity bit) */
const COVER = PARITY_CHECKS[0].covered.length;
const positionsOf = (role: 'data' | 'parity') =>
  LAYOUT_74.filter((p) => p.role === role)
    .map((p) => p.position)
    .join('、');
const DATA_POS = positionsOf('data');
const PARITY_POS = positionsOf('parity');
const PARITY_NAMES = PARITY_CHECKS.map((pc) => pc.name).join('、');
const BIT_VALUES = PARITY_CHECKS.map((pc) => pc.bitValue).join('、');
/** a position (or a lamp pattern) written in binary, P4 P2 P1 */
const bin = (j: number) => j.toString(2).padStart(L, '0');
const eqText = (k: number) => `${PARITY_CHECKS[k].name} = ${PARITY_CHECKS[k].dataTerms.join(' ⊕ ')}`;
const coveredText = (k: number) => PARITY_CHECKS[k].covered.map((i) => i + 1).join('、');
/** worked example: an error at position 5 fails the checks in column 5 of H */
const ERR_POS = 5;
const ERR_COL = column(H74, ERR_POS - 1);
/** the checks read as a binary number: P4 P2 P1, the most significant first */
const READ = [...PARITY_CHECKS.keys()].reverse();
const FAILED = READ.filter((i) => ERR_COL[i]).map((i) => PARITY_CHECKS[i].name);
const LAMP_ORDER = READ.map((i) => PARITY_CHECKS[i].name).join('');
/** the 3-fold repetition code also corrects 1 error: rate 1/3 */
const N_REPEAT = hammingN(L - 1);

/* ------------------------------------------------------------------ */
/* 第 1 章：Hamming(7,4) 編碼                                          */
/* ------------------------------------------------------------------ */

function OverlapIdeaSlide({ s }: { s: Stepper }) {
  const eqs = PARITY_CHECKS.map((pc) => `${sub(pc.name)} = ${pc.dataTerms.map(sub).join(' \\oplus ')}`);
  const hot = s.step >= 1; // the worked column lights up with the coverage table
  return (
    <div className="space-y-4 text-xl">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.8fr_1.5fr]">
        <Reveal on={s.step >= 0}>
          <Box tone="bg-sky-50 text-sky-950" title="想法：多個重疊的檢查">
            <p>
              發送端多算 {L} 個同位位元，各管一組位置；接收端把這 {L} 組重算一次。
            </p>
            <p className="mt-2 text-lg text-slate-600">各組互相重疊：每個位置對到一種專屬的失敗組合，「全部通過」留給「沒有錯」。</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 1}>
          <Box tone="bg-amber-50 text-amber-950" title="怎麼重疊：位置寫成二進位">
            <table className="w-full text-center text-lg">
              <thead>
                <tr className="text-base text-slate-500">
                  <th className="pr-2 text-left font-normal">位置</th>
                  {LAYOUT_74.map((p) => (
                    <th key={p.index} className={`rounded-t-md ${p.position === ERR_POS && hot ? 'bg-rose-100' : ''} ${p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}`}>
                      {p.position}
                      <div className="text-sm font-normal leading-none">{p.label}</div>
                    </th>
                  ))}
                </tr>
                <tr className="font-mono text-base text-slate-500">
                  <th className="pr-2 text-left font-sans font-normal leading-tight">
                    二進位
                    <div className="font-mono text-xs leading-none">{LAMP_ORDER}</div>
                  </th>
                  {LAYOUT_74.map((p) => (
                    <th key={p.index} className={`font-normal ${p.position === ERR_POS && hot ? 'bg-rose-100 font-bold text-rose-700' : ''}`}>
                      {bin(p.position)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PARITY_CHECKS.map((pc) => (
                  <tr key={pc.name} className="border-t border-amber-100">
                    <td className="py-1 pr-2 text-left font-semibold text-parity-700">{pc.name}</td>
                    {LAYOUT_74.map((p) => {
                      const on = pc.covered.includes(p.index);
                      const err = p.position === ERR_POS && hot;
                      return (
                        <td key={p.index} className={err ? 'bg-rose-100' : ''}>
                          {on ? <span className={`inline-block h-4 w-4 rounded-full ${err ? 'bg-rose-500' : 'bg-parity-500'}`} /> : <span className="text-slate-300">·</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-lg">
              <M>{'P_b'}</M> 管二進位含有 <M>b</M> 的位置。位置 {ERR_POS} 錯 → {FAILED.join('、')} 失敗 → <span className="font-semibold text-rose-700">{LAMP_ORDER} = {bin(ERR_POS)}₂ = {ERR_POS}</span>
            </p>
          </Box>
        </Reveal>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.8fr_1fr]">
        <Reveal on={s.step >= 2}>
          <Box tone="bg-parity-50" title={<span className="text-parity-700">同位位元放在位置 {PARITY_POS}（2 的冪次）</span>}>
            <p className="text-lg">二進位只有一個 1 → 每個同位位元只在一組檢查裡，直接用資料位元算出：</p>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {eqs.map((e) => (
                <Tex key={e}>{e}</Tex>
              ))}
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 3}>
          <Box tone="bg-emerald-50 text-emerald-950" title={`結果：Hamming(${N},${K})`}>
            <p>
              <span className="font-semibold text-data-700">{K} 個資料位元</span> + <span className="font-semibold text-parity-700">{L} 個同位位元</span>
            </p>
            <p>能找出並修正任何 1 個錯誤</p>
            <p className="text-lg text-slate-600">
              碼率 <M>{`${K}/${N} \\approx ${(K / N).toFixed(2)}`}</M>（三重重複碼 <M>{`1/${N_REPEAT}`}</M>）
            </p>
          </Box>
        </Reveal>
      </div>
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
        {s.step === 0 && `先把 ${K} 個資料位元放進位置 ${DATA_POS}，再逐一算出 ${PARITY_CHECKS.map((pc) => pc.name).join('、')}：每個檢查管到的位元要有偶數個 1。`}
        {s.step > 0 && s.step <= L && `算出 ${PARITY_CHECKS[s.step - 1].name}：讓它管的 ${COVER} 個位置有偶數個 1。`}
        {s.step === L + 1 && (
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
  // the slide opens with one flipped bit (position 5, as in chapter 3), so the red circles are there to read
  const [e, setE] = useState<number[]>([ERR_POS - 1]);
  const r = c.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const d = decode74(r);
  return (
    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
      <Venn word={r} errorIdx={e} onToggle={(i) => setE(e.includes(i) ? e.filter((j) => j !== i) : [...e, i])} />
      <div className="space-y-4 text-xl">
        <p>每個圓圈是一個檢查：圈裡必須有偶數個 1。</p>
        <div className="rounded-2xl bg-slate-50 p-4">
          {e.length === 0 && <>{L} 個圓圈都是偶數個 1（綠色）：沒有錯。</>}
          {e.length > 0 && d.position > 0 && (
            <>
              只有位置 <strong>{d.position}（{LAYOUT_74[d.position - 1].label}）</strong>落在所有失敗的圓圈裡、又不在任何通過的圓圈裡：把它翻回來就修好了
              {e.length > 1 && <span className="text-rose-700">（但其實錯了 {e.length} 個：誤更正）</span>}。
            </>
          )}
          {e.length > 0 && d.position === 0 && <>{L} 個圓圈又都變回偶數：錯誤剛好互相抵銷，看不出來（未偵測錯誤）。</>}
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
    sub: `一個檢查只說「有沒有錯」：改用 ${L} 個互相重疊的檢查`,
    steps: () => 4,
    render: (s) => <OverlapIdeaSlide s={s} />,
    takeaway: (
      <>
        <Ph>{L} 個互相重疊的檢查，</Ph>
        <Ph>讓每個位置各有一種專屬的失敗組合</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          情境：一個檢查只回答「有沒有錯」→ 發送端多算 {L} 個同位位元，接收端重算 {L} 組檢查
          <ul className={NOTES_SUB}>
            <li>各組互相重疊：每個位置對到一種專屬的失敗組合；「全部通過」留給「沒有錯」</li>
          </ul>
        </li>
        <li>
          → 怎麼重疊：位置 1–{N} 寫成二進位，{PARITY_NAMES} 各管二進位含 {BIT_VALUES} 的位置
          <ul className={NOTES_SUB}>
            <li>每一欄的圓點 = 那個位置的二進位；{N} 欄兩兩不同、沒有空欄</li>
            <li>
              例：位置 {ERR_POS} 錯 → {FAILED.join('、')} 失敗 → {bin(ERR_POS)}₂ = {ERR_POS}；這 {L} 組檢查就是接收端的 {L} 盞警示燈（第 2 章）
            </li>
          </ul>
        </li>
        <li>
          → 同位位元放在 {PARITY_POS}：二進位只有一個 1，每個只在一組檢查裡
          <ul className={NOTES_SUB}>
            <li>直接用資料位元算出，{L} 個 XOR 互不依賴、可以同時算</li>
          </ul>
        </li>
        <li>
          → 結果：Hamming({N},{K})，能修任何 1 個錯；碼率 {K}/{N} ≈ {(K / N).toFixed(2)}，三重重複碼只有 1/{N_REPEAT}
          <ul className={NOTES_SUB}>
            <li>代價：錯 2 個就會誤更正（第 3、4 章）</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 1 章：一步一步編碼',
    sub: '每個檢查管到的位元要有偶數個 1',
    steps: () => L + 2,
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
        <li>先把 {K} 個資料位元原封不動放進位置 {DATA_POS}，同位位元先空著；接收端拿掉同位位元就是原訊息</li>
        {PARITY_CHECKS.map((_, k) => (
          <li key={k}>
            → {eqText(k)}：讓位置 {coveredText(k)} 湊成偶數個 1
            {k === L - 1 && (
              <ul className={NOTES_SUB}>
                <li>
                  {L} 個式子只用到資料位元、互不依賴：硬體上是 {L} 組 XOR 同時算完
                </li>
              </ul>
            )}
          </li>
        ))}
        <li>→ 完成：{N} 個位元送出去，每組檢查都是偶數個 1；發送端只有 XOR，沒有乘法、沒有查表</li>
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
          {L} 個圓 = {L} 組檢查；圓圈切出的 {N} 個區域 = {N} 個位置
          <ul className={NOTES_SUB}>
            <li>一個區域在哪幾個圓裡 ⇔ 那個位置的二進位含 {BIT_VALUES} 的哪幾個</li>
          </ul>
        </li>
        <li>規則：每個圓裡要有偶數個 1；全部綠色 = 合法 codeword</li>
        <li>
          開場已翻了位置 {ERR_POS}：包含它的圓變紅
          <ul className={NOTES_SUB}>
            <li>只有一格「在所有紅圈裡、又不在任何綠圈裡」：就是錯的位置，翻回來就修好</li>
          </ul>
        </li>
        <li>現場再翻第二個：紅圈的組合會指向第三個位置 → 誤更正（第 3、4 章）</li>
        <li>接收端做的就是這件事：看 {L} 盞警示燈亮哪幾盞，就知道錯在哪（第 3 章）</li>
      </ul>
    ),
  },
];
