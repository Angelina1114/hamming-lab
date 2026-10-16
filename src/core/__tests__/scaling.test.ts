import { describe, it, expect } from 'vitest';
import { type Bit, weight } from '../gf2';
import { kernelBasis, span, type Matrix } from '../matrix';
import { binomial } from '../bound';
import { anyOf, blockFailureProb, checkBitsFor, pairCount, planBlocks, scalingTable, shortenedHamming, shortenedPositions, uncodedFailure } from '../scaling';

/** Direct formula P(≥ 2 errors) = 1 − (1−p)^n − n p (1−p)^(n−1); fine when p is not tiny. */
const direct = (n: number, p: number) => 1 - (1 - p) ** n - n * p * (1 - p) ** (n - 1);

describe('blockFailureProb', () => {
  it('matches the direct formula for moderate p', () => {
    for (const n of [3, 7, 15, 31, 63, 127, 255]) {
      for (const p of [1e-1, 1e-2, 1e-3]) {
        expect(blockFailureProb(n, 1, p)).toBeCloseTo(direct(n, p), 12);
      }
    }
  });

  it('stays accurate for tiny p (leading term C(n,2)p²)', () => {
    for (const n of [7, 127]) {
      const p = 1e-9;
      const lead = binomial(n, 2) * p * p;
      expect(Math.abs(blockFailureProb(n, 1, p) / lead - 1)).toBeLessThan(1e-6);
    }
  });

  it('handles t = 0 and edge probabilities', () => {
    expect(blockFailureProb(7, 0, 0.1)).toBeCloseTo(1 - 0.9 ** 7, 12);
    expect(blockFailureProb(7, 1, 0)).toBe(0);
    expect(blockFailureProb(7, 7, 0.3)).toBe(0);
  });

  it('agrees with the numbers quoted in the lesson (p = 10⁻³)', () => {
    expect(blockFailureProb(7, 1, 1e-3)).toBeCloseTo(2.09e-5, 7);
    expect(blockFailureProb(127, 1, 1e-3)).toBeCloseTo(7.36e-3, 5);
  });
});

describe('anyOf / uncodedFailure', () => {
  it('equals 1 − Π(1 − q)', () => {
    const qs = [0.1, 0.2, 0.05];
    expect(anyOf(qs)).toBeCloseTo(1 - 0.9 * 0.8 * 0.95, 12);
    expect(anyOf([])).toBe(0);
    expect(anyOf([1, 0.2])).toBe(1);
  });
  it('uncoded: P(any error in L bits)', () => {
    expect(uncodedFailure(120, 1e-3)).toBeCloseTo(1 - 0.999 ** 120, 12);
  });
});

describe('shortened Hamming codes', () => {
  it('picks the smallest r with 2^r − r − 1 ≥ k', () => {
    expect(checkBitsFor(1)).toBe(2);
    expect(checkBitsFor(4)).toBe(3);
    expect(checkBitsFor(5)).toBe(4);
    expect(checkBitsFor(11)).toBe(4);
    expect(checkBitsFor(12)).toBe(5);
    expect(checkBitsFor(120)).toBe(7);
    expect(checkBitsFor(121)).toBe(8);
  });

  it('gives the familiar parameters', () => {
    expect(shortenedHamming(4)).toMatchObject({ r: 3, n: 7, shortenedBy: 0, nSecded: 8 });
    expect(shortenedHamming(8)).toMatchObject({ r: 4, parentN: 15, parentK: 11, shortenedBy: 3, n: 12, nSecded: 13 });
    expect(shortenedHamming(64)).toMatchObject({ r: 7, parentN: 127, parentK: 120, shortenedBy: 56, n: 71, nSecded: 72 });
    expect(shortenedHamming(120)).toMatchObject({ r: 7, n: 127, shortenedBy: 0, nSecded: 128 });
    expect(shortenedHamming(64).rateSecded).toBe(64 / 72);
  });

  it('keeps every parity position and exactly k data positions, all columns distinct and nonzero', () => {
    for (let k = 1; k <= 300; k++) {
      const { kept, removed, r } = shortenedPositions(k);
      expect(kept.length).toBe(k + r);
      expect(kept.length + removed.length).toBe(2 ** r - 1);
      for (let i = 0; i < r; i++) expect(kept).toContain(2 ** i);
      expect(new Set(kept).size).toBe(kept.length); // columns = binary of position: distinct ⇔ positions distinct
      expect(kept.every((j) => j >= 1)).toBe(true);
    }
  });

  it('brute force: shortened codes still have d_min = 3 (so they still correct 1 error)', () => {
    for (const k of [1, 2, 3, 5, 8, 10, 13, 16]) {
      const { kept, r } = shortenedPositions(k);
      const H: Matrix = Array.from({ length: r }, (_, i) => kept.map((j) => ((j >> i) & 1) as Bit));
      const C = span(kernelBasis(H), kept.length);
      expect(C.length).toBe(2 ** k);
      const dmin = C.reduce((m, c) => (weight(c) > 0 ? Math.min(m, weight(c)) : m), Infinity);
      expect(dmin).toBe(3);
    }
  });
});

