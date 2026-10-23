import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Bit, type Matrix, G74, H74, N7, allVectors, bitsToString, flipBit, formatRowOp, isZeroVector, matVec, rref, span, vecAdd } from '../core';
import { M, Tex } from './Tex';
import { ColumnVector, MatrixView } from './MatrixView';

/* ---------- small fixed examples (all results below are computed) ---------- */

const A_MV: Matrix = [
  [1, 0, 1, 1],
  [0, 1, 1, 0],
  [1, 1, 0, 1],
];

const SPAN_VECS: Bit[][] = [
  [1, 1, 0, 0],
  [0, 1, 1, 0],
  [0, 0, 1, 1],
];
const DEP_VECS: Bit[][] = [
  [1, 1, 0, 0],
  [0, 1, 1, 0],
  [1, 0, 1, 0],
];

const A_KER: Matrix = [
  [1, 1, 0],
  [0, 1, 1],
];

/** Number of distinct vectors among all combinations (span() lists every combination, duplicates included). */
const spanSize = (vecs: Bit[][]) => new Set(span(vecs, vecs[0].length).map(bitsToString)).size;

/** All 2^k combinations a_1 v_1 + … + a_k v_k, with their coefficients. */
function combos(vecs: readonly Bit[][]) {
  return allVectors(vecs.length).map((a) => ({
    a,
    v: vecs.reduce<Bit[]>((acc, v, i) => (a[i] ? vecAdd(acc, v) : acc), vecs[0].map(() => 0 as Bit)),
  }));
}

/** rank of G and H, and the dimension of ker H by Rank–Nullity */
const RANK_G = rref(G74).rank;
const RANK_H = rref(H74).rank;
const NULLITY_H = N7 - RANK_H;

/* ---------- the concepts ---------- */

interface Concept {
  id: string;
  short: string;
  /** an English name shown after a Chinese tab label (omitted when the label is already the English term) */
  en?: string;
  title: string;
  def: ReactNode;
  example: ReactNode;
  use: ReactNode;
}

