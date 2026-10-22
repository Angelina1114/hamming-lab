import { H74, LAYOUT_74, PARITY_CHECKS, column } from '../../core';
import { M, Tex } from '../../components/Tex';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';
import { Box, Reveal, sub } from './parts';

const SINGLE = ['D1', 'D2', 'D3', 'D4', 'P'];

function OverlapIdeaSlide({ s }: { s: Stepper }) {
  const r = PARITY_CHECKS.length; // 3 checks
  const n = LAYOUT_74.length; // 7 positions
  const k = n - r; // 4 information bits
  // r = 1 is the single parity bit of the first box; the table starts at 2 (not enough) and ends at 3 (exactly enough)
  const counts = [r - 1, r].map((x) => ({ r: x, patterns: 2 ** x - 1, positions: k + x }));
  // worked example: an error at position 5 fails exactly the checks in column 5 of H (P1 on top)
  const pos = 5;
  const pattern = column(H74, pos - 1);
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
                  <th className="font-normal">位置數 {k} + r</th>
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
              位置數 = {k} 個資訊 + <M>r</M> 個同位
            </p>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 2}>
          <Box tone="bg-amber-50 text-amber-950" title="怎麼重疊：位置寫成二進位">
            <p className="text-lg">
              1–{n} 的二進位剛好是 {n} 種非零組合：檢查 <M>{'P_b'}</M> 負責二進位含有 <M>b</M> 的位置。
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
                  <td className="whitespace-nowrap text-left text-slate-600">位置 {pos} 錯</td>
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
                    <M>{`= ${pos}`}</M>
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
          <Box tone="bg-parity-50" title={<span className="text-parity-700">同位位元放在位置 1、2、4（2 的冪次）</span>}>
            <p className="text-lg">二進位只有一個 1 → 每個同位位元只在一個檢查裡，直接用資訊位元算出：</p>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1">
              {eqs.map((e) => (
                <Tex key={e}>{e}</Tex>
              ))}
            </div>
          </Box>
        </Reveal>
        <Reveal on={s.step >= 4}>
          <Box tone="bg-emerald-50 text-emerald-950" title={`結果：Hamming(${n},${k})`}>
            <p>
              <span className="font-semibold text-data-700">{k} 個資訊位元</span> + <span className="font-semibold text-parity-700">{r} 個同位位元</span>
            </p>
            <p>能找出並修正任何 1 個錯誤</p>
            <p className="text-lg text-slate-600">
              碼率 <M>{`R = ${k}/${n} \\approx ${(k / n).toFixed(2)}`}</M>（三重重複碼 <M>{'1/3'}</M>）
            </p>
          </Box>
        </Reveal>
      </div>
    </div>
  );
}


export const INTRO_CH1_SLIDES: DeckSlide<null>[] = [
  { title: '第 1 章：Hamming(7,4) 編碼', sub: '怎麼讓接收端不只發現錯、還知道錯在哪？', steps: () => 5, render: (s) => <OverlapIdeaSlide s={s} /> },
];

