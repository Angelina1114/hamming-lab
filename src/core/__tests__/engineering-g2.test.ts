import { describe, expect, it } from 'vitest';
import {
  type Bit,
  G_MSB,
  alphaMultiplierXors,
  buildField,
  gfMultiplierNetlist,
  intToBits,
  irreduciblePolys,
  lfsrCost,
  longDivision,
  maskDegree,
  maskMod,
  maskMulMod,
  maskWeight,
  orderOfX,
  polysOfDegree,
  primitivePolys,
  runLfsr,
  syndromeClocks,
} from '..';
import { constMulApply, constMulMatrix, constMulXors, logAntilogEntries, minIrreducibleWeight, mulTableEntries } from '../engineering-g2';

const P3 = 0b1011; // x³ + x + 1
const P3R = 0b1101; // x³ + x² + 1
const P4_NONPRIM = 0b11111; // x⁴ + x³ + x² + x + 1
const P7 = 0b10001001; // x⁷ + x³ + 1 (Lesson 2-12)
const P8_RS = 0b100011101; // x⁸ + x⁴ + x³ + x² + 1 (GF(2⁸) of byte-oriented Reed–Solomon)

describe('A3: choosing p(x) for GF(8)', () => {
  it('8 monic cubics, only 2 irreducible, both primitive, both with the minimum 3 terms', () => {
    expect(polysOfDegree(3).length).toBe(8);
    expect(irreduciblePolys(3)).toEqual([P3, P3R]);
    expect(primitivePolys(3)).toEqual([P3, P3R]);
    expect(irreduciblePolys(3).map(maskWeight)).toEqual([3, 3]);
    expect(minIrreducibleWeight(3)).toBe(3);
    expect(maskWeight(P3)).toBe(3);
    // fewer than 3 terms ⇒ reducible (no constant term ⇒ root 0; even weight ⇒ root 1)
    for (let p = 8; p < 16; p++) if (maskWeight(p) < 3) expect(irreduciblePolys(3)).not.toContain(p);
  });

  it('multiply-by-α: shift + 1 XOR for both irreducible cubics', () => {
    expect(alphaMultiplierXors(P3)).toBe(1);
    expect(alphaMultiplierXors(P3R)).toBe(1);
    expect(constMulXors(2, P3)).toBe(alphaMultiplierXors(P3));
    expect(constMulXors(2, P3R)).toBe(alphaMultiplierXors(P3R));
  });

  it('LFSR period: x³+x+1 walks all 7 states, reducible cubics repeat early, p(0)=0 never returns', () => {
    expect(orderOfX(P3)).toBe(7);
    expect(orderOfX(0b1001)).toBe(3); // x³ + 1
    expect(orderOfX(0b1111)).toBe(4); // (x + 1)³
    for (const p of [0b1000, 0b1010, 0b1100, 0b1110]) expect(orderOfX(p)).toBe(0);
    // positions i and i + 3 share the label x^i mod (x³ + 1)
    for (let i = 0; i < 4; i++) expect(maskMod(1 << i, 0b1001)).toBe(maskMod(1 << (i + 3), 0b1001));
  });

  it('GF(8) general multiplier and the encoder LFSR of Lesson 2', () => {
    const net = gfMultiplierNetlist(3, P3);
    expect([net.ands, net.xors]).toEqual([9, 8]);
    expect(lfsrCost(G_MSB)).toEqual({ flipFlops: 3, xors: 2 });
    expect(maskDegree(P3)).toBe(lfsrCost(G_MSB).flipFlops); // one register per bit of a GF(8) element
    // the encoder has exactly one XOR more than multiply-by-α: the message input
    expect(lfsrCost(G_MSB).xors - alphaMultiplierXors(P3)).toBe(1);
  });

  it('divider LFSR leaves r(x) mod g(x) after one clock per bit, for every 7-bit dividend', () => {
    expect(syndromeClocks(7)).toBe(7);
    for (let v = 0; v < 128; v++) {
      const d = intToBits(v, 7) as Bit[];
      const run = runLfsr(d, 'divider');
      expect(run.steps.length).toBe(syndromeClocks(d.length));
      expect(run.final).toEqual(longDivision(d, G_MSB).remainder);
    }
  });
});

describe('A4: α cycle and primitive polynomials', () => {
  it('constant multipliers: the wiring computes c·a, and α is the cheapest of the bases α, α³, α⁴', () => {
    for (let c = 0; c < 8; c++) for (let a = 0; a < 8; a++) expect(constMulApply(c, P3, a)).toBe(maskMulMod(c, a, P3));
    expect(constMulMatrix(2, P3)).toEqual([
      [0, 0, 1],
      [1, 0, 1],
      [0, 1, 0],
    ]);
    expect([1, 2, 3, 4, 5, 6, 7].map((c) => constMulXors(c, P3))).toEqual([0, 1, 4, 2, 1, 4, 3]);
    expect(Math.min(...[2, 3, 6].map((c) => constMulXors(c, P3)))).toBe(constMulXors(2, P3));
  });

  it('log / antilog tables versus a full multiplication table', () => {
    expect(mulTableEntries(3)).toBe(64);
    expect(logAntilogEntries(3)).toBe(14);
    expect(mulTableEntries(8)).toBe(65536);
    expect(logAntilogEntries(8)).toBe(510);
    expect(primitivePolys(8)).toContain(P8_RS);
    expect(orderOfX(P8_RS)).toBe(255);
    expect(buildField(8, P8_RS).primitive).toBe(true);
  });

  it('GF(16): 3 irreducible quartics, 2 primitive; the non-primitive one repeats every 5 clocks', () => {
    expect(irreduciblePolys(4).length).toBe(3);
    expect(primitivePolys(4).length).toBe(2);
    expect(irreduciblePolys(4)).toContain(P4_NONPRIM);
    expect(primitivePolys(4)).not.toContain(P4_NONPRIM);
    expect(orderOfX(P4_NONPRIM)).toBe(5);
    expect(buildField(4, P4_NONPRIM).order).toBe(5);
    expect([buildField(4, P4_NONPRIM).m, buildField(4, P4_NONPRIM).size - 1]).toEqual([4, 15]);
    expect(orderOfX(0b10011)).toBe(15);
    // as a length-15 cyclic code's g(x): single errors at i and i + 5 give the same syndrome
    for (let i = 0; i < 10; i++) expect(maskMod(1 << i, P4_NONPRIM)).toBe(maskMod(1 << (i + 5), P4_NONPRIM));
  });

  it('a one-place cyclic shift (multiply by x mod x⁷ + 1) multiplies the Syndrome by α', () => {
    const rotl = (r: number) => ((r << 1) | (r >> 6)) & 0x7f; // bit i = coefficient of x^i
    for (let r = 0; r < 128; r++) expect(maskMod(rotl(r), P3)).toBe(maskMulMod(maskMod(r, P3), 2, P3));
  });

  it('Lesson 2-12: x⁷ + x³ + 1 runs 127 clocks before repeating', () => {
    expect(orderOfX(P7)).toBe(127);
    expect(maskDegree(P7)).toBe(7); // register stages of that LFSR
  });
});
