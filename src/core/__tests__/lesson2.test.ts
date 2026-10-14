import { describe, it, expect } from 'vitest';
import { type Bit, allVectors, bitsToString, parseBits, vecAdd, weight } from '../gf2';
import { ALPHA_POW, alphaPow } from '../gf8';
import { minimumDistance } from '../distance';
import {
  G_MSB,
  alphaTerms,
  bitsToField,
  chienSearch,
  codewordsL2,
  combinations,
  decodeL2,
  encodeCyclic,
  encodeSecdedL2,
  errorLocator,
  errorVector,
  evalAtAlphaMsb,
  exponentToPosition,
  fieldToBits,
  longDivision,
  lookupPosition,
  msbToPoly,
  polyModMsb,
  polyToMsb,
  positionToExponent,
  runLfsr,
  secdedDecodeL2,
  simulateL2,
  simulateSecdedL2,
  syndromeL2,
  syndromeTable,
} from '../cyclic';
import { CyclicHamming, buildField, hammingParams, randomBits, rng } from '../gfm';
import { QUIZ_TYPES, makeQuestion, makeQuiz } from '../quiz';

const b = parseBits;
const str = bitsToString;
const MESSAGES = allVectors(4);

describe('bit-order convention', () => {
  it('position, index and exponent are consistent', () => {
    expect(positionToExponent(1)).toBe(6);
    expect(positionToExponent(2)).toBe(5);
    expect(positionToExponent(7)).toBe(0);
    for (let p = 1; p <= 7; p++) expect(exponentToPosition(positionToExponent(p))).toBe(p);
    expect(msbToPoly(b('1011'))).toEqual([1, 1, 0, 1]); // 1 + x + x³
    expect(polyToMsb([1, 1, 0, 1], 4)).toEqual(b('1011'));
    expect(alphaTerms(b('1001110'))).toEqual([6, 3, 2, 1]);
  });
});

describe('Lesson 2 worked example (all values computed)', () => {
  const enc = encodeCyclic(b('1001'));
  it('u = 1001 → 1001000 mod 1011 = 110 → c = 1001110', () => {
    expect(str(enc.shifted)).toBe('1001000');
    expect(str(enc.parity)).toBe('110');
    expect(str(enc.codeword)).toBe('1001110');
    expect(str(enc.division.quotient)).toBe('1010');
  });
  it('single error at position 2: S = 111 = α⁵, σ(z) = 1 + α⁵z, root α², i = 5', () => {
    const r = b('1101110');
    expect(str(syndromeL2(r))).toBe('111');
    const S1 = bitsToField(syndromeL2(r));
    expect(S1).toBe(alphaPow(5));
    expect(errorLocator(S1)).toEqual([1, alphaPow(5)]);
    const chien = chienSearch(errorLocator(S1));
    const roots = chien.filter((c) => c.isRoot);
    expect(roots).toHaveLength(1);
    expect(roots[0].j).toBe(2);
    expect(roots[0].exponent).toBe(5);
    const d = decodeL2(r, 'chien');
    expect(d.position).toBe(2);
    expect(str(d.estimatedError)).toBe('0100000');
    expect(str(d.corrected)).toBe('1001110');
    expect(str(d.message)).toBe('1001');
    expect(d.check).toBe(0);
  });
  it('ĉ(α) = α⁶ + α³ + α² + α = 0', () => {
    const terms = alphaTerms(b('1001110')).map((e) => alphaPow(e));
    expect(terms.reduce((a, x) => a ^ x, 0)).toBe(0);
    expect(evalAtAlphaMsb(b('1001110'))).toBe(0);
  });
  it('two errors (positions 2, 7): r = 1101111, S = 110 = α⁴, miscorrected to 1111111', () => {
    const o = simulateL2(b('1001'), [2, 7]);
    expect(str(o.r)).toBe('1101111');
    expect(str(o.decode.syndrome)).toBe('110');
    expect(o.decode.field).toBe(alphaPow(4));
    expect(alphaPow(5) ^ 1).toBe(alphaPow(4));
    expect(o.decode.position).toBe(3);
    expect(str(o.decode.corrected)).toBe('1111111');
    expect(o.decode.check).toBe(0);
    expect(str(o.decode.message)).toBe('1111');
    expect(o.miscorrection).toBe(true);
  });
  it('three errors (x³, x¹, x⁰): e = g, r = 1000101, S = 000, undetected, û = 1000', () => {
    const o = simulateL2(b('1001'), [4, 6, 7]);
    expect(str(o.e)).toBe('0001011');
    expect(str(o.r)).toBe('1000101');
    expect(str(o.decode.syndrome)).toBe('000');
    expect(o.undetected).toBe(true);
    expect(str(o.decode.message)).toBe('1000');
  });
});

