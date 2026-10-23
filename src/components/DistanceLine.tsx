import { correctionCapability } from '../core';

/**
 * A geodesic path A → B of length d with radius-t regions around both ends. `nodeLabel` names the in-between words (default: the step number).
 * `at` (optional) marks where a received word r sits: a step number 0…d rings that node; null means r is off this path, and the whole line fades.
 */
export function DistanceLine({ d, nodeLabel = (k) => `${k}`, at }: { d: number; nodeLabel?: (k: number) => string; at?: number | null }) {
  const t = correctionCapability(d);
  const W = 560;
  const pad = 40;
  const step = (W - 2 * pad) / d;
  const xs = Array.from({ length: d + 1 }, (_, k) => pad + k * step);
  const off = at === null;
  const here = typeof at === 'number' ? at : -1;
  const label = (k: number) => (k === 0 ? 'A' : k === d ? 'B' : nodeLabel(k));
  return (
    <svg viewBox={`0 0 ${W} 90`} className="mt-3 w-full max-w-[600px]">
      <g opacity={off ? 0.3 : 1}>
        <rect x={xs[0] - 12} y={28} width={t * step + 24} height={30} rx={15} fill="rgba(59,108,246,0.12)" stroke="#3b6cf6" strokeDasharray="4 3" />
        <rect x={xs[d] - t * step - 12} y={28} width={t * step + 24} height={30} rx={15} fill="rgba(139,85,240,0.12)" stroke="#8b55f0" strokeDasharray="4 3" />
        <line x1={xs[0]} x2={xs[d]} y1={43} y2={43} stroke="#cbd5e1" strokeWidth={2} />
        {xs.map((x, k) => {
          const end = k === 0 || k === d;
          const inA = k <= t;
          const inB = d - k <= t;
          return (
            <g key={k}>
              <circle cx={x} cy={43} r={end ? 9 : 6} fill={k === 0 ? '#3b6cf6' : k === d ? '#8b55f0' : inA && inB ? '#e11d48' : inA ? '#93b4fd' : inB ? '#c6a8fd' : '#fff'} stroke={end ? 'none' : '#64748b'} strokeWidth={1.5} />
              <text x={x} y={78} textAnchor="middle" fontSize={11} fill={k === here ? '#0f172a' : '#64748b'} fontWeight={k === here ? 700 : 400}>
                {k !== here ? label(k) : k === 0 || k === d ? `r = ${label(k)}` : `r：${label(k)}`}
              </text>
            </g>
          );
        })}
        <text x={pad} y={18} fontSize={11} fill="#2a55e0">
          A 的半徑 {t} 地盤
        </text>
        <text x={W - pad} y={18} fontSize={11} fill="#7638dc" textAnchor="end">
          B 的半徑 {t} 地盤
        </text>
      </g>
      {here >= 0 && <circle cx={xs[here]} cy={43} r={14} fill="none" stroke="#0f172a" strokeWidth={2.5} />}
      {off && (
        <text x={W / 2} y={18} fontSize={11} fill="#0f172a" fontWeight={700} textAnchor="middle">
          r 不在這條路上
        </text>
      )}
    </svg>
  );
}
