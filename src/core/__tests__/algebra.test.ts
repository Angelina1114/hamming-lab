import { describe, it, expect } from 'vitest';
import { type Bit, allVectors, bitsToString, intToBits, parseBits, vecAdd, unitVector } from '../gf2';
import { ALPHA_POW, LOG, alphaPow, gf8Add, gf8Mul, polyMul } from '../gf8';
import { matMul, matVec, transpose, vecMat, isZeroMatrix, rank } from '../matrix';
import { H74, isCodeword74 } from '../hamming';
import { G_MSB, chienSearch, codewordsL2, encodeCyclic, errorLocator, polyModMsb, runLfsr, syndromeL2, bitsToField } from '../cyclic';
import {
  GF2,
  GF8_FIELD,
  GF8_ELEMENTS,
  allMinimalPolynomials,
  alphaPowerTrace,
  characteristic,
  checkFieldAxioms,
  cosetOrbit,
  cubic,
  cyclicGenerator,
  cyclicWordToStandard,
  cyclotomicCosets,
  encodeNonSystematic,
  evalGF2,
  factorGF2,
  frobenius,
  gf8Inverse,
  gf8MulTrace,
  gf8Order,
  gfPolyEval,
  hFromGF8,
  inCyclicCode,
  isField,
  isIrreducible,
  lfsrDivisionSync,
  minimalPolynomial,
  mulModXn1,
  polyDivides,
  polyEq,
  polyMulTrace,
  polyProduct,
  polysOfDegree,
  primitiveElements,
  quotientRing,
  rotateLeft,
  wordAtAlpha,
  wordAtAlphaPower,
  xn1,
  zmod,
} from '../algebra';

const s = bitsToString;
const ALL7 = allVectors(7);
const MSGS = allVectors(4);
const NONSYS = MSGS.map((m) => encodeNonSystematic(m));

describe('A1 · GF(2)', () => {
  it('addition and multiplication are mod 2 (17)', () => {
    for (const a of [0, 1]) for (const b of [0, 1]) {
      expect(GF2.add(a, b)).toBe((a + b) % 2);
      expect(GF2.mul(a, b)).toBe((a * b) % 2);
      expect(GF2.add(a, b)).toBe(a ^ b); // XOR
    }
    expect(GF2.add(1, 1)).toBe(0);
  });
  it('GF(2) is a field of characteristic 2', () => {
    expect(isField(GF2)).toBe(true);
    expect(characteristic(GF2)).toBe(2);
  });
  it('Hamming Hcᵀ is a GF(2) computation: every coordinate is a sum mod 2', () => {
    ALL7.forEach((c) => {
      const s1 = H74.map((row) => row.reduce<number>((acc, h, j) => acc + h * c[j], 0) % 2);
      expect(s1).toEqual(matVec(H74, c));
    });
  });
});

describe('A2 · GF(8) vs ℤ/8', () => {
  it('GF(8) has exactly 8 distinct elements (1)', () => {
    expect(new Set(GF8_ELEMENTS).size).toBe(8);
    expect(GF8_ELEMENTS.every((a) => a >= 0 && a < 8)).toBe(true);
  });
  it('every nonzero element has a multiplicative inverse (2)', () => {
    GF8_ELEMENTS.filter((a) => a).forEach((a) => expect(gf8Mul(a, gf8Inverse(a))).toBe(1));
  });
  it('GF(8) satisfies every field axiom (exhaustive over all pairs/triples) (6)', () => {
    checkFieldAxioms(GF8_FIELD).forEach((r) => expect(r.holds, r.zh).toBe(true));
    expect(characteristic(GF8_FIELD)).toBe(2);
  });
  it('ℤ/8 is NOT a field: 2 has no inverse and 2·4 = 0', () => {
    const Z8 = zmod(8);
    expect(isField(Z8)).toBe(false);
    expect(Z8.mul(2, 4)).toBe(0);
    expect([1, 2, 3, 4, 5, 6, 7].filter((a) => [1, 2, 3, 4, 5, 6, 7].some((b) => Z8.mul(a, b) === 1))).toEqual([1, 3, 5, 7]);
    expect(characteristic(Z8)).toBe(8);
  });
});

