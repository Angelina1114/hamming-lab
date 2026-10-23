/**
 * Lesson 2 quiz generator. Every answer and every distractor is COMPUTED from the core
 * algorithms; each distractor models a specific misconception and carries its explanation.
 * Text uses $…$ for inline LaTeX.
 */
import { type Bit, intToBits, vecAdd } from './gf2';
import { alphaPow } from './gf8';
import {
  G_MSB,
  bitsToField,
  codewordsL2,
  decodeL2,
  encodeCyclic,
  errorVector,
  fieldToBits,
  polyModMsb,
  positionToExponent,
  runLfsr,
  secdedDecodeL2,
  syndromeL2,
  type SecdedL2Case,
} from './cyclic';
import { rng } from './gfm';

export type QuizType = 'lfsr' | 'xor' | 'division' | 'syndrome' | 'gf8' | 'chien' | 'single' | 'double' | 'triple' | 'secded';

export const QUIZ_TYPES: { type: QuizType; label: string }[] = [
  { type: 'lfsr', label: 'LFSR 狀態更新' },
  { type: 'xor', label: 'XOR 運算' },
  { type: 'division', label: '多項式除法' },
  { type: 'syndrome', label: 'Syndrome 計算' },
  { type: 'gf8', label: 'GF(8) 元素轉換' },
  { type: 'chien', label: 'Chien search' },
  { type: 'single', label: '單一錯誤更正' },
  { type: 'double', label: '雙位元 miscorrection' },
  { type: 'triple', label: '三位元 undetected error' },
  { type: 'secded', label: 'SECDED 判斷' },
];

export interface QuizOption {
  text: string;
  correct: boolean;
  /** why this option is right / which misconception it represents */
  why: string;
}

export interface QuizQuestion {
  id: string;
  type: QuizType;
  /** route id of the chapter that teaches this */
  chapter: string;
  chapterLabel: string;
  prompt: string;
  options: QuizOption[];
  explanation: string;
}

const s = (b: readonly Bit[]) => b.join('');
const pick = <T,>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)];
const randInt = (lo: number, hi: number, r: () => number) => lo + Math.floor(r() * (hi - lo + 1));

/** dedupe distractors against the answer and each other, then shuffle */
function finalize(correct: QuizOption, distractors: QuizOption[], r: () => number, filler: () => string): QuizOption[] {
  const out: QuizOption[] = [correct];
  for (const d of distractors) if (!out.some((o) => o.text === d.text)) out.push(d);
  let guard = 0;
  while (out.length < 4 && guard++ < 50) {
    const t = filler();
    if (!out.some((o) => o.text === t)) out.push({ text: t, correct: false, why: '這個值與實際計算結果不符（干擾選項）。' });
  }
  const opts = out.slice(0, 4);
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  return opts;
}

const randBitsStr = (n: number, r: () => number) => () => s(Array.from({ length: n }, () => (r() < 0.5 ? 0 : 1) as Bit));