function MatVecExample() {
  const [x, setX] = useState<Bit[]>([1, 0, 1, 0]);
  const y = matVec(A_MV, x);
  const picked = x.flatMap((b, j) => (b ? [j] : []));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        點 x 的位元切換：
        {x.map((b, j) => (
          <button key={j} type="button" onClick={() => setX(flipBit(x, j))} className={`h-7 w-7 rounded-md border font-mono text-sm font-bold ${b ? 'border-fuchsia-400 bg-fuchsia-100 text-fuchsia-800' : 'border-slate-200 text-slate-400'}`} aria-label={`切換 x${j + 1}`}>
            {b}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <MatrixView matrix={A_MV} name="M" size="sm" highlightCols={picked} />
        <span>·</span>
        <ColumnVector bits={x} size="sm" label={<M>{'x^T ='}</M>} />
        <span>=</span>
        <ColumnVector bits={y} size="sm" cellClass="bg-emerald-50 text-emerald-700" />
      </div>
      <p className="text-xs text-slate-600">
        {picked.length === 0 ? '沒有選到任何欄，結果是 0。' : <>把第 {picked.map((j) => j + 1).join('、')} 欄加起來（mod 2）就是結果。</>}
      </p>
    </div>
  );
}

const SUB = ['₁', '₂', '₃', '₄'];

function CombosTable({ vecs }: { vecs: Bit[][] }) {
  const rows = combos(vecs);
  const counts = new Map<string, number>();
  rows.forEach((r) => counts.set(bitsToString(r.v), (counts.get(bitsToString(r.v)) ?? 0) + 1));
  const coef = vecs.map((_, i) => `a${SUB[i]}`).join('');
  return (
    <div className="overflow-x-auto">
      <table className="text-xs tabular-nums">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="pr-3 font-normal">係數 {coef}</th>
            <th className="pr-3 font-normal">選到的向量相加</th>
            <th className="font-normal">結果</th>
          </tr>
        </thead>
        <tbody className="font-mono">
          {rows.map((r) => {
            const dup = (counts.get(bitsToString(r.v)) ?? 0) > 1;
            const picked = r.a.flatMap((x, i) => (x ? [i] : []));
            const how =
              picked.length === 0
                ? '都不選'
                : `${picked.map((i) => `v${SUB[i]}`).join(' + ')}${picked.length > 1 ? ` = ${picked.map((i) => vecs[i].join('')).join(' + ')}` : ''}`;
            return (
              <tr key={r.a.join('')} className="border-t border-slate-100">
                <td className="py-0.5 pr-3 text-slate-500">{r.a.join('')}</td>
                <td className="pr-3 font-sans text-slate-600">{how}</td>
                <td className={dup ? 'font-bold text-rose-600' : 'font-bold'}>{bitsToString(r.v)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Span of three vectors, independent or not: the 8 coefficient choices and how many different results they give. */
function SpanExample() {
  const [dep, setDep] = useState(false);
  const vecs = dep ? DEP_VECS : SPAN_VECS;
  const size = spanSize(vecs);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="選擇例子">
        {[
          { v: false, label: '三個獨立的向量' },
          { v: true, label: '有一個是多餘的' },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={dep === o.v}
            onClick={() => setDep(o.v)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${dep === o.v ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="text-xs text-slate-500">
        v₁ = {vecs[0].join('')}、v₂ = {vecs[1].join('')}、v₃ = {vecs[2].join('')}
        {dep && (
          <>
            ：因為 {vecs[0].join('')} + {vecs[1].join('')} = {vecAdd(vecs[0], vecs[1]).join('')}，v₃ 是多餘的
          </>
        )}
        。係數 aᵢ = 1 代表「選 vᵢ」，{vecs.length} 個係數各選 0 或 1，共 {combos(vecs).length} 種挑法：
      </div>
      <CombosTable vecs={vecs} />
      <p className="text-xs text-slate-600">
        {dep ? (
          <>
            每個結果都被組出兩次（標紅）：{combos(vecs).length} 種挑法只組出 {size} 個不同向量 = <M>{`2^{${Math.log2(size)}}`}</M>，span 是 {Math.log2(size)} 維。
          </>
        ) : (
          <>
            {combos(vecs).length} 種挑法組出 {size} 個不同向量 = <M>{`2^{${Math.log2(size)}}`}</M>：三個向量是 linearly independent，span 是 {Math.log2(size)} 維。
          </>
        )}
      </p>
    </div>
  );
}

function KernelExample() {
  const xs = allVectors(3);
  return (
    <div className="space-y-2">
      <MatrixView matrix={A_KER} name="M =" size="sm" />
      <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-xs">
        {xs.map((x) => {
          const y = matVec(A_KER, x);
          const zero = isZeroVector(y);
          return (
            <div key={x.join('')} className={`rounded-md border px-1 py-1 ${zero ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}>
              <div>x = {x.join('')}</div>
              <div>Mxᵀ = {y.join('')}</div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-600">
        綠色的就是 ker M = {'{'}
        {xs.filter((x) => isZeroVector(matVec(A_KER, x))).map((x) => x.join('')).join(', ')}
        {'}'}：把 {xs.length} 個向量全部代進去，只有它們讓 {A_KER.length} 條方程都成立。
      </p>
    </div>
  );
}

/** RREF cell styling: pivots solid, pivot columns tinted, free columns amber. */
const pivotCell = (pivotCols: number[]) => (i: number, j: number) =>
  pivotCols[i] === j ? 'bg-indigo-600 text-white rounded-full' : pivotCols.includes(j) ? 'bg-indigo-50 text-indigo-900' : 'bg-amber-50 text-amber-800';

function RankExample() {
  const res = rref(A_KER);
  const cols = A_KER[0].length;
  const free = res.freeCols;
  const x = (j: number) => `x_${j + 1}`;
  // each nonzero RREF row r: x_{pivot} + Σ_{free f with a 1} x_f = 0  ⇒  x_{pivot} = Σ x_f
  const eqs = res.pivotCols.map((pcol, r) => {
    const fs = free.filter((f) => res.rref[r][f] === 1);
    return { lhs: [pcol, ...fs].map(x).join(' + '), solved: `${x(pcol)} = ${fs.length ? fs.map(x).join(' + ') : '0'}` };
  });
  const ker = allVectors(cols).filter((v) => isZeroVector(matVec(A_KER, v)));
  return (
    <div className="space-y-3 text-xs text-slate-600">
      <div>
        <div className="mb-1 font-semibold text-slate-700">① Gaussian elimination，化成 RREF</div>
        <div className="flex flex-wrap items-center gap-2">
          <MatrixView matrix={A_KER} name="M =" size="sm" />
          {res.steps.map((st, k) => (
            <span key={k} className="inline-flex items-center gap-2">
              <span className="text-slate-500">
                <M>{`\\xrightarrow{${formatRowOp(st.op)}}`}</M>
              </span>
              <MatrixView matrix={st.matrix} size="sm" cellClass={k === res.steps.length - 1 ? pivotCell(res.pivotCols) : undefined} />
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-1 font-semibold text-slate-700">② 找 pivot</div>
        <p>
          <span className="rounded-full bg-indigo-600 px-1.5 text-white">實心</span> 是 pivot（每一列第一個 1），所在的第 {res.pivotCols.map((j) => j + 1).join('、')} 欄是 pivot column；<span className="rounded bg-amber-50 px-1 text-amber-800">橘色</span>的第 {free.map((j) => j + 1).join('、')} 欄沒有 pivot，所以 {free.map((j) => `x${j + 1}`).join('、')} 是 free variable。
        </p>
      </div>
      <div>
        <div className="mb-1 font-semibold text-slate-700">③ 讀出解（mod 2 中移項不變號）</div>
        <div className="space-y-0.5">
          {eqs.map((e, k) => (
            <div key={k}>
              <M>{`${e.lhs} = 0 \\;\\Rightarrow\\; ${e.solved}`}</M>
            </div>
          ))}
        </div>
        <p className="mt-1">
          每個 free variable <M>{free.map(x).join(', ')}</M> 各自選 0 或 1，其他的就被決定：ker M = {'{'}
          {ker.map((v) => v.join('')).join(', ')}
          {'}'}，和工具箱「Kernel」那一頁逐一代入的結果一樣。
        </p>
      </div>
      <div className="rounded-lg bg-white p-2">
        <div className="mb-1 font-semibold text-slate-700">④ 數一數</div>
        <M>{`\\operatorname{rank} M = ${res.rank}\\ (\\text{pivot}),\\quad \\operatorname{nullity} M = ${free.length}\\ (\\text{free variable}),\\quad ${res.rank} + ${free.length} = ${cols} = \\text{欄數}`}</M>
      </div>
    </div>
  );
}

const CONCEPTS: Concept[] = [
  {
    id: 'matvec',
    short: '矩陣乘向量',
    en: 'Matrix × Vector',
    title: '矩陣乘向量 = 挑欄相加',
    def: (
      <>
        <p>
          向量就是一串 0/1（例如 {N7} 個位元的 codeword），兩個向量相加是<strong>逐位 mod 2</strong>（
          <a href="#/intro" className="font-semibold text-overall-700 hover:underline">
            導論
          </a>
          的 GF(2)），不進位；每個向量加自己都是 0。長度 {N7} 的 0/1 向量一共 <M>{`2^{${N7}} = ${2 ** N7}`}</M> 個。
        </p>
        <p>
          <M>{'Mx^{T}'}</M> 的結果，就是<strong>把 <M>{'x_j = 1'}</M> 的那些欄加起來</strong>。反過來，列向量放左邊的 <M>{'xM'}</M> 是把 <M>{'x_i = 1'}</M> 的那些<strong>列</strong>加起來。
        </p>
        <p>
          <M>{'x^{T}'}</M>（transpose）只是把橫的列向量立起來，變成直的行向量。
        </p>
      </>
    ),
    example: <MatVecExample />,
    use: (
      <>
        上面的兩個電路都是這條規則。發送端 <M>{'c = mG'}</M>：m 裡是 1 的位置（按下的開關）各送出 G 的一列，疊加起來就是 c。接收端 <M>{'Hc^{T}'}</M>：c 裡是 1 的位置各點亮 H 的一欄，疊加起來就是 {H74.length} 盞燈。
      </>
    ),
  },
  {
    id: 'span',
    short: 'Span 與 dimension',
    title: 'Linear combination（線性組合）、span 與 dimension',
    def: (
      <>
        <p>
          <M>{'a_1v_1 + a_2v_2 + \\cdots'}</M>（每個係數 <M>{'a_i \\in \\{0,1\\}'}</M>）叫做 <strong>linear combination</strong>：在 <M>{'\\mathbb{F}_2'}</M> 裡就是<strong>挑一些向量加起來</strong>。所有 linear combination 的集合叫 <M>{'\\operatorname{span}\\{v_1, v_2, \\dots\\}'}</M>；一個矩陣所有列的 span 叫做它的 <strong>row space</strong>。
        </p>
        <p>
          如果只有「全部係數都是 0」才能組出零向量，這組向量就是 <strong>linearly independent</strong>；否則某個向量是其他向量的和，它是多餘的。能生成整個空間、又 linearly independent 的一組向量叫 <strong>basis（基底）</strong>，basis 的向量個數叫 <strong>dimension</strong>，空間 <M>V</M> 的 dimension 記作 <M>{'\\dim V'}</M>。
        </p>
        <p>
          在 <M>{'\\mathbb{F}_2'}</M> 上，空間 <M>V</M> <strong>恰有 <M>{'2^{\\dim V}'}</M> 個向量</strong>：basis 的每個係數 2 種選法，而且不同係數給不同向量。
        </p>
      </>
    ),
    example: <SpanExample />,
    use: (
      <>
        發送端造得出的全部 codeword <M>{'\\{mG\\}'}</M>，就是 G 的 {G74.length} 列的所有 linear combination，也就是 <strong>G 的 row space</strong>。G 的 D1–D4 那 {G74.length} 欄剛好是 identity matrix，所以 G 的 {G74.length} 列是 linearly independent（rank G = {RANK_G}）：row space 是 {RANK_G} 維，恰有 <M>{`2^{${RANK_G}} = ${2 ** RANK_G}`}</M> 個向量，{2 ** RANK_G} 種訊息各對應一個不同的 codeword。
      </>
    ),
  },
  {
    id: 'kernel',
    short: 'Kernel',
    title: 'Kernel，也叫 null space（零空間）',
    def: (
      <>
        <p>
          <M>{'\\ker M = \\{\\, x : Mx^{T} = 0 \\,\\}'}</M>：讓 M 乘出零向量的所有 x，也就是<strong>齊次方程組 <M>{'Mx^{T} = 0'}</M> 的全部解</strong>。M 的每一列就是一條方程。它一定包含 0，而且兩個解相加還是解，所以 ker M 是一個 subspace。
        </p>
        <p>
          <strong>Rank–nullity theorem</strong> 一句話：<M>{'\\operatorname{rank} M + \\dim \\ker M = \\text{M 的欄數}'}</M>。rank M 是互相獨立的方程有幾條，每多一條，解的 dimension 就少 1。
        </p>
      </>
    ),
    example: <KernelExample />,
    use: (
      <>
        讓 {H74.length} 盞燈全暗的 {N7} 位元字串，就是 <strong>ker H</strong>。H 的 P1、P2、P4 那 {H74.length} 欄是 identity matrix，{H74.length} 條方程互相獨立（rank H = {RANK_H}），所以 <M>{`\\dim \\ker H = ${N7} - ${RANK_H} = ${NULLITY_H}`}</M>，ker H 恰有 <M>{`2^{${NULLITY_H}} = ${2 ** NULLITY_H}`}</M> 個向量：全部 <M>{`2^{${N7}} = ${2 ** N7}`}</M> 個 {N7} 位元字串裡，只有這些讓燈全暗。發送端造的 codeword 都在裡面（HGᵀ = 0），而且兩邊一樣多，所以兩者相等。
      </>
    ),
  },
];

/** Rank and nullity for the 「進階」 block: the vocabulary of Gaussian elimination, the theorem, and a worked example. */
export function RankNullityPrimer() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">
        <dl className="grid grid-cols-[minmax(0,6rem)_1fr] gap-x-3 gap-y-2 sm:grid-cols-[minmax(0,8.5rem)_1fr]">
          {[
            ['Gaussian elimination', <>用「交換兩列」「把一列加到另一列」化簡矩陣，解不會改變。</>],
            ['RREF', <>全名 reduced row echelon form（RREF，簡化列梯形），化簡的終點：每列第一個 1 越往下越靠右，它所在的欄其他位置都是 0。</>],
            ['Pivot', <>RREF 每一個非零列的第一個 1 叫 pivot（樞紐），它所在的欄叫 pivot column（樞紐欄）。</>],
            ['Free variable', <>沒有 pivot 的欄對應的未知數叫 free variable（自由變數），可以任意選 0 或 1。</>],
            ['Rank', <>等於 pivot 的個數（= linearly independent 的列數）。</>],
            ['Nullity', <>等於 free variable 的個數（= <M>{'\\dim \\ker M'}</M>）。</>],
          ].map(([en, d]) => (
            <div key={en as string} className="contents">
              <dt className="font-semibold">{en}</dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <p>
          <strong>Rank–nullity theorem</strong>：每一欄要嘛有 pivot、要嘛對應一個 free variable，所以
        </p>
        <Tex block>{'\\operatorname{rank} M + \\operatorname{nullity} M = \\text{M 的欄數}'}</Tex>
        <p className="rounded-lg border border-sky-200 bg-sky-50/60 p-2">
          <span className="mr-1 font-semibold text-sky-800">在 Hamming(7,4) 裡：</span>H 本身就是 RREF：pivot 在 P1、P2、P4，free variable 是 D1–D4。所以 rank H = {RANK_H}、nullity H = {NULLITY_H}，ker H 有{' '}
          <M>{`2^{${NULLITY_H}} = ${2 ** NULLITY_H}`}</M> 個向量。也就是 data bit 自由選、parity bit 被決定：這正是編碼。
        </p>
      </div>
      <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
        <div className="mb-2 text-xs font-semibold text-slate-500">小例子（即時計算）</div>
        <RankExample />
      </div>
    </div>
  );
}

/** One card, a tab menu on top: pick which linear-algebra concept to read. */
export function LinAlgPrimer({ tab, onTab, framed = true }: { tab?: number; onTab?: (i: number) => void; framed?: boolean } = {}) {
  const [own, setOwn] = useState(0);
  const i = tab ?? own;
  const setI = onTab ?? setOwn;
  const c = CONCEPTS[i];
  return (
    <div className={framed ? 'card min-w-0 p-4 sm:p-5' : 'min-w-0'}>
      {framed && <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">線性代數工具箱</div>}
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist" aria-label="線性代數工具箱">
        {CONCEPTS.map((x, k) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={k === i}
            onClick={() => setI(k)}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${k === i ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}
          >
            <span className="mr-1 text-xs opacity-60">{k + 1}</span>
            {x.short}
            {x.en && `（${x.en}）`}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <h3 className="mb-3 text-base font-bold text-slate-900">{c.title}</h3>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="min-w-0 space-y-2 text-sm leading-relaxed text-slate-700">{c.def}</div>
          <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-500">小例子（即時計算）</div>
            {c.example}
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50/60 p-3 text-sm text-slate-700">
          <p>
            <span className="mr-1 font-semibold text-sky-800">在 Hamming(7,4) 裡：</span>
            {c.use}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <button type="button" className="btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>
          <ChevronLeft className="h-4 w-4" /> {i > 0 ? CONCEPTS[i - 1].short : ''}
        </button>
        <span className="text-xs text-slate-400">
          {i + 1} / {CONCEPTS.length}
        </span>
        <button type="button" className="btn-ghost" disabled={i === CONCEPTS.length - 1} onClick={() => setI(i + 1)}>
          {i < CONCEPTS.length - 1 ? CONCEPTS[i + 1].short : ''} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
