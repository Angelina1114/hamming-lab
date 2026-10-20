import { useMemo, useState } from 'react';
import {
  type Bit,
  G74,
  H74,
  LAYOUT_74,
  PARITY_CHECKS,
  codewords74,
  codewords84,
  column,
  correctionCapability,
  decode74,
  encode74,
  encode74ByParity,
  encode84,
  flipBit,
  matVec,
  minimumDistance,
  secdedDecode,
  vecAdd,
} from '../core';
import { useMessage } from '../lib/store';
import { M, Tex } from '../components/Tex';
import { BitRow, MessageInput } from '../components/Bits';
import { MatrixView, ColumnVector } from '../components/MatrixView';
import { StatusBadge } from '../components/Lesson';
import { Venn } from '../components/Venn';
import { ParityLab } from '../components/ParityLab';
import { MessageSizeLab } from '../components/WhySevenFour';
import { BallDiagram, CubeBall, PackingDiagram } from '../components/BoundFigures';
import { DistanceLine } from '../components/DistanceLine';
import { Deck, type DeckSlide } from '../components/Deck';
import type { Stepper } from '../components/l2/Stepper';

type Ctx = null;
const LAYOUT_84 = [...LAYOUT_74.map((p) => p.label), 'P0'];

/* ------------------------------------------------------------------ */
/* Slides                                                             */
/* ------------------------------------------------------------------ */

