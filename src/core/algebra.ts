/**
 * Abstract-algebra foundations for the cyclic Hamming Code ("代數基礎與循環碼" chapter).
 *
 * Conventions (identical to Lesson 2, see cyclic.ts):
 *   • Codewords / GF(2) polynomials shown as bit strings are MSB-first (leftmost = highest power).
 *   • Internally a GF(2) polynomial may also be a low→high coefficient array (`Poly` from gf8.ts).
 *   • A GF(8) element is an integer 0..7 whose bit i is the coefficient of αⁱ (α³ = α + 1);
 *     it is displayed MSB-first as the 3-bit string (α², α, 1).
 */
import { type Bit, bitsToInt, intToBits, isZeroVector, zeroVector } from './gf2';
import { type GF8, type Poly, LOG, alphaPow, gf8Add, gf8Mul, polyMul } from './gf8';
import { G_MSB, longDivision, msbToPoly, polyModMsb, polyToMsb, runLfsr } from './cyclic';

/* ================================================================== */
/* Generic finite-structure checks (used for GF(2), GF(8), Z/n, quotient rings) */
/* ================================================================== */

export interface Structure {
  name: string;
  elements: number[];
  add: (a: number, b: number) => number;
  mul: (a: number, b: number) => number;
  zero: number;
  one: number;
}

export interface AxiomResult {
  key: string;
  /** label for the first checklist a reader sees: closure, additive inverse and zero divisor carry their Chinese gloss */
  zh: string;
  /** the same label without the Chinese gloss, for every later checklist (the gloss is given once per unit) */
  plain: string;
  holds: boolean;
  /** first counterexample found, as readable text */
  counterexample?: string;
}

/** Exhaustively check the field axioms of a finite structure. */
export function checkFieldAxioms(S: Structure, label: (x: number) => string = String): AxiomResult[] {
  const E = S.elements;
  const res: AxiomResult[] = [];
  const find = (pred: (...xs: number[]) => boolean, arity: number, fmt: (...xs: number[]) => string): string | undefined => {
    const rec = (acc: number[]): string | undefined => {
      if (acc.length === arity) return pred(...acc) ? undefined : fmt(...acc);
      for (const e of E) {
        const r = rec([...acc, e]);
        if (r) return r;
      }
      return undefined;
    };
    return rec([]);
  };
  const L = label;
  const push = (key: string, zh: string, ce?: string) => res.push({ key, zh, plain: zh.replace(/（[^（）]*）/g, ''), holds: !ce, counterexample: ce });
  // Labels are shown in the algebra pages (A1 lists all ten first) and the algebra deck: closure, inverse and
  // zero divisor carry their Chinese gloss in `zh`, used only where that checklist is the first occurrence;
  // later checklists use `plain`. Associativity etc. are glossed in the page text before.
  push('add-closed', '對加法滿足 closure（封閉性）', find((a, b) => E.includes(S.add(a, b)), 2, (a, b) => `${L(a)} + ${L(b)} 不在集合中`));
  push('mul-closed', '對乘法滿足 closure', find((a, b) => E.includes(S.mul(a, b)), 2, (a, b) => `${L(a)} · ${L(b)} 不在集合中`));
  push('add-assoc', '加法滿足 associativity', find((a, b, c) => S.add(S.add(a, b), c) === S.add(a, S.add(b, c)), 3, (a, b, c) => `(${L(a)}+${L(b)})+${L(c)}`));
  push('mul-assoc', '乘法滿足 associativity', find((a, b, c) => S.mul(S.mul(a, b), c) === S.mul(a, S.mul(b, c)), 3, (a, b, c) => `(${L(a)}·${L(b)})·${L(c)}`));
  push('add-comm', '加法滿足 commutativity', find((a, b) => S.add(a, b) === S.add(b, a), 2, (a, b) => `${L(a)}+${L(b)}`));
  push('mul-comm', '乘法滿足 commutativity', find((a, b) => S.mul(a, b) === S.mul(b, a), 2, (a, b) => `${L(a)}·${L(b)}`));
  push('distrib', '滿足 distributivity', find((a, b, c) => S.mul(a, S.add(b, c)) === S.add(S.mul(a, b), S.mul(a, c)), 3, (a, b, c) => `${L(a)}·(${L(b)}+${L(c)})`));
  push('add-inv', '每個元素都有 additive inverse（加法反元素）', find((a) => E.some((b) => S.add(a, b) === S.zero), 1, (a) => `${L(a)} 沒有 additive inverse`));
  push(
    'mul-inv',
    '每個非零元素都有 multiplicative inverse',
    find((a) => a === S.zero || E.some((b) => S.mul(a, b) === S.one), 1, (a) => `${L(a)} 沒有 multiplicative inverse`),
  );
  push(
    'no-zero-div',
    '沒有 zero divisor（零因子）：ab = 0 ⇒ a = 0 或 b = 0',
    find((a, b) => !(S.mul(a, b) === S.zero && a !== S.zero && b !== S.zero), 2, (a, b) => `${L(a)} · ${L(b)} = 0`),
  );
  return res;
}

