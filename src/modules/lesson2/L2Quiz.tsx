import { useMemo, useState } from 'react';
import { CheckCircle2, Shuffle, XCircle, BookOpen } from 'lucide-react';
import { type QuizQuestion, makeQuiz } from '../../core';
import { M, Tex } from '../../components/Tex';
import { Callout, Card } from '../../components/Lesson';
import { Chapter, Checks, RichText } from '../../components/l2/Common';

const ID = 'l2-14';

const MAP: [string, string, string][] = [
  ['2-1', '完整流程', 'u → c → r → S → 定位 → ĉ → û'],
  ['2-2', 'LFSR', "R_2'=R_1,\\ R_1'=R_0\\oplus\\text{fb},\\ R_0'=\\text{fb}"],
  ['2-3', '長除法', 'a(x) = q(x)g(x) + \\rho(x)'],
  ['2-4', 'Syndrome', 'S(x) = r(x) \\bmod g(x) = e(x) \\bmod g(x)'],
  ['2-5', '查表', 'x^i \\bmod g(x)\\ \\text{兩兩相異}'],
  ['2-6', 'Key Equation', 'S_1 = \\alpha^i,\\ \\sigma(z) = 1 + S_1z'],
  ['2-7', 'Chien Search', '\\sigma(\\alpha^{-i}) = 0 \\Rightarrow \\text{位置} = 7 - i'],
  ['2-8', 'XOR 更正', '\\hat c = r \\oplus \\hat e,\\ \\hat c(\\alpha) = 0'],
  ['2-9', '兩個錯誤', 'd_{\\min}=3 \\Rightarrow t = 1:\\ \\text{誤更正}'],
  ['2-10', '三個錯誤', 'e \\in C \\Rightarrow S = 0:\\ \\text{未偵測}'],
  ['2-11', 'SECDED', '(S, q)\\ \\text{四種判斷，}d_{\\min}=4'],
  ['2-12', '實際參數', 'n = 2^m-1,\\ k = n - m'],
];

