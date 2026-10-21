import { useState } from 'react';
import {
  type Bit,
  G_MSB,
  L2_K,
  L2_N,
  LOG,
  alphaMultiplierXors,
  alphaPow,
  bchRedundancy,
  bitsToField,
  blockFailureProb,
  codewordsL2,
  decodeL2,
  errorVector,
  gf8Bits,
  gf8PolyTex,
  hammingSyndromeXors,
  lfsrCost,
  maskWeight,
  msbToMask,
  msbToTex,
  syndromeClocks,
  syndromeL2,
  uncodedFailure,
  vecAdd,
  wordAtAlpha,
} from '../../core';
import {
  G127_MSB,
  STREAM_MATCH,
  doubleErrorStats,
  hornerCost,
  hornerTrace,
  logTableEntries,
  sciTex,
  streamLocate,
} from '../../core/engineering-g5';
import { M, Tex } from '../../components/Tex';
import { Card, Derivation, LabGrid, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { BitStrip, Checks, L2Legend } from '../../components/l2/Common';
import { AlphaCheck } from '../../components/l2/Field';

const ID = 'a-10';
const CODE = codewordsL2();
const TEACHER_R: Bit[] = [1, 1, 0, 1, 1, 1, 0];
const P_MASK = msbToMask(G_MSB); // x³ + x + 1
const HORNER = hornerCost(P_MASK); // S ← S·α ⊕ r_k register
const DIVIDER = lfsrCost(G_MSB); // Lesson 2-4 divider LFSR, for comparison
const CLOCKS = syndromeClocks(L2_N);
const PARALLEL_XORS = hammingSyndromeXors(3);
const ALPHA_XORS = alphaMultiplierXors(P_MASK);
const LOG_ENTRIES = logTableEntries(L2_N, L2_K);
const HORNER_127 = hornerCost(msbToMask(G127_MSB));
const G127_TERMS = maskWeight(msbToMask(G127_MSB));
const PARALLEL_127 = hammingSyndromeXors(7);
const DOUBLE = doubleErrorStats();
const P_BIT = 1e-3;
const P_BLOCK = blockFailureProb(L2_N, 1, P_BIT); // ≥ 2 errors in a 7-bit block
const P_UNCODED = uncodedFailure(L2_K, P_BIT); // the data bits sent without coding
const BCH7 = [bchRedundancy(3, 1), bchRedundancy(3, 2)];
const BCH127 = [bchRedundancy(7, 1), bchRedundancy(7, 2)];
const TEACHER_DEC = decodeL2(TEACHER_R);

export default function A10Syndrome() {
  const [ci, setCi] = useState(9); // u = 1001 → 1001110
  const [pos, setPos] = useState(2); // x⁵
  const c = CODE[ci].c;
  const e = errorVector(pos ? [pos] : []);
  const r = vecAdd(c, e);
  const S1 = wordAtAlpha(r);
  const i = S1 ? LOG[S1] : -1;
  const located = i >= 0 ? 7 - i : 0;
  const teacherS = wordAtAlpha(TEACHER_R);
  const trace = hornerTrace(r);
  const streamPos = streamLocate(S1);

  return (
    <AlgebraUnit
      id={ID}
      convention
      lead={<p>本章最後一步：把代數用在解碼上。因為每個 codeword 都滿足 <M>{'c(\\alpha) = 0'}</M>，接收字在 α 的值只剩下錯誤的貢獻——錯誤的位置就寫在它的指數裡。σ(z)、Chien Search 與 XOR 更正的完整操作在第二課 2-6 ~ 2-8。</p>}
      takeaway={
        <>
          接收端用 {HORNER.flipFlops} 個暫存器邊收邊算 <M>{'S_1 = r(\\alpha)'}</M>；S₁ 是 α 的幾次方，就指出哪個 bit 被翻轉。
        </>
      }
      why={{
        title: '解碼就是「解方程」',
        body: (
          <Plain>
            <p>
              先回到接收端的實際情況：{L2_N} 個 bit 從通道一個接一個進來（串列傳輸，serial transmission），其中可能有一個被雜訊翻轉。解碼器在把 {L2_K} 個資料位元交出去之前，必須回答兩件事：有沒有錯？錯在哪一個 bit？
            </p>
            <p>
              第一課用查表：Syndrome 等於 H 的哪一欄。有了 GF(8) 之後可以換個說法：Syndrome 是一個「數」 <M>{'S_1 = r(\\alpha)'}</M>，錯誤位置 <M>{'x^i'}</M> 滿足 <M>{'\\alpha^i = S_1'}</M>。把「找位置」寫成「解方程」，就能用 Chien Search 這種可以推廣到多錯誤 BCH Code 的通用演算法。
            </p>
            <p>
              這個寫法也改變了電路的做法。第一課的平行電路要等 {L2_N} 個 bit 全部到齊，再用 {PARALLEL_XORS} 個 XOR 閘一次算出 Syndrome；改用 Horner 法（Horner&apos;s Rule）可以邊收邊算：每個時脈把暫存器內容乘 α、再加上剛收到的 bit，只需要 {HORNER.flipFlops} 個暫存器和 {HORNER.xors} 個 XOR 閘（乘 α 的回授 {ALPHA_XORS} 個、把新 bit 加進來 {HORNER.xors - ALPHA_XORS} 個），{CLOCKS} 個時脈後暫存器裡就是 S₁。它和 A6、第二課 2-4 的除法 LFSR 是同一個電路（同樣 {DIVIDER.flipFlops} 個暫存器、{DIVIDER.xors} 個 XOR 閘）：「乘 α 再加入新 bit」就是「左移再回授」。
            </p>
            <p>
              代價是 S₁ 要 {CLOCKS} 個時脈才算完；不過資料本來就一拍一拍進來，平行電路同樣得等最後一個 bit 到齊，所以 S₁ 並沒有比較晚算好。換來的是硬體幾乎不隨碼長變大：長度 127 的 Hamming Code 選用只有 {G127_TERMS} 項的 <M>{`g(x) = ${msbToTex(G127_MSB)}`}</M>，平行電路要 {PARALLEL_127} 個 XOR 閘，串列電路只要 {HORNER_127.flipFlops} 個暫存器、{HORNER_127.xors} 個 XOR 閘。暫存器個數只等於檢查位元數，XOR 閘數只看 g(x) 有幾項。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: 'S₁ = r(α) = e(α)',
        body: (
          <>
            <Terms
              items={[
                { zh: 'GF(8) 版 Syndrome：S₁ = r(α)', def: <>把接收字當多項式，代入 α。因為 <M>{'g(\\alpha) = 0'}</M>，它也等於 <M>{'r(x) \\bmod g(x)'}</M> 的 3 位元餘數（第二課 2-4）讀成 GF(8) 元素。</> },
                { zh: '錯誤定位數 X', en: 'Error Locator', def: <>單一錯誤 <M>{'e(x) = x^i'}</M> 時 <M>{'S_1 = \\alpha^i =: X'}</M>。指數 i 就是錯誤的次方，位置 = 7 − i。</> },
                {
                  zh: 'Horner 法',
                  en: "Horner's Rule",
                  def: (
                    <>
                      <M>{'r(\\alpha) = (\\cdots((r_6\\alpha + r_5)\\alpha + r_4)\\alpha + \\cdots)\\alpha + r_0'}</M>：每讀進一個 bit 就做一次 <M>{'S \\leftarrow S\\alpha + r_k'}</M>，最先到的 <M>{'r_6'}</M> 被乘了最多次 α。
                    </>
                  ),
                },
              ]}
            />
            <Derivation
              defaultOpen
              title="完整推導"
              steps={[
                { title: '接收字', body: <Tex block>{'r(x) = c(x) + e(x)'}</Tex> },
                { title: '代入 α', body: <Tex block>{'S_1 = r(\\alpha) = \\underbrace{c(\\alpha)}_{0\\ (\\text{A5, A9})} + e(\\alpha) = e(\\alpha)'}</Tex> },
                { title: '單一錯誤', body: <Tex block>{'e(x) = x^i \\Rightarrow S_1 = \\alpha^i'}</Tex> },
                {
                  title: '取對數',
                  body: (
                    <>
                      <Tex block>{'i = \\log_\\alpha S_1,\\quad \\text{位置} = 7 - i\\quad(\\alpha^0,\\dots,\\alpha^6 \\text{ 兩兩相異，A4})'}</Tex>
                      <p className="text-sm text-slate-600">硬體上可以是一張 {LOG_ENTRIES} 格的對數表，每個非零 Syndrome 一格。</p>
                    </>
                  ),
                },
                {
                  title: '下一步（第二課）',
                  body: <p>寫成錯誤定位多項式 <M>{'\\sigma(z) = 1 + S_1 z'}</M>，用 Chien Search 找根（2-6、2-7），再用 XOR 更正（2-8）。</p>,
                },
              ]}
            />
          </>
        ),
      }}
      how={{
        title: '計算 S₁ = r(α)',
        body: (
          <>
            <Card
              title="選擇合法 codeword，再點一個位元製造錯誤（再點一次取消）"
              actions={
                <>
                  <select className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm" value={ci} onChange={(ev) => setCi(Number(ev.target.value))}>
                    {CODE.map((x, k) => (
                      <option key={k} value={k}>
                        u = {x.u.join('')} → c = {x.c.join('')}
                      </option>
                    ))}
                  </select>
                  <ResetButton
                    onClick={() => {
                      setCi(9);
                      setPos(2);
                    }}
                  />
                </>
              }
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 text-xs font-semibold text-slate-500">Codeword c</span>
                  <BitStrip bits={c} size="sm" groups={false} showPos={false} />
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-20 text-xs font-semibold text-slate-500">接收 r</span>
                  <BitStrip bits={r} size="sm" groups={false} states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={(k) => setPos(pos === k + 1 ? 0 : k + 1)} />
                </div>
                <L2Legend />
              </div>
              <LabGrid
                main={
                  <div className="mt-4 rounded-xl border border-slate-200 p-3">
                    <div className="mb-1 text-sm font-semibold">S₁ = r(α)，逐項相加</div>
                    <AlphaCheck word={r} name="r" />
                  </div>
                }
                aside={
                  <div className="mt-4 space-y-3">
                    <Card title="由 S₁ 找位置">
                      <div className="space-y-1 text-sm">
                        <div>
                          <M>{`S_1 = ${gf8PolyTex(S1)}`}</M>（{gf8Bits(S1)}）
                        </div>
                        {i >= 0 ? (
                          <>
                            <div>
                              <M>{`S_1 = \\alpha^{${i}} \\Rightarrow i = ${i}`}</M>
                            </div>
                            <div>
                              錯在 <M>{`x^{${i}}`}</M>，即從左數第 <strong>{located}</strong> 個 bit
                            </div>
                            <div className="text-xs text-slate-500">
                              跟著資料流找：每送出一個 bit 就把暫存器乘一次 α，第 {streamPos} 個時脈內容等於 <M>{'\\alpha^6'}</M> = {gf8Bits(STREAM_MATCH)}，那時送出的 bit 就是錯的。
                            </div>
                          </>
                        ) : (
                          <div>S₁ = 0：沒有偵測到錯誤</div>
                        )}
                      </div>
                    </Card>
                    <Checks
                      items={[
                        { label: <>c(α) = 0（選的是合法 codeword）</>, pass: wordAtAlpha(c) === 0 },
                        { label: <>S₁ = r(α) = e(α)</>, pass: S1 === wordAtAlpha(e) },
                        { label: <>S₁ 等於餘數 r(x) mod g(x) 讀成 GF(8) 元素</>, pass: S1 === bitsToField(syndromeL2(r)) },
                        { label: <>{CLOCKS} 個時脈後，Horner 暫存器 = r(α)</>, pass: trace[trace.length - 1].state === S1 },
                        { label: <>由指數找到的位置 = 實際錯誤位置</>, pass: located === pos },
                        { label: <>逐時脈乘 α 找到的位置 = 實際錯誤位置</>, pass: streamPos === pos },
                      ]}
                    />
                  </div>
                }
              />
              <div className="mt-4 rounded-xl border border-slate-200 p-3">
                <div className="mb-2 text-sm font-semibold">
                  邊收邊算：每個時脈 <M>{'S \\leftarrow S\\alpha + r_k'}</M>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-center text-sm">
                    <tbody>
                      <tr>
                        <td className="py-1 text-left text-xs text-slate-500">時脈</td>
                        {trace.map((t) => (
                          <td key={t.clock} className="text-xs text-slate-500">
                            {t.clock}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="py-1 text-left text-xs text-slate-500">收到的 bit</td>
                        {trace.map((t, k) => (
                          <td key={t.clock} className={`font-mono ${e[k] ? 'font-bold text-rose-600' : ''}`}>
                            {t.input}
                          </td>
                        ))}
                      </tr>
                      <tr className="border-t border-slate-100">
                        <td className="py-1 text-left text-xs text-slate-500">暫存器 S</td>
                        {trace.map((t, k) => (
                          <td key={t.clock} className={`font-mono ${k === trace.length - 1 ? 'font-bold text-emerald-700' : ''}`}>
                            {gf8Bits(t.state)}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-slate-500">每一拍的暫存器內容，都和第二課 2-4 除法電路的暫存器相同；最後一拍就是上面逐項相加得到的 S₁。</p>
              </div>
            </Card>
            <Plain>
              <p>
                S₁ 算出來之後，「找位置」在硬體上有兩種做法。一種是查一張 {LOG_ENTRIES} 格的對數表，一步就得到 i；另一種是把 S₁ 留在暫存器裡，收到的 {L2_N} 個 bit 一邊依序送出，一邊每個時脈把暫存器乘一次 α（還是同一個乘 α 電路，{ALPHA_XORS} 個 XOR 閘），內容等於固定樣式 <M>{'\\alpha^6'}</M> 的那一拍，正在送出的 bit 就是錯的，用 XOR 把它翻回來。後者不需要任何表，碼長變長時也不必存更大的表，只是要走的時脈數跟著碼長變多；第二課 2-7 的 Chien Search 用的是同一個想法。
              </p>
            </Plain>
          </>
        ),
      }}
      example={{
        title: '老師的例子：c = 1001110，錯在 x⁵',
        body: (
          <Card>
            <div className="space-y-2 text-sm text-slate-700">
              <Tex block>{'r = 1101110,\\quad S_1 = r(\\alpha) = \\alpha^6 + \\alpha^5 + \\alpha^3 + \\alpha^2 + \\alpha'}</Tex>
              <Tex block>{`= ${[6, 5, 3, 2, 1].map((x) => gf8Bits(alphaPow(x))).join(' \\oplus ')} = ${gf8Bits(teacherS)} = \\alpha^{${LOG[teacherS]}}`}</Tex>
              <p>
                所以錯在 <M>{`x^{${LOG[teacherS]}}`}</M>，從左數第 {7 - LOG[teacherS]} 個 bit。上面的計算器預設就是這個例子。接下來在第二課：<M>{`\\sigma(z) = 1 + \\alpha^{${LOG[teacherS]}}z`}</M> 的 Chien Search（2-7）、XOR 更正為 1001110（2-8）。
              </p>
              <p>
                放到接收端上，這個例子是這樣跑的：{L2_N} 個 bit 依序進入 {HORNER.flipFlops} 個暫存器，第 {CLOCKS} 個時脈結束時暫存器停在 {gf8Bits(teacherS)}；讀成 <M>{`\\alpha^{${LOG[teacherS]}}`}</M> 之後，在第 {streamLocate(teacherS)} 個 bit 送出時把它翻回來，交出 <span className="mono">{TEACHER_DEC.corrected.join('')}</span>，前 {L2_K} 位 <span className="mono">{TEACHER_DEC.message.join('')}</span> 就是原本的資料。
              </p>
            </div>
          </Card>
        ),
      }}
      connection={{
        title: '本章的終點，也是第二課解碼的起點',
        body: (
          <Card>
            <div className="space-y-3 text-sm leading-relaxed text-slate-700">
              <p>
                同一個 Syndrome 有三種寫法：矩陣 <M>{'s = Hr^T'}</M>（第一課）、多項式 <M>{'S(x) = r(x) \\bmod g(x)'}</M>（第二課 2-4）、有限體 <M>{'S_1 = r(\\alpha)'}</M>（本單元）。三者的對照表在 2-4。在電路上它們分別是平行的 XOR 網路、除法 LFSR、Horner 暫存器，後兩者其實是同一個電路。
              </p>
              <p>
                這套方法的極限也來自同一個式子。兩個 bit 同時被翻轉時，<M>{'S_1 = \\alpha^a + \\alpha^b'}</M> 不是 0，而且一定等於第三個位置的 α 次方，解碼器會毫不猶豫地再翻掉第三個 bit：長度 {L2_N} 的 {DOUBLE.pairs} 種雙錯誤裡，{DOUBLE.miscorrected} 種都被「更正」成 {DOUBLE.errorsAfter.join('、')} 個錯，這就是誤更正（Miscorrection，第二課 2-9）。在錯誤率 <M>{`p = 10^{${Math.round(Math.log10(P_BIT))}}`}</M> 的通道上，一個 {L2_N} 位元區塊出現兩個以上錯誤的機率約 <M>{sciTex(P_BLOCK)}</M>；不編碼直接送 {L2_K} 個資料位元，出錯機率約 <M>{sciTex(P_UNCODED)}</M>，所以單錯更正通常夠用。雜訊一大，雙錯變得常見，更正反而會製造錯誤。
              </p>
              <p>
                想更正兩個錯，g(x) 就得再多一組共軛根——這正是 A7、A8 的工具，也就是 BCH Code。長度 {L2_N} 時，檢查位元從 {BCH7[0]} 個增加到 {BCH7[1]} 個，只剩 {L2_N - BCH7[1]} 個資料位元，codeword 只有 <span className="mono">{'0'.repeat(L2_N)}</span> 和 <span className="mono">{'1'.repeat(L2_N)}</span>，等於重複碼；長度 127 時是從 {BCH127[0]} 個增加到 {BCH127[1]} 個，g(x) 多乘一個 {BCH127[1] - BCH127[0]} 次的最小多項式，LFSR 也多 {BCH127[1] - BCH127[0]} 個暫存器。
              </p>
              <p>第二課從 2-1 開始，把這一章的編碼器、Syndrome 電路與錯誤定位接成一條從訊息到更正結果的完整流程。</p>
            </div>
          </Card>
        ),
        links: [
          { to: 'l2-4', text: '第二課：S(x) = e(x) mod g(x) 與 Syndrome 三種寫法對照' },
          { to: 'l2-6', text: '第二課：Key Equation σ(z) = 1 + S₁z' },
          { to: 'l2-7', text: '第二課：Chien Search 與查表的成本比較' },
          { to: 'l2-8', text: '第二課：XOR 更正與 ĉ(α) 驗證' },
        ],
        misconceptions: [
          { wrong: 'S₁ = 111 表示錯在第 7 個位置。', right: '111 = α²+α+1 = α⁵，表示錯在 x⁵（從左數第 2 個 bit）。要用 GF(8) 的對數，不是二進位數值。' },
          { wrong: 'r(α) 和 r(x) mod g(x) 是兩個不同的 Syndrome。', right: '因為 g(α) = 0，兩者是同一個元素：餘數的 3 個位元就是 r(α) 的 (α², α, 1) 座標。' },
          { wrong: '這個方法可以修正任意多個錯誤。', right: '只保證單一錯誤（Hamming Code t = 1）。兩個以上的錯誤見第二課 2-9、2-10。' },
        ],
      }}
    />
  );
}
