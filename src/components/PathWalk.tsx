import { useMemo, useState, type ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  type Bit,
  DEFAULT_MESSAGE,
  LAYOUT_74,
  LAYOUT_84,
  OVERALL_INDEX,
  PARITY_CHECKS,
  bitsToString,
  decode74,
  differingPositions,
  encode74,
  encode84,
  flipBit,
  flipPath,
  hammingDistance,
  isZeroVector,
  secdedDecode,
  vecEquals,
} from '../core';
import { BitRow, BitString, type BitState } from './Bits';
import { DistanceLine } from './DistanceLine';
import { Card, ResetButton } from './Lesson';

/**
 * Walk from codeword A towards codeword B yourself: the noise starts from A, every flipped bit is one step,
 * and the panel shows how far r is from A and from B, the receiver's lamps, and what the receiver does.
 * 'hamming' = Hamming(7,4) with chapter 3's 3-lamp decoder; 'secded' = Extended(8,4) with the SECDED decoder (a 4th lamp, P0).
 */
export type PathWalkMode = 'hamming' | 'secded';

const LAMP = PARITY_CHECKS.map((pc) => pc.name);
const OVERALL = LAYOUT_84[OVERALL_INDEX].label;
const ALL_ONES: Bit[] = DEFAULT_MESSAGE.map(() => 1 as Bit);
/** chapter 3's running example: the noise flips position 5 first */
const CH3_FIRST = [5];
const lampText = (bits: readonly Bit[]) => (isZeroVector(bits) ? '全暗' : `${LAMP.filter((_, i) => bits[i]).join('、')} 亮`);
const posList = (idx: readonly number[]) => [...idx].sort((a, b) => a - b).map((i) => i + 1).join('、');

const LIT = 'border-rose-500 bg-rose-400 shadow-[0_0_8px_2px_rgba(244,63,94,0.45)]';
const LIT_OVERALL = 'border-overall-600 bg-overall-500 shadow-[0_0_8px_2px_rgba(139,85,240,0.5)]';

/** The receiver's warning lamps in H's row order (P1, P2, P4): lit = that check failed. With `q`, the 4th lamp (P0) that watches every position. */
export function WarningLamps({ s, q, size = 'md' }: { s: readonly Bit[]; q?: Bit; size?: 'sm' | 'md' }) {
  const d = size === 'sm' ? 'h-4 w-4' : 'h-6 w-6';
  const one = (label: string, on: boolean, lit: string) => (
    <span key={label} className="inline-flex flex-col items-center gap-0.5">
      <span className={`${d} rounded-full border-2 ${on ? lit : 'border-slate-300 bg-slate-200'}`} />
      <span className="text-[10px] font-semibold leading-none text-slate-500">{label}</span>
    </span>
  );
  const aria = [`警示燈${lampText(s)}`, q === undefined ? '' : `${OVERALL} 燈${q ? '亮' : '暗'}`].filter(Boolean).join('，');
  return (
    <span className="inline-flex items-end gap-1.5 align-middle" role="img" aria-label={aria}>
      {s.map((b, i) => one(LAMP[i], b === 1, LIT))}
      {q !== undefined && (
        <>
          <span className="mx-0.5 h-5 w-px self-center bg-slate-300" aria-hidden />
          {one(OVERALL, q === 1, LIT_OVERALL)}
        </>
      )}
    </span>
  );
}

/** What the receiver reads off r and does with it. */
interface Reading {
  s: Bit[];
  /** the 4th lamp (SECDED only) */
  q?: Bit;
  /** 1-based position the receiver flips, 0 = none */
  flip: number;
  /** SECDED refuses to guess (s ≠ 0 with an even number of flips) */
  report: boolean;
  /** the word the receiver hands on, null when it reports */
  out: Bit[] | null;
}

function readWord(mode: PathWalkMode, r: readonly Bit[]): Reading {
  if (mode === 'secded') {
    const d = secdedDecode(r);
    return { s: d.syndrome, q: d.overallParity, flip: d.correctedPosition, report: d.case === 'double-detected', out: d.corrected };
  }
  const d = decode74(r);
  return { s: d.syndrome, flip: d.position, report: false, out: d.corrected };
}

type Tone = 'ok' | 'bad' | 'warn';
const TONE: Record<Tone, string> = {
  ok: 'bg-emerald-100 text-emerald-800',
  bad: 'bg-rose-100 text-rose-800',
  warn: 'bg-orange-100 text-orange-800',
};

function outcome(r: readonly Bit[], A: readonly Bit[], B: readonly Bit[], rd: Reading): { text: string; tone: Tone } {
  if (vecEquals(r, A)) return { text: '收到 A', tone: 'ok' };
  if (rd.report) return { text: '回報有錯，不猜', tone: 'warn' };
  if (rd.flip === 0) return { text: vecEquals(r, B) ? '就是 B：看不出錯 ✗' : '別的 codeword：看不出錯 ✗', tone: 'bad' };
  if (rd.out && vecEquals(rd.out, A)) return { text: '修回 A ✓', tone: 'ok' };
  if (rd.out && vecEquals(rd.out, B)) return { text: '改成 B ✗', tone: 'bad' };
  return { text: '改成別的 codeword ✗', tone: 'bad' };
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-slate-800">{children}</span>
    </div>
  );
}

