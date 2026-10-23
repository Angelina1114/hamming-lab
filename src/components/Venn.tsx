import { motion } from 'framer-motion';
import { type Bit, LAYOUT_74, PARITY_CHECKS } from '../core';

/**
 * Venn diagram of the three parity checks of Hamming(7,4).
 * Each region contains exactly the positions whose binary expansion matches the circles containing it:
 * position j lies in circle P_b  ⇔  (j & b) ≠ 0.
 * This is a picture of SET MEMBERSHIP, not of distances.
 */
const CIRCLES = [
  { name: 'P1', cx: 135, cy: 118 },
  { name: 'P2', cx: 225, cy: 118 },
  { name: 'P4', cx: 180, cy: 196 },
];
const R = 84;

/** label position for each 0-based codeword index */
const REGION_POS: Record<number, [number, number]> = {
  0: [92, 92], // P1 only  (pos 1 = 001)
  1: [268, 92], // P2 only  (pos 2 = 010)
  3: [180, 250], // P4 only  (pos 4 = 100)
  2: [180, 86], // P1∩P2   (pos 3 = 011)
  4: [130, 182], // P1∩P4  (pos 5 = 101)
  5: [230, 182], // P2∩P4  (pos 6 = 110)
  6: [180, 145], // center (pos 7 = 111)
};

interface VennProps {
  word: readonly (Bit | null)[];
  /** 0-based indices of bits flipped by the channel */
  errorIdx?: number[];
  correctedIdx?: number[];
  onToggle?: (i: number) => void;
  /** show red/green status of each circle (parity of the bits inside) */
  showStatus?: boolean;
  focusCircle?: number | null;
  onFocusCircle?: (c: number | null) => void;
}

export function Venn({ word, errorIdx = [], correctedIdx = [], onToggle, showStatus = true, focusCircle = null, onFocusCircle }: VennProps) {
  const circleParity = PARITY_CHECKS.map((pc) => {
    if (pc.covered.some((i) => word[i] === null)) return null;
    return pc.covered.reduce<number>((a, i) => a ^ (word[i] as number), 0);
  });
  return (
    <svg viewBox="0 0 360 300" className="mx-auto w-full max-w-[380px] select-none" role="img" aria-label="三個 parity check 的 Venn 圖">
      {CIRCLES.map((c, k) => {
        const par = circleParity[k];
        const bad = showStatus && par === 1;
        const good = showStatus && par === 0;
        const dim = focusCircle !== null && focusCircle !== k;
        return (
          <g key={c.name} onMouseEnter={() => onFocusCircle?.(k)} onMouseLeave={() => onFocusCircle?.(null)}>
            <motion.circle
              cx={c.cx}
              cy={c.cy}
              r={R}
              fill={bad ? 'rgba(244,63,94,0.10)' : good ? 'rgba(16,185,129,0.06)' : 'rgba(232,147,12,0.06)'}
              stroke={bad ? '#e11d48' : good ? '#10b981' : '#e8930c'}
              strokeWidth={focusCircle === k ? 3.5 : 2}
              strokeDasharray={bad ? '6 4' : undefined}
              animate={{ opacity: dim ? 0.35 : 1 }}
            />
          </g>
        );
      })}
      {CIRCLES.map((c, k) => {
        const par = circleParity[k];
        const lx = k === 0 ? c.cx - 78 : k === 1 ? c.cx + 78 : c.cx + 88;
        const ly = k === 2 ? c.cy + 70 : c.cy - 70;
        return (
          <g key={`l${k}`}>
            <text x={lx} y={ly} textAnchor="middle" className="fill-parity-700 text-[13px] font-bold">
              {c.name}
            </text>
            {showStatus && par !== null && (
              <text x={lx} y={ly + 15} textAnchor="middle" className={`text-[10px] font-semibold ${par ? 'fill-rose-600' : 'fill-emerald-600'}`}>
                {par ? '奇數 ✗' : '偶數 ✓'}
              </text>
            )}
          </g>
        );
      })}
      {LAYOUT_74.map((p) => {
        const [x, y] = REGION_POS[p.index];
        const v = word[p.index];
        const err = errorIdx.includes(p.index);
        const cor = correctedIdx.includes(p.index);
        const isParity = p.role === 'parity';
        const fill = err ? '#fff1f2' : cor ? '#ecfdf5' : isParity ? '#fff8eb' : '#eef4ff';
        const stroke = err ? '#e11d48' : cor ? '#10b981' : isParity ? '#fbcb6a' : '#93b4fd';
        const text = err ? '#be123c' : cor ? '#047857' : isParity ? '#9a560b' : '#1f43b8';
        return (
          <g key={p.index} onClick={onToggle ? () => onToggle(p.index) : undefined} className={onToggle ? 'cursor-pointer' : ''}>
            <motion.rect
              x={x - 17}
              y={y - 17}
              width={34}
              height={34}
              rx={8}
              fill={fill}
              stroke={stroke}
              strokeWidth={2}
              whileHover={onToggle ? { scale: 1.1 } : undefined}
              style={{ transformOrigin: `${x}px ${y}px` }}
            />
            <text x={x} y={y + 6} textAnchor="middle" fill={text} className="pointer-events-none font-mono text-[17px] font-bold">
              {v ?? '?'}
            </text>
            <text x={x} y={y - 21} textAnchor="middle" fill={text} className="pointer-events-none text-[9.5px] font-semibold">
              {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
