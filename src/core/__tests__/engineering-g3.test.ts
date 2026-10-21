/**
 * Pins every engineering number quoted on A5 (generator polynomial) and A6 (cyclic code), and the facts
 * behind them: the LFSR divider decides membership in n clocks, and a cyclic shift multiplies r(α) by α.
 */
import { describe, expect, it } from 'vitest';
import {
  G_MSB,
  alphaMultiplierXors,
  bchRedundancy,
  gf8Mul,
  hammingEncoderXors,
  hammingSyndromeXors,
  inCyclicCode,
  intToBits,
  lfsrCost,
  lfsrEncoderClocks,
  msbToMask,
  orderOfX,
  polyMaskToMsb,
  primitivePolys,
  rotateLeft,
  runLfsr,
  syndromeClocks,
  syndromeTableEntries,
  wordAtAlpha,
} from '../index';

const G127 = polyMaskToMsb(0b10001001, 7); // x⁷ + x³ + 1

describe('A5: parallel XOR network vs LFSR encoder', () => {
  it('uses the primitive x⁷ + x³ + 1 for Hamming(127,120)', () => {
    expect(G127).toEqual([1, 0, 0, 0, 1, 0, 0, 1]);
    expect(primitivePolys(7)).toContain(msbToMask(G127));
    expect(orderOfX(msbToMask(G127))).toBe(127);
  });

  it('pins the gate, register and clock counts shown on the page', () => {
    expect(hammingEncoderXors(3)).toBe(6);
    expect(hammingEncoderXors(7)).toBe(434);
    expect(lfsrCost(G_MSB)).toEqual({ flipFlops: 3, xors: 2 });
    expect(lfsrCost(G127)).toEqual({ flipFlops: 7, xors: 2 });
    expect(lfsrEncoderClocks(7, 4)).toEqual({ message: 4, parityOut: 3, total: 7 });
    expect(lfsrEncoderClocks(127, 120).total).toBe(127);
  });
});

describe('A6: membership test and shift invariance', () => {
  const ALL = Array.from({ length: 128 }, (_, i) => intToBits(i, 7));

  it('the divider LFSR reads n bits and leaves 0 exactly for codewords', () => {
    for (const w of ALL) {
      const run = runLfsr(w, 'divider');
      expect(run.steps).toHaveLength(syndromeClocks(7));
      expect(run.final.every((b) => b === 0)).toBe(inCyclicCode(w));
    }
    expect(ALL.filter(inCyclicCode)).toHaveLength(16);
  });

  it('pins the syndrome-circuit and table sizes shown on the page', () => {
    expect(hammingSyndromeXors(3)).toBe(9);
    expect(hammingSyndromeXors(7)).toBe(441);
    expect(syndromeClocks(127)).toBe(127);
    expect(syndromeTableEntries(7, 4)).toBe(8);
    expect(syndromeTableEntries(127, 120)).toBe(128);
    expect(bchRedundancy(7, 2)).toBe(14);
    expect(127 - bchRedundancy(7, 2)).toBe(113); // shown as BCH(127,113)
    expect(syndromeTableEntries(127, 127 - bchRedundancy(7, 2))).toBe(16384);
    expect(alphaMultiplierXors(0b1011)).toBe(1);
  });

  it('a left rotation (× x mod x⁷ − 1) multiplies r(α) by α', () => {
    for (const w of ALL) expect(wordAtAlpha(rotateLeft(w, 1))).toBe(gf8Mul(2, wordAtAlpha(w)));
    // a single error at x^i has r(α) = α^i, so moving it one place left multiplies by α
    for (let i = 0; i < 7; i++) {
      const e = intToBits(1 << i, 7);
      expect(wordAtAlpha(rotateLeft(e, 1))).toBe(wordAtAlpha(intToBits(1 << ((i + 1) % 7), 7)));
    }
  });
});