export const isField = (S: Structure) => checkFieldAxioms(S).every((r) => r.holds);

/** smallest n ≥ 1 with 1 + 1 + … + 1 (n times) = 0 */
export function characteristic(S: Structure): number {
  let acc = S.zero;
  for (let n = 1; n <= S.elements.length; n++) {
    acc = S.add(acc, S.one);
    if (acc === S.zero) return n;
  }
  return 0;
}

export const GF2: Structure = { name: 'GF(2)', elements: [0, 1], add: (a, b) => (a + b) % 2, mul: (a, b) => (a * b) % 2, zero: 0, one: 1 };

export const GF8_FIELD: Structure = { name: 'GF(8)', elements: [0, 1, 2, 3, 4, 5, 6, 7], add: gf8Add, mul: gf8Mul, zero: 0, one: 1 };

export const zmod = (n: number): Structure => ({
  name: `ℤ/${n}ℤ`,
  elements: Array.from({ length: n }, (_, i) => i),
  add: (a, b) => (a + b) % n,
  mul: (a, b) => (a * b) % n,
  zero: 0,
  one: 1,
});

/* ================================================================== */
/* GF(8) element helpers                                              */
/* ================================================================== */

export const GF8_ELEMENTS: GF8[] = [0, 1, 2, 3, 4, 5, 6, 7];

export const gf8Bits = (a: GF8): string => intToBits(a, 3).join('');

/** a + bα + cα² style LaTeX, highest power first (e.g. 6 → α² + α) */
export function gf8PolyTex(a: GF8): string {
  if (a === 0) return '0';
  const t: string[] = [];
  if (a & 4) t.push('\\alpha^2');
  if (a & 2) t.push('\\alpha');
  if (a & 1) t.push('1');
  return t.join(' + ');
}

/** α^k label, or "0" */
export const gf8PowTex = (a: GF8): string => (a === 0 ? '0' : LOG[a] === 0 ? '1' : LOG[a] === 1 ? '\\alpha' : `\\alpha^{${LOG[a]}}`);

export function gf8Inverse(a: GF8): GF8 {
  if (a === 0) throw new Error('0 has no inverse');
  return GF8_ELEMENTS.find((b) => gf8Mul(a, b) === 1)!;
}

export function gf8Pow(a: GF8, k: number): GF8 {
  let r = 1;
  for (let i = 0; i < k; i++) r = gf8Mul(r, a);
  return r;
}

export function gf8Order(a: GF8): number {
  if (a === 0) return 0;
  let x = a;
  for (let k = 1; k <= 7; k++) {
    if (x === 1) return k;
    x = gf8Mul(x, a);
  }
  return -1;
}

export const primitiveElements = (): GF8[] => GF8_ELEMENTS.filter((a) => gf8Order(a) === 7);

/* ---------------- multiplication with a full hand-calculation trace ---------------- */

export interface ReduceStep {
  /** highest power being replaced (3 or 4) */
  power: number;
  before: number; // up to 5-bit polynomial in α
  after: number;
}

export interface Gf8MulTrace {
  a: GF8;
  b: GF8;
  /** exponents of α produced by distributing (a_i αⁱ)(b_j αʲ), before combining like terms */
  terms: number[];
  /** product before reduction (carry-less), bit i = coefficient of αⁱ, may reach α⁴ */
  raw: number;
  reductions: ReduceStep[];
  result: GF8;
}

