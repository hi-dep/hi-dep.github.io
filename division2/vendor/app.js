/* global initSqlJs */

const DATA_BASE = "../data"; // vendor/ から見て data/ は ../data
const statusEl = document.getElementById("status");
const contentEl = document.getElementById("content");
const dateInput = document.getElementById("dateInput");
const langSelect = document.getElementById("langSelect");
const reloadBtn = document.getElementById("reloadBtn");
const labelWeekEl = document.getElementById("labelWeek");
const labelLangEl = document.getElementById("labelLang");

let indexJson = null;
let i18n = {};
let graphConfig = {};
let SQL = null;

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

// UI文言（固定ラベル/エラーメッセージ等）
const UI = {
  ja: {
    week: "週",
    language: "言語",
    reload: "再読込",
    optJa: "日本語",
    optEn: "English",
    loadingIndex: "index.json 読み込み…",
    loadingI18n: "i18n 読み込み…",
    loadingGraph: "graph_config 読み込み…",
    loadingDb: "DB 読み込み…",
    noData: "対象週のデータがありません。",
    noChunk: "該当する月DBが見つかりません",
    error: "エラー",
    loadError: "読み込みエラー",
    catGear: "GEAR",
    catWeapon: "WEAPON",
    catMod: "MOD",
    modSuffix: "MOD"
  },
  en: {
    week: "Week",
    language: "Language",
    reload: "Reload",
    optJa: "Japanese",
    optEn: "English",
    loadingIndex: "Loading index.json…",
    loadingI18n: "Loading i18n…",
    loadingGraph: "Loading graph_config…",
    loadingDb: "Loading DB…",
    noData: "No data for the selected week.",
    noChunk: "Monthly DB not found",
    error: "Error",
    loadError: "Load error",
    catGear: "GEAR",
    catWeapon: "WEAPON",
    catMod: "MOD",
    modSuffix: " MOD"
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
  if (reloadBtn) reloadBtn.textContent = ui("reload");

  // selectの表示文言
  const optJa = langSelect?.querySelector('option[value="ja"]');
  const optEn = langSelect?.querySelector('option[value="en"]');
  if (optJa) optJa.textContent = ui("optJa");
  if (optEn) optEn.textContent = ui("optEn");
}


// ベンダー表示順（vendor_key 基準）
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
  "thebridge"
];

// Division2: ショップは毎週火曜更新・1週間継続。
// 日付選択は「その日が属する週の火曜日（週開始日）」へ正規化して表示する。
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
function normalizeToShopWeekStart(dateStr) {
  const dtObj = parseLocalYmd(dateStr);
  if (!dtObj) return dateStr;
  const day = dtObj.getDay(); // Sun=0 ... Tue=2 ...
  const TUE = 2;
  const diff = (day - TUE + 7) % 7; // 0..6
  const start = new Date(dtObj);
  start.setDate(dtObj.getDate() - diff);
  return formatLocalYmd(start);
}

function normalizeKey(text) {
  if (text == null) return "";
  return String(text)
    .trim()
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, "")
    .toLowerCase();
}


function sanitizeFileKey(key) {
  // アイコンファイル名用：ASCII英数と._- 以外は _ に置換
  return String(key ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[–—]/g, "-")
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}


