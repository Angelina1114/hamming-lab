import { describe, it, expect } from 'vitest';
import { type Bit, allVectors } from '../gf2';
import { H74 } from '../hamming';
import { analyzeDesign, failingChecks, outcomeTable, singleErrorCandidates, type Design } from '../parityDesign';

const ONE: Design = [[1, 1, 1, 1, 1]]; // one parity bit over D1..D4 P
const TWO: Design = [
  [1, 1, 0, 0, 1, 0], // A: D1 D2 PA
  [0, 0, 1, 1, 0, 1], // B: D3 D4 PB
];

describe('parity designs', () => {
  it('one parity bit: detects odd errors, never locates', () => {
    const a = analyzeDesign(ONE);
    expect(a.locatesEverySingleError).toBe(false);
    expect(a.clashes).toEqual([[0, 1, 2, 3, 4]]);
    expect(failingChecks(ONE, [1, 0, 1, 1, 1])).toEqual([false]); // even → passes
    expect(failingChecks(ONE, [0, 0, 1, 1, 1])).toEqual([true]); // 1 error
    expect(failingChecks(ONE, [0, 1, 1, 1, 1])).toEqual([false]); // 2 errors → passes (fooled)
  });

  it('two parity bits on 4 data bits: 3 nonzero outcomes for 6 positions', () => {
    const a = analyzeDesign(TWO);
    expect(a.outcomes).toBe(4);
    expect(a.locatesEverySingleError).toBe(false);
    expect(singleErrorCandidates(TWO, [true, false])).toEqual([0, 1, 4]);
    expect(singleErrorCandidates(TWO, [true, true])).toEqual([]); // needs ≥ 2 errors
  });

  it('no 2-check design can locate every single error among 6 positions (pigeonhole)', () => {
    // try all 2×6 0/1 matrices
    let found = false;
    for (const r1 of allVectors(6)) for (const r2 of allVectors(6)) if (analyzeDesign([r1, r2]).locatesEverySingleError) found = true;
    expect(found).toBe(false);
  });

  it('Hamming H locates every single error and each check covers exactly 4 positions', () => {
    const a = analyzeDesign(H74);
    expect(a.locatesEverySingleError).toBe(true);
    expect(a.rowWeights).toEqual([4, 4, 4]);
    for (const row of outcomeTable(H74)) expect(row.positions.length).toBe(row.pattern.some(Boolean) ? 1 : 0);
  });

  it('every 3×7 design that locates all single errors has row weights 4, 4, 4', () => {
    // columns must be the 7 distinct nonzero 3-bit vectors in some order; check a sample of permutations exhaustively over column sets
    const cols = allVectors(3).filter((v) => v.some(Boolean));
    let count = 0;
    const perm = (rest: Bit[][], acc: Bit[][]) => {
      if (rest.length === 0) {
        const D: Design = [0, 1, 2].map((i) => acc.map((c) => c[i]));
        const a = analyzeDesign(D);
        expect(a.locatesEverySingleError).toBe(true);
        expect(a.rowWeights).toEqual([4, 4, 4]);
        count++;
        return;
      }
      rest.forEach((c, i) => perm([...rest.slice(0, i), ...rest.slice(i + 1)], [...acc, c]));
    };
    perm(cols, []);
    expect(count).toBe(5040);
  });

  it('shrinking a check to 3 positions always breaks single-error location', () => {
    for (let j = 0; j < 7; j++) {
      if (!H74[0][j]) continue;
      const D = H74.map((row, i) => row.map((v, c) => (i === 0 && c === j ? 0 : v)) as Bit[]);
      expect(analyzeDesign(D).locatesEverySingleError).toBe(false);
    }
  });
});
