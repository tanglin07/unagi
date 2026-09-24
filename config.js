/* =========================================================
 *  網站設定檔 —— 平常只需要改這個檔案
 *  改完存檔、上傳到 GitHub 即生效
 * ========================================================= */
window.SITE_CONFIG = {
  // 1) Apps Script 部署後得到的「網頁應用程式網址」，貼在引號內
  //    留空 = 展示模式（不會真的寫入訂單）
  scriptUrl: "https://script.google.com/macros/s/AKfycbz_kfy3z_U-EAjUyze20uAWbH7mQEFhClTE1O7X1Cwnus2GwMB_ydZDGDclVMqUPJKA/exec",

  // 2) 成團目標（盒）—— 需與 Apps Script 內的 GOAL 一致
  goal: 800,

  // 3) 預購截止日（YYYY-MM-DD），留空則不顯示倒數
  deadline: "2026-11-30",

  // 4) 商品（價格請務必與 Apps Script 的 PRODUCTS 一致）
  products: [
    {
      id: "gift4",
      name: "Oishi 外銷級蒲燒鰻",
      spec: "每盒 1 片，每片約 160g（±25g），真空包裝",
      price: 599,
      image: "images/giftbox.jpg"
    }
  ],

  // 5) 每筆訂單最多可訂盒數
  maxPerOrder: 50,

  // 6) 出貨／付款說明（顯示在預購區與常見問題）
  shippingNote: "成團後約 7–14 天陸續以冷凍宅配出貨，運費由買家自付",
  paymentNote: "預購免先付款。成團後我們會以 Email／LINE 通知付款，可選擇信用卡刷卡或銀行匯款，確認收款後出貨。",

  // 7) 聯絡方式
  facebookUrl: "https://www.facebook.com/profile.php?id=100063738142128",
  lineUrl: ""   // 若有 LINE 加好友連結（https://line.me/ti/p/...）可填入，手機可直接點
};
