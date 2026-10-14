/**
 * Lesson 2 — systematic cyclic Hamming(7,4) with g(x) = x³ + x + 1.
 *
 * BIT-ORDER CONVENTION (used everywhere in Lesson 2):
 *   A bit string is written MSB-first: the LEFTMOST bit is the coefficient of the HIGHEST power.
 *   For a length-n word, left-to-right position p = 1..n  ↔  array index p − 1  ↔  exponent n − p.
 *   e.g. 1001110 = x⁶ + x³ + x² + x, and "position 2" is the coefficient of x⁵.
 *
 * Systematic encoding: c(x) = x³u(x) + (x³u(x) mod g(x)), so c = u ‖ p (message in the 4 leftmost bits).
 * Field elements of GF(8) are integers b0 + 2b1 + 4b2 (b_i = coefficient of αⁱ), shown MSB-first as "b2 b1 b0".
 */
import { type Bit, bitsToInt, intToBits, isZeroVector, sum, vecAdd, weight, zeroVector } from './gf2';
import { type GF8, LOG, alphaPow, gf8Add, gf8Mul, polyToTex } from './gf8';

export const L2_N = 7;
export const L2_K = 4;
export const L2_R = 3;
/** g(x) = x³ + x + 1, MSB-first */
export const G_MSB: Bit[] = [1, 0, 1, 1];
export const DEFAULT_U: Bit[] = [1, 0, 0, 1];

/* ------------------------------------------------------------------ */
/* Index / exponent / position                                         */
/* ------------------------------------------------------------------ */

/** 1-based left-to-right position → exponent of x */
export const positionToExponent = (pos: number, n = L2_N): number => n - pos;
/** exponent of x → 1-based left-to-right position */
export const exponentToPosition = (e: number, n = L2_N): number => n - e;
/** 0-based array index → exponent */
export const indexToExponent = (idx: number, n = L2_N): number => n - 1 - idx;

/** MSB-first bits → polynomial coefficients low→high (the representation used in gf8.ts). */
export const msbToPoly = (bits: readonly Bit[]): Bit[] => [...bits].reverse();
/** polynomial (low→high) → MSB-first bits of length n */
export const polyToMsb = (p: readonly Bit[], n: number): Bit[] => Array.from({ length: n }, (_, k) => (p[n - 1 - k] ?? 0) as Bit);
/** LaTeX for an MSB-first bit string, e.g. 1011 → x^{3} + x + 1 */
export const msbToTex = (bits: readonly Bit[], v = 'x'): string => polyToTex(msbToPoly(bits), v);

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
/** "x⁶" style label for exponent e (plain text, for small UI labels) */
export const expLabel = (e: number, v = 'x'): string => (e === 0 ? '1' : e === 1 ? v : v + String(e).split('').map((c) => SUP[c]).join(''));

/** unit error vector with a 1 at the given 1-based positions */
export function errorVector(positions: number[], n = L2_N): Bit[] {
  const e = zeroVector(n);
  positions.forEach((p) => (e[p - 1] = (e[p - 1] ^ 1) as Bit));
  return e;
}

/* ------------------------------------------------------------------ */
/* GF(2) long division, MSB-first                                       */
/* ------------------------------------------------------------------ */

export interface LongDivStep {
  /** 0-based column where the divisor's leading bit is aligned */
  col: number;
  /** 'xor' when the leading bit was 1, 'skip' when it was 0 (divisor shifted past it) */
  kind: 'xor' | 'skip';
  before: Bit[];
  after: Bit[];
  /** exponent of the quotient term produced at this column */
  quotientExp: number;
}

export interface LongDivResult {
  dividend: Bit[];
  divisor: Bit[];
  steps: LongDivStep[];
  /** MSB-first, length = len(dividend) − deg(divisor) */
  quotient: Bit[];
  /** MSB-first, length = deg(divisor) */
  remainder: Bit[];
}

/** Binary long division over GF(2). The divisor must start with 1. */
export function longDivision(dividend: readonly Bit[], divisor: readonly Bit[]): LongDivResult {
  if (divisor[0] !== 1) throw new Error('divisor must be MSB-first with a leading 1');
  const d = divisor.length - 1;
  const n = dividend.length;
  if (n < d) throw new Error('dividend shorter than divisor degree');
  let work = [...dividend];
  const steps: LongDivStep[] = [];
  const quotient: Bit[] = [];
  for (let col = 0; col + d < n; col++) {
    const before = [...work];
    const lead = work[col];
    if (lead === 1) {
      work = work.map((b, i) => (i >= col && i <= col + d ? ((b ^ divisor[i - col]) as Bit) : b));
    }
    quotient.push(lead);
    steps.push({ col, kind: lead ? 'xor' : 'skip', before, after: [...work], quotientExp: n - 1 - col - d });
  }
  return { dividend: [...dividend], divisor: [...divisor], steps, quotient, remainder: work.slice(n - d) };
}