// タレントアイコンのフォールバックキー生成
// - perfect** / perfectly** の接頭辞を外した通常版へフォールバック
// - futureperfect の完全版は futureperfection、逆も相互に試す
function talentKeyVariants(tKey) {
  const key = String(tKey || "");
  const vars = [];
  // 特殊：Future Perfect / Future Perfection
  if (key === "futureperfection") vars.push("futureperfect");
  if (key === "futureperfect") vars.push("futureperfection");

  // 一般：perfectlyX -> X
  if (key.startsWith("perfectly")) {
    const base = key.replace(/^perfectly/, "");
    if (base) vars.push(base);
  } else if (key.startsWith("perfect")) {
    const base = key.replace(/^perfect/, "");
    if (base) vars.push(base);
  }

  // 重複排除（順序保持）
  const seen = new Set([key]);
  const out = [];
  for (const v of vars) {
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function stripHtml(s) {
  return String(s ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFirstClassFromHtml(s) {
  const m = String(s ?? "").match(/class="([^"]+)"/i);
  return m ? m[1] : "";
}

function trText(text) {
  const cleaned = stripHtml(text ?? "");
  if (langSelect.value !== "ja") return cleaned;
  const key = normalizeKey(cleaned);
  return i18n[key] ?? cleaned;
}

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
 * MODカード用ヘルパー
 * ------------------------- */

function isDashOnlyText(s) {
  const t = stripHtml(s ?? "");
  return /^[\-–—]+$/.test(t); // -, – , — のみ
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
  // mods の slot は（最適化後）shop_items.slot_en に入る。
  // 互換用に shop_lines(line_type='slot') が残っているDBもあるので両対応する。
  const lines0 = Array.isArray(item.lines) ? item.lines.slice() : [];

  const slotFromItem = stripHtml(item.slot_en || "");
  const hasSlotItem = !!slotFromItem;

  // 互換（旧DB）：line_type='slot' があればスキルMOD（slot行のstat_enがスキル名）
  const slotIdx = hasSlotItem
    ? -1
    : lines0.findIndex(l => String(l.line_type || "").toLowerCase() === "slot");

  let title = "MOD";
  let dotOverride = ""; // 装備MODのみ色固定
  let lines = [];

  if (hasSlotItem || slotIdx >= 0) {
    // ---- スキルMOD ----
    const skillEn = hasSlotItem ? slotFromItem : stripHtml(lines0[slotIdx].stat_en || "");
    const skillDisp = trText(skillEn);
    title = (langSelect.value === "ja") ? `${skillDisp}MOD` : `${skillDisp} MOD`;

    // 本文から slot 行は除外（互換DBの場合）
    lines = lines0.filter(ln => String(ln.line_type || "").toLowerCase() !== "slot");
    dotOverride = ""; // 灰のまま

  } else {
    // ---- 装備MOD（Offensive/Defensive/Utility）----
    const kindEn = modKindFromName(item.name_en || "");
    const kindDisp = kindEn ? trText(kindEn) : "MOD";
    title = kindEn
      ? ((langSelect.value === "ja") ? `${kindDisp}MOD` : `${kindDisp} MOD`)
      : "MOD";

    dotOverride = dotClassFromModKind(kindEn);
    lines = lines0; // 値（特性）行のみのはず
  }

  // 空/ダッシュだけ/旧仕様 modslot は除外
  lines = lines.filter(ln => {
    const lt = String(ln.line_type || "").toLowerCase();
    if (lt === "modslot") return false;
    if (lt === "slot") return false; // 念のため

    const statText = stripHtml(ln.stat_en || "");
    if (!statText) return false;
    if (isDashOnlyText(statText)) return false;

    const v = String(ln.value_raw || "").trim();
    if (v === "-" || /^[\-–—]+$/.test(v)) return false;

    return true;
  });

  return { title, lines, dotOverride };
}


function isNamedItem(item) {
  return String(item?.rarity || "").toLowerCase().includes("named");
}

function rarityToClass(rarity) {
  const r = String(rarity || "").toLowerCase();
  if (r.includes("named")) return "named";
  if (r.includes("gearset")) return "gearset";
  if (r.includes("highend")) return "highend";
  if (r.includes("offensive")) return "offensive";
  if (r.includes("defensive")) return "defensive";
  if (r.includes("utility")) return "utility";
  return "default";
}

function iconImgHtml(src, cls, alt, fallbackList = []) {
  // fallbackList: 失敗時に順に試すsrcの配列（src 自体は含めない）
  const fallbacks = Array.isArray(fallbackList) ? fallbackList.filter(Boolean) : [];
  const fbAttr = fallbacks.length
    ? ` data-fallbacks="${escapeHtml(fallbacks.join("|"))}" data-fbi="0"`
    : "";
  return `<img class="${escapeHtml(cls)}" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy"${fbAttr}
    onerror="(function(img){const fb=img.dataset.fallbacks; if(!fb){img.style.display='none'; return;} const arr=fb.split('|'); const i=Number(img.dataset.fbi||0); if(i < arr.length){img.dataset.fbi=String(i+1); img.src=arr[i];} else {img.style.display='none';}})(this)">`;
}


function buildCardHeadParts(item, modCard = null) {
  const lang = langSelect.value;

  // --------- gear ----------
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

    const bKey = sanitizeFileKey(item.brand_key || normalizeKey(brandEn));
    const sKey = sanitizeFileKey(item.slot_key || normalizeKey(slotEn));

    // タイトルは2行：1行目=ブランド（アイコンはここに内包） / 2行目=部位(+任意でnamed名)
    const title2Text = name ? `${slot} / ${name}` : `${slot}`;

    const brandIcon = bKey ? iconImgHtml(`../img/brands/${bKey}.png`, "ico ico--brand-inline", "brand") : "";
    const title1Html = `${brandIcon}<span class="card__title-text">${escapeHtml(brand)}</span>`;

    const slotIcon = sKey ? iconImgHtml(`../img/gears/${sKey}.png`, "ico ico--slot-inline", "slot") : "";
    const title2Html = `${slotIcon}<span class="card__subtitle-text">${escapeHtml(title2Text)}</span>`;

    // gear は icons カラムを使わない（字下げを発生させない）
    const icons = "";

    return { title1, title2: title2Text, title1Html, title2Html, icons };

  }
// --------- weapon ----------
  if (item.category === "weapon") {
    const nameEn = item.name_en || "";
    const title1 = (lang === "ja") ? trText(nameEn) : nameEn;

    const typeEn = item.slot_en || item.slot_key || "";
    const typeDisp = (lang === "ja")
      ? (i18n[item.slot_key] ?? trText(typeEn))
      : (stripHtml(typeEn) || item.slot_key || "");

    const wKey = sanitizeFileKey(item.slot_key || normalizeKey(typeEn));
    const icons = wKey ? iconImgHtml(`../img/weapons/${wKey}.png`, "ico ico--weapon", "weapon") : "";

    return { title1, title2: typeDisp, icons };
  }

  // --------- mod ----------
  if (item.category === "mod" && modCard) {
    return { title1: modCard.title, title2: "", icons: "" };
  }

  const nameEn = item.name_en || "";
  const title1 = (lang === "ja") ? trText(nameEn) : nameEn;
  return { title1, title2: "", icons: "" };
}

function renderCardHead(item, parts) {
  const namedClass = isNamedItem(item) ? " is-named" : "";

  const title1Inner = parts.title1Html ? parts.title1Html : escapeHtml(parts.title1 || "");
  const title2Html = parts.title2Html
    ? `<div class="card__subtitle">${parts.title2Html}</div>`
    : (parts.title2 ? `<div class="card__subtitle">${escapeHtml(parts.title2)}</div>` : "");

  const iconsHtml = (parts.icons && String(parts.icons).trim())
    ? `<div class="card__icons">${parts.icons}</div>`
    : "";

  const wrapClass = item.category === "gear" ? " card__title-wrap--gear" : "";

  return `
    <div class="card__head">
      <div class="card__title-wrap${wrapClass}">
        ${iconsHtml}
        <div class="card__titles">
          <div class="card__title${namedClass}">${title1Inner}</div>
          ${title2Html}
        </div>
      </div>
    </div>
  `;
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

  if (item.category === "gear") {
    return Number(graphConfig?.gear?.[statKey] ?? 0);
  }
  if (item.category === "weapon") {
    const w = String(item.slot_key || "").trim();
    return Number(
      graphConfig?.weapon?.[w]?.[statKey] ??
      graphConfig?.weapon_default?.[statKey] ??
      0
    );
  }
  if (item.category === "mod") {
    const skill = String(item.slot_key || "").trim();
    if (skill) {
      return Number(
        graphConfig?.mod?.skill?.[skill]?.[statKey] ??
        graphConfig?.mod?.skill_default?.[statKey] ??
        graphConfig?.mod?.gear?.[statKey] ??
        0
      );
    }
    return Number(graphConfig?.mod?.gear?.[statKey] ?? 0);
  }
  return 0;
}


function renderLine(item, ln, colorOverride = "") {
  const lt = String(ln.line_type || "").toLowerCase();
  if (lt === "modslot" || lt === "slot") return "";

  let iconClass = ln.icon_class || "";
  let statEnRaw = ln.stat_en || "";

  if (statEnRaw.includes("<") && !iconClass) {
    iconClass = extractFirstClassFromHtml(statEnRaw);
  }

  const statEn = stripHtml(statEnRaw);
  if (!statEn) return "";
  if (/^[\-–—]+$/.test(statEn)) return "";

  const statKey = String(ln.stat_key || normalizeKey(statEn));
  const stat = (langSelect.value === "ja") ? (i18n[statKey] ?? statEn) : statEn;

  const valueRaw = String(ln.value_raw || "").trim();
  if (valueRaw === "-" || /^[\-–—]+$/.test(valueRaw)) return "";

  const hasValue = !!valueRaw;
  const valuePart = hasValue ? `+${valueRaw}` : "";
  const text = valuePart ? `${valuePart} ${stat}` : `${stat}`;
  if (!text.trim() || /^[\-–—]+$/.test(text.trim())) return "";

  // 色クラス（点は出さない。左帯/ゲージ色に利用）
  const colorClass = colorOverride ? colorOverride : dotColorFromIconClass(iconClass);

  // talent icon（Perfect系は通常版へフォールバック）
  let talentIconHtml = "";
  if (lt === "talent") {
    const tKey = sanitizeFileKey(statKey || normalizeKey(statEn));
    const variants = talentKeyVariants(tKey);
    const isWeapon = item.category === "weapon";
    const primaryDir = isWeapon ? "../img/weapon_talents" : "../img/talents";
    const fallbackDir = isWeapon ? "../img/talents" : "../img/weapon_talents";

    const fallbacks = [];
    // 同一ディレクトリ内で派生キー（通常版/特殊互換）を優先して試す
    for (const k of variants) fallbacks.push(`${primaryDir}/${k}.png`);
    // ディレクトリ違いも試す（weapon_talents ⇄ talents）
    fallbacks.push(`${fallbackDir}/${tKey}.png`);
    for (const k of variants) fallbacks.push(`${fallbackDir}/${k}.png`);
    // 重複排除
    const uniq = [];
    const seen = new Set();
    for (const u of fallbacks) { if (!seen.has(u)) { seen.add(u); uniq.push(u); } }
    const fallbacksUniq = uniq;

    talentIconHtml = iconImgHtml(`${primaryDir}/${tKey}.png`, "ico ico--talent", "talent", fallbacksUniq);
  }

  // gauge（未定義は 0%）
  let gaugeHtml = "";
  const vnum = (ln.value_num != null && ln.value_num !== "") ? Number(ln.value_num) : null;
  if (vnum != null && !Number.isNaN(vnum) && lt !== "talent") {
    const maxv = getGraphMaxValue(item, ln);
    const pct = (maxv > 0) ? Math.max(0, Math.min(100, (vnum / maxv) * 100)) : 0;
    gaugeHtml = `
      <div class="gauge" title="${pct.toFixed(1)}%">
        <div class="gauge__fill" style="width:${pct.toFixed(1)}%"></div>
      </div>
    `;
  }

  const lineClass = `line line--${colorClass} line--${lt}`;

  return `
    <div class="${lineClass}">
      ${talentIconHtml}
      <div class="line__body">
        <div class="line__text">${escapeHtml(text)}</div>
        ${gaugeHtml}
      </div>
    </div>
  `;
}


function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sortLinesForDisplay(lines) {
  const typeOrder = { core: 0, attr: 1, modslot: 1, slot: 1, talent: 2 };
  return (lines || []).slice().sort((a, b) => {
    const oa = typeOrder[a.line_type] ?? 9;
    const ob = typeOrder[b.line_type] ?? 9;
    if (oa !== ob) return oa - ob;
    return (a.ord ?? 0) - (b.ord ?? 0);
  });
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

  const catOrder = ["gear", "weapon", "mod"];

  function sortItems(cat, arr) {
    const a2 = Array.from(arr || []);
    // 表示が安定する程度の簡易ソート
    return a2.sort((x, y) => {
      const sx = `${x.slot_key || ""}|${x.brand_key || ""}|${x.name_en || ""}`.toLowerCase();
      const sy = `${y.slot_key || ""}|${y.brand_key || ""}|${y.name_en || ""}`.toLowerCase();
      return sx.localeCompare(sy);
    });
  }

  for (const vendorKey of vendors) {
    const itemsAll = vendorMap.get(vendorKey) || [];
    const vendorEn = (itemsAll[0] && itemsAll[0].vendor_en) ? itemsAll[0].vendor_en : vendorKey;

    const vendorTitle = (langSelect.value === "ja")
      ? (i18n[vendorKey] ?? vendorEn)
      : vendorEn;

    const groups = {
      gear: sortItems("gear", itemsAll.filter(x => x.category === "gear")),
      weapon: sortItems("weapon", itemsAll.filter(x => x.category === "weapon")),
      mod: sortItems("mod", itemsAll.filter(x => x.category === "mod"))
    };

    const gearCount = groups.gear.length;
    const weaponCount = groups.weapon.length;
    const modCount = groups.mod.length;

    const section = document.createElement("section");
    section.className = "vendor";

    const groupBlocks = catOrder.map(cat => {
      const cnt = groups[cat].length;
      if (!cnt) return "";
      const label = (cat === "gear") ? ui("catGear") : (cat === "weapon") ? ui("catWeapon") : ui("catMod");
      return `
        <div class="catgroup catgroup--${cat}">
          <div class="catgroup__title">${label}</div>
          <div class="grid grid--${cat}"></div>
        </div>
      `;
    }).join("");

    section.innerHTML = `
      <h3 class="vendor__title"><span>${escapeHtml(vendorTitle)}</span></h3>
      <div class="vendor__groups">
        ${groupBlocks}
      </div>
    `;

    for (const cat of catOrder) {
      const grid = section.querySelector(`.grid--${cat}`);
      if (!grid) continue;

      for (const item of groups[cat]) {
        let lines = item.lines || [];
        let colorOverride = "";
        let modCard = null;

        if (item.category === "mod") {
          modCard = computeModCard(item);
          lines = modCard.lines;
          colorOverride = modCard.dotOverride;
        }

        const headParts = buildCardHeadParts(item, modCard);
        const rarityClass = rarityToClass(item.rarity);

        const card = document.createElement("div");
        card.className = `card rarity-${rarityClass} cat-${item.category}`;

        lines = sortLinesForDisplay(lines);

        const linesHtml = lines
          .map(ln => renderLine(item, ln, colorOverride))
          .filter(Boolean)
          .join("");

        card.innerHTML = `
          ${renderCardHead(item, headParts)}
          <div class="lines">${linesHtml}</div>
        `;

        grid.appendChild(card);
      }
    }

    contentEl.appendChild(section);
  }
}


async function loadWeek(userDateStr) {
  const dateStr = normalizeToShopWeekStart(userDateStr);
  // 選択日を「週開始（火曜）」へ寄せる（表示も火曜に揃える）
  if (dateInput && dateStr) dateInput.value = dateStr;
  if (!indexJson) throw new Error("index.json is not loaded");

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
      ORDER BY i.vendor_en, i.category, i.item_id, l.ord
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
          lines: []
        };
        itemMap.set(row.item_id, item);

        const vkey = item.vendor_key;
        if (!vendorMap.has(vkey)) vendorMap.set(vkey, []);
        vendorMap.get(vkey).push(item);
      }

      // modslot は旧仕様なので読み込み段階で捨てる
      if (String(row.line_type || "").toLowerCase() === "modslot") {
        continue;
      }

      const statText = stripHtml(row.stat_en || "");
      if (!statText) continue;
      if (/^[\-–—]+$/.test(statText)) continue;  // "-" だけの行を除外

      const v = String(row.value_raw || "").trim();
      if (v === "-" || /^[\-–—]+$/.test(v)) continue; // "-" だけの値も除外

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

    renderVendors(vendorMap);
    // 表示中の注記は不要：完了したらステータスを消す
    setStatus("");
  } finally {
    db.close();
  }
}