export function makeQuestion(type: QuizType, seed: number): QuizQuestion {
  const r = rng(seed * 97 + QUIZ_TYPES.findIndex((q) => q.type === type) * 7919 + 1);
  const id = `${type}-${seed}`;
  switch (type) {
    case 'lfsr': {
      const state = intToBits(randInt(0, 7, r), 3);
      const input = (r() < 0.5 ? 0 : 1) as Bit;
      const step = lfsrFrom(state, input);
      const [R2, R1, R0] = state;
      const fb = (input ^ R2) as Bit;
      const noXor: Bit[] = [R1, R0, 0];
      const fbNoInput: Bit[] = [R1, (R0 ^ R2) as Bit, R2];
      const wrongTaps: Bit[] = [(R1 ^ fb) as Bit, R0, fb];
      return {
        id,
        type,
        chapter: 'l2-2',
        chapterLabel: '2-2 LFSR 與 generator polynomial',
        prompt: `預乘式 LFSR，$g(x)=x^3+x+1$，規則 feedback $= \\text{input} \\oplus R_2$，$R_2'=R_1,\\ R_1'=R_0\\oplus \\text{fb},\\ R_0'=\\text{fb}$。目前 $R_2R_1R_0 = ${s(state)}$，輸入 ${input}，下一個狀態是？`,
        options: finalize(
          { text: s(step), correct: true, why: `feedback $= ${input}\\oplus ${R2} = ${fb}$；左移得 $${s(noXor)}$，再把 fb 加到 $R_1$、$R_0$（對應 $g$ 的 $x$ 與 $1$ 項）得到 $${s(step)}$。` },
          [
            { text: s(noXor), correct: false, why: '只做了左移，忘了把 feedback XOR 回 $R_1$ 與 $R_0$。' },
            { text: s(fbNoInput), correct: false, why: '把 feedback 當成 $R_2$，忘了先與輸入 bit 做 XOR（那是除法器的規則，不是預乘式 encoder）。' },
            { text: s(wrongTaps), correct: false, why: '把 feedback 接到錯的位置：XOR 進了 $R_2$，相當於使用 $g(x)=x^3+x^2+1$；feedback 要接到哪幾個 register，由 $g(x)$ 的係數決定。' },
          ],
          r,
          randBitsStr(3, r),
        ),
        explanation: `fb $= ${input}\\oplus ${R2} = ${fb}$。$R_2' = R_1 = ${step[0]}$，$R_1' = R_0\\oplus\\text{fb} = ${R0}\\oplus${fb} = ${step[1]}$，$R_0' = \\text{fb} = ${step[2]}$。`,
      };
    }
    case 'xor': {
      const a = intToBits(randInt(1, 127, r), 7);
      const k = randInt(1, 2, r);
      const positions = pickPositions(7, k, r);
      const e = errorVector(positions);
      const x = vecAdd(a, e);
      const and = a.map((b, i) => (b & e[i]) as Bit);
      const or = a.map((b, i) => (b | e[i]) as Bit);
      return {
        id,
        type,
        chapter: 'l2-8',
        chapterLabel: '2-8 XOR 錯誤更正與驗證',
        prompt: `計算 $${s(a)} \\oplus ${s(e)}$。`,
        options: finalize(
          { text: s(x), correct: true, why: '逐位 XOR：相同得 0、不同得 1；e 中為 1 的位置被翻轉。' },
          [
            { text: s(or), correct: false, why: '這是 OR（1 ∨ 1 = 1）。在 GF(2) 中 1 ⊕ 1 = 0。' },
            { text: s(and), correct: false, why: '這是 AND，不是加法。' },
            { text: s(a), correct: false, why: '原字串沒有被改變——忘了套用 error vector。' },
          ],
          r,
          randBitsStr(7, r),
        ),
        explanation: `e 的 1 在位置 ${positions.join('、')}，把 $${s(a)}$ 的這些位置翻轉即得 $${s(x)}$。`,
      };
    }
    case 'division': {
      const u = intToBits(randInt(1, 15, r), 4);
      const enc = encodeCyclic(u);
      const noPad = polyModMsb(u, G_MSB);
      const reversed = [...enc.parity].reverse() as Bit[];
      return {
        id,
        type,
        chapter: 'l2-3',
        chapterLabel: '2-3 手算 GF(2) 多項式除法',
        prompt: `訊息 $u = ${s(u)}$，補三個 0 後計算 $${s(enc.shifted)} \\bmod 1011$，得到的 parity bit $p$ 是？`,
        options: finalize(
          { text: s(enc.parity), correct: true, why: `長除法：每次把 1011 對齊目前最高位的 1 並 XOR，最後剩下 3 位餘數 $${s(enc.parity)}$。` },
          [
            { text: s(noPad), correct: false, why: '忘了先補三個 0（乘以 $x^3$），直接計算 $u(x) \\bmod g(x)$。' },
            { text: s(reversed), correct: false, why: '餘數的位元順序寫反了。第二課最左邊是最高次項。' },
            { text: s(enc.division.quotient.slice(1)), correct: false, why: '這是商的一部分，不是餘數；parity bit 是「餘數」。' },
          ],
          r,
          randBitsStr(3, r),
        ),
        explanation: `$${s(enc.shifted)} \\div 1011$ 的商為 $${s(enc.division.quotient)}$，餘數 $p = ${s(enc.parity)}$，所以 codeword $c = ${s(enc.codeword)}$。`,
      };
    }
    case 'syndrome': {
      const c = pick(codewordsL2(), r).c;
      const pos = randInt(1, 7, r);
      const rv = vecAdd(c, errorVector([pos]));
      const S = syndromeL2(rv);
      const exp = positionToExponent(pos);
      return {
        id,
        type,
        chapter: 'l2-4',
        chapterLabel: '2-4 Syndrome 計算',
        prompt: `收到 $r = ${s(rv)}$，計算 syndrome $S(x) = r(x) \\bmod (x^3+x+1)$（以 3 位元表示）。`,
        options: finalize(
          { text: s(S), correct: true, why: `$S(x) = r(x) \\bmod g(x)$；因為 $c(x) \\bmod g(x)=0$，$S = x^{${exp}} \\bmod g(x) = ${s(S)}$。` },
          [
            { text: s(intToBits(pos, 3)), correct: false, why: '把錯誤「位置」直接寫成二進位；syndrome 是餘數，不是位置編號。' },
            { text: s(intToBits(exp, 3)), correct: false, why: '把錯誤「次方」寫成二進位；syndrome 是 $x^i \\bmod g(x)$，不是 $i$ 本身。' },
            { text: s([...S].reverse() as Bit[]), correct: false, why: '餘數位元順序寫反了（第二課最左邊是 $x^2$ 係數）。' },
          ],
          r,
          randBitsStr(3, r),
        ),
        explanation: `錯誤在位置 ${pos}（$x^{${exp}}$），$S = x^{${exp}} \\bmod g(x) = ${s(S)}$。`,
      };
    }
    case 'gf8': {
      const k = randInt(2, 6, r);
      const a = alphaPow(k);
      return {
        id,
        type,
        chapter: 'l2-6',
        chapterLabel: '2-6 Key equation',
        prompt: `在 $\\mathrm{GF}(8)$（$g(x)=x^3+x+1$，$\\alpha^3=\\alpha+1$）中，$\\alpha^{${k}}$ 的三位元表示（$\\alpha^2\\,\\alpha\\,1$ 的係數）是？`,
        options: finalize(
          { text: s(fieldToBits(a)), correct: true, why: `逐次乘 $\\alpha$，遇到 $\\alpha^3$ 就換成 $\\alpha+1$，得到 $\\alpha^{${k}}$ = ${s(fieldToBits(a))}。` },
          [
            { text: s(intToBits(k, 3)), correct: false, why: `把指數 ${k} 寫成二進位；finite field 元素的表示是多項式係數，不是指數。` },
            { text: s([...fieldToBits(a)].reverse() as Bit[]), correct: false, why: '係數順序寫反了（左邊應是 $\\alpha^2$ 的係數）。' },
            { text: s(fieldToBits(alphaPow(k - 1))), correct: false, why: `這是 $\\alpha^{${k - 1}}$，少乘了一次 $\\alpha$。` },
          ],
          r,
          randBitsStr(3, r),
        ),
        explanation: `$\\alpha^{${k}} = ${s(fieldToBits(a))}$。`,
      };
    }
    case 'chien': {
      const pos = randInt(1, 7, r);
      const i = positionToExponent(pos);
      const S1 = alphaPow(i);
      const j = (7 - i) % 7;
      const opt = (jj: number) => `z = α${sup(jj)}`;
      return {
        id,
        type,
        chapter: 'l2-7',
        chapterLabel: '2-7 Chien search',
        prompt: `已知 syndrome $S_1 = ${s(fieldToBits(S1))} = \\alpha^{${i}}$，error-locator polynomial $\\sigma(z) = 1 + \\alpha^{${i}}z$。Chien search 在 $z = \\alpha^0,\\dots,\\alpha^6$ 中找到的根是？`,
        options: finalize(
          { text: opt(j), correct: true, why: `$\\sigma(\\alpha^{${j}}) = 1 + \\alpha^{${i}+${j}} = 1 + \\alpha^{7} = 0$。根 $z = \\alpha^{-i}$，所以錯誤次方 $i = ${i}$，即從左數第 ${pos} 個 bit。` },
          [
            { text: opt(i), correct: false, why: `$\\sigma(\\alpha^{${i}}) = 1+\\alpha^{${(2 * i) % 7}} \\ne 0$。根是 $\\alpha^{-i}$ 而不是 $\\alpha^{i}$：error-location number $X=\\alpha^i$ 是根的倒數。` },
            { text: opt(pos % 7), correct: false, why: '把「從左數的位置」當成指數。位置與次方的關係是 $i = 7 - \\text{位置}$。' },
            { text: opt((j + 1) % 7), correct: false, why: `$\\sigma(\\alpha^{${(j + 1) % 7}}) = 1+\\alpha \\ne 0$，不是根。` },
          ],
          r,
          () => opt(randInt(0, 6, r)),
        ),
        explanation: `逐一代入 $z=\\alpha^j$：$\\sigma(\\alpha^j) = 1 + \\alpha^{${i}+j}$，只有 $${i}+j \\equiv 0 \\pmod 7$ 時為 0，即 $j = ${j}$。`,
      };
    }
    case 'single': {
      const c = pick(codewordsL2(), r).c;
      const pos = randInt(1, 7, r);
      const rv = vecAdd(c, errorVector([pos]));
      const d = decodeL2(rv);
      const asBinary = bitsToField(d.syndrome); // misreading S as a position number
      const flipAt = (p: number) => (p >= 1 && p <= 7 ? vecAdd(rv, errorVector([p])) : rv);
      // confusing the exponent with a left-to-right index: flip position (exponent + 1)
      const confused = positionToExponent(pos) + 1;
      return {
        id,
        type,
        chapter: 'l2-8',
        chapterLabel: '2-8 XOR 錯誤更正與驗證',
        prompt: `收到 $r = ${s(rv)}$（假設至多一個錯誤），syndrome $S = ${s(d.syndrome)}$。更正後的 codeword $\\hat c$ 是？`,
        options: finalize(
          { text: s(d.corrected), correct: true, why: `查表 $S = ${s(d.syndrome)}$ → 位置 ${d.position}（$x^{${d.exponent}}$），$\\hat c = r \\oplus ${s(d.estimatedError)} = ${s(d.corrected)}$。` },
          [
            { text: s(flipAt(asBinary)), correct: false, why: `把 $S = ${s(d.syndrome)}$ 當成二進位數 ${asBinary}，翻轉第 ${asBinary} 位；syndrome 不是位置的二進位，必須查表或用 Chien search。` },
            { text: s(rv), correct: false, why: '這個 syndrome 不為 0，表示有錯誤，不能原樣輸出。' },
            { text: s(flipAt(confused)), correct: false, why: '混淆了「從左數的位置」與「多項式次方」。' },
          ],
          r,
          randBitsStr(7, r),
        ),
        explanation: `$S = ${s(d.syndrome)}$ 對應位置 ${d.position}，翻轉後 $\\hat c(\\alpha) = 0$，還原訊息 $${s(d.message)}$。`,
      };
    }
    case 'double': {
      const { u, c } = pick(codewordsL2().slice(1), r);
      const [p1, p2] = pickPositions(7, 2, r);
      const rv = vecAdd(c, errorVector([p1, p2]));
      const d = decodeL2(rv);
      const oneFixed = vecAdd(rv, errorVector([p1]));
      return {
        id,
        type,
        chapter: 'l2-9',
        chapterLabel: '2-9 超過 error-correcting capability：兩個錯誤',
        prompt: `送出 $c = ${s(c)}$，位置 ${p1}、${p2} 發生錯誤，收到 $r = ${s(rv)}$。只能更正一個錯誤的 Hamming(7,4) decoder 輸出什麼？`,
        options: finalize(
          { text: s(d.corrected), correct: true, why: `$S = ${s(d.syndrome)}$ 剛好等於位置 ${d.position} 的單一錯誤 syndrome，decoder 翻轉位置 ${d.position}，得到另一個合法 codeword：這就是 miscorrection。` },
          [
            { text: s(c), correct: false, why: '兩個錯誤超出 $t=1$ 的能力，decoder 無法還原原 codeword。' },
            { text: s(rv), correct: false, why: '普通 Hamming decoder 沒有「偵測雙錯並保留」的機制；那是 SECDED 才有的行為。' },
            { text: s(oneFixed), correct: false, why: '真正的錯誤位置 decoder 並不知道，它只會翻轉 syndrome 所指的那一位。' },
          ],
          r,
          randBitsStr(7, r),
        ),
        explanation: `$S = ${s(d.syndrome)} \\ne 0$，查表得位置 ${d.position}。輸出 $${s(d.corrected)}$ 雖滿足 $\\hat c(\\alpha)=0$，但訊息 $${s(d.message)} \\ne ${s(u)}$。`,
      };
    }
    case 'triple': {
      const { u, c } = pick(codewordsL2(), r);
      const shift = randInt(0, 3, r);
      const e = [...Array(3 - shift).fill(0), ...G_MSB, ...Array(shift).fill(0)] as Bit[]; // x^shift · g(x)
      const rv = vecAdd(c, e);
      const d = decodeL2(rv);
      const positions = e.flatMap((b, k) => (b ? [k + 1] : []));
      return {
        id,
        type,
        chapter: 'l2-10',
        chapterLabel: '2-10 超過 error-correcting capability：三個錯誤',
        prompt: `送出訊息 $u = ${s(u)}$（$c = ${s(c)}$），error vector $e = ${s(e)}$（位置 ${positions.join('、')}）。此時 decoder 輸出的訊息 $\\hat u$ 是？`,
        options: finalize(
          { text: s(d.message), correct: true, why: `$e(x) = x^{${shift}}g(x)$ 本身就是 codeword，所以 $S = 0$，decoder 以為沒錯，直接取前四位 $${s(d.message)}$（undetected error）。` },
          [
            { text: s(u), correct: false, why: '三個錯誤超出能力範圍，而且這個 error vector 完全不會被偵測到。' },
            { text: s(vecAdd(rv, errorVector([1])).slice(0, 4)), correct: false, why: '$S = 0$，decoder 不會翻轉任何位元。' },
            { text: '偵測到錯誤，不輸出', correct: false, why: '$e(x)$ 被 $g(x)$ 整除，$S = 0$，decoder 根本察覺不到錯誤。' },
          ],
          r,
          randBitsStr(4, r),
        ),
        explanation: `$S(x) = e(x) \\bmod g(x) = 0$，因為 $e(x) = x^{${shift}}g(x)$。`,
      };
    }
    case 'secded': {
      const u = intToBits(randInt(0, 15, r), 4);
      const nErr = randInt(0, 2, r);
      const c7 = encodeCyclic(u).codeword;
      const c8 = [...c7, c7.reduce<number>((a, b) => a ^ b, 0) as Bit];
      const positions = pickPositions(8, nErr, r);
      const r8 = vecAdd(c8, errorVector(positions, 8));
      const res = secdedDecodeL2(r8);
      const LABEL: Record<SecdedL2Case, string> = {
        'no-error': '沒有錯誤（No Error）',
        single: '單一錯誤，更正（Single Error, Correct）',
        overall: 'Overall parity bit 錯誤',
        double: '偵測到雙重錯誤，不更正（Double Error Detected）',
      };
      const WHY: Record<SecdedL2Case, string> = {
        'no-error': '需要 $S = 0$ 且 overall parity 為偶。',
        single: '需要 $S \\ne 0$ 且 overall parity 為奇。',
        overall: '需要 $S = 0$ 且 overall parity 為奇。',
        double: '需要 $S \\ne 0$ 且 overall parity 為偶。',
      };
      const sz = res.syndrome.every((b) => b === 0);
      return {
        id,
        type,
        chapter: 'l2-11',
        chapterLabel: '2-11 SECDED 的補救',
        prompt: `收到 extended Hamming(8,4) 的 $r = ${s(r8)}$。前 7 位的 $S = ${s(res.syndrome)}$，8 個位元的 overall parity 為${res.parity ? '奇' : '偶'}。SECDED 的判斷是？`,
        options: (['no-error', 'single', 'overall', 'double'] as SecdedL2Case[]).map((k) => ({
          text: LABEL[k],
          correct: k === res.case,
          why: k === res.case ? `$S ${sz ? '=' : '\\ne'} 0$、overall parity 為${res.parity ? '奇' : '偶'} → ${LABEL[k]}。` : WHY[k],
        })),
        explanation: `實際錯誤數 = ${nErr}${positions.length ? `（位置 ${positions.join('、')}）` : ''}。在「至多兩個錯誤」的假設下，判斷保證正確。`,
      };
    }
  }
}

export function makeQuiz(seed: number): QuizQuestion[] {
  return QUIZ_TYPES.map((q) => makeQuestion(q.type, seed));
}

/* helpers */

const lfsrFrom = (state: Bit[], input: Bit): Bit[] => runLfsr([input], 'encoder', G_MSB, state).final;

function pickPositions(n: number, k: number, r: () => number): number[] {
  const pool = Array.from({ length: n }, (_, i) => i + 1);
  const out: number[] = [];
  while (out.length < k) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  return out.sort((a, b) => a - b);
}

const SUPS = '⁰¹²³⁴⁵⁶';
const sup = (j: number) => SUPS[j];