/** a(x) mod g(x), MSB-first in and out (remainder length = deg g). */
export const polyModMsb = (a: readonly Bit[], g: readonly Bit[] = G_MSB): Bit[] => longDivision(a, g).remainder;

/* ------------------------------------------------------------------ */
/* LFSR                                                                */
/* ------------------------------------------------------------------ */

export type LfsrKind = 'encoder' | 'divider';

export interface LfsrStep {
  t: number;
  input: Bit;
  /** registers before the clock, display order [R_{m−1}, …, R_0] */
  before: Bit[];
  feedback: Bit;
  /** registers after the shift but before the feedback XOR, same display order */
  shifted: Bit[];
  /** g_j · feedback for each register, same display order (what gets XOR-ed in) */
  mask: Bit[];
  after: Bit[];
}

/**
 * Clock an m-stage LFSR for g(x) (MSB-first, leading 1), display order [R_{m−1} … R_0].
 *
 * 'encoder' (premultiplied by x^m — the rule used in class):
 *      feedback = input ⊕ R_{m−1};   R_j' = R_{j−1} ⊕ g_j·feedback  (R_{−1} := 0)
 *   For g = x³+x+1:  R2' = R1,  R1' = R0 ⊕ fb,  R0' = fb.
 *   After feeding bits b₁…b_k the state equals x^m·b(x) mod g(x)  → feed only the k message bits.
 *
 * 'divider' (plain division):
 *      feedback = R_{m−1};           R_j' = R_{j−1} ⊕ g_j·feedback  (R_{−1} := input)
 *   After feeding b₁…b_k the state equals b(x) mod g(x)  → feed the zero-padded word x^m·u(x).
 */
export function runLfsr(input: readonly Bit[], kind: LfsrKind, g: readonly Bit[] = G_MSB, init?: readonly Bit[]): { steps: LfsrStep[]; states: Bit[][]; final: Bit[] } {
  const m = g.length - 1;
  const gLow = msbToPoly(g); // g_0 … g_m
  let R: Bit[] = init ? [...init] : zeroVector(m); // display order: index d ↔ R_{m−1−d}
  const steps: LfsrStep[] = [];
  const states: Bit[][] = [[...R]];
  input.forEach((bit, t) => {
    const top = R[0];
    const feedback = (kind === 'encoder' ? bit ^ top : top) as Bit;
    // shift toward R_{m−1}: R_j ← R_{j−1}; the lowest stage receives 0 (encoder) or the input (divider)
    const shifted: Bit[] = [...R.slice(1), (kind === 'divider' ? bit : 0) as Bit];
    const mask: Bit[] = R.map((_, d) => (gLow[m - 1 - d] & feedback) as Bit);
    const after = shifted.map((b, d) => (b ^ mask[d]) as Bit);
    steps.push({ t, input: bit, before: [...R], feedback, shifted, mask, after });
    R = after;
    states.push([...R]);
  });
  return { steps, states, final: R };
}

/* ------------------------------------------------------------------ */
/* Encoding                                                            */
/* ------------------------------------------------------------------ */

export interface L2Encoding {
  u: Bit[];
  /** x³u(x) as MSB-first 7 bits (u followed by three zeros) */
  shifted: Bit[];
  division: LongDivResult;
  parity: Bit[];
  codeword: Bit[];
}

export function encodeCyclic(u: readonly Bit[]): L2Encoding {
  if (u.length !== L2_K) throw new Error('message must be 4 bits');
  const shifted = [...u, 0, 0, 0] as Bit[];
  const division = longDivision(shifted, G_MSB);
  const parity = division.remainder;
  return { u: [...u], shifted, division, parity, codeword: [...u, ...parity] };
}

export const extractMessageL2 = (word: readonly Bit[]): Bit[] => word.slice(0, L2_K);

export function codewordsL2(): { u: Bit[]; c: Bit[] }[] {
  return Array.from({ length: 16 }, (_, i) => {
    const u = intToBits(i, 4);
    return { u, c: encodeCyclic(u).codeword };
  });
}

/* ------------------------------------------------------------------ */
/* GF(8) view of the syndrome                                          */
/* ------------------------------------------------------------------ */

