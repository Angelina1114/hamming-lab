import { useState } from 'react';
import { type Bit, type Design, DEFAULT_MESSAGE, H74, LAYOUT_74, PARITY_CHECKS, encode74, failingChecks, outcomeTable, singleErrorCandidates } from '../core';
import { M } from './Tex';
import { Card, ResetButton, Segmented } from './Lesson';
import { usePresenting } from '../lib/presenting';

type Mode = '1' | '2' | '3';

interface Setup {
  tab: string;
  labels: string[];
  parity: boolean[];
  checks: string[];
  cover: Design;
  sent: Bit[];
  how: string;
}

/** who each Hamming check watches: 'P1 管位置 1、3、5、7，P2 管 2、3、6、7，…' */
const HAMMING_HOW = PARITY_CHECKS.map((pc, k) => `${pc.name} 管${k === 0 ? '位置 ' : ' '}${pc.covered.map((i) => i + 1).join('、')}`).join('，');

/** the three ways of adding parity bits to the same data d (four bits) */
function setupsFor(d: readonly Bit[]): Record<Mode, Setup> {
  return {
    '1': {
      tab: '1 個同位位元',
      labels: ['D1', 'D2', 'D3', 'D4', 'P'],
      parity: [false, false, false, false, true],
      checks: ['檢查'],
      cover: [[1, 1, 1, 1, 1]],
      sent: [...d, (d[0] ^ d[1] ^ d[2] ^ d[3]) as Bit],
      how: `一個同位位元 P 負責全部 ${d.length + 1} 個位元：讓 1 的總數是偶數。`,
    },
    '2': {
      tab: '2 個同位位元',
      labels: ['D1', 'D2', 'D3', 'D4', 'P前', 'P後'],
      parity: [false, false, false, false, true, true],
      checks: ['前半檢查', '後半檢查'],
      cover: [
        [1, 1, 0, 0, 1, 0],
        [0, 0, 1, 1, 0, 1],
      ],
      sent: [...d, (d[0] ^ d[1]) as Bit, (d[2] ^ d[3]) as Bit],
      how: '資料分成兩半：P前 讓 D1、D2、P前 裡有偶數個 1，P後 讓 D3、D4、P後 裡有偶數個 1。',
    },
    '3': {
      tab: `${PARITY_CHECKS.length} 個（Hamming）`,
      labels: LAYOUT_74.map((p) => p.label),
      parity: LAYOUT_74.map((p) => p.role === 'parity'),
      checks: PARITY_CHECKS.map((pc) => pc.name),
      cover: H74,
      sent: encode74(d),
      how: `${PARITY_CHECKS.length} 個檢查互相重疊（第 1 章）：${HAMMING_HOW}。`,
    },
  };
}

const patternText = (s: Setup, p: readonly boolean[]) => (p.some(Boolean) ? s.checks.filter((_, i) => p[i]).join('、') + ' 失敗' : '全部通過');

/**
 * Interactive comparison of 1, 2 and 3 parity bits on one 4-bit message.
 * In a deck it opens on the 3 overlapping checks, drops the card title and reset button, and uses slide-size text.
 */
