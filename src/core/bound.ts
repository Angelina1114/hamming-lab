/**
 * Hamming spheres, the Hamming (sphere-packing) bound and perfect codes.
 */
import { type BitVector, allVectors } from './gf2';
import { hammingDistance } from './distance';

/** Binomial coefficient C(n, k), exact for the small n used here. */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
}

/** V₂(n, t) = Σ_{i=0}^{t} C(n, i): number of words within Hamming distance t of a fixed word. */
export function sphereVolume(n: number, t: number): number {
  let v = 0;
  for (let i = 0; i <= Math.min(t, n); i++) v += binomial(n, i);
  return v;
}

/** Terms C(n,0), C(n,1), …, C(n,t). */
export const sphereTerms = (n: number, t: number): number[] =>
  Array.from({ length: Math.min(t, n) + 1 }, (_, i) => binomial(n, i));

export interface HammingBoundResult {
  n: number;
  k: number;
  t: number;
  codewords: number; // 2^k
  volume: number; // V₂(n,t)
  lhs: number; // 2^k · V₂(n,t)
  rhs: number; // 2^n
  satisfied: boolean; // lhs ≤ rhs
  equality: boolean; // lhs = rhs  (perfect code parameters)
  /** largest k for which the bound holds with this n, t */
  maxK: number;
  /** fraction of the space covered by the disjoint spheres */
  coverage: number;
}

/** Hamming bound: 2^k · V₂(n,t) ≤ 2^n for any binary code of length n, 2^k codewords, correcting t errors. */
export function hammingBound(n: number, k: number, t: number): HammingBoundResult {
  const volume = sphereVolume(n, t);
  const codewords = 2 ** k;
  const lhs = codewords * volume;
  const rhs = 2 ** n;
  return {
    n,
    k,
    t,
    codewords,
    volume,
    lhs,
    rhs,
    satisfied: lhs <= rhs,
    equality: lhs === rhs,
    maxK: Math.floor(n - Math.log2(volume) + 1e-12),
    coverage: lhs / rhs,
  };
}

/** All words of length n within distance t of center. */
export function hammingSphere(center: readonly (0 | 1)[], t: number): BitVector[] {
  return allVectors(center.length).filter((w) => hammingDistance(w, center) <= t);
}

export interface PartitionResult {
  /** groups[i] = all words whose UNIQUE nearest codeword is code[i] */
  groups: BitVector[][];
  /** words with more than one nearest codeword */
  ties: BitVector[];
  /** for every word (indexed by its integer value), the distance to its nearest codeword */
  distanceToCode: number[];
  /** for every word, the index of its nearest codeword (−1 when tied) */
  owner: number[];
  totalWords: number;
  /** each word belongs to exactly one group and no word is tied */
  isPartition: boolean;
  /** covering radius = max_w d(w, C) */
  coveringRadius: number;
}

/** Group all 2^n words by nearest codeword (minimum-distance decoding regions). */
export function partitionByNearest(code: readonly BitVector[], n: number): PartitionResult {
  const words = allVectors(n);
  const groups: BitVector[][] = code.map(() => []);
  const ties: BitVector[] = [];
  const distanceToCode: number[] = [];
  const owner: number[] = [];
  for (const w of words) {
    let best = Infinity;
    let bestIdx: number[] = [];
    code.forEach((c, i) => {
      const d = hammingDistance(w, c);
      if (d < best) {
        best = d;
        bestIdx = [i];
      } else if (d === best) bestIdx.push(i);
    });
    distanceToCode.push(best);
    if (bestIdx.length === 1) {
      groups[bestIdx[0]].push(w);
      owner.push(bestIdx[0]);
    } else {
      ties.push(w);
      owner.push(-1);
    }
  }
  const covered = groups.reduce((a, g) => a + g.length, 0);
  return {
    groups,
    ties,
    distanceToCode,
    owner,
    totalWords: words.length,
    isPartition: ties.length === 0 && covered === words.length,
    coveringRadius: Math.max(...distanceToCode),
  };
}

/** Known non-trivial perfect binary codes, for the UI checklist. */
export function knownPerfectFamily(n: number, k: number, t: number): string | null {
  if (t === 0 && k === n) return '平凡碼 (trivial code：整個空間)';
  if (k === 0 && t >= n) return '平凡碼 (trivial code：只有一個 codeword)';
  if (k === 1 && n % 2 === 1 && t === (n - 1) / 2) return `重複碼 Repetition code [${n},1,${n}]`;
  const r = n - k;
  if (t === 1 && r >= 2 && n === 2 ** r - 1) return `Hamming code [${n},${k},3]`;
  if (n === 23 && k === 12 && t === 3) return 'Binary Golay code [23,12,7]';
  return null;
}
