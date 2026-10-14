import { describe, it, expect } from 'vitest';
import {
  type Bit,
  allVectors,
  bitsToString,
  dot,
  flipBit,
  parseBits,
  unitVector,
  vecAdd,
  weight,
  zeroVector,
} from '../gf2';
import { isZeroMatrix, kernelBasis, kernelBruteForce, matMul, nullity, rank, rref, span, transpose, vecMat, matVec } from '../matrix';
import {
  G74,
  H74,
  PARITY_CHECKS,
  codewords74,
  decode74,
  encode74,
  encode74ByParity,
  extractMessage74,
  isCodeword74,
  matchingColumn,
  simulate74,
  syndrome74,
} from '../hamming';
import { H84, codewords84, encode84, secdedDecode, simulate84 } from '../extended';
import { correctionCapability, hammingDistance, minimumDistance, nearestCodewords, weightDistribution } from '../distance';
import { binomial, hammingBound, partitionByNearest, sphereVolume } from '../bound';
import {
  ALPHA_POW,
  CYCLIC_G,
  CYCLIC_H,
  LOG,
  cyclicCodewords,
  cyclicDecode,
  cyclicEncodeNonSystematic,
  cyclicEncodeSystematic,
  cyclicShift,
  cyclicToStandard,
  evalAtAlpha,
  gf8Mul,
  polyDivmod,
  polyMul,
} from '../gf8';

const MESSAGES = allVectors(4);
const C74 = codewords74().map((e) => e.codeword);
const C84 = codewords84().map((e) => e.codeword);

/** all error vectors of length n with exactly w ones */
function errorsOfWeight(n: number, w: number): Bit[][] {
  return allVectors(n).filter((v) => weight(v) === w);
}

describe('GF(2) arithmetic', () => {
  it('addition is XOR and every element is its own inverse', () => {
    for (const a of [0, 1] as Bit[]) for (const b of [0, 1] as Bit[]) {
      const s = vecAdd([a], [b])[0];
      expect(s).toBe(a ^ b);
      expect(vecAdd([s], [b])[0]).toBe(a);
    }
  });
  it('dot product and weight', () => {
    expect(dot([1, 1, 0, 1], [1, 0, 1, 1])).toBe(0);
    expect(weight(parseBits('0110011'))).toBe(4);
    expect(bitsToString(flipBit(parseBits('0000'), 2))).toBe('0010');
  });
});

describe('Matrix operations and rank–nullity', () => {
  it('rank(H) = 3, nullity(H) = 4, |ker H| = 2^4 = 16', () => {
    expect(rank(H74)).toBe(3);
    expect(nullity(H74)).toBe(4);
    const basis = kernelBasis(H74);
    expect(basis).toHaveLength(4);
    const kernel = span(basis);
    expect(new Set(kernel.map(bitsToString)).size).toBe(16);
    // the spanned kernel equals the brute-force kernel
    const brute = kernelBruteForce(H74).map(bitsToString).sort();
    expect(kernel.map(bitsToString).sort()).toEqual(brute);
  });
  it('kernel basis vectors are linearly independent and lie in ker H', () => {
    const basis = kernelBasis(H74);
    basis.forEach((b) => expect(matVec(H74, b)).toEqual([0, 0, 0]));
    expect(rank(basis)).toBe(4);
  });
  it('rank(G) = 4 and the row space of G equals ker H', () => {
    expect(rank(G74)).toBe(4);
    const rowSpace = span(G74).map(bitsToString).sort();
    const ker = kernelBruteForce(H74).map(bitsToString).sort();
    expect(rowSpace).toEqual(ker);
  });
  it('rref of H has pivots in 3 columns', () => {
    const r = rref(H74);
    expect(r.pivotCols).toHaveLength(3);
    expect(r.freeCols).toHaveLength(4);
  });
  it('rank–nullity holds for every 2×3 binary matrix (exhaustive)', () => {
    for (let mask = 0; mask < 64; mask++) {
      const bits = allVectors(6)[mask];
      const A = [bits.slice(0, 3), bits.slice(3)];
      expect(rank(A) + nullity(A)).toBe(3);
      expect(kernelBruteForce(A)).toHaveLength(2 ** nullity(A));
    }
  });
});