export default function L2Quiz() {
  const [seed, setSeed] = useState(1);
  const quiz = useMemo(() => makeQuiz(seed), [seed]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const answered = quiz.filter((q) => answers[q.id] !== undefined);
  const score = quiz.filter((q) => answers[q.id] !== undefined && q.options[answers[q.id]].correct).length;

  return (
    <Chapter
      id={ID}
      lead={<p>回顧第二課的觀念地圖，然後用測驗檢查自己。題目由演算法產生，每按一次「換一組題目」都是新的數字；每個選項都附上它代表的觀念或常見錯誤。</p>}
      goals={['把 14 章的觀念串成一條完整的解碼流程', '用十種題型檢查計算能力', '從錯誤選項的解析中找出自己的盲點', '知道每個觀念要回到哪一章複習']}
      intuition={{
        title: '一句話總結第二課',
        body: (
          <Callout kind="key" title="從編碼到錯誤更正">
            <p>
              編碼把訊息變成 <M>{'g(x)'}</M> 的倍數；通道加上錯誤；除以 <M>{'g(x)'}</M> 的餘數只剩下錯誤的指紋；在 GF(8) 中這個指紋是 <M>{'\\alpha^i'}</M>，它的指數 i 就是錯誤的次方（從左數位置 = 7 − i）；翻轉那一位就完成更正——前提是錯誤不超過一個。超過時，SECDED 至少能告訴你「修不好」。
            </p>
          </Callout>
        ),
      }}
      math={{
        title: '觀念地圖',
        body: (
          <Card>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MAP.map(([n, t, f]) => (
                <a key={n} href={`#/l2-${n.split('-')[1]}`} className="rounded-xl border border-slate-200 p-3 hover:border-slate-400 hover:bg-slate-50">
                  <div className="text-xs font-semibold text-slate-500">
                    {n} {t}
                  </div>
                  <div className="mt-1 overflow-x-auto text-sm">
                    <Tex>{f}</Tex>
                  </div>
                </a>
              ))}
            </div>
          </Card>
        ),
      }}
      algorithm={{
        title: '答題策略',
        body: (
          <Card>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              <li>先確認位元順序：最左邊是最高次項，位置 p ↔ 次方 7 − p。</li>
              <li>Syndrome、GF(8) 元素、σ(z) 是三種不同的物件，不要用「二進位數」直接解讀。</li>
              <li>看到兩個以上的錯誤，先問：解碼器知道嗎？（S 是否為 0）它會怎麼做？</li>
              <li>選完答案後，把每個錯誤選項的解析都讀一遍——它們就是最常見的誤解。</li>
            </ul>
          </Card>
        ),
      }}
      interactive={{
        title: '互動測驗',
        body: (
          <>
            <Card
              actions={
                <>
                  <span className="text-sm text-slate-600">
                    得分 <strong>{score}</strong> / {quiz.length}（已作答 {answered.length}）
                  </span>
                  <button
                    className="btn-ghost"
                    onClick={() => {
                      setSeed((s) => s + 1);
                      setAnswers({});
                    }}
                  >
                    <Shuffle className="h-3.5 w-3.5" /> 換一組題目
                  </button>
                  <button className="btn-ghost" onClick={() => setAnswers({})}>
                    清除作答
                  </button>
                </>
              }
              title={`第 ${seed} 組題目`}
            >
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(answered.length / quiz.length) * 100}%` }} />
              </div>
            </Card>
            {quiz.map((q, k) => (
              <QuestionCard key={q.id} q={q} n={k + 1} picked={answers[q.id]} onPick={(i) => setAnswers((a) => ({ ...a, [q.id]: i }))} />
            ))}
          </>
        ),
      }}
      verify={{
        title: '測驗結果',
        body: (
          <Checks
            title="你的作答"
            items={quiz.map((q) => ({
              label: (
                <>
                  {q.chapterLabel}：{answers[q.id] === undefined ? '尚未作答' : q.options[answers[q.id]].correct ? '答對' : '答錯，建議複習'}
                </>
              ),
              pass: answers[q.id] !== undefined && q.options[answers[q.id]].correct,
            }))}
          />
        ),
      }}
      next={
        <p>
          恭喜完成第二課！可以到「報告模式」把整個流程投影出來，或回到 <a className="text-indigo-700 underline" href="#/l2-13">2-13 完整互動實驗室</a> 自由實驗。延伸方向：把單一根 <M>{'\\alpha'}</M> 推廣成多個連續的根，就得到能更正多個錯誤的 BCH Code。
        </p>
      }
    />
  );
}

function QuestionCard({ q, n, picked, onPick }: { q: QuizQuestion; n: number; picked?: number; onPick: (i: number) => void }) {
  const done = picked !== undefined;
  const right = done && q.options[picked].correct;
  return (
    <Card>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-slate-900 font-bold text-white">{n}</span>
        <a href={`#/${q.chapter}`} className="chip bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
          <BookOpen className="h-3 w-3" /> {q.chapterLabel}
        </a>
      </div>
      <div className="text-sm leading-relaxed text-slate-800">
        <RichText text={q.prompt} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {q.options.map((o, i) => {
          const isPicked = picked === i;
          const cls = !done ? 'border-slate-200 hover:border-slate-500 hover:bg-slate-50' : o.correct ? 'border-emerald-500 bg-emerald-50' : isPicked ? 'border-rose-500 bg-rose-50' : 'border-slate-200 opacity-80';
          return (
            <button key={i} type="button" disabled={done} onClick={() => onPick(i)} className={`rounded-xl border-2 px-3 py-2 text-left transition-colors ${cls}`}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 font-mono text-xs text-slate-400">{String.fromCharCode(65 + i)}</span>
                <span className="flex-1 font-mono text-sm font-semibold">
                  <RichText text={o.text} />
                </span>
                {done && o.correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                {done && isPicked && !o.correct && <XCircle className="h-4 w-4 shrink-0 text-rose-600" />}
              </div>
              {done && (
                <div className="mt-1 pl-5 text-xs leading-relaxed text-slate-600">
                  {o.correct ? '正確：' : '為什麼不對：'}
                  <RichText text={o.why} />
                </div>
              )}
            </button>
          );
        })}
      </div>
      {done && (
        <div className={`mt-3 rounded-xl p-3 text-sm ${right ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
          <strong>{right ? '答對了！' : '再想想。'}</strong> 詳解：<RichText text={q.explanation} />
          {!right && (
            <a href={`#/${q.chapter}`} className="ml-2 font-semibold underline">
              回到 {q.chapterLabel}
            </a>
          )}
        </div>
      )}
    </Card>
  );
}