/** Multiply by distributing, combine like terms mod 2, then replace α⁴ = α² + α and α³ = α + 1. */
export function gf8MulTrace(a: GF8, b: GF8): Gf8MulTrace {
  const terms: number[] = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) if ((a >> i) & 1 && (b >> j) & 1) terms.push(i + j);
  const raw = terms.reduce((acc, e) => acc ^ (1 << e), 0);
  const reductions: ReduceStep[] = [];
  let v = raw;
  for (const power of [4, 3]) {
    if ((v >> power) & 1) {
      // α^power = α^(power−3) · (α + 1)
      const before = v;
      v ^= (1 << power) ^ (0b011 << (power - 3));
      reductions.push({ power, before, after: v });
    }
  }
  return { a, b, terms, raw, reductions, result: v };
}

/** polynomial in α (bit i ↔ αⁱ, any degree) as LaTeX */
export function alphaPolyTex(v: number): string {
  if (v === 0) return '0';
  const t: string[] = [];
  for (let i = 8; i >= 0; i--) if ((v >> i) & 1) t.push(i === 0 ? '1' : i === 1 ? '\\alpha' : `\\alpha^{${i}}`);
  return t.join(' + ');
}

export interface AlphaPowerStep {
  k: number;
  /** α · α^{k−1} before reduction (may contain α³) */
  shifted: number;
  reduced: boolean;
  value: GF8;
}

/** α^k computed by repeated multiplication by α, recording each α³ → α + 1 replacement. */
export function alphaPowerTrace(k: number): AlphaPowerStep[] {
  const steps: AlphaPowerStep[] = [{ k: 0, shifted: 1, reduced: false, value: 1 }];
  let v = 1;
  for (let i = 1; i <= k; i++) {
    const shifted = v << 1;
    const reduced = (shifted & 0b1000) !== 0;
    v = reduced ? shifted ^ 0b1011 : shifted;
    steps.push({ k: i, shifted, reduced, value: v });
  }
  return steps;
}

/* ================================================================== */
/* GF(2)[x]: irreducibility, factoring, quotient rings                */
/* ================================================================== */

/** p(x) evaluated at x ∈ {0, 1} (low→high coefficients) */
export const evalGF2 = (p: Poly, x: 0 | 1): Bit => (x === 0 ? (p[0] ?? 0) : (p.reduce<number>((a, b) => a ^ b, 0) as Bit)) as Bit;

export const polyDegreeOf = (p: Poly): number => {
  for (let i = p.length - 1; i >= 0; i--) if (p[i]) return i;
  return -1;
};

/** all GF(2) polynomials of exact degree d (low→high), in counting order */
export function polysOfDegree(d: number): Poly[] {
  const out: Poly[] = [];
  for (let m = 0; m < 2 ** d; m++) out.push([...intToBits(m, d).reverse(), 1] as Poly);
  return out;
}

const trimPoly = (p: Poly): Poly => p.slice(0, Math.max(polyDegreeOf(p) + 1, 1)) as Poly;

/** p mod d (low→high), via MSB-first long division */
export function polyRem(p: Poly, d: Poly): Poly {
  const dp = polyDegreeOf(p);
  const dd = polyDegreeOf(d);
  if (dp < dd) return trimPoly(p);
  const rem = longDivision(polyToMsb(p, dp + 1), polyToMsb(trimPoly(d), dd + 1)).remainder;
  return trimPoly(msbToPoly(rem));
}

export const polyDivides = (d: Poly, p: Poly): boolean => polyDegreeOf(polyRem(p, d)) === -1;

/** irreducible ⇔ no factor of degree 1 … ⌊deg/2⌋ */
export function isIrreducible(p: Poly): boolean {
  const n = polyDegreeOf(p);
  if (n < 1) return false;
  for (let d = 1; d <= Math.floor(n / 2); d++) for (const q of polysOfDegree(d)) if (polyDivides(q, p)) return false;
  return true;
}

/** factor into irreducibles by repeated trial division (low→high polynomials) */
export function factorGF2(p: Poly): Poly[] {
  let rest = trimPoly(p);
  const out: Poly[] = [];
  for (let d = 1; d <= polyDegreeOf(rest); d++) {
    for (const q of polysOfDegree(d)) {
      if (!isIrreducible(q)) continue;
      while (polyDegreeOf(rest) >= d && polyDivides(q, rest)) {
        out.push(q);
        rest = polyQuot(rest, q);
      }
    }
  }
  if (polyDegreeOf(rest) > 0) out.push(rest);
  return out;
}

export function polyQuot(p: Poly, d: Poly): Poly {
  const dp = polyDegreeOf(p);
  const dd = polyDegreeOf(d);
  if (dp < dd) return [0];
  const q = longDivision(polyToMsb(p, dp + 1), polyToMsb(trimPoly(d), dd + 1)).quotient;
  return trimPoly(msbToPoly(q));
}