describe('Hamming(7,4) encoder', () => {
  it('default example 1011 → 0110011', () => {
    expect(bitsToString(encode74(parseBits('1011')))).toBe('0110011');
    expect(bitsToString(encode74ByParity(parseBits('1011')).codeword)).toBe('0110011');
  });
  it('parity coverage is derived from binary positions', () => {
    expect(PARITY_CHECKS.map((p) => p.dataTerms)).toEqual([
      ['D1', 'D2', 'D4'],
      ['D1', 'D3', 'D4'],
      ['D2', 'D3', 'D4'],
    ]);
  });
  it('parity-equation encoder agrees with c = mG for all 16 messages', () => {
    MESSAGES.forEach((m) => expect(encode74ByParity(m).codeword).toEqual(vecMat(m, G74)));
  });
  it('all 16 codewords satisfy H cᵀ = 0 and are distinct', () => {
    expect(C74).toHaveLength(16);
    expect(new Set(C74.map(bitsToString)).size).toBe(16);
    C74.forEach((c) => expect(syndrome74(c)).toEqual([0, 0, 0]));
  });
  it('H Gᵀ = 0', () => {
    expect(isZeroMatrix(matMul(H74, transpose(G74)))).toBe(true);
  });
  it('data bits are recoverable from each codeword', () => {
    MESSAGES.forEach((m) => expect(extractMessage74(encode74(m))).toEqual(m));
  });
});

describe('Hamming(7,4) syndrome decoder', () => {
  it('syndrome of a single error at position j equals column j of H (binary of j)', () => {
    for (let j = 0; j < 7; j++) {
      const s = syndrome74(unitVector(7, j));
      expect(matchingColumn(s)).toBe(j);
    }
  });
  it('corrects every single-bit error in every codeword (16 × 7 cases)', () => {
    let cases = 0;
    C74.forEach((c) => {
      for (let j = 0; j < 7; j++) {
        const out = simulate74(c, unitVector(7, j));
        expect(out.success).toBe(true);
        expect(out.decoded.position).toBe(j + 1);
        cases++;
      }
    });
    expect(cases).toBe(112);
  });
  it('no error ⇒ syndrome 0 and nothing changed', () => {
    C74.forEach((c) => {
      const d = decode74(c);
      expect(d.status).toBe('no-error');
      expect(d.corrected).toEqual(c);
    });
  });
  it('every double error is miscorrected (never decoded correctly)', () => {
    C74.forEach((c) => {
      errorsOfWeight(7, 2).forEach((e) => {
        const out = simulate74(c, e);
        expect(out.success).toBe(false);
        expect(out.miscorrection).toBe(true);
        expect(isCodeword74(out.decoded.corrected)).toBe(true);
      });
    });
  });
  it('7 error patterns of weight 3 are undetectable (they are codewords)', () => {
    const undetectable = errorsOfWeight(7, 3).filter((e) => isCodeword74(e));
    expect(undetectable).toHaveLength(7);
  });
});

describe('Hamming distance & minimum distance', () => {
  it('distance basics', () => {
    expect(hammingDistance(parseBits('1011101'), parseBits('1001001'))).toBe(2);
    expect(hammingDistance(parseBits('000'), parseBits('000'))).toBe(0);
  });
  it('Hamming(7,4) has d_min = 3 (exhaustive over all 120 pairs)', () => {
    const r = minimumDistance(C74);
    expect(r.pairsChecked).toBe(120);
    expect(r.dmin).toBe(3);
    expect(correctionCapability(r.dmin)).toBe(1);
  });
  it('for a linear code, d_min = minimum non-zero weight', () => {
    const minWeight = Math.min(...C74.filter((c) => weight(c) > 0).map(weight));
    expect(minWeight).toBe(3);
    expect(weightDistribution(C74, 7)).toEqual([1, 0, 0, 7, 7, 0, 0, 1]);
  });
  it('nearest-codeword decoding agrees with syndrome decoding on all 128 words', () => {
    allVectors(7).forEach((w) => {
      const near = nearestCodewords(w, C74);
      expect(near.unique).toBe(true);
      expect(near.minDistance).toBeLessThanOrEqual(1);
      expect(C74[near.nearest[0]]).toEqual(decode74(w).corrected);
    });
  });
});

