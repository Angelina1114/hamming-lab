/**
 * Parity-check designs: which checks cover which positions, and whether a
 * single error can be located from the pattern of failing checks.
 *
 * A design is a 0/1 matrix `cover[check][position]`. The "signature" of a
 * position is the column of the matrix: the checks that fail when that bit flips.
 */
import { type Bit } from './gf2';

export type Design = Bit[][];

/** Which checks fail for a received word (true = odd number of 1s among the covered bits). */
export const failingChecks = (cover: Design, word: readonly Bit[]): boolean[] =>
  cover.map((row) => row.reduce<number>((acc, c, j) => acc ^ (c & word[j]), 0) === 1);

/** Signature of position j: which checks cover it. */
export const signature = (cover: Design, j: number): boolean[] => cover.map((row) => row[j] === 1);

const key = (s: readonly boolean[]) => s.map((b) => (b ? '1' : '0')).join('');

/** Positions whose single-bit error produces exactly this failing pattern. */
export function singleErrorCandidates(cover: Design, failing: readonly boolean[]): number[] {
  const n = cover[0]?.length ?? 0;
  const k = key(failing);
  return Array.from({ length: n }, (_, j) => j).filter((j) => key(signature(cover, j)) === k);
}

export interface DesignAnalysis {
  /** positions covered by no check: an error there is invisible */
  invisible: number[];
  /** groups (size ≥ 2) of positions with the same signature: errors there cannot be told apart */
  clashes: number[][];
  /** how many positions each check covers */
  rowWeights: number[];
  /** every single error has its own nonzero signature */
  locatesEverySingleError: boolean;
  /** number of possible outcomes 2^r and how many positions must be named (n) */
  outcomes: number;
  positions: number;
}

export function analyzeDesign(cover: Design): DesignAnalysis {
  const n = cover[0]?.length ?? 0;
  const groups = new Map<string, number[]>();
  const invisible: number[] = [];
  for (let j = 0; j < n; j++) {
    const s = signature(cover, j);
    if (s.every((b) => !b)) {
      invisible.push(j);
      continue;
    }
    const k = key(s);
    groups.set(k, [...(groups.get(k) ?? []), j]);
  }
  const clashes = [...groups.values()].filter((g) => g.length > 1);
  return {
    invisible,
    clashes,
    rowWeights: cover.map((row) => row.reduce<number>((a, b) => a + b, 0)),
    locatesEverySingleError: invisible.length === 0 && clashes.length === 0,
    outcomes: 2 ** cover.length,
    positions: n,
  };
}

/** Every failing pattern (including "none fail") and the single-error positions that produce it. */
export function outcomeTable(cover: Design): { pattern: boolean[]; positions: number[] }[] {
  const r = cover.length;
  return Array.from({ length: 2 ** r }, (_, m) => {
    const pattern = Array.from({ length: r }, (_, i) => ((m >> i) & 1) === 1);
    return { pattern, positions: singleErrorCandidates(cover, pattern) };
  });
}
