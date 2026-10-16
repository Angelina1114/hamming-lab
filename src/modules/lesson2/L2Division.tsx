import { useMemo, useState } from 'react';
import { type Bit, G_MSB, flipBit, longDivision, msbToPoly, msbToTex, polyMul, polyToMsb, runLfsr, vecAdd } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, ResetButton, Segmented } from '../../components/Lesson';
import { AlgoSteps, BitsPoly, Chapter, Checks } from '../../components/l2/Common';
import { LongDivisionView } from '../../components/l2/Division';
import { LfsrSim } from '../../components/l2/LfsrSim';
import { SyncLfsrDivision } from '../../components/alg/Sync';

const ID = 'l2-3';
const DEFAULT: Bit[] = [1, 0, 0, 1, 0, 0, 0];

/** partial remainder window after the first k bits, read from the long-division rows */
function divisionWindow(dividend: Bit[], k: number): Bit[] {
  const res = longDivision(dividend, G_MSB);
  if (k < 4) return [...Array(3 - k).fill(0), ...dividend.slice(0, k)] as Bit[];
  return res.steps[k - 4].after.slice(k - 3, k);
}

export default function L2Division() {
  const [dividend, setDividend] = useState<Bit[]>([...DEFAULT]);
  const [view, setView] = useState<'division' | 'lfsr' | 'compare' | 'sync'>('division');
  const [key, setKey] = useState(0);
  const res = useMemo(() => longDivision(dividend, G_MSB), [dividend]);
  const lfsr = useMemo(() => runLfsr(dividend, 'divider'), [dividend]);

  // q(x)g(x) + ρ(x) must reproduce the dividend
  const qg = polyMul(msbToPoly(res.quotient), msbToPoly(G_MSB));
  const recon = vecAdd(polyToMsb(qg, 7), [0, 0, 0, 0, ...res.remainder] as Bit[]);

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          LFSR 很快，但看不見「除法」本身。這一章用紙筆做同一件事：<span className="mono">1001000 ÷ 1011</span>。規則只有一條——對齊最高位、XOR。
        </p>
      }
      goals={[
        '在二進位表示與多項式表示之間互相轉換',
        '手算 GF(2) 長除法：對齊、XOR、消去最高位、移動除數',
        '理解為什麼 GF(2) 的「減法」就是 XOR（沒有借位）',
        '確認 LFSR 的每個狀態等於長除法的部分餘數',
      ]}
      intuition={{
        title: '沒有借位的長除法',
        body: (
          <div className="prose-lab max-w-3xl">
            <p>
              一般的長除法要「估商、相乘、相減、借位」。在 GF(2) 中只剩下最簡單的情況：商的每一位不是 0 就是 1，而「相減」就是 XOR，<strong>永遠不需要借位</strong>。
            </p>
            <p>
              每一步只要看目前最左邊的 1：把除數 <span className="mono">1011</span> 對齊它，XOR 一次，那個 1 就被消掉了。重複直到剩下的位數比除數少，剩下的就是餘數。
            </p>
          </div>
        ),
      }}
      math={{
        title: '多項式除法定理',
        body: (
          <Card>
            <p className="text-sm text-slate-700">對任何多項式 <M>{'a(x)'}</M> 與非零的 <M>{'g(x)'}</M>，存在唯一的商 <M>{'q(x)'}</M> 與餘數 <M>{'\\rho(x)'}</M>（不寫成 <M>{'r(x)'}</M>，因為從 2-4 起 <M>{'r(x)'}</M> 代表接收字）：</p>
            <Tex block>{'a(x) = q(x)\\,g(x) + \\rho(x),\\qquad \\deg \\rho(x) < \\deg g(x) = 3'}</Tex>
            <p className="text-sm text-slate-700">位元字串與多項式一一對應（最左邊 = 最高次）：</p>
            <div className="mt-1 space-y-1 text-sm">
              <div>
                <BitsPoly bits={G_MSB} name="g(x):" />
              </div>
              <div>
                <BitsPoly bits={DEFAULT} name="x^3u(x):" />
              </div>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              每一步減去 <M>{'x^k g(x)'}</M>（二進位就是把 1011 往右平移到最高位的位置）。因為 <M>{'1 + 1 = 0'}</M>，減法 = 加法 = 逐位 XOR。
            </p>
          </Card>
        ),
      }}
      algorithm={{
        title: '手算步驟',
        body: (
          <AlgoSteps
            steps={[
              <>把被除數寫成一列；除數 1011 的最左邊對齊被除數最左邊。</>,
              <>看除數對齊位置下的位元：若是 1，在商寫 1，並把除數與這 4 位做 XOR。</>,
              <>若是 0，在商寫 0，不做 XOR（等於減去 0）。</>,
              <>把除數往右移一格，重複，直到除數的最右邊對齊被除數的最右邊。</>,
              <>最後 3 位就是餘數；它就是同位位元 p。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: 'LFSR View ⇄ Long Division View',
        body: (
          <Card
            title="切換兩種方法；點擊被除數的位元可以改變題目"
            actions={
              <>
                <Segmented
                  value={view}
                  onChange={(v) => {
                    setView(v);
                    setKey((k) => k + 1);
                  }}
                  options={[
                    { value: 'division', label: 'Long Division View' },
                    { value: 'lfsr', label: 'LFSR View' },
                    { value: 'compare', label: '逐步比較' },
                    { value: 'sync', label: '同步對照（老師的 LFSR）' },
                  ]}
                />
                <ResetButton
                  onClick={() => {
                    setDividend([...DEFAULT]);
                    setKey((k) => k + 1);
                  }}
                />
              </>
            }
          >
            {view === 'division' && <LongDivisionView key={key} dividend={dividend} onToggle={(i) => setDividend(flipBit(dividend, i) as Bit[])} />}
            {view === 'lfsr' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  這裡使用<strong>除法器</strong>接法（輸入從 R₀ 端進入），因為輸入的是補零後的 7 位元 <span className="mono">{dividend.join('')}</span>。
                </p>
                <LfsrSim key={key} kind="divider" input={dividend} detailed={false} />
              </div>
            )}
            {view === 'sync' && (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">
                  老師的預乘式 LFSR 只輸入訊息 u = <span className="mono">{dividend.slice(0, 4).join('')}</span>（被除數的前 4 位）；左邊用「一次帶下一個位元」的長除法，每一步都與暫存器相同。
                  {dividend.slice(4).some(Boolean) && ' （注意：目前被除數後三位不是 000，這裡只使用前 4 位。）'}
                </p>
                <SyncLfsrDivision key={`s${key}-${dividend.slice(0, 4).join('')}`} u={dividend.slice(0, 4) as Bit[]} />
              </div>
            )}
            {view === 'compare' && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">已讀入 k 個 bit</th>
                      <th>前綴</th>
                      <th>長除法的部分餘數（3 位視窗）</th>
                      <th>除法器 LFSR 狀態</th>
                      <th>一致？</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dividend.map((_, i) => {
                      const k = i + 1;
                      const win = divisionWindow(dividend, k);
                      const st = lfsr.states[k];
                      const same = win.join('') === st.join('');
                      return (
                        <tr key={k} className="border-t border-slate-100">
                          <td className="py-1.5 font-mono">{k}</td>
                          <td className="font-mono">{dividend.slice(0, k).join('')}</td>
                          <td className="font-mono font-semibold">{win.join('')}</td>
                          <td className="font-mono font-semibold">{st.join('')}</td>
                          <td className={same ? 'text-emerald-700' : 'text-rose-700'}>{same ? '✓' : '✗'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-slate-500">兩欄分別由 longDivision() 與 runLfsr() 獨立計算。LFSR 的暫存器就是長除法「目前看得到的三位數」。</p>
              </div>
            )}
          </Card>
        ),
      }}
      verify={{
        title: '驗算：q(x)g(x) + ρ(x) = 被除數',
        body: (
          <>
            <Card>
              <Tex block>{`q(x)\\,g(x) + \\rho(x) = (${msbToTex(res.quotient)})(x^3+x+1) + (${msbToTex(res.remainder)}) = ${msbToTex(recon)}`}</Tex>
            </Card>
            <Checks
              items={[
                { label: <>重建結果 {recon.join('')} = 被除數 {dividend.join('')}</>, pass: recon.join('') === dividend.join('') },
                { label: <>餘數次數 &lt; 3</>, pass: res.remainder.length === 3 },
                { label: <>長除法餘數 {res.remainder.join('')} = LFSR 最後狀態 {lfsr.final.join('')}</>, pass: res.remainder.join('') === lfsr.final.join('') },
                { label: <>每一步的 LFSR 狀態都等於部分餘數</>, pass: dividend.every((_, i) => divisionWindow(dividend, i + 1).join('') === lfsr.states[i + 1].join('')) },
              ]}
            />
            <Callout kind="info" title="預設題目的答案">
              <p>
                <span className="mono">1001000 ÷ 1011</span>：商 <span className="mono">{longDivision(DEFAULT, G_MSB).quotient.join('')}</span>，餘數 <span className="mono">{longDivision(DEFAULT, G_MSB).remainder.join('')}</span>，所以 codeword <span className="mono">1001{longDivision(DEFAULT, G_MSB).remainder.join('')}</span>。
              </p>
            </Callout>
          </>
        ),
      }}
      related={[{ to: 'a-5', text: '系統式 vs 非系統式編碼、GF(2) 多項式乘法與生成多項式' }, { to: 'l2-2', text: 'LFSR 每一步的「為什麼」' }]}
      next={
        <p>
          同一個除法換個用途：接收端把收到的 <M>r</M> 除以 <M>{'g(x)'}</M>。如果沒有錯誤，餘數一定是 0；有錯誤時，餘數就是 Syndrome。
        </p>
      }
    />
  );
}
