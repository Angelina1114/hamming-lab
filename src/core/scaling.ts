/**
 * Scaling Hamming Codes to longer messages: splitting into blocks vs. one long
 * code, and shortened Hamming Codes for message lengths that are not 2^r − r − 1.
 *
 * Positions use the Lesson 1 standard layout: position j (1-based) has H column
 * = binary of j (LSB on top); parity bits sit at powers of two.
 */

/** Hamming Code with r check bits: n = 2^r − 1, k = n − r. */
export const hammingN = (r: number): number => 2 ** r - 1;
export const hammingK = (r: number): number => 2 ** r - 1 - r;

/**
 * P(more than t of n independent bits flip) on a binary symmetric channel with
 * bit error probability p. Sums the upper tail term by term (no 1 − (…)
 * cancellation), so it stays accurate for tiny p.
 */
export function blockFailureProb(n: number, t: number, p: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return t < n ? 1 : 0;
  const ratio = p / (1 - p);
  let term = Math.exp(n * Math.log1p(-p)); // i = 0
  let tail = 0;
  for (let i = 0; i < n; i++) {
    term *= ((n - i) / (i + 1)) * ratio; // term for i + 1
    if (i + 1 > t) tail += term;
  }
  return Math.min(1, tail);
}

/** P(at least one of several independent events), computed without cancellation. */
export function anyOf(probs: readonly number[]): number {
  const logNone = probs.reduce((acc, q) => acc + Math.log1p(-q), 0);
  return 0 - Math.expm1(logNone); // 0 − … avoids returning −0
}

export interface ShortenedParams {
  /** data bits actually carried */
  k: number;
  /** check bits */
  r: number;
  /** parent Hamming Code (2^r − 1, 2^r − 1 − r) */
  parentN: number;
  parentK: number;
  /** data bits fixed to 0 and not sent */
  shortenedBy: number;
  /** shortened code (n, k) with n = k + r */
  n: number;
  rate: number;
  /** with one overall parity bit added (SECDED) */
  nSecded: number;
  rateSecded: number;
}

/** Smallest r whose Hamming Code carries at least k data bits. */
export function checkBitsFor(k: number): number {
  if (!Number.isInteger(k) || k < 1) throw new Error(`checkBitsFor: k must be a positive integer, got ${k}`);
  let r = 2;
  while (hammingK(r) < k) r++;
  return r;
}

/** Shortened Hamming Code for exactly k data bits (shortenedBy = 0 when k = 2^r − r − 1). */
export function shortenedHamming(k: number): ShortenedParams {
  const r = checkBitsFor(k);
  const parentN = hammingN(r);
  const parentK = hammingK(r);
  const n = k + r;
  return { k, r, parentN, parentK, shortenedBy: parentK - k, n, rate: k / n, nSecded: n + 1, rateSecded: k / (n + 1) };
}

const isPowerOfTwo = (j: number) => (j & (j - 1)) === 0;

/**
 * Which parent positions (1-based) the shortened code keeps: all r parity
 * positions, plus the first k data positions. The removed ones are the
 * highest-numbered data positions (fixed to 0, never sent).
 */
export function shortenedPositions(k: number): { kept: number[]; removed: number[]; r: number } {
  const { r, parentN } = shortenedHamming(k);
  const kept: number[] = [];
  const removed: number[] = [];
  let data = 0;
  for (let j = 1; j <= parentN; j++) {
    if (isPowerOfTwo(j)) kept.push(j);
    else if (data < k) {
      kept.push(j);
      data++;
    } else removed.push(j);
  }
  return { kept, removed, r };
}

export interface BlockPlan {
  r: number;
  parentN: number;
  parentK: number;
  /** full-length Hamming blocks */
  fullBlocks: number;
  /** data bits left for one final shortened block (0 = none) */
  tail: number;
  blocks: number;
  /** total bits transmitted */
  sent: number;
  /** extra bits per data bit: (sent − L) / L */
  overhead: number;
  /** P(a full block has ≥ 2 errors) */
  pBlock: number;
  /** P(at least one block has ≥ 2 errors), i.e. the message is not fully recovered */
  pAnyFail: number;
}

/**
 * Send L data bits with Hamming Codes of r check bits: as many full
 * (2^r − 1, 2^r − 1 − r) blocks as fit, and the remainder in one shortened
 * block of (tail + r, tail). Each block corrects 1 error, so it fails iff
 * it receives ≥ 2.
 */
export function planBlocks(L: number, r: number, p: number): BlockPlan {
  if (!Number.isInteger(L) || L < 1) throw new Error(`planBlocks: L must be a positive integer, got ${L}`);
  const parentN = hammingN(r);
  const parentK = hammingK(r);
  if (parentK < 1) throw new Error(`planBlocks: r = ${r} carries no data`);
  const fullBlocks = Math.floor(L / parentK);
  const tail = L - fullBlocks * parentK;
  const pBlock = blockFailureProb(parentN, 1, p);
  const probs = Array<number>(fullBlocks).fill(pBlock);
  if (tail > 0) probs.push(blockFailureProb(tail + r, 1, p));
  const sent = fullBlocks * parentN + (tail > 0 ? tail + r : 0);
  return { r, parentN, parentK, fullBlocks, tail, blocks: probs.length, sent, overhead: (sent - L) / L, pBlock, pAnyFail: anyOf(probs) };
}

/**
 * Σ_b C(n_b, 2) over the blocks of planBlocks(L, r): for small p,
 * P(at least one block fails) ≈ pairCount · p².
 */
export function pairCount(L: number, r: number): number {
  const { fullBlocks, tail, parentN } = planBlocks(L, r, 0);
  const pairs = (n: number) => (n * (n - 1)) / 2;
  return fullBlocks * pairs(parentN) + (tail > 0 ? pairs(tail + r) : 0);
}

/** P(an uncoded L-bit message arrives with at least one error). */
export const uncodedFailure = (L: number, p: number): number => 0 - Math.expm1(L * Math.log1p(-p));

/** Block plans for r = 3 up to the smallest r that fits L in a single block. */
export function scalingTable(L: number, p: number): BlockPlan[] {
  const rMax = Math.max(3, checkBitsFor(L));
  return Array.from({ length: rMax - 2 }, (_, i) => planBlocks(L, i + 3, p));
}
