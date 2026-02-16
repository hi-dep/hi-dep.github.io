/* global initSqlJs */

const DATA_BASE = "../data"; // vendor/ から見て data/ は ../data

const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");

const dateInput = document.getElementById("dateInput");
const langSelect = document.getElementById("langSelect");

const modeSelect = document.getElementById("modeSelect");
const filterInput = document.getElementById("filterInput");

const onlySelectedBtn = document.getElementById("onlySelectedBtn");
const clearSelectedBtn = document.getElementById("clearSelectedBtn");
const clearFiltersBtn = document.getElementById("clearFiltersBtn");
const filterToggleBtn = document.getElementById("filterToggleBtn");

const chipsEl = document.getElementById("filterChips");
const worldTimeEl = document.getElementById("worldTime");
const worldTimePopupEl = document.getElementById("worldTimePopup");
const worldTimePopupBodyEl = document.getElementById("worldTimePopupBody");
const worldTimeLabelEl = document.getElementById("worldTimeLabel");
const worldTimePopupTitleEl = document.getElementById("worldTimePopupTitle");
const cacheProviderRowEl = document.getElementById("cacheProviderRow");

const labelWeekEl = document.getElementById("labelWeek");
const labelLangEl = document.getElementById("labelLang");
const labelModeEl = document.getElementById("labelMode");
const labelFilterEl = document.getElementById("labelFilter");

const LANG_STORAGE_KEY = "division2_lang";

let indexJson = null;
let i18n = {};
let i18nJaNormToKey = new Map();
let graphConfig = {};
let assetMap = null;
let SQL = null;
let lastVendorMap = null;
let lastItems = [];
let isWorldTimePopupOpen = false;
let statusMode = "";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
let filtersOpen = false;

/* ---------------------------
 * Division2 world time (HH:MM)
 * ------------------------- */
function getWorldTimeHHMM(sec) {
  let minuteSec = 0;
  for (let i = 0; i < m_sec.length; i++) {
    if (sec > m_sec[i]) minuteSec = i;
    else break;
  }
  const hour = Math.floor(minuteSec / 60);
  const minute = minuteSec % 60;
  return ("0" + hour).slice(-2) + ":" + ("0" + minute).slice(-2);
}

function updateWorldTime() {
  if (!worldTimeEl) return;
  const nowTime = new Date();
  updateScheduleStatus(nowTime);
  if (!window.base_t || !window.m_sec || !window.d1_sec) {
    worldTimeEl.textContent = "--:--";
    return;
  }
  const diff = nowTime.getTime() - base_t.getTime();
  const diffSec = Math.floor(diff / 1000);
  const curSec = diffSec % d1_sec;
  worldTimeEl.textContent = getWorldTimeHHMM(curSec);
  if (isWorldTimePopupOpen) updateWorldTimePopup(curSec, nowTime);
}

function formatHMS(totalSec) {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor(totalSec / 60) % 60;
  const s = totalSec % 60;
  return ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + ":" + ("0" + s).slice(-2);
}

function formatHM(dateObj) {
  const h = ("0" + dateObj.getHours()).slice(-2);
  const m = ("0" + dateObj.getMinutes()).slice(-2);
  return `${h}:${m}`;
}

function formatRemaining(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const mins = totalMin % 60;
  const d = String(days).padStart(2, "0");
  const h = String(hours).padStart(2, "0");
  const m = String(mins).padStart(2, "0");
  return `${d}d ${h}h ${m}m`;
}

function getJstParts(ms) {
  const d = new Date(ms + JST_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth(),
    d: d.getUTCDate(),
    dow: d.getUTCDay(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes()
  };
}

function addDaysJst(y, m, d, deltaDays) {
  const baseUtc = Date.UTC(y, m, d);
  const targetUtc = baseUtc + deltaDays * 86400000;
  const t = new Date(targetUtc);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth(), d: t.getUTCDate() };
}

function jstToUtcMs(y, m, d, h, min) {
  return Date.UTC(y, m, d, h, min) - JST_OFFSET_MS;
}

function nextWeeklyUtcMs(nowMs, dow, hour, minute) {
  const p = getJstParts(nowMs);
  let daysUntil = (dow - p.dow + 7) % 7;
  if (daysUntil === 0 && (p.h > hour || (p.h === hour && p.min >= minute))) {
    daysUntil = 7;
  }
  const date = addDaysJst(p.y, p.m, p.d, daysUntil);
  return jstToUtcMs(date.y, date.m, date.d, hour, minute);
}

function lastWeeklyUtcMs(nowMs, dow, hour, minute) {
  const p = getJstParts(nowMs);
  let daysSince = (p.dow - dow + 7) % 7;
  if (daysSince === 0 && (p.h < hour || (p.h === hour && p.min < minute))) {
    daysSince = 7;
  }
  const date = addDaysJst(p.y, p.m, p.d, -daysSince);
  return jstToUtcMs(date.y, date.m, date.d, hour, minute);
}

function updateScheduleStatus(nowTime) {
  const nowMs = nowTime.getTime();

  // Shop update: every Tue 17:00 JST
  const nextShopUtc = nextWeeklyUtcMs(nowMs, 2, 17, 0);
  const shopRemain = nextShopUtc - nowMs;

  // Cassie/Danny opening windows (24h each)
  const openSlots = [
    { dow: 3, hour: 17, min: 0 }, // Wed 17:00
    { dow: 6, hour: 1, min: 0 },  // Sat 01:00
    { dow: 1, hour: 9, min: 0 }   // Mon 09:00
  ];

  function computeStoreStatus() {
    let openUntil = null;
    let openFrom = null;
    for (const s of openSlots) {
      const lastOpen = lastWeeklyUtcMs(nowMs, s.dow, s.hour, s.min);
      const close = lastOpen + 24 * 60 * 60 * 1000;
      if (nowMs >= lastOpen && nowMs < close) {
        if (openFrom == null || lastOpen > openFrom) {
          openFrom = lastOpen;
          openUntil = close;
        }
      }
    }

    if (openUntil != null) {
      const remain = openUntil - nowMs;
      return { isOpen: true, remain };
    }

    let nextOpenUtc = null;
    for (const s of openSlots) {
      const nextOpen = nextWeeklyUtcMs(nowMs, s.dow, s.hour, s.min);
      if (nextOpenUtc == null || nextOpen < nextOpenUtc) nextOpenUtc = nextOpen;
    }
    const openRemain = nextOpenUtc - nowMs;
    return { isOpen: false, remain: openRemain };
  }

  const store = computeStoreStatus();
  const storeText = store.isOpen
    ? `${ui("closesIn")} ${formatRemaining(store.remain)}`
    : `${ui("opensIn")} ${formatRemaining(store.remain)}`;

  const lines = [
    { label: ui("shopUpdate"), time: formatRemaining(shopRemain) },
    { label: `${ui("cassie")} / ${ui("danny")}`, time: storeText }
  ];

  showScheduleStatus(lines);
}

function remainSecondsToHour(sec, toHour) {
  const bfIdx = ((toHour - 1 + 24) % 24) * 60;
  const idx = toHour * 60;
  const remainSec = (m_sec[idx] + 1 - sec + d1_sec) % d1_sec;
  return remainSec;
}

