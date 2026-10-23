import { useState, type ReactNode } from 'react';
import { type Bit, H74, K4, LAYOUT_74, N7, PARITY_CHECKS, column, encode74ByParity } from '../../core';
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
/** which check computes the parity bit at codeword index i (−1 for a data bit) */
const checkAt = (i: number) => PARITY_CHECKS.findIndex((pc) => pc.parityIndex === i);

/* ------------------------------------------------------------------ */
/* 第 1 章：Hamming(7,4) 編碼                                          */
/* ------------------------------------------------------------------ */

function CoverageSlide({ s }: { s: Stepper }) {
  const hot = s.step >= 1; // the worked column lights up with its example
  return (
    <div className="grid grid-cols-1 gap-4 text-xl lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Box
        tone="bg-amber-50 text-amber-950"
        title={
          <>
            <M>{'P_b'}</M> 管二進位含有 <M>b</M> 的位置（<M>{`b = ${PARITY_CHECKS.map((pc) => pc.bitValue).join(', ')}`}</M>）
          </>
        }
      >
        <table className="mt-3 w-full text-center text-xl">
          <thead>
            <tr className="text-lg text-slate-500">
              <th className="pr-2 text-left font-normal">位置</th>
              {LAYOUT_74.map((p) => (
                <th key={p.index} className={`rounded-t-md ${p.position === ERR_POS && hot ? 'bg-rose-100' : ''} ${p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}`}>
                  {p.position}
                  <div className="text-sm font-normal leading-none">{p.label}</div>
                </th>
              ))}
            </tr>
            <tr className="font-mono text-lg text-slate-500">
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
                <td className="py-3 pr-2 text-left font-semibold text-parity-700">{pc.name}</td>
                {LAYOUT_74.map((p) => {
                  const on = pc.covered.includes(p.index);
                  const err = p.position === ERR_POS && hot;
                  return (
                    <td key={p.index} className={err ? 'bg-rose-100' : ''}>
                      {on ? <span className={`inline-block h-5 w-5 rounded-full ${err ? 'bg-rose-500' : 'bg-parity-500'}`} /> : <span className="text-slate-300">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
      <div className="space-y-4">
        <Reveal on={s.step >= 1}>
          <Box tone="bg-rose-50 text-rose-950" title={`位置 ${ERR_POS} 錯`}>
            <p>
              {FAILED.join('、')} 失敗 → 讀成 {LAMP_ORDER} = <span className="font-semibold text-rose-700">{bin(ERR_POS)}₂ = {ERR_POS}</span>
            </p>
            <p className="mt-1 text-lg font-semibold">失敗的檢查拼出位置編號</p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-parity-50" title={<span className="text-parity-700">Parity bit 放在 {PARITY_POS}（2 的冪次）</span>}>
            <p className="text-lg">二進位只有一個 1 → 只在自己那組檢查裡，直接用 data bit 算（下一頁）</p>
            <p className="mt-1 text-lg">data bit 原封不動放在 {DATA_POS}</p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}

function EncodeSlide({ s }: { s: Stepper }) {
  const { message, toggleBit } = useMessage();
  const enc = encode74ByParity(message);
  const done = s.step === L + 1;
  // bits flipped on the Venn diagram: only once the codeword is complete
  const [e, setE] = useState<number[]>([]);
  const flips = done ? e : [];
  const shown = (i: number) => LAYOUT_74[i].role === 'data' || checkAt(i) < s.step;
  const word: (Bit | null)[] = enc.codeword.map((b, i) => (!shown(i) ? null : flips.includes(i) ? ((b ^ 1) as Bit) : b));
  const eq = (k: number) => {
    const p = enc.parities[k];
    return `${sub(p.name)} = ${p.terms.map((t) => sub(t.label)).join(' \\oplus ')} = ${p.terms.map((t) => t.value).join(' \\oplus ')} = ${p.value}`;
  };
  return (
    <div className="grid grid-cols-1 items-start gap-6 text-xl lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <MessageInput message={message} onToggle={toggleBit} />
        <div className="flex items-end gap-3">
          <span className="pb-2 text-3xl text-slate-300">→</span>
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
          {s.step === 0 && `先把 ${K} 個 data bit 放進位置 ${DATA_POS}，再逐一算出 ${PARITY_NAMES}。`}
          {s.step > 0 && s.step <= L && `算出 ${PARITY_CHECKS[s.step - 1].name}：圓 ${PARITY_CHECKS[s.step - 1].name} 的 ${COVER} 個位置湊成偶數個 1。`}
          {done && (
            <>
              完成！訊息 {message.join('')} 編成 codeword（碼字）<strong className="mono">{enc.codeword.join('')}</strong>。
            </>
          )}
        </p>
      </div>
      <Venn word={word} errorIdx={flips} maxWidth="max-w-[460px]" onToggle={done ? (i) => setE(e.includes(i) ? e.filter((j) => j !== i) : [...e, i]) : undefined} />
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
    sub: `導論的 ${L} 個檢查，各管哪些位置？`,
    steps: () => 3,
    render: (s) => <CoverageSlide s={s} />,
    takeaway: (
      <>
        <Ph>位置寫成二進位：</Ph>
        <Ph>失敗的檢查讀成二進位，</Ph>
        <Ph>就是出錯位置的編號</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          覆蓋表：位置 1–{N} 寫成二進位，{PARITY_NAMES} 各管二進位含 {BIT_VALUES} 的位置
          <ul className={NOTES_SUB}>
            <li>每一欄的圓點 = 那個位置的二進位；{N} 欄兩兩不同、沒有空欄：導論說的「每個位置一種失敗組合」就是這樣分出來的</li>
          </ul>
        </li>
        <li>
          → 例：位置 {ERR_POS} 錯 → {FAILED.join('、')} 失敗 → 讀成 {LAMP_ORDER} = {bin(ERR_POS)}₂ = {ERR_POS}
          <ul className={NOTES_SUB}>
            <li>每一欄都一樣：失敗的檢查拼出位置編號，接收端不用查表；這 {L} 組檢查就是接收端的 {L} 盞警示燈（第 2 章）</li>
          </ul>
        </li>
        <li>
          → parity bit 放在 {PARITY_POS}：二進位只有一個 1，每個只在自己那組檢查裡
          <ul className={NOTES_SUB}>
            <li>直接用 data bit 算出（下一頁）；data bit 原封不動放在 {DATA_POS}，接收端拿掉 parity bit 就是原訊息</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '第 1 章：一步一步編碼',
    sub: '每個圓圈（每個檢查）都要有偶數個 1',
    steps: () => L + 2,
    render: (s) => <EncodeSlide s={s} />,
    takeaway: (
      <>
        <Ph>發送端只做 XOR：</Ph>
        <Ph>補上 parity bit，</Ph>
        <Ph>讓每組檢查都有偶數個 1</Ph>
      </>
    ),
    notes: (
      <ul className={NOTES_UL}>
        <li>
          先把 {K} 個 data bit 原封不動放進位置 {DATA_POS}，parity bit 先空著（?）
          <ul className={NOTES_SUB}>
            <li>
              右邊：{L} 個圓 = {L} 組檢查，圓圈切出的 {N} 個區域 = {N} 個位置；一個區域在哪幾個圓裡 ⇔ 那個位置的二進位含 {BIT_VALUES} 的哪幾個
            </li>
            <li>圓裡還有 ? 的時候保持橘色：這組檢查還不能判斷</li>
          </ul>
        </li>
        {PARITY_CHECKS.map((pc, k) => (
          <li key={pc.name}>
            → {eqText(k)}：讓位置 {coveredText(k)} 湊成偶數個 1，圓 {pc.name} 變綠
            {k === L - 1 && (
              <ul className={NOTES_SUB}>
                <li>
                  {L} 個式子只用到 data bit、互不依賴：硬體上是 {L} 組 XOR 同時算完
                </li>
              </ul>
            )}
          </li>
        ))}
        <li>
          → 完成：{N} 個位元送出去，{L} 個圓都是綠的 = 合法 codeword；發送端只有 XOR，沒有乘法、沒有查表
          <ul className={NOTES_SUB}>
            <li>這時可以點圓裡的格子翻一位：包含它的圓變紅；怎麼從紅圈找出錯的位置，是第 3 章的事</li>
          </ul>
        </li>
      </ul>
    ),
  },
];
