/* global initSqlJs */

const APP_BASE = String(window.__APP_BASE__ || ".").replace(/\/+$/, "");
const DATA_BASE = `${APP_BASE}/data`;

function appPath(relPath) {
  const rel = String(relPath || "").replace(/^\.?\//, "");
  return rel ? `${APP_BASE}/${rel}` : APP_BASE;
}

const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");
const langSelect = document.getElementById("langSelect");
const vendorToolbarHostEl = document.getElementById("vendorToolbarHost");
let vendorToolbarMounted = false;
let vendorDateValue = "";
let toolbarSyncLock = false;
let toolbarSyncTimer = 0;

let dateInput = null;
let modeSelect = null;
let filterInput = null;
let onlySelectedBtn = null;
let recommendSelectedBtn = null;
let clearSelectedBtn = null;
let clearFiltersBtn = null;
let filterToggleBtn = null;
let chipsEl = null;
const worldTimeEl = document.getElementById("worldTime");
const descentPoolSummaryEl = document.getElementById("descentPoolSummary");
const descentPoolValueEl = document.getElementById("descentPoolValue");
const worldTimePopupEl = document.getElementById("worldTimePopup");
const worldTimePopupBodyEl = document.getElementById("worldTimePopupBody");
const worldTimeLabelEl = document.getElementById("worldTimeLabel");
const worldTimePopupTitleEl = document.getElementById("worldTimePopupTitle");
const cacheProviderRowEl = document.getElementById("cacheProviderRow");
const worldTimeWrapEl = worldTimeEl ? worldTimeEl.closest(".topbar__time") : null;
const titleEl = document.querySelector(".topbar .title");
let weekFieldEl = null;
const navMenuBtn = document.getElementById("navMenuBtn");
const navMenuPanel = document.getElementById("navMenuPanel");
const navVendorBtn = document.getElementById("navVendorBtn");
const navWeaponsBtn = document.getElementById("navWeaponsBtn");
const navBrandBtn = document.getElementById("navBrandBtn");
const navGearsetBtn = document.getElementById("navGearsetBtn");
const navExoticGearBtn = document.getElementById("navExoticGearBtn");
const navGearTalentBtn = document.getElementById("navGearTalentBtn");
const navWeaponTalentBtn = document.getElementById("navWeaponTalentBtn");
const navDescentTalentBtn = document.getElementById("navDescentTalentBtn");
const navItemSourcesBtn = document.getElementById("navItemSourcesBtn");
const navTrelloBtn = document.getElementById("navTrelloBtn");
const navPatchesBtn = document.getElementById("navPatchesBtn");
if (navMenuPanel) navMenuPanel.inert = true;

const labelLangEl = document.getElementById("labelLang");
let labelWeekEl = null;
let labelModeEl = null;
let labelFilterEl = null;

const LANG_STORAGE_KEY = "division2_lang";

let indexJson = null;
let i18n = {};
let i18nAliases = {};
let i18nJaNormToKey = new Map();
let i18nCategories = {};
let graphConfig = {};
let vendorRecommendations = { version: 1, auto_select_on_load: false, rules: [] };
let assetMap = null;
let SQL = null;
let lastVendorMap = null;
let lastItems = [];
let isWorldTimePopupOpen = false;
let statusMode = "";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
let filtersOpen = false;
let currentViewMode = "vendor"; // vendor | weapons | brand | gearset | exotic_gear | gear_talent | weapon_talent | descent_talent | item_sources | trello | patches
let trelloSummaryCache = null;
let descentPoolState = {
  loaded: false,
  available: false,
  cycleMs: 0,
  anchorUtcMs: 0,
  entries: [] // [{ startUtcMs, pools[], talents[] }]
};
const DESCENT_POOL_CONTRIB_URL = "https://forms.gle/DVZABnwSWacTGpi48";
let floatingInfoCardEl = null;
let floatingInfoCardTitleEl = null;
let floatingInfoCardBodyEl = null;
let floatingInfoCardAnchorEl = null;
let floatingInfoBackdropEl = null;
let brandDescCache = null;
let brandDescPromise = null;
let gearsetPopupCache = null;
let gearsetPopupPromise = null;
let namedTalentLookupCache = null;
let namedTalentLookupPromise = null;
let itemTalentOverrideCache = null;
let itemTalentOverridePromise = null;
let talentDescLookupCache = null;
let talentDescLookupPromise = null;
window.currentViewMode = currentViewMode;
window.trelloGroupBy = "name";
window.trelloShowArchive = false;
window.trelloExpandAll = false;
window.brandShowNamed = false;
window.weaponsShowDetails = false;
window.weaponTalentTypeFilter = [];
window.talentShowDesc = false;
const descToggleByView = {
  gearset: false,
  exotic_gear: false,
  gear_talent: false,
  weapon_talent: false,
  descent_talent: false
};
function syncDescToggleForCurrentView() {
  if (Object.prototype.hasOwnProperty.call(descToggleByView, currentViewMode)) {
    window.talentShowDesc = !!descToggleByView[currentViewMode];
  } else {
    window.talentShowDesc = false;
  }
}
function setDescToggleForCurrentView(nextValue) {
  const v = !!nextValue;
  if (Object.prototype.hasOwnProperty.call(descToggleByView, currentViewMode)) {
    descToggleByView[currentViewMode] = v;
  }
  window.talentShowDesc = v;
}
let initialViewMode = "vendor";
window.descentTalentInitialPoolKey = "";

const VIEW_TOOLBAR_DEFS = Object.freeze({
  common: Object.freeze({
    header: Object.freeze(["title", "nav", "lang", "world_time"])
  }),
  vendor: Object.freeze({
    controls: Object.freeze([
      Object.freeze({ kind: "field_date", id: "dateInput", labelId: "labelWeek", label: "週", alwaysVisible: true }),
      Object.freeze({ kind: "button", id: "filterToggleBtn", className: "btn btn--ghost topbar__toggle", label: "条件", alwaysVisible: true }),
      Object.freeze({ kind: "group_label", id: "selectGroupLabel", className: "vendor-toolbar__group-label vendor-toolbar__group-label--select", label: "選択" }),
      Object.freeze({ kind: "button", id: "onlySelectedBtn", className: "btn btn--toggle", label: "選択のみ" }),
      Object.freeze({ kind: "button", id: "recommendSelectedBtn", className: "btn btn--ghost", label: "おすすめ選択" }),
      Object.freeze({ kind: "button", id: "clearSelectedBtn", className: "btn btn--ghost", label: "選択解除" }),
      Object.freeze({ kind: "group_label", id: "filterGroupLabel", className: "vendor-toolbar__group-label vendor-toolbar__group-label--filter", label: "フィルタ" }),
      Object.freeze({
        kind: "field_select",
        id: "modeSelect",
        labelId: "labelMode",
        label: "条件",
        options: Object.freeze([
          Object.freeze({ value: "and", label: "AND", selected: true }),
          Object.freeze({ value: "or", label: "OR" })
        ])
      }),
      Object.freeze({ kind: "field_text", id: "filterInput", labelId: "labelFilter", label: "フィルタ", autocomplete: "off" }),
      Object.freeze({ kind: "button", id: "clearFiltersBtn", className: "btn btn--ghost", label: "フィルタ解除" }),
      Object.freeze({ kind: "chips", id: "filterChips" })
    ])
  }),
  weapons: Object.freeze({
    controls: Object.freeze(["detail_toggle", "weapon_type_filter"])
  }),
  brand: Object.freeze({
    controls: Object.freeze(["named_toggle"])
  }),
  gearset: Object.freeze({
    controls: Object.freeze(["desc_toggle"])
  }),
  exotic_gear: Object.freeze({
    controls: Object.freeze(["desc_toggle"])
  }),
  gear_talent: Object.freeze({
    controls: Object.freeze(["desc_toggle"])
  }),
  weapon_talent: Object.freeze({
    controls: Object.freeze(["desc_toggle", "weapon_type_filter"])
  }),
  descent_talent: Object.freeze({
    controls: Object.freeze(["desc_toggle", "pool_filter"])
  }),
  item_sources: Object.freeze({
    controls: Object.freeze(["search", "clear", "weapon_type_filter"])
  })
});
window.viewToolbarDefs = VIEW_TOOLBAR_DEFS;

function buildToolbarHtmlFromDef(def) {
  const controls = Array.isArray(def?.controls) ? def.controls : [];
  const html = controls.map((c) => {
    if (!c || typeof c !== "object") return "";
    const extraAttr = c.alwaysVisible ? "" : ' data-vendor-filter-control="1"';
    if (c.kind === "group_label") {
      return `<div id="${c.id}" class="${c.className || "vendor-toolbar__group-label"}"${extraAttr}>${c.label || ""}</div>`;
    }
    if (c.kind === "button") {
      return `<button id="${c.id}" class="${c.className || "btn"}" type="button"${extraAttr}>${c.label || ""}</button>`;
    }
    if (c.kind === "field_date") {
      return `
      <label class="field field--date"${extraAttr}>
        <span id="${c.labelId}">${c.label || ""}</span>
        <input id="${c.id}" type="date" />
      </label>`;
    }
    if (c.kind === "field_select") {
      const options = Array.isArray(c.options) ? c.options : [];
      const optionHtml = options
        .map((o) => `<option value="${o.value}"${o.selected ? " selected" : ""}>${o.label || o.value}</option>`)
        .join("");
      return `
      <label class="field field--mode"${extraAttr}>
        <span id="${c.labelId}">${c.label || ""}</span>
        <select id="${c.id}" aria-label="${c.label || c.id || "mode"}">
          ${optionHtml}
        </select>
      </label>`;
    }
    if (c.kind === "field_text") {
      return `
      <label class="field field--filter"${extraAttr}>
        <span id="${c.labelId}">${c.label || ""}</span>
        <input id="${c.id}" type="text" autocomplete="${c.autocomplete || "off"}" aria-label="${c.label || c.id || "filter"}" />
      </label>`;
    }
    if (c.kind === "chips") {
      return `<div id="${c.id}" class="chips" aria-label="filters"${extraAttr}></div>`;
    }
    return "";
  }).join("");
  return `<div class="vendor-toolbar">${html}</div>`;
}

function findViewToolbarNodes(viewMode) {
  if (!contentEl) return [];
  const mode = String(viewMode || "");
  if (mode === "item_sources") {
    const tb = contentEl.querySelector(".item-sources-toolbar");
    return tb ? [tb] : [];
  }
  if (mode === "descent_talent") {
    const tb = contentEl.querySelector(".trello-group-toggle.descent-controls");
    return tb ? [tb] : [];
  }
  if (mode === "trello" || mode === "patches") {
    const tb = contentEl.querySelector(".trello-group-toggle");
    if (!tb) return [];
    const nodes = [tb];
    const picker = tb.nextElementSibling;
    if (picker && picker.classList.contains("trello-sections-picker")) nodes.push(picker);
    return nodes;
  }
  if (mode === "weapons" || mode === "brand" || mode === "gearset" || mode === "exotic_gear" || mode === "gear_talent" || mode === "weapon_talent") {
    const tb = contentEl.querySelector(".trello-group-toggle");
    return tb ? [tb] : [];
  }
  return [];
}

function syncHeaderToolbarFromContent() {
  if (!vendorToolbarHostEl || toolbarSyncLock) return;
  if (currentViewMode === "vendor") {
    ensureVendorToolbarMounted();
    vendorToolbarHostEl.style.display = "";
    return;
  }
  const nodes = findViewToolbarNodes(currentViewMode);
  const hasExistingHeaderToolbar = !!vendorToolbarHostEl.querySelector(".view-toolbar");
  toolbarSyncLock = true;
  try {
    if (!nodes.length) {
      if (hasExistingHeaderToolbar) {
        vendorToolbarHostEl.style.display = "";
        return;
      }
      vendorToolbarHostEl.innerHTML = "";
      vendorToolbarHostEl.style.display = "none";
      return;
    }
    vendorToolbarHostEl.innerHTML = "";
    const shell = document.createElement("div");
    shell.className = "view-toolbar";
    nodes.forEach((n) => shell.appendChild(n));
    vendorToolbarHostEl.appendChild(shell);
    vendorToolbarHostEl.style.display = "";
  } finally {
    toolbarSyncLock = false;
  }
}

function requestToolbarSync() {
  if (toolbarSyncTimer) clearTimeout(toolbarSyncTimer);
  toolbarSyncTimer = setTimeout(() => {
    toolbarSyncTimer = 0;
    syncHeaderToolbarFromContent();
  }, 0);
}

function setVendorDateValue(value) {
  vendorDateValue = String(value || "").trim();
  if (dateInput) dateInput.value = vendorDateValue;
}
window.vendorSetDateValue = setVendorDateValue;

function getVendorDateValue() {
  if (dateInput && dateInput.value) return String(dateInput.value).trim();
  return vendorDateValue;
}

function bindVendorToolbarRefs() {
  dateInput = document.getElementById("dateInput");
  modeSelect = document.getElementById("modeSelect");
  filterInput = document.getElementById("filterInput");
  onlySelectedBtn = document.getElementById("onlySelectedBtn");
  recommendSelectedBtn = document.getElementById("recommendSelectedBtn");
  clearSelectedBtn = document.getElementById("clearSelectedBtn");
  clearFiltersBtn = document.getElementById("clearFiltersBtn");
  filterToggleBtn = document.getElementById("filterToggleBtn");
  chipsEl = document.getElementById("filterChips");
  weekFieldEl = dateInput ? dateInput.closest(".field") : null;
  labelWeekEl = document.getElementById("labelWeek");
  labelModeEl = document.getElementById("labelMode");
  labelFilterEl = document.getElementById("labelFilter");
  if (dateInput && vendorDateValue) dateInput.value = vendorDateValue;
}

function bindVendorToolbarEvents() {
  if (dateInput) {
    dateInput.addEventListener("change", () => {
      const d = dateInput.value;
      if (!d) return;
      setVendorDateValue(d);
      if (currentViewMode === "vendor") {
        loadWeek(d).catch(err => setStatus(`${ui("error")}: ${err.message}`));
      }
    });
  }
  if (modeSelect) {
    modeSelect.addEventListener("change", () => {
      if (!filtersOpen) return;
      filterMode = modeSelect.value === "or" ? "or" : "and";
      applyUiLang();
      applyFiltersToDom();
    });
  }
  if (filterInput) {
    filterInput.addEventListener("keydown", (e) => {
      if (!filtersOpen) return;
      if (e.key !== "Enter") return;
      const term = stripHtml(filterInput.value).trim();
      if (term) addFilterKey(term);
      filterInput.value = "";
    });
  }
  if (onlySelectedBtn) {
    onlySelectedBtn.addEventListener("click", () => {
      if (!filtersOpen) return;
      onlySelected = !onlySelected;
      updateViewMode();
      applyFiltersToDom();
    });
  }
  if (recommendSelectedBtn) {
    recommendSelectedBtn.addEventListener("click", () => {
      if (!filtersOpen) return;
      applyVendorRecommendedSelection({ force: true });
    });
  }
  if (clearSelectedBtn) {
    clearSelectedBtn.addEventListener("click", () => {
      if (!filtersOpen) return;
      clearSelection();
      updateViewMode();
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (!filtersOpen) return;
      clearFilters();
    });
  }
  if (chipsEl) {
    chipsEl.addEventListener("click", (e) => {
      if (!filtersOpen) return;
      const x = e.target.closest(".chip__x");
      if (!x) return;
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const k = chip.dataset.key;
      removeFilterKey(k);
    });
  }
  if (filterToggleBtn) {
    filterToggleBtn.addEventListener("click", () => {
      setFiltersOpen(!filtersOpen);
      applyUiLang();
    });
  }
}

function ensureVendorToolbarMounted() {
  if (!vendorToolbarHostEl) return;
  const hasLiveToolbar = !!vendorToolbarHostEl.querySelector("#dateInput");
  if (vendorToolbarMounted && hasLiveToolbar) return;
  vendorToolbarMounted = false;
  vendorToolbarHostEl.innerHTML = buildToolbarHtmlFromDef(VIEW_TOOLBAR_DEFS.vendor);
  bindVendorToolbarRefs();
  bindVendorToolbarEvents();
  vendorToolbarMounted = true;
  setFiltersOpen(filtersOpen);
  applyUiLang();
}

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
  updateDescentPoolSummary(nowTime.getTime());
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

function updateDescentPoolSummary(nowMs) {
  if (!descentPoolSummaryEl || !descentPoolValueEl) return;
  const descent = getActiveDescentPoolStatus(nowMs);
  if (descent) {
    descentPoolValueEl.innerHTML = `<span class="topbar__descent-name">${escapeHtml(descent.poolText)}</span><span class="topbar__descent-remain">${escapeHtml(formatRemaining(descent.expireRemainMs))}</span>`;
    descentPoolSummaryEl.dataset.statusAction = "open_descent_talent";
    descentPoolSummaryEl.dataset.statusPoolKey = descent.poolKey || "";
    return;
  }
  descentPoolValueEl.innerHTML = '<span class="topbar__descent-remain">---</span>';
  descentPoolSummaryEl.dataset.statusAction = "open_descent_pool_contribute";
  descentPoolSummaryEl.dataset.statusPoolKey = "";
}

function parseJstDateTimeToUtcMs(text) {
  const s = String(text || "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return NaN;
  const y = Number(m[1]);
  const mon = Number(m[2]) - 1;
  const d = Number(m[3]);
  const h = Number(m[4]);
  const min = Number(m[5]);
  const sec = Number(m[6] || "0");
  return Date.UTC(y, mon, d, h, min, sec) - JST_OFFSET_MS;
}

function formatJstDateTimeFromUtcMs(utcMs) {
  const d = new Date(Number(utcMs) + JST_OFFSET_MS);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const h = String(d.getUTCHours()).padStart(2, "0");
  const min = String(d.getUTCMinutes()).padStart(2, "0");
  const sec = String(d.getUTCSeconds()).padStart(2, "0");
  return `${y}-${mo}-${day} ${h}:${min}:${sec}`;
}

function getActiveDescentPoolStatus(nowMs) {
  if (!descentPoolState?.available || !Array.isArray(descentPoolState.entries) || !descentPoolState.entries.length) {
    return null;
  }
  const entries = descentPoolState.entries;
  const cycleMs = Number(descentPoolState.cycleMs) || 0;
  const anchorUtcMs = Number(descentPoolState.anchorUtcMs);
  if (!(cycleMs > 0) || !Number.isFinite(anchorUtcMs)) {
    return null;
  }

  // Current cycle boundary from configured anchor/cycle.
  const slot = Math.floor((nowMs - anchorUtcMs) / cycleMs);
  const cycleStartUtcMs = anchorUtcMs + slot * cycleMs;
  const cycleEndUtcMs = cycleStartUtcMs + cycleMs;

  let found = null;
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if ((Number(e.startUtcMs) || 0) <= nowMs) {
      found = e;
      break;
    }
  }
  if (!found) return null;
  if ((Number(found.startUtcMs) || 0) !== cycleStartUtcMs) return null;

  const talents = Array.isArray(found.talents) ? found.talents.filter(Boolean) : [];
  const pools = Array.isArray(found.pools) ? found.pools.filter(Boolean) : [];
  const poolText = pools.length
    ? pools.map((x) => trText(x)).join(", ")
    : talents.map((x) => trText(x)).join(", ");
  if (!poolText) return null;
  const poolKeys = Array.isArray(found.poolKeys) ? found.poolKeys.filter(Boolean).map((x) => normalizeKey(x)) : [];
  const poolKey = poolKeys.length ? poolKeys[0] : "";
  return {
    poolText,
    poolKey,
    talents,
    expireRemainMs: Math.max(0, cycleEndUtcMs - nowMs),
    cycleStartJst: formatJstDateTimeFromUtcMs(cycleStartUtcMs),
    cycleEndJst: formatJstDateTimeFromUtcMs(cycleEndUtcMs)
  };
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
  if (currentViewMode !== "vendor") return;
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
  const filterOnlyControls = [
    ...(vendorToolbarHostEl ? Array.from(vendorToolbarHostEl.querySelectorAll("[data-vendor-filter-control='1']")) : []),
    ...(contentEl ? Array.from(contentEl.querySelectorAll("[data-vendor-filter-control='1']")) : [])
  ];
  filterOnlyControls.forEach((el) => {
    el.hidden = !filtersOpen;
    el.setAttribute("aria-hidden", (!filtersOpen).toString());
  });

  const controls = [
    modeSelect,
    filterInput,
    onlySelectedBtn,
    recommendSelectedBtn,
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
    const action = String(l?.action || "").trim();
    const poolKey = normalizeKey(String(l?.poolKey || ""));
    const attrs = action
      ? ` data-status-action="${escapeHtml(action)}"${poolKey ? ` data-status-pool-key="${escapeHtml(poolKey)}"` : ""}`
      : "";
    const rowClass = action ? "status__row status__row--link" : "status__row";
    return `
      <div class="${rowClass}"${attrs}>
        <span class="status__label">${escapeHtml(l.label)}</span>
        <span class="status__time">${escapeHtml(l.time)}</span>
      </div>
    `;
  }).join("");
  statusEl.style.display = (lines && lines.length) ? "" : "none";
}

