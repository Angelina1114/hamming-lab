/**
 * Engineering numbers quoted by the lessons: gate counts, register sizes, clock counts, table sizes
 * and LFSR periods. Every figure the UI states comes from here (and is pinned in engineering.test.ts),
 * never typed into a page by hand.
 *
 * Polynomials are integer bitmasks with the leading term included (x³+x+1 = 0b1011) unless noted;
 * `msb` arguments are MSB-first bit arrays as in cyclic.ts.
 */
import type { Bit } from './gf2';
import { cyclotomicCosets } from './algebra';

/* ------------------------------------------------------------------ */
/* GF(2) polynomials as bitmasks                                       */
/* ------------------------------------------------------------------ */

export const maskDegree = (p: number): number => 31 - Math.clz32(p);
export const maskWeight = (p: number): number => {
  let w = 0;
  for (let v = p; v; v &= v - 1) w++;
  return w;
};
export const msbToMask = (msb: readonly Bit[]): number => msb.reduce<number>((acc, b) => (acc << 1) | b, 0);

/** a mod b over GF(2) */
export function maskMod(a: number, b: number): number {
  const db = maskDegree(b);
  let r = a;
  while (r && maskDegree(r) >= db) r ^= b << (maskDegree(r) - db);
  return r;
}

/** a·b mod p over GF(2) */
export function maskMulMod(a: number, b: number, p: number): number {
  let r = 0;
  let x = a;
  for (let y = b; y; y >>= 1) {
    if (y & 1) r ^= x;
    x <<= 1;
    if (x & (1 << maskDegree(p))) x ^= p;
  }
  return maskMod(r, p);
}

export function isIrreducibleMask(p: number): boolean {
  const d = maskDegree(p);
  if (d < 1) return false;
  for (let q = 2; maskDegree(q) <= d / 2; q++) if (maskMod(p, q) === 0) return false;
  return true;
}

/**
 * Multiplicative order of x modulo p(x) — the period of an LFSR wired from p, i.e. how many clocks
 * before its state repeats. Requires p(0) = 1 (otherwise x has no inverse); returns 0 then.
 */
export function orderOfX(p: number): number {
  if (!(p & 1)) return 0;
  const limit = 2 ** maskDegree(p);
  let v = maskMod(2, p);
  for (let i = 1; i <= limit; i++) {
    if (v === 1) return i;
    v = maskMulMod(v, 2, p);
  }
  return 0;
}

const degreePolys = (m: number): number[] => Array.from({ length: 2 ** m }, (_, i) => (1 << m) | i);
/** all irreducible polynomials of degree m */
export const irreduciblePolys = (m: number): number[] => degreePolys(m).filter(isIrreducibleMask);
/** primitive = irreducible and x has the maximal order 2^m − 1 (α walks through every non-zero element) */
export const primitivePolys = (m: number): number[] => irreduciblePolys(m).filter((p) => orderOfX(p) === 2 ** m - 1);

/* ------------------------------------------------------------------ */
/* Combinational XOR networks (parallel, one clock)                    */
/* ------------------------------------------------------------------ */

/** two-input XOR gates needed to add w signals: a tree of w − 1 gates */
export const xorTree = (w: number): number => Math.max(0, w - 1);

/** one XOR tree per row of a 0/1 matrix (each row = one output bit, its 1s = the inputs it adds) */
export const xorNetworkGates = (rows: readonly (readonly Bit[])[]): number => rows.reduce((acc, row) => acc + xorTree(row.filter((b) => b === 1).length), 0);

/** Hamming(2^m − 1) parity-check matrix in Lesson 1 form: column j (1-based) = binary of j, LSB on the top row */
export const hammingH = (m: number): Bit[][] =>
  Array.from({ length: m }, (_, r) => Array.from({ length: 2 ** m - 1 }, (_, j) => (((j + 1) >> r) & 1) as Bit));

/**
 * Parallel Hamming(2^m − 1, 2^m − 1 − m) encoder (Lesson 1 layout): parity bit P_{2^r} is the XOR of the
 * data positions whose binary contains 2^r. Returns the XOR-gate count.
 */
export function hammingEncoderXors(m: number): number {
  const isParity = (j: number) => (j & (j - 1)) === 0;
  return hammingH(m).reduce((acc, row) => acc + xorTree(row.filter((b, j) => b === 1 && !isParity(j + 1)).length), 0);
}

/** parallel syndrome circuit: each of the m checks XORs every position it covers */
export const hammingSyndromeXors = (m: number): number => xorNetworkGates(hammingH(m));

