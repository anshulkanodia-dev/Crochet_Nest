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
  function hasPrice(p) { return Number(p && p.price) > 0; }
  function priceLabel(p) { return hasPrice(p) ? money(p.price) : "Price on enquiry"; }
  function makeLabel(p) { return Number(p && p.shipDays) > 0 ? "Ships ~" + p.shipDays + " days" : "Made to order"; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function swatchFor(p) { return p.swatch && SWATCHES.indexOf(p.swatch) >= 0 ? p.swatch : SWATCHES[(hash(p.id) % SWATCHES.length)]; }
  function hash(s) { var h = 0, i; s = String(s); for (i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return Math.abs(h); }
  function param(name) { return new URLSearchParams(location.search).get(name); }

  var SITE = "https://anshulkanodia-dev.github.io/Crochet_Nest";
  function setMeta(sel, attr, val) {
    var el = document.head.querySelector(sel);
    if (!el) { el = document.createElement("meta"); document.head.appendChild(el); var parts = sel.match(/\[(.+?)=["']?(.+?)["']?\]/); if (parts) el.setAttribute(parts[1], parts[2]); }
    el.setAttribute(attr, val);
  }
  function setCanonical(url) {
    var el = document.head.querySelector('link[rel="canonical"]');
    if (!el) { el = document.createElement("link"); el.setAttribute("rel", "canonical"); document.head.appendChild(el); }
    el.setAttribute("href", url);
  }
  function injectJsonLd(obj) {
    var s = document.createElement("script");
    s.type = "application/ld+json";
    s.textContent = JSON.stringify(obj);
    document.head.appendChild(s);
  }

  function media(p, withKnot) {
    if (p.image) return '<img class="photo" loading="lazy" decoding="async" src="' + esc(p.image) + '" alt="' + esc(p.name) + '">';
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

  // Runtime settings (contacts + categories) — admin-managed, from data/settings.json,
  // falling back to values in config.js.
  var SETTINGS = {
    whatsappNumber: CFG.whatsappNumber || "",
    instagramHandle: CFG.instagramHandle || "",
    categories: (CFG.categories || []).slice()
  };
  var _settingsLoaded = null;
  function loadSettings() {
    if (_settingsLoaded) return _settingsLoaded;
    _settingsLoaded = fetch("data/settings.json", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (s) {
        if (s && s.whatsappNumber) SETTINGS.whatsappNumber = s.whatsappNumber;
        if (s && s.instagramHandle) SETTINGS.instagramHandle = s.instagramHandle;
        if (s && Array.isArray(s.categories) && s.categories.length) SETTINGS.categories = s.categories;
        return SETTINGS;
      })
      .catch(function () { return SETTINGS; });
    return _settingsLoaded;
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
    var lines = ["Hi CrochetNest! I'd like to enquire about these handmade pieces:", ""];
    rows.forEach(function (r, idx) {
      lines.push((idx + 1) + ". " + r.p.name + " (" + r.p.category + ") x" + r.qty + (hasPrice(r.p) ? " — " + money(r.line) : ""));
    });
    if (rows.some(function (r) { return hasPrice(r.p); })) {
      lines.push("");
      lines.push("Estimated total for priced items: " + money(cartTotal()));
    }
    lines.push("Please let me know availability and next steps. Thank you!");
    return lines.join("\n");
  }

  function enquireWhatsApp() {
    if (!getCart().length) { toast("Your cart is empty"); return; }
    var num = (SETTINGS.whatsappNumber || "").replace(/\D/g, "");
    if (!num) { toast("WhatsApp is being set up — please use Instagram for now"); return; }
    var url = "https://wa.me/" + num + "?text=" + encodeURIComponent(enquiryText());
    window.open(url, "_blank");
  }
  function enquireInstagram() {
    if (!getCart().length) { toast("Your cart is empty"); return; }
    copyText(enquiryText());
    toast("Enquiry copied — paste it in our Instagram DM", true);
    window.open("https://instagram.com/" + encodeURIComponent(SETTINGS.instagramHandle || ""), "_blank");
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
            '<div class="c">' + esc(r.p.category) + " · " + esc(makeLabel(r.p)) + "</div>" +
            '<div class="p">' + esc(priceLabel(r.p)) + "</div>" +
            '<div class="mstep"><button data-dec="' + esc(r.p.id) + '">\u2212</button><span>' + r.qty + '</span><button data-inc="' + esc(r.p.id) + '">+</button></div>' +
          "</div>" +
          '<div class="rm" data-rm="' + esc(r.p.id) + '">\u2715</div>' +
        "</div>";
      }).join("");
    }
    var tot = $("#cart-total"); if (tot) tot.textContent = rows.length && rows.every(function (r) { return hasPrice(r.p); }) ? money(cartTotal()) : "Confirmed on enquiry";
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
        '<div class="foot"><span class="price">' + esc(priceLabel(p)) + '</span><span class="ship">' + esc(makeLabel(p)) + "</span></div>" +
      "</div>" +
    "</a>";
  }

  function renderHome() {
    loadProducts().then(function (products) {
      var feat = $("#featured-grid");
      if (feat) {
        var seen = {};
        var spread = products.filter(function (p) {
          if (seen[p.category]) return false;
          seen[p.category] = true;
          return true;
        });
        feat.innerHTML = spread.slice(0, 6).map(cardHTML).join("");
      }
      var counts = {};
      products.forEach(function (p) { counts[p.category] = (counts[p.category] || 0) + 1; });
      var tiles = $("#cat-tiles");
      if (tiles) {
        var cats = SETTINGS.categories || [];
        tiles.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
        tiles.innerHTML = cats.map(function (c) {
          var sample = products.filter(function (p) { return p.category === c; })[0];
          return '<a class="cat-tile" href="shop.html?category=' + encodeURIComponent(c) + '">' +
            '<div class="cat-photo">' + (sample ? media(sample) : "") + "</div>" +
            '<span class="cnum">' + (counts[c] || 0) + "</span>" +
            '<div class="ct-cap"><h4>' + esc(c) + "</h4></div>" +
          "</a>";
        }).join("");
      }
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
      // build filter list dynamically from settings categories
      var flist = $("#cat-filters");
      if (flist) {
        var cats = ["All"].concat(SETTINGS.categories || []);
        flist.innerHTML = cats.map(function (cat) {
          return '<a data-filter="' + esc(cat) + '" href="' + (cat === "All" ? "shop.html" : "shop.html?category=" + encodeURIComponent(cat)) + '">' +
            esc(cat) + ' <span class="c">' + (counts[cat] || 0) + "</span></a>";
        }).join("");
      }
      $all("[data-filter]").forEach(function (a) {
        var cat = a.getAttribute("data-filter");
        var cEl = a.querySelector(".c"); if (cEl) cEl.textContent = counts[cat] || 0;
        a.classList.toggle("active", cat === activeCat);
        a.href = cat === "All" ? "shop.html" : "shop.html?category=" + encodeURIComponent(cat);
      });
      var list = activeCat === "All" ? products : products.filter(function (p) { return p.category === activeCat; });
      var PAGE = 36;
      var shown = 0;
      var more = $("#shop-more");

      function showNext() {
        var next = list.slice(shown, shown + PAGE);
        grid.insertAdjacentHTML("beforeend", next.map(cardHTML).join(""));
        shown += next.length;
        if (more) {
          more.hidden = shown >= list.length;
          more.textContent = "Show more (" + (list.length - shown) + " left)";
        }
      }

      grid.innerHTML = list.length ? "" : '<div class="cart-empty">No pieces in this category yet.</div>';
      showNext();
      if (more) more.addEventListener("click", showNext);
      var res = $("#shop-res"); if (res) res.textContent = list.length + " handmade item" + (list.length === 1 ? "" : "s");
      var title = $("#shop-title"); if (title) title.textContent = activeCat === "All" ? "All pieces" : activeCat;
    });
  }

  function renderProduct() {
    var root = $("#product-root");
    if (!root) return;
    var id = param("id");
    loadProducts().then(function (products) {
      var p = products.filter(function (x) { return x.id === id; })[0];
      if (!p) { root.innerHTML = '<div class="cart-empty" style="padding:100px 0"><span class="em">\uD83E\uDDF6</span>Product not found. <a href="shop.html" style="color:var(--mint)">Back to shop</a></div>'; return; }
      document.title = p.name + " — CrochetNest";
      var pUrl = SITE + "/product.html?id=" + encodeURIComponent(p.id);
      var pImg = p.image || (SITE + "/assets/logo.png");
      var desc = (p.description || ("Handmade " + p.category + " from CrochetNest.")).slice(0, 300);
      setMeta('meta[name="description"]', "content", desc);
      setCanonical(pUrl);
      setMeta('meta[property="og:title"]', "content", p.name + " — CrochetNest");
      setMeta('meta[property="og:description"]', "content", desc);
      setMeta('meta[property="og:url"]', "content", pUrl);
      setMeta('meta[property="og:image"]', "content", pImg);
      setMeta('meta[name="twitter:title"]', "content", p.name + " — CrochetNest");
      setMeta('meta[name="twitter:description"]', "content", desc);
      setMeta('meta[name="twitter:image"]', "content", pImg);
      var schema = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": p.name,
        "description": desc,
        "category": p.category,
        "image": pImg,
        "brand": { "@type": "Brand", "name": "CrochetNest" }
      };
      if (hasPrice(p)) schema.offers = { "@type": "Offer", "price": String(p.price), "priceCurrency": "INR", "availability": "https://schema.org/MadeToOrder", "url": pUrl };
      injectJsonLd(schema);
      var others = products.filter(function (x) { return x.id !== id; }).slice(0, 3);
      root.innerHTML =
        '<div class="crumbs"><a href="index.html">Home</a> / <a href="shop.html">Shop</a> / ' + esc(p.category) + " / " + esc(p.name) + "</div>" +
        '<div class="detail">' +
          '<div class="d-gallery"><div class="main">' + media(p, true) + "</div></div>" +
          '<div class="d-info">' +
            '<div class="cat">' + esc(p.category) + "</div>" +
            "<h1>" + esc(p.name) + "</h1>" +
            '<div class="price">' + esc(priceLabel(p)) + "</div>" +
            '<p class="desc">' + esc(p.description) + "</p>" +
            '<div class="spec">' +
              '<div class="row"><span class="k">Availability</span><span class="v">' + esc(makeLabel(p)) + "</span></div>" +
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

  /* ---------- customise (custom request) page ---------- */
  function renderCustomise() {
    var MAX = 5;
    var files = [];
    var dz = $("#dropzone"), input = $("#file-input"), thumbs = $("#thumbs"), preview = $("#msg-preview");
    if (!dz) return;

    function addFiles(list) {
      var arr = Array.prototype.slice.call(list || []);
      arr.forEach(function (f) {
        if (!/^image\//.test(f.type)) { toast("“" + f.name + "” isn’t an image"); return; }
        if (files.length >= MAX) { toast("You can add up to " + MAX + " photos"); return; }
        files.push({ file: f, url: URL.createObjectURL(f) });
      });
      renderThumbs();
    }
    function removeFile(i) {
      URL.revokeObjectURL(files[i].url);
      files.splice(i, 1);
      renderThumbs();
    }
    function renderThumbs() {
      thumbs.innerHTML = files.map(function (f, i) {
        return '<div class="th"><img src="' + f.url + '" alt="' + esc(f.file.name) + '">' +
          '<button data-rm="' + i + '" title="Remove">\u2715</button>' +
          '<span class="nm">' + esc(f.file.name) + "</span></div>";
      }).join("");
      renderPreview();
    }

    function requestText() {
      var msg = $("#c-msg").value.trim() || "Is it possible to make this?";
      var lines = ["Hi CrochetNest! I have a custom request:", "", msg, ""];
      var name = $("#c-name").value.trim();
      var size = $("#c-size").value.trim();
      var colour = $("#c-colour").value.trim();
      var by = $("#c-date").value;
      if (name) lines.push("Name: " + name);
      if (size) lines.push("Size: " + size);
      if (colour) lines.push("Colours: " + colour);
      if (by) lines.push("Needed by: " + by);
      if (name || size || colour || by) lines.push("");
      lines.push(files.length
        ? "(Attaching " + files.length + " reference photo" + (files.length > 1 ? "s" : "") + ".)"
        : "(I'll share a reference photo next.)");
      return lines.join("\n");
    }
    function renderPreview() { preview.textContent = requestText(); }

    function copyFirstImage() {
      if (!files.length) return Promise.resolve(false);
      if (!(window.ClipboardItem && navigator.clipboard && navigator.clipboard.write)) return Promise.resolve(false);
      return new Promise(function (resolve) {
        var img = new Image();
        img.onload = function () {
          var c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          c.toBlob(function (blob) {
            if (!blob) { resolve(false); return; }
            navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })])
              .then(function () { resolve(true); })
              .catch(function () { resolve(false); });
          }, "image/png");
        };
        img.onerror = function () { resolve(false); };
        img.src = files[0].url;
      });
    }

    function downloadPhotos() {
      if (!files.length) { toast("Add a photo first"); return; }
      files.forEach(function (f, i) {
        var a = document.createElement("a");
        a.href = f.url;
        a.download = f.file.name || ("crochetnest-reference-" + (i + 1));
        a.click();
      });
      toast("Photos downloaded — attach them in the chat", true);
    }

    // events
    dz.addEventListener("click", function () { input.click(); });
    dz.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", function () { addFiles(input.files); input.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("over"); });
    });
    dz.addEventListener("drop", function (e) { addFiles(e.dataTransfer && e.dataTransfer.files); });
    thumbs.addEventListener("click", function (e) {
      var rm = e.target.getAttribute && e.target.getAttribute("data-rm");
      if (rm !== null && rm !== undefined) removeFile(Number(rm));
    });
    ["c-msg", "c-name", "c-size", "c-colour", "c-date"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener("input", renderPreview);
    });

    $("#c-wa").addEventListener("click", function () {
      var num = (SETTINGS.whatsappNumber || "").replace(/\D/g, "");
      if (!num) { toast("WhatsApp is being set up — please use Instagram for now"); return; }
      window.open("https://wa.me/" + num + "?text=" + encodeURIComponent(requestText()), "_blank");
      copyFirstImage().then(function (ok) {
        toast(ok ? "Photo copied — paste it in the chat" : (files.length ? "Attach your photo in the chat" : "Request opened in WhatsApp"), true);
      });
    });
    $("#c-ig").addEventListener("click", function () {
      window.open("https://instagram.com/" + encodeURIComponent(SETTINGS.instagramHandle || ""), "_blank");
      copyText(requestText());
      toast("Message copied — paste it in our DM with your photo", true);
    });
    $("#c-copy").addEventListener("click", function () { copyText(requestText()); toast("Message copied", true); });
    $("#c-download").addEventListener("click", downloadPhotos);

    renderPreview();
  }

  /* ---------- mobile menu ---------- */
  function buildMobileMenu() {
    var nav = $(".nav"), actions = $(".header-actions");
    if (!nav || !actions || $("#menu-toggle")) return;

    var toggle = document.createElement("button");
    toggle.id = "menu-toggle";
    toggle.className = "icon-btn menu-toggle";
    toggle.setAttribute("aria-label", "Menu");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = "\u2261";
    actions.appendChild(toggle);

    var sheet = document.createElement("nav");
    sheet.id = "mobile-menu";
    sheet.className = "mobile-menu";
    sheet.innerHTML = nav.innerHTML;
    document.querySelector(".header").appendChild(sheet);

    toggle.addEventListener("click", function () {
      var open = sheet.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
      toggle.innerHTML = open ? "\u2715" : "\u2261";
    });
    sheet.addEventListener("click", function () { sheet.classList.remove("open"); toggle.innerHTML = "\u2261"; });
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
    buildMobileMenu();
    updateBadge();
    renderDrawer();
    var page = document.body.getAttribute("data-page");
    loadSettings().then(function () {
      if (page === "home") renderHome();
      else if (page === "shop") renderShop();
      else if (page === "product") renderProduct();
      else if (page === "customise") renderCustomise();
    });
  });

  window.CN = { openDrawer: openDrawer, closeDrawer: closeDrawer };
})();
