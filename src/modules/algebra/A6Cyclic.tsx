import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCw } from 'lucide-react';
import { type Bit, G_MSB, alphaMultiplierXors, bchRedundancy, encodeNonSystematic, flipBit, gf8Mul, hammingSyndromeXors, inCyclicCode, intToBits, lfsrCost, msbToTex, mulModXn1, polyMaskToMsb, polyQuot, polyToTex, rotateLeft, syndromeClocks, syndromeTableEntries, vecAdd, wordAtAlpha, xn1 } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, LabGrid, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { BitPolyEditor } from '../../components/alg/PolyViews';
import { Checks } from '../../components/l2/Common';

const ID = 'a-6';
const CODE = Array.from({ length: 16 }, (_, i) => ({ m: intToBits(i, 4), c: encodeNonSystematic(intToBits(i, 4)) }));
const START: Bit[] = [0, 0, 0, 1, 0, 1, 1];
// hardware of the membership test (numbers pinned in engineering-g3.test.ts)
const G127 = polyMaskToMsb(0b10001001, 7); // x⁷ + x³ + 1, the generator of Hamming(127,120) in 2-12
const DIV7 = lfsrCost(G_MSB);
const DIV127 = lfsrCost(G127);
const BCH2 = bchRedundancy(7, 2); // check bits of the 2-error-correcting BCH code of length 127
// shifting the received word one place left multiplies r(α) by α — checked on all 128 words
const ALL_WORDS = Array.from({ length: 128 }, (_, i) => intToBits(i, 7));
const shiftTimesAlpha = ALL_WORDS.every((w) => wordAtAlpha(rotateLeft(w, 1)) === gf8Mul(2, wordAtAlpha(w)));
// "remainder 0 after dividing by g(x)" picks out exactly the 16 codewords m(x)g(x)
const CODE_SET = new Set(CODE.map((x) => x.c.join('')));
const divisibleAreCode = ALL_WORDS.filter(inCyclicCode).map((w) => w.join('')).sort().join() === [...CODE_SET].sort().join();

