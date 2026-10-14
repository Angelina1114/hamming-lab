# Hamming Lab — Error-Correcting Codes Interactive Playground

一個給大學生的 Hamming Code 互動式教學與實驗平台，分為兩課：第一課（為什麼與線性代數觀點）與第二課（From Encoding to Error Correction：LFSR、Syndrome、GF(8)、Chien Search、SECDED 與報告模式）。從「為什麼需要錯誤更正碼」開始，一路走到 Hamming(7,4)、線性代數（H、G、rank、kernel）、Syndrome 解碼、最小距離、Hamming Bound 與完美碼、Extended Hamming(8,4)，以及 SECDED。

每個模組都依照 **Why → Definition → Calculation → Visualization → Experiment → Conclusion** 的流程設計，所有編碼、解碼與矩陣運算都由獨立的 TypeScript 數學核心即時計算，沒有預先寫死的結果。

## 技術

- React 18 + TypeScript + Vite 5
- Tailwind CSS 3
- KaTeX（數學公式）、framer-motion（動畫）、Recharts（圖表）、lucide-react（圖示）
- Vitest（單元測試）
- 無後端、無資料庫、不需 API Key

## 啟動

需要 Node.js 18 以上（本機以 Homebrew 安裝：`brew install node`）。

```bash
npm install        # 安裝依賴
npm run dev        # 開發伺服器，預設 http://localhost:5173
npm test           # 執行 Vitest 單元測試
npm run build      # 型別檢查 + production build（輸出到 dist/）
npm run preview    # 預覽 production build
```

`dist/` 使用相對路徑（`base: './'`）與 hash 路由，可直接放到任何靜態主機上。

## 專案結構

```
src/
├── core/                 數學核心（與 UI 完全分離，可獨立測試）
│   ├── gf2.ts            GF(2) 運算、向量工具
│   ├── matrix.ts         矩陣乘法、轉置、RREF（記錄每一步列運算）、rank、nullity、kernel basis、span
│   ├── hamming.ts        Hamming(7,4)：位置排列、H、G、同位方程編碼、c = mG、Syndrome 解碼、codeword 列舉
│   ├── extended.ts       Extended Hamming(8,4) 編碼、SECDED 解碼器（四種情況）
│   ├── distance.ts       Hamming distance、窮舉最小距離、最近 codeword 解碼、重量分佈
│   ├── bound.ts          二項式係數、漢明球體積、Hamming Bound、依最近 codeword 分割整個空間
│   ├── gf8.ts            GF(8)（p(x) = x³+x+1）基本乘法、α 次方、GF(2) 多項式運算
│   ├── algebra.ts        代數章：體公理檢查、ℤ/n、商環 GF(2)[x]/(q)、不可約判定與分解、GF(8) 乘法手算追蹤、
│   │                     乘法階、多項式乘法追蹤、G_cyc、R₇ 與理想、Frobenius、Cyclotomic Cosets、
│   │                     最小多項式、由 GF(8) 建 H_cyc、座標排列、長除法 ↔ LFSR 同步步驟
│   ├── cyclic.ts         第二課：MSB-first 系統式循環碼、長除法（含每一步）、LFSR（編碼器/除法器）、
│   │                     Syndrome、查表、錯誤定位多項式、Chien Search、XOR 更正、SECDED(8,4)
│   ├── gfm.ts            通用 GF(2^m)、原根檢查、Hamming(2^m−1) 循環碼（GF(128) / Hamming(127,120)）
│   ├── quiz.ts           第二課測驗產生器（答案與干擾選項皆由演算法計算）
│   └── __tests__/        Vitest 窮舉測試（core.test.ts、lesson2.test.ts）
├── components/           共用 UI：位元方塊、矩陣檢視、Venn 圖、KaTeX、教學流程元件、圖表
│   └── l2/               第二課元件：Stepper（播放/暫停）、章節模板、流程圖、LFSR 電路模擬、
│                         長除法、GF(8) 表、Chien Search、XOR 更正、codeword 集合圖
│   └── alg/              代數章元件：單元模板（Why/What/How/Example/Connection）、相關單元連結、
│                         位元↔多項式編輯器、多項式乘法表、長除法與 LFSR 同步、概念地圖
├── modules/              各章節頁面（Intro、M1–M7）
│   ├── algebra/          代數基礎與循環碼 A0 ~ A10
│   └── lesson2/          第二課 2-1 ~ 2-14 與 Presentation（報告模式）
├── lib/                  章節清單、共用訊息狀態
└── App.tsx               版面（左側章節導覽、行動版抽屜選單）與 hash 路由
```