describe('GF(2) long division', () => {
  it('quotient · divisor + remainder = dividend, for every 7-bit dividend', () => {
    allVectors(7).forEach((a) => {
      const { quotient, remainder } = longDivision(a, G_MSB);
      // multiply quotient by g (polynomial product), add remainder
      const q = msbToPoly(quotient);
      const g = msbToPoly(G_MSB);
      const prod = Array.from({ length: 7 }, () => 0);
      q.forEach((qi, i) => qi && g.forEach((gj, j) => gj && (prod[i + j] ^= 1)));
      const rem = msbToPoly(remainder);
      rem.forEach((ri, i) => (prod[i] ^= ri));
      expect(polyToMsb(prod as Bit[], 7)).toEqual(a);
    });
  });
});

describe('LFSR', () => {
  it('premultiplied encoder (rule used in class) fed with u = 1001: 000 → 011 → 110 → 111 → 110', () => {
    const { states, final } = runLfsr(b('1001'), 'encoder');
    expect(states.map(str)).toEqual(['000', '011', '110', '111', '110']);
    expect(str(final)).toBe('110');
  });
  it('the same rule fed with all 7 bits 1001000 does NOT give the parity (it computes x³·x³u(x) mod g)', () => {
    const { states } = runLfsr(b('1001000'), 'encoder');
    expect(states.map(str)).toEqual(['000', '011', '110', '111', '110', '111', '101', '001']);
    expect(str(states[7])).toBe(str(polyModMsb(b('1001000000'), G_MSB)));
  });
  it('divider LFSR fed with 1001000 ends at 110, and every state is the prefix mod g', () => {
    const input = b('1001000');
    const { states } = runLfsr(input, 'divider');
    expect(str(states[7])).toBe('110');
    for (let k = 1; k <= 7; k++) {
      // leading zeros do not change the polynomial
      expect(states[k]).toEqual(polyModMsb([0, 0, 0, ...input.slice(0, k)], G_MSB));
    }
  });
  it('encoder state after k bits = x³·prefix mod g', () => {
    const input = b('1001000');
    const { states } = runLfsr(input, 'encoder');
    for (let k = 1; k <= 7; k++) expect(states[k]).toEqual(polyModMsb([...input.slice(0, k), 0, 0, 0], G_MSB));
  });
  it('for all 16 messages: encoder LFSR = divider LFSR = long division', () => {
    MESSAGES.forEach((u) => {
      const enc = encodeCyclic(u);
      expect(runLfsr(u, 'encoder').final).toEqual(enc.parity);
      expect(runLfsr(enc.shifted, 'divider').final).toEqual(enc.parity);
    });
  });
});

describe('codewords', () => {
  const C = codewordsL2();
  it('16 distinct systematic codewords, each divisible by g and with c(α) = 0', () => {
    expect(new Set(C.map((x) => str(x.c))).size).toBe(16);
    C.forEach(({ u, c }) => {
      expect(c.slice(0, 4)).toEqual(u);
      expect(str(syndromeL2(c))).toBe('000');
      expect(evalAtAlphaMsb(c)).toBe(0);
    });
  });
  it('d_min = 3 and the code is cyclic', () => {
    expect(minimumDistance(C.map((x) => x.c)).dmin).toBe(3);
    const set = new Set(C.map((x) => str(x.c)));
    C.forEach(({ c }) => expect(set.has(str([...c.slice(1), c[0]]))).toBe(true));
  });
  it('1111111 is a codeword (needed for the miscorrection example)', () => {
    expect(str(syndromeL2(b('1111111')))).toBe('000');
  });
});