/** 3-bit MSB-first remainder (coeffs of x², x, 1) → GF(8) element: since g(α) = 0, S(α) is that element. */
export const bitsToField = (s: readonly Bit[]): GF8 => bitsToInt(s);
/** GF(8) element → MSB-first 3-bit string (α², α, 1) */
export const fieldToBits = (a: GF8): Bit[] => intToBits(a, 3);
/** α-power label of a field element, null for 0 */
export const fieldLog = (a: GF8): number | null => (a === 0 ? null : LOG[a]);

/** Evaluate an MSB-first word at α: Σ word_k · α^{exponent(k)} */
export function evalAtAlphaMsb(word: readonly Bit[]): GF8 {
  const n = word.length;
  return word.reduce<number>((acc, b, k) => (b ? gf8Add(acc, alphaPow(n - 1 - k)) : acc), 0);
}

/** the α-powers that contribute to word(α), as exponents (highest first) */
export const alphaTerms = (word: readonly Bit[]): number[] => word.flatMap((b, k) => (b ? [word.length - 1 - k] : []));

/* ------------------------------------------------------------------ */
/* Syndrome, lookup table, key equation, Chien search                   */
/* ------------------------------------------------------------------ */

/** S(x) = r(x) mod g(x), MSB-first 3 bits */
export const syndromeL2 = (r: readonly Bit[]): Bit[] => polyModMsb(r, G_MSB);

export interface LookupRow {
  position: number;
  exponent: number;
  syndrome: Bit[];
  field: GF8;
}

/** Syndrome of every single-bit error, computed (not typed in). */
export function syndromeTable(n = L2_N): LookupRow[] {
  return Array.from({ length: n }, (_, k) => {
    const position = k + 1;
    const s = syndromeL2(errorVector([position], n));
    return { position, exponent: positionToExponent(position, n), syndrome: s, field: bitsToField(s) };
  });
}

/** Lookup: syndrome → 1-based position (0 if syndrome is zero) */
export function lookupPosition(s: readonly Bit[]): number {
  if (isZeroVector(s)) return 0;
  const row = syndromeTable().find((r) => r.syndrome.every((b, i) => b === s[i]));
  return row ? row.position : -1;
}

/** Error-locator polynomial for a single error, coefficients in z (low → high): σ(z) = 1 + S₁z. */
export const errorLocator = (S1: GF8): GF8[] => (S1 === 0 ? [1] : [1, S1]);

export interface ChienStep {
  j: number; // trial z = α^j
  z: GF8;
  /** S₁ · z */
  product: GF8;
  /** σ(z) = 1 + S₁z */
  value: GF8;
  isRoot: boolean;
  /** if root: error exponent i with z = α^{−i} */
  exponent: number | null;
}

/** Evaluate σ(z) at z = α⁰ … α⁶. A root z = α^j means X = z⁻¹ = α^{−j}, i.e. exponent i = (7 − j) mod 7. */
export function chienSearch(sigma: GF8[]): ChienStep[] {
  return Array.from({ length: 7 }, (_, j) => {
    const z = alphaPow(j);
    let value = 0;
    let zp = 1;
    let product = 0;
    sigma.forEach((coef, deg) => {
      const term = gf8Mul(coef, zp);
      if (deg === 1) product = term;
      value = gf8Add(value, term);
      zp = gf8Mul(zp, z);
    });
    const isRoot = value === 0;
    return { j, z, product, value, isRoot, exponent: isRoot ? (7 - j) % 7 : null };
  });
}

export type L2Method = 'lookup' | 'chien';

export interface L2Decode {
  received: Bit[];
  syndrome: Bit[];
  field: GF8;
  sigma: GF8[];
  chien: ChienStep[];
  /** error exponent located (−1 if none) */
  exponent: number;
  /** 1-based position located (0 if none) */
  position: number;
  estimatedError: Bit[];
  corrected: Bit[];
  message: Bit[];
  /** ĉ(α) — 0 for every valid codeword */
  check: GF8;
}

/** Single-error decoder. Both methods are implemented independently and must agree. */
export function decodeL2(r: readonly Bit[], method: L2Method = 'lookup'): L2Decode {
  const syndrome = syndromeL2(r);
  const field = bitsToField(syndrome);
  const sigma = errorLocator(field);
  const chien = chienSearch(sigma);
  let position = 0;
  if (field !== 0) {
    if (method === 'lookup') position = lookupPosition(syndrome);
    else {
      const root = chien.find((c) => c.isRoot);
      position = root ? exponentToPosition(root.exponent!) : -1;
    }
  }
  const estimatedError = position > 0 ? errorVector([position]) : zeroVector(L2_N);
  const corrected = vecAdd(r, estimatedError);
  return {
    received: [...r],
    syndrome,
    field,
    sigma,
    chien,
    exponent: position > 0 ? positionToExponent(position) : -1,
    position,
    estimatedError,
    corrected,
    message: extractMessageL2(corrected),
    check: evalAtAlphaMsb(corrected),
  };
}

