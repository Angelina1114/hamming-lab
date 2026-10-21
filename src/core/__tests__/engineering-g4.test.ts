import { describe, expect, it } from 'vitest';
import {
  G_MSB,
  bchRedundancy,
  buildField,
  cosetSizes,
  fieldMul,
  frobenius,
  gfMultiplierNetlist,
  intToBits,
  lfsrCost,
  minimalPolynomial,
  syndromeClocks,
  wordAtAlpha,
  wordAtAlphaPower,
} from '../index';
import {
  bchRootBudget,
  cyclicCodeMenu,
  cyclicMinDistance,
  factorsOfXnMinus1,
  maskMul,
  maskToMsb,
  reciprocalMask,
  squarerApply,
  squarerXors,
  squaringMatrix,
} from '../engineering-g4';

describe('A7: the squaring circuit', () => {
  it('GF(8) from x³+x+1: c₀ = a₀, c₁ = a₂, c₂ = a₁ ⊕ a₂ — one XOR gate', () => {
    expect(squaringMatrix(3, 0b1011)).toEqual([
      [1, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
    ]);
    expect(squarerXors(3, 0b1011)).toBe(1);
    for (let a = 0; a < 8; a++) expect(squarerApply(3, 0b1011, a)).toBe(frobenius(a));
  });

  it('is far cheaper than a general multiplier', () => {
    const net = gfMultiplierNetlist(3, 0b1011);
    expect([net.ands, net.xors]).toEqual([9, 8]);
    expect(squarerXors(3, 0b1011)).toBeLessThan(net.xors);
  });

  it('works for GF(16) too', () => {
    const F = buildField(4, 0b10011);
    for (let a = 0; a < 16; a++) expect(squarerApply(4, 0b10011, a)).toBe(fieldMul(F, a, a));
    expect(squarerXors(4, 0b10011)).toBe(2);
  });

  it('r(α²) = r(α)² for every received 7-bit word, so S₂ needs no second pass over the 7 bits', () => {
    for (let i = 0; i < 128; i++) {
      const r = intToBits(i, 7);
      expect(wordAtAlphaPower(r, 2)).toBe(squarerApply(3, 0b1011, wordAtAlpha(r)));
      expect(wordAtAlphaPower(r, 4)).toBe(squarerApply(3, 0b1011, wordAtAlphaPower(r, 2)));
    }
    expect(syndromeClocks(7)).toBe(7);
  });
});

describe('A7: one root costs a whole coset of check bits', () => {
  it('GF(8): cosets 1, 3, 3', () => {
    expect(cosetSizes(3)).toEqual([1, 3, 3]);
    expect(bchRedundancy(3, 1)).toBe(3);
  });

  it('BCH root budget: conjugates come free', () => {
    expect(bchRootBudget(3, 1)).toEqual({ roots: 2, naiveBits: 6, bits: 3 });
    expect(bchRootBudget(4, 2)).toEqual({ roots: 4, naiveBits: 16, bits: 8 }); // BCH(15,7)
    expect(bchRootBudget(8, 3)).toEqual({ roots: 6, naiveBits: 48, bits: 24 }); // BCH(255,231)
  });
});

describe('A8: minimal polynomials are the LFSR wiring', () => {
  it('x⁷ − 1 = (x+1)(x³+x+1)(x³+x²+1)', () => {
    expect(factorsOfXnMinus1(7)).toEqual([0b11, 0b1011, 0b1101]);
    expect(factorsOfXnMinus1(7).reduce(maskMul, 1)).toBe(0b10000001);
    expect(factorsOfXnMinus1(15)).toEqual([0b11, 0b111, 0b10011, 0b11001, 0b11111]);
  });

  it('m_α = x³+x+1 is g(x): 3 register stages, 2 XOR gates; its mirror x³+x²+1 costs the same', () => {
    expect(maskToMsb(0b1011)).toEqual(G_MSB);
    expect(lfsrCost(G_MSB)).toEqual({ flipFlops: 3, xors: 2 });
    expect(reciprocalMask(0b1011)).toBe(0b1101);
    expect(lfsrCost(maskToMsb(reciprocalMask(0b1011)))).toEqual({ flipFlops: 3, xors: 2 });
    // the mirror polynomial is the minimal polynomial of α³ = (α⁴)⁻¹
    expect(minimalPolynomial(3).binary).toEqual([1, 0, 1, 1]); // LSB-first 1 + x² + x³
    expect(minimalPolynomial(1).binary).toEqual([1, 1, 0, 1]); // LSB-first 1 + x + x³
  });

  it('lists every non-trivial cyclic code of length 7 with its cost and protection', () => {
    const menu = cyclicCodeMenu(7).map((o) => [o.g, o.checkBits, o.k, o.flipFlops, o.xors, o.dmin]);
    expect(menu).toEqual([
      [0b11, 1, 6, 1, 1, 2], // single parity check
      [0b1011, 3, 4, 3, 2, 3], // Hamming
      [0b1101, 3, 4, 3, 2, 3], // mirror Hamming
      [0b11101, 4, 3, 4, 3, 4], // (x+1)(x³+x+1): even-weight subcode
      [0b10111, 4, 3, 4, 3, 4], // (x+1)(x³+x²+1)
      [0b1111111, 6, 1, 6, 6, 7], // (x³+x+1)(x³+x²+1) = 1+x+…+x⁶: repetition code
    ]);
    expect(cyclicCodeMenu(7)[1].gMsb).toEqual(G_MSB);
    expect(cyclicMinDistance(7, 0b1011)).toBe(3);
  });
});