describe('A3 · constructing GF(8)', () => {
  it('p(x) = x³+x+1 has no root in GF(2) and is irreducible', () => {
    const p = cubic(0, 1, 1);
    expect(evalGF2(p, 0)).toBe(1);
    expect(evalGF2(p, 1)).toBe(1);
    expect(isIrreducible(p)).toBe(true);
  });
  it('a cubic over GF(2) is irreducible ⇔ it has no root (all 8 monic cubics)', () => {
    polysOfDegree(3).forEach((p) => expect(isIrreducible(p)).toBe(evalGF2(p, 0) === 1 && evalGF2(p, 1) === 1));
    expect(polysOfDegree(3).filter(isIrreducible).map((p) => p.join(''))).toEqual(['1101', '1011']); // x³+x+1, x³+x²+1
  });
  it('GF(2)[x]/(q) is a field exactly when q is irreducible (all 8 monic cubics)', () => {
    polysOfDegree(3).forEach((q) => expect(isField(quotientRing(q))).toBe(isIrreducible(q)));
  });
  it('the quotient by x³+x+1 is exactly our GF(8) multiplication', () => {
    const R = quotientRing(cubic(0, 1, 1));
    GF8_ELEMENTS.forEach((a) => GF8_ELEMENTS.forEach((b) => expect(R.mul(a, b)).toBe(gf8Mul(a, b))));
  });
  it('α³ = α + 1 (3)', () => {
    expect(alphaPow(3)).toBe(0b011);
    expect(gf8Add(alphaPow(3), alphaPow(1))).toBe(1);
  });
  it('hand-calculation multiplication trace agrees with table multiplication and with logs (6)', () => {
    GF8_ELEMENTS.forEach((a) =>
      GF8_ELEMENTS.forEach((b) => {
        const t = gf8MulTrace(a, b);
        expect(t.result).toBe(gf8Mul(a, b));
        if (a && b) expect(t.result).toBe(ALPHA_POW[(LOG[a] + LOG[b]) % 7]);
        expect(t.result).toBeLessThan(8);
      }),
    );
  });
  it('power trace: α⁴ = α² + α computed from α·α³', () => {
    const tr = alphaPowerTrace(7);
    expect(tr[4].shifted).toBe(0b110); // α·(α+1) = α²+α, no reduction needed
    expect(tr[4].value).toBe(0b110);
    expect(tr[5].reduced).toBe(true);
    expect(tr[7].value).toBe(1);
  });
});

describe('A4 · primitive element', () => {
  it('powers of α in (α², α, 1) form (5)', () => {
    expect(alphaPowerTrace(7).map((t) => s(intToBits(t.value, 3)))).toEqual(['001', '010', '100', '011', '110', '111', '101', '001']);
  });
  it('α⁷ = 1 and α has multiplicative order 7 (4)', () => {
    expect(gf8Order(2)).toBe(7);
    for (let k = 1; k < 7; k++) expect(alphaPow(k)).not.toBe(1);
  });
  it('every nonzero element ≠ 1 is primitive (7 is prime); orders divide 7', () => {
    expect(primitiveElements()).toEqual([2, 3, 4, 5, 6, 7]);
    GF8_ELEMENTS.filter((a) => a).forEach((a) => expect(7 % gf8Order(a)).toBe(0));
  });
});

describe('A5 · generator polynomial and G_cyclic', () => {
  it('m = 1011 → c(x) = (x³+x+1)² = x⁶+x²+1 → 1000101', () => {
    expect(s(encodeNonSystematic(parseBits('1011')))).toBe('1000101');
    const t = polyMulTrace(parseBits('1011'), G_MSB);
    expect(t.counts.some((c) => c === 2)).toBe(true); // like terms cancel mod 2
  });
  it('polyMulTrace equals gf8.polyMul for all 4-bit × 4-bit pairs', () => {
    MSGS.forEach((a) =>
      MSGS.forEach((b) => {
        const viaLow = polyMul([...a].reverse() as Bit[], [...b].reverse() as Bit[]).reverse();
        expect(polyMulTrace(a, b).result).toEqual(viaLow);
      }),
    );
  });
  it('G_cyclic rows are x³g, x²g, xg, g', () => {
    expect(cyclicGenerator().map(s)).toEqual(['1011000', '0101100', '0010110', '0001011']);
    expect(rank(cyclicGenerator())).toBe(4);
  });
  it('coordinate consistency: mG_cyclic = m(x)g(x) for all 16 messages (18)', () => {
    MSGS.forEach((m) => expect(vecMat(m, cyclicGenerator())).toEqual(encodeNonSystematic(m)));
  });
  it('all non-systematic codewords pass the H_cyclic check (12)', () => {
    NONSYS.forEach((c) => expect(matVec(hFromGF8(), c)).toEqual([0, 0, 0]));
  });
  it('systematic and non-systematic encoders give the SAME code but different maps', () => {
    const sys = codewordsL2().map((x) => s(x.c)).sort();
    expect(NONSYS.map(s).sort()).toEqual(sys);
    expect(s(encodeNonSystematic(parseBits('1001')))).not.toBe(s(encodeCyclic(parseBits('1001')).codeword));
  });
});

