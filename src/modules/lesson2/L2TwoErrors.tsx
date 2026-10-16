import { useState } from 'react';
import { type Bit, DEFAULT_U, LOG, alphaPow, codewordsL2, combinations, fieldToBits, minimumDistance, positionToExponent, simulateL2, correctionCapability } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, ResetButton } from '../../components/Lesson';
import { AlgoSteps, Chapter, Checks, L2Legend } from '../../components/l2/Common';
import { DecodeReport } from '../../components/l2/Decode';
import { CodewordGraph } from '../../components/l2/CodewordGraph';
import { MessagePicker, toggleError } from '../../components/l2/Controls';

const ID = 'l2-9';

export default function L2TwoErrors() {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const [errors, setErrors] = useState<number[]>([2, 7]);
  const o = simulateL2(u, errors, 'chien');
  const d = o.decode;
  const exps = errors.map((p) => positionToExponent(p));
  const dmin = minimumDistance(codewordsL2().map((x) => x.c)).dmin;
  const pairs = combinations(7, 2).map((pp) => ({ pp, o: simulateL2(u, pp) }));
  const allMis = pairs.every((p) => p.o.miscorrection);

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          這一章非常重要：兩個錯誤時，解碼器<strong>不會</strong>失敗得很明顯。它會很有自信地「更正」一個本來正確的位元，交出一個通過驗證、卻是錯的 codeword。這叫做 <strong>誤更正（Miscorrection）</strong>。
        </p>
      }
      goals={[
        '計算兩個錯誤時的 Syndrome：S = αᵃ + αᵇ',
        '追蹤單錯解碼器如何再翻轉一個本來正確的 bit（錯誤變成 3 個）',
        <>
          理解「更正後 <M>{'\\hat c(\\alpha) = 0'}</M>」不代表還原正確
        </>,
        <>
          由 <M>{'d_{\\min} = 3'}</M> 推出 <M>{'t = 1'}</M>
        </>,
      ]}
      intuition={{
        title: '被推到鄰居家門口',
        body: (
          <div className="prose-lab max-w-3xl">
            <p>
              每個合法 codeword 周圍有一圈「距離 1」的字串，解碼器會把它們都拉回中心的 codeword。兩個錯誤把 c 推到距離 2 的地方——那裡已經是<strong>另一個 codeword 的地盤</strong>（距離 1），解碼器就把它拉到那個錯的 codeword 去。
            </p>
            <p>解碼器只能看到 r，它無法分辨「從 c 走了 2 步」和「從另一個 codeword 走了 1 步」。</p>
          </div>
        ),
      }}
      math={{
        title: '兩個錯誤的 Syndrome 與最小距離',
        body: (
          <Card>
            <Tex block>{'e(x) = x^a + x^b \\;\\Rightarrow\\; S_1 = e(\\alpha) = \\alpha^a + \\alpha^b'}</Tex>
            <p className="text-sm text-slate-700">GF(8) 中兩個不同元素的和仍是某個非零元素 <M>{'\\alpha^k'}</M>，於是解碼器以為錯誤只在 <M>{'x^k'}</M>。</p>
            <Tex block>{'\\text{預設：}\\ e(x) = x^5 + 1,\\quad S = \\alpha^5 + 1 = 111 \\oplus 001 = 110 = \\alpha^4 \\Rightarrow \\text{翻轉 } x^4\\ (\\text{第 3 個 bit})'}</Tex>
            <Tex block>{`d_{\\min} = ${dmin} \\;\\Rightarrow\\; t = \\left\\lfloor \\tfrac{d_{\\min}-1}{2} \\right\\rfloor = ${correctionCapability(dmin)}`}</Tex>
            <p className="text-sm text-slate-700">
              兩個錯誤後 <M>{'d_H(r, c) = 2'}</M>；因為 Hamming Code 是完美碼，每個字串都恰好在某個 codeword 的距離 1 以內，所以存在 <M>{"c'"}</M> 使 <M>{"d_H(r, c') = 1 < 2"}</M>。最近 codeword 解碼必然選錯。
            </p>
          </Card>
        ),
      }}
      algorithm={{
        title: '單錯解碼器在雙錯時的行為',
        body: (
          <AlgoSteps
            steps={[
              <>計算 S = r(x) mod g(x)，結果不為 0（兩個不同的 αᵃ、αᵇ 相加不會是 0）。</>,
              <>把 S 當作單一錯誤：S = αᵏ ⇒ 錯在 xᵏ。</>,
              <>翻轉 xᵏ：此時錯誤位元變成 3 個（原本 2 個 + 新翻轉 1 個）。</>,
              <>
                檢查 <M>{'\\hat c(\\alpha)'}</M>：= 0，因為 3 個錯誤剛好湊成一個 codeword。驗證「通過」。
              </>,
            ]}
          />
        ),
      }}
      interactive={{
        title: '選擇兩個錯誤位置',
        body: (
          <Card
            title="點擊接收字的位元選擇錯誤（最多 2 個）"
            actions={
              <ResetButton
                onClick={() => {
                  setU([...DEFAULT_U]);
                  setErrors([2, 7]);
                }}
              />
            }
          >
            <div className="mb-4 space-y-2">
              <MessagePicker u={u} onChange={setU} size="sm" />
              <L2Legend />
            </div>
            <DecodeReport o={o} method="chien" onToggle={(i) => setErrors(toggleError(errors, i + 1, 2))} />
            {errors.length === 2 && d.field !== 0 && (
              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                <Tex>{`S_1 = \\alpha^{${exps[0]}} + \\alpha^{${exps[1]}} = ${fieldToBits(alphaPow(exps[0])).join('')} \\oplus ${fieldToBits(alphaPow(exps[1])).join('')} = ${d.syndrome.join('')} = \\alpha^{${LOG[d.field]}}`}</Tex>
                <span className="ml-1">→ 解碼器翻轉第 {d.position} 個 bit（<M>{`x^{${d.exponent}}`}</M>），但真正的錯誤在第 {errors.join('、')} 個。</span>
              </div>
            )}
            <div className="mt-5">
              <div className="mb-2 text-sm font-semibold text-slate-700">Codeword 集合圖</div>
              <CodewordGraph sent={o.c} received={o.r} decoded={d.corrected} />
            </div>
          </Card>
        ),
      }}
      verify={{
        title: '對全部 21 種雙錯窮舉',
        body: (
          <>
            <Checks
              items={[
                { label: <>預設例子：r = {simulateL2(DEFAULT_U, [2, 7]).r.join('')}，S = {simulateL2(DEFAULT_U, [2, 7]).decode.syndrome.join('')}，輸出 {simulateL2(DEFAULT_U, [2, 7]).decode.corrected.join('')}</>, pass: simulateL2(DEFAULT_U, [2, 7]).decode.corrected.join('') === '1111111' },
                { label: <>輸出滿足 ĉ(α) = 0，但訊息 {simulateL2(DEFAULT_U, [2, 7]).decode.message.join('')} ≠ 1001</>, pass: simulateL2(DEFAULT_U, [2, 7]).decode.check === 0 && simulateL2(DEFAULT_U, [2, 7]).miscorrection },
                { label: <>對 u = {u.join('')}：21 種雙錯全部被偵測（S ≠ 0）且全部誤更正</>, pass: allMis },
              ]}
            />
            <Card title={`u = ${u.join('')} 的 21 種雙錯`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-1">錯誤位置</th>
                      <th>r</th>
                      <th>S</th>
                      <th>解碼器翻轉</th>
                      <th>輸出 ĉ</th>
                      <th>û</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {pairs.map(({ pp, o: x }) => (
                      <tr key={pp.join()} className={`border-t border-slate-100 ${pp.join() === errors.join() ? 'bg-amber-100' : ''}`}>
                        <td className="py-1">{pp.join(', ')}</td>
                        <td>{x.r.join('')}</td>
                        <td>{x.decode.syndrome.join('')}</td>
                        <td>#{x.decode.position}</td>
                        <td>{x.decode.corrected.join('')}</td>
                        <td className="text-rose-700">{x.decode.message.join('')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <Callout kind="warning" title="即使更正後 Syndrome = 0，也不代表還原正確">
              <p>每一列的輸出都是合法 codeword（再算一次 Syndrome 會得到 000），但沒有一列還原出原訊息。Hamming(7,4) 只保證 <M>{'t = 1'}</M>。</p>
            </Callout>
          </>
        ),
      }}
      next={
        <p>
          兩個錯誤至少還會讓 S ≠ 0（被「偵測到」，只是修錯）。三個錯誤可能更糟：有些錯誤樣式會讓 S = 0，解碼器完全察覺不到。
        </p>
      }
    />
  );
}
