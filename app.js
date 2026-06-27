/* أذكار — منطق التطبيق (أذكار + حصن المسلم + بطاقات + أعمال + مواقيت) */
(function () {
  "use strict";

  const view = document.getElementById("view");
  const appTitle = document.getElementById("appTitle");
  const backBtn = document.getElementById("backBtn");
  const themeBtn = document.getElementById("themeBtn");
  const tabbar = document.getElementById("tabbar");

  const SITE = "athkar.vercel.app";
  const APP_NAME = "أذكار";
  let currentTab = "athkar";
  let goBack = null; // وجهة زر الرجوع حسب الشاشة الحالية

  // رمز QR للموقع (بديل أنيق للدومين على البطاقات)
  const qrImg = new Image();
  qrImg.src = "icons/qr.png";
  qrImg.onload = () => { if (document.getElementById("cardCanvas")) drawCard(); };

  const todayDate = new Date();
  const today = todayDate.toISOString().slice(0, 10);
  const PROGRESS_KEY = "athkar_progress_" + today;
  let progress = loadProgress();

  function loadProgress() {
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("athkar_progress_") && k !== PROGRESS_KEY) localStorage.removeItem(k);
      }
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    } catch (e) { return {}; }
  }
  function saveProgress() { try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {} }
  function getRemaining(catId, idx, total) {
    if (progress[catId] && typeof progress[catId][idx] === "number") return progress[catId][idx];
    return total;
  }
  function setRemaining(catId, idx, val) {
    if (!progress[catId]) progress[catId] = {};
    progress[catId][idx] = val; saveProgress();
  }

  const ICONS = { sunrise: "🌅", moon: "🌙", mosque: "🕌", bed: "🛏️", sun: "☀️", beads: "📿", parents: "👪", anbiya: "⭐", ruqya: "🛡️" };
  if (typeof ADHKAR_EXTRA !== "undefined" && Array.isArray(ADHKAR_EXTRA)) { try { ADHKAR.push.apply(ADHKAR, ADHKAR_EXTRA); } catch (e) {} }

  // فهرس موحّد لكل أذكار التطبيق (للبحث في مكتبة البطاقات)
  function stripD(s) { return String(s).replace(/[ً-ْٰـ]/g, ""); }
  const CARD_POOL = [];
  (function buildCardPool() {
    const seen = new Set();
    const add = (t, s) => { if (!t) return; const k = t.replace(/\s+/g, ""); if (seen.has(k)) return; seen.add(k); CARD_POOL.push({ t: t, s: s || "", n: stripD(t) }); };
    if (typeof CARD_GROUPS !== "undefined") CARD_GROUPS.forEach(g => g.items.forEach(it => add(it.t, it.s)));
    if (typeof ADHKAR !== "undefined") ADHKAR.forEach(c => c.items.forEach(it => add(it.text, it.source)));
    if (typeof HISN !== "undefined") HISN.forEach(c => c.items.forEach(it => add(it.text, "حصن المسلم — " + c.title)));
  })();

  // تمييز النص النبوي وإضافة تمهيد مع الصلاة عليه ﷺ (القرآن لا يحتاج تمهيدًا)
  function normSrc(s) { return stripD(s || "").replace(/[أإآٱ]/g, "ا"); }
  function isQuranSrc(s) { return /سورة|القران|قران|الفاتحة|الكرسي/.test(normSrc(s)); }
  function isHadithSrc(s) { return /(رواه|متفق|البخاري|مسلم|الترمذي|ابو داود|ابن ماجه|النسائي|احمد|الالباني|الحاكم|ابن حبان|الطبراني|حصن المسلم|صحيح|حسن|صححه|حسنه|السيوطي)/.test(normSrc(s)); }
  function looksLikeDua(t) { const x = normSrc(t); return /^(اللهم|ربنا|رب|يا)/.test(x) || /(اعوذ بك|اسالك|اغفر|ارحم|اعني)/.test(x); }
  function prophetPreamble(text, source) {
    if (isQuranSrc(source)) return "";
    if (/عليه السلام/.test(normSrc(source))) return "";
    if (isHadithSrc(source)) return looksLikeDua(text) ? "من دعاء النبي ﷺ" : "ثبت عن النبي ﷺ";
    return "";
  }

  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function vibrate(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

  /* ============== التبويبات ============== */
  tabbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab"); if (!btn) return;
    switchTab(btn.dataset.tab);
  });
  function switchTab(tab) {
    stopAudio();
    goBack = null;
    currentTab = tab;
    tabbar.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    backBtn.classList.add("hidden");
    if (tab === "athkar") renderAthkarHome();
    else if (tab === "quran") renderQuran();
    else if (tab === "cards") renderCards();
    else if (tab === "deeds") renderDeeds();
    else if (tab === "prayer") renderPrayer();
  }

  /* ============== تبويب الأذكار ============== */
  function tickerHTML() {
    return `<div class="ticker-wrap">
      <div class="ticker a"><span class="tk-now" id="tkA"></span></div>
      <div class="ticker b"><span class="tk-now" id="tkB"></span></div>
    </div>`;
  }
  let tickerTimers = [];
  function startTickers() {
    tickerTimers.forEach(clearInterval); tickerTimers = [];
    const drive = (id, arr, period) => {
      const el = document.getElementById(id); if (!el || !arr || !arr.length) return;
      let i = Math.floor(Math.random() * arr.length);
      el.textContent = arr[i]; requestAnimationFrame(() => el.classList.add("show"));
      const step = () => {
        if (!document.body.contains(el)) return;
        el.classList.remove("show"); // تلاشٍ للخارج
        setTimeout(() => {
          if (!document.body.contains(el)) return;
          i = (i + 1) % arr.length; el.textContent = arr[i];
          requestAnimationFrame(() => el.classList.add("show")); // ومضة دخول
        }, 600);
      };
      tickerTimers.push(setInterval(step, period));
    };
    drive("tkA", TICKER_TASBIH, 4000);
    setTimeout(() => drive("tkB", TICKER_ISTIGHFAR, 4600), 2000);
  }

  function renderAthkarHome() {
    appTitle.textContent = APP_NAME;
    backBtn.classList.add("hidden");
    goBack = null;
    let html = tickerHTML();
    html += `<div class="share-banner">
      <div class="sb-main"><span class="sb-emoji">🤲</span>
        <div class="sb-txt"><b>اجعلها صدقةً جارية</b><small>دُلّ غيرك على الخير، فلك مثلُ أجرِ من عمل به</small></div>
      </div>
      <button class="sb-share" id="spreadBtn">📤 انشُر الأجر</button>
      <div class="sb-count" id="visitCount"></div>
    </div>`;
    // الأذكار اليومية والأدعية المختارة — صفوف مرتّبة موفّرة للمساحة
    html += `<div class="sec-title">الأذكار اليومية والأدعية</div><div class="acat-list">`;
    ADHKAR.forEach(cat => {
      const done = countDone(cat), full = done === cat.items.length;
      html += `<button class="acat-row ${full ? "full" : ""}" data-cat="${cat.id}">
        <span class="ar-ic">${ICONS[cat.icon] || "📿"}</span>
        <span class="ar-txt"><b>${cat.title}</b><small>${cat.subtitle || ""}</small></span>
        <span class="ar-count">${full ? "✓ " : ""}${done}/${cat.items.length}</span></button>`;
    });
    html += "</div>";
    // حصن المسلم — كامل الأبواب مدمج وقابل للبحث (المرجع المعتمد)
    if (typeof HISN !== "undefined") {
      const total = HISN.reduce((s, c) => s + c.items.length, 0);
      html += `<div class="sec-title">📕 حصن المسلم — ${HISN.length} بابًا · ${total} ذكرًا</div>
        <input id="hisnSearch" class="hisn-search" type="search" placeholder="🔍 ابحث في أبواب حصن المسلم (المنزل، السفر، الطعام…)" />
        <div class="hisn-list" id="hisnList"></div>`;
    }
    html += `<button class="about-link" id="aboutBtn">ℹ️ المصادر ومنهج التوثيق</button>`;
    view.innerHTML = html;
    view.querySelectorAll(".acat-row").forEach(el => el.addEventListener("click", () => renderCategory(el.dataset.cat)));
    if (typeof HISN !== "undefined") {
      renderHisnList("");
      const s = document.getElementById("hisnSearch");
      s.addEventListener("input", () => renderHisnList(s.value));
    }
    document.getElementById("aboutBtn").addEventListener("click", renderAbout);
    const spread = document.getElementById("spreadBtn");
    if (spread) spread.addEventListener("click", spreadSite);
    loadVisits();
    startTickers();
    window.scrollTo(0, 0);
  }
  function spreadSite() {
    const text = "🌿 أذكار — حصّن يومك بالأذكار الصحيحة الموثّقة، مع القرآن والتفسير الميسّر.\nدُلّ غيرك على الخير فلك مثلُ أجرِه، صدقةٌ جارية:\n";
    const url = "https://" + SITE + "/";
    if (navigator.share) { navigator.share({ title: "أذكار", text, url }).catch(() => {}); return; }
    const b = document.getElementById("spreadBtn");
    if (navigator.clipboard) navigator.clipboard.writeText(text + url).then(() => {
      if (b) { const o = b.textContent; b.textContent = "✓ نُسِخ الرابط — انشُره"; setTimeout(() => b.textContent = o, 2200); }
    });
  }
  async function loadVisits() {
    const el = document.getElementById("visitCount"); if (!el) return;
    const NS = "athkar-vercel-app";
    try {
      const inc = !sessionStorage.getItem("av_counted");
      const u = "https://api.counterapi.dev/v1/" + NS + "/visits" + (inc ? "/up" : "/");
      const r = await fetch(u); const j = await r.json();
      const n = j && typeof j.count === "number" ? j.count : null;
      if (n === null) { el.style.display = "none"; return; }
      if (inc) sessionStorage.setItem("av_counted", "1");
      el.textContent = "🌿 زارَنا " + n.toLocaleString("ar-EG") + " — جزى الله كلَّ من نشرها خيرًا";
    } catch (e) { el.style.display = "none"; }
  }
  function countDone(cat) {
    let d = 0; cat.items.forEach((it, i) => { if (getRemaining(cat.id, i, it.count) === 0) d++; }); return d;
  }

  /* ----- حصن المسلم الكامل ----- */
  function hcid(id) { return "h" + id; }
  function renderHisnList(filter) {
    const box = document.getElementById("hisnList"); if (!box) return;
    const q = (filter || "").trim();
    const list = q ? HISN.filter(c => c.title.includes(q)) : HISN;
    if (!list.length) { box.innerHTML = `<p class="muted-line">لا نتائج مطابقة.</p>`; return; }
    box.innerHTML = list.map(c => {
      let done = 0; c.items.forEach((it, i) => { if (getRemaining(hcid(c.id), i, it.count) === 0) done++; });
      const full = done === c.items.length;
      return `<button class="hisn-row ${full ? "full" : ""}" data-id="${c.id}">
        <span class="hr-title">${esc(c.title)}</span>
        <span class="hr-count">${full ? "✓ " : ""}${c.items.length}</span></button>`;
    }).join("");
    box.querySelectorAll(".hisn-row").forEach(b => b.addEventListener("click", () => renderHisnChapter(parseInt(b.dataset.id, 10))));
  }

  function renderHisnChapter(id) {
    const ch = HISN.find(c => c.id === id); if (!ch) return renderAthkarHome();
    appTitle.textContent = ch.title;
    backBtn.classList.remove("hidden");
    goBack = renderAthkarHome;
    const cid = hcid(id);
    let html = `<div class="cat-head"><h2>${esc(ch.title)}</h2><p>من كتاب حصن المسلم</p></div>`;
    if (ch.audio) html += `<button class="audio-btn" id="audioBtn" data-src="${ch.audio}">▶ استماع للباب</button>`;
    html += `<div class="progress-wrap"><div class="progress-track"><div class="progress-fill" id="progFill"></div></div>
      <div class="progress-label" id="progLabel"></div></div>`;
    ch.items.forEach((item, idx) => {
      const remaining = getRemaining(cid, idx, item.count);
      const done = remaining === 0;
      html += `<div class="dhikr-card ${done ? "done" : ""}" data-idx="${idx}">
          <div class="dhikr-text">${item.text}</div>
          <div class="dhikr-bottom"><span class="source">حصن المسلم</span>
            <button class="counter ${done ? "complete" : ""}" data-idx="${idx}">
              <span class="num">${done ? "✓" : remaining}</span><span class="lbl">${done ? "تم" : "اضغط"}</span></button></div>
          <div class="dhikr-actions">
            <button class="mini-act" data-act="share" data-idx="${idx}">📤 مشاركة</button>
            <button class="mini-act" data-act="card" data-idx="${idx}">🎴 بطاقة</button></div></div>`;
    });
    html += `<button class="reset-cat" id="resetCat">إعادة ضبط هذا الباب</button>`;
    view.innerHTML = html;
    view.querySelectorAll(".counter").forEach(btn =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); tapHisn(ch, cid, parseInt(btn.dataset.idx, 10)); }));
    view.querySelectorAll(".mini-act").forEach(btn => btn.addEventListener("click", () => {
      const it = ch.items[parseInt(btn.dataset.idx, 10)];
      if (btn.dataset.act === "share") shareDhikr(it.text, "حصن المسلم"); else makeCard(it.text, "حصن المسلم", ch.title);
    }));
    document.getElementById("resetCat").addEventListener("click", () => {
      if (progress[cid]) { delete progress[cid]; saveProgress(); } renderHisnChapter(id);
    });
    const ab = document.getElementById("audioBtn");
    if (ab) ab.addEventListener("click", () => toggleAudio(ab));
    updateHisnProgress(ch, cid); window.scrollTo(0, 0);
  }
  function tapHisn(ch, cid, idx) {
    const item = ch.items[idx];
    let r = getRemaining(cid, idx, item.count);
    r = r <= 0 ? item.count : r - 1;
    setRemaining(cid, idx, r);
    vibrate(r === 0 ? [12, 40, 12] : 10);
    const card = view.querySelector(`.dhikr-card[data-idx="${idx}"]`);
    const btn = view.querySelector(`.counter[data-idx="${idx}"]`);
    const done = r === 0;
    btn.querySelector(".num").textContent = done ? "✓" : r;
    btn.querySelector(".lbl").textContent = done ? "تم" : "اضغط";
    btn.classList.toggle("complete", done); card.classList.toggle("done", done);
    updateHisnProgress(ch, cid);
  }
  function updateHisnProgress(ch, cid) {
    const total = ch.items.length;
    let done = 0; ch.items.forEach((it, i) => { if (getRemaining(cid, i, it.count) === 0) done++; });
    const pct = Math.round((done / total) * 100);
    const fill = document.getElementById("progFill"), label = document.getElementById("progLabel");
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = `${done} من ${total} (${pct}%)`;
  }

  let currentAudio = null;
  function stopAudio() { if (currentAudio) { try { currentAudio.pause(); } catch (e) {} } }
  function toggleAudio(btn) {
    if (currentAudio && !currentAudio.paused) {
      currentAudio.pause(); btn.textContent = "▶ استماع للباب"; return;
    }
    if (!currentAudio || currentAudio._src !== btn.dataset.src) {
      if (currentAudio) currentAudio.pause();
      currentAudio = new Audio(btn.dataset.src); currentAudio._src = btn.dataset.src;
      currentAudio.addEventListener("ended", () => { btn.textContent = "▶ استماع للباب"; });
      currentAudio.addEventListener("error", () => { toast("تعذّر تشغيل الصوت"); btn.textContent = "▶ استماع للباب"; });
    }
    currentAudio.play().then(() => btn.textContent = "⏸ إيقاف").catch(() => toast("تعذّر تشغيل الصوت"));
  }

  function renderCategory(catId) {
    const cat = ADHKAR.find(c => c.id === catId); if (!cat) return renderAthkarHome();
    appTitle.textContent = cat.title;
    backBtn.classList.remove("hidden");
    goBack = renderAthkarHome;
    let html = `<div class="cat-head"><h2>${cat.title}</h2><p>${cat.subtitle}</p></div>
      <div class="progress-wrap"><div class="progress-track"><div class="progress-fill" id="progFill"></div></div>
      <div class="progress-label" id="progLabel"></div></div><div id="completeBanner"></div>`;
    cat.items.forEach((item, idx) => {
      const remaining = getRemaining(cat.id, idx, item.count);
      const done = remaining === 0;
      html += `<div class="dhikr-card ${done ? "done" : ""}" data-idx="${idx}">
          <div class="dhikr-text ${isQuranSrc(item.source) ? "quran" : ""}">${item.text}</div>
          <div class="dhikr-meta"><span class="badge">التكرار: ${item.count}</span><span class="badge virtue">${esc(item.virtue)}</span></div>
          <div class="dhikr-bottom"><span class="source">${esc(item.source)}</span>
            <button class="counter ${done ? "complete" : ""}" data-idx="${idx}">
              <span class="num">${done ? "✓" : remaining}</span><span class="lbl">${done ? "تم" : "اضغط"}</span></button></div>
          <div class="dhikr-actions">
            <button class="mini-act" data-act="share" data-idx="${idx}">📤 مشاركة</button>
            <button class="mini-act" data-act="card" data-idx="${idx}">🎴 بطاقة</button></div></div>`;
    });
    html += `<button class="reset-cat" id="resetCat">إعادة ضبط هذه الفئة</button>`;
    view.innerHTML = html;
    view.querySelectorAll(".counter").forEach(btn =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); tapCounter(cat, parseInt(btn.dataset.idx, 10)); }));
    view.querySelectorAll(".mini-act").forEach(btn => btn.addEventListener("click", () => {
      const it = cat.items[parseInt(btn.dataset.idx, 10)];
      if (btn.dataset.act === "share") shareDhikr(it.text, it.source); else makeCard(it.text, it.source, cat.title);
    }));
    document.getElementById("resetCat").addEventListener("click", () => {
      if (progress[cat.id]) { delete progress[cat.id]; saveProgress(); } renderCategory(cat.id);
    });
    updateProgress(cat); window.scrollTo(0, 0);
  }
  function tapCounter(cat, idx) {
    const item = cat.items[idx];
    let r = getRemaining(cat.id, idx, item.count);
    r = r <= 0 ? item.count : r - 1;
    setRemaining(cat.id, idx, r);
    vibrate(r === 0 ? [12, 40, 12] : 10);
    const card = view.querySelector(`.dhikr-card[data-idx="${idx}"]`);
    const btn = view.querySelector(`.counter[data-idx="${idx}"]`);
    const done = r === 0;
    btn.querySelector(".num").textContent = done ? "✓" : r;
    btn.querySelector(".lbl").textContent = done ? "تم" : "اضغط";
    btn.classList.toggle("complete", done); card.classList.toggle("done", done);
    updateProgress(cat);
  }
  function updateProgress(cat) {
    const total = cat.items.length, done = countDone(cat), pct = Math.round((done / total) * 100);
    const fill = document.getElementById("progFill"), label = document.getElementById("progLabel"), banner = document.getElementById("completeBanner");
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = `${done} من ${total} (${pct}%)`;
    if (banner) banner.innerHTML = done === total ? `<div class="complete-banner">تقبّل الله — أتممت ${cat.title} 🤲</div>` : "";
  }

  /* ============== تبويب البطاقات ============== */
  const SIZES = [
    { id: "story", name: "ستوري · واتساب/سناب", short: "واتساب/سناب", w: 1440, h: 2560 },
    { id: "square", name: "مربع · منشور", short: "مربع", w: 2000, h: 2000 },
    { id: "portrait", name: "عمودي · انستقرام", short: "انستقرام", w: 1620, h: 2025 },
    { id: "wide", name: "عريض · تويتر/فيسبوك", short: "عريض", w: 1920, h: 1080 }
  ];
  const FILTER_PRESETS = [
    { key: "original", name: "أصلي", f: { brightness: 100, contrast: 102, saturate: 105, sepia: 0, blur: 0 } },
    { key: "bw", name: "أبيض وأسود", f: { brightness: 102, contrast: 112, saturate: 0, sepia: 0, blur: 0 } },
    { key: "warm", name: "دافئ", f: { brightness: 104, contrast: 104, saturate: 120, sepia: 30, blur: 0 } },
    { key: "cool", name: "بارد", f: { brightness: 102, contrast: 106, saturate: 85, sepia: 0, blur: 0 } },
    { key: "luxury", name: "فاخر", f: { brightness: 95, contrast: 118, saturate: 92, sepia: 12, blur: 0 } },
    { key: "dreamy", name: "حالم", f: { brightness: 108, contrast: 98, saturate: 112, sepia: 0, blur: 2 } }
  ];
  let cardState = {
    text: "", source: "", theme: 0, sizeIdx: 0, bgImage: null, filterKey: "original",
    filter: { brightness: 100, contrast: 102, saturate: 105, sepia: 0, blur: 0, dark: 0.45 },
    textScale: 1, textColor: "", img: { zoom: 1, ox: 0, oy: 0, fit: "cover" }, frame: "double", pattern: "", title: "", bg: "", fromName: "", toName: "",
    layers: [], sel: -1, textPos: "center"
  };
  const FRAMES = [
    { k: "double", n: "مزدوج" }, { k: "simple", n: "بسيط" }, { k: "corners", n: "زوايا" },
    { k: "dashed", n: "متقطّع" }, { k: "ornate", n: "مزخرف" },
    { k: "thick", n: "عريض" }, { k: "beaded", n: "لؤلؤي" }, { k: "deco", n: "آرت ديكو" },
    { k: "inner", n: "غائر" }, { k: "ribbon", n: "شريطي" }, { k: "none", n: "بدون" }
  ];
  const PATTERNS = [
    { k: "", n: "تلقائي" }, { k: "none", n: "بدون" }, { k: "dots", n: "نقاط" }, { k: "stars", n: "نجوم" },
    { k: "rays", n: "أشعة" }, { k: "diamonds", n: "معيّنات" }, { k: "grid", n: "شبكة" },
    { k: "girih", n: "نجوم هندسية" }, { k: "scales", n: "حراشف" }, { k: "waves", n: "أمواج" },
    { k: "chevron", n: "متعرّج" }, { k: "arabesque", n: "أرابيسك" }
  ];
  const BACKGROUNDS = [
    { k: "", n: "بدون" }, { k: "mosque", n: "🕌 مسجد" }, { k: "dome", n: "قبة" }, { k: "night", n: "🌙 ليل ونجوم" },
    { k: "arch", n: "محراب" }, { k: "lantern", n: "🏮 فوانيس" }, { k: "girih", n: "زخرفة هندسية" },
    { k: "rays", n: "✨ نور" }, { k: "bokeh", n: "تلألؤ" }
  ];
  const TEXT_COLORS = ["gold", "#ffffff", "#f7e9c2", "#e6cf95", "#ffd97d", "#f5c6d6", "#bfe8ee", "#1c2625", "#0c1716"];
  const RAIL_COLORS = ["gold", "#ffffff", "#e6cf95", "#f5c6d6", "#bfe8ee", "#0c1716"];
  const GOLD_GRAD = "linear-gradient(135deg,#f9df8c 0%,#fff3c4 22%,#d4af37 52%,#f7e69b 74%,#b8860b 100%)";
  function swatchBg(c) { return c === "gold" ? GOLD_GRAD : c; }
  function goldFill(ctx, top, bot) {
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "#f9df8c"); g.addColorStop(0.25, "#fff3c4"); g.addColorStop(0.5, "#d4af37");
    g.addColorStop(0.75, "#f7e69b"); g.addColorStop(1, "#b8860b"); return g;
  }
  function filterString(f) {
    return `brightness(${f.brightness}%) contrast(${f.contrast}%) saturate(${f.saturate}%) sepia(${f.sepia}%) blur(${f.blur}px)`;
  }

  function renderCards() {
    appTitle.textContent = "بطاقات الأذكار";
    backBtn.classList.add("hidden");
    if (!cardState.text) {
      const g = CARD_GROUPS[0].items[0]; cardState.text = g.t; cardState.source = g.s;
    }
    let chips = CARD_GROUPS.map((g, i) => `<button class="chip gchip ${i === 0 ? "active" : ""}" data-g="${i}">${g.icon} ${g.name}</button>`).join("");
    let themes = CARD_THEMES.map((t, i) =>
      `<button class="theme-dot ${i === cardState.theme ? "active" : ""}" data-t="${i}" title="${t.name}"
        style="background:${t.grad === "radial" ? "radial-gradient(circle at 50% 40%," + t.bg.join(",") + ")" : "linear-gradient(135deg," + t.bg.join(",") + ")"}"><span style="color:${t.accent}">۞</span></button>`).join("");
    let sizeThumbs = SIZES.map((s, i) => {
      const ar = s.w / s.h; let bw, bh;
      if (ar <= 1) { bh = 40; bw = Math.round(40 * ar); } else { bw = 40; bh = Math.round(40 / ar); }
      return `<button class="size-thumb ${i === cardState.sizeIdx ? "active" : ""}" data-s="${i}" title="${s.name}">
        <span class="st-box" style="width:${bw}px;height:${bh}px"></span><span class="st-label">${s.short}</span></button>`;
    }).join("");
    let fpresets = FILTER_PRESETS.map(p => `<button class="chip fchip ${p.key === cardState.filterKey ? "active" : ""}" data-fp="${p.key}">${p.name}</button>`).join("");

    view.innerHTML = `
      <div class="cards-layout">
        <div class="card-stage">
          <div class="stage-row">
            <div class="side-rail nav-rail" id="cardToolbar">
              <button class="tool active" data-target="ctlLib" title="اختر الذكر">📚</button>
              <button class="tool" data-target="ctlDesign" title="التصميم والألوان">🎨</button>
              <button class="tool" data-target="sizeThumbs" title="مقاس البطاقة">📐</button>
              <button class="tool" data-target="ctlText" title="حجم النص ولونه">✏️</button>
              <button class="tool" data-target="photoDetails" title="صورة وفلاتر">📷</button>
              <button class="tool" data-target="ctlGift" title="إهداء دعاء">🎁</button>
              <button class="tool" data-target="ctlCustom" title="ذكر خاص">✍️</button>
            </div>
            <div class="card-preview" id="cardPreview"><canvas id="cardCanvas"></canvas></div>
            <div class="side-rail" id="colorRail">
              <span class="rail-end big">أ</span>
              <input type="range" class="vrange" id="vTextScale" min="60" max="170" step="5" value="${Math.round(cardState.textScale * 100)}" title="حجم الخط" />
              <span class="rail-end">أ</span>
              <div class="rail-sep"></div>
              <button class="vsw reset ${cardState.textColor ? "" : "active"}" data-col="" title="افتراضي">↺</button>
              ${RAIL_COLORS.slice(0, 4).map(c => `<button class="vsw ${cardState.textColor === c ? "active" : ""}" data-col="${c}" style="background:${swatchBg(c)}" title="${c === "gold" ? "ذهبي معدني" : "لون"}"></button>`).join("")}
              <label class="vsw pick" title="لون مخصّص"><input type="color" id="vColorPick" value="#ffffff" /></label>
            </div>
          </div>
          <div class="size-thumbs" id="sizeThumbs">${sizeThumbs}</div>
          <div class="card-actions">
            <button class="act primary" id="shareCard">📤 مشاركة</button>
            <button class="act" id="downloadCard">📥 تنزيل</button>
            <button class="act" id="randomCard">🎲 عشوائي</button>
            <button class="act" id="copyCard">📋 نسخ</button>
          </div>
        </div>
        <div class="card-controls">
          <details class="ctl" id="ctlLib" open>
            <summary>📚 اختر الذكر (${CARD_POOL.length}+ ذكرًا)</summary>
            <div class="ctl-body">
              <input id="libSearch" class="hisn-search" type="search" placeholder="🔍 ابحث في كل أذكار التطبيق…" />
              <div class="chips-row" id="libChips">${chips}</div>
              <div class="lib-list" id="libList"></div>
            </div>
          </details>
          <details class="ctl" id="ctlGift">
            <summary>🎁 إهداء دعاء (من / إلى)</summary>
            <div class="ctl-body custom-box">
              <input id="giftTo" type="text" placeholder="إلى (مثل: الصديق الغالي أبو أحمد)" value="${esc(cardState.toName)}" />
              <input id="giftFrom" type="text" placeholder="من (اسمك — اختياري)" value="${esc(cardState.fromName)}" />
              <p class="drag-hint">اختر دعاءً من مكتبة «إهداء ودعوات» أو «تهاني ومناسبات»، أضف الأسماء، وشاركه هديةً.</p>
            </div>
          </details>
          <details class="ctl" id="ctlDesign" open>
            <summary>🎨 التصميم</summary>
            <div class="ctl-body">
              <div class="mini-label">الألوان</div>
              <div class="theme-row">${themes}</div>
              <div class="mini-label">🕌 الخلفية الدينية</div>
              <div class="chips-row" id="bgRow">${BACKGROUNDS.map(b => `<button class="chip ${cardState.bg === b.k ? "active" : ""}" data-bg="${b.k}">${b.n}</button>`).join("")}</div>
              <div class="mini-label">الإطار</div>
              <div class="chips-row" id="frameRow">${FRAMES.map(f => `<button class="chip ${cardState.frame === f.k ? "active" : ""}" data-frame="${f.k}">${f.n}</button>`).join("")}</div>
              <div class="mini-label">الزخرفة (بدون صورة)</div>
              <div class="chips-row" id="patternRow">${PATTERNS.map(p => `<button class="chip ${cardState.pattern === p.k ? "active" : ""}" data-pattern="${p.k}">${p.n}</button>`).join("")}</div>
            </div>
          </details>
          <details class="ctl" id="ctlText">
            <summary>✏️ حجم النص ولونه</summary>
            <div class="ctl-body">
              ${sliderHTML("textScale", "حجم النص", 60, 170, 5, Math.round(cardState.textScale * 100))}
              <div class="mini-label">لون النص</div>
              <div class="swatch-row" id="textColors">
                <button class="swatch reset ${cardState.textColor ? "" : "active"}" data-col="" title="افتراضي">↺</button>
                ${TEXT_COLORS.map(c => `<button class="swatch ${cardState.textColor === c ? "active" : ""}" data-col="${c}" style="background:${swatchBg(c)}" title="${c === "gold" ? "ذهبي معدني" : ""}"></button>`).join("")}
                <label class="swatch pick" title="لون مخصّص"><input type="color" id="textColorPick" value="#ffffff" />🎨</label>
              </div>
            </div>
          </details>
          <details class="ctl" id="photoDetails">
            <summary>📷 الصور والخلفية</summary>
            <div class="ctl-body">
              <label class="act full upload-label">📷 صورة الخلفية من جهازك
                <input type="file" id="photoInput" accept="image/*" hidden /></label>
              <div class="filter-panel hidden" id="filterPanel">
                <div class="mini-label">طريقة عرض الخلفية</div>
                <div class="chips-row" id="fitRow">
                  <button class="chip ${cardState.img.fit === "cover" ? "active" : ""}" data-fit="cover">تعبئة الإطار</button>
                  <button class="chip ${cardState.img.fit === "contain" ? "active" : ""}" data-fit="contain">احتواء كامل الصورة</button>
                </div>
                <p class="drag-hint">👆 اسحب الصورة لتحريكها · «احتواء» يُظهر الصورة كاملةً بخلفية ضبابية أنيقة (مثالي لخلفية الجوال)</p>
                ${sliderHTML("zoom", "تكبير / تصغير", 50, 300, 5, Math.round(cardState.img.zoom * 100))}
                <div class="chips-row">${fpresets}</div>
                ${sliderHTML("brightness", "السطوع", 50, 150, 1, cardState.filter.brightness)}
                ${sliderHTML("contrast", "التباين", 50, 160, 1, cardState.filter.contrast)}
                ${sliderHTML("saturate", "التشبّع", 0, 200, 1, cardState.filter.saturate)}
                ${sliderHTML("dark", "تعتيم لوضوح النص", 0, 95, 5, Math.round(cardState.filter.dark * 100))}
                <button class="act full" id="removePhoto">✖ إزالة الخلفية</button>
              </div>
              <div class="mini-label">صور إضافية فوق التصميم</div>
              <label class="act full upload-label">➕ أضف صورة فوق التصميم
                <input type="file" id="layerInput" accept="image/*" hidden /></label>
              <div id="layersBox"></div>
              <div class="mini-label">موضع النصّ</div>
              <div class="chips-row" id="textPosRow">
                ${[["top", "أعلى"], ["center", "وسط"], ["bottom", "أسفل"], ["hide", "إخفاء"]].map(p => `<button class="chip ${cardState.textPos === p[0] ? "active" : ""}" data-tp="${p[0]}">${p[1]}</button>`).join("")}
              </div>
            </div>
          </details>
          <details class="ctl" id="ctlCustom">
            <summary>✍️ اكتب ذكرك الخاص</summary>
            <div class="ctl-body custom-box">
              <input id="customTitle" type="text" placeholder="العنوان (اختياري) — مثل: أذكار الصباح" value="${esc(cardState.title)}" />
              <textarea id="customText" rows="2" placeholder="اكتب ذكرًا أو دعاءً صحيحًا..."></textarea>
              <input id="customSource" type="text" placeholder="المصدر (اختياري)" />
              <button class="act primary full" id="applyCustom">توليد بطاقتي الخاصة</button>
            </div>
          </details>
        </div>
      </div>
    `;

    view.querySelector("#libList").innerHTML = libItemsHTML(0);
    if (cardState.bgImage) view.querySelector("#filterPanel").classList.remove("hidden");
    bindCardEvents();
    view.querySelectorAll("#cardToolbar .tool").forEach(b => b.addEventListener("click", () => {
      const el = document.getElementById(b.dataset.target); if (!el) return;
      if (el.tagName === "DETAILS") el.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      view.querySelectorAll("#cardToolbar .tool").forEach(x => x.classList.toggle("active", x === b));
    }));
    ensureFontsThenDraw();
    window.scrollTo(0, 0);
  }

  function sliderHTML(key, label, min, max, step, val) {
    return `<div class="slider-box"><label>${label} <span id="v_${key}">${val}</span></label>
      <input type="range" class="frange" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}" /></div>`;
  }

  function libItemsHTML(gi) {
    return CARD_GROUPS[gi].items.map((it, i) =>
      `<button class="lib-item" data-g="${gi}" data-i="${i}"><span>${esc(it.t)}</span></button>`).join("");
  }

  function bindCardEvents() {
    // المقاس — مصغّرات بصرية بجانب البطاقة
    view.querySelectorAll("#sizeThumbs .size-thumb").forEach(b => b.addEventListener("click", () => {
      cardState.sizeIdx = parseInt(b.dataset.s, 10);
      view.querySelectorAll("#sizeThumbs .size-thumb").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    // رفع الصورة
    view.querySelector("#photoInput").addEventListener("change", onPhoto);
    view.querySelector("#removePhoto").addEventListener("click", () => {
      cardState.bgImage = null;
      view.querySelector("#filterPanel").classList.add("hidden");
      view.querySelector("#photoInput").value = "";
      drawCard();
    });
    // طريقة عرض الخلفية (تعبئة/احتواء)
    view.querySelectorAll("#fitRow .chip").forEach(b => b.addEventListener("click", () => {
      cardState.img.fit = b.dataset.fit;
      cardState.img.ox = 0; cardState.img.oy = 0;
      view.querySelectorAll("#fitRow .chip").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    // موضع النصّ
    view.querySelectorAll("#textPosRow .chip").forEach(b => b.addEventListener("click", () => {
      cardState.textPos = b.dataset.tp;
      view.querySelectorAll("#textPosRow .chip").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    // إضافة صورة طبقة
    const li = view.querySelector("#layerInput"); if (li) li.addEventListener("change", onLayerPhoto);
    renderLayersBox();
    // فلاتر جاهزة
    view.querySelectorAll("[data-fp]").forEach(b => b.addEventListener("click", () => {
      const p = FILTER_PRESETS.find(x => x.key === b.dataset.fp); if (!p) return;
      cardState.filterKey = p.key;
      cardState.filter = Object.assign({}, p.f, { dark: cardState.filter.dark });
      view.querySelectorAll("[data-fp]").forEach(x => x.classList.toggle("active", x === b));
      ["brightness", "contrast", "saturate"].forEach(k => {
        const inp = view.querySelector(`.frange[data-key="${k}"]`);
        if (inp) { inp.value = cardState.filter[k]; const v = document.getElementById("v_" + k); if (v) v.textContent = cardState.filter[k]; }
      });
      drawCard();
    }));
    // المنزلقات
    view.querySelectorAll(".frange").forEach(inp => inp.addEventListener("input", () => {
      const k = inp.dataset.key, val = parseFloat(inp.value);
      if (k === "textScale") { cardState.textScale = val / 100; const vr = document.getElementById("vTextScale"); if (vr) vr.value = inp.value; }
      else if (k === "zoom") cardState.img.zoom = val / 100;
      else cardState.filter[k] = (k === "dark" ? val / 100 : val);
      const vlab = document.getElementById("v_" + k); if (vlab) vlab.textContent = inp.value;
      drawCard();
    }));
    // ألوان النص
    view.querySelectorAll("#textColors .swatch[data-col]").forEach(b => b.addEventListener("click", () => {
      cardState.textColor = b.dataset.col;
      view.querySelectorAll("#textColors .swatch").forEach(x => x.classList.toggle("active", x === b));
      view.querySelectorAll("#colorRail .vsw").forEach(x => x.classList.toggle("active", (x.dataset.col || "") === (b.dataset.col || "")));
      drawCard();
    }));
    const pick = view.querySelector("#textColorPick");
    if (pick) pick.addEventListener("input", () => {
      cardState.textColor = pick.value;
      view.querySelectorAll("#textColors .swatch").forEach(x => x.classList.remove("active"));
      pick.parentElement.classList.add("active");
      drawCard();
    });
    // المقياس العمودي لحجم الخط
    const vts = view.querySelector("#vTextScale");
    if (vts) vts.addEventListener("input", () => {
      cardState.textScale = parseFloat(vts.value) / 100;
      const ps = view.querySelector('.frange[data-key="textScale"]'); if (ps) ps.value = vts.value;
      const pv = document.getElementById("v_textScale"); if (pv) pv.textContent = vts.value;
      drawCard();
    });
    // مؤشّر الألوان العمودي
    view.querySelectorAll("#colorRail .vsw[data-col]").forEach(b => b.addEventListener("click", () => {
      cardState.textColor = b.dataset.col;
      view.querySelectorAll("#colorRail .vsw").forEach(x => x.classList.toggle("active", x === b));
      view.querySelectorAll("#textColors .swatch").forEach(x => x.classList.toggle("active", (x.dataset.col || "") === b.dataset.col));
      drawCard();
    }));
    const vpick = view.querySelector("#vColorPick");
    if (vpick) vpick.addEventListener("input", () => {
      cardState.textColor = vpick.value;
      view.querySelectorAll("#colorRail .vsw").forEach(x => x.classList.remove("active"));
      vpick.closest(".vsw").classList.add("active");
      drawCard();
    });
    // تحريك الصورة بالسحب داخل المعاينة
    bindCanvasDrag();
    // التصميم
    view.querySelectorAll(".theme-dot").forEach(b => b.addEventListener("click", () => {
      cardState.theme = parseInt(b.dataset.t, 10);
      view.querySelectorAll(".theme-dot").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    // الإطار
    view.querySelectorAll("#frameRow .chip").forEach(b => b.addEventListener("click", () => {
      cardState.frame = b.dataset.frame;
      view.querySelectorAll("#frameRow .chip").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    // الزخرفة
    view.querySelectorAll("#patternRow .chip").forEach(b => b.addEventListener("click", () => {
      cardState.pattern = b.dataset.pattern;
      view.querySelectorAll("#patternRow .chip").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    // الخلفية الدينية
    view.querySelectorAll("#bgRow .chip").forEach(b => b.addEventListener("click", () => {
      cardState.bg = b.dataset.bg;
      view.querySelectorAll("#bgRow .chip").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    // الإهداء (من / إلى)
    const gt = view.querySelector("#giftTo"), gf = view.querySelector("#giftFrom");
    if (gt) gt.addEventListener("input", () => { cardState.toName = gt.value; drawCard(); });
    if (gf) gf.addEventListener("input", () => { cardState.fromName = gf.value; drawCard(); });
    view.querySelectorAll(".gchip").forEach(b => b.addEventListener("click", () => {
      const gi = parseInt(b.dataset.g, 10);
      view.querySelectorAll(".gchip").forEach(x => x.classList.toggle("active", x === b));
      const ls = view.querySelector("#libSearch"); if (ls) ls.value = "";
      view.querySelector("#libList").innerHTML = libItemsHTML(gi);
      bindLibItems();
    }));
    const libSearch = view.querySelector("#libSearch");
    if (libSearch) libSearch.addEventListener("input", () => {
      const q = stripD(libSearch.value.trim());
      if (!q) { view.querySelector("#libList").innerHTML = libItemsHTML(0); bindLibItems(); return; }
      const res = [];
      for (let i = 0; i < CARD_POOL.length && res.length < 80; i++) if (CARD_POOL[i].n.indexOf(q) >= 0) res.push(i);
      view.querySelector("#libList").innerHTML = res.length
        ? res.map(pi => `<button class="lib-item" data-pool="${pi}"><span>${esc(CARD_POOL[pi].t)}</span></button>`).join("")
        : `<p class="muted-line">لا نتائج مطابقة.</p>`;
      bindLibItems();
    });
    bindLibItems();
    view.querySelector("#applyCustom").addEventListener("click", () => {
      const t = view.querySelector("#customText").value.trim();
      if (!t) { view.querySelector("#customText").focus(); return; }
      cardState.text = t; cardState.source = view.querySelector("#customSource").value.trim();
      cardState.title = view.querySelector("#customTitle").value.trim();
      drawCard(); document.querySelector(".card-preview").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    view.querySelector("#randomCard").addEventListener("click", () => {
      const rnd = a => a[Math.floor(Math.random() * a.length)];
      cardState.theme = Math.floor(Math.random() * CARD_THEMES.length);
      const th = CARD_THEMES[cardState.theme];
      cardState.frame = rnd(FRAMES).k;
      if (Math.random() < 0.45) { cardState.bg = rnd(BACKGROUNDS.filter(b => b.k)).k; cardState.pattern = ""; }
      else { cardState.bg = ""; cardState.pattern = rnd(PATTERNS.filter(p => p.k && p.k !== "none")).k; }
      cardState.textColor = rnd(isLight(th.bg[0]) ? ["", "", "#0c1716", "gold"] : ["", "", "#ffffff", "#f7e9c2", "gold", "#ffd97d"]);
      cardState.textScale = rnd([0.9, 1, 1, 1.1, 1.2]);
      const vr = document.getElementById("vTextScale"); if (vr) vr.value = Math.round(cardState.textScale * 100);
      refreshCardUI();
      drawCard(); vibrate(12);
    });
    view.querySelector("#downloadCard").addEventListener("click", () => exportCard("download"));
    view.querySelector("#shareCard").addEventListener("click", () => exportCard("share"));
    view.querySelector("#copyCard").addEventListener("click", copyCardText);
  }
  function bindCanvasDrag() {
    const cv = view.querySelector("#cardCanvas"); if (!cv) return;
    const pts = new Map(); let mode = null, pinch = null, lx = 0, ly = 0;
    const toCanvas = (e) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * cv.width, y: (e.clientY - r.top) / r.height * cv.height }; };
    const hitLayer = (p) => {
      const W = cv.width, H = cv.height;
      for (let i = cardState.layers.length - 1; i >= 0; i--) {
        const L = cardState.layers[i]; if (!L.img) continue;
        const w = W * L.scale, h = w * (L.img.height / L.img.width), cx = W * L.cx, cy = H * L.cy;
        if (p.x >= cx - w / 2 && p.x <= cx + w / 2 && p.y >= cy - h / 2 && p.y <= cy + h / 2) return i;
      }
      return -1;
    };
    const two = () => { const a = [...pts.values()]; return { dist: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), ang: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) }; };
    cv.addEventListener("pointerdown", (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) {
        const hit = hitLayer(toCanvas(e));
        if (hit >= 0) { if (cardState.sel !== hit) { cardState.sel = hit; renderLayersBox(); drawCard(); } mode = "layer"; }
        else if (cardState.bgImage) mode = "bg"; else mode = null;
        lx = e.clientX; ly = e.clientY; cv.classList.add("grabbing");
      } else if (pts.size === 2) {
        const t = two();
        if (mode === "layer" && cardState.layers[cardState.sel]) { const L = cardState.layers[cardState.sel]; pinch = { d: t.dist, a: t.ang, s0: L.scale, r0: L.rot || 0 }; }
        else if (cardState.bgImage) { mode = "bg"; pinch = { d: t.dist, a: t.ang, s0: cardState.img.zoom || 1, r0: 0 }; }
      }
    });
    cv.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size >= 2 && pinch) {
        const t = two(), ratio = t.dist / pinch.d;
        if (mode === "layer" && cardState.layers[cardState.sel]) {
          const L = cardState.layers[cardState.sel];
          L.scale = Math.min(1.6, Math.max(0.08, pinch.s0 * ratio));
          L.rot = pinch.r0 + (t.ang - pinch.a);
        } else if (mode === "bg") { cardState.img.zoom = Math.min(4, Math.max(0.3, pinch.s0 * ratio)); }
        drawCard(); return;
      }
      if (pts.size === 1 && mode) {
        const r = cv.getBoundingClientRect();
        const dx = (e.clientX - lx) / r.width * cv.width, dy = (e.clientY - ly) / r.height * cv.height;
        if (mode === "layer" && cardState.layers[cardState.sel]) { const L = cardState.layers[cardState.sel]; L.cx += dx / cv.width; L.cy += dy / cv.height; }
        else if (mode === "bg") { cardState.img.ox += dx; cardState.img.oy += dy; }
        lx = e.clientX; ly = e.clientY; drawCard();
      }
    });
    const up = (e) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
      if (pts.size === 1) { const p = [...pts.values()][0]; lx = p.x; ly = p.y; }
      if (pts.size === 0) { mode = null; cv.classList.remove("grabbing"); renderLayersBox(); }
    };
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
  }
  function bindLibItems() {
    view.querySelectorAll(".lib-item").forEach(b => b.addEventListener("click", () => {
      let t, s;
      if (b.dataset.pool !== undefined) { const it = CARD_POOL[parseInt(b.dataset.pool, 10)]; t = it.t; s = it.s; }
      else { const it = CARD_GROUPS[parseInt(b.dataset.g, 10)].items[parseInt(b.dataset.i, 10)]; t = it.t; s = it.s; }
      // المكتبة العامة بلا عنوان — العنوان يليق فقط بالأذكار المرتبطة بمناسبة محددة
      cardState.text = t; cardState.source = s; cardState.title = "";
      const ti = view.querySelector("#customTitle"); if (ti) ti.value = "";
      drawCard(); document.querySelector(".card-preview").scrollIntoView({ behavior: "smooth", block: "center" });
    }));
  }

  function ensureFontsThenDraw() {
    if (document.fonts && document.fonts.load) {
      Promise.all([
        document.fonts.load("700 90px 'Amiri Quran'"),
        document.fonts.load("700 40px 'Tajawal'")
      ]).then(drawCard).catch(drawCard);
    } else { drawCard(); }
  }

  function wrapLines(ctx, text, maxW) {
    const lines = [];
    text.split("\n").forEach(par => {
      const words = par.split(/\s+/).filter(Boolean);
      let line = "";
      words.forEach(w => {
        const test = line ? line + " " + w : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      });
      if (line) lines.push(line);
    });
    return lines;
  }

  function onLayerPhoto(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        cardState.layers.push({ img: img, cx: 0.5, cy: 0.42, scale: 0.45, rot: 0, bright: 100, contrast: 100, sat: 100, cut: false, proc: null });
        cardState.sel = cardState.layers.length - 1;
        renderLayersBox(); drawCard();
        const pv = document.getElementById("cardPreview"); if (pv) pv.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      img.onerror = () => toast("تعذّر قراءة الصورة");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function renderLayersBox() {
    const box = document.getElementById("layersBox"); if (!box) return;
    const L = cardState.layers || [];
    if (!L.length) { box.innerHTML = ""; return; }
    let h = '<div class="layers-list">';
    L.forEach((ly, i) => { h += `<button class="layer-chip ${cardState.sel === i ? "active" : ""}" data-ly="${i}">🖼️ صورة ${i + 1}</button>`; });
    h += "</div>";
    if (cardState.sel >= 0 && cardState.sel < L.length) {
      const ly = L[cardState.sel];
      h += `<div class="layer-controls">
        <p class="drag-hint">👆 اسحب الصورة لتحريكها · باصبعين كبّر/صغّر ودوّر مباشرةً على البطاقة</p>
        <div class="slider-box"><label>حجم الصورة <span>${Math.round(ly.scale * 100)}</span></label>
          <input type="range" class="lrange" data-lk="scale" min="12" max="140" step="1" value="${Math.round(ly.scale * 100)}" /></div>
        <div class="slider-box"><label>تدوير <span>${Math.round((ly.rot || 0) * 180 / Math.PI)}°</span></label>
          <input type="range" class="lrange" data-lk="rot" min="-180" max="180" step="1" value="${Math.round((ly.rot || 0) * 180 / Math.PI)}" /></div>
        <div class="slider-box"><label>السطوع <span>${ly.bright || 100}</span></label>
          <input type="range" class="lrange" data-lk="bright" min="50" max="150" step="1" value="${ly.bright || 100}" /></div>
        <div class="slider-box"><label>التباين <span>${ly.contrast || 100}</span></label>
          <input type="range" class="lrange" data-lk="contrast" min="50" max="160" step="1" value="${ly.contrast || 100}" /></div>
        <div class="slider-box"><label>التشبّع <span>${ly.sat == null ? 100 : ly.sat}</span></label>
          <input type="range" class="lrange" data-lk="sat" min="0" max="200" step="1" value="${ly.sat == null ? 100 : ly.sat}" /></div>
        <button class="act full" id="cutLayer">${ly.cut ? "↩ استعادة الخلفية" : "🪄 إزالة الخلفية (للخلفيات السادة)"}</button>
        <button class="act full" id="delLayer">🗑 حذف الصورة المحدّدة</button>
      </div>`;
    }
    box.innerHTML = h;
    box.querySelectorAll(".layer-chip").forEach(b => b.addEventListener("click", () => { cardState.sel = parseInt(b.dataset.ly, 10); renderLayersBox(); drawCard(); }));
    box.querySelectorAll(".lrange").forEach(inp => inp.addEventListener("input", () => {
      const ly = cardState.layers[cardState.sel]; if (!ly) return;
      const v = parseFloat(inp.value), k = inp.dataset.lk;
      if (k === "scale") ly.scale = v / 100;
      else if (k === "rot") ly.rot = v * Math.PI / 180;
      else ly[k] = v; // bright / contrast / sat
      inp.parentElement.querySelector("span").textContent = k === "rot" ? Math.round(v) + "°" : Math.round(v);
      drawCard();
    }));
    const cut = document.getElementById("cutLayer");
    if (cut) cut.addEventListener("click", () => {
      const ly = cardState.layers[cardState.sel]; if (!ly) return;
      if (ly.cut) { ly.cut = false; drawCard(); }
      else { cut.textContent = "… جارٍ الإزالة"; setTimeout(() => { removeLayerBg(ly); renderLayersBox(); }, 30); }
    });
    const del = document.getElementById("delLayer");
    if (del) del.addEventListener("click", () => { cardState.layers.splice(cardState.sel, 1); cardState.sel = cardState.layers.length ? 0 : -1; renderLayersBox(); drawCard(); });
  }
  function onPhoto(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        cardState.bgImage = img;
        cardState.img = { zoom: 1, ox: 0, oy: 0, fit: cardState.img.fit || "cover" };
        const z = view.querySelector('.frange[data-key="zoom"]'); if (z) { z.value = 100; const zv = document.getElementById("v_zoom"); if (zv) zv.textContent = "100"; }
        const fp = view.querySelector("#filterPanel"); if (fp) fp.classList.remove("hidden");
        const pd = document.getElementById("photoDetails"); if (pd) pd.open = true; // افتح لوحة التحكم تلقائيًا
        drawCard();
        const pv = document.getElementById("cardPreview"); if (pv) pv.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      img.onerror = () => toast("تعذّر قراءة الصورة");
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function drawBg(ctx, img, W, H, t) {
    const zoom = t.zoom || 1;
    if ((t.fit || "cover") === "contain") {
      // احتواء: تظهر الصورة كاملةً (بلا قصّ)، ونملأ الفراغ بنسخة مكبّرة مضبّبة من الصورة نفسها — تبدو كخلفية جوال أنيقة
      const cov = Math.max(W / img.width, H / img.height) * 1.15;
      const bw = img.width * cov, bh = img.height * cov;
      ctx.save(); ctx.filter = "blur(" + Math.round(Math.min(W, H) * 0.03) + "px) brightness(0.7)";
      ctx.drawImage(img, (W - bw) / 2, (H - bh) / 2, bw, bh);
      ctx.restore();
      const fit = Math.min(W / img.width, H / img.height) * zoom;
      const dw = img.width * fit, dh = img.height * fit;
      ctx.drawImage(img, (W - dw) / 2 + (t.ox || 0), (H - dh) / 2 + (t.oy || 0), dw, dh);
    } else {
      // تعبئة (cover): تملأ البطاقة وقد تُقَصّ الأطراف. zoom للتكبير، والسحب لتحريك موضع القصّ.
      const s = Math.max(W / img.width, H / img.height) * zoom;
      const dw = img.width * s, dh = img.height * s;
      ctx.drawImage(img, (W - dw) / 2 + (t.ox || 0), (H - dh) / 2 + (t.oy || 0), dw, dh);
    }
  }
  // رسم طبقات الصور الأمامية (صور إضافية فوق الخلفية)
  function drawLayers(ctx, W, H) {
    (cardState.layers || []).forEach((L, i) => {
      if (!L.img || !L.img.complete) return;
      const w = W * (L.scale || 0.45), h = w * (L.img.height / L.img.width);
      const cx = W * (L.cx != null ? L.cx : 0.5), cy = H * (L.cy != null ? L.cy : 0.5);
      const rr = w * 0.035, cut = !!(L.cut && L.proc), src = cut ? L.proc : L.img;
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(L.rot || 0);
      if (!cut) { // ظلّ + حافة فقط للصورة المستطيلة (لا للمقصوصة)
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.32)"; ctx.shadowBlur = w * 0.045; ctx.shadowOffsetY = w * 0.012;
        ctx.fillStyle = "#000"; roundRect(ctx, -w / 2, -h / 2, w, h, rr); ctx.fill();
        ctx.restore();
      }
      ctx.save();
      if (!cut) { roundRect(ctx, -w / 2, -h / 2, w, h, rr); ctx.clip(); }
      ctx.filter = `brightness(${L.bright || 100}%) contrast(${L.contrast || 100}%) saturate(${L.sat == null ? 100 : L.sat}%)`;
      ctx.drawImage(src, -w / 2, -h / 2, w, h); ctx.restore();
      if (!cut) {
        ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = Math.max(1, w * 0.005);
        roundRect(ctx, -w / 2, -h / 2, w, h, rr); ctx.stroke();
      }
      if (cardState.sel === i) {
        ctx.strokeStyle = "#c8a24a"; ctx.lineWidth = Math.max(2, w * 0.011); ctx.setLineDash([w * 0.04, w * 0.03]);
        roundRect(ctx, -w / 2, -h / 2, w, h, rr); ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();
    });
  }
  // إزالة الخلفية السادة (تقريبية — تعمل أفضل مع خلفية موحّدة اللون)
  function removeLayerBg(L) {
    const img = L.img; const mx = 800, sc = Math.min(1, mx / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
    const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
    let d; try { d = x.getImageData(0, 0, c.width, c.height); } catch (e) { toast("تعذّرت معالجة الصورة"); return; }
    const px = d.data, W = c.width, H = c.height;
    const corner = (cx, cy) => { const k = (cy * W + cx) * 4; return [px[k], px[k + 1], px[k + 2]]; };
    const cs = [corner(0, 0), corner(W - 1, 0), corner(0, H - 1), corner(W - 1, H - 1)];
    const tol = 50;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      for (let j = 0; j < cs.length; j++) {
        if (Math.abs(r - cs[j][0]) < tol && Math.abs(g - cs[j][1]) < tol && Math.abs(b - cs[j][2]) < tol) { px[i + 3] = 0; break; }
      }
    }
    x.putImageData(d, 0, 0);
    L.proc = c; L.cut = true; drawCard();
  }

  const STATIC_ANIM = { bgZoom: 1, textAlpha: 1, textDy: 0, uiAlpha: 1 };
  function drawCard() {
    const canvas = document.getElementById("cardCanvas"); if (!canvas) return;
    const sz = SIZES[cardState.sizeIdx];
    canvas.width = sz.w; canvas.height = sz.h;
    renderCardTo(canvas.getContext("2d"), sz.w, sz.h, STATIC_ANIM);
  }

  // محرّك الرسم المشترك بين الصورة والفيديو. anim يتحكّم بالحركة والظهور التدريجي.
  function renderCardTo(ctx, W, H, anim) {
    anim = anim || STATIC_ANIM;
    const u = Math.min(W, H);
    const th = CARD_THEMES[cardState.theme];
    const hasImg = !!cardState.bgImage;
    let fg, sub, accent = th.accent;
    ctx.imageSmoothingEnabled = true; try { ctx.imageSmoothingQuality = "high"; } catch (e) {}
    ctx.clearRect(0, 0, W, H);

    const gt = th.grad || "diag";
    let g;
    if (gt === "radial") g = ctx.createRadialGradient(W * 0.5, H * 0.40, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.78);
    else if (gt === "vert") g = ctx.createLinearGradient(0, 0, 0, H);
    else if (gt === "horiz") g = ctx.createLinearGradient(0, 0, W, 0);
    else if (gt === "diagUp") g = ctx.createLinearGradient(0, H, W, 0);
    else g = ctx.createLinearGradient(0, 0, W, H);
    const bg = th.bg;
    if (bg.length >= 3) { g.addColorStop(0, bg[0]); g.addColorStop(0.5, bg[1]); g.addColorStop(1, bg[2]); }
    else { g.addColorStop(0, bg[0]); g.addColorStop(1, bg[1]); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (hasImg) {
      ctx.save(); ctx.filter = filterString(cardState.filter);
      drawBg(ctx, cardState.bgImage, W, H, { zoom: (cardState.img.zoom || 1) * anim.bgZoom, ox: cardState.img.ox, oy: cardState.img.oy, fit: cardState.img.fit });
      ctx.restore();
      const d = cardState.filter.dark;
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, `rgba(8,11,14,${Math.min(0.95, d * 0.75)})`);
      ov.addColorStop(0.45, `rgba(8,11,14,${Math.min(0.97, d)})`);
      ov.addColorStop(1, `rgba(8,11,14,${Math.min(1, d * 1.08)})`);
      ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
      fg = "#ffffff"; sub = "#ece3cd";
    } else if (cardState.bg) {
      drawScene(ctx, W, H, th, cardState.bg);
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, "rgba(0,0,0,0.10)"); ov.addColorStop(0.5, "rgba(0,0,0,0.28)"); ov.addColorStop(1, "rgba(0,0,0,0.42)");
      ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
      fg = "#ffffff"; sub = "#ece3cd";
    } else {
      const pat = cardState.pattern || th.pattern;
      if (pat && pat !== "none") paintPattern(ctx, W, H, th, pat);
      fg = th.fg; sub = th.sub;
    }

    // زخرفة مركزية أنيقة تملأ الفراغ (للبطاقات بلا صورة/خلفية مشهدية)
    if (!hasImg && !cardState.bg && !(cardState.layers && cardState.layers.length)) drawMedallion(ctx, W, H, u, accent);
    drawLayers(ctx, W, H);

    const fm = u * 0.045;
    drawFrame(ctx, W, H, u, accent, cardState.frame);

    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.direction = "rtl";
    // العنوان أو الإهداء أو الزخرفة (يخضع لظهور uiAlpha)
    ctx.globalAlpha = anim.uiAlpha;
    const hasGift = !!(cardState.fromName || cardState.toName);
    const fitTo = (txt, base, weight) => { let s = base; ctx.font = `${weight} ${s}px 'Tajawal', sans-serif`; while (ctx.measureText(txt).width > W * 0.82 && s > base * 0.55) { s -= base * 0.06; ctx.font = `${weight} ${s}px 'Tajawal', sans-serif`; } };
    if (hasGift) {
      ctx.fillStyle = hexA(accent, 0.9); ctx.font = `${Math.round(u * 0.024)}px 'Tajawal', sans-serif`;
      ctx.fillText("🎁 إهداء", W / 2, H * 0.072);
      let gy = H * 0.115;
      if (cardState.toName) { fitTo("إلى: " + cardState.toName, u * 0.036, "700"); ctx.fillStyle = accent; ctx.fillText("إلى: " + cardState.toName, W / 2, gy); gy += u * 0.044; }
      if (cardState.fromName) { fitTo("من: " + cardState.fromName, u * 0.029, "400"); ctx.fillStyle = sub; ctx.fillText("من: " + cardState.fromName, W / 2, gy); }
    } else if (cardState.title) {
      let ts = u * 0.042;
      ctx.font = `700 ${ts}px 'Tajawal', sans-serif`;
      while (ctx.measureText(cardState.title).width > W * 0.78 && ts > u * 0.024) { ts -= u * 0.003; ctx.font = `700 ${ts}px 'Tajawal', sans-serif`; }
      ctx.fillStyle = accent;
      ctx.fillText(cardState.title, W / 2, H * 0.125);
      ctx.strokeStyle = hexA(accent, 0.5); ctx.lineWidth = Math.max(1, u * 0.002);
      ctx.beginPath(); ctx.moveTo(W / 2 - u * 0.07, H * 0.16); ctx.lineTo(W / 2 + u * 0.07, H * 0.16); ctx.stroke();
    } else {
      // زخرفة محايدة (معيّن صغير) بدل أي رمز
      ctx.save(); ctx.translate(W / 2, H * 0.115); ctx.rotate(Math.PI / 4);
      ctx.fillStyle = accent; ctx.fillRect(-u * 0.013, -u * 0.013, u * 0.026, u * 0.026);
      ctx.restore();
    }
    // فاصل زخرفي تحت الترويسة لإعطاء توازن واحترافية
    drawFlourish(ctx, W / 2, H * 0.20, u * 0.11, accent, u);
    ctx.globalAlpha = 1;

    // النص الرئيسي — ملاءمة تلقائية
    const maxW = W * 0.80, areaTop = H * 0.20, areaBot = H * 0.82, maxH = areaBot - areaTop;
    const len = cardState.text.length;
    let size = (len < 18 ? 0.11 : len < 45 ? 0.086 : len < 90 ? 0.065 : len < 150 ? 0.048 : 0.038) * u;
    let lines;
    while (size >= u * 0.022) {
      ctx.font = `${size}px 'Amiri Quran', serif`;
      lines = wrapLines(ctx, cardState.text, maxW);
      const lh0 = size * 1.75, totalH = lines.length * lh0;
      const widest = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
      if (totalH <= maxH && widest <= maxW) break;
      size -= u * 0.006;
    }
    size *= cardState.textScale || 1;
    ctx.font = `${size}px 'Amiri Quran', serif`;
    lines = wrapLines(ctx, cardState.text, maxW);
    ctx.globalAlpha = anim.textAlpha;
    if (hasImg) { ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = u * 0.022; ctx.shadowOffsetY = u * 0.004; }
    const lh = size * 1.75;
    let cyText = (areaTop + areaBot) / 2;
    if (cardState.textPos === "top") cyText = areaTop + (Math.min(lines.length, 4) * lh) / 2;
    else if (cardState.textPos === "bottom") cyText = areaBot - (Math.min(lines.length, 4) * lh) / 2;
    const startY = cyText - ((lines.length - 1) * lh) / 2 + (anim.textDy || 0);
    const hideText = cardState.textPos === "hide";
    if (cardState.textColor === "gold") {
      ctx.fillStyle = goldFill(ctx, startY - lh * 0.7, startY + (lines.length - 1) * lh + lh * 0.7);
    } else {
      ctx.fillStyle = cardState.textColor || fg;
    }
    if (!hideText) lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh));
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;

    // المصدر + العلامة + QR (ظهور تدريجي)
    ctx.globalAlpha = anim.uiAlpha;
    const pre = prophetPreamble(cardState.text, cardState.source);
    let sy = areaBot + u * 0.032;
    if (pre) {
      ctx.fillStyle = hexA(accent, 0.95); ctx.font = `700 ${Math.round(u * 0.025)}px 'Tajawal', sans-serif`;
      ctx.fillText(pre, W / 2, sy); sy += u * 0.038;
    }
    if (cardState.source) {
      ctx.fillStyle = sub; ctx.font = `${Math.round(u * 0.027)}px 'Amiri', 'Tajawal', sans-serif`;
      ctx.fillText("﴿ " + cardState.source + " ﴾", W / 2, sy);
    }
    ctx.fillStyle = hexA(accent, 0.95);
    ctx.font = `700 ${Math.round(u * 0.030)}px 'Tajawal', sans-serif`;
    ctx.fillText("📿 أذكار", W / 2, H - u * 0.066);
    if (qrImg && qrImg.complete && qrImg.naturalWidth) {
      const q = u * 0.115, pad = u * 0.011, qx = fm * 1.7, qy = H - fm * 1.7 - q;
      ctx.fillStyle = "rgba(255,255,255,0.96)";
      roundRect(ctx, qx - pad, qy - pad, q + pad * 2, q + pad * 2, u * 0.012); ctx.fill();
      ctx.drawImage(qrImg, qx, qy, q, q);
      ctx.fillStyle = sub; ctx.font = `${Math.round(u * 0.019)}px 'Tajawal', sans-serif`;
      ctx.fillText("امسح للوصول", qx + q / 2, qy + q + u * 0.028);
    }
    ctx.globalAlpha = 1;
  }


  function paintPattern(ctx, W, H, th, key) {
    key = key || th.pattern;
    ctx.save();
    const u = Math.min(W, H), maxD = Math.max(W, H);
    if (key === "dots") {
      ctx.fillStyle = hexA(th.accent, 0.10); const step = u * 0.065;
      for (let y = u * 0.1; y < H - u * 0.08; y += step) for (let x = u * 0.1; x < W - u * 0.08; x += step) {
        ctx.beginPath(); ctx.arc(x, y, u * 0.003, 0, 7); ctx.fill();
      }
    } else if (key === "stars") {
      ctx.fillStyle = hexA(th.accent, 0.13); ctx.textAlign = "center"; ctx.font = `${Math.round(u * 0.024)}px serif`;
      [[.15, .18], [.85, .22], [.22, .82], [.82, .8], [.5, .14], [.13, .5], [.87, .52], [.48, .88]]
        .forEach(p => ctx.fillText("✦", W * p[0], H * p[1]));
    } else if (key === "rays") {
      ctx.strokeStyle = hexA(th.accent, 0.06); ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.moveTo(W / 2, H / 2); const ang = (Math.PI / 12) * i; ctx.lineTo(W / 2 + Math.cos(ang) * maxD, H / 2 + Math.sin(ang) * maxD); ctx.stroke(); }
    } else if (key === "diamonds") {
      ctx.fillStyle = hexA(th.accent, 0.09); const s = u * 0.085, d = u * 0.006;
      for (let y = u * 0.12; y < H - u * 0.1; y += s) for (let x = u * 0.12; x < W - u * 0.1; x += s) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-d, -d, d * 2, d * 2); ctx.restore();
      }
    } else if (key === "grid") {
      ctx.strokeStyle = hexA(th.accent, 0.055); ctx.lineWidth = 1; const s = u * 0.1;
      for (let x = u * 0.12; x < W - u * 0.08; x += s) { ctx.beginPath(); ctx.moveTo(x, u * 0.1); ctx.lineTo(x, H - u * 0.1); ctx.stroke(); }
      for (let y = u * 0.12; y < H - u * 0.08; y += s) { ctx.beginPath(); ctx.moveTo(u * 0.1, y); ctx.lineTo(W - u * 0.1, y); ctx.stroke(); }
    } else if (key === "frame") {
      ctx.strokeStyle = hexA(th.accent, 0.18); ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const o = u * 0.085 + i * u * 0.009; roundRect(ctx, o, o, W - 2 * o, H - 2 * o, u * 0.016); ctx.stroke(); }
    } else if (key === "girih") {
      const step = u * 0.18;
      for (let y = step * 0.55; y < H; y += step) for (let x = step * 0.55; x < W; x += step) girihStar(ctx, x, y, step * 0.36, hexA(th.accent, 0.10));
    } else if (key === "scales") {
      ctx.strokeStyle = hexA(th.accent, 0.08); ctx.lineWidth = Math.max(1, u * 0.0016);
      const R = u * 0.05;
      for (let row = 0, y = u * 0.06; y < H + R; y += R, row++) {
        const off = (row % 2) ? R : 0;
        for (let x = -R + off; x < W + R; x += R * 2) { ctx.beginPath(); ctx.arc(x, y, R, 0.16 * Math.PI, 0.84 * Math.PI); ctx.stroke(); }
      }
    } else if (key === "waves") {
      ctx.strokeStyle = hexA(th.accent, 0.07); ctx.lineWidth = Math.max(1, u * 0.002);
      const amp = u * 0.018, wl = u * 0.13, step = u * 0.066;
      for (let y = u * 0.08; y < H - u * 0.05; y += step) { ctx.beginPath(); for (let x = 0; x <= W; x += 5) { const yy = y + Math.sin((x / wl) * 6.2832) * amp; x === 0 ? ctx.moveTo(x, yy) : ctx.lineTo(x, yy); } ctx.stroke(); }
    } else if (key === "chevron") {
      ctx.strokeStyle = hexA(th.accent, 0.06); ctx.lineWidth = Math.max(1.2, u * 0.0024);
      const w = u * 0.06, h = u * 0.03, step = u * 0.08;
      for (let y = u * 0.05; y < H + h; y += step) { ctx.beginPath(); for (let x = 0, k = 0; x <= W; x += w, k++) ctx.lineTo(x, y + (k % 2 ? h : 0)); ctx.stroke(); }
    } else if (key === "arabesque") {
      ctx.strokeStyle = hexA(th.accent, 0.08); ctx.lineWidth = Math.max(1, u * 0.0017);
      const s = u * 0.13;
      for (let y = s * 0.5; y < H; y += s) for (let x = s * 0.5; x < W; x += s) {
        ctx.beginPath(); ctx.arc(x, y, s * 0.5, Math.PI, 1.5 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + s, y, s * 0.5, Math.PI, 1.5 * Math.PI); ctx.stroke();
        ctx.beginPath(); ctx.arc(x + s * 0.5, y, s * 0.5, 0.5 * Math.PI, Math.PI); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ===== مكتبة الخلفيات الدينية (مرسومة برمجيًا — تعمل دون إنترنت) =====
  function sStar(ctx, x, y, r, color) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
  function sCrescent(ctx, cx, cy, r, color, mask) {
    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = mask; ctx.beginPath(); ctx.arc(cx + r * 0.5, cy - r * 0.22, r * 0.92, 0, 6.2832); ctx.fill();
  }
  function sDome(ctx, cx, by, r) {
    ctx.beginPath(); ctx.arc(cx, by, r, Math.PI, 0); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx - r * 0.22, by - r * 0.96); ctx.quadraticCurveTo(cx, by - r * 1.55, cx + r * 0.22, by - r * 0.96); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - r * 0.03, by - r * 1.75, r * 0.06, r * 0.28);
  }
  function sMinaret(ctx, cx, by, w, h) {
    ctx.fillRect(cx - w / 2, by - h, w, h);
    ctx.beginPath(); ctx.arc(cx, by - h, w * 0.75, Math.PI, 0); ctx.fill();
    ctx.fillRect(cx - w * 0.07, by - h - w * 1.3, w * 0.14, w * 0.7);
  }
  function girihStar(ctx, cx, cy, R, color) {
    ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, R * 0.05); ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = (Math.PI / 4) * i, r2 = i % 2 ? R * 0.42 : R; const x = cx + Math.cos(a) * r2, y = cy + Math.sin(a) * r2; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.closePath(); ctx.stroke();
  }
  function drawScene(ctx, W, H, th, key) {
    const u = Math.min(W, H), acc = th.accent, sky = th.bg[0];
    ctx.save();
    if (key === "mosque" || key === "dome") {
      [[.18, .22], [.34, .14], [.62, .17], [.86, .26], [.5, .1], [.72, .33], [.26, .35]].forEach(p => sStar(ctx, W * p[0], H * p[1], u * 0.007, hexA(acc, 0.6)));
      sCrescent(ctx, W * 0.8, H * 0.19, u * 0.052, acc, sky);
      const y = H * 0.86; ctx.fillStyle = "rgba(0,0,0,0.40)"; ctx.fillRect(0, y, W, H - y);
      if (key === "dome") { sMinaret(ctx, W * 0.26, y, u * 0.045, u * 0.40); sMinaret(ctx, W * 0.74, y, u * 0.045, u * 0.40); sDome(ctx, W * 0.5, y, u * 0.2); }
      else { sMinaret(ctx, W * 0.30, y, u * 0.04, u * 0.34); sMinaret(ctx, W * 0.70, y, u * 0.04, u * 0.34); sDome(ctx, W * 0.5, y, u * 0.15); sDome(ctx, W * 0.23, y, u * 0.08); sDome(ctx, W * 0.77, y, u * 0.08); }
    } else if (key === "night") {
      ctx.fillStyle = "rgba(0,0,10,0.25)"; ctx.fillRect(0, 0, W, H);
      for (let i = 0; i < 70; i++) { const x = ((i * 73) % 100) / 100 * W, yy = ((i * 191) % 100) / 100 * H * 0.85; sStar(ctx, x, yy, u * (i % 5 ? 0.0045 : 0.008), hexA(acc, 0.7)); }
      sCrescent(ctx, W * 0.7, H * 0.22, u * 0.09, acc, sky);
    } else if (key === "arch") {
      ctx.strokeStyle = hexA(acc, 0.55); ctx.lineWidth = Math.max(2, u * 0.006);
      const mx = W * 0.16, top = H * 0.12, bot = H * 0.9, r = (W - 2 * mx) / 2;
      ctx.beginPath(); ctx.moveTo(mx, bot); ctx.lineTo(mx, top + r * 0.5);
      ctx.quadraticCurveTo(mx, top, W / 2, top); ctx.quadraticCurveTo(W - mx, top, W - mx, top + r * 0.5);
      ctx.lineTo(W - mx, bot); ctx.stroke();
      ctx.lineWidth = Math.max(1, u * 0.0025); ctx.strokeStyle = hexA(acc, 0.3);
      ctx.beginPath(); ctx.moveTo(mx + u * 0.02, bot); ctx.lineTo(mx + u * 0.02, top + r * 0.5);
      ctx.quadraticCurveTo(mx + u * 0.02, top + u * 0.02, W / 2, top + u * 0.02); ctx.quadraticCurveTo(W - mx - u * 0.02, top + u * 0.02, W - mx - u * 0.02, top + r * 0.5); ctx.lineTo(W - mx - u * 0.02, bot); ctx.stroke();
    } else if (key === "lantern") {
      const xs = [0.22, 0.5, 0.78], hs = [0.18, 0.28, 0.18];
      xs.forEach((px, i) => {
        const x = W * px, top = 0, ly = H * hs[i], s = u * 0.06;
        ctx.strokeStyle = hexA(acc, 0.5); ctx.lineWidth = Math.max(1, u * 0.002); ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, ly); ctx.stroke();
        ctx.fillStyle = hexA(acc, 0.85); ctx.beginPath(); ctx.arc(x, ly, s * 0.18, 0, 6.2832); ctx.fill();
        ctx.strokeStyle = hexA(acc, 0.7); ctx.lineWidth = Math.max(1.5, u * 0.003);
        ctx.beginPath(); ctx.moveTo(x - s * 0.5, ly + s * 0.3); ctx.lineTo(x - s * 0.35, ly + s * 1.3); ctx.lineTo(x + s * 0.35, ly + s * 1.3); ctx.lineTo(x + s * 0.5, ly + s * 0.3); ctx.closePath(); ctx.stroke();
        sStar(ctx, x, ly + s * 0.8, s * 0.16, hexA(acc, 0.9));
      });
    } else if (key === "girih") {
      const step = u * 0.2;
      for (let y = step * 0.6; y < H; y += step) for (let x = step * 0.6; x < W; x += step) girihStar(ctx, x, y, step * 0.4, hexA(acc, 0.16));
    } else if (key === "rays") {
      ctx.globalCompositeOperation = "lighter";
      const cx = W / 2, cy = -H * 0.1;
      for (let i = -6; i <= 6; i++) { ctx.fillStyle = hexA(acc, 0.05); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + i * u * 0.12 - u * 0.05, H); ctx.lineTo(cx + i * u * 0.12 + u * 0.05, H); ctx.closePath(); ctx.fill(); }
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, u * 0.8); rg.addColorStop(0, hexA(acc, 0.25)); rg.addColorStop(1, hexA(acc, 0)); ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    } else if (key === "bokeh") {
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 22; i++) { const x = ((i * 137) % 100) / 100 * W, y = ((i * 89) % 100) / 100 * H, r = u * (0.02 + (i % 5) * 0.012); const rg = ctx.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, hexA(acc, 0.18)); rg.addColorStop(1, hexA(acc, 0)); ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); }
    }
    ctx.restore();
  }

  // زخرفة مركزية محايدة (نور + دوائر ونقاط) — بلا أي شكل قد يُفهم رمزًا
  function drawMedallion(ctx, W, H, u, accent) {
    ctx.save();
    ctx.translate(W / 2, H * 0.5);
    // وهج ناعم
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, u * 0.42);
    g.addColorStop(0, hexA(accent, 0.07)); g.addColorStop(1, hexA(accent, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, u * 0.42, 0, 6.2832); ctx.fill();
    // حلقات متّحدة المركز (محايدة)
    ctx.strokeStyle = hexA(accent, 0.085); ctx.lineWidth = Math.max(1, u * 0.0016);
    [0.32, 0.235, 0.15].forEach(r => { ctx.beginPath(); ctx.arc(0, 0, u * r, 0, 6.2832); ctx.stroke(); });
    // نقاط لطيفة موزّعة على الحلقة
    ctx.fillStyle = hexA(accent, 0.11);
    for (let i = 0; i < 12; i++) { const a = Math.PI / 6 * i; ctx.beginPath(); ctx.arc(Math.cos(a) * u * 0.32, Math.sin(a) * u * 0.32, u * 0.0042, 0, 6.2832); ctx.fill(); }
    ctx.restore();
  }
  // فاصل زخرفي (خط بطرفين ومعيّن في الوسط)
  function drawFlourish(ctx, cx, y, halfW, accent, u) {
    ctx.strokeStyle = hexA(accent, 0.5); ctx.lineWidth = Math.max(1, u * 0.0016); ctx.fillStyle = hexA(accent, 0.75);
    ctx.beginPath(); ctx.moveTo(cx - halfW, y); ctx.lineTo(cx - u * 0.022, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + u * 0.022, y); ctx.lineTo(cx + halfW, y); ctx.stroke();
    ctx.save(); ctx.translate(cx, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-u * 0.009, -u * 0.009, u * 0.018, u * 0.018); ctx.restore();
    ctx.beginPath(); ctx.arc(cx - halfW, y, u * 0.0045, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + halfW, y, u * 0.0045, 0, 6.2832); ctx.fill();
  }

  // إطارات متنوّعة
  function drawFrame(ctx, W, H, u, accent, style) {
    if (!style || style === "none") return;
    ctx.save();
    const fm = u * 0.045, r = u * 0.026;
    ctx.setLineDash([]);
    ctx.strokeStyle = hexA(accent, 0.55); ctx.lineWidth = Math.max(2, u * 0.0035);
    if (style === "corners") {
      const m = fm * 1.1, L = u * 0.075; ctx.lineWidth = Math.max(2.5, u * 0.004);
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]
        .forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x + L * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + L * sy); ctx.stroke(); });
      ctx.restore(); return;
    }
    if (style === "dashed") {
      ctx.setLineDash([u * 0.02, u * 0.013]);
      roundRect(ctx, fm, fm, W - 2 * fm, H - 2 * fm, r); ctx.stroke();
      ctx.restore(); return;
    }
    if (style === "thick") {
      ctx.lineWidth = Math.max(4, u * 0.012);
      roundRect(ctx, fm, fm, W - 2 * fm, H - 2 * fm, r); ctx.stroke();
      ctx.strokeStyle = hexA(accent, 0.9); ctx.lineWidth = Math.max(1, u * 0.0015);
      const o = fm * 1.7; roundRect(ctx, o, o, W - 2 * o, H - 2 * o, u * 0.02); ctx.stroke();
      ctx.restore(); return;
    }
    if (style === "beaded") {
      roundRect(ctx, fm, fm, W - 2 * fm, H - 2 * fm, r); ctx.stroke();
      ctx.fillStyle = hexA(accent, 0.8);
      const o = fm * 1.6, x0 = o, y0 = o, x1 = W - o, y1 = H - o, step = u * 0.028, br = Math.max(1, u * 0.0034);
      for (let x = x0; x <= x1 + 1; x += step) { ctx.beginPath(); ctx.arc(x, y0, br, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.arc(x, y1, br, 0, 6.2832); ctx.fill(); }
      for (let y = y0; y <= y1 + 1; y += step) { ctx.beginPath(); ctx.arc(x0, y, br, 0, 6.2832); ctx.fill(); ctx.beginPath(); ctx.arc(x1, y, br, 0, 6.2832); ctx.fill(); }
      ctx.restore(); return;
    }
    if (style === "inner") {
      roundRect(ctx, fm, fm, W - 2 * fm, H - 2 * fm, r); ctx.stroke();
      ctx.strokeStyle = hexA(accent, 0.3); ctx.lineWidth = Math.max(1, u * 0.0016);
      const o = fm * 2.1; roundRect(ctx, o, o, W - 2 * o, H - 2 * o, u * 0.016); ctx.stroke();
      ctx.fillStyle = accent; const d = u * 0.009;
      [[W / 2, o], [W / 2, H - o], [o, H / 2], [W - o, H / 2]].forEach(([x, y]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-d / 2, -d / 2, d, d); ctx.restore(); });
      ctx.restore(); return;
    }
    if (style === "deco") {
      roundRect(ctx, fm, fm, W - 2 * fm, H - 2 * fm, r); ctx.stroke();
      const m = fm * 1.05, L = u * 0.062; ctx.lineWidth = Math.max(2.5, u * 0.004);
      [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath(); ctx.moveTo(x + L * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + L * sy); ctx.stroke();
        ctx.fillStyle = accent; ctx.save(); ctx.translate(x + L * 0.5 * sx, y + L * 0.5 * sy); ctx.rotate(Math.PI / 4); const d = u * 0.011; ctx.fillRect(-d / 2, -d / 2, d, d); ctx.restore();
      });
      ctx.restore(); return;
    }
    if (style === "ribbon") {
      const o = fm * 1.4;
      roundRect(ctx, o, o, W - 2 * o, H - 2 * o, u * 0.02); ctx.stroke();
      ctx.fillStyle = accent;
      [[W / 2, o], [W / 2, H - o]].forEach(([x, y]) => {
        ctx.beginPath(); ctx.moveTo(x - u * 0.05, y); ctx.lineTo(x, y - u * 0.018); ctx.lineTo(x + u * 0.05, y); ctx.lineTo(x, y + u * 0.018); ctx.closePath(); ctx.fill();
      });
      ctx.restore(); return;
    }
    // simple / double / ornate يشتركون في الإطار الخارجي
    roundRect(ctx, fm, fm, W - 2 * fm, H - 2 * fm, r); ctx.stroke();
    if (style === "double" || style === "ornate") {
      const o = fm * 1.35;
      ctx.strokeStyle = hexA(accent, 0.25); ctx.lineWidth = Math.max(1.5, u * 0.0018);
      roundRect(ctx, o, o, W - 2 * o, H - 2 * o, u * 0.02); ctx.stroke();
    }
    if (style === "ornate") {
      ctx.fillStyle = accent; const d = u * 0.013;
      [[fm, fm], [W - fm, fm], [fm, H - fm], [W - fm, H - fm]]
        .forEach(([x, y]) => { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4); ctx.fillRect(-d / 2, -d / 2, d, d); ctx.restore(); });
    }
    ctx.restore();
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function hexA(hex, a) {
    const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  function isLight(hex) {
    const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) > 150;
  }
  // مزامنة كل مؤشّرات لوحة البطاقة مع الحالة الحالية
  function refreshCardUI() {
    view.querySelectorAll(".theme-dot").forEach((x, i) => x.classList.toggle("active", i === cardState.theme));
    view.querySelectorAll("#frameRow .chip").forEach(x => x.classList.toggle("active", x.dataset.frame === cardState.frame));
    view.querySelectorAll("#patternRow .chip").forEach(x => x.classList.toggle("active", (x.dataset.pattern || "") === (cardState.pattern || "")));
    view.querySelectorAll("#bgRow .chip").forEach(x => x.classList.toggle("active", (x.dataset.bg || "") === (cardState.bg || "")));
    view.querySelectorAll("#textColors .swatch").forEach(x => x.classList.toggle("active", (x.dataset.col || "") === (cardState.textColor || "")));
    view.querySelectorAll("#colorRail .vsw").forEach(x => x.classList.toggle("active", (x.dataset.col || "") === (cardState.textColor || "")));
  }

  function cardTextForShare() {
    let t = "";
    if (cardState.toName) t += "🎁 إلى: " + cardState.toName + "\n\n";
    else if (cardState.title) t += "【 " + cardState.title + " 】\n\n";
    t += cardState.text;
    const pre = prophetPreamble(cardState.text, cardState.source);
    if (pre) t += "\n— " + pre;
    if (cardState.source) t += "\n﴿ " + cardState.source + " ﴾";
    if (cardState.fromName) t += "\n\nمن: " + cardState.fromName;
    return t + "\n\nتطبيق أذكار — https://" + SITE;
  }
  function copyCardText() {
    navigator.clipboard.writeText(cardTextForShare())
      .then(() => toast("تم نسخ النص ✓")).catch(() => toast("تعذّر النسخ"));
  }
  function exportCard(mode) {
    const canvas = document.getElementById("cardCanvas");
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], "thikr.png", { type: "image/png" });
      if (mode === "share") {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await navigator.share({ files: [file], text: cardTextForShare() }); return; }
          catch (e) { if (e && e.name === "AbortError") return; }
        }
        toast("سيتم تنزيل الصورة لمشاركتها");
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "ذكر.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }, "image/png");
  }

  /* ============== تبويب المواقيت ============== */
  const REGIONS = [
    { name: "مكة المكرمة", group: "منطقة مكة المكرمة", coords: true, lat: 21.3891, lng: 39.8579, method: 4 },
    { name: "جدة", group: "منطقة مكة المكرمة", coords: true, lat: 21.4858, lng: 39.1925, method: 4 },
    { name: "الطائف", group: "منطقة مكة المكرمة", coords: true, lat: 21.2854, lng: 40.4183, method: 4 },
    { name: "القنفذة", group: "منطقة مكة المكرمة", coords: true, lat: 19.1264, lng: 41.0789, method: 4 },
    { name: "رابغ", group: "منطقة مكة المكرمة", coords: true, lat: 22.7986, lng: 39.0349, method: 4 },
    { name: "الليث", group: "منطقة مكة المكرمة", coords: true, lat: 20.15, lng: 40.267, method: 4 },
    { name: "الجموم", group: "منطقة مكة المكرمة", coords: true, lat: 21.619, lng: 39.697, method: 4 },
    { name: "خليص", group: "منطقة مكة المكرمة", coords: true, lat: 22.153, lng: 39.317, method: 4 },
    { name: "تربة", group: "منطقة مكة المكرمة", coords: true, lat: 21.215, lng: 41.63, method: 4 },
    { name: "رنية", group: "منطقة مكة المكرمة", coords: true, lat: 21.267, lng: 42.85, method: 4 },
    { name: "أضم", group: "منطقة مكة المكرمة", coords: true, lat: 20.76, lng: 41, method: 4 },
    { name: "المدينة المنورة", group: "منطقة المدينة المنورة", coords: true, lat: 24.5247, lng: 39.5692, method: 4 },
    { name: "ينبع", group: "منطقة المدينة المنورة", coords: true, lat: 24.0895, lng: 38.0618, method: 4 },
    { name: "العلا", group: "منطقة المدينة المنورة", coords: true, lat: 26.608, lng: 37.922, method: 4 },
    { name: "بدر", group: "منطقة المدينة المنورة", coords: true, lat: 23.78, lng: 38.79, method: 4 },
    { name: "الحناكية", group: "منطقة المدينة المنورة", coords: true, lat: 24.887, lng: 40.518, method: 4 },
    { name: "مهد الذهب", group: "منطقة المدينة المنورة", coords: true, lat: 23.49, lng: 40.86, method: 4 },
    { name: "خيبر", group: "منطقة المدينة المنورة", coords: true, lat: 25.7, lng: 39.29, method: 4 },
    { name: "الرياض", group: "منطقة الرياض", coords: true, lat: 24.7136, lng: 46.6753, method: 4 },
    { name: "الخرج", group: "منطقة الرياض", coords: true, lat: 24.1554, lng: 47.3346, method: 4 },
    { name: "الدوادمي", group: "منطقة الرياض", coords: true, lat: 24.5074, lng: 44.3922, method: 4 },
    { name: "المجمعة", group: "منطقة الرياض", coords: true, lat: 25.9039, lng: 45.345, method: 4 },
    { name: "الزلفي", group: "منطقة الرياض", coords: true, lat: 26.2997, lng: 44.8048, method: 4 },
    { name: "وادي الدواسر", group: "منطقة الرياض", coords: true, lat: 20.4504, lng: 44.7855, method: 4 },
    { name: "عفيف", group: "منطقة الرياض", coords: true, lat: 23.9065, lng: 42.9176, method: 4 },
    { name: "القويعية", group: "منطقة الرياض", coords: true, lat: 24.072, lng: 45.262, method: 4 },
    { name: "شقراء", group: "منطقة الرياض", coords: true, lat: 25.24, lng: 45.252, method: 4 },
    { name: "حوطة بني تميم", group: "منطقة الرياض", coords: true, lat: 23.523, lng: 46.853, method: 4 },
    { name: "الأفلاج", group: "منطقة الرياض", coords: true, lat: 22.287, lng: 46.733, method: 4 },
    { name: "الحريق", group: "منطقة الرياض", coords: true, lat: 23.62, lng: 46.15, method: 4 },
    { name: "بريدة", group: "منطقة القصيم", coords: true, lat: 26.326, lng: 43.975, method: 4 },
    { name: "عنيزة", group: "منطقة القصيم", coords: true, lat: 26.084, lng: 43.994, method: 4 },
    { name: "الرس", group: "منطقة القصيم", coords: true, lat: 25.869, lng: 43.497, method: 4 },
    { name: "المذنب", group: "منطقة القصيم", coords: true, lat: 25.862, lng: 44.221, method: 4 },
    { name: "البكيرية", group: "منطقة القصيم", coords: true, lat: 26.139, lng: 43.654, method: 4 },
    { name: "البدائع", group: "منطقة القصيم", coords: true, lat: 26, lng: 43.767, method: 4 },
    { name: "رياض الخبراء", group: "منطقة القصيم", coords: true, lat: 26.056, lng: 43.506, method: 4 },
    { name: "عيون الجواء", group: "منطقة القصيم", coords: true, lat: 26, lng: 43.7, method: 4 },
    { name: "الدمام", group: "المنطقة الشرقية", coords: true, lat: 26.4207, lng: 50.0888, method: 4 },
    { name: "الخبر", group: "المنطقة الشرقية", coords: true, lat: 26.2172, lng: 50.1971, method: 4 },
    { name: "الظهران", group: "المنطقة الشرقية", coords: true, lat: 26.288, lng: 50.114, method: 4 },
    { name: "الأحساء (الهفوف)", group: "المنطقة الشرقية", coords: true, lat: 25.3833, lng: 49.5867, method: 4 },
    { name: "الجبيل", group: "المنطقة الشرقية", coords: true, lat: 27.0046, lng: 49.6606, method: 4 },
    { name: "القطيف", group: "المنطقة الشرقية", coords: true, lat: 26.565, lng: 49.996, method: 4 },
    { name: "حفر الباطن", group: "المنطقة الشرقية", coords: true, lat: 28.4326, lng: 45.9636, method: 4 },
    { name: "الخفجي", group: "المنطقة الشرقية", coords: true, lat: 28.4392, lng: 48.491, method: 4 },
    { name: "رأس تنورة", group: "المنطقة الشرقية", coords: true, lat: 26.642, lng: 50.158, method: 4 },
    { name: "بقيق", group: "المنطقة الشرقية", coords: true, lat: 25.934, lng: 49.667, method: 4 },
    { name: "النعيرية", group: "المنطقة الشرقية", coords: true, lat: 27.467, lng: 48.483, method: 4 },
    { name: "أبها", group: "منطقة عسير", coords: true, lat: 18.2164, lng: 42.5053, method: 4 },
    { name: "خميس مشيط", group: "منطقة عسير", coords: true, lat: 18.3, lng: 42.729, method: 4 },
    { name: "بيشة", group: "منطقة عسير", coords: true, lat: 19.9764, lng: 42.601, method: 4 },
    { name: "النماص", group: "منطقة عسير", coords: true, lat: 19.15, lng: 42.12, method: 4 },
    { name: "محايل عسير", group: "منطقة عسير", coords: true, lat: 18.55, lng: 42.05, method: 4 },
    { name: "ظهران الجنوب", group: "منطقة عسير", coords: true, lat: 17.66, lng: 43.51, method: 4 },
    { name: "سراة عبيدة", group: "منطقة عسير", coords: true, lat: 18.2, lng: 43, method: 4 },
    { name: "تثليث", group: "منطقة عسير", coords: true, lat: 19.57, lng: 43.52, method: 4 },
    { name: "رجال ألمع", group: "منطقة عسير", coords: true, lat: 18.19, lng: 42.3, method: 4 },
    { name: "تبوك", group: "منطقة تبوك", coords: true, lat: 28.3838, lng: 36.555, method: 4 },
    { name: "الوجه", group: "منطقة تبوك", coords: true, lat: 26.239, lng: 36.464, method: 4 },
    { name: "ضباء", group: "منطقة تبوك", coords: true, lat: 27.35, lng: 35.69, method: 4 },
    { name: "تيماء", group: "منطقة تبوك", coords: true, lat: 27.629, lng: 38.549, method: 4 },
    { name: "أملج", group: "منطقة تبوك", coords: true, lat: 25.05, lng: 37.267, method: 4 },
    { name: "حقل", group: "منطقة تبوك", coords: true, lat: 29.279, lng: 34.938, method: 4 },
    { name: "حائل", group: "منطقة حائل", coords: true, lat: 27.5114, lng: 41.7208, method: 4 },
    { name: "بقعاء", group: "منطقة حائل", coords: true, lat: 27.85, lng: 42.75, method: 4 },
    { name: "الغزالة", group: "منطقة حائل", coords: true, lat: 26.93, lng: 41.7, method: 4 },
    { name: "الشنان", group: "منطقة حائل", coords: true, lat: 27.22, lng: 42.18, method: 4 },
    { name: "عرعر", group: "منطقة الحدود الشمالية", coords: true, lat: 30.9753, lng: 41.0381, method: 4 },
    { name: "رفحاء", group: "منطقة الحدود الشمالية", coords: true, lat: 29.62, lng: 43.5, method: 4 },
    { name: "طريف", group: "منطقة الحدود الشمالية", coords: true, lat: 31.677, lng: 38.663, method: 4 },
    { name: "العويقيلة", group: "منطقة الحدود الشمالية", coords: true, lat: 30.33, lng: 42.2, method: 4 },
    { name: "جازان", group: "منطقة جازان", coords: true, lat: 16.8892, lng: 42.5511, method: 4 },
    { name: "صبيا", group: "منطقة جازان", coords: true, lat: 17.149, lng: 42.625, method: 4 },
    { name: "أبو عريش", group: "منطقة جازان", coords: true, lat: 16.969, lng: 42.832, method: 4 },
    { name: "صامطة", group: "منطقة جازان", coords: true, lat: 16.597, lng: 42.945, method: 4 },
    { name: "بيش", group: "منطقة جازان", coords: true, lat: 17.376, lng: 42.591, method: 4 },
    { name: "الدرب", group: "منطقة جازان", coords: true, lat: 17.722, lng: 42.253, method: 4 },
    { name: "فرسان", group: "منطقة جازان", coords: true, lat: 16.7, lng: 42.117, method: 4 },
    { name: "أحد المسارحة", group: "منطقة جازان", coords: true, lat: 16.71, lng: 42.95, method: 4 },
    { name: "نجران", group: "منطقة نجران", coords: true, lat: 17.4917, lng: 44.1322, method: 4 },
    { name: "شرورة", group: "منطقة نجران", coords: true, lat: 17.484, lng: 47.117, method: 4 },
    { name: "حبونا", group: "منطقة نجران", coords: true, lat: 17.74, lng: 44.5, method: 4 },
    { name: "بدر الجنوب", group: "منطقة نجران", coords: true, lat: 17.9, lng: 44.7, method: 4 },
    { name: "الباحة", group: "منطقة الباحة", coords: true, lat: 20.0129, lng: 41.4677, method: 4 },
    { name: "بلجرشي", group: "منطقة الباحة", coords: true, lat: 19.86, lng: 41.56, method: 4 },
    { name: "المندق", group: "منطقة الباحة", coords: true, lat: 20.17, lng: 41.28, method: 4 },
    { name: "المخواة", group: "منطقة الباحة", coords: true, lat: 19.75, lng: 41.43, method: 4 },
    { name: "قلوة", group: "منطقة الباحة", coords: true, lat: 19.88, lng: 41.63, method: 4 },
    { name: "العقيق", group: "منطقة الباحة", coords: true, lat: 20.27, lng: 41.64, method: 4 },
    { name: "سكاكا", group: "منطقة الجوف", coords: true, lat: 29.9697, lng: 40.2064, method: 4 },
    { name: "القريات", group: "منطقة الجوف", coords: true, lat: 31.332, lng: 37.342, method: 4 },
    { name: "دومة الجندل", group: "منطقة الجوف", coords: true, lat: 29.812, lng: 39.867, method: 4 },
    { name: "طبرجل", group: "منطقة الجوف", coords: true, lat: 30.5, lng: 38.22, method: 4 },
    { name: "القاهرة", group: "دول عربية وإسلامية", city: "Cairo", country: "Egypt", method: 5 },
    { name: "دبي", group: "دول عربية وإسلامية", city: "Dubai", country: "United Arab Emirates", method: 8 },
    { name: "الكويت", group: "دول عربية وإسلامية", city: "Kuwait City", country: "Kuwait", method: 9 },
    { name: "الدوحة", group: "دول عربية وإسلامية", city: "Doha", country: "Qatar", method: 4 },
    { name: "المنامة", group: "دول عربية وإسلامية", city: "Manama", country: "Bahrain", method: 4 },
    { name: "مسقط", group: "دول عربية وإسلامية", city: "Muscat", country: "Oman", method: 8 },
    { name: "عمّان", group: "دول عربية وإسلامية", city: "Amman", country: "Jordan", method: 23 },
    { name: "بغداد", group: "دول عربية وإسلامية", city: "Baghdad", country: "Iraq", method: 3 },
    { name: "بيروت", group: "دول عربية وإسلامية", city: "Beirut", country: "Lebanon", method: 3 },
    { name: "الخرطوم", group: "دول عربية وإسلامية", city: "Khartoum", country: "Sudan", method: 5 },
    { name: "إسطنبول", group: "دول عربية وإسلامية", city: "Istanbul", country: "Turkey", method: 13 },
  ];
  const PRAYERS = [
    { k: "Fajr", n: "الفجر", ic: "🌅" }, { k: "Sunrise", n: "الشروق", ic: "☀️" },
    { k: "Dhuhr", n: "الظهر", ic: "🌤️" }, { k: "Asr", n: "العصر", ic: "🌇" },
    { k: "Maghrib", n: "المغرب", ic: "🌆" }, { k: "Isha", n: "العشاء", ic: "🌙" }
  ];
  const PRAYER_SETTINGS_KEY = "prayer_region";
  const PRAYER_CACHE_KEY = "prayer_cache";

  function ddmmyyyy(d) {
    const p = n => String(n).padStart(2, "0");
    return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}`;
  }

  function renderPrayer() {
    appTitle.textContent = "مواقيت الصلاة";
    backBtn.classList.add("hidden");
    let savedIdx = parseInt(localStorage.getItem(PRAYER_SETTINGS_KEY) || "0", 10);
    if (!(savedIdx >= 0 && savedIdx < REGIONS.length)) savedIdx = 0;
    const grp = {};
    REGIONS.forEach((r, i) => { (grp[r.group] = grp[r.group] || []).push(i); });
    const opts = Object.keys(grp).map(g => `<optgroup label="${g}">` + grp[g].map(i => `<option value="${i}" ${i === savedIdx ? "selected" : ""}>${REGIONS[i].name}</option>`).join("") + `</optgroup>`).join("");
    view.innerHTML = `
      <div class="prayer-top">
        <select id="regionSel" class="region-sel">${opts}</select>
        <button class="act" id="geoBtn">📍 موقعي</button>
      </div>
      <div id="prayerBody"><div class="loading">جارٍ تحميل المواقيت…</div></div>
      <p class="src-note">المصدر: Aladhan API — حساب أم القرى والهيئات المعتمدة. يتحدّث يوميًا تلقائيًا.</p>
    `;
    view.querySelector("#regionSel").addEventListener("change", (e) => {
      const i = parseInt(e.target.value, 10);
      localStorage.setItem(PRAYER_SETTINGS_KEY, i);
      loadPrayer(REGIONS[i]);
    });
    view.querySelector("#geoBtn").addEventListener("click", useGeolocation);
    loadPrayer(REGIONS[savedIdx]);
    window.scrollTo(0, 0);
  }

  function regionKey(r) { return r.coords ? `geo_${r.lat.toFixed(2)}_${r.lng.toFixed(2)}` : `${r.city}_${r.country}`; }

  async function loadPrayer(region) {
    const body = document.getElementById("prayerBody"); if (!body) return;
    const dateKey = ddmmyyyy(todayDate);
    const rKey = regionKey(region);
    // جرّب الكاش أولًا (يعمل بدون إنترنت لليوم نفسه)
    const cache = readCache();
    if (cache && cache.rKey === rKey && cache.dateKey === dateKey) {
      return renderPrayerData(cache.data, region, false);
    }
    body.innerHTML = `<div class="loading">جارٍ تحميل المواقيت…</div>`;
    try {
      const url = region.coords
        ? `https://api.aladhan.com/v1/timings/${dateKey}?latitude=${region.lat}&longitude=${region.lng}&method=${region.method || 4}`
        : `https://api.aladhan.com/v1/timingsByCity/${dateKey}?city=${encodeURIComponent(region.city)}&country=${encodeURIComponent(region.country)}&method=${region.method || 4}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.code !== 200 || !json.data) throw new Error("bad");
      writeCache({ rKey, dateKey, data: json.data });
      renderPrayerData(json.data, region, false);
    } catch (e) {
      // عند الفشل: اعرض آخر نسخة محفوظة إن وُجدت
      if (cache && cache.rKey === rKey) renderPrayerData(cache.data, region, true);
      else body.innerHTML = `<div class="err">تعذّر تحميل المواقيت. تأكّد من الاتصال بالإنترنت لأول مرة، وبعدها ستعمل دون اتصال لليوم نفسه.</div>`;
    }
  }
  function readCache() { try { return JSON.parse(localStorage.getItem(PRAYER_CACHE_KEY) || "null"); } catch (e) { return null; } }
  function writeCache(o) { try { localStorage.setItem(PRAYER_CACHE_KEY, JSON.stringify(o)); } catch (e) {} }

  function renderPrayerData(data, region, stale) {
    const body = document.getElementById("prayerBody"); if (!body) return;
    const t = data.timings, hj = data.date.hijri, gr = data.date.gregorian;
    const hijri = `${hj.weekday.ar} ${hj.day} ${hj.month.ar} ${hj.year}هـ`;
    const greg = `${gr.day} ${gr.month.en} ${gr.year}م`;
    const clean = s => (s || "").split(" ")[0];
    const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes();
    const timed = PRAYERS.map(p => { const [h, m] = clean(t[p.k]).split(":").map(Number); return { ...p, min: h * 60 + m, time: clean(t[p.k]) }; });
    const upcoming = timed.filter(p => p.k !== "Sunrise").find(p => p.min > nowMin);
    const nextK = upcoming ? upcoming.k : "Fajr";
    let nextInfo = "";
    if (upcoming) {
      const diff = upcoming.min - nowMin; const hh = Math.floor(diff / 60), mm = diff % 60;
      nextInfo = `الصلاة القادمة: <b>${upcoming.n}</b> — بعد ${hh ? hh + " ساعة و" : ""}${mm} دقيقة`;
    } else nextInfo = `انتهت صلوات اليوم — القادمة <b>الفجر</b> غدًا`;

    let rows = timed.map(p => `
      <div class="prayer-row ${p.k === nextK ? "next" : ""}">
        <span class="pr-name">${p.ic} ${p.n}</span>
        <span class="pr-time">${to12(p.time)}</span>
      </div>`).join("");

    body.innerHTML = `
      <div class="date-card">
        <div class="hijri">${hijri}</div>
        <div class="greg">${greg}</div>
        <div class="region-name">📍 ${region.name || "موقعي الحالي"}</div>
      </div>
      ${stale ? '<div class="stale">⚠️ عرض آخر نسخة محفوظة (تعذّر التحديث)</div>' : ""}
      <div class="next-prayer">${nextInfo}</div>
      <div class="prayer-table">${rows}</div>
    `;
  }
  function to12(hm) {
    let [h, m] = hm.split(":").map(Number);
    const am = h < 12; const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${am ? "ص" : "م"}`;
  }
  function useGeolocation() {
    if (!navigator.geolocation) return toast("الموقع غير مدعوم في متصفحك");
    toast("جارٍ تحديد موقعك…");
    navigator.geolocation.getCurrentPosition(
      pos => {
        const region = { name: "موقعي الحالي", coords: true, lat: pos.coords.latitude, lng: pos.coords.longitude, method: 4 };
        loadPrayer(region);
      },
      () => toast("تعذّر الوصول للموقع — اختر منطقة يدويًا"),
      { timeout: 10000 }
    );
  }

  /* ----- مشاركة ذكر (نصًا أو بطاقة) ----- */
  function shareDhikr(text, source) {
    const pre = prophetPreamble(text, source);
    const t = text + (pre ? "\n— " + pre : "") + (source ? "\n﴿ " + source + " ﴾" : "") + "\n\nتطبيق أذكار — https://" + SITE;
    if (navigator.share) navigator.share({ text: t }).catch(() => {});
    else navigator.clipboard.writeText(t).then(() => toast("تم نسخ الذكر ✓")).catch(() => toast("تعذّر النسخ"));
  }
  function makeCard(text, source, title) {
    cardState.text = text; cardState.source = source || ""; cardState.title = title || "";
    cardState.bgImage = null; cardState.textColor = ""; cardState.textScale = 1;
    switchTab("cards");
    toast("جهّزنا الذكر — صمّم بطاقتك وشاركها 🎴");
  }

  /* ----- حول التطبيق والمصادر ----- */
  function renderAbout() {
    appTitle.textContent = "المصادر ومنهج التوثيق";
    backBtn.classList.remove("hidden");
    goBack = renderAthkarHome;
    view.innerHTML = `
      <div class="about-box">
        <h2>منهج التوثيق</h2>
        <p>يعتمد هذا التطبيق على <b>القرآن الكريم</b> و<b>السنة النبوية الصحيحة</b> فقط، ويتحرّى الأذكار الثابتة، ويتجنّب الضعيف والبدع.</p>
        <h3>المصادر</h3>
        <ul>
          <li>القرآن الكريم (برواية حفص عن عاصم).</li>
          <li>صحيح البخاري وصحيح مسلم، والسنن الأربعة.</li>
          <li>كتاب «حصن المسلم» للشيخ سعيد بن علي القحطاني رحمه الله — من مصدره الرسمي.</li>
          <li>تصحيحات أهل العلم المعتبرين كالشيخ الألباني وغيره.</li>
        </ul>
        <h3>التدقيق المطبَّق فعليًا</h3>
        <ul>
          <li><b>الآيات القرآنية:</b> دُقّقت كلها آليًا بمطابقة حرفية مع نص مصحفي معتمد — <b>مطابقة 100%</b>. وآيات «أدعية الأنبياء والرقية» منسوخة حرفيًا من المصحف.</li>
          <li><b>أذكار حصن المسلم:</b> من المصدر الرسمي للكتاب دون تعديل.</li>
          <li><b>الأحاديث:</b> اقتصرنا على المشهور الصحيح بنسبته (متفق عليه، البخاري، مسلم، والسنن بتصحيح أهل العلم)، وتجنّبنا الضعيف.</li>
        </ul>
        <h3>للتحقق والاستزادة</h3>
        <ul>
          <li>الدرر السنية — dorar.net</li>
          <li>موقع الشيخ ابن باز — binbaz.org.sa</li>
          <li>دار الإفتاء — الموقع الرسمي</li>
        </ul>
        <p class="about-note"><b>تنبيه أمانة:</b> هذا التطبيق عملٌ تطوّعيّ، <b>وليس جهةً رسمية، ولا يمثّل هيئة كبار العلماء أو أي جهة إفتاء، ولا يدّعي اعتمادها</b>. وهو عملٌ بشريّ قابل للخطأ؛ فمن وجد ملاحظةً على نصٍّ فليُبلغنا لتصحيحه. ويُوصى — قبل النشر الواسع — بعرضه على عالمٍ موثوق أو جهة إفتاء رسمية لإجازته.</p>
      </div>`;
    window.scrollTo(0, 0);
  }

  /* ============== تبويب الأعمال الصالحة ============== */
  function renderDeeds() {
    appTitle.textContent = "أعمال صالحة";
    backBtn.classList.add("hidden");
    if (typeof DEEDS === "undefined") { view.innerHTML = `<p class="muted-line">لا يوجد محتوى.</p>`; return; }
    let html = `<p class="intro">أبواب الخير الثابتة في السنة مع فضلها (على نهج كتب الفضائل) — «من دلّ على خير فله مثل أجر فاعله».</p>`;
    let lastSec = "";
    DEEDS.forEach((d, i) => {
      if (d.sec !== lastSec) { if (lastSec) html += `</div>`; html += `<div class="sec-title">${esc(d.sec)}</div><div class="deeds-list">`; lastSec = d.sec; }
      html += `<div class="deed-card">
        <div class="deed-head"><span class="deed-ic">${d.icon}</span><h3>${esc(d.title)}</h3></div>
        <p class="deed-desc">${esc(d.desc)}</p>
        <p class="deed-virtue">${esc(d.virtue)}</p>
        <div class="deed-foot"><span class="source">${esc(d.source)}</span>
          <button class="deed-share" data-i="${i}">📤 شارك</button></div></div>`;
    });
    if (lastSec) html += `</div>`;
    view.innerHTML = html;
    view.querySelectorAll(".deed-share").forEach(b => b.addEventListener("click", () => shareDeed(parseInt(b.dataset.i, 10))));
    window.scrollTo(0, 0);
  }
  function shareDeed(i) {
    const d = DEEDS[i];
    const text = `${d.icon} ${d.title}\n${d.desc}\n\n${d.virtue}\n﴿ ${d.source} ﴾\n\nتطبيق أذكار — https://${SITE}`;
    if (navigator.share) navigator.share({ text }).catch(() => {});
    else navigator.clipboard.writeText(text).then(() => toast("تم نسخ التذكير ✓")).catch(() => toast("تعذّر النسخ"));
  }

  /* ============== تبويب القرآن الكريم ============== */
  const qAudio = (typeof Audio !== "undefined") ? new Audio() : null;
  let qState = { reciterIdx: 0, curIdx: -1, repeat: localStorage.getItem("quran_repeat") || "none" };
  function repeatLabel() {
    return qState.repeat === "all" ? "🔁 تكرار المصحف" : qState.repeat === "one" ? "🔂 تكرار السورة" : "🔁 التكرار: إيقاف";
  }
  const player = document.getElementById("player");
  const plTitle = document.getElementById("plTitle");
  const plToggle = document.getElementById("plToggle");
  const plSeek = document.getElementById("plSeek");

  function surahFile(n) { return String(n).padStart(3, "0") + ".mp3"; }
  function surahURL(reciter, i) { return reciter.server + surahFile(i + 1); }

  // تخزين محلي (IndexedDB) لتحميل السور للعمل دون اتصال
  function idb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open("athkar-quran", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("audio");
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
  }
  async function idbPut(k, v) { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction("audio", "readwrite"); tx.objectStore("audio").put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); }); }
  async function idbGet(k) { const db = await idb(); return new Promise((res) => { const tx = db.transaction("audio", "readonly"); const rq = tx.objectStore("audio").get(k); rq.onsuccess = () => res(rq.result || null); rq.onerror = () => res(null); }); }
  async function idbKeys() { const db = await idb(); return new Promise((res) => { const tx = db.transaction("audio", "readonly"); const rq = tx.objectStore("audio").getAllKeys(); rq.onsuccess = () => res(rq.result || []); rq.onerror = () => res([]); }); }
  async function idbDel(k) { const db = await idb(); return new Promise((res) => { const tx = db.transaction("audio", "readwrite"); tx.objectStore("audio").delete(k); tx.oncomplete = () => res(); tx.onerror = () => res(); }); }
  function dlKey(rid, num) { return rid + ":" + num; }

  function renderQuran() {
    appTitle.textContent = "القرآن الكريم";
    backBtn.classList.add("hidden"); goBack = null;
    if (typeof RECITERS === "undefined") { view.innerHTML = `<p class="muted-line">تعذّر تحميل البيانات.</p>`; return; }
    qState.reciterIdx = parseInt(localStorage.getItem("quran_reciter") || "0", 10);
    const opts = RECITERS.map((r, i) => `<option value="${i}" ${i === qState.reciterIdx ? "selected" : ""}>${r.name}</option>`).join("");
    view.innerHTML = `
      <div class="quran-top">
        <label class="q-label">🎙️ القارئ</label>
        <select id="reciterSel" class="region-sel">${opts}</select>
      </div>
      <div class="quran-controls">
        <button class="act primary" id="playAll">▶ تشغيل المصحف كاملًا</button>
        <button class="act" id="repeatBtn">${repeatLabel()}</button>
      </div>
      <p class="src-note">اضغط السورة للاستماع · يكمل تلقائيًا للسورة التالية · ⬇️ للتحميل دون إنترنت · المصدر: mp3quran.net</p>
      <div class="surah-list" id="surahList"><div class="loading">جارٍ التحميل…</div></div>`;
    view.querySelector("#reciterSel").addEventListener("change", (e) => {
      qState.reciterIdx = parseInt(e.target.value, 10);
      localStorage.setItem("quran_reciter", e.target.value);
      renderSurahList();
    });
    view.querySelector("#playAll").addEventListener("click", () => playSurah(0));
    view.querySelector("#repeatBtn").addEventListener("click", (e) => {
      qState.repeat = qState.repeat === "none" ? "all" : qState.repeat === "all" ? "one" : "none";
      localStorage.setItem("quran_repeat", qState.repeat);
      e.target.textContent = repeatLabel();
      toast(qState.repeat === "all" ? "تكرار المصحف كاملًا 🔁" : qState.repeat === "one" ? "تكرار السورة 🔂" : "إيقاف التكرار");
    });
    renderSurahList();
    window.scrollTo(0, 0);
  }

  async function renderSurahList() {
    const box = document.getElementById("surahList"); if (!box) return;
    const rid = RECITERS[qState.reciterIdx].id;
    let keys;
    try { keys = new Set(await idbKeys()); } catch (e) { keys = new Set(); }
    box.innerHTML = SURAHS.map((name, i) => {
      const num = i + 1, dl = keys.has(dlKey(rid, num));
      const cur = qState.curIdx === i && qAudio && !qAudio.paused;
      return `<div class="surah-row ${cur ? "active" : ""}" data-i="${i}">
        <span class="sr-num">${num}</span>
        <span class="sr-name">${cur ? "🔊 " : ""}${name}</span>
        <button class="sr-read" data-read="${num}" title="قراءة وتفسير">📖</button>
        <button class="sr-dl ${dl ? "done" : ""}" data-dl="${i}" title="${dl ? "محمّلة — اضغط للحذف" : "تحميل"}">${dl ? "✓" : "⬇️"}</button>
      </div>`;
    }).join("");
    box.querySelectorAll(".surah-row").forEach(r => r.addEventListener("click", (e) => {
      if (e.target.closest(".sr-dl") || e.target.closest(".sr-read")) return; playSurah(parseInt(r.dataset.i, 10));
    }));
    box.querySelectorAll(".sr-dl").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation(); toggleDownload(parseInt(b.dataset.dl, 10), b);
    }));
    box.querySelectorAll(".sr-read").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation(); renderSurahRead(parseInt(b.dataset.read, 10), SURAHS[parseInt(b.dataset.read, 10) - 1]);
    }));
  }

  // عارض القراءة والتفسير الميسّر (المصدر الرسمي — مجمع الملك فهد)
  let TAFSEER = null;
  async function loadTafseer() {
    if (TAFSEER) return TAFSEER;
    const r = await fetch("data/tafseer.json"); TAFSEER = await r.json(); return TAFSEER;
  }
  async function renderSurahRead(num, name) {
    appTitle.textContent = "سورة " + name;
    backBtn.classList.remove("hidden"); goBack = renderQuran;
    view.innerHTML = `<div class="cat-head"><h2>سورة ${name}</h2><p>القراءة والتفسير الميسّر — مجمع الملك فهد</p></div><div class="loading">جارٍ تحميل التفسير…</div>`;
    let T; try { T = await loadTafseer(); } catch (e) { view.querySelector(".loading").textContent = "تعذّر تحميل التفسير — تحقّق من الاتصال أول مرة."; return; }
    let html = "";
    for (let a = 1; a <= 286; a++) {
      const e = T[num + ":" + a]; if (!e) { if (a > 7) break; else continue; }
      html += `<div class="ayah-card">
        <div class="ayah-text">${e.t} <span class="ayah-no">${a}</span></div>
        <details class="tafseer"><summary>📖 التفسير الميسّر</summary><div class="tafseer-body">${esc(e.f)}</div></details>
      </div>`;
    }
    view.innerHTML = `<div class="cat-head"><h2>سورة ${name}</h2><p>القراءة والتفسير الميسّر — مجمع الملك فهد</p></div>${html}`;
    window.scrollTo(0, 0);
  }

  async function playSurah(i) {
    if (!qAudio) return;
    stopAudio(); // أوقف صوت حصن المسلم
    qState.curIdx = i;
    const r = RECITERS[qState.reciterIdx], num = i + 1;
    if (qAudio._blobUrl) { URL.revokeObjectURL(qAudio._blobUrl); qAudio._blobUrl = null; }
    let blob = null;
    try { blob = await idbGet(dlKey(r.id, num)); } catch (e) {}
    if (blob) { const u = URL.createObjectURL(blob); qAudio._blobUrl = u; qAudio.src = u; }
    else qAudio.src = surahURL(r, i);
    qAudio.play().then(() => showPlayer(SURAHS[i] + " · " + r.name)).catch(() => toast("تعذّر التشغيل — تحقق من الاتصال"));
    showPlayer(SURAHS[i] + " · " + r.name);
    markSurahRows();
  }
  function markSurahRows() {
    const box = document.getElementById("surahList"); if (!box) return;
    box.querySelectorAll(".surah-row").forEach(r => {
      const i = parseInt(r.dataset.i, 10), cur = i === qState.curIdx && qAudio && !qAudio.paused;
      r.classList.toggle("active", cur);
      const nm = r.querySelector(".sr-name");
      if (nm) nm.textContent = (cur ? "🔊 " : "") + SURAHS[i];
    });
  }

  async function toggleDownload(i, btn) {
    const r = RECITERS[qState.reciterIdx], num = i + 1, key = dlKey(r.id, num);
    if (btn.classList.contains("done")) {
      await idbDel(key); btn.classList.remove("done"); btn.textContent = "⬇️"; btn.title = "تحميل"; toast("حُذفت السورة المحمّلة");
      return;
    }
    btn.textContent = "⏳"; btn.disabled = true;
    try {
      const res = await fetch(surahURL(r, i));
      if (!res.ok) throw new Error("net");
      const blob = await res.blob();
      await idbPut(key, blob);
      btn.classList.add("done"); btn.textContent = "✓"; btn.title = "محمّلة — اضغط للحذف";
      toast("تم تحميل سورة " + SURAHS[i] + " ✓");
    } catch (e) { btn.textContent = "⬇️"; toast("تعذّر التحميل — تحقق من الاتصال"); }
    btn.disabled = false;
  }

  function showPlayer(title) { if (!player) return; player.classList.remove("hidden"); plTitle.textContent = title; plToggle.textContent = "⏸"; }
  if (qAudio && player) {
    qAudio.addEventListener("timeupdate", () => { if (qAudio.duration) plSeek.value = (qAudio.currentTime / qAudio.duration) * 100; });
    qAudio.addEventListener("play", () => { plToggle.textContent = "⏸"; markSurahRows(); });
    qAudio.addEventListener("pause", () => { plToggle.textContent = "▶"; markSurahRows(); });
    qAudio.addEventListener("ended", () => {
      if (qState.repeat === "one") { playSurah(qState.curIdx); return; }
      if (qState.curIdx < 113) playSurah(qState.curIdx + 1);
      else if (qState.repeat === "all") playSurah(0); // ختمة متصلة: العودة للفاتحة
    });
    plToggle.addEventListener("click", () => { if (qAudio.paused) qAudio.play().catch(() => {}); else qAudio.pause(); });
    document.getElementById("plPrev").addEventListener("click", () => { if (qState.curIdx > 0) playSurah(qState.curIdx - 1); });
    document.getElementById("plNext").addEventListener("click", () => { if (qState.curIdx < 113) playSurah(qState.curIdx + 1); });
    plSeek.addEventListener("input", () => { if (qAudio.duration) qAudio.currentTime = (plSeek.value / 100) * qAudio.duration; });
    document.getElementById("plClose").addEventListener("click", () => { qAudio.pause(); player.classList.add("hidden"); });
  }

  /* ============== أدوات عامة ============== */
  function toast(msg) {
    let el = document.getElementById("toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("show");
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove("show"), 2200);
  }

  function initTheme() {
    const saved = localStorage.getItem("athkar_theme");
    const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    themeBtn.textContent = dark ? "☀" : "☾";
  }
  themeBtn.addEventListener("click", () => {
    const dark = document.documentElement.getAttribute("data-theme") !== "dark";
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    themeBtn.textContent = dark ? "☀" : "☾";
    localStorage.setItem("athkar_theme", dark ? "dark" : "light");
  });
  backBtn.addEventListener("click", () => { stopAudio(); if (typeof goBack === "function") goBack(); });

  initTheme();
  renderAthkarHome();
})();