async function boot() {
  applyUiLang();
  setStatus(ui("loadingIndex"));
  indexJson = await fetchJson(`${DATA_BASE}/index.json?ts=${Date.now()}`);

  const i18nFile = indexJson?.i18n?.file || "i18n.json";
  setStatus(ui("loadingI18n"));
  i18n = await fetchJson(`${DATA_BASE}/${i18nFile}?ts=${Date.now()}`);

  // グラフ設定（最大値テーブル）
  try {
    setStatus(ui("loadingGraph"));
    graphConfig = await fetchJson(`${DATA_BASE}/graph_config.json?ts=${Date.now()}`);
  } catch (e) {
    graphConfig = {};
  }

  const defaultDate = indexJson.target_week || new Date().toISOString().slice(0, 10);
  dateInput.value = defaultDate;

  await loadWeek(defaultDate);
}

dateInput.addEventListener("change", () => {
  const d = dateInput.value;
  if (d) loadWeek(d).catch(err => setStatus(`${ui("error")}: ${err.message}`));
});

langSelect.addEventListener("change", () => {
  applyUiLang();
  const d = dateInput.value;
  if (d) loadWeek(d).catch(err => setStatus(`${ui("error")}: ${err.message}`));
});

reloadBtn.addEventListener("click", () => {
  boot().catch(err => setStatus(`${ui("error")}: ${err.message}`));
});

boot().catch(err => {
  console.error(err);
  setStatus(`${ui("loadError")}: ${err.message}`);
});
