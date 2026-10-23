import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Info } from 'lucide-react';
import {
  type Bit,
  type L2Method,
  LOG,
  encodeCyclic,
  errorVector,
  evalAtAlphaMsb,
  expLabel,
  runLfsr,
  simulateL2,
  simulateSecdedL2,
} from '../../core';
import { M } from '../Tex';
import { StatusBadge } from '../Lesson';
import { StepControls, useStepper, type Stepper } from './Stepper';
import { outcomeStatus } from './Decode';

type Col = 'enc' | 'ch' | 'dec';

interface NodeDef {
  id: string;
  col: Col;
  zh: string;
  en: string;
  secdedOnly?: boolean;
  desc: string;
}

export const FLOW_NODES: NodeDef[] = [
  { id: 'u', col: 'enc', zh: '原始資料 u', en: 'Message', desc: '要保護的 4 個 data bit（資料位元）。視為多項式 u(x)，最左邊是 x³ 的係數。' },
  { id: 'lfsr', col: 'enc', zh: 'LFSR / 多項式除法', en: 'LFSR / Polynomial division', desc: '計算 x³u(x) mod g(x)。硬體用 3 個 register（暫存器）組成的 LFSR，一個時脈處理一個 bit。' },
  { id: 'parity', col: 'enc', zh: 'Parity bits p', en: '', desc: 'LFSR 最後的 register 內容就是餘數，也就是 3 個 parity bit。' },
  { id: 'codeword', col: 'enc', zh: 'Codeword c', en: '', desc: 'c = u ‖ p 是 codeword（碼字），即 c(x) = x³u(x) + p(x)，一定被 g(x) 整除。' },
  { id: 'overall', col: 'enc', zh: 'Overall parity bit', en: '', secdedOnly: true, desc: 'SECDED 模式：在 7 位元 codeword 後面加 1 個位元，採 even parity（偶同位），使 8 個位元中 1 的個數為偶數。' },
  { id: 'channel', col: 'ch', zh: '通道', en: 'Channel', desc: '雜訊把某些位元翻轉：r = c ⊕ e。e 中的 1 就是錯誤位置。' },
  { id: 'received', col: 'ch', zh: 'Received word r', en: '', desc: '接收端只看得到 r，不知道 c 與 e。' },
  { id: 'buffer', col: 'ch', zh: 'Buffer', en: '', desc: '計算 syndrome 需要讀完全部 n 個位元，所以 received word（收到的字）先存在 buffer，等定位完成再做更正。' },
  { id: 'syndrome', col: 'dec', zh: 'Syndrome S', en: '', desc: 'S(x) = r(x) mod g(x) = e(x) mod g(x)：只和錯誤有關。' },
  { id: 'secdedchk', col: 'dec', zh: 'SECDED 判斷', en: 'Overall parity check', secdedOnly: true, desc: '重新計算 8 個位元的 parity（同位）q，與 syndrome 一起分辨 0、1、2 個錯誤。' },
  { id: 'locator', col: 'dec', zh: 'Error-locator polynomial', en: '', desc: 'S₁ = S(α) ∈ GF(8)，σ(z) = 1 + S₁z。' },
  { id: 'search', col: 'dec', zh: 'Chien search / 查表', en: 'Chien search / lookup', desc: '找出 σ(z) 的根（或直接查 syndrome 表），得到錯誤的次方 i。' },
  { id: 'logic', col: 'dec', zh: '更正邏輯', en: 'Correction logic', desc: '決定要不要更正：S = 0 不動；單一錯誤就產生 error vector（錯誤向量）ê；SECDED 偵測到雙錯時拒絕更正。' },
  { id: 'xor', col: 'dec', zh: 'XOR 更正', en: 'XOR correction', desc: 'ĉ = r ⊕ ê：在錯誤位置翻轉一個位元。' },
  { id: 'corrected', col: 'dec', zh: '更正後 codeword ĉ', en: 'Corrected codeword', desc: '應滿足 ĉ(α) = 0（合法 codeword）。合法不代表正確！' },
  { id: 'recovered', col: 'dec', zh: '還原訊息 û', en: 'Recovered message', desc: '這是 systematic code（系統碼）：直接取 ĉ 的前 4 位。' },
  { id: 'flag', col: 'dec', zh: '錯誤偵測旗標', en: 'Error detection flag', desc: '輸出給系統的狀態：無錯誤 / 已更正 / 偵測到無法更正的錯誤。' },
];