function updateWorldTimePopup(curSec, nowTime) {
  if (!worldTimePopupBodyEl) return;

  const prevBody = worldTimePopupBodyEl.querySelector(".time-popup__table-body");
  const prevScrollTop = prevBody ? prevBody.scrollTop : 0;

  const curWorld = getWorldTimeHHMM(curSec);
  const nowLocal = formatHM(nowTime);

  // Find next in-game hour (minimum remaining seconds)
  let minRemain = d1_sec;
  let nextHour = 0;
  for (let h = 0; h < 24; h++) {
    const r = remainSecondsToHour(curSec, h);
    if (r > 0 && r < minRemain) {
      minRemain = r;
      nextHour = h;
    }
  }

  const rows = [];
  rows.push(`
    <div class="time-popup__row">
      <span>${ui("worldTime")}</span>
      <strong>${curWorld}</strong>
    </div>
  `);
  rows.push(`
    <div class="time-popup__row">
      <span>${ui("localTime")}</span>
      <strong>${nowLocal}</strong>
    </div>
  `);
  // Next line omitted; full list below covers it

  const tableHead = `
    <div class="time-popup__th">${ui("nextHour")}</div>
    <div class="time-popup__th">${ui("local")}</div>
    <div class="time-popup__th">${ui("remain")}</div>
  `;
  const tableBodyRows = [];
  for (let i = 0; i < 24; i++) {
    const h = (nextHour + i) % 24;
    const r = remainSecondsToHour(curSec, h);
    const t = new Date(nowTime.getTime() + r * 1000);
    const label = `${("0" + h).slice(-2)}:00`;
    tableBodyRows.push(`<div>${label}</div><div>${formatHM(t)}</div><div>${formatHMS(r)}</div>`);
  }

  worldTimePopupBodyEl.innerHTML = `
    ${rows.join("")}
    <div class="time-popup__table">
      <div class="time-popup__table-head">${tableHead}</div>
      <div class="time-popup__table-body">${tableBodyRows.join("")}</div>
    </div>
  `;

  const newBody = worldTimePopupBodyEl.querySelector(".time-popup__table-body");
  if (newBody) newBody.scrollTop = prevScrollTop;
}

function positionWorldTimePopup() {
  if (!worldTimeEl || !worldTimePopupEl) return;
  const rect = worldTimeEl.getBoundingClientRect();
  const top = rect.bottom + 8;
  const right = Math.max(8, window.innerWidth - rect.right);
  worldTimePopupEl.style.top = `${top}px`;
  worldTimePopupEl.style.right = `${right}px`;
  worldTimePopupEl.style.left = "auto";
}

function openWorldTimePopup() {
  if (!worldTimePopupEl) return;
  isWorldTimePopupOpen = true;
  worldTimePopupEl.setAttribute("aria-hidden", "false");
  positionWorldTimePopup();
  const now = new Date();
  const diff = now.getTime() - base_t.getTime();
  const diffSec = Math.floor(diff / 1000);
  const curSec = diffSec % d1_sec;
  updateWorldTimePopup(curSec, now);
}

function closeWorldTimePopup() {
  if (!worldTimePopupEl) return;
  isWorldTimePopupOpen = false;
  worldTimePopupEl.setAttribute("aria-hidden", "true");
}

function toggleWorldTimePopup() {
  if (isWorldTimePopupOpen) closeWorldTimePopup();
  else openWorldTimePopup();
}

function setFiltersOpen(isOpen) {
  filtersOpen = !!isOpen;
  document.body.classList.toggle("filters-closed", !filtersOpen);

  const controls = [
    modeSelect,
    filterInput,
    onlySelectedBtn,
    clearSelectedBtn,
    clearFiltersBtn
  ];
  controls.forEach(el => {
    if (!el) return;
    el.disabled = !filtersOpen;
  });
}

// selection & filters
let onlySelected = false;
const selectedIds = new Set();        // item_id
let filterMode = "and";               // and/or
let activeFilterKeys = [];            // stat_key[]
const statLabelEnByKey = new Map();   // stat_key -> English label

function setStatus(msg, mode = "loading") {
  statusMode = msg ? mode : "";
  statusEl.textContent = msg || "";
  statusEl.classList.toggle("status--schedule", mode === "schedule");
  statusEl.style.display = msg ? "" : "none";
}

function showScheduleStatus(lines) {
  if (!statusEl) return;
  if (statusMode === "loading" || statusMode === "error") return;
  statusMode = "schedule";
  statusEl.classList.add("status--schedule");
  statusEl.innerHTML = (lines || []).map(l => {
    return `
      <div class="status__row">
        <span class="status__label">${escapeHtml(l.label)}</span>
        <span class="status__time">${escapeHtml(l.time)}</span>
      </div>
    `;
  }).join("");
  statusEl.style.display = (lines && lines.length) ? "" : "none";
}

function saveLangSetting() {
  if (!langSelect) return;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, langSelect.value || "ja");
  } catch (e) {
    // ignore storage errors (private mode, quota, etc.)
  }
}

function loadLangSetting() {
  if (!langSelect) return;
  try {
    const v = localStorage.getItem(LANG_STORAGE_KEY);
    if (v) langSelect.value = v;
  } catch (e) {
    // ignore storage errors
  }
}

function getUrlParam(name) {
  try {
    const params = new URLSearchParams(window.location.search || "");
    const v = params.get(name);
    return v ? v.trim() : "";
  } catch (e) {
    return "";
  }
}

function applyUrlParams() {
  // lang=ja|en
  const lang = getUrlParam("lang");
  if (lang && (lang === "ja" || lang === "en") && langSelect) {
    langSelect.value = lang;
  }

  // date=YYYY-MM-DD
  const date = getUrlParam("date");
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && dateInput) {
    dateInput.value = date;
  }
}

/* ---------------------------
 * UI text
 * ------------------------- */
const UI = {
  ja: {
    week: "週",
    language: "言語",
    mode: "条件",
    filter: "フィルタ",
    filterPh: "属性/タレントを入力（Enterで追加）",
    selectedOnly: "選択のみ",
    clearSelected: "選択解除",
    clearFilters: "フィルタ解除",
    loadingIndex: "index.json 読み込み…",
    loadingI18n: "i18n 読み込み…",
    loadingAssets: "asset_map 読み込み…",
    loadingGraph: "graph_config 読み込み…",
    loadingDb: "DB 読み込み…",
    noData: "対象週のデータがありません。",
    noChunk: "該当する月DBが見つかりません",
    error: "エラー",
    loadError: "読み込みエラー",
    catGear: "GEAR",
    catWeapon: "WEAPON",
    catMod: "MOD",
    catCache: "CACHE",
    modSuffix: "MOD",
    and: "AND",
    or: "OR",
    time: "時間",
    worldTime: "ゲーム内時刻",
    localTime: "現在時刻",
    next: "次",
    nextHour: "次の時刻",
    local: "現実時刻",
    remain: "残り",
    shopUpdate: "ショップ更新",
    cassie: "キャシー",
    danny: "ダニー",
    opensIn: "開店まで",
    closesIn: "閉店まで",
    filtersOpen: "条件を開く",
    filtersClose: "条件を閉じる"
  },
  en: {
    week: "Week",
    language: "Language",
    mode: "Mode",
    filter: "Filter",
    filterPh: "Type attribute/talent (Enter to add)",
    selectedOnly: "Selected only",
    clearSelected: "Clear selection",
    clearFilters: "Clear filters",
    loadingIndex: "Loading index.json…",
    loadingI18n: "Loading i18n…",
    loadingAssets: "Loading asset_map…",
    loadingGraph: "Loading graph_config…",
    loadingDb: "Loading DB…",
    noData: "No data for the selected week.",
    noChunk: "Monthly DB not found",
    error: "Error",
    loadError: "Load error",
    catGear: "GEAR",
    catWeapon: "WEAPON",
    catMod: "MOD",
    catCache: "CACHE",
    modSuffix: " MOD",
    and: "AND",
    or: "OR",
    time: "TIME",
    worldTime: "World Time",
    localTime: "Local Time",
    next: "Next",
    nextHour: "Next Hour",
    local: "Local",
    remain: "Remain",
    shopUpdate: "Vendor Reset",
    cassie: "Cassie",
    danny: "Danny",
    opensIn: "Opens in",
    closesIn: "Closes in",
    filtersOpen: "Show Filters",
    filtersClose: "Hide Filters"
  }
};

function ui(key) {
  const lang = (langSelect && langSelect.value) ? langSelect.value : "ja";
  return (UI[lang] && UI[lang][key]) || UI.en[key] || key;
}

