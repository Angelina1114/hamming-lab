import { describe, expect, it } from 'vitest';
import {
  type Bit,
  G74,
  G_MSB,
  H74,
  PARITY_INDICES,
  alphaMultiplierXors,
  bchRedundancy,
  buildField,
  cosetSizes,
  encodeCyclic,
  fieldMul,
  gf8Mul,
  gfMultiplierNetlist,
  hammingEncoderXors,
  hammingH,
  hammingSyndromeXors,
  intToBits,
  irreduciblePolys,
  lfsrCost,
  lfsrEncoderClocks,
  maskWeight,
  msbToMask,
  orderOfX,
  primitivePolys,
  runLfsr,
  syndromeClocks,
  syndromeTableEntries,
  transpose,
  xorNetworkGates,
} from '../index';

describe('GF(2) polynomials as bitmasks', () => {
  it('finds the irreducible and primitive cubics and quartics', () => {
    expect(irreduciblePolys(3)).toEqual([0b1011, 0b1101]); // x³+x+1, x³+x²+1
    expect(primitivePolys(3)).toEqual([0b1011, 0b1101]);
    expect(irreduciblePolys(4)).toEqual([0b10011, 0b11001, 0b11111]);
    expect(primitivePolys(4)).toEqual([0b10011, 0b11001]); // x⁴+x³+x²+x+1 is irreducible but not primitive
  });

  it('gives LFSR periods (order of x mod p)', () => {
    expect(orderOfX(0b1011)).toBe(7); // walks all 7 non-zero states
    expect(orderOfX(0b1001)).toBe(3); // x³+1 = (x+1)(x²+x+1): x³ = 1, period 3 only
    expect(orderOfX(0b11111)).toBe(5); // irreducible, not primitive: 5 of the 15 states
    expect(orderOfX(0b10011)).toBe(15);
    expect(orderOfX(0b1010)).toBe(0); // p(0) = 0: x not invertible
    // agrees with the field builder used elsewhere
    expect(buildField(3, 0b1011).order).toBe(7);
    expect(buildField(4, 0b10011).order).toBe(15);
  });
});

describe('combinational XOR networks', () => {
  it('Hamming(7,4): 6 XOR gates to encode, 9 to compute the syndrome', () => {
    expect(hammingH(3)).toEqual(H74);
    // encoder: each parity bit is the XOR of the data bits in its G column
    const parityCols = transpose(G74).filter((_, j) => (PARITY_INDICES as readonly number[]).includes(j));
    expect(xorNetworkGates(parityCols)).toBe(6);
    expect(hammingEncoderXors(3)).toBe(6);
    expect(xorNetworkGates(H74)).toBe(9);
    expect(hammingSyndromeXors(3)).toBe(9);
  });

  it('scales as m(2^(m−1) − 2) and m(2^(m−1) − 1)', () => {
    for (let m = 2; m <= 8; m++) {
      expect(hammingEncoderXors(m)).toBe(m * (2 ** (m - 1) - 2));
      expect(hammingSyndromeXors(m)).toBe(m * (2 ** (m - 1) - 1));
    }
    expect(hammingEncoderXors(7)).toBe(434); // Hamming(127,120)
  });
});

describe('LFSR', () => {
  it('costs deg g flip-flops and weight(g) − 1 XOR gates', () => {
    expect(lfsrCost(G_MSB)).toEqual({ flipFlops: 3, xors: 2 });
    expect(lfsrCost([1, 0, 0, 0, 1, 0, 0, 1])).toEqual({ flipFlops: 7, xors: 2 }); // x⁷+x³+1, Hamming(127,120)
    for (const g of [G_MSB, [1, 1, 0, 1] as Bit[], [1, 0, 0, 1, 1] as Bit[], [1, 1, 1, 1, 1] as Bit[]]) {
      expect(lfsrCost(g).xors).toBe(maskWeight(msbToMask(g)) - 1);
    }
  });

  it('matches the stages runLfsr actually XORs into', () => {
    // stages that ever receive feedback, other than R0 (which takes the feedback on a plain wire)
    const run = runLfsr([1, 1, 1, 1, 0, 1, 0, 1], 'encoder');
    const xored = new Set<number>();
    run.steps.forEach((s) => s.mask.forEach((b, d) => b && d < s.mask.length - 1 && xored.add(d)));
    expect(1 + xored.size).toBe(lfsrCost(G_MSB).xors);
  });

  it('encodes in k clocks and needs n clocks overall', () => {
    for (let i = 0; i < 16; i++) {
      const u = intToBits(i, 4);
      const run = runLfsr(u, 'encoder');
      expect(run.steps).toHaveLength(lfsrEncoderClocks(7, 4).message);
      expect(run.final).toEqual(encodeCyclic(u).parity);
    }
    expect(lfsrEncoderClocks(7, 4)).toEqual({ message: 4, parityOut: 3, total: 7 });
    expect(syndromeClocks(7)).toBe(7);
  });
});

describe('GF(2^m) circuits', () => {
  it('multiply-by-α is a shift plus weight(p) − 2 XOR gates', () => {
    expect(alphaMultiplierXors(0b1011)).toBe(1);
    // simulate: shift up, and the bit that falls off the top re-enters at the taps of p
    for (let v = 0; v < 8; v++) {
      const shifted = (v << 1) & 0b111;
      const top = (v >> 2) & 1;
      const out = shifted ^ (top ? 0b011 : 0);
      expect(out).toBe(gf8Mul(v, 2));
    }
  });

  it('a GF(8) multiplier is 9 AND + 8 XOR gates and multiplies correctly', () => {
    const net = gfMultiplierNetlist(3, 0b1011);
    expect(net.ands).toBe(9);
    expect(net.xors).toBe(8);
    for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) expect(net.mul(a, b)).toBe(gf8Mul(a, b));
    const F = buildField(4, 0b10011);
    const net4 = gfMultiplierNetlist(4, 0b10011);
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) expect(net4.mul(a, b)).toBe(fieldMul(F, a, b));
  });
});

describe('table decoding vs algebraic decoding', () => {
  it('a syndrome table has 2^(n−k) entries', () => {
    expect(syndromeTableEntries(7, 4)).toBe(8);
    expect(syndromeTableEntries(127, 120)).toBe(128);
  });

  it('BCH check bits come from whole cyclotomic cosets', () => {
    expect(cosetSizes(3)).toEqual([1, 3, 3]);
    expect(bchRedundancy(3, 1)).toBe(3); // Hamming(7,4)
    expect(bchRedundancy(4, 2)).toBe(8); // BCH(15,7)
    expect(bchRedundancy(4, 3)).toBe(10); // BCH(15,5)
    expect(bchRedundancy(7, 1)).toBe(7); // Hamming(127,120)
    expect(bchRedundancy(7, 2)).toBe(14); // BCH(127,113)
    expect(bchRedundancy(8, 2)).toBe(16); // BCH(255,239)
    expect(bchRedundancy(8, 3)).toBe(24); // BCH(255,231)
    expect(syndromeTableEntries(127, 127 - bchRedundancy(7, 2))).toBe(16384);
    expect(syndromeTableEntries(255, 255 - bchRedundancy(8, 3))).toBe(16777216);
  });
});