describe('Hamming bound & perfect code', () => {
  it('binomials and sphere volume', () => {
    expect(binomial(7, 0)).toBe(1);
    expect(binomial(7, 1)).toBe(7);
    expect(binomial(7, 3)).toBe(35);
    expect(sphereVolume(7, 1)).toBe(8);
    expect(sphereVolume(23, 3)).toBe(2048);
  });
  it('Hamming(7,4) meets the Hamming bound with equality: 16 × 8 = 128', () => {
    const b = hammingBound(7, 4, 1);
    expect(b.lhs).toBe(128);
    expect(b.rhs).toBe(128);
    expect(b.equality).toBe(true);
    expect(b.maxK).toBe(4);
  });
  it('Golay [23,12,7] also meets the bound with equality', () => {
    expect(hammingBound(23, 12, 3).equality).toBe(true);
  });
  it('the 128 words split into 16 disjoint radius-1 spheres of 8 words', () => {
    const p = partitionByNearest(C74, 7);
    expect(p.isPartition).toBe(true);
    expect(p.ties).toHaveLength(0);
    expect(p.groups).toHaveLength(16);
    p.groups.forEach((g, i) => {
      expect(g).toHaveLength(8);
      g.forEach((w) => expect(hammingDistance(w, C74[i])).toBeLessThanOrEqual(1));
    });
    const all = p.groups.flat().map(bitsToString);
    expect(new Set(all).size).toBe(128);
    expect(p.coveringRadius).toBe(1);
  });
  it('the extended code is NOT perfect: ties exist', () => {
    const p = partitionByNearest(C84, 8);
    expect(p.isPartition).toBe(false);
    expect(p.ties.length).toBeGreaterThan(0);
  });
});

describe('Extended Hamming(8,4)', () => {
  it('[7,4,3] → [8,4,4]: 16 distinct even-weight codewords, d_min = 4', () => {
    expect(new Set(C84.map(bitsToString)).size).toBe(16);
    C84.forEach((c) => expect(weight(c) % 2).toBe(0));
    expect(minimumDistance(C84).dmin).toBe(4);
    expect(weightDistribution(C84, 8)).toEqual([1, 0, 0, 0, 14, 0, 0, 0, 1]);
  });
  it('every extended codeword satisfies H84 cᵀ = 0, rank(H84) = 4', () => {
    C84.forEach((c) => expect(matVec(H84, c)).toEqual([0, 0, 0, 0]));
    expect(rank(H84)).toBe(4);
  });
  it('1011 → 01100110', () => {
    expect(bitsToString(encode84(parseBits('1011')))).toBe('01100110');
  });
});

describe('SECDED decoder', () => {
  it('no error ⇒ case no-error for all 16 codewords', () => {
    C84.forEach((c) => expect(secdedDecode(c).case).toBe('no-error'));
  });
  it('corrects every single-bit error, including the overall parity bit (16 × 8 cases)', () => {
    C84.forEach((c) => {
      for (let j = 0; j < 8; j++) {
        const out = simulate84(c, unitVector(8, j));
        expect(out.success).toBe(true);
        expect(out.result.correctedPosition).toBe(j + 1);
        expect(out.result.case).toBe(j === 7 ? 'overall-corrected' : 'single-corrected');
      }
    });
  });
  it('classifies every double-bit error as detected-not-corrected (16 × 28 cases)', () => {
    let cases = 0;
    C84.forEach((c) => {
      errorsOfWeight(8, 2).forEach((e) => {
        const out = simulate84(c, e);
        expect(out.result.case).toBe('double-detected');
        expect(out.result.corrected).toBeNull();
        expect(out.wrongDecision).toBe(false);
        cases++;
      });
    });
    expect(cases).toBe(448);
  });
  it('triple errors can be miscorrected (guarantee only holds for ≤ 2 errors)', () => {
    const c = C84[0];
    const wrong = errorsOfWeight(8, 3).filter((e) => simulate84(c, e).wrongDecision);
    expect(wrong.length).toBeGreaterThan(0);
  });
});

