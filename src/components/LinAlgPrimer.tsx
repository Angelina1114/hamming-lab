import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { type Bit, type Matrix, G74, H74, allVectors, bitsToString, flipBit, formatRowOp, isZeroVector, matVec, rref, span, vecAdd } from '../core';
import { M, Tex } from './Tex';
import { BitString } from './Bits';
import { ColumnVector, MatrixView } from './MatrixView';

/* ---------- small fixed examples (all results below are computed) ---------- */

const U: Bit[] = [1, 0, 1, 1];
const V: Bit[] = [0, 1, 1, 0];

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

/* ---------- the concepts ---------- */

interface Concept {
  id: string;
  short: string;
  en: string;
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
        <MatrixView matrix={A_MV} name="A" size="sm" highlightCols={picked} />
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

function KernelExample() {
  const xs = allVectors(3);
  return (
    <div className="space-y-2">
      <MatrixView matrix={A_KER} name="A =" size="sm" />
      <div className="grid grid-cols-4 gap-1.5 text-center font-mono text-xs">
        {xs.map((x) => {
          const y = matVec(A_KER, x);
          const zero = isZeroVector(y);
          return (
            <div key={x.join('')} className={`rounded-md border px-1 py-1 ${zero ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-500'}`}>
              <div>x = {x.join('')}</div>
              <div>Axᵀ = {y.join('')}</div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-600">
        綠色的就是 ker A = {'{'}
        {xs.filter((x) => isZeroVector(matVec(A_KER, x))).map((x) => x.join('')).join(', ')}
        {'}'}：把 8 個向量全部代進去，只有它們讓兩條方程都成立。
      </p>
    </div>
  );
}

/** RREF cell styling: pivots solid, pivot columns tinted, free columns amber. */
const pivotCell = (pivotCols: number[]) => (i: number, j: number) =>
  pivotCols[i] === j ? 'bg-indigo-600 text-white rounded-full' : pivotCols.includes(j) ? 'bg-indigo-50 text-indigo-900' : 'bg-amber-50 text-amber-800';

function RankExample() {
  const res = rref(A_KER);
  const n = A_KER[0].length;
  const free = res.freeCols;
  const x = (j: number) => `x_${j + 1}`;
  // each nonzero RREF row r: x_{pivot} + Σ_{free f with a 1} x_f = 0  ⇒  x_{pivot} = Σ x_f
  const eqs = res.pivotCols.map((pcol, r) => {
    const fs = free.filter((f) => res.rref[r][f] === 1);
    return { lhs: [pcol, ...fs].map(x).join(' + '), solved: `${x(pcol)} = ${fs.length ? fs.map(x).join(' + ') : '0'}` };
  });
  const ker = allVectors(n).filter((v) => isZeroVector(matVec(A_KER, v)));
  return (
    <div className="space-y-3 text-xs text-slate-600">
      <div>
        <div className="mb-1 font-semibold text-slate-700">① 高斯消去，化成 RREF</div>
        <div className="flex flex-wrap items-center gap-2">
          <MatrixView matrix={A_KER} name="A =" size="sm" />
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
        <div className="mb-1 font-semibold text-slate-700">② 找樞紐</div>
        <p>
          <span className="rounded-full bg-indigo-600 px-1.5 text-white">實心</span> 是樞紐（每一列第一個 1），所在的第 {res.pivotCols.map((j) => j + 1).join('、')} 欄是樞紐欄；<span className="rounded bg-amber-50 px-1 text-amber-800">橘色</span>的第 {free.map((j) => j + 1).join('、')} 欄沒有樞紐，所以 {free.map((j) => `x${j + 1}`).join('、')} 是自由變數。
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
          自由變數 <M>{free.map(x).join(', ')}</M> 各自選 0 或 1，其他的就被決定：ker A = {'{'}
          {ker.map((v) => v.join('')).join(', ')}
          {'}'}，和「核空間」那一頁逐一代入的結果一樣。
        </p>
      </div>
      <div className="rounded-lg bg-white p-2">
        <div className="mb-1 font-semibold text-slate-700">④ 數一數</div>
        <M>{`\\operatorname{rank} A = ${res.rank}\\ (\\text{樞紐}),\\quad \\operatorname{nullity} A = ${free.length}\\ (\\text{自由變數}),\\quad ${res.rank} + ${free.length} = ${n} = n`}</M>
      </div>
    </div>
  );
}

const CONCEPTS: Concept[] = [
  {
    id: 'vector',
    short: '向量',
    en: 'Vector',
    title: '向量與 𝔽₂ⁿ',
    def: (
      <>
        <p>
          <M>{'\\mathbb{F}_2'}</M>（也寫成 GF(2)）就是 <M>{'\\{0,1\\}'}</M> 配上 mod 2 的加法與乘法（導論）。<M>{'\\mathbb{F}_2^n'}</M> 是所有長度 n 的 0/1 向量，一共 <M>{'2^n'}</M> 個。
        </p>
        <p>
          向量加法 = <strong>逐位 mod 2</strong>；純量只有 0 和 1，所以純量乘法只有 <M>{'0 \\cdot v = 0'}</M>、<M>{'1 \\cdot v = v'}</M> 兩種。
        </p>
      </>
    ),
    example: (
      <div className="space-y-1 font-mono text-sm">
        <div>
          u = <BitString bits={U} />
        </div>
        <div>
          v = <BitString bits={V} />
        </div>
        <div className="border-t border-slate-200 pt-1">
          u + v = <BitString bits={vecAdd(U, V)} className="font-bold" />
        </div>
        <div className="text-slate-500">
          v + v = <BitString bits={vecAdd(V, V)} />（每個向量都是自己的負元）
        </div>
      </div>
    ),
    use: (
      <>
        訊息 <M>{'m \\in \\mathbb{F}_2^4'}</M>、codeword 與接收字 <M>{'c, r \\in \\mathbb{F}_2^7'}</M> 都是向量；<M>{'\\mathbb{F}_2^7'}</M> 一共 <M>{'2^7 = 128'}</M> 個向量，其中只有 16 個是 codeword。
      </>
    ),
  },
  {
    id: 'matvec',
    short: '矩陣 × 向量',
    en: 'Matrix × Vector',
    title: '矩陣乘向量 = 挑欄相加',
    def: (
      <>
        <p>
          <M>{'Ax^{T}'}</M> 的結果，就是<strong>把 <M>{'x_j = 1'}</M> 的那些欄加起來</strong>。反過來，列向量放左邊的 <M>{'xA'}</M> 是把 <M>{'x_i = 1'}</M> 的那些<strong>列</strong>加起來。
        </p>
        <p>
          <M>{'x^{T}'}</M>（轉置）只是把橫的列向量立起來，變成直的行向量。
        </p>
      </>
    ),
    example: <MatVecExample />,
    use: (
      <>
        下一段會建出 G 與 H。到時候檢查 <M>{'Hc^{T}'}</M> 就是挑出 c 裡是 1 的位置、把 H 的那些欄相加；編碼 <M>{'c = mG'}</M> 就是挑出 m 裡是 1 的位置、把 G 的那些列相加。
      </>
    ),
  },
  {
    id: 'span',
    short: '線性組合與生成',
    en: 'Span',
    title: '線性組合與生成空間（span）',
    def: (
      <>
        <p>
          <M>{'a_1v_1 + \\cdots + a_kv_k'}</M>（每個 <M>{'a_i \\in \\{0,1\\}'}</M>）叫做線性組合：在 <M>{'\\mathbb{F}_2'}</M> 裡就是<strong>挑一些向量加起來</strong>。
        </p>
        <p>
          所有線性組合的集合叫 <M>{'\\operatorname{span}\\{v_1,\\dots,v_k\\}'}</M>。一個矩陣所有列的 span 叫做它的<strong>列空間</strong>（row space）。
        </p>
      </>
    ),
    example: (
      <div className="space-y-1">
        <div className="text-xs text-slate-500">
          v₁ = {SPAN_VECS[0].join('')}、v₂ = {SPAN_VECS[1].join('')}、v₃ = {SPAN_VECS[2].join('')}。係數 aᵢ = 1 代表「選 vᵢ」，0 代表不選；3 個係數各選 0 或 1，共 8 種挑法。把選到的向量加起來（mod 2）：
        </div>
        <CombosTable vecs={SPAN_VECS} />
        <p className="text-xs text-slate-600">
          右欄這 {combos(SPAN_VECS).length} 個結果合起來就是 span{'{'}v₁, v₂, v₃{'}'}，而且 {spanSize(SPAN_VECS)} 個都不一樣——下一頁會說明這代表什麼。
        </p>
      </div>
    ),
    use: (
      <>
        下一段的 G 有 4 列。編碼器能產生的全部 codeword <M>{'\\{mG\\}'}</M>，就是這 4 列的所有線性組合，也就是 <strong>G 的列空間</strong>。
      </>
    ),
  },
  {
    id: 'basis',
    short: '基底與維度',
    en: 'Basis & Dimension',
    title: '線性獨立、基底與維度',
    def: (
      <>
        <p>
          如果只有「全部係數都是 0」才能組出零向量，這組向量就<strong>線性獨立</strong>；否則某個向量是其他向量的和，它是多餘的。
        </p>
        <p>
          能生成整個空間、又線性獨立的一組向量叫<strong>基底</strong>；基底的向量個數叫<strong>維度</strong> dim。在 <M>{'\\mathbb{F}_2'}</M> 上，d 維空間<strong>恰有 <M>{'2^d'}</M> 個向量</strong>（每個係數 2 種選法，而且不同係數給不同向量）。
        </p>
      </>
    ),
    example: (
      <div className="space-y-1">
        <div className="text-xs text-slate-500">
          {DEP_VECS[0].join('')}、{DEP_VECS[1].join('')}、{DEP_VECS[2].join('')}：因為 {DEP_VECS[0].join('')} + {DEP_VECS[1].join('')} = {vecAdd(DEP_VECS[0], DEP_VECS[1]).join('')}，第三個是多餘的
        </div>
        <CombosTable vecs={DEP_VECS} />
        <p className="text-xs text-slate-600">
          每個向量都恰好被組出兩次（全部標紅）：8 種係數只組出 {spanSize(DEP_VECS)} 個不同向量 = <M>{'2^2'}</M>，所以 span 是 2 維。上一頁的 3 個向量是獨立的，8 種係數組出 {spanSize(SPAN_VECS)} 個不同向量 = <M>{'2^3'}</M>。
        </p>
      </div>
    ),
    use: (
      <>
        下一段會看到 G 的 D1–D4 那 4 欄剛好是單位矩陣，所以 G 的 4 列線性獨立（rank G = {rref(G74).rank}）。它們的 span 是 4 維，恰有 <M>{'2^4 = 16'}</M> 個向量：16 種訊息各對應一個不同的 codeword。
      </>
    ),
  },
  {
    id: 'kernel',
    short: '核空間',
    en: 'Kernel',
    title: '核空間（kernel，也叫零空間）',
    def: (
      <>
        <p>
          <M>{'\\ker A = \\{\\, x : Ax^{T} = 0 \\,\\}'}</M>：讓 A 乘出零向量的所有 x，也就是<strong>齊次方程組 <M>{'Ax^{T} = 0'}</M> 的全部解</strong>。A 的每一列就是一條方程。
        </p>
        <p>它一定包含 0，而且兩個解相加還是解，所以 ker A 是一個子空間。</p>
      </>
    ),
    example: <KernelExample />,
    use: (
      <>
        把第 1 章的三個檢查寫成 H 之後，「通過全部檢查」的向量就是 <strong>ker H</strong>。第 1 章編出來的 16 個 codeword 都在裡面；它們是不是 ker H 的全部，第 4 段會用維度證明。
      </>
    ),
  },
  {
    id: 'rank',
    short: '秩與零度',
    en: 'Rank & Nullity',
    title: '秩與零度',
    def: (
      <>
        <dl className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-x-3 gap-y-2">
          {[
            ['高斯消去', 'Gaussian elimination', <>用「交換兩列」「把一列加到另一列」化簡矩陣，解不會改變。</>],
            ['RREF', 'reduced row echelon form', <>化簡的終點：每列第一個 1 越往下越靠右，它所在的欄其他位置都是 0。</>],
            ['樞紐', 'pivot', <>RREF 每一個非零列的第一個 1。它所在的欄叫樞紐欄。</>],
            ['自由變數', 'free variable', <>沒有樞紐的欄對應的未知數，可以任意選 0 或 1。</>],
            ['秩', 'rank', <>樞紐的個數（= 線性獨立的列數）。</>],
            ['零度', 'nullity', <>自由變數的個數（= <M>{'\\dim \\ker A'}</M>）。</>],
          ].map(([zh, en, d]) => (
            <div key={zh as string} className="contents">
              <dt className="font-semibold">
                <span className="whitespace-nowrap">{zh}</span>
                <span className="block text-[11px] font-normal leading-tight text-slate-400">{en}</span>
              </dt>
              <dd>{d}</dd>
            </div>
          ))}
        </dl>
        <p>
          <strong>Rank–Nullity Theorem</strong>：每一欄要嘛有樞紐、要嘛對應一個自由變數，所以
        </p>
        <Tex block>{'\\operatorname{rank} A + \\operatorname{nullity} A = n \\quad (n = \\text{欄數})'}</Tex>
      </>
    ),
    example: <RankExample />,
    use: (
      <>
        H 本身就是 RREF：樞紐在 P1、P2、P4，自由變數是 D1–D4。所以 rank H = {rref(H74).rank}、nullity H = {7 - rref(H74).rank}，ker H 有 <M>{`2^{${7 - rref(H74).rank}} = ${2 ** (7 - rref(H74).rank)}`}</M> 個向量。資訊位元自由選、同位位元被決定——正是編碼。
      </>
    ),
  },
];

/** One card, a tab menu on top: pick which linear-algebra concept to read. */
export function LinAlgPrimer({ tab, onTab }: { tab?: number; onTab?: (i: number) => void } = {}) {
  const [own, setOwn] = useState(0);
  const i = tab ?? own;
  const setI = onTab ?? setOwn;
  const c = CONCEPTS[i];
  return (
    <div className="card min-w-0 p-4 sm:p-5">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">線性代數工具箱</div>
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
            {x.short}（{x.en}）
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
          <span className="mr-1 font-semibold text-sky-800">在 Hamming(7,4) 裡：</span>
          {c.use}
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