function openDescentPoolStatusPopup(anchorEl, poolKeyHint = "") {
  if (!anchorEl) return;
  const nowMs = Date.now();
  let descent = getActiveDescentPoolStatus(nowMs);
  if (!descent && poolKeyHint) {
    // Fallback: try matching current entries by key if timing lookup failed.
    const key = normalizeKey(poolKeyHint);
    const entries = Array.isArray(descentPoolState?.entries) ? descentPoolState.entries : [];
    const hit = entries.find((e) => Array.isArray(e?.poolKeys) && e.poolKeys.some((k) => normalizeKey(k) === key));
    if (hit) {
      const pools = Array.isArray(hit.pools) ? hit.pools.filter(Boolean) : [];
      const poolText = pools.map((x) => trText(x)).join(", ");
      descent = {
        poolText: poolText || "---",
        expireRemainMs: 0,
        cycleStartJst: String(hit.cycleJst || ""),
        cycleEndJst: ""
      };
    }
  }
  if (!descent) {
    openFloatingInfoCard(anchorEl, ui("descentPool"), ui("noData"), "brand");
    return;
  }
  const remainText = `${ui("remainPrefix")} ${formatRemaining(descent.expireRemainMs || 0)}`;
  const talents = Array.isArray(descent.talents) ? descent.talents : [];
  if (!talents.length) {
    const body = `${descent.poolText}\n${remainText}`;
    openFloatingInfoCard(anchorEl, ui("descentPool"), body, "brand");
    return;
  }
  const groupOrder = ["exotic", "offensive", "defensive", "utility"];
  const groupRank = (group) => {
    const g = normalizeKey(group || "");
    const idx = groupOrder.indexOf(g);
    return idx >= 0 ? idx : 99;
  };
  const lang = (langSelect && langSelect.value) ? langSelect.value : "en";
  const talentsSorted = talents.slice().sort((a, b) => {
    const ga = groupRank(a?.talent_group);
    const gb = groupRank(b?.talent_group);
    if (ga !== gb) return ga - gb;
    const anRaw = String(a?.name || a?.talent_name || a?.talent_key || "");
    const bnRaw = String(b?.name || b?.talent_name || b?.talent_key || "");
    const an = trText(anRaw);
    const bn = trText(bnRaw);
    return String(an).localeCompare(String(bn), lang === "ja" ? "ja" : "en");
  });
  const rarityClassByGroup = (group) => {
    const g = normalizeKey(group || "");
    if (g === "exotic") return "rarity-exotic";
    if (g === "offensive") return "rarity-offensive";
    if (g === "defensive") return "rarity-defensive";
    if (g === "utility") return "rarity-utility";
    return "rarity-highend";
  };
  const groupLabel = (group) => {
    const g = normalizeKey(group || "");
    if (g === "exotic") return "Exotic";
    if (g === "offensive") return "Offensive";
    if (g === "defensive") return "Defensive";
    if (g === "utility") return "Utility";
    return "Other";
  };
  const byGroup = new Map();
  groupOrder.forEach((g) => byGroup.set(g, []));
  talentsSorted.forEach((t) => {
    const g = normalizeKey(String(t?.talent_group || ""));
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g).push(t);
  });
  const sections = [];
  groupOrder.forEach((g) => {
    const list = byGroup.get(g) || [];
    if (!list.length) return;
    const tiles = list.map((t) => {
      const key = normalizeKey(String(t?.talent_key || t?.name || ""));
      const name = String(t?.name || t?.talent_name || key || "").trim();
      const rarityClass = rarityClassByGroup(g);
      const iconSrc = iconUrl("talents", key, "img/talents")
        || iconUrl("weapon_talents", key, "img/weapon_talents");
      const bgStyle = iconSrc ? ` style="background-image:url('${escapeHtml(iconSrc)}')"` : "";
      const disp = (langSelect.value === "ja") ? (i18n[key] ?? name) : name;
      return `
        <article class="card ${rarityClass} descent-pool-tile" title="${escapeHtml(disp || name || key)}">
          <div class="descent-pool-tile__bg"${bgStyle}></div>
          <div class="descent-pool-tile__head"><div class="descent-pool-tile__name">${escapeHtml(disp || name || key)}</div></div>
        </article>
      `;
    }).join("");
    sections.push(`
      <section class="descent-pool-section">
        <div class="descent-pool-section__title">${escapeHtml(groupLabel(g))}</div>
        <div class="descent-pool-grid">${tiles}</div>
      </section>
    `);
  });
  const bodyHtml = `
    <div class="descent-pool-popup">
      <div class="descent-pool-popup__meta">${escapeHtml(descent.poolText)} / ${escapeHtml(remainText)}</div>
      ${sections.join("")}
    </div>
  `;
  openFloatingInfoCardRich(anchorEl, ui("descentPool"), bodyHtml, "brand", "floating-info-card--descent-pool");
}

function saveLangSetting() {
  if (!langSelect) return;
  try {
    localStorage.setItem(LANG_STORAGE_KEY, langSelect.value || "en");
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
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    setVendorDateValue(date);
  }

  // view=vendor|weapons|brand|gearset|exotic_gear|gear_talent|weapon_talent|item_sources|trello|patches (accept typo: vendo)
  const view = getUrlParam("view").toLowerCase();
  if (view === "vendor" || view === "vendo") initialViewMode = "vendor";
  else if (view === "weapons" || view === "weapon") initialViewMode = "weapons";
  else if (view === "brand" || view === "brands") initialViewMode = "brand";
  else if (view === "gearset" || view === "gearsets") initialViewMode = "gearset";
  else if (view === "exotic_gear" || view === "exoticgear") initialViewMode = "exotic_gear";
  else if (view === "gear_talent" || view === "geartalent") initialViewMode = "gear_talent";
  else if (view === "weapon_talent" || view === "weapontalent") initialViewMode = "weapon_talent";
  else if (view === "descent_talent" || view === "descenttalent") initialViewMode = "descent_talent";
  else if (view === "item_sources" || view === "itemsources") initialViewMode = "item_sources";
  else if (view === "trello") initialViewMode = "trello";
  else if (view === "patches") initialViewMode = "patches";

  // descent_pool=<pool_key>
  const descentPool = normalizeKey(getUrlParam("descent_pool"));
  window.descentTalentInitialPoolKey = descentPool || "";

  // trello_group=name|planned
  const trelloGroup = getUrlParam("trello_group").toLowerCase();
  if (trelloGroup === "planned") window.trelloGroupBy = "planned";
  else if (trelloGroup === "name") window.trelloGroupBy = "name";
}

function replaceUrlParams(patch) {
  try {
    const u = new URL(window.location.href);
    const params = u.searchParams;
    Object.entries(patch || {}).forEach(([k, v]) => {
      if (v == null || v === "") params.delete(k);
      else params.set(k, String(v));
    });
    const qs = params.toString();
    const next = `${u.pathname}${qs ? "?" + qs : ""}${u.hash || ""}`;
    history.replaceState(null, "", next);
  } catch (e) {
    // ignore URL rewrite errors
  }
}

function updateModeUi() {
  const isVendorView = currentViewMode === "vendor";
  if (isVendorView) {
    ensureVendorToolbarMounted();
  } else {
    requestToolbarSync();
  }
  let nextTitle = "Division 2 Vendor";
  if (titleEl) {
    if (currentViewMode === "brand") {
      nextTitle = "Division 2 Brandset";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "weapons") {
      nextTitle = "Division 2 Weapons";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "gearset") {
      nextTitle = "Division 2 Gearset";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "exotic_gear") {
      nextTitle = "Division 2 Exotic Items";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "gear_talent") {
      nextTitle = "Division 2 Gear Talent";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "weapon_talent") {
      nextTitle = "Division 2 Weapon Talent";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "descent_talent") {
      nextTitle = "Division 2 Descent Talent";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "item_sources") {
      nextTitle = "Division 2 Item Sources";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "trello") {
      nextTitle = "Division 2 Trello";
      titleEl.textContent = nextTitle;
    } else if (currentViewMode === "patches") {
      nextTitle = "Division 2 Patches";
      titleEl.textContent = nextTitle;
    } else {
      nextTitle = "Division 2 Vendor";
      titleEl.textContent = nextTitle;
    }
  }
  document.title = nextTitle;
  if (vendorToolbarHostEl && isVendorView) vendorToolbarHostEl.style.display = "";
  if (!isVendorView && filtersOpen) {
    setFiltersOpen(false);
  }
}

function refreshDescButtons() {
  document.querySelectorAll(".trello-desc-btn[data-toggle-desc]").forEach((btn) => {
    btn.classList.toggle("is-on", !!window.trelloExpandAll);
  });
}

function refreshTalentDescButtons() {
  document.querySelectorAll(".talent-desc-btn[data-toggle-talent-desc]").forEach((btn) => {
    btn.classList.toggle("is-on", !!window.talentShowDesc);
  });
}

function toggleCardDesc(cardEl) {
  if (!cardEl) return;
  if (String(cardEl.getAttribute("data-desc-collapsible") || "") !== "1") return;
  const isOpen = cardEl.classList.contains("is-desc-open");
  cardEl.classList.toggle("is-desc-open", !isOpen);
  cardEl.setAttribute("data-desc-open", (!isOpen) ? "1" : "0");
}

