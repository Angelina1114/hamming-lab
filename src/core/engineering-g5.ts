/**
 * Engineering numbers for algebra units A9 (H from GF(8)) and A10 (S₁ = r(α)).
 * Every figure those pages state is computed here or by engineering.ts and pinned in
 * __tests__/engineering-g5.test.ts — nothing is typed into the page by hand.
 *
 * Bit strings are MSB-first (leftmost = highest power), as in cyclic.ts.
 */
import { type Bit, weight } from './gf2';
import { type GF8, alphaPow, gf8Mul } from './gf8';
import { L2_N, codewordsL2, combinations, simulateL2 } from './cyclic';
import { alphaMultiplierXors, maskDegree, msbToMask } from './engineering';

/** x⁷ + x³ + 1, MSB-first: generator of the cyclic Hamming(127, 120) code */
export const G127_MSB: Bit[] = [1, 0, 0, 0, 1, 0, 0, 1];

/* ------------------------------------------------------------------ */
/* A9: is a code closed under cyclic shift?                            */
/* ------------------------------------------------------------------ */

const rotl = (c: readonly Bit[]): Bit[] => [...c.slice(1), c[0]];

/** how many codewords leave the code after one cyclic (left) shift — 0 exactly for a cyclic code */
export function cyclicShiftEscapes(code: readonly (readonly Bit[])[]): number {
  const set = new Set(code.map((c) => c.join('')));
  return code.filter((c) => !set.has(rotl(c).join(''))).length;
}

/* ------------------------------------------------------------------ */
/* A10: serial syndrome by Horner's rule                               */
/* ------------------------------------------------------------------ */

export interface HornerCost {
  /** register stages = deg p (one flip-flop each) */
  flipFlops: number;
  /** the multiply-by-α feedback XORs plus one XOR where the received bit enters the lowest stage */
  xors: number;
}

/** Hardware of the "S ← S·α ⊕ r_k" register for GF(2^m) built from p (bitmask with leading term). */
export const hornerCost = (p: number): HornerCost => ({ flipFlops: maskDegree(p), xors: alphaMultiplierXors(p) + 1 });

/** register contents after each clock of S ← S·α ⊕ r_k, reading r MSB-first (r₆ first) */
export function hornerTrace(r: readonly Bit[]): { clock: number; input: Bit; state: GF8 }[] {
  let S = 0;
  return r.map((input, k) => {
    S = gf8Mul(S, 2) ^ input;
    return { clock: k + 1, input, state: S };
  });
}

/* ------------------------------------------------------------------ */
/* A10: locating the error while the word streams out                  */
/* ------------------------------------------------------------------ */

/** the pattern the stepping register is compared with: α⁶ = the S₁ an error in the first bit (x⁶) leaves */
export const STREAM_MATCH: GF8 = alphaPow(L2_N - 1);

/**
 * Load T = S₁ and output the word bit by bit; after each output clock multiply T by α (the same α circuit).
 * At output clock p, T = S₁·α^{p−1}, which equals α⁶ exactly when the error sits at position p.
 * Returns the 1-based position flagged (0 when S₁ = 0 or nothing matches).
 */
export function streamLocate(S1: GF8, n = L2_N): number {
  if (S1 === 0) return 0;
  let T = S1;
  for (let p = 1; p <= n; p++) {
    if (T === STREAM_MATCH) return p;
    T = gf8Mul(T, 2);
  }
  return 0;
}

/** non-zero syndromes a log table must list: 2^(n−k) − 1 (one per single-error position for a perfect code) */
export const logTableEntries = (n: number, k: number): number => 2 ** (n - k) - 1;

/* ------------------------------------------------------------------ */
/* A10: what two errors do to a single-error decoder                   */
/* ------------------------------------------------------------------ */

export interface DoubleErrorStats {
  /** number of distinct two-bit error patterns */
  pairs: number;
  /** patterns where the decoder flips a bit that was correct */
  miscorrected: number;
  /** distinct error counts left after decoding (over all codewords and pairs) */
  errorsAfter: number[];
}

/** Run the single-error decoder on every codeword with every two-bit error. */
export function doubleErrorStats(): DoubleErrorStats {
  const pairs = combinations(L2_N, 2);
  const after = new Set<number>();
  let miscorrected = 0;
  for (const pp of pairs) {
    let mis = true;
    for (const { u } of codewordsL2()) {
      const o = simulateL2(u, pp);
      if (!o.miscorrection) mis = false;
      after.add(weight(o.decode.corrected.map((b, i) => (b ^ o.c[i]) as Bit)));
    }
    if (mis) miscorrected++;
  }
  return { pairs: pairs.length, miscorrected, errorsAfter: [...after].sort((a, b) => a - b) };
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

/** x = mantissa × 10^exponent with the mantissa rounded to `digits` significant figures */
export function sciParts(x: number, digits = 2): { mantissa: string; exponent: number } {
  let exponent = Math.floor(Math.log10(x));
  let m = Number((x / 10 ** exponent).toPrecision(digits));
  if (m >= 10) {
    m /= 10;
    exponent += 1;
  }
  return { mantissa: m.toFixed(digits - 1), exponent };
}

/** LaTeX for sciParts, e.g. 2.1 \times 10^{-5} */
export const sciTex = (x: number, digits = 2): string => {
  const { mantissa, exponent } = sciParts(x, digits);
  return `${mantissa} \\times 10^{${exponent}}`;
};

/** x⁷ + x³ + 1 as a bitmask */
export const g127Mask = (): number => msbToMask(G127_MSB);