## 模組與操作方式

| 章節 | 內容 | 主要互動 |
|---|---|---|
| 0 導論 | 為什麼需要冗餘、GF(2)、碼率比較 | 翻轉未編碼訊息；單一同位位元實驗（能偵測不能定位、偶數個錯誤會隱形） |
| 1 Hamming(7,4) 編碼 | `[P1,P2,D1,P4,D2,D3,D4]`、偶同位、三條 XOR 方程 | 點 d1–d4 即時編碼（預設 1011 → 0110011）；覆蓋表與 Venn 圖互相高亮；逐步組裝 codeword；「換你當編碼器」挑戰 |
| 2 矩陣 H 與 G | c = mG、Hcᵀ = 0、HGᵀ = 0；rank / nullity / kernel / basis | 三種乘法即時切換；**GF(2) 線性代數實驗區**：可編輯矩陣、逐步高斯消去、基底、全部 kernel 元素、秩–零度定理 |
| 3 Syndrome 解碼 | r = c + e、s = Hrᵀ = Heᵀ | 點擊接收字翻轉 0–7 個位元；H 欄位掃描動畫；Venn 圖顯示失敗的檢查；誤修正與未偵測的實例；128 種錯誤樣式窮舉統計 |
| 4 最小距離 | d_H、d_min、t = ⌊(d_min−1)/2⌋ | 兩個可編輯字串；16 個 codeword 瀏覽器、16×16 距離矩陣、距離分佈圖、A→B 最短路徑；最近 codeword 解碼並與 Syndrome 解碼比對 |
| 5 Hamming Bound | V₂(n,t)、2ᵏV₂(n,t) ≤ 2ⁿ、完美碼 | n/k/t 滑桿；**真正的 128 字串分組**（16 組 × 8，驗證不重疊且完全覆蓋）；「依數值排列」視圖避免把漢明球誤解成圓；可切換 Extended(8,4) 看到 112 個平手字串 |
| 6 Extended(8,4) | 整體同位 P0、[7,4,3] → [8,4,4] | 即時延伸編碼；兩種 code 的重量分佈；16 個 codeword 並排；窮舉 d_min = 4；比較總表；證明 |
| 7 SECDED | (s, q) 四種判斷 | 決策表與 2×2 決策平面；預設情境（單錯、P0 錯、雙錯、三錯）；**Hamming(7,4) / Extended(8,4) / 並排比較** 模式；256 與 128 種錯誤的窮舉統計 |

共用操作：

- 方塊狀的位元都可點擊翻轉。藍色 = 資訊位元，橘色 = 同位位元，紫色 = 整體同位位元，紅色 = 被通道翻轉，綠色 = 解碼器修正。
- 每個實驗都有「重設範例」按鈕；模組 1、2、3、6、7 共用同一組訊息（預設 1011），左側欄底部隨時顯示。
- 「逐步數學推導」可用「上一步 / 下一步」逐步展開；定義與證明放在可展開區塊中。
- 頁首的流程列可以跳到 Why / Definition / … / Conclusion，並標示目前所在的階段。

## 代數基礎與循環碼（A0 ~ A10）

位於第一課與第二課之間，回答「線性代數已經能處理 Hamming Code，為什麼還需要 Generator Polynomial、GF(8)、Cyclic Code 與 Minimal Polynomial？」。原本的「進階：GF(8) 與循環碼」選修頁已併入本章（舊網址 `#/advanced` 會自動導向 A0）。每個單元依 **Why → What → How → Example → Connection** 排列，含白話解釋、定義、逐步手算（上一步／下一步／重設）、可修改的輸入、程式即時驗證、相關單元連結與常見錯誤觀念。

