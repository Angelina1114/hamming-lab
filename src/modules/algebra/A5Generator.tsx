import { useMemo, useState } from 'react';
import { type Bit, G74, G_MSB, LAYOUT_74, cyclicGenerator, encode74, encodeCyclic, encodeNonSystematic, flipBit, hammingEncoderXors, inCyclicCode, intToBits, lfsrCost, lfsrEncoderClocks, msbToTex, polyMaskToMsb, polyMulTrace, polyQuot, polyToTex, vecMat, wordAtAlpha } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, LabGrid, ResetButton } from '../../components/Lesson';
import { MatrixView } from '../../components/MatrixView';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { BitPolyEditor, PolyMulTable, PolyMulTex } from '../../components/alg/PolyViews';
import { BitStrip, Checks } from '../../components/l2/Common';
import { StepControls, useStepper } from '../../components/l2/Stepper';

const ID = 'a-5';
const GC = cyclicGenerator();
const ROW_NAMES = ['x³g(x)', 'x²g(x)', 'x·g(x)', 'g(x)'];
const ALL_MSGS = Array.from({ length: 16 }, (_, i) => intToBits(i, 4));
const sysSet = ALL_MSGS.map((x) => encodeCyclic(x).codeword.join('')).sort().join();
const nonSet = ALL_MSGS.map((x) => encodeNonSystematic(x).join('')).sort().join();
const diffCount = ALL_MSGS.filter((x) => encodeCyclic(x).codeword.join('') !== encodeNonSystematic(x).join('')).length;
// hardware cost of the two encoders (numbers pinned in engineering-g3.test.ts)
const G127 = polyMaskToMsb(0b10001001, 7); // x⁷ + x³ + 1, the generator of Hamming(127,120) in 2-12
const LFSR7 = lfsrCost(G_MSB);
const LFSR127 = lfsrCost(G127);
const CLK7 = lfsrEncoderClocks(7, 4);
const CLK127 = lfsrEncoderClocks(127, 120);

