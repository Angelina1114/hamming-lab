import type { ReactNode } from 'react';
import { type Bit, DATA_INDICES, G74, H74, LAYOUT_74, PARITY_CHECKS, PARITY_INDICES, column, encode74ByParity, isZeroMatrix, matMul, rank, syndromeToPosition, transpose } from '../../core';
import { M, Tex } from '../../components/Tex';
import { MatrixView, ColumnVector } from '../../components/MatrixView';
import type { DeckSlide } from '../../components/Deck';
import type { Stepper } from '../../components/l2/Stepper';

/* ------------------------------------------------------------------ */
/* Shared pieces                                                      */
/* ------------------------------------------------------------------ */

/** Keeps its place from the first step (so the slide never reflows) and fades in at its step. */
function Reveal({ on, className = '', children }: { on: boolean; className?: string; children: ReactNode }) {
  return (
    <div aria-hidden={!on} className={`transition-opacity duration-500 ${on ? 'opacity-100' : 'invisible opacity-0'} ${className}`}>
      {children}
    </div>
  );
}

/** 'P1' → 'P_1' for KaTeX */
const sub = (label: string) => label.replace(/(\d)/, '_$1');
const roleText = (i: number) => (LAYOUT_74[i].role === 'parity' ? 'text-parity-700' : 'text-data-700');

/** A 7-bit word, parity bits and data bits in their own colours. */
function Word({ bits }: { bits: readonly Bit[] }) {
  return (
    <span className="font-mono text-2xl font-bold tracking-[0.12em]">
      {bits.map((b, i) => (
        <span key={i} className={roleText(i)}>
          {b}
        </span>
      ))}
    </span>
  );
}

const N = LAYOUT_74.length; // 7
const R = PARITY_CHECKS.length; // 3
const K = N - R; // 4

/** H built row by row from the chapter-1 checks: covered position → 1, not covered → 0. */
const H_ROWS: Bit[][] = PARITY_CHECKS.map((pc) => LAYOUT_74.map((p) => (pc.covered.includes(p.index) ? 1 : 0) as Bit));
/** Left-hand side of each check as a homogeneous equation, e.g. c_1 + c_3 + c_5 + c_7 */
const H_SUMS = PARITY_CHECKS.map((pc) => pc.covered.map((j) => `c_${j + 1}`).join(' + '));
/** G built from the codewords of the unit messages e_1 … e_4. */
const UNIT: Bit[][] = Array.from({ length: K }, (_, i) => Array.from({ length: K }, (_, k) => (k === i ? 1 : 0) as Bit));
const G_ROWS = UNIT.map((e) => encode74ByParity(e));
const G_FROM_UNITS = G_ROWS.map((r) => r.codeword);
const DATA_LABELS = DATA_INDICES.map((i) => LAYOUT_74[i].label);

/* ------------------------------------------------------------------ */
/* 1. 第 2 章導論：為什麼要用矩陣                                      */
/* ------------------------------------------------------------------ */