| 單元 | 互動工具 |
|---|---|
| A0 概念地圖 | 可點擊的概念關係圖；一個例子（u、錯誤位置可改）走完整章 |
| A1 GF(2) | GF(2) 計算器（加、減、乘，整數→mod 2）；體公理窮舉檢查；特徵 = 2 動畫；Hcᵀ = 0 逐列 mod 2 計算 |
| A2 為什麼需要 GF(8) | 8 個元素的二進位 ↔ 多項式表；GF(8) 與 ℤ/8 乘法表比較（零因子、反元素）；H 的 7 欄 = 7 個非零元素 |
| A3 不可約多項式・商環 | 8 個三次多項式取商的實驗（是否為體、零因子）；GF(8) 計算器：αᵏ 化簡、加法、乘法（展開→合併→化簡）、多項式取餘數 |
| A4 本原元素 | α 次方循環動畫（可換底數）；每個元素的乘法階；GF(16) 中「不可約但非本原」的對照 |
| A5 生成多項式 | Bit ↔ Polynomial Converter；m(x)g(x) 的部分積／同類項／mod 2 逐步表；由 x³g, x²g, xg, g 建 G_cyc；與第一課 G 的區別；系統式 vs 非系統式編碼（同一個 code、不同對應） |
| A6 循環碼・R₇・理想 | 「乘上 x」循環位移動畫（x⁷ ≡ 1 繞回）；任意 r(x) × codeword mod (x⁷−1) 仍是 codeword；加法封閉 |
| A7 Frobenius・陪集 | Frobenius 表與 (a+b)² = a²+b² 驗證；i → 2i mod 7 陪集互動圖；c(αʲ) 表；x + α 反例 |
| A8 最小多項式 | 選任一元素：共軛、陪集、在 GF(8) 中逐步乘開化簡、根驗證；x⁷−1 = (x+1)(x³+x+1)(x³+x²+1) 驗算 |
| A9 GF(8) 推導 H | 逐欄建立 H_cyc；c(α) 與 H_cyc cᵀ 並排；H_cyc G_cycᵀ = 0；與第一課 H 的座標排列 |
| A10 Syndrome 的 GF(8) 觀點 | 選 codeword 與錯誤位置：S₁ = r(α) 逐項計算、= e(α) = αⁱ、由指數找位置；σ(z)、Chien Search、XOR 修正交給第二課 2-6 ~ 2-8 |

第一課的「矩陣 H 與 G」「Syndrome」以及第二課 2-1 ~ 2-8 都加上了通往本章的連結；第二課 2-3 新增「同步對照（老師的 LFSR）」檢視。

**避免重複的分工**：每個觀念只完整教一次，其他地方用連結回去——第一課學「是什麼」，代數章學「為什麼」，第二課學「怎麼算」。例如 GF(8) 的建構只在 A3、A4（2-6 只留速查表）；LFSR 的「為什麼」與同步演示在 2-2、2-3；SECDED 的理論在 M7（2-11 只講循環碼上的實作與旗標）；Syndrome 的三種寫法（矩陣／多項式／GF(8)）在 2-4 有對照表。舊網址 `#/a-11` 會導向 A10。

## 第二課：From Encoding to Error Correction

每一章都依「學習目標 → 直觀概念 → 數學原理 → 逐步演算法 → 互動範例 → 結果驗證 → 下一章」排列，並附「自動驗證」區塊（由程式即時計算，非寫死）。

