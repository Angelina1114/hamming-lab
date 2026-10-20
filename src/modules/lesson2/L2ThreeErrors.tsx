import { useState } from 'react';
import { type Bit, DEFAULT_U, G_MSB, codewordsL2, combinations, msbToTex, polyModMsb, simulateL2, syndromeL2 } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, ResetButton } from '../../components/Lesson';
import { AlgoSteps, Chapter, Checks, L2Legend } from '../../components/l2/Common';
import { DecodeReport } from '../../components/l2/Decode';
import { CodewordGraph } from '../../components/l2/CodewordGraph';
import { MessagePicker, toggleError } from '../../components/l2/Controls';

const ID = 'l2-10';

export default function L2ThreeErrors() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [errors, setErrors] = useState<number[]>([4, 6, 7]);
  const o = simulateL2(u, errors);
  const eIsCodeword = syndromeL2(o.e).every((b) => b === 0);
  const triples = combinations(7, 3).map((t) => ({ t, o: simulateL2(u, t) }));
  const undetected = triples.filter((x) => x.o.undetected);
  const weight3 = codewordsL2().filter((x) => x.c.reduce<number>((a, b) => a + b, 0) === 3);
  const def = simulateL2(DEFAULT_U, [4, 6, 7]);

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          原始 codeword <span className="mono">1001110</span>，錯誤落在 <M>{'x^3, x^1, x^0'}</M>。收到的 <span className="mono">1000101</span> 剛好也是一個合法 codeword——Syndrome = 000，解碼器以為一切正常。這是 <strong>未偵測錯誤（Undetected Error）</strong>。
        </p>
      }
      goals={[
        <>
          計算 <M>{'e(x) = x^3 + x + 1 = g(x)'}</M> 的 Syndrome
        </>,
        '理解「錯誤模式本身是合法 codeword」時錯誤不可見',
        '計算 35 種三錯中有幾種未偵測',
        '用 codeword 集合圖理解最小 Hamming 距離',
      ]}
      intuition={{
        title: '從一個 codeword 直接跳到另一個 codeword',
        body: (
          <div className="prose-lab">
            <p>
              codeword 之間最近相距 3。如果剛好有 3 個錯誤落在「兩個 codeword 之間的差異」上，c 就被整個搬到另一個合法 codeword。接收端看到的是一個完美的合法 codeword，沒有任何症狀可言。
            </p>
          </div>
        ),
      }}
      math={{
        title: '為什麼 S = 0？',
        body: (
          <Card>
            <Tex block>{'e = 0001011 \\;\\Leftrightarrow\\; e(x) = x^3 + x + 1 = g(x)'}</Tex>
            <Tex block>{'S(x) = e(x) \\bmod g(x) = g(x) \\bmod g(x) = 0'}</Tex>
            <p className="text-sm text-slate-700">
              一般地：<M>{'S = 0 \\iff g(x) \\mid e(x) \\iff e \\in C'}</M>。錯誤模式 e 本身是 codeword 時，<M>{'r = c + e'}</M> 也是 codeword（線性碼對加法封閉）。重量 3 的 codeword 有 {weight3.length} 個，所以 35 種三錯中有 {weight3.length} 種完全看不見。
            </p>
          </Card>
        ),
      }}
      algorithm={{
        title: '解碼器看到了什麼',
        body: (
          <AlgoSteps
            steps={[
              <>計算 S = r(x) mod g(x) = 000。</>,
              <>判定「沒有偵測到錯誤」，不做任何更正。</>,
              <>直接取前 4 位：<M>{'\\hat u = 1000'}</M>（原訊息 1001）。</>,
              <>錯誤旗標 = 0：系統完全不知道資料壞了。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: '選擇三個錯誤位置',
        body: (
          <Card
            title="點擊接收字的位元（最多 3 個錯誤）"
            actions={
              <ResetButton
                onClick={() => {
                  setU([...DEFAULT_U]);
                  setErrors([4, 6, 7]);
                }}
              />
            }
          >
            <div className="mb-4 space-y-2">
              <MessagePicker u={u} onChange={setU} size="sm" />
              <L2Legend />
            </div>
            <DecodeReport o={o} method="lookup" onToggle={(i) => setErrors(toggleError(errors, i + 1, 3))} />
            <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
              <M>{`e(x) = ${msbToTex(o.e)}`}</M>，<M>{`e(x) \\bmod g(x) = ${polyModMsb(o.e, G_MSB).join('')}`}</M>
              {o.errorCount === 0 ? (
                <span className="ml-2 text-slate-600">→ 沒有錯誤（e = 0）</span>
              ) : eIsCodeword ? (
                <strong className="ml-2 text-rose-700">→ e 本身是 codeword，錯誤不可見</strong>
              ) : (
                <span className="ml-2 text-slate-600">→ e 不是 codeword，S ≠ 0{o.success ? '（單一錯誤，可正確更正）' : '（但會誤更正）'}</span>
              )}
            </div>
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-slate-700">Codeword 集合圖：r 落在哪裡？</div>
              <CodewordGraph sent={o.c} received={o.r} decoded={o.decode.corrected} />
            </div>
          </Card>
        ),
      }}
      verify={{
        title: '對全部 35 種三錯窮舉',
        body: (
          <>
            <Checks
              items={[
                { label: <>預設：e = {def.e.join('')}，r = {def.r.join('')}，S = {def.decode.syndrome.join('')}</>, pass: def.r.join('') === '1000101' && def.undetected },
                { label: <>預設：輸出訊息 {def.decode.message.join('')} ≠ 1001</>, pass: def.decode.message.join('') === '1000' },
                { label: <>對 u = {u.join('')}：35 種三錯中未偵測 {undetected.length} 種、誤更正 {triples.filter((x) => x.o.miscorrection).length} 種、正確 0 種</>, pass: undetected.length === 7 && triples.every((x) => !x.o.success) },
                { label: <>未偵測的 7 種錯誤樣式 = 7 個重量 3 的 codeword</>, pass: undetected.map((x) => x.o.e.join('')).sort().join() === weight3.map((x) => x.c.join('')).sort().join() },
              ]}
            />
            <Card title="7 種「看不見」的三錯樣式（每一個都是 g(x) 的倍數）">
              <div className="flex flex-wrap gap-2">
                {undetected.map((x) => (
                  <span key={x.t.join()} className={`rounded-lg border px-2 py-1 font-mono text-sm ${x.t.join() === errors.join() ? 'border-rose-500 bg-rose-50 text-rose-700' : 'border-slate-200'}`}>
                    {x.o.e.join('')} <span className="text-xs text-slate-400">#{x.t.join(',')}</span>
                  </span>
                ))}
              </div>
            </Card>
            <Callout kind="warning" title="Undetected Error 比 Miscorrection 更危險">
              <p>誤更正至少有「S ≠ 0」這個痕跡，系統可以記錄錯誤次數；未偵測錯誤則完全不留痕跡。這是任何 <M>{'d_{\\min} = 3'}</M> 的 code 都無法避免的：一定存在 3 個錯誤能把一個 codeword 變成另一個 codeword。</p>
            </Callout>
          </>
        ),
      }}
      next={
        <p>
          能不能至少<strong>知道</strong>自己修不好？只要再花一個 bit：加入整體同位位元，把 <M>{'d_{\\min}'}</M> 從 3 提高到 4，就能可靠地偵測雙錯——這就是 SECDED。
        </p>
      }
    />
  );
}