describe('A6 · cyclic code, R₇ and ideal', () => {
  it('g(x) divides x⁷ − 1 (7)', () => {
    expect(polyDivides([1, 1, 0, 1], xn1(7))).toBe(true);
  });
  it('0001011 → 0010110 → 0101100 (multiply by x)', () => {
    expect(s(rotateLeft(parseBits('0001011')))).toBe('0010110');
    expect(s(rotateLeft(parseBits('0001011'), 2))).toBe('0101100');
  });
  it('rotation equals multiplication by x mod x⁷ − 1, for every word', () => {
    ALL7.forEach((c) => expect(rotateLeft(c)).toEqual(mulModXn1(c, parseBits('10')).folded));
  });
  it('C is an ideal: closed under + and under multiplication by ANY r(x) ∈ R₇ (128 × 16)', () => {
    NONSYS.forEach((a) => NONSYS.forEach((b) => expect(inCyclicCode(vecAdd(a, b))).toBe(true)));
    ALL7.forEach((r) => NONSYS.forEach((c) => expect(inCyclicCode(mulModXn1(r, c).folded)).toBe(true)));
  });
});

describe('A7 · Frobenius and cyclotomic cosets', () => {
  it('(a+b)² = a² + b², (ab)² = a²b², and squaring is a bijection', () => {
    GF8_ELEMENTS.forEach((a) =>
      GF8_ELEMENTS.forEach((b) => {
        expect(frobenius(gf8Add(a, b))).toBe(gf8Add(frobenius(a), frobenius(b)));
        expect(frobenius(gf8Mul(a, b))).toBe(gf8Mul(frobenius(a), frobenius(b)));
      }),
    );
    expect(new Set(GF8_ELEMENTS.map(frobenius)).size).toBe(8);
  });
  it('cosets mod 7: {0}, {1,2,4}, {3,6,5} (8)', () => {
    expect(cyclotomicCosets()).toEqual([[0], [1, 2, 4], [3, 6, 5]]);
    expect(cosetOrbit(5)).toEqual([5, 3, 6]);
  });
  it('c(α) = 0 ⇒ c(α²) = c(α⁴) = 0 for every codeword', () => {
    NONSYS.forEach((c) => [1, 2, 4].forEach((j) => expect(wordAtAlphaPower(c, j)).toBe(0)));
  });
  it('the property needs GF(2) coefficients: f(x) = x + α has f(α) = 0 but f(α²) ≠ 0', () => {
    expect(gfPolyEval([alphaPow(1), 1], alphaPow(1))).toBe(0);
    expect(gfPolyEval([alphaPow(1), 1], alphaPow(2))).not.toBe(0);
  });
});

describe('A8 · minimal polynomials', () => {
  it('m_α = x³+x+1, m_α³ = x³+x²+1, m_1 = x+1, all with GF(2) coefficients (9)', () => {
    expect(minimalPolynomial(1).binary).toEqual([1, 1, 0, 1]);
    expect(minimalPolynomial(3).binary).toEqual([1, 0, 1, 1]);
    expect(minimalPolynomial(0).binary).toEqual([1, 1]);
    allMinimalPolynomials().forEach((m) => {
      expect(m.binary).not.toBeNull();
      expect(m.rootsOk).toBe(true);
      expect(isIrreducible(m.binary!)).toBe(true);
    });
  });
  it('conjugates share the minimal polynomial', () => {
    [1, 2, 4].forEach((e) => expect(minimalPolynomial(e).binary).toEqual([1, 1, 0, 1]));
    [3, 5, 6].forEach((e) => expect(minimalPolynomial(e).binary).toEqual([1, 0, 1, 1]));
  });
  it('x⁷ − 1 = (x+1)(x³+x+1)(x³+x²+1) = product of the minimal polynomials', () => {
    const prod = polyProduct(allMinimalPolynomials().map((m) => m.binary!));
    expect(polyEq(prod, xn1(7))).toBe(true);
    expect(factorGF2(xn1(7)).map((p) => p.join('')).sort()).toEqual(['1011', '1101', '11'].sort());
  });
});