| 章節 | 主要互動 |
|---|---|
| 2-1 完整流程 | 17 個模組的互動流程圖（含 SECDED、Overall Parity、Buffer、Error Flag）；點擊看說明、逐步播放、暫停、重設；顯示目前資料與運算 |
| 2-2 LFSR | R₂R₁R₀ 電路圖，每個時脈分 4 階段（讀入、feedback、左移 = ×x、XOR 回授）；x³ ≡ x + 1 圖解；預乘式編碼器 / 除法器切換 |
| 2-3 長除法 | 1001000 ÷ 1011 逐步 XOR；二進位 ↔ 多項式；Long Division View / LFSR View / 逐步比較 |
| 2-4 Syndrome | r(x) ÷ g(x) 與 e(x) ÷ g(x) 並排；S(x) = e(x) mod g(x) 完整證明 |
| 2-5 查表 | 點擊製造單一錯誤；七列查表；「S 讀成二進位數 ≠ 位置」；改變位元順序後整張表改變 |
| 2-6 Key Equation | GF(8) 元素表逐列推導；二進位餘數 / GF(8) 元素 / σ(z) 三者並列區分 |
| 2-7 Chien Search | 逐一代入 α⁰…α⁶；Lookup 與 Chien 兩種模式結果一致；成本比較 |
| 2-8 XOR 更正 | 逐位 XOR 動畫、ĉ(α) 逐項驗證、還原訊息比較 |
| 2-9 / 2-10 | 雙錯誤更正（Miscorrection）與三錯未偵測（Undetected）；21 / 35 種錯誤窮舉表；codeword 集合圖 |
| 2-11 SECDED | 四種情況、雙錯不更正並保留資料、Uncorrectable / Error Detected 旗標 |
| 2-12 實際參數 | GF(8) vs GF(128)、Hamming(127,120) 即時運算、串列/平行硬體成本、400ZR CFEC 延伸（軟判決內碼與教學範例區分） |
| 2-13 Playground | 輸入訊息、LFSR / 除法、0–3 個錯誤、查表 / Key Equation / Chien、XOR 驗證、SECDED、即時摘要 |
| 2-14 測驗 | 十種題型，每題含正確答案、詳解、每個錯誤選項的原因與對應章節；可「換一組題目」 |

### 報告模式 Presentation Mode（`#/present`）

16 張投影片沿用網站元件、放大字體並依螢幕自動縮放。`→`／空白鍵：下一步（動畫走完自動換頁）、`←`：上一步、`P`：播放/暫停、`F`：全螢幕、`Home`/`End`。上方可切換範例（無錯 / 單錯 / 雙錯 / 三錯）、訊息、Lookup/Chien、SECDED，並可直接點擊位元注入錯誤。

### 關於 LFSR 規則與輸入（重要說明）

課程規格中的 LFSR 規則（feedback = input ⊕ R₂；R₂′ = R₁、R₁′ = R₀ ⊕ fb、R₀′ = fb）是**預乘式編碼器**：輸入已在 x³ 的位置，應只輸入訊息 u = 1001，狀態為 000 → 011 → 110 → 111 → **110**（= 檢查碼）。若把補零後的 1001000 全部送入同一電路，第 5–7 步為 111 → 101 → **001**（= x³·x³u(x) mod g(x)），不是檢查碼。要輸入 1001000，需使用**除法器**接法（輸入從 R₀ 端進入），其狀態為 000 → 001 → 010 → 100 → 010 → 100 → 011 → **110**。兩種接法都實作並有測試，2-2 章提供切換與「多送三個 0」的實驗。

## 座標慣例（重要）

- 模組 1–7：標準位置排列 `[P1, P2, D1, P4, D2, D3, D4]`（Extended 版本在第 8 位附加 P0）。H 的第 j 欄是 j 的二進位、最低位在上。
- **第二課**：位元字串為 MSB-first——最左邊是最高次項；7 位元字串中從左數第 p 個 bit 是 x^(7−p) 的係數（位置 2 = x⁵）。系統碼 c = u ‖ p，訊息在最左 4 位。GF(8) 元素以 (α² α 1) 三位元表示。每一章頂部都有提示列。
- **代數章**：與第二課相同（最左邊 = x⁶）。G_cyc 的列為 x³g, x²g, xg, g；H_cyc 第 k 欄為 α^(6−k) 的 (α², α, 1) 係數。循環碼與第一課的標準排列只差一個座標排列：位置 x^(6−k) ↦ 第一課位置 int(α^(6−k))（A9 實際計算並驗證）。兩套矩陣不可混用。

## 測試

共 119 個測試（`npm test`）。`core.test.ts` 44 個（第一課）、`algebra.test.ts` 44 個（代數章）、`lesson2.test.ts` 31 個（第二課）。