export interface PathWalkProps {
  /** 'hamming' (default): 7 bits, 3 lamps; 'secded': 8 bits, the 4th lamp P0 and the SECDED action */
  mode?: PathWalkMode;
  /** messages of A and B (default: the shared default message and 1111) */
  messageA?: readonly Bit[];
  messageB?: readonly Bit[];
  /** 1-based positions the step button flips first (default: chapter 3's position 5); the rest follow in increasing order */
  first?: readonly number[];
  title?: ReactNode;
  /** a sentence above the bits */
  intro?: ReactNode;
}

export function PathWalk({ mode = 'hamming', messageA = DEFAULT_MESSAGE, messageB = ALL_ONES, first = CH3_FIRST, title = '自己翻：從 A 走到 B', intro }: PathWalkProps) {
  const ext = mode === 'secded';
  const layout = ext ? LAYOUT_84 : LAYOUT_74;
  const { A, B, D, diff, order } = useMemo(() => {
    const encode = ext ? encode84 : encode74;
    const a = encode(messageA);
    const b = encode(messageB);
    const walk = flipPath(a, b, first.map((p) => p - 1));
    return { A: a, B: b, D: hammingDistance(a, b), diff: differingPositions(a, b), order: walk[walk.length - 1].flipped };
  }, [ext, messageA, messageB, first]);

  const [r, setR] = useState<Bit[]>(() => [...A]);
  // a new A (another message or mode) restarts the walk from A
  const aKey = `${mode}:${bitsToString(A)}:${bitsToString(B)}`;
  const [seen, setSeen] = useState(aKey);
  if (seen !== aKey) {
    setSeen(aKey);
    setR([...A]);
  }

  const dA = hammingDistance(r, A);
  const dB = hammingDistance(r, B);
  /** r lies on a shortest A → B walk exactly when its two distances add up to d(A, B) */
  const onPath = dA + dB === D;
  const nextPos = onPath ? order.find((i) => r[i] === A[i]) : undefined;
  const flipped = differingPositions(r, A);
  const rd = readWord(mode, r);
  const res = outcome(r, A, B, rd);
  const action = rd.report ? '回報，不翻' : rd.flip ? `翻位置 ${rd.flip}` : '不動';
  /** one more step along the walk (functional, so quick double clicks each count) */
  const stepOnce = () =>
    setR((prev) => {
      if (hammingDistance(prev, A) + hammingDistance(prev, B) !== D) return prev;
      const i = order.find((j) => prev[j] === A[j]);
      return i === undefined ? prev : flipBit(prev, i);
    });
  const states: BitState[] = r.map((_, i) => (flipped.includes(i) ? 'error' : diff.includes(i) ? 'diff' : 'normal'));
  const mark = (j: number) => (diff.includes(j) ? 'text-fuchsia-600 font-bold' : undefined);

  return (
    <Card title={title} actions={<ResetButton onClick={() => setR([...A])} />}>
      {intro && <div className="mb-3 text-sm leading-relaxed text-slate-700">{intro}</div>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <span>
              A <BitString bits={A} highlight={mark} className="font-semibold" />
            </span>
            <span>
              B <BitString bits={B} highlight={mark} className="font-semibold" />
            </span>
          </div>
          <div>
            <div className="mb-1 text-xs font-semibold text-slate-500">收到的 r（點位元翻轉）</div>
            <BitRow bits={r} layout={layout} plain size="sm" states={states} onToggle={(i) => setR((prev) => flipBit(prev, i))} gapBefore={ext ? OVERALL_INDEX : undefined} />
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border-2 border-fuchsia-500 bg-fuchsia-50" />
                A、B 不同的位置
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded border-2 border-rose-500 bg-rose-50" />
                雜訊翻了的位置
              </span>
            </div>
          </div>
          <button type="button" className="btn-primary" disabled={nextPos === undefined} onClick={stepOnce}>
            翻下一位（{order.map((i) => i + 1).join(' → ')}）
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="flex justify-center">
            <DistanceLine d={D} nodeLabel={(k) => `翻 ${k} 位`} at={onPath ? dA : null} />
          </div>
        </div>
        <div className="min-w-0 space-y-2.5 self-start rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm" aria-live="polite">
          <Row label="雜訊翻了">
            {dA} 位{flipped.length > 0 && <span className="text-slate-500">（位置 {posList(flipped)}）</span>}
          </Row>
          <Row label="distance">
            離 A <strong className={dA < dB ? 'text-data-700' : 'font-normal'}>{dA}</strong>・離 B <strong className={dB < dA ? 'text-overall-700' : 'font-normal'}>{dB}</strong>
          </Row>
          <Row label={`${rd.s.length + (rd.q === undefined ? 0 : 1)} 盞燈`}>
            <WarningLamps s={rd.s} q={rd.q} size="sm" />
          </Row>
          <Row label="接收端">{action}</Row>
          <div className={`rounded-lg px-2.5 py-1.5 text-center font-semibold ${TONE[res.tone]}`}>{res.text}</div>
        </div>
      </div>
    </Card>
  );
}