export function ParityLab({ message = DEFAULT_MESSAGE }: { message?: readonly Bit[] }) {
  const presenting = usePresenting();
  const [mode, setMode] = useState<Mode>(presenting ? '3' : '1');
  const [flips, setFlips] = useState<number[]>([]);
  const s = setupsFor(message)[mode];
  const recv = s.sent.map((b, j) => (flips.includes(j) ? ((b ^ 1) as Bit) : b));
  const failing = failingChecks(s.cover, recv);
  const anyFail = failing.some(Boolean);
  const cands = singleErrorCandidates(s.cover, failing);
  const table = outcomeTable(s.cover);
  const checks = s.cover.length;
  const n = s.labels.length;
  const name = (j: number) => s.labels[j];
  const flipNames = [...flips].sort((a, b) => a - b).map(name);
  // text sizes: the web card, or a slide read from the back of the room
  const t = presenting
    ? {
        body: 'text-lg',
        small: 'text-base',
        tiny: 'text-sm',
        bit: 'text-2xl',
        cell: 'w-14',
        cols: 'gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]',
        tabs: '[&_button]:text-lg',
        mt: 'mt-3',
        row: 'py-0.5',
        verdict: 'min-h-[6.75rem]',
      }
    : {
        body: 'text-sm',
        small: 'text-xs',
        tiny: 'text-[10px]',
        bit: 'text-lg',
        cell: 'w-9 sm:w-12',
        cols: 'gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]',
        tabs: '',
        mt: 'mt-4',
        row: 'py-1',
        verdict: '',
      };

  // what the receiver concludes vs. what really happened (a shorter line on a slide, read out by the presenter)
  const X = cands.length ? name(cands[0]) : '';
  const flipList = `${flips.length} 個（${flipNames.join('、')}）`;
  let receiver: { tone: string; text: string; short: string };
  if (!anyFail) receiver = { tone: 'border-emerald-300 bg-emerald-50 text-emerald-900', text: '每個檢查都是偶數個 1 → 接收端認為：沒有錯。', short: '全部偶數 → 認為沒有錯' };
  else if (cands.length === 1)
    receiver = {
      tone: 'border-sky-300 bg-sky-50 text-sky-900',
      text: `假設只錯一個：只有 ${X} 錯會造成這個結果 → 接收端把 ${X} 翻回來，認為已經修好（只有真的只錯一個時才對）。`,
      short: `只有 ${X} 錯會這樣 → 把 ${X} 翻回來`,
    };
  else if (cands.length > 1)
    receiver = {
      tone: 'border-orange-300 bg-orange-50 text-orange-900',
      text: `發現有錯！但 ${cands.map(name).join('、')} 任何一個錯都會造成這個結果 → 不知道要修哪一個，無法修正。`,
      short: `${cands.map(name).join('、')} 都有可能 → 修不了`,
    };
  else
    receiver = {
      tone: 'border-orange-300 bg-orange-50 text-orange-900',
      text: '發現有錯！而且沒有任何「只錯一個」會造成這個結果 → 至少錯了 2 個，無法修正。',
      short: '不是只錯一個 → 修不了',
    };

  let truth: { ok: boolean; text: string; short: string };
  if (flips.length === 0) truth = { ok: true, text: '沒有任何位元被翻轉，判斷正確。', short: '沒有翻轉：判斷正確' };
  else if (!anyFail) truth = { ok: false, text: `實際錯了 ${flipList}，但每個檢查裡的 1 又剛好變回偶數個 → 未偵測錯誤：接收端完全沒發現，被騙了。`, short: `錯了 ${flipList}：未偵測錯誤` };
  else if (cands.length === 1 && flips.length === 1 && cands[0] === flips[0])
    truth = { ok: true, text: `真的是 ${flipNames[0]} 錯了：判斷正確，可以修正。`, short: `真的是 ${flipNames[0]}：修對了` };
  else if (cands.length === 1)
    truth = flips.includes(cands[0])
      ? { ok: false, text: `實際錯了 ${flipList}，接收端卻以為只有 ${X} 錯：${X} 確實錯了、會被翻回來，但其餘 ${flips.length - 1} 個錯誤還在 → 誤更正（超過能力，第 3、4 章會細看）。`, short: `錯了 ${flipList} → 誤更正` }
      : { ok: false, text: `實際錯了 ${flipList}，接收端卻以為只有 ${X} 錯 → 會把原本沒錯的 ${X} 也翻掉：誤更正（超過能力，第 3、4 章會細看）。`, short: `錯了 ${flipList} → 誤更正` };
  else truth = { ok: true, text: `實際錯了 ${flipList}。接收端知道「有錯」是對的，只是沒辦法修。`, short: `錯了 ${flipList}：知道有錯是對的` };

  const tabs = (
    <Segmented
      ariaLabel="同位位元的個數"
      value={mode}
      onChange={(v) => {
        setMode(v);
        setFlips([]);
      }}
      options={(['1', '2', '3'] as Mode[]).map((k) => ({ value: k, label: setupsFor(message)[k].tab }))}
    />
  );

  return (
    <Card
      title={presenting ? undefined : '1 個、2 個、3 個同位位元，各能做到什麼？'}
      actions={
        <>
          <div className={t.tabs}>{tabs}</div>
          {!presenting && <ResetButton onClick={() => setFlips([])} />}
        </>
      }
    >
      <div className={`grid grid-cols-1 ${t.cols}`}>
        <div className="min-w-0">
          <p className={`mb-3 ${t.body} text-slate-600`}>
            傳送資料 <span className="mono">{message.join('')}</span>。{/* on a slide the check table below already shows who watches what */}
            {!presenting && `${s.how}點擊位元製造錯誤（可以點好幾個），看接收端怎麼判斷。`}
          </p>

          <div className="flex flex-wrap gap-1.5">
            {recv.map((b, j) => {
              const flipped = flips.includes(j);
              return (
                <button
                  key={j}
                  type="button"
                  onClick={() => setFlips(flipped ? flips.filter((x) => x !== j) : [...flips, j])}
                  aria-label={`${name(j)} = ${b}${flipped ? '（已翻轉）' : ''}，點擊翻轉`}
                  aria-pressed={flipped}
                  className={`flex ${t.cell} flex-col items-center rounded-lg border-2 py-1 transition-colors ${
                    flipped ? 'border-rose-500 bg-rose-50' : s.parity[j] ? 'border-parity-300 bg-parity-50' : 'border-data-300 bg-data-50'
                  }`}
                >
                  <span className={`${t.tiny} font-semibold ${s.parity[j] ? 'text-parity-700' : 'text-data-700'}`}>{name(j)}</span>
                  <span className={`font-mono ${t.bit} font-bold ${flipped ? 'text-rose-600' : 'text-slate-800'}`}>{b}</span>
                </button>
              );
            })}
          </div>

          <div className={`${t.mt} overflow-x-auto`}>
            <table className={`w-full ${t.body}`}>
              <thead>
                <tr className={`text-left ${t.small} text-slate-500`}>
                  <th className="py-1 pr-3">檢查</th>
                  <th className="pr-3">管哪些位元</th>
                  <th className="pr-3">1 的個數</th>
                  <th>結果</th>
                </tr>
              </thead>
              <tbody>
                {s.cover.map((row, i) => {
                  const covered = row.flatMap((c, j) => (c ? [j] : []));
                  const ones = covered.filter((j) => recv[j] === 1).length;
                  return (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="whitespace-nowrap py-1.5 pr-3 font-semibold text-parity-700">{s.checks[i]}</td>
                      <td className={`pr-3 ${t.small} text-slate-600`}>{covered.map(name).join(' ')}</td>
                      <td className="pr-3 font-mono">{ones}</td>
                      <td className={failing[i] ? 'font-semibold text-orange-700' : 'font-semibold text-emerald-700'}>{failing[i] ? '奇數 ✗ 失敗' : '偶數 ✓ 通過'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={`${t.mt} grid grid-cols-1 gap-3 md:grid-cols-2`} aria-live="polite">
            <div className={`rounded-xl border p-3 ${t.body} ${t.verdict} ${receiver.tone}`}>
              <div className={`mb-1 ${t.small} font-semibold opacity-80`}>接收端的判斷{!presenting && '（只看得到收到的位元）'}</div>
              {presenting ? receiver.short : receiver.text}
            </div>
            <div className={`rounded-xl border p-3 ${t.body} ${t.verdict} ${truth.ok ? 'border-slate-200 bg-slate-50 text-slate-700' : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
              <div className={`mb-1 ${t.small} font-semibold opacity-80`}>真相（接收端看不到）</div>
              {truth.ok ? '✓ ' : '✗ '}
              {presenting ? truth.short : truth.text}
            </div>
          </div>
        </div>
        <div className="min-w-0">
          <div className={`mb-1 ${t.body} font-semibold text-slate-800`}>每一種檢查結果，可能是哪個位元錯？（只錯一個時）</div>
          <div className="overflow-x-auto">
            <table className={`w-full ${t.body}`}>
              <tbody>
                {table.map((row) => {
                  const here = row.pattern.every((p, i) => p === failing[i]);
                  return (
                    <tr key={row.pattern.join('')} className={`border-t border-slate-100 ${here ? 'bg-amber-50' : ''}`}>
                      <td className={`${t.row} pr-3 text-slate-700`}>{patternText(s, row.pattern)}</td>
                      <td className={t.row}>
                        {!row.pattern.some(Boolean) ? (
                          <span className="text-slate-500">沒有錯（或錯誤剛好互相抵銷）</span>
                        ) : row.positions.length === 0 ? (
                          <span className="text-slate-400">不會由單一錯誤造成</span>
                        ) : (
                          <span className={row.positions.length === 1 ? 'font-semibold text-sky-700' : 'font-semibold text-orange-700'}>
                            {row.positions.map(name).join('、')}
                            {row.positions.length > 1 && `（${row.positions.length} 個都有可能）`}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {presenting ? (
            <p className={`mt-2 ${t.body} text-slate-700`}>
              {checks} 個檢查 → <M>{`2^{${checks}} = ${2 ** checks}`}</M> 種結果，扣掉「全部通過」剩 {2 ** checks - 1} 種，要分給 {n} 個位置：
              {2 ** checks - 1 >= n ? <strong className="text-sky-700"> 剛好夠，能定位。</strong> : <strong className="text-orange-700"> 不夠，定位不了。</strong>}
            </p>
          ) : (
            <p className={`mt-2 ${t.body} text-slate-700`}>
              {checks} 個檢查，每個不是通過就是失敗，一共只有 <M>{`2^{${checks}} = ${2 ** checks}`}</M> 種結果。扣掉「全部通過」，剩 {2 ** checks - 1}{' '}
              種可以用來指出錯誤，但要分辨的位置有 {n} 個：
              {2 ** checks - 1 >= n ? (
                <strong className="text-sky-700"> 剛好夠，每個位置一種結果，所以能定位、能修正。</strong>
              ) : (
                <strong className="text-orange-700"> 結果比位置少，一定有好幾個位置共用同一種結果，所以定位不了。</strong>
              )}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