export default function A6Cyclic() {
  const [base, setBase] = useState<Bit[]>([...START]);
  const [shift, setShift] = useState(0);
  const cur = rotateLeft(base, shift % 7);
  const prev = rotateLeft(base, (shift + 6) % 7);
  const wrapped = shift > 0 && prev[0] === 1;

  const [r, setR] = useState<Bit[]>([0, 0, 0, 0, 0, 1, 1]); // x + 1
  const [ci, setCi] = useState(11); // m = 1011
  const [cj, setCj] = useState(6);
  const c = CODE[ci].c;
  const prod = useMemo(() => mulModXn1(r, c), [r, c]);
  const h = polyQuot(xn1(7), [1, 1, 0, 1]);
  const orbit = new Set(Array.from({ length: 7 }, (_, k) => rotateLeft(base, k).join(''))).size;

  return (
    <AlgebraUnit
      id={ID}
      convention
      lead={<p>A5 中 G_cyc 的四列都是 g(x) 的左移。這暗示一個更強的性質：<strong>任何 codeword 做 cyclic shift 後仍然是 codeword</strong>。這一單元說明這件事為什麼成立，以及它在代數上叫什麼名字。</p>}
      takeaway={<>cyclic code 就是 g(x) 的倍數，接收端只要一個除以 g(x) 的 LFSR，讀完看餘數是否為 0。</>}
      why={{
        title: '移位 = 乘以 x，但 x⁷ 要去哪裡？',
        body: (
          <Plain>
            <p>
              接收端拿到 7 個 bit，第一件事是判斷「這是不是 codeword」。第一課的做法是 parallel 計算 <M>{'Hr^T'}</M>：每個 syndrome 位元是一條 parity check，把它盯著的那些位置全部 XOR 起來，一個時脈就算完。(7,4) 要 {hammingSyndromeXors(3)} 個 XOR 閘，第二課的 Hamming(127,120) 要 {hammingSyndromeXors(7)} 個；對一般的 linear code（線性碼），這片網路只能跟著 code length 一起長大。
            </p>
            <p>
              而 cyclic code 多要求一件事：codeword 做 cyclic shift 後仍是 codeword。這一單元會看到，這個性質讓整個 code 剛好是 <M>{'g(x)'}</M> 的所有倍數，於是「是不是 codeword」變成「能不能被 <M>{'g(x)'}</M> 整除」。
            </p>
            <p>
              接收端用和 A5 encoder 同樣大小的 LFSR 做除法就能檢查：{DIV7.flipFlops} 個 register 加 {DIV7.xors} 個 XOR 閘，每個時脈讀進一個 bit，{syndromeClocks(7)} 個時脈讀完。code length 變成 127 時，register 只從 {DIV7.flipFlops} 個變成 {DIV127.flipFlops} 個，XOR 閘仍是 {DIV127.xors} 個，代價是要 {syndromeClocks(127)} 個時脈。這就是從「任意 linear code」走到 cyclic code 的理由：硬體大小只看 <M>{'g(x)'}</M> 的次數和項數，而不是 code length。
            </p>
            <p>
              要把「位移」寫成代數，先看左移一格：把每一項的次方加一，也就是乘以 <M>x</M>。問題是最高次項 <M>{'x^6'}</M> 乘以 <M>x</M> 變成 <M>{'x^7'}</M>，超出 7 個位元。cyclic shift 的做法是把它「繞回」最右邊，也就是讓 <M>{'x^7'}</M> 變成 <M>1</M>。
            </p>
            <p>
              要讓「<M>{'x^7 = 1'}</M>」合法，就要在一個規定 <M>{'x^7 - 1 \\equiv 0'}</M> 的世界裡計算——這就是 quotient ring <M>{'R_7'}</M>。在 <M>{'R_7'}</M> 中，cyclic code 有一個漂亮的描述：它是一個 <strong>ideal（理想）</strong>。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: 'Cyclic code、ring、R₇ 與 ideal',
        body: (
          <Terms
            items={[
              { term: 'Cyclic code', def: <>是 linear code，而且任何 codeword 做 cyclic shift 後仍是 codeword。</> },
              { term: 'Ring', def: <>可以加、減、乘（滿足 associativity、distributivity），但<strong>不一定能除</strong>的結構。整數、GF(2)[x] 都是 ring；field 則是「每個非零元素都能除」的 ring。</> },
              { term: 'Quotient ring R₇ = GF(2)[x]/(x⁷ − 1)', def: <>次數 ≤ 6 的多項式，運算後用 <M>{'x^7 \\equiv 1'}</M> 化簡（<M>{'x^{7+i} \\equiv x^i'}</M>）。它有 <M>{'2^7 = 128'}</M> 個元素，就是所有 7 位元字串。<M>{'x^7-1'}</M> 可分解，所以 R₇ 是 ring 而不是 field。</> },
              {
                term: 'Ideal',
                def: (
                  <>
                    ring 的一個子集 I，滿足：(1) I 中兩元素相加仍在 I；(2) I 中元素乘上 <strong>ring 中任何元素</strong>仍在 I（會「吸收」乘法）。additive subgroup（在 GF(2) 上就是 subspace（子空間），也就是 linear code）只要求 (1)；ideal 多了「吸收」的條件。在 R₇ 中，吸收「乘以 x」正是「cyclic shift 後仍是 codeword」。
                  </>
                ),
              },
              {
                term: 'Principal ideal ⟨g(x)⟩',
                gloss: '主理想',
                def: (
                  <>
                    <M>{'\\langle g(x) \\rangle = \\{ a(x)g(x) \\bmod (x^7-1) \\}'}</M>：g 的所有倍數。cyclic Hamming code 就是 <M>{'C = \\langle x^3+x+1 \\rangle'}</M>。所以「r 是不是 codeword」等於「r(x) 除以 g(x) 的餘數是不是 0」，接收端只需要一個除法電路。
                  </>
                ),
              },
              {
                term: '為什麼 g(x) 要整除 x⁷ − 1？',
                def: (
                  <>
                    這保證繞回時不會「離開」g 的倍數。程式計算：<M>{`x^7 - 1 = (x^3+x+1)(${polyToTex(h)})`}</M>，商 <M>{'h(x)'}</M> 叫 parity-check polynomial（同位檢查多項式）。
                  </>
                ),
              },
            ]}
          />
        ),
      }}
      how={{
        title: 'Cyclic shift 實驗器',
        body: (
          <>
          <Plain>
            <p>
              在硬體上，<M>{'R_7'}</M> 的「乘以 <M>x</M>」就是 7 個首尾相接的 register（circular shift register）整排移一格：最左邊那個 register 移出的 bit 從最右邊接回來，那條接回來的線就是 <M>{'x^7 \\equiv 1'}</M>。不管從哪個 codeword 出發、轉幾格，register 裡永遠是合法的 codeword。
            </p>
          </Plain>
          <LabGrid
            main={
              <Card
                title="按「乘上 x」：每一位左移，最左邊繞到最右邊"
                actions={
                  <>
                    <button className="btn-primary" onClick={() => setShift((s) => s + 1)}>
                      <RotateCw className="h-4 w-4" /> 乘上 x
                    </button>
                    <ResetButton
                      onClick={() => {
                        setBase([...START]);
                        setShift(0);
                      }}
                    />
                  </>
                }
              >
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {CODE.slice(1, 8).map((x) => (
                    <button
                      key={x.c.join('')}
                      onClick={() => {
                        setBase(x.c);
                        setShift(0);
                      }}
                      className={`chip border font-mono ${x.c.join('') === base.join('') ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}
                    >
                      {x.c.join('')}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  {cur.map((b, i) => {
                    const origin = (i + (shift % 7)) % 7; // which original index sits here now
                    return (
                      <motion.div
                        key={`${origin}`}
                        layout
                        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                        className={`grid h-11 w-11 place-items-center rounded-lg border-2 font-mono text-lg font-bold ${b ? 'border-overall-400 bg-overall-50 text-overall-800' : 'border-slate-300 text-slate-400'} ${wrapped && i === 6 ? 'ring-2 ring-amber-400' : ''}`}
                      >
                        {b}
                      </motion.div>
                    );
                  })}
                </div>
                <div className="mt-3 space-y-1 text-sm">
                  <div>
                    已乘 <strong>{shift}</strong> 次：<M>{`x^{${shift}}c(x) \\equiv ${msbToTex(cur)}`}</M>
                  </div>
                  {shift > 0 && (
                    <div className="text-slate-600">
                      <M>{`x \\cdot (${msbToTex(prev)})`}</M>
                      {wrapped ? (
                        <>
                          {' '}
                          產生 <M>{'x^7'}</M>，用 <M>{'x^7 \\equiv 1'}</M> 繞回最右邊（橘框）。
                        </>
                      ) : (
                        ' 沒有超過 x⁶，直接左移。'
                      )}
                    </div>
                  )}
                </div>
              </Card>
            }
            aside={
              <Checks
                items={[
                  { label: <>目前字串 {cur.join('')} 是 codeword</>, pass: inCyclicCode(cur) },
                  { label: <>出發的字串 {base.join('')} 是 codeword</>, pass: inCyclicCode(base) },
                  { label: <>位移 7 次回到原點（軌道長度 {orbit}）</>, pass: rotateLeft(base, 7).join('') === base.join('') },
                ]}
              />
            }
          />
          </>
        ),
      }}
      example={{
        title: 'Ideal 會「吸收」乘法：任意 a(x) × codeword 仍是 codeword',
        body: (
          <>
          <LabGrid
            main={
              <Card
                title="a(x) 任意選（點位元），c(x) 從 codeword 中選"
                actions={
                  <ResetButton
                    onClick={() => {
                      setR([0, 0, 0, 0, 0, 1, 1]);
                      setCi(11);
                      setCj(6);
                    }}
                  />
                }
              >
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">a(x) ∈ R₇（不必是 codeword）</div>
                    <BitPolyEditor bits={r} onToggle={(i) => setR(flipBit(r, i) as Bit[])} />
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-500">c(x) ∈ C（16 個 codeword 之一，依訊息 m 編號）</div>
                    <select className="rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm" value={ci} onChange={(e) => setCi(Number(e.target.value))}>
                      {CODE.map((x, i) => (
                        <option key={i} value={i}>
                          m = {x.m.join('')} → c = {x.c.join('')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1 rounded-xl bg-slate-50 p-3 text-sm">
                    <Tex block>{`a(x)c(x) = ${msbToTex(prod.full)}`}</Tex>
                    {prod.wrapped.length > 0 && <Tex block>{`${prod.wrapped.map((e) => `x^{${e}} \\equiv x^{${e - 7}}`).join(',\\ ')}\\quad (x^7 \\equiv 1)`}</Tex>}
                    <Tex block>{`\\equiv ${msbToTex(prod.folded)} \\pmod{x^7-1}\\quad [${prod.folded.join('')}]`}</Tex>
                  </div>
                </div>
              </Card>
            }
            aside={
              <>
                <Checks
                  items={[
                    { label: <>a(x)c(x) mod (x⁷−1) = {prod.folded.join('')} 是 codeword</>, pass: inCyclicCode(prod.folded) },
                    { label: <>c(x) 本身是 codeword</>, pass: inCyclicCode(c) },
                    { label: <>128 個 7 位元字串中，被 g(x) 整除的剛好就是這 {CODE_SET.size} 個 codeword</>, pass: divisibleAreCode },
                  ]}
                />
                <Card title="加法也滿足 closure">
                  <select className="mb-2 rounded-lg border border-slate-200 px-2 py-1 font-mono text-sm" value={cj} onChange={(e) => setCj(Number(e.target.value))}>
                    {CODE.map((x, i) => (
                      <option key={i} value={i}>
                        {x.c.join('')}
                      </option>
                    ))}
                  </select>
                  <div className="font-mono text-sm">
                    {c.join('')} ⊕ {CODE[cj].c.join('')} = <strong>{vecAdd(c, CODE[cj].c).join('')}</strong>
                  </div>
                  <p className={`mt-1 text-sm ${inCyclicCode(vecAdd(c, CODE[cj].c)) ? 'text-emerald-700' : 'text-rose-700'}`}>{inCyclicCode(vecAdd(c, CODE[cj].c)) ? '✓ 仍是 codeword' : '✗'}</p>
                </Card>
              </>
            }
          />
          <Plain>
            <p>
              吸收保證 <M>{'g(x)'}</M> 乘上任何 <M>{'a(x)'}</M>、再用 <M>{'x^7 \\equiv 1'}</M> 繞回，結果都還在 code 裡；反過來，每個 codeword 本來就是 <M>{'m(x)g(x)'}</M>。上面第三項檢查把兩個方向一起驗證：所有 7 位元字串中被 <M>{'g(x)'}</M> 整除的，一個不多、一個不少，正好是這 {CODE_SET.size} 個 codeword。所以「除以 <M>{'g(x)'}</M>、看餘數」是完整的檢查：餘數為 0 就一定是 codeword，接收端不必再檢查別的條件。乙太網路封包的 CRC 用的就是同一個除法，只是 <M>{'g(x)'}</M> 的次數更高，而且只用來<strong>偵測</strong>錯誤：餘數不為 0 就丟掉這個封包，由上層協定決定要不要重送，不嘗試更正。
            </p>
          </Plain>
          </>
        ),
      }}
      connection={{
        title: '循環性讓 g(x) 變成整個 code 的代表',
        body: (
          <Card>
            <p className="text-sm text-slate-700">
              「線性」只保證 codeword 相加仍是 codeword；「循環」多保證乘以 <M>x</M> 仍是 codeword。兩者合起來，乘以任何多項式都還在 code 裡——這正是 ideal 的定義。所以整個 code 由一個多項式 <M>{'g(x)'}</M> 決定：<M>{'C = \\langle g(x) \\rangle'}</M>。
            </p>
            <p className="mt-3 text-sm text-slate-700">
              位移不變也讓 decoder 可以做得很小。把 received word 左移一格，它的 syndrome <M>{'S_1 = r(\\alpha)'}</M>（A10）剛好乘上 α（因為 <M>{'\\alpha^7 = 1'}</M>）；<M>{'x^i'}</M> 位置的單一錯誤，syndrome 是 <M>{'\\alpha^i'}</M>，錯誤每往左移一格就多乘一個 α。所以 decoder 可以不為 7 個位置各做一套比對電路，只用一個「乘以 α」電路（<M>{'x^3+x+1'}</M> 時只要 {alphaMultiplierXors(0b1011)} 個 XOR 閘），每個時脈換一個位置、掃過整個字，用時間換面積。第二課 2-7 的 Chien search 用的也是這種「每個時脈乘一次 α」的逐一檢查。
            </p>
            <div className="mt-3">
              <Checks items={[{ label: <>128 個 7 位元字串左移一格後，r(α) 都剛好乘上 α</>, pass: shiftTimesAlpha }]} />
            </div>
            <p className="mt-3 text-sm text-slate-700">
              要更正多個錯誤的長 code 不靠查表，也是同樣的道理。2-5 的查表法要存 <M>{'2^{n-k}'}</M> 項：(7,4) 是 {syndromeTableEntries(7, 4)} 項、(127,120) 是 {syndromeTableEntries(127, 120)} 項，都還很小；但只要多更正一個錯，BCH(127,{127 - BCH2}) 的 n − k 就變成 {BCH2}，表要 {syndromeTableEntries(127, 127 - BCH2).toLocaleString('en-US')} 項。cyclic code 可以用 <M>{'g(x)'}</M> 的根來描述（A7、A8），解碼因此能改成代數計算（2-6、2-7），電路不必跟著表一起膨脹。
            </p>
            <p className="mt-3 text-sm text-slate-700">下一單元 A7 就從這些根下手，看 <M>{'g(x)'}</M> 該怎麼選。</p>
          </Card>
        ),
        links: [
          { to: 'a-5', text: '上一步：G_cyc 的列是 g(x) 的位移' },
          { to: 'a-7', text: '下一步：c(α) = 0 會帶出哪些根？' },
          { to: 'l2-12', text: '第二課：同樣的結構放大到 x¹²⁷ − 1' },
        ],
        misconceptions: [
          { wrong: 'cyclic shift 是向右移。', right: '本章（和第二課）最左邊是最高次項，乘以 x 讓每個係數往左移一格，最左邊的 x⁶ 繞到最右邊（x⁷ ≡ 1）。' },
          { wrong: 'ideal 就是「codeword 的集合」，任何子集合都可以。', right: 'ideal 要對加法滿足 closure，而且乘上 ring 中任何元素都還在裡面。隨便挑的 codeword 集合通常不滿足。' },
          { wrong: 'R₇ 是一個 field。', right: 'x⁷ − 1 = (x+1)(x³+x+1)(x³+x²+1) 可分解，所以 R₇ 有 zero divisor，例如 (x³+x+1)(x⁴+x²+x+1) ≡ 0。' },
          { wrong: 'CRC 和 cyclic code 是兩回事。', right: 'CRC 就是 cyclic code 的除法檢查：把收到的資料除以 g(x)、看餘數是不是 0。差別在用途：CRC 只偵測錯誤（發現錯就丟掉封包），Hamming code 還用 syndrome 找出錯誤位置來更正。' },
        ],
      }}
    />
  );
}
