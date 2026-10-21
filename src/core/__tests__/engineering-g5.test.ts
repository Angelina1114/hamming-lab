import { describe, expect, it } from 'vitest';
import {
  type Bit,
  G_MSB,
  H74,
  allVectors,
  allMinimalPolynomials,
  alphaMultiplierXors,
  bchRedundancy,
  cyclotomicCosets,
  hammingParams,
  maskWeight,
  blockFailureProb,
  codewords74,
  codewordsL2,
  cyclicWordToStandard,
  decodeL2,
  encodeCyclic,
  errorVector,
  hFromGF8,
  hammingSyndromeXors,
  intToBits,
  lfsrCost,
  matVec,
  orderOfX,
  polyProduct,
  primitivePolys,
  runLfsr,
  bitsToInt,
  syndromeClocks,
  syndromeTable,
  syndromeTableEntries,
  transpose,
  uncodedFailure,
  vecAdd,
  wordAtAlpha,
  xorNetworkGates,
} from '../index';
import {
  G127_MSB,
  STREAM_MATCH,
  cyclicShiftEscapes,
  doubleErrorStats,
  g127Mask,
  hornerCost,
  hornerTrace,
  logTableEntries,
  sciParts,
  sciTex,
  streamLocate,
} from '../engineering-g5';

const ALL7 = allVectors(7) as Bit[][];

describe('A9: H from GF(8) as a checking circuit', () => {
  const HC = hFromGF8();

  it('column k of H_cyc is the syndrome a single error at position k leaves in the divider register', () => {
    const cols = transpose(HC);
    syndromeTable().forEach((row, k) => expect(cols[k]).toEqual(row.syndrome));
  });

  it('three parity checks = three XOR trees: 9 gates, the same as Lesson 1', () => {
    expect(xorNetworkGates(HC)).toBe(9);
    expect(hammingSyndromeXors(3)).toBe(9);
    expect(xorNetworkGates(HC)).toBe(xorNetworkGates(H74));
  });

  it('the two H differ only by wiring: permute the input wires and reverse the three outputs', () => {
    for (const w of ALL7) expect(matVec(H74, cyclicWordToStandard(w))).toEqual([...matVec(HC, w)].reverse());
  });

  it('Lesson 1 layout is not cyclic; the GF(8) layout is', () => {
    expect(cyclicShiftEscapes(codewords74().map((x) => x.codeword))).toBe(12);
    expect(cyclicShiftEscapes(codewordsL2().map((x) => x.c))).toBe(0);
  });
});

describe('A10: S₁ = r(α) computed serially', () => {
  it('Horner register: 3 flip-flops + 2 XOR, exactly the divider LFSR', () => {
    expect(hornerCost(0b1011)).toEqual({ flipFlops: 3, xors: 2 });
    expect(hornerCost(0b1011)).toEqual(lfsrCost(G_MSB));
    // Hamming(127,120): still 7 flip-flops + 2 XOR, versus a 441-gate parallel network
    expect(primitivePolys(7)).toContain(g127Mask());
    expect(orderOfX(g127Mask())).toBe(127);
    expect(hornerCost(g127Mask())).toEqual({ flipFlops: 7, xors: 2 });
    expect(hornerCost(g127Mask())).toEqual(lfsrCost(G127_MSB));
    expect(hammingSyndromeXors(7)).toBe(441);
  });

  it('Horner XORs = multiply-by-α feedback + one XOR for the incoming bit; stages = check bits', () => {
    expect(alphaMultiplierXors(0b1011)).toBe(1);
    expect(hornerCost(0b1011).xors - alphaMultiplierXors(0b1011)).toBe(1);
    expect(hornerCost(0b1011).flipFlops).toBe(hammingParams(3).n - hammingParams(3).k);
    expect(hornerCost(g127Mask()).flipFlops).toBe(hammingParams(7).n - hammingParams(7).k);
    // the 127-bit generator is a trinomial: 3 terms → 2 XOR gates
    expect(maskWeight(g127Mask())).toBe(3);
  });

  it('S ← S·α ⊕ r_k reproduces the divider state clock by clock and ends at r(α)', () => {
    for (const r of ALL7) {
      const trace = hornerTrace(r);
      expect(trace).toHaveLength(syndromeClocks(7));
      const div = runLfsr(r, 'divider');
      trace.forEach((t, k) => expect(t.state).toBe(bitsToInt(div.states[k + 1])));
      expect(trace[trace.length - 1].state).toBe(wordAtAlpha(r));
    }
  });

  it('the teacher example ends at α⁵ = 111', () => {
    const t = hornerTrace([1, 1, 0, 1, 1, 1, 0]);
    expect(t.map((x) => x.state)).toEqual([1, 3, 6, 6, 6, 6, 7]);
  });
});

describe('A10: from S₁ to the position', () => {
  it('a log table lists the 7 non-zero syndromes', () => {
    expect(logTableEntries(7, 4)).toBe(7);
    expect(logTableEntries(7, 4)).toBe(syndromeTableEntries(7, 4) - 1);
  });

  it('stepping T ← T·α while the word streams out flags the erroneous bit', () => {
    expect(STREAM_MATCH).toBe(0b101);
    expect(streamLocate(0)).toBe(0);
    for (let p = 1; p <= 7; p++) expect(streamLocate(wordAtAlpha(errorVector([p])))).toBe(p);
    for (const { c } of codewordsL2())
      for (let p = 1; p <= 7; p++) {
        const r = vecAdd(c, errorVector([p]));
        expect(streamLocate(wordAtAlpha(r))).toBe(decodeL2(r, 'chien').position);
        expect(streamLocate(wordAtAlpha(r))).toBe(decodeL2(r, 'lookup').position);
      }
  });
});

describe('A10: limits', () => {
  it('every one of the 21 double errors is miscorrected into 3 errors', () => {
    expect(doubleErrorStats()).toEqual({ pairs: 21, miscorrected: 21, errorsAfter: [3] });
  });

  it('two-error correction at length 7 costs 6 check bits: the repetition code', () => {
    expect(bchRedundancy(3, 1)).toBe(3);
    expect(bchRedundancy(3, 2)).toBe(6);
    const all = allMinimalPolynomials();
    expect(polyProduct([all[1].binary!, all[2].binary!])).toEqual([1, 1, 1, 1, 1, 1, 1]);
    expect(bchRedundancy(7, 1)).toBe(7);
    expect(bchRedundancy(7, 2)).toBe(14);
    // the extra 7 check bits are one degree-7 minimal polynomial: the coset of 3 mod 127
    const coset3 = cyclotomicCosets(127).find((c) => c.includes(3))!;
    expect(coset3).toHaveLength(bchRedundancy(7, 2) - bchRedundancy(7, 1));
  });

  it('block error rates at p = 10⁻³', () => {
    expect(sciTex(blockFailureProb(7, 1, 1e-3))).toBe('2.1 \\times 10^{-5}');
    expect(sciTex(uncodedFailure(4, 1e-3))).toBe('4.0 \\times 10^{-3}');
    expect(sciParts(9.96e-4)).toEqual({ mantissa: '1.0', exponent: -3 });
  });

  it('sanity: encodeCyclic is the systematic code used by the pages', () => {
    expect(encodeCyclic(intToBits(9, 4)).codeword).toEqual([1, 0, 0, 1, 1, 1, 0]);
  });
});
