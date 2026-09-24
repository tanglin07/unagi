/* =========================================================
 *  網站設定檔 —— 平常只需要改這個檔案
 *  改完存檔、上傳到 GitHub 即生效
 * ========================================================= */
window.SITE_CONFIG = {
  // 1) Apps Script 部署後得到的「網頁應用程式網址」，貼在引號內
  //    留空 = 展示模式（不會真的寫入訂單）
  scriptUrl: "",

  // 2) 成團目標（盒）—— 需與 Apps Script 內的 GOAL 一致
  goal: 800,

  // 3) 預購截止日（YYYY-MM-DD），留空則不顯示倒數
  deadline: "2026-10-31",

  // 4) 商品（價格請務必與 Apps Script 的 PRODUCTS 一致）
  products: [
    {
      id: "gift4",
      name: "外銷級蒲燒鰻禮盒",
      spec: "每盒 4 包真空包裝（每包重量待補）",   // ← 請修改
      price: 1280,                                   // ← 請修改（新台幣）
      image: "images/giftbox.jpg"
    }
  ],

  // 5) 每筆訂單最多可訂盒數
  maxPerOrder: 50,

  // 6) 出貨／付款說明（顯示在預購區與常見問題）
  shippingNote: "成團後約 7–14 天陸續以冷凍宅配出貨，運費另計（待公布）",
  paymentNote: "預購免先付款。成團後我們會以 Email／LINE 通知匯款資訊，確認收款後出貨。",

  // 7) 聯絡方式
  facebookUrl: "https://www.facebook.com/profile.php?id=100063738142128",
  lineUrl: ""   // 若有 LINE 加好友連結（https://line.me/ti/p/...）可填入，手機可直接點
};
