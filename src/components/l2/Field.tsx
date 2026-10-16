import { motion } from 'framer-motion';
import { type Bit, type GF8, LOG, bitsToField, alphaPow, alphaPowerSteps, chienSearch, errorLocator, exponentToPosition, fieldToBits, gf8ToPolyTex, msbToTex } from '../../core';
import { M, Tex } from '../Tex';
import { StepControls, useStepper, type Stepper } from './Stepper';

const bits3 = (a: GF8) => fieldToBits(a).join('');
const aTex = (a: GF8) => (a === 0 ? '0' : LOG[a] === 0 ? '1' : LOG[a] === 1 ? '\\alpha' : `\\alpha^{${LOG[a]}}`);

/** GF(8) element table, each row derived from the previous one with α³ = α + 1. */
export function GF8Table({ highlight, large = false, revealed = 7 }: { highlight?: GF8; large?: boolean; revealed?: number }) {
  const steps = alphaPowerSteps();
  return (
    <div className="overflow-x-auto">
      <table className={`w-full min-w-[480px] ${large ? 'text-lg' : 'text-sm'}`}>
        <thead>
          <tr className="text-left text-xs text-slate-500">
            <th className="py-1">元素</th>
            <th>由上一列推導</th>
            <th>多項式（α 的次數 ≤ 2）</th>
            <th>3 位元 (α² α 1)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-100 text-slate-400">
            <td className="py-1.5">0</td>
            <td>零元素</td>
            <td>
              <M>0</M>
            </td>
            <td className="font-mono">000</td>
          </tr>
          {steps.slice(0, revealed).map((s) => {
            const hi = highlight !== undefined && s.value === highlight;
            const lowPart = s.shifted & 0b111;
            return (
              <motion.tr key={s.power} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`border-t border-slate-100 ${hi ? 'bg-amber-100' : ''}`}>
                <td className="py-1.5 font-semibold">
                  <M>{s.power === 0 ? '1 = \\alpha^0' : `\\alpha^{${s.power}}`}</M>
                </td>
                <td className="text-slate-600">
                  {s.power === 0 ? (
                    '定義'
                  ) : s.reduced ? (
                    <Tex>{`\\alpha\\cdot\\alpha^{${s.power - 1}} = ${lowPart ? gf8ToPolyTex(lowPart) + ' + ' : ''}\\underline{\\alpha^3} = ${lowPart ? gf8ToPolyTex(lowPart) + ' + ' : ''}(\\alpha+1)`}</Tex>
                  ) : (
                    <Tex>{`\\alpha\\cdot\\alpha^{${s.power - 1}}`}</Tex>
                  )}
                </td>
                <td>
                  <M>{gf8ToPolyTex(s.value)}</M>
                </td>
                <td className="font-mono font-bold">{bits3(s.value)}</td>
              </motion.tr>
            );
          })}
          {revealed >= 7 && (
            <tr className="border-t border-slate-200 bg-emerald-50/60">
              <td className="py-1.5 font-semibold">
                <M>{'\\alpha^7'}</M>
              </td>
              <td className="text-slate-600">
                <Tex>{`\\alpha\\cdot\\alpha^6 = \\alpha^3 + \\alpha = (\\alpha+1)+\\alpha`}</Tex>
              </td>
              <td>
                <M>1</M>
              </td>
              <td className="font-mono font-bold">001 → 回到 1</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Three different objects that all "look like" 111 — kept visibly separate. */
export function ThreeObjects({ S }: { S: Bit[] }) {
  const a = bitsToField(S);
  const sigma = errorLocator(a);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div className="rounded-xl border-2 border-slate-300 bg-white p-3">
        <div className="text-xs font-semibold text-slate-500">① 二進位餘數（多項式 in x）</div>
        <div className="mt-1 font-mono text-2xl font-bold">{S.join('')}</div>
        <div className="text-sm">
          <M>{`S(x) = ${msbToTex(S)}`}</M>
        </div>
        <p className="mt-1 text-xs text-slate-500">在 <M>{'\\mathbb{F}_2[x]/(g(x))'}</M> 中，是 r(x) 除以 g(x) 的餘式。</p>
      </div>
      <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/50 p-3">
        <div className="text-xs font-semibold text-indigo-600">② 有限體元素（GF(8) 中的一個數）</div>
        <div className="mt-1 text-2xl font-bold">
          <M>{a === 0 ? 'S_1 = 0' : `S_1 = ${aTex(a)}`}</M>
        </div>
        <div className="text-sm">
          <M>{`S_1 = r(\\alpha) = S(\\alpha) = ${gf8ToPolyTex(a)}`}</M>
        </div>
        <p className="mt-1 text-xs text-slate-500">把 <M>x</M> 換成 <M>{'\\alpha'}</M>；因為 <M>{'g(\\alpha)=0'}</M>，<M>{'r(\\alpha) = S(\\alpha)'}</M>。</p>
      </div>
      <div className="rounded-xl border-2 border-fuchsia-300 bg-fuchsia-50/50 p-3">
        <div className="text-xs font-semibold text-fuchsia-600">③ 錯誤定位多項式（多項式 in z，係數在 GF(8)）</div>
        <div className="mt-1 text-2xl font-bold">
          <M>{sigma.length === 1 ? '\\sigma(z) = 1' : `\\sigma(z) = 1 + ${aTex(a)}z`}</M>
        </div>
        <p className="mt-1 text-xs text-slate-500">它的根 <M>{'z = X^{-1}'}</M> 告訴我們錯誤位置；不是一個數字，而是一個函數。</p>
      </div>
    </div>
  );
}

export const chienTotalFrames = 9;

/** Chien search: evaluate σ(z) = 1 + S₁z at z = α⁰ … α⁶. */
export function ChienSim({ S1, stepper, large = false }: { S1: GF8; stepper?: Stepper; large?: boolean }) {
  const sigma = errorLocator(S1);
  const rows = chienSearch(sigma);
  const own = useStepper(chienTotalFrames, { interval: 1100 });
  const s = stepper ?? own;
  const frame = Math.min(s.step, chienTotalFrames - 1);
  const evaluated = Math.min(frame, 7);
  const root = rows.find((r) => r.isRoot);
  const sLog = S1 ? LOG[S1] : null;

  return (
    <div className="space-y-3">
      {!stepper && <StepControls s={s} label={frame === 0 ? '準備' : frame <= 7 ? `測試 z = ${frame === 1 ? '1' : frame === 2 ? 'α' : `α${'⁰¹²³⁴⁵⁶'[frame - 1]}`}` : '結論'} />}
      <div className={`rounded-xl bg-slate-50 p-3 ${large ? 'text-lg' : 'text-sm'}`}>
        <M>{sigma.length === 1 ? '\\sigma(z) = 1' : `\\sigma(z) = 1 + ${aTex(S1)}\\,z`}</M>
        <span className="ml-2 text-slate-500">依序代入 GF(8) 的 7 個非零元素，找出 <M>{'\\sigma(z)=0'}</M> 的 z。</span>
      </div>
      <div className="overflow-x-auto">
        <table className={`w-full min-w-[520px] ${large ? 'text-lg' : 'text-sm'}`}>
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1">j</th>
              <th>z = αʲ</th>
              <th>S₁·z</th>
              <th>σ(z) = 1 + S₁z</th>
              <th>位元</th>
              <th>結果</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const shown = r.j < evaluated;
              const current = r.j === evaluated - 1 && frame <= 7;
              return (
                <tr key={r.j} className={`border-t border-slate-100 ${current ? 'bg-amber-100' : r.isRoot && shown ? 'bg-emerald-100' : ''} ${shown ? '' : 'opacity-30'}`}>
                  <td className="py-1.5 font-mono">{r.j}</td>
                  <td>
                    <M>{r.j === 0 ? '1' : `\\alpha^{${r.j}}`}</M>
                  </td>
                  <td>{shown && sLog !== null ? <M>{`\\alpha^{${sLog}+${r.j}} = ${aTex(r.product)}`}</M> : shown ? <M>0</M> : '?'}</td>
                  <td>{shown ? <M>{`1 + ${aTex(r.product)} = ${aTex(r.value)}`}</M> : '?'}</td>
                  <td className="font-mono">{shown ? bits3(r.value) : '???'}</td>
                  <td>{shown ? r.isRoot ? <span className="chip bg-emerald-600 text-white">✓ 根 root</span> : <span className="text-slate-400">≠ 0</span> : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {frame === 8 && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 ${large ? 'text-lg' : 'text-sm'}`}>
          {root ? (
            <>
              根 <M>{`z = \\alpha^{${root.j}}`}</M>。錯誤定位數 <M>{`X = z^{-1} = \\alpha^{-${root.j}} = \\alpha^{${root.exponent}}`}</M>，所以錯誤在 <M>{`x^{${root.exponent}}`}</M>，即<strong>從左數第 {exponentToPosition(root.exponent!)} 個 bit</strong>。
            </>
          ) : (
            <>σ(z) 沒有根（S = 0），判定沒有錯誤。</>
          )}
        </motion.div>
      )}
    </div>
  );
}

/** ĉ(α) evaluated term by term with running XOR of 3-bit vectors. */
export function AlphaCheck({ word, large = false, name = '\\hat c' }: { word: Bit[]; large?: boolean; name?: string }) {
  const n = word.length;
  const exps = word.flatMap((b, k) => (b ? [n - 1 - k] : []));
  let acc = 0;
  const rows = exps.map((e) => {
    const v = alphaPow(e);
    acc ^= v;
    return { e, v, acc };
  });
  return (
    <div className={`space-y-2 ${large ? 'text-lg' : 'text-sm'}`}>
      <Tex block>{`${name}(x) = ${msbToTex(word)} \\;\\Rightarrow\\; ${name}(\\alpha) = ${exps.length ? exps.map((e) => (e === 0 ? '1' : e === 1 ? '\\alpha' : `\\alpha^{${e}}`)).join(' + ') : '0'}`}</Tex>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px]">
          <thead>
            <tr className="text-left text-xs text-slate-500">
              <th className="py-1">項</th>
              <th>3 位元</th>
              <th>累計 XOR</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {rows.map((r, k) => (
              <tr key={k} className="border-t border-slate-100">
                <td className="py-1">
                  <M>{r.e === 0 ? '1' : r.e === 1 ? '\\alpha' : `\\alpha^{${r.e}}`}</M>
                </td>
                <td>{bits3(r.v)}</td>
                <td className={k === rows.length - 1 ? 'font-bold' : ''}>{bits3(r.acc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={acc === 0 ? 'text-emerald-700' : 'text-rose-700'}>
        <M>{`${name}(\\alpha) = ${acc === 0 ? '0' : aTex(acc)}`}</M> {acc === 0 ? '✓ 是合法 codeword（被 g(x) 整除）' : '✗ 不是合法 codeword'}
      </div>
    </div>
  );
}

