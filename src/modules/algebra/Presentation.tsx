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
  alphaMultiplierXors,
  alphaPolyTex,
  alphaPow,
  bchRedundancy,
  bitsToField,
  blockFailureProb,
  characteristic,
  checkFieldAxioms,
  chienSearch,
  codewords74,
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
  gfMultiplierNetlist,
  gfPolyEval,
  gfPolyTex,
  hFromGF8,
  hammingEncoderXors,
  hammingK,
  hammingN,
  inCyclicCode,
  intToBits,
  irreduciblePolys,
  isCodeword74,
  isIrreducible,
  lfsrCost,
  lfsrEncoderClocks,
  maskDegree,
  matVec,
  minimalPolynomial,
  msbToMask,
  msbToTex,
  mulModXn1,
  orderOfX,
  polyMulTrace,
  polyQuot,
  polyToMsb,
  polyToTex,
  polysOfDegree,
  quotientRing,
  rotateLeft,
  syndromeClocks,
  syndromeL2,
  syndromeTableEntries,
  vecAdd,
  vecMat,
  wordAtAlpha,
  wordAtAlphaPower,
  xn1,
  xorNetworkGates,
  zmod,
} from '../../core';
import { gfAdderXors, nonInvertible } from '../../core/engineering-g1';
import { minIrreducibleWeight } from '../../core/engineering-g2';
import { bchRootBudget, cyclicCodeMenu, maskMul, squarerXors } from '../../core/engineering-g4';
import { G127_MSB, cyclicShiftEscapes, doubleErrorStats, hornerCost, logTableEntries, sciParts } from '../../core/engineering-g5';
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

/* plain-text (Unicode) forms for the speaker notes, written the way the speaking script writes them */
const SUPS: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => [...String(n)].map((ch) => SUPS[ch]).join('');
const xMono = (e: number) => (e === 0 ? '1' : e === 1 ? 'x' : `x${sup(e)}`);
/** MSB-first bits as "x⁶ + x⁴ + x³" */
const polyText = (bits: readonly number[]) => bits.flatMap((b, i) => (b ? [xMono(bits.length - 1 - i)] : [])).join(' + ') || '0';
/** integer column counts (MSB-first) as "x⁶ + 2x⁴ + 2x³ + …" */
const countsText = (counts: readonly number[]) =>
  counts
    .flatMap((c, i) => {
      const e = counts.length - 1 - i;
      return c === 0 ? [] : [c === 1 ? xMono(e) : `${c}${e === 0 ? '' : xMono(e)}`];
    })
    .join(' + ');
/** a GF(8) element as "α² + α + 1" */
const gf8Text = (v: number) => [v & 4 ? 'α²' : '', v & 2 ? 'α' : '', v & 1 ? '1' : ''].filter(Boolean).join(' + ') || '0';
/** a probability as "2.1×10⁻⁵" */
const sciText = (x: number) => {
  const { mantissa, exponent } = sciParts(x);
  return `${mantissa}×10${sup(exponent)}`;
};
const num = (x: number) => x.toLocaleString('en-US');
const hamName = (m: number) => `Hamming(${hammingN(m)},${hammingK(m)})`;

