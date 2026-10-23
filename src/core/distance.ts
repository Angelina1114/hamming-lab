/**
 * Hamming distance, minimum distance and nearest-codeword (minimum-distance) decoding.
 */
import { type Bit, type BitVector, flipBit } from './gf2';

/** d_H(x, y) = number of coordinates where x and y differ. */
export function hammingDistance(x: readonly Bit[], y: readonly Bit[]): number {
  if (x.length !== y.length) throw new Error(`hammingDistance: length mismatch ${x.length} vs ${y.length}`);
  let d = 0;
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) d++;
  return d;
}

/** 0-based indices where x and y differ. */
export function differingPositions(x: readonly Bit[], y: readonly Bit[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) out.push(i);
  return out;
}

export interface PathStep {
  word: BitVector;
  /** 0-based positions flipped so far, in the order they were flipped */
  flipped: number[];
}

/**
 * The walk from a to b that flips one differing position per step: d(a, b) + 1 words, a first and b last.
 * Positions listed in `first` (0-based) are flipped first, the rest in increasing order.
 */
export function flipPath(a: readonly Bit[], b: readonly Bit[], first: readonly number[] = []): PathStep[] {
  const diff = differingPositions(a, b);
  const order = [...first.filter((i) => diff.includes(i)), ...diff.filter((i) => !first.includes(i))];
  const steps: PathStep[] = [{ word: [...a], flipped: [] }];
  for (const i of order) {
    const prev = steps[steps.length - 1];
    steps.push({ word: flipBit(prev.word, i), flipped: [...prev.flipped, i] });
  }
  return steps;
}

/** Full |C|×|C| distance table. */
export function distanceMatrix(code: readonly BitVector[]): number[][] {
  return code.map((x) => code.map((y) => hammingDistance(x, y)));
}

export interface MinDistanceResult {
  dmin: number;
  /** all unordered pairs (i < j) achieving d_min */
  closestPairs: [number, number][];
  /** number of unordered pairs compared */
  pairsChecked: number;
  /** histogram: distance → number of unordered pairs */
  histogram: Map<number, number>;
}

/** Exhaustive minimum distance over all C(|C|, 2) pairs of distinct codewords. */
export function minimumDistance(code: readonly BitVector[]): MinDistanceResult {
  if (code.length < 2) throw new Error('minimumDistance needs at least two codewords');
  let dmin = Infinity;
  let closestPairs: [number, number][] = [];
  const histogram = new Map<number, number>();
  let pairsChecked = 0;
  for (let i = 0; i < code.length; i++) {
    for (let j = i + 1; j < code.length; j++) {
      const d = hammingDistance(code[i], code[j]);
      pairsChecked++;
      histogram.set(d, (histogram.get(d) ?? 0) + 1);
      if (d < dmin) {
        dmin = d;
        closestPairs = [[i, j]];
      } else if (d === dmin) {
        closestPairs.push([i, j]);
      }
    }
  }
  return { dmin, closestPairs, pairsChecked, histogram };
}

/** t = ⌊(d_min − 1) / 2⌋ — number of errors that can always be corrected. */
export const correctionCapability = (dmin: number): number => Math.floor((dmin - 1) / 2);

/** d_min − 1 — number of errors that can always be detected. */
export const detectionCapability = (dmin: number): number => dmin - 1;

export interface NearestResult {
  distances: number[];
  minDistance: number;
  /** indices of all codewords at minimum distance (more than one = tie) */
  nearest: number[];
  unique: boolean;
}

/** Minimum-distance decoding: compare r against every codeword. */
export function nearestCodewords(received: readonly Bit[], code: readonly BitVector[]): NearestResult {
  const distances = code.map((c) => hammingDistance(received, c));
  const minDistance = Math.min(...distances);
  const nearest = distances.flatMap((d, i) => (d === minDistance ? [i] : []));
  return { distances, minDistance, nearest, unique: nearest.length === 1 };
}

/** Weight distribution: A_w = number of codewords of weight w. */
export function weightDistribution(code: readonly BitVector[], n: number): number[] {
  const A = Array.from({ length: n + 1 }, () => 0);
  code.forEach((c) => A[c.reduce<number>((a, b) => a + b, 0)]++);
  return A;
}
