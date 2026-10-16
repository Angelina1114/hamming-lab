import { useMemo, useState } from 'react';
import { type Bit, codewordsL2, hammingDistance } from '../../core';

interface Props {
  sent: Bit[];
  received: Bit[];
  decoded?: Bit[] | null;
  large?: boolean;
}

/**
 * The 16 codewords as nodes; an edge joins two codewords at Hamming distance d_min = 3.
 * Node placement is arbitrary (a circle) — only the edges / distances carry meaning.
 */
export function CodewordGraph({ sent, received, decoded, large = false }: Props) {
  const C = useMemo(() => codewordsL2(), []);
  const key = (b: readonly Bit[]) => b.join('');
  const sentIdx = C.findIndex((x) => key(x.c) === key(sent));
  const recIdx = C.findIndex((x) => key(x.c) === key(received));
  const decIdx = decoded ? C.findIndex((x) => key(x.c) === key(decoded)) : -1;
  const [sel, setSel] = useState<number>(sentIdx);

  const R = 158;
  const cx = 210;
  const cy = 200;
  const pos = C.map((_, i) => {
    const a = (i / C.length) * 2 * Math.PI - Math.PI / 2;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });
  const edges: [number, number][] = [];
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) if (hammingDistance(C[i].c, C[j].c) === 3) edges.push([i, j]);

  const recIsCodeword = recIdx >= 0;
  const distToRec = C.map((x) => hammingDistance(x.c, received));
  const minRec = Math.min(...distToRec);
  const nearestToRec = distToRec.flatMap((d, i) => (d === minRec ? [i] : []));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)]">
      <svg viewBox="0 0 420 400" className={`mx-auto w-full ${large ? 'max-w-[620px]' : 'max-w-[460px]'}`} role="img" aria-label="16 個 codeword 與最小距離的關係圖">
        {edges.map(([i, j]) => {
          const on = i === sel || j === sel;
          return <line key={`${i}-${j}`} x1={pos[i].x} y1={pos[i].y} x2={pos[j].x} y2={pos[j].y} stroke={on ? '#7638dc' : '#e2e8f0'} strokeWidth={on ? 2 : 1} />;
        })}
        {!recIsCodeword &&
          nearestToRec.concat(sentIdx >= 0 && !nearestToRec.includes(sentIdx) ? [sentIdx] : []).map((i) => (
            <g key={`r${i}`}>
              <line x1={cx} y1={cy} x2={pos[i].x} y2={pos[i].y} stroke="#e11d48" strokeDasharray="5 4" strokeWidth={2} />
              <text x={(cx + pos[i].x) / 2} y={(cy + pos[i].y) / 2 - 4} fontSize={12} fill="#be123c" fontWeight={700}>
                d={distToRec[i]}
              </text>
            </g>
          ))}
        {C.map((x, i) => {
          const isSent = i === sentIdx;
          const isRec = i === recIdx;
          const isDec = i === decIdx;
          const fill = isSent ? '#dbe6fe' : isDec || isRec ? '#ffedd5' : i === sel ? '#f1f5f9' : '#fff';
          const stroke = isSent ? '#2a55e0' : isRec ? '#e11d48' : isDec ? '#ea580c' : i === sel ? '#7638dc' : '#94a3b8';
          const tags = [isSent && 'c 送出', isRec && 'r 收到', isDec && !isRec && 'ĉ 解碼'].filter(Boolean).join(' / ');
          return (
            <g key={i} onClick={() => setSel(i)} className="cursor-pointer">
              <circle cx={pos[i].x} cy={pos[i].y} r={isSent || isRec || isDec ? 23 : 19} fill={fill} stroke={stroke} strokeWidth={isSent || isRec || isDec ? 3 : 1.5} />
              <text x={pos[i].x} y={pos[i].y + 4} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fontWeight={700} fill="#0f172a">
                {x.u.join('')}
              </text>
              {tags && (
                <text x={pos[i].x} y={pos[i].y + (pos[i].y > cy ? 38 : -30)} textAnchor="middle" fontSize={11} fontWeight={700} fill={stroke}>
                  {tags}
                </text>
              )}
            </g>
          );
        })}
        {!recIsCodeword && (
          <g>
            <rect x={cx - 42} y={cy - 16} width={84} height={32} rx={8} fill="#fff1f2" stroke="#e11d48" strokeWidth={2} />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize={12} fontFamily="ui-monospace, monospace" fontWeight={700} fill="#be123c">
              r={received.join('')}
            </text>
          </g>
        )}
      </svg>
      <div className="space-y-2 text-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <div className="text-xs text-slate-500">點選的 codeword（節點內是訊息 u）</div>
          <div className="font-mono text-lg font-bold">{C[sel]?.c.join('')}</div>
          <div className="text-slate-600">u = {C[sel]?.u.join('')}</div>
          <div className="mt-1">與送出的 c 距離：<strong>{sentIdx >= 0 ? hammingDistance(C[sel].c, sent) : '—'}</strong></div>
          <div>與收到的 r 距離：<strong>{hammingDistance(C[sel].c, received)}</strong></div>
          <div className="mt-1 text-xs text-slate-500">紫色線：與它相距 3（= d_min）的 {edges.filter(([a, b]) => a === sel || b === sel).length} 個 codeword</div>
        </div>
        <ul className="space-y-1 text-xs text-slate-600">
          <li>● 藍框「c 送出」、紅框「r 收到」、橘框「ĉ 解碼」。</li>
          <li>● 灰線連接距離剛好 3 的 codeword；沒有任何兩個 codeword 距離 1 或 2。</li>
          <li>● 節點排成圓形只是為了好看，圖上的長短沒有意義——只有「相距幾個 bit」有意義。</li>
          {!recIsCodeword && <li>● 紅色虛線：r 到最近 codeword（與 c）的 Hamming 距離。</li>}
        </ul>
      </div>
    </div>
  );
}
