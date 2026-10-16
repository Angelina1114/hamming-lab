/**
 * GF(8) = GF(2)[x] / (p(x)),  p(x) = x³ + x + 1, and the cyclic Hamming Code it defines.
 *
 * COORDINATE CONVENTION (cyclic code):
 *   A 7-bit word is the coefficient vector (c0, c1, …, c6) of c(x) = c0 + c1 x + … + c6 x⁶,
 *   written lowest degree first. This is NOT the [P1,P2,D1,P4,D2,D3,D4] layout of the
 *   standard Hamming(7,4) encoder; the two codes are equivalent only up to the coordinate
 *   permutation computed by `cyclicToStandardPermutation`.
 *
 * Field elements are stored as 3-bit integers b0 + 2·b1 + 4·b2 representing b0 + b1·α + b2·α².
 */
import { type Bit, type BitVector, add, intToBits } from './gf2';
import { type Matrix } from './matrix';

export type GF8 = number; // 0..7

/** p(x) = x³ + x + 1, coefficients low → high. */
export const PRIMITIVE_POLY: BitVector = [1, 1, 0, 1];
const PRIM_MASK = 0b1011;

/** Addition in GF(8) = XOR of coefficient vectors. */
export const gf8Add = (a: GF8, b: GF8): GF8 => a ^ b;

/** Multiplication in GF(8): carry-less multiply, then reduce modulo p(x). */
export function gf8Mul(a: GF8, b: GF8): GF8 {
  let r = 0;
  for (let i = 0; i < 3; i++) if ((b >> i) & 1) r ^= a << i;
  for (let deg = 4; deg >= 3; deg--) if ((r >> deg) & 1) r ^= PRIM_MASK << (deg - 3);
  return r;
}

export interface PowerStep {
  power: number;
  value: GF8;
  /** shifted value before reduction (α · α^{i−1}) */
  shifted: number;
  reduced: boolean;
}

/** α⁰ … α⁶ computed by repeated multiplication by α, recording reductions via α³ = α + 1. */
export function alphaPowerSteps(): PowerStep[] {
  const steps: PowerStep[] = [{ power: 0, value: 1, shifted: 1, reduced: false }];
  let v = 1;
  for (let i = 1; i < 7; i++) {
    const shifted = v << 1;
    const reduced = (shifted & 0b1000) !== 0;
    v = reduced ? shifted ^ PRIM_MASK : shifted;
    steps.push({ power: i, value: v, shifted, reduced });
  }
  return steps;
}

/** ALPHA_POW[i] = α^i for i = 0..6 */
export const ALPHA_POW: GF8[] = alphaPowerSteps().map((s) => s.value);

/** LOG[a] = i such that α^i = a (a ≠ 0) */
export const LOG: Record<number, number> = Object.fromEntries(ALPHA_POW.map((v, i) => [v, i]));

export const alphaPow = (i: number): GF8 => ALPHA_POW[((i % 7) + 7) % 7];

/** Element as a polynomial in α, e.g. 6 → "α² + α". */
export function gf8ToPolyTex(a: GF8): string {
  if (a === 0) return '0';
  const terms: string[] = [];
  if (a & 4) terms.push('\\alpha^2');
  if (a & 2) terms.push('\\alpha');
  if (a & 1) terms.push('1');
  return terms.join(' + ');
}

/** Coefficient vector (b0, b1, b2) of an element. */
export const gf8ToVector = (a: GF8): BitVector => [(a & 1) as Bit, ((a >> 1) & 1) as Bit, ((a >> 2) & 1) as Bit];

/* ------------------------------------------------------------------ */
/* Polynomials over GF(2), coefficients low → high                      */
/* ------------------------------------------------------------------ */

export type Poly = BitVector;

export const polyDegree = (p: Poly): number => {
  for (let i = p.length - 1; i >= 0; i--) if (p[i] === 1) return i;
  return -Infinity;
};

export function polyTrim(p: Poly): Poly {
  const d = polyDegree(p);
  return d === -Infinity ? [] : p.slice(0, d + 1);
}

export function polyAdd(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  return Array.from({ length: n }, (_, i) => add((a[i] ?? 0) as Bit, (b[i] ?? 0) as Bit));
}

export function polyMul(a: Poly, b: Poly): Poly {
  if (a.length === 0 || b.length === 0) return [];
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => 0 as Bit);
  a.forEach((ai, i) => {
    if (ai) b.forEach((bj, j) => (out[i + j] = add(out[i + j], bj)));
  });
  return out;
}

export interface DivisionStep {
  /** degree of the quotient term produced in this step */
  shift: number;
  /** remainder before subtracting */
  before: Poly;
  /** the multiple x^shift · g(x) subtracted */
  subtracted: Poly;
  after: Poly;
}

export function polyDivmod(a: Poly, g: Poly): { quotient: Poly; remainder: Poly; steps: DivisionStep[] } {
  const dg = polyDegree(g);
  if (dg === -Infinity) throw new Error('division by zero polynomial');
  let r = [...a];
  const quotient: Poly = Array.from({ length: Math.max(a.length - dg, 1) }, () => 0 as Bit);
  const steps: DivisionStep[] = [];
  while (polyDegree(r) >= dg) {
    const shift = polyDegree(r) - dg;
    const subtracted: Poly = Array.from({ length: r.length }, () => 0 as Bit);
    g.forEach((gi, i) => {
      if (gi) subtracted[i + shift] = 1;
    });
    const after = polyAdd(r, subtracted).slice(0, r.length);
    steps.push({ shift, before: r, subtracted, after });
    quotient[shift] = 1;
    r = after;
  }
  const remainder = Array.from({ length: dg }, (_, i) => (r[i] ?? 0) as Bit);
  return { quotient, remainder, steps };
}

