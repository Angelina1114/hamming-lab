/**
 * Hamming(7,4) code — standard positional layout [P1, P2, D1, P4, D2, D3, D4], even parity.
 *
 * Positions are 1-based in the mathematics (position j = 1..7) and 0-based in arrays (index j−1).
 * Column j of H is the binary representation of j, least-significant bit in the top row,
 * so the syndrome read as (s1 + 2·s2 + 4·s3) directly names the erroneous position.
 */
import { type Bit, type BitVector, sum, isZeroVector, flipBit, intToBits, vecAdd } from './gf2';
import { type Matrix, matVec, vecMat, column } from './matrix';

export const N7 = 7;
export const K4 = 4;

export type BitRole = 'data' | 'parity' | 'overall';

export interface PositionInfo {
  index: number; // 0-based array index
  position: number; // 1-based Hamming position
  label: string; // "P1", "D1", ...
  role: BitRole;
}

export const LAYOUT_74: PositionInfo[] = [
  { index: 0, position: 1, label: 'P1', role: 'parity' },
  { index: 1, position: 2, label: 'P2', role: 'parity' },
  { index: 2, position: 3, label: 'D1', role: 'data' },
  { index: 3, position: 4, label: 'P4', role: 'parity' },
  { index: 4, position: 5, label: 'D2', role: 'data' },
  { index: 5, position: 6, label: 'D3', role: 'data' },
  { index: 6, position: 7, label: 'D4', role: 'data' },
];

/** 0-based indices of the data bits D1..D4 inside the codeword. */
export const DATA_INDICES = [2, 4, 5, 6] as const;
/** 0-based indices of the parity bits P1, P2, P4. */
export const PARITY_INDICES = [0, 1, 3] as const;

/** Parity-check matrix H (3×7). Column j (1-based) = binary of j, LSB on top. */
export const H74: Matrix = [
  [1, 0, 1, 0, 1, 0, 1],
  [0, 1, 1, 0, 0, 1, 1],
  [0, 0, 0, 1, 1, 1, 1],
];

/** Generator matrix G (4×7): row i is the codeword of the i-th unit message. */
export const G74: Matrix = [
  [1, 1, 1, 0, 0, 0, 0],
  [1, 0, 0, 1, 1, 0, 0],
  [0, 1, 0, 1, 0, 1, 0],
  [1, 1, 0, 1, 0, 0, 1],
];

export interface ParityCheckDef {
  name: 'P1' | 'P2' | 'P4';
  parityIndex: number; // 0-based index of this parity bit in the codeword
  bitValue: number; // 1, 2 or 4
  /** 0-based codeword indices covered by this check (positions j with j & bitValue ≠ 0). */
  covered: number[];
  /** The data bits (by name) used to compute this parity bit. */
  dataTerms: ('D1' | 'D2' | 'D3' | 'D4')[];
}

/**
 * Each parity bit P_b checks every position j whose binary expansion contains b.
 * Derived from positions — not hard-coded — so the UI can explain the pattern.
 */
export const PARITY_CHECKS: ParityCheckDef[] = ([1, 2, 4] as const).map((b) => {
  const covered = LAYOUT_74.filter((p) => (p.position & b) !== 0).map((p) => p.index);
  const dataTerms = covered
    .map((i) => LAYOUT_74[i])
    .filter((p) => p.role === 'data')
    .map((p) => p.label as 'D1' | 'D2' | 'D3' | 'D4');
  return {
    name: `P${b}` as 'P1' | 'P2' | 'P4',
    parityIndex: LAYOUT_74.find((p) => p.position === b)!.index,
    bitValue: b,
    covered,
    dataTerms,
  };
});

export interface ParityEncodeResult {
  message: BitVector;
  codeword: BitVector;
  parities: { name: string; value: Bit; terms: { label: string; value: Bit }[] }[];
}

/** Encode by the parity equations (P1 = D1⊕D2⊕D4, P2 = D1⊕D3⊕D4, P4 = D2⊕D3⊕D4). */
export function encode74ByParity(message: readonly Bit[]): ParityEncodeResult {
  assertLength(message, K4, 'message');
  const d: Record<string, Bit> = { D1: message[0], D2: message[1], D3: message[2], D4: message[3] };
  const codeword: BitVector = Array.from({ length: N7 }, () => 0 as Bit);
  DATA_INDICES.forEach((idx, i) => (codeword[idx] = message[i]));
  const parities = PARITY_CHECKS.map((pc) => {
    const terms = pc.dataTerms.map((t) => ({ label: t, value: d[t] }));
    const value = sum(terms.map((t) => t.value));
    codeword[pc.parityIndex] = value;
    return { name: pc.name, value, terms };
  });
  return { message: [...message], codeword, parities };
}