export const polyEq = (a: Poly, b: Poly) => trimPoly(a).join() === trimPoly(b).join();

/** product of several polynomials */
export const polyProduct = (ps: Poly[]): Poly => ps.reduce<Poly>((acc, p) => trimPoly(polyMul(acc, p)), [1]);

/** monic cubic x³ + a x² + b x + c as low→high, from its 3 lower coefficients */
export const cubic = (a: Bit, b: Bit, c: Bit): Poly => [c, b, a, 1];

/** Quotient ring GF(2)[x]/(q(x)) for a degree-3 q, elements = remainders 0..7 (bit i ↔ xⁱ) */
export function quotientRing(q: Poly): Structure {
  const mask = q.reduce<number>((acc, b, i) => acc | (b << i), 0);
  const mul = (a: number, b: number) => {
    let r = 0;
    for (let i = 0; i < 3; i++) if ((b >> i) & 1) r ^= a << i;
    for (let deg = 4; deg >= 3; deg--) if ((r >> deg) & 1) r ^= mask << (deg - 3);
    return r;
  };
  return { name: `GF(2)[x]/(q)`, elements: [0, 1, 2, 3, 4, 5, 6, 7], add: (a, b) => a ^ b, mul, zero: 0, one: 1 };
}

/* ================================================================== */
/* Polynomial multiplication with a hand-calculation trace (MSB-first) */
/* ================================================================== */

export interface PolyMulTrace {
  a: Bit[];
  b: Bit[];
  /** one partial product per 1-bit of b: a(x)·x^shift, aligned to the result width */
  partials: { shift: number; bits: Bit[] }[];
  /** number of 1s in each column before reducing mod 2 (like terms) */
  counts: number[];
  /** column counts mod 2 */
  result: Bit[];
}

/** a(x)·b(x) over GF(2); result width = len(a) + len(b) − 1 (or `width` if larger) */
export function polyMulTrace(a: readonly Bit[], b: readonly Bit[], width?: number): PolyMulTrace {
  const n = Math.max(width ?? 0, a.length + b.length - 1);
  const partials: { shift: number; bits: Bit[] }[] = [];
  b.forEach((bit, k) => {
    if (!bit) return;
    const shift = b.length - 1 - k; // exponent of this term of b
    const bits = zeroVector(n);
    a.forEach((x, i) => {
      const e = a.length - 1 - i + shift; // exponent of this product term
      if (x) bits[n - 1 - e] = 1;
    });
    partials.push({ shift, bits });
  });
  const counts = Array.from({ length: n }, (_, col) => partials.reduce((s, p) => s + p.bits[col], 0));
  return { a: [...a], b: [...b], partials, counts, result: counts.map((c) => (c % 2) as Bit) };
}

/* ================================================================== */
/* Cyclic code C = ⟨g(x)⟩ in R₇ = GF(2)[x]/(x⁷ − 1), MSB-first         */
/* ================================================================== */

export const N = 7;
export const K = 4;

/** rows x³g, x²g, xg, g (MSB-first) — row i pairs with message bit m_i (coefficient of x^{3−i}) */
export function cyclicGenerator(g: readonly Bit[] = G_MSB, n = N): Bit[][] {
  const k = n - (g.length - 1);
  return Array.from({ length: k }, (_, i) => {
    const shift = k - 1 - i;
    const row = zeroVector(n);
    g.forEach((b, j) => {
      if (b) row[n - 1 - (g.length - 1 - j + shift)] = 1;
    });
    return row;
  });
}

/** non-systematic encoding c(x) = m(x) g(x), 7 bits MSB-first */
export function encodeNonSystematic(m: readonly Bit[]): Bit[] {
  return polyMulTrace(m, G_MSB, N).result.slice(-N) as Bit[];
}

export const inCyclicCode = (c: readonly Bit[]): boolean => isZeroVector(polyModMsb(c, G_MSB));

/** multiply by x^k mod (x⁷ − 1): left rotation of the MSB-first word */
export const rotateLeft = (c: readonly Bit[], k = 1): Bit[] => c.map((_, i) => c[(i + k) % c.length]);

export interface MulModTrace {
  /** full product, MSB-first, width 2n−1 */
  full: Bit[];
  /** folded: x^{n+i} ≡ xⁱ */
  folded: Bit[];
  /** exponents that wrapped around */
  wrapped: number[];
}

