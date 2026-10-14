/**
 * Extended Hamming(8,4) code and the SECDED decoder.
 *
 * Layout: [P1, P2, D1, P4, D2, D3, D4, P0] — the Hamming(7,4) codeword followed by an
 * overall parity bit P0 = c1 ⊕ c2 ⊕ … ⊕ c7, so every codeword has even total weight.
 * Positions 1..7 are unchanged, so the 3-bit syndrome still names an error position.
 */
import { type Bit, type BitVector, sum, isZeroVector, flipBit, intToBits, vecAdd } from './gf2';
import { type Matrix } from './matrix';
import { H74, encode74, extractMessage74, syndrome74, syndromeToPosition, LAYOUT_74, type PositionInfo } from './hamming';

export const N8 = 8;
export const OVERALL_INDEX = 7;

export const LAYOUT_84: PositionInfo[] = [
  ...LAYOUT_74,
  { index: 7, position: 8, label: 'P0', role: 'overall' },
];

/** Parity-check matrix of the extended code (4×8): H74 padded with a zero column, plus the all-ones row. */
export const H84: Matrix = [
  ...H74.map((r) => [...r, 0 as Bit]),
  Array.from({ length: N8 }, () => 1 as Bit),
];

export const overallParityOf = (word: readonly Bit[]): Bit => sum(word);

/** Encode 4 bits → 8-bit extended Hamming codeword. */
export function encode84(message: readonly Bit[]): BitVector {
  const c7 = encode74(message);
  return [...c7, overallParityOf(c7)];
}

export const extractMessage84 = (word: readonly Bit[]): BitVector => extractMessage74(word.slice(0, 7));

export type SecdedCase =
  | 'no-error' // s = 0, overall parity check = 0
  | 'single-corrected' // s ≠ 0, overall parity check = 1 → flip position s (1..7)
  | 'overall-corrected' // s = 0, overall parity check = 1 → flip P0
  | 'double-detected'; // s ≠ 0, overall parity check = 0 → detected, NOT corrected

export interface SecdedResult {
  received: BitVector;
  /** 3-bit Hamming syndrome of the first seven bits */
  syndrome: BitVector;
  /** overall parity of all 8 received bits (0 = even, consistent) */
  overallParity: Bit;
  case: SecdedCase;
  /** 1-based position flipped (1..8), 0 if none */
  correctedPosition: number;
  /** corrected word, or null when a double error is detected (decoder refuses to guess) */
  corrected: BitVector | null;
  message: BitVector | null;
}

export function secdedDecode(received: readonly Bit[]): SecdedResult {
  if (received.length !== N8) throw new Error(`SECDED expects 8 bits, got ${received.length}`);
  const syndrome = syndrome74(received.slice(0, 7));
  const overallParity = overallParityOf(received);
  const sZero = isZeroVector(syndrome);
  let kase: SecdedCase;
  let correctedPosition = 0;
  let corrected: BitVector | null;
  if (sZero && overallParity === 0) {
    kase = 'no-error';
    corrected = [...received];
  } else if (!sZero && overallParity === 1) {
    kase = 'single-corrected';
    correctedPosition = syndromeToPosition(syndrome);
    corrected = flipBit(received, correctedPosition - 1);
  } else if (sZero && overallParity === 1) {
    kase = 'overall-corrected';
    correctedPosition = 8;
    corrected = flipBit(received, OVERALL_INDEX);
  } else {
    kase = 'double-detected';
    corrected = null;
  }
  return {
    received: [...received],
    syndrome,
    overallParity,
    case: kase,
    correctedPosition,
    corrected,
    message: corrected ? extractMessage84(corrected) : null,
  };
}

export interface SecdedOutcome {
  sent: BitVector;
  error: BitVector;
  received: BitVector;
  result: SecdedResult;
  errorWeight: number;
  /** decoder output equals what was sent */
  success: boolean;
  /** decoder produced a word but it is wrong (or claimed "no error" while errors exist) */
  wrongDecision: boolean;
}

export function simulate84(sent: readonly Bit[], error: readonly Bit[]): SecdedOutcome {
  const received = vecAdd(sent, error);
  const result = secdedDecode(received);
  const errorWeight = error.reduce<number>((a, b) => a + b, 0);
  const success = result.corrected !== null && result.corrected.every((b, i) => b === sent[i]);
  return {
    sent: [...sent],
    error: [...error],
    received,
    result,
    errorWeight,
    success,
    wrongDecision: result.corrected !== null && !success,
  };
}

export function codewords84(): { index: number; message: BitVector; codeword: BitVector }[] {
  return Array.from({ length: 16 }, (_, i) => {
    const message = intToBits(i, 4);
    return { index: i, message, codeword: encode84(message) };
  });
}