export interface L2Outcome {
  u: Bit[];
  c: Bit[];
  e: Bit[];
  r: Bit[];
  errorCount: number;
  decode: L2Decode;
  /** decoder noticed something (syndrome ≠ 0) */
  detected: boolean;
  /** recovered message equals the original */
  success: boolean;
  /** decoder changed bits but produced the wrong codeword */
  miscorrection: boolean;
  /** errors present but syndrome = 0 */
  undetected: boolean;
}

export function simulateL2(u: readonly Bit[], errorPositions: number[], method: L2Method = 'lookup'): L2Outcome {
  const c = encodeCyclic(u).codeword;
  const e = errorVector(errorPositions);
  const r = vecAdd(c, e);
  const decode = decodeL2(r, method);
  const errorCount = weight(e);
  const success = decode.corrected.every((b, i) => b === c[i]);
  const detected = decode.field !== 0;
  return {
    u: [...u],
    c,
    e,
    r,
    errorCount,
    decode,
    detected,
    success,
    miscorrection: detected && !success,
    undetected: errorCount > 0 && !detected,
  };
}

/* ------------------------------------------------------------------ */
/* SECDED: 7-bit cyclic codeword + overall even-parity bit (position 8) */
/* ------------------------------------------------------------------ */

export type SecdedL2Case = 'no-error' | 'single' | 'overall' | 'double';

export interface SecdedL2 {
  received: Bit[];
  syndrome: Bit[];
  /** parity of all 8 received bits: 0 = even (consistent), 1 = odd */
  parity: Bit;
  case: SecdedL2Case;
  /** 1..8 corrected position, 0 if none */
  position: number;
  /** corrected word; for a double error the received data are kept unchanged */
  output: Bit[];
  /** decoder raised the uncorrectable-error flag */
  uncorrectable: boolean;
  message: Bit[];
}

export const encodeSecdedL2 = (u: readonly Bit[]): Bit[] => {
  const c = encodeCyclic(u).codeword;
  return [...c, sum(c)];
};

export function secdedDecodeL2(r8: readonly Bit[]): SecdedL2 {
  if (r8.length !== 8) throw new Error('SECDED word must be 8 bits');
  const syndrome = syndromeL2(r8.slice(0, 7));
  const parity = sum(r8);
  const sZero = isZeroVector(syndrome);
  let kase: SecdedL2Case;
  let position = 0;
  if (sZero && parity === 0) kase = 'no-error';
  else if (!sZero && parity === 1) {
    kase = 'single';
    position = lookupPosition(syndrome);
  } else if (sZero && parity === 1) {
    kase = 'overall';
    position = 8;
  } else kase = 'double';
  const output = [...r8];
  if (position > 0) output[position - 1] = (output[position - 1] ^ 1) as Bit;
  return { received: [...r8], syndrome, parity, case: kase, position, output, uncorrectable: kase === 'double', message: output.slice(0, 4) };
}

export interface SecdedL2Outcome {
  c8: Bit[];
  e: Bit[];
  r8: Bit[];
  result: SecdedL2;
  errorCount: number;
  success: boolean;
  /** produced a word (no flag) but it is wrong */
  wrongDecision: boolean;
}

export function simulateSecdedL2(u: readonly Bit[], errorPositions: number[]): SecdedL2Outcome {
  const c8 = encodeSecdedL2(u);
  const e = errorVector(errorPositions, 8);
  const r8 = vecAdd(c8, e);
  const result = secdedDecodeL2(r8);
  const success = !result.uncorrectable && result.output.every((b, i) => b === c8[i]);
  return { c8, e, r8, result, errorCount: weight(e), success, wrongDecision: !result.uncorrectable && !success };
}

/** All k-subsets of {1..n} (positions), lexicographic */
export function combinations(n: number, k: number): number[][] {
  const out: number[][] = [];
  const rec = (start: number, acc: number[]) => {
    if (acc.length === k) return void out.push([...acc]);
    for (let i = start; i <= n; i++) rec(i + 1, [...acc, i]);
  };
  rec(1, []);
  return out;
}