function applyUiLang() {
  const lang = (langSelect && langSelect.value) ? langSelect.value : "ja";
  document.documentElement.lang = lang;

  if (labelWeekEl) labelWeekEl.textContent = ui("week");
  if (labelLangEl) labelLangEl.textContent = ui("language");
  if (labelModeEl) labelModeEl.textContent = ui("mode");
  if (labelFilterEl) labelFilterEl.textContent = ui("filter");
  if (worldTimeLabelEl) worldTimeLabelEl.textContent = ui("time");
  if (worldTimePopupTitleEl) worldTimePopupTitleEl.textContent = ui("worldTime");
  if (filterToggleBtn) {
    filterToggleBtn.textContent = filtersOpen ? ui("filtersClose") : ui("filtersOpen");
  }

  if (filterInput) filterInput.placeholder = ui("filterPh");

  // select option labels
  const optJa = langSelect?.querySelector('option[value="ja"]');
  const optEn = langSelect?.querySelector('option[value="en"]');
  if (optJa) optJa.textContent = "Japanese";
  if (optEn) optEn.textContent = "English";

  const optAnd = modeSelect?.querySelector('option[value="and"]');
  const optOr = modeSelect?.querySelector('option[value="or"]');
  if (optAnd) optAnd.textContent = ui("and");
  if (optOr) optOr.textContent = ui("or");

  // buttons
  if (onlySelectedBtn) onlySelectedBtn.textContent = ui("selectedOnly");
  if (clearSelectedBtn) clearSelectedBtn.textContent = ui("clearSelected");
  if (clearFiltersBtn) clearFiltersBtn.textContent = ui("clearFilters");

  if (isWorldTimePopupOpen) updateWorldTime();
  renderChips(); // label changes
  updateScheduleStatus(new Date());
  if (cacheProviderRowEl) {
    cacheProviderRowEl.style.display = "";
  }
}

/* ---------------------------
 * Vendor order
 * ------------------------- */
const VENDOR_ORDER = [
  "whitehouse",
  "clan",
  "countdown",
  "thecampus",
  "thetheater",
  "thecastle",
  "cassie",
  "dzeast",
  "dzsouth",
  "dzwest",
  "haven",
  "benitez",
  "thebridge",
  "danny"
];

/* ---------------------------
 * Static cache items (not stored in DB)
 * ------------------------- */
// Some vendors always sell caches, but they may not exist in the DB.
// Inject them at render-time so they are always visible in the UI.
const STATIC_VENDOR_EN = {
  countdown: "Countdown",
  dzeast: "DZ East",
  dzsouth: "DZ South",
  dzwest: "DZ West"
};

const STATIC_CACHE_ITEMS = {
  // Countdown vendor: always show these caches
  countdown: [
    { name_en: "Named Item Cache", price: 112, rarity: "named" },
    { name_en: "Optimization Cache", price: 145, rarity: "highend" },
    { name_en: "Season Cache", price: 145, rarity: "highend" },
    { name_en: "Exotic Cache", price: 224, rarity: "exotic" }
  ],
  // Dark Zone vendors: exotic cache
  dzeast: [
    { name_en: "Exotic Cache", price: 170, rarity: "exotic" }
  ],
  dzsouth: [
    { name_en: "Exotic Cache", price: 170, rarity: "exotic" }
  ],
  dzwest: [
    { name_en: "Exotic Cache", price: 170, rarity: "exotic" }
  ]
};

function injectStaticCaches(vendorMap, dateStr) {
  if (!vendorMap) return;

  for (const [vendorKey, defs] of Object.entries(STATIC_CACHE_ITEMS)) {
    if (!Array.isArray(defs) || defs.length === 0) continue;

    if (!vendorMap.has(vendorKey)) vendorMap.set(vendorKey, []);
    const arr = vendorMap.get(vendorKey);

    const vendorEn = (arr[0] && arr[0].vendor_en) ? arr[0].vendor_en : (STATIC_VENDOR_EN[vendorKey] || vendorKey);

    const hasCache = (nameKey) => {
      const nk = String(nameKey || "");
      return arr.some(it =>
        it && it.category === "cache" &&
        (String(it.name_key || "") === nk || normalizeKey(it.name_en) === nk)
      );
    };

    // Put injected caches before other items (stable, deterministic)
    const ordStart = -1000;

    defs.forEach((d, i) => {
      const nameEn = String(d.name_en || "").trim();
      if (!nameEn) return;

      const nameKey = normalizeKey(nameEn);
      if (hasCache(nameKey)) return;

      const priceNum = Number(d.price);
      const priceRaw = (Number.isFinite(priceNum) ? String(priceNum) : String(d.price ?? "").trim());

      arr.push({
        item_id: `static-${dateStr}-${vendorKey}-${nameKey}`,
        date: dateStr,
        category: "cache",
        rarity: String(d.rarity || "highend"),
        vendor_en: vendorEn,
        vendor_key: vendorKey,
        name_en: nameEn,
        name_key: nameKey,
        brand_en: "",
        brand_key: "",
        slot_en: "",
        slot_key: "",
        item_ord: ordStart + i,
        lines: [
          {
            ord: 0,
            line_type: "price",
            icon_class: "",
            stat_key: "unit_price",
            stat_en: "Unit Price",
            value_num: Number.isFinite(priceNum) ? priceNum : null,
            value_raw: priceRaw,
            unit: ""
          }
        ]
      });
    });
  }
}


/* ---------------------------
 * Division2 shop week normalize
 * ------------------------- */
