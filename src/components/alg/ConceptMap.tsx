import { useState } from 'react';
import { MODULES, moduleIndex } from '../../lib/modules';

interface Node {
  id: string; // route
  label: string;
  sub: string;
  x: number;
  y: number;
  kind: 'l1' | 'alg' | 'l2';
  desc: string;
}

const NODES: Node[] = [
  { id: 'encode', label: 'Hamming(7,4)', sub: 'Parity-check equation', x: 110, y: 50, kind: 'l1', desc: '用三條 XOR 方程產生 3 個 parity bit。' },
  { id: 'matrix', label: 'H 與 G', sub: 'GF(2) 線性代數', x: 360, y: 50, kind: 'l1', desc: 'c = mG、Hcᵀ = 0：Hamming code 的線性代數描述。' },
  { id: 'syndrome', label: 'Syndrome', sub: 's = Hrᵀ', x: 680, y: 50, kind: 'l1', desc: '單一錯誤的 syndrome 等於 H 的某一欄。' },
  { id: 'a-1', label: 'GF(2)', sub: '1 + 1 = 0', x: 360, y: 150, kind: 'alg', desc: 'Hamming code 原本就使用的運算規則：field、characteristic 2、XOR。' },
  { id: 'a-2', label: 'GF(8)', sub: 'a + bα + cα²', x: 200, y: 250, kind: 'alg', desc: '把 3 位元向量變成可以相乘、相除的「數」。' },
  { id: 'a-3', label: 'Quotient ring', sub: 'GF(2)[x]/(x³+x+1)', x: 440, y: 250, kind: 'alg', desc: '用 irreducible polynomial 取商才會得到 field；α³ = α + 1。' },
  { id: 'a-4', label: 'Primitive element α', sub: 'α⁷ = 1', x: 200, y: 350, kind: 'alg', desc: 'α 的次方走遍 7 個非零元素：指數 = 位置。' },
  { id: 'a-5', label: 'Generator g(x)', sub: 'c(x) = m(x)g(x)', x: 680, y: 350, kind: 'alg', desc: '一個 generator polynomial 取代整個 generator matrix；G_cyc 的列是 g 的位移。' },
  { id: 'a-6', label: 'Cyclic code・ideal', sub: 'C = ⟨g(x)⟩ ⊂ R₇', x: 680, y: 450, kind: 'alg', desc: '乘以 x = cyclic shift；code 是 R₇ 的 ideal。' },
  { id: 'a-7', label: 'Frobenius・cosets', sub: 'α → α² → α⁴', x: 200, y: 450, kind: 'alg', desc: 'GF(2) 係數多項式的根成組出現（conjugates）。' },
  { id: 'a-8', label: 'Minimal polynomial', sub: 'm_α = x³+x+1', x: 440, y: 450, kind: 'alg', desc: '把 conjugate roots 乘起來得到 GF(2) 多項式，它就是 g(x)。' },
  { id: 'a-9', label: 'GF(8) 推導 H', sub: 'c(α)=0 ⇔ Hcᵀ=0', x: 440, y: 560, kind: 'alg', desc: '一條 GF(8) 方程 = 三條 GF(2) 方程：回到線性代數。' },
  { id: 'l2-2', label: 'LFSR 編碼', sub: 'x³u mod g', x: 680, y: 560, kind: 'l2', desc: '第二課：三個 register 計算 x³u(x) mod g(x)，與長除法同步（2-3）。' },
  { id: 'a-10', label: 'Syndrome（GF(8)）', sub: 'S₁ = r(α) = αⁱ', x: 200, y: 560, kind: 'alg', desc: 'S₁ = r(α) = e(α)：錯誤位置寫在它的指數裡；之後接第二課的 Chien search。' },
  { id: 'l2-1', label: '第二課流水線', sub: '編碼→解碼', x: 440, y: 660, kind: 'l2', desc: '把所有元件組成完整的編碼／解碼流程（含 SECDED）。' },
];

/** [from, to, label, optional curve control point, optional label position along a straight edge] */
const EDGES: [string, string, string, [number, number]?, number?][] = [
  ['encode', 'matrix', '寫成矩陣'],
  ['matrix', 'syndrome', 'Hrᵀ'],
  ['matrix', 'a-1', '運算規則'],
  ['a-1', 'a-2', '擴張'],
  ['a-3', 'a-2', '建構'],
  ['a-2', 'a-4', '乘法結構'],
  ['a-4', 'a-5', '根是 α'],
  ['matrix', 'a-5', 'G ↔ g(x)'],
  ['a-3', 'a-5', '同一個多項式'],
  ['a-5', 'a-6', '位移'],
  ['a-4', 'a-7', '平方'],
  ['a-7', 'a-8', 'Conjugates', undefined, 0.1],
  ['a-8', 'a-5', 'g = m_α'],
  ['a-6', 'a-9', 'c(α)=0'],
  ['a-8', 'a-9', ''],
  ['a-9', 'syndrome', 'Equivalent code', undefined, 0.78],
  ['a-5', 'l2-2', 'Systematic', [830, 455]],
  ['a-9', 'a-10', 'S₁ = r(α)'],
  ['a-4', 'a-10', '取對數', [50, 455]],
  ['l2-2', 'l2-1', ''],
  ['a-10', 'l2-1', ''],
];

