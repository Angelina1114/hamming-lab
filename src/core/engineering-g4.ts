/**
 * Engineering numbers for algebra units A7 (Frobenius, cyclotomic cosets) and A8 (minimal polynomials).
 * Every figure those pages state is computed here and pinned in __tests__/engineering-g4.test.ts.
 *
 * Field elements are integers whose bit i is the coefficient of α^i; polynomials are bitmasks with the
 * leading term included (x³+x+1 = 0b1011), as in engineering.ts.
 */
import type { Bit } from './gf2';
import { bchRedundancy, irreduciblePolys, lfsrCost, maskDegree, maskMod, maskWeight, xorNetworkGates } from './engineering';

/* ------------------------------------------------------------------ */
/* A7 — squaring is linear, so a squarer is XOR wiring                 */
/* ------------------------------------------------------------------ */

/**
 * The GF(2) matrix of a ↦ a² in GF(2^m) built from p: entry [r][i] = coefficient of α^r in (α^i)² = α^{2i}.
 * Row r is output bit r; its 1s are the input bits that output bit is the XOR of.
 */
export function squaringMatrix(m: number, p: number): Bit[][] {
  const cols = Array.from({ length: m }, (_, i) => maskMod(1 << (2 * i), p));
  return Array.from({ length: m }, (_, r) => cols.map((c) => ((c >> r) & 1) as Bit));
}

/** two-input XOR gates of the squaring circuit (one XOR tree per output bit) */
export const squarerXors = (m: number, p: number): number => xorNetworkGates(squaringMatrix(m, p));

/** run the squaring circuit (exactly the matrix above) on a field element */
export function squarerApply(m: number, p: number, a: number): number {
  return squaringMatrix(m, p).reduce((acc, row, r) => {
    const bit = row.reduce<number>((s, b, i) => s ^ (b & ((a >> i) & 1)), 0);
    return acc | (bit << r);
  }, 0);
}

/**
 * Check bits a narrow-sense binary BCH code of length 2^m − 1 needs for t errors, versus a naive count that
 * pays m check bits for each of the 2t required roots α, α², …, α^{2t} separately.
 */
export function bchRootBudget(m: number, t: number): { roots: number; naiveBits: number; bits: number } {
  return { roots: 2 * t, naiveBits: 2 * t * m, bits: bchRedundancy(m, t) };
}

/* ------------------------------------------------------------------ */
/* A8 — every divisor of x^n − 1 is a cyclic code an engineer can build */
/* ------------------------------------------------------------------ */

/** plain (unreduced) product of two GF(2) polynomials */
export function maskMul(a: number, b: number): number {
  let r = 0;
  for (let x = a, y = b; y; y >>= 1, x <<= 1) if (y & 1) r ^= x;
  return r;
}

/** MSB-first bit array of a polynomial mask (leading term first), as used by lfsrCost / msbToTex */
export const maskToMsb = (p: number): Bit[] => Array.from({ length: maskDegree(p) + 1 }, (_, k) => ((p >> (maskDegree(p) - k)) & 1) as Bit);

/** the irreducible factors of x^n − 1 over GF(2) (n odd, so each appears once), lowest degree first */
export function factorsOfXnMinus1(n: number): number[] {
  const xn1 = (1 << n) | 1;
  const out: number[] = [];
  for (let d = 1; d <= n; d++) for (const q of irreduciblePolys(d)) if (maskMod(xn1, q) === 0) out.push(q);
  return out;
}

/** minimum weight of the non-zero multiples a(x)g(x), deg a < k: the d_min of the cyclic code ⟨g⟩ */
export function cyclicMinDistance(n: number, g: number): number {
  const k = n - maskDegree(g);
  let best = Infinity;
  for (let a = 1; a < 2 ** k; a++) best = Math.min(best, maskWeight(maskMul(a, g)));
  return best;
}

export interface CyclicCodeOption {
  /** generator polynomial as a mask, and MSB-first */
  g: number;
  gMsb: Bit[];
  /** which irreducible factors of x^n − 1 it is made of */
  factors: number[];
  /** check bits n − k = deg g = LFSR register stages */
  checkBits: number;
  k: number;
  flipFlops: number;
  xors: number;
  dmin: number;
}

/**
 * Every non-trivial cyclic code of length n (n odd): g runs over the products of the irreducible factors of
 * x^n − 1, leaving out g = 1 (no protection) and g = x^n − 1 (only the zero word). Sorted by deg g; within a
 * degree, codes keep the factor order (x³+x+1 before x³+x²+1).
 */
export function cyclicCodeMenu(n: number): CyclicCodeOption[] {
  const fs = factorsOfXnMinus1(n);
  const out: CyclicCodeOption[] = [];
  for (let s = 1; s < 2 ** fs.length - 1; s++) {
    const factors = fs.filter((_, i) => (s >> i) & 1);
    const g = factors.reduce(maskMul, 1);
    const gMsb = maskToMsb(g);
    const cost = lfsrCost(gMsb);
    out.push({ g, gMsb, factors, checkBits: maskDegree(g), k: n - maskDegree(g), flipFlops: cost.flipFlops, xors: cost.xors, dmin: cyclicMinDistance(n, g) });
  }
  return out.sort((a, b) => a.checkBits - b.checkBits); // stable: factor order breaks ties
}

/** reciprocal polynomial x^deg · p(1/x): the LFSR wired in mirror image (its roots are the inverses) */
export function reciprocalMask(p: number): number {
  const d = maskDegree(p);
  let r = 0;
  for (let i = 0; i <= d; i++) if ((p >> i) & 1) r |= 1 << (d - i);
  return r;
}