function parseLocalYmd(dateStr) {
  const m = String(dateStr || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return new Date(y, mo - 1, d); // local
}
function formatLocalYmd(dtObj) {
  const y = dtObj.getFullYear();
  const m = String(dtObj.getMonth() + 1).padStart(2, "0");
  const d = String(dtObj.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
// Date -> the Tuesday (local) of its shop week
function normalizeToShopWeekStart(dateStr) {
  const dtObj = parseLocalYmd(dateStr);
  if (!dtObj) return dateStr;
  const day = dtObj.getDay(); // Sun=0 ... Tue=2
  const TUE = 2;
  const diff = (day - TUE + 7) % 7; // 0..6
  const start = new Date(dtObj);
  start.setDate(dtObj.getDate() - diff);
  return formatLocalYmd(start);
}

/* ---------------------------
 * Common helpers
 * ------------------------- */
function normalizeKey(text) {
  if (text == null) return "";
  return String(text)
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function sanitizeFileKey(key) {
  // ファイル名用：ASCII英数と._- 以外は _ に置換
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stripHtml(s) {
  return String(s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trText(text) {
  const cleaned = stripHtml(text ?? "");
  if (langSelect.value !== "ja") return cleaned;
  const key = normalizeKey(cleaned);
  return i18n[key] ?? cleaned;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------------------------
 * Assets
 * ------------------------- */
function assetUrl(assetPath) {
  if (!assetPath) return "";
  // asset_map は "img/..." のパスを返す想定。vendor/ からは ../img/...
  return assetPath.startsWith("img/") ? `../${assetPath}` : assetPath;
}
function assetPath(kind, key) {
  const k = String(key || "").trim();
  if (!k) return "";
  const dict = assetMap && assetMap[kind];
  if (dict && dict[k]) return dict[k];
  return "";
}
function iconUrl(kind, key, fallbackDir = "") {
  const p = assetPath(kind, key);
  if (p) return assetUrl(p);
  if (!fallbackDir) return "";
  const safe = sanitizeFileKey(key);
  if (!safe) return "";
  return `../${fallbackDir}/${safe}.png`;
}

/* ---------------------------
 * i18n reverse map (JA text -> key)
 * ------------------------- */
function buildI18nReverse() {
  const m = new Map();
  const dup = new Set();
  for (const [k, v] of Object.entries(i18n || {})) {
    const n = normalizeKey(v);
    if (!n) continue;
    if (m.has(n)) {
      dup.add(n);
    } else {
      m.set(n, k);
    }
  }
  for (const n of dup) m.delete(n);
  i18nJaNormToKey = m;
}

function userTextToKey(text) {
  const raw = stripHtml(text || "").trim();
  if (!raw) return "";
  const norm = normalizeKey(raw);

  // 1) if already a key
  if (i18n && Object.prototype.hasOwnProperty.call(i18n, norm)) return norm;

  // 2) JA label -> key
  if (langSelect.value === "ja") {
    const k = i18nJaNormToKey.get(norm);
    if (k) return k;
  }
  // 3) fallback normalize
  return norm;
}

/* ---------------------------
 * Talent fallback variants
 * ------------------------- */
// - perfect** / perfectly** の接頭辞を外した通常版へフォールバック
// - futureperfect の完全版は futureperfection、逆も相互に試す
function talentKeyVariants(tKey) {
  const key = String(tKey || "");
  const vars = [];
  if (key === "futureperfection") vars.push("futureperfect");
  if (key === "futureperfect") vars.push("futureperfection");

  if (key.startsWith("perfectly")) {
    const base = key.replace(/^perfectly/, "");
    if (base) vars.push(base);
  } else if (key.startsWith("perfect")) {
    const base = key.replace(/^perfect/, "");
    if (base) vars.push(base);
  }

  const seen = new Set([key]);
  const out = [];
  for (const v of vars) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function iconImgHtml(src, cls, alt, fallbackList = []) {
  const fallbacks = Array.isArray(fallbackList) ? fallbackList.filter(Boolean) : [];
  const fbAttr = fallbacks.length
    ? ` data-fallbacks="${escapeHtml(fallbacks.join("|"))}" data-fbi="0"`
    : "";
  return `<img class="${escapeHtml(cls)}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"${fbAttr}
    onerror="(function(img){const fb=img.dataset.fallbacks; if(!fb){img.style.display='none'; return;} const arr=fb.split('|'); const i=Number(img.dataset.fbi||0); if(i < arr.length){img.dataset.fbi=String(i+1); img.src=arr[i];} else {img.style.display='none';}})(this)">`;
}

function bgIconHtml(src, cls, alt, fallbackList = []) {
  if (!src) return "";
  const img = iconImgHtml(src, "card__bgimg", alt, fallbackList);
  return `<div class="card__bg ${escapeHtml(cls)}">${img}</div>`;
}

/* ---------------------------
 * DB chunk & fetch
 * ------------------------- */
function toMonth(dateStr) {
  return (dateStr || "").slice(0, 7);
}

function pickChunkForDate(dateStr) {
  const m = toMonth(dateStr);
  if (!indexJson?.chunks?.length) return null;
  const byMonth = indexJson.chunks.find(c => c.month === m);
  if (byMonth) return byMonth;
  return indexJson.chunks.find(c => c.start <= dateStr && dateStr <= c.end) || null;
}

async function fetchJson(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${path}`);
  return res.json();
}

async function fetchArrayBuffer(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`fetch failed: ${res.status} ${path}`);
  return res.arrayBuffer();
}

async function gunzipToUint8Array(gzBuffer) {
  if ("DecompressionStream" in window) {
    const ds = new DecompressionStream("gzip");
    const stream = new Blob([gzBuffer]).stream().pipeThrough(ds);
    const ab = await new Response(stream).arrayBuffer();
    return new Uint8Array(ab);
  }
  if (window.pako) {
    return window.pako.ungzip(new Uint8Array(gzBuffer));
  }
  throw new Error("gzip decode unavailable. Use a modern browser or add pako.min.js.");
}

async function initSql() {
  if (SQL) return SQL;
  if (typeof initSqlJs !== "function") {
    throw new Error("sql-wasm.js is not loaded. Place vendor/sql-wasm.js and vendor/sql-wasm.wasm.");
  }
  SQL = await initSqlJs({
    locateFile: (file) => `./${file}`
  });
  return SQL;
}

function clearContent() {
  contentEl.innerHTML = "";
}

/* ---------------------------
 * MOD helpers
 * ------------------------- */
function isDashOnlyText(s) {
  const t = stripHtml(s ?? "");
  return /^[\-–—]+$/.test(t);
}

function modKindFromName(nameEn) {
  const s = String(nameEn || "");
  const m = s.match(/^(Offensive|Defensive|Utility)\b/i);
  return m ? (m[1][0].toUpperCase() + m[1].slice(1).toLowerCase()) : "";
}

function dotClassFromModKind(kind) {
  const k = String(kind || "").toLowerCase();
  if (k === "offensive") return "red";
  if (k === "defensive") return "blue";
  if (k === "utility") return "yellow";
  return "";
}

function computeModCard(item) {
  const lines0 = Array.isArray(item.lines) ? item.lines.slice() : [];

  const slotFromItem = stripHtml(item.slot_en || "");
  const hasSlotItem = !!slotFromItem;

  const slotIdx = hasSlotItem ? -1 : lines0.findIndex(l => String(l.line_type || "").toLowerCase() === "slot");

  let title = "MOD";
  let dotOverride = "";
  let lines = [];
  let isSkillMod = false;

  if (hasSlotItem || slotIdx >= 0) {
    isSkillMod = true;
    const skillEn = hasSlotItem ? slotFromItem : stripHtml(lines0[slotIdx].stat_en || "");
    const skillDisp = trText(skillEn);
    title = (langSelect.value === "ja") ? `${skillDisp}${ui("modSuffix")}` : `${skillDisp}${ui("modSuffix")}`;

    lines = lines0.filter(ln => String(ln.line_type || "").toLowerCase() !== "slot");
    dotOverride = "";

  } else {
    const kindEn = modKindFromName(item.name_en || "");
    const kindDisp = kindEn ? trText(kindEn) : "MOD";
    title = kindEn
      ? ((langSelect.value === "ja") ? `${kindDisp}${ui("modSuffix")}` : `${kindDisp}${ui("modSuffix")}`)
      : "MOD";

    dotOverride = dotClassFromModKind(kindEn);
    lines = lines0;
  }

  lines = lines.filter(ln => {
    const lt = String(ln.line_type || "").toLowerCase();
    if (lt === "modslot") return false;
    if (lt === "slot") return false;

    const statText = stripHtml(ln.stat_en || "");
    if (!statText) return false;
    if (isDashOnlyText(statText)) return false;

    const v = String(ln.value_raw || "").trim();
    if (v === "-" || /^[\-–—]+$/.test(v)) return false;

    return true;
  });

  return { title, lines, dotOverride, isSkillMod };
}

/* ---------------------------
 * Item / line rendering
 * ------------------------- */
function isNamedItem(item) {
  return String(item?.rarity || "").toLowerCase().includes("named");
}

function rarityToClass(rarity) {
  const r = String(rarity || "").toLowerCase();
  if (r.includes("named")) return "named";
  if (r.includes("gearset")) return "gearset";
  if (r.includes("highend")) return "highend";
  if (r.includes("exotic")) return "exotic";
  if (r.includes("offensive")) return "offensive";
  if (r.includes("defensive")) return "defensive";
  if (r.includes("utility")) return "utility";
  return "highend";
}

function dotColorFromIconClass(iconClass) {
  const c = (iconClass || "").toLowerCase();
  if (c.includes("offensive")) return "red";
  if (c.includes("defensive")) return "blue";
  if (c.includes("utility")) return "yellow";
  return "gray";
}

function getGraphMaxValue(item, ln) {
  const statKey = String(ln.stat_key || "").trim();
  if (!statKey) return 0;

  const matchException = (ex, nameKey, valueNum) => {
    if (!ex || typeof ex !== "object") return false;
    if ("name_key" in ex && String(ex.name_key || "") !== String(nameKey || "")) return false;
    if ("value_num_eq" in ex) {
      if (!Number.isFinite(valueNum)) return false;
      if (Number(valueNum) !== Number(ex.value_num_eq)) return false;
    }
    return true;
  };

  const maxFromCfg = (cfg, itemNameKey, valueNum) => {
    if (cfg == null) return 0;
    if (typeof cfg === "number") return Number(cfg) || 0;
    if (typeof cfg === "object") {
      const exs = Array.isArray(cfg.exceptions) ? cfg.exceptions : [];
      for (const ex of exs) {
        if (matchException(ex, itemNameKey, valueNum) && ex.max_value_num != null) {
          return Number(ex.max_value_num) || 0;
        }
      }
      return Number(cfg.max_value_num ?? 0) || 0;
    }
    return 0;
  };

  // gear: { stat_key: max }
  if (item.category === "gear") {
    return maxFromCfg(graphConfig?.gear?.[statKey] ?? 0, item.name_key, ln.value_num);
  }

  // weapon: { weapon_type: { stat_key: max }, default: { stat_key: max } }
  if (item.category === "weapon") {
    const w = String(item.slot_key || "").trim();
    return maxFromCfg(
      graphConfig?.weapon?.[w]?.[statKey] ??
      graphConfig?.weapon?.default?.[statKey] ??
      graphConfig?.weapon_default?.[statKey] ?? // backward compat
      0,
      item.name_key,
      ln.value_num
    );
  }

  // mod: { gear:{}, skill:{skill_key:{}}, skill_default:{} }
  if (item.category === "mod") {
    const skill = String(item.slot_key || "").trim();
    if (skill) {
      return maxFromCfg(
        graphConfig?.mod?.skill?.[skill]?.[statKey] ??
        graphConfig?.mod?.skill_default?.[statKey] ??
        graphConfig?.mod?.gear?.[statKey] ??
        0,
        item.name_key,
        ln.value_num
      );
    }
    return maxFromCfg(graphConfig?.mod?.gear?.[statKey] ?? 0, item.name_key, ln.value_num);
  }

  return 0;
}

function renderLine(item, ln, colorOverride = "") {
  const lt = String(ln.line_type || "").toLowerCase();
  if (lt === "modslot" || lt === "slot") return "";

  const iconClass = ln.icon_class || "";
  const statEn = stripHtml(ln.stat_en || "");
  if (!statEn) return "";
  if (/^[\-–—]+$/.test(statEn)) return "";

  const statKey = String(ln.stat_key || normalizeKey(statEn));
  if (!statLabelEnByKey.has(statKey)) statLabelEnByKey.set(statKey, statEn);

  const stat = (langSelect.value === "ja") ? (i18n[statKey] ?? statEn) : statEn;

  const unit = String(ln.unit || "");
  const valueNum = Number.isFinite(ln.value_num) ? ln.value_num : null;
  const valueRaw = String(ln.value_raw || "").trim();
  if (valueNum === null && (valueRaw === "-" || /^[\-–—]+$/.test(valueRaw))) return "";
  let valueText = "";
  if (valueNum !== null) {
    const numStr = Number.isInteger(valueNum) ? String(Math.trunc(valueNum)) : String(valueNum);
    valueText = `${numStr}${unit}`;
  }

  const valuePart = valueText ? (item.category === "cache" ? `${valueText}` : `+${valueText}`) : "";
  const text = valuePart ? `${valuePart} ${stat}` : `${stat}`;
  if (!text.trim() || /^[\-–—]+$/.test(text.trim())) return "";

  const colorClass = colorOverride ? colorOverride : dotColorFromIconClass(iconClass);
  const perfectItem = (() => {
    const byCat = graphConfig?.perfect?.items_by_category;
    if (!byCat || typeof byCat !== "object") return null;
    const nk = String(item.name_key || "");
    const cat = String(item.category || "");
    const items = Array.isArray(byCat[cat]) ? byCat[cat] : [];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      if (String(it.name_key || "") !== nk) continue;
      return it;
    }
    return null;
  })();

  const isPerfectTalent =
    (lt === "talent") &&
    isNamedItem(item) &&
    !!(perfectItem && perfectItem.perfect_talent_key && String(perfectItem.perfect_talent_key) === String(statKey));

  const isPerfectAttr = (() => {
    if (!isNamedItem(item)) return false;
    if (!(lt === "core" || lt === "attr")) return false;
    if (!perfectItem || !Array.isArray(perfectItem.attrs)) return false;
    const vnum = Number.isFinite(ln.value_num) ? ln.value_num : null;
    for (const ex of perfectItem.attrs) {
      if (!ex || typeof ex !== "object") continue;
      if (String(ex.stat_key || "") !== String(statKey)) continue;
      if (String(ex.unit || "") !== String(unit)) continue;
      if (vnum == null) continue;
      if (Number(vnum) !== Number(ex.max_value_num)) continue;
      return true;
    }
    return false;
  })();

  // talent icon（Perfect系は通常版へフォールバック）
  let talentIconHtml = "";
  if (lt === "talent") {
    const baseKey = sanitizeFileKey(statKey || normalizeKey(statEn));
    const variants = talentKeyVariants(baseKey);
    const isWeapon = item.category === "weapon";
    const primaryKind = isWeapon ? "weapon_talents" : "talents";
    const fallbackKind = isWeapon ? "talents" : "weapon_talents";

    const primary = iconUrl(primaryKind, baseKey, isWeapon ? "img/weapon_talents" : "img/talents");
    const fallbacks = [];

    for (const k of variants) {
      const p = iconUrl(primaryKind, k, isWeapon ? "img/weapon_talents" : "img/talents");
      if (p) fallbacks.push(p);
    }

    const fbSameKey = iconUrl(fallbackKind, baseKey, isWeapon ? "img/talents" : "img/weapon_talents");
    if (fbSameKey) fallbacks.push(fbSameKey);
    for (const k of variants) {
      const p = iconUrl(fallbackKind, k, isWeapon ? "img/talents" : "img/weapon_talents");
      if (p) fallbacks.push(p);
    }

    // uniq
    const uniq = [];
    const seen = new Set();
    for (const u of fallbacks) { if (!seen.has(u)) { seen.add(u); uniq.push(u); } }

    talentIconHtml = primary ? iconImgHtml(primary, "ico ico--talent", "talent", uniq) : "";
  }

  // gauge（未定義は 0%）
  let gaugeHtml = "";
  const vnum = (ln.value_num != null && ln.value_num !== "") ? Number(ln.value_num) : null;
  if (vnum != null && !Number.isNaN(vnum) && lt !== "talent" && item.category !== "cache") {
    const maxv = getGraphMaxValue(item, ln);
    const pct = (maxv > 0) ? Math.max(0, Math.min(100, (vnum / maxv) * 100)) : 0;
    gaugeHtml = `
      <div class="gauge" title="${pct.toFixed(1)}%">
        <div class="gauge__fill" style="width:${pct.toFixed(1)}%"></div>
      </div>
    `;
  }

  const perfectClass = (isPerfectTalent || isPerfectAttr) ? " line--perfect" : "";
  const lineClass = `line line--${colorClass} line--${lt}${perfectClass}`;
  const hitClass = activeFilterKeys.includes(statKey) ? " is-filter-hit" : "";

  return `
    <div class="${lineClass}${hitClass}" data-stat-key="${escapeHtml(statKey)}" data-line-type="${escapeHtml(lt)}">
      ${talentIconHtml}
      <div class="line__body">
        <div class="line__text">${escapeHtml(text)}</div>
        ${gaugeHtml}
      </div>
    </div>
  `;
}

function sortLinesForDisplay(lines) {
  // 要望：attr の下に talent（core/attr → talent）
  const typeOrder = { price: -1, core: 0, attr: 1, talent: 2, modslot: 9, slot: 9 };
  return (lines || []).slice().sort((a, b) => {
    const oa = typeOrder[String(a.line_type || "").toLowerCase()] ?? 9;
    const ob = typeOrder[String(b.line_type || "").toLowerCase()] ?? 9;
    if (oa !== ob) return oa - ob;
    return (a.ord ?? 0) - (b.ord ?? 0);
  });
}

function buildCardHead(item, modCard = null) {
  const lang = langSelect.value;

  if (item.category === "gear") {
    const brandEn = item.brand_en || "";
    const slotEn = item.slot_en || "";

    const brand = (lang === "ja") ? (i18n[item.brand_key] ?? trText(brandEn)) : brandEn;
    const slot = (lang === "ja") ? (i18n[item.slot_key] ?? trText(slotEn)) : slotEn;

    let name = "";
    if (isNamedItem(item)) {
      const nameEn = item.name_en || "";
      const d = (lang === "ja") ? trText(nameEn) : nameEn;
      if (d && d !== slot) name = d;
    }

    const title1 = brand;
    const title2 = name ? `${slot} / ${name}` : `${slot}`;
    const title2Parts = name ? { slot, name } : null;

    return {
      title1,
      title2,
      title2Parts,
      titleClass: isNamedItem(item) ? " is-named" : ""
    };
  }

  if (item.category === "weapon") {
    const nameEn = item.name_en || "";
    const title1 = (lang === "ja") ? trText(nameEn) : nameEn;

    const typeEn = item.slot_en || item.slot_key || "";
    const typeDisp = (lang === "ja")
      ? (i18n[item.slot_key] ?? trText(typeEn))
      : (stripHtml(typeEn) || item.slot_key || "");

    return { title1, title2: typeDisp, titleClass: isNamedItem(item) ? " is-named" : "" };
  }

  if (item.category === "mod" && modCard) {
    return { title1: modCard.title, title2: "", titleClass: "" };
  }

  const nameEn = item.name_en || "";
  const title1 = (lang === "ja") ? trText(nameEn) : nameEn;
  return { title1, title2: "", titleClass: "" };
}

function buildCardBg(item, modCard = null) {
  // gear: brand (TR), slot (BR)
  if (item.category === "gear") {
    const bKey = item.brand_key || normalizeKey(item.brand_en);
    const sKey = item.slot_key || normalizeKey(item.slot_en);

    const brandIcon = iconUrl("brands", bKey, "img/brands");
    const slotIcon = iconUrl("gear_slots", sKey, "img/gears");

    return [
      bgIconHtml(brandIcon, "card__bg--tr", "brand"),
      bgIconHtml(slotIcon, "card__bg--br", "slot")
    ].join("");
  }

  // weapon: weapon type (TR)
  if (item.category === "weapon") {
    const wKey = item.slot_key || normalizeKey(item.slot_en);
    const wIcon = iconUrl("weapon_types", wKey, "img/weapons");
    return bgIconHtml(wIcon, "card__bg--tr", "weapon");
  }

  // mod: skill mod / gear mod icons (top-right)
  if (item.category === "mod" && modCard) {
    const p = modCard.isSkillMod ? "../img/gears/skillmod.png" : "../img/gears/gearmod.png";
    return bgIconHtml(p, "card__bg--tr", "mod");
  }

  return "";
}

function buildCardSearch(item, lines, head) {
  const toks = [];
  const push = (s) => {
    const n = normalizeKey(stripHtml(s ?? ""));
    if (n) toks.push(n);
  };

  // item basics
  push(item.category);
  push(item.rarity);

  // vendor / brand / slot / name (key + EN + JA label)
  push(item.vendor_key);
  push(item.vendor_en);
  push(i18n[item.vendor_key] || "");

  push(item.brand_key);
  push(item.brand_en);
  push(i18n[item.brand_key] || "");

  push(item.slot_key);
  push(item.slot_en);
  push(i18n[item.slot_key] || "");

  push(item.name_key);
  push(item.name_en);
  push(i18n[item.name_key] || "");

  // rendered titles (in current language)
  if (head) {
    push(head.title1 || "");
    push(head.title2 || "");
  }

  // lines (stat key + EN + JA)
  for (const ln of (lines || [])) {
    push(ln.stat_key || "");
    push(ln.stat_en || "");
    if (ln.stat_key && i18n[ln.stat_key]) push(i18n[ln.stat_key]);
  }
  return toks.join(" ");
}

function renderCard(item) {
  let lines = item.lines || [];
  let colorOverride = "";
  let modCard = null;

  if (item.category === "mod") {
    modCard = computeModCard(item);
    lines = modCard.lines;
    colorOverride = modCard.dotOverride;
  }

  const head = buildCardHead(item, modCard);
  const vendorTitle = (langSelect.value === "ja")
    ? (i18n[item.vendor_key] ?? item.vendor_en ?? item.vendor_key ?? "")
    : (item.vendor_en ?? item.vendor_key ?? "");
  const rarityClass = rarityToClass(item.rarity);
  const bg = buildCardBg(item, modCard);

  lines = sortLinesForDisplay(lines);

  const linesHtml = lines
    .map(ln => renderLine(item, ln, colorOverride))
    .filter(Boolean)
    .join("");

  // key list for filters
  const keys = Array.from(new Set(lines.map(ln => String(ln.stat_key || "").trim()).filter(Boolean))).join(" ");

  // For partial-match filtering
  const search = buildCardSearch(item, lines, head);

  const namedClass = head.titleClass || "";
  let title2Html = "";
  if (head.title2Parts && head.title2Parts.name) {
    title2Html = `
      <div class="card__subtitle">
        <span class="card__subtitle-text">${escapeHtml(head.title2Parts.slot)}</span>
        <span class="card__subtitle-sep">/</span>
        <span class="card__subtitle-name is-named">${escapeHtml(head.title2Parts.name)}</span>
      </div>
    `;
  } else if (head.title2) {
    title2Html = `<div class="card__subtitle"><span class="card__subtitle-text">${escapeHtml(head.title2)}</span></div>`;
  }

  return `
    <div class="card rarity-${escapeHtml(rarityClass)} cat-${escapeHtml(item.category)}" data-item-id="${escapeHtml(item.item_id)}" data-keys="${escapeHtml(keys)}" data-search="${escapeHtml(search)}" data-vendor="${escapeHtml(vendorTitle)}">
      ${bg}
      <div class="card__head">
        <div class="card__title-wrap">
          <div class="card__titles">
            <div class="card__title${namedClass}"><span class="card__title-text">${escapeHtml(head.title1 || "")}</span></div>
            ${title2Html}
          </div>
        </div>
      </div>
      <div class="lines">${linesHtml}</div>
    </div>
  `;
}

/* ---------------------------
 * Render vendors
 * ------------------------- */
function sortItemsStable(arr) {
  const a2 = Array.from(arr || []);
  return a2.sort((x, y) => {
    const ox = Number.isFinite(x.item_ord) ? x.item_ord : null;
    const oy = Number.isFinite(y.item_ord) ? y.item_ord : null;
    if (ox != null && oy != null && ox !== oy) return ox - oy;
    if (ox != null && oy == null) return -1;
    if (ox == null && oy != null) return 1;

    const sx = `${x.slot_key || ""}|${x.brand_key || ""}|${x.name_en || ""}`.toLowerCase();
    const sy = `${y.slot_key || ""}|${y.brand_key || ""}|${y.name_en || ""}`.toLowerCase();
    return sx.localeCompare(sy);
  });
}

function vendorOrderIndex(vkey) {
  const i = VENDOR_ORDER.indexOf(vkey);
  return (i === -1) ? 9999 : i;
}

function sortItemsByVendorAndOrd(arr) {
  const a2 = Array.from(arr || []);
  return a2.sort((x, y) => {
    const ia = vendorOrderIndex(x.vendor_key);
    const ib = vendorOrderIndex(y.vendor_key);
    if (ia !== ib) return ia - ib;

    const ox = Number.isFinite(x.item_ord) ? x.item_ord : null;
    const oy = Number.isFinite(y.item_ord) ? y.item_ord : null;
    if (ox != null && oy != null && ox !== oy) return ox - oy;
    if (ox != null && oy == null) return -1;
    if (ox == null && oy != null) return 1;

    const sx = `${x.slot_key || ""}|${x.brand_key || ""}|${x.name_en || ""}`.toLowerCase();
    const sy = `${y.slot_key || ""}|${y.brand_key || ""}|${y.name_en || ""}`.toLowerCase();
    return sx.localeCompare(sy);
  });
}

function renderOnlySelectedView() {
  clearContent();

  const selectedItems = (lastItems || []).filter(it => selectedIds.has(it.item_id));
  if (!selectedItems.length) return;

  const catOrder = ["gear", "weapon", "mod", "cache"];
  for (const cat of catOrder) {
    const items = sortItemsByVendorAndOrd(selectedItems.filter(x => x.category === cat));
    if (!items.length) continue;

    const label = (cat === "gear") ? ui("catGear")
      : (cat === "weapon") ? ui("catWeapon")
      : (cat === "mod") ? ui("catMod")
      : ui("catCache");

    const section = document.createElement("section");
    section.className = `catgroup catgroup--${cat}`;
    section.innerHTML = `
      <div class="catgroup__title">${escapeHtml(label)}</div>
      <div class="grid grid--${escapeHtml(cat)}"></div>
    `;

    const grid = section.querySelector(".grid");
    for (const item of items) {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderCard(item);
      grid.appendChild(wrapper.firstElementChild);
    }

    contentEl.appendChild(section);
  }

  syncCardSelectionClasses();
  applyFiltersToDom();
}

function updateViewMode() {
  if (onlySelected) {
    renderOnlySelectedView();
  } else if (lastVendorMap) {
    renderVendors(lastVendorMap);
  }
}

function renderVendors(vendorMap) {
  clearContent();

  const vendors = Array.from(vendorMap.keys()).sort((a, b) => {
    const ia = VENDOR_ORDER.indexOf(a);
    const ib = VENDOR_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b);
  });

  if (vendors.length === 0) {
    contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
    return;
  }

  const catOrder = ["gear", "weapon", "mod", "cache"];

  for (const vendorKey of vendors) {
    const itemsAll = vendorMap.get(vendorKey) || [];
    const vendorEn = (itemsAll[0] && itemsAll[0].vendor_en) ? itemsAll[0].vendor_en : vendorKey;

    const vendorTitle = (langSelect.value === "ja")
      ? (i18n[vendorKey] ?? vendorEn)
      : vendorEn;

    const groups = {
      gear: sortItemsStable(itemsAll.filter(x => x.category === "gear")),
      weapon: sortItemsStable(itemsAll.filter(x => x.category === "weapon")),
      mod: sortItemsStable(itemsAll.filter(x => x.category === "mod")),
      cache: sortItemsStable(itemsAll.filter(x => x.category === "cache"))
    };

    const section = document.createElement("section");
    section.className = "vendor";
    section.innerHTML = `
      <h3 class="vendor__title"><span>${escapeHtml(vendorTitle)}</span></h3>
      <div class="vendor__groups">
        ${catOrder.map(cat => {
          const cnt = groups[cat].length;
          if (!cnt) return "";
          const label = (cat === "gear") ? ui("catGear") : (cat === "weapon") ? ui("catWeapon") : (cat === "mod") ? ui("catMod") : ui("catCache");
          return `
            <div class="catgroup catgroup--${escapeHtml(cat)}">
              <div class="catgroup__title">${escapeHtml(label)}</div>
              <div class="grid grid--${escapeHtml(cat)}"></div>
            </div>
          `;
        }).join("")}
      </div>
    `;

    for (const cat of catOrder) {
      const grid = section.querySelector(`.grid--${cat}`);
      if (!grid) continue;

      for (const item of groups[cat]) {
        const wrapper = document.createElement("div");
        wrapper.innerHTML = renderCard(item);
        grid.appendChild(wrapper.firstElementChild);
      }
    }

    contentEl.appendChild(section);
  }

  // After render, apply selection state & filters
  syncCardSelectionClasses();
  applyFiltersToDom();
}

/* ---------------------------
 * Selection / filtering (DOM)
 * ------------------------- */
function syncCardSelectionClasses() {
  document.querySelectorAll(".card[data-item-id]").forEach(card => {
    const id = card.dataset.itemId;
    if (selectedIds.has(id)) card.classList.add("is-selected");
    else card.classList.remove("is-selected");
  });
}

function cardHasKeys(card, terms) {
  const hay = String(card.dataset.search || "");
  if (!terms.length) return true;
  if (!hay) return false;

  const t = terms
    .map(s => normalizeKey(stripHtml(s ?? "")))
    .filter(Boolean);

  if (!t.length) return true;

  if (filterMode === "or") {
    return t.some(x => hay.includes(x));
  }
  return t.every(x => hay.includes(x));
}


function applyFiltersToDom() {
  const keys = activeFilterKeys.slice();

  document.body.classList.toggle("only-selected", onlySelected);

  document.querySelectorAll(".card[data-item-id]").forEach(card => {
    const id = card.dataset.itemId;
    const okSel = (!onlySelected) || selectedIds.has(id);
    const okKeys = cardHasKeys(card, keys);
    card.style.display = (okSel && okKeys) ? "" : "none";
  });

  // line highlight
  document.querySelectorAll(".line[data-stat-key]").forEach(line => {
    const k = line.dataset.statKey;
    if (activeFilterKeys.includes(k)) line.classList.add("is-filter-hit");
    else line.classList.remove("is-filter-hit");
  });

  // toggle button ui
  if (onlySelectedBtn) {
    onlySelectedBtn.classList.toggle("is-on", onlySelected);
  }
  // Hide empty category blocks / vendors when no cards match
  document.querySelectorAll(".catgroup").forEach(group => {
    const any = Array.from(group.querySelectorAll(".card[data-item-id]"))
      .some(c => c.style.display !== "none");
    group.style.display = any ? "" : "none";
  });

  document.querySelectorAll(".vendor").forEach(v => {
    const any = Array.from(v.querySelectorAll(".card[data-item-id]"))
      .some(c => c.style.display !== "none");
    v.style.display = any ? "" : "none";
  });

}

function keyToLabel(key) {
  const lang = langSelect.value;
  if (lang === "ja") return i18n[key] ?? statLabelEnByKey.get(key) ?? key;
  return statLabelEnByKey.get(key) ?? key;
}

function renderChips() {
  if (!chipsEl) return;
  const keys = activeFilterKeys.slice();
  if (!keys.length) {
    chipsEl.innerHTML = "";
    return;
  }
  chipsEl.innerHTML = keys.map(k => {
    const text = keyToLabel(k);
    return `
      <div class="chip" data-key="${escapeHtml(k)}">
        <span class="chip__text">${escapeHtml(text)}</span>
        <span class="chip__x" role="button" aria-label="remove" title="remove">×</span>
      </div>
    `;
  }).join("");
}

function addFilterKey(key) {
  const k = String(key || "").trim();
  if (!k) return;
  if (!activeFilterKeys.includes(k)) activeFilterKeys = activeFilterKeys.concat([k]);
  renderChips();
  applyFiltersToDom();
}

function removeFilterKey(key) {
  const k = String(key || "").trim();
  if (!k) return;
  activeFilterKeys = activeFilterKeys.filter(x => x !== k);
  renderChips();
  applyFiltersToDom();
}

function toggleFilterKey(key) {
  const k = String(key || "").trim();
  if (!k) return;
  if (activeFilterKeys.includes(k)) removeFilterKey(k);
  else addFilterKey(k);
}

function clearFilters() {
  activeFilterKeys = [];
  renderChips();
  applyFiltersToDom();
}

function clearSelection() {
  selectedIds.clear();
  onlySelected = false;
  syncCardSelectionClasses();
  applyFiltersToDom();
}

function toggleCardSelection(cardEl) {
  const id = cardEl?.dataset?.itemId;
  if (!id) return;
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    cardEl.classList.remove("is-selected");
  } else {
    selectedIds.add(id);
    cardEl.classList.add("is-selected");
  }
  applyFiltersToDom();
}

/* ---------------------------
 * Main loader
 * ------------------------- */
async function loadWeek(userDateStr, options = {}) {
  const preserveSelection = !!options.preserveSelection;
  const dateStr = normalizeToShopWeekStart(userDateStr);
  if (dateInput && dateStr) dateInput.value = dateStr;
  if (!indexJson) throw new Error("index.json is not loaded");

  // week switch => selection reset
  if (!preserveSelection) clearSelection();

  const chunk = pickChunkForDate(dateStr);
  if (!chunk) {
    renderVendors(new Map());
    setStatus(`${ui("noChunk")}（${dateStr}）`);
    return;
  }

  const v = indexJson.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : "";
  const chunkUrl = `${DATA_BASE}/${chunk.file}${v}`;
  setStatus(ui("loadingDb"));

  const SQL = await initSql();
  const gz = await fetchArrayBuffer(chunkUrl);
  const dbBytes = await gunzipToUint8Array(gz);

  const db = new SQL.Database(dbBytes);

  try {
    const stmt = db.prepare(`
      SELECT
        i.item_id,
        i.date,
        i.category,
        i.rarity,
        i.vendor_en,
        i.vendor_key,
        i.name_en,
        i.name_key,
        i.brand_en,
        i.brand_key,
        i.slot_en,
        i.slot_key,
        i.item_ord,
        l.ord,
        l.line_type,
        l.icon_class,
        l.stat_key,
        l.stat_en,
        l.value_num,
        l.value_raw,
        l.unit
      FROM shop_items i
      LEFT JOIN shop_lines l ON i.item_id = l.item_id
      WHERE i.date = ?
      ORDER BY i.vendor_key, i.category, i.item_ord, i.item_id, l.ord
    `);

    stmt.bind([dateStr]);

    const vendorMap = new Map();
    const itemMap = new Map();

    while (stmt.step()) {
      const row = stmt.getAsObject();

      let item = itemMap.get(row.item_id);
      if (!item) {
        item = {
          item_id: row.item_id,
          date: row.date,
          category: row.category,
          rarity: row.rarity,
          vendor_en: row.vendor_en,
          vendor_key: row.vendor_key || normalizeKey(row.vendor_en),
          name_en: row.name_en || "",
          name_key: row.name_key || normalizeKey(row.name_en),
          brand_en: row.brand_en || "",
          brand_key: row.brand_key || normalizeKey(row.brand_en),
          slot_en: row.slot_en || "",
          slot_key: row.slot_key || normalizeKey(row.slot_en),
          item_ord: (row.item_ord != null ? Number(row.item_ord) : null),
          lines: []
        };
        itemMap.set(row.item_id, item);

        const vkey = item.vendor_key;
        if (!vendorMap.has(vkey)) vendorMap.set(vkey, []);
        vendorMap.get(vkey).push(item);
      }

      if (String(row.line_type || "").toLowerCase() === "modslot") continue;

      const statText = stripHtml(row.stat_en || "");
      if (!statText) continue;
      if (/^[\-–—]+$/.test(statText)) continue;

      const vraw = String(row.value_raw || "").trim();
      if (vraw === "-" || /^[\-–—]+$/.test(vraw)) continue;

      item.lines.push({
        ord: row.ord,
        line_type: row.line_type,
        icon_class: row.icon_class,
        stat_key: row.stat_key || normalizeKey(statText),
        stat_en: row.stat_en || "",
        value_num: row.value_num,
        value_raw: row.value_raw || "",
        unit: row.unit || ""
      });
    }

    stmt.free();

    // Inject always-available cache items (not in DB)
    injectStaticCaches(vendorMap, dateStr);

    lastVendorMap = vendorMap;
    lastItems = Array.from(itemMap.values());

    renderVendors(vendorMap);
    setStatus("");
  } finally {
    db.close();
  }
}

async function boot() {
  loadLangSetting();
  applyUrlParams();
  setFiltersOpen(false);
  applyUiLang();

  setStatus(ui("loadingIndex"));
  indexJson = await fetchJson(`${DATA_BASE}/index.json?ts=${Date.now()}`);

  const i18nFile = indexJson?.i18n?.file || "i18n.json";
  setStatus(ui("loadingI18n"));
  i18n = await fetchJson(`${DATA_BASE}/${i18nFile}?ts=${Date.now()}`);
  buildI18nReverse();

  // assets（任意）
  try {
    setStatus(ui("loadingAssets"));
    const assetFile = (indexJson?.assets?.file) ? indexJson.assets.file : "asset_map.json";
    assetMap = await fetchJson(`${DATA_BASE}/${assetFile}?ts=${Date.now()}`);
  } catch (e) {
    assetMap = null;
  }

  // graph config（任意）
  try {
    setStatus(ui("loadingGraph"));
    graphConfig = await fetchJson(`${DATA_BASE}/graph_config.json?ts=${Date.now()}`);
  } catch (e) {
    graphConfig = {};
  }

  const defaultDate = dateInput.value || indexJson.target_week || new Date().toISOString().slice(0, 10);
  dateInput.value = defaultDate;

  await loadWeek(defaultDate);
}

if (filterToggleBtn) {
  filterToggleBtn.addEventListener("click", () => {
    setFiltersOpen(!filtersOpen);
    applyUiLang();
  });
}

/* ---------------------------
 * Events
 * ------------------------- */
dateInput.addEventListener("change", () => {
  const d = dateInput.value;
  if (d) loadWeek(d).catch(err => setStatus(`${ui("error")}: ${err.message}`));
});

langSelect.addEventListener("change", () => {
  saveLangSetting();
  applyUiLang();
  const d = dateInput.value;
  if (d) loadWeek(d, { preserveSelection: true }).catch(err => setStatus(`${ui("error")}: ${err.message}`));
});

modeSelect.addEventListener("change", () => {
  if (!filtersOpen) return;
  filterMode = modeSelect.value === "or" ? "or" : "and";
  applyUiLang(); // option labels (and/or)
  applyFiltersToDom();
});

filterInput.addEventListener("keydown", (e) => {
  if (!filtersOpen) return;
  if (e.key !== "Enter") return;
  const term = stripHtml(filterInput.value).trim();
  if (term) addFilterKey(term);
  filterInput.value = "";
});

onlySelectedBtn.addEventListener("click", () => {
  if (!filtersOpen) return;
  onlySelected = !onlySelected;
  updateViewMode();
  applyFiltersToDom();
});

clearSelectedBtn.addEventListener("click", () => {
  if (!filtersOpen) return;
  clearSelection();
  updateViewMode();
});

clearFiltersBtn.addEventListener("click", () => {
  if (!filtersOpen) return;
  clearFilters();
});

chipsEl.addEventListener("click", (e) => {
  if (!filtersOpen) return;
  const x = e.target.closest(".chip__x");
  if (!x) return;
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const k = chip.dataset.key;
  removeFilterKey(k);
});

if (worldTimeEl) {
  worldTimeEl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWorldTimePopup();
  });
}
document.addEventListener("click", (e) => {
  if (!isWorldTimePopupOpen) return;
  if (worldTimePopupEl && worldTimePopupEl.contains(e.target)) return;
  if (worldTimeEl && worldTimeEl.contains(e.target)) return;
  closeWorldTimePopup();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeWorldTimePopup();
});
window.addEventListener("resize", () => {
  if (isWorldTimePopupOpen) positionWorldTimePopup();
});

// event delegation: line tap => toggle filter, card tap => select
contentEl.addEventListener("click", (e) => {
  const line = e.target.closest(".line[data-stat-key]");
  if (line) {
    if (!filtersOpen) return;
    e.stopPropagation();
    toggleFilterKey(line.dataset.statKey);
    return;
  }
  const card = e.target.closest(".card[data-item-id]");
  if (card) {
    toggleCardSelection(card);
  }
});

boot().catch(err => {
  console.error(err);
  setStatus(`${ui("loadError")}: ${err.message}`, "error");
});

// world time tick (once per second)
updateWorldTime();
setInterval(updateWorldTime, 1000);
