import { useState } from 'react';
import { type Bit, DEFAULT_U, decodeL2, encodeCyclic, msbToTex, simulateL2 } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, ResetButton } from '../../components/Lesson';
import { AlgoSteps, BitStrip, Chapter, Checks } from '../../components/l2/Common';
import { AlphaCheck } from '../../components/l2/Field';
import { XorView, correctedStates } from '../../components/l2/Decode';
import { MessagePicker } from '../../components/l2/Controls';

const ID = 'l2-8';

export default function L2Xor() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [pos, setPos] = useState(2);
  const [key, setKey] = useState(0);
  const o = simulateL2(u, [pos]);
  const d = o.decode;
  const allSingles = [1, 2, 3, 4, 5, 6, 7].every((p) => simulateL2(u, [p]).success);

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          知道錯誤位置之後，更正只需要一個 XOR。但真正負責任的 decoder 還要<strong>驗證</strong>：更正後的字是否真的是合法 codeword？還原的訊息是否可信？
        </p>
      }
      goals={[
        <>由錯誤位置產生估計的 error vector <M>{'\\hat e'}</M></>,
        <>計算 <M>{'\\hat c = r \\oplus \\hat e'}</M></>,
        <>驗證 <M>{'\\hat c(\\alpha) = 0'}</M></>,
        '從 systematic code 取出還原訊息，並理解「合法 ≠ 正確」',
      ]}
      intuition={{
        title: '翻轉一個開關',
        body: (
          <div className="prose-lab">
            <p>
              GF(2) 中 <M>{'b \\oplus 1'}</M> 會把 b 翻轉，<M>{'b \\oplus 0 = b'}</M> 不變。所以「在第 2 位放 1、其他放 0」的向量 <span className="mono">0100000</span>，和 r 做 XOR，就剛好只改第 2 位。
            </p>
            <p>
              為什麼這一定能改回原本的 c？因為 <M>{'r = c \\oplus e'}</M>，若 <M>{'\\hat e = e'}</M>，則 <M>{'r \\oplus \\hat e = c \\oplus e \\oplus e = c'}</M>（<M>{'e \\oplus e = 0'}</M>）。
            </p>
          </div>
        ),
      }}
      math={{
        title: '更正與驗證的數學',
        body: (
          <Card>
            <Tex block>{'\\hat e(x) = x^{i},\\qquad \\hat c(x) = r(x) + \\hat e(x)'}</Tex>
            <Tex block>{'\\hat c \\in C \\iff g(x) \\mid \\hat c(x) \\iff \\hat c(\\alpha) = 0'}</Tex>
            <p className="text-sm text-slate-700">
              預設例子：<M>{'\\hat c = 1001110,\\ \\hat c(x) = x^6 + x^3 + x^2 + x'}</M>，代入 <M>{'\\alpha'}</M>：<M>{'\\alpha^6 + \\alpha^3 + \\alpha^2 + \\alpha = 101 \\oplus 011 \\oplus 100 \\oplus 010 = 000'}</M>。
            </p>
            <p className="text-sm text-slate-700">在 systematic code 中，前 4 位就是訊息：<M>{'\\hat u = \\hat c_1\\hat c_2\\hat c_3\\hat c_4'}</M>。</p>
          </Card>
        ),
      }}
      algorithm={{
        title: '更正與驗證步驟',
        body: (
          <AlgoSteps
            steps={[
              <>由錯誤次方 i 產生 <M>{'\\hat e'}</M>：位置 7 − i 為 1，其他為 0。</>,
              <>逐位 XOR：<M>{'\\hat c = r \\oplus \\hat e'}</M>。</>,
              <>驗證：計算 <M>{'\\hat c(\\alpha)'}</M>（或 <M>{'\\hat c(x) \\bmod g(x)'}</M>），應為 0。</>,
              <>取前 4 位為 <M>{'\\hat u'}</M>，連同狀態旗標輸出。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: 'XOR 更正動畫',
        body: (
          <Card
            title="選擇訊息與錯誤位置"
            actions={
              <ResetButton
                onClick={() => {
                  setU([...DEFAULT_U]);
                  setPos(2);
                  setKey((k) => k + 1);
                }}
              />
            }
          >
            <div className="mb-4 space-y-3">
              <MessagePicker
                u={u}
                onChange={(v) => {
                  setU(v);
                  setKey((k) => k + 1);
                }}
                size="sm"
              />
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">接收 r（點擊選錯誤位置）</span>
                <BitStrip
                  bits={o.r}
                  size="sm"
                  groups={false}
                  states={o.r.map((_, k) => (k === pos - 1 ? 'error' : 'normal'))}
                  onToggle={(k) => {
                    setPos(k + 1);
                    setKey((x) => x + 1);
                  }}
                />
              </div>
              <p className="text-sm text-slate-600">
                Syndrome <span className="mono">{d.syndrome.join('')}</span> → 位置 {d.position} → <M>{`\\hat e = ${d.estimatedError.join('')}`}</M>
              </p>
            </div>
            <XorView key={key} r={o.r} e={d.estimatedError} />
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-500">更正結果</div>
                <BitStrip bits={d.corrected} states={correctedStates(o.e, d.position)} />
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold text-slate-500">驗證 ĉ(α)</div>
                <AlphaCheck word={d.corrected} />
              </div>
            </div>
            <div className="mt-4 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-sm">
              還原訊息（Recovered Message）û = <span className="mono font-bold">{d.message.join('')}</span> {o.success ? '=' : '≠'} 原始訊息（Original Message）u = <span className="mono font-bold">{u.join('')}</span> {o.success ? '✓' : '✗'}
            </div>
          </Card>
        ),
      }}
      verify={{
        title: '驗證與限制',
        body: (
          <>
            <Checks
              items={[
                { label: <>預設例子：1101110 ⊕ 0100000 = {decodeL2([1, 1, 0, 1, 1, 1, 0]).corrected.join('')}</>, pass: decodeL2([1, 1, 0, 1, 1, 1, 0]).corrected.join('') === '1001110' },
                { label: <>ĉ(α) = 0（目前例子）</>, pass: d.check === 0, detail: <M>{`\\hat c(x) = ${msbToTex(d.corrected)}`}</M> },
                { label: <>還原訊息 = 原訊息</>, pass: o.success },
                { label: <>對訊息 {u.join('')}，7 種單一錯誤全部正確還原</>, pass: allSingles },
                { label: <>原始 codeword c = {encodeCyclic(u).codeword.join('')}</>, pass: d.corrected.join('') === encodeCyclic(u).codeword.join('') },
              ]}
            />
            <Callout kind="warning" title="合法 codeword 檢查通過 ≠ 一定還原原始訊息">
              <p>
                <M>{'\\hat c(\\alpha) = 0'}</M> 只證明 <M>{'\\hat c'}</M> 是 16 個合法 codeword 之一，不能證明它就是送出的那一個。如果錯誤超過 1 個，decoder 可能把 r 推到另一個合法 codeword——驗證照樣通過，但訊息是錯的。下一章就是這種情況。
              </p>
            </Callout>
          </>
        ),
      }}
      related={[{ to: 'a-9', text: 'ĉ(α) = 0 ⇔ H_cyc ĉᵀ = 0' }]}
      next={
        <p>
          到這裡，單一錯誤的完整流程已經走完。接下來兩章故意「超載」：注入兩個、三個錯誤，看看這個 decoder 會發生什麼事。
        </p>
      }
    />
  );
}