function syncDescToggleStateFromDom() {
  if (!(currentViewMode === "trello" || currentViewMode === "patches")) return;
  const panels = Array.from(contentEl.querySelectorAll(".trello-card__detail"));
  if (panels.length === 0) {
    window.trelloExpandAll = false;
    refreshDescButtons();
    return;
  }
  window.trelloExpandAll = panels.every((p) => p.getAttribute("aria-hidden") === "false");
  refreshDescButtons();
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
    recommendSelected: "おすすめ選択",
    clearSelected: "選択解除",
    selectGroup: "選択",
    filterGroup: "フィルタ",
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
    dataUnavailable: "表示データが未準備です。",
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
    remainPrefix: "残り",
    descentPool: "ディセントタレントプール",
    descentPoolContribute: "クリックして協力",
    descentExpires: "ディセント有効期限",
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
    recommendSelected: "Recommend",
    clearSelected: "Clear selection",
    selectGroup: "Select",
    filterGroup: "Filter",
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
    dataUnavailable: "Display data is not ready.",
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
    remainPrefix: "Remain",
    descentPool: "Descent Talent Pool",
    descentPoolContribute: "Click to contribute",
    descentExpires: "Descent Expires In",
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
  const lang = (langSelect && langSelect.value) ? langSelect.value : "en";
  return (UI[lang] && UI[lang][key]) || UI.en[key] || key;
}

