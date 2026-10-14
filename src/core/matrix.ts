/**
 * Matrix operations over GF(2).
 * A matrix is an array of rows; every entry is a Bit.
 */
import { type Bit, type BitVector, add, dot, mul, zeroVector, isZeroVector, intToBits } from './gf2';

export type Matrix = Bit[][];

export const rows = (A: Matrix): number => A.length;
export const cols = (A: Matrix): number => (A.length === 0 ? 0 : A[0].length);

export const cloneMatrix = (A: Matrix): Matrix => A.map((r) => [...r]);

export function zeros(m: number, n: number): Matrix {
  return Array.from({ length: m }, () => zeroVector(n));
}

export function identity(n: number): Matrix {
  return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0) as Bit));
}

export function transpose(A: Matrix): Matrix {
  const m = rows(A);
  const n = cols(A);
  return Array.from({ length: n }, (_, j) => Array.from({ length: m }, (_, i) => A[i][j]));
}

export const column = (A: Matrix, j: number): BitVector => A.map((r) => r[j]);

/** A · B over GF(2). */
export function matMul(A: Matrix, B: Matrix): Matrix {
  if (cols(A) !== rows(B)) throw new Error(`matMul: ${rows(A)}×${cols(A)} · ${rows(B)}×${cols(B)} incompatible`);
  const Bt = transpose(B);
  return A.map((row) => Bt.map((col) => dot(row, col)));
}

/** A · vᵀ — treats v as a column vector, returns the resulting column as a flat vector. */
export function matVec(A: Matrix, v: readonly Bit[]): BitVector {
  if (cols(A) !== v.length) throw new Error(`matVec: ${rows(A)}×${cols(A)} · length ${v.length}`);
  return A.map((row) => dot(row, v));
}

/** v · A — treats v as a row vector. */
export function vecMat(v: readonly Bit[], A: Matrix): BitVector {
  if (v.length !== rows(A)) throw new Error(`vecMat: length ${v.length} · ${rows(A)}×${cols(A)}`);
  const out = zeroVector(cols(A));
  for (let i = 0; i < v.length; i++) {
    if (v[i] === 0) continue;
    for (let j = 0; j < out.length; j++) out[j] = add(out[j], mul(v[i], A[i][j]));
  }
  return out;
}

export const isZeroMatrix = (A: Matrix): boolean => A.every((r) => isZeroVector(r));

export const matEquals = (A: Matrix, B: Matrix): boolean =>
  rows(A) === rows(B) && cols(A) === cols(B) && A.every((r, i) => r.every((x, j) => x === B[i][j]));

/* ------------------------------------------------------------------ */
/* Gaussian elimination over GF(2)                                     */
/* ------------------------------------------------------------------ */

export type RowOp =
  | { kind: 'swap'; i: number; j: number }
  | { kind: 'add'; target: number; source: number }; // R_target ← R_target + R_source

export interface EliminationStep {
  op: RowOp;
  matrix: Matrix; // matrix AFTER applying op
  pivotCol: number;
}

export interface RrefResult {
  rref: Matrix;
  pivotCols: number[];
  freeCols: number[];
  rank: number;
  steps: EliminationStep[];
}

/** Reduced row echelon form over GF(2), recording every row operation. */
export function rref(A: Matrix): RrefResult {
  const M = cloneMatrix(A);
  const m = rows(M);
  const n = cols(M);
  const pivotCols: number[] = [];
  const steps: EliminationStep[] = [];
  let r = 0;
  for (let c = 0; c < n && r < m; c++) {
    let p = -1;
    for (let i = r; i < m; i++) {
      if (M[i][c] === 1) {
        p = i;
        break;
      }
    }
    if (p === -1) continue;
    if (p !== r) {
      [M[p], M[r]] = [M[r], M[p]];
      steps.push({ op: { kind: 'swap', i: r, j: p }, matrix: cloneMatrix(M), pivotCol: c });
    }
    for (let i = 0; i < m; i++) {
      if (i !== r && M[i][c] === 1) {
        M[i] = M[i].map((x, j) => add(x, M[r][j]));
        steps.push({ op: { kind: 'add', target: i, source: r }, matrix: cloneMatrix(M), pivotCol: c });
      }
    }
    pivotCols.push(c);
    r++;
  }
  const freeCols = Array.from({ length: n }, (_, j) => j).filter((j) => !pivotCols.includes(j));
  return { rref: M, pivotCols, freeCols, rank: pivotCols.length, steps };
}

export const rank = (A: Matrix): number => rref(A).rank;

/** dim ker(A) = (#columns) − rank(A)  (Rank–Nullity Theorem). */
export const nullity = (A: Matrix): number => cols(A) - rank(A);

/**
 * Basis of the kernel (null space) { x : A xᵀ = 0 }.
 * One basis vector per free column: set that free variable to 1, the other free variables to 0,
 * and solve the pivot variables from the RREF.
 */
export function kernelBasis(A: Matrix): BitVector[] {
  const { rref: R, pivotCols, freeCols } = rref(A);
  const n = cols(A);
  return freeCols.map((f) => {
    const x = zeroVector(n);
    x[f] = 1;
    pivotCols.forEach((pc, row) => {
      // pivot variable = sum of free entries in its row (over GF(2), minus = plus)
      x[pc] = R[row][f];
    });
    return x;
  });
}

/** All 2^k linear combinations of the given basis vectors (the span). */
export function span(basis: readonly BitVector[], n?: number): BitVector[] {
  const len = n ?? (basis[0]?.length ?? 0);
  const k = basis.length;
  const out: BitVector[] = [];
  for (let mask = 0; mask < 2 ** k; mask++) {
    const coeffs = intToBits(mask, k);
    let v = zeroVector(len);
    coeffs.forEach((c, i) => {
      if (c === 1) v = v.map((x, j) => add(x, basis[i][j]));
    });
    out.push(v);
  }
  return out;
}

/** Brute-force kernel enumeration (for verification): every x ∈ GF(2)^n with A xᵀ = 0. */
export function kernelBruteForce(A: Matrix): BitVector[] {
  const n = cols(A);
  const out: BitVector[] = [];
  for (let i = 0; i < 2 ** n; i++) {
    const x = intToBits(i, n);
    if (isZeroVector(matVec(A, x))) out.push(x);
  }
  return out;
}

export function formatRowOp(op: RowOp): string {
  return op.kind === 'swap' ? `R_${op.i + 1} \\leftrightarrow R_${op.j + 1}` : `R_${op.target + 1} \\leftarrow R_${op.target + 1} + R_${op.source + 1}`;
}

/** LaTeX bmatrix of a matrix. */
export function matrixToTex(A: Matrix | BitVector[]): string {
  return `\\begin{bmatrix}${A.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{bmatrix}`;
}
