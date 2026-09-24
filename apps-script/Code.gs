/**
 * 蒲燒鰻預購 — Google Apps Script 後端
 * 功能：接收網頁訂單 → 寫入試算表「訂單」分頁；回傳目前有效盒數給進度條
 *
 * 安裝步驟請看 README.md「二、建立訂單系統」
 */

// ====== 設定（請與網頁 config.js 保持一致）======
var GOAL = 800;                 // 成團目標盒數
var MAX_PER_ORDER = 50;         // 每筆最多盒數
var PRODUCTS = {                // 商品編號: { 名稱, 單價 } —— 價格以這裡為準
  gift4: { name: "Oishi 外銷級蒲燒鰻", price: 599 }
};
var SEND_CONFIRM_EMAIL = true;  // 是否寄確認信給顧客
var OWNER_EMAIL = "";           // 若想每筆新訂單都收到通知，填你的 Email
var SHOP_NAME = "Oishi 蒲燒鰻魚";
var SHEET_NAME = "訂單";
var HEADERS = ["下單時間", "訂單編號", "姓名", "手機", "Email", "收件地址", "到貨時段", "商品明細", "盒數", "金額", "備註", "狀態"];
// 「狀態」欄：預設「有效」；改成「取消」或「重複」就不會計入進度條

// ====== 第一次請先執行這個函式（建立工作表與標題列）======
function setup() {
  var sh = getSheet_();
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight("bold").setBackground("#101c40").setFontColor("#e8d9bf");
  sh.setFrozenRows(1);
  var rule = SpreadsheetApp.newDataValidation().requireValueInList(["有效", "已付款", "已出貨", "取消", "重複"], true).build();
  sh.getRange(2, 12, 1000, 1).setDataValidation(rule);
}

// ====== 網頁讀取進度 ======
function doGet(e) {
  return json_({ ok: true, total: getTotal_(), goal: GOAL });
}

// ====== 網頁送出訂單 ======
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var d = JSON.parse((e && e.postData && e.postData.contents) || "{}");

    // 防機器人：隱藏欄位有值就假裝成功但不寫入
    if (d.website) return json_({ ok: true, orderId: "OK", total: getTotal_() });

    var name = clean_(d.name, 30), phone = String(d.phone || "").replace(/[\s-]/g, ""),
        email = clean_(d.email, 80), address = clean_(d.address, 120),
        timeslot = clean_(d.timeslot, 20), note = clean_(d.note, 200);

    if (!name) return fail_("請填寫姓名");
    if (!/^09\d{8}$/.test(phone)) return fail_("手機格式不正確");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail_("Email 格式不正確");
    if (address.length < 6) return fail_("請填寫完整收件地址");

    var items = Array.isArray(d.items) ? d.items : [];
    var boxes = 0, amount = 0, detail = [];
    items.forEach(function (it) {
      var p = PRODUCTS[it.id]; var q = parseInt(it.qty, 10);
      if (!p || !(q > 0)) return;
      boxes += q; amount += q * p.price; detail.push(p.name + " × " + q);
    });
    if (boxes < 1) return fail_("購物車沒有商品");
    if (boxes > MAX_PER_ORDER) return fail_("每筆訂單最多 " + MAX_PER_ORDER + " 盒，大量訂購請私訊我們");

    // 同一支手機 60 秒內不能重複送出（避免連點）
    var cache = CacheService.getScriptCache();
    if (cache.get("p_" + phone)) return fail_("您剛剛已送出訂單，請勿重複送出");

    lock.waitLock(20000);
    var sh = getSheet_();
    var now = new Date();
    var orderId = "UN" + Utilities.formatDate(now, "Asia/Taipei", "MMdd") + "-" + ("000" + sh.getLastRow()).slice(-4);
    sh.appendRow([
      Utilities.formatDate(now, "Asia/Taipei", "yyyy/MM/dd HH:mm:ss"), orderId, name, "'" + phone, email,
      address, timeslot, detail.join("；"), boxes, amount, note, "有效"
    ]);
    SpreadsheetApp.flush();
    cache.put("p_" + phone, "1", 60);
    var total = getTotal_();
    lock.releaseLock();

    try { if (SEND_CONFIRM_EMAIL) sendConfirm_(email, name, orderId, detail, boxes, amount, total); } catch (err) {}
    try { if (OWNER_EMAIL) MailApp.sendEmail(OWNER_EMAIL, "【新訂單】" + orderId + " " + name + " " + boxes + " 盒",
      "目前累計 " + total + " / " + GOAL + " 盒\n\n" + name + " " + phone + "\n" + address + "\n" + detail.join("\n") + "\n備註：" + note); } catch (err) {}

    return json_({ ok: true, orderId: orderId, total: total });
  } catch (err) {
    return fail_("系統忙碌，請稍後再試");
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ====== 工具函式 ======
function getTotal_() {
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var rows = sh.getRange(2, 9, last - 1, 4).getValues(); // 盒數(I)…狀態(L)
  return rows.reduce(function (s, r) {
    var st = String(r[3]).trim();
    return (st === "取消" || st === "重複") ? s : s + (Number(r[0]) || 0);
  }, 0);
}
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}
function clean_(v, max) {
  var s = String(v == null ? "" : v).trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s; // 防止試算表公式注入
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(msg) { return json_({ ok: false, error: msg }); }

function sendConfirm_(email, name, orderId, detail, boxes, amount, total) {
  var body =
    name + " 您好：\n\n感謝您預購我們的蒲燒鰻！以下是您的預購資料：\n\n" +
    "訂單編號：" + orderId + "\n" + detail.join("\n") + "\n共 " + boxes + " 盒，金額 NT$ " + amount.toLocaleString() + "（運費自付）\n\n" +
    "目前團購進度：" + total + " / " + GOAL + " 盒\n" +
    "滿 " + GOAL + " 盒成團後，我們會再寄信通知付款（可刷卡或匯款）與出貨時間；預購期間不需先付款。\n\n" +
    "如需修改或取消，請回覆此信或私訊我們的 LINE / 臉書，並附上訂單編號。\n\n" + SHOP_NAME + " 敬上";
  MailApp.sendEmail({ to: email, subject: "【" + SHOP_NAME + "】預購確認 " + orderId, body: body, name: SHOP_NAME });
}