/** Pad / truncate to exactly n coefficients. */
export const polyToLength = (p: Poly, n: number): Poly => Array.from({ length: n }, (_, i) => (p[i] ?? 0) as Bit);

/** LaTeX of a polynomial in variable `v`, highest degree first, e.g. "x^3 + x + 1". */
export function polyToTex(p: Poly, v = 'x'): string {
  const terms: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    if (p[i] !== 1) continue;
    terms.push(i === 0 ? '1' : i === 1 ? v : `${v}^{${i}}`);
  }
  return terms.length ? terms.join(' + ') : '0';
}

/* ------------------------------------------------------------------ */
/* Cyclic Hamming Code of length 7 with generator g(x) = x³ + x + 1     */
/* ------------------------------------------------------------------ */

export const CYCLIC_N = 7;
export const GENERATOR_POLY: Poly = PRIMITIVE_POLY; // g(x) = p(x): its root α is primitive

/** Non-systematic encoding: c(x) = m(x) g(x), m = (m0, m1, m2, m3). */
export function cyclicEncodeNonSystematic(m: readonly Bit[]): BitVector {
  if (m.length !== 4) throw new Error('message must have 4 bits');
  return polyToLength(polyMul([...m], GENERATOR_POLY), CYCLIC_N);
}

/**
 * Systematic encoding: c(x) = x³ m(x) + (x³ m(x) mod g(x)).
 * Coefficients: (r0, r1, r2, m0, m1, m2, m3) — parity in c0..c2, message in c3..c6.
 */
export function cyclicEncodeSystematic(m: readonly Bit[]): { codeword: BitVector; shifted: Poly; remainder: Poly; steps: DivisionStep[] } {
  if (m.length !== 4) throw new Error('message must have 4 bits');
  const shifted: Poly = [0, 0, 0, ...m];
  const { remainder, steps } = polyDivmod(shifted, GENERATOR_POLY);
  const codeword = polyToLength(polyAdd(shifted, remainder), CYCLIC_N);
  return { codeword, shifted, remainder, steps };
}

/** Cyclic shift by k: (c0,…,c6) ↦ (c_{6},c0,…,c5) for k = 1, i.e. multiply by x mod (x⁷ − 1). */
export function cyclicShift(c: readonly Bit[], k = 1): BitVector {
  const n = c.length;
  return Array.from({ length: n }, (_, i) => c[(((i - k) % n) + n) % n]);
}

/** Evaluate r(α) = Σ r_i α^i ∈ GF(8). */
export function evalAtAlpha(r: readonly Bit[]): GF8 {
  return r.reduce<number>((acc, ri, i) => (ri ? gf8Add(acc, alphaPow(i)) : acc), 0);
}

export interface CyclicDecodeResult {
  syndrome: GF8; // r(α)
  /** 0-based coefficient index of the error (x^j), −1 if syndrome is 0 */
  errorDegree: number;
  corrected: BitVector;
}

/** Single-error decoding via S = r(α) = α^j ⇒ error at x^j. */
export function cyclicDecode(r: readonly Bit[]): CyclicDecodeResult {
  const syndrome = evalAtAlpha(r);
  if (syndrome === 0) return { syndrome, errorDegree: -1, corrected: [...r] };
  const j = LOG[syndrome];
  const corrected = [...r];
  corrected[j] = add(corrected[j], 1);
  return { syndrome, errorDegree: j, corrected };
}

/** Generator matrix of the cyclic code: rows g(x), x g(x), x² g(x), x³ g(x). */
export const CYCLIC_G: Matrix = [0, 1, 2, 3].map((s) => cyclicShift(polyToLength(GENERATOR_POLY, CYCLIC_N), s));

/** Parity-check matrix of the cyclic code: column i is α^i as (b0, b1, b2). */
export const CYCLIC_H: Matrix = [0, 1, 2].map((row) => ALPHA_POW.map((a) => ((a >> row) & 1) as Bit));

/**
 * Coordinate permutation linking the two conventions.
 * Column i of CYCLIC_H is α^i = (b0,b1,b2); column j of the standard H74 is the binary of j with LSB on top.
 * They coincide exactly when j = b0 + 2b1 + 4b2 = ALPHA_POW[i].
 * So cyclic coefficient index i ↦ standard 1-based position ALPHA_POW[i].
 */
export const cyclicToStandardPermutation = (): number[] => [...ALPHA_POW];

/** Re-arrange a cyclic-coordinate word into the standard [P1,P2,D1,P4,D2,D3,D4] positions. */
export function cyclicToStandard(c: readonly Bit[]): BitVector {
  const out: BitVector = Array.from({ length: CYCLIC_N }, () => 0 as Bit);
  ALPHA_POW.forEach((pos, i) => (out[pos - 1] = c[i]));
  return out;
}

/** All 16 codewords of the cyclic code, indexed by message m = (m0..m3). */
export function cyclicCodewords(systematic = false): { message: BitVector; codeword: BitVector }[] {
  return Array.from({ length: 16 }, (_, i) => {
    const message = intToBits(i, 4);
    return { message, codeword: systematic ? cyclicEncodeSystematic(message).codeword : cyclicEncodeNonSystematic(message) };
  });
}
