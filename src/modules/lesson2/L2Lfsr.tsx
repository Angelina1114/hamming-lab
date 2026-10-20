import { useState } from 'react';
import { type Bit, type LfsrKind, DEFAULT_U, G_MSB, encodeCyclic, polyModMsb, runLfsr } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, Derivation, Expandable, ResetButton, Segmented } from '../../components/Lesson';
import { AlgoSteps, Chapter, Checks } from '../../components/l2/Common';
import { LfsrModeToggle, LfsrSim, OverflowViz } from '../../components/l2/LfsrSim';
import { MessagePicker } from '../../components/l2/Controls';

const ID = 'l2-2';

export default function L2Lfsr() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [kind, setKind] = useState<LfsrKind>('encoder');
  const [feedZeros, setFeedZeros] = useState(false);
  const [detailed, setDetailed] = useState(true);
  const [resetKey, setResetKey] = useState(0);

  const input: Bit[] = kind === 'divider' || feedZeros ? [...u, 0, 0, 0] : [...u];
  const enc = encodeCyclic(u);
  const encRun = runLfsr(u, 'encoder');
  const divRun = runLfsr([...u, 0, 0, 0], 'divider');
  const wrongRun = runLfsr([...u, 0, 0, 0], 'encoder');

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          LFSR（Linear Feedback Shift Register，線性回授移位暫存器）是編碼器的硬體心臟：三個 1-bit 暫存器、兩個 XOR 閘，每個時脈吃進一個 bit，最後留在暫存器裡的就是同位位元。
        </p>
      }
      goals={[
        <>解釋為什麼需要三個暫存器（餘數的次數 &lt; 3）</>,
        <>理解左移 = 乘以 <M>x</M></>,
        <>看懂 feedback 為何要 XOR，以及回授位置為何由 g(x) 決定</>,
        <>
          用圖形理解 <M>{'x^3 \\equiv x + 1 \\pmod{g(x)}'}</M>，說明 000 → 011
        </>,
        <>區分「預乘式編碼器」與「除法器」兩種 LFSR</>,
      ]}
      intuition={{
        title: '暫存器 = 餘數的係數',
        body: (
          <>
            <div className="prose-lab">
              <p>
                除以三次多項式 <M>{'g(x)'}</M> 的餘數，次數最多是 2，也就是 <M>{'R_2x^2 + R_1x + R_0'}</M>——剛好三個係數，所以需要三個暫存器 <M>{'R_2R_1R_0'}</M>。
              </p>
              <p>
                每讀入一個新 bit，原本的餘數要乘以 <M>x</M>（每個係數升一次方 = 往左移一格）。最左邊的 <M>{'R_2'}</M> 會變成 <M>{'x^3'}</M> 項「溢出」暫存器；但在 mod <M>{'g(x)'}</M> 的世界裡 <M>{'x^3 = x + 1'}</M>，所以溢出的那個 1 要「回授」加到 <M>x</M> 和 <M>1</M> 的位置。
              </p>
            </div>
            <Card title="圖解：x³ ≡ x + 1（為什麼第一次輸入 1 會得到 011）">
              <OverflowViz />
              <p className="mt-2 text-xs text-slate-500">
                這條規則的代數來源（為什麼可以把 x³ 換成 x + 1）：<a className="text-indigo-700 underline" href="#/a-3">A3 不可約多項式與商環</a>。
              </p>
            </Card>
          </>
        ),
      }}
      math={{
        title: '從遞迴式推出 LFSR 的更新規則',
        body: (
          <>
            <Card>
              <p className="text-sm text-slate-700">
                設已讀入的 bit 組成多項式 <M>b(x)</M>，預乘式編碼器維持 <M>{'R(x) = x^3 b(x) \\bmod g(x)'}</M>。讀入下一個 bit <M>{'b_{\\text{new}}'}</M> 後，<M>{'b(x) \\to x\\,b(x) + b_{\\text{new}}'}</M>：
              </p>
              <Tex block>{"R'(x) = x\\,R(x) + b_{\\text{new}}\\,x^3 \\bmod g(x) = (R_2 \\oplus b_{\\text{new}})\\,x^3 + R_1x^2 + R_0x \\bmod g(x)"}</Tex>
              <p className="text-sm text-slate-700">
                令 <M>{'\\text{fb} = b_{\\text{new}} \\oplus R_2'}</M>，再用 <M>{'x^3 \\equiv x + 1'}</M> 把 <M>{'\\text{fb}\\cdot x^3'}</M> 換掉：
              </p>
              <Tex block>{"R'(x) = R_1x^2 + (R_0 \\oplus \\text{fb})\\,x + \\text{fb} \\;\\Longrightarrow\\; R_2' = R_1,\\quad R_1' = R_0 \\oplus \\text{fb},\\quad R_0' = \\text{fb}"}</Tex>
            </Card>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Expandable title="為什麼需要三個暫存器？" defaultOpen>
                <p>餘數的次數 &lt; deg g = 3，只有 <M>{'x^2, x, 1'}</M> 三個係數要記。一般而言，<M>{'\\deg g = m'}</M> 就需要 m 個暫存器。</p>
              </Expandable>
              <Expandable title="為什麼要左移？左移為什麼是乘以 x？" defaultOpen>
                <p>
                  暫存器排成 <M>{'R_2R_1R_0'}</M> = <M>{'x^2, x, 1'}</M> 的係數。乘以 <M>x</M> 讓每一項升一次：<M>{'R_0 \\to x'}</M> 的位置、<M>{'R_1 \\to x^2'}</M>、<M>{'R_2 \\to x^3'}</M>——在圖上就是每個值往左移一格。
                </p>
              </Expandable>
              <Expandable title="為什麼 feedback 要 XOR？">
                <p>
                  左移後的 <M>{'x^3'}</M> 係數 = <M>{'R_2'}</M>，再加上新輸入的 <M>{'b\\,x^3'}</M>（預乘），兩者在 GF(2) 相加就是 XOR。XOR 也用在回授：把 <M>{'\\text{fb}\\cdot(x+1)'}</M> 加到暫存器，GF(2) 的加法就是 XOR。
                </p>
              </Expandable>
              <Expandable title="為什麼回授位置由 g(x) 決定？">
                <p>
                  回授是在套用 <M>{'x^3 \\equiv g(x) - x^3 = x + 1'}</M>。<M>{'g(x)'}</M> 的 <M>{'x^1'}</M> 與 <M>{'x^0'}</M> 係數是 1，<M>{'x^2'}</M> 係數是 0，所以 fb XOR 進 <M>{'R_1'}</M> 與 <M>{'R_0'}</M>，<M>{'R_2'}</M> 直接接 <M>{'R_1'}</M>。換一個 g(x)，接線就跟著改。
                </p>
              </Expandable>
              <Expandable title="Feedback = 1 時，為什麼 XOR 011？">
                <p>
                  要消去溢出的 <M>{'x^3'}</M>，就減去 <M>{'g(x) = x^3 + x + 1'}</M>（GF(2) 中減 = 加）。<M>{'x^3'}</M> 那一項正好和溢出位抵消，不在暫存器裡；剩下的 <M>{'x + 1'}</M> 對應到 <M>{'(R_2, R_1, R_0)'}</M> 就是 <span className="mono">011</span>。換一個 g(x)，mask 就跟著改。
                </p>
              </Expandable>
              <Expandable title="為什麼最後的暫存器就是 Parity？">
                <p>
                  每一步都維持 <M>{'R^{(k)}(x) = x^3\\,(u_1 \\dots u_k)(x) \\bmod g(x)'}</M>（上標 (k) 表示讀入 k 個 bit 後的整體狀態，和暫存器 R₂、R₁、R₀ 的下標無關）。4 個訊息位元讀完時，<M>{'R^{(4)}(x) = x^3u(x) \\bmod g(x)'}</M>，正是系統式編碼需要的同位位元 p。（系統式與 <M>{'m(x)g(x)'}</M> 兩種編碼的差別見 A5。）
                </p>
              </Expandable>
            </div>
          </>
        ),
      }}
      algorithm={{
        title: '每個時脈做四件事',
        body: (
          <>
            <AlgoSteps
              steps={[
                <>讀入下一個 bit（MSB 先，也就是最高次項先進來）。</>,
                <>
                  計算 <M>{'\\text{feedback} = \\text{input} \\oplus R_2'}</M>。
                </>,
                <>
                  左移：<M>{"R_2 \\leftarrow R_1,\\ R_1 \\leftarrow R_0,\\ R_0 \\leftarrow 0"}</M>（乘以 x）。
                </>,
                <>
                  依 g(x) 回授：<M>{"R_1 \\mathrel{\\oplus}= \\text{fb},\\ R_0 \\mathrel{\\oplus}= \\text{fb}"}</M>。全部輸入完後，暫存器 = 同位位元 p。
                </>,
              ]}
            />
            <Callout kind="warning" title="這個電路應該輸入幾個 bit？">
              <p>
                上面的規則（input 在 <M>{'R_2'}</M> 端與 feedback 相加）是<strong>預乘式</strong>：每個輸入 bit 已經被放到 <M>{'x^3'}</M> 的位置，相當於自動乘上 <M>{'x^3'}</M>。所以只要輸入 4 個訊息位元 <span className="mono">{u.join('')}</span>，暫存器就停在 <M>{'x^3u(x) \\bmod g(x)'}</M>。
              </p>
              <p>
                若把補零後的 7 個 bit <span className="mono">{[...u, 0, 0, 0].join('')}</span> 全送進這個電路，會多乘一次 <M>{'x^3'}</M>，得到 <span className="mono">{wrongRun.final.join('')}</span>（不是同位位元）。要輸入補零後的 7 bit，必須改用「除法器」接法：輸入從 <M>{'R_0'}</M> 端進入，feedback 只取 <M>{'R_2'}</M>。下方實驗可以切換兩種接法比較。
              </p>
            </Callout>
          </>
        ),
      }}
      interactive={{
        title: 'LFSR 逐步模擬器',
        body: (
          <Card
            title="選擇接法與訊息，按「下一步」逐 bit 執行"
            actions={
              <>
                <LfsrModeToggle
                  kind={kind}
                  onChange={(k) => {
                    setKind(k);
                    setFeedZeros(false);
                    setResetKey((x) => x + 1);
                  }}
                />
                <Segmented
                  value={detailed ? 'd' : 's'}
                  onChange={(v) => {
                    setDetailed(v === 'd');
                    setResetKey((x) => x + 1);
                  }}
                  options={[
                    { value: 'd', label: '細部動畫（4 階段）' },
                    { value: 's', label: '每 bit 一步' },
                  ]}
                />
                <ResetButton
                  onClick={() => {
                    setU([...DEFAULT_U]);
                    setKind('encoder');
                    setFeedZeros(false);
                    setDetailed(true);
                    setResetKey((x) => x + 1);
                  }}
                />
              </>
            }
          >
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <MessagePicker
                u={u}
                onChange={(v) => {
                  setU(v);
                  setResetKey((x) => x + 1);
                }}
                size="sm"
              />
              {kind === 'encoder' && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={feedZeros}
                    onChange={(e) => {
                      setFeedZeros(e.target.checked);
                      setResetKey((x) => x + 1);
                    }}
                    className="h-4 w-4 accent-slate-900"
                  />
                  實驗：把補的三個 0 也送進預乘式電路
                </label>
              )}
            </div>
            <LfsrSim key={`${resetKey}-${kind}-${detailed}`} kind={kind} input={input} detailed={detailed} extraTail={input.length > 4 ? 3 : 0} />
            {kind === 'encoder' && feedZeros && (
              <div className="mt-3">
                <Callout kind="misconception" title="結果不是同位位元">
                  <p>
                    送完 7 個 bit 後暫存器是 <span className="mono">{wrongRun.final.join('')}</span>，等於 <M>{'x^3 \\cdot x^3u(x) \\bmod g(x)'}</M>；正確的同位位元 <span className="mono">{enc.parity.join('')}</span> 早在第 4 個 bit 時就出現了。
                  </p>
                </Callout>
              </div>
            )}
          </Card>
        ),
      }}
      verify={{
        title: 'LFSR 的結果和長除法一致嗎？',
        body: (
          <>
            <Checks
              items={[
                { label: <>預乘式編碼器輸入 u = {u.join('')}：最後狀態 {encRun.final.join('')}</>, pass: encRun.final.join('') === enc.parity.join(''), detail: `長除法餘數 = ${enc.parity.join('')}` },
                { label: <>除法器輸入 x³u = {[...u, 0, 0, 0].join('')}：最後狀態 {divRun.final.join('')}</>, pass: divRun.final.join('') === enc.parity.join('') },
                {
                  label: <>編碼器每一步的狀態 = x³·(已讀入的前綴) mod g(x)</>,
                  pass: encRun.states.every((st, k) => st.join('') === polyModMsb([...u.slice(0, k), 0, 0, 0], G_MSB).join('')),
                  detail: encRun.states.map((x) => x.join('')).join(' → '),
                },
                { label: <>Codeword c = u ‖ p = {enc.codeword.join('')} 被 g(x) 整除</>, pass: polyModMsb(enc.codeword, G_MSB).every((b) => b === 0) },
              ]}
            />
            <Derivation
              title="手算驗證 u = 1001 的四個時脈"
              steps={runLfsr(DEFAULT_U, 'encoder').steps.map((st, k) => ({
                title: `時脈 ${k + 1}：輸入 ${st.input}`,
                body: (
                  <Tex block>{`\\text{fb} = ${st.input}\\oplus ${st.before[0]} = ${st.feedback};\\quad R_2'R_1'R_0' = ${st.before[1]},\\ ${st.before[2]}\\oplus${st.feedback},\\ ${st.feedback} = ${st.after.join('')}`}</Tex>
                ),
              }))}
            />
          </>
        ),
      }}
      related={[{ to: 'l2-3', text: '長除法與 LFSR 的同步對照' }, { to: 'a-5', text: '系統式 vs 非系統式編碼的代數' }, { to: 'a-3', text: 'x³ ≡ x + 1 的代數來源：商環' }]}
      next={
        <p>
          LFSR 是「一次處理一個 bit」的除法。下一章用紙筆做同一個除法——二進位長除法，並把兩種方法並排比較，看清楚暫存器裡的值就是長除法每一步的部分餘數。
        </p>
      }
    />
  );
}
