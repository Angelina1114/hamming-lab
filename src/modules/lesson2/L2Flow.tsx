import { useState } from 'react';
import { type Bit, type L2Method, DEFAULT_U, encodeCyclic, simulateL2, syndromeL2 } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, ResetButton, Segmented } from '../../components/Lesson';
import { AlgoSteps, BitStrip, Chapter, Checks, L2Legend } from '../../components/l2/Common';
import { FlowDiagram } from '../../components/l2/FlowDiagram';
import { MessagePicker, PresetButtons } from '../../components/l2/Controls';

const ID = 'l2-1';

export default function L2Flow() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [errors, setErrors] = useState<number[]>([2]);
  const [secded, setSecded] = useState(false);
  const [method, setMethod] = useState<L2Method>('chien');
  const enc = encodeCyclic(u);
  const o = simulateL2(u, errors.filter((p) => p <= 7), method);

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          第一課從「為什麼」理解了 Hamming Code。第二課要把它變成一條真正能執行的流水線：從訊息 <M>u</M> 出發，經過 LFSR 編碼、通道、Syndrome、錯誤定位、XOR 更正，最後還原 <M>{'\\hat u'}</M>。這一章先看全貌，之後每一章放大其中一個方塊。
        </p>
      }
      goals={[
        '說出編碼器、通道、解碼器各由哪些模組組成',
        '追蹤同一個例子 u = 1001 在每個模組中的資料',
        '知道 Syndrome、Chien Search、XOR 更正各自負責什麼',
        '理解 SECDED、整體同位位元（Overall Parity）、緩衝區（Buffer）、錯誤旗標的位置',
      ]}
      intuition={{
        title: '一封信的旅程',
        body: (
          <div className="prose-lab max-w-3xl">
            <p>
              把資料想成寄信：寄件人在信末附上「同位位元」（編碼）；郵差可能弄髒幾個字（通道）；收件人先算一次同位位元，發現「症狀值」（Syndrome），從症狀值推理是哪個字被弄髒（錯誤定位），最後把那個字改回來（XOR 更正）。
            </p>
            <p>
              關鍵在於：收件人<strong>看不到原信</strong>，只能從收到的內容本身推理。這要求寄件人加上的同位位元有非常特別的數學結構——生成多項式 <M>{'g(x) = x^3 + x + 1'}</M>。
            </p>
          </div>
        ),
      }}
      math={{
        title: '整條流水線的數學',
        body: (
          <Card>
            <div className="space-y-1 text-sm">
              <Tex block>{'\\underbrace{c(x) = x^3u(x) + \\big(x^3u(x) \\bmod g(x)\\big)}_{\\text{編碼}} \\quad \\underbrace{r(x) = c(x) + e(x)}_{\\text{通道}} \\quad \\underbrace{S(x) = r(x) \\bmod g(x)}_{\\text{Syndrome}}'}</Tex>
              <Tex block>{'S_1 = S(\\alpha) \\in \\mathrm{GF}(8),\\qquad \\sigma(z) = 1 + S_1 z,\\qquad \\sigma(\\alpha^{-i}) = 0 \\Rightarrow \\text{錯在 } x^i,\\qquad \\hat c = r \\oplus \\hat e'}</Tex>
            </div>
            <p className="mt-2 text-sm text-slate-600">
              用統一的例子：<M>{'u = 1001'}</M>，<M>{`c = ${enc.codeword.join('')}`}</M>。後面每一章都會實際計算其中一段。
            </p>
          </Card>
        ),
      }}
      algorithm={{
        title: '演算法總覽',
        body: (
          <AlgoSteps
            steps={[
              <>編碼：把 u 補三個 0 得到 <M>{'x^3u(x)'}</M>，用 LFSR（或長除法）求除以 g(x) 的餘數 p，輸出 <M>{'c = u \\,\\|\\, p'}</M>。（2-2、2-3）</>,
              <>通道加入錯誤：<M>{'r = c \\oplus e'}</M>。接收端把 r 存入緩衝區。</>,
              <>計算 Syndrome <M>{'S(x) = r(x) \\bmod g(x)'}</M>；S = 0 表示「看起來沒有錯」。（2-4）</>,
              <>錯誤定位：查表（2-5），或用 Key Equation 與 Chien Search（2-6、2-7）找出錯誤次方 i。</>,
              <>更正邏輯產生 <M>{'\\hat e'}</M>，<M>{'\\hat c = r \\oplus \\hat e'}</M>，驗證 <M>{'\\hat c(\\alpha) = 0'}</M>，取前 4 位為 <M>{'\\hat u'}</M>。（2-8）</>,
              <>SECDED 模式額外檢查整體同位，遇到雙錯就設旗標、不更正。（2-11）</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: '互動流程圖',
        body: (
          <Card
            title="點擊任一模組查看說明；用播放控制逐步執行"
            actions={
              <>
                <Segmented
                  value={method}
                  onChange={setMethod}
                  options={[
                    { value: 'chien', label: 'Chien Search' },
                    { value: 'lookup', label: '查表 Lookup' },
                  ]}
                />
                <Segmented
                  value={secded ? 'on' : 'off'}
                  onChange={(v) => {
                    setSecded(v === 'on');
                    if (v === 'off') setErrors((e) => e.filter((p) => p <= 7));
                  }}
                  options={[
                    { value: 'off', label: 'Hamming(7,4)' },
                    { value: 'on', label: 'SECDED (8,4)' },
                  ]}
                />
                <ResetButton
                  onClick={() => {
                    setU([...DEFAULT_U]);
                    setErrors([2]);
                    setSecded(false);
                    setMethod('chien');
                  }}
                />
              </>
            }
          >
            <div className="mb-4 space-y-3">
              <MessagePicker u={u} onChange={setU} size="sm" />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">通道錯誤（點擊位元或選範例）</span>
                <PresetButtons errors={errors} onPick={setErrors} />
              </div>
              <BitStrip
                bits={secded ? [...enc.codeword, enc.codeword.reduce<number>((a, b) => a ^ b, 0) as Bit] : enc.codeword}
                size="sm"
                states={(secded ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7]).map((p) => (errors.includes(p) ? 'error' : 'normal'))}
                onToggle={(i) => setErrors((e) => (e.includes(i + 1) ? e.filter((p) => p !== i + 1) : [...e, i + 1].sort((a, b) => a - b)))}
              />
              <L2Legend overall={secded} />
            </div>
            <FlowDiagram u={u} errors={errors} secded={secded} method={method} />
          </Card>
        ),
      }}
      verify={{
        title: '這條流水線真的有用嗎？',
        body: (
          <>
            <Checks
              items={[
                { label: <>編碼後 c(x) 被 g(x) 整除</>, pass: syndromeL2(enc.codeword).every((b) => b === 0), detail: `S(c) = ${syndromeL2(enc.codeword).join('')}` },
                { label: <>無錯誤時解碼結果 = 原始訊息</>, pass: simulateL2(u, []).success },
                { label: <>任一單一錯誤都能修好（7 種全部測試）</>, pass: [1, 2, 3, 4, 5, 6, 7].every((p) => simulateL2(u, [p], method).success) },
                { label: <>目前的錯誤情境：{o.errorCount} 個錯誤，結果 {o.success ? '正確還原' : o.undetected ? '未偵測' : '誤更正'}</>, pass: o.errorCount <= 1 ? o.success : true, detail: o.errorCount >= 2 ? '（超過更正能力，第 2-9、2-10 章詳細說明）' : '' },
              ]}
            />
            <Callout kind="warning" title="流水線的保證範圍">
              <p>Hamming(7,4) 只保證更正 1 個錯誤。選「兩個錯誤」或「三個錯誤」範例，觀察流水線如何「自信地」產生錯誤結果——這是第 2-9、2-10 章的主題。</p>
            </Callout>
          </>
        ),
      }}
      related={[{ to: 'a-0', text: '代數背景：為什麼需要 g(x) 與 GF(8)（概念地圖）' }]}
      next={
        <p>
          流程圖第二個方塊「LFSR」是編碼的核心：只用三個暫存器和兩個 XOR 閘，就能算出 <M>{'x^3u(x) \\bmod g(x)'}</M>。下一章一個時脈一個時脈地拆開它。
        </p>
      }
    />
  );
}