function applyUiLang() {
  const lang = (langSelect && langSelect.value) ? langSelect.value : "en";
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
  if (optJa) optJa.textContent = "JA";
  if (optEn) optEn.textContent = "EN";

  const optAnd = modeSelect?.querySelector('option[value="and"]');
  const optOr = modeSelect?.querySelector('option[value="or"]');
  if (optAnd) optAnd.textContent = ui("and");
  if (optOr) optOr.textContent = ui("or");

  // buttons
  if (onlySelectedBtn) onlySelectedBtn.textContent = ui("selectedOnly");
  if (recommendSelectedBtn) recommendSelectedBtn.textContent = ui("recommendSelected");
  if (clearSelectedBtn) clearSelectedBtn.textContent = ui("clearSelected");
  if (clearFiltersBtn) clearFiltersBtn.textContent = ui("clearFilters");
  const selectGroupLabelEl = document.getElementById("selectGroupLabel");
  const filterGroupLabelEl = document.getElementById("filterGroupLabel");
  if (selectGroupLabelEl) selectGroupLabelEl.textContent = ui("selectGroup");
  if (filterGroupLabelEl) filterGroupLabelEl.textContent = ui("filterGroup");
  if (navExoticGearBtn) navExoticGearBtn.textContent = "Exotic Items";

  if (isWorldTimePopupOpen) updateWorldTime();
  renderChips(); // label changes
  updateDescentPoolSummary(Date.now());
  updateScheduleStatus(new Date());
  refreshTalentDescButtons();
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
  "castle",
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
    // Align with image_create rule:
    // inject static caches only when the vendor has at least one non-cache item in this week.
    const hasNonCacheItem = arr.some(it => it && it.category !== "cache");
    if (!hasNonCacheItem) continue;

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
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function formatDisplayNumber(v) {
  if (v == null || v === "") return "";
  const s0 = String(v).trim();
  if (!s0) return "";
  if (!/^[-+]?\d+(?:\.\d+)?$/.test(s0)) return s0;
  // "20.0" -> "20"
  return s0.replace(/\.0+$/, "");
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

function parseJsonArrayText(text) {
  const s = String(text || "").trim();
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

function parseJsonObjectArrayText(text) {
  const arr = parseJsonArrayText(text);
  return arr.filter((x) => x && typeof x === "object");
}

function parseJsonObjectText(text) {
  const s = String(text || "").trim();
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch (e) {
    // ignore
  }
  return {};
}

function gearSlotKey(itemType) {
  const k = normalizeKey(itemType || "");
  if (k === "knee" || k === "knees" || k === "kneepad") return "kneepads";
  return k;
}

function brandJoinCandidates(...rawValues) {
  const out = new Set();
  const suffixes = new Set([
    "co", "company", "corp", "corporation",
    "ltd", "limited", "gmbh", "group", "inc", "llc",
    "industries", "industry", "defense", "defence", "sa"
  ]);
  for (const raw of rawValues) {
    const s = String(raw || "").trim();
    if (!s) continue;
    const n1 = normalizeKey(s);
    if (n1) out.add(n1);
    const words = s
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!words.length) continue;
    out.add(words.join(""));
    const trimmed = words.slice();
    while (trimmed.length && suffixes.has(trimmed[trimmed.length - 1])) trimmed.pop();
    if (trimmed.length) out.add(trimmed.join(""));
  }
  return Array.from(out);
}

function trText(text) {
  const cleaned = stripHtml(text ?? "");
  if (langSelect.value !== "ja") return cleaned;
  const key = normalizeKey(cleaned);
  return i18n[key] ?? cleaned;
}

function trCategoryText(category, key, fallbackText = "") {
  const cleaned = String(fallbackText ?? "").replace(/\r/g, "");
  if (langSelect.value !== "ja") return cleaned;
  const cat = (i18nCategories && typeof i18nCategories === "object")
    ? i18nCategories[category]
    : null;
  if (!cat || typeof cat !== "object") return cleaned;

  const seed = normalizeKey(key || "");
  if (!seed) return cleaned;

  const cands = [];
  const seen = new Set();
  const add = (k) => {
    const kk = normalizeKey(k || "");
    if (!kk || seen.has(kk)) return;
    seen.add(kk);
    cands.push(kk);
  };
  add(seed);
  if (i18nAliases && i18nAliases[seed]) add(i18nAliases[seed]);
  if (typeof talentKeyVariants === "function") {
    for (const v of talentKeyVariants(seed)) add(v);
  }
  for (const k of cands) {
    if (Object.prototype.hasOwnProperty.call(cat, k)) {
      return String(cat[k] ?? "").replace(/\r/g, "");
    }
  }
  return cleaned;
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function ensureFloatingInfoCard() {
  if (floatingInfoCardEl && floatingInfoCardTitleEl && floatingInfoCardBodyEl) return;
  const backdrop = document.createElement("div");
  backdrop.className = "floating-info-backdrop";
  backdrop.setAttribute("aria-hidden", "true");
  backdrop.addEventListener("click", () => closeFloatingInfoCard());
  document.body.appendChild(backdrop);
  floatingInfoBackdropEl = backdrop;
  const el = document.createElement("div");
  el.className = "floating-info-card";
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `
    <div class="floating-info-card__title"></div>
    <div class="floating-info-card__body"></div>
  `;
  document.body.appendChild(el);
  floatingInfoCardEl = el;
  floatingInfoCardTitleEl = el.querySelector(".floating-info-card__title");
  floatingInfoCardBodyEl = el.querySelector(".floating-info-card__body");
}

function isFloatingInfoCardOpen() {
  return !!(floatingInfoCardEl && floatingInfoCardEl.getAttribute("aria-hidden") === "false");
}

function closeFloatingInfoCard() {
  if (!floatingInfoCardEl) return;
  floatingInfoCardEl.setAttribute("aria-hidden", "true");
  if (floatingInfoBackdropEl) floatingInfoBackdropEl.setAttribute("aria-hidden", "true");
  floatingInfoCardAnchorEl = null;
}

function setFloatingBackdropVisible(visible) {
  if (!floatingInfoBackdropEl) return;
  floatingInfoBackdropEl.setAttribute("aria-hidden", visible ? "false" : "true");
}

function positionFloatingInfoCard(anchorEl) {
  if (!floatingInfoCardEl || !anchorEl) return;
  const gap = 8;
  const pad = 8;
  const rect = anchorEl.getBoundingClientRect();
  const panelRect = floatingInfoCardEl.getBoundingClientRect();
  const vw = window.innerWidth || document.documentElement.clientWidth || 0;
  const vh = window.innerHeight || document.documentElement.clientHeight || 0;
  let left = rect.left + (rect.width / 2) - (panelRect.width / 2);
  left = Math.max(pad, Math.min(left, Math.max(pad, vw - panelRect.width - pad)));
  let top = rect.bottom + gap;
  if (top + panelRect.height + pad > vh) {
    top = rect.top - panelRect.height - gap;
  }
  if (top < pad) top = pad;
  floatingInfoCardEl.style.left = `${Math.round(left)}px`;
  floatingInfoCardEl.style.top = `${Math.round(top)}px`;
}

const FLOATING_INFO_KIND_CLASSES = [
  "floating-info-card--brand",
  "floating-info-card--talent",
  "floating-info-card--talent-named",
  "floating-info-card--gear-highend",
  "floating-info-card--gear-named",
  "floating-info-card--gearset",
  "floating-info-card--descent-pool",
  "floating-info-card--brand-core-weapon",
  "floating-info-card--brand-core-armor",
  "floating-info-card--brand-core-skill",
  "floating-info-card--brand-core-other"
];

function resetFloatingInfoCardClasses() {
  if (!floatingInfoCardEl) return;
  floatingInfoCardEl.classList.remove(...FLOATING_INFO_KIND_CLASSES);
}

function applyFloatingInfoCardKind(kind, extraClass = "") {
  if (!floatingInfoCardEl) return;
  if (kind === "talent") floatingInfoCardEl.classList.add("floating-info-card--talent");
  else if (kind === "talent-named") floatingInfoCardEl.classList.add("floating-info-card--talent-named");
  else if (kind === "gear-highend") floatingInfoCardEl.classList.add("floating-info-card--gear-highend");
  else if (kind === "gear-named") floatingInfoCardEl.classList.add("floating-info-card--gear-named");
  else if (kind === "gearset") floatingInfoCardEl.classList.add("floating-info-card--gearset");
  else if (kind === "brand") floatingInfoCardEl.classList.add("floating-info-card--brand");
  if (extraClass) floatingInfoCardEl.classList.add(extraClass);
}

function showFloatingInfoCard(anchorEl, {
  kind = "",
  title = "",
  bodyText = "",
  bodyHtml = "",
  rich = false,
  extraClass = ""
} = {}) {
  ensureFloatingInfoCard();
  if (!floatingInfoCardEl || !floatingInfoCardTitleEl || !floatingInfoCardBodyEl || !anchorEl) return;
  resetFloatingInfoCardClasses();
  applyFloatingInfoCardKind(kind, extraClass);
  if (rich) {
    floatingInfoCardEl.classList.add("floating-info-card--cardhost");
    const titleText = String(title || "").trim();
    if (titleText) {
      floatingInfoCardTitleEl.textContent = titleText;
      floatingInfoCardTitleEl.style.display = "";
    } else {
      floatingInfoCardTitleEl.textContent = "";
      floatingInfoCardTitleEl.style.display = "none";
    }
    floatingInfoCardBodyEl.classList.add("floating-info-card__body--rich");
    floatingInfoCardBodyEl.innerHTML = String(bodyHtml || "").trim() || `<div>${escapeHtml(ui("noData"))}</div>`;
  } else {
    floatingInfoCardEl.classList.remove("floating-info-card--cardhost");
    floatingInfoCardTitleEl.textContent = String(title || "").trim();
    floatingInfoCardTitleEl.style.display = "";
    floatingInfoCardBodyEl.classList.remove("floating-info-card__body--rich");
    floatingInfoCardBodyEl.textContent = String(bodyText || "").replace(/\r/g, "").trim() || ui("noData");
  }
  setFloatingBackdropVisible(true);
  floatingInfoCardEl.setAttribute("aria-hidden", "false");
  floatingInfoCardAnchorEl = anchorEl;
  positionFloatingInfoCard(anchorEl);
}

function openFloatingInfoCard(anchorEl, title, body, kind = "") {
  showFloatingInfoCard(anchorEl, { kind, title, bodyText: body, rich: false });
}

function openFloatingInfoCardRich(anchorEl, title, bodyHtml, kind = "", extraClass = "") {
  showFloatingInfoCard(anchorEl, { kind, title, bodyHtml, rich: true, extraClass });
}

function resolveCategoryTextRaw(category, key) {
  const cat = (i18nCategories && typeof i18nCategories === "object")
    ? i18nCategories[category]
    : null;
  if (!cat || typeof cat !== "object") return "";

  const seed = normalizeKey(key || "");
  if (!seed) return "";

  const cands = [];
  const seen = new Set();
  const add = (k) => {
    const kk = normalizeKey(k || "");
    if (!kk || seen.has(kk)) return;
    seen.add(kk);
    cands.push(kk);
  };
  add(seed);
  if (i18nAliases && i18nAliases[seed]) add(i18nAliases[seed]);
  if (typeof talentKeyVariants === "function") {
    for (const v of talentKeyVariants(seed)) add(v);
  }

  for (const k of cands) {
    if (Object.prototype.hasOwnProperty.call(cat, k)) {
      return String(cat[k] ?? "").replace(/\r/g, "").trim();
    }
  }
  return "";
}

function getTalentDescFromLookup(lookup, itemCategory, talentKey) {
  if (!lookup) return "";
  const cat = normalizeKey(itemCategory || "");
  const map = (cat === "weapon") ? lookup.weapon : lookup.gear;
  if (!map || !(map instanceof Map)) return "";
  const keys = expandTalentKeysForLookup(talentKey || "");
  for (const k of keys) {
    const hit = map.get(k);
    if (hit) return String(hit).replace(/\r/g, "").trim();
  }
  return "";
}

function resolveTalentDescription(itemCategory, talentKey, fallbackText = "", lookup = null, talentNameHint = "") {
  const cat = normalizeKey(itemCategory || "");
  const key = normalizeKey(talentKey || "");
  const hintKey = normalizeKey(talentNameHint || "");
  const fallbackRaw = String(fallbackText || "").replace(/\r/g, "").trim();
  const lookupDesc = getTalentDescFromLookup(lookup, itemCategory, key);
  const fallback = fallbackRaw || lookupDesc || "";
  const probeKey = key || hintKey;
  if (!probeKey) return fallback;
  if (langSelect.value !== "ja") return fallback;
  const catNames = (cat === "weapon")
    ? ["weapon_talent_desc", "exotic_weapon_talent_desc"]
    : ["gear_talent_desc", "exotic_gear_talent_desc", "gearset_talent_desc"];
  for (const cn of catNames) {
    const txt = trCategoryText(cn, probeKey, "");
    if (txt) return txt;
  }
  return fallback;
}

async function ensureTalentDescLookupCache() {
  if (talentDescLookupCache) return talentDescLookupCache;
  if (talentDescLookupPromise) return talentDescLookupPromise;
  talentDescLookupPromise = (async () => {
    const out = { gear: new Map(), weapon: new Map() };
    const put = (map, keyRaw, descRaw) => {
      const desc = String(descRaw || "").replace(/\r/g, "").trim();
      if (!desc) return;
      const keys = expandTalentKeysForLookup(keyRaw || "");
      if (!keys.length) return;
      for (const k of keys) {
        if (!map.has(k)) map.set(k, desc);
      }
    };
    const parseTitleDescFromRaw = (rawText) => {
      const raw = String(rawText || "").replace(/\r/g, "");
      if (!raw.trim()) return { title: "", desc: "" };
      const lines = raw.split("\n").map((x) => String(x || "").trim());
      const nonEmpty = lines.filter(Boolean);
      if (!nonEmpty.length) return { title: "", desc: "" };
      const title = nonEmpty[0];
      const desc = nonEmpty.slice(1).join("\n").trim();
      return { title, desc };
    };
    const sql = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new sql.Database(dbBytes);
    try {
      const hasTable = (name) => db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${name}'`).length > 0;
      if (hasTable("items_weapon_talents")) {
        const st = db.prepare(`
          SELECT talent, talent_desc, perfect_talent, perfect_talent_desc
          FROM items_weapon_talents
        `);
        while (st.step()) {
          const r = st.getAsObject();
          put(out.weapon, r.talent, r.talent_desc);
          put(out.weapon, r.perfect_talent, r.perfect_talent_desc);
        }
        st.free();
      }
      if (hasTable("items_gear_talents")) {
        const st = db.prepare(`
          SELECT talent, talent_desc, perfect_talent, perfect_talent_desc
          FROM items_gear_talents
        `);
        while (st.step()) {
          const r = st.getAsObject();
          put(out.gear, r.talent, r.talent_desc);
          put(out.gear, r.perfect_talent, r.perfect_talent_desc);
        }
        st.free();
      }
      if (hasTable("items_gearset_bonuses")) {
        const st = db.prepare(`
          SELECT talent_name, talent_desc
          FROM items_gearset_bonuses
          WHERE trim(talent_name) <> '' OR trim(talent_desc) <> ''
        `);
        while (st.step()) {
          const r = st.getAsObject();
          const tName = String(r.talent_name || "").trim();
          const tDesc = String(r.talent_desc || "").replace(/\r/g, "").trim();
          if (tName && tDesc) put(out.gear, tName, tDesc);
        }
        st.free();
      }
      if (hasTable("items_gearsets")) {
        const st = db.prepare(`
          SELECT backpack_talent, backpack_talent_raw, chest_talent, chest_talent_raw
          FROM items_gearsets
        `);
        while (st.step()) {
          const r = st.getAsObject();
          const bp = parseTitleDescFromRaw(r.backpack_talent_raw || "");
          const ch = parseTitleDescFromRaw(r.chest_talent_raw || "");
          const bpName = bp.title || String(r.backpack_talent || "").trim();
          const chName = ch.title || String(r.chest_talent || "").trim();
          const bpDesc = bp.desc;
          const chDesc = ch.desc;
          if (bpName && bpDesc) put(out.gear, bpName, bpDesc);
          if (chName && chDesc) put(out.gear, chName, chDesc);
        }
        st.free();
      }
      const collectNamedExotic = (table, map) => {
        if (!hasTable(table)) return;
        const st = db.prepare(`
          SELECT talent, talent_key, talent_desc
          FROM ${table}
          WHERE trim(talent) <> '' OR trim(talent_key) <> ''
        `);
        while (st.step()) {
          const r = st.getAsObject();
          put(map, r.talent_key || r.talent, r.talent_desc);
        }
        st.free();
      };
      collectNamedExotic("items_weapon_named", out.weapon);
      collectNamedExotic("items_weapon_exotic", out.weapon);
      collectNamedExotic("items_gear_named", out.gear);
      collectNamedExotic("items_gear_exotic", out.gear);
      talentDescLookupCache = out;
      return out;
    } finally {
      db.close();
    }
  })();
  try {
    return await talentDescLookupPromise;
  } finally {
    talentDescLookupPromise = null;
  }
}

async function ensureBrandDescCache() {
  if (brandDescCache) return brandDescCache;
  if (brandDescPromise) return brandDescPromise;
  brandDescPromise = (async () => {
    const out = new Map();
    const sql = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new sql.Database(dbBytes);
    try {
      const hasBrandsets = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_brandsets'").length > 0;
      const hasGearsets = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gearsets'").length > 0;
      const hasBonuses = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_brandset_bonuses'").length > 0;
      if ((!hasBrandsets && !hasGearsets) || !hasBonuses) {
        brandDescCache = out;
        return out;
      }
      const ingest = (tableName, keyCol, nameCol) => {
        const st = db.prepare(`
          SELECT
            t.${keyCol} AS set_key,
            t.${nameCol} AS set_name,
            t.core_attribute,
            bo.slot,
            bo.value,
            bo.type,
            bo.type_key,
            bo.value_num,
            bo.unit
          FROM ${tableName} t
          LEFT JOIN items_brandset_bonuses bo ON bo.parent_item_id = t.item_id
          ORDER BY t.${nameCol}, t.item_id, bo.bonus_ord, bo.bonus_part_ord
        `);
        while (st.step()) {
          const row = st.getAsObject();
          const brandKey = normalizeKey(String(row.set_key || row.set_name || ""));
          if (!brandKey) continue;
          if (!out.has(brandKey)) {
            out.set(brandKey, {
              core: String(row.core_attribute || "").trim(),
              bonuses: []
            });
          }
          if (row.slot != null && String(row.slot).trim() !== "") {
            out.get(brandKey).bonuses.push({
              slot: String(row.slot || "").trim(),
              value: String(row.value || "").trim(),
              type: String(row.type || "").trim(),
              typeKey: String(row.type_key || "").trim(),
              valueNum: String(row.value_num || "").trim(),
              unit: String(row.unit || "").trim()
            });
          }
        }
        st.free();
      };
      if (hasBrandsets) ingest("items_brandsets", "brandset_key", "brandset");
      if (hasGearsets) ingest("items_gearsets", "gearset_key", "gearset");
      brandDescCache = out;
      return out;
    } finally {
      db.close();
    }
  })();
  try {
    return await brandDescPromise;
  } finally {
    brandDescPromise = null;
  }
}

function formatBrandDescription(info) {
  if (!info || typeof info !== "object") return "";
  const lines = [];
  const coreText = String(info.core || "").trim();
  if (coreText) lines.push(`${trText(coreText)}`);
  const bonuses = Array.isArray(info.bonuses) ? info.bonuses.slice() : [];
  bonuses.sort((a, b) => Number(a.slot || 999) - Number(b.slot || 999));
  bonuses.forEach((b) => {
    const numOnly = formatDisplayNumber(b.valueNum || "");
    const numUnit = `${numOnly}${b.unit || ""}`.trim();
    const typeText = trText(b.type || b.typeKey || "");
    const valueText = (numUnit || stripHtml(b.value || "")).trim();
    const body = [valueText, typeText].filter(Boolean).join(" ").trim();
    if (!body) return;
    lines.push(body);
  });
  return lines.join("\n");
}

function brandPopupCoreClass(coreText) {
  const k = normalizeKey(coreText || "");
  if (k === "weapondamage") return "brand-core-weapon";
  if (k === "armor") return "brand-core-armor";
  if (k === "skilltier") return "brand-core-skill";
  return "brand-core-other";
}

function buildBrandPopupCardHtml(info, brandName, brandKey) {
  const title = String(brandName || brandKey || "").trim();
  const core = String(info?.core || "").trim();
  const bonuses = Array.isArray(info?.bonuses) ? info.bonuses.slice() : [];
  bonuses.sort((a, b) => Number(a.slot || 999) - Number(b.slot || 999));
  const lines = [];
  if (core) lines.push(trText(core));
  bonuses.forEach((b) => {
    const numOnly = formatDisplayNumber(b.valueNum || "");
    const numUnit = `${numOnly}${b.unit || ""}`.trim();
    const typeText = trText(b.type || b.typeKey || "");
    const valueText = (numUnit || stripHtml(b.value || "")).trim();
    const text = [valueText, typeText].filter(Boolean).join(" ").trim();
    if (text) lines.push(text);
  });
  const brandKeyNorm = normalizeKey(brandKey || title);
  const brandIconPrimary = iconUrl("brands", brandKeyNorm, "img/brands");
  const brandIconAlt = iconUrl("brands", normalizeKey(title), "img/brands");
  const brandIconFallbacks = [];
  if (brandIconAlt && brandIconAlt !== brandIconPrimary) brandIconFallbacks.push(brandIconAlt);
  const brandBgHtml = brandIconPrimary
    ? bgIconHtml(brandIconPrimary, "card__bg--tr", "brand", brandIconFallbacks)
    : "";
  const coreClass = brandPopupCoreClass(core);
  const linesHtml = lines.length
    ? lines.map((ln, idx) => `<div class="line ${idx === 0 ? "line--core" : "line--gray"}"><div class="line__body"><div class="line__text">${escapeHtml(ln)}</div></div></div>`).join("")
    : `<div class="line line--gray"><div class="line__body"><div class="line__text">${escapeHtml(ui("noData"))}</div></div></div>`;

  return `
    <div class="card rarity-highend ${escapeHtml(coreClass)}">
      ${brandBgHtml}
      <div class="card__head">
        <div class="card__title-wrap card__title-wrap--gear">
          <div class="card__titles">
            <div class="card__title"><span class="card__title-text">${escapeHtml(title)}</span></div>
          </div>
        </div>
      </div>
      <div class="lines">${linesHtml}</div>
    </div>
  `;
}

async function ensureGearsetPopupCache() {
  if (gearsetPopupCache) return gearsetPopupCache;
  if (gearsetPopupPromise) return gearsetPopupPromise;
  gearsetPopupPromise = (async () => {
    const out = new Map();
    const sql = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new sql.Database(dbBytes);
    try {
      const hasGearsets = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gearsets'").length > 0;
      const hasBonuses = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gearset_bonuses'").length > 0;
      if (!hasGearsets || !hasBonuses) {
        gearsetPopupCache = out;
        return out;
      }
      const st = db.prepare(`
        SELECT
          g.item_id,
          g.gearset_key,
          g.gearset,
          g.core_attribute,
          g.backpack_talent,
          g.backpack_talent_raw,
          g.chest_talent,
          g.chest_talent_raw,
          bo.slot,
          bo.label,
          bo.bonus_type,
          bo.value,
          bo.value_num,
          bo.unit,
          bo.type,
          bo.type_key,
          bo.talent_name,
          bo.talent_desc,
          bo.value_raw
        FROM items_gearsets g
        LEFT JOIN items_gearset_bonuses bo ON bo.parent_item_id = g.item_id
        ORDER BY g.gearset, g.item_id, bo.bonus_ord, bo.bonus_part_ord
      `);
      while (st.step()) {
        const r = st.getAsObject();
        const key = normalizeKey(String(r.gearset_key || r.gearset || ""));
        if (!key) continue;
        if (!out.has(key)) {
          out.set(key, {
            itemId: String(r.item_id || "").trim(),
            gearsetKey: String(r.gearset_key || "").trim(),
            gearset: String(r.gearset || "").trim(),
            core: String(r.core_attribute || "").trim(),
            backpackTalent: String(r.backpack_talent || "").trim(),
            backpackTalentRaw: String(r.backpack_talent_raw || "").trim(),
            chestTalent: String(r.chest_talent || "").trim(),
            chestTalentRaw: String(r.chest_talent_raw || "").trim(),
            bonuses: []
          });
        }
        if (r.slot != null && String(r.slot).trim() !== "") {
          out.get(key).bonuses.push({
            slot: String(r.slot || "").trim(),
            label: String(r.label || "").trim(),
            bonusType: String(r.bonus_type || "").trim(),
            value: String(r.value || "").trim(),
            valueNum: String(r.value_num || "").trim(),
            unit: String(r.unit || "").trim(),
            type: String(r.type || "").trim(),
            typeKey: String(r.type_key || "").trim(),
            talentName: String(r.talent_name || "").trim(),
            talentDesc: String(r.talent_desc || "").trim(),
            valueRaw: String(r.value_raw || "").trim()
          });
        }
      }
      st.free();
      gearsetPopupCache = out;
      return out;
    } finally {
      db.close();
    }
  })();
  try {
    return await gearsetPopupPromise;
  } finally {
    gearsetPopupPromise = null;
  }
}

function gearsetPopupCoreClass(coreText) {
  const k = normalizeKey(coreText || "");
  if (k === "weapondamage") return "gearset-core-weapon";
  if (k === "armor") return "gearset-core-armor";
  if (k === "skilltier") return "gearset-core-skill";
  return "gearset-core-other";
}

function parseTalentRawTitleDesc(raw) {
  const s = String(raw || "").replace(/\r/g, "").trim();
  if (!s) return { title: "", desc: "" };
  const parts = s.split("\n").map((x) => String(x || "").trim()).filter(Boolean);
  if (!parts.length) return { title: "", desc: "" };
  return { title: parts[0], desc: parts.slice(1).join("\n").trim() };
}

function buildGearsetPopupCardHtml(it, fallbackTitle = "") {
  if (!it || typeof it !== "object") return `<div class="status">${escapeHtml(ui("noData"))}</div>`;
  const titleRaw = String(it.gearset || fallbackTitle || "").trim();
  const title = (langSelect.value === "ja")
    ? (i18n[it.gearsetKey] ?? i18n[normalizeKey(it.gearsetKey || titleRaw)] ?? titleRaw)
    : titleRaw;
  const coreText = trText(it.core || "");
  const lines = [];
  if (coreText) lines.push({ cls: "line line--core", text: coreText, textHtml: "" });

  const grouped = new Map();
  (it.bonuses || []).forEach((b) => {
    const gk = `${b.slot}|${b.bonusType || ""}|${b.talentName || ""}|${b.talentDesc || ""}`;
    if (!grouped.has(gk)) grouped.set(gk, []);
    grouped.get(gk).push(b);
  });
  function gearPieceIconByLabels(labels) {
    const all = (labels || []).map((x) => normalizeKey(x || "")).join(" ");
    if (all.includes("backpack")) {
      const src = iconUrl("gear_slots", "backpack", "img/gears");
      return src ? iconImgHtml(src, "ico ico--talent", "backpack") : "";
    }
    if (all.includes("chest")) {
      const src = iconUrl("gear_slots", "chest", "img/gears");
      return src ? iconImgHtml(src, "ico ico--talent", "chest") : "";
    }
    return "";
  }

  const keyNorm = normalizeKey(it.gearsetKey || titleRaw);
  const setIconPrimary = iconUrl("brands", it.gearsetKey || keyNorm, "img/brands");
  const setIconAlt = iconUrl("brands", keyNorm, "img/brands");
  const setFallbacks = [];
  if (setIconAlt && setIconAlt !== setIconPrimary) setFallbacks.push(setIconAlt);
  const setBgHtml = setIconPrimary ? bgIconHtml(setIconPrimary, "card__bg--tr", "gearset", setFallbacks) : "";

  for (const gs of grouped.values()) {
    const b = gs[0] || {};
    if (b.bonusType === "talent" || b.talentName || b.talentDesc) {
      const tn = b.talentName || b.value || "";
      const td = b.talentDesc || "";
      const labelList = gs.map((x) => String(x.label || "").trim()).filter(Boolean);
      const labelNorm = labelList.map((x) => normalizeKey(x)).join(" ");
      const slotNum = Number.parseInt(String(b.slot || "0"), 10) || 0;
      const isFourPc = slotNum >= 4 || labelNorm.includes("4pc") || labelNorm.includes("4piece");
      const pieceIcon = gearPieceIconByLabels(labelList);
      const talentIcon = pieceIcon || (isFourPc && setIconPrimary ? iconImgHtml(setIconPrimary, "ico ico--talent", "gearset", setFallbacks) : "");
      const talentKey = normalizeKey(tn || "");
      const tnDisp = (langSelect.value === "ja")
        ? (i18n[talentKey] ?? trText(tn))
        : tn;
      const tdDisp = (langSelect.value === "ja")
        ? trCategoryText("gearset_talent_desc", talentKey, td)
        : td;
      if (tnDisp) lines.push({ cls: "line line--gray line--talent", text: tnDisp.trim(), textHtml: "", icon: talentIcon });
      if (tdDisp) lines.push({ cls: "line line--named-meta line--talent-desc", text: tdDisp, textHtml: escapeHtml(tdDisp).replace(/\r?\n/g, "<br>") });
      continue;
    }
    const parts = [];
    gs.forEach((x) => {
      const typeText = trText(x.type || x.typeKey || "");
      const numUnit = `${formatDisplayNumber(x.valueNum || "")}${x.unit || ""}`.trim();
      const valText = [numUnit, typeText].filter(Boolean).join(" ").trim() || stripHtml(x.value || "");
      if (valText) parts.push(valText);
    });
    if (!parts.length) continue;
    lines.push({ cls: "line line--gray", text: parts.join(" "), textHtml: parts.map((p) => escapeHtml(p)).join("<br>") });
  }

  // fallback talents from gearsets raw columns
  if (!lines.some((x) => x.cls.includes("line--talent"))) {
    const bp = parseTalentRawTitleDesc(it.backpackTalentRaw || "");
    const ch = parseTalentRawTitleDesc(it.chestTalentRaw || "");
    [bp, ch].forEach((t) => {
      if (!t.title) return;
      const tk = normalizeKey(t.title);
      const tnDisp = (langSelect.value === "ja") ? (i18n[tk] ?? trText(t.title)) : t.title;
      const tdDisp = (langSelect.value === "ja") ? trCategoryText("gearset_talent_desc", tk, t.desc) : t.desc;
      lines.push({ cls: "line line--gray line--talent", text: tnDisp, textHtml: "", icon: "" });
      if (tdDisp) lines.push({ cls: "line line--named-meta line--talent-desc", text: tdDisp, textHtml: escapeHtml(tdDisp).replace(/\r?\n/g, "<br>") });
    });
  }
  const coreClass = gearsetPopupCoreClass(it.core);
  const linesHtml = lines.length
    ? lines.map((ln) => `<div class="${ln.cls}">${ln.icon || ""}<div class="line__body"><div class="line__text">${ln.textHtml || escapeHtml(ln.text)}</div></div></div>`).join("")
    : `<div class="line line--gray"><div class="line__body"><div class="line__text">${escapeHtml(ui("noData"))}</div></div></div>`;
  return `
    <div class="card rarity-gearset ${escapeHtml(coreClass)}">
      ${setBgHtml}
      <div class="card__head">
        <div class="card__title-wrap card__title-wrap--gear">
          <div class="card__titles">
            <div class="card__title"><span class="card__title-text">${escapeHtml(title)}</span></div>
          </div>
        </div>
      </div>
      <div class="lines">${linesHtml}</div>
    </div>
  `;
}

function expandTalentKeysForLookup(raw) {
  const seed = normalizeKey(raw || "");
  if (!seed) return [];
  const out = [];
  const seen = new Set();
  const add = (k) => {
    const kk = normalizeKey(k || "");
    if (!kk || seen.has(kk)) return;
    seen.add(kk);
    out.push(kk);
  };
  add(seed);
  const alias = (i18nAliases && i18nAliases[seed]) ? i18nAliases[seed] : "";
  if (alias) add(alias);
  if (typeof talentKeyVariants === "function") {
    for (const v of talentKeyVariants(seed)) add(v);
  }
  return out;
}

async function ensureNamedTalentLookupCache() {
  if (namedTalentLookupCache) return namedTalentLookupCache;
  if (namedTalentLookupPromise) return namedTalentLookupPromise;
  namedTalentLookupPromise = (async () => {
    const out = {
      gearByItemId: new Map(),
      gearByNameKey: new Map(),
      weaponByItemId: new Map(),
      weaponByNameKey: new Map()
    };
    const add = (bucket, key, talentKey) => {
      const k = String(key || "").trim();
      const t = normalizeKey(talentKey || "");
      if (!k || !t) return;
      if (!bucket.has(k)) bucket.set(k, new Set());
      bucket.get(k).add(t);
    };
    const sql = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new sql.Database(dbBytes);
    try {
      const hasGearNamed = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gear_named'").length > 0;
      if (hasGearNamed) {
        const st = db.prepare(`
          SELECT item_id, name_key, talent, talent_key
          FROM items_gear_named
          WHERE trim(talent) <> '' OR trim(talent_key) <> ''
        `);
        while (st.step()) {
          const r = st.getAsObject();
          const itemId = String(r.item_id || "").trim();
          const nameKey = normalizeKey(String(r.name_key || ""));
          const keys = expandTalentKeysForLookup(r.talent_key || r.talent || "");
          keys.forEach((tk) => {
            add(out.gearByItemId, itemId, tk);
            add(out.gearByNameKey, nameKey, tk);
          });
        }
        st.free();
      }
      const hasWeaponNamed = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_weapon_named'").length > 0;
      if (hasWeaponNamed) {
        const st = db.prepare(`
          SELECT item_id, name_key, talent, talent_key
          FROM items_weapon_named
          WHERE trim(talent) <> '' OR trim(talent_key) <> ''
        `);
        while (st.step()) {
          const r = st.getAsObject();
          const itemId = String(r.item_id || "").trim();
          const nameKey = normalizeKey(String(r.name_key || ""));
          const keys = expandTalentKeysForLookup(r.talent_key || r.talent || "");
          keys.forEach((tk) => {
            add(out.weaponByItemId, itemId, tk);
            add(out.weaponByNameKey, nameKey, tk);
          });
        }
        st.free();
      }
      namedTalentLookupCache = out;
      return out;
    } finally {
      db.close();
    }
  })();
  try {
    return await namedTalentLookupPromise;
  } finally {
    namedTalentLookupPromise = null;
  }
}

function hasNamedTalentInLookup(lookup, itemCategory, itemId, nameKey, talentKey) {
  if (!lookup || !talentKey) return false;
  const t = normalizeKey(talentKey);
  if (!t) return false;
  const cat = normalizeKey(itemCategory || "");
  const id = String(itemId || "").trim();
  const nk = normalizeKey(nameKey || "");
  const byItem = (cat === "weapon") ? lookup.weaponByItemId : lookup.gearByItemId;
  const byName = (cat === "weapon") ? lookup.weaponByNameKey : lookup.gearByNameKey;
  const hitByItem = !!(id && byItem.has(id) && byItem.get(id).has(t));
  const hitByName = !!(nk && byName.has(nk) && byName.get(nk).has(t));
  return hitByItem || hitByName;
}

async function ensureItemTalentOverrideCache() {
  if (itemTalentOverrideCache) return itemTalentOverrideCache;
  if (itemTalentOverridePromise) return itemTalentOverridePromise;
  itemTalentOverridePromise = (async () => {
    const out = {
      gearByItemId: new Map(),
      gearByNameKey: new Map(),
      weaponByItemId: new Map(),
      weaponByNameKey: new Map()
    };
    const upsert = (bucket, key, talentKey, payload) => {
      const k = String(key || "").trim();
      const tk = normalizeKey(talentKey || "");
      if (!k || !tk) return;
      if (!bucket.has(k)) bucket.set(k, new Map());
      const m = bucket.get(k);
      const prev = m.get(tk);
      if (!prev) {
        m.set(tk, payload);
        return;
      }
      if (!prev.talentDesc && payload.talentDesc) prev.talentDesc = payload.talentDesc;
      if (!prev.talent && payload.talent) prev.talent = payload.talent;
    };
    const ingestRow = (target, row) => {
      const itemId = String(row.item_id || "").trim();
      const nameKey = normalizeKey(String(row.name_key || ""));
      const talent = String(row.talent || "").trim();
      const talentDesc = String(row.talent_desc || "").replace(/\r/g, "").trim();
      const keys = expandTalentKeysForLookup(row.talent_key || row.talent || "");
      keys.forEach((tk) => {
        const payload = { talentKey: tk, talent, talentDesc };
        upsert(target.byItemId, itemId, tk, payload);
        upsert(target.byNameKey, nameKey, tk, payload);
      });
    };

    const sql = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new sql.Database(dbBytes);
    try {
      const collect = (table, target) => {
        const has = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).length > 0;
        if (!has) return;
        const st = db.prepare(`
          SELECT item_id, name_key, talent, talent_key, talent_desc
          FROM ${table}
          WHERE trim(talent) <> '' OR trim(talent_key) <> ''
        `);
        while (st.step()) ingestRow(target, st.getAsObject());
        st.free();
      };
      collect("items_gear_named", { byItemId: out.gearByItemId, byNameKey: out.gearByNameKey });
      collect("items_gear_exotic", { byItemId: out.gearByItemId, byNameKey: out.gearByNameKey });
      collect("items_weapon_named", { byItemId: out.weaponByItemId, byNameKey: out.weaponByNameKey });
      collect("items_weapon_exotic", { byItemId: out.weaponByItemId, byNameKey: out.weaponByNameKey });
      itemTalentOverrideCache = out;
      return out;
    } finally {
      db.close();
    }
  })();
  try {
    return await itemTalentOverridePromise;
  } finally {
    itemTalentOverridePromise = null;
  }
}

function getVendorTalentOverrideFromCache(cache, itemCategory, itemId, nameKey, talentKey) {
  if (!cache) return null;
  const cat = normalizeKey(itemCategory || "");
  const byItem = (cat === "weapon") ? cache.weaponByItemId : cache.gearByItemId;
  const byName = (cat === "weapon") ? cache.weaponByNameKey : cache.gearByNameKey;
  const id = String(itemId || "").trim();
  const nk = normalizeKey(nameKey || "");
  const keys = expandTalentKeysForLookup(talentKey || "");
  for (const tk of keys) {
    if (id && byItem.has(id)) {
      const hit = byItem.get(id).get(tk);
      if (hit) return hit;
    }
  }
  for (const tk of keys) {
    if (nk && byName.has(nk)) {
      const hit = byName.get(nk).get(tk);
      if (hit) return hit;
    }
  }
  // Fallback: if item/name resolves to exactly one talent definition in items tables,
  // prefer that even when shop talent_key is wrong.
  const pickSingleEquivalent = (m) => {
    if (!m || m.size === 0) return null;
    let first = null;
    let sig = "";
    for (const v of m.values()) {
      if (!v) continue;
      const s = [
        normalizeKey(v.talent || ""),
        normalizeKey(v.talentDesc || "")
      ].join("|");
      if (!first) {
        first = v;
        sig = s;
        continue;
      }
      if (s !== sig) return null;
    }
    return first;
  };
  if (id && byItem.has(id)) {
    const picked = pickSingleEquivalent(byItem.get(id));
    if (picked) return picked;
  }
  if (nk && byName.has(nk)) {
    const picked = pickSingleEquivalent(byName.get(nk));
    if (picked) return picked;
  }
  return null;
}

/* ---------------------------
 * Assets
 * ------------------------- */
function assetUrl(assetPath) {
  if (!assetPath) return "";
  return assetPath.startsWith("img/") ? appPath(assetPath) : assetPath;
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
  // Talent icons are shared across categories in some data snapshots.
  // Cross-check both maps so WebUI can resolve either side.
  if (kind === "talents") {
    const pAlt = assetPath("weapon_talents", key);
    if (pAlt) return assetUrl(pAlt);
  } else if (kind === "weapon_talents") {
    const pAlt = assetPath("talents", key);
    if (pAlt) return assetUrl(pAlt);
  }
  if (!fallbackDir) return "";
  const safe = sanitizeFileKey(key);
  if (!safe) return "";
  return appPath(`${fallbackDir}/${safe}.png`);
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
  const ali = i18nAliases[norm];
  if (ali && i18n && Object.prototype.hasOwnProperty.call(i18n, ali)) return ali;

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
// - perfect** <-> perfectly** の揺れのみ相互フォールバック
// - futureperfect の完全版は futureperfection、逆も相互に試す
function talentKeyVariants(tKey) {
  const key = String(tKey || "");
  const vars = [];
  if (key === "futureperfection") vars.push("futureperfect");
  if (key === "futureperfect") vars.push("futureperfection");

  if (key.startsWith("perfectly")) {
    const base = key.replace(/^perfectly/, "");
    if (base) {
      vars.push(`perfect${base}`);
    }
  } else if (key.startsWith("perfect")) {
    const base = key.replace(/^perfect/, "");
    if (base) {
      vars.push(`perfectly${base}`);
    }
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

function brandTalentIconHtml(talentKey, fallbackText = "") {
  const baseKey = sanitizeFileKey(talentKey || normalizeKey(fallbackText || ""));
  if (!baseKey) return "";
  const cands = [];
  const add = (u) => {
    if (!u) return;
    if (!cands.includes(u)) cands.push(u);
  };
  add(iconUrl("talents", baseKey, "img/talents"));
  for (const k of talentKeyVariants(baseKey)) {
    add(iconUrl("talents", k, "img/talents"));
  }
  if (!cands.length) return "";
  return iconImgHtml(cands[0], "ico ico--talent", "talent", cands.slice(1));
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

async function fetchJsonWithTimeout(path, timeoutMs = 8000) {
  const ms = Math.max(1, Number(timeoutMs) || 8000);
  const hasAbort = typeof AbortController !== "undefined";
  const ctrl = hasAbort ? new AbortController() : null;
  let timer = null;
  try {
    const fetchPromise = fetch(path, hasAbort
      ? { cache: "no-store", signal: ctrl.signal }
      : { cache: "no-store" }
    ).then((res) => {
      if (!res.ok) throw new Error(`fetch failed: ${res.status} ${path}`);
      return res.json();
    });

    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        try {
          if (ctrl) ctrl.abort();
        } catch (e) {
          // ignore abort errors
        }
        reject(new Error(`fetch timeout: ${path}`));
      }, ms);
    });

    return await Promise.race([fetchPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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
    throw new Error("sql-wasm.js is not loaded. Place web/sql-wasm.js and web/sql-wasm.wasm.");
  }
  SQL = await initSqlJs({
    locateFile: (file) => appPath(file)
  });
  return SQL;
}

async function loadDescentPoolState() {
  const fallback = {
    loaded: true,
    available: false,
    cycleMs: 0,
    anchorUtcMs: 0,
    entries: []
  };
  try {
    const idx = await fetchJsonWithTimeout(`${DATA_BASE}/descent/index.json?ts=${Date.now()}`, 5000);
    const dbRel = String(idx?.db_gz || "data/descent/descent_talent_pool_latest.db.gz").trim();
    const dbPath = appPath(dbRel);
    const cycleDays = Number(idx?.cycle_days || 3);
    const cycleMs = cycleDays * 24 * 60 * 60 * 1000;
    const anchorUtcMs = parseJstDateTimeToUtcMs(String(idx?.anchor_jst || "2026-03-07 09:00:00"));
    if (!(cycleMs > 0) || !Number.isFinite(anchorUtcMs)) {
      descentPoolState = fallback;
      return;
    }

    const gz = await fetchArrayBuffer(`${dbPath}?ts=${Date.now()}`);
    const bytes = await gunzipToUint8Array(gz);
    const sql = await initSql();
    const db = new sql.Database(bytes);
    try {
      const rs = db.exec(
        "SELECT normalized_cycle_jst, talent_pool, talent_pool_key FROM descent_talent_pool ORDER BY normalized_cycle_jst ASC, talent_pool ASC"
      );
      if (!rs || !rs.length || !Array.isArray(rs[0].values)) {
        descentPoolState = fallback;
        return;
      }
      const map = new Map();
      for (const row of rs[0].values) {
        const cycleJst = String(row[0] || "").trim();
        const poolName = String(row[1] || "").trim();
        const poolKey = normalizeKey(String(row[2] || poolName));
        if (!cycleJst) continue;
        if (!map.has(cycleJst)) {
          map.set(cycleJst, { pools: new Set(), poolKeys: new Set(), talents: [] });
        }
        const bucket = map.get(cycleJst);
        if (poolName) bucket.pools.add(poolName);
        if (poolKey) bucket.poolKeys.add(poolKey);
      }
      const talentByPoolKey = new Map();
      try {
        const trs = db.exec(
          "SELECT m.pool_key, m.talent_name, m.talent_key, d.talent_group "
          + "FROM descent_talent_pool_map m "
          + "LEFT JOIN descent_talent_descriptions d ON d.talent_key = m.talent_key "
          + "ORDER BY m.pool_key, m.talent_name"
        );
        if (trs && trs.length && Array.isArray(trs[0].values)) {
          for (const row of trs[0].values) {
            const poolKey = normalizeKey(String(row[0] || ""));
            if (!poolKey) continue;
            const item = {
              talent_name: String(row[1] || "").trim(),
              talent_key: normalizeKey(String(row[2] || row[1] || "")),
              talent_group: String(row[3] || "").trim()
            };
            if (!talentByPoolKey.has(poolKey)) talentByPoolKey.set(poolKey, []);
            talentByPoolKey.get(poolKey).push(item);
          }
        }
      } catch (e) {
        // keep talents empty when map tables are unavailable
      }
      const entries = Array.from(map.entries()).map(([cycleJst, bucket]) => ({
        cycleJst,
        startUtcMs: parseJstDateTimeToUtcMs(cycleJst),
        pools: Array.from(bucket.pools || []),
        poolKeys: Array.from(bucket.poolKeys || []),
        talents: (() => {
          const keys = Array.from(bucket.poolKeys || []).map((x) => normalizeKey(x)).filter(Boolean);
          const out = [];
          const seen = new Set();
          for (const k of keys) {
            const arr = talentByPoolKey.get(k) || [];
            for (const t of arr) {
              const tk = normalizeKey(String(t?.talent_key || t?.talent_name || ""));
              if (!tk || seen.has(tk)) continue;
              seen.add(tk);
              out.push({
                name: String(t?.talent_name || "").trim(),
                talent_key: tk,
                talent_group: String(t?.talent_group || "").trim()
              });
            }
          }
          return out;
        })()
      })).filter((x) => Number.isFinite(x.startUtcMs));
      entries.sort((a, b) => a.startUtcMs - b.startUtcMs);
      descentPoolState = {
        loaded: true,
        available: entries.length > 0,
        cycleMs,
        anchorUtcMs,
        entries
      };
    } finally {
      db.close();
    }
  } catch (e) {
    descentPoolState = fallback;
  }
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
    if ("name_key" in ex && normalizeKey(String(ex.name_key || "")) !== normalizeKey(String(nameKey || ""))) return false;
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
  const statEn = stripHtml((lt === "talent" && ln.override_talent_name) ? ln.override_talent_name : (ln.stat_en || ""));
  if (!statEn) return "";
  if (/^[\-–—]+$/.test(statEn)) return "";

  const statKey = String((lt === "talent" && ln.override_talent_key) ? ln.override_talent_key : (ln.stat_key || normalizeKey(statEn)));
  if (!statLabelEnByKey.has(statKey)) statLabelEnByKey.set(statKey, statEn);

  const stat = (langSelect.value === "ja")
    ? (i18n[statKey] ?? i18n[normalizeKey(statKey)] ?? statEn)
    : statEn;

  const unit = String(ln.unit || "");
  const valueNum = Number.isFinite(ln.value_num) ? ln.value_num : null;
  const valueRaw = String(ln.value_raw || "").trim();
  if (valueNum === null && (valueRaw === "-" || /^[\-–—]+$/.test(valueRaw))) return "";
  let valueText = "";
  if (valueNum !== null) {
    const numStr = formatDisplayNumber(valueNum);
    valueText = `${numStr}${unit}`;
  }

  const valuePart = valueText ? (item.category === "cache" ? `${valueText}` : `+${valueText}`) : "";
  const text = valuePart ? `${valuePart} ${stat}` : `${stat}`;
  if (!text.trim() || /^[\-–—]+$/.test(text.trim())) return "";

  const colorClass = colorOverride ? colorOverride : dotColorFromIconClass(iconClass);
  const perfectItem = (() => {
    const byCat = graphConfig?.perfect?.items_by_category;
    if (!byCat || typeof byCat !== "object") return null;
    const nk = normalizeKey(String(item.name_key || ""));
    const cat = String(item.category || "");
    const items = Array.isArray(byCat[cat]) ? byCat[cat] : [];
    for (const it of items) {
      if (!it || typeof it !== "object") continue;
      if (normalizeKey(String(it.name_key || "")) !== nk) continue;
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

  const perfectClass = "";
  const namedTalentClass = (lt === "talent" && !!ln.is_named_talent) ? " line--named" : "";
  const lineClass = `line line--${colorClass} line--${lt}${perfectClass}${namedTalentClass}`;
  const hitClass = activeFilterKeys.includes(statKey) ? " is-filter-hit" : "";

  let lineTextHtml = escapeHtml(text);
  if (currentViewMode === "vendor" && lt === "talent" && statKey) {
    const namedAttr = ln.is_named_talent ? "1" : "0";
    lineTextHtml = `<button type="button" class="inline-pop-trigger line__text-pop-trigger" data-pop-type="talent" data-item-category="${escapeHtml(item.category || "")}" data-item-rarity="${escapeHtml(item.rarity || "")}" data-item-id="${escapeHtml(item.item_id || "")}" data-item-name-key="${escapeHtml(item.name_key || "")}" data-talent-key="${escapeHtml(statKey)}" data-talent-name="${escapeHtml(stat)}" data-talent-named="${namedAttr}">${escapeHtml(text)}</button>`;
  }

  return `
    <div class="${lineClass}${hitClass}" data-stat-key="${escapeHtml(statKey)}" data-line-type="${escapeHtml(lt)}">
      ${talentIconHtml}
      <div class="line__body">
        <div class="line__text">${lineTextHtml}</div>
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
    const p = modCard.isSkillMod ? appPath("img/gears/skillmod.png") : appPath("img/gears/gearmod.png");
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
  const rarityClass = (currentViewMode === "vendor" && item.category === "mod")
    ? "highend"
    : rarityToClass(item.rarity);
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

  let title1Html = `<span class="card__title-text">${escapeHtml(head.title1 || "")}</span>`;
  if (currentViewMode === "vendor" && item.category === "gear") {
    const brandKey = normalizeKey(String(item.brand_key || item.brand_en || ""));
    const brandScope = String(item.rarity || "").toLowerCase().includes("gearset") ? "gearset" : "brand";
    if (brandKey) {
      title1Html = `<button type="button" class="inline-pop-trigger card__title-pop-trigger" data-pop-type="brand" data-brand-scope="${escapeHtml(brandScope)}" data-brand-key="${escapeHtml(brandKey)}" data-brand-name="${escapeHtml(head.title1 || item.brand_en || "")}"><span class="card__title-text">${escapeHtml(head.title1 || "")}</span></button>`;
    }
  }

  return `
    <div class="card rarity-${escapeHtml(rarityClass)} cat-${escapeHtml(item.category)}" data-item-id="${escapeHtml(item.item_id)}" data-keys="${escapeHtml(keys)}" data-search="${escapeHtml(search)}" data-vendor="${escapeHtml(vendorTitle)}">
      ${bg}
      <div class="card__head">
        <div class="card__title-wrap">
          <div class="card__titles">
            <div class="card__title${namedClass}">${title1Html}</div>
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
  const legacy = (vkey === "thecastle") ? "castle" : vkey;
  const i = VENDOR_ORDER.indexOf(legacy);
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

function appendVendorWeekInfo() {
  const currentWeek = getVendorDateValue() || (indexJson && indexJson.target_week) || "";
  if (!currentWeek || !contentEl) return;
  const weekInfo = document.createElement("div");
  weekInfo.className = "vendor-week-info";
  weekInfo.textContent = `${ui("week")}: ${currentWeek}`;
  contentEl.appendChild(weekInfo);
}

function renderOnlySelectedView() {
  clearContent();
  appendVendorWeekInfo();

  const selectedItems = (lastItems || []).filter(it => selectedIds.has(it.item_id));
  if (!selectedItems.length) return;

  const catOrder = ["gear", "weapon", "mod", "cache"];
  for (const cat of catOrder) {
    const items = sortItemsByVendorAndOrd(selectedItems.filter(x => x.category === cat));
    if (!items.length) continue;

    const section = document.createElement("section");
    section.className = `catgroup catgroup--${cat} vendor-selected-group`;
    section.innerHTML = `
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
  if (currentViewMode === "brand") {
    // Brand view stays in-place; selection filtering is handled by applyFiltersToDom().
    return;
  }
  if (currentViewMode !== "vendor") return;
  if (onlySelected) {
    renderOnlySelectedView();
  } else if (lastVendorMap) {
    renderVendors(lastVendorMap);
  }
}

function renderVendors(vendorMap) {
  clearContent();

  const vendors = Array.from(vendorMap.keys()).sort((a, b) => {
    const ia = vendorOrderIndex(a);
    const ib = vendorOrderIndex(b);
    if (ia === 9999 && ib === 9999) return a.localeCompare(b);
    if (ia === 9999) return 1;
    if (ib === 9999) return -1;
    return ia - ib;
  });

  if (vendors.length === 0) {
    contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
    return;
  }
  appendVendorWeekInfo();

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
  document.querySelectorAll("[data-item-id][data-search]").forEach(card => {
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
  if (currentViewMode === "trello" || currentViewMode === "patches") {
    document.body.classList.remove("only-selected");
    if (typeof window.trelloViewApplyFilters === "function") {
      window.trelloViewApplyFilters();
    }
    if (onlySelectedBtn) {
      onlySelectedBtn.classList.remove("is-on");
    }
    return;
  }

  const keys = activeFilterKeys.slice();
  const isVendor = currentViewMode === "vendor";

  document.body.classList.toggle("only-selected", isVendor && onlySelected);

  document.querySelectorAll("[data-item-id][data-search]").forEach(card => {
    const id = card.dataset.itemId;
    const okSel = (!isVendor || !onlySelected) || selectedIds.has(id);
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
    if (String(group.getAttribute("data-keep-visible") || "") === "1") {
      group.style.display = "";
      return;
    }
    const any = Array.from(group.querySelectorAll("[data-item-id][data-search]"))
      .some(c => c.style.display !== "none");
    group.style.display = any ? "" : "none";
  });

  document.querySelectorAll(".vendor").forEach(v => {
    const any = Array.from(v.querySelectorAll("[data-item-id][data-search]"))
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

function normalizeRuleValue(value) {
  if (value == null) return "";
  return normalizeKey(String(value));
}

function normalizeRuleValueList(value) {
  if (Array.isArray(value)) return value.map(v => normalizeRuleValue(v)).filter(Boolean);
  const one = normalizeRuleValue(value);
  return one ? [one] : [];
}

function getItemStatKeys(item) {
  const lines = Array.isArray(item?.lines) ? item.lines : [];
  const keys = [];
  for (const ln of lines) {
    const lt = normalizeRuleValue(ln?.line_type);
    if (!(lt === "core" || lt === "attr" || lt === "talent" || lt === "price")) continue;
    const k = normalizeRuleValue(ln?.stat_key || ln?.stat_en);
    if (k) keys.push(k);
  }
  return keys;
}

function getItemAttrStatKeys(item) {
  const lines = Array.isArray(item?.lines) ? item.lines : [];
  const keys = [];
  for (const ln of lines) {
    const lt = normalizeRuleValue(ln?.line_type);
    if (lt !== "attr") continue;
    const k = normalizeRuleValue(ln?.stat_key || ln?.stat_en);
    if (k) keys.push(k);
  }
  return keys;
}

function getItemAttrStatKeyByIndex(item, index1) {
  const idx = Number(index1);
  if (!Number.isFinite(idx) || idx < 1) return "";
  const attrs = (Array.isArray(item?.lines) ? item.lines : [])
    .filter(ln => normalizeRuleValue(ln?.line_type) === "attr")
    .sort((a, b) => Number(a?.ord || 0) - Number(b?.ord || 0));
  const ln = attrs[idx - 1];
  if (!ln) return "";
  return normalizeRuleValue(ln.stat_key || ln.stat_en);
}

function evalRuleLeaf(item, node) {
  const field = String(node?.field || "");
  const op = String(node?.op || "");
  const value = node?.value;
  if (!field || !op) return false;

  if (field === "attr_at") {
    if (op !== "eq") return false;
    const idx = value && typeof value === "object" ? value.index : null;
    const statKey = value && typeof value === "object" ? value.stat_key : null;
    const actual = getItemAttrStatKeyByIndex(item, idx);
    const expected = normalizeRuleValue(statKey);
    return !!actual && !!expected && actual === expected;
  }

  if (field === "stat_keys") {
    const actualList = getItemStatKeys(item);
    const actualSet = new Set(actualList);
    const expectedList = normalizeRuleValueList(value);
    if (!expectedList.length) return false;
    if (op === "has_any") return expectedList.some(v => actualSet.has(v));
    if (op === "has_all") return expectedList.every(v => actualSet.has(v));
    if (op === "has_only") {
      if (!actualSet.size) return false;
      return Array.from(actualSet).every(v => expectedList.includes(v));
    }
    return false;
  }

  if (field === "attr_stat_keys") {
    const actualList = getItemAttrStatKeys(item);
    const actualSet = new Set(actualList);
    const expectedList = normalizeRuleValueList(value);
    if (!expectedList.length) return false;
    if (op === "has_any") return expectedList.some(v => actualSet.has(v));
    if (op === "has_all") return expectedList.every(v => actualSet.has(v));
    if (op === "has_only") {
      if (!actualSet.size) return false;
      return Array.from(actualSet).every(v => expectedList.includes(v));
    }
    return false;
  }

  if (field === "has_talent") {
    if (op !== "eq") return false;
    const lines = Array.isArray(item?.lines) ? item.lines : [];
    const hasTalent = lines.some(ln => normalizeRuleValue(ln?.line_type) === "talent");
    return Boolean(hasTalent) === Boolean(value);
  }

  if (field === "is_named") {
    if (op !== "eq") return false;
    return Boolean(isNamedItem(item)) === Boolean(value);
  }

  const actualMap = {
    target: normalizeRuleValue(item?.category),
    category: normalizeRuleValue(item?.category),
    vendor_key: normalizeRuleValue(item?.vendor_key),
    brand_key: normalizeRuleValue(item?.brand_key),
    slot_key: normalizeRuleValue(item?.slot_key),
    rarity: normalizeRuleValue(item?.rarity),
    name_key: normalizeRuleValue(item?.name_key)
  };

  const actual = actualMap[field];
  if (actual == null) return false;
  if (op === "eq") return !!actual && actual === normalizeRuleValue(value);
  if (op === "in") {
    const list = normalizeRuleValueList(value);
    return !!actual && list.includes(actual);
  }
  return false;
}

function evalRuleNode(item, node) {
  if (!node || typeof node !== "object") return false;
  const hasAll = Array.isArray(node.all);
  const hasAny = Array.isArray(node.any);
  if (hasAll || hasAny) {
    const allOk = hasAll ? node.all.every(child => evalRuleNode(item, child)) : true;
    const anyOk = hasAny ? node.any.some(child => evalRuleNode(item, child)) : true;
    return allOk && anyOk;
  }
  return evalRuleLeaf(item, node);
}

function itemMatchesRecommendationRule(item, rule) {
  if (!item || !rule || typeof rule !== "object") return false;
  if (rule.enabled === false) return false;
  const target = normalizeRuleValue(rule.target);
  if (target) {
    const cat = normalizeRuleValue(item?.category);
    if (!cat || cat !== target) return false;
  }
  return evalRuleNode(item, rule);
}

function collectRecommendedItemIds(items) {
  const rules = Array.isArray(vendorRecommendations?.rules) ? vendorRecommendations.rules : [];
  if (!rules.length) return [];
  const ids = [];
  for (const item of (items || [])) {
    if (!item?.item_id) continue;
    const hit = rules.some(rule => itemMatchesRecommendationRule(item, rule));
    if (hit) ids.push(item.item_id);
  }
  return ids;
}

function applyVendorRecommendedSelection(options = {}) {
  const preserveSelection = !!options.preserveSelection;
  const force = !!options.force;
  if (currentViewMode !== "vendor") return 0;
  if (preserveSelection && !force) return 0;
  if (!force && vendorRecommendations?.auto_select_on_load === false) return 0;

  const ids = collectRecommendedItemIds(lastItems || []);
  selectedIds.clear();
  for (const id of ids) selectedIds.add(id);
  syncCardSelectionClasses();
  applyFiltersToDom();
  return ids.length;
}

window.vendorApplyRecommendations = function vendorApplyRecommendations(items, options = {}) {
  if (Array.isArray(items)) lastItems = items;
  return applyVendorRecommendedSelection(options);
};

function toggleCardSelection(cardEl) {
  if (currentViewMode !== "vendor") return;
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
  if (currentViewMode !== "vendor") return;
  if (typeof window.vendorViewLoadWeek !== "function") {
    throw new Error("vendorViewLoadWeek is not available");
  }
  await window.vendorViewLoadWeek(userDateStr, options);
  const currentDate = getVendorDateValue();
  if (currentDate) setVendorDateValue(currentDate);
}

async function renderTrelloView() {
  if (typeof window.trelloViewRender !== "function") {
    throw new Error("trelloViewRender is not available");
  }
  await window.trelloViewRender();
  syncDescToggleStateFromDom();
}

async function renderBrandView() {
  if (typeof window.brandViewRender !== "function") {
    throw new Error("brandViewRender is not available");
  }
  await window.brandViewRender();
}

async function renderGearsetView() {
  if (typeof window.gearsetViewRender !== "function") {
    throw new Error("gearsetViewRender is not available");
  }
  await window.gearsetViewRender();
}

async function renderExoticGearView() {
  if (typeof window.exoticGearViewRender !== "function") {
    throw new Error("exoticGearViewRender is not available");
  }
  await window.exoticGearViewRender();
}

async function renderWeaponsView() {
  if (typeof window.weaponsViewRender !== "function") {
    throw new Error("weaponsViewRender is not available");
  }
  await window.weaponsViewRender();
}

async function renderGearTalentView() {
  if (typeof window.gearTalentViewRender !== "function") {
    throw new Error("gearTalentViewRender is not available");
  }
  await window.gearTalentViewRender();
}

async function renderWeaponTalentView() {
  if (typeof window.weaponTalentViewRender !== "function") {
    throw new Error("weaponTalentViewRender is not available");
  }
  await window.weaponTalentViewRender();
}

async function renderDescentTalentView() {
  if (typeof window.descentTalentViewRender !== "function") {
    throw new Error("descentTalentViewRender is not available");
  }
  await window.descentTalentViewRender();
}

async function renderItemSourcesView() {
  if (typeof window.itemSourcesViewRender !== "function") {
    throw new Error("itemSourcesViewRender is not available");
  }
  await window.itemSourcesViewRender();
}
function closeNavMenu() {
  if (!navMenuPanel) return;
  const active = document.activeElement;
  if (active && navMenuPanel.contains(active) && typeof active.blur === "function") {
    active.blur();
  }
  navMenuPanel.inert = true;
  navMenuPanel.setAttribute("aria-hidden", "true");
}

function toggleNavMenu() {
  if (!navMenuPanel) return;
  const hidden = navMenuPanel.getAttribute("aria-hidden") !== "false";
  navMenuPanel.inert = !hidden;
  navMenuPanel.setAttribute("aria-hidden", hidden ? "false" : "true");
}

async function switchViewMode(mode) {
  currentViewMode = (mode === "weapons" || mode === "brand" || mode === "gearset" || mode === "exotic_gear" || mode === "gear_talent" || mode === "weapon_talent" || mode === "descent_talent" || mode === "item_sources" || mode === "trello" || mode === "patches") ? mode : "vendor";
  window.currentViewMode = currentViewMode;
  syncDescToggleForCurrentView();
  closeNavMenu();
  updateModeUi();
  if (currentViewMode !== "vendor") {
    setStatus("");
  }
  if (worldTimeWrapEl) worldTimeWrapEl.style.display = "";
  replaceUrlParams({
    view: currentViewMode,
    descent_pool: currentViewMode === "descent_talent" ? (window.descentTalentInitialPoolKey || null) : null
  });
  if (currentViewMode === "weapons") {
    await renderWeaponsView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "brand") {
    await renderBrandView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "gearset") {
    await renderGearsetView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "exotic_gear") {
    await renderExoticGearView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "gear_talent") {
    await renderGearTalentView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "weapon_talent") {
    await renderWeaponTalentView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "descent_talent") {
    await renderDescentTalentView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "item_sources") {
    await renderItemSourcesView();
    requestToolbarSync();
    return;
  }
  if (currentViewMode === "trello" || currentViewMode === "patches") {
    await renderTrelloView();
    requestToolbarSync();
    return;
  }
  const d = getVendorDateValue() || indexJson.target_week || new Date().toISOString().slice(0, 10);
  setVendorDateValue(d);
  await loadWeek(d, { preserveSelection: true });
}

async function boot() {
  loadLangSetting();
  applyUrlParams();
  setFiltersOpen(false);
  applyUiLang();

  setStatus(ui("loadingIndex"));
  indexJson = await fetchJson(`${DATA_BASE}/index.json?ts=${Date.now()}`);

  setStatus(ui("loadingI18n"));
  const i18nRaw = await fetchJson(`${DATA_BASE}/i18n.json?ts=${Date.now()}`);
  let i18nTalentRaw = null;
  try {
    i18nTalentRaw = await fetchJson(`${DATA_BASE}/i18n_talents.json?ts=${Date.now()}`);
  } catch (e) {
    i18nTalentRaw = null;
  }
  let i18nDict = {};

  const mergedCategories = {};
  const mergeCategories = (rawObj) => {
    if (!rawObj || typeof rawObj !== "object") return;
    const cats = rawObj.categories;
    if (!cats || typeof cats !== "object") return;
    for (const [catName, bucket] of Object.entries(cats)) {
      if (!bucket || typeof bucket !== "object") continue;
      if (!mergedCategories[catName] || typeof mergedCategories[catName] !== "object") {
        mergedCategories[catName] = {};
      }
      Object.assign(mergedCategories[catName], bucket);
    }
  };
  mergeCategories(i18nRaw);
  mergeCategories(i18nTalentRaw);
  i18nCategories = mergedCategories;

  if (i18nRaw && typeof i18nRaw === "object" && i18nRaw.dict && typeof i18nRaw.dict === "object") {
    // backward compatibility for old shape
    i18nDict = i18nRaw.dict;
  } else if (Object.keys(mergedCategories).length > 0) {
    // v2 shape: categories. Flatten for runtime lookup.
    const merged = {};
    for (const [catName, bucket] of Object.entries(mergedCategories)) {
      // desc categories are resolved explicitly by trCategoryText to avoid key collisions.
      if (String(catName || "").endsWith("_desc")) continue;
      if (!bucket || typeof bucket !== "object") continue;
      for (const [k, v] of Object.entries(bucket)) {
        if (!Object.prototype.hasOwnProperty.call(merged, k)) merged[k] = v;
      }
    }
    i18nDict = merged;
  } else {
    i18nDict = i18nRaw || {};
  }
  const aliasA = (i18nRaw && typeof i18nRaw === "object" && i18nRaw.aliases && typeof i18nRaw.aliases === "object")
    ? i18nRaw.aliases
    : {};
  const aliasB = (i18nTalentRaw && typeof i18nTalentRaw === "object" && i18nTalentRaw.aliases && typeof i18nTalentRaw.aliases === "object")
    ? i18nTalentRaw.aliases
    : {};
  i18nAliases = Object.assign({}, aliasA, aliasB);
  i18n = new Proxy(i18nDict, {
    get(target, prop, receiver) {
      if (typeof prop !== "string") return Reflect.get(target, prop, receiver);
      if (Object.prototype.hasOwnProperty.call(target, prop)) return target[prop];
      const k = i18nAliases[prop];
      if (k && Object.prototype.hasOwnProperty.call(target, k)) return target[k];
      // perfect/perfectly prefix wobble fallback (both directions).
      const keysToTry = [];
      const baseKey = (k && typeof k === "string") ? k : prop;
      if (typeof baseKey === "string" && baseKey) {
        if (baseKey.startsWith("perfectly")) {
          const tail = baseKey.slice("perfectly".length);
          if (tail) keysToTry.push(`perfect${tail}`);
        } else if (baseKey.startsWith("perfect")) {
          const tail = baseKey.slice("perfect".length);
          if (tail) keysToTry.push(`perfectly${tail}`);
        }
      }
      for (const kk of keysToTry) {
        if (Object.prototype.hasOwnProperty.call(target, kk)) return target[kk];
      }
      return Reflect.get(target, prop, receiver);
    }
  });
  buildI18nReverse();

  const defaultDate = getVendorDateValue() || indexJson.target_week || new Date().toISOString().slice(0, 10);
  setVendorDateValue(defaultDate);
  updateModeUi();
  await switchViewMode(initialViewMode);

  // Optional files: load in background so boot is never blocked.
  setStatus("");
  (async () => {
    let needsVendorRerender = false;
    try {
      assetMap = await fetchJsonWithTimeout(`${DATA_BASE}/asset_map.json?ts=${Date.now()}`, 8000);
      needsVendorRerender = true;
    } catch (e) {
      assetMap = null;
    }
    try {
      graphConfig = await fetchJsonWithTimeout(`${DATA_BASE}/graph_config.json?ts=${Date.now()}`, 5000);
      needsVendorRerender = true;
    } catch (e) {
      graphConfig = {};
    }
    try {
      vendorRecommendations = await fetchJsonWithTimeout(`${DATA_BASE}/vendor_recommendations.json?ts=${Date.now()}`, 5000);
    } catch (e) {
      vendorRecommendations = { version: 1, auto_select_on_load: false, rules: [] };
    }
    if (needsVendorRerender) {
      try {
        if (currentViewMode === "vendor") {
          const d = getVendorDateValue() || indexJson.target_week || new Date().toISOString().slice(0, 10);
          setVendorDateValue(d);
          await loadWeek(d, { preserveSelection: true });
        } else if (currentViewMode === "weapons") {
          await renderWeaponsView();
        } else if (currentViewMode === "brand") {
          await renderBrandView();
        } else if (currentViewMode === "gearset") {
          await renderGearsetView();
        } else if (currentViewMode === "exotic_gear") {
          await renderExoticGearView();
        } else if (currentViewMode === "gear_talent") {
          await renderGearTalentView();
        } else if (currentViewMode === "weapon_talent") {
          await renderWeaponTalentView();
        } else if (currentViewMode === "descent_talent") {
          await renderDescentTalentView();
        } else if (currentViewMode === "item_sources") {
          await renderItemSourcesView();
        }
      } catch (e) {
        // Keep optional asset failures from breaking initial render.
      }
    }
  })();
  loadDescentPoolState().finally(() => {
    updateScheduleStatus(new Date());
  });
}

/* ---------------------------
 * Events
 * ------------------------- */

langSelect.addEventListener("change", () => {
  saveLangSetting();
  replaceUrlParams({ lang: langSelect.value || "en" });
  applyUiLang();
  const d = getVendorDateValue();
  if (currentViewMode === "vendor") {
    if (d) loadWeek(d, { preserveSelection: true }).catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "weapons") {
    renderWeaponsView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "brand") {
    renderBrandView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "gearset") {
    renderGearsetView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "exotic_gear") {
    renderExoticGearView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "gear_talent") {
    renderGearTalentView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "weapon_talent") {
    renderWeaponTalentView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "descent_talent") {
    renderDescentTalentView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else if (currentViewMode === "item_sources") {
    renderItemSourcesView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  } else {
    renderTrelloView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
  }
});

if (navMenuBtn) {
  navMenuBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleNavMenu();
  });
}
if (navVendorBtn) {
  navVendorBtn.addEventListener("click", () => {
    switchViewMode("vendor").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navWeaponsBtn) {
  navWeaponsBtn.addEventListener("click", () => {
    switchViewMode("weapons").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navBrandBtn) {
  navBrandBtn.addEventListener("click", () => {
    switchViewMode("brand").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navGearsetBtn) {
  navGearsetBtn.addEventListener("click", () => {
    switchViewMode("gearset").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navExoticGearBtn) {
  navExoticGearBtn.addEventListener("click", () => {
    switchViewMode("exotic_gear").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navGearTalentBtn) {
  navGearTalentBtn.addEventListener("click", () => {
    switchViewMode("gear_talent").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navWeaponTalentBtn) {
  navWeaponTalentBtn.addEventListener("click", () => {
    switchViewMode("weapon_talent").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navDescentTalentBtn) {
  navDescentTalentBtn.addEventListener("click", () => {
    switchViewMode("descent_talent").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navItemSourcesBtn) {
  navItemSourcesBtn.addEventListener("click", () => {
    switchViewMode("item_sources").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navTrelloBtn) {
  navTrelloBtn.addEventListener("click", () => {
    switchViewMode("trello").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}
if (navPatchesBtn) {
  navPatchesBtn.addEventListener("click", () => {
    switchViewMode("patches").catch(err => setStatus(`${ui("error")}: ${err.message}`));
  });
}

if (worldTimeEl) {
  worldTimeEl.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleWorldTimePopup();
  });
}
if (descentPoolSummaryEl) {
  descentPoolSummaryEl.addEventListener("click", (e) => {
    e.stopPropagation();
    const action = String(descentPoolSummaryEl.dataset.statusAction || "");
    if (action === "open_descent_talent") {
      const poolKey = normalizeKey(String(descentPoolSummaryEl.dataset.statusPoolKey || ""));
      openDescentPoolStatusPopup(descentPoolSummaryEl, poolKey);
      return;
    }
    window.open(DESCENT_POOL_CONTRIB_URL, "_blank", "noopener,noreferrer");
  });
  descentPoolSummaryEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    descentPoolSummaryEl.click();
  });
}
document.addEventListener("click", (e) => {
  if (navMenuPanel && navMenuBtn) {
    if (!navMenuPanel.contains(e.target) && !navMenuBtn.contains(e.target)) {
      closeNavMenu();
    }
  }
  if (isFloatingInfoCardOpen()) {
    if (!(floatingInfoCardEl && floatingInfoCardEl.contains(e.target)) && !e.target.closest(".inline-pop-trigger")) {
      closeFloatingInfoCard();
    }
  }
  if (isWorldTimePopupOpen) {
    if (worldTimePopupEl && worldTimePopupEl.contains(e.target)) return;
    if (worldTimeEl && worldTimeEl.contains(e.target)) return;
    closeWorldTimePopup();
  }
});
if (statusEl) {
  statusEl.addEventListener("click", (e) => {
    const row = e.target.closest(".status__row[data-status-action]");
    if (!row) return;
    const action = String(row.getAttribute("data-status-action") || "");
    if (action === "open_descent_talent") {
      const poolKey = normalizeKey(String(row.getAttribute("data-status-pool-key") || ""));
      e.stopPropagation();
      openDescentPoolStatusPopup(row, poolKey);
      return;
    }
    if (action === "open_descent_pool_contribute") {
      e.stopPropagation();
      window.open(DESCENT_POOL_CONTRIB_URL, "_blank", "noopener,noreferrer");
    }
  });
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  closeWorldTimePopup();
  closeFloatingInfoCard();
});
window.addEventListener("resize", () => {
  if (isWorldTimePopupOpen) positionWorldTimePopup();
  if (isFloatingInfoCardOpen()) {
    if (floatingInfoCardAnchorEl && document.body.contains(floatingInfoCardAnchorEl)) {
      positionFloatingInfoCard(floatingInfoCardAnchorEl);
    } else {
      closeFloatingInfoCard();
    }
  }
});

if (contentEl && typeof MutationObserver !== "undefined") {
  const toolbarObserver = new MutationObserver(() => {
    if (currentViewMode === "vendor") return;
    requestToolbarSync();
  });
  toolbarObserver.observe(contentEl, { childList: true, subtree: true });
}

async function handleVendorTalentPopup(talentBtn) {
  const itemCategory = talentBtn.getAttribute("data-item-category") || "";
  const itemId = talentBtn.getAttribute("data-item-id") || "";
  const itemNameKey = talentBtn.getAttribute("data-item-name-key") || "";
  const itemRarity = normalizeKey(talentBtn.getAttribute("data-item-rarity") || "");
  const talentKey = talentBtn.getAttribute("data-talent-key") || "";
  const talentName = stripHtml(talentBtn.getAttribute("data-talent-name") || talentBtn.textContent || "");
  let body = "";
  let title = talentName || talentKey;
  const hintedNamed = String(talentBtn.getAttribute("data-talent-named") || "") === "1";
  let isNamedTalent = hintedNamed;
  let descLookup = null;
  let effectiveTalentKey = talentKey;
  try {
    descLookup = await ensureTalentDescLookupCache();
  } catch (err) {
    descLookup = null;
  }
  body = resolveTalentDescription(itemCategory, effectiveTalentKey, "", descLookup, talentName);
  try {
    const overrideCache = await ensureItemTalentOverrideCache();
    const override = getVendorTalentOverrideFromCache(overrideCache, itemCategory, itemId, itemNameKey, talentKey);
    if (override && (override.talentKey || override.talent)) {
      effectiveTalentKey = normalizeKey(override.talentKey || override.talent);
    }
    if (override && override.talent) {
      const tKey = normalizeKey(override.talentKey || effectiveTalentKey || override.talent);
      title = (langSelect.value === "ja")
        ? (i18n[tKey] ?? trText(override.talent))
        : override.talent;
    }
    if (override && override.talentDesc) {
      body = resolveTalentDescription(itemCategory, effectiveTalentKey, override.talentDesc, descLookup, override.talent || talentName);
    } else {
      body = resolveTalentDescription(itemCategory, effectiveTalentKey, body, descLookup, override?.talent || talentName);
    }
    if (!isNamedTalent) {
      const lookup = await ensureNamedTalentLookupCache();
      isNamedTalent = hasNamedTalentInLookup(lookup, itemCategory, itemId, itemNameKey, effectiveTalentKey);
    }
  } catch (err) {
    // keep hintedNamed as-is
  }
  const catNorm = normalizeKey(itemCategory || "");
  const popupKind = (catNorm === "gear" && itemRarity.includes("gearset"))
    ? "gearset"
    : (catNorm === "gear")
    ? (isNamedTalent ? "gear-named" : "gear-highend")
    : (isNamedTalent ? "talent-named" : "talent");
  openFloatingInfoCard(talentBtn, title, body || ui("noData"), popupKind);
}

async function handleVendorBrandPopup(brandBtn) {
  const brandKey = normalizeKey(brandBtn.getAttribute("data-brand-key") || "");
  const brandName = stripHtml(brandBtn.getAttribute("data-brand-name") || brandBtn.textContent || "");
  const brandScope = normalizeKey(brandBtn.getAttribute("data-brand-scope") || "brand");
  try {
    if (brandScope === "gearset") {
      const gmap = await ensureGearsetPopupCache();
      const ginfo = gmap.get(brandKey);
      const ghtml = buildGearsetPopupCardHtml(ginfo, brandName || brandKey);
      openFloatingInfoCardRich(brandBtn, "", ghtml, "brand");
      return;
    }
    const map = await ensureBrandDescCache();
    const info = map.get(brandKey);
    const bodyHtml = buildBrandPopupCardHtml(info, brandName || brandKey, brandKey);
    openFloatingInfoCardRich(brandBtn, "", bodyHtml, "brand");
  } catch (err) {
    openFloatingInfoCard(brandBtn, brandName || brandKey, ui("dataUnavailable"), "brand");
  }
}

function handleVendorGearSummaryPopup(gearBtn) {
  const srcCard = gearBtn.closest(".card[data-item-id]");
  if (!srcCard) return;
  const cloned = srcCard.cloneNode(true);
  cloned.querySelectorAll(".inline-pop-trigger").forEach((btn) => {
    const span = document.createElement("span");
    span.className = String(btn.className || "").replace(/\binline-pop-trigger\b/g, "").trim();
    span.innerHTML = btn.innerHTML;
    btn.replaceWith(span);
  });
  const itemRarity = String(srcCard.className || "");
  const kind = itemRarity.includes("rarity-named") ? "gear-named" : "gear-highend";
  openFloatingInfoCardRich(gearBtn, "", cloned.outerHTML, kind);
}

// event delegation: line tap => toggle filter, card tap => select
function handleViewInteractionClick(e) {
  if (currentViewMode === "trello" || currentViewMode === "patches") {
    const sbtn = e.target.closest(".trello-sections-btn[data-toggle-sections-picker]");
    if (sbtn) {
      const picker = document.querySelector(".trello-sections-picker");
      if (picker) {
        const hidden = picker.getAttribute("aria-hidden") !== "false";
        picker.setAttribute("aria-hidden", hidden ? "false" : "true");
      }
      return;
    }
    const schk = e.target.closest(".trello-section-check[data-section-key-enc]");
    if (schk) {
      const enc = schk.getAttribute("data-section-key-enc");
      const key = enc ? decodeURIComponent(enc) : "";
      if (key && typeof window.trelloViewSetSectionVisible === "function") {
        const gb = window.trelloGroupBy === "planned" ? "planned" : "name";
        window.trelloViewSetSectionVisible(gb, key, !!schk.checked);
        applyFiltersToDom();
      }
      return;
    }
    const gbtn = e.target.closest(".trello-group-btn[data-group-by]");
    if (gbtn) {
      const gb = String(gbtn.getAttribute("data-group-by") || "").toLowerCase();
      window.trelloGroupBy = gb === "planned" ? "planned" : "name";
      renderTrelloView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
    const abtn = e.target.closest(".trello-archive-btn[data-toggle-archive]");
    if (abtn) {
      window.trelloShowArchive = !window.trelloShowArchive;
      renderTrelloView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
    const dbtn = e.target.closest(".trello-desc-btn[data-toggle-desc]");
    if (dbtn) {
      window.trelloExpandAll = !window.trelloExpandAll;
      contentEl.querySelectorAll(".trello-card[data-detail-id]").forEach((card) => {
        const id = card.getAttribute("data-detail-id");
        const panel = id ? document.getElementById(id) : null;
        if (!panel) return;
        panel.setAttribute("aria-hidden", window.trelloExpandAll ? "false" : "true");
        card.classList.toggle("is-expanded", !!window.trelloExpandAll);
      });
      refreshDescButtons();
      return;
    }
    const sht = e.target.closest(".trello-section-title[data-section-key-enc]");
    if (sht) {
      const enc = sht.getAttribute("data-section-key-enc");
      const key = enc ? decodeURIComponent(enc) : "";
      const gb = window.trelloGroupBy === "planned" ? "planned" : "name";
      const sec = sht.closest(".trello-section");
      if (key && sec && typeof window.trelloViewSetSectionCollapsed === "function") {
        const nextCollapsed = !sec.classList.contains("is-collapsed");
        window.trelloViewSetSectionCollapsed(gb, key, nextCollapsed);
        sec.classList.toggle("is-collapsed", nextCollapsed);
        const list = sec.querySelector(".trello-list");
        const caret = sht.querySelector(".trello-section-title__caret");
        if (list) list.setAttribute("aria-hidden", nextCollapsed ? "true" : "false");
        sht.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
        if (caret) caret.textContent = nextCollapsed ? "▸" : "▾";
      }
      return;
    }
    const fk = e.target.closest("[data-filter-key]");
    if (fk && filtersOpen) {
      const k = fk.getAttribute("data-filter-key");
      if (k) toggleFilterKey(k);
      return;
    }
    if (e.target.closest("a")) return;
    const tcard = e.target.closest(".trello-card[data-detail-id]");
    if (tcard) {
      const targetId = tcard.getAttribute("data-detail-id");
      const panel = targetId ? document.getElementById(targetId) : null;
      if (panel) {
        const hidden = panel.getAttribute("aria-hidden") !== "false";
        panel.setAttribute("aria-hidden", hidden ? "false" : "true");
        tcard.classList.toggle("is-expanded", hidden);
        syncDescToggleStateFromDom();
      }
      return;
    }
    return;
  }
  if (currentViewMode === "brand") {
    const bnbtn = e.target.closest(".brand-named-btn[data-toggle-brand-named]");
    if (bnbtn) {
      window.brandShowNamed = !window.brandShowNamed;
      renderBrandView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
  }
  if (currentViewMode === "weapon_talent") {
    const tdbtn = e.target.closest(".talent-desc-btn[data-toggle-talent-desc]");
    if (tdbtn) {
      setDescToggleForCurrentView(!window.talentShowDesc);
      refreshTalentDescButtons();
      renderWeaponTalentView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
    const wtfbtn = e.target.closest(".weapon-type-filter-btn[data-wt-type]");
    if (wtfbtn) {
      const t = normalizeKey(wtfbtn.getAttribute("data-wt-type") || "");
      const all = ["ar", "smg", "lmg", "shotgun", "rifle", "mmr", "pistol"];
      const cur = new Set(Array.isArray(window.weaponTalentTypeFilter) ? window.weaponTalentTypeFilter : []);
      if (all.includes(t)) {
        if (cur.has(t)) cur.delete(t);
        else cur.add(t);
        window.weaponTalentTypeFilter = all.filter((k) => cur.has(k));
      }
      renderWeaponTalentView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
  }
  if (currentViewMode === "gear_talent") {
    const tdbtn = e.target.closest(".talent-desc-btn[data-toggle-talent-desc]");
    if (tdbtn) {
      setDescToggleForCurrentView(!window.talentShowDesc);
      refreshTalentDescButtons();
      renderGearTalentView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
  }
  if (currentViewMode === "gearset") {
    const tdbtn = e.target.closest(".talent-desc-btn[data-toggle-talent-desc]");
    if (tdbtn) {
      setDescToggleForCurrentView(!window.talentShowDesc);
      refreshTalentDescButtons();
      renderGearsetView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
  }
  if (currentViewMode === "exotic_gear") {
    const tdbtn = e.target.closest(".talent-desc-btn[data-toggle-talent-desc]");
    if (tdbtn) {
      setDescToggleForCurrentView(!window.talentShowDesc);
      refreshTalentDescButtons();
      renderExoticGearView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
  }
  if (currentViewMode === "descent_talent") {
    const tdbtn = e.target.closest(".talent-desc-btn[data-toggle-talent-desc]");
    if (tdbtn) {
      setDescToggleForCurrentView(!window.talentShowDesc);
      refreshTalentDescButtons();
      renderDescentTalentView().catch(err => setStatus(`${ui("error")}: ${err.message}`));
      return;
    }
  }
  if (currentViewMode === "vendor") {
    if (!filtersOpen) {
      const talentBtn = e.target.closest(".inline-pop-trigger[data-pop-type='talent']");
      if (talentBtn) {
        e.preventDefault();
        e.stopPropagation();
        void handleVendorTalentPopup(talentBtn);
        return;
      }
      const brandBtn = e.target.closest(".inline-pop-trigger[data-pop-type='brand']");
      if (brandBtn) {
        e.preventDefault();
        e.stopPropagation();
        void handleVendorBrandPopup(brandBtn);
        return;
      }
      const gearBtn = e.target.closest(".inline-pop-trigger[data-pop-type='gear-summary']");
      if (gearBtn) {
        e.preventDefault();
        e.stopPropagation();
        handleVendorGearSummaryPopup(gearBtn);
        return;
      }
    }
  }
  const line = e.target.closest(".line[data-stat-key]");
  if (line) {
    if (!filtersOpen) return;
    const lineTextTapTarget = e.target.closest(".line__text, .line__text-pop-trigger");
    if (!lineTextTapTarget) return;
    e.stopPropagation();
    toggleFilterKey(line.dataset.statKey);
    return;
  }
  const card = e.target.closest("[data-item-id][data-search]");
  if (card) {
    if (!window.talentShowDesc && (
      currentViewMode === "gear_talent" ||
      currentViewMode === "weapon_talent" ||
      currentViewMode === "gearset" ||
      currentViewMode === "exotic_gear" ||
      currentViewMode === "descent_talent"
    ) && String(card.getAttribute("data-desc-collapsible") || "") === "1") {
      const selectedText = (window.getSelection && window.getSelection().toString()) || "";
      if (selectedText.trim()) return;
      toggleCardDesc(card);
      return;
    }
    if (currentViewMode !== "vendor") return;
    if (!filtersOpen) return;
    const selectedText = (window.getSelection && window.getSelection().toString()) || "";
    if (selectedText.trim()) return;
    toggleCardSelection(card);
  }
}

contentEl.addEventListener("click", handleViewInteractionClick);
if (vendorToolbarHostEl) {
  vendorToolbarHostEl.addEventListener("click", handleViewInteractionClick);
}

contentEl.addEventListener("keydown", (e) => {
  if (currentViewMode !== "trello" && currentViewMode !== "patches") return;
  if (e.key !== "Enter" && e.key !== " ") return;
  const sht = e.target.closest(".trello-section-title[data-section-key-enc]");
  if (!sht) return;
  e.preventDefault();
  sht.click();
});

boot().catch(err => {
  console.error(err);
  setStatus(`${ui("loadError")}: ${err.message}`, "error");
});

// world time tick (once per second)
updateWorldTime();
setInterval(updateWorldTime, 1000);


