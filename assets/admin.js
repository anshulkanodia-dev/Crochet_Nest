/* CrochetNest — admin (OTP login + product management) */
(function () {
  "use strict";

  var CFG = window.CN_CONFIG || {};
  var ADMIN = CFG.admin || {};
  var GH = CFG.github || {};
  var AUTH_KEY = "cn_admin_auth";
  var OTP_KEY = "cn_otp";
  var TOKEN_KEY = "cn_gh_token";
  var SWATCHES = ["g1", "g2", "g3", "g4", "g5", "g6", "g7", "g8"];

  function $(s, c) { return (c || document).querySelector(s); }
  function $all(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function money(n) { return (CFG.currencySymbol || "\u20b9") + Number(n || 0).toLocaleString("en-IN"); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || ("item-" + Date.now()); }
  function b64EncodeUnicode(str) { return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (m, p1) { return String.fromCharCode("0x" + p1); })); }
  function b64DecodeUnicode(str) { return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) { return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2); }).join("")); }

  function toast(msg, ok) {
    var wrap = $(".toast-wrap");
    if (!wrap) { wrap = document.createElement("div"); wrap.className = "toast-wrap"; document.body.appendChild(wrap); }
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = (ok ? '<span class="ok">\u2713</span> ' : "") + esc(msg);
    wrap.appendChild(el);
    setTimeout(function () { el.style.opacity = "0"; el.style.transition = "opacity .3s"; setTimeout(function () { el.remove(); }, 300); }, 3200);
  }

  /* ================= AUTH ================= */
  function isAuthed() {
    try {
      var a = JSON.parse(sessionStorage.getItem(AUTH_KEY));
      return a && a.ok === true;
    } catch (e) { return false; }
  }
  function setAuthed() { sessionStorage.setItem(AUTH_KEY, JSON.stringify({ ok: true, ts: Date.now() })); }
  function logout() { sessionStorage.removeItem(AUTH_KEY); sessionStorage.removeItem(OTP_KEY); location.href = "admin.html"; }

  function genCode() { return String(Math.floor(100000 + Math.random() * 900000)); }

  function loadEmailJs() {
    return new Promise(function (resolve, reject) {
      if (window.emailjs) return resolve(window.emailjs);
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js";
      s.onload = function () { resolve(window.emailjs); };
      s.onerror = function () { reject(new Error("EmailJS SDK failed to load")); };
      document.head.appendChild(s);
    });
  }

  function sendOtp() {
    var code = genCode();
    var ttl = (ADMIN.otpTtlMinutes || 10) * 60 * 1000;
    sessionStorage.setItem(OTP_KEY, JSON.stringify({ code: code, exp: Date.now() + ttl, email: ADMIN.email }));
    var ej = ADMIN.emailjs || {};
    var configured = ej.publicKey && ej.serviceId && ej.templateId;
    if (configured) {
      return loadEmailJs().then(function (emailjs) {
        emailjs.init({ publicKey: ej.publicKey });
        return emailjs.send(ej.serviceId, ej.templateId, {
          passcode: code,
          to_email: ADMIN.email,
          email: ADMIN.email,
          time: (ADMIN.otpTtlMinutes || 10) + " minutes"
        });
      }).then(function () {
        return { sent: true };
      });
    }
    // Dev fallback
    if (ADMIN.devMode) {
      console.warn("[CrochetNest] DEV MODE — OTP is " + code + ". Configure EmailJS + set devMode:false for production.");
      window.alert("DEV MODE (no EmailJS configured)\n\nYour one-time code is: " + code + "\n\nSet admin.devMode = false and configure EmailJS in assets/config.js for production.");
      return Promise.resolve({ sent: true, dev: true });
    }
    return Promise.reject(new Error("EmailJS is not configured. Set admin.emailjs keys or enable devMode in assets/config.js."));
  }

  function verifyOtp(entered) {
    var raw = sessionStorage.getItem(OTP_KEY);
    if (!raw) return { ok: false, msg: "Please request a code first." };
    var o;
    try { o = JSON.parse(raw); } catch (e) { return { ok: false, msg: "Please request a new code." }; }
    if (Date.now() > o.exp) return { ok: false, msg: "Code expired — request a new one." };
    if (String(entered) !== String(o.code)) return { ok: false, msg: "Incorrect code." };
    return { ok: true };
  }

  /* ================= LOGIN PAGE ================= */
  function initLogin() {
    if (isAuthed()) { location.href = "admin-dashboard.html"; return; }
    $("#admin-email").value = ADMIN.email || "";
    var ttlEl = $("#ttl"); if (ttlEl) ttlEl.textContent = ADMIN.otpTtlMinutes || 10;

    function maskEmail(e) { var p = String(e).split("@"); if (p.length !== 2) return e; var u = p[0]; return u.slice(0, 1) + "\u2022\u2022\u2022\u2022\u2022\u2022" + u.slice(-2) + "@" + p[1]; }

    function goOtpStep() {
      $("#step-email").classList.add("is-hidden");
      $("#step-otp").classList.remove("is-hidden");
      $("#otp-sub").textContent = "Step 2 — sent to " + maskEmail(ADMIN.email);
      var first = $("#otp-inputs input"); if (first) first.focus();
    }

    var sendBtn = $("#send-otp");
    function doSend() {
      sendBtn.disabled = true; sendBtn.textContent = "Sending…";
      sendOtp().then(function (r) {
        sendBtn.disabled = false; sendBtn.textContent = "Send OTP to my email";
        goOtpStep();
        if (!r.dev) toast("Code sent to " + maskEmail(ADMIN.email), true);
      }).catch(function (err) {
        sendBtn.disabled = false; sendBtn.textContent = "Send OTP to my email";
        var h = $("#email-hint"); if (h) { h.textContent = err.message; h.style.color = "var(--coral)"; }
        toast(err.message);
      });
    }
    sendBtn.addEventListener("click", doSend);
    var resend = $("#resend"); if (resend) resend.addEventListener("click", function (e) { e.preventDefault(); doSend(); toast("New code sent"); });

    // OTP input UX
    var inputs = $all("#otp-inputs input");
    inputs.forEach(function (inp, i) {
      inp.addEventListener("input", function () {
        inp.value = inp.value.replace(/\D/g, "");
        if (inp.value && i < inputs.length - 1) inputs[i + 1].focus();
        inp.classList.toggle("on", !!inp.value);
      });
      inp.addEventListener("keydown", function (e) {
        if (e.key === "Backspace" && !inp.value && i > 0) inputs[i - 1].focus();
        if (e.key === "Enter") $("#verify-otp").click();
      });
      inp.addEventListener("paste", function (e) {
        var d = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
        if (d) { e.preventDefault(); d.split("").forEach(function (ch, k) { if (inputs[k]) { inputs[k].value = ch; inputs[k].classList.add("on"); } }); (inputs[Math.min(d.length, 5)] || inputs[5]).focus(); }
      });
    });

    $("#verify-otp").addEventListener("click", function () {
      var code = inputs.map(function (i) { return i.value; }).join("");
      if (code.length < 6) { toast("Enter all 6 digits"); return; }
      var r = verifyOtp(code);
      if (!r.ok) { toast(r.msg); var h = $("#otp-hint"); if (h) { h.textContent = r.msg; h.style.color = "var(--coral)"; } return; }
      setAuthed();
      sessionStorage.removeItem(OTP_KEY);
      location.href = "admin-dashboard.html";
    });
  }

  /* ================= GITHUB ================= */
  function ghToken() { return sessionStorage.getItem(TOKEN_KEY) || ""; }
  function ghHeaders() { return { "Authorization": "Bearer " + ghToken(), "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }; }
  function ghUrl() { return "https://api.github.com/repos/" + GH.owner + "/" + GH.repo + "/contents/" + GH.productsPath; }

  function ghGet() {
    return fetch(ghUrl() + "?ref=" + encodeURIComponent(GH.branch) + "&t=" + Date.now(), { headers: ghHeaders() })
      .then(function (r) {
        if (r.status === 404) return { data: { products: [] }, sha: null };
        if (!r.ok) throw new Error("GitHub read failed (" + r.status + ")");
        return r.json().then(function (j) { return { data: JSON.parse(b64DecodeUnicode(j.content)), sha: j.sha }; });
      });
  }
  function ghPut(dataObj, sha) {
    var body = {
      message: "Update products via CrochetNest admin",
      content: b64EncodeUnicode(JSON.stringify(dataObj, null, 2) + "\n"),
      branch: GH.branch
    };
    if (sha) body.sha = sha;
    return fetch(ghUrl(), { method: "PUT", headers: ghHeaders(), body: JSON.stringify(body) })
      .then(function (r) { if (!r.ok) return r.json().then(function (j) { throw new Error("GitHub write failed: " + (j.message || r.status)); }); return r.json(); });
  }

  /* ================= DASHBOARD ================= */
  function initDashboard() {
    if (!isAuthed()) { location.href = "admin.html"; return; }

    var state = { products: [], sha: null, editingId: null };

    // category select
    var sel = $("#f-category");
    (CFG.categories || []).forEach(function (c) { var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o); });

    $("#logout").addEventListener("click", logout);

    renderTokenNotice();

    function setPublishState() {
      var el = $("#publish-state");
      if (ghToken()) { el.className = "badge-live ok"; el.innerHTML = '<span class="d"></span> Connected to GitHub'; }
      else { el.className = "badge-live"; el.innerHTML = '<span class="d"></span> Not connected'; }
    }

    function renderTokenNotice() {
      var box = $("#gh-notice");
      if (ghToken()) {
        box.innerHTML = '<div class="notice">Connected to GitHub — changes you publish update <b>' + esc(GH.owner + "/" + GH.repo) + "</b> (" + esc(GH.productsPath) + '). <a href="#" id="gh-disconnect" style="color:var(--mint)">Disconnect</a></div>';
        var dc = $("#gh-disconnect"); if (dc) dc.addEventListener("click", function (e) { e.preventDefault(); sessionStorage.removeItem(TOKEN_KEY); setPublishState(); renderTokenNotice(); load(); });
      } else {
        box.innerHTML =
          '<div class="notice warn">To publish edits to the live site, connect a GitHub <b>fine-grained Personal Access Token</b> with <b>Contents: Read &amp; write</b> on this repo. It is stored only in this browser tab and never committed. Without it you can still edit locally and use <b>Download JSON</b>.' +
          '<div class="token-row" style="margin-top:12px"><input id="gh-token" type="password" placeholder="github_pat_…" style="flex:1;background:var(--bg);border:1px solid var(--stroke);color:var(--ink);padding:10px 14px;border-radius:10px;font-size:14px"><button class="btn btn-mint" id="gh-connect">Connect</button></div></div>';
        var cn = $("#gh-connect");
        cn.addEventListener("click", function () {
          var v = $("#gh-token").value.trim();
          if (!v) { toast("Paste a token first"); return; }
          sessionStorage.setItem(TOKEN_KEY, v);
          setPublishState();
          toast("Verifying token…");
          load(true);
        });
      }
      setPublishState();
    }

    function computeStats() {
      var ps = state.products;
      $("#s-total").textContent = ps.length;
      var cats = {}; ps.forEach(function (p) { cats[p.category] = 1; });
      $("#s-cats").textContent = Object.keys(cats).length;
      var avg = ps.length ? Math.round(ps.reduce(function (s, p) { return s + Number(p.price || 0); }, 0) / ps.length) : 0;
      $("#s-avg").textContent = money(avg);
      var avgShip = ps.length ? Math.round(ps.reduce(function (s, p) { return s + Number(p.shipDays || 0); }, 0) / ps.length) : 0;
      $("#s-ship").textContent = avgShip + "d";
    }

    function swatchFor(p, i) { return p.swatch || SWATCHES[i % SWATCHES.length]; }

    function renderTable() {
      var tb = $("#prod-rows");
      if (!state.products.length) { tb.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:40px">No products yet. Click “Add product”.</td></tr>'; computeStats(); return; }
      tb.innerHTML = state.products.map(function (p, i) {
        var img = p.image ? '<img class="photo" src="' + esc(p.image) + '" alt="">' : '<div class="ph ' + swatchFor(p, i) + '"></div>';
        return "<tr>" +
          '<td><div class="tprod"><div class="im">' + img + '</div><div class="nm">' + esc(p.name) + "</div></div></td>" +
          '<td><span class="pill">' + esc(p.category) + "</span></td>" +
          "<td>" + money(p.price) + "</td>" +
          "<td>~" + esc(p.shipDays) + " days</td>" +
          '<td><div class="tacts"><div class="icon-btn" data-edit="' + esc(p.id) + '">\u270e</div><div class="icon-btn" data-del="' + esc(p.id) + '">\u2715</div></div></td>' +
        "</tr>";
      }).join("");
      computeStats();
    }

    function load(afterConnect) {
      var tb = $("#prod-rows");
      tb.innerHTML = '<tr><td colspan="5"><div class="spinner"></div></td></tr>';
      var loader = ghToken() ? ghGet() : fetch("data/products.json?t=" + Date.now()).then(function (r) { return r.json(); }).then(function (d) { return { data: d, sha: null }; });
      loader.then(function (res) {
        state.products = (res.data && res.data.products) || [];
        state.sha = res.sha;
        renderTable();
        if (afterConnect) toast("Connected — loaded live data", true);
      }).catch(function (err) {
        if (afterConnect) { sessionStorage.removeItem(TOKEN_KEY); setPublishState(); renderTokenNotice(); }
        toast(err.message);
        // fall back to local file
        fetch("data/products.json?t=" + Date.now()).then(function (r) { return r.json(); }).then(function (d) { state.products = d.products || []; renderTable(); }).catch(function () { renderTable(); });
      });
    }

    /* ---- modal ---- */
    function openModal(product) {
      state.editingId = product ? product.id : null;
      $("#modal-title").textContent = product ? "Edit product" : "Add product";
      $("#f-name").value = product ? product.name : "";
      $("#f-category").value = product ? product.category : (CFG.categories || [])[0] || "";
      $("#f-price").value = product ? product.price : "";
      $("#f-image").value = product ? (product.image || "") : "";
      $("#f-material").value = product ? (product.material || "") : "";
      $("#f-size").value = product ? (product.size || "") : "";
      $("#f-desc").value = product ? (product.description || "") : "";
      var sd = $("#f-shipdate");
      if (product && product.shipDays != null) {
        var d = new Date(); d.setDate(d.getDate() + Number(product.shipDays));
        sd.value = d.toISOString().slice(0, 10);
      } else { sd.value = ""; }
      $("#modal-overlay").classList.add("open");
      $("#prod-modal").classList.add("open");
    }
    function closeModal() { $("#modal-overlay").classList.remove("open"); $("#prod-modal").classList.remove("open"); }

    function saveModal() {
      var name = $("#f-name").value.trim();
      var price = Number($("#f-price").value);
      if (!name) { toast("Product name is required"); return; }
      if (!(price >= 0)) { toast("Enter a valid price"); return; }
      var shipDays = 7;
      var sd = $("#f-shipdate").value;
      if (sd) { var diff = Math.ceil((new Date(sd).getTime() - Date.now()) / 86400000); shipDays = Math.max(1, diff); }
      var payload = {
        name: name,
        category: $("#f-category").value,
        price: price,
        shipDays: shipDays,
        shipDate: sd || "",
        description: $("#f-desc").value.trim(),
        material: $("#f-material").value.trim(),
        size: $("#f-size").value.trim(),
        image: $("#f-image").value.trim()
      };
      if (state.editingId) {
        state.products = state.products.map(function (p) { return p.id === state.editingId ? Object.assign({}, p, payload) : p; });
      } else {
        var id = slugify(name);
        var ids = {}; state.products.forEach(function (p) { ids[p.id] = 1; });
        if (ids[id]) id = id + "-" + Date.now().toString(36).slice(-4);
        payload.id = id;
        payload.swatch = SWATCHES[state.products.length % SWATCHES.length];
        state.products.push(payload);
      }
      closeModal();
      renderTable();
      toast(ghToken() ? "Saved — click Publish to go live" : "Saved locally — Download JSON or connect GitHub", true);
    }

    function publish() {
      if (!ghToken()) { toast("Connect a GitHub token to publish"); return; }
      var btn = $("#publish"); btn.disabled = true; btn.textContent = "Publishing…";
      ghGet().then(function (res) {
        return ghPut({ products: state.products }, res.sha);
      }).then(function () {
        btn.disabled = false; btn.textContent = "Publish changes";
        toast("Published to the live site \uD83C\uDF89", true);
      }).catch(function (err) {
        btn.disabled = false; btn.textContent = "Publish changes";
        toast(err.message);
      });
    }

    function downloadJson() {
      var blob = new Blob([JSON.stringify({ products: state.products }, null, 2) + "\n"], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "products.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast("Downloaded products.json", true);
    }

    // wire
    $("#add-product").addEventListener("click", function () { openModal(null); });
    $("#modal-close").addEventListener("click", closeModal);
    $("#modal-cancel").addEventListener("click", closeModal);
    $("#modal-overlay").addEventListener("click", closeModal);
    $("#modal-save").addEventListener("click", saveModal);
    $("#publish").addEventListener("click", publish);
    $("#download-json").addEventListener("click", downloadJson);
    $("#prod-rows").addEventListener("click", function (e) {
      var ed = e.target.getAttribute("data-edit"); if (ed) { openModal(state.products.filter(function (p) { return p.id === ed; })[0]); return; }
      var dl = e.target.getAttribute("data-del"); if (dl) {
        var p = state.products.filter(function (x) { return x.id === dl; })[0];
        if (p && window.confirm("Delete “" + p.name + "”? Remember to Publish to apply on the live site.")) {
          state.products = state.products.filter(function (x) { return x.id !== dl; });
          renderTable();
        }
      }
    });

    load();
  }

  /* ================= BOOT ================= */
  document.addEventListener("DOMContentLoaded", function () {
    var page = document.body.getAttribute("data-page");
    if (page === "admin-login") initLogin();
    else if (page === "admin-dashboard") initDashboard();
  });
})();