/** a(x)·b(x) mod (xⁿ − 1) */
export function mulModXn1(a: readonly Bit[], b: readonly Bit[], n = N): MulModTrace {
  const full = polyMulTrace(a, b, 2 * n - 1).result;
  const folded = zeroVector(n);
  const wrapped: number[] = [];
  full.forEach((bit, idx) => {
    if (!bit) return;
    const e = full.length - 1 - idx;
    if (e >= n) wrapped.push(e);
    const f = e % n;
    folded[n - 1 - f] = (folded[n - 1 - f] ^ 1) as Bit;
  });
  return { full, folded, wrapped };
}

/** xⁿ − 1 = xⁿ + 1 over GF(2), low→high */
export const xn1 = (n = N): Poly => [1, ...Array(n - 1).fill(0), 1] as Poly;

/* ================================================================== */
/* Frobenius, cyclotomic cosets, minimal polynomials                  */
/* ================================================================== */

export const frobenius = (a: GF8): GF8 => gf8Mul(a, a);

/** orbit of exponent i under i → 2i mod n */
export function cosetOrbit(i: number, n = 7, q = 2): number[] {
  const out = [((i % n) + n) % n];
  for (;;) {
    const nx = (out[out.length - 1] * q) % n;
    if (nx === out[0]) return out;
    out.push(nx);
  }
}

/** all q-cyclotomic cosets mod n, each listed in orbit order, sorted by representative */
export function cyclotomicCosets(n = 7, q = 2): number[][] {
  const seen = new Set<number>();
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (seen.has(i)) continue;
    const c = cosetOrbit(i, n, q);
    c.forEach((x) => seen.add(x));
    out.push(c);
  }
  return out;
}

/** polynomial with GF(8) coefficients, low→high */
export type GFPoly = GF8[];

export function gfPolyMul(a: GFPoly, b: GFPoly): GFPoly {
  const out: GFPoly = Array.from({ length: a.length + b.length - 1 }, () => 0);
  a.forEach((ai, i) => b.forEach((bj, j) => (out[i + j] = gf8Add(out[i + j], gf8Mul(ai, bj)))));
  return out;
}

export const gfPolyEval = (p: GFPoly, x: GF8): GF8 => p.reduceRight<number>((acc, c) => gf8Add(gf8Mul(acc, x), c), 0);

/** LaTeX for a GF(8)-coefficient polynomial in x, coefficients written as α-powers */
export function gfPolyTex(p: GFPoly, v = 'x'): string {
  const t: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c === 0) continue;
    const mono = i === 0 ? '' : i === 1 ? v : `${v}^{${i}}`;
    const coef = c === 1 ? (i === 0 ? '1' : '') : gf8PowTex(c);
    t.push(i === 0 ? (c === 1 ? '1' : coef) : `${coef}${mono}`);
  }
  return t.length ? t.join(' + ') : '0';
}

export interface MinPolyStep {
  /** product so far (before multiplying by the factor) */
  left: GFPoly;
  /** the factor (x + β^{2^j}) */
  factor: GFPoly;
  /** raw coefficients as sums of α-powers before simplifying: list per degree */
  rawTerms: number[][];
  product: GFPoly;
}

export interface MinPolyResult {
  /** exponent s of β = α^s */
  exp: number;
  coset: number[];
  steps: MinPolyStep[];
  poly: GFPoly;
  /** the polynomial as GF(2) coefficients (null if some coefficient is outside {0,1} — never for a true minimal polynomial) */
  binary: Poly | null;
  /** each conjugate is a root */
  rootsOk: boolean;
}

/** m_β(x) = ∏ over the conjugates β, β², β⁴, … of (x + β^{2^j}), β = α^s */
export function minimalPolynomial(s: number): MinPolyResult {
  const coset = cosetOrbit(s);
  let acc: GFPoly = [1];
  const steps: MinPolyStep[] = [];
  coset.forEach((e) => {
    const factor: GFPoly = [alphaPow(e), 1];
    // raw terms: for each degree of the product, list the α-exponents that add up
    const rawTerms: number[][] = Array.from({ length: acc.length + 1 }, () => []);
    acc.forEach((ai, i) =>
      factor.forEach((fj, j) => {
        const prod = gf8Mul(ai, fj);
        if (prod) rawTerms[i + j].push(LOG[prod]);
      }),
    );
    const product = gfPolyMul(acc, factor);
    steps.push({ left: acc, factor, rawTerms, product });
    acc = product;
  });
  const binary = acc.every((c) => c === 0 || c === 1) ? (acc as Poly) : null;
  const rootsOk = coset.every((e) => gfPolyEval(acc, alphaPow(e)) === 0);
  return { exp: s, coset, steps, poly: acc, binary, rootsOk };
}

