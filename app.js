(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var GOAL = C.goal || 800;
  var MAX = C.maxPerOrder || 50;
  var PRODUCTS = C.products || [];
  var DEMO = !C.scriptUrl;
  var CART_KEY = "unagi_cart_v1";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var fmt = function (n) { return "NT$ " + Number(n).toLocaleString("zh-TW"); };
  var byId = function (id) { return PRODUCTS.filter(function (p) { return p.id === id; })[0]; };
  var clampQty = function (n) { n = parseInt(n, 10); return isNaN(n) ? 1 : Math.max(1, Math.min(MAX, n)); };
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };

  /* ---------- 靜態文字 ---------- */
  $("#yr").textContent = new Date().getFullYear();
  $("#goalText").textContent = GOAL;
  $("#pGoal").textContent = GOAL;
  $("#faqPay").textContent = C.paymentNote || "";
  $("#faqShip").textContent = C.shippingNote || "";
  if (C.facebookUrl) $("#fbBtn").href = C.facebookUrl; else $("#fbBtn").hidden = true;
  if (C.lineUrl) $("#lineBtn").href = C.lineUrl;
  else { $("#lineBtn").removeAttribute("target"); $("#lineBtn").href = "#contact"; $("#lineBtn").textContent = "掃描右側 QR Code 加 LINE"; }
  if (DEMO) $("#demoNote").hidden = false;

  /* ---------- 進度條 ---------- */
  var currentTotal = 0;
  function renderProgress(total) {
    currentTotal = total;
    var pct = Math.min(100, (total / GOAL) * 100);
    var shown = pct > 0 && pct < 1 ? 1 : Math.floor(pct);
    $("#pTotal").textContent = total.toLocaleString("zh-TW");
    $("#pFill").style.width = pct + "%";
    $("#pPct").textContent = shown + "%";
    $("#pBar").setAttribute("aria-valuenow", total);
    $("#pBar").setAttribute("aria-valuemax", GOAL);
    $("#mbFill").style.width = pct + "%";
    $("#mbText").textContent = total + " / " + GOAL + " 盒";
    var remain = GOAL - total;
    if (remain > 0) {
      $("#pRemain").innerHTML = "還差 <b>" + remain + "</b> 盒即成團";
      $(".progress-card").classList.remove("done-goal");
    } else {
      $("#pRemain").innerHTML = "<b>已成團！</b>仍可持續預購";
      $(".progress-card").classList.add("done-goal");
    }
  }
  function fetchProgress() {
    if (DEMO) { renderProgress(currentTotal); return; }
    fetch(C.scriptUrl + "?action=total&t=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (d) { if (d && d.ok) renderProgress(Number(d.total) || 0); })
      .catch(function () { /* 讀取失敗時保留目前數字 */ });
  }
  renderProgress(0);
  fetchProgress();
  setInterval(fetchProgress, 60000);

  /* 截止倒數 */
  if (C.deadline) {
    var end = new Date(C.deadline + "T23:59:59+08:00");
    var days = Math.ceil((end - new Date()) / 86400000);
    $("#pDeadline").textContent = days > 0 ? "截止倒數 " + days + " 天" : "預購已截止";
  }

  /* ---------- 購物車（存在瀏覽器） ---------- */
  var cart = {};
  try { cart = JSON.parse(localStorage.getItem(CART_KEY) || "{}") || {}; } catch (e) { cart = {}; }
  Object.keys(cart).forEach(function (k) { if (!byId(k)) delete cart[k]; else cart[k] = clampQty(cart[k]); });
  function saveCart() { try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch (e) {} }
  function cartCount() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0); }
  function cartSum() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k] * byId(k).price; }, 0); }

  function renderCart() {
    var n = cartCount();
    var badge = $("#cartBadge");
    badge.textContent = n;
    badge.classList.remove("bump"); void badge.offsetWidth; badge.classList.add("bump");
    var box = $("#cartItems");
    var keys = Object.keys(cart);
    if (!keys.length) {
      box.innerHTML = '<div class="cart-empty">購物車是空的<br><small>先選擇想預購的盒數吧</small></div>';
    } else {
      box.innerHTML = keys.map(function (k) {
        var p = byId(k);
        return '<div class="cart-item" data-id="' + esc(k) + '"><img src="' + esc(p.image) + '" alt=""><div>' +
          '<h4>' + esc(p.name) + '</h4><div class="muted" style="font-size:.85rem">' + fmt(p.price) + ' / 盒</div>' +
          '<div class="ci-row" style="margin-top:8px"><div class="qty"><button type="button" data-d="-1" aria-label="減少">−</button>' +
          '<input type="number" value="' + cart[k] + '" min="1" max="' + MAX + '" aria-label="數量">' +
          '<button type="button" data-d="1" aria-label="增加">＋</button></div>' +
          '<button class="ci-del" type="button">移除</button></div></div></div>';
      }).join("");
    }
    $("#cartSum").textContent = fmt(cartSum());
    $("#checkoutBtn").disabled = n === 0;
    $("#checkoutBtn").textContent = n ? "確定下單（共 " + n + " 盒）" : "確定下單";
  }

  $("#cartItems").addEventListener("click", function (e) {
    var item = e.target.closest(".cart-item"); if (!item) return;
    var id = item.getAttribute("data-id");
    if (e.target.classList.contains("ci-del")) { delete cart[id]; }
    else if (e.target.dataset.d) {
      var v = cart[id] + Number(e.target.dataset.d);
      if (v < 1) delete cart[id]; else cart[id] = clampQty(v);
    } else return;
    saveCart(); renderCart();
  });
  $("#cartItems").addEventListener("change", function (e) {
    var item = e.target.closest(".cart-item"); if (!item || e.target.tagName !== "INPUT") return;
    cart[item.getAttribute("data-id")] = clampQty(e.target.value);
    saveCart(); renderCart();
  });

  /* ---------- 商品卡 ---------- */
  $("#productList").innerHTML = PRODUCTS.map(function (p) {
    var gal = (p.gallery && p.gallery.length) ? p.gallery : [{ src: p.image, caption: "" }];
    var slides = gal.map(function (g, i) {
      return '<figure class="slide"><img src="' + esc(g.src) + '" alt="' + esc(p.name + (g.caption ? "－" + g.caption : "")) + '"' + (i ? ' loading="lazy"' : '') + '>' +
        (g.caption ? '<figcaption>' + esc(g.caption) + '</figcaption>' : '') + '</figure>';
    }).join("");
    var nav = gal.length > 1 ? '<button type="button" class="gal-btn prev" aria-label="上一張">‹</button><button type="button" class="gal-btn next" aria-label="下一張">›</button>' +
      '<div class="gal-dots">' + gal.map(function (g, i) { return '<button type="button" class="dot' + (i ? '' : ' on') + '" data-i="' + i + '" aria-label="第 ' + (i + 1) + ' 張"></button>'; }).join("") + '</div>' : '';
    return '<article class="product" data-id="' + esc(p.id) + '"><div class="gallery"><div class="track">' + slides + '</div>' + nav + '</div>' +
      '<div class="product-body"><h3>' + esc(p.name) + '</h3><p class="product-spec">' + esc(p.spec) + '</p>' +
      '<div class="price"><small>預購價</small>' + fmt(p.price) + '<small style="margin-left:4px">/ 盒</small></div>' +
      '<div class="product-actions"><div class="qty"><button type="button" data-d="-1" aria-label="減少">−</button>' +
      '<input type="number" value="1" min="1" max="' + MAX + '" aria-label="盒數"><button type="button" data-d="1" aria-label="增加">＋</button></div>' +
      '<button type="button" class="btn btn-red add-btn">加入購物車</button></div>' +
      '<p class="product-note">' + esc(C.shippingNote || "") + '</p></div></article>';
  }).join("");

  /* 滑動圖片 */
  document.querySelectorAll(".gallery").forEach(function (g) {
    var track = g.querySelector(".track"), dots = g.querySelectorAll(".dot");
    var idx = function () { return Math.round(track.scrollLeft / track.clientWidth); };
    var go = function (i) { var n = dots.length || 1; i = (i + n) % n; track.scrollTo({ left: i * track.clientWidth, behavior: "smooth" }); };
    track.addEventListener("scroll", function () { var i = idx(); dots.forEach(function (d, k) { d.classList.toggle("on", k === i); }); }, { passive: true });
    g.addEventListener("click", function (e) {
      if (e.target.classList.contains("prev")) go(idx() - 1);
      else if (e.target.classList.contains("next")) go(idx() + 1);
      else if (e.target.classList.contains("dot")) go(Number(e.target.dataset.i));
    });
  });

  $("#productList").addEventListener("click", function (e) {
    var card = e.target.closest(".product"); if (!card) return;
    var input = $("input", card);
    if (e.target.dataset.d) { input.value = clampQty(Number(input.value) + Number(e.target.dataset.d)); return; }
    if (e.target.classList.contains("add-btn")) {
      var id = card.getAttribute("data-id");
      var add = clampQty(input.value);
      var next = (cart[id] || 0) + add;
      if (next > MAX) { toast("每筆訂單最多 " + MAX + " 盒"); next = MAX; }
      cart[id] = next; saveCart(); renderCart();
      input.value = 1;
      toast("已加入 " + add + " 盒到購物車");
      openDrawer();
    }
  });
  $("#productList").addEventListener("change", function (e) { if (e.target.tagName === "INPUT") e.target.value = clampQty(e.target.value); });

  /* ---------- 抽屜 / 視窗 ---------- */
  var drawer = $("#drawer"), overlay = $("#overlay"), modal = $("#orderModal");
  function openDrawer() { overlay.hidden = false; drawer.classList.add("open"); drawer.setAttribute("aria-hidden", "false"); }
  function closeDrawer() { drawer.classList.remove("open"); drawer.setAttribute("aria-hidden", "true"); if (modal.hidden) overlay.hidden = true; }
  $("#cartOpen").addEventListener("click", openDrawer);
  $("#cartClose").addEventListener("click", closeDrawer);
  overlay.addEventListener("click", closeDrawer);

  function openModal() {
    if (!cartCount()) return;
    closeDrawer();
    $("#orderSummary").innerHTML = Object.keys(cart).map(function (k) {
      var p = byId(k);
      return "<div><span>" + esc(p.name) + " × " + cart[k] + " 盒</span><span>" + fmt(p.price * cart[k]) + "</span></div>";
    }).join("") + '<div class="tot"><span>合計（運費自付）</span><span>' + fmt(cartSum()) + "</span></div>";
    $("#orderFormView").hidden = false; $("#orderDoneView").hidden = true;
    $("#formErr").textContent = "";
    if (giftPreset.on) { setGift(true); if (giftPreset.msg && !form.elements.cardMsg.value) form.elements.cardMsg.value = giftPreset.msg; updateCard(); giftPreset.on = false; }
    modal.hidden = false; document.body.style.overflow = "hidden";
    setTimeout(function () { $("#orderForm [name=name]").focus(); }, 50);
  }
  /* ---------- 送禮模式 ---------- */
  var form = $("#orderForm");
  var giftPreset = { on: false, msg: "" };
  function isGift() { var r = form.querySelector("input[name=mode]:checked"); return !!r && r.value === "gift"; }
  function setGift(on) {
    var r = form.querySelector('input[name=mode][value="' + (on ? "gift" : "self") + '"]'); if (r) r.checked = true;
    form.classList.toggle("is-gift", on);
    form.querySelectorAll(".gift-only input, .gift-only textarea").forEach(function (el) { el.disabled = !on; });
    $("#addrLabel").textContent = on ? "收禮人地址" : "收件地址";
    $("#buyerTitle").textContent = on ? "訂購人（您）" : "收件資料";
  }
  function updateCard() {
    var msg = (form.elements.cardMsg.value || "").trim();
    $("#cardText").textContent = msg || "在這裡寫下想對他說的話";
    $("#cardFrom").textContent = (form.elements.name.value || "").trim() ? "—— " + form.elements.name.value.trim() + " 敬上" : "—— 您的名字";
    $("#cardTo").textContent = (form.elements.rName.value || "").trim() ? "給　" + form.elements.rName.value.trim() : "給　最重要的您";
    $("#cardCount").textContent = msg.length + " / 60";
  }
  form.addEventListener("change", function (e) { if (e.target.name === "mode") setGift(e.target.value === "gift"); });
  form.addEventListener("input", function (e) { if (["cardMsg", "name", "rName"].indexOf(e.target.name) > -1) updateCard(); });
  form.addEventListener("click", function (e) {
    var t = e.target.closest(".msg-tpl"); if (!t) return;
    form.elements.cardMsg.value = t.dataset.msg; updateCard();
  });
  setGift(false); updateCard();

  /* 送禮情境入口：選好心意 → 加一盒 → 開購物車 */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-gift-start]"); if (!b) return;
    e.preventDefault();
    giftPreset = { on: true, msg: b.dataset.msg || "" };
    var pid = PRODUCTS[0] && PRODUCTS[0].id;
    if (pid && !cart[pid]) { cart[pid] = 1; saveCart(); renderCart(); }
    toast(b.dataset.toast || "已幫您準備好一盒，確認數量後下單");
    openDrawer();
  });
  /* 時機小卡：點了換祝福語 */
  document.querySelectorAll(".occasion").forEach(function (o) {
    o.addEventListener("click", function () {
      document.querySelectorAll(".occasion").forEach(function (x) { x.classList.toggle("on", x === o); x.setAttribute("aria-pressed", x === o); });
      var m = $("#occMsg"); m.classList.remove("swap"); void m.offsetWidth; m.classList.add("swap");
      m.textContent = o.dataset.msg;
      $("#occCta").dataset.msg = o.dataset.msg;
    });
  });

  function closeModal() { modal.hidden = true; document.body.style.overflow = ""; overlay.hidden = true; }
  $("#checkoutBtn").addEventListener("click", openModal);
  $("#orderClose").addEventListener("click", closeModal);
  $("#doneClose").addEventListener("click", closeModal);
  modal.addEventListener("click", function (e) { if (e.target === modal) closeModal(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { if (!modal.hidden) closeModal(); else closeDrawer(); } });

  /* ---------- 送出訂單 ---------- */
  var form = $("#orderForm"), submitting = false;
  function validate(fd) {
    var errs = [];
    form.querySelectorAll(".invalid").forEach(function (el) { el.classList.remove("invalid"); });
    function bad(name, msg) { form.elements[name].classList.add("invalid"); errs.push(msg); }
    if (!fd.name.trim()) bad("name", "請填寫姓名");
    if (!/^09\d{8}$/.test(fd.phone)) bad("phone", "手機格式需為 09 開頭共 10 碼");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fd.email)) bad("email", "Email 格式不正確");
    if (fd.gift) {
      if (!fd.recipientName) bad("rName", "請填寫收禮人姓名");
      if (!/^09\d{8}$/.test(fd.recipientPhone) && !/^0\d{7,9}$/.test(fd.recipientPhone)) bad("rPhone", "請填寫收禮人電話（手機或市話）");
    }
    if (fd.address.trim().length < 6) bad("address", fd.gift ? "請填寫收禮人的完整地址" : "請填寫完整收件地址");
    if (!form.elements.agree.checked) errs.push("請勾選同意個資使用");
    return errs;
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (submitting) return;
    var fd = {
      name: form.elements.name.value.trim(),
      phone: form.elements.phone.value.replace(/[\s-]/g, ""),
      email: form.elements.email.value.trim(),
      address: form.elements.address.value.trim(),
      timeslot: form.elements.timeslot.value,
      note: form.elements.note.value.trim(),
      gift: isGift(),
      recipientName: isGift() ? form.elements.rName.value.trim() : "",
      recipientPhone: isGift() ? form.elements.rPhone.value.replace(/[\s-]/g, "") : "",
      cardMsg: isGift() ? form.elements.cardMsg.value.trim() : "",
      website: form.elements.website.value,
      items: Object.keys(cart).map(function (k) { return { id: k, qty: cart[k] }; })
    };
    var errs = validate(fd);
    if (errs.length) { $("#formErr").textContent = errs[0]; return; }
    submitting = true;
    var btn = $("#submitBtn");
    btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 送出中…';

    var done = function (res) {
      submitting = false; btn.disabled = false; btn.textContent = "送出預購";
      if (!res || !res.ok) { $("#formErr").textContent = (res && res.error) || "送出失敗，請稍後再試或私訊我們"; return; }
      $("#doneId").textContent = res.orderId;
      $("#doneMsg").textContent = DEMO ? "（展示模式）實際上線後，確認信會寄到您的 Email。" : "我們已將確認信寄到 " + fd.email + "，成團後會再通知付款與出貨資訊。";
      if (fd.gift) $("#doneMsg").textContent += " 成團出貨時，會直接寄到" + fd.recipientName + "手上" + (fd.cardMsg ? "，並附上您的祝福卡。" : "。");
      $("#orderFormView").hidden = true; $("#orderDoneView").hidden = false;
      cart = {}; saveCart(); renderCart(); form.reset(); setGift(false); updateCard();
      if (typeof res.total === "number") renderProgress(res.total); else fetchProgress();
    };

    if (DEMO) {
      var boxes = fd.items.reduce(function (s, i) { return s + i.qty; }, 0);
      setTimeout(function () { done({ ok: true, orderId: "DEMO-" + String(Date.now()).slice(-6), total: currentTotal + boxes }); }, 700);
      return;
    }
    // text/plain 可避免 CORS 預檢，Apps Script 以 e.postData.contents 讀取
    fetch(C.scriptUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(fd) })
      .then(function (r) { return r.json(); })
      .then(done)
      .catch(function () { done({ ok: false, error: "網路連線不穩，請稍後再試（若已收到確認信請勿重複下單）" }); });
  });

  /* ---------- 其他 ---------- */
  var tt;
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(function () { t.classList.remove("show"); }, 2200); }

  var mb = $("#mobileBar"), orderSec = $("#order");
  window.addEventListener("scroll", function () {
    var y = window.scrollY, o = orderSec.getBoundingClientRect();
    mb.classList.toggle("show", y > 500 && (o.top > window.innerHeight || o.bottom < 0));
  }, { passive: true });

  
  /* ---------- 進場動畫 ---------- */
  if ("IntersectionObserver" in window && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    var els = document.querySelectorAll(".sec-title, .nh, .scene, .occasion-wrap, .jn, .heat-feature, .hm, .portion-img, .portion-text, .farm-card, .safety-main, .test-table, .product, .steps li, .faq-list, .qr");
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { el.classList.add("reveal"); io.observe(el); });
  }

  
  /* ---------- 首屏輪播 ---------- */
  (function () {
    var root = document.querySelector(".hero-carousel"); if (!root) return;
    var slides = root.querySelectorAll(".hc-slide"), dotsBox = root.querySelector(".hc-dots");
    var i = 0, timer = null, DUR = 5500;
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    slides.forEach(function (_, k) {
      var d = document.createElement("button"); d.type = "button"; d.className = "hc-dot" + (k ? "" : " on");
      d.setAttribute("aria-label", "第 " + (k + 1) + " 張"); d.innerHTML = "<i></i>";
      d.addEventListener("click", function () { go(k, true); }); dotsBox.appendChild(d);
    });
    var dots = dotsBox.querySelectorAll(".hc-dot");
    function go(n, user) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle("is-on", k === i); s.setAttribute("aria-hidden", k !== i); });
      dots.forEach(function (d, k) { d.classList.remove("on"); void d.offsetWidth; d.classList.toggle("on", k === i); });
      if (user) restart();
    }
    function restart() { clearInterval(timer); if (!reduce) timer = setInterval(function () { go(i + 1); }, DUR); }
    root.querySelector(".prev").addEventListener("click", function () { go(i - 1, true); });
    root.querySelector(".next").addEventListener("click", function () { go(i + 1, true); });
    root.addEventListener("mouseenter", function () { clearInterval(timer); root.classList.add("paused"); });
    root.addEventListener("mouseleave", function () { root.classList.remove("paused"); restart(); });
    var x0 = null;
    root.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    root.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) go(i + (dx < 0 ? 1 : -1), true); x0 = null; });
    document.addEventListener("visibilitychange", function () { if (document.hidden) clearInterval(timer); else restart(); });
    go(0); restart();
  })();

  
  /* ---------- 圖片放大檢視 ---------- */
  (function () {
    var lb = $("#lightbox"), img = $("#lbImg"), box = $("#lbScroll"), last = null;
    function open(src, title) {
      last = document.activeElement; img.src = src; img.alt = title; $("#lbTitle").textContent = title;
      box.classList.remove("full", "wide");
      img.onload = function () { if (window.innerWidth < 640 && img.naturalWidth > img.naturalHeight * 1.2) { box.classList.add("wide"); box.scrollLeft = 0; } };
      lb.hidden = false; document.body.style.overflow = "hidden"; $("#lbClose").focus();
      var car = document.querySelector(".hero-carousel"); if (car) car.dispatchEvent(new Event("mouseenter"));
    }
    function close() { lb.hidden = true; document.body.style.overflow = ""; if (last) last.focus(); var car = document.querySelector(".hero-carousel"); if (car) car.dispatchEvent(new Event("mouseleave")); }
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".hc-enlarge");
      var z = !b && e.target.closest(".hc-zoom img") ? e.target.closest(".hc-zoom").querySelector(".hc-enlarge") : null;
      var t = b || z; if (!t) return;
      e.preventDefault(); open(t.dataset.full, t.dataset.title);
    });
    img.addEventListener("click", function () { box.classList.toggle("full"); });
    $("#lbClose").addEventListener("click", close);
    lb.addEventListener("click", function (e) { if (e.target === lb || e.target === box) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !lb.hidden) close(); });
  })();

  renderCart();
})();
