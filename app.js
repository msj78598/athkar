/* أذكار المسلم — منطق التطبيق (أذكار + بطاقات + مواقيت) */
(function () {
  "use strict";

  const view = document.getElementById("view");
  const appTitle = document.getElementById("appTitle");
  const backBtn = document.getElementById("backBtn");
  const themeBtn = document.getElementById("themeBtn");
  const tabbar = document.getElementById("tabbar");

  const SITE = "msj78598.github.io/athkar";
  let currentTab = "athkar";

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

  const ICONS = { sunrise: "🌅", moon: "🌙", mosque: "🕌", bed: "🛏️", sun: "☀️", beads: "📿" };
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
  function vibrate(p) { if (navigator.vibrate) try { navigator.vibrate(p); } catch (e) {} }

  /* ============== التبويبات ============== */
  tabbar.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab"); if (!btn) return;
    switchTab(btn.dataset.tab);
  });
  function switchTab(tab) {
    stopAudio();
    currentTab = tab;
    tabbar.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
    backBtn.classList.add("hidden");
    if (tab === "athkar") renderAthkarHome();
    else if (tab === "cards") renderCards();
    else if (tab === "prayer") renderPrayer();
  }

  /* ============== تبويب الأذكار ============== */
  function tickerHTML() {
    const row = (arr, cls) => {
      const items = arr.map(t => `<span class="tk-item">${esc(t)}</span>`).join('<span class="tk-dot">•</span>');
      // نُكرّر المحتوى مرتين لحركة لا نهائية سلسة
      return `<div class="ticker ${cls}"><div class="tk-track">${items}<span class="tk-dot">•</span>${items}<span class="tk-dot">•</span></div></div>`;
    };
    return `<div class="ticker-wrap">${row(TICKER_TASBIH, "rtl")}${row(TICKER_ISTIGHFAR, "ltr")}</div>`;
  }

  function renderAthkarHome() {
    appTitle.textContent = "أذكار المسلم";
    backBtn.classList.add("hidden");
    let html = tickerHTML();
    html += '<p class="intro">الأذكار الصحيحة الموثّقة بمصادرها.<br>اختر فئة لتبدأ، ويُحفظ تقدّمك تلقائيًا.</p><div class="cat-grid">';
    ADHKAR.forEach(cat => {
      const done = countDone(cat);
      html += `<div class="cat-card" data-cat="${cat.id}"><div class="cat-icon">${ICONS[cat.icon] || "📿"}</div>
        <h3>${cat.title}</h3><p>${done}/${cat.items.length} مكتمل</p></div>`;
    });
    html += "</div>";
    // قسم حصن المسلم الكامل
    if (typeof HISN !== "undefined") {
      html += `<div class="section-label">📕 حصن المسلم كامل — ${HISN.length} بابًا</div>
        <input id="hisnSearch" class="hisn-search" type="search" placeholder="🔍 ابحث في أبواب حصن المسلم…" />
        <div class="hisn-list" id="hisnList"></div>`;
    }
    view.innerHTML = html;
    view.querySelectorAll(".cat-card").forEach(el => el.addEventListener("click", () => renderCategory(el.dataset.cat)));
    if (typeof HISN !== "undefined") {
      renderHisnList("");
      const s = document.getElementById("hisnSearch");
      s.addEventListener("input", () => renderHisnList(s.value));
    }
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
              <span class="num">${done ? "✓" : remaining}</span><span class="lbl">${done ? "تم" : "اضغط"}</span></button></div></div>`;
    });
    html += `<button class="reset-cat" id="resetCat">إعادة ضبط هذا الباب</button>`;
    view.innerHTML = html;
    view.querySelectorAll(".counter").forEach(btn =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); tapHisn(ch, cid, parseInt(btn.dataset.idx, 10)); }));
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
              <span class="num">${done ? "✓" : remaining}</span><span class="lbl">${done ? "تم" : "اضغط"}</span></button></div></div>`;
    });
    html += `<button class="reset-cat" id="resetCat">إعادة ضبط هذه الفئة</button>`;
    view.innerHTML = html;
    view.querySelectorAll(".counter").forEach(btn =>
      btn.addEventListener("click", (e) => { e.stopPropagation(); tapCounter(cat, parseInt(btn.dataset.idx, 10)); }));
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
  let cardState = { text: "", source: "", theme: 0 };

  function renderCards() {
    appTitle.textContent = "بطاقات الأذكار";
    backBtn.classList.add("hidden");
    if (!cardState.text) {
      const g = CARD_GROUPS[0].items[0]; cardState.text = g.t; cardState.source = g.s;
    }
    let chips = CARD_GROUPS.map((g, i) => `<button class="chip ${i === 0 ? "active" : ""}" data-g="${i}">${g.icon} ${g.name}</button>`).join("");
    let themes = CARD_THEMES.map((t, i) =>
      `<button class="theme-dot ${i === cardState.theme ? "active" : ""}" data-t="${i}" title="${t.name}"
        style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})"><span style="color:${t.accent}">۞</span></button>`).join("");

    view.innerHTML = `
      <p class="intro">صمّم بطاقة ذكر وشاركها في واتساب وغيره — صدقة تنتشر بضغطة.</p>
      <div class="card-preview"><canvas id="cardCanvas" width="1080" height="1080"></canvas></div>
      <div class="card-actions">
        <button class="act primary" id="shareCard">📤 مشاركة</button>
        <button class="act" id="downloadCard">📥 تنزيل</button>
        <button class="act" id="randomCard">🎲 تصميم عشوائي</button>
        <button class="act" id="copyCard">📋 نسخ النص</button>
      </div>
      <div class="section-label">🎨 اختر التصميم</div>
      <div class="theme-row">${themes}</div>
      <div class="section-label">✍️ اكتب ذكرك الخاص</div>
      <div class="custom-box">
        <textarea id="customText" rows="2" placeholder="اكتب ذكرًا أو دعاءً صحيحًا..."></textarea>
        <input id="customSource" type="text" placeholder="المصدر (اختياري)" />
        <button class="act primary full" id="applyCustom">توليد بطاقتي الخاصة</button>
      </div>
      <div class="section-label">📚 أو اختر من المكتبة</div>
      <div class="chips-row">${chips}</div>
      <div class="lib-list" id="libList"></div>
    `;

    view.querySelector("#libList").innerHTML = libItemsHTML(0);
    bindCardEvents();
    ensureFontsThenDraw();
    window.scrollTo(0, 0);
  }

  function libItemsHTML(gi) {
    return CARD_GROUPS[gi].items.map((it, i) =>
      `<button class="lib-item" data-g="${gi}" data-i="${i}"><span>${esc(it.t)}</span></button>`).join("");
  }

  function bindCardEvents() {
    view.querySelectorAll(".theme-dot").forEach(b => b.addEventListener("click", () => {
      cardState.theme = parseInt(b.dataset.t, 10);
      view.querySelectorAll(".theme-dot").forEach(x => x.classList.toggle("active", x === b));
      drawCard();
    }));
    view.querySelectorAll(".chip").forEach(b => b.addEventListener("click", () => {
      const gi = parseInt(b.dataset.g, 10);
      view.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x === b));
      view.querySelector("#libList").innerHTML = libItemsHTML(gi);
      bindLibItems();
    }));
    bindLibItems();
    view.querySelector("#applyCustom").addEventListener("click", () => {
      const t = view.querySelector("#customText").value.trim();
      if (!t) { view.querySelector("#customText").focus(); return; }
      cardState.text = t; cardState.source = view.querySelector("#customSource").value.trim();
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
  function bindLibItems() {
    view.querySelectorAll(".lib-item").forEach(b => b.addEventListener("click", () => {
      const g = parseInt(b.dataset.g, 10), i = parseInt(b.dataset.i, 10), it = CARD_GROUPS[g].items[i];
      cardState.text = it.t; cardState.source = it.s;
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

  function drawCard() {
    const canvas = document.getElementById("cardCanvas"); if (!canvas) return;
    const S = 1080, ctx = canvas.getContext("2d");
    const th = CARD_THEMES[cardState.theme];
    ctx.clearRect(0, 0, S, S);

    // خلفية متدرّجة
    const g = ctx.createLinearGradient(0, 0, S, S);
    g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
    paintPattern(ctx, S, th);

    // إطار
    ctx.strokeStyle = hexA(th.accent, 0.55); ctx.lineWidth = 4;
    roundRect(ctx, 46, 46, S - 92, S - 92, 28); ctx.stroke();
    ctx.strokeStyle = hexA(th.accent, 0.25); ctx.lineWidth = 2;
    roundRect(ctx, 62, 62, S - 124, S - 124, 22); ctx.stroke();

    // زخرفة علوية
    ctx.fillStyle = th.accent; ctx.font = "40px 'Amiri Quran', serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.direction = "rtl";
    ctx.fillText("۞", S / 2, 150);

    // النص الرئيسي — ملاءمة تلقائية للحجم
    const maxW = S * 0.76, areaTop = S * 0.24, areaBot = S * 0.80, maxH = areaBot - areaTop;
    const len = cardState.text.length;
    let size = len < 18 ? 104 : len < 45 ? 78 : len < 90 ? 60 : len < 150 ? 47 : 38;
    let lines;
    while (size >= 26) {
      ctx.font = `700 ${size}px 'Amiri Quran', serif`;
      lines = wrapLines(ctx, cardState.text, maxW);
      const lh = size * 1.7, totalH = lines.length * lh;
      const widest = Math.max.apply(null, lines.map(l => ctx.measureText(l).width));
      if (totalH <= maxH && widest <= maxW) break;
      size -= 4;
    }
    ctx.fillStyle = th.fg;
    const lh = size * 1.7, startY = (areaTop + areaBot) / 2 - ((lines.length - 1) * lh) / 2;
    lines.forEach((l, i) => ctx.fillText(l, S / 2, startY + i * lh));

    // المصدر
    if (cardState.source) {
      ctx.fillStyle = th.sub; ctx.font = "400 34px 'Amiri', 'Tajawal', sans-serif";
      ctx.fillText("﴿ " + cardState.source + " ﴾", S / 2, areaBot + 36);
    }

    // العلامة (تنشر التطبيق)
    ctx.fillStyle = hexA(th.accent, 0.9); ctx.font = "700 30px 'Tajawal', sans-serif";
    ctx.fillText("📿 أذكار المسلم", S / 2, S - 96);
    ctx.fillStyle = th.sub; ctx.font = "400 26px 'Tajawal', sans-serif";
    ctx.fillText(SITE, S / 2, S - 58);
  }

  function paintPattern(ctx, S, th) {
    ctx.save();
    const a = hexA(th.accent, 0.10);
    if (th.pattern === "dots") {
      ctx.fillStyle = a;
      for (let y = 110; y < S - 90; y += 70) for (let x = 110; x < S - 90; x += 70) {
        ctx.beginPath(); ctx.arc(x, y, 3, 0, 7); ctx.fill();
      }
    } else if (th.pattern === "stars") {
      ctx.fillStyle = hexA(th.accent, 0.13); ctx.font = "26px serif"; ctx.textAlign = "center";
      const pts = [[160, 200], [920, 240], [240, 880], [880, 860], [540, 160], [140, 540], [940, 560], [520, 940]];
      pts.forEach(p => ctx.fillText("✦", p[0], p[1]));
    } else if (th.pattern === "rays") {
      ctx.strokeStyle = hexA(th.accent, 0.06); ctx.lineWidth = 2;
      for (let i = 0; i < 24; i++) { ctx.beginPath(); ctx.moveTo(S / 2, S / 2); const ang = (Math.PI / 12) * i; ctx.lineTo(S / 2 + Math.cos(ang) * 900, S / 2 + Math.sin(ang) * 900); ctx.stroke(); }
    } else if (th.pattern === "corners") {
      ctx.strokeStyle = hexA(th.accent, 0.5); ctx.lineWidth = 3;
      const c = [[120, 120, 1, 1], [S - 120, 120, -1, 1], [120, S - 120, 1, -1], [S - 120, S - 120, -1, -1]];
      c.forEach(([x, y, sx, sy]) => { ctx.beginPath(); ctx.moveTo(x + 70 * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + 70 * sy); ctx.stroke(); });
    } else if (th.pattern === "frame") {
      ctx.strokeStyle = hexA(th.accent, 0.18); ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) roundRect(ctx, 90 + i * 10, 90 + i * 10, S - 180 - i * 20, S - 180 - i * 20, 18), ctx.stroke();
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
    let t = cardState.text;
    if (cardState.source) t += "\n﴿ " + cardState.source + " ﴾";
    return t + "\n\nمن تطبيق أذكار المسلم — https://" + SITE;
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
  backBtn.addEventListener("click", () => { stopAudio(); if (currentTab === "athkar") renderAthkarHome(); });

  initTheme();
  renderAthkarHome();
})();