export function flowSequence(secded: boolean): NodeDef[] {
  return FLOW_NODES.filter((n) => secded || !n.secdedOnly);
}

const aTex = (a: number) => (a === 0 ? '0' : LOG[a] === 0 ? '1' : LOG[a] === 1 ? '\\alpha' : `\\alpha^{${LOG[a]}}`);

/** colour + symbol: info / parity / error bits */
function Bits({ bits, err = [], overall = false }: { bits: readonly Bit[]; err?: readonly Bit[]; overall?: boolean }) {
  return (
    <span className="font-mono text-[13px] tracking-[0.1em]">
      {bits.map((b, i) => {
        const isErr = err[i] === 1;
        const cls = isErr ? 'rounded bg-rose-100 font-bold text-rose-700 underline decoration-2' : i < 4 ? 'text-data-700' : i < 7 ? 'text-parity-700' : overall ? 'text-overall-700' : '';
        return (
          <span key={i} className={cls} title={isErr ? '錯誤位元' : undefined}>
            {b}
          </span>
        );
      })}
    </span>
  );
}

interface FlowProps {
  u: Bit[];
  errors: number[];
  secded: boolean;
  method: L2Method;
  stepper?: Stepper;
  large?: boolean;
}

export function FlowDiagram({ u, errors, secded, method, stepper, large = false }: FlowProps) {
  const seq = flowSequence(secded);
  const own = useStepper(seq.length, { interval: 1600 });
  const s = stepper ?? own;
  const [selected, setSelected] = useState<string | null>(null);
  const curIdx = Math.min(s.step, seq.length - 1);
  const current = seq[curIdx];
  const rootRef = useRef<HTMLDivElement>(null);
  // presentation: keep the active module on screen
  useEffect(() => {
    if (!large) return;
    rootRef.current?.querySelector('[aria-current="step"]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [curIdx, large]);
  const reached = (id: string) => seq.findIndex((n) => n.id === id) <= curIdx && seq.some((n) => n.id === id);

  const data = useMemo(() => {
    const enc = encodeCyclic(u);
    const lfsr = runLfsr(u, 'encoder');
    const e7 = errors.filter((p) => p <= 7);
    const o = simulateL2(u, e7, method);
    const so = simulateSecdedL2(u, errors);
    return { enc, lfsr, o, so };
  }, [u, errors, method]);
  const { enc, lfsr, o, so } = data;
  const d = o.decode;
  const root = d.chien.find((c) => c.isRoot);
  const e8 = so.e;
  const status = outcomeStatus(o);
  // SECDED estimated error (8 bits) and the check of its 7-bit part
  const eHat8 = so.result.position ? errorVector([so.result.position], 8) : errorVector([], 8);
  const check = secded ? evalAtAlphaMsb(so.result.output.slice(0, 7)) : d.check;

  const view: Record<string, { data: ReactNode; op: ReactNode }> = {
    u: { data: <Bits bits={u} />, op: <>u(x) = {u.join('')}</> },
    lfsr: { data: <span className="font-mono text-[13px]">{lfsr.states.map((x) => x.join('')).join(' → ')}</span>, op: <M>{`x^3u(x) \\bmod g(x)`}</M> },
    parity: { data: <span className="font-mono text-[13px] text-parity-700">{enc.parity.join('')}</span>, op: <>{enc.shifted.join('')} mod 1011 = {enc.parity.join('')}</> },
    codeword: { data: <Bits bits={enc.codeword} />, op: <>c = u ‖ p</> },
    overall: { data: <Bits bits={so.c8} overall />, op: <>P = c₁ ⊕ … ⊕ c₇ = {so.c8[7]}</> },
    channel: { data: <span className="font-mono text-[13px] text-rose-700">e = {(secded ? e8 : o.e).join('')}</span>, op: <>{(secded ? errors : errors.filter((p) => p <= 7)).length ? `翻轉位置 ${(secded ? errors : errors.filter((p) => p <= 7)).join('、')}` : '無錯誤'}</> },
    received: { data: <Bits bits={secded ? so.r8 : o.r} err={secded ? e8 : o.e} overall={secded} />, op: <>r = c ⊕ e</> },
    buffer: { data: <span className="text-xs text-slate-500">暫存 {secded ? 8 : 7} 個位元</span>, op: <>等待 syndrome 計算完成</> },
    syndrome: { data: <span className="font-mono text-[13px] font-bold">S = {d.syndrome.join('')}</span>, op: <>r(x) mod g(x)</> },
    secdedchk: { data: <span className="font-mono text-[13px]">q = {so.result.parity}（{so.result.parity ? '奇' : '偶'}）</span>, op: <>{secdedLabel(so.result.case)}</> },
    locator: { data: <M>{d.field === 0 ? '\\sigma(z)=1' : `\\sigma(z) = 1 + ${aTex(d.field)}z`}</M>, op: <M>{`S_1 = S(\\alpha) = ${aTex(d.field)}`}</M> },
    search: {
      data: <span className="text-[13px]">{d.field === 0 ? '無根 → 無錯誤' : `位置 ${d.position}（${expLabel(d.exponent)}）`}</span>,
      op: method === 'lookup' ? <>查表 S → 位置</> : <M>{root ? `\\sigma(\\alpha^{${root.j}}) = 0 \\Rightarrow i = ${root.exponent}` : '\\text{no root}'}</M>,
    },
    logic: {
      data: (
        <span className="text-[13px]">
          {secded ? (so.result.uncorrectable ? '拒絕更正，設旗標' : so.result.position ? `ê = ${eHat8.join('')}` : '不更正') : d.position ? `ê = ${d.estimatedError.join('')}` : '不更正'}
        </span>
      ),
      op: <>{secded ? secdedLabel(so.result.case) : d.position ? '單一錯誤假設' : 'S = 0'}</>,
    },
    xor: {
      data: <span className="font-mono text-[13px]">{secded ? (so.result.uncorrectable ? '（略過，保留接收資料）' : `${so.r8.join('')} ⊕ ${eHat8.join('')}`) : `${o.r.join('')} ⊕ ${d.estimatedError.join('')}`}</span>,
      op: <>ĉ = r ⊕ ê</>,
    },
    corrected: {
      data: secded ? <Bits bits={so.result.output} overall /> : <Bits bits={d.corrected} />,
      op: <M>{`\\hat c(\\alpha) = ${aTex(check)}${secded ? '\\ (\\text{前 7 位})' : ''}`}</M>,
    },
    recovered: {
      data: <span className={`font-mono text-[13px] font-bold ${(secded ? so.success : o.success) ? 'text-emerald-700' : 'text-rose-700'}`}>û = {(secded ? so.result.message : d.message).join('')}</span>,
      op: <>原始 u = {u.join('')}，{(secded ? so.success : o.success) ? '相同 ✓' : secded && so.result.uncorrectable ? '資料標記為不可信' : '不同 ✗'}</>,
    },
    flag: {
      data: secded ? (
        so.result.uncorrectable ? <StatusBadge status="detected" zh="偵測到無法更正的錯誤" en="Uncorrectable error" /> : so.success ? <StatusBadge status={so.errorCount ? 'corrected' : 'ok'} /> : <StatusBadge status="wrong" />
      ) : (
        <StatusBadge status={status.status} zh={status.zh} en={status.en} />
      ),
      op: <>旗標 = {secded ? (so.result.uncorrectable ? '1（不可更正）' : '0') : o.detected ? '偵測到並嘗試更正' : '未偵測到錯誤'}</>,
    },
  };

  const focus = FLOW_NODES.find((n) => n.id === (selected ?? current.id))!;
  const cols: { key: Col; zh: string }[] = [
    { key: 'enc', zh: 'Encoder' },
    { key: 'ch', zh: '通道與接收 Channel' },
    { key: 'dec', zh: 'Decoder' },
  ];

  // on a slide the explanation fills the room under the two short columns, beside the tall decoder column
  const panel = (
    <motion.div key={focus.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`rounded-2xl border-2 border-indigo-200 bg-white p-4 ${large ? 'text-lg lg:col-span-2' : 'text-sm'}`}>
      <div className="mb-1 flex items-center gap-2 font-bold text-indigo-900">
        <Info className="h-4 w-4" />
        {focus.zh} {focus.en && <span className="font-normal text-slate-400">{focus.en}</span>}
        {selected && <span className="chip bg-indigo-100 text-indigo-700">你點選的模組</span>}
      </div>
      <p className="text-slate-700">{focus.desc}</p>
      {!(focus.secdedOnly && !secded) && reached(focus.id) && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-xs text-slate-500">目前資料 Current data</div>
            <div className="overflow-x-auto">{view[focus.id].data}</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-2">
            <div className="text-xs text-slate-500">目前運算 Current operation</div>
            <div className="overflow-x-auto">{view[focus.id].op}</div>
          </div>
        </div>
      )}
      {!reached(focus.id) && <p className="mt-1 text-xs text-slate-400">（播放到這個模組時會顯示資料）</p>}
    </motion.div>
  );

  return (
    <div ref={rootRef} className="space-y-4">
      {!stepper && <StepControls s={s} label={current.en ? `${current.zh}（${current.en}）` : current.zh} />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.25fr)]">
        {cols.map((c) => (
          <div key={c.key} className={`min-w-0 rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 ${large && c.key === 'dec' ? 'lg:row-span-2' : ''}`}>
            <div className="mb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-500">{c.zh}</div>
            <div className="space-y-1">
              {FLOW_NODES.filter((n) => n.col === c.key).map((n, k, arr) => {
                const skipped = n.secdedOnly && !secded;
                const isCur = n.id === current.id;
                const was = reached(n.id);
                return (
                  <div key={n.id}>
                    <motion.button
                      type="button"
                      onClick={() => setSelected(selected === n.id ? null : n.id)}
                      animate={isCur ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                      transition={{ duration: 0.5 }}
                      className={`w-full rounded-xl border-2 px-3 py-2 text-left transition-colors ${
                        skipped ? 'border-dashed border-slate-200 bg-white/50 opacity-50' : isCur ? 'border-amber-500 bg-amber-50 shadow-md' : selected === n.id ? 'border-indigo-400 bg-white' : was ? 'border-slate-300 bg-white' : 'border-slate-200 bg-white/70'
                      }`}
                      aria-current={isCur ? 'step' : undefined}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold ${large ? 'text-base' : 'text-sm'} ${n.secdedOnly ? 'text-overall-700' : 'text-slate-800'}`}>
                          {isCur && '▶ '}
                          {n.zh}
                        </span>
                        <span className="truncate text-[10px] text-slate-400">{n.en}</span>
                      </div>
                      <div className="mt-0.5 min-h-[20px] overflow-x-auto">{skipped ? <span className="text-xs text-slate-400">SECDED 模式關閉，略過</span> : was ? view[n.id].data : <span className="text-xs text-slate-300">—</span>}</div>
                    </motion.button>
                    {k < arr.length - 1 && <ArrowDown className="mx-auto my-0.5 h-3.5 w-3.5 text-slate-300" />}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {large && panel}
      </div>
      {!large && panel}
    </div>
  );
}

function secdedLabel(c: string) {
  return c === 'no-error' ? 'S = 0、q 偶 → 無錯誤' : c === 'single' ? 'S ≠ 0、q 奇 → 單一錯誤，更正' : c === 'overall' ? 'S = 0、q 奇 → overall parity bit 錯誤' : 'S ≠ 0、q 偶 → 雙重錯誤，不更正';
}