代數章測試（皆窮舉、獨立計算，不比對實作自己的輸出）：GF(2) 運算為 mod 2；GF(2) 與 GF(8) 滿足全部體公理、ℤ/8 不是體；8 個三次多項式中恰好 x³+x+1、x³+x²+1 不可約，且商環為體 ⇔ 不可約；α³ = α+1、α⁷ = 1、乘法階 7、次方表；乘法追蹤 = 查表乘法 = 對數乘法（64 組）；每個非零元素有反元素；g | x⁷−1；循環位移 = 乘 x mod x⁷−1；C 是理想（128 × 16 組乘積皆為 codeword）；Frobenius 為自同構；陪集 {0}{1,2,4}{3,6,5}；最小多項式與 x⁷−1 分解；H_cyc 的每欄 = x^(6−k) mod g(x)；H_cyc G_cycᵀ = 0；128 個字中 c(α) = 0 ⇔ H_cyc cᵀ = 0；mG_cyc = m(x)g(x)；座標排列後為第一課 codeword；同步長除法的每一步 = LFSR 每個時脈（16 個訊息）；Chien Search 定位 16 × 7 種單錯。

第二課測試（皆實際執行演算法、窮舉驗證）：

- 教學範例全部數值：1001000 mod 1011 = 110、c = 1001110、S(1101110) = 111 = α⁵、σ(z) = 1 + α⁵z、根 α²、i = 5、ĉ = 1001110、ĉ(α) = 0；雙錯 1101111 → S = 110 = α⁴ → 1111111；三錯 e = 0001011 = g → S = 000、û = 1000
- 長除法：全部 128 個 7 位元被除數滿足 q·g + r = a
- LFSR：預乘式 / 除法器兩種接法的每一步狀態都等於對應的餘數；16 種訊息皆與長除法一致
- 16 種訊息 × 7 種單錯（Lookup 與 Chien 都正確且一致）、× 21 種雙錯（全部誤更正）、× 35 種三錯（每個 codeword 7 種未偵測、28 種誤更正）
- 查表 = 101,111,110,011,100,010,001；GF(8) 表 = 001,010,100,011,110,111,101
- SECDED(8,4)：16 × 8 種單錯全部更正（含總同位位元）；16 × 28 種雙錯全部判為雙錯、設旗標、保留資料；三錯存在誤判
- GF(128)：x⁷ + x³ + 1 為原根多項式；Hamming(127,120) 在隨機 codeword 上 127 個位置的單錯全部更正；參數與 Code Rate
- 測驗：60 組種子 × 10 題型，每題恰一個正確答案、四個不同選項、每個選項都有解析

第一課測試以窮舉方式驗證，包含：

- 16 個 Hamming(7,4) codeword 皆滿足 Hcᵀ = 0，且同位方程編碼與 c = mG 一致
- HGᵀ = 0；rank(H) = 3、nullity(H) = 4、|ker H| = 16，kernel 與暴力列舉結果相同；所有 2×3 二元矩陣滿足秩–零度定理
- Hamming(7,4) 最小距離 = 3（全部 120 對）；重量分佈 1,0,0,7,7,0,0,1
- 16 × 7 = 112 種單一錯誤全部正確修正；所有雙重錯誤都被誤修正（說明其限制）；7 種重量 3 錯誤無法偵測
- 最近 codeword 解碼與 Syndrome 解碼在全部 128 個字串上一致
- Hamming(7,4) 達到 Hamming Bound 等號；128 個字串恰好分成 16 組 × 8 個；Golay [23,12,7] 也達到等號；Extended(8,4) 不是完美碼
- Extended(8,4) 最小距離 = 4；16 × 8 種單一錯誤（含 P0）全部修正；16 × 28 = 448 種雙重錯誤全部被分類為「偵測到雙重錯誤」；三重錯誤會發生誤判
- GF(8)：α 的 7 個冪次是全部非零元素、對數乘法與多項式乘法一致；循環碼在兩種編碼器下 c(α) = 0、在循環移位下封閉、d_min = 3、單一錯誤可由 r(α) 定位；經座標置換後與標準 Hamming Code相同，未置換則不同

## 尚未實作 / 限制

- BCH Code（依需求暫不實作；2-6、2-7 只說明 t = 1 時的 Key Equation 與 Chien Search）。
- 400ZR 章節為概念介紹，參數引用公開的業界簡報（IEEE 802.3 B10K 2018、Lightwave），並未實作軟判決 Chase 解碼。
- 無深色模式與多語系；介面為繁體中文並附英文術語。
- Hamming Bound 計算器的 n 上限為 24（數值以 JavaScript number 計算）。
