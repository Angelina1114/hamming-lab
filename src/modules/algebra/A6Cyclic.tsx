import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCw } from 'lucide-react';
import { type Bit, encodeNonSystematic, flipBit, inCyclicCode, intToBits, msbToTex, mulModXn1, polyQuot, polyToTex, rotateLeft, vecAdd, xn1 } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Card, LabGrid, ResetButton } from '../../components/Lesson';
import { AlgebraUnit, Plain, Terms } from '../../components/alg/Unit';
import { BitPolyEditor } from '../../components/alg/PolyViews';
import { Checks } from '../../components/l2/Common';

const ID = 'a-6';
const CODE = Array.from({ length: 16 }, (_, i) => ({ m: intToBits(i, 4), c: encodeNonSystematic(intToBits(i, 4)) }));
const START: Bit[] = [0, 0, 0, 1, 0, 1, 1];

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
      lead={<p>A5 中 G_cyc 的四列都是 g(x) 的左移。這暗示一個更強的性質：<strong>任何 codeword 循環位移後仍然是 codeword</strong>。這一單元說明這件事為什麼成立，以及它在代數上叫什麼名字。</p>}
      why={{
        title: '移位 = 乘以 x，但 x⁷ 要去哪裡？',
        body: (
          <Plain>
            <p>
              左移一格就是把每一項的次方加一：乘以 <M>x</M>。問題是最高次項 <M>{'x^6'}</M> 乘以 <M>x</M> 變成 <M>{'x^7'}</M>，超出 7 個位元。循環位移的做法是把它「繞回」最右邊，也就是讓 <M>{'x^7'}</M> 變成 <M>1</M>。
            </p>
            <p>
              要讓「<M>{'x^7 = 1'}</M>」合法，就要在一個規定 <M>{'x^7 - 1 \\equiv 0'}</M> 的世界裡計算——這就是商環 <M>{'R_7'}</M>。在 <M>{'R_7'}</M> 中，循環碼有一個漂亮的描述：它是一個<strong>理想 (Ideal)</strong>。
            </p>
          </Plain>
        ),
      }}
      what={{
        title: '循環碼、環、R₇ 與理想',
        body: (
          <Terms
            items={[
              { zh: '循環碼', en: 'Cyclic Code', def: <>線性碼，而且任何 codeword 循環位移後仍是 codeword。</> },
              { zh: '環', en: 'Ring', def: <>可以加、減、乘（滿足結合律、分配律），但<strong>不一定能除</strong>的結構。整數、GF(2)[x] 都是環。體是「每個非零元素都能除」的環。</> },
              { zh: '商環 R₇', en: 'R₇ = GF(2)[x]/(x⁷ − 1)', def: <>次數 ≤ 6 的多項式，運算後用 <M>{'x^7 \\equiv 1'}</M> 化簡（<M>{'x^{7+i} \\equiv x^i'}</M>）。它有 <M>{'2^7 = 128'}</M> 個元素，就是所有 7 位元字串。<M>{'x^7-1'}</M> 可分解，所以 R₇ 是環不是體。</> },
              {
                zh: '理想',
                en: 'Ideal',
                def: (
                  <>
                    環的一個子集 I，滿足：(1) I 中兩元素相加仍在 I；(2) I 中元素乘上<strong>環中任何元素</strong>仍在 I（會「吸收」乘法）。一般的子集合只要求 (1) 或什麼都不要求，理想多了「吸收」的條件。
                  </>
                ),
              },
              {
                zh: '主理想',
                en: 'Principal Ideal ⟨g(x)⟩',
                def: (
                  <>
                    <M>{'\\langle g(x) \\rangle = \\{ a(x)g(x) \\bmod (x^7-1) \\}'}</M>：g 的所有倍數。循環 Hamming Code <M>{'C = \\langle x^3+x+1 \\rangle'}</M>。
                  </>
                ),
              },
              {
                zh: '為什麼 g 要整除 x⁷ − 1？',
                en: 'g(x) | x⁷ − 1',
                def: (
                  <>
                    這保證繞回時不會「離開」g 的倍數。程式計算：<M>{`x^7 - 1 = (x^3+x+1)(${polyToTex(h)})`}</M>，商 <M>{'h(x)'}</M> 叫同位檢查多項式 (parity-check polynomial)。
                  </>
                ),
              },
            ]}
          />
        ),
      }}
      how={{
        title: '循環位移實驗器',
        body: (
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
        ),
      }}
      example={{
        title: '理想會「吸收」乘法：任意 r(x) × codeword 仍是 codeword',
        body: (
          <LabGrid
            main={
              <Card
                title="r(x) 任意選（點位元），c(x) 從 codeword 中選"
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
                    <div className="mb-1 text-xs font-semibold text-slate-500">r(x) ∈ R₇（不必是 codeword）</div>
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
                    <Tex block>{`r(x)c(x) = ${msbToTex(prod.full)}`}</Tex>
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
                    { label: <>r(x)c(x) mod (x⁷−1) = {prod.folded.join('')} 是 codeword</>, pass: inCyclicCode(prod.folded) },
                    { label: <>c(x) 本身是 codeword</>, pass: inCyclicCode(c) },
                  ]}
                />
                <Card title="加法也封閉">
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
        ),
      }}
      connection={{
        title: '循環性讓 g(x) 變成整個 code 的代表',
        body: (
          <Card>
            <p className="text-sm text-slate-700">
              「線性」只保證 codeword 相加仍是 codeword；「循環」多保證乘以 <M>x</M> 仍是 codeword。兩者合起來，乘以任何多項式都還在 code 裡——這正是理想的定義。所以整個 code 由一個多項式 <M>{'g(x)'}</M> 決定：<M>{'C = \\langle g(x) \\rangle'}</M>。接下來的問題是：<M>{'g(x)'}</M> 該怎麼選？答案藏在它的根裡（A7、A8）。
            </p>
          </Card>
        ),
        links: [
          { to: 'a-5', text: '上一步：G_cyc 的列是 g(x) 的位移' },
          { to: 'a-7', text: '下一步：c(α) = 0 會帶出哪些根？' },
          { to: 'l2-12', text: '第二課：同樣的結構放大到 x¹²⁷ − 1' },
        ],
        misconceptions: [
          { wrong: '循環位移是向右移。', right: '本課程最左邊是最高次項，乘以 x 讓每個係數往左移一格，最左邊的 x⁶ 繞到最右邊（x⁷ ≡ 1）。' },
          { wrong: '理想就是「codeword 的集合」，任何子集合都可以。', right: '理想要對加法封閉，而且乘上環中任何元素都還在裡面。隨便挑的 codeword 集合通常不滿足。' },
          { wrong: 'R₇ 是一個體。', right: 'x⁷ − 1 = (x+1)(x³+x+1)(x³+x²+1) 可分解，所以 R₇ 有零因子，例如 (x³+x+1)(x⁴+x²+x+1) ≡ 0。' },
        ],
      }}
    />
  );
}