/** the distinct minimal polynomials of all nonzero elements (one per cyclotomic coset) */
export const allMinimalPolynomials = () => cyclotomicCosets().map((c) => minimalPolynomial(c[0]));

/* ================================================================== */
/* Parity-check matrix from GF(8)                                     */
/* ================================================================== */

/** column k (MSB index) of H_cyclic = α^{6−k} written as (α², α, 1) coefficients, top to bottom */
export function hFromGF8(): Bit[][] {
  return [0, 1, 2].map((row) => Array.from({ length: N }, (_, k) => ((alphaPow(N - 1 - k) >> (2 - row)) & 1) as Bit));
}

export const hColumn = (k: number): Bit[] => intToBits(alphaPow(N - 1 - k), 3);

/** c(α) as a GF(8) element, by summing the α-powers selected by the bits */
export const wordAtAlpha = (c: readonly Bit[]): GF8 => c.reduce<number>((acc, b, k) => (b ? acc ^ alphaPow(N - 1 - k) : acc), 0);

/** c(α^j) for j = 0..6 */
export const wordAtAlphaPower = (c: readonly Bit[], j: number): GF8 =>
  c.reduce<number>((acc, b, k) => (b ? acc ^ alphaPow((N - 1 - k) * j) : acc), 0);

/**
 * Coordinate change to Lesson 1's standard layout [P1,P2,D1,P4,D2,D3,D4]:
 * column k of H_cyclic is α^{6−k}; the standard H has column j = binary of j (LSB on top).
 * They carry the same 3 bits when j = int(α^{6−k}), so cyclic index k ↦ standard position int(α^{6−k}).
 */
export const cyclicIndexToStandardPosition = (k: number): number => alphaPow(N - 1 - k);

export function cyclicWordToStandard(c: readonly Bit[]): Bit[] {
  const out = zeroVector(N);
  c.forEach((b, k) => (out[cyclicIndexToStandardPosition(k) - 1] = b));
  return out;
}

/* ================================================================== */
/* LFSR ↔ long division, step-synchronised                            */
/* ================================================================== */

export interface SyncStep {
  k: number;
  input: Bit;
  /** remainder before this step, 3 bits (x², x, 1) */
  prev: Bit[];
  /** x · prev as 4 bits (x³, x², x, 1) */
  shifted: Bit[];
  /** after bringing down the input at x³: shifted ⊕ (input·x³) */
  broughtDown: Bit[];
  /** leading coefficient = feedback */
  feedback: Bit;
  /** feedback · g(x) as 4 bits */
  subtract: Bit[];
  /** broughtDown ⊕ subtract (leading bit is always 0) */
  after4: Bit[];
  next: Bit[];
  /** the LFSR step computed independently by runLfsr */
  lfsr: { before: Bit[]; feedback: Bit; shifted: Bit[]; mask: Bit[]; after: Bit[] };
}

/**
 * Horner-form long division of x³u(x) by g(x): R_k = (x·R_{k−1} + u_k·x³) mod g(x).
 * Each step is the "bring down one bit and cancel the x³ term" of hand division,
 * which is exactly one clock of the premultiplied LFSR.
 */
export function lfsrDivisionSync(u: readonly Bit[]): SyncStep[] {
  const lfsr = runLfsr(u, 'encoder');
  let R: Bit[] = [0, 0, 0];
  return u.map((input, k) => {
    const shifted: Bit[] = [...R, 0];
    const broughtDown: Bit[] = [(shifted[0] ^ input) as Bit, shifted[1], shifted[2], shifted[3]];
    const feedback = broughtDown[0];
    const subtract: Bit[] = G_MSB.map((b) => (b & feedback) as Bit);
    const after4 = broughtDown.map((b, i) => (b ^ subtract[i]) as Bit);
    const step: SyncStep = { k: k + 1, input, prev: R, shifted, broughtDown, feedback, subtract, after4, next: after4.slice(1), lfsr: lfsr.steps[k] };
    R = step.next;
    return step;
  });
}

export const bitsToGF8 = (bits: readonly Bit[]): GF8 => bitsToInt(bits);
