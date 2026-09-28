/**
 * Oishi 蒲燒鰻預購 — Google Apps Script 後端（v5 出貨版）
 * 功能：接收網頁訂單 → 寫入試算表「訂單」分頁；回傳目前有效盒數給進度條
 *      試算表上方選單「出貨工具」可一鍵產生出貨清單、祝福卡清單
 *
 * 更新方式：貼上本檔 → 儲存 → 執行 setup（一次）→ 部署 › 管理部署作業 › 編輯 › 新版本 › 部署
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
var TZ = "Asia/Taipei";

// ====== 欄位（出貨人員只要看「收件」那幾欄）======
var COLS = [
  ["下單時間", 140], ["訂單編號", 110], ["狀態", 80], ["盒數", 55], ["金額", 75],
  ["類型", 60],                                        // 自用 / 送禮
  ["收件人", 90], ["收件人電話", 110], ["收件地址", 280], ["到貨時段", 110],
  ["祝福卡內容", 260], ["卡片已寫", 70],
  ["訂購人", 90], ["訂購人手機", 110], ["訂購人Email", 190], ["備註", 180],
  ["付款日期", 95], ["出貨日期", 95], ["物流單號", 130]
];
var C = {}; COLS.forEach(function (c, i) { C[c[0]] = i + 1; });   // 欄名 → 欄號
var STATUS = ["待付款", "已付款", "已出貨", "取消", "重複"];         // 取消、重複不計入進度條

// ====== 試算表選單 ======
function onOpen() {
  SpreadsheetApp.getUi().createMenu("出貨工具")
    .addItem("產生出貨清單（已付款未出貨）", "makeShipList")
    .addItem("產生祝福卡清單（未寫）", "makeCardList")
    .addSeparator()
    .addItem("重新套用格式", "setup")
    .addToUi();
}

// ====== 建立／更新工作表（舊版欄位會自動封存）======
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  var headers = COLS.map(function (c) { return c[0]; });
  if (sh && sh.getLastRow() > 0) {
    var cur = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].join("|");
    if (cur !== headers.join("|")) {
      sh.setName(SHEET_NAME + "_舊版_" + Utilities.formatDate(new Date(), TZ, "MMdd_HHmm"));
      sh = null;
    }
  }
  if (!sh) { sh = ss.insertSheet(SHEET_NAME, 0); }

  sh.getRange(1, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold").setBackground("#101c40").setFontColor("#e8d9bf").setVerticalAlignment("middle");
  sh.setRowHeight(1, 32);
  sh.setFrozenRows(1); sh.setFrozenColumns(2);
  COLS.forEach(function (c, i) { sh.setColumnWidth(i + 1, c[1]); });
  // 收件區塊用紅色標頭，出貨時一眼找到
  sh.getRange(1, C["收件人"], 1, 6).setBackground("#b3262b").setFontColor("#ffffff");

  var max = Math.max(sh.getMaxRows(), 1000);
  if (sh.getMaxRows() < max) sh.insertRowsAfter(sh.getMaxRows(), max - sh.getMaxRows());
  var body = function (col) { return sh.getRange(2, col, max - 1, 1); };

  body(C["狀態"]).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(STATUS, true).build());
  body(C["類型"]).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["自用", "送禮"], true).build());
  body(C["卡片已寫"]).insertCheckboxes();
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(false).build();
  body(C["付款日期"]).setDataValidation(dateRule).setNumberFormat("yyyy/mm/dd");
  body(C["出貨日期"]).setDataValidation(dateRule).setNumberFormat("yyyy/mm/dd");
  body(C["金額"]).setNumberFormat("#,##0");
  body(C["收件地址"]).setWrap(true); body(C["祝福卡內容"]).setWrap(true); body(C["備註"]).setWrap(true);
  sh.getRange(2, 1, max - 1, headers.length).setVerticalAlignment("top");

  // 依狀態上色：整列
  var all = sh.getRange(2, 1, max - 1, headers.length);
  var colL = columnLetter_(C["狀態"]), colT = columnLetter_(C["類型"]);
  var rules = [
    ["=$" + colL + "2=\"待付款\"", "#fff6d8", null, false],
    ["=$" + colL + "2=\"已付款\"", "#e4ecfb", null, false],
    ["=$" + colL + "2=\"已出貨\"", "#e3f3e6", null, false],
    ["=OR($" + colL + "2=\"取消\",$" + colL + "2=\"重複\")", "#eeeeee", "#9a9a9a", true]
  ].map(function (r) {
    var b = SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied(r[0]).setBackground(r[1]).setRanges([all]);
    if (r[2]) b.setFontColor(r[2]); if (r[3]) b.setStrikethrough(true);
    return b.build();
  });
  // 送禮訂單：類型欄標紅
  rules.unshift(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=$" + colT + "2=\"送禮\"")
    .setBackground("#b3262b").setFontColor("#ffffff").setBold(true).setRanges([body(C["類型"])]).build());
  sh.setConditionalFormatRules(rules);

  if (sh.getFilter()) sh.getFilter().remove();
  sh.getRange(1, 1, max, headers.length).createFilter();
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
    if (d.website) return json_({ ok: true, orderId: "OK", total: getTotal_() }); // 防機器人

    var name = clean_(d.name, 30), phone = String(d.phone || "").replace(/[\s-]/g, ""),
        email = clean_(d.email, 80), address = clean_(d.address, 120),
        timeslot = clean_(d.timeslot, 20), note = clean_(d.note, 200);
    if (!name) return fail_("請填寫姓名");
    if (!/^09\d{8}$/.test(phone)) return fail_("手機格式不正確");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail_("Email 格式不正確");
    if (address.length < 6) return fail_("請填寫完整收件地址");

    var gift = d.gift === true;
    var rName = gift ? clean_(d.recipientName, 30) : name;       // 自用時收件人＝訂購人
    var rPhone = gift ? String(d.recipientPhone || "").replace(/[\s-]/g, "").slice(0, 12) : phone;
    var cardMsg = gift ? clean_(d.cardMsg, 60) : "";
    if (gift && !rName) return fail_("請填寫收禮人姓名");
    if (gift && !/^0\d{7,9}$/.test(rPhone)) return fail_("收禮人電話格式不正確");

    var items = Array.isArray(d.items) ? d.items : [];
    var boxes = 0, amount = 0, detail = [];
    items.forEach(function (it) {
      var p = PRODUCTS[it.id]; var q = parseInt(it.qty, 10);
      if (!p || !(q > 0)) return;
      boxes += q; amount += q * p.price; detail.push(p.name + " × " + q);
    });
    if (boxes < 1) return fail_("購物車沒有商品");
    if (boxes > MAX_PER_ORDER) return fail_("每筆訂單最多 " + MAX_PER_ORDER + " 盒，大量訂購請私訊我們");

    var cache = CacheService.getScriptCache();
    if (cache.get("p_" + phone)) return fail_("您剛剛已送出訂單，請勿重複送出");

    lock.waitLock(20000);
    var sh = getSheet_();
    var now = new Date();
    var seq = Number(PropertiesService.getScriptProperties().getProperty("seq") || 0) + 1;
    PropertiesService.getScriptProperties().setProperty("seq", String(seq));
    var orderId = "UN" + Utilities.formatDate(now, TZ, "MMdd") + "-" + ("000" + seq).slice(-4);

    var row = new Array(COLS.length).fill("");
    row[C["下單時間"] - 1] = Utilities.formatDate(now, TZ, "yyyy/MM/dd HH:mm");
    row[C["訂單編號"] - 1] = orderId;
    row[C["狀態"] - 1] = "待付款";
    row[C["盒數"] - 1] = boxes;
    row[C["金額"] - 1] = amount;
    row[C["類型"] - 1] = gift ? "送禮" : "自用";
    row[C["收件人"] - 1] = rName;
    row[C["收件人電話"] - 1] = "'" + rPhone;
    row[C["收件地址"] - 1] = address;
    row[C["到貨時段"] - 1] = timeslot;
    row[C["祝福卡內容"] - 1] = cardMsg;
    row[C["卡片已寫"] - 1] = false;
    row[C["訂購人"] - 1] = name;
    row[C["訂購人手機"] - 1] = "'" + phone;
    row[C["訂購人Email"] - 1] = email;
    row[C["備註"] - 1] = note;
    sh.getRange(nextRow_(sh), 1, 1, row.length).setValues([row]);
    SpreadsheetApp.flush();
    cache.put("p_" + phone, "1", 60);
    var total = getTotal_();
    lock.releaseLock();

    try { if (SEND_CONFIRM_EMAIL) sendConfirm_(email, name, orderId, detail, boxes, amount, total, gift ? { name: rName, address: address, msg: cardMsg } : null); } catch (err) {}
    try { if (OWNER_EMAIL) MailApp.sendEmail(OWNER_EMAIL, "【新訂單】" + orderId + (gift ? "（送禮）" : "") + " " + name + " " + boxes + " 盒",
      "目前累計 " + total + " / " + GOAL + " 盒\n\n收件：" + rName + " " + rPhone + "\n" + address + "\n" + detail.join("\n") +
      (cardMsg ? "\n祝福卡：" + cardMsg : "") + "\n備註：" + note); } catch (err) {}

    return json_({ ok: true, orderId: orderId, total: total });
  } catch (err) {
    return fail_("系統忙碌，請稍後再試");
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

// ====== 出貨工具 ======
function readOrders_() {
  var sh = getSheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, COLS.length).getValues().filter(function (r) { return r[C["訂單編號"] - 1]; });
}
function writeList_(name, headers, rows, note) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  sh.clear();
  sh.getRange(1, 1).setValue(note + "（產生時間 " + Utilities.formatDate(new Date(), TZ, "yyyy/MM/dd HH:mm") + "，共 " + rows.length + " 筆）").setFontColor("#555555");
  sh.getRange(2, 1, 1, headers.length).setValues([headers]).setFontWeight("bold").setBackground("#101c40").setFontColor("#e8d9bf");
  if (rows.length) sh.getRange(3, 1, rows.length, headers.length).setValues(rows).setVerticalAlignment("top").setWrap(true);
  sh.setFrozenRows(2);
  headers.forEach(function (h, i) { sh.setColumnWidth(i + 1, h === "收件地址" || h === "祝福卡內容" ? 280 : 110); });
  ss.setActiveSheet(sh);
}
function makeShipList() {
  var rows = readOrders_().filter(function (r) { return r[C["狀態"] - 1] === "已付款" && !r[C["出貨日期"] - 1]; })
    .map(function (r) {
      return [r[C["訂單編號"] - 1], r[C["收件人"] - 1], "'" + r[C["收件人電話"] - 1], r[C["收件地址"] - 1], r[C["盒數"] - 1],
              r[C["到貨時段"] - 1], r[C["類型"] - 1], r[C["祝福卡內容"] - 1] ? "要附卡" : "", r[C["備註"] - 1]];
    });
  writeList_("出貨清單", ["訂單編號", "收件人", "收件人電話", "收件地址", "盒數", "到貨時段", "類型", "祝福卡", "備註"], rows,
    "狀態＝已付款、尚未填出貨日期的訂單");
}
function makeCardList() {
  var rows = readOrders_().filter(function (r) {
      var st = r[C["狀態"] - 1];
      return r[C["祝福卡內容"] - 1] && r[C["卡片已寫"] - 1] !== true && st !== "取消" && st !== "重複";
    }).map(function (r) {
      return [r[C["訂單編號"] - 1], r[C["收件人"] - 1], r[C["祝福卡內容"] - 1], r[C["訂購人"] - 1], r[C["狀態"] - 1]];
    });
  writeList_("祝福卡清單", ["訂單編號", "收件人（卡片抬頭）", "祝福卡內容", "署名（訂購人）", "狀態"], rows,
    "有祝福卡、尚未勾「卡片已寫」的訂單");
}

// ====== 工具函式 ======
function getTotal_() {
  var sh = getSheet_(), last = sh.getLastRow();
  if (last < 2) return 0;
  var st = sh.getRange(2, C["狀態"], last - 1, 1).getValues();
  var bx = sh.getRange(2, C["盒數"], last - 1, 1).getValues();
  return st.reduce(function (s, r, i) {
    var v = String(r[0]).trim();
    return (v === "取消" || v === "重複") ? s : s + (Number(bx[i][0]) || 0);
  }, 0);
}
// 找「訂單編號」欄最後一筆的下一列（勾選框欄會讓 appendRow 跑到最底，所以不用 appendRow）
function nextRow_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return 2;
  var ids = sh.getRange(2, C["訂單編號"], last - 1, 1).getValues();
  var r = ids.length;
  while (r > 0 && !ids[r - 1][0]) r--;
  var target = r + 2;
  if (target > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 200);
  return target;
}
// 刪除測試訂單（訂購人含「測試訂單」）並把訂單流水號歸零；正式開賣前執行一次
function cleanupTestOrders() {
  var sh = getSheet_(), last = sh.getLastRow();
  if (last >= 2) {
    var v = sh.getRange(2, C["訂購人"], last - 1, 1).getValues();
    for (var i = v.length - 1; i >= 0; i--) if (String(v[i][0]).indexOf("測試訂單") > -1) sh.deleteRow(i + 2);
  }
  PropertiesService.getScriptProperties().setProperty("seq", "0");
}
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
}
function columnLetter_(n) { var s = ""; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - m - 1) / 26; } return s; }
function clean_(v, max) {
  var s = String(v == null ? "" : v).trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s; // 防止試算表公式注入
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function fail_(msg) { return json_({ ok: false, error: msg }); }

function sendConfirm_(email, name, orderId, detail, boxes, amount, total, giftInfo) {
  var giftTxt = giftInfo ? ("送禮對象：" + giftInfo.name + "\n寄送地址：" + giftInfo.address + "\n祝福卡：" + (giftInfo.msg || "（無）") + "\n\n") : "";
  var body =
    name + " 您好：\n\n感謝您預購我們的蒲燒鰻！以下是您的預購資料：\n\n" +
    "訂單編號：" + orderId + "\n" + giftTxt + detail.join("\n") + "\n共 " + boxes + " 盒，金額 NT$ " + amount.toLocaleString() + "（運費自付）\n\n" +
    "目前團購進度：" + total + " / " + GOAL + " 盒\n" +
    "滿 " + GOAL + " 盒成團後，我們會再寄信通知付款（可刷卡或匯款）與出貨時間；預購期間不需先付款。\n\n" +
    "如需修改或取消，請回覆此信或私訊我們的 LINE / 臉書，並附上訂單編號。\n\n" + SHOP_NAME + " 敬上";
  MailApp.sendEmail({ to: email, subject: "【" + SHOP_NAME + "】預購確認 " + orderId, body: body, name: SHOP_NAME });
}
