import { describe, expect, it } from 'vitest';
import {
  G_MSB,
  GF8_FIELD,
  H74,
  blockFailureProb,
  bchRedundancy,
  column,
  gf8Add,
  gfMultiplierNetlist,
  hammingEncoderXors,
  hammingParams,
  hammingSyndromeXors,
  lfsrCost,
  lfsrEncoderClocks,
  msbToTex,
  orderOfX,
  primitivePolys,
  syndromeClocks,
  syndromeTableEntries,
  vecAdd,
  zmod,
} from '../index';
import { aliasPosition, gfAdderXors, nonInvertible, rippleAdderNetlist, sciTex } from '../engineering-g1';

describe('adders: GF(8) vs ℤ/8', () => {
  it('GF(2^m) addition is m XOR gates and agrees with gf8Add', () => {
    expect(gfAdderXors(3)).toBe(3);
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) expect(a ^ b).toBe(gf8Add(a, b));
  });

  it('a mod-8 ripple-carry adder is 5 XOR + 3 AND + 1 OR with a 2-hop carry chain, and adds correctly', () => {
    const r = rippleAdderNetlist(3);
    expect([r.xors, r.ands, r.ors, r.carryHops]).toEqual([5, 3, 1, 2]);
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) expect(r.add(a, b)).toBe((a + b) % 8);
    for (let m = 1; m <= 6; m++) {
      const n = rippleAdderNetlist(m);
      for (let a = 0; a < 2 ** m; a++) for (let b = 0; b < 2 ** m; b++) expect(n.add(a, b)).toBe((a + b) % 2 ** m);
    }
    expect(rippleAdderNetlist(1)).toMatchObject({ xors: 1, ands: 0, ors: 0, carryHops: 0 });
  });

  it('ℤ/8 has three non-zero elements that cannot be divided by; GF(8) has none', () => {
    expect(nonInvertible(zmod(8))).toEqual([2, 4, 6]);
    expect(nonInvertible(GF8_FIELD)).toEqual([]);
    expect(zmod(8).mul(2, 4)).toBe(0);
  });

  it('GF(8) multiplier from x³+x+1: 9 AND + 8 XOR', () => {
    const net = gfMultiplierNetlist(3, 0b1011);
    expect([net.ands, net.xors]).toEqual([9, 8]);
  });
});

describe('two errors alias onto one position (A2)', () => {
  it('errors at 3 and 5 give the syndrome of a single error at 6', () => {
    expect(aliasPosition(3, 5)).toBe(6);
    expect(vecAdd(column(H74, 2), column(H74, 4))).toEqual(column(H74, 5));
    expect(gf8Add(3, 5)).toBe(6);
  });
});

describe('figures shown in A0 and A1', () => {
  it('Lesson 1 XOR networks and Hamming(7,4) LFSR', () => {
    expect(hammingEncoderXors(3)).toBe(6);
    expect(hammingSyndromeXors(3)).toBe(9);
    expect(lfsrCost(G_MSB)).toEqual({ flipFlops: 3, xors: 2 });
    expect(lfsrEncoderClocks(7, 4).message).toBe(4);
    expect(syndromeClocks(7)).toBe(7);
    expect(syndromeTableEntries(7, 4)).toBe(8);
  });

  it('Hamming(127,120): x⁷+x³+1 is primitive; LFSR 7 flip-flops + 2 XOR vs 434 parallel XOR gates', () => {
    const g7 = [1, 0, 0, 0, 1, 0, 0, 1] as const;
    expect(primitivePolys(7)).toContain(0b10001001);
    expect(orderOfX(0b10001001)).toBe(127);
    expect(lfsrCost([...g7])).toEqual({ flipFlops: 7, xors: 2 });
    expect(msbToTex([...g7])).toBe('x^{7} + x^{3} + 1');
    expect(hammingEncoderXors(7)).toBe(434);
    expect(lfsrEncoderClocks(127, 120).total).toBe(127);
    expect(hammingParams(7)).toMatchObject({ n: 127, k: 120 });
  });

  it('code rates 4/7 and 120/127', () => {
    expect(hammingParams(3).rate).toBeCloseTo(4 / 7, 12);
    expect(hammingParams(7).rate).toBeCloseTo(120 / 127, 12);
    expect(Math.round(hammingParams(3).rate * 100)).toBe(57);
    expect(Math.round(hammingParams(7).rate * 100)).toBe(94);
  });

  it('BSC block error rates at p = 10⁻³: Hamming(7,4), Hamming(127,120), BCH(127,113)', () => {
    expect(sciTex(blockFailureProb(7, 1, 1e-3))).toBe('2.1 \\times 10^{-5}');
    expect(sciTex(blockFailureProb(127, 1, 1e-3))).toBe('7.4 \\times 10^{-3}');
    expect(sciTex(blockFailureProb(127, 2, 1e-3))).toBe('3.0 \\times 10^{-4}');
  });

  it('syndrome tables of multi-error BCH codes', () => {
    expect(127 - bchRedundancy(7, 2)).toBe(113);
    expect(syndromeTableEntries(127, 127 - bchRedundancy(7, 2))).toBe(16384);
    expect(255 - bchRedundancy(8, 3)).toBe(231);
    expect(syndromeTableEntries(255, 255 - bchRedundancy(8, 3)).toLocaleString('en-US')).toBe('16,777,216');
  });
});

describe('sciTex', () => {
  it('formats with one decimal and carries a rounded 10.0 into the exponent', () => {
    expect(sciTex(0.0073642)).toBe('7.4 \\times 10^{-3}');
    expect(sciTex(0.000996)).toBe('1.0 \\times 10^{-3}');
    expect(sciTex(0.5)).toBe('5.0 \\times 10^{-1}');
    expect(sciTex(0)).toBe('0');
  });
});