describe('A9 · H from GF(8)', () => {
  it('H_cyclic built from α⁶ … α⁰ equals the expected matrix (10)', () => {
    expect(hFromGF8().map(s)).toEqual(['1110100', '0111010', '1101001']);
  });
  it('each column equals x^{6−k} mod g(x) — an independent computation', () => {
    for (let k = 0; k < 7; k++) {
      const col = hFromGF8().map((r) => r[k]);
      expect(col).toEqual(polyModMsb(unitVector(7, k) as Bit[], G_MSB));
    }
  });
  it('H_cyclic G_cyclicᵀ = 0 (11)', () => {
    expect(isZeroMatrix(matMul(hFromGF8(), transpose(cyclicGenerator())))).toBe(true);
  });
  it('c(α) = 0 ⇔ H_cyclic cᵀ = 0, for all 128 words (one GF(8) equation = three GF(2) equations)', () => {
    ALL7.forEach((c) => {
      expect(intToBits(wordAtAlpha(c), 3)).toEqual(matVec(hFromGF8(), c));
      expect(wordAtAlpha(c) === 0).toBe(inCyclicCode(c));
    });
  });
  it('the cyclic code is Lesson 1’s Hamming code after the coordinate permutation', () => {
    NONSYS.forEach((c) => expect(isCodeword74(cyclicWordToStandard(c))).toBe(true));
    // without the permutation the two layouts disagree
    expect(NONSYS.every((c) => isCodeword74(c))).toBe(false);
  });
});

describe('A5 / 2-2 / 2-3 · systematic encoding, LFSR ↔ long division', () => {
  it('LFSR(1001) = 110 and systematic(1001) = 1001110 (13, 14)', () => {
    expect(s(runLfsr(parseBits('1001'), 'encoder').final)).toBe('110');
    expect(s(encodeCyclic(parseBits('1001')).codeword)).toBe('1001110');
  });
  it('teacher states 000, 011, 110, 111, 110 from the synchronised division', () => {
    expect(['000', ...lfsrDivisionSync(parseBits('1001')).map((x) => s(x.next))]).toEqual(['000', '011', '110', '111', '110']);
  });
  it('every division step equals the corresponding LFSR clock, for all 16 messages', () => {
    MSGS.forEach((u) =>
      lfsrDivisionSync(u).forEach((st) => {
        expect(st.feedback).toBe(st.lfsr.feedback);
        expect(st.next).toEqual(st.lfsr.after);
        expect(st.after4[0]).toBe(0);
        expect(st.subtract.slice(1)).toEqual(st.lfsr.mask);
      }),
    );
  });
});

describe('A10 · GF(8) syndrome (+ 2-7 Chien search)', () => {
  it('S₁ = r(α) = e(α) and Chien search locates all 7 single errors on all 16 codewords (15, 16)', () => {
    codewordsL2().forEach(({ c }) => {
      expect(wordAtAlpha(c)).toBe(0);
      for (let p = 1; p <= 7; p++) {
        const r = vecAdd(c, unitVector(7, p - 1) as Bit[]);
        const S1 = wordAtAlpha(r);
        expect(S1).toBe(alphaPow(7 - p));
        expect(S1).toBe(bitsToField(syndromeL2(r))); // remainder view agrees
        const root = chienSearch(errorLocator(S1)).filter((x) => x.isRoot);
        expect(root).toHaveLength(1);
        expect(7 - root[0].exponent!).toBe(p);
      }
    });
  });
  it('e(x) = x⁵ gives S₁ = α⁵ and root α⁻⁵ = α²', () => {
    const S1 = wordAtAlpha(parseBits('0100000'));
    expect(S1).toBe(alphaPow(5));
    expect(chienSearch(errorLocator(S1)).find((x) => x.isRoot)!.j).toBe(2);
  });
});