/* ------------------------------------------------------------------ */
/* LFSR (serial, one bit per clock)                                    */
/* ------------------------------------------------------------------ */

export interface LfsrCost {
  /** register stages = deg g */
  flipFlops: number;
  /** two-input XOR gates: one where the input meets the feedback, plus one per inner tap (0 < j < deg g, g_j = 1) */
  xors: number;
}

/** Hardware of the LFSR in cyclic.ts (encoder and divider wiring cost the same) for g given MSB-first. */
export function lfsrCost(gMsb: readonly Bit[]): LfsrCost {
  const m = gMsb.length - 1;
  const innerTaps = gMsb.slice(1, m).filter((b) => b === 1).length;
  return { flipFlops: m, xors: 1 + innerTaps };
}

/**
 * Clock counts for a systematic (n, k) cyclic encoder: k clocks to push the message through the LFSR
 * (the parity sits in the registers afterwards) and n − k more to shift the parity out — n in total.
 */
export const lfsrEncoderClocks = (n: number, k: number) => ({ message: k, parityOut: n - k, total: n });

/** a syndrome register (divider, or Horner evaluation of r(α)) reads the n received bits one per clock */
export const syndromeClocks = (n: number): number => n;

/* ------------------------------------------------------------------ */
/* GF(2^m) arithmetic circuits                                         */
/* ------------------------------------------------------------------ */

/**
 * "Multiply by α" in GF(2^m) built from p(x): shift every bit up one place; the bit that falls off the top
 * re-enters at the taps of p. A tap at x⁰ is a plain wire (the shifted-in bit is 0); every other inner tap
 * is one XOR. So the circuit is m wires/flip-flops + weight(p) − 2 XOR gates.
 */
export const alphaMultiplierXors = (p: number): number => Math.max(0, maskWeight(p) - 2);

export interface GfMultiplierNetlist {
  ands: number;
  xors: number;
  /** evaluate the netlist (bit-level simulation of exactly the gates counted above) */
  mul: (a: number, b: number) => number;
}

/**
 * Schoolbook GF(2^m) multiplier: m² AND gates form the partial products a_i b_j; XOR trees add them into
 * the 2m − 1 product coefficients; each coefficient of degree ≥ m is then folded back using
 * x^m = p(x) − x^m, one XOR for every lower term of p it is added onto.
 */
export function gfMultiplierNetlist(m: number, p: number): GfMultiplierNetlist {
  const ands = m * m;
  let xors = 0;
  for (let d = 0; d <= 2 * m - 2; d++) xors += xorTree(Math.min(d, 2 * m - 2 - d, m - 1) + 1);
  const low = p ^ (1 << m); // p(x) − x^m, the replacement for x^m
  for (let d = 2 * m - 2; d >= m; d--) xors += maskWeight(low);
  const mul = (a: number, b: number): number => {
    const c = Array.from({ length: 2 * m - 1 }, () => 0);
    for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) c[i + j] ^= ((a >> i) & 1) & ((b >> j) & 1);
    for (let d = 2 * m - 2; d >= m; d--) {
      if (!c[d]) continue;
      for (let t = 0; t < m; t++) if ((low >> t) & 1) c[d - m + t] ^= 1;
      c[d] = 0;
    }
    return c.slice(0, m).reduce((acc, bit, i) => acc | (bit << i), 0);
  };
  return { ands, xors, mul };
}

/* ------------------------------------------------------------------ */
/* Decoding by table vs by algebra                                     */
/* ------------------------------------------------------------------ */

/** a syndrome-lookup decoder for an (n, k) linear code stores one entry per syndrome: 2^(n−k) */
export const syndromeTableEntries = (n: number, k: number): number => 2 ** (n - k);

/**
 * Check bits of the narrow-sense primitive BCH code of length 2^m − 1 that corrects t errors: the generator must
 * have α, α², …, α^{2t} as roots, and every root drags its whole cyclotomic coset along (Frobenius), so
 * n − k = |union of the cosets of 1 … 2t|. t = 1 gives the Hamming code.
 */
export function bchRedundancy(m: number, t: number): number {
  const n = 2 ** m - 1;
  const roots = new Set<number>();
  for (const c of cyclotomicCosets(n)) if (c.some((e) => e >= 1 && e <= 2 * t)) c.forEach((e) => roots.add(e));
  return roots.size;
}

/** sizes of all 2-cyclotomic cosets mod 2^m − 1 (each coset = one minimal polynomial = that many check bits) */
export const cosetSizes = (m: number): number[] => cyclotomicCosets(2 ** m - 1).map((c) => c.length);
