import { useState } from 'react';
import { type Bit, DEFAULT_U, alphaPow, bitsToField, encodeCyclic, flipBit, lookupPosition, syndromeL2, syndromeTable, vecAdd, weight } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card, Misconceptions, ResetButton, Segmented } from '../../components/Lesson';
import { AlgoSteps, BitStrip, Chapter, Checks, L2Legend } from '../../components/l2/Common';
import { LookupTable, lookupRows } from '../../components/l2/Decode';

const ID = 'l2-5';
const C = encodeCyclic(DEFAULT_U).codeword;

export default function L2Lookup() {
  const [r, setR] = useState<Bit[]>(flipBit(C, 1) as Bit[]);
  const [conv, setConv] = useState<'msb' | 'lsb'>('msb');
  const e = vecAdd(r, C);
  const S = syndromeL2(r);
  const pos = lookupPosition(S);
  const nErr = weight(e);
  const table = syndromeTable();
  const distinct = new Set(table.map((t) => t.syndrome.join(''))).size;
  const lsbDiffers = lookupRows('lsb').some((row, k) => row.syndrome.join('') !== table[k].syndrome.join(''));

  return (
    <Chapter
      id={ID}
      lead={
        <p>
          上一章得到的 syndrome <span className="mono">111</span> 要對應到「第 2 個 bit」。這一章逐一製造 7 種單一錯誤，記下各自的 syndrome，建立一張查表——並看清楚為什麼這張表<strong>不能</strong>用「把 S 當二進位數」取代。
        </p>
      }
      goals={[
        '對每個錯誤位置計算 syndrome，建立查表',
        '說明為什麼 7 個 syndrome 互不相同且都不為 0',
        <>強調：syndrome 是錯誤特徵值，不是位置的二進位</>,
        '理解查表依賴編碼方式與位元順序',
      ]}
      intuition={{
        title: '每個位置都有獨一無二的指紋',
        body: (
          <div className="prose-lab">
            <p>
              上一章證明 <M>{'S = e(x) \\bmod g(x)'}</M>。若只有一個錯誤在 <M>{'x^i'}</M>，<M>{'S = x^i \\bmod g(x)'}</M>——只和 i 有關。只要 7 個位置的指紋兩兩不同，看到指紋就能認出位置。
            </p>
            <p>但指紋的「樣子」是由 <M>{'g(x)'}</M> 和位元順序決定的，看起來像二進位數字純屬巧合。</p>
          </div>
        ),
      }}
      math={{
        title: '為什麼 7 個指紋都不同？',
        body: (
          <Card>
            <Tex block>{'S_i(x) = x^i \\bmod g(x),\\qquad i = 0,1,\\dots,6'}</Tex>
            <p className="text-sm text-slate-700">
              若 <M>{'S_i = S_j'}</M>（<M>{'i > j'}</M>），則 <M>{'g(x) \\mid x^i - x^j = x^j(x^{i-j} - 1)'}</M>。<M>{'g(x)'}</M> 與 <M>{'x'}</M> 互質，所以 <M>{'g(x) \\mid x^{i-j} - 1'}</M>，其中 <M>{'0 < i - j < 7'}</M>。但 <M>{'g(x)'}</M> 是 primitive polynomial（本原多項式，見 A4），使 <M>{'g \\mid x^k - 1'}</M> 的最小 k 是 7，矛盾。所以 7 個 syndrome 兩兩相異，且都不為 0（<M>{'g \\nmid x^i'}</M>）。
            </p>
            <p className="text-sm text-slate-700">3 位元的非零值剛好只有 7 個，所以這是一一對應——Hamming code 是 perfect code（完美碼，見<a className="text-indigo-700 underline" href="#/distance">第一課第 4 章</a>）。</p>
            <p className="mt-2 text-sm text-slate-700">
              換個角度看：把這 7 個 syndrome 依位置 1 ~ 7 排成直行，得到的正是 cyclic code（循環碼）的 parity-check matrix（同位檢查矩陣）<M>{'H_{\\text{cyc}}'}</M>（第 k 欄 = <M>{'\\alpha^{7-k}'}</M>，k = 1, …, 7）。所以「查表」就是<a className="text-indigo-700 underline" href="#/syndrome">第一課「比對 H 的哪一欄」</a>，只是位元排列不同——詳見 <a className="text-indigo-700 underline" href="#/a-9">A9 用 GF(8) 推導 H</a>。
            </p>
          </Card>
        ),
      }}
      algorithm={{
        title: '查表解碼',
        body: (
          <AlgoSteps
            steps={[
              <>事先計算：對 i = 6, 5, …, 0（位置 1–7），存下 <M>{'x^i \\bmod g(x)'}</M>。</>,
              <>收到 r，算出 S。</>,
              <>S = 000 → 不更正；否則在表中找出 S 對應的位置 p。</>,
              <>翻轉位置 p（下一步：XOR 更正，2-8）。</>,
            ]}
          />
        ),
      }}
      interactive={{
        title: '點擊任一位元製造錯誤',
        body: (
          <Card
            title={`Codeword c = ${C.join('')}；點擊位元翻轉`}
            actions={
              <>
                <Segmented
                  value={conv}
                  onChange={setConv}
                  options={[
                    { value: 'msb', label: '本課程排列（左 = 高次）' },
                    { value: 'lsb', label: '如果改成左 = 低次' },
                  ]}
                />
                <ResetButton
                  onClick={() => {
                    setR(flipBit(C, 1) as Bit[]);
                    setConv('msb');
                  }}
                />
              </>
            }
          >
            <BitStrip bits={r} states={e.map((b) => (b ? 'error' : 'normal'))} onToggle={(i) => setR(flipBit(r, i) as Bit[])} />
            <div className="mt-2">
              <L2Legend />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs text-slate-500">Syndrome S</div>
                <div className="font-mono text-2xl font-bold">{S.join('')}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs text-slate-500">查表結果</div>
                <div className="text-xl font-bold">{pos === 0 ? '無錯誤' : `位置 ${pos}`}</div>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs text-slate-500">S 讀成二進位數</div>
                <div className="text-xl font-bold text-rose-600">{bitsToField(S)}</div>
                <div className="text-xs text-slate-500">{pos > 0 && bitsToField(S) !== pos ? '≠ 錯誤位置！' : ''}</div>
              </div>
            </div>
            {nErr >= 2 && (
              <div className="mt-3">
                <Callout kind="warning" title={`目前有 ${nErr} 個錯誤`}>
                  <p>
                    查表假設「最多一個錯誤」。
                    {pos > 0 ? (
                      <>現在 S = {S.join('')} 會被當成位置 {pos} 的單一錯誤，結果會是錯的（2-9、2-10）。</>
                    ) : (
                      <>現在 S = 000，decoder 會判定「沒有錯誤」，這些錯誤完全沒被發現（2-10）。</>
                    )}
                  </p>
                </Callout>
              </div>
            )}
            <div className="mt-4">
              <LookupTable highlightPos={nErr === 1 ? e.indexOf(1) + 1 : undefined} convention={conv} />
            </div>
            {conv === 'lsb' && (
              <p className="mt-2 text-sm text-amber-800">
                改變位元順序後，除了正中間的位置 4（不論從哪一端數都是 x³）以外，其餘六個位置都對應到不同的次方，表格的六列都變了；同一個 S 在兩種慣例下通常指向不同位置——查表必須和編碼時的位元順序一致。
              </p>
            )}
          </Card>
        ),
      }}
      verify={{
        title: '查表的正確性',
        body: (
          <>
            <Checks
              items={[
                { label: <>7 個 syndrome 兩兩相異（共 {distinct} 種）</>, pass: distinct === 7 },
                { label: <>沒有任何位置的 syndrome 是 000</>, pass: table.every((t) => t.syndrome.join('') !== '000') },
                { label: <>表格：{table.map((t) => `${t.position}→${t.syndrome.join('')}`).join('、')}</>, pass: table.map((t) => t.syndrome.join('')).join(',') === '101,111,110,011,100,010,001' },
                { label: <>每一列：S 作為 GF(8) 元素等於 αⁱ（i = 錯誤次方）</>, pass: table.every((t) => t.field === alphaPow(t.exponent)) },
                { label: <>改變位元順序，表格確實不同</>, pass: lsbDiffers },
              ]}
            />
            <Misconceptions
              items={[
                { wrong: 'S = 111 = 7，所以錯在第 7 個 bit。', right: 'S = 111 對應位置 2（x⁵）。syndrome 是錯誤特徵值，只有依據編碼方式與位元順序建立的對照表才能解讀。' },
                { wrong: '第一課的 syndrome 直接等於位置，所以這裡也一樣。', right: '第一課的 H 是刻意把「第 j 欄 = j 的二進位」排好的。cyclic code 的 H 欄位是 αⁱ，順序不同。' },
              ]}
            />
          </>
        ),
      }}
      related={[{ to: 'a-9', text: '查表的七列 = H_cyc 的七個欄' }, { to: 'a-4', text: '為什麼七個 syndrome 都不同：α 是 primitive element（本原元素）' }]}
      next={
        <p>
          查表對 7 位元很好用，但 code length（碼長）變成 127、甚至要更正多個錯誤時，表格會大到不實際。下一章換一個角度：把 syndrome 看成 finite field（有限體）<M>{'\\mathrm{GF}(8)'}</M> 中的元素，用代數「解出」錯誤位置。
        </p>
      }
    />
  );
}