function TitleSlide() {
  const parts: [string, string][] = [
    ['導論', '雜訊會翻轉位元；同位位元能發現錯，卻找不到錯'],
    ['第 1 章', '三個互相重疊的檢查：Hamming(7,4) 編碼'],
    ['第 2 章', '寫成矩陣：c = mG、Hcᵀ = 0'],
    ['第 3 章', 'Syndrome：錯誤自己說出位置'],
    ['第 4 章', 'Hamming 距離：d_min = 3，所以 t = 1'],
    ['第 5 章', 'Hamming Bound：16 顆球剛好鋪滿 128 個字串'],
    ['第 6、7 章', '多一個位元：SECDED 修 1 個、偵測 2 個'],
  ];
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <ol className="space-y-2 text-xl">
        {parts.map(([tag, text], i) => (
          <li key={tag} className="flex gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-base font-bold text-white">{i + 1}</span>
            <span>
              <strong className="mr-2">{tag}</strong>
              <span className="text-slate-600">{text}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="rounded-2xl border-2 border-slate-200 p-5 text-lg text-slate-600">
        <div className="mb-2 font-semibold text-slate-800">操作</div>
        <ul className="space-y-1">
          <li>→ / 空白鍵：下一步（動畫走完再換頁）</li>
          <li>←：上一步　P：播放 / 暫停　F：全螢幕</li>
          <li>每一頁的位元、按鈕都可以直接點，和網頁上一樣</li>
          <li>右上角可切換範例訊息（第 1–3、6、7 章共用）</li>
        </ul>
      </div>
    </div>
  );
}

function NoiseSlide() {
  const [bits, setBits] = useState<Bit[]>([1, 0, 1, 1]);
  const [flips, setFlips] = useState<number[]>([]);
  return (
    <div className="space-y-5 text-xl">
      <p>
        傳送訊息 <span className="mono font-bold">1011</span>。點一個位元，模擬雜訊把它翻轉：
      </p>
      <BitRow
        bits={bits}
        plain
        size="lg"
        states={bits.map((_, i) => (flips.includes(i) ? 'error' : 'normal'))}
        onToggle={(i) => {
          setBits(flipBit(bits, i));
          setFlips(flips.includes(i) ? flips.filter((j) => j !== i) : [...flips, i]);
        }}
      />
      <div className={`rounded-2xl p-4 ${flips.length ? 'bg-rose-50 text-rose-900' : 'bg-slate-50 text-slate-700'}`}>
        {flips.length === 0 ? (
          <>接收端收到 {bits.join('')}，看起來一切正常。</>
        ) : (
          <>
            接收端收到 <strong className="mono">{bits.join('')}</strong>：這也是一個合法的 4 位元訊息，<strong>接收端完全沒辦法知道它被改過。</strong>
          </>
        )}
      </div>
      <p className="text-lg text-slate-600">每一個 4 位元字串都合法，錯誤只會把一個合法訊息變成另一個。要發現錯誤，就必須多送一些「冗餘」，讓合法的字串變稀少。</p>
    </div>
  );
}

function FlipSumSlide() {
  const { message } = useMessage();
  const [e, setE] = useState<Bit[]>([0, 1, 0, 0]);
  const r = vecAdd(message, e);
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 text-xl">
        <p>雜訊只會「翻轉」位元。把翻轉寫成「加 1」、不動寫成「加 0」：</p>
        <table className="font-mono text-2xl">
          <tbody>
            <tr>
              <th className="border-b border-r border-slate-300 px-4 py-1">+</th>
              <th className="border-b border-slate-300 px-4 py-1">0</th>
              <th className="border-b border-slate-300 px-4 py-1">1</th>
            </tr>
            {[0, 1].map((a) => (
              <tr key={a}>
                <th className="border-r border-slate-300 px-4 py-1">{a}</th>
                <td className="px-4 py-1 text-center">{a}</td>
                <td className="bg-rose-50 px-4 py-1 text-center font-bold text-rose-600">{1 - a}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          這就是 <strong>mod 2 的加法</strong>（XOR）：<M>{'1 + 1 = 0'}</M>，不進位，每一位各自算。這套算術記作 GF(2)。
        </p>
      </div>
      <div className="space-y-4 text-xl">
        <p>點下面的錯誤向量 e 決定翻哪幾位：</p>
        <BitRow bits={e} plain size="lg" states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={(i) => setE(flipBit(e, i))} />
        <Tex block>{`\\underbrace{${message.join('')}}_{c\\ (\\text{送出})} + \\underbrace{${e.join('')}}_{e\\ (\\text{錯誤})} = \\underbrace{${r.join('')}}_{r\\ (\\text{收到})}`}</Tex>
        <p className="text-lg text-slate-600">接收端只看得到 r。整門課的任務：只靠 r，找出 e。</p>
      </div>
    </div>
  );
}

function CoverageSlide() {
  return (
    <div className="space-y-5 text-xl">
      <p>
        把位置 1–7 寫成二進位。檢查 <M>{'P_b'}</M> 負責「二進位含有 b」的位置（b = 1, 2, 4），同位位元放在位置 1、2、4：
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-center text-xl">
          <thead>
            <tr className="text-base text-slate-500">
              <th className="py-1 text-left">位置</th>
              {LAYOUT_74.map((p) => (
                <th key={p.index} className={p.role === 'parity' ? 'text-parity-600' : 'text-data-600'}>
                  {p.position}
                  <div className="text-sm font-normal">{p.label}</div>
                </th>
              ))}
            </tr>
            <tr className="font-mono text-base text-slate-400">
              <th className="text-left font-sans font-normal">二進位</th>
              {LAYOUT_74.map((p) => (
                <th key={p.index} className="font-normal">
                  {p.position.toString(2).padStart(3, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PARITY_CHECKS.map((pc) => (
              <tr key={pc.name} className="border-t border-slate-100">
                <td className="py-2 text-left font-semibold text-parity-700">{pc.name}</td>
                {LAYOUT_74.map((p) => (
                  <td key={p.index}>{pc.covered.includes(p.index) ? <span className="inline-block h-4 w-4 rounded-full bg-parity-500" /> : <span className="text-slate-200">·</span>}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-lg text-slate-600">每個位置被一組不同的檢查管到：錯在哪裡，「哪些檢查失敗」就不一樣。3 個檢查有 2³ − 1 = 7 種組合，剛好給 7 個位置。</p>
    </div>
  );
}

function EncodeSlide({ s }: { s: Stepper }) {
  const { message, toggleBit } = useMessage();
  const enc = encode74ByParity(message);
  const shown = (i: number) => LAYOUT_74[i].role === 'data' || PARITY_CHECKS.findIndex((pc) => pc.parityIndex === i) < s.step;
  const eq = (k: number) => {
    const p = enc.parities[k];
    return `${p.name.replace(/(\d)/, '_$1')} = ${p.terms.map((t) => t.label.replace(/(\d)/, '_$1')).join(' \\oplus ')} = ${p.terms.map((t) => t.value).join(' \\oplus ')} = ${p.value}`;
  };
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-end gap-6">
        <MessageInput message={message} onToggle={toggleBit} />
        <span className="text-3xl text-slate-300">→</span>
        <div className="flex gap-1.5">
          {enc.codeword.map((b, i) => (
            <div key={i} className={`flex w-12 flex-col items-center rounded-lg border-2 py-1 ${LAYOUT_74[i].role === 'parity' ? 'border-parity-300 bg-parity-50' : 'border-data-300 bg-data-50'}`}>
              <span className={`text-xs font-semibold ${LAYOUT_74[i].role === 'parity' ? 'text-parity-700' : 'text-data-700'}`}>{LAYOUT_74[i].label}</span>
              <span className="font-mono text-2xl font-bold">{shown(i) ? b : '?'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {[0, 1, 2].map((k) =>
          k < s.step ? (
            <div key={k} className="rounded-xl bg-parity-50 px-4 py-2">
              <Tex>{eq(k)}</Tex>
            </div>
          ) : null,
        )}
      </div>
      <p className="text-lg text-slate-600">
        {s.step === 0 && '先把 4 個資訊位元放進位置 3、5、6、7。按「下一步」逐一算出 P1、P2、P4：每個檢查管到的位元要有偶數個 1。'}
        {s.step > 0 && s.step < 4 && `算出 ${PARITY_CHECKS[s.step - 1].name}：讓它管的 4 個位置有偶數個 1。`}
        {s.step === 4 && (
          <>
            完成！訊息 {message.join('')} 編成 codeword <strong className="mono">{enc.codeword.join('')}</strong>。點左邊的 D1–D4 換一個訊息試試。
          </>
        )}
      </p>
    </div>
  );
}

function VennSlide() {
  const { message } = useMessage();
  const c = encode74(message);
  const [e, setE] = useState<number[]>([]);
  const r = c.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const d = decode74(r);
  return (
    <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-2">
      <Venn word={r} errorIdx={e} onToggle={(i) => setE(e.includes(i) ? e.filter((j) => j !== i) : [...e, i])} />
      <div className="space-y-4 text-xl">
        <p>每個圓圈是一個檢查：圈裡必須有偶數個 1。點圖中的位元製造錯誤：</p>
        <div className="rounded-2xl bg-slate-50 p-4">
          {e.length === 0 && <>三個圓圈都是偶數個 1（綠色）：沒有錯。</>}
          {e.length > 0 && d.position > 0 && (
            <>
              失敗的圓圈只共同包含位置 <strong>{d.position}（{LAYOUT_74[d.position - 1].label}）</strong>：把它翻回來就修好了
              {e.length > 1 && <span className="text-rose-700">（但其實錯了 {e.length} 個，會改錯）</span>}。
            </>
          )}
          {e.length > 0 && d.position === 0 && <>三個圓圈又都變回偶數：錯誤剛好互相抵銷，看不出來。</>}
        </div>
        <p className="text-lg text-slate-600">紅色圓圈 = 奇數個 1（檢查失敗）。哪幾個圈失敗，就像座標一樣指出錯在哪裡。</p>
      </div>
    </div>
  );
}

function MatrixSlide({ s }: { s: Stepper }) {
  const { message, toggleBit } = useMessage();
  const c = encode74(message);
  const rows = message.flatMap((b, i) => (b ? [i] : []));
  const Hc = matVec(H74, c);
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-center gap-4">
        <MessageInput message={message} onToggle={toggleBit} size="md" />
        <span>
          <M>{`m = ${message.join('')}`}</M>，<M>{`c = mG = ${c.join('')}`}</M>
        </span>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-1 text-base font-semibold text-slate-700">生成矩陣 G：把 m 裡是 1 的列加起來</div>
          <MatrixView matrix={G74} name="G =" colLabels={LAYOUT_74.map((p) => p.label)} rowLabels={['D1', 'D2', 'D3', 'D4']} highlightRows={rows} dimRows={[0, 1, 2, 3].filter((i) => !rows.includes(i))} />
        </div>
        {s.step >= 1 && (
          <div>
            <div className="mb-1 text-base font-semibold text-slate-700">同位檢查矩陣 H：每一列是一個檢查</div>
            <div className="flex flex-wrap items-center gap-3">
              <MatrixView matrix={H74} name="H =" colLabels={LAYOUT_74.map((p) => p.position)} rowLabels={['P1', 'P2', 'P4']} />
              <span className="text-2xl">·</span>
              <ColumnVector bits={c} label={<M>{'c^T ='}</M>} size="sm" />
              <span className="text-2xl">=</span>
              <ColumnVector bits={Hc} size="sm" cellClass="bg-emerald-50 text-emerald-700" />
            </div>
          </div>
        )}
      </div>
      <p className="text-lg text-slate-600">
        {s.step === 0 ? '編碼就是矩陣乘法 c = mG。按下一步看「檢查」怎麼寫成矩陣。' : '合法 codeword 一定滿足 Hcᵀ = 0：三個檢查全部通過。第 j 欄正好是 j 的二進位（由下往上讀）。'}
      </p>
    </div>
  );
}

function SyndromeSlide({ s }: { s: Stepper }) {
  const { message } = useMessage();
  const c = encode74(message);
  const [e, setE] = useState<number[]>([4]);
  const r = c.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const d = decode74(r);
  const col = d.position - 1;
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-slate-500">收到 r =</span>
        <BitRow bits={r} layout={LAYOUT_74} size="lg" states={r.map((_, i) => (e.includes(i) ? 'error' : 'normal'))} onToggle={(i) => setE(e.includes(i) ? e.filter((j) => j !== i) : [...e, i])} />
      </div>
      {s.step >= 1 && (
        <div className="flex flex-wrap items-center gap-4">
          <MatrixView matrix={H74} name="H" colLabels={LAYOUT_74.map((p) => p.position)} highlightCols={col >= 0 && s.step >= 2 ? [col] : []} />
          <span className="text-2xl">·</span>
          <ColumnVector bits={r} label={<M>{'r^T ='}</M>} size="sm" />
          <span className="text-2xl">=</span>
          <ColumnVector bits={d.syndrome} label={<M>{'s'}</M>} size="sm" cellClass="bg-amber-50 text-amber-800" />
        </div>
      )}
      {s.step >= 2 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50 p-4">
          {d.position === 0 ? (
            <>
              s = 000：沒有發現錯誤。<StatusBadge status={e.length ? 'wrong' : 'ok'} zh={e.length ? '漏掉了' : undefined} en={e.length ? 'Undetected error' : undefined} large />
            </>
          ) : (
            <>
              s 等於 H 的第 {d.position} 欄 <span className="mono">({column(H74, col).join(',')})ᵀ</span> → 翻轉位置 {d.position}（{LAYOUT_74[col].label}），得到 <strong className="mono">{d.corrected.join('')}</strong>
              {e.length === 1 ? <StatusBadge status="corrected" large /> : <StatusBadge status="wrong" zh="誤更正" en="Miscorrection" large />}
            </>
          )}
        </div>
      )}
      <p className="text-lg text-slate-600">
        {s.step === 0 && '點位元注入錯誤（可以點好幾個），再按下一步計算 Syndrome。'}
        {s.step === 1 && 's = Hrᵀ = Heᵀ：codeword 的部分全部消掉，只剩錯誤。'}
        {s.step === 2 && '只錯一個時，s 就是錯誤位置那一欄 = 位置的二進位。錯兩個以上就會改錯（第 4 章解釋原因）。'}
      </p>
    </div>
  );
}

function DistanceSlide() {
  const [d, setD] = useState(3);
  const md = useMemo(() => minimumDistance(codewords74().map((x) => x.codeword)), []);
  const t = correctionCapability(d);
  return (
    <div className="space-y-5 text-xl">
      <p>
        Hamming 距離 = 兩個字串有幾個位置不一樣。Hamming(7,4) 的 16 個 codeword 兩兩比較（{md.pairsChecked} 對），最近的一對距離是 <strong>{md.dmin}</strong>，所以 <M>{`d_{\\min} = ${md.dmin}`}</M>。
      </p>
      <label className="flex items-center gap-4">
        <span>
          設 <M>{'d_{\\min}'}</M> =
        </span>
        <input type="range" min={1} max={7} value={d} onChange={(ev) => setD(Number(ev.target.value))} className="w-64 accent-slate-900" aria-label="最小距離" />
        <span className="font-mono text-3xl font-bold">{d}</span>
      </label>
      <DistanceLine d={d} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-sky-50 p-4">
          保證能修正 <M>{`t = \\lfloor (${d} - 1)/2 \\rfloor = ${t}`}</M> 個：錯 t 個以內，一定還在原本那個 codeword 的地盤。
        </div>
        <div className="rounded-2xl bg-amber-50 p-4">
          保證能偵測 <M>{`d_{\\min} - 1 = ${d - 1}`}</M> 個：錯不到 d_min 個，不可能剛好變成另一個 codeword。
        </div>
      </div>
    </div>
  );
}

function BoundSlide() {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <BallDiagram />
      <div className="space-y-4">
        <PackingDiagram />
        <Tex block>{'2^k \\cdot V_2(n,t) \\le 2^n \\qquad 16 \\times 8 = 128 = 2^7'}</Tex>
      </div>
    </div>
  );
}

function ExtendedSlide() {
  const { message, toggleBit } = useMessage();
  const c8 = encode84(message);
  const d7 = useMemo(() => minimumDistance(codewords74().map((x) => x.codeword)).dmin, []);
  const d8 = useMemo(() => minimumDistance(codewords84().map((x) => x.codeword)).dmin, []);
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-end gap-6">
        <MessageInput message={message} onToggle={toggleBit} size="md" />
        <span className="text-3xl text-slate-300">→</span>
        <div className="flex gap-1.5">
          {c8.map((b, i) => (
            <div key={i} className={`flex w-11 flex-col items-center rounded-lg border-2 py-1 ${i === 7 ? 'border-overall-300 bg-overall-50' : LAYOUT_74[i].role === 'parity' ? 'border-parity-300 bg-parity-50' : 'border-data-300 bg-data-50'}`}>
              <span className="text-xs font-semibold text-slate-600">{LAYOUT_84[i]}</span>
              <span className="font-mono text-2xl font-bold">{b}</span>
            </div>
          ))}
        </div>
      </div>
      <p>
        在 Hamming(7,4) 後面多加一個<strong>整體同位位元</strong> <M>{'P_0 = c_1 \\oplus \\cdots \\oplus c_7'}</M>，讓全部 8 個位元有偶數個 1。
      </p>
      <table className="w-full text-xl">
        <thead>
          <tr className="text-left text-base text-slate-500">
            <th className="py-1" />
            <th>碼長</th>
            <th>
              <M>{'d_{\\min}'}</M>（窮舉計算）
            </th>
            <th>能做到</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-t border-slate-200">
            <td className="py-2 font-semibold">Hamming(7,4)</td>
            <td>7</td>
            <td className="font-mono">{d7}</td>
            <td>修 1 個（錯 2 個會被改錯）</td>
          </tr>
          <tr className="border-t border-slate-200">
            <td className="py-2 font-semibold">Extended(8,4)</td>
            <td>8</td>
            <td className="font-mono">{d8}</td>
            <td>修 1 個，同時偵測 2 個（SECDED）</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const SECDED_ROWS = [
  { kase: 'no-error', s: 's = 0', q: '偶', label: '沒有錯', status: 'ok' },
  { kase: 'single-corrected', s: 's ≠ 0', q: '奇', label: '單一錯誤 → 翻轉位置 s', status: 'corrected' },
  { kase: 'double-detected', s: 's ≠ 0', q: '偶', label: '兩個錯誤 → 只偵測，不修正', status: 'detected' },
  { kase: 'overall-corrected', s: 's = 0', q: '奇', label: 'P0 自己錯了 → 翻轉 P0', status: 'corrected' },
] as const;

function SecdedSlide() {
  const { message } = useMessage();
  const sent = encode84(message);
  const [e, setE] = useState<number[]>([2, 5]);
  const r = sent.map((b, i) => (e.includes(i) ? ((b ^ 1) as Bit) : b));
  const res = secdedDecode(r);
  return (
    <div className="space-y-5 text-xl">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-slate-500">收到 r =</span>
        <div className="flex gap-1.5">
          {r.map((b, i) => {
            const flipped = e.includes(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => setE(flipped ? e.filter((j) => j !== i) : e.length < 3 ? [...e, i] : e)}
                aria-label={`${LAYOUT_84[i]} = ${b}${flipped ? '（已翻轉）' : ''}，點擊翻轉`}
                aria-pressed={flipped}
                className={`flex w-11 flex-col items-center rounded-lg border-2 py-1 ${flipped ? 'border-rose-500 bg-rose-50' : i === 7 ? 'border-overall-300 bg-overall-50' : 'border-slate-200 bg-white'}`}
              >
                <span className="text-xs font-semibold text-slate-600">{LAYOUT_84[i]}</span>
                <span className={`font-mono text-2xl font-bold ${flipped ? 'text-rose-600' : ''}`}>{b}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-8 text-2xl">
        <span>
          s = <span className="mono font-bold">{res.syndrome.join('')}</span>
        </span>
        <span>
          q = {res.overallParity}（8 個位元裡 1 的個數是{res.overallParity ? '奇數' : '偶數'}）
        </span>
        <span className="text-slate-500">實際錯了 {e.length} 個</span>
      </div>
      <table className="w-full text-xl">
        <tbody>
          {SECDED_ROWS.map((row) => {
            const on = row.kase === res.case;
            return (
              <tr key={row.kase} className={`border-t border-slate-200 ${on ? 'bg-amber-100 font-bold' : ''}`}>
                <td className="py-2">{on ? '▶ ' : ''}{row.s}</td>
                <td>q {row.q}</td>
                <td>{row.label}</td>
                <td>
                  <StatusBadge status={row.status} large />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-lg text-slate-600">點位元注入 0–3 個錯誤。至多 2 個錯誤時保證判斷正確；錯 3 個就可能被當成單一錯誤而改錯。</p>
    </div>
  );
}

function SummarySlide() {
  return (
    <div className="space-y-4 text-2xl leading-relaxed">
      <ol className="list-decimal space-y-2 pl-8">
        <li>一個同位位元只能發現「奇數個錯」，找不到錯在哪。</li>
        <li>三個互相重疊的檢查：7 種失敗組合對上 7 個位置 → Hamming(7,4)。</li>
        <li>矩陣語言：c = mG，Hcᵀ = 0，code = ker H。</li>
        <li>Syndrome s = Heᵀ：單一錯誤時就是錯誤位置的二進位。</li>
        <li>
          <M>{'d_{\\min} = 3 \\Rightarrow t = 1'}</M>：保證修 1 個，錯 2 個會改錯。
        </li>
        <li>16 × 8 = 128：Hamming(7,4) 是完美碼，沒有多餘空間偵測雙錯。</li>
        <li>多一個整體同位位元 → (8,4)，d_min = 4：SECDED 修 1 個、偵測 2 個。</li>
      </ol>
      <p className="text-lg text-slate-600">
        第二課：同一個 code 換成多項式與 GF(8) 的觀點，用 LFSR 編碼、用 Chien Search 解碼（報告模式「第二課」）。
      </p>
    </div>
  );
}

const SLIDES: DeckSlide<Ctx>[] = [
  { title: 'Lesson 1 — Hamming(7,4)：從同位位元到 SECDED', sub: '第一課報告：導論與第 1–7 章', steps: () => 1, render: () => <TitleSlide /> },
  { title: '導論：雜訊會翻轉位元', sub: '沒有保護時，錯了也看不出來', steps: () => 1, render: () => <NoiseSlide /> },
  { title: '導論：翻轉 = 加 1（mod 2）', sub: 'r = c + e', steps: () => 1, render: () => <FlipSumSlide /> },
  { title: '導論：要幾個同位位元，才找得到錯？', sub: '切換 1／2／3 個同位位元，點位元製造錯誤', steps: () => 1, render: () => <ParityLab /> },
  { title: '第 1 章：三個互相重疊的檢查', sub: 'P_b 管「二進位含有 b」的位置', steps: () => 1, render: () => <CoverageSlide /> },
  { title: '第 1 章：一步一步編碼', sub: '每個檢查管到的位元要有偶數個 1', steps: () => 5, render: (s) => <EncodeSlide s={s} /> },
  { title: '第 1 章：Venn 圖', sub: '每個圓圈都要有偶數個 1', steps: () => 1, render: () => <VennSlide /> },
  { title: '第 1 章：為什麼訊息是 4 個位元？', sub: '可以更少，但 4 個最划算', steps: () => 1, render: () => <MessageSizeLab /> },
  { title: '第 2 章：矩陣 G 與 H', sub: 'c = mG、Hcᵀ = 0', steps: () => 2, render: (s) => <MatrixSlide s={s} /> },
  { title: '第 3 章：Syndrome 解碼', sub: 's = Hrᵀ = Heᵀ', steps: () => 3, render: (s) => <SyndromeSlide s={s} /> },
  { title: '第 4 章：Hamming 距離與 d_min', sub: '拉動滑桿看地盤怎麼變', steps: () => 1, render: () => <DistanceSlide /> },
  { title: '第 5 章：漢明球', sub: 'n = 3 的立方體：沿著邊走的步數 = 距離', steps: () => 1, render: () => <CubeBall /> },
  { title: '第 5 章：Hamming Bound', sub: '球不能重疊，空間只有 2ⁿ 個字串', steps: () => 1, render: () => <BoundSlide /> },
  { title: '第 6 章：Extended Hamming(8,4)', sub: '多一個整體同位位元', steps: () => 1, render: () => <ExtendedSlide /> },
  { title: '第 7 章：SECDED', sub: '用 s 和 q 兩個訊號判斷四種情況', steps: () => 1, render: () => <SecdedSlide /> },
  { title: '總結', steps: () => 1, render: () => <SummarySlide /> },
];

const MESSAGES = ['1011', '1001', '0110', '1111', '0001'];

export default function Presentation1() {
  const { message, setMessage } = useMessage();
  const [key, setKey] = useState(0);
  return (
    <Deck
      slides={SLIDES}
      ctx={null}
      label="第一課報告"
      exitHref="#/intro"
      resetKey={key}
      toolbar={
        <select
          aria-label="切換範例訊息"
          className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 font-mono"
          value={message.join('')}
          onChange={(e) => {
            setMessage(e.target.value.split('').map((x) => (x === '1' ? 1 : 0)) as Bit[]);
            setKey((k) => k + 1);
          }}
        >
          {[...new Set([message.join(''), ...MESSAGES])].map((m) => (
            <option key={m} value={m}>
              m = {m}
            </option>
          ))}
        </select>
      }
    />
  );
}