describe('syndrome lookup table', () => {
  it('matches x^i mod g(x) for every position', () => {
    expect(syndromeTable().map((r) => str(r.syndrome))).toEqual(['101', '111', '110', '011', '100', '010', '001']);
    syndromeTable().forEach((row) => {
      expect(row.field).toBe(alphaPow(row.exponent)); // S(α) = α^i
      expect(lookupPosition(row.syndrome)).toBe(row.position);
    });
  });
  it('syndrome is NOT the binary of the position', () => {
    const asNumber = syndromeTable().map((r) => bitsToField(r.syndrome));
    expect(asNumber).not.toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('GF(8) for Lesson 2', () => {
  it('element table 1, α … α⁶ = 001 010 100 011 110 111 101 and α⁷ = 1', () => {
    expect(ALPHA_POW.map((a) => str(fieldToBits(a)))).toEqual(['001', '010', '100', '011', '110', '111', '101']);
    expect(alphaPow(7)).toBe(1);
  });
});

describe('exhaustive decoding — 16 messages', () => {
  it('7 single errors per codeword: corrected by lookup AND by Chien, both agree (112 cases)', () => {
    let n = 0;
    MESSAGES.forEach((u) => {
      for (let p = 1; p <= 7; p++) {
        const a = simulateL2(u, [p], 'lookup');
        const c = simulateL2(u, [p], 'chien');
        expect(a.success).toBe(true);
        expect(c.success).toBe(true);
        expect(a.decode.position).toBe(p);
        expect(c.decode.position).toBe(p);
        expect(a.decode.check).toBe(0);
        n++;
      }
    });
    expect(n).toBe(112);
  });
  it('21 double errors per codeword: always detected, always miscorrected (336 cases)', () => {
    const pairs = combinations(7, 2);
    expect(pairs).toHaveLength(21);
    MESSAGES.forEach((u) =>
      pairs.forEach((pp) => {
        const o = simulateL2(u, pp);
        expect(o.detected).toBe(true);
        expect(o.miscorrection).toBe(true);
        expect(o.decode.check).toBe(0); // lands on a valid — but wrong — codeword
        expect(simulateL2(u, pp, 'chien').decode.corrected).toEqual(o.decode.corrected);
      }),
    );
  });
  it('35 triple errors per codeword: 7 undetected (e is a codeword), 28 miscorrected, none succeed', () => {
    const triples = combinations(7, 3);
    expect(triples).toHaveLength(35);
    MESSAGES.forEach((u) => {
      let undetected = 0;
      let mis = 0;
      triples.forEach((t) => {
        const o = simulateL2(u, t);
        expect(o.success).toBe(false);
        if (o.undetected) undetected++;
        if (o.miscorrection) mis++;
      });
      expect(undetected).toBe(7);
      expect(mis).toBe(28);
    });
  });
});

describe('SECDED (8,4) on the cyclic code', () => {
  it('appends even overall parity: 1001 → 10011100', () => {
    expect(str(encodeSecdedL2(b('1001')))).toBe('10011100');
    MESSAGES.forEach((u) => expect(weight(encodeSecdedL2(u)) % 2).toBe(0));
  });
  it('no error → no-error; all 8 single errors corrected (incl. overall bit)', () => {
    MESSAGES.forEach((u) => {
      expect(simulateSecdedL2(u, []).result.case).toBe('no-error');
      for (let p = 1; p <= 8; p++) {
        const o = simulateSecdedL2(u, [p]);
        expect(o.success).toBe(true);
        expect(o.result.case).toBe(p === 8 ? 'overall' : 'single');
        expect(o.result.position).toBe(p);
      }
    });
  });
  it('all 28 double errors → double-detected, uncorrectable flag set, data kept (448 cases)', () => {
    const pairs = combinations(8, 2);
    expect(pairs).toHaveLength(28);
    MESSAGES.forEach((u) =>
      pairs.forEach((pp) => {
        const o = simulateSecdedL2(u, pp);
        expect(o.result.case).toBe('double');
        expect(o.result.uncorrectable).toBe(true);
        expect(o.result.output).toEqual(o.r8);
        expect(o.wrongDecision).toBe(false);
      }),
    );
  });
  it('some triple errors are misjudged (guarantee only for ≤ 2 errors)', () => {
    const wrong = combinations(8, 3).filter((t) => simulateSecdedL2(b('1001'), t).wrongDecision);
    expect(wrong.length).toBeGreaterThan(0);
  });
  it('secdedDecodeL2 of the four textbook cases', () => {
    const c8 = encodeSecdedL2(b('1001'));
    expect(secdedDecodeL2(c8).case).toBe('no-error');
    expect(secdedDecodeL2(vecAdd(c8, errorVector([2], 8))).case).toBe('single');
    expect(secdedDecodeL2(vecAdd(c8, errorVector([8], 8))).case).toBe('overall');
    expect(secdedDecodeL2(vecAdd(c8, errorVector([2, 7], 8))).case).toBe('double');
  });
});

describe('larger parameters: GF(128), Hamming(127,120)', () => {
  it('x⁷ + x³ + 1 is primitive; x³ + x + 1 is primitive', () => {
    const F = buildField(7, 0b10001001);
    expect(F.primitive).toBe(true);
    expect(F.order).toBe(127);
    expect(buildField(3, 0b1011).exp).toEqual(ALPHA_POW);
    // a non-primitive example: x⁴ + x³ + x² + x + 1 has order 5
    expect(buildField(4, 0b11111).primitive).toBe(false);
  });
  it('parameters and rates', () => {
    const p3 = hammingParams(3);
    expect([p3.n, p3.k, p3.dmin, p3.hRows, p3.hCols]).toEqual([7, 4, 3, 3, 7]);
    expect(p3.rate).toBeCloseTo(4 / 7);
    const p7 = hammingParams(7);
    expect([p7.n, p7.k, p7.nExt, p7.hRows, p7.hCols]).toEqual([127, 120, 128, 7, 127]);
    expect(p7.rateExt).toBe(0.9375);
  });
  it('Hamming(127,120) corrects every single error on random codewords', () => {
    const code = new CyclicHamming(7, 0b10001001);
    const rand = rng(42);
    for (let trial = 0; trial < 4; trial++) {
      const c = code.encode(randomBits(120, rand));
      expect(code.syndrome(c).every((x) => x === 0)).toBe(true);
      for (let p = 1; p <= 127; p++) {
        const r = [...c];
        r[p - 1] = (r[p - 1] ^ 1) as Bit;
        const d = code.decode(r);
        expect(d.position).toBe(p);
        expect(d.corrected).toEqual(c);
      }
    }
  });
});

describe('quiz generator', () => {
  it('every question has exactly one correct, four distinct options, and an explanation (many seeds)', () => {
    for (let seed = 0; seed < 60; seed++) {
      QUIZ_TYPES.forEach(({ type }) => {
        const q = makeQuestion(type, seed);
        expect(q.options).toHaveLength(4);
        expect(q.options.filter((o) => o.correct)).toHaveLength(1);
        expect(new Set(q.options.map((o) => o.text)).size).toBe(4);
        q.options.forEach((o) => expect(o.why.length).toBeGreaterThan(0));
        expect(q.chapter).toMatch(/^l2-\d+$/);
      });
    }
  });
  it('a full quiz covers all ten topics', () => {
    expect(makeQuiz(1).map((q) => q.type)).toEqual(QUIZ_TYPES.map((t) => t.type));
  });
});
