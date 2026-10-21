/**
 * Engineering numbers for algebra units A3 (constructing GF(8)) and A4 (primitive element), on top of
 * engineering.ts. Every figure is pinned in __tests__/engineering-g2.test.ts.
 *
 * Polynomials are integer bitmasks with the leading term included (x³+x+1 = 0b1011).
 */
import type { Bit } from './gf2';
import { irreduciblePolys, maskDegree, maskMulMod, maskWeight } from './engineering';

/**
 * The fixed "multiply by c" circuit of GF(2^m) = GF(2)[x]/(p) is an m×m GF(2) matrix: output bit r is the
 * XOR of the input bits j for which bit r of c·x^j is 1. Rows are returned low bit first.
 */
export function constMulMatrix(c: number, p: number): Bit[][] {
  const m = maskDegree(p);
  const cols = Array.from({ length: m }, (_, j) => maskMulMod(c, 1 << j, p));
  return Array.from({ length: m }, (_, r) => cols.map((col) => ((col >> r) & 1) as Bit));
}

/** two-input XOR gates of that circuit: one XOR tree per output bit */
export const constMulXors = (c: number, p: number): number =>
  constMulMatrix(c, p).reduce((acc, row) => acc + Math.max(0, row.filter((b) => b === 1).length - 1), 0);

/** bit-level simulation of exactly the wiring counted by constMulXors */
export function constMulApply(c: number, p: number, a: number): number {
  return constMulMatrix(c, p).reduce((acc, row, r) => acc | (row.reduce<number>((s, b, j) => s ^ (b & ((a >> j) & 1)), 0) << r), 0);
}

/** fewest terms an irreducible polynomial of degree m can have (fewest feedback taps) */
export const minIrreducibleWeight = (m: number): number => Math.min(...irreduciblePolys(m).map(maskWeight));

/** entries of a full multiplication lookup table of GF(2^m): one per ordered pair (a, b) */
export const mulTableEntries = (m: number): number => (2 ** m) ** 2;

/** entries of a log table plus an antilog table: one per non-zero element each */
export const logAntilogEntries = (m: number): number => 2 * (2 ** m - 1);
