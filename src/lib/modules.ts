export interface ModuleMeta {
  id: string;
  num: string;
  title: string;
  en: string;
  blurb: string;
  advanced?: boolean;
  /** 1 = Lesson 1 (default), 2 = Lesson 2 */
  lesson?: 1 | 2;
  /** the 「代數基礎與 Cyclic Codes」 chapter, between Lesson 1 and Lesson 2 */
  group?: 'algebra';
}

export const MODULES: ModuleMeta[] = [
  { id: 'intro', num: '0', title: '導論與使用方式', en: 'Introduction', blurb: '雜訊會翻轉位元：多送幾個有規律的位元，才能發現並修好錯' },
  { id: 'encode', num: '1', title: 'Hamming(7,4) 編碼', en: 'Encoding', blurb: '4 個 data bit 如何長出 3 個 parity bit' },
  { id: 'matrix', num: '2', title: 'H 與 G', en: 'Parity-check & Generator Matrix', blurb: '發送端用 G 編碼，接收端用 H 的 3 盞燈檢查' },
  { id: 'syndrome', num: '3', title: 'Syndrome 解碼', en: 'Syndrome Decoding', blurb: '翻轉位元，讓 Syndrome 告訴你錯在哪裡' },
  { id: 'distance', num: '4', title: '能力與極限', en: 'Capability & Limits', blurb: 'Minimum distance 3 與 3 盞燈能撐多長' },
  { id: 'secded', num: '5', title: 'SECDED：修 1 個、偵測 2 個', en: 'Single Error Correction, Double Error Detection', blurb: '多一個 overall parity bit P0：(s, q) 的四種判斷' },
  // ---------------- 代數基礎與 Cyclic Codes (bridges Lesson 1 and Lesson 2; replaces the former optional GF(8) page) ----------------
  { id: 'a-0', num: 'A0', group: 'algebra', title: '概念地圖：為什麼需要抽象代數？', en: 'Concept Map', blurb: '線性代數已經夠用，為什麼還要 g(x)、GF(8)？' },
  { id: 'a-1', num: 'A1', group: 'algebra', title: 'GF(2)：Hamming code 本來的運算', en: 'The Field GF(2)', blurb: '1 + 1 = 0、field、characteristic、Hcᵀ = 0' },
  { id: 'a-2', num: 'A2', group: 'algebra', title: '為什麼需要 GF(8)？', en: 'Why GF(8)?', blurb: '8 個元素 a + bα + cα²，不是 mod 8' },
  { id: 'a-3', num: 'A3', group: 'algebra', title: '建構 GF(8)：irreducible polynomial 與 quotient ring', en: 'Irreducible Polynomial & Quotient Ring', blurb: 'GF(2)[x]/(x³+x+1)，α³ = α + 1' },
  { id: 'a-4', num: 'A4', group: 'algebra', title: 'Primitive element 與 α 的循環', en: 'Primitive Element', blurb: 'α⁷ = 1，七個非零元素一個循環' },
  { id: 'a-5', num: 'A5', group: 'algebra', title: 'Generator polynomial g(x)', en: 'Generator Polynomial', blurb: 'c = mG 與 c(x) = m(x)g(x)' },
  { id: 'a-6', num: 'A6', group: 'algebra', title: 'Cyclic code、quotient ring R₇ 與 ideal', en: 'Cyclic Code, R₇ & Ideal', blurb: '乘以 x = cyclic shift，C = ⟨g(x)⟩' },
  { id: 'a-7', num: 'A7', group: 'algebra', title: 'Frobenius 與 cyclotomic cosets', en: 'Frobenius & Cyclotomic Cosets', blurb: 'α → α² → α⁴ → α' },
  { id: 'a-8', num: 'A8', group: 'algebra', title: 'Minimal polynomial', en: 'Minimal Polynomial', blurb: '(x+α)(x+α²)(x+α⁴) = x³+x+1' },
  { id: 'a-9', num: 'A9', group: 'algebra', title: '用 GF(8) 推導 H 矩陣', en: 'H from GF(8)', blurb: '一條 GF(8) 方程 = 三條 GF(2) 方程' },
  { id: 'a-10', num: 'A10', group: 'algebra', title: 'Syndrome 的 GF(8) 觀點', en: 'Syndrome in GF(8)', blurb: 'S₁ = r(α) = e(α) = αⁱ' },
  // ---------------- Lesson 2 — From Encoding to Error Correction ----------------
  { id: 'l2-1', num: '2-1', lesson: 2, title: '完整編碼與解碼流程', en: 'The Full Pipeline', blurb: '從 u 到 û：每個模組在做什麼' },
  { id: 'l2-2', num: '2-2', lesson: 2, title: 'LFSR 與 generator polynomial', en: 'Linear Feedback Shift Register', blurb: '三個 register 如何算出 x³u(x) mod g(x)' },
  { id: 'l2-3', num: '2-3', lesson: 2, title: '手算 GF(2) 多項式除法', en: 'Polynomial Long Division', blurb: '1001000 ÷ 1011，一步一步 XOR' },
  { id: 'l2-4', num: '2-4', lesson: 2, title: 'Syndrome 計算', en: 'Syndrome Computation', blurb: 'S(x) = r(x) mod g(x) = e(x) mod g(x)' },
  { id: 'l2-5', num: '2-5', lesson: 2, title: 'Syndrome 與錯誤位置的關係', en: 'Syndrome Lookup', blurb: '七種單一錯誤，七個不同的特徵值' },
  { id: 'l2-6', num: '2-6', lesson: 2, title: 'Key equation', en: 'GF(8) & Error Locator Polynomial', blurb: 'S = α⁵，σ(z) = 1 + α⁵z' },
  { id: 'l2-7', num: '2-7', lesson: 2, title: 'Chien search', en: 'Chien Search', blurb: '逐一代入 αʲ 找出 σ(z) 的根' },
  { id: 'l2-8', num: '2-8', lesson: 2, title: 'XOR 錯誤更正與驗證', en: 'XOR Correction & Verification', blurb: 'ĉ = r ⊕ ê，再驗證 ĉ(α) = 0' },
  { id: 'l2-9', num: '2-9', lesson: 2, title: '超過 error-correcting capability：兩個錯誤', en: 'Two Errors: Miscorrection', blurb: '更正後合法，卻是錯的 codeword' },
  { id: 'l2-10', num: '2-10', lesson: 2, title: '超過 error-correcting capability：三個錯誤', en: 'Three Errors: Undetected', blurb: 'Error vector 本身就是 codeword' },
  { id: 'l2-11', num: '2-11', lesson: 2, title: 'SECDED 的補救', en: 'SECDED', blurb: '多一個 overall parity bit，偵測雙錯' },
  { id: 'l2-12', num: '2-12', lesson: 2, title: '小型範例與實際參數的差距', en: 'From GF(8) to GF(128) & 400ZR', blurb: 'Hamming(127,120)、硬體架構與 400ZR FEC' },
  { id: 'l2-13', num: '2-13', lesson: 2, title: '完整互動實驗室', en: 'Hamming Code Playground', blurb: '編碼、注入錯誤、兩種解碼、SECDED' },
  { id: 'l2-14', num: '2-14', lesson: 2, title: '課程總結與測驗', en: 'Summary & Quiz', blurb: '十種題型，每題都有詳細解析' },
];

export const moduleIndex = (id: string) => MODULES.findIndex((m) => m.id === id);
