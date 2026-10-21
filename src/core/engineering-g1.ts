/**
 * Extra engineering figures quoted by the algebra chapter's opening units (A0 concept map, A1 GF(2),
 * A2 why GF(8)). Same rule as engineering.ts: a page never types a gate count or a probability by hand,
 * it calls a function here, and engineering-g1.test.ts pins every value.
 */
import type { Structure } from './algebra';

/** GF(2^m) addition is coefficient-wise XOR: one two-input XOR gate per bit, and no carry between bits. */
export const gfAdderXors = (m: number): number => m;

export interface RippleAdderNetlist {
  xors: number;
  ands: number;
  ors: number;
  /** positions a carry has to travel through before the top output bit is final */
  carryHops: number;
  /** bit-level simulation of the adder (a + b mod 2^m) */
  add: (a: number, b: number) => number;
}

/**
 * The plainest adder for ℤ/2^m (integers mod 2^m): a ripple-carry adder whose final carry is thrown away.
 * Bit 0 is a half adder (1 XOR, plus 1 AND for its carry); bits 1 … m − 1 are full adders (2 XOR for the sum,
 * plus 2 AND + 1 OR for the carry they pass on — the top bit passes nothing on).
 */
export function rippleAdderNetlist(m: number): RippleAdderNetlist {
  let xors = 1;
  let ands = m > 1 ? 1 : 0;
  let ors = 0;
  for (let i = 1; i < m; i++) {
    xors += 2;
    if (i < m - 1) {
      ands += 2;
      ors += 1;
    }
  }
  const add = (a: number, b: number): number => {
    let carry = 0;
    let out = 0;
    for (let i = 0; i < m; i++) {
      const x = (a >> i) & 1;
      const y = (b >> i) & 1;
      const half = x ^ y;
      out |= (half ^ carry) << i;
      carry = (x & y) | (carry & half);
    }
    return out;
  };
  return { xors, ands, ors, carryHops: Math.max(0, m - 1), add };
}

/** non-zero elements with no multiplicative inverse (they can never be divided by) */
export const nonInvertible = (S: Structure): number[] =>
  S.elements.filter((x) => x !== S.zero && !S.elements.some((y) => S.mul(x, y) === S.one));

/** the position whose single-error Syndrome equals that of errors at positions i and j (Lesson 1 layout: XOR of the binaries) */
export const aliasPosition = (i: number, j: number): number => i ^ j;

/** a probability as TeX scientific notation with one decimal, e.g. 7.4 \times 10^{-3} */
export function sciTex(x: number, digits = 1): string {
  if (x === 0) return '0';
  let e = Math.floor(Math.log10(x));
  let mant = Number((x / 10 ** e).toFixed(digits));
  if (mant >= 10) {
    mant /= 10;
    e += 1;
  }
  return `${mant.toFixed(digits)} \\times 10^{${e}}`;
}