/* engineering figures the slides and the notes quote (all computed, none typed in) */
const P_MASK = 0b1011; // p(x) = x³ + x + 1, which is also g(x)
const M3 = maskDegree(P_MASK); // bits per GF(8) element = register stages
const CODE_N = hammingN(M3);
const CODE_K = hammingK(M3);
const ENC = lfsrCost(G_MSB); // encoder / divider LFSR of g(x) = x³ + x + 1
const CLK = lfsrEncoderClocks(CODE_N, CODE_K);
const M127 = G127_MSB.length - 1;
const ENC127 = lfsrCost(G127_MSB); // x⁷ + x³ + 1 for Hamming(127,120)
const GF_MUL = gfMultiplierNetlist(M3, P_MASK);
const HORNER = hornerCost(P_MASK);
const T_HAM = 1; // errors a Hamming Code corrects
const P_BIT = 1e-3;
const P_BIT_TEXT = `10${sup(Math.round(Math.log10(P_BIT)))}`;
const BCH_A = { m: 7, t: 2 };
const BCH_B = { m: 8, t: 3 };
const bchName = ({ m, t }: { m: number; t: number }) => `BCH(${hammingN(m)},${hammingN(m) - bchRedundancy(m, t)})`;

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
    ['A3', '建構 GF(8)：irreducible polynomial，α³ = α + 1'],
    ['A4', 'α 的循環：α⁷ = 1，指數 = 位置'],
    ['A5', 'Generator polynomial：c(x) = m(x)g(x)'],
    ['A6', 'Cyclic shift = 乘以 x，C 是 R₇ 的 ideal'],
    ['A7', 'Frobenius：一個根帶出 α²、α⁴'],
    ['A8', 'Minimal polynomial：(x+α)(x+α²)(x+α⁴) = x³+x+1'],
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
    { tag: '第一課', name: 'GF(2) 線性代數', lines: ['c = mG', `Hc^T = 0\\ \\ (${H74.length} \\text{ 條方程})`], tone: 'border-data-300 bg-data-50' },
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
            ① 更省的 encoder（編碼器）：{GC.length}×{GC[0].length} 的 G → 一個 <M>{`g(x) = ${msbToTex(G_MSB)}`}</M> → {ENC.flipFlops} 個 register（暫存器）的 LFSR（linear feedback shift register，線性回授移位暫存器）。
          </li>
          <li>
            ② 更聰明的 decoder（解碼器）：syndrome（徵狀）變成一個數 <M>{'S_1 = r(\\alpha) = \\alpha^i'}</M>，錯誤位置就是指數。
          </li>
          {s.step >= 2 && <li>③ 可以推廣：多選幾組 conjugate roots（共軛根）→ BCH code，一次修好幾個錯。</li>}
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
  const fieldAxioms = checkFieldAxioms(GF2);
  const axiomsOk = fieldAxioms.every((x) => x.holds);
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
        <div className="text-lg font-semibold text-slate-700">Characteristic：把 1 一直加</div>
        {['1', '1 + 1', '1 + 1 + 1'].slice(0, Math.min(s.step, 2) + 1).map((l, i) => (
          <motion.div key={l} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} className={`rounded-xl px-4 py-2 text-2xl ${i === 1 ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50'}`}>
            <Tex>{`${l} = ${(i + 1) % 2}`}</Tex>
            {i === 1 && <span className="ml-2 text-base">← 第一次回到 0</span>}
          </motion.div>
        ))}
        {s.step >= 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 rounded-xl border-2 border-emerald-300 p-4 text-xl">
            <div>
              characteristic = {characteristic(GF2)}：<M>{'-1 = 1'}</M>，所以 <M>{'a - b = a + b'}</M>
            </div>
            <div className="text-lg text-emerald-800">{axiomsOk ? `✓ ${fieldAxioms.length} 條 field axioms（體的公理）全部成立：GF(2) 是 field（體）` : '✗ field axioms（體的公理）沒有全部成立'}</div>
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
        <p className="text-lg text-slate-600">{flip === null ? '右邊是編好的 codeword（碼字）c，沒有錯誤。' : `右邊的字第 ${flip + 1} 個位元被翻轉（紅色）。`}</p>
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
        {s.step >= 4 && <p className="text-lg text-slate-600">拿掉 mod 2 就會出現 {EVEN_SUMS.join('、')}：「= 0」就不再代表 parity check（同位檢查）通過。</p>}
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
            <p>
              GF(2) 觀點：H 有 {H74[0].length} 個不同的非零 {H74.length} 位元向量——只能相加，不能相乘。
            </p>
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
        {/* add-inv carries the deck's gloss of inverse; zero divisor is glossed in this slide's sub */}
        <Checks title={`${S.name} 是 field 嗎？`} items={axioms.map((x) => ({ label: x.key === 'add-inv' ? x.zh : x.plain, pass: x.holds, detail: x.counterexample }))} />
        <p className="text-lg text-slate-600">綠色 = 乘積為 1（有 inverse）；紅色 = 兩個非零元素相乘得 0（zero divisor）。</p>
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
        <div className={`rounded-xl p-3 font-semibold ${irr ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{irr ? 'Irreducible ✓：quotient ring（商環）是 field' : 'Reducible（可約）✗：有根，出現 zero divisor'}</div>
        <Checks items={axioms.map((x) => ({ label: x.plain, pass: x.holds, detail: x.counterexample }))} />
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
  { label: 'Distributivity 展開（先不合併）', tex: MUL.terms.map(powTex).join(' + ') },
  { label: '同類項合併（係數 mod 2）', tex: `= ${alphaPolyTex(MUL.raw)}` },
  ...MUL.reductions.map((r) => ({
    label: `化簡 α${SUP[r.power]}`,
    tex: `${r.power === 4 ? '\\alpha^4 = \\alpha\\cdot\\alpha^3 = \\alpha^2 + \\alpha' : '\\alpha^3 = \\alpha + 1'}\\;\\Rightarrow\\; ${alphaPolyTex(r.before)} = ${alphaPolyTex(r.after)}`,
  })),
  { label: '結果：兩者互為 inverse', tex: `= ${gf8PolyTex(MUL.result)}\\quad [${gf8Bits(MUL.result)}]` },
];

function MulSlide({ s }: { s: Stepper }) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
      <StepLines s={s} lines={MUL_LINES} />
      <div className="space-y-3 rounded-2xl border-2 border-slate-200 p-5 text-xl">
        <div className="font-semibold text-slate-800">x³ ≡ x + 1：LFSR 的 feedback（回授）規則從這裡來</div>
        <Tex block>{'\\alpha^4 = \\alpha\\cdot\\alpha^3 = \\alpha^2 + \\alpha'}</Tex>
        <Tex block>{'\\alpha^5 = \\alpha\\cdot\\alpha^4 = \\alpha^3 + \\alpha^2 = \\alpha^2 + \\alpha + 1'}</Tex>
        <p className="text-lg text-slate-600">每次乘上 α 就是左移；溢出 α³ 時換成 α + 1——第二課的 {ENC.flipFlops} 個 register 做的正是這件事。</p>
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
          <p>從 1 出發，每次乘上 α：位元左移，溢出 α³ 時用 α³ = α + 1 做 feedback。</p>
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
                左移後出現 α³，經 feedback：<M>{`${alphaPolyTex(prev << 1)} \\to ${gf8PolyTex(cur)}`}</M>
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
              <M>{`\\alpha^{${PERIOD}} = 1`}</M>：{PERIOD} 步走遍全部 {2 ** M3 - 1} 個非零元素，α 是 <strong>primitive element（本原元素）</strong>。
            </div>
            <div>
              乘法變成指數相加 <M>{'\\alpha^i \\cdot \\alpha^j = \\alpha^{i+j}'}</M>；{PERIOD} 個次方對上 code length（碼長）<M>{`n = 2^{${M3}} - 1 = ${CODE_N}`}</M> 的 {CODE_N} 個位置。
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
const C5 = encodeNonSystematic(M5); // m(x)g(x) = 1000101
/** the rows of G_cyc that m = 1011 selects (1-based): the same rows as the partial products */
const SEL5 = M5.flatMap((b, i) => (b ? [i + 1] : []));
/** the last row of G_cyc is g itself (0001011); its cyclic shifts */
const G_ROW = GC[GC.length - 1];
const ORBIT = Array.from({ length: CODE_N }, (_, j) => rotateLeft(G_ROW, j));
const ORBIT_LEN = Array.from({ length: CODE_N }, (_, j) => j + 1).find((j) => rotateLeft(G_ROW, j % CODE_N).join('') === G_ROW.join('')) ?? CODE_N;

function PolyMulSlide({ s }: { s: Stepper }) {
  const stage = s.step >= P5 + 1 ? 3 : s.step >= P5 ? 2 : s.step >= P5 - 1 ? 1 : 0;
  const sameAsMatrix = vecMat(M5, GC).join('') === C5.join('');
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <PolyMulTable t={T5} revealed={s.step + 1} aName="g(x)" bName="m(x)" large />
      <div className="space-y-4">
        <div className="text-2xl">
          <PolyMulTex t={T5} stage={stage} />
        </div>
        {s.step >= P5 + 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1 rounded-xl border-2 border-emerald-300 bg-emerald-50 p-4 text-xl text-emerald-900">
            <div>
              c = <span className="mono font-bold">{C5.join('')}</span>：是 g(x) 的倍數，所以 <M>{'c(\\alpha) = 0'}</M>
              {wordAtAlpha(C5) === 0 ? ' ✓' : ' ✗'}。編碼只做乘法，<strong>不取餘數</strong>。
            </div>
            <div>
              = <M>{'G_{\\text{cyc}}'}</M> 第 {SEL5.join('、')} 列相加 {sameAsMatrix ? '✓' : '✗'}（m = {M5.join('')} 選中的列）
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/** The encoder LFSR drawn from g's coefficients: a 1 at x^j (0 < j < deg g) is a feedback XOR, x^deg is where the message enters. */
function EncoderWiring() {
  const deg = G_MSB.length - 1;
  const coef = (j: number) => G_MSB[deg - j]; // coefficient of x^j
  const tapX = (j: number) => 30 + j * 110;
  const regL = (j: number) => tapX(j) + 22;
  const REG_W = 56;
  const Y = 80;
  const BUS = 40;
  const R = 9;
  const inX = tapX(deg);
  const wire = '#475569';
  const fb = '#7638dc';
  const xor = (x: number, key: string) => (
    <g key={key}>
      <circle cx={x} cy={Y} r={R} fill="#fff" stroke={fb} strokeWidth={2} />
      <path d={`M${x - R + 3} ${Y} H${x + R - 3} M${x} ${Y - R + 3} V${Y + R - 3}`} stroke={fb} strokeWidth={2} />
    </g>
  );
  return (
    <svg viewBox={`0 0 ${inX + 40} 138`} className="mx-auto w-full max-w-[350px]" role="img" aria-label="由 g(x) 的係數接成的 encoder LFSR">
      <defs>
        <marker id="deck-lfsr-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={wire} />
        </marker>
        <marker id="deck-lfsr-fb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={fb} />
        </marker>
      </defs>
      {/* coefficients of g, one per tap */}
      {Array.from({ length: deg + 1 }, (_, j) => (
        <g key={`c${j}`}>
          <text x={tapX(j)} y={12} textAnchor="middle" fontSize={12} fill="#64748b">
            {`x${sup(j)}`}
          </text>
          <text x={tapX(j)} y={29} textAnchor="middle" fontSize={15} fontWeight={700} fontFamily="ui-monospace, monospace" fill={coef(j) ? fb : '#cbd5e1'}>
            {coef(j)}
          </text>
        </g>
      ))}
      {/* feedback bus: from the input XOR back over the top, into the first stage */}
      <path d={`M${inX} ${Y - R} V${BUS} H${tapX(0)} V${Y} H${regL(0)}`} fill="none" stroke={fb} strokeWidth={2} markerEnd="url(#deck-lfsr-fb)" />
      {Array.from({ length: deg - 1 }, (_, k) => k + 1)
        .filter((j) => coef(j))
        .map((j) => (
          <line key={`d${j}`} x1={tapX(j)} y1={BUS} x2={tapX(j)} y2={Y - R} stroke={fb} strokeWidth={2} markerEnd="url(#deck-lfsr-fb)" />
        ))}
      {/* stages and the wires between them */}
      {Array.from({ length: deg }, (_, j) => {
        const next = j + 1;
        const right = regL(j) + REG_W;
        const tapped = next < deg && coef(next) === 1;
        return (
          <g key={`r${j}`}>
            <rect x={regL(j)} y={Y - 18} width={REG_W} height={36} rx={6} fill="#f8fafc" stroke="#334155" strokeWidth={1.5} />
            <text x={regL(j) + REG_W / 2} y={Y + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill="#334155">
              {`r${'₀₁₂₃₄₅₆₇'[j]}`}
            </text>
            {next === deg ? (
              <line x1={right} y1={Y} x2={inX - R} y2={Y} stroke={wire} strokeWidth={2} markerEnd="url(#deck-lfsr-arr)" />
            ) : tapped ? (
              <>
                <line x1={right} y1={Y} x2={tapX(next) - R} y2={Y} stroke={wire} strokeWidth={2} markerEnd="url(#deck-lfsr-arr)" />
                <line x1={tapX(next) + R} y1={Y} x2={regL(next)} y2={Y} stroke={wire} strokeWidth={2} markerEnd="url(#deck-lfsr-arr)" />
              </>
            ) : (
              <line x1={right} y1={Y} x2={regL(next)} y2={Y} stroke={wire} strokeWidth={2} markerEnd="url(#deck-lfsr-arr)" />
            )}
          </g>
        );
      })}
      {Array.from({ length: deg - 1 }, (_, k) => k + 1)
        .filter((j) => coef(j))
        .map((j) => xor(tapX(j), `x${j}`))}
      {xor(inX, 'in')}
      {/* the message enters at the top tap */}
      <line x1={inX} y1={134} x2={inX} y2={Y + R} stroke={wire} strokeWidth={2} markerEnd="url(#deck-lfsr-arr)" />
      <text x={inX - 8} y={128} textAnchor="end" fontSize={12} fill="#64748b">
        data bit
      </text>
    </svg>
  );
}

function GcycSlide({ s }: { s: Stepper }) {
  // step ≥ 1: mark where g's coefficients sit in each row — every row is the same four numbers, shifted
  const band = (i: number, j: number, v: Bit) => (s.step >= 1 && j >= i && j < i + G_MSB.length ? (v ? 'bg-overall-100 text-overall-700' : 'bg-overall-50 text-overall-300') : undefined);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          <div style={{ zoom: 1.3 }}>
            <MatrixView matrix={GC} name={<M>{'G_{\\text{cyc}} ='}</M>} colLabels={EXP_LABELS} cellClass={band} />
          </div>
          {s.step >= 1 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border-2 border-overall-300 bg-overall-50 px-3 py-2 text-lg text-overall-700">
              {GC.length}×{GC[0].length} = {GC.length * GC[0].length} 個數字 → 只要 g 的 {G_MSB.length} 個係數 <span className="mono font-bold">{G_MSB.join('')}</span>
            </motion.div>
          )}
        </div>
        <div className="space-y-1 text-lg">
          <div className="pb-1 text-2xl">
            <M>{`g(x) = ${msbToTex(G_MSB)}`}</M> <span className="mono text-xl text-slate-500">[{G_MSB.join('')}]</span>
            <span className="ml-2 text-lg text-slate-600">次數 = n − k = {CODE_N - CODE_K}</span>
          </div>
          {GC.map((row, i) => (
            <div key={i}>
              第 {i + 1} 列 <span className="mono">{row.join('')}</span> = <M>{`${['x^3g(x)', 'x^2g(x)', 'x\\cdot g(x)', 'g(x)'][i]} = ${msbToTex(row)}`}</M>
            </div>
          ))}
          {s.step >= 2 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="!mt-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-3 py-2 text-emerald-900">
              <div className="text-base">都是 g 的倍數：cyclic shift（循環位移）後還是 codeword，位移 {ORBIT_LEN} 次回到原點</div>
              <div className="font-mono text-lg">
                {ORBIT.slice(0, 3).map((w, j) => (
                  <span key={j}>
                    {j > 0 && ' → '}
                    {w.join('')}
                    <span className="text-emerald-600">{inCyclicCode(w) ? '✓' : '✗'}</span>
                  </span>
                ))}{' '}
                → …
              </div>
            </motion.div>
          )}
        </div>
      </div>
      {s.step >= 3 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 items-center gap-6 rounded-2xl border-2 border-slate-200 px-4 py-2 lg:grid-cols-[350px_minmax(0,1fr)]">
          <EncoderWiring />
          <div className="space-y-1">
            <table className="w-full whitespace-nowrap text-lg">
              <thead>
                <tr className="text-base text-slate-500">
                  <th className="pr-3 text-left font-semibold" />
                  <th className="pr-3 text-left font-semibold">矩陣 encoder</th>
                  <th className="text-left font-semibold">LFSR</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-slate-100">
                  <td className="py-1 pr-3 text-base text-slate-600">{hamName(M3)}</td>
                  <td className="pr-3">{hammingEncoderXors(M3)} 個 XOR 閘</td>
                  <td>
                    {ENC.flipFlops} 個 register + {ENC.xors} 個 XOR 閘
                  </td>
                </tr>
                <tr className="border-t border-slate-100">
                  <td className="py-1 pr-3 text-base text-slate-600">{hamName(M127)}</td>
                  <td className="pr-3 font-semibold text-rose-700">{hammingEncoderXors(M127)} 個 XOR 閘</td>
                  <td className="font-semibold text-emerald-700">
                    {ENC127.flipFlops} 個 register + {ENC127.xors} 個 XOR 閘
                  </td>
                </tr>
              </tbody>
            </table>
            <div className="text-lg text-slate-700">
              一個時脈一個位元：{CLK.message} + {CLK.parityOut} = {CLK.total} 個時脈
            </div>
          </div>
        </motion.div>
      )}
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
            線性 = 對加法滿足 closure（封閉性），循環 = 對乘 x 滿足 closure ⇒ C 是 <M>{'R_7'}</M> 的 <strong>ideal（理想）</strong><M>{'\\langle g(x) \\rangle'}</M>。
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
        {k >= 7 && <p className="pt-1 text-lg text-slate-600">位移 {ORBIT_LEN} 次回到起點。</p>}
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
        <div className="text-lg font-semibold text-slate-600">a(x)：ring R₇ 中任意一個元素</div>
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
          <div className="mb-1 font-semibold">Ideal I ⊂ R₇</div>
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
  { label: 'Characteristic 2：任何元素加兩次都是 0', tex: '2ab = ab + ab = 0' },
  { label: 'Freshman’s dream', tex: '(a+b)^2 = a^2 + b^2,\\quad \\varphi(a) = a^2 \\text{ 保持加法與乘法}' },
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
            title="Frobenius 是 automorphism（窮舉 64 組）"
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
              Cyclotomic cosets：{cyclotomicCosets().map((cs) => `{${cs.join(', ')}}`).join('、')}
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
            每個係數都化簡成 0 或 1：<M>{`m_\\alpha(x) = ${polyToTex(MP.binary!)}`}</M>，正是 Hamming code 的 g(x)。
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
              { label: '每個 conjugate 都是根', pass: MP.rootsOk },
              { label: `次數 = coset 大小 = ${MP.coset.length}，k = ${CODE_N} − ${MP.coset.length} = ${CODE_N - MP.coset.length}`, pass: MP.poly.length - 1 === MP.coset.length },
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
        <Tex block>{`c(\\alpha) = \\sum_{i=0}^{6} c_i\\,\\alpha^i = \\underbrace{\\big[\\,\\alpha^6\\ \\alpha^5\\ \\alpha^4\\ \\alpha^3\\ \\alpha^2\\ \\alpha\\ 1\\,\\big]}_{\\text{每一項寫成 ${HC.length} 位元直行}}\\begin{bmatrix}c_6\\\\ \\vdots\\\\ c_0\\end{bmatrix} = H_{\\text{cyc}}\\,c^T`}</Tex>
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
            <p>從最左欄（x⁶ 的位置，對應 α⁶）開始：每一欄就是 αⁱ 的 {HC.length} 位元座標。</p>
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
          和第一課對照：cyclic code（循環碼）的位置 x⁶…1 對到第一課的 #{COL_LABELS.map((_, k) => cyclicIndexToStandardPosition(k)).join(' #')}。 c = {w.join('')} 換成第一課座標是 {std.join('')}，
          {isCodeword74(std) === inCyclicCode(w) ? ' 兩邊判斷一致 ✓' : ' 判斷不一致 ✗'}：同一組 {HC[0].length} 個非零欄，只差排列 → equivalent code（等價碼）[{CODE_N},{OPT_HAM.k},{OPT_HAM.dmin}]。
        </motion.div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A10 Syndrome in GF(8)                                              */
/* ------------------------------------------------------------------ */

const DERIVE_LINES = [
  { label: 'Received word', tex: 'r(x) = c(x) + e(x)' },
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
          同一個 syndrome 的三種寫法：<M>{'s = Hr^T'}</M>（第一課）、<M>{'S(x) = r(x) \\bmod g(x)'}</M>（第二課）、<M>{'S_1 = r(\\alpha)'}</M>（這一章）。
        </motion.p>
      )}
    </div>
  );
}

const L2_CODE = codewordsL2();
/** the example the slide opens with (and the notes describe): u = 1001 → c = 1001110, the bit at x⁵ flipped */
const EX_C = L2_CODE[9].c;
const EX_POS = 2;
const EX_R = vecAdd(EX_C, errorVector([EX_POS]));
const EX_S1 = wordAtAlpha(EX_R);
const EX_I = LOG[EX_S1];
const DOUBLE = doubleErrorStats();

function SyndromeExampleSlide({ s }: { s: Stepper }) {
  const [pos, setPos] = useState(EX_POS); // x⁵
  const c = EX_C;
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

/** the default run of the summary slide, for the notes */
const J_POS = 2;
const J_C = encodeCyclic(DEFAULT_U).codeword;
const J_R = vecAdd(J_C, errorVector([J_POS]));
const J_S1 = wordAtAlpha(J_R);
const J_ROOT = chienSearch(errorLocator(J_S1)).find((x) => x.isRoot);

function JourneySlide({ s }: { s: Stepper }) {
  const [u, setU] = useState<Bit[]>([...DEFAULT_U]);
  const pos = J_POS;
  const c = encodeCyclic(u).codeword;
  const r = vecAdd(c, errorVector([pos]));
  const S1 = wordAtAlpha(r);
  const root = chienSearch(errorLocator(S1)).find((x) => x.isRoot);
  const g = MP.binary!;
  const rows: { title: string; body: ReactNode }[] = [
    { title: 'GF(2)（A1）', body: <>所有位元運算都 mod 2：<M>{'1 + 1 = 0'}</M></> },
    { title: '建構 GF(8)（A3）', body: <>取 irreducible 的 <M>{'p(x) = x^3+x+1'}</M>，<M>{'\\alpha^3 = \\alpha + 1'}</M></> },
    { title: 'Minimal polynomial（A8）', body: <><M>{`(x+\\alpha)(x+\\alpha^2)(x+\\alpha^4) = ${polyToTex(g)} = g(x)`}</M></> },
    { title: 'Systematic encoding（系統式編碼，A5）', body: <>u = {u.join('')} → <span className="mono font-bold">c = {c.join('')}</span></> },
    { title: 'Codeword 檢查（A9）', body: <><M>{'c(\\alpha) = 0'}</M> ⇔ <M>{`H_{\\text{cyc}}c^T = (${matVec(HC, c).join(',')})^T`}</M></> },
    { title: '通道錯誤', body: <>錯在 <M>{`x^{${7 - pos}}`}</M>：r = <span className="mono">{r.join('')}</span></> },
    { title: 'Syndrome（A10）', body: <><M>{`S_1 = r(\\alpha) = \\alpha^{${LOG[S1]}}`}</M>（{gf8Bits(S1)}）</> },
    { title: 'Chien search（第二課）', body: <><M>{`\\sigma(z) = 1 + \\alpha^{${LOG[S1]}}z`}</M>，根 <M>{`z = \\alpha^{${root?.j}}`}</M> → 錯在 <M>{`x^{${root?.exponent}}`}</M> → 翻回來</> },
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
/* Speaker notes: the speaking script, slide by slide                  */
/* ------------------------------------------------------------------ */

const UL = 'list-disc space-y-1 pl-5';
const SUB = 'mt-0.5 list-[circle] space-y-0.5 pl-5';

/** data bits under parity P₁ (D₁, D₂, D₄) and how many bits their integer sum needs */
const P1_DATA = H74[0].filter((b, j) => b === 1 && ((j + 1) & j) !== 0).length;
const P1_SUM_BITS = Math.ceil(Math.log2(P1_DATA + 1));
const ROW1_W = H74[0].filter((b) => b === 1).length;
/** the non-zero integer sums a row of H can give on a codeword (an even count of 1s) when mod 2 is dropped */
const EVEN_SUMS = Array.from({ length: Math.floor(ROW1_W / 2) }, (_, i) => 2 * (i + 1));
/** bits one GF(2) value takes on a wire */
const GF2_BITS = Math.log2(GF2.elements.length);
/** A4: the multiply-by-α register walking through GF(8) */
const PERIOD = orderOfX(P_MASK);
const WALK = Array.from({ length: PERIOD }, (_, i) => gf8Bits(alphaPow(i)));
const FIRST_WRAP = WALK.findIndex((_, i) => i > 0 && (alphaPow(i - 1) & 4) !== 0);
const P16 = 0b11111; // x⁴ + x³ + x² + x + 1: irreducible but not primitive
/** A7 */
const ORBIT1 = cosetOrbit(1);
const BUD7 = bchRootBudget(M3, T_HAM);
const BUD_B = bchRootBudget(BCH_B.m, BCH_B.t);
/** A8: the three minimal polynomials as masks, and the cyclic codes of length 7 built from them */
const MP_MASKS = ALL_MP.map((m) => msbToMask(toMsb(m.binary!)));
const MP_MIRROR = ALL_MP.find((m) => m.coset.includes(3))!;
const MIRROR = lfsrCost(toMsb(MP_MIRROR.binary!));
const MENU = cyclicCodeMenu(CODE_N);
const menuOf = (g: number) => MENU.find((o) => o.g === g)!;
const OPT_PARITY = menuOf(MP_MASKS[0]);
const OPT_HAM = menuOf(MP_MASKS[1]);
const OPT_ODD = menuOf(maskMul(MP_MASKS[0], MP_MASKS[1]));
const OPT_REP = menuOf(maskMul(MP_MASKS[1], MP_MASKS[2]));
/** A9: Lesson 1's codewords are not closed under cyclic shift */
const L1_CODE = codewords74().map((x) => x.codeword);
const L1_ESCAPES = cyclicShiftEscapes(L1_CODE);

/* ------------------------------------------------------------------ */
/* Deck                                                               */
/* ------------------------------------------------------------------ */

const SLIDES: DeckSlide<Ctx>[] = [
  {
    title: '代數章 — 用多項式與 GF(8) 看 Hamming code',
    sub: '代數章報告：A0–A10',
    steps: () => 1,
    render: () => <TitleSlide />,
    takeaway: <>硬體裡只有位元：代數讓 encoder 變小，decoder 直接算出位置</>,
    notes: (
      <ul className={UL}>
        <li>第一課：用矩陣做出 {hamName(M3)}</li>
        <li>這章的問題：同一個 code，為什麼還要用多項式和 GF(8)？</li>
        <li>
          答案：硬體裡只有位元
          <ul className={SUB}>
            <li>encoder → 幾個 register 就夠</li>
            <li>decoder → 直接「算出」錯誤位置，不用查表</li>
          </ul>
        </li>
        <li>右邊三行 = 整章地圖：編碼 = 多項式乘法、檢查 = c(α) = 0、解碼 = 找根</li>
        <li>左邊是路線：A1 的 GF(2) → A10 的 syndrome</li>
      </ul>
    ),
  },
  {
    title: 'A0 為什麼需要抽象代數？',
    sub: '不是另一種 code（碼），是同一個 Hamming code 的另一種看法',
    steps: () => 3,
    render: (s) => <WhySlide s={s} />,
    takeaway: <>code 一長，矩陣和查表就撐不住；代數讓電路不跟著 code length 膨脹</>,
    notes: (
      <ul className={UL}>
        <li>
          畫面三個階段
          <ul className={SUB}>
            <li>第一課：GF(2) 線性代數，c = mG、三條 Hcᵀ = 0</li>
            <li>代數章：c(x) = m(x)g(x)，只剩一條 c(α) = 0</li>
            <li>第二課：LFSR 編碼、Chien search 解碼</li>
          </ul>
        </li>
        <li>不是另一種 code：和第一課只差座標排列（A9 證明）</li>
        <li>
          code 一長，第一課的做法就撐不住
          <ul className={SUB}>
            <li>
              p = {P_BIT_TEXT} 時一個區塊錯 {T_HAM + 1} 個以上：{hamName(M3)} 約 {sciText(blockFailureProb(CODE_N, T_HAM, P_BIT))} → {hamName(M127)} 約 {sciText(blockFailureProb(hammingN(M127), T_HAM, P_BIT))}
            </li>
            <li>
              查表解碼要存 2ⁿ⁻ᵏ 筆：{hamName(M3)} {num(syndromeTableEntries(CODE_N, CODE_K))} 筆 → {bchName(BCH_A)} {num(syndromeTableEntries(hammingN(BCH_A.m), hammingN(BCH_A.m) - bchRedundancy(BCH_A.m, BCH_A.t)))} 筆 → {bchName(BCH_B)}{' '}
              {num(syndromeTableEntries(hammingN(BCH_B.m), hammingN(BCH_B.m) - bchRedundancy(BCH_B.m, BCH_B.t)))} 筆
            </li>
          </ul>
        </li>
        <li>
          → 代數的好處 ①②
          <ul className={SUB}>
            <li>
              ① encoder 省：{GC.length}×{GC[0].length} 的 G 換成一個 g(x) = {polyText(G_MSB)}，硬體是 {ENC.flipFlops} 個 register 的 LFSR
            </li>
            <li>② decoder 聰明：S₁ = r(α) = αⁱ，位置就是指數，用算的</li>
          </ul>
        </li>
        <li>
          → 好處 ③ 可以推廣：多選幾組根 = BCH code，一次修好幾個錯
          <ul className={SUB}>
            <li>CRC、快閃記憶體的 BCH、CD 和 QR code 的 Reed–Solomon 都靠這套代數</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A1 GF(2)：1 + 1 = 0',
    sub: '加法 = XOR（exclusive OR，互斥或）、乘法 = AND、characteristic（特徵）= 2',
    steps: () => 4,
    render: (s) => <GF2Slide s={s} />,
    takeaway: <>GF(2) 的加法就是 XOR 閘：不進位，每個位元各自算</>,
    notes: (
      <ul className={UL}>
        <li>GF(2) = {'{0, 1}'}：剛好是一條線上的一個位元</li>
        <li>加法 = XOR 閘（相同得 0、不同得 1）；乘法 = AND 閘；減法 = 加法（−1 = 1）</li>
        <li>雜訊翻一個位元 = 加 1；再翻一次，1 + 1 = 0 → 抵銷</li>
        <li>→ 一直加 1：1 + 1 = 0，兩步回到 0 → characteristic = {characteristic(GF2)}</li>
        <li>→ 再加一次回到 1，之後 0、1 輪流</li>
        <li>
          → {checkFieldAxioms(GF2).length} 條 field axioms 全部成立 → GF(2) 是 field
          <ul className={SUB}>
            <li>
              換成整數就會進位：D₁ + D₂ + D₄ = 0～{P1_DATA}，要 {P1_SUM_BITS} 個位元＋進位線
            </li>
            <li>GF(2)：P₁ = D₁ ⊕ D₂ ⊕ D₄ 永遠 {GF2_BITS} 個位元，各位置獨立 → 三個 parity bit 同時算出</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A1 Hcᵀ = 0 就是 GF(2) 線性代數',
    sub: '每一列：整數相加，再取 mod 2',
    steps: () => 5,
    render: (s) => <HcSlide s={s} />,
    takeaway: <>H 的每一列是一棵 XOR 樹，整個檢查器只要 {xorNetworkGates(H74)} 個 XOR 閘</>,
    notes: (
      <ul className={UL}>
        <li>第一課的檢查 Hcᵀ = 0，其實就是 GF(2) 線性代數；右邊是編好的 codeword</li>
        <li>→ H 的每一列 = 一個 parity check，盯 {ROW1_W} 個位置</li>
        <li>
          → 第一列：整數相加再 mod 2 = 一個 {ROW1_W} 輸入的 XOR 樹（{xorNetworkGates([H74[0]])} 個 XOR 閘）
        </li>
        <li>→ 第二列，同樣做法</li>
        <li>
          → 第三列 → 結果是零向量：每列偶數個 1，合法 codeword
          <ul className={SUB}>
            <li>
              整個檢查電路 {xorNetworkGates(H74)} 個 XOR 閘；encoder 也是 XOR 網路，{hammingEncoderXors(M3)} 個
            </li>
            <li>拿掉 mod 2 會算出 {EVEN_SUMS.join('、')} →「= 0」不再代表通過 → 一定要在 GF(2) 裡算</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A2 H 的 7 個欄 = GF(8) 的 7 個非零元素',
    sub: '把 3 位元向量當成可以相乘、相除的數',
    steps: () => 8,
    render: (s) => <ColumnsSlide s={s} />,
    takeaway: <>{M3} 條線上的位元讀成 GF(8) 的數，錯誤位置才能用算的</>,
    notes: (
      <ul className={UL}>
        <li>
          第一課的 H 有 {H74[0].length} 欄 = {H74[0].length} 個不同的非零 {H74.length} 位元向量；在 GF(2) 裡它們只能相加
        </li>
        <li>想「算出」錯誤位置，就要能對位置做乘除（錯不只一個時要解方程）</li>
        <li>
          {M3} 個位元 = {M3} 條線 = {M3} 個 register → 讀成 1、α、α² 的係數，就是 GF(8) 的一個元素
        </li>
        <li>
          → 按 {H74[0].length} 次，一欄一欄亮：第 j 欄 = j 的二進位
          <ul className={SUB}>
            <li>{[1, 2, 3, 4].map((j) => `第 ${j} 欄 = ${gf8Text(j)}`).join('、')}</li>
            <li>{[5, 6, 7].map((j) => `第 ${j} 欄 = ${gf8Text(j)}`).join('、')}</li>
          </ul>
        </li>
        <li>
          最後一步的結論
          <ul className={SUB}>
            <li>
              {CODE_N} 個錯誤位置 ↔ GF(8) 的 {GF8_ELEMENTS.length - 1} 個非零元素
            </li>
            <li>三條 Hcᵀ = 0 → 濃縮成一條 c(α) = 0（A9）</li>
            <li>加法還是 XOR，硬體不用改</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A2 GF(8) 不是整數 mod 8',
    sub: 'ℤ/8 有 zero divisor（零因子）：2 · 4 = 0',
    steps: () => 2,
    render: (s) => <Z8Slide s={s} />,
    takeaway: <>ℤ/8 有 zero divisor 又要進位；GF(8) 能除，加法只是 XOR</>,
    notes: (
      <ul className={UL}>
        <li>為什麼不直接用整數 mod 8？看 ℤ/8 的乘法表</li>
        <li>
          紅色 = zero divisor：兩個非零數相乘得 0，例 2 · 4 = 0
          <ul className={SUB}>
            <li>{nonInvertible(zmod(8)).join('、')} 沒有 inverse → 不能除 → 解不出錯誤位置</li>
            <li>mod 8 的加法還要進位：最高位要等進位從最低位傳上來</li>
          </ul>
        </li>
        <li>
          → 換成 GF(8)：每個非零元素都有 inverse（綠色 = 乘積為 1），field axioms 全部成立
          <ul className={SUB}>
            <li>加法 = {gfAdderXors(M3)} 個 XOR 閘，沒有進位</li>
            <li>
              乘法電路 = {GF_MUL.ands} 個 AND 閘 + {GF_MUL.xors} 個 XOR 閘
            </li>
            <li>101 不是數字 5，是 α² + 1；乘法規則來自 A3 的 α³ = α + 1</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A3 建構 GF(8)：irreducible polynomial',
    sub: 'p(x) 要 irreducible（不可約）；GF(2)[x]/(p(x)) 只留下除以 p(x) 的餘數',
    steps: () => 3,
    render: (s) => <QuotientSlide s={s} />,
    takeaway: <>irreducible 才能除；α³ = α + 1 就是 register 的 feedback 接線</>,
    notes: (
      <ul className={UL}>
        <li>
          做法：多項式只留「除以 p(x) 的餘數」，次數 ≤ {M3 - 1} → 剛好 {2 ** M3} 個 = {M3} 個位元
        </li>
        <li>
          先試 p(x) = x³ + 1：p(1) = 0，有根 → = (x + 1)(x² + x + 1)
          <ul className={SUB}>
            <li>乘法表出現紅色 zero divisor → 不是 field，不能除</li>
          </ul>
        </li>
        <li>
          → 換 p(x) = x³ + x + 1：p(0) = p(1) = 1，沒有根 → irreducible → quotient ring 是 field
          <ul className={SUB}>
            <li>
              {M3} 次 irreducible polynomial 只有 {irreduciblePolys(M3).length} 個，都只有 {minIrreducibleWeight(M3)} 項（最少）
            </li>
            <li>項數少 = 電路少：乘以 α 只要 {alphaMultiplierXors(P_MASK)} 個 XOR 閘</li>
          </ul>
        </li>
        <li>→ p(α) = 0 ⇒ α³ = α + 1：這條化簡規則就是 shift register 的 feedback 接線</li>
      </ul>
    ),
  },
  {
    title: 'A3 GF(8) 乘法：遇到 α³ 就換成 α + 1',
    sub: '(α² + α)(α + 1) = 1',
    steps: () => MUL_LINES.length,
    render: (s) => <MulSlide s={s} />,
    takeaway: <>乘以 α = register 左移一格，溢出的 α³ 經 feedback 換成 α + 1</>,
    notes: (
      <ul className={UL}>
        <li>
          例子：({gf8Text(MUL_A)})({gf8Text(MUL_B)})，就是 {gf8Bits(MUL_A)} 乘 {gf8Bits(MUL_B)}
        </li>
        <li>→ distributivity 展開：α + α² + α² + α³</li>
        <li>→ 同類項合併，係數 mod 2：兩個 α² 抵銷 → α³ + α</li>
        <li>→ 化簡 α³：換成 α + 1 → (α + 1) + α = 1</li>
        <li>
          → 結果 = {gf8Text(MUL.result)}（{gf8Bits(MUL.result)}）：兩者互為 inverse，除法做得到
        </li>
        <li>
          電路上
          <ul className={SUB}>
            <li>乘以 α = 左移一格；溢出 α³ 就經 feedback 換成 α + 1</li>
            <li>第二課的 {ENC.flipFlops} 個 register 做的就是這件事</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A4 α 的循環：α⁷ = 1',
    sub: '每次乘上 α，走遍 7 個非零元素再回到 1',
    steps: () => 8,
    render: (s) => <CycleSlide s={s} />,
    takeaway: (
      <>
        LFSR 每個時脈乘一次 α，{PERIOD} 個狀態剛好標記 {CODE_N} 個位置
      </>
    ),
    notes: (
      <ul className={UL}>
        <li>從 1（{WALK[0]}）出發，每次乘上 α：左移，溢出就用 α³ = α + 1 做 feedback</li>
        <li>硬體上每乘一次 α = LFSR 走一個時脈</li>
        <li>
          → 按 {PERIOD - 1} 次走完：{WALK.join(' → ')}
          <ul className={SUB}>
            <li>
              → 第 {FIRST_WRAP} 步第一次溢出：α³ 換成 α + 1（{WALK[FIRST_WRAP]}）
            </li>
          </ul>
        </li>
        <li>
          → 第 {PERIOD} 步回到 {WALK[0]}：α⁷ = 1
          <ul className={SUB}>
            <li>
              {PERIOD} 步走遍全部 {2 ** M3 - 1} 個非零狀態 → α 是 primitive element
            </li>
            <li>乘法變成指數相加：αⁱ · αʲ = αⁱ⁺ʲ</li>
          </ul>
        </li>
        <li>
          每個位置都有地址
          <ul className={SUB}>
            <li>第 i 個位置 ↔ αⁱ：「位置」變成可以運算的數</li>
            <li>
              {PERIOD} 個次方剛好對上 code length n = 2³ − 1 = {CODE_N} 的 {CODE_N} 個位置
            </li>
          </ul>
        </li>
        <li>
          只是 irreducible 還不夠，要 primitive
          <ul className={SUB}>
            <li>
              x⁴ + x³ + x² + x + 1 是 irreducible，但 LFSR 只繞 {orderOfX(P16)} 個狀態就回頭（共 {2 ** maskDegree(P16) - 1} 個）
            </li>
            <li>→ 只能標記 {orderOfX(P16)} 個位置，其他位置沒有地址</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A5 Generator polynomial（生成多項式）',
    sub: '一個 g(x) 取代整個 G：G_cyc 的四列 = x³g, x²g, xg, g',
    steps: () => 4,
    render: (s) => <GcycSlide s={s} />,
    takeaway: (
      <>
        g 的係數就是接線：{ENC.flipFlops} 個 register + {ENC.xors} 個 XOR 閘取代整個 G
      </>
    ),
    notes: (
      <ul className={UL}>
        <li>
          問題：第一課的 G 是 {GC.length}×{GC[0].length} 個數字，encoder 是一片 XOR 網路
        </li>
        <li>
          g(x) = {polyText(G_MSB)}（{G_MSB.join('')}），次數 = n − k = {CODE_N - CODE_K}
        </li>
        <li>
          G_cyc 的四列 = x³g、x²g、xg、g：同一個多項式往左移
          <ul className={SUB}>
            <li>→ 只要記住 g 的 {G_MSB.length} 個係數，就等於記住整個 G</li>
          </ul>
        </li>
        <li>
          → 循環的概念
          <ul className={SUB}>
            <li>每個 codeword 都是 g(x) 的倍數</li>
            <li>
              把 codeword 做 cyclic shift，還是 codeword：{ORBIT.slice(0, 3).map((w) => w.join('')).join(' → ')} → …，{ORBIT_LEN} 次回到原點（A6 證明）
            </li>
          </ul>
        </li>
        <li>
          → g 的係數就是 encoder 的接線圖
          <ul className={SUB}>
            <li>
              次數 {G_MSB.length - 1} → {ENC.flipFlops} 個 register；係數為 1 的位置 → feedback XOR，共 {ENC.xors} 個 XOR 閘
            </li>
            <li>
              一個時脈處理一個位元：訊息 {CLK.message} 個時脈、把 parity bit 移出 {CLK.parityOut} 個，共 {CLK.total} 個時脈
            </li>
            <li>
              拉長就看得出差別：{hamName(M127)} 的矩陣 encoder 要 {hammingEncoderXors(M127)} 個 XOR 閘，LFSR 只要 {ENC127.flipFlops} 個 register + {ENC127.xors} 個 XOR 閘
            </li>
            <li>用時間換面積；serial 傳輸和儲存本來就是一個位元一個位元送</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A5 怎麼乘：c(x) = m(x)g(x)',
    sub: 'm = 1011，g = 1011：distributivity（分配律）→ 同類項 → mod 2',
    steps: () => P5 + 2,
    render: (s) => <PolyMulSlide s={s} />,
    takeaway: <>編碼 = 乘上 g：每個送出的 codeword 都通過 c(α) = 0</>,
    notes: (
      <ul className={UL}>
        <li>
          訊息 m = {M5.join('')} → m(x) = {polyText(M5)}，乘上 g(x)
        </li>
        <li>
          第一列部分積：{xMono(T5.partials[0].shift)} · g(x) = {polyText(T5.partials[0].bits)}（m 的每個 1 產生一列 = g 往左移）
        </li>
        <li>
          → 第二列：{xMono(T5.partials[1].shift)} · g(x) = {polyText(T5.partials[1].bits)}
        </li>
        <li>
          → 第三列：{xMono(T5.partials[2].shift)} · g(x) = {polyText(T5.partials[2].bits)}
        </li>
        <li>→ 同類項合併：{countsText(T5.counts)}</li>
        <li>
          → 係數 mod 2：{polyText(C5)} = {C5.join('')}
          <ul className={SUB}>
            <li>c(α) = 0 ✓：g 的根也是 c 的根</li>
            <li>編碼只做乘法，不取餘數</li>
            <li>
              和矩陣是同一件事：{C5.join('')} = G_cyc 第 {SEL5.join('、')} 列相加（m = {M5.join('')} 選中的列）
            </li>
            <li>實務常用 systematic encoding：訊息原封不動放前面，沒錯時不用解碼就能讀資料</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A6 Cyclic shift = 乘以 x',
    sub: '在 R₇ = GF(2)[x]/(x⁷ − 1) 中 x⁷ ≡ 1，最左邊繞回最右邊',
    steps: () => 8,
    render: (s) => <ShiftSlide s={s} />,
    takeaway: <>位移後仍是 codeword：同一個小電路一個時脈處理一個位元</>,
    notes: (
      <ul className={UL}>
        <li>cyclic shift = 乘以 x：每個位元往左一格（次方 +1）</li>
        <li>在 R₇ 裡 x⁷ ≡ 1：最左邊溢出的位元繞回最右邊（橘框）</li>
        <li>從 {START.join('')}（= g(x)）出發</li>
        <li>
          {[1, 2, 3].map((k) => `→ ${rotateLeft(START, k).join('')}`).join('、')}：直接左移
        </li>
        <li>→ {rotateLeft(START, 4).join('')}：第一次繞回（x⁷ → 1）</li>
        <li>
          {[5, 6, 7].map((k) => `→ ${rotateLeft(START, k % CODE_N).join('')}`).join('、')}：{ORBIT_LEN} 次回到起點，每一個都是 codeword
        </li>
        <li>線性 + 循環 ⇒ C 是 R₇ 的 ideal ⟨g(x)⟩（下一頁）</li>
        <li>
          電路上
          <ul className={SUB}>
            <li>位移不變 → 同一個小電路就能服務每一個位置</li>
            <li>
              接收端檢查 = 除以 g(x)：一個時脈讀一個位元，{syndromeClocks(CODE_N)} 個時脈讀完看餘數
            </li>
            <li>CRC（例如乙太網路）用的是同一種除法，只是拿來偵測錯誤</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A6 Ideal：C 吸收 R₇ 的乘法',
    sub: '任意 a(x) × codeword 仍是 codeword ⇒ C = ⟨g(x)⟩',
    steps: () => 3,
    render: (s) => <IdealSlide s={s} />,
    takeaway: <>C 就是 g 的倍數：檢查只要一次除法看餘數，不用查表</>,
    notes: (
      <ul className={UL}>
        <li>ideal I 的兩個條件：① 相加還在 I（線性）② 乘上 R₇ 的任何元素還在 I（吸收乘法）</li>
        <li>例：任意 a(x) 乘上一個 codeword c(x)</li>
        <li>→ 先照常乘開 a(x)c(x)</li>
        <li>
          → 超過 x⁶ 的項用 x⁷ ≡ 1 繞回 → 結果還是 codeword ✓；兩個 codeword 相加也是 ✓
          <ul className={SUB}>
            <li>關鍵：g(x) 整除 x⁷ − 1，繞回時才不會離開 g 的倍數</li>
          </ul>
        </li>
        <li>
          C = ⟨g(x)⟩ = 所有 g 的倍數
          <ul className={SUB}>
            <li>「是不是 codeword」只要做一次除法、看餘數是不是 0，不用查表</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A7 Frobenius：(a + b)² = a² + b²',
    sub: 'Characteristic 2 的 freshman’s dream（新生的夢）：φ(a) = a² 是 GF(8) 的 automorphism（自同構）',
    steps: () => 3,
    render: (s) => <FrobSlide s={s} />,
    takeaway: <>平方是線性的：平方器只要 {squarerXors(M3, P_MASK)} 個 XOR 閘，不用乘法器</>,
    notes: (
      <ul className={UL}>
        <li>這頁是純代數；工程上用得到的是平方的性質</li>
        <li>(a + b)² 照常展開 = a² + 2ab + b²</li>
        <li>→ characteristic {characteristic(GF8_FIELD)}：2ab = ab + ab = 0</li>
        <li>
          → freshman’s dream：(a + b)² = a² + b²
          <ul className={SUB}>
            <li>平方保持加法和乘法，窮舉 {GF8_ELEMENTS.length ** 2} 組驗證：是 GF(8) 的 automorphism</li>
          </ul>
        </li>
        <li>
          平方是線性運算
          <ul className={SUB}>
            <li>平方器只要 XOR 接線，不用乘法器</li>
            <li>
              GF(8) 平方器 {squarerXors(M3, P_MASK)} 個 XOR 閘；一般乘法器 {GF_MUL.ands} 個 AND + {GF_MUL.xors} 個 XOR 閘
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A7 Cyclotomic cosets（分圓陪集）',
    sub: '一個根帶出 conjugate roots：i → 2i mod 7，c(α) = 0 ⇒ c(α²) = c(α⁴) = 0',
    steps: () => cosetOrbit(1).length + 1,
    render: (s) => <CosetSlide s={s} />,
    takeaway: <>一個根帶出整個 coset：parity bit 數按 coset 大小算，不按根數算</>,
    notes: (
      <ul className={UL}>
        <li>
          c(x) = {COSET_C.join('')} = {polyText(COSET_C)}，代入 α 的各次方；指數從 {ORBIT1[0]} 出發，每次 ×2 mod {CODE_N}
        </li>
        <li>
          → {ORBIT1[0]} → {ORBIT1[1]}：c 的係數在 GF(2)，c(α)² = c(α²) → α 是根 ⇒ α² 也是根
        </li>
        <li>
          → {ORBIT1[1]} → {ORBIT1[2]}：α⁴ 也是根
        </li>
        <li>
          → {ORBIT1[2]} → {ORBIT1[0]} 回到起點：coset {`{${ORBIT1.join(', ')}}`}
          <ul className={SUB}>
            <li>所有 coset：{cyclotomicCosets().map((cs) => `{${cs.join(', ')}}`).join('、')}</li>
            <li>
              g(x) 至少要包含 (x + α)(x + α²)(x + α⁴)，次數 ≥ {ORBIT1.length}（A8 乘開）
            </li>
          </ul>
        </li>
        <li>
          要一個根，整個 coset 都會跟著來 → parity bit 數按 coset 大小算
          <ul className={SUB}>
            <li>
              n = {CODE_N} 要 α、α² 兩個根：直覺 {BUD7.roots} × {M3} = {BUD7.naiveBits} 個位元，實際只要 {BUD7.bits}
            </li>
            <li>
              設計 BCH 就是挑 coset：{bchName(BCH_B)} 要 {BUD_B.roots} 個根，直覺 {BUD_B.naiveBits} 個位元，實際 {BUD_B.bits} 個
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A8 Minimal polynomial（最小多項式）',
    sub: '把 conjugate roots 乘起來：(x + α)(x + α²)(x + α⁴) = x³ + x + 1',
    steps: () => 4,
    render: (s) => <MinPolySlide s={s} />,
    takeaway: <>minimal polynomial 就是 g(x)：次數 = register 數，係數 = feedback 位置</>,
    notes: (
      <ul className={UL}>
        <li>目標：係數全在 GF(2)、以 α 為根的最小次數多項式</li>
        <li>conjugate roots 必須一起出現：(x + α)(x + α²)(x + α⁴)</li>
        <li>→ 先乘前兩個</li>
        <li>
          → 再乘第三個：每個係數都化簡成 0 或 1 → m_α(x) = {polyText(toMsb(MP.binary!))} = g(x)
        </li>
        <li>
          → 對照表：三個 conjugate 都是根 ✓；次數 = coset 大小 = {MP.coset.length} → k = {CODE_N} − {MP.coset.length} = {CODE_N - MP.coset.length}
        </li>
        <li>
          minimal polynomial 就是 g(x)，也就是 encoder 的接線
          <ul className={SUB}>
            <li>
              次數 = register 數 = parity bit 數 = {ENC.flipFlops}；係數 = feedback 位置 → {ENC.xors} 個 XOR 閘
            </li>
            <li>
              另一個 coset {`{${MP_MIRROR.coset.join(', ')}}`} 的 minimal polynomial {polyText(toMsb(MP_MIRROR.binary!))}：鏡像接線，一樣 {MIRROR.flipFlops} 個 register + {MIRROR.xors} 個 XOR 閘
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A8 x⁷ − 1 = (x + 1)(x³ + x + 1)(x³ + x² + 1)',
    sub: '三個 coset → 三個 minimal polynomial',
    steps: () => 3,
    render: (s) => <FactorSlide s={s} />,
    takeaway: (
      <>
        挑幾個因式當 g(x)：多幾個 register，換更大的 <M>{'d_{\\min}'}</M>
      </>
    ),
    notes: (
      <ul className={UL}>
        <li>三個 coset → 三個 minimal polynomial，乘起來剛好是 x⁷ − 1</li>
        <li>→ 先乘 (x + 1)(x³ + x + 1)</li>
        <li>
          → 再乘 (x³ + x² + 1) = x⁷ + 1 = x⁷ − 1（GF(2) 中 −1 = +1）
          <ul className={SUB}>
            <li>g(x) 整除 x⁷ − 1：正是 A6 需要的條件</li>
          </ul>
        </li>
        <li>
          從這三個因式挑幾個相乘當 g(x)，就是長度 {CODE_N} 的所有 cyclic code 選單
          <ul className={SUB}>
            <li>
              x + 1 → single parity check：{OPT_PARITY.checkBits} 個 parity bit，d_min = {OPT_PARITY.dmin}
            </li>
            <li>
              x³ + x + 1 → {hamName(M3)}：{OPT_HAM.flipFlops} 個 register + {OPT_HAM.xors} 個 XOR 閘，d_min = {OPT_HAM.dmin}
            </li>
            <li>
              (x + 1)(x³ + x + 1) → [{CODE_N},{OPT_ODD.k},{OPT_ODD.dmin}]：{OPT_ODD.flipFlops} 個 register + {OPT_ODD.xors} 個 XOR 閘，d_min = {OPT_ODD.dmin}
            </li>
            <li>
              兩個三次式相乘 → repetition code：{OPT_REP.flipFlops} 個 register，d_min = {OPT_REP.dmin}
            </li>
            <li>多一個因式 = 多幾個 register、少幾個 data bit，換更大的 d_min</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A9 用 GF(8) 推導 H 矩陣',
    sub: '一條 GF(8) 方程 = 三條 GF(2) 方程',
    steps: () => 8,
    render: (s) => <BuildHSlide s={s} />,
    takeaway: <>第 k 欄 = 那個位置出錯時，syndrome register 留下的圖樣</>,
    notes: (
      <ul className={UL}>
        <li>c(α) = Σ cᵢαⁱ：每個 αⁱ 寫成 {HC.length} 位元直行，排起來就是 H_cyc</li>
        <li>
          → 按 {HC[0].length} 次，從最左欄（x⁶ ↔ α⁶）開始一欄一欄建
          <ul className={SUB}>
            <li>{[6, 5, 4, 3, 2, 1, 0].map((e) => `${powLabel(e)} = ${gf8Bits(alphaPow(e))}`).join('、')}</li>
          </ul>
        </li>
        <li>最後：一條 GF(8) 方程 c(α) = 0 ⇔ 三個座標都是 0 ⇔ 三條 GF(2) 方程</li>
        <li>
          電路上
          <ul className={SUB}>
            <li>第 k 欄 = 這個位置出錯時，在 syndrome register 留下的 {HC.length} 位元圖樣</li>
            <li>三條方程 = 三個 XOR 樹，共 {xorNetworkGates(HC)} 個 XOR 閘，和第一課的 H 一樣</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A9 c(α) = 0 ⇔ H_cyc cᵀ = 0',
    sub: '換任何 c，兩種算法都一致',
    steps: () => 3,
    render: (s) => <CompareSlide s={s} />,
    takeaway: <>和第一課只差接線順序；換成循環排列，LFSR 才用得上</>,
    notes: (
      <ul className={UL}>
        <li>GF(8) 觀點：直接算 c(α)</li>
        <li>→ GF(2) 觀點：H_cyc cᵀ = 把 c 是 1 的那幾欄相加 → 和 c(α) 的三個座標一模一樣</li>
        <li>
          → 和第一課對照：cyclic code 的位置 x⁶…1 對到第一課的 {COL_LABELS.map((_, k) => `#${cyclicIndexToStandardPosition(k)}`).join(' ')}
          <ul className={SUB}>
            <li>
              同一組 {HC[0].length} 個非零欄，只差排列 → equivalent code [{CODE_N},{OPT_HAM.k},{OPT_HAM.dmin}]
            </li>
            <li>硬體上只是重新接線，不用多任何閘</li>
            <li>
              要換排列：第一課 {L1_CODE.length} 個 codeword 位移一格後有 {L1_ESCAPES} 個跑出 code；換成循環排列後一個都不會，LFSR 才用得上
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A10 Syndrome 的 GF(8) 觀點',
    sub: 'S₁ = r(α) = e(α) = αⁱ',
    steps: () => DERIVE_LINES.length,
    render: (s) => <DeriveSlide s={s} />,
    takeaway: (
      <>
        S₁ = αⁱ 直接算出位置：{HORNER.flipFlops} 個 register、{syndromeClocks(CODE_N)} 個時脈
      </>
    ),
    notes: (
      <ul className={UL}>
        <li>received word r(x) = c(x) + e(x)</li>
        <li>→ 代入 α：S₁ = r(α) = c(α) + e(α) = e(α)，codeword 的部分是 0</li>
        <li>→ 只錯一個 e(x) = xⁱ ⇒ S₁ = αⁱ</li>
        <li>→ 取對數：i = log S₁，位置 = {CODE_N} − i（α⁰…α⁶ 兩兩不同，A4）</li>
        <li>
          → 下一步（第二課）：σ(z) = 1 + S₁z → Chien search 找根 → XOR 更正
          <ul className={SUB}>
            <li>同一個 syndrome 三種寫法：s = Hrᵀ（第一課）、S(x) = r(x) mod g(x)（第二課）、S₁ = r(α)（這章）</li>
          </ul>
        </li>
        <li>
          硬體
          <ul className={SUB}>
            <li>r(α) 用 Horner’s rule 一個時脈讀一個位元：S ← S·α ⊕ rₖ</li>
            <li>
              {HORNER.flipFlops} 個 register + {HORNER.xors} 個 XOR 閘，和除法 LFSR 一樣大；{syndromeClocks(CODE_N)} 個時脈讀完
            </li>
            <li>找位置：查 {logTableEntries(CODE_N, CODE_K)} 筆的對數表，或讓 S 跟著資料每個時脈乘 α，比對到就翻轉</li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: 'A10 例子：c = 1001110 錯一個位元',
    sub: 'S₁ = r(α) = αⁱ ⇒ 錯在從左數第 7 − i 個 bit',
    steps: () => 3,
    render: (s) => <SyndromeExampleSlide s={s} />,
    takeaway: <>接收端算出 S₁ 再取對數，就知道該翻哪一個位元</>,
    notes: (
      <ul className={UL}>
        <li>
          c = {EX_C.join('')}，雜訊翻了 {xMono(CODE_N - EX_POS)} 那一位 → r = {EX_R.join('')}
        </li>
        <li>
          → 算 r(α)：把 r 裡是 1 的那幾項 αⁱ 加起來 = {powLabel(EX_I)}（{gf8Bits(EX_S1)}）
        </li>
        <li>
          → 取對數 i = {EX_I} → 錯在 {xMono(EX_I)} = 從左數第 {CODE_N - EX_I} 個位元，翻回來
          <ul className={SUB}>
            <li>
              {gf8Bits(EX_S1)} 不是「第 {EX_S1} 個位置」：要先取對數
            </li>
            <li>也等於 r(x) mod g(x) 的餘數 {bitsToField(syndromeL2(EX_R)) === EX_S1 ? '✓' : '✗'}：和第二課的除法電路是同一件事</li>
          </ul>
        </li>
        <li>
          極限
          <ul className={SUB}>
            <li>
              錯 {T_HAM + 1} 個時 S₁ = αⁱ + αʲ 會是第三個位置 → 翻錯成 {DOUBLE.errorsAfter.join('、')} 個錯（miscorrection）
            </li>
            <li>
              要修更多錯就要多選根（BCH）：n = {hammingN(BCH_A.m)} 修 {BCH_A.t} 個錯要 {bchRedundancy(BCH_A.m, BCH_A.t)} 個 parity bit
            </li>
          </ul>
        </li>
      </ul>
    ),
  },
  {
    title: '總結：一個訊息走完整章',
    sub: 'u → c → r → S₁ → σ(z) → 更正',
    steps: () => 8,
    render: (s) => <JourneySlide s={s} />,
    takeaway: (
      <>
        整條鏈路都是 shift register + XOR：編碼、syndrome 各 {ENC.flipFlops} 個 register
      </>
    ),
    notes: (
      <ul className={UL}>
        <li>用一個訊息把整章串起來，每按一次出現一步</li>
        <li>GF(2)：位元運算都 mod 2，1 + 1 = 0（XOR）</li>
        <li>→ 建構 GF(8)：irreducible p(x) = x³ + x + 1，α³ = α + 1（feedback 接線）</li>
        <li>
          → minimal polynomial：(x + α)(x + α²)(x + α⁴) = {polyText(toMsb(MP.binary!))} = g(x)
        </li>
        <li>
          → systematic encoding：u = {DEFAULT_U.join('')} → c = {J_C.join('')}（{ENC.flipFlops} 個 register 的 LFSR）
        </li>
        <li>→ codeword 檢查：c(α) = 0 ⇔ H_cyc cᵀ = 0</li>
        <li>
          → 通道錯誤：錯在 {xMono(CODE_N - J_POS)}，r = {J_R.join('')}
        </li>
        <li>
          → syndrome：S₁ = r(α) = {powLabel(LOG[J_S1])}（{gf8Bits(J_S1)}）
        </li>
        <li>
          → Chien search：σ(z) = 1 + {powLabel(LOG[J_S1])}z，根 z = {powLabel(J_ROOT?.j ?? 0)} → 錯在 {xMono(J_ROOT?.exponent ?? 0)} → 翻回來
        </li>
        <li>
          收尾
          <ul className={SUB}>
            <li>
              整條路線在硬體上都是 shift register + XOR：encoder 和 syndrome 都只要 {ENC.flipFlops} 個 register
            </li>
            <li>同一套代數延伸到 BCH、Reed–Solomon、CRC</li>
            <li>第二課把每一步做成實際的電路與演算法</li>
          </ul>
        </li>
      </ul>
    ),
  },
];

export default function PresentationAlgebra() {
  return <Deck slides={SLIDES} ctx={null} label="代數章報告" exitHref="#/a-0" />;
}
