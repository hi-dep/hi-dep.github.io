/* item-sources specific view logic */
(function () {
  const ENTITY_TYPES = ["brandset", "gear_named"];
  const TAG_ORDER = [
    "general",
    "craft",
    "craft_only",
    "craft_sp",
    "dz_cache",
    "conflict_cache",
    "target_loot:brand",
    "target_loot:mask",
    "target_loot:backpack",
    "target_loot:chest",
    "target_loot:gloves",
    "target_loot:holster",
    "target_loot:kneepads",
    "pvp_dz",
    "pvp_conflict",
    "named_cache",
    "legacy_season_cache",
    "season_manhunt",
    "no_drop",
    "exotic_cache",
    "event",
    "mission",
    "other",
  ];
  const CACHE_TAGS = new Set([
    "field_proficiency_cache",
    "named_item_cache",
    "named_cache",
    "conflict_cache",
    "exotic_cache",
    "season_cache",
    "legacy_season_cache",
    "dz_cache",
  ]);
  const DROP_TAGS = new Set([
    "general",
    "pvp_dz",
    "pvp_conflict",
    "dz_cache",
    "conflict_cache",
    "named_cache",
    "legacy_season_cache",
    "season_manhunt",
    "no_drop",
    "exotic_cache",
    "event",
    "mission",
    "other",
  ]);
  if (!Array.isArray(window.itemSourcesEntityFilter)) {
    window.itemSourcesEntityFilter = [];
  }
  if (!Array.isArray(window.itemSourcesTagFilter)) {
    window.itemSourcesTagFilter = [];
  }
  if (typeof window.itemSourcesSearchText !== "string") {
    window.itemSourcesSearchText = "";
  }

  let rowsCache = null;

  function parseTargetLootTag(tag) {
    const raw = String(tag || "").trim().toLowerCase();
    if (raw.startsWith("target_loot:")) {
      const parts = raw.split(":");
      const target = normalizeKey(parts[1] || "");
      const scopeRaw = normalizeKey(parts[2] || "");
      const scope = (scopeRaw === "dz" || scopeRaw === "lz" || scopeRaw === "any") ? scopeRaw : "";
      if (!target) return null;
      return { target, scope };
    }

    // Fallback for normalized keys used in filters (e.g. "targetlootmaskdz")
    const k = normalizeKey(tag || "");
    if (!k.startsWith("targetloot")) return null;
    let rest = k.slice("targetloot".length);
    let scope = "";
    if (rest.endsWith("dz")) {
      scope = "dz";
      rest = rest.slice(0, -2);
    } else if (rest.endsWith("lz")) {
      scope = "lz";
      rest = rest.slice(0, -2);
    } else if (rest.endsWith("any")) {
      scope = "any";
      rest = rest.slice(0, -3);
    }
    const target = normalizeKey(rest || "");
    if (!target) return null;
    return { target, scope };
  }

  function parseCraftTag(tag) {
    const raw = String(tag || "").trim().toLowerCase();
    if (!raw) return null;
    if (raw === "craft_sp") {
      return { slot: "", source: "sp", isOnly: true };
    }
    if (raw === "craft_only" || raw === "craft") {
      return { slot: "", source: "", isOnly: true };
    }
    if (raw.startsWith("craft:")) {
      const parts = raw.split(":").slice(1);
      const slot = normalizeKey(parts[0] || "");
      let source = normalizeKey(parts[1] || "");
      if (source === "reconstructed") source = "rc";
      if (!slot) return { slot: "", source, isOnly: true };
      return { slot, source, isOnly: false };
    }
    return null;
  }

  function entityLabel(key) {
    const k = normalizeKey(key || "");
    if (k === "brandset") return "Brandset";
    if (k === "gear_named") return "Named Gear";
    return key || "";
  }

  function tagLabel(key) {
    const k = normalizeKey(key || "");
    const ja = langSelect.value === "ja";
    const tl = parseTargetLootTag(key);
    if (tl) {
      const tKey = tl.target;
      const scope = tl.scope;
      if (ja) {
        const prefix = scope === "dz" ? "目標アイテム(DZ)" : (scope === "lz" ? "目標アイテム(LZ)" : "目標アイテム");
        if (tKey === "brand") return `${prefix}: ブランド指定`;
        const slotJa = i18n[tKey] || tKey;
        return `${prefix}: ${slotJa}`;
      }
      const prefix = scope === "dz" ? "Targeted Loot (DZ)" : (scope === "lz" ? "Targeted Loot (LZ)" : "Targeted Loot");
      if (tKey === "brand") return `${prefix}: Brand`;
      return `${prefix}: ${tKey}`;
    }
    const map = {
      general: ja ? "一般" : "General",
      craft_only: ja ? "クラフト限定" : "Craft Only",
      craft: ja ? "クラフト限定" : "Craft Only",
      craft_sp: ja ? "SP設計図クラフト" : "SP Blueprint Craft",
      pvp_dz: ja ? "DZ" : "DZ",
      pvp_conflict: ja ? "コンフリクト" : "Conflict",
      dz_cache: ja ? "DZキャッシュ" : "DZ Cache",
      conflict_cache: ja ? "コンフリクトキャッシュ" : "Conflict Cache",
      named_cache: ja ? "ネームドキャッシュ" : "Named Cache",
      named_item_cache: ja ? "名前付きアイテムキャッシュ" : "Named Item Cache",
      field_proficiency_cache: ja ? "フィールドマスターキャッシュ" : "Field Proficiency Cache",
      legacy_season_cache: ja ? "レガシーシーズンキャッシュ" : "Legacy Season Cache",
      season_cache: ja ? "シーズンキャッシュ" : "Season Cache",
      season_manhunt: ja ? "シーズンマンハント" : "Season Manhunt",
      no_drop: ja ? "通常ドロップなし" : "No Regular Drop",
      exotic_cache: ja ? "エキゾチックキャッシュ" : "Exotic Cache",
      event: ja ? "イベント" : "Event",
      mission: ja ? "ミッション" : "Mission",
      other: ja ? "その他" : "Other",
    };
    return map[k] || key || "";
  }

  function trByKeyFallback(key, fallbackText) {
    const k = normalizeKey(key || "");
    if (langSelect.value !== "ja") return String(fallbackText || "");
    return i18n[k] || String(fallbackText || "");
  }

  function localizeBlueprintSource(sourceText) {
    const s = String(sourceText || "").trim();
    if (!s) return s;
    const table = {
      "Reconstructed Caches": { ja: "復元キャッシュ", en: "Reconstructed Caches" },
      "Kill Squad": { ja: "キルスクワッド", en: "Kill Squad" },
      "completion": { ja: "コンプリート", en: "completion" },
      "Hyenas completion": { ja: "ハイエナコンプリート", en: "Hyenas completion" },
      "Outcasts completion": { ja: "アウトキャストコンプリート", en: "Outcasts completion" },
      "Rikers completion": { ja: "ライカーズコンプリート", en: "Rikers completion" },
      "True Sons completion": { ja: "トゥルーサンズコンプリート", en: "True Sons completion" },
      "Cleaners completion": { ja: "クリーナーズコンプリート", en: "Cleaners completion" },
      "Hyenas Kill Squad": { ja: "ハイエナ キルスクワッド", en: "Hyenas Kill Squad" },
      "Outcasts Kill Squad": { ja: "アウトキャスト キルスクワッド", en: "Outcasts Kill Squad" },
      "Rikers Kill Squad": { ja: "ライカーズ キルスクワッド", en: "Rikers Kill Squad" },
      "True Sons Kill Squad": { ja: "トゥルーサンズ キルスクワッド", en: "True Sons Kill Squad" },
      "Cleaners Kill Squad": { ja: "クリーナーズ キルスクワッド", en: "Cleaners Kill Squad" },
    };
    const hit = table[s];
    if (!hit) return s;
    return langSelect.value === "ja" ? hit.ja : hit.en;
  }

  function localizeAcquisitionNote(noteText) {
    const raw = String(noteText || "").trim();
    if (!raw) return "";
    const lines = raw.split(/\r?\n/).map((x) => String(x || "").trim()).filter(Boolean);
    const out = [];
    lines.forEach((ln) => {
      const srcJa = "設計図ソース:";
      const srcEn = "Blueprint Source:";
      if (ln.startsWith(srcJa)) {
        const src = localizeBlueprintSource(ln.slice(srcJa.length).trim());
        out.push((langSelect.value === "ja") ? `${srcJa} ${src}` : `${srcEn} ${src}`);
        return;
      }
      if (ln.startsWith(srcEn)) {
        const src = localizeBlueprintSource(ln.slice(srcEn.length).trim());
        out.push((langSelect.value === "ja") ? `${srcJa} ${src}` : `${srcEn} ${src}`);
        return;
      }

      const dict = {
        "スペシャリゼーションのフィールドリサーチ報酬で得られる設計図が必要": {
          ja: "スペシャリゼーションのフィールドリサーチ報酬で得られる設計図が必要",
          en: "Requires a blueprint earned from Specialization Field Research rewards",
        },
        "ハンターパズル完了後にキャシーの店で購入、またはクラフトで入手": {
          ja: "ハンターパズル完了後にキャシーの店で購入、またはクラフトで入手",
          en: "After completing Hunter puzzles, obtainable via Cassie purchase or crafting",
        },
        "スペシャルイベントホーダー限定ドロップ": {
          ja: "スペシャルイベントホーダー限定ドロップ",
          en: "Drops only from special event hoarder",
        },
      };
      const hit = dict[ln];
      if (hit) {
        out.push(langSelect.value === "ja" ? hit.ja : hit.en);
        return;
      }
      out.push(ln);
    });
    return out.join("\n");
  }

  function targetLootIconHtml(row, tag, brandNameByKey) {
    const tl = parseTargetLootTag(tag);
    if (!tl) return "";
    const tKey = normalizeKey(tl.target || "");
    const scope = normalizeKey(tl.scope || "");
    if (!tKey) return "";

    let src = "";
    let alt = tagLabel(tag);
    if (tKey === "brand") {
      const bKey = normalizeKey(row.brand_key || "");
      const brandFallback = (brandNameByKey && brandNameByKey.get(bKey)) || row.brand_key || alt;
      src = iconUrl("brands", bKey, "img/brands");
      alt = trByKeyFallback(bKey, brandFallback);
    } else {
      src = iconUrl("gear_slots", tKey, "img/gears");
      alt = trByKeyFallback(tKey, tKey || alt);
    }
    if (!src) {
      return `<span class="item-source-tag">${escapeHtml(tagLabel(tag))}</span>`;
    }
    const badge = scope === "dz"
      ? `<span class="item-source-scope">DZ</span>`
      : (scope === "lz" ? `<span class="item-source-scope">LZ</span>` : "");
    return `<span class="item-source-icon" title="${escapeHtml(tagLabel(tag))}">${iconImgHtml(src, "ico ico--item-source", alt)}${badge}</span>`;
  }

  function craftIconHtml(tag) {
    const c = parseCraftTag(tag);
    if (!c) return "";
    if (c.isOnly || !c.slot) {
      const onlyLabel = c.source === "sp"
        ? (langSelect.value === "ja" ? "クラフト限定(SP)" : "Craft Only (SP)")
        : tagLabel("craft_only");
      return `<span class="item-source-tag">${escapeHtml(onlyLabel)}</span>`;
    }
    const src = iconUrl("gear_slots", c.slot, "img/gears");
    if (!src) {
      return `<span class="item-source-tag">${escapeHtml(`Craft:${c.slot}`)}</span>`;
    }
    const alt = trByKeyFallback(c.slot, c.slot);
    let sourceBadge = "";
    let sourceText = "";
    if (c.source === "sp") {
      sourceBadge = `<span class="item-source-scope">SP</span>`;
      sourceText = (langSelect.value === "ja") ? " / SP設計図" : " / SP Blueprint";
    } else if (c.source === "cp") {
      sourceBadge = `<span class="item-source-scope">CP</span>`;
      sourceText = (langSelect.value === "ja") ? " / CP設計図" : " / CP Blueprint";
    } else if (c.source === "rc") {
      sourceBadge = `<span class="item-source-scope">RC</span>`;
      sourceText = (langSelect.value === "ja") ? " / 復元キャッシュ設計図" : " / Reconstructed Cache Blueprint";
    }
    return `<span class="item-source-icon" title="${escapeHtml(`${tagLabel("craft")}: ${alt}${sourceText}`)}">${iconImgHtml(src, "ico ico--item-source", alt)}${sourceBadge}</span>`;
  }

  async function loadItemSourcesRows() {
    if (rowsCache) return rowsCache;
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const obj = await fetchJson(`${DATA_BASE}/item_sources.json${v}`);
    const rows = Array.isArray(obj?.rows) ? obj.rows : [];
    rowsCache = rows.filter((r) => r && typeof r === "object");
    return rowsCache;
  }

  function matchesFilters(row) {
    const entityActive = new Set(Array.isArray(window.itemSourcesEntityFilter) ? window.itemSourcesEntityFilter : []);
    const tagActive = new Set(Array.isArray(window.itemSourcesTagFilter) ? window.itemSourcesTagFilter : []);
    const search = normalizeKey(window.itemSourcesSearchText || "");

    const entity = normalizeKey(row.entity_type || "");
    if (entityActive.size && !entityActive.has(entity)) return false;

    const tags = []
      .concat(Array.isArray(row.acquisition_tags) ? row.acquisition_tags : [])
      .concat(Array.isArray(row.drop_tags) ? row.drop_tags : [])
      .map((t) => normalizeKey(t || ""))
      .filter(Boolean);
    if (tagActive.size && !Array.from(tagActive).every((t) => tags.includes(t))) return false;

    if (search) {
      const parts = [
        row.item_id,
        row.entity_type,
        row.category,
        row.name_key,
        row.name,
        row.brand_key,
        row.slot_key,
        ...(Array.isArray(row.acquisition_tags) ? row.acquisition_tags : []),
        ...(Array.isArray(row.drop_tags) ? row.drop_tags : []),
        row.acquisition_note,
      ];
      const hay = normalizeKey(parts.map((x) => String(x || "")).join(" "));
      if (!hay.includes(search)) return false;
    }
    return true;
  }

  function renderFilters(rows) {
    const searchPh = (langSelect.value === "ja") ? "検索（名前/タグ/ブランド）" : "Search (name/tag/brand)";
    return `
      <div class="item-sources-toolbar">
        <div class="item-sources-toolbar__row">
          <input id="itemSourcesSearchInput" class="item-sources-search" type="text" placeholder="${escapeHtml(searchPh)}" value="${escapeHtml(window.itemSourcesSearchText || "")}">
          <button class="btn btn--ghost" type="button" id="itemSourcesClearBtn">${langSelect.value === "ja" ? "クリア" : "Clear"}</button>
        </div>
      </div>
    `;
  }

  function renderTableRows(rows, brandNameByKey) {
    return rows.map((r) => {
      const nameText = trByKeyFallback(r.name_key, r.name || r.name_key || "");
      const bKey = normalizeKey(r.brand_key || "");
      const brandFallback = (brandNameByKey && brandNameByKey.get(bKey)) || r.brand_key || "";
      const brandText = trByKeyFallback(r.brand_key, brandFallback);
      const slotText = trByKeyFallback(r.slot_key, r.slot_key || "");
      const isBrandset = normalizeKey(r.entity_type || "") === "brandset";
      const displayName = isBrandset
        ? brandText
        : `${brandText} / ${nameText}`;
      const tags = Array.isArray(r.acquisition_tags) ? r.acquisition_tags : [];
      const dropTags = Array.isArray(r.drop_tags) ? r.drop_tags : [];
      const cacheTags = dropTags.filter((t) => CACHE_TAGS.has(normalizeKey(t || "")));
      const craftTags = tags.filter((t) => parseCraftTag(t));
      const targetLootTags = tags.filter((t) => normalizeKey(t || "").startsWith("targetloot"));
      const otherTags = tags.filter((t) => {
        const k = normalizeKey(t || "");
        return !k.startsWith("targetloot") && !parseCraftTag(t) && !DROP_TAGS.has(k);
      });
      let dropKind = "";
      if (dropTags.some((t) => {
        const k = normalizeKey(t || "");
        return k === "pvpdz" || k === "pvpconflict" || k === "dzcache" || k === "conflictcache";
      })) {
        dropKind = (langSelect.value === "ja") ? "PVP" : "PVP";
      } else if (dropTags.some((t) => normalizeKey(t || "") === "event")) {
        dropKind = (langSelect.value === "ja") ? "イベント" : "Event";
      } else if (dropTags.some((t) => normalizeKey(t || "") !== "nodrop")) {
        dropKind = (langSelect.value === "ja") ? "通常" : "Normal";
      }
      const dropHtml = dropKind
        ? `<div class="item-sources-tags"><span class="item-source-tag">${escapeHtml(dropKind)}</span></div>`
        : "";
      const cacheHtml = cacheTags.length
        ? `<div class="item-sources-tags">${cacheTags.map((t) => `<span class="item-source-tag">${escapeHtml(tagLabel(t))}</span>`).join("")}</div>`
        : "";
      const targetLootHtml = targetLootTags.length
        ? `<div class="item-sources-icons">${targetLootTags.map((t) => targetLootIconHtml(r, t, brandNameByKey)).join("")}</div>`
        : "";
      const craftHtml = craftTags.length
        ? `<div class="item-sources-icons item-sources-icons--craft">${craftTags.map((t) => craftIconHtml(t)).join("")}</div>`
        : "";
      const tagsHtml = otherTags.length
        ? `<div class="item-sources-tags">${otherTags.map((t) => `<span class="item-source-tag">${escapeHtml(tagLabel(t))}</span>`).join("")}</div>`
        : "";
      return `
        <tr>
          <td>${escapeHtml(displayName)}</td>
          <td>${dropHtml}</td>
          <td>${cacheHtml}</td>
          <td>${targetLootHtml}</td>
          <td class="item-sources-col-craft">${craftHtml}</td>
          <td>${tagsHtml}</td>
          <td>${escapeHtml(localizeAcquisitionNote(r.acquisition_note || "")).replace(/\n/g, "<br>")}</td>
        </tr>
      `;
    }).join("");
  }

  function renderItemSourcesViewFromRows(rows) {
    clearContent();
    const brandNameByKey = new Map();
    rows.forEach((r) => {
      const ek = normalizeKey(r.entity_type || "");
      const bk = normalizeKey(r.brand_key || "");
      if (!bk || ek !== "brandset") return;
      const nm = String(r.name || "").trim();
      if (nm) brandNameByKey.set(bk, nm);
    });

    const filtered = rows.filter(matchesFilters).sort((a, b) => {
      const ba = normalizeKey(a.brand_key || "");
      const bb = normalizeKey(b.brand_key || "");
      if (ba !== bb) return ba.localeCompare(bb);

      const ea = normalizeKey(a.entity_type || "");
      const eb = normalizeKey(b.entity_type || "");
      const eo = { brandset: 1, gear_named: 2 };
      const ead = eo[ea] || 99;
      const ebd = eo[eb] || 99;
      if (ead !== ebd) return ead - ebd;

      const sa = normalizeKey(a.slot_key || "");
      const sb = normalizeKey(b.slot_key || "");
      if (sa !== sb) return sa.localeCompare(sb);

      const na = normalizeKey(a.name_key || a.name || "");
      const nb = normalizeKey(b.name_key || b.name || "");
      return na.localeCompare(nb);
    });

    const section = document.createElement("section");
    section.className = "catgroup catgroup--item-sources";
    section.innerHTML = `
      ${renderFilters(rows)}
      <div class="item-sources-table-wrap">
        <table class="item-sources-table">
          <thead>
            <tr>
              <th>${langSelect.value === "ja" ? "アイテム" : "Item"}</th>
              <th>${langSelect.value === "ja" ? "ドロップ" : "Drop"}</th>
              <th>${langSelect.value === "ja" ? "キャッシュ" : "Cache"}</th>
              <th>${langSelect.value === "ja" ? "目標アイテム" : "Targeted Loot"}</th>
              <th class="item-sources-col-craft">${langSelect.value === "ja" ? "クラフト" : "Craft"}</th>
              <th>${langSelect.value === "ja" ? "入手属性" : "Source Tags"}</th>
              <th>${langSelect.value === "ja" ? "備考" : "Note"}</th>
            </tr>
          </thead>
          <tbody>
            ${renderTableRows(filtered, brandNameByKey)}
          </tbody>
        </table>
      </div>
    `;
    contentEl.appendChild(section);

    const searchInput = section.querySelector("#itemSourcesSearchInput");
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        window.itemSourcesSearchText = String(searchInput.value || "");
        renderItemSourcesViewFromRows(rows);
      });
    }
    const clearBtn = section.querySelector("#itemSourcesClearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        window.itemSourcesEntityFilter = [];
        window.itemSourcesTagFilter = [];
        window.itemSourcesSearchText = "";
        renderItemSourcesViewFromRows(rows);
      });
    }
  }

  window.itemSourcesViewRender = async function itemSourcesViewRender() {
    // Item Sources view currently has no toggle filters.
    window.itemSourcesEntityFilter = [];
    window.itemSourcesTagFilter = [];
    const rows = await loadItemSourcesRows();
    if (!rows.length) {
      clearContent();
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }
    renderItemSourcesViewFromRows(rows);
  };
})();
