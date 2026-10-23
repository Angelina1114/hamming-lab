import { useState } from 'react';
import { type Bit, allVectors, binomial, codewords74, encode74, flipBit, hammingBound, hammingDistance } from '../core';
import { M } from './Tex';
import { Segmented } from './Lesson';
import { usePresenting } from '../lib/presenting';

/* ------------------------------------------------------------------ */
/* 1. One Hamming ball, drawn as rings around its codeword              */
/* ------------------------------------------------------------------ */

const CENTER: Bit[] = encode74([1, 0, 1, 1]); // 0110011
const OTHERS = codewords74().map((e) => e.codeword).filter((w) => w.join('') !== CENTER.join(''));
const OWNER_FILL = ['fill-sky-400', 'fill-violet-400', 'fill-amber-400', 'fill-emerald-400', 'fill-rose-400', 'fill-teal-400', 'fill-fuchsia-400'];

export function BallDiagram() {
  const [t, setT] = useState<'1' | '2'>('1');
  const n = CENTER.length;
  const W = 380;
  const H = t === '2' ? 360 : 300;
  const cx = W / 2;
  const cy = H / 2;
  const r1 = 100;
  const r2 = 158;
  const ring1 = Array.from({ length: n }, (_, j) => {
    const a = -Math.PI / 2 + (2 * Math.PI * j) / n;
    return { j, word: flipBit(CENTER, j), x: cx + r1 * Math.cos(a), y: cy + r1 * Math.sin(a) };
  });
  const pairs: [number, number][] = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  // each 2-flip string lies within distance 1 of exactly one OTHER codeword (Hamming(7,4) is perfect)
  const owned = pairs.map((p) => {
    const w = flipBit(flipBit(CENTER, p[0]), p[1]);
    const owner = OTHERS.findIndex((c) => hammingDistance(c, w) === 1);
    return { p, w, owner };
  });
  const ownerIds = [...new Set(owned.map((o) => o.owner))];
  const ring2 = [...owned]
    .sort((a, b) => ownerIds.indexOf(a.owner) - ownerIds.indexOf(b.owner))
    .map((o, k) => {
      const a = -Math.PI / 2 + (2 * Math.PI * (k + 0.5)) / owned.length;
      return { ...o, color: OWNER_FILL[ownerIds.indexOf(o.owner) % OWNER_FILL.length], x: cx + r2 * Math.cos(a), y: cy + r2 * Math.sin(a) };
    });
  const tt = Number(t);
  const terms = Array.from({ length: tt + 1 }, (_, i) => binomial(n, i));
  const V = terms.reduce((a, b) => a + b, 0);

  const Word = ({ bits, flipped, x, y, center = false }: { bits: Bit[]; flipped: number[]; x: number; y: number; center?: boolean }) => (
    <g>
      <rect x={x - 33} y={y - 11} width={66} height={22} rx={6} className={center ? 'fill-emerald-600' : 'fill-white stroke-indigo-300'} strokeWidth={1.5} />
      <text x={x} y={y + 4} textAnchor="middle" fontSize={11.5} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontWeight={700}>
        {bits.map((b, i) => (
          <tspan key={i} className={center ? 'fill-white' : flipped.includes(i) ? 'fill-rose-600' : 'fill-slate-500'}>
            {b}
          </tspan>
        ))}
      </text>
    </g>
  );

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">② 一顆球有多大（n = 7）</div>
        <Segmented ariaLabel="球的半徑 t" value={t} onChange={setT} options={[{ value: '1', label: 't = 1' }, { value: '2', label: 't = 2' }]} />
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-[380px]" role="img" aria-label={`以 codeword ${CENTER.join('')} 為中心、半徑 ${t} 的漢明球`}>
        {ring1.map((v) => (
          <line key={`l1-${v.j}`} x1={cx} y1={cy} x2={v.x} y2={v.y} className="stroke-indigo-200" strokeWidth={2} />
        ))}
        {tt >= 2 && <circle cx={cx} cy={cy} r={r2} className="fill-none stroke-slate-300" strokeDasharray="4 4" />}
        <circle cx={cx} cy={cy} r={r1} className="fill-none stroke-indigo-200" strokeDasharray="4 4" />
        {tt >= 2 &&
          ring2.map(({ p, w, owner, color, x, y }) => (
            <circle key={`d-${p.join('-')}`} cx={x} cy={y} r={5.5} className={color}>
              <title>{`翻第 ${p[0] + 1}、${p[1] + 1} 位：${w.join('')}，離 codeword ${OTHERS[owner].join('')} 只有 1`}</title>
            </circle>
          ))}
        {ring1.map((v) => (
          <g key={`w-${v.j}`}>
            <title>{`翻第 ${v.j + 1} 位`}</title>
            <Word bits={v.word} flipped={[v.j]} x={v.x} y={v.y} />
          </g>
        ))}
        <Word bits={CENTER} flipped={[]} x={cx} y={cy} center />
      </svg>
      <div className="mt-1 space-y-1 text-xs text-slate-600">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600 align-middle" />
            codeword（翻 0 位）：{terms[0]} 個
          </span>
          <span>
            <span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-indigo-300 bg-white align-middle" />
            翻 1 位（紅字）：<M>{`\\binom{${n}}{1} = ${terms[1]}`}</M> 個
          </span>
          {tt >= 2 && (
            <span>
              <span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-r from-sky-400 via-amber-400 to-rose-400 align-middle" />
              翻 2 位：<M>{`\\binom{${n}}{2} = ${terms[2]}`}</M> 個
            </span>
          )}
        </div>
        <p>
          球的體積 <M>{`V_2(${n},${tt}) = ${terms.join(' + ')} = ${V}`}</M>：中心的 codeword，加上「錯 {tt === 1 ? '1 個' : '1 或 2 個'}位元」能變成的所有字串。
        </p>
        <p className="text-slate-500">排成同心圈只是依「翻了幾位」分層，圈上的位置和角度沒有意義：例如第 1 圈任兩個字串，彼此的距離都是 2。</p>
        {tt >= 2 && (
          <p className="rounded-lg bg-rose-50 p-2 text-rose-800">
            對 Hamming(7,4) 來說，這 {ring2.length} 個點全都落在另外 {ownerIds.length} 個 codeword 的半徑 1 球裡（同色的 {ring2.length / ownerIds.length} 個點屬於同一個 codeword），所以錯 2 位一定會被誤更正。16 × {V} = {16 * V} &gt; 128：半徑 2 的球不可能互不重疊。這裡的 t = 2 只是示範體積公式怎麼長。
          </p>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. How many balls fit in the space of 2^n strings                    */
/* ------------------------------------------------------------------ */

type PackKey = 'h74' | 'e84' | 'x75';
const PACKS: Record<PackKey, { label: string; tab: string; n: number; k: number; t: number; cols: number; rows: number; bw: number; bh: number; perRow: number }> = {
  h74: { label: 'Hamming(7,4)', tab: '(7,4)', n: 7, k: 4, t: 1, cols: 16, rows: 8, bw: 4, bh: 2, perRow: 4 },
  e84: { label: 'Extended(8,4)', tab: 'Ext(8,4)', n: 8, k: 4, t: 1, cols: 16, rows: 16, bw: 3, bh: 3, perRow: 4 },
  x75: { label: '假想的 (7,5)', tab: '(7,5)？', n: 7, k: 5, t: 1, cols: 16, rows: 8, bw: 4, bh: 2, perRow: 4 },
};
const HUES = ['fill-sky-300', 'fill-violet-300', 'fill-amber-300', 'fill-emerald-300'];
const HUES_DARK = ['fill-sky-600', 'fill-violet-600', 'fill-amber-600', 'fill-emerald-600'];

export function PackingDiagram() {
  const presenting = usePresenting();
  const [key, setKey] = useState<PackKey>('h74');
  const p = PACKS[key];
  const hb = hammingBound(p.n, p.k, p.t);
  const balls = hb.codewords;
  const fitRows = p.rows / p.bh; // block rows that fit inside the box
  const capacity = p.perRow * fitRows; // only meaningful for h74/x75 (V = 8 tiles the box)
  const inside = key === 'e84' ? balls : Math.min(balls, capacity);
  const overflow = balls - inside;
  const cell = 15;
  const gap = 1.5;
  const step = cell + gap;
  const pad = 6;
  const boxW = p.cols * step - gap;
  const boxH = p.rows * step - gap;
  const overflowRows = overflow > 0 ? Math.ceil(overflow / p.perRow) * p.bh : 0;
  const W = boxW + 2 * pad;
  const H = boxH + 2 * pad + (overflow > 0 ? 26 + overflowRows * step : 0);

  const used = new Set<string>();
  const blocks: { b: number; x0: number; y0: number; out: boolean }[] = [];
  for (let b = 0; b < balls; b++) {
    const out = b >= inside;
    const idx = out ? b - inside : b;
    const bx = (idx % p.perRow) * p.bw;
    const by = Math.floor(idx / p.perRow) * p.bh;
    blocks.push({ b, x0: bx, y0: by, out });
    if (!out) for (let dy = 0; dy < p.bh; dy++) for (let dx = 0; dx < p.bw; dx++) used.add(`${bx + dx},${by + dy}`);
  }
  const leftover = p.cols * p.rows - used.size;
  const cx = (x: number) => pad + x * step;
  const cyIn = (y: number) => pad + y * step;
  const cyOut = (y: number) => pad + boxH + 26 + y * step;

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">③ 空間裝得下幾顆球</div>
        <Segmented ariaLabel="選擇 code" value={key} onChange={setKey} options={(Object.keys(PACKS) as PackKey[]).map((k) => ({ value: k, label: PACKS[k].tab }))} />
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto block w-full max-w-[300px]" role="img" aria-label={`${p.label}：${balls} 顆球、每顆 ${hb.volume} 格，空間共 ${hb.rhs} 格`}>
          {/* empty cells of the box */}
          {Array.from({ length: p.rows }, (_, y) =>
            Array.from({ length: p.cols }, (_, x) => (used.has(`${x},${y}`) ? null : <rect key={`e${x},${y}`} x={cx(x)} y={cyIn(y)} width={cell} height={cell} rx={2} className="fill-slate-100" />)),
          )}
          {/* balls */}
          {blocks.map(({ b, x0, y0, out }) => {
            const yy = out ? cyOut : cyIn;
            const hue = (b + Math.floor(b / p.perRow)) % 4; // shift each row so stacked balls differ
            return (
              <g key={b}>
                <title>{`第 ${b + 1} 顆球（${hb.volume} 個字串）${out ? '：放不進空間' : ''}`}</title>
                {Array.from({ length: p.bh }, (_, dy) =>
                  Array.from({ length: p.bw }, (_, dx) => {
                    const center = dx === 0 && dy === 0;
                    const tone = out ? (center ? 'fill-rose-600' : 'fill-rose-300') : center ? HUES_DARK[hue] : HUES[hue];
                    return <rect key={`${dx},${dy}`} x={cx(x0 + dx)} y={yy(y0 + dy)} width={cell} height={cell} rx={2} className={tone} />;
                  }),
                )}
                <rect x={cx(x0) - 1} y={yy(y0) - 1} width={p.bw * step - gap + 2} height={p.bh * step - gap + 2} rx={3} className={out ? 'fill-none stroke-rose-500' : 'fill-none stroke-slate-500/60'} strokeWidth={1.2} />
              </g>
            );
          })}
          {/* the space itself */}
          <rect x={pad - 3} y={pad - 3} width={boxW + 6} height={boxH + 6} rx={5} className="fill-none stroke-slate-700" strokeWidth={2} />
          {overflow > 0 && (
            <>
              <text x={pad} y={pad + boxH + 18} fontSize={10} className="fill-rose-600" fontWeight={700}>
                ↓ 還有 {overflow} 顆球，盒子裡已經沒有位置
              </text>
              <rect x={pad - 3} y={cyOut(0) - 3} width={boxW + 6} height={overflowRows * step - gap + 6} rx={5} className="fill-none stroke-rose-400" strokeWidth={1.5} strokeDasharray="5 4" />
            </>
          )}
        </svg>
      </div>
      <div className="mt-2 space-y-1 text-xs text-slate-600">
        <p>
          <strong className="text-slate-800">{p.label}</strong>（{hb.codewords} 個 codeword，每個要修 {p.t} 個錯）。黑框 = 全部 <M>{`2^{${p.n}} = ${hb.rhs}`}</M> 個 {p.n} 位元字串，一格一個。每個色塊是一顆球（{hb.volume} 格，深色那格是 codeword）。
        </p>
        <p className="text-sm text-slate-800">
          <M>{`2^{${p.k}} \\times ${hb.volume} = ${hb.lhs} \\;${hb.equality ? '=' : hb.satisfied ? '<' : '>'}\\; ${hb.rhs}`}</M>：
          {hb.equality && <strong className="text-emerald-700">剛好鋪滿，一格都不剩——完美碼。</strong>}
          {!hb.equality && hb.satisfied && (
            <strong className="text-sky-700">
              裝得下，但剩 {leftover} 格（灰色）不屬於任何球：收到這些字串時無法確定原本是哪個 codeword。
            </strong>
          )}
          {!hb.satisfied && <strong className="text-rose-700">裝不下！所以 n = {p.n}、要修 {p.t} 個錯時，k 最多只能是 {hb.maxK}。</strong>}
        </p>
        <p className="text-slate-500">格子怎麼排只是為了好數；真正同一顆球的字串在數值上分散各處{!presenting && '（見下方「真正的 2ⁿ 個字串分組」）'}。</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 0. The true geometry for n = 3: the cube, edges = 1-bit flips        */
/* ------------------------------------------------------------------ */

const CUBE: Bit[][] = allVectors(3);
const vkey = (v: readonly Bit[]) => v.join('');
// "abc": c → right, b → up, a → into the page (oblique projection)
const cubePos = (v: readonly Bit[]) => ({ x: 70 + 160 * v[2] + 80 * v[0], y: 240 - 140 * v[1] - 70 * v[0] });
const CUBE_EDGES: [Bit[], Bit[]][] = [];
CUBE.forEach((u, i) => CUBE.forEach((w, j) => j > i && hammingDistance(u, w) === 1 && CUBE_EDGES.push([u, w])));

export function CubeBall() {
  const presenting = usePresenting();
  const [mode, setMode] = useState<'one' | 'rep'>('one');
  const [center, setCenter] = useState<Bit[]>([0, 0, 0]);
  const [tStr, setTStr] = useState<'0' | '1' | '2' | '3'>('1');
  const t = Number(tStr);
  const balls =
    mode === 'one'
      ? [{ c: center, t, fill: 'fill-emerald-200', dark: 'fill-emerald-600', edge: 'stroke-emerald-500', text: 'fill-emerald-900' }]
      : [
          { c: [0, 0, 0] as Bit[], t: 1, fill: 'fill-sky-200', dark: 'fill-sky-600', edge: 'stroke-sky-500', text: 'fill-sky-900' },
          { c: [1, 1, 1] as Bit[], t: 1, fill: 'fill-violet-200', dark: 'fill-violet-600', edge: 'stroke-violet-500', text: 'fill-violet-900' },
        ];
  const ballOf = (v: readonly Bit[]) => balls.findIndex((b) => hammingDistance(v, b.c) <= b.t);
  const inBall = CUBE.filter((v) => hammingDistance(v, center) <= t).sort((a, b) => hammingDistance(a, center) - hammingDistance(b, center));
  const terms = Array.from({ length: t + 1 }, (_, i) => binomial(3, i));

  return (
    <div className="min-w-0">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">① n = 3 的漢明球（真正的結構）</div>
        <Segmented ariaLabel="顯示一顆或兩顆球" value={mode} onChange={setMode} options={[{ value: 'one', label: '一顆球' }, { value: 'rep', label: '兩顆球' }]} />
      </div>
      {mode === 'one' && (
        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          半徑 t
          <Segmented ariaLabel="半徑 t" value={tStr} onChange={setTStr} options={(['0', '1', '2', '3'] as const).map((v) => ({ value: v, label: v }))} />
          {!presenting && <span>點任一個頂點當中心 c</span>}
        </div>
      )}
      <svg viewBox="0 0 340 280" className="mx-auto w-full max-w-[340px]" role="img" aria-label="3 位元字串的立方體：頂點是字串，邊連接只差 1 位的兩個字串">
        {CUBE_EDGES.map(([u, w]) => {
          const a = cubePos(u);
          const b = cubePos(w);
          const bu = ballOf(u);
          const same = bu >= 0 && bu === ballOf(w);
          return <line key={vkey(u) + vkey(w)} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={same ? balls[bu].edge : 'stroke-slate-300'} strokeWidth={same ? 3.5 : 1.5} />;
        })}
        {CUBE.map((v) => {
          const { x, y } = cubePos(v);
          const bi = ballOf(v);
          const ball = bi >= 0 ? balls[bi] : null;
          const d = ball ? hammingDistance(v, ball.c) : null;
          const isC = d === 0;
          return (
            <g
              key={vkey(v)}
              className="cursor-pointer"
              onClick={() => {
                setMode('one');
                setCenter(v);
              }}
            >
              <title>{`${vkey(v)}${ball ? `：離 ${vkey(ball.c)} 的距離 ${d}` : ''}`}</title>
              <circle cx={x} cy={y} r={20} className={isC ? ball!.dark : ball ? ball.fill : 'fill-white stroke-slate-300'} strokeWidth={1.5} />
              <text x={x} y={y + 4} textAnchor="middle" fontSize={12} fontWeight={700} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" className={isC ? 'fill-white' : ball ? ball.text : 'fill-slate-400'}>
                {vkey(v)}
              </text>
              {ball && !isC && (
                <text x={x > 250 ? x - 23 : x + 23} y={y - 14} fontSize={10} textAnchor={x > 250 ? 'end' : 'start'} className="fill-slate-500">
                  d={d}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <div className="mt-1 space-y-1 text-xs text-slate-600">
        <p>頂點 = 3 位元字串；邊連接「只差 1 位」的兩個字串。沿著邊最少要走幾步，就是兩個字串的 Hamming distance（看邊，不看圖上的直線距離）。</p>
        {mode === 'one' ? (
          <p className="text-sm text-slate-800">
            <M>{`\\mathrm{Ball}(${vkey(center)}, ${t})`}</M> = 從 {vkey(center)} 出發、走 {t} 步以內到得了的頂點 = {'{'}
            {inBall.map(vkey).join(', ')}
            {'}'}，共 <M>{`${terms.join(' + ')} = ${inBall.length}`}</M> 個。
          </p>
        ) : (
          <p className="text-sm text-slate-800">
            code {'{'}000, 111{'}'}（<M>{'d_{\\min} = 3'}</M>，t = 1）：兩顆半徑 1 的球 {'{'}000, 001, 010, 100{'}'} 與 {'{'}111, 110, 101, 011{'}'} 互不重疊，<M>{'2 \\times 4 = 8 = 2^3'}</M>，剛好分完整個立方體——迷你版的完美碼。它就是 <M>{'\\ell = 2'}</M> 個同位位元的 Hamming Code，即 Hamming(3,1)。
          </p>
        )}
      </div>
    </div>
  );
}
