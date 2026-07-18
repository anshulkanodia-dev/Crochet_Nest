/* CrochetNest — public storefront logic (catalogue, cart, enquiry) */
(function () {
  "use strict";

  var CFG = window.CN_CONFIG || {};
  var CART_KEY = "cn_cart_v1";
  var SWATCHES = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"];

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function money(n) { return (CFG.currencySymbol || "\u20b9") + Number(n).toLocaleString("en-IN"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function swatchFor(p) { return p.swatch && SWATCHES.indexOf(p.swatch) >= 0 ? p.swatch : SWATCHES[(hash(p.id) % SWATCHES.length)]; }
  function hash(s) { var h = 0, i; s = String(s); for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function param(name) { return new URLSearchParams(location.search).get(name); }

  function media(p, withKnot) {
    if (p.image) return '<img class="photo" src="' + esc(p.image) + '" alt="' + esc(p.name) + '">';
    return '<div class="ph ' + swatchFor(p) + '">' + (withKnot ? '<div class="knot"></div>' : "") + "</div>";
  }

  /* ---------- data ---------- */
  var _products = null;
  function loadProducts() {
    if (_products) return Promise.resolve(_products);
    return fetch("data/products.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (data) { _products = (data && data.products) || []; return _products; })
      .catch(function (e) { console.error("Failed to load products.json", e); _products = []; return _products; });
  }

  /* ---------- cart ---------- */
  function getCart() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch (e) { return []; }
  }
  function setCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    updateBadge();
    renderDrawer();
  }
  function cartCount() { return getCart().reduce(function (n, i) { return n + i.qty; }, 0); }
  function addToCart(id, qty) {
    qty = qty || 1;
    var cart = getCart();
    var row = cart.filter(function (i) { return i.id === id; })[0];
    if (row) row.qty += qty; else cart.push({ id: id, qty: qty });
    setCart(cart);
  }
  function setQty(id, qty) {
    var cart = getCart().map(function (i) { return i.id === id ? { id: id, qty: qty } : i; })
      .filter(function (i) { return i.qty > 0; });
    setCart(cart);
  }
  function removeItem(id) { setCart(getCart().filter(function (i) { return i.id !== id; })); }

  function updateBadge() {
    var c = cartCount();
    $all("[data-cart-badge]").forEach(function (b) {
      b.textContent = c;
      b.style.display = c > 0 ? "" : "none";
    });
  }

  /* ---------- enquiry message ---------- */
  function cartDetailed() {
    var byId = {};
    (_products || []).forEach(function (p) { byId[p.id] = p; });
    return getCart().map(function (i) {
      var p = byId[i.id] || { name: i.id, price: 0, category: "" };
      return { p: p, qty: i.qty, line: p.price * i.qty };
    });
  }
  function cartTotal() { return cartDetailed().reduce(function (s, r) { return s + r.line; }, 0); }

  function enquiryText() {
    var rows = cartDetailed();
    var lines = ["Hi CrochetNest! I'd like to enquire about booking these pieces:", ""];
    rows.forEach(function (r, idx) {
      lines.push((idx + 1) + ". " + r.p.name + " (" + r.p.category + ") x" + r.qty + " — " + money(r.line));
    });
    lines.push("");
    lines.push("Estimated total: " + money(cartTotal()));
    lines.push("Please let me know availability and next steps. Thank you!");
    return lines.join("\n");
  }

  function enquireWhatsApp() {
    if (!getCart().length) { toast("Your cart is empty"); return; }
    var num = (CFG.whatsappNumber || "").replace(/\D/g, "");
    var url = "https://wa.me/" + num + "?text=" + encodeURIComponent(enquiryText());
    window.open(url, "_blank");
  }
  function enquireInstagram() {
    if (!getCart().length) { toast("Your cart is empty"); return; }
    copyText(enquiryText());
    toast("Enquiry copied — paste it in our Instagram DM", true);
    window.open("https://instagram.com/" + encodeURIComponent(CFG.instagramHandle || ""), "_blank");
  }
  function copyText(t) {
    try { navigator.clipboard && navigator.clipboard.writeText(t); } catch (e) {}
  }

  /* ---------- toast ---------- */
  function toast(msg, ok) {
    var wrap = $(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = (ok ? '<span class="ok">\u2713</span> ' : "") + esc(msg);
    wrap.appendChild(el);
    setTimeout(function () { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(function () { el.remove(); }, 300); }, 2600);
  }

  /* ---------- cart drawer ---------- */
  function openDrawer() { var d = $("#cart-drawer"), o = $("#cart-overlay"); if (d) d.classList.add("open"); if (o) o.classList.add("open"); renderDrawer(); }
  function closeDrawer() { var d = $("#cart-drawer"), o = $("#cart-overlay"); if (d) d.classList.remove("open"); if (o) o.classList.remove("open"); }

  function renderDrawer() {
    var body = $("#cart-items");
    if (!body) return;
    var rows = cartDetailed();
    var cc = $("#cart-count"); if (cc) cc.textContent = "\u00b7 " + cartCount() + " piece" + (cartCount() === 1 ? "" : "s");
    if (!rows.length) {
      body.innerHTML = '<div class="cart-empty"><span class="em">\uD83E\uDDF6</span>Your cart is empty.<br>Browse the collection and add pieces to enquire.</div>';
    } else {
      body.innerHTML = rows.map(function (r) {
        return '<div class="citem">' +
          '<div class="im">' + media(r.p) + "</div>" +
          '<div class="info">' +
            '<div class="t">' + esc(r.p.name) + "</div>" +
            '<div class="c">' + esc(r.p.category) + " \u00b7 Ships ~" + esc(r.p.shipDays) + " days</div>" +
            '<div class="p">' + money(r.p.price) + "</div>" +
            '<div class="mstep"><button data-dec="' + esc(r.p.id) + '">\u2212</button><span>' + r.qty + '</span><button data-inc="' + esc(r.p.id) + '">+</button></div>' +
          "</div>" +
          '<div class="rm" data-rm="' + esc(r.p.id) + '">\u2715</div>' +
        "</div>";
      }).join("");
    }
    var tot = $("#cart-total"); if (tot) tot.textContent = money(cartTotal());
  }

  /* ---------- renders ---------- */
  function cardHTML(p) {
    return '<a class="card" href="product.html?id=' + esc(p.id) + '">' +
      '<div class="media">' +
        '<span class="tag">' + esc(p.category) + "</span>" +
        '<div class="fav" data-fav>\u2661</div>' +
        media(p, true) +
        '<button class="add" data-add="' + esc(p.id) + '" title="Add to cart">+</button>' +
      "</div>" +
      '<div class="body">' +
        '<div class="cat">' + esc(p.category) + "</div>" +
        "<h3>" + esc(p.name) + "</h3>" +
        '<div class="foot"><span class="price">' + money(p.price) + '</span><span class="ship">Ships ~' + esc(p.shipDays) + " days</span></div>" +
      "</div>" +
    "</a>";
  }

  function renderHome() {
    loadProducts().then(function (products) {
      var feat = $("#featured-grid");
      if (feat) feat.innerHTML = products.slice(0, 3).map(cardHTML).join("");
      // category counts
      var counts = {};
      products.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
      $all("[data-cat-count]").forEach(function (el) {
        var c = el.getAttribute("data-cat-count");
        el.textContent = counts[c] || 0;
      });
    });
  }

  function renderShop() {
    var grid = $("#shop-grid");
    if (!grid) return;
    var activeCat = param("category") || "All";
    loadProducts().then(function (products) {
      // counts
      var counts = { All: products.length };
      products.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
      $all("[data-filter]").forEach(function (a) {
        var cat = a.getAttribute("data-filter");
        var cEl = a.querySelector(".c"); if (cEl) cEl.textContent = counts[cat] || 0;
        a.classList.toggle("active", cat === activeCat);
        a.href = cat === "All" ? "shop.html" : "shop.html?category=" + encodeURIComponent(cat);
      });
      var list = activeCat === "All" ? products : products.filter(function (p) { return p.category === activeCat; });
      var sort = $("#sort");
      function apply() {
        var arr = list.slice();
        var v = sort ? sort.value : "featured";
        if (v === "low") arr.sort(function (a, b) { return a.price - b.price; });
        else if (v === "high") arr.sort(function (a, b) { return b.price - a.price; });
        grid.innerHTML = arr.length ? arr.map(cardHTML).join("") : '<div class="cart-empty">No pieces in this category yet.</div>';
        var res = $("#shop-res"); if (res) res.textContent = arr.length + " handmade item" + (arr.length === 1 ? "" : "s");
        var title = $("#shop-title"); if (title) title.textContent = activeCat === "All" ? "All pieces" : activeCat;
      }
      if (sort) sort.addEventListener("change", apply);
      apply();
    });
  }

  function renderProduct() {
    var root = $("#product-root");
    if (!root) return;
    var id = param("id");
    loadProducts().then(function (products) {
      var p = products.filter(function (x) { return x.id === id; })[0];
      if (!p) { root.innerHTML = '<div class="cart-empty" style="padding:100px 0"><span class="em">\uD83E\uDDF6</span>Product not found. <a href="shop.html" style="color:var(--mint)">Back to shop</a></div>'; return; }
      document.title = "CrochetNest — " + p.name;
      var others = products.filter(function (x) { return x.id !== id; }).slice(0, 3);
      root.innerHTML =
        '<div class="crumbs"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / ' + esc(p.category) + " / " + esc(p.name) + "</div>" +
        '<div class="detail">' +
          '<div class="d-gallery"><div class="main">' + media(p, true) + "</div></div>" +
          '<div class="d-info">' +
            '<div class="cat">' + esc(p.category) + "</div>" +
            "<h1>" + esc(p.name) + "</h1>" +
            '<div class="price">' + money(p.price) + "</div>" +
            '<p class="desc">' + esc(p.description) + "</p>" +
            '<div class="spec">' +
              '<div class="row"><span class="k">Estimated shipping</span><span class="v">Ships in ~' + esc(p.shipDays) + " days</span></div>" +
              (p.material ? '<div class="row"><span class="k">Material</span><span class="v">' + esc(p.material) + "</span></div>" : "") +
              (p.size ? '<div class="row"><span class="k">Size</span><span class="v">' + esc(p.size) + "</span></div>" : "") +
            "</div>" +
            '<div class="buy">' +
              '<div class="stepper"><button id="q-dec">\u2212</button><span id="q-val">1</span><button id="q-inc">+</button></div>' +
              '<button class="btn btn-mint btn-lg" id="pd-add" style="flex:1">Add to cart</button>' +
            "</div>" +
            '<div class="note">\u2726 No checkout here — add pieces to your cart, then send an enquiry on WhatsApp or Instagram to confirm and book your order.</div>' +
          "</div>" +
        "</div>" +
        '<section class="section"><div class="sec-head"><div><div class="kick">You may also like</div><h2>More pieces</h2></div></div>' +
        '<div class="grid">' + others.map(cardHTML).join("") + "</div></section>";

      var qty = 1;
      var qv = $("#q-val");
      $("#q-dec").addEventListener("click", function () { qty = Math.max(1, qty - 1); qv.textContent = qty; });
      $("#q-inc").addEventListener("click", function () { qty += 1; qv.textContent = qty; });
      $("#pd-add").addEventListener("click", function () { addToCart(p.id, qty); toast("Added to cart", true); openDrawer(); });
    });
  }

  /* ---------- global event wiring ---------- */
  function wire() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      var add = t.closest ? t.closest("[data-add]") : null;
      if (add) { e.preventDefault(); addToCart(add.getAttribute("data-add"), 1); toast("Added to cart", true); openDrawer(); return; }
      if (t.closest && t.closest("[data-open-cart]")) { e.preventDefault(); openDrawer(); return; }
      if (t.closest && t.closest("[data-close-cart]")) { e.preventDefault(); closeDrawer(); return; }
      if (t.closest && t.closest("[data-wa]")) { e.preventDefault(); enquireWhatsApp(); return; }
      if (t.closest && t.closest("[data-ig]")) { e.preventDefault(); enquireInstagram(); return; }
      if (t.hasAttribute && t.hasAttribute("data-fav")) { e.preventDefault(); t.classList.toggle("chip-active"); t.textContent = t.classList.contains("chip-active") ? "\u2665" : "\u2661"; return; }
      var inc = t.getAttribute && t.getAttribute("data-inc"); if (inc) { var r1 = getCart().filter(function (i) { return i.id === inc; })[0]; setQty(inc, (r1 ? r1.qty : 0) + 1); return; }
      var dec = t.getAttribute && t.getAttribute("data-dec"); if (dec) { var r2 = getCart().filter(function (i) { return i.id === dec; })[0]; setQty(dec, (r2 ? r2.qty : 1) - 1); return; }
      var rm = t.getAttribute && t.getAttribute("data-rm"); if (rm) { removeItem(rm); return; }
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDrawer(); });
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    wire();
    updateBadge();
    renderDrawer();
    var page = document.body.getAttribute("data-page");
    if (page === "home") renderHome();
    else if (page === "shop") renderShop();
    else if (page === "product") renderProduct();
  });

  window.CN = { openDrawer: openDrawer, closeDrawer: closeDrawer };
})();
