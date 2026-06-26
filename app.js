/* أذكار المسلم — منطق التطبيق */
(function () {
  "use strict";

  const view = document.getElementById("view");
  const appTitle = document.getElementById("appTitle");
  const backBtn = document.getElementById("backBtn");
  const themeBtn = document.getElementById("themeBtn");
  const shareBtn = document.getElementById("shareBtn");

  // مفتاح حفظ التقدم اليومي (يُعاد ضبطه تلقائيًا كل يوم)
  const today = new Date().toISOString().slice(0, 10);
  const PROGRESS_KEY = "athkar_progress_" + today;

  let progress = loadProgress();

  function loadProgress() {
    // امسح تقدم الأيام السابقة لتوفير المساحة
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith("athkar_progress_") && k !== PROGRESS_KEY) localStorage.removeItem(k);
      }
      return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
    } catch (e) { return {}; }
  }
  function saveProgress() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress)); } catch (e) {}
  }

  // عدّاد المتبقي لكل ذكر: progress[catId][index] = العدد المتبقي
  function getRemaining(catId, idx, total) {
    if (progress[catId] && typeof progress[catId][idx] === "number") return progress[catId][idx];
    return total;
  }
  function setRemaining(catId, idx, val) {
    if (!progress[catId]) progress[catId] = {};
    progress[catId][idx] = val;
    saveProgress();
  }

  const ICONS = {
    sunrise: "🌅", moon: "🌙", mosque: "🕌", bed: "🛏️", sun: "☀️", beads: "📿"
  };

  // ===== الشاشة الرئيسية =====
  function renderHome() {
    appTitle.textContent = "أذكار المسلم";
    backBtn.classList.add("hidden");
    let html = '<p class="intro">الأذكار الصحيحة الموثّقة بمصادرها من القرآن والسنة.<br>اختر فئة لتبدأ، ويُحفظ تقدّمك تلقائيًا.</p><div class="cat-grid">';
    ADHKAR.forEach(cat => {
      const count = cat.items.length;
      const done = countDone(cat);
      const icon = ICONS[cat.icon] || "📿";
      html += `
        <div class="cat-card" data-cat="${cat.id}">
          <div class="cat-icon">${icon}</div>
          <h3>${cat.title}</h3>
          <p>${done}/${count} مكتمل</p>
        </div>`;
    });
    html += "</div>";
    view.innerHTML = html;
    view.querySelectorAll(".cat-card").forEach(el => {
      el.addEventListener("click", () => renderCategory(el.dataset.cat));
    });
    window.scrollTo(0, 0);
  }

  function countDone(cat) {
    let done = 0;
    cat.items.forEach((it, i) => { if (getRemaining(cat.id, i, it.count) === 0) done++; });
    return done;
  }

  // ===== شاشة الفئة =====
  function renderCategory(catId) {
    const cat = ADHKAR.find(c => c.id === catId);
    if (!cat) return renderHome();
    appTitle.textContent = cat.title;
    backBtn.classList.remove("hidden");

    let html = `<div class="cat-head"><h2>${cat.title}</h2><p>${cat.subtitle}</p></div>
      <div class="progress-wrap"><div class="progress-track"><div class="progress-fill" id="progFill"></div></div>
      <div class="progress-label" id="progLabel"></div></div>
      <div id="completeBanner"></div>`;

    cat.items.forEach((item, idx) => {
      const remaining = getRemaining(cat.id, idx, item.count);
      const done = remaining === 0;
      html += `
        <div class="dhikr-card ${done ? "done" : ""}" data-idx="${idx}">
          <div class="dhikr-text">${item.text}</div>
          <div class="dhikr-meta">
            <span class="badge">التكرار: ${item.count}</span>
            <span class="badge virtue">${item.virtue}</span>
          </div>
          <div class="dhikr-bottom">
            <span class="source">${item.source}</span>
            <button class="counter ${done ? "complete" : ""}" data-idx="${idx}">
              <span class="num">${done ? "✓" : remaining}</span>
              <span class="lbl">${done ? "تم" : "اضغط"}</span>
            </button>
          </div>
        </div>`;
    });

    html += `<button class="reset-cat" id="resetCat">إعادة ضبط هذه الفئة</button>`;
    view.innerHTML = html;

    view.querySelectorAll(".counter").forEach(btn => {
      btn.addEventListener("click", (e) => { e.stopPropagation(); tapCounter(cat, parseInt(btn.dataset.idx, 10)); });
    });
    document.getElementById("resetCat").addEventListener("click", () => {
      if (progress[cat.id]) { delete progress[cat.id]; saveProgress(); }
      renderCategory(cat.id);
    });

    updateProgress(cat);
    window.scrollTo(0, 0);
  }

  function tapCounter(cat, idx) {
    const item = cat.items[idx];
    let remaining = getRemaining(cat.id, idx, item.count);
    if (remaining <= 0) {
      // إعادة للذكر المكتمل عند الضغط
      remaining = item.count;
    } else {
      remaining -= 1;
    }
    setRemaining(cat.id, idx, remaining);
    vibrate(remaining === 0 ? [12, 40, 12] : 10);

    const card = view.querySelector(`.dhikr-card[data-idx="${idx}"]`);
    const btn = view.querySelector(`.counter[data-idx="${idx}"]`);
    const done = remaining === 0;
    btn.querySelector(".num").textContent = done ? "✓" : remaining;
    btn.querySelector(".lbl").textContent = done ? "تم" : "اضغط";
    btn.classList.toggle("complete", done);
    card.classList.toggle("done", done);

    updateProgress(cat);
  }

  function updateProgress(cat) {
    const total = cat.items.length;
    const done = countDone(cat);
    const pct = Math.round((done / total) * 100);
    const fill = document.getElementById("progFill");
    const label = document.getElementById("progLabel");
    const banner = document.getElementById("completeBanner");
    if (fill) fill.style.width = pct + "%";
    if (label) label.textContent = `${done} من ${total} (${pct}%)`;
    if (banner) {
      banner.innerHTML = done === total
        ? `<div class="complete-banner">تقبّل الله — أتممت ${cat.title} 🤲</div>`
        : "";
    }
  }

  function vibrate(pattern) { if (navigator.vibrate) try { navigator.vibrate(pattern); } catch (e) {} }

  // ===== الوضع الليلي =====
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

  backBtn.addEventListener("click", renderHome);

  // ===== المشاركة (الانتشار) =====
  shareBtn.addEventListener("click", async (e) => {
    e.preventDefault();
    const shareData = {
      title: "أذكار المسلم",
      text: "أذكار صحيحة موثّقة بمصادرها — تطبيق مجاني يعمل بدون إنترنت. صدقة جارية، انشره ولك أجره 🤲",
      url: location.href
    };
    try {
      if (navigator.share) { await navigator.share(shareData); }
      else { await navigator.clipboard.writeText(shareData.text + "\n" + shareData.url); alert("تم نسخ رابط التطبيق — انشره ولك الأجر."); }
    } catch (err) {}
  });

  initTheme();
  renderHome();
})();
