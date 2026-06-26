/* أذكار — منطق التطبيق (أذكار + حصن المسلم + بطاقات + أعمال + مواقيت) */
(function () {
  "use strict";

  const view = document.getElementById("view");
  const appTitle = document.getElementById("appTitle");
  const backBtn = document.getElementById("backBtn");
  const themeBtn = document.getElementById("themeBtn");
  const tabbar = document.getElementById("tabbar");

  const SITE = "msj78598.github.io/athkar";
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

  const ICONS = { sunrise: "🌅", moon: "🌙", mosque: "🕌", bed: "🛏️", sun: "☀️", beads: "📿", parents: "👪" };
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
    const row = (arr, cls) => {
      const one = arr.map(t => `<span class="tk-item">${esc(t)}</span>`).join('<span class="tk-dot">۞</span>');
      // نكرّر المحتوى 4 مرات لضمان امتلاء الشاشة وحركة سلسة بلا فراغات
      const seq = (one + '<span class="tk-dot">۞</span>').repeat(4);
      return `<div class="ticker ${cls}"><div class="tk-track">${seq}</div></div>`;
    };
    return `<div class="ticker-wrap">${row(TICKER_TASBIH, "a")}${row(TICKER_ISTIGHFAR, "b")}</div>`;
  }

  function renderAthkarHome() {
    appTitle.textContent = APP_NAME;
    backBtn.classList.add("hidden");
    goBack = null;
    let html = tickerHTML();
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
    window.scrollTo(0, 0);
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
          <div class="dhikr-text">${item.text}</div>
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
    { id: "square", name: "مربع · منشور", w: 1440, h: 1440 },
    { id: "story", name: "ستوري · واتساب/سناب", w: 1080, h: 1920 },
    { id: "portrait", name: "عمودي · انستقرام", w: 1080, h: 1350 },
    { id: "wide", name: "عريض · تويتر/فيسبوك", w: 1280, h: 720 }
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
    textScale: 1, textColor: "", img: { zoom: 1, ox: 0, oy: 0 }, frame: "double", pattern: "", title: ""
  };
  const FRAMES = [
    { k: "double", n: "مزدوج" }, { k: "simple", n: "بسيط" }, { k: "corners", n: "زوايا" },
    { k: "dashed", n: "متقطّع" }, { k: "ornate", n: "مزخرف" }, { k: "none", n: "بدون" }
  ];
  const PATTERNS = [
    { k: "", n: "تلقائي" }, { k: "none", n: "بدون" }, { k: "dots", n: "نقاط" }, { k: "stars", n: "نجوم" },
    { k: "rays", n: "أشعة" }, { k: "diamonds", n: "معيّنات" }, { k: "grid", n: "شبكة" }
  ];
  const TEXT_COLORS = ["#ffffff", "#f7e9c2", "#e6cf95", "#ffd97d", "#f5c6d6", "#bfe8ee", "#1c2625", "#0c1716"];
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
        style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})"><span style="color:${t.accent}">۞</span></button>`).join("");
    let sizes = SIZES.map((s, i) => `<button class="chip ${i === cardState.sizeIdx ? "active" : ""}" data-s="${i}">${s.name}</button>`).join("");
    let fpresets = FILTER_PRESETS.map(p => `<button class="chip fchip ${p.key === cardState.filterKey ? "active" : ""}" data-fp="${p.key}">${p.name}</button>`).join("");

    view.innerHTML = `
      <div class="cards-layout">
        <div class="card-stage">
          <div class="card-preview" id="cardPreview"><canvas id="cardCanvas"></canvas></div>
          <div class="card-actions">
            <button class="act primary" id="shareCard">📤 مشاركة</button>
            <button class="act" id="downloadCard">📥 تنزيل</button>
            <button class="act" id="randomCard">🎲 عشوائي</button>
            <button class="act" id="copyCard">📋 نسخ</button>
          </div>
        </div>
        <div class="card-controls">
          <details class="ctl" open>
            <summary>📚 اختر الذكر</summary>
            <div class="ctl-body">
              <div class="chips-row" id="libChips">${chips}</div>
              <div class="lib-list" id="libList"></div>
            </div>
          </details>
          <details class="ctl" open>
            <summary>🎨 التصميم</summary>
            <div class="ctl-body">
              <div class="mini-label">المقاس (للمنصّات)</div>
              <div class="chips-row" id="sizeRow">${sizes}</div>
              <div class="mini-label">الألوان</div>
              <div class="theme-row">${themes}</div>
              <div class="mini-label">الإطار</div>
              <div class="chips-row" id="frameRow">${FRAMES.map(f => `<button class="chip ${cardState.frame === f.k ? "active" : ""}" data-frame="${f.k}">${f.n}</button>`).join("")}</div>
              <div class="mini-label">الزخرفة (بدون صورة)</div>
              <div class="chips-row" id="patternRow">${PATTERNS.map(p => `<button class="chip ${cardState.pattern === p.k ? "active" : ""}" data-pattern="${p.k}">${p.n}</button>`).join("")}</div>
            </div>
          </details>
          <details class="ctl">
            <summary>✏️ حجم النص ولونه</summary>
            <div class="ctl-body">
              ${sliderHTML("textScale", "حجم النص", 60, 170, 5, Math.round(cardState.textScale * 100))}
              <div class="mini-label">لون النص</div>
              <div class="swatch-row" id="textColors">
                <button class="swatch reset ${cardState.textColor ? "" : "active"}" data-col="" title="افتراضي">↺</button>
                ${TEXT_COLORS.map(c => `<button class="swatch ${cardState.textColor === c ? "active" : ""}" data-col="${c}" style="background:${c}"></button>`).join("")}
                <label class="swatch pick" title="لون مخصّص"><input type="color" id="textColorPick" value="#ffffff" />🎨</label>
              </div>
            </div>
          </details>
          <details class="ctl" id="photoDetails">
            <summary>📷 خلفية صورة وفلاتر</summary>
            <div class="ctl-body">
              <label class="act full upload-label">📷 رفع صورة من جهازك
                <input type="file" id="photoInput" accept="image/*" hidden /></label>
              <div class="filter-panel hidden" id="filterPanel">
                <p class="drag-hint">👆 اسحب الصورة لتحريكها · صغّر أو كبّر بالشريط</p>
                ${sliderHTML("zoom", "تكبير / تصغير الصورة", 30, 300, 5, Math.round(cardState.img.zoom * 100))}
                <div class="chips-row">${fpresets}</div>
                ${sliderHTML("brightness", "السطوع", 50, 150, 1, cardState.filter.brightness)}
                ${sliderHTML("contrast", "التباين", 50, 160, 1, cardState.filter.contrast)}
                ${sliderHTML("saturate", "التشبّع", 0, 200, 1, cardState.filter.saturate)}
                ${sliderHTML("dark", "تعتيم لوضوح النص", 0, 95, 5, Math.round(cardState.filter.dark * 100))}
                <button class="act full" id="removePhoto">✖ إزالة الصورة</button>
              </div>
            </div>
          </details>
          <details class="ctl">
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
    // المقاس
    view.querySelectorAll("#sizeRow .chip").forEach(b => b.addEventListener("click", () => {
      cardState.sizeIdx = parseInt(b.dataset.s, 10);
      view.querySelectorAll("#sizeRow .chip").forEach(x => x.classList.toggle("active", x === b));
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
      if (k === "textScale") cardState.textScale = val / 100;
      else if (k === "zoom") cardState.img.zoom = val / 100;
      else cardState.filter[k] = (k === "dark" ? val / 100 : val);
      const vlab = document.getElementById("v_" + k); if (vlab) vlab.textContent = inp.value;
      drawCard();
    }));
    // ألوان النص
    view.querySelectorAll("#textColors .swatch[data-col]").forEach(b => b.addEventListener("click", () => {
      cardState.textColor = b.dataset.col;
      view.querySelectorAll("#textColors .swatch").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    const pick = view.querySelector("#textColorPick");
    if (pick) pick.addEventListener("input", () => {
      cardState.textColor = pick.value;
      view.querySelectorAll("#textColors .swatch").forEach(x => x.classList.remove("active"));
      pick.parentElement.classList.add("active");
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
    view.querySelectorAll(".gchip").forEach(b => b.addEventListener("click", () => {
      const gi = parseInt(b.dataset.g, 10);
      view.querySelectorAll(".gchip").forEach(x => x.classList.toggle("active", x === b));
      view.querySelector("#libList").innerHTML = libItemsHTML(gi);
      bindLibItems();
    }));
    bindLibItems();
    view.querySelector("#applyCustom").addEventListener("click", () => {
      const t = view.querySelector("#customText").value.trim();
      if (!t) { view.querySelector("#customText").focus(); return; }
      cardState.text = t; cardState.source = view.querySelector("#customSource").value.trim();
      cardState.title = view.querySelector("#customTitle").value.trim();
      drawCard(); document.querySelector(".card-preview").scrollIntoView({ behavior: "smooth", block: "center" });
    });
    view.querySelector("#randomCard").addEventListener("click", () => {
      cardState.theme = Math.floor(Math.random() * CARD_THEMES.length);
      view.querySelectorAll(".theme-dot").forEach((x, i) => x.classList.toggle("active", i === cardState.theme));
      drawCard(); vibrate(8);
    });
    view.querySelector("#downloadCard").addEventListener("click", () => exportCard("download"));
    view.querySelector("#shareCard").addEventListener("click", () => exportCard("share"));
    view.querySelector("#copyCard").addEventListener("click", copyCardText);
  }
  function bindCanvasDrag() {
    const cv = view.querySelector("#cardCanvas"); if (!cv) return;
    let dragging = false, lx = 0, ly = 0;
    const ratio = () => cv.width / (cv.clientWidth || cv.width);
    cv.addEventListener("pointerdown", (e) => {
      if (!cardState.bgImage) return;
      dragging = true; lx = e.clientX; ly = e.clientY;
      try { cv.setPointerCapture(e.pointerId); } catch (err) {}
      cv.classList.add("grabbing");
    });
    cv.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const r = ratio();
      cardState.img.ox += (e.clientX - lx) * r;
      cardState.img.oy += (e.clientY - ly) * r;
      lx = e.clientX; ly = e.clientY;
      drawCard();
    });
    const end = () => { dragging = false; cv.classList.remove("grabbing"); };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
    cv.addEventListener("pointerleave", end);
  }
  function bindLibItems() {
    view.querySelectorAll(".lib-item").forEach(b => b.addEventListener("click", () => {
      const g = parseInt(b.dataset.g, 10), i = parseInt(b.dataset.i, 10), it = CARD_GROUPS[g].items[i];
      // المكتبة العامة بلا عنوان — العنوان يليق فقط بالأذكار المرتبطة بمناسبة محددة
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

  function onPhoto(e) {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        cardState.bgImage = img;
        cardState.img = { zoom: 1, ox: 0, oy: 0 };
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
    // zoom = 1 يملأ البطاقة (cover). أقل من 1 يُصغّر الصورة، وأكثر يكبّرها. الحركة حرّة بالسحب.
    const cover = Math.max(W / img.width, H / img.height);
    const s = cover * (t.zoom || 1);
    const dw = img.width * s, dh = img.height * s;
    const dx = (W - dw) / 2 + (t.ox || 0), dy = (H - dh) / 2 + (t.oy || 0);
    ctx.drawImage(img, dx, dy, dw, dh);
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
    ctx.clearRect(0, 0, W, H);

    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    if (hasImg) {
      ctx.save(); ctx.filter = filterString(cardState.filter);
      drawBg(ctx, cardState.bgImage, W, H, { zoom: (cardState.img.zoom || 1) * anim.bgZoom, ox: cardState.img.ox, oy: cardState.img.oy });
      ctx.restore();
      const d = cardState.filter.dark;
      const ov = ctx.createLinearGradient(0, 0, 0, H);
      ov.addColorStop(0, `rgba(8,11,14,${Math.min(0.95, d * 0.75)})`);
      ov.addColorStop(0.45, `rgba(8,11,14,${Math.min(0.97, d)})`);
      ov.addColorStop(1, `rgba(8,11,14,${Math.min(1, d * 1.08)})`);
      ctx.fillStyle = ov; ctx.fillRect(0, 0, W, H);
      fg = "#ffffff"; sub = "#ece3cd";
    } else {
      const pat = cardState.pattern || th.pattern;
      if (pat && pat !== "none") paintPattern(ctx, W, H, th, pat);
      fg = th.fg; sub = th.sub;
    }

    const fm = u * 0.045;
    drawFrame(ctx, W, H, u, accent, cardState.frame);

    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.direction = "rtl";
    // العنوان أو الزخرفة (يخضع لظهور uiAlpha)
    ctx.globalAlpha = anim.uiAlpha;
    if (cardState.title) {
      let ts = u * 0.042;
      ctx.font = `700 ${ts}px 'Tajawal', sans-serif`;
      while (ctx.measureText(cardState.title).width > W * 0.78 && ts > u * 0.024) { ts -= u * 0.003; ctx.font = `700 ${ts}px 'Tajawal', sans-serif`; }
      ctx.fillStyle = accent;
      ctx.fillText(cardState.title, W / 2, H * 0.125);
      ctx.strokeStyle = hexA(accent, 0.5); ctx.lineWidth = Math.max(1, u * 0.002);
      ctx.beginPath(); ctx.moveTo(W / 2 - u * 0.07, H * 0.16); ctx.lineTo(W / 2 + u * 0.07, H * 0.16); ctx.stroke();
    } else {
      ctx.fillStyle = accent; ctx.font = `${Math.round(u * 0.042)}px 'Amiri Quran', serif`;
      ctx.fillText("۞", W / 2, H * 0.135);
    }
    ctx.globalAlpha = 1;

    // النص الرئيسي — ملاءمة تلقائية
    const maxW = W * 0.80, areaTop = H * 0.20, areaBot = H * 0.82, maxH = areaBot - areaTop;
    const len = cardState.text.length;
    let size = (len < 18 ? 0.105 : len < 45 ? 0.078 : len < 90 ? 0.060 : len < 150 ? 0.047 : 0.038) * u;
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
    ctx.fillStyle = cardState.textColor || fg;
    const lh = size * 1.75, startY = (areaTop + areaBot) / 2 - ((lines.length - 1) * lh) / 2 + (anim.textDy || 0);
    lines.forEach((l, i) => ctx.fillText(l, W / 2, startY + i * lh));
    ctx.shadowColor = "transparent"; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.globalAlpha = 1;

    // المصدر + العلامة + QR (ظهور تدريجي)
    ctx.globalAlpha = anim.uiAlpha;
    if (cardState.source) {
      ctx.fillStyle = sub; ctx.font = `${Math.round(u * 0.030)}px 'Amiri', 'Tajawal', sans-serif`;
      ctx.fillText("﴿ " + cardState.source + " ﴾", W / 2, areaBot + u * 0.04);
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
    }
    ctx.restore();
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

  function cardTextForShare() {
    let t = "";
    if (cardState.title) t += "【 " + cardState.title + " 】\n\n";
    t += cardState.text;
    if (cardState.source) t += "\n﴿ " + cardState.source + " ﴾";
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
    { name: "مكة المكرمة", city: "Makkah", country: "Saudi Arabia", method: 4 },
    { name: "المدينة المنورة", city: "Madinah", country: "Saudi Arabia", method: 4 },
    { name: "الرياض", city: "Riyadh", country: "Saudi Arabia", method: 4 },
    { name: "جدة", city: "Jeddah", country: "Saudi Arabia", method: 4 },
    { name: "الدمام", city: "Dammam", country: "Saudi Arabia", method: 4 },
    { name: "أبها", city: "Abha", country: "Saudi Arabia", method: 4 },
    { name: "القاهرة", city: "Cairo", country: "Egypt", method: 5 },
    { name: "دبي", city: "Dubai", country: "United Arab Emirates", method: 8 },
    { name: "الكويت", city: "Kuwait City", country: "Kuwait", method: 9 },
    { name: "الدوحة", city: "Doha", country: "Qatar", method: 4 },
    { name: "المنامة", city: "Manama", country: "Bahrain", method: 4 },
    { name: "مسقط", city: "Muscat", country: "Oman", method: 8 },
    { name: "عمّان", city: "Amman", country: "Jordan", method: 23 },
    { name: "بغداد", city: "Baghdad", country: "Iraq", method: 3 },
    { name: "بيروت", city: "Beirut", country: "Lebanon", method: 3 },
    { name: "الخرطوم", city: "Khartoum", country: "Sudan", method: 5 },
    { name: "إسطنبول", city: "Istanbul", country: "Turkey", method: 13 }
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
    const savedIdx = parseInt(localStorage.getItem(PRAYER_SETTINGS_KEY) || "2", 10);
    const opts = REGIONS.map((r, i) => `<option value="${i}" ${i === savedIdx ? "selected" : ""}>${r.name}</option>`).join("");
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
    const t = text + (source ? "\n﴿ " + source + " ﴾" : "") + "\n\nتطبيق أذكار — https://" + SITE;
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
        <h3>للتحقق والاستزادة</h3>
        <ul>
          <li>الدرر السنية — dorar.net</li>
          <li>موقع الشيخ ابن باز — binbaz.org.sa</li>
          <li>الإفتاء — الموقع الرسمي لدار الإفتاء</li>
        </ul>
        <p class="about-note">نحرص على أعلى درجات الدقّة. وهذا عملٌ بشريّ قابل للخطأ، فمن وجد ملاحظةً على أي نص فنرجو إبلاغنا لتصحيحه فورًا. ويُستحسن لطالب النشر الواسع عرضُه على عالمٍ موثوق لمراجعته.</p>
      </div>`;
    window.scrollTo(0, 0);
  }

  /* ============== تبويب الأعمال الصالحة ============== */
  function renderDeeds() {
    appTitle.textContent = "أعمال صالحة";
    backBtn.classList.add("hidden");
    if (typeof DEEDS === "undefined") { view.innerHTML = `<p class="muted-line">لا يوجد محتوى.</p>`; return; }
    let html = `<p class="intro">تذكير بأبواب الخير الثابتة في السنة — «من دلّ على خير فله مثل أجر فاعله».<br>افعلها وذكّر بها غيرك، ولك أجرٌ بكل من يعمل بها.</p><div class="deeds-list">`;
    DEEDS.forEach((d, i) => {
      html += `<div class="deed-card">
        <div class="deed-head"><span class="deed-ic">${d.icon}</span><h3>${esc(d.title)}</h3></div>
        <p class="deed-desc">${esc(d.desc)}</p>
        <p class="deed-virtue">${esc(d.virtue)}</p>
        <div class="deed-foot"><span class="source">${esc(d.source)}</span>
          <button class="deed-share" data-i="${i}">📤 شارك</button></div></div>`;
    });
    html += `</div>`;
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
        <button class="sr-dl ${dl ? "done" : ""}" data-dl="${i}" title="${dl ? "محمّلة — اضغط للحذف" : "تحميل"}">${dl ? "✓" : "⬇️"}</button>
      </div>`;
    }).join("");
    box.querySelectorAll(".surah-row").forEach(r => r.addEventListener("click", (e) => {
      if (e.target.closest(".sr-dl")) return; playSurah(parseInt(r.dataset.i, 10));
    }));
    box.querySelectorAll(".sr-dl").forEach(b => b.addEventListener("click", (e) => {
      e.stopPropagation(); toggleDownload(parseInt(b.dataset.dl, 10), b);
    }));
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
