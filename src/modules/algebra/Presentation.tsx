import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import {
  type Bit,
  DEFAULT_U,
  G_MSB,
  GF2,
  GF8_ELEMENTS,
  GF8_FIELD,
  H74,
  LAYOUT_74,
  LOG,
  allMinimalPolynomials,
  alphaPolyTex,
  alphaPow,
  bitsToField,
  characteristic,
  checkFieldAxioms,
  chienSearch,
  codewordsL2,
  column,
  cosetOrbit,
  cyclicGenerator,
  cyclicIndexToStandardPosition,
  cyclicWordToStandard,
  cyclotomicCosets,
  encode74,
  encodeCyclic,
  encodeNonSystematic,
  errorLocator,
  errorVector,
  evalGF2,
  factorGF2,
  flipBit,
  frobenius,
  gf8Add,
  gf8Bits,
  gf8Mul,
  gf8MulTrace,
  gf8PolyTex,
  gf8PowTex,
  gfPolyEval,
  gfPolyTex,
  hFromGF8,
  inCyclicCode,
  intToBits,
  isCodeword74,
  isIrreducible,
  matVec,
  minimalPolynomial,
  msbToTex,
  mulModXn1,
  polyMulTrace,
  polyQuot,
  polyToMsb,
  polyToTex,
  polysOfDegree,
  quotientRing,
  rotateLeft,
  syndromeL2,
  vecAdd,
  vecMat,
  wordAtAlpha,
  wordAtAlphaPower,
  xn1,
  zmod,
} from '../../core';
import { M, Tex } from '../../components/Tex';
import { BitCell, BitRow, MessageInput } from '../../components/Bits';
import { MatrixView, ColumnVector } from '../../components/MatrixView';
import { Segmented } from '../../components/Lesson';
import { BitPolyEditor, PolyMulTable, PolyMulTex } from '../../components/alg/PolyViews';
import { BitStrip, Checks } from '../../components/l2/Common';
import { AlphaCheck } from '../../components/l2/Field';
import { MessagePicker } from '../../components/l2/Controls';
import { Deck, type DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';

type Ctx = null;

const SUP = '⁰¹²³⁴⁵⁶';
const powTex = (e: number) => (e === 0 ? '1' : e === 1 ? '\\alpha' : `\\alpha^{${e}}`);
const powLabel = (e: number) => (e === 0 ? '1' : e === 1 ? 'α' : `α${SUP[e]}`);
/** non-systematic codewords c(x) = m(x)g(x), index = int(m) */
const CODE = Array.from({ length: 16 }, (_, i) => encodeNonSystematic(intToBits(i, 4)));
const EXP_LABELS = ['x⁶', 'x⁵', 'x⁴', 'x³', 'x²', 'x', '1'];

/** numbered lines revealed one per step */
function StepLines({ s, lines, size = 'text-2xl' }: { s: Stepper; lines: { label: string; tex: string }[]; size?: string }) {
  return (
    <ol className="space-y-3">
      {lines.slice(0, s.step + 1).map((l, i) => (
        <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
          <span className="mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white">{i + 1}</span>
          <div className="min-w-0">
            <div className="text-base font-semibold text-slate-500">{l.label}</div>
            <div className={size}>
              <Tex>{l.tex}</Tex>
            </div>
          </div>
        </motion.li>
      ))}
    </ol>
  );
}

/** the same 7-node ring used by A4 (powers of α) and A7 (exponents i → 2i) */
const ringPoint = (e: number, r = 118, c = 160) => {
  const t = (e / 7) * 2 * Math.PI - Math.PI / 2;
  return { x: c + r * Math.cos(t), y: c + r * Math.sin(t) };
};

/* ------------------------------------------------------------------ */
/* Title and A0                                                       */
/* ------------------------------------------------------------------ */

function TitleSlide() {
  const units: [string, string][] = [
    ['A1', 'GF(2)：1 + 1 = 0，Hcᵀ = 0 就是 GF(2) 線性代數'],
    ['A2', 'H 的 7 個欄 = GF(8) 的 7 個非零元素'],
    ['A3', '建構 GF(8)：不可約多項式，α³ = α + 1'],
    ['A4', 'α 的循環：α⁷ = 1，指數 = 位置'],
    ['A5', '生成多項式：c(x) = m(x)g(x)'],
    ['A6', '循環位移 = 乘以 x，C 是 R₇ 的理想'],
    ['A7', 'Frobenius：一個根帶出 α²、α⁴'],
    ['A8', '最小多項式：(x+α)(x+α²)(x+α⁴) = x³+x+1'],
    ['A9', '一條 GF(8) 方程 = 三條 GF(2) 方程'],
    ['A10', 'Syndrome：S₁ = r(α) = αⁱ'],
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <ol className="space-y-1.5 text-lg">
        {units.map(([tag, text]) => (
          <li key={tag} className="flex gap-3">
            <span className="grid h-7 w-11 shrink-0 place-items-center rounded-full bg-overall-600 text-sm font-bold text-white">{tag}</span>
            <span className="text-slate-700">{text}</span>
          </li>
        ))}
      </ol>
      <div className="flex flex-col justify-center gap-4 rounded-2xl bg-overall-50 p-6 text-xl leading-relaxed text-overall-700">
        <p>
          同一個 Hamming(7,4)，換成<strong>多項式與 GF(8)</strong> 的語言：
        </p>
        <ul className="space-y-2">
          <li>編碼 → 多項式乘法 <M>{'c(x) = m(x)g(x)'}</M></li>
          <li>檢查 → 一條方程 <M>{'c(\\alpha) = 0'}</M></li>
          <li>解碼 → 找根 <M>{'S_1 = r(\\alpha) = \\alpha^i'}</M></li>
        </ul>
      </div>
    </div>
  );
}

function WhySlide({ s }: { s: Stepper }) {
  const cols = [
    { tag: '第一課', name: 'GF(2) 線性代數', lines: ['c = mG', 'Hc^T = 0\\ \\ (3 \\text{ 條方程})'], tone: 'border-data-300 bg-data-50' },
    { tag: '代數章', name: 'GF(8) 與多項式', lines: ['c(x) = m(x)g(x)', 'c(\\alpha) = 0\\ \\ (1 \\text{ 條方程})'], tone: 'border-overall-300 bg-overall-50' },
    { tag: '第二課', name: '編碼與解碼演算法', lines: ['\\text{LFSR 編碼}', 'S_1 = r(\\alpha) \\to \\text{Chien Search}'], tone: 'border-parity-300 bg-parity-50' },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {cols.map((c, i) => (
          <div key={c.tag} className={`rounded-2xl border-2 p-4 ${c.tone}`}>
            <div className="text-sm font-semibold text-slate-500">{c.tag}</div>
            <div className="mb-2 text-xl font-bold text-slate-800">
              {c.name} {i < 2 && <span className="text-slate-400">→</span>}
            </div>
            {c.lines.map((l) => (
              <div key={l} className="text-xl">
                <Tex>{l}</Tex>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="text-xl">
        不是另一種 code：循環版本和第一課的 Hamming(7,4) <strong>只差座標的排列</strong>（A9 會證明）。
      </p>
      {s.step >= 1 && (
        <motion.ol initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 text-xl">
          <li>
            ① 更省的編碼器：4×7 的 G → 一個 <M>{'g(x) = x^3+x+1'}</M> → 三個暫存器的 LFSR。
          </li>
          <li>
            ② 更聰明的解碼器：Syndrome 變成一個數 <M>{'S_1 = r(\\alpha) = \\alpha^i'}</M>，錯誤位置就是指數。
          </li>
          {s.step >= 2 && <li>③ 可以推廣：多選幾組共軛根 → BCH Code，一次修好幾個錯。</li>}
        </motion.ol>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A1 GF(2)                                                           */
/* ------------------------------------------------------------------ */

function GF2Slide({ s }: { s: Stepper }) {
  const [a, setA] = useState<Bit>(1);
  const [b, setB] = useState<Bit>(1);
  const [op, setOp] = useState<'add' | 'sub' | 'mul'>('add');
  const intRes = op === 'mul' ? a * b : op === 'add' ? a + b : a - b;
  const gfRes = op === 'mul' ? GF2.mul(a, b) : GF2.add(a, b);
  const sym = op === 'add' ? '+' : op === 'sub' ? '-' : '\\cdot';
  const axiomsOk = checkFieldAxioms(GF2).every((x) => x.holds);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        <Segmented
          ariaLabel="運算"
          value={op}
          onChange={setOp}
          options={[
            { value: 'add', label: '加法' },
            { value: 'sub', label: '減法' },
            { value: 'mul', label: '乘法' },
          ]}
        />
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-end gap-3">
            <BitCell value={a} label="a" size="lg" onClick={() => setA((1 - a) as Bit)} />
            <span className="pb-3 text-3xl text-slate-400">{op === 'add' ? '+' : op === 'sub' ? '−' : '·'}</span>
            <BitCell value={b} label="b" size="lg" onClick={() => setB((1 - b) as Bit)} />
          </div>
          <div className="space-y-1 text-2xl">
            <div>
              <Tex>{`\\text{整數：}\\ ${a} ${sym} ${b} = ${intRes}`}</Tex>
            </div>
            <div>
              <Tex>{`\\text{mod 2：}\\ ${intRes} \\equiv ${gfRes}`}</Tex>
            </div>
            <div className="text-lg text-slate-500">{op === 'mul' ? `= ${a} AND ${b}` : `= ${a} XOR ${b}`}</div>
          </div>
        </div>
        <div className="flex gap-10 text-center text-2xl">
          {(['add', 'mul'] as const).map((o) => (
            <table key={o}>
              <tbody>
                <tr>
                  <td className="px-3 py-1 font-semibold">{o === 'add' ? '+' : '·'}</td>
                  <td className="px-3 py-1 font-semibold">0</td>
                  <td className="px-3 py-1 font-semibold">1</td>
                </tr>
                {[0, 1].map((x) => (
                  <tr key={x}>
                    <td className="px-3 py-1 font-semibold">{x}</td>
                    {[0, 1].map((y) => {
                      const on = x === a && y === b && (o === 'mul') === (op === 'mul');
                      return (
                        <td key={y} className={`rounded px-3 py-1 font-mono ${on ? 'bg-amber-100 font-bold' : ''}`}>
                          {o === 'add' ? GF2.add(x, y) : GF2.mul(x, y)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-lg font-semibold text-slate-700">特徵：把 1 一直加</div>
        {['1', '1 + 1', '1 + 1 + 1'].slice(0, Math.min(s.step, 2) + 1).map((l, i) => (
          <motion.div key={l} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className={`rounded-xl px-4 py-2 text-2xl ${i === 1 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50'}`}>
            <Tex>{`${l} = ${(i + 1) % 2}`}</Tex>
            {i === 1 && <span className="ml-2 text-base">← 第一次回到 0</span>}
          </motion.div>
        ))}
        {s.step >= 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 rounded-xl border-2 border-emerald-300 p-4 text-xl">
            <div>
              特徵 = {characteristic(GF2)}：<M>{'-1 = 1'}</M>，所以 <M>{'a - b = a + b'}</M>
            </div>
            <div className="text-lg text-emerald-800">{axiomsOk ? '✓ 10 條體公理全部成立：GF(2) 是體' : '✗ 有公理不成立'}</div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function HcSlide({ s }: { s: Stepper }) {
  const [m, setM] = useState<Bit[]>([1, 0, 1, 1]);
  const [flip, setFlip] = useState<number | null>(null);
  const c = encode74(m);
  const r = flip === null ? c : (flipBit(c, flip) as Bit[]);
  const syn = matVec(H74, r);
  const ok = syn.every((x) => x === 0);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-5">
          <MessageInput message={m} onToggle={(i) => setM(m.map((x, j) => (j === i ? ((1 - x) as Bit) : x)))} size="md" />
          <span className="pb-3 text-2xl text-slate-300">→</span>
          <BitRow bits={r} layout={LAYOUT_74} size="md" states={r.map((_, i) => (i === flip ? 'error' : 'normal'))} onToggle={(i) => setFlip(flip === i ? null : i)} />
        </div>
        <p className="text-lg text-slate-600">{flip === null ? '右邊是編好的 codeword c，沒有錯誤。' : `右邊的字第 ${flip + 1} 個位元被翻轉（紅色）。`}</p>
        {s.step >= 1 && (
          <div style={{ zoom: 1.35 }}>
            <MatrixView matrix={H74} name="H" colLabels={r.map((x) => `r=${x}`)} highlightCols={r.flatMap((x, j) => (x ? [j] : []))} />
          </div>
        )}
      </div>
      <div className="space-y-3 text-xl">
        {s.step >= 2 &&
          H74.slice(0, s.step - 1).map((row, i) => {
            const vals = row.flatMap((h, j) => (h ? [r[j]] : []));
            const total = vals.filter(Boolean).length;
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-slate-50 px-3 py-2">
                <Tex>{`\\text{第 ${i + 1} 列：}\\ ${row.map((h, j) => (h ? `r_{${j + 1}}` : null)).filter(Boolean).join(' + ')} = ${vals.join(' + ')} = ${total} \\equiv ${total % 2}`}</Tex>
              </motion.div>
            );
          })}
        {s.step >= 4 && (
          <div className={`rounded-xl border-2 p-3 ${ok ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-rose-300 bg-rose-50 text-rose-900'}`}>
            <M>{`Hr^T = (${syn.join(', ')})^T`}</M>：{ok ? '每一列都是偶數個 1，合法 codeword。' : '有一列是奇數個 1，r 不是 codeword。'}
          </div>
        )}
        {s.step < 2 && <p className="text-lg text-slate-500">下一步：把 H 的每一列和 r 對應的位元相加。</p>}
        {s.step >= 4 && <p className="text-lg text-slate-600">拿掉 mod 2 就會出現 2、4：「= 0」就不再代表同位檢查通過。</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A2 Why GF(8)                                                       */
/* ------------------------------------------------------------------ */

function ColumnsSlide({ s }: { s: Stepper }) {
  const col = s.step - 1;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-8">
        <div style={{ zoom: 1.35 }}>
          <MatrixView matrix={H74} name="H =" colLabels={LAYOUT_74.map((p) => p.label)} highlightCols={s.step ? [col] : []} />
        </div>
        <div className="min-w-0 flex-1 text-xl">
          {s.step === 0 ? (
            <p>GF(2) 觀點：H 有 7 個不同的非零 3 位元向量——只能相加，不能相乘。</p>
          ) : (
            <p>
              第 {col + 1} 欄由上而下 <span className="mono">({column(H74, col).join(', ')})</span> 讀成 <M>{'1, \\alpha, \\alpha^2'}</M> 的係數 = <strong><M>{gf8PolyTex(col + 1)}</M></strong>（{gf8Bits(col + 1)}）
            </p>
          )}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {GF8_ELEMENTS.map((x) => {
          const on = x === 0 || x <= s.step;
          return (
            <div key={x} className={`rounded-xl border-2 px-3 py-2 transition-colors ${s.step > 0 && x === s.step ? 'border-overall-500 bg-overall-50' : on ? 'border-slate-300' : 'border-slate-100 opacity-40'}`}>
              <div className="font-mono text-2xl font-bold">{gf8Bits(x)}</div>
              <div className="text-xl">
                <M>{gf8PolyTex(x)}</M>
              </div>
            </div>
          );
        })}
      </div>
      {s.step >= 7 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl">
          GF(8) 把它們變成可以相乘、相除的「數」：三條 <M>{'Hc^T = 0'}</M> 濃縮成一條 <M>{'c(\\alpha) = 0'}</M>（A9）。加法仍是 XOR：<M>{'(\\alpha^2 + 1) + (\\alpha + 1) = \\alpha^2 + \\alpha'}</M>，101 ⊕ 011 = 110。
        </motion.p>
      )}
    </div>
  );
}

function Z8Slide({ s }: { s: Stepper }) {
  const S = s.step === 0 ? zmod(8) : GF8_FIELD;
  const isGF = S === GF8_FIELD;
  const label = (x: number) => (isGF ? gf8Bits(x) : String(x));
  const axioms = checkFieldAxioms(S, label).filter((x) => ['distrib', 'add-inv', 'mul-inv', 'no-zero-div'].includes(x.key));
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <table className="mx-auto text-center font-mono text-lg">
        <thead>
          <tr>
            <th className="px-2 py-1">·</th>
            {S.elements.map((y) => (
              <th key={y} className="px-2 py-1 text-slate-500">
                {label(y)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {S.elements.map((x) => (
            <tr key={x}>
              <th className="px-2 py-1 text-slate-500">{label(x)}</th>
              {S.elements.map((y) => {
                const v = S.mul(x, y);
                const zeroDiv = v === 0 && x !== 0 && y !== 0;
                return (
                  <td key={y} className={`rounded px-2 py-1 ${zeroDiv ? 'bg-rose-200 font-bold text-rose-800' : v === 1 ? 'bg-emerald-100 text-emerald-800' : ''}`}>
                    {label(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-4">
        <div className="text-2xl font-bold">{isGF ? 'GF(8)' : 'ℤ/8（整數 mod 8）'}</div>
        <Checks title={`${S.name} 是體嗎？`} items={axioms.map((x) => ({ label: x.zh, pass: x.holds, detail: x.counterexample }))} />
        <p className="text-lg text-slate-600">綠色 = 乘積為 1（有反元素）；紅色 = 兩個非零元素相乘得 0（零因子）。</p>
        {isGF && <p className="text-lg text-slate-700">101 不是數字 5，而是 α² + 1。乘法規則來自 A3 的 α³ = α + 1。</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A3 Construct GF(8)                                                 */
/* ------------------------------------------------------------------ */

const CUBICS = polysOfDegree(3);
const REDUCIBLE = CUBICS.findIndex((p) => p.join('') === '1001'); // x³ + 1
const IRREDUCIBLE = CUBICS.findIndex((p) => p.join('') === '1101'); // x³ + x + 1
const xBits = (v: number) => {
  if (v === 0) return '0';
  const t: string[] = [];
  if (v & 4) t.push('x²');
  if (v & 2) t.push('x');
  if (v & 1) t.push('1');
  return t.join('+');
};

function QuotientSlide({ s }: { s: Stepper }) {
  const q = CUBICS[s.step === 0 ? REDUCIBLE : IRREDUCIBLE];
  const ring = useMemo(() => quotientRing(q), [q]);
  const axioms = checkFieldAxioms(ring, xBits).filter((x) => ['mul-inv', 'no-zero-div'].includes(x.key));
  const irr = isIrreducible(q);
  const factors = factorGF2(q);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <table className="mx-auto text-center font-mono text-sm">
        <thead>
          <tr>
            <th className="px-1.5 py-1">·</th>
            {ring.elements.map((y) => (
              <th key={y} className="px-1.5 py-1 text-slate-500">
                {xBits(y)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ring.elements.map((x) => (
            <tr key={x}>
              <th className="px-1.5 py-1 text-slate-500">{xBits(x)}</th>
              {ring.elements.map((y) => {
                const v = ring.mul(x, y);
                const zd = v === 0 && x !== 0 && y !== 0;
                return (
                  <td key={y} className={`rounded px-1.5 py-1 ${zd ? 'bg-rose-200 font-bold text-rose-800' : v === 1 ? 'bg-emerald-100' : ''}`}>
                    {xBits(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-3 text-xl">
        <div className="text-2xl">
          <M>{`p(x) = ${polyToTex(q)}`}</M>
        </div>
        <div>
          <M>{`p(0) = ${evalGF2(q, 0)},\\ p(1) = ${evalGF2(q, 1)}`}</M>
        </div>
        <div>
          分解：<M>{factors.length > 1 ? factors.map((f) => `(${polyToTex(f)})`).join('') : polyToTex(q)}</M>
        </div>
        <div className={`rounded-xl p-3 font-semibold ${irr ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{irr ? '不可約 ✓：商環是體' : '可約（有根）✗：出現零因子'}</div>
        <Checks items={axioms.map((x) => ({ label: x.zh, pass: x.holds, detail: x.counterexample }))} />
        {s.step >= 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border-2 border-overall-300 bg-overall-50 p-3">
            <Tex>{'p(\\alpha) = \\alpha^3+\\alpha+1 = 0 \\;\\Rightarrow\\; \\alpha^3 = \\alpha + 1'}</Tex>
          </motion.div>
        )}
      </div>
    </div>
  );
}

const MUL_A = 0b110;
const MUL_B = 0b011;
const MUL = gf8MulTrace(MUL_A, MUL_B);
const MUL_LINES = [
  { label: '寫成多項式', tex: `(${gf8PolyTex(MUL_A)})(${gf8PolyTex(MUL_B)})` },
  { label: '分配律展開（先不合併）', tex: MUL.terms.map(powTex).join(' + ') },
  { label: '同類項合併（係數 mod 2）', tex: `= ${alphaPolyTex(MUL.raw)}` },
  ...MUL.reductions.map((r) => ({
    label: `化簡 α${SUP[r.power]}`,
    tex: `${r.power === 4 ? '\\alpha^4 = \\alpha\\cdot\\alpha^3 = \\alpha^2 + \\alpha' : '\\alpha^3 = \\alpha + 1'}\\;\\Rightarrow\\; ${alphaPolyTex(r.before)} = ${alphaPolyTex(r.after)}`,
  })),
  { label: '結果：兩者互為反元素', tex: `= ${gf8PolyTex(MUL.result)}\\quad [${gf8Bits(MUL.result)}]` },
];

function MulSlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <StepLines s={s} lines={MUL_LINES} />
      <div className="space-y-3 rounded-2xl border-2 border-slate-200 p-5 text-xl">
        <div className="font-semibold text-slate-800">x³ ≡ x + 1：LFSR 回授規則從這裡來</div>
        <Tex block>{'\\alpha^4 = \\alpha\\cdot\\alpha^3 = \\alpha^2 + \\alpha'}</Tex>
        <Tex block>{'\\alpha^5 = \\alpha\\cdot\\alpha^4 = \\alpha^3 + \\alpha^2 = \\alpha^2 + \\alpha + 1'}</Tex>
        <p className="text-lg text-slate-600">每次乘上 α 就是左移；溢出 α³ 時換成 α + 1——第二課的三個暫存器做的正是這件事。</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A4 Primitive element                                               */
/* ------------------------------------------------------------------ */

function CycleSlide({ s }: { s: Stepper }) {
  const k = s.step;
  const cur = alphaPow(k);
  const prev = alphaPow(k + 6);
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[400px_minmax(0,1fr)]">
      <svg viewBox="0 0 320 320" className="mx-auto w-full max-w-[400px]">
        {[0, 1, 2, 3, 4, 5, 6].map((e) => {
          const p = ringPoint(e);
          const q = ringPoint((e + 1) % 7);
          return <line key={`l${e}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#e2e8f0" strokeWidth={1.5} />;
        })}
        {[0, 1, 2, 3, 4, 5, 6].map((e) => {
          const p = ringPoint(e);
          const on = LOG[cur] === e;
          return (
            <g key={e}>
              <circle cx={p.x} cy={p.y} r={26} fill={on ? '#ede4ff' : '#fff'} stroke={on ? '#7638dc' : '#94a3b8'} strokeWidth={on ? 3 : 1.5} />
              <text x={p.x} y={p.y - 3} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
                {powLabel(e)}
              </text>
              <text x={p.x} y={p.y + 13} textAnchor="middle" fontSize={11} fontFamily="ui-monospace, monospace" fill="#64748b">
                {gf8Bits(alphaPow(e))}
              </text>
            </g>
          );
        })}
        <motion.circle r={8} fill="#7638dc" initial={false} animate={{ cx: ringPoint(LOG[cur]).x, cy: ringPoint(LOG[cur]).y - 34 }} transition={{ type: 'spring', stiffness: 180, damping: 18 }} />
        <text x={160} y={164} textAnchor="middle" fontSize={13} fill="#334155">
          已乘 {k} 次
        </text>
      </svg>
      <div className="space-y-4 text-xl">
        {k === 0 ? (
          <p>從 1 出發，每次乘上 α：位元左移，溢出 α³ 時用 α³ = α + 1 回授。</p>
        ) : (
          <>
            <div className="text-2xl">
              <Tex>{`(${gf8PolyTex(prev)}) \\cdot \\alpha = ${gf8PolyTex(cur)}`}</Tex>
            </div>
            <div className="font-mono text-2xl">
              {gf8Bits(prev)} → <strong>{gf8Bits(cur)}</strong>
            </div>
            {(prev & 4) !== 0 && (
              <p className="text-amber-700">
                左移後出現 α³，回授：<M>{`${alphaPolyTex(prev << 1)} \\to ${gf8PolyTex(cur)}`}</M>
              </p>
            )}
          </>
        )}
        <div className="font-mono text-lg text-slate-500">
          {Array.from({ length: k + 1 }, (_, i) => gf8Bits(alphaPow(i))).join(' → ')}
        </div>
        {k >= 7 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
            <div>
              <M>{'\\alpha^7 = 1'}</M>：7 步走遍全部 7 個非零元素，α 是<strong>本原元素</strong>。
            </div>
            <div>
              乘法變成指數相加 <M>{'\\alpha^i \\cdot \\alpha^j = \\alpha^{i+j}'}</M>；7 個次方對上碼長 <M>{'n = 2^3 - 1 = 7'}</M> 的 7 個位置。
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A5 Generator polynomial                                            */
/* ------------------------------------------------------------------ */

const M5: Bit[] = [1, 0, 1, 1];
const T5 = polyMulTrace(G_MSB, M5, 7);
const P5 = T5.partials.length;
const GC = cyclicGenerator();

function PolyMulSlide({ s }: { s: Stepper }) {
  const stage = s.step >= P5 + 1 ? 3 : s.step >= P5 ? 2 : s.step >= P5 - 1 ? 1 : 0;
  const c = encodeNonSystematic(M5);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PolyMulTable t={T5} revealed={s.step + 1} aName="g(x)" bName="m(x)" large />
      <div className="space-y-4">
        <div className="text-2xl">
          <PolyMulTex t={T5} stage={stage} />
        </div>
        {s.step >= P5 + 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-xl text-emerald-900">
            c = <span className="mono font-bold">{c.join('')}</span>：是 g(x) 的倍數，所以 <M>{'c(\\alpha) = 0'}</M>
            {wordAtAlpha(c) === 0 ? ' ✓' : ' ✗'}。編碼只做乘法，<strong>不取餘數</strong>。
          </motion.div>
        )}
      </div>
    </div>
  );
}

function GcycSlide({ s }: { s: Stepper }) {
  const c = vecMat(M5, GC);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div style={{ zoom: 1.5 }}>
        <MatrixView
          matrix={GC}
          name={<M>{'G_{\\text{cyc}} ='}</M>}
          colLabels={EXP_LABELS}
          rowLabels={s.step >= 1 ? M5.map((b) => `${b}·`) : undefined}
          highlightRows={s.step >= 1 ? M5.flatMap((b, i) => (b ? [i] : [])) : []}
          dimRows={s.step >= 1 ? M5.flatMap((b, i) => (b ? [] : [i])) : []}
        />
      </div>
      <div className="space-y-2 text-xl">
        {GC.map((row, i) => (
          <div key={i} className={s.step >= 1 && !M5[i] ? 'opacity-40' : ''}>
            第 {i + 1} 列 <span className="mono">{row.join('')}</span> = <M>{`${['x^3g(x)', 'x^2g(x)', 'x\\cdot g(x)', 'g(x)'][i]} = ${msbToTex(row)}`}</M>
          </div>
        ))}
        {s.step >= 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 text-2xl">
            <Tex>{'m = 1011:\\ m(x)g(x) = x^3g(x) + x\\,g(x) + g(x)'}</Tex>
          </motion.div>
        )}
        {s.step >= 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 text-emerald-900">
            <span className="mono font-bold">mG_cyc = {c.join('')}</span> = 上一頁的 m(x)g(x) {c.join('') === encodeNonSystematic(M5).join('') ? '✓' : '✗'}：矩陣和多項式是同一個計算的兩種寫法。
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A6 Cyclic code                                                     */
/* ------------------------------------------------------------------ */

const START: Bit[] = [0, 0, 0, 1, 0, 1, 1];
/** one tile slot: w-16 tile + gap-2 */
const SLOT = 72;

function ShiftSlide({ s }: { s: Stepper }) {
  const k = s.step;
  const cur = rotateLeft(START, k % 7);
  const prev = rotateLeft(START, (k + 6) % 7);
  const wrapped = k > 0 && prev[0] === 1;
  // direction of the last step, so each tile slides in from the slot it just left
  const lastK = useRef(k);
  const dir = Math.sign(k - lastK.current);
  useEffect(() => {
    lastK.current = k;
  }, [k]);
  const from = (i: number) => (dir > 0 ? (i === 6 ? -6 * SLOT : SLOT) : dir < 0 ? (i === 0 ? 6 * SLOT : -SLOT) : 0);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        <div className="flex gap-2">
          {EXP_LABELS.map((l) => (
            <span key={l} className="w-16 text-center text-base font-semibold text-slate-500">
              {l}
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          {cur.map((b, i) => {
            const origin = (i + (k % 7)) % 7; // which original bit sits here now
            return (
              <motion.div
                key={`${origin}-${k}`}
                initial={{ x: from(i) }}
                animate={{ x: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className={`grid h-16 w-16 place-items-center rounded-xl border-2 font-mono text-3xl font-bold ${b ? 'border-overall-400 bg-overall-50 text-overall-800' : 'border-slate-300 text-slate-400'} ${wrapped && i === 6 ? 'ring-4 ring-amber-400' : ''}`}
              >
                {b}
              </motion.div>
            );
          })}
        </div>
        <div className="text-2xl">
          <Tex>{`x^{${k}}c(x) \\equiv ${msbToTex(cur)}`}</Tex>
        </div>
        {k > 0 && (
          <p className="text-xl text-slate-700">
            <M>{`x \\cdot (${msbToTex(prev)})`}</M>
            {wrapped ? (
              <>
                {' '}產生 <M>{'x^7'}</M>，用 <M>{'x^7 \\equiv 1'}</M> 繞回最右邊（橘框）。
              </>
            ) : (
              ' 沒有超過 x⁶，直接左移。'
            )}
          </p>
        )}
        {k >= 7 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-xl text-emerald-900">
            線性（加法封閉）＋ 循環（乘 x 封閉）⇒ C 是 <M>{'R_7'}</M> 的<strong>理想</strong> <M>{'\\langle g(x) \\rangle'}</M>。
          </motion.div>
        )}
      </div>
      <div className="space-y-1.5">
        <div className="text-lg font-semibold text-slate-700">軌道（每一個都是 codeword？）</div>
        {Array.from({ length: Math.min(k, 7) + 1 }, (_, j) => rotateLeft(START, j % 7)).map((w, j) => (
          <div key={j} className={`flex items-center justify-between rounded-lg px-3 py-1 font-mono text-xl ${j === Math.min(k, 7) ? 'bg-amber-50' : 'bg-slate-50'}`}>
            <span>
              x<sup>{j}</sup>c = {w.join('')}
            </span>
            <span className={inCyclicCode(w) ? 'text-emerald-600' : 'text-rose-600'}>{inCyclicCode(w) ? '✓' : '✗'}</span>
          </div>
        ))}
        {k >= 7 && <p className="pt-1 text-lg text-slate-600">位移 7 次回到起點。</p>}
      </div>
    </div>
  );
}

const IDEAL_CODES = [11, 6, 1, 15];

function IdealSlide({ s }: { s: Stepper }) {
  const [a, setA] = useState<Bit[]>([0, 0, 0, 0, 0, 1, 1]); // x + 1
  const [ci, setCi] = useState(11); // m = 1011 → 1000101
  const c = CODE[ci];
  const prod = useMemo(() => mulModXn1(a, c), [a, c]);
  const other = CODE[6];
  const h = polyQuot(xn1(7), [1, 1, 0, 1]);
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="text-lg font-semibold text-slate-600">a(x)：環 R₇ 中任意一個元素</div>
        <BitPolyEditor bits={a} onToggle={(i) => setA(flipBit(a, i) as Bit[])} />
        <div className="flex flex-wrap items-center gap-2 text-lg">
          <span className="font-semibold text-slate-600">c(x)：</span>
          {IDEAL_CODES.map((i) => (
            <button key={i} type="button" onClick={() => setCi(i)} className={`chip border px-3 py-1 font-mono text-base ${i === ci ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200'}`}>
              {CODE[i].join('')}
            </button>
          ))}
        </div>
        <div className="space-y-1 text-2xl">
          {s.step >= 1 && <Tex block>{`a(x)c(x) = ${msbToTex(prod.full)}`}</Tex>}
          {s.step >= 2 && (prod.wrapped.length ? <Tex block>{`${prod.wrapped.map((e) => `x^{${e}} \\equiv x^{${e - 7}}`).join(',\\ ')}\\quad (x^7 \\equiv 1)`}</Tex> : <p className="text-xl text-slate-500">沒有超過 x⁶，不必繞回。</p>)}
          {s.step >= 2 && <Tex block>{`\\equiv ${msbToTex(prod.folded)} \\pmod{x^7-1}\\quad [${prod.folded.join('')}]`}</Tex>}
        </div>
      </div>
      <div className="space-y-3">
        <div className="rounded-2xl border-2 border-overall-300 bg-overall-50 p-4 text-lg text-overall-900">
          <div className="mb-1 font-semibold">理想 I ⊂ R₇</div>
          (1) I 中兩元素相加仍在 I（線性）
          <br />
          (2) I 中元素乘上 R₇ 的<strong>任何元素</strong>仍在 I（吸收乘法）
        </div>
        {s.step >= 2 && (
          <>
            <Checks
              items={[
                { label: <>a(x)c(x) = {prod.folded.join('')} 是 codeword</>, pass: inCyclicCode(prod.folded) },
                { label: <>加法：{c.join('')} ⊕ {other.join('')} = {vecAdd(c, other).join('')} 是 codeword</>, pass: inCyclicCode(vecAdd(c, other)) },
              ]}
            />
            <div className="text-lg">
              <M>{`x^7 - 1 = (x^3+x+1)(${polyToTex(h)})`}</M>：g(x) 整除 x⁷ − 1，繞回時才不會離開 g 的倍數。
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A7 Frobenius and cyclotomic cosets                                 */
/* ------------------------------------------------------------------ */

const FROB_LINES = [
  { label: '照常展開', tex: '(a+b)^2 = a^2 + ab + ba + b^2 = a^2 + 2ab + b^2' },
  { label: '特徵 2：任何元素加兩次都是 0', tex: '2ab = ab + ab = 0' },
  { label: '新生的夢（Freshman’s Dream）', tex: '(a+b)^2 = a^2 + b^2,\\quad \\varphi(a) = a^2 \\text{ 保持加法與乘法}' },
];

function FrobSlide({ s }: { s: Stepper }) {
  const frobAdd = GF8_ELEMENTS.every((x) => GF8_ELEMENTS.every((y) => frobenius(gf8Add(x, y)) === gf8Add(frobenius(x), frobenius(y))));
  const frobMul = GF8_ELEMENTS.every((x) => GF8_ELEMENTS.every((y) => frobenius(gf8Mul(x, y)) === gf8Mul(frobenius(x), frobenius(y))));
  const frobBij = new Set(GF8_ELEMENTS.map(frobenius)).size === 8;
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_440px]">
      <StepLines s={s} lines={FROB_LINES} />
      <div className="space-y-3">
        <div className="text-lg font-semibold text-slate-700">Frobenius 表：a ↦ a²</div>
        <div className="grid grid-cols-4 gap-2">
          {GF8_ELEMENTS.map((x) => (
            <div key={x} className="rounded-lg border border-slate-200 p-2 text-center text-lg">
              <M>{`${gf8PowTex(x)} \\mapsto ${gf8PowTex(frobenius(x))}`}</M>
              <div className="font-mono text-sm text-slate-500">
                {gf8Bits(x)} → {gf8Bits(frobenius(x))}
              </div>
            </div>
          ))}
        </div>
        {s.step >= 2 && (
          <Checks
            title="Frobenius 是自同構（窮舉 64 組）"
            items={[
              { label: '保持加法 φ(a+b) = φ(a)+φ(b)', pass: frobAdd },
              { label: '保持乘法 φ(ab) = φ(a)φ(b)', pass: frobMul },
              { label: '一對一且映成', pass: frobBij },
            ]}
          />
        )}
      </div>
    </div>
  );
}

const COSET_C = CODE[11]; // 1000101 = x⁶ + x² + 1

function CosetSlide({ s }: { s: Stepper }) {
  const orbit = cosetOrbit(1);
  const visited = orbit.slice(0, Math.min(s.step + 1, orbit.length));
  const closed = s.step >= orbit.length;
  const shownRows = closed ? [0, 1, 2, 3, 4, 5, 6] : visited;
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[420px_minmax(0,1fr)]">
      <div>
        <svg viewBox="0 0 320 320" className="mx-auto w-full max-w-[370px]">
          <defs>
            <marker id="deck-coset-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#7638dc" />
            </marker>
          </defs>
          {visited.slice(0, -1).map((e, k) => {
            const p = ringPoint(e);
            const q = ringPoint(visited[k + 1]);
            return <motion.line key={`${e}-${k}`} x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#7638dc" strokeWidth={2.5} markerEnd="url(#deck-coset-arr)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />;
          })}
          {closed && (() => {
            const p = ringPoint(orbit[orbit.length - 1]);
            const q = ringPoint(orbit[0]);
            return <motion.line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#7638dc" strokeWidth={2.5} strokeDasharray="5 4" markerEnd="url(#deck-coset-arr)" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} />;
          })()}
          {[0, 1, 2, 3, 4, 5, 6].map((e) => {
            const p = ringPoint(e);
            const on = visited.includes(e);
            return (
              <g key={e}>
                <circle cx={p.x} cy={p.y} r={24} fill={on ? '#ede4ff' : '#fff'} stroke={on ? '#7638dc' : '#cbd5e1'} strokeWidth={on ? 3 : 1.5} />
                <text x={p.x} y={p.y - 2} textAnchor="middle" fontSize={13} fontWeight={700} fill="#334155">
                  {powLabel(e)}
                </text>
                <text x={p.x} y={p.y + 12} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="#64748b">
                  {gf8Bits(alphaPow(e))}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="text-center text-xl">
          指數：{visited.join(' → ×2 → ')}
          {closed && ` → ${orbit[0]}（8 ≡ 1 mod 7）`}
        </div>
      </div>
      <div className="space-y-3">
        <div className="text-xl">
          <M>{`c(x) = ${msbToTex(COSET_C)}`}</M> 代入 <M>{'\\alpha^j'}</M>：
        </div>
        <table className="text-lg">
          <tbody>
            {[0, 1, 2, 3, 4, 5, 6].map((j) => {
              const v = wordAtAlphaPower(COSET_C, j);
              const show = shownRows.includes(j);
              return (
                <tr key={j} className={`border-t border-slate-100 ${orbit.includes(j) && show ? 'bg-overall-50' : ''}`}>
                  <td className="py-0.5 pr-6">
                    <M>{`c(${powTex(j)})`}</M>
                  </td>
                  <td className="pr-4">{show ? <M>{`= ${gf8PowTex(v)}`}</M> : <span className="text-slate-300">?</span>}</td>
                  <td className="text-base text-emerald-700">{show && v === 0 ? '✓ 根' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {s.step === 1 && <p className="text-lg text-slate-600">c 的係數在 GF(2)：<M>{'c(\\alpha)^2 = c(\\alpha^2)'}</M>，所以 α 是根 ⇒ α² 也是根。</p>}
        {closed && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 text-lg">
            <div>
              分圓陪集：{cyclotomicCosets().map((cs) => `{${cs.join(', ')}}`).join('、')}
            </div>
            <div>
              ⇒ g(x) 至少要有 <M>{'(x+\\alpha)(x+\\alpha^2)(x+\\alpha^4)'}</M>，次數 ≥ 3（A8 把它乘開）。
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A8 Minimal polynomial                                              */
/* ------------------------------------------------------------------ */

const MP = minimalPolynomial(1);
const ALL_MP = allMinimalPolynomials();
const toMsb = (p: number[]) => polyToMsb(p as Bit[], p.length);
const T1 = polyMulTrace(toMsb(ALL_MP[0].binary!), toMsb(ALL_MP[1].binary!));
const T2 = polyMulTrace(T1.result, toMsb(ALL_MP[2].binary!));

function MinPolyStep({ k }: { k: number }) {
  const st = MP.steps[k];
  return (
    <div className="space-y-1 rounded-xl bg-slate-50 p-3">
      <div className="text-2xl">
        <Tex>{`(${gfPolyTex(st.left)})(${gfPolyTex(st.factor)})`}</Tex>
      </div>
      <div className="space-y-0.5 text-lg">
        {st.rawTerms
          .map((terms, deg) => ({ terms, deg }))
          .reverse()
          .filter((x) => x.terms.length > 1)
          .map(({ terms, deg }) => (
            <div key={deg}>
              <Tex>{`${deg === 0 ? '\\text{常數項}' : deg === 1 ? 'x' : `x^{${deg}}`}:\\ ${terms.map(powTex).join(' + ')} = ${gf8PowTex(st.product[deg])}\\quad (${terms.map((e) => gf8Bits(alphaPow(e))).join(' \\oplus ')} = ${gf8Bits(st.product[deg])})`}</Tex>
            </div>
          ))}
      </div>
      <div className="text-2xl">
        <Tex>{`= ${gfPolyTex(st.product)}`}</Tex>
      </div>
    </div>
  );
}

function MinPolySlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-3">
        <div className="text-2xl">
          <Tex>{`\\alpha \\to \\alpha^2 \\to \\alpha^4 \\to \\alpha,\\quad m_\\alpha(x) = (x + \\alpha)(x + \\alpha^2)(x + \\alpha^4)`}</Tex>
        </div>
        {s.step >= 1 && <MinPolyStep k={1} />}
        {s.step >= 2 && <MinPolyStep k={2} />}
        {s.step >= 2 && (
          <p className="text-xl text-emerald-800">
            每個係數都化簡成 0 或 1：<M>{`m_\\alpha(x) = ${polyToTex(MP.binary!)}`}</M>，正是 Hamming Code 的 g(x)。
          </p>
        )}
      </div>
      <div className="space-y-3">
        <table className="w-full text-xl">
          <tbody>
            {[0, 1, 2, 3, 4, 5, 6].map((e) => {
              const v = gfPolyEval(MP.poly, alphaPow(e));
              const conj = MP.coset.includes(e);
              return (
                <tr key={e} className={`border-t border-slate-100 ${conj && s.step >= 3 ? 'bg-overall-50' : ''}`}>
                  <td className="py-1">
                    <M>{`m_\\alpha(${powTex(e)})`}</M>
                  </td>
                  <td>{s.step >= 3 ? <M>{`= ${gf8PowTex(v)}`}</M> : <span className="text-slate-300">?</span>}</td>
                  <td className="text-base text-emerald-700">{s.step >= 3 && v === 0 ? '✓ 根' : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {s.step >= 3 && (
          <Checks
            items={[
              { label: '所有係數都在 GF(2)', pass: MP.binary !== null },
              { label: '每個共軛元素都是根', pass: MP.rootsOk },
              { label: `次數 = 陪集大小 = ${MP.coset.length}，k = 7 − 3 = 4`, pass: MP.poly.length - 1 === MP.coset.length },
            ]}
          />
        )}
      </div>
    </div>
  );
}

function FactorSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        {ALL_MP.map((m) => (
          <div key={m.coset[0]} className={`rounded-xl border-2 p-2 text-center text-xl ${m.coset.includes(1) ? 'border-overall-400 bg-overall-50' : 'border-slate-200'}`}>
            <M>{`C_{${m.coset[0]}} = \\{${m.coset.join(', ')}\\} \\;\\to\\; ${polyToTex(m.binary!)}`}</M>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {s.step >= 1 && <PolyMulTable t={T1} aName="(x+1)" bName="x³+x+1" />}
        {s.step >= 2 && <PolyMulTable t={T2} aName="上式" bName="x³+x²+1" />}
      </div>
      {s.step >= 2 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl">
          <M>{`(x+1)(x^3+x+1)(x^3+x^2+1) = ${msbToTex(T2.result)} = x^7 - 1`}</M>（GF(2) 中 −1 = +1）：g(x) = m_α(x) 整除 x⁷ − 1，正是 A6 需要的條件。
        </motion.p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A9 H from GF(8)                                                    */
/* ------------------------------------------------------------------ */

const HC = hFromGF8();
const COL_LABELS = ['α⁶', 'α⁵', 'α⁴', 'α³', 'α²', 'α', '1'];

function BuildHSlide({ s }: { s: Stepper }) {
  const built = s.step;
  const k = Math.min(built, 7) - 1;
  const e = 6 - k;
  return (
    <div className="space-y-5">
      <div className="text-xl">
        <Tex block>{'c(\\alpha) = \\sum_{i=0}^{6} c_i\\,\\alpha^i = \\underbrace{\\big[\\,\\alpha^6\\ \\alpha^5\\ \\alpha^4\\ \\alpha^3\\ \\alpha^2\\ \\alpha\\ 1\\,\\big]}_{\\text{每一項寫成 3 位元直行}}\\begin{bmatrix}c_6\\\\ \\vdots\\\\ c_0\\end{bmatrix} = H_{\\text{cyc}}\\,c^T'}</Tex>
      </div>
      <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div style={{ zoom: 1.6 }}>
          <MatrixView
            matrix={HC.map((row) => row.map((v, j) => (j < built ? v : 0) as Bit))}
            name={<M>{'H_{\\text{cyc}} ='}</M>}
            colLabels={COL_LABELS}
            rowLabels={['α²', 'α', '1']}
            highlightCols={built > 0 && built <= 7 ? [built - 1] : []}
            cellClass={(_, j) => (j >= built ? 'text-slate-200' : undefined)}
          />
        </div>
        <div className="space-y-3 text-xl">
          {built === 0 ? (
            <p>從最左欄（x⁶ 的位置，對應 α⁶）開始：每一欄就是 αⁱ 的 3 位元座標。</p>
          ) : (
            <>
              <div>
                第 {k + 1} 欄 = <M>{`c_{${e}}`}</M> 所乘的元素 <M>{powTex(e)}</M>
              </div>
              <div className="text-2xl">
                <Tex>{`${powTex(e)} = ${gf8PolyTex(alphaPow(e))} \\leftrightarrow (${intToBits(alphaPow(e), 3).join(',')})^T`}</Tex>
              </div>
              <ColumnVector bits={intToBits(alphaPow(e), 3)} cellClass="bg-fuchsia-100 text-fuchsia-800" />
            </>
          )}
          {built >= 7 && <p className="text-lg text-slate-600">一條 GF(8) 方程 c(α) = 0 ⇔ 三個座標都是 0 ⇔ 三條 GF(2) 方程。</p>}
        </div>
      </div>
    </div>
  );
}

function CompareSlide({ s }: { s: Stepper }) {
  const [w, setW] = useState<Bit[]>(encodeNonSystematic([1, 0, 1, 1]));
  const terms = w.flatMap((b, k) => (b ? [6 - k] : []));
  let acc = 0;
  const accRows = terms.map((e) => {
    acc ^= alphaPow(e);
    return { e, v: alphaPow(e), acc };
  });
  const atAlpha = wordAtAlpha(w);
  const hw = matVec(HC, w);
  const std = cyclicWordToStandard(w);
  return (
    <div className="space-y-3">
      <BitPolyEditor bits={w} onToggle={(i) => setW(flipBit(w, i) as Bit[])} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-3 text-lg">
          <div className="mb-1 font-semibold text-slate-500">GF(8) 觀點：c(α)</div>
          <div className="text-xl">
            <Tex>{`c(\\alpha) = ${terms.map(powTex).join(' + ') || '0'}`}</Tex>
          </div>
          <div className="mt-1 font-mono">
            {accRows.map((r) => `${gf8Bits(r.v)}`).join(' ⊕ ') || '000'} = <strong>{gf8Bits(atAlpha)}</strong>
          </div>
          <div className={`mt-1 text-xl ${atAlpha === 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            <M>{`c(\\alpha) = ${gf8PolyTex(atAlpha)}`}</M>
          </div>
        </div>
        {s.step >= 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl bg-slate-50 p-3 text-lg">
            <div className="mb-1 font-semibold text-slate-500">GF(2) 觀點：H_cyc cᵀ（選中的欄相加）</div>
            <div className="flex flex-wrap items-center gap-4">
              <div style={{ zoom: 1.2 }}>
                <MatrixView matrix={HC} size="sm" colLabels={w.map((b) => `${b}`)} highlightCols={w.flatMap((b, k) => (b ? [k] : []))} />
              </div>
              <div className="flex items-center gap-2">
                <M>{'='}</M>
                <ColumnVector bits={hw} cellClass="bg-emerald-50 text-emerald-800" />
              </div>
            </div>
            <div className={intToBits(atAlpha, 3).join('') === hw.join('') ? 'text-emerald-700' : 'text-rose-700'}>
              {intToBits(atAlpha, 3).join('') === hw.join('') ? '✓ 和 c(α) 的三個座標一模一樣' : '✗ 不一致'}
            </div>
          </motion.div>
        )}
      </div>
      {s.step >= 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border-2 border-overall-300 bg-overall-50 p-3 text-lg text-overall-900">
          和第一課對照：循環碼位置 x⁶…1 對到第一課的 #{COL_LABELS.map((_, k) => cyclicIndexToStandardPosition(k)).join(' #')}。 c = {w.join('')} 換成第一課座標是 {std.join('')}，
          {isCodeword74(std) === inCyclicCode(w) ? ' 兩邊判斷一致 ✓' : ' 判斷不一致 ✗'}：同一組 7 個非零欄，只差排列 → 等價碼 [7,4,3]。
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A10 Syndrome in GF(8)                                              */
/* ------------------------------------------------------------------ */

const DERIVE_LINES = [
  { label: '接收字', tex: 'r(x) = c(x) + e(x)' },
  { label: '代入 α', tex: 'S_1 = r(\\alpha) = \\underbrace{c(\\alpha)}_{0\\ (\\text{A5, A9})} + e(\\alpha) = e(\\alpha)' },
  { label: '單一錯誤', tex: 'e(x) = x^i \\Rightarrow S_1 = \\alpha^i' },
  { label: '取對數', tex: 'i = \\log_\\alpha S_1,\\quad \\text{位置} = 7 - i\\quad(\\alpha^0,\\dots,\\alpha^6 \\text{ 兩兩相異，A4})' },
  { label: '下一步（第二課 2-6～2-8）', tex: '\\sigma(z) = 1 + S_1 z \\;\\to\\; \\text{Chien Search 找根} \\;\\to\\; \\text{XOR 更正}' },
];

function DeriveSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-5">
      <StepLines s={s} lines={DERIVE_LINES} />
      {s.step >= 4 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xl text-slate-700">
          同一個 Syndrome 的三種寫法：<M>{'s = Hr^T'}</M>（第一課）、<M>{'S(x) = r(x) \\bmod g(x)'}</M>（第二課）、<M>{'S_1 = r(\\alpha)'}</M>（這一章）。
        </motion.p>
      )}
    </div>
  );
}

const L2_CODE = codewordsL2();

function SyndromeExampleSlide({ s }: { s: Stepper }) {
  const [pos, setPos] = useState(2); // x⁵
  const c = L2_CODE[9].c; // u = 1001 → 1001110
  const e = errorVector(pos ? [pos] : []);
  const r = vecAdd(c, e);
  const S1 = wordAtAlpha(r);
  const i = S1 ? LOG[S1] : -1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-8">
        <div>
          <div className="mb-1 text-base font-semibold text-slate-500">Codeword c</div>
          <BitStrip bits={c} size="md" groups={false} showPos={false} />
        </div>
        <div>
          <div className="mb-1 text-base font-semibold text-slate-500">接收 r</div>
          <BitStrip bits={r} size="md" groups={false} showPos={false} states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={(k) => setPos(pos === k + 1 ? 0 : k + 1)} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        {s.step >= 1 && <AlphaCheck word={r} name="r" large />}
        {s.step >= 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 rounded-2xl border-2 border-slate-200 p-4 text-xl">
            <div className="font-semibold text-slate-800">由 S₁ 找位置</div>
            {S1 === 0 ? (
              <p>S₁ = 0：沒有發現錯誤。</p>
            ) : (
              <>
                <div>
                  <M>{`S_1 = ${gf8PolyTex(S1)} = \\alpha^{${i}}`}</M>（{gf8Bits(S1)}）
                </div>
                <div>
                  ⇒ <M>{`i = ${i}`}</M>：錯在 <M>{`x^{${i}}`}</M> = 從左數第 {7 - i} 個 bit
                </div>
                <div className="rounded-lg bg-rose-50 p-2 text-lg text-rose-900">{gf8Bits(S1)} 不是「第 {parseInt(gf8Bits(S1), 2)} 個位置」：要先取對數。</div>
                <div className="text-lg text-slate-600">
                  也等於 r(x) mod g(x) 的餘數 {syndromeL2(r).join('')} {bitsToField(syndromeL2(r)) === S1 ? '✓' : '✗'}
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Summary: one message through the whole chapter                     */
/* ------------------------------------------------------------------ */

function JourneySlide({ s }: { s: Stepper }) {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const pos = 2;
  const c = encodeCyclic(u).codeword;
  const r = vecAdd(c, errorVector([pos]));
  const S1 = wordAtAlpha(r);
  const root = chienSearch(errorLocator(S1)).find((x) => x.isRoot);
  const g = MP.binary!;
  const rows: { title: string; body: ReactNode }[] = [
    { title: 'GF(2)（A1）', body: <>所有位元運算都 mod 2：<M>{'1 + 1 = 0'}</M></> },
    { title: '建構 GF(8)（A3）', body: <>取不可約的 <M>{'p(x) = x^3+x+1'}</M>，<M>{'\\alpha^3 = \\alpha + 1'}</M></> },
    { title: '最小多項式（A8）', body: <><M>{`(x+\\alpha)(x+\\alpha^2)(x+\\alpha^4) = ${polyToTex(g)} = g(x)`}</M></> },
    { title: '系統式編碼（A5）', body: <>u = {u.join('')} → <span className="mono font-bold">c = {c.join('')}</span></> },
    { title: 'Codeword 檢查（A9）', body: <><M>{'c(\\alpha) = 0'}</M> ⇔ <M>{`H_{\\text{cyc}}c^T = (${matVec(HC, c).join(',')})^T`}</M></> },
    { title: '通道錯誤', body: <>錯在 <M>{`x^{${7 - pos}}`}</M>：r = <span className="mono">{r.join('')}</span></> },
    { title: 'Syndrome（A10）', body: <><M>{`S_1 = r(\\alpha) = \\alpha^{${LOG[S1]}}`}</M>（{gf8Bits(S1)}）</> },
    { title: 'Chien Search（第二課）', body: <><M>{`\\sigma(z) = 1 + \\alpha^{${LOG[S1]}}z`}</M>，根 <M>{`z = \\alpha^{${root?.j}}`}</M> → 錯在 <M>{`x^{${root?.exponent}}`}</M> → 翻回來</> },
  ];
  return (
    <div className="space-y-4">
      <MessagePicker u={u} onChange={setU} size="md" />
      <ol className="grid grid-cols-1 gap-x-8 gap-y-2 lg:grid-cols-2">
        {rows.slice(0, s.step + 1).map((row, k) => (
          <motion.li key={k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3 text-xl">
            <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-overall-600 text-sm font-bold text-white">{k + 1}</span>
            <div className="min-w-0">
              <div className="text-base font-semibold text-slate-500">{row.title}</div>
              <div>{row.body}</div>
            </div>
          </motion.li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deck                                                               */
/* ------------------------------------------------------------------ */

const SLIDES: DeckSlide<Ctx>[] = [
  { title: '代數章 — 用多項式與 GF(8) 看 Hamming Code', sub: '代數章報告：A0–A10', steps: () => 1, render: () => <TitleSlide /> },
  { title: 'A0 為什麼需要抽象代數？', sub: '不是另一種 code，是同一個 Hamming Code 的另一種看法', steps: () => 3, render: (s) => <WhySlide s={s} /> },
  { title: 'A1 GF(2)：1 + 1 = 0', sub: '加法 = XOR、乘法 = AND、特徵 = 2', steps: () => 4, render: (s) => <GF2Slide s={s} /> },
  { title: 'A1 Hcᵀ = 0 就是 GF(2) 線性代數', sub: '每一列：整數相加，再取 mod 2', steps: () => 5, render: (s) => <HcSlide s={s} /> },
  { title: 'A2 H 的 7 個欄 = GF(8) 的 7 個非零元素', sub: '把 3 位元向量當成可以相乘、相除的數', steps: () => 8, render: (s) => <ColumnsSlide s={s} /> },
  { title: 'A2 GF(8) 不是整數 mod 8', sub: 'ℤ/8 有零因子：2 · 4 = 0', steps: () => 2, render: (s) => <Z8Slide s={s} /> },
  { title: 'A3 建構 GF(8)：不可約多項式', sub: 'GF(2)[x]/(p(x))：只留下除以 p(x) 的餘數', steps: () => 3, render: (s) => <QuotientSlide s={s} /> },
  { title: 'A3 GF(8) 乘法：遇到 α³ 就換成 α + 1', sub: '(α² + α)(α + 1) = 1', steps: () => MUL_LINES.length, render: (s) => <MulSlide s={s} /> },
  { title: 'A4 α 的循環：α⁷ = 1', sub: '每次乘上 α，走遍 7 個非零元素再回到 1', steps: () => 8, render: (s) => <CycleSlide s={s} /> },
  { title: 'A5 生成多項式：c(x) = m(x)g(x)', sub: 'm = 1011，g = 1011：分配律 → 同類項 → mod 2', steps: () => P5 + 2, render: (s) => <PolyMulSlide s={s} /> },
  { title: 'A5 G_cyc 的四列 = x³g, x²g, xg, g', sub: 'mG_cyc 和 m(x)g(x) 是同一個計算', steps: () => 3, render: (s) => <GcycSlide s={s} /> },
  { title: 'A6 循環位移 = 乘以 x', sub: '在 R₇ = GF(2)[x]/(x⁷ − 1) 中 x⁷ ≡ 1，最左邊繞回最右邊', steps: () => 8, render: (s) => <ShiftSlide s={s} /> },
  { title: 'A6 理想：C 吸收 R₇ 的乘法', sub: '任意 a(x) × codeword 仍是 codeword ⇒ C = ⟨g(x)⟩', steps: () => 3, render: (s) => <IdealSlide s={s} /> },
  { title: 'A7 Frobenius：(a + b)² = a² + b²', sub: '特徵 2 的「新生的夢」：φ(a) = a² 是 GF(8) 的自同構', steps: () => 3, render: (s) => <FrobSlide s={s} /> },
  { title: 'A7 Cyclotomic Cosets：一個根帶出共軛根', sub: 'i → 2i mod 7；c(α) = 0 ⇒ c(α²) = c(α⁴) = 0', steps: () => cosetOrbit(1).length + 1, render: (s) => <CosetSlide s={s} /> },
  { title: 'A8 最小多項式：把共軛根乘起來', sub: '(x + α)(x + α²)(x + α⁴) = x³ + x + 1', steps: () => 4, render: (s) => <MinPolySlide s={s} /> },
  { title: 'A8 x⁷ − 1 = (x + 1)(x³ + x + 1)(x³ + x² + 1)', sub: '三個陪集 → 三個最小多項式', steps: () => 3, render: (s) => <FactorSlide s={s} /> },
  { title: 'A9 用 GF(8) 推導 H 矩陣', sub: '一條 GF(8) 方程 = 三條 GF(2) 方程', steps: () => 8, render: (s) => <BuildHSlide s={s} /> },
  { title: 'A9 c(α) = 0 ⇔ H_cyc cᵀ = 0', sub: '換任何 c，兩種算法都一致', steps: () => 3, render: (s) => <CompareSlide s={s} /> },
  { title: 'A10 Syndrome 的 GF(8) 觀點', sub: 'S₁ = r(α) = e(α) = αⁱ', steps: () => DERIVE_LINES.length, render: (s) => <DeriveSlide s={s} /> },
  { title: 'A10 例子：c = 1001110 錯一個位元', sub: 'S₁ = r(α) = αⁱ ⇒ 錯在從左數第 7 − i 個 bit', steps: () => 3, render: (s) => <SyndromeExampleSlide s={s} /> },
  { title: '總結：一個訊息走完整章', sub: 'u → c → r → S₁ → σ(z) → 更正', steps: () => 8, render: (s) => <JourneySlide s={s} /> },
];

export default function PresentationAlgebra() {
  return <Deck slides={SLIDES} ctx={null} label="代數章報告" exitHref="#/a-0" />;
}
