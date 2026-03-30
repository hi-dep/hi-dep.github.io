/* blueprint-specific view logic */
(function () {
  let blueprintCache = null;

  const GEAR_SLOTS = ["mask", "backpack", "chest", "glove", "holster", "kneepads"];
  const WEAPON_SLOTS = ["ar", "smg", "lmg", "shotgun", "rifle", "mmr", "pistol"];

  const SLOT_LABEL = {
    ja: {
      ar: "アサルトライフル",
      smg: "SMG",
      lmg: "LMG",
      shotgun: "ショットガン",
      rifle: "ライフル",
      mmr: "マークスマンライフル",
      pistol: "ピストル",
      mask: "マスク",
      backpack: "バックパック",
      chest: "ボディアーマー",
      glove: "グローブ",
      holster: "ホルスター",
      kneepads: "ニーパッド",
    },
    en: {
      ar: "Assault Rifle",
      smg: "SMG",
      lmg: "LMG",
      shotgun: "Shotgun",
      rifle: "Rifle",
      mmr: "Marksman Rifle",
      pistol: "Pistol",
      mask: "Mask",
      backpack: "Backpack",
      chest: "Chest",
      glove: "Gloves",
      holster: "Holster",
      kneepads: "Kneepads",
    },
  };

  const SOURCE_LABEL = {
    "Control Point": { ja: "コントロールポイント", en: "Control Point" },
    "Season": { ja: "過去シーズン", en: "Past Season" },
    "Field Research Technician": { ja: "フィールドリサーチ テクニシャン", en: "Field Research Technician" },
    "Field Research Firewall": { ja: "フィールドリサーチ ファイアウォール", en: "Field Research Firewall" },
    "Field Research Gunner": { ja: "フィールドリサーチ ガンナー", en: "Field Research Gunner" },
    "Reconstructed Caches": { ja: "復元されたキャッシュ", en: "Reconstructed Caches" },
    "Kill Squad": { ja: "キルスクワッド", en: "Kill Squad" },
    "Hyenas completion": { ja: "ハイエナ 報復完了", en: "Hyenas retaliation completion" },
    "Outcasts completion": { ja: "アウトキャスト 報復完了", en: "Outcasts retaliation completion" },
    "Rikers completion": { ja: "ライカーズ 報復完了", en: "Rikers retaliation completion" },
    "True Sons completion": { ja: "トゥルーサンズ 報復完了", en: "True Sons retaliation completion" },
    "Cleaners completion": { ja: "クリーナーズ 報復完了", en: "Cleaners retaliation completion" },
    "Hyenas Kill Squad": { ja: "ハイエナ キルスクワッド", en: "Hyenas Kill Squad" },
    "Outcasts Kill Squad": { ja: "アウトキャスト キルスクワッド", en: "Outcasts Kill Squad" },
    "Rikers Kill Squad": { ja: "ライカーズ キルスクワッド", en: "Rikers Kill Squad" },
    "True Sons Kill Squad": { ja: "トゥルーサンズ キルスクワッド", en: "True Sons Kill Squad" },
    "Cleaners Kill Squad": { ja: "クリーナーズ キルスクワッド", en: "Cleaners Kill Squad" },
    "Blacktusk Kill Squad": { ja: "ブラックタスク キルスクワッド", en: "Blacktusk Kill Squad" },
    "Blacktusk retaliation completion": { ja: "ブラックタスク 報復完了", en: "Blacktusk retaliation completion" },
    "Friend Referral Reward": { ja: "フレンド紹介特典", en: "Friend Referral Reward" },
    "Project: Dodge City Gunslinger's Holster": { ja: "ドッジシティガンスリンガーホルスターのプロジェクト", en: "Project: Dodge City Gunslinger's Holster" },
    "Project: Ridgeway's Pride": { ja: "リッジウェイプライドのプロジェクト", en: "Project: Ridgeway's Pride" },
    "Project: The Chatterbox": { ja: "チャッターボックスのプロジェクト", en: "Project: The Chatterbox" },
    "Project: Nemesis": { ja: "ネメシスのプロジェクト", en: "Project: Nemesis" },
    "Project: Liberty": { ja: "リバティのプロジェクト", en: "Project: Liberty" },
    "Project: Regulus": { ja: "レグルスのプロジェクト", en: "Project: Regulus" },
    "Purchase from Inaya after defeating WoNY Hunters": { ja: "WoNYハンター討伐後、イナヤから購入", en: "Purchase from Inaya after defeating WoNY Hunters" },
    "Purchase from Inaya after defeating DC Hunters": { ja: "DCハンター討伐後、イナヤから購入", en: "Purchase from Inaya after defeating DC Hunters" },
    "Purchase from Inaya after defeating Brooklyn Hunters": { ja: "ブルックリンハンター討伐後、イナヤから購入", en: "Purchase from Inaya after defeating Brooklyn Hunters" },
  };

  function bpUi(key) {
    const isJa = langSelect && langSelect.value === "ja";
    const ja = {
      items: "件",
      category: "カテゴリ",
      category_all: "ギア + 武器",
      category_gear: "ギア",
      category_weapon: "武器",
      status: "状態",
      status_all: "すべて",
      status_available: "取得可能",
      status_unavailable: "未取得",
      search: "検索",
      search_ph: "名前・部位・入手元で検索",
      source: "入手元",
      source_none: "未設定",
      obtainable: "取得可能",
      unobtainable: "未取得",
      season_lock: "シーズン限定",
      gear_sec_brandset: "ブランドセット",
      gear_sec_gearset: "ギアセット",
      gear_sec_exotic: "エキゾチック",
      th_name: "名前",
      th_slot: "部位",
      th_slots: "部位・種別",
      th_rarity: "種別",
      th_source: "入手元",
      th_status: "状態",
      filter_slot: "スロット",
      filter_type: "種別",
      filter_rarity: "rarity",
      selected_only: "選択のみ",
      type_brand: "ブランド",
      type_named: "ネームド",
      type_gearset: "ギアセット",
      type_exotic: "エキゾ",
      type_highend: "ハイエンド",
    };
    const en = {
      items: "items",
      category: "Category",
      category_all: "Gear + Weapon",
      category_gear: "Gear",
      category_weapon: "Weapon",
      status: "Status",
      status_all: "All",
      status_available: "Obtainable",
      status_unavailable: "Unobtainable",
      search: "Search",
      search_ph: "Search by name, slot, source",
      source: "Source",
      source_none: "Unknown",
      obtainable: "Obtainable",
      unobtainable: "Unobtainable",
      season_lock: "Season Locked",
      gear_sec_brandset: "Brandset (incl. Named)",
      gear_sec_gearset: "Gearset",
      gear_sec_exotic: "Exotic",
      th_name: "Name",
      th_slot: "Slot",
      th_slots: "Slot / Type",
      th_rarity: "Type",
      th_source: "Source",
      th_status: "Status",
      filter_slot: "Slot",
      filter_type: "Type",
      filter_rarity: "Rarity",
      selected_only: "Selected only",
      type_brand: "Brand",
      type_named: "Named",
      type_gearset: "Gearset",
      type_exotic: "Exotic",
      type_highend: "High-End",
    };
    const dict = isJa ? ja : en;
    return dict[key] || key;
  }

  function toBool(v) {
    const s = String(v == null ? "" : v).trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }

  function normalizeSlot(v) {
    const s = normalizeKey(v || "");
    if (s === "gloves") return "glove";
    if (s === "kneepad") return "kneepads";
    return s;
  }

  function sourceLabel(raw) {
    const s = String(raw || "").trim();
    if (s === "__EMPTY__") return "";
    if (!s) return bpUi("source_none");
    const hit = SOURCE_LABEL[s];
    if (!hit) return s;
    return (langSelect && langSelect.value === "ja") ? hit.ja : hit.en;
  }

  function slotLabel(slot) {
    const key = normalizeSlot(slot || "");
    const lang = (langSelect && langSelect.value === "ja") ? "ja" : "en";
    return (SLOT_LABEL[lang] && SLOT_LABEL[lang][key]) || slot || "-";
  }

  function localizeName(nameKey, fallback) {
    const key = normalizeKey(nameKey || "");
    const text = String(fallback || "").trim();
    if (langSelect && langSelect.value === "ja") {
      return (key && i18n && i18n[key]) ? String(i18n[key]) : text;
    }
    return text || ((key && i18n && i18n[key]) ? String(i18n[key]) : key);
  }

  function localizeBrand(brand) {
    const raw = String(brand || "").trim();
    if (!raw) return "";
    const key = normalizeKey(raw);
    if (langSelect && langSelect.value === "ja" && key && i18n && i18n[key]) {
      return String(i18n[key]);
    }
    return raw;
  }

  function rarityClass(raw) {
    const k = normalizeKey(raw || "");
    if (k === "exotic") return "rarity-exotic";
    if (k === "named") return "rarity-named";
    if (k === "gearset") return "rarity-gearset";
    return "rarity-highend";
  }

  function rarityLabel(raw) {
    const k = normalizeKey(raw || "");
    if (k === "named") return bpUi("type_named");
    if (k === "gearset") return bpUi("type_gearset");
    if (k === "exotic") return bpUi("type_exotic");
    return bpUi("type_highend");
  }

  function statusBadge(isAvailable, seasonLock) {
    const s1 = isAvailable ? bpUi("obtainable") : bpUi("unobtainable");
    const c1 = isAvailable ? "is-on" : "is-off";
    return `<span class="blueprint-tag ${c1}">${escapeHtml(s1)}</span>${seasonLock ? `<span class="blueprint-tag is-season">${escapeHtml(bpUi("season_lock"))}</span>` : ""}`;
  }

  function acquisitionNoteByDifficulty(kind) {
    const isJa = langSelect && langSelect.value === "ja";
    if (kind === "killsquad") {
      return isJa
        ? "ヒロイック: 95%、チャレンジ: 90%、ハード: 60%、ノーマル: 50%"
        : "Heroic: 95%, Challenging: 90%, Hard: 60%, Normal: 50%";
    }
    if (kind === "completion") {
      return isJa
        ? "ヒロイック: 50%、チャレンジ: 35%、ハード: 10%、ノーマル: 5%"
        : "Heroic: 50%, Challenging: 35%, Hard: 10%, Normal: 5%";
    }
    return "";
  }

  function enrichSourceToken(token) {
    const t = String(token || "").trim();
    if (!t) return "";
    const low = t.toLowerCase();
    if (t.includes("キルスクワッド") || low.includes("kill squad")) {
      const note = acquisitionNoteByDifficulty("killsquad");
      return `${t} (${note})`;
    }
    if (t.includes("報復完了") || low.includes("completion") || low.includes("retaliation completion")) {
      const note = acquisitionNoteByDifficulty("completion");
      return `${t} (${note})`;
    }
    return t;
  }

  function slotIcon(slot, category) {
    const s = normalizeSlot(slot || "");
    const c = normalizeKey(category || "");
    let src = "";
    if (c === "weapon") {
      if (WEAPON_SLOTS.includes(s)) src = appPath(`img/weapons/${s}.png`);
    } else if (c === "gear") {
      if (s === "mask" || s === "backpack" || s === "chest") src = appPath(`img/gears/${s}.png`);
      if (s === "glove") src = appPath("img/gears/gloves.png");
      if (s === "holster") src = appPath("img/gears/holster.png");
      if (s === "kneepads") src = appPath("img/gears/kneepads.png");
    }
    if (!src) return `<span class="blueprint-slot-text">${escapeHtml(slotLabel(s))}</span>`;
    return `<img class="ico ico--item-source blueprint-slot-ico" src="${escapeHtml(src)}" alt="${escapeHtml(slotLabel(s))}" title="${escapeHtml(slotLabel(s))}" loading="lazy" decoding="async" />`;
  }

  async function fetchBlueprintRows() {
    if (blueprintCache) return blueprintCache;
    const SQL = await initSql();
    const v = (window.indexJson && window.indexJson.built_at) ? `?v=${encodeURIComponent(window.indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasBp = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_blueprints'").length > 0;
      if (!hasBp) throw new Error("data_unavailable");

      const out = [];
      const bpStmt = db.prepare("SELECT category, slot, rality, brand, brand_key, name_key, name, blueprint_exists, season_lock, \"from\" AS source FROM items_blueprints");
      while (bpStmt.step()) {
        const r = bpStmt.getAsObject() || {};
        const category = normalizeKey(r.category);
        const slot = normalizeSlot(r.slot);
        if (!category || !slot) continue;
        out.push({
          category,
          slot,
          rality: normalizeKey(r.rality),
          brand: String(r.brand || "").trim(),
          brand_key: normalizeKey(r.brand_key),
          name_key: normalizeKey(r.name_key),
          name: String(r.name || "").trim(),
          blueprint_exists: toBool(r.blueprint_exists),
          season_lock: toBool(r.season_lock),
          source: String(r.source || "").trim(),
        });
      }
      bpStmt.free();
      blueprintCache = out;
      return blueprintCache;
    } finally {
      db.close();
    }
  }

  function loadViewState() {
    const cur = window.blueprintViewState || {};
    const tf = Array.isArray(cur.typeFilter) ? cur.typeFilter.map((x) => normalizeKey(x)).filter(Boolean) : [];
    const ff = Array.isArray(cur.factionFilter) ? cur.factionFilter.map((x) => normalizeKey(x)).filter(Boolean) : [];
    return {
      search: String(cur.search || "").trim(),
      typeFilter: Array.from(new Set(tf)),
      factionFilter: Array.from(new Set(ff)),
      filtersOpen: !!cur.filtersOpen,
      onlySelected: !!cur.onlySelected,
      sortKey: ["name", "slot", "source"].includes(normalizeKey(cur.sortKey || "")) ? normalizeKey(cur.sortKey || "") : "",
      sortDir: ["asc", "desc"].includes(normalizeKey(cur.sortDir || "")) ? normalizeKey(cur.sortDir || "") : "",
    };
  }

  function saveViewState(state) {
    window.blueprintViewState = {
      search: state.search,
      typeFilter: Array.isArray(state.typeFilter) ? state.typeFilter.slice() : [],
      factionFilter: Array.isArray(state.factionFilter) ? state.factionFilter.slice() : [],
      filtersOpen: !!state.filtersOpen,
      onlySelected: !!state.onlySelected,
      sortKey: normalizeKey(state.sortKey || ""),
      sortDir: normalizeKey(state.sortDir || ""),
    };
  }

  function rowSelectionKey(row) {
    const r = row || {};
    const cat = normalizeKey(r.category || "");
    const kindRaw = String(r.kind || "").trim().toLowerCase();
    const slot = normalizeSlot(r.slot || "");
    const rality = normalizeKey(r.rality || "");
    const nk = String(r.name_key || "").trim().toLowerCase();
    const name = String(r.name || "").trim().toLowerCase();
    const itemName = String(r.item_name || "").trim().toLowerCase();
    if (kindRaw === "brand_agg") return `agg::${cat}::${rality}::${name}`;
    return `row::${cat}::${slot}::${rality}::${nk || name || itemName}`;
  }

  function factionIcon(factionKey) {
    const k = normalizeKey(factionKey || "");
    if (!k) return "";
    const src = appPath(`img/faction/${k}.png`);
    return `<img class="ico blueprint-faction-ico" src="${escapeHtml(src)}" alt="${escapeHtml(k)}" title="${escapeHtml(k)}" loading="lazy" decoding="async" />`;
  }

  function buildTypeFilterButtonsHtml(state) {
    const active = new Set(Array.isArray(state.typeFilter) ? state.typeFilter : []);
    const activeFaction = new Set(Array.isArray(state.factionFilter) ? state.factionFilter : []);
    const gearDefs = [
      { key: "mask", category: "gear" },
      { key: "backpack", category: "gear" },
      { key: "chest", category: "gear" },
      { key: "glove", category: "gear" },
      { key: "holster", category: "gear" },
      { key: "kneepads", category: "gear" },
    ];
    const weaponDefs = [
      { key: "ar", label: "AR" },
      { key: "smg", label: "SMG" },
      { key: "lmg", label: "LMG" },
      { key: "shotgun", label: "SG" },
      { key: "rifle", label: "RF" },
      { key: "mmr", label: "MMR" },
      { key: "pistol", label: "HG" },
    ];
    const rarityDefs = [
      { key: "named", label: "NAMED" },
      { key: "exotic", label: "EXOTIC" },
    ];
    const factionDefs = [
      { key: "outcasts" },
      { key: "hyenas" },
      { key: "truesons" },
      { key: "rikers" },
      { key: "cleaners" },
      { key: "blacktusk" },
    ];
    const gearBtns = gearDefs.map((d) => {
      const on = active.has(d.key) ? " is-on" : "";
      return `<button class="btn btn--ghost blueprint-type-btn blueprint-type-btn--icon${on}" type="button" data-blueprint-type="${escapeHtml(d.key)}" title="${escapeHtml(slotLabel(d.key))}" aria-label="${escapeHtml(slotLabel(d.key))}">${slotIcon(d.key, d.category)}</button>`;
    }).join("");
    const weaponBtns = weaponDefs.map((d) => {
      const on = active.has(d.key) ? " is-on" : "";
      return `<button class="btn btn--ghost blueprint-type-btn${on}" type="button" data-blueprint-type="${escapeHtml(d.key)}">${escapeHtml(d.label)}</button>`;
    }).join("");
    const rarityBtns = rarityDefs.map((d) => {
      const on = active.has(d.key) ? " is-on" : "";
      return `<button class="btn btn--ghost blueprint-type-btn${on}" type="button" data-blueprint-type="${escapeHtml(d.key)}">${escapeHtml(d.label)}</button>`;
    }).join("");
    const factionBtns = factionDefs.map((d) => {
      const on = activeFaction.has(d.key) ? " is-on" : "";
      return `<button class="btn btn--ghost blueprint-type-btn blueprint-type-btn--icon${on}" type="button" data-blueprint-faction="${escapeHtml(d.key)}" title="${escapeHtml(d.key)}" aria-label="${escapeHtml(d.key)}">${factionIcon(d.key)}</button>`;
    }).join("");
    return `
      <div class="blueprint-type-filter-group">
        <div class="blueprint-type-filter-buttons">${factionBtns}</div>
      </div>
      <div class="blueprint-type-filter-group">
        <div class="blueprint-type-filter-buttons">${gearBtns}</div>
      </div>
      <div class="blueprint-type-filter-group">
        <div class="blueprint-type-filter-buttons">${weaponBtns}</div>
      </div>
      <div class="blueprint-type-filter-group">
        <div class="blueprint-type-filter-buttons">${rarityBtns}</div>
      </div>
    `;
  }

  function addAggregateRow(map, key, label, rality, sourceRaw, slot, blueprintExists, seasonLock, typeLabel) {
    const k = normalizeKey(key || label || "unknown");
    if (!map.has(k)) {
      map.set(k, {
        kind: "brand_agg",
        category: "gear",
        name: label || "-",
        rality: rality || "highend",
        typeLabel: typeLabel || "",
        slots: {},
        sourceSet: new Set(),
        season_lock: false,
        blueprint_exists: false,
      });
    }
    const ag = map.get(k);
    const sk = normalizeSlot(slot);
    if (!ag.slots[sk]) ag.slots[sk] = { exists: false, season: false };
    ag.slots[sk].exists = ag.slots[sk].exists || !!blueprintExists;
    ag.slots[sk].season = ag.slots[sk].season || !!seasonLock;
    if (sourceRaw) ag.sourceSet.add(sourceLabel(sourceRaw));
    ag.season_lock = ag.season_lock || !!seasonLock;
    ag.blueprint_exists = ag.blueprint_exists || !!blueprintExists;
  }

  function finalizeAggregateRows(map, defaultTypeLabel) {
    const out = [];
    map.forEach((ag) => {
      const source = ag.sourceSet.size ? Array.from(ag.sourceSet).join(", ") : bpUi("source_none");
      const slotSearch = GEAR_SLOTS.map((s) => slotLabel(s)).join(" ");
      out.push({
        kind: "brand_agg",
        category: "gear",
        name: ag.name,
        rality: ag.rality || "highend",
        typeLabel: ag.typeLabel || defaultTypeLabel || "",
        slots: ag.slots || {},
        source,
        season_lock: !!ag.season_lock,
        blueprint_exists: !!ag.blueprint_exists,
        brand_key: normalizeKey(ag.brand_key || ""),
        brand_scope: normalizeKey(ag.brand_scope || (ag.rality === "gearset" ? "gearset" : "brand")),
        search: normalizeKey(`${ag.name} ${slotSearch} ${source} ${ag.typeLabel || defaultTypeLabel || ""}`),
      });
    });
    return out.sort((a, b) => String(a.name).localeCompare(String(b.name), (langSelect && langSelect.value === "ja") ? "ja" : "en"));
  }

  function buildGearRows(rows) {
    const brandAgg = new Map();
    const gearsetAgg = new Map();
    const brandSingles = [];
    const namedMap = new Map();
    const exoticMap = new Map();
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (r.category !== "gear") return;
      const hasBrand = String(r.brand || "").trim().length > 0;
      const hasName = String(r.name || "").trim().length > 0 || String(r.name_key || "").trim().length > 0;
      if (r.rality === "highend" || (!r.rality && hasBrand && !hasName)) {
        const label = localizeBrand(r.brand) || r.brand || "-";
        addAggregateRow(brandAgg, r.brand || label, label, "highend", r.source, r.slot, r.blueprint_exists, r.season_lock, bpUi("type_brand"));
        const ag = brandAgg.get(normalizeKey(r.brand || label || ""));
        if (ag) {
          if (!ag.brand_key) ag.brand_key = normalizeKey(r.brand_key || r.brand || label || "");
          ag.brand_scope = "brand";
        }
        return;
      }
      if (r.rality === "gearset") {
        const label = localizeBrand(r.brand) || localizeName(r.name_key, r.name) || r.brand || "-";
        addAggregateRow(gearsetAgg, r.brand || label, label, "gearset", r.source, r.slot, r.blueprint_exists, r.season_lock, bpUi("type_gearset"));
        const ag = gearsetAgg.get(normalizeKey(r.brand || label || ""));
        if (ag) {
          if (!ag.brand_key) ag.brand_key = normalizeKey(r.brand_key || r.brand || label || "");
          ag.brand_scope = "gearset";
        }
        return;
      }
      const displayName = localizeName(r.name_key, r.name) || localizeBrand(r.brand) || "-";
      const inferredRarity = r.rality || ((!hasBrand && hasName) ? "exotic" : "highend");
      const namedBrand = localizeBrand(r.brand) || r.brand || "";
      const row = {
        kind: "single",
        category: "gear",
        name: (inferredRarity === "named" && namedBrand) ? namedBrand : displayName,
        item_name: displayName,
        name_key: normalizeKey(r.name_key),
        rality: inferredRarity,
        slot: r.slot,
        source: sourceLabel(r.source),
        blueprint_exists: !!r.blueprint_exists,
        season_lock: !!r.season_lock,
        typeLabel: rarityLabel(inferredRarity),
        brand_key: normalizeKey(r.brand_key || r.brand || ""),
        brand_scope: "brand",
        search: normalizeKey(`${displayName} ${namedBrand} ${slotLabel(r.slot)} ${sourceLabel(r.source)} ${rarityLabel(inferredRarity)}`),
      };
      if (inferredRarity === "named" || inferredRarity === "exotic") {
        const key = normalizeKey(`${row.rality}::${row.slot}::${r.name_key || displayName}`);
        const map = inferredRarity === "named" ? namedMap : exoticMap;
        if (!map.has(key)) {
          row._sourceSet = new Set([row.source]);
          map.set(key, row);
        } else {
          const ex = map.get(key);
          ex.blueprint_exists = ex.blueprint_exists || row.blueprint_exists;
          ex.season_lock = ex.season_lock || row.season_lock;
          ex.brand_key = ex.brand_key || row.brand_key;
          ex.brand_scope = ex.brand_scope || row.brand_scope;
          ex._sourceSet.add(row.source);
          ex.source = Array.from(ex._sourceSet).filter(Boolean).join(", ");
          ex.search = normalizeKey(`${ex.name} ${ex.item_name || ""} ${slotLabel(ex.slot)} ${ex.source} ${rarityLabel(ex.rality)}`);
        }
      }
      else brandSingles.push(row);
    });
    const namedRows = Array.from(namedMap.values()).map((x) => {
      delete x._sourceSet;
      return x;
    });
    const exoticRows = Array.from(exoticMap.values()).map((x) => {
      delete x._sourceSet;
      return x;
    });
    brandSingles.sort((a, b) => String(a.name).localeCompare(String(b.name), (langSelect && langSelect.value === "ja") ? "ja" : "en"));
    namedRows.sort((a, b) => String(a.name).localeCompare(String(b.name), (langSelect && langSelect.value === "ja") ? "ja" : "en"));
    exoticRows.sort((a, b) => String(a.name).localeCompare(String(b.name), (langSelect && langSelect.value === "ja") ? "ja" : "en"));
    return {
      brandset: finalizeAggregateRows(brandAgg, bpUi("type_brand")).concat(brandSingles, namedRows),
      gearset: finalizeAggregateRows(gearsetAgg, bpUi("type_gearset")),
      exotic: exoticRows,
    };
  }

  function buildWeaponRows(rows) {
    const groups = {};
    const seen = {};
    WEAPON_SLOTS.forEach((s) => { groups[s] = []; });
    WEAPON_SLOTS.forEach((s) => { seen[s] = new Map(); });
    const rarityRank = (raw) => {
      const k = normalizeKey(raw || "");
      if (k === "exotic") return 3;
      if (k === "named") return 2;
      return 1;
    };
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (r.category !== "weapon") return;
      const slot = normalizeSlot(r.slot);
      if (!WEAPON_SLOTS.includes(slot)) return;
      const name = localizeName(r.name_key, r.name) || localizeBrand(r.brand) || "-";
      const source = sourceLabel(r.source);
      const row = {
        category: "weapon",
        name,
        name_key: normalizeKey(r.name_key),
        slot,
        rality: r.rality || "highend",
        source,
        blueprint_exists: !!r.blueprint_exists,
        season_lock: !!r.season_lock,
        search: normalizeKey(`${name} ${slotLabel(slot)} ${source} ${rarityLabel(r.rality)}`),
      };
      const key = normalizeKey(`${slot}::${r.name_key || name}`);
      if (!seen[slot].has(key)) {
        row._sourceSet = new Set([source]);
        seen[slot].set(key, row);
      } else {
        const ex = seen[slot].get(key);
        if (rarityRank(row.rality) > rarityRank(ex.rality)) ex.rality = row.rality;
        ex.blueprint_exists = ex.blueprint_exists || row.blueprint_exists;
        ex.season_lock = ex.season_lock || row.season_lock;
        ex._sourceSet.add(source);
        ex.source = Array.from(ex._sourceSet).filter(Boolean).join(", ");
        ex.search = normalizeKey(`${ex.name} ${slotLabel(slot)} ${ex.source} ${rarityLabel(ex.rality)}`);
      }
    });
    WEAPON_SLOTS.forEach((s) => {
      groups[s] = Array.from(seen[s].values()).map((x) => {
        delete x._sourceSet;
        return x;
      });
      groups[s].sort((a, b) => String(a.name).localeCompare(String(b.name), (langSelect && langSelect.value === "ja") ? "ja" : "en"));
    });
    return groups;
  }

  function isRowAvailable(row) {
    return !!row.blueprint_exists;
  }

  function filterRows(gearRows, weaponRows, state) {
    const qRaw = String(state.search || "").trim().toLowerCase();
    const q = normalizeKey(state.search || "");
    const activeTypes = new Set(Array.isArray(state.typeFilter) ? state.typeFilter : []);
    const gearTypeKeys = new Set(["mask", "backpack", "chest", "glove", "holster", "kneepads"]);
    const weaponTypeKeys = new Set(["ar", "smg", "lmg", "shotgun", "rifle", "mmr", "pistol"]);
    const rarityTypeKeys = new Set(["named", "exotic"]);
    const selectedSlotTypes = new Set(Array.from(activeTypes).filter((t) => gearTypeKeys.has(t) || weaponTypeKeys.has(t)));
    const selectedRarities = new Set(Array.from(activeTypes).filter((t) => rarityTypeKeys.has(t)));
    const hasGearTypeFilter = Array.from(selectedSlotTypes).some((t) => gearTypeKeys.has(t));
    const hasWeaponTypeFilter = Array.from(selectedSlotTypes).some((t) => weaponTypeKeys.has(t));
    const activeFactions = new Set(Array.isArray(state.factionFilter) ? state.factionFilter : []);
    const selectedOnly = !!(state && state.onlySelected);
    const selectedSet = window.blueprintSelectedRowKeys instanceof Set ? window.blueprintSelectedRowKeys : new Set();
    const factionsFromSource = (text) => {
      const t = String(text || "").toLowerCase();
      const out = new Set();
      if (!t) return out;
      if (t.includes("outcasts") || t.includes("アウトキャスト")) out.add("outcasts");
      if (t.includes("hyenas") || t.includes("ハイエナ")) out.add("hyenas");
      if (t.includes("true sons") || t.includes("truesons") || t.includes("トゥルーサンズ")) out.add("truesons");
      if (t.includes("rikers") || t.includes("ライカーズ")) out.add("rikers");
      if (t.includes("cleaners") || t.includes("クリーナーズ")) out.add("cleaners");
      if (t.includes("blacktusk") || t.includes("black tusk") || t.includes("ブラックタスク")) out.add("blacktusk");
      return out;
    };
    const sourceSearchText = (row) => {
      const available = (row && row.category === "weapon") ? !!(row && row.blueprint_exists) : isRowAvailable(row);
      return sourceDisplayText(row && row.source, available, !!(row && row.season_lock));
    };
    const rowSearchTextRaw = (row) => {
      if (row && row.kind === "brand_agg") {
        const slotNames = GEAR_SLOTS.map((s) => slotLabel(s)).join(" ");
        return `${row.name || ""} ${sourceSearchText(row)} ${row.typeLabel || ""} ${slotNames}`.toLowerCase();
      }
      return `${row.name || ""} ${row.item_name || ""} ${sourceSearchText(row)} ${slotLabel(row && row.slot)} ${row.typeLabel || ""} ${rarityLabel(row && row.rality)}`.toLowerCase();
    };
    const rowFilterTokens = (row) => {
      const tokens = new Set();
      if (row && row.kind === "brand_agg" && row.category === "gear" && row.slots && typeof row.slots === "object") {
        Object.keys(row.slots).forEach((k) => tokens.add(normalizeSlot(k)));
      } else if (row && row.slot) {
        tokens.add(normalizeSlot(row.slot));
      }
      const rk = normalizeKey(row && row.rality ? row.rality : "");
      if (rk === "named" || rk === "exotic") tokens.add(rk);
      return tokens;
    };
    const pass = (row) => {
      if (selectedOnly && !selectedSet.has(rowSelectionKey(row))) return false;
      if (hasGearTypeFilter && (!hasWeaponTypeFilter) && normalizeKey(row && row.category) !== "gear") {
        return false;
      }
      if (hasWeaponTypeFilter && (!hasGearTypeFilter) && normalizeKey(row && row.category) !== "weapon") {
        return false;
      }
      if (selectedSlotTypes.size) {
        const toks = rowFilterTokens(row);
        let slotHit = false;
        selectedSlotTypes.forEach((t) => {
          if (!slotHit && toks.has(t)) slotHit = true;
        });
        if (!slotHit) return false;
      }
      if (selectedRarities.size) {
        const rk = normalizeKey(row && row.rality ? row.rality : "");
        if (!selectedRarities.has(rk)) return false;
      }
      if (activeFactions.size) {
        // When faction filter is active, show only faction-targeted exotic blueprint rows.
        if (normalizeKey(row && row.rality) !== "exotic") return false;
        const fs = factionsFromSource(row && row.source);
        if (!fs.size) return false;
        let fHit = false;
        activeFactions.forEach((f) => {
          if (!fHit && fs.has(f)) fHit = true;
        });
        if (!fHit) return false;
      }
      if (qRaw || q) {
        const raw = rowSearchTextRaw(row);
        const norm = normalizeKey(raw);
        const rawHit = qRaw ? raw.includes(qRaw) : false;
        const normHit = q ? norm.includes(q) : false;
        if (!rawHit && !normHit) return false;
      }
      return true;
    };
    const fg = { brandset: [], gearset: [], exotic: [] };
    fg.brandset = (gearRows.brandset || []).filter(pass);
    fg.gearset = (gearRows.gearset || []).filter(pass);
    fg.exotic = (gearRows.exotic || []).filter(pass);
    const fw = {};
    WEAPON_SLOTS.forEach((s) => { fw[s] = []; });
    WEAPON_SLOTS.forEach((s) => { fw[s] = (weaponRows[s] || []).filter(pass); });
    return { gear: fg, weapon: fw };
  }

  function renderToolbar(state) {
    const open = !!state.filtersOpen;
    const toggleLabel = open ? ui("filtersClose") : ui("filtersOpen");
    const onlySelOn = state.onlySelected ? " is-on" : "";
    return `
      <div class="blueprint-toolbar">
        <button id="blueprintFilterToggleBtn" class="btn btn--ghost topbar__toggle" type="button">${escapeHtml(toggleLabel)}</button>
        <button id="blueprintOnlySelectedBtn" class="btn btn--toggle${onlySelOn}" type="button" data-blueprint-filter-control="1"${open ? "" : " hidden"}>${escapeHtml(bpUi("selected_only"))}</button>
        <label class="field blueprint-toolbar__search" data-blueprint-filter-control="1"${open ? "" : " hidden"}>
          <span>${escapeHtml(bpUi("search"))}</span>
          <input type="text" data-blueprint-filter="search" value="${escapeHtml(state.search || "")}" placeholder="${escapeHtml(bpUi("search_ph"))}" />
        </label>
      </div>
      <div class="blueprint-type-filter-row" data-blueprint-filter-control="1"${open ? "" : " hidden"}>
        ${buildTypeFilterButtonsHtml(state)}
      </div>
    `;
  }

  function renderGearSlotsCell(row) {
    if (row.kind !== "brand_agg") {
      const onoff = row.blueprint_exists ? "is-on" : "is-off";
      const season = row.season_lock ? " has-season" : "";
      if (row.rality === "named") {
        const itemName = String(row.item_name || row.name || "-").trim();
        const itemNameHtml = `<button type="button" class="inline-pop-trigger line__text-pop-trigger" data-pop-type="blueprint-named" data-named-kind="gear" data-named-name="${escapeHtml(itemName)}" data-named-name-key="${escapeHtml(String(row.name_key || ""))}">${escapeHtml(itemName)}</button>`;
        return `<span class="blueprint-slot-inline"><span class="blueprint-slot-pill ${onoff}${season}">${slotIcon(row.slot, "gear")}</span><span class="blueprint-slot-inline-name">${itemNameHtml}</span></span>`;
      }
      return `<span class="blueprint-slot-pill ${onoff}${season}">${slotIcon(row.slot, "gear")}</span>`;
    }
    const chips = GEAR_SLOTS.map((s) => {
      const st = row.slots[s] || { exists: false, season: false };
      const cls = st.exists ? "is-on" : "is-off";
      const season = st.season ? " has-season" : "";
      return `<span class="blueprint-slot-pill ${cls}${season}" title="${escapeHtml(slotLabel(s))}">${slotIcon(s, "gear")}</span>`;
    }).join("");
    return `<div class="blueprint-slot-pack">${chips}</div>`;
  }

  function sourceDisplayText(sourceText, available, seasonLock) {
    const isJa = langSelect && langSelect.value === "ja";
    const srcRaw = String(sourceText || "").trim();
    if (srcRaw === "__EMPTY__") return "";
    const seasonUnavailableText = isJa
      ? "過去シーズン報酬限定（現在取得不可）"
      : "Past season reward only (currently unobtainable)";
    if (seasonLock) return seasonUnavailableText;
    const sourceNone = bpUi("source_none");
    const sourceMissing = !srcRaw || srcRaw === sourceNone;
    if (sourceMissing) {
      if (available && !seasonLock) {
        return (isJa
          ? "プロジェクト・サミットチャレンジ・警戒レベル3以上のコントロールポイント"
          : "Project / Summit Challenge / Control Point Alert Level 3+");
      }
      return "";
    }
    const tokens = srcRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const enriched = tokens.map(enrichSourceToken).filter(Boolean);
    const text = enriched.length ? enriched.join(" / ") : srcRaw;
    return text;
  }

  function renderSourceStatusCell(sourceText, available, seasonLock) {
    return escapeHtml(sourceDisplayText(sourceText, available, seasonLock));
  }

  function renderWeaponSlotTypeCell(slot, isAvailable, seasonLock) {
    const s = normalizeSlot(slot);
    const fullLabel = slotLabel(s);
    const cls = isAvailable ? "is-on" : "is-off";
    const season = seasonLock ? " has-season" : "";
    return `<span class="blueprint-slot-inline"><span class="blueprint-slot-pill ${cls}${season}">${slotIcon(s, "weapon")}</span><span class="blueprint-slot-inline-name">${escapeHtml(fullLabel)}</span></span>`;
  }

  function sortMark(state, key) {
    const sk = normalizeKey((state && state.sortKey) || "");
    if (sk !== key) return "";
    const dir = normalizeKey((state && state.sortDir) || "");
    if (dir === "desc") return " ▼";
    if (dir === "asc") return " ▲";
    return "";
  }

  function renderBlueprintNameCell(row) {
    const r = row || {};
    const category = normalizeKey(r.category || "");
    const rarity = normalizeKey(r.rality || "");
    const name = String(r.name || "").trim();
    if (!name) return escapeHtml("-");
    if (rarity === "exotic") {
      const exoticKind = category === "weapon" ? "weapon" : "gear";
      return `<button type="button" class="inline-pop-trigger line__text-pop-trigger" data-pop-type="blueprint-exotic" data-exotic-kind="${escapeHtml(exoticKind)}" data-exotic-name="${escapeHtml(name)}" data-exotic-name-key="${escapeHtml(String(r.name_key || ""))}">${escapeHtml(name)}</button>`;
    }
    if (rarity === "named" && category === "weapon") {
      const itemName = String(r.item_name || r.name || "").trim();
      return `<button type="button" class="inline-pop-trigger line__text-pop-trigger" data-pop-type="blueprint-named" data-named-kind="weapon" data-named-name="${escapeHtml(itemName || name)}" data-named-name-key="${escapeHtml(String(r.name_key || ""))}">${escapeHtml(name)}</button>`;
    }
    if (category !== "gear") return escapeHtml(r.name || "");
    const isBrandLabelRow = (String(r.kind || "").toLowerCase() === "brand_agg") || rarity === "named";
    if (!isBrandLabelRow) return escapeHtml(r.name || "");
    const brandKey = normalizeKey(r.brand_key || "");
    const brandScope = normalizeKey(r.brand_scope || "brand");
    if (!brandKey) return escapeHtml(name);
    return `<button type="button" class="inline-pop-trigger line__text-pop-trigger" data-pop-type="brand" data-brand-scope="${escapeHtml(brandScope)}" data-brand-key="${escapeHtml(brandKey)}" data-brand-name="${escapeHtml(name)}">${escapeHtml(name)}</button>`;
  }

  function renderGearRowsWithSection(rows, sectionLabel) {
    void sectionLabel;
    if (!rows.length) return "";
    const body = rows.map((r) => {
      const rowClass = `blueprint-row ${rarityClass(r.rality)}`;
      return `
      <tr class="${rowClass}">
        <td class="blueprint-td-accent"><span class="blueprint-accent"></span></td>
        <td class="blueprint-td-name">${escapeHtml(r.name)}</td>
        <td class="blueprint-td-slots">${renderGearSlotsCell(r)}</td>
        <td class="blueprint-td-source">${renderSourceStatusCell(r.source, isRowAvailable(r), !!r.season_lock)}</td>
      </tr>`;
    }).join("");
    return body;
  }

  function renderWeaponRowsWithSection(slot, rows) {
    void slot;
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) return "";
    const body = list.map((r) => `
      <tr class="blueprint-row ${rarityClass(r.rality)}">
        <td class="blueprint-td-accent"><span class="blueprint-accent"></span></td>
        <td class="blueprint-td-name">${escapeHtml(r.name)}</td>
        <td class="blueprint-td-slots">${renderWeaponSlotTypeCell(r.slot, !!r.blueprint_exists, !!r.season_lock)}</td>
        <td class="blueprint-td-source">${renderSourceStatusCell(r.source, !!r.blueprint_exists, !!r.season_lock)}</td>
      </tr>
    `).join("");
    return body;
  }

  function renderUnifiedTable(gearGroups, weaponGroups, state) {
    const b = (gearGroups && gearGroups.brandset) ? gearGroups.brandset : [];
    const g = (gearGroups && gearGroups.gearset) ? gearGroups.gearset : [];
    const e = (gearGroups && gearGroups.exotic) ? gearGroups.exotic : [];
    const rows = []
      .concat(b, g, e)
      .concat(WEAPON_SLOTS.flatMap((slot) => ((weaponGroups && weaponGroups[slot]) || [])));
    if (!rows.length) return "";

    const sortKey = normalizeKey((state && state.sortKey) || "");
    const sortDir = normalizeKey((state && state.sortDir) || "");
    if (["name", "slot", "source"].includes(sortKey) && ["asc", "desc"].includes(sortDir)) {
      const factor = sortDir === "desc" ? -1 : 1;
      const locale = (langSelect && langSelect.value === "ja") ? "ja" : "en";
      const slotSortText = (r) => {
        if (r && r.kind === "brand_agg" && r.slots && typeof r.slots === "object") {
          return GEAR_SLOTS.filter((s) => !!r.slots[s]).map((s) => slotLabel(s)).join(" ");
        }
        return slotLabel((r && r.slot) || "");
      };
      const keyText = (r) => {
        if (sortKey === "slot") return String(slotSortText(r) || "").toLowerCase();
        if (sortKey === "source") {
          const available = (r && r.category === "weapon") ? !!(r && r.blueprint_exists) : isRowAvailable(r);
          return String(sourceDisplayText(r && r.source, available, !!(r && r.season_lock)) || "").toLowerCase();
        }
        return String((r && r.name) || "").toLowerCase();
      };
      rows.sort((a, b2) => {
        const c = keyText(a).localeCompare(keyText(b2), locale);
        if (c !== 0) return c * factor;
        return String((a && a.name) || "").localeCompare(String((b2 && b2.name) || ""), locale);
      });
    }

    const body = rows.map((r) => {
      const rowKey = rowSelectionKey(r);
      const selectedSet = window.blueprintSelectedRowKeys instanceof Set ? window.blueprintSelectedRowKeys : new Set();
      const selectedClass = selectedSet.has(rowKey) ? " is-selected" : "";
      const rowClass = `blueprint-row ${rarityClass(r.rality)}`;
      if (r.category === "weapon") {
        return `
      <tr class="${rowClass}${selectedClass}" data-bp-rowkey="${escapeHtml(rowKey)}">
        <td class="blueprint-td-accent"><span class="blueprint-accent"></span></td>
        <td class="blueprint-td-name">${renderBlueprintNameCell(r)}</td>
        <td class="blueprint-td-slots">${renderWeaponSlotTypeCell(r.slot, !!r.blueprint_exists, !!r.season_lock)}</td>
        <td class="blueprint-td-source">${renderSourceStatusCell(r.source, !!r.blueprint_exists, !!r.season_lock)}</td>
      </tr>`;
      }
      return `
      <tr class="${rowClass}${selectedClass}" data-bp-rowkey="${escapeHtml(rowKey)}">
        <td class="blueprint-td-accent"><span class="blueprint-accent"></span></td>
        <td class="blueprint-td-name">${renderBlueprintNameCell(r)}</td>
        <td class="blueprint-td-slots">${renderGearSlotsCell(r)}</td>
        <td class="blueprint-td-source">${renderSourceStatusCell(r.source, isRowAvailable(r), !!r.season_lock)}</td>
      </tr>`;
    }).join("");
    return `
      <section class="blueprint-table-wrap">
        <div class="blueprint-table-scroll">
          <table class="blueprint-table">
            <thead>
              <tr>
                <th class="blueprint-th-accent"></th>
                <th class="blueprint-th-sort" data-blueprint-sort="name">${escapeHtml(bpUi("th_name") + sortMark(state, "name"))}</th>
                <th class="blueprint-th-sort" data-blueprint-sort="slot">${escapeHtml(bpUi("th_slots") + sortMark(state, "slot"))}</th>
                <th class="blueprint-th-sort" data-blueprint-sort="source">${escapeHtml(bpUi("th_source") + sortMark(state, "source"))}</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>
    `;
  }

  function bindToolbarEvents(allRows) {
    const toggleBtn = contentEl.querySelector("#blueprintFilterToggleBtn");
    const onlySelectedBtn = contentEl.querySelector("#blueprintOnlySelectedBtn");
    const searchEl = contentEl.querySelector('[data-blueprint-filter="search"]');
    const typeBtns = Array.from(contentEl.querySelectorAll('[data-blueprint-type]'));
    const factionBtns = Array.from(contentEl.querySelectorAll('[data-blueprint-faction]'));
    const sortThs = Array.from(contentEl.querySelectorAll('[data-blueprint-sort]'));
    const rowEls = Array.from(contentEl.querySelectorAll("tr[data-bp-rowkey]"));
    const rerender = () => {
      const keepSearchFocus = !!(searchEl && document.activeElement === searchEl);
      const selStart = keepSearchFocus ? searchEl.selectionStart : null;
      const selEnd = keepSearchFocus ? searchEl.selectionEnd : null;
      const state = {
        search: String((searchEl && searchEl.value) || ""),
        typeFilter: Array.isArray(window.blueprintTypeFilter) ? window.blueprintTypeFilter.slice() : [],
        factionFilter: Array.isArray(window.blueprintFactionFilter) ? window.blueprintFactionFilter.slice() : [],
        filtersOpen: !!window.blueprintFiltersOpen,
        onlySelected: !!window.blueprintOnlySelected,
        sortKey: normalizeKey(window.blueprintSortKey || ""),
        sortDir: normalizeKey(window.blueprintSortDir || ""),
      };
      saveViewState(state);
      renderBlueprint(allRows, state);
      if (keepSearchFocus && state.filtersOpen) {
        const next = contentEl.querySelector('[data-blueprint-filter="search"]');
        if (next) {
          next.focus();
          try {
            const s = (typeof selStart === "number") ? selStart : next.value.length;
            const e = (typeof selEnd === "number") ? selEnd : next.value.length;
            next.setSelectionRange(s, e);
          } catch (_) {}
        }
      }
    };
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        window.blueprintFiltersOpen = !window.blueprintFiltersOpen;
        rerender();
      });
    }
    if (onlySelectedBtn) {
      onlySelectedBtn.addEventListener("click", () => {
        window.blueprintOnlySelected = !window.blueprintOnlySelected;
        rerender();
      });
    }
    if (!searchEl) return;
    let isComposing = false;
    searchEl.addEventListener("compositionstart", () => {
      isComposing = true;
    });
    searchEl.addEventListener("compositionend", () => {
      isComposing = false;
      rerender();
    });
    searchEl.addEventListener("input", (ev) => {
      if (isComposing || (ev && ev.isComposing)) {
        const state = {
          search: String(searchEl.value || ""),
          typeFilter: Array.isArray(window.blueprintTypeFilter) ? window.blueprintTypeFilter.slice() : [],
          factionFilter: Array.isArray(window.blueprintFactionFilter) ? window.blueprintFactionFilter.slice() : [],
          filtersOpen: !!window.blueprintFiltersOpen,
          onlySelected: !!window.blueprintOnlySelected,
          sortKey: normalizeKey(window.blueprintSortKey || ""),
          sortDir: normalizeKey(window.blueprintSortDir || ""),
        };
        saveViewState(state);
        return;
      }
      rerender();
    });
    typeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = normalizeKey(btn.getAttribute("data-blueprint-type") || "");
        if (!key) return;
        const cur = new Set(Array.isArray(window.blueprintTypeFilter) ? window.blueprintTypeFilter : []);
        if (cur.has(key)) cur.delete(key);
        else cur.add(key);
        window.blueprintTypeFilter = Array.from(cur);
        rerender();
      });
    });
    factionBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = normalizeKey(btn.getAttribute("data-blueprint-faction") || "");
        if (!key) return;
        const cur = new Set(Array.isArray(window.blueprintFactionFilter) ? window.blueprintFactionFilter : []);
        if (cur.has(key)) cur.delete(key);
        else cur.add(key);
        window.blueprintFactionFilter = Array.from(cur);
        rerender();
      });
    });
    sortThs.forEach((th) => {
      th.addEventListener("click", () => {
        const key = normalizeKey(th.getAttribute("data-blueprint-sort") || "");
        if (!key) return;
        if (window.blueprintSortKey === key) {
          if (window.blueprintSortDir === "asc") {
            window.blueprintSortDir = "desc";
          } else if (window.blueprintSortDir === "desc") {
            window.blueprintSortKey = "";
            window.blueprintSortDir = "";
          } else {
            window.blueprintSortDir = "asc";
          }
        } else {
          window.blueprintSortKey = key;
          window.blueprintSortDir = "asc";
        }
        rerender();
      });
    });
    rowEls.forEach((tr) => {
      tr.addEventListener("click", () => {
        if (!window.blueprintFiltersOpen) return;
        const key = String(tr.getAttribute("data-bp-rowkey") || "").trim();
        if (!key) return;
        if (!(window.blueprintSelectedRowKeys instanceof Set)) window.blueprintSelectedRowKeys = new Set();
        if (window.blueprintSelectedRowKeys.has(key)) window.blueprintSelectedRowKeys.delete(key);
        else window.blueprintSelectedRowKeys.add(key);
        rerender();
      });
    });
  }

  function renderBlueprint(allRows, state) {
    clearContent();
    const gearRows = buildGearRows(allRows);
    const weaponRows = buildWeaponRows(allRows);
    const filtered = filterRows(gearRows, weaponRows, state);
    const toolbar = renderToolbar(state);
    const hasGear = (filtered.gear.brandset || []).length || (filtered.gear.gearset || []).length || (filtered.gear.exotic || []).length;
    const hasWeapon = WEAPON_SLOTS.some((s) => (filtered.weapon[s] || []).length > 0);
    const hasAny = hasGear || hasWeapon;
    if (!hasAny) {
      contentEl.innerHTML = `
        <section class="blueprint-view">
          ${toolbar}
          <div class="status">${escapeHtml(ui("noData"))}</div>
        </section>
      `;
      bindToolbarEvents(allRows);
      return;
    }
    contentEl.innerHTML = `
      <section class="blueprint-view">
        ${toolbar}
        ${renderUnifiedTable(filtered.gear, filtered.weapon, state)}
      </section>
    `;
    bindToolbarEvents(allRows);
  }

  async function blueprintViewRender() {
    const rows = await fetchBlueprintRows();
    const state = loadViewState();
    window.blueprintTypeFilter = Array.isArray(state.typeFilter) ? state.typeFilter.slice() : [];
    window.blueprintFactionFilter = Array.isArray(state.factionFilter) ? state.factionFilter.slice() : [];
    window.blueprintFiltersOpen = !!state.filtersOpen;
    window.blueprintOnlySelected = !!state.onlySelected;
    if (!(window.blueprintSelectedRowKeys instanceof Set)) window.blueprintSelectedRowKeys = new Set();
    window.blueprintSortKey = ["name", "slot", "source"].includes(normalizeKey(state.sortKey || "")) ? normalizeKey(state.sortKey || "") : "";
    window.blueprintSortDir = ["asc", "desc"].includes(normalizeKey(state.sortDir || "")) ? normalizeKey(state.sortDir || "") : "";
    renderBlueprint(rows, state);
  }

  window.blueprintViewRender = blueprintViewRender;
})();
