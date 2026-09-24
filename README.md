# 蒲燒鰻預購網頁 — 使用與上線教學

## 檔案結構

```
unagi-site/
├─ index.html          網頁本體
├─ style.css           樣式（寶藍／紅／淺棕配色）
├─ app.js              購物車、下單、進度條程式
├─ config.js           ★ 平常只要改這個：價格、截止日、Apps Script 網址
├─ images/             網頁圖片
└─ apps-script/Code.gs Google 試算表後端（貼到 Apps Script 用，不影響網頁）
```

## 運作方式

```
顧客選盒數 → 加入購物車 → 按「確定下單」→ 跳出表單填資料 → 送出
   → Apps Script 檢查資料 → 寫入 Google 試算表「訂單」分頁 → 寄確認信
   → 回傳最新總盒數 → 進度條更新
```

- 只有「送出成功」的訂單才會計入，亂按購物車不會影響進度條。
- 試算表「狀態」欄改成「取消」或「重複」，那筆就會自動扣掉。
- 網頁只讀得到「總盒數」，顧客個資只存在你的 Google 試算表，不會公開。

---

## 一、上線前必改（config.js 與 Code.gs 兩邊都要改）

| 項目 | config.js | Code.gs |
|---|---|---|
| 價格 | `price: 599` | `PRODUCTS.gift4.price` |
| 每盒規格 | `spec` | — |
| 成團目標 | `goal: 800` | `GOAL` |
| 截止日 | `deadline` | — |
| 運費／付款說明 | `shippingNote`、`paymentNote` | 確認信文字 `sendConfirm_` |

---

## 二、建立訂單系統（Google 試算表 + Apps Script，約 10 分鐘）

1. 打開 Google 雲端硬碟，新增一個 Google 試算表，命名例如「蒲燒鰻預購訂單」。
2. 上方選單：**擴充功能 → Apps Script**。
3. 把 `apps-script/Code.gs` 的全部內容貼上，覆蓋原本的程式碼，按儲存。
4. 上方函式下拉選 **setup**，按 **執行**。第一次會要求授權：選擇你的帳號 → 「進階」→「前往（不安全）」→ 允許。（這是你自己的程式，所以會出現這個警告。）
   - 執行完回到試算表，會看到「訂單」分頁和標題列。
5. 右上角 **部署 → 新增部署作業**：
   - 類型：**網頁應用程式**
   - 執行身分：**我**
   - 誰可以存取：**所有人**
   - 按「部署」，複製「網頁應用程式網址」（`https://script.google.com/macros/s/…/exec`）
6. 把網址貼到 `config.js` 的 `scriptUrl: "這裡"`。

> 之後如果有修改 Code.gs，要到 **部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新版本」→ 部署**，網址不會變。

**測試：** 瀏覽器直接打開那個網址，看到 `{"ok":true,"total":0,"goal":800}` 就代表成功了。

---

## 三、發布到 GitHub Pages（免費網址）

1. 登入 GitHub → 右上「＋」→ **New repository**
   - Repository name：例如 `unagi`
   - 選 **Public** → Create repository
2. 在新 repo 頁面點 **uploading an existing file**，把 `unagi-site` 資料夾**裡面的所有檔案和 images 資料夾**拖進去（不要拖外層的資料夾本身）→ Commit changes。
3. 到 **Settings → Pages**：
   - Source：**Deploy from a branch**
   - Branch：**main**、資料夾 **/ (root)** → Save
4. 等 1–2 分鐘，網址會是：`https://你的帳號.github.io/unagi/`

之後要改價格或文字：在 GitHub 上點 `config.js` → 鉛筆圖示 → 修改 → Commit，1 分鐘後自動更新。

---

## 四、日常管理

- **看訂單：** 打開 Google 試算表的「訂單」分頁。
- **取消或重複的訂單：** 把「狀態」改成「取消」或「重複」，進度條會自動扣掉。
- **收款與出貨：** 可以把狀態改成「已付款」、「已出貨」（這兩種仍會計入進度）。
- **每筆新訂單都通知你：** 在 Code.gs 的 `OWNER_EMAIL` 填入你的 Email，然後重新部署新版本。
- **Email 寄送上限：** 免費 Gmail 帳號每天約 100 封。如果一天超過 100 筆訂單，確認信會暫停寄送，但訂單照樣會記錄。

## 五、法規提醒

- 網頁已經避開醫療或功效宣稱（依食安法第 28 條），只列營養成分。之後加文案時，請不要寫「壯陽」、「補腎」、「治療」、「養顏美容」這類字眼。
- 檢驗報告依原報告備註，不直接張貼報告影像，只以文字摘要呈現。報告有效期限是 115/09/28，拿到新一期報告後，請更新 `index.html` 裡的報告編號和日期。
- 禮盒主圖已標註「示意圖」。