const W = 160;
const H = 52;

export function ConceptMap() {
  const [hover, setHover] = useState<string | null>(null);
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const focus = hover ? byId[hover] : null;
  const related = (id: string) => !hover || id === hover || EDGES.some(([a, b]) => (a === hover && b === id) || (b === hover && a === id));

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">
        <svg viewBox="0 0 860 700" className="w-full min-w-[680px]" role="img" aria-label="抽象代數與 Hamming code 的概念關係圖">
          <defs>
            <marker id="cm-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#94a3b8" />
            </marker>
            <marker id="cm-arr-on" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#7638dc" />
            </marker>
          </defs>
          {EDGES.map(([a, b, label, ctrl, lt = 0.5]) => {
            const p = byId[a];
            const q = byId[b];
            const on = hover === a || hover === b;
            // leave each box through its border, heading toward the other end (or the curve's control point)
            const exit = (from: Node, tx: number, ty: number) => {
              const dx = tx - from.x;
              const dy = ty - from.y;
              const t = Math.min(Math.abs(dx) > 1e-6 ? W / 2 / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? H / 2 / Math.abs(dy) : Infinity);
              return { x: from.x + dx * t, y: from.y + dy * t };
            };
            const s1 = exit(p, ctrl ? ctrl[0] : q.x, ctrl ? ctrl[1] : q.y);
            const s2 = exit(q, ctrl ? ctrl[0] : p.x, ctrl ? ctrl[1] : p.y);
            const d = ctrl ? `M${s1.x},${s1.y} Q${ctrl[0]},${ctrl[1]} ${s2.x},${s2.y}` : `M${s1.x},${s1.y} L${s2.x},${s2.y}`;
            const lx = ctrl ? (s1.x + 2 * ctrl[0] + s2.x) / 4 : s1.x + (s2.x - s1.x) * lt;
            const ly = ctrl ? (s1.y + 2 * ctrl[1] + s2.y) / 4 : s1.y + (s2.y - s1.y) * lt;
            return (
              <g key={`${a}-${b}`} opacity={hover && !on ? 0.2 : 1}>
                <path d={d} fill="none" stroke={on ? '#7638dc' : '#94a3b8'} strokeWidth={on ? 2.5 : 1.5} markerEnd={`url(#${on ? 'cm-arr-on' : 'cm-arr'})`} />
                {label && (
                  <text x={lx + 4} y={ly - 4} fontSize={10.5} fill={on ? '#622ab8' : '#64748b'} textAnchor={ctrl && ctrl[0] < 100 ? 'end' : 'start'}>
                    {label}
                  </text>
                )}
              </g>
            );
          })}
          {NODES.map((n) => {
            const m = MODULES[moduleIndex(n.id)];
            const color = n.kind === 'l1' ? { fill: '#eef4ff', stroke: '#93b4fd' } : n.kind === 'l2' ? { fill: '#fff8eb', stroke: '#fbcb6a' } : { fill: '#f6f1ff', stroke: '#c6a8fd' };
            return (
              <a key={n.id} href={`#/${n.id}`} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(n.id)} onBlur={() => setHover(null)}>
                <g opacity={related(n.id) ? 1 : 0.3} className="cursor-pointer">
                  <rect x={n.x - W / 2} y={n.y - H / 2} width={W} height={H} rx={12} fill={color.fill} stroke={hover === n.id ? '#7638dc' : color.stroke} strokeWidth={hover === n.id ? 3 : 1.5} />
                  <text x={n.x - W / 2 + 8} y={n.y - H / 2 + 14} fontSize={9.5} fontWeight={700} fill="#64748b">
                    {m?.num}
                  </text>
                  <text x={n.x} y={n.y + 1} textAnchor="middle" fontSize={13.5} fontWeight={700} fill="#0f172a">
                    {n.label}
                  </text>
                  <text x={n.x} y={n.y + 17} textAnchor="middle" fontSize={10.5} fill="#475569">
                    {n.sub}
                  </text>
                </g>
              </a>
            );
          })}
        </svg>
      </div>
      <div className="min-h-[56px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
        {focus ? (
          <>
            <strong>{focus.label}</strong>（{MODULES[moduleIndex(focus.id)]?.num} {MODULES[moduleIndex(focus.id)]?.title}）：{focus.desc}
            <span className="ml-1 text-slate-500">點擊前往。</span>
          </>
        ) : (
          <span className="text-slate-500">把滑鼠移到（或用 Tab 選到）任一方塊查看說明，點擊即可前往該單元。藍色 = 第一課、紫色 = 本章、橘色 = 第二課。</span>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs sm:hidden">
        {NODES.map((n) => (
          <a key={n.id} href={`#/${n.id}`} className="chip border border-slate-200 bg-white">
            {MODULES[moduleIndex(n.id)]?.num} {n.label}
          </a>
        ))}
      </div>
    </div>
  );
}