function IntroSlide() {
  return (
    <div className="space-y-5 text-xl">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-slate-50 p-5">
          <div className="mb-2 font-bold text-slate-900">問題：方程一條一條寫，寫不完</div>
          <p>第 1 章用 {R} 條 XOR 方程管 {N} 個位元，逐條寫還算容易。</p>
          <p className="mt-2 text-lg text-slate-600">
            碼長變成 64、128、甚至上千位元時，每條方程有幾十到幾百項：我們需要一套能<strong>系統化計算</strong>、也能<strong>證明性質</strong>的語言。
          </p>
        </div>
        <div className="rounded-2xl bg-sky-50 p-5">
          <div className="font-bold text-sky-900">關鍵：XOR 就是 GF(2) 的加法</div>
          <p className="mb-2 text-lg text-slate-600">
            所以三條規則都是<strong>線性方程</strong>，線性代數正好提供這套語言：
          </p>
          <ul className="space-y-1">
            <li>
              「有多少個 codeword？」→ 子空間的<strong>維度</strong>
            </li>
            <li>
              「哪些字串合法？」→ <strong>解方程組</strong>
            </li>
            <li>
              編碼、檢查 → <strong>矩陣乘法</strong>，碼長再長都一樣算
            </li>
          </ul>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="rounded-2xl bg-data-50 p-5">
          <div className="font-bold text-data-700">
            生成矩陣 G（{G74.length} × {N}）
          </div>
          <div className="my-2 text-2xl">
            <M>{'c = mG'}</M>
          </div>
          <p className="text-lg text-slate-600">
            負責<strong>編碼</strong>：訊息 m 乘上 G，得到 codeword c。
          </p>
        </div>
        <div className="rounded-2xl bg-parity-50 p-5">
          <div className="font-bold text-parity-700">
            同位檢查矩陣 H（{H74.length} × {N}）
          </div>
          <div className="my-2 text-2xl">
            <M>{'Hc^{T} = 0'}</M>
          </div>
          <p className="text-lg text-slate-600">
            負責<strong>檢查</strong>：c 合法 ⇔ {R} 個檢查全部通過。
          </p>
        </div>
        <div className="rounded-2xl bg-emerald-50 p-5">
          <div className="font-bold text-emerald-800">本章結論</div>
          <div className="my-2 text-2xl">
            <M>{'C = \\{mG\\} = \\ker H'}</M>
          </div>
          <p className="text-lg text-slate-600">G 的列空間 = H 的核空間：同一個 code 的兩種描述。</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. H 怎麼來的                                                       */
/* ------------------------------------------------------------------ */

function HFromChecksSlide({ s }: { s: Stepper }) {
  const hcTex = `Hc^{T} = \\begin{pmatrix} ${H_SUMS.join(' \\\\ ')} \\end{pmatrix} = \\begin{pmatrix} ${H_ROWS.map(() => '0').join(' \\\\ ')} \\end{pmatrix}`;
  return (
    <div className="space-y-4 text-xl">
      <p className="text-lg text-slate-600">
        第 1 章的規則：每個檢查涵蓋的位置（<strong>包含同位位元自己</strong>）要有偶數個 1。⊕ 就是 GF(2) 的加法；兩邊同加同位位元（<M>{'x + x = 0'}</M>），再把位元改用位置編號{' '}
        <M>{'c_j'}</M> 表示（位置 1–7 依序是 {LAYOUT_74.map((p) => p.label).join(' ')}），每條規則就變成一條「= 0」的<strong>齊次線性方程</strong>。
      </p>
      <table className="w-full text-left">
        <thead>
          <tr className="text-base text-slate-500">
            <th className="py-1 pr-4 font-normal">檢查</th>
            <th className="pr-4 font-normal">第 1 章的規則</th>
            <th className="pr-4 font-normal">
              齊次線性方程（<M>{'c_j'}</M> = 位置 j 的位元）
            </th>
            <th className={`font-normal ${s.step >= 1 ? '' : 'invisible'}`}>
              H 的這一列：涵蓋記 1、沒涵蓋記 0
              {/* position numbers line each bit up with its c_j */}
              <div className="mt-0.5 flex gap-1 text-sm">
                {LAYOUT_74.map((p) => (
                  <span key={p.index} className="w-9 text-center">
                    {p.position}
                  </span>
                ))}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {PARITY_CHECKS.map((pc, i) => (
            <tr key={pc.name} className="border-t border-slate-100">
              <td className="py-1.5 pr-4 font-semibold text-parity-700">{pc.name}</td>
              <td className="pr-4">
                <M>{`${sub(pc.name)} = ${pc.dataTerms.map(sub).join(' \\oplus ')}`}</M>
              </td>
              <td className="pr-4">
                <M>{`${H_SUMS[i]} = 0`}</M>
              </td>
              <td className={s.step >= 1 ? '' : 'invisible'}>
                <div className="flex gap-1">
                  {H_ROWS[i].map((b, j) => (
                    <span key={j} className={`grid h-9 w-9 place-items-center rounded-lg font-mono text-xl font-bold ${b ? 'bg-parity-100 text-parity-700' : 'bg-slate-50 text-slate-300'}`}>
                      {b}
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Reveal on={s.step >= 2} className="flex flex-wrap items-center gap-6 rounded-2xl bg-parity-50 p-3">
        <MatrixView matrix={H_ROWS} name="H =" colLabels={LAYOUT_74.map((p) => p.position)} rowLabels={PARITY_CHECKS.map((pc) => pc.name)} />
        <p className="min-w-0 flex-1 basis-48 text-lg text-slate-700">
          三列疊起來，就是 {R} × {N} 的<strong>同位檢查矩陣 H</strong>：第 i 列是第 i 個檢查，第 j 欄對應位置 j。
        </p>
        <Reveal on={s.step >= 3} className="space-y-1">
          <Tex className="text-xl">{hcTex}</Tex>
          <p className="text-lg font-semibold text-emerald-800">
            c 是 codeword ⇔ <M>{'Hc^{T} = 0'}</M>：三個檢查全部通過。
          </p>
        </Reveal>
      </Reveal>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 3. 為什麼 H 要這樣設計                                               */
/* ------------------------------------------------------------------ */

function WhyHSlide({ s }: { s: Stepper }) {
  const cols = LAYOUT_74.map((p) => column(H74, p.index));
  const nonzero = cols.every((c) => c.some(Boolean));
  const distinct = new Set(cols.map((c) => c.join(''))).size === cols.length;
  const maxCols = 2 ** H74.length - 1;
  const isBinary = LAYOUT_74.every((p) => syndromeToPosition(column(H74, p.index)) === p.position);
  const unitAtParity = PARITY_INDICES.every((i) => column(H74, i).filter(Boolean).length === 1);
  const ex = LAYOUT_74[5]; // position 6
  const exCol = column(H74, ex.index);
  const showUnits = s.step >= 5;

  const points: { lead: ReactNode; text: ReactNode; ok: boolean }[] = [
    {
      lead: <>{N} 欄都不是 0 → 單一錯誤一定被偵測</>,
      text: <>位置 j 出錯，第 j 欄裡是 1 的檢查會失敗（至少一個）。</>,
      ok: nonzero,
    },
    {
      lead: <>{N} 欄兩兩不同 → 單一錯誤可以定位</>,
      text: <>錯在不同位置，失敗的檢查組合就不同。</>,
      ok: distinct,
    },
    {
      lead: (
        <>
          {H74.length} 列只有 <M>{`2^{${H74.length}} - 1 = ${maxCols}`}</M> 種非零欄 → n = {maxCols} 最長
        </>
      ),
      text: (
        <>
          要同時做到 ①②，{R} 個檢查最多只能管 {maxCols} 個位置；資訊位元 <M>{`k = ${N} - ${R} = ${K}`}</M>。
        </>
      ),
      ok: N === maxCols,
    },
    {
      lead: <>第 j 欄就是 j 的二進位 → 不必查表</>,
      text: <>第 3 章：單一錯誤時 Syndrome = 錯誤位置那一欄，直接讀出位置。</>,
      ok: isBinary,
    },
    {
      lead: <>位置 1、2、4 是單位欄 → 同位位元直接算</>,
      text: (
        <>
          三欄合起來是 <M>{`I_${R}`}</M>：每條方程只含一個同位位元，移項就解出它。
        </>
      ),
      ok: unitAtParity,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 text-xl lg:grid-cols-[5fr_7fr]">
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="font-bold text-slate-900">按欄讀 H：第 j 欄 = 位置 j 被哪些檢查涵蓋</div>
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {LAYOUT_74.map((p, k) => {
            const unit = showUnits && p.role === 'parity';
            return (
              <div key={p.index} className={`flex flex-col items-center gap-1 rounded-xl border-2 py-1.5 transition-colors ${unit ? 'border-parity-300 bg-parity-50' : 'border-slate-200 bg-white'}`}>
                <span className={`text-sm font-semibold ${roleText(p.index)}`}>{p.label}</span>
                <ColumnVector bits={cols[k]} size="sm" />
                <span className="text-lg font-bold leading-none">{p.position}</span>
                <span className="font-mono text-xs text-slate-500">{p.position.toString(2).padStart(H74.length, '0')}₂</span>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-lg text-slate-600">
          第 1 章：<M>{'P_b'}</M> 涵蓋「二進位含有 b」的位置。所以第 j 欄由上往下是 j 的 1、2、4 位，由下往上讀就是 j 的二進位。
        </p>
        <p className="mt-1 whitespace-nowrap text-lg text-slate-600">
          例：第 {ex.position} 欄 <M>{`(${exCol.join(',')})^{T} \\to ${exCol.map((b, i) => `${b}\\cdot ${2 ** i}`).join(' + ')} = ${syndromeToPosition(exCol)}`}</M>
        </p>
      </div>
      <div>
        <div className="mb-3 font-bold text-slate-900">這樣排，帶來五個好處</div>
        <ol className="space-y-3">
          {points.map((pt, i) => (
            <Reveal key={i} on={s.step >= i + 1} className="flex gap-3">
              <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-slate-900 text-base font-bold text-white">{i + 1}</span>
              <div>
                <div className="font-semibold text-slate-900">
                  {pt.lead}
                  {pt.ok ? '' : ' ✗'}
                </div>
                <div className="text-lg text-slate-600">{pt.text}</div>
              </div>
            </Reveal>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. G 怎麼來的                                                       */
/* ------------------------------------------------------------------ */

function GFromUnitsSlide({ s }: { s: Stepper }) {
  return (
    <div className="space-y-4 text-xl">
      <div className="rounded-2xl bg-slate-50 p-4">
        <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1">
          <span className="font-bold text-slate-900">每個同位位元都是資訊位元的和：</span>
          {PARITY_CHECKS.map((pc) => (
            <M key={pc.name}>{`${sub(pc.name)} = ${pc.dataTerms.map(sub).join(' + ')}`}</M>
          ))}
        </div>
        <p className="mt-1 text-lg text-slate-600">
          → 編碼是<strong>線性</strong>的：訊息相加，codeword 也相加。所以只要編好 {K} 個單位訊息 <M>{`e_1, \\dots, e_${K}`}</M>：任何訊息都是其中幾個 <M>{'e_i'}</M> 的和（例如 <M>{'1011 = e_1 + e_3 + e_4'}</M>），codeword 就是對應那幾個 <M>{'g_i'}</M> 的和。
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Reveal on={s.step >= 1}>
          <table className="w-full text-left">
            <thead>
              <tr className="text-base text-slate-500">
                <th className="py-1 pr-3 font-normal">單位訊息</th>
                <th className="pr-3 font-normal">用第 1 章的規則算</th>
                <th className="font-normal">
                  codeword <M>{'g_i'}</M>
                </th>
              </tr>
            </thead>
            <tbody>
              {G_ROWS.map((r, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="py-1.5 pr-3">
                    <M>{`e_${i + 1}`}</M> = <span className="font-mono">{UNIT[i].join('')}</span>
                  </td>
                  <td className="pr-3 text-lg text-slate-600">{r.parities.map((p) => `${p.name} = ${p.value}`).join('、')}</td>
                  <td>
                    <Word bits={r.codeword} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <div className="space-y-3">
          <Reveal on={s.step >= 2} className="space-y-2">
            <MatrixView
              matrix={G_FROM_UNITS}
              name="G ="
              colLabels={LAYOUT_74.map((p) => p.label)}
              rowLabels={DATA_LABELS}
              cellClass={(_, j, v) => {
                if (s.step < 3) return undefined;
                if (LAYOUT_74[j].role === 'data') return v ? 'bg-data-100 text-data-700' : 'bg-data-50 text-data-300';
                return v ? 'bg-parity-100 text-parity-700' : 'bg-parity-50 text-parity-300';
              }}
            />
            <div>
              <M>{`c = ${Array.from({ length: K }, (_, i) => `m_${i + 1} g_${i + 1}`).join(' + ')} = mG`}</M>
            </div>
          </Reveal>
          <Reveal on={s.step >= 3} className="rounded-2xl bg-data-50 p-3 text-lg text-slate-700">
            {DATA_LABELS[0]}–{DATA_LABELS[K - 1]} 四欄是單位矩陣 <M>{`I_${K}`}</M>：codeword 原封不動地帶著訊息；P1、P2、P4 三欄就是上面三條公式的係數。
          </Reveal>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 5. G 與 H 的關係                                                     */
/* ------------------------------------------------------------------ */

function GAndHSlide({ s }: { s: Stepper }) {
  const HGt = matMul(H74, transpose(G74));
  const zero = isZeroMatrix(HGt);
  const rankG = rank(G74);
  const rankH = rank(H74);
  const gLabels = Array.from({ length: G74.length }, (_, j) => (
    <span key={j}>
      g<sub>{j + 1}</sub>
    </span>
  ));
  const hLabels = PARITY_CHECKS.map((pc) => pc.name);
  return (
    <div className="space-y-4 text-xl">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <MatrixView matrix={H74} name="H" size="sm" rowLabels={hLabels} />
          <span>·</span>
          <MatrixView matrix={transpose(G74)} name={<M>{'G^{T}'}</M>} size="sm" colLabels={gLabels} />
          <span>=</span>
          <MatrixView matrix={HGt} size="sm" rowLabels={hLabels} colLabels={gLabels} cellClass={() => 'bg-emerald-50 text-emerald-700'} />
        </div>
        <div className="min-w-0 flex-1 basis-72 space-y-2">
          <p>
            第 (i, j) 格 = H 的第 i 列 · <M>{'g_j'}</M>：第 i 個檢查套在 <M>{'g_j'}</M> 上。
          </p>
          <p className="text-lg text-slate-600">
            {zero ? `結果是 ${HGt.length} × ${HGt[0].length} 零矩陣` : '結果不是零矩陣'}：G 的每一列都通過 H 的每一個檢查。
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.15fr_1fr]">
        <Reveal on={s.step >= 1} className="h-full rounded-2xl bg-sky-50 p-4">
          <div className="mb-1 font-bold text-sky-900">① 生成出來的都合法</div>
          <div className="text-lg">
            <M>{'Hc^{T} = H(mG)^{T} = (HG^{T})\\,m^{T} = 0'}</M>
          </div>
          <p className="mt-1 text-lg text-slate-600">
            對每個 m 都成立，所以{' '}
            <span className="whitespace-nowrap">
              <M>{'\\{mG\\} \\subseteq \\ker H'}</M>。
            </span>
          </p>
        </Reveal>
        <Reveal on={s.step >= 2} className="h-full rounded-2xl bg-amber-50 p-4">
          <div className="mb-1 font-bold text-amber-900">② 兩邊維度一樣</div>
          <ul className="space-y-0.5 text-lg text-slate-700">
            <li>
              G 的 D1–D4 欄是 <M>{`I_${G74.length} \\Rightarrow`}</M>{' '}
              <span className="whitespace-nowrap">
                <M>{`\\dim\\{mG\\} = \\operatorname{rank} G = ${rankG}`}</M>
              </span>
            </li>
            <li>
              H 的 P1、P2、P4 欄是 <M>{`I_${H74.length} \\Rightarrow \\operatorname{rank} H = ${rankH}`}</M>
            </li>
            <li>
              Rank–Nullity：<M>{`\\dim\\ker H = ${N} - ${rankH} = ${N - rankH}`}</M>
            </li>
          </ul>
        </Reveal>
        <Reveal on={s.step >= 3} className="h-full rounded-2xl bg-emerald-50 p-4">
          <div className="mb-1 font-bold text-emerald-800">③ 所以兩者相等</div>
          <div className="text-xl">
            <M>{'C = \\{mG\\} = \\ker H'}</M>
          </div>
          <p className="mt-1 text-lg text-slate-600">
            {rankG} 維子空間包含在 {N - rankH} 維子空間裡，只能相等：G 編出來的，正好是 H 會通過的 <M>{`2^{${rankG}} = ${2 ** rankG}`}</M> 個 codeword。
          </p>
        </Reveal>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Export                                                             */
/* ------------------------------------------------------------------ */

export const CH2_SLIDES: DeckSlide<null>[] = [
  { title: '第 2 章：矩陣 G 與 H', sub: '為什麼要把三條 XOR 方程寫成矩陣？', steps: () => 1, render: () => <IntroSlide /> },
  { title: '第 2 章：H 怎麼來的', sub: '三個檢查 = 三條齊次線性方程 = H 的三列', steps: () => 4, render: (s) => <HFromChecksSlide s={s} /> },
  { title: '第 2 章：為什麼 H 要這樣設計', sub: '按欄讀：第 j 欄 = j 的二進位', steps: () => 6, render: (s) => <WhyHSlide s={s} /> },
  { title: '第 2 章：G 怎麼來的', sub: '編碼是線性的：只要編 4 個單位訊息', steps: () => 4, render: (s) => <GFromUnitsSlide s={s} /> },
  { title: '第 2 章：G 與 H 的關係', sub: 'HGᵀ = 0，而且 {mG} = ker H', steps: () => 4, render: (s) => <GAndHSlide s={s} /> },
];