describe('planBlocks / scalingTable', () => {
  it('splits 120 data bits into (7,4) blocks', () => {
    const p = planBlocks(120, 3, 1e-3);
    expect(p).toMatchObject({ fullBlocks: 30, tail: 0, blocks: 30, sent: 210 });
    expect(p.overhead).toBeCloseTo(0.75, 12);
    expect(p.pAnyFail).toBeCloseTo(1 - (1 - direct(7, 1e-3)) ** 30, 12);
    expect(p.pAnyFail).toBeCloseTo(6.28e-4, 6);
  });

  it('uses one shortened block for the remainder', () => {
    const p = planBlocks(120, 4, 1e-3); // (15,11): 10 full blocks + (14,10)
    expect(p).toMatchObject({ fullBlocks: 10, tail: 10, blocks: 11, sent: 164 });
    expect(p.pAnyFail).toBeCloseTo(1 - (1 - direct(15, 1e-3)) ** 10 * (1 - direct(14, 1e-3)), 12);
  });

  it('one (127,120) block for 120 bits', () => {
    const p = planBlocks(120, 7, 1e-3);
    expect(p).toMatchObject({ fullBlocks: 1, tail: 0, blocks: 1, sent: 127 });
  });

  it('64 data bits fit one shortened (71,64) block at r = 7', () => {
    const p = planBlocks(64, 7, 1e-3);
    expect(p).toMatchObject({ fullBlocks: 0, tail: 64, blocks: 1, sent: 71 });
  });

  it('table runs from r = 3 to the first r that fits L in one block', () => {
    expect(scalingTable(120, 1e-3).map((x) => x.r)).toEqual([3, 4, 5, 6, 7]);
    expect(scalingTable(64, 1e-3).map((x) => x.r)).toEqual([3, 4, 5, 6, 7]);
    expect(scalingTable(4, 1e-3).map((x) => x.r)).toEqual([3]);
    const t = scalingTable(4096, 1e-4);
    expect(t.at(-1)!.blocks).toBe(1);
    expect(t.at(-2)!.blocks).toBeGreaterThan(1);
  });

  it('longer codes send fewer bits but fail more often (L = 120)', () => {
    const t = scalingTable(120, 1e-3);
    for (let i = 1; i < t.length; i++) {
      expect(t[i].sent).toBeLessThan(t[i - 1].sent);
      expect(t[i].pAnyFail).toBeGreaterThan(t[i - 1].pAnyFail);
    }
  });
});

describe('pairCount (small-p approximation)', () => {
  it('Σ C(n_b, 2) over the blocks', () => {
    expect(pairCount(120, 3)).toBe(30 * 21);
    expect(pairCount(120, 7)).toBe(8001);
    expect(pairCount(120, 4)).toBe(10 * 105 + 91); // (15,11)×10 + (14,10)
  });
  it('P(any block fails) / p² → pairCount as p → 0', () => {
    for (const [L, r] of [[120, 3], [120, 7], [4096, 13]] as const) {
      const p = 1e-7;
      expect(planBlocks(L, r, p).pAnyFail / (p * p) / pairCount(L, r)).toBeCloseTo(1, 3);
    }
  });
});

