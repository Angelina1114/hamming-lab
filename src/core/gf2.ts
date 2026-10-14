/**
 * GF(2) — the binary field {0, 1}.
 * Addition is XOR, multiplication is AND. Every element is its own additive inverse,
 * so subtraction equals addition.
 */

export type Bit = 0 | 1;
export type BitVector = Bit[];

export const toBit = (n: number): Bit => ((((n % 2) + 2) % 2) as Bit);

/** a + b in GF(2) (XOR) */
export const add = (a: Bit, b: Bit): Bit => (a ^ b) as Bit;

/** a · b in GF(2) (AND) */
export const mul = (a: Bit, b: Bit): Bit => (a & b) as Bit;

/** Sum of a list of bits in GF(2) */
export const sum = (bits: readonly Bit[]): Bit => bits.reduce<Bit>((acc, b) => add(acc, b), 0);

/** Component-wise vector addition u + v over GF(2). */
export function vecAdd(u: readonly Bit[], v: readonly Bit[]): BitVector {
  if (u.length !== v.length) throw new Error(`vecAdd: length mismatch ${u.length} vs ${v.length}`);
  return u.map((x, i) => add(x, v[i]));
}

/** Inner product u · v over GF(2). */
export function dot(u: readonly Bit[], v: readonly Bit[]): Bit {
  if (u.length !== v.length) throw new Error(`dot: length mismatch ${u.length} vs ${v.length}`);
  let s: Bit = 0;
  for (let i = 0; i < u.length; i++) s = add(s, mul(u[i], v[i]));
  return s;
}

/** Hamming weight: number of non-zero coordinates. */
export const weight = (v: readonly Bit[]): number => v.reduce<number>((acc, b) => acc + b, 0);

export const isZeroVector = (v: readonly Bit[]): boolean => v.every((b) => b === 0);

export const zeroVector = (n: number): BitVector => Array.from({ length: n }, () => 0 as Bit);

/** Unit vector e_i (0-based index). */
export function unitVector(n: number, i: number): BitVector {
  const v = zeroVector(n);
  v[i] = 1;
  return v;
}

/** Return a copy of v with coordinate i flipped. */
export function flipBit(v: readonly Bit[], i: number): BitVector {
  const out = [...v];
  out[i] = add(out[i], 1);
  return out;
}

export const bitsToString = (v: readonly Bit[]): string => v.join('');

export function parseBits(s: string): BitVector {
  const clean = s.replace(/\s+/g, '');
  if (!/^[01]*$/.test(clean)) throw new Error(`parseBits: invalid binary string "${s}"`);
  return clean.split('').map((c) => (c === '1' ? 1 : 0));
}

/**
 * Integer → bit vector of given length, most significant bit first
 * (so intToBits(11, 4) = [1,0,1,1]).
 */
export function intToBits(n: number, length: number): BitVector {
  const out: BitVector = [];
  for (let i = length - 1; i >= 0; i--) out.push(toBit((n >> i) & 1));
  return out;
}

/** Bit vector (MSB first) → integer. */
export const bitsToInt = (v: readonly Bit[]): number => v.reduce<number>((acc, b) => acc * 2 + b, 0);

/** All 2^n binary vectors of length n, in lexicographic (counting) order. */
export function allVectors(n: number): BitVector[] {
  const out: BitVector[] = [];
  for (let i = 0; i < 2 ** n; i++) out.push(intToBits(i, n));
  return out;
}

export const vecEquals = (u: readonly Bit[], v: readonly Bit[]): boolean =>
  u.length === v.length && u.every((x, i) => x === v[i]);