export default function A5Generator() {
  const [word, setWord] = useState<Bit[]>([0, 0, 0, 1, 0, 1, 1]);
  const [m, setM] = useState<Bit[]>([1, 0, 1, 1]);
  const [u, setU] = useState<Bit[]>([1, 0, 0, 1]);
  const sys = encodeCyclic(u);
  const sysQ = polyQuot([...sys.shifted].reverse() as Bit[], [1, 1, 0, 1]);
  const nonSysU = encodeNonSystematic(u);
  // g(x)·m(x): one partial product per 1-bit of m — the same rows that G_cyc adds up
  const trace = useMemo(() => polyMulTrace(G_MSB, m, 7), [m]);
  const P = trace.partials.length;
  const steps = useStepper(P + 2, { interval: 1100 });
  const c = encodeNonSystematic(m);
  const viaMatrix = vecMat(m, GC);
  const texStage = steps.step >= P + 1 ? 3 : steps.step >= P ? 2 : steps.step >= P - 1 ? 1 : 0;

  return (
    <AlgebraUnit
      id={ID}
      convention
      lead={
        <p>
          第一課用 4×7 的 <strong>generator matrix（生成矩陣）G</strong> 編碼：<M>{'c = mG'}</M>。這一單元介紹它的多項式版本——<strong>generator polynomial g(x)</strong>：只要 4 個係數，編碼就是一次多項式乘法 <M>{'c(x) = m(x)g(x)'}</M>，encoder 也從一整片 XOR 網路縮成一排只有幾個 register 的電路。
        </p>
      }
      takeaway={<>g(x) 就是 encoder 的接線圖：次數決定要幾個 register，係數為 1 的位置決定 feedback 線接在哪裡。</>}
      why={{
        title: '一個多項式取代一整個矩陣',
        body: (
          <Plain>
            <p>
              傳送端每送出一個 codeword，都要先算出 parity bit。第一課的做法是把 <M>{'c = mG'}</M> 直接做成電路：每個 parity bit 是幾個 data bit 的 XOR，(7,4) 要 {hammingEncoderXors(3)} 個 XOR 閘，一個時脈就算完。問題是這片 parallel XOR 網路會跟著 code length 一起長大：第二課的 Hamming(127,120) 要 {hammingEncoderXors(7)} 個 XOR 閘，而且每個 parity bit 的接線都不一樣。
            </p>
            <p>
              如果 G 的每一列只是<strong>同一個多項式往左移</strong>，那只需要記住那一個多項式 <M>{'g(x)'}</M>，encoder 也跟著變成一排 shift register，接線完全由 <M>{'g(x)'}</M> 決定。第二課實際用的是 LFSR：它做的是除以 <M>{'g(x)'}</M>，算出本頁下方 systematic encoding 的 parity bit。<M>{'g(x) = x^3+x+1'}</M> 只要 {LFSR7.flipFlops} 個 register 加 {LFSR7.xors} 個 XOR 閘；換成 (127,120) 的 <M>{'g(x) = x^7+x^3+1'}</M>，也只是 {LFSR127.flipFlops} 個 register 加 {LFSR127.xors} 個 XOR 閘。
            </p>
            <p>
              代價是時間：LFSR 每個時脈只處理一個 bit，送完一個 codeword 要 {CLK7.total} 個時脈，(127,120) 要 {CLK127.total} 個。但 serial 傳輸的線路本來就是一個時脈送一個 bit，parallel 電路一次算出的整個 codeword 也得排隊送出，所以這是拿本來就要花的時間換電路面積。只有速度要求極高時（例如第二課 2-12 的高速光通訊），才會改回 parallel 或部分 parallel 的架構，一個時脈處理多個 bit。
            </p>
            <p>
              除了硬體便宜，還有一個代數上的收穫：所有 codeword 都是 <M>{'g(x)'}</M> 的倍數。<M>{'g(x) = x^3+x+1'}</M> 的根是 α，所以每個 codeword 都滿足 <M>{'c(\\alpha) = 0'}</M>——這是把編碼理論和 GF(8) 連起來的關鍵。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: 'Generator matrix G 與 generator polynomial g(x)',
        body: (
          <>
            <Terms
              items={[
                { term: 'Generator matrix G', def: <>k×n 矩陣，codeword = 訊息列向量 × G。G 的 row space（列空間）就是 code。</> },
                { term: 'Generator polynomial g(x)', def: <>次數 n − k 的多項式，codeword = 訊息多項式 × g(x)。這裡 <M>{'g(x) = x^3 + x + 1'}</M>，n − k = {LFSR7.flipFlops}，也就是 encoder LFSR 的 register 個數。</> },
                { term: '位元 ↔ 多項式', def: <>7 位元字串對應次數 ≤ 6 的多項式，<strong>最左邊是 x⁶ 的係數</strong>。例：<span className="mono">0001011</span> ↔ <M>{'x^3+x+1'}</M>。在線路上，最先送出的 bit 就是最高次項的係數，「第幾個送出」直接對應「x 的幾次方」。</> },
                { term: '多項式乘法（GF(2) 係數）', def: <>用 distributivity 展開 → 同次項合併 → 係數 mod 2。和 A3 的 GF(8) 乘法不同：這裡<strong>不</strong>除以任何多項式。</> },
              ]}
            />
            <Card title="Bit ↔ Polynomial Converter（點擊位元）" actions={<ResetButton onClick={() => setWord([0, 0, 0, 1, 0, 1, 1])} />}>
              <BitPolyEditor bits={word} onToggle={(i) => setWord(flipBit(word, i) as Bit[])} />
              <p className={`mt-2 text-sm ${inCyclicCode(word) ? 'text-emerald-700' : 'text-slate-500'}`}>
                {inCyclicCode(word) ? '✓ 這是 g(x) 的倍數（cyclic Hamming code 的 codeword）' : '不是 g(x) 的倍數'}
              </p>
            </Card>
          </>
        ),
      }}
      how={{
        title: '真正的 GF(2) 多項式乘法：c(x) = m(x)g(x)',
        body: (
          <>
          <Plain>
            <p>
              下面每一列部分積都是「g(x) 往左移幾格」，只在 data bit 為 1 時才加進來，最後同次項相加取 mod 2。換成電路的語言：乘以 <M>x</M>（左移一格）在時間上就是晚一個時脈，也就是資料多經過一個 register；同次項相加就是一個 XOR 閘。整個過程沒有乘法器、也沒有進位，這正是 GF(2) 多項式運算適合做成硬體的原因。
            </p>
          </Plain>
          <LabGrid
            main={
              <Card
                title="選擇訊息 m（4 位元，最左邊 = x³ 的係數）"
                actions={
                  <ResetButton
                    onClick={() => {
                      setM([1, 0, 1, 1]);
                      steps.reset();
                    }}
                  />
                }
              >
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  <BitStrip bits={m} topExp={3} roles={['info', 'info', 'info', 'info']} groups={false} size="sm" onToggle={(i) => { setM(m.map((x, j) => (j === i ? ((1 - x) as Bit) : x))); steps.reset(); }} />
                  <span className="text-sm">
                    <M>{`m(x) = ${msbToTex(m)}`}</M>，<M>{`g(x) = ${msbToTex(G_MSB)}`}</M>
                  </span>
                </div>
                <StepControls s={steps} label={steps.step < P ? `部分積 ${steps.step + 1}` : steps.step === P ? '同類項合併' : '取 mod 2'} />
                <div className="mt-3">
                  <PolyMulTable t={trace} revealed={steps.step + 1} aName="g(x)" bName="m(x)" />
                </div>
              </Card>
            }
            aside={
              <Card title="符號推導">
                <PolyMulTex t={trace} stage={texStage} />
                {steps.atEnd && (
                  <p className="mt-2 text-sm">
                    所以 <span className="mono font-bold">c = {c.join('')}</span>。
                  </p>
                )}
              </Card>
            }
          />
          </>
        ),
      }}
      example={{
        title: '從 g(x) 建立 G_cyc：四列 = x³g, x²g, xg, g',
        body: (
          <>
            <LabGrid
              main={
                <Card title="mG 就是把 m_i = 1 的那些列加起來">
                  <MatrixView matrix={GC} name={<M>{'G_{\\text{cyc}} ='}</M>} rowLabels={m.map((b) => `${b}·`)} highlightRows={m.flatMap((b, i) => (b ? [i] : []))} dimRows={m.flatMap((b, i) => (b ? [] : [i]))} colLabels={['x⁶', 'x⁵', 'x⁴', 'x³', 'x²', 'x', '1']} />
                  <div className="mt-3 space-y-1 text-sm">
                    {GC.map((row, i) => (
                      <div key={i} className={m[i] ? '' : 'opacity-40'}>
                        第 {i + 1} 列 <span className="mono">{row.join('')}</span> = <M>{`${ROW_NAMES[i].replace('·', '\\cdot ')} = ${msbToTex(row)}`}</M>
                      </div>
                    ))}
                  </div>
                  <Tex block>{`m(x)g(x) = ${m.map((b, i) => (b ? ['x^3', 'x^2', 'x', '1'][i] + 'g(x)' : null)).filter(Boolean).join(' + ') || '0'}`}</Tex>
                </Card>
              }
              aside={
                <Checks
                  items={[
                    { label: <>矩陣：mG_cyc = {viaMatrix.join('')} 是合法 codeword</>, pass: inCyclicCode(viaMatrix) },
                    { label: <>多項式：m(x)g(x) = {c.join('')}</>, pass: inCyclicCode(c) },
                    { label: <>兩者相同（distributivity）</>, pass: viaMatrix.join('') === c.join('') },
                    { label: <>c(α) = 0（g 的根 α 也是 c 的根）</>, pass: wordAtAlpha(c) === 0 },
                  ]}
                />
              }
            />
            <Callout kind="warning" title="不可混用兩套矩陣">
              <p>
                第一課的 G 採用 <M>{'[P_1,P_2,D_1,P_4,D_2,D_3,D_4]'}</M> 排列，同一個訊息 {m.join('')} 會得到 <span className="mono">{encode74(m).join('')}</span>；這裡的 <M>{'G_{\\text{cyc}}'}</M> 以多項式係數排列（左 = x⁶），得到 <span className="mono">{c.join('')}</span>。兩個 code 只差一個座標排列（A9 會實際算出這個排列），但矩陣不能混用：拿第一課的 H 去檢查這裡的 codeword 會失敗。
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <MatrixView matrix={G74} name="G（第一課）" size="sm" colLabels={LAYOUT_74.map((p) => p.label)} />
                <MatrixView matrix={GC} name={<M>{'G_{\\text{cyc}}'}</M>} size="sm" />
              </div>
            </Callout>
            <Card
              title="另一種編碼：systematic encoding（訊息放在前 4 位）"
              actions={<ResetButton onClick={() => setU([1, 0, 0, 1])} />}
            >
              <div className="mb-3 flex flex-wrap items-center gap-3">
                <span className="text-xs font-semibold text-slate-500">訊息 u（點擊切換）</span>
                <BitStrip bits={u} topExp={3} roles={['info', 'info', 'info', 'info']} groups={false} size="sm" onToggle={(i) => setU(u.map((x, j) => (j === i ? ((1 - x) as Bit) : x)))} />
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-1 text-sm text-slate-700">
                  <p>
                    <M>{'m(x)g(x)'}</M> 會把訊息打散：接收端即使沒有收到錯誤，也要先算 <M>{'c(x) \\div g(x)'}</M> 的商才拿得回訊息。實務上（第二課的老師範例）常用 <strong>systematic encoding</strong>：
                  </p>
                  <Tex block>{'c(x) = x^3u(x) + b(x),\\quad b(x) = x^3u(x) \\bmod g(x)'}</Tex>
                  <p>
                    為什麼它也在 code 裡？寫 <M>{'x^3u(x) = q(x)g(x) + b(x)'}</M>，則 <M>{'c(x) = q(x)g(x) + b(x) + b(x) = q(x)g(x)'}</M>，是 g 的倍數。
                  </p>
                  <Tex block>{`x^3u(x) = ${msbToTex(sys.shifted)} = (${polyToTex(sysQ)})(x^3+x+1) + (${msbToTex(sys.parity)})`}</Tex>
                  <Tex block>{`c = ${u.join('')}\\,\\|\\,${sys.parity.join('')} = ${sys.codeword.join('')}`}</Tex>
                  <p>
                    它的好處都在硬體和使用端：前 {CLK7.message} 個時脈，data bit 一邊原樣送上線路、一邊餵進 LFSR；送完時 register 裡剩下的正是 <M>{'b(x)'}</M>，再用 {CLK7.parityOut} 個時脈把它接在後面送出。接收端拿到的前 {CLK7.message} 位就是原始資料，沒有錯誤時直接取用即可。這張卡片的檢查也顯示兩種編碼的 codeword 集合完全相同，error-correcting capability（更正能力）一模一樣，所以選 systematic encoding 純粹是工程上的方便。
                  </p>
                  <p className="text-xs text-slate-500">
                    b(x) 用長除法或 LFSR 計算，逐步過程見 <a className="text-indigo-700 underline" href="#/l2-2">2-2 LFSR</a>、<a className="text-indigo-700 underline" href="#/l2-3">2-3 長除法</a>。
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                    <div className="rounded-lg bg-slate-50 p-2">
                      Systematic：<span className="mono font-bold">{sys.codeword.join('')}</span>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-2">
                      Nonsystematic u(x)g(x)：<span className="mono font-bold">{nonSysU.join('')}</span>
                    </div>
                  </div>
                  <Checks
                    items={[
                      { label: <>兩種 codeword 都是 g(x) 的倍數</>, pass: inCyclicCode(sys.codeword) && inCyclicCode(nonSysU) },
                      { label: <>16 個訊息：兩種編碼產生的 codeword 集合完全相同</>, pass: sysSet === nonSet },
                      { label: <>但同一訊息的 codeword 不保證相同：16 個訊息中有 {diffCount} 個不同</>, pass: diffCount > 0 },
                      { label: <>老師的例子 u = 1001 → 1001110</>, pass: encodeCyclic([1, 0, 0, 1]).codeword.join('') === '1001110' },
                    ]}
                  />
                </div>
              </div>
            </Card>
          </>
        ),
      }}
      connection={{
        title: '矩陣與多項式是同一件事',
        body: (
          <Card>
            <p className="text-sm text-slate-700">
              <M>{'m(x)g(x) = m_3\\,x^3g(x) + m_2\\,x^2g(x) + m_1\\,xg(x) + m_0\\,g(x)'}</M>——右邊每一項正是 <M>{'G_{\\text{cyc}}'}</M> 的一列乘上一個 data bit。所以「多項式乘法」和「列向量乘矩陣」是同一個計算的兩種寫法。
            </p>
            <p className="mt-3 text-sm text-slate-700">
              同一個 code 因此有兩種電路可選。矩陣寫法 <M>{'c = mG'}</M> 是 parallel XOR 網路，一個時脈算完，但閘數跟著 code length 成長；多項式寫法是 LFSR，一個時脈處理一個 bit，硬體只看 <M>{'g(x)'}</M> 的次數和項數。選哪一種要看資料怎麼進來：一個 bit 一個 bit 抵達的 serial 線路適合 LFSR；像 ECC（error-correcting code，錯誤更正碼）記憶體那樣一次讀出整個字組、而且要在一個時脈內算完的系統，則用 parallel XOR 網路。
            </p>
            <p className="mt-3 text-sm text-slate-700">下一單元 A6 換到接收端：檢查 received word 是不是 codeword，能不能也只用同樣大小的 shift register 完成。</p>
          </Card>
        ),
        links: [
          { to: 'matrix', text: '第一課：Generator matrix G 與 c = mG' },
          { to: 'a-6', text: '下一步：cyclic code，為什麼移位後仍是 codeword？' },
          { to: 'l2-2', text: `第二課：LFSR 用 ${LFSR7.flipFlops} 個 register 計算 x³u(x) mod g(x)` },
          { to: 'l2-3', text: '第二課：長除法與 LFSR 的同步對照' },
        ],
        misconceptions: [
          { wrong: 'generator polynomial 就是 generator matrix 的第一列。', right: 'g(x) 對應 G_cyc 的最後一列；其他列是它的左移。而且這只對 G_cyc 成立，不是第一課的 G。' },
          { wrong: 'm(x)g(x) 要除以 x³+x+1 取餘數。', right: '編碼時不取餘數：(x³+x+1)(x³+x+1) = x⁶+x²+1 是完整的乘積，次數 ≤ 6 剛好 7 位元。取餘數是 GF(8) 運算或 syndrome 的事。' },
          { wrong: '1011 編碼後一定是 1011xxx。', right: 'nonsystematic encoding m(x)g(x) 不保留訊息在前 4 位（1011 → 1000101）。systematic encoding 才會（見本頁上方「systematic encoding」卡片：1001 → 1001110）。' },
          { wrong: '用 systematic encoding 得到的 codeword 和 m(x)g(x) 是同一個字，只是寫法不同。', right: '1001 → systematic 1001110，nonsystematic 1010011。兩者都是合法 codeword，但不同；只有 codeword 的「集合」相同。' },
          {
            wrong: 'LFSR 要 n 個時脈才編完，所以一定比 parallel XOR 網路差。',
            right: (
              <>
                要看資料怎麼進來。serial 線路本來就一個時脈送一個 bit，LFSR 用 {LFSR7.flipFlops} 個 register、{LFSR7.xors} 個 XOR 閘就跟得上，而 parallel encoder 要 {hammingEncoderXors(3)} 個 XOR 閘（n = 127 時是 {hammingEncoderXors(7)} 個，LFSR 仍只要 {LFSR127.xors} 個）。只有整個字組同時到達、而且要在一個時脈內編完時，parallel 電路才划算。
              </>
            ),
          },
        ],
      }}
    />
  );
}