/** Encode by the generator matrix: c = mG. */
export const encode74 = (message: readonly Bit[]): BitVector => {
  assertLength(message, K4, 'message');
  return vecMat(message, G74);
};

/** Read D1..D4 out of a 7-bit word. */
export const extractMessage74 = (word: readonly Bit[]): BitVector => DATA_INDICES.map((i) => word[i]);

/** Syndrome s = H rᵀ (s1, s2, s3). */
export const syndrome74 = (received: readonly Bit[]): BitVector => {
  assertLength(received, N7, 'received word');
  return matVec(H74, received);
};

/** Syndrome (s1, s2, s3) → position s1 + 2 s2 + 4 s3 (0 means "no error detected"). */
export const syndromeToPosition = (s: readonly Bit[]): number => s.reduce<number>((acc, b, i) => acc + b * 2 ** i, 0);

/** Column of H whose value equals the syndrome (0-based), or −1 when the syndrome is zero. */
export function matchingColumn(s: readonly Bit[]): number {
  if (isZeroVector(s)) return -1;
  for (let j = 0; j < N7; j++) {
    const col = column(H74, j);
    if (col.every((x, i) => x === s[i])) return j;
  }
  return -1; // impossible for Hamming(7,4): H contains every non-zero 3-bit column
}

export type Decode74Status = 'no-error' | 'corrected';

export interface Decode74Result {
  received: BitVector;
  syndrome: BitVector;
  /** 1-based position flipped by the decoder, 0 if none. */
  position: number;
  corrected: BitVector;
  message: BitVector;
  status: Decode74Status;
}

/** Syndrome decoding: if s ≠ 0, flip the bit at the position named by s. */
export function decode74(received: readonly Bit[]): Decode74Result {
  const s = syndrome74(received);
  const position = syndromeToPosition(s);
  const corrected = position === 0 ? [...received] : flipBit(received, position - 1);
  return {
    received: [...received],
    syndrome: s,
    position,
    corrected,
    message: extractMessage74(corrected),
    status: position === 0 ? 'no-error' : 'corrected',
  };
}

export interface ChannelOutcome {
  sent: BitVector;
  error: BitVector;
  received: BitVector;
  decoded: Decode74Result;
  errorWeight: number;
  /** decoder output equals what was sent */
  success: boolean;
  /** decoder changed the word but to a wrong codeword */
  miscorrection: boolean;
  /** errors present but syndrome zero (error pattern is itself a codeword) */
  undetected: boolean;
}

/** Full channel simulation r = c + e followed by syndrome decoding. */
export function simulate74(sent: readonly Bit[], error: readonly Bit[]): ChannelOutcome {
  const received = vecAdd(sent, error);
  const decoded = decode74(received);
  const errorWeight = error.reduce<number>((a, b) => a + b, 0);
  const success = decoded.corrected.every((b, i) => b === sent[i]);
  return {
    sent: [...sent],
    error: [...error],
    received,
    decoded,
    errorWeight,
    success,
    miscorrection: !success && decoded.position !== 0,
    undetected: errorWeight > 0 && decoded.position === 0,
  };
}

export interface CodewordEntry {
  index: number;
  message: BitVector;
  codeword: BitVector;
}

/** Enumerate all 16 codewords by encoding all 16 messages. */
export function codewords74(): CodewordEntry[] {
  return Array.from({ length: 2 ** K4 }, (_, i) => {
    const message = intToBits(i, K4);
    return { index: i, message, codeword: encode74(message) };
  });
}

/** True iff H wᵀ = 0. */
export const isCodeword74 = (w: readonly Bit[]): boolean => isZeroVector(syndrome74(w));

function assertLength(v: readonly unknown[], n: number, what: string) {
  if (v.length !== n) throw new Error(`${what} must have length ${n}, got ${v.length}`);
}

export const DEFAULT_MESSAGE: BitVector = [1, 0, 1, 1];