describe('GF(8) and cyclic Hamming code', () => {
  it('α³ = α + 1 and the 7 powers of α are the 7 non-zero elements', () => {
    expect(ALPHA_POW[3]).toBe(0b011);
    expect(new Set(ALPHA_POW).size).toBe(7);
    expect(ALPHA_POW).not.toContain(0);
    expect(gf8Mul(ALPHA_POW[6], ALPHA_POW[1])).toBe(1); // α⁷ = 1
  });
  it('multiplication via logs agrees with direct multiplication', () => {
    for (let a = 1; a < 8; a++) for (let b = 1; b < 8; b++) {
      expect(gf8Mul(a, b)).toBe(ALPHA_POW[(LOG[a] + LOG[b]) % 7]);
    }
  });
  it('polynomial division: m(x)g(x) / g(x) = m(x)', () => {
    MESSAGES.forEach((m) => {
      const { quotient, remainder } = polyDivmod(polyMul(m, [1, 1, 0, 1]), [1, 1, 0, 1]);
      expect(remainder).toEqual([0, 0, 0]);
      expect(quotient.slice(0, 4)).toEqual(m);
    });
  });
  it('every cyclic codeword (both encoders) has c(α) = 0 and lies in ker(CYCLIC_H)', () => {
    for (const sys of [false, true]) {
      cyclicCodewords(sys).forEach(({ codeword }) => {
        expect(evalAtAlpha(codeword)).toBe(0);
        expect(matVec(CYCLIC_H, codeword)).toEqual([0, 0, 0]);
      });
    }
    expect(isZeroMatrix(matMul(CYCLIC_H, transpose(CYCLIC_G)))).toBe(true);
  });
  it('systematic encoding keeps the message in c3..c6', () => {
    MESSAGES.forEach((m) => expect(cyclicEncodeSystematic(m).codeword.slice(3)).toEqual(m));
  });
  it('the code is closed under cyclic shift', () => {
    const set = new Set(cyclicCodewords().map((e) => bitsToString(e.codeword)));
    cyclicCodewords().forEach(({ codeword }) => {
      for (let k = 1; k < 7; k++) expect(set.has(bitsToString(cyclicShift(codeword, k)))).toBe(true);
    });
  });
  it('same code set from both encoders; d_min = 3', () => {
    const a = cyclicCodewords(false).map((e) => bitsToString(e.codeword)).sort();
    const b = cyclicCodewords(true).map((e) => bitsToString(e.codeword)).sort();
    expect(a).toEqual(b);
    expect(minimumDistance(cyclicCodewords().map((e) => e.codeword)).dmin).toBe(3);
  });
  it('single errors are located by r(α) = α^j', () => {
    cyclicCodewords().forEach(({ codeword }) => {
      for (let j = 0; j < 7; j++) {
        const d = cyclicDecode(flipBit(codeword, j));
        expect(d.errorDegree).toBe(j);
        expect(d.corrected).toEqual(codeword);
      }
    });
  });
  it('after the coordinate permutation, every cyclic codeword is a standard Hamming codeword', () => {
    const std = new Set(C74.map(bitsToString));
    cyclicCodewords().forEach(({ codeword }) => expect(std.has(bitsToString(cyclicToStandard(codeword)))).toBe(true));
  });
  it('WITHOUT the permutation the two layouts do not give the same word for the same message', () => {
    // e.g. message 1011 under the two conventions
    const m = [1, 0, 1, 1] as Bit[];
    expect(bitsToString(cyclicEncodeNonSystematic(m))).not.toBe(bitsToString(encode74(m)));
    // and the raw cyclic code set differs from the standard code set
    const std = new Set(C74.map(bitsToString));
    const raw = cyclicCodewords().map((e) => bitsToString(e.codeword));
    expect(raw.every((w) => std.has(w))).toBe(false);
    expect(zeroVector(7)).toEqual(cyclicEncodeNonSystematic([0, 0, 0, 0]));
  });
});
