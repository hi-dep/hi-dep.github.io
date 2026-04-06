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
  if (!Array.isArray(window.itemSourcesWeaponTypeFilter)) {
    window.itemSourcesWeaponTypeFilter = [];
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

  function localizeItemNameWithReplica(nameKey, nameText) {
    const nk = normalizeKey(nameKey || "");
    const rawName = String(nameText || "");
    if (!nk.endsWith("replica")) {
      return trByKeyFallback(nameKey, rawName || nameKey || "");
    }
    const baseKey = nk.replace(/replica$/, "");
    const baseName = rawName.replace(/\s+replica\s*$/i, "").trim();
    const localizedBase = trByKeyFallback(baseKey, baseName || rawName || nameKey || "");
    if (langSelect.value === "ja") return `${localizedBase} 模造品`;
    return `${localizedBase} Replica`;
  }

  function localizeBlueprintSource(sourceText) {
    const s = String(sourceText || "").trim();
    if (!s) return langSelect.value === "ja" ? "コントロールポイント" : "Control Point";
    const table = {
      "Control Point": { ja: "コントロールポイント", en: "Control Point" },
      "Season": { ja: "過去シーズン", en: "Past Season" },
      "Field Research Technician": { ja: "フィールドリサーチ テクニシャン", en: "Field Research Technician" },
      "Field Research Firewall": { ja: "フィールドリサーチ ファイアウォール", en: "Field Research Firewall" },
      "Field Research Gunner": { ja: "フィールドリサーチ ガンナー", en: "Field Research Gunner" },
      "Reconstructed Caches": { ja: "復元されたキャッシュ", en: "Reconstructed Caches" },
      "Y8S1 Journey 7 reward": { ja: "Y8S1のジャーニー7報酬", en: "Y8S1 Journey 7 reward" },
      "Y8S1 Journey 7 Reward": { ja: "Y8S1のジャーニー7報酬", en: "Y8S1 Journey 7 Reward" },
      "Kill Squad": { ja: "キルスクワッド", en: "Kill Squad" },
      "completion": { ja: "報復完了", en: "retaliation completion" },
      "Hyenas retaliation completion": { ja: "ハイエナ 報復完了", en: "Hyenas retaliation completion" },
      "Outcasts retaliation completion": { ja: "アウトキャスト 報復完了", en: "Outcasts retaliation completion" },
      "Rikers retaliation completion": { ja: "ライカーズ 報復完了", en: "Rikers retaliation completion" },
      "True Sons retaliation completion": { ja: "トゥルーサンズ 報復完了", en: "True Sons retaliation completion" },
      "Cleaners retaliation completion": { ja: "クリーナーズ 報復完了", en: "Cleaners retaliation completion" },
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

  function localizeBlueprintType(typeText) {
    const k = normalizeKey(typeText || "");
    if (k === "craft") return langSelect.value === "ja" ? "クラフト" : "Craft";
    if (k === "reconfigure") return langSelect.value === "ja" ? "リコンフィグ" : "Reconfigure";
    return String(typeText || "");
  }

  function blueprintSourceText(bp) {
    const src = String(bp?.src || "").trim();
    return src || "Control Point";
  }

  function blueprintSourceRawText(bp) {
    return String(bp?.src || "").trim();
  }

  function blueprintSlotIconHtml(row, bp) {
    const slot = normalizeKey(bp?.slot || "");
    if (!slot) return "";
    const isWeapon = normalizeKey(row.category || "") === "weapon";
    const iconKind = isWeapon ? "weapon_types" : "gear_slots";
    const iconDir = isWeapon ? "img/weapons" : "img/gears";
    const src = iconUrl(iconKind, slot, iconDir);
    const slotLabel = trByKeyFallback(slot, slot);
    const bpType = localizeBlueprintType(bp?.type || "craft");
    const bpSource = localizeBlueprintSource(blueprintSourceText(bp));
    const title = `${slotLabel} / ${bpType} / ${bpSource}`;
    if (!src) {
      return `<span class="item-source-tag" title="${escapeHtml(title)}">${escapeHtml(slotLabel)}</span>`;
    }
    const isReconfigure = normalizeKey(bp?.type || "") === "reconfigure";
    const typeBadge = isReconfigure ? `<span class="item-source-scope item-source-scope--craft">R</span>` : "";
    return `<span class="item-source-icon item-sources-name-slot" title="${escapeHtml(title)}">${iconImgHtml(src, "ico ico--item-source", slotLabel)}${typeBadge}</span>`;
  }

  function blueprintEntryHtml(row, bp) {
    const category = normalizeKey(row?.category || "");
    if (category === "weapon") {
      return `<span class="item-source-icon item-sources-name-slot item-source-icon--check" title="blueprint">✓</span>`;
    }
    const slotIcon = blueprintSlotIconHtml(row, bp);
    if (!slotIcon) return "";
    return slotIcon;
  }

  function blueprintSourceTextHtml(sourceText) {
    const raw = String(sourceText || "").trim();
    if (!raw) return "";
    const nk = normalizeKey(raw);
    if (nk === "season" || nk === "pastseason") return "";
    return `<span class="item-sources-bp-src">${escapeHtml(localizeBlueprintSource(raw))}</span>`;
  }

  function weaponTypeShortLabel(key) {
    const k = normalizeKey(key || "");
    if (k === "ar") return "AR";
    if (k === "smg") return "SMG";
    if (k === "lmg") return "LMG";
    if (k === "shotgun") return "SG";
    if (k === "rifle") return "RF";
    if (k === "mmr") return "MMR";
    if (k === "pistol") return "HG";
    return k.toUpperCase();
  }

  function weaponTypeBadgeHtml(slotKey) {
    const sk = normalizeKey(slotKey || "");
    if (!sk) return "";
    const label = weaponTypeShortLabel(sk);
    return `<span class="wt-badge is-on">${escapeHtml(label)}</span>`;
  }

  function itemNameSuffixHtml(row) {
    const tier = normalizeKey(row.tier || "");
    const category = normalizeKey(row.category || "");
    const slotKey = normalizeKey(row.slot_key || "");
    const bits = [];
    if (category === "weapon") {
      const wBadge = weaponTypeBadgeHtml(slotKey);
      if (wBadge) bits.push(wBadge);
    } else if (category === "gear" && (tier === "named" || tier === "exotic")) {
      const slotIcon = iconUrl("gear_slots", slotKey, "img/gears");
      const slotLabel = trByKeyFallback(slotKey, slotKey);
      if (slotIcon) {
        bits.push(`<span class="item-source-icon item-sources-name-slot" title="${escapeHtml(slotLabel)}">${iconImgHtml(slotIcon, "ico ico--item-source", slotLabel)}</span>`);
      } else if (slotLabel) {
        bits.push(`<span class="item-source-tag">${escapeHtml(slotLabel)}</span>`);
      }
    }
    if (!bits.length) return "";
    return `<span class="wt-inline-badges">${bits.join("")}</span>`;
  }

  function targetLootedEntryHtml(row, rawValue, brandNameByKey) {
    const category = normalizeKey(row.category || "");
    const val = String(rawValue || "").trim();
    const rawParts = val.split(":");
    const baseRaw = String(rawParts[0] || "").trim();
    const scopeRaw = normalizeKey(rawParts[1] || "");
    const scope = (scopeRaw === "dz" || scopeRaw === "lz" || scopeRaw === "any") ? scopeRaw : "";
    const k = normalizeKey(baseRaw || val);
    if (!k) return "";
    const scopeText = scope === "dz" ? "DZ" : (scope === "lz" ? "LZ" : "");
    const scopeEntryClass = scope === "dz" ? " item-sources-target-entry--dz" : "";
    const scopeBadge = scopeText
      ? `<span class="item-source-scope item-source-scope--overlay item-source-scope--${scope}">${scopeText}</span>`
      : "";

    if (category === "weapon") {
      const wt = weaponTypeBadgeHtml(k);
      if (wt) {
        const weaponDzClass = scope === "dz" ? " item-sources-target-entry--weapon-dz" : "";
        return `<span class="item-sources-bp-entry item-sources-target-entry${scopeEntryClass}${weaponDzClass}">${wt}${scopeBadge}</span>`;
      }
      return `<span class="item-source-tag${scope === "dz" ? " item-source-tag--dz" : ""}">${escapeHtml(baseRaw || val)}${scopeText ? ` (${escapeHtml(scopeText)})` : ""}</span>`;
    }

    const bKey = normalizeKey(row.brand_key || "");
    const brandName = String((brandNameByKey && brandNameByKey.get(bKey)) || row.brand_name || row.name || "").trim();
    const brandNameKey = normalizeKey(brandName);
    const isBrand = !!bKey && (k === bKey || (brandNameKey && k === brandNameKey));
    if (isBrand) {
      const src = iconUrl("brands", bKey, "img/brands");
      const alt = trByKeyFallback(bKey, brandName || baseRaw || val);
      if (!src) return `<span class="item-source-tag${scope === "dz" ? " item-source-tag--dz" : ""}">${escapeHtml(alt)}${scopeText ? ` (${escapeHtml(scopeText)})` : ""}</span>`;
      return `<span class="item-source-icon item-sources-name-slot item-sources-target-entry${scopeEntryClass}" title="${escapeHtml(alt)}">${iconImgHtml(src, "ico ico--item-source", alt)}${scopeBadge}</span>`;
    }

    const slotSrc = iconUrl("gear_slots", k, "img/gears");
    const slotLabel = trByKeyFallback(k, baseRaw || val);
    if (slotSrc) {
      return `<span class="item-source-icon item-sources-name-slot item-sources-target-entry${scopeEntryClass}" title="${escapeHtml(slotLabel)}">${iconImgHtml(slotSrc, "ico ico--item-source", slotLabel)}${scopeBadge}</span>`;
    }
    return `<span class="item-source-tag${scope === "dz" ? " item-source-tag--dz" : ""}">${escapeHtml(baseRaw || val)}${scopeText ? ` (${escapeHtml(scopeText)})` : ""}</span>`;
  }

  function localizeDropValue(rawValue) {
    const k = normalizeKey(rawValue || "");
    const ja = langSelect.value === "ja";
    if (k === "dz" || k === "pvpdz") return ja ? "PVP限定 (DZ)" : "PVP only (DZ)";
    if (k === "conflict" || k === "pvpconflict") return ja ? "PVP限定 (コンフリクト)" : "PVP only (Conflict)";
    if (k === "pvp") return ja ? "PVP限定" : "PVP only";
    return String(rawValue || "");
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
      sourceText = (langSelect.value === "ja") ? " / 復元されたキャッシュ設計図" : " / Reconstructed Cache Blueprint";
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
    const weaponTypeActive = new Set(Array.isArray(window.itemSourcesWeaponTypeFilter) ? window.itemSourcesWeaponTypeFilter : []);
    const search = normalizeKey(window.itemSourcesSearchText || "");

    const entity = normalizeKey(row.entity_type || "");
    if (entityActive.size && !entityActive.has(entity)) return false;
    if (weaponTypeActive.size) {
      const category = normalizeKey(row.category || "");
      const slotKey = normalizeKey(row.slot_key || "");
      if (category !== "weapon") return false;
      if (!weaponTypeActive.has(slotKey)) return false;
    }

    const tags = []
      .concat(Array.isArray(row.acquisition_tags) ? row.acquisition_tags : [])
      .concat(Array.isArray(row.drop_tags) ? row.drop_tags : [])
      .map((t) => normalizeKey(t || ""))
      .filter(Boolean);
    if (tagActive.size && !Array.from(tagActive).every((t) => tags.includes(t))) return false;

    if (search) {
      const bps = Array.isArray(row.blueprint) ? row.blueprint : [];
      const targetLooted = Array.isArray(row.target_looted) ? row.target_looted : [];
      const drops = Array.isArray(row.drop) ? row.drop : [];
      const parts = [
        row.item_id,
        row.entity_type,
        row.category,
        row.tier,
        row.name_key,
        row.name,
        row.brand_name,
        row.brand_key,
        row.slot_key,
        ...bps.map((bp) => bp.slot || ""),
        ...bps.map((bp) => bp.src || "Control Point"),
        ...bps.map((bp) => bp.type || ""),
        ...targetLooted,
        ...drops,
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
    const weaponOrder = ["ar", "smg", "lmg", "rifle", "mmr", "shotgun", "pistol"];
    const weaponTypes = new Set();
    (rows || []).forEach((r) => {
      if (normalizeKey(r?.category || "") !== "weapon") return;
      const sk = normalizeKey(r?.slot_key || "");
      if (sk) weaponTypes.add(sk);
    });
    const selected = new Set(Array.isArray(window.itemSourcesWeaponTypeFilter) ? window.itemSourcesWeaponTypeFilter : []);
    const weaponTypeButtons = weaponOrder
      .filter((k) => weaponTypes.has(k))
      .map((k) => {
        const on = selected.has(k);
        const label = weaponTypeShortLabel(k);
        return `<button class="btn btn--ghost talent-desc-btn${on ? " is-on" : ""}" type="button" data-item-sources-wt="${escapeHtml(k)}">${escapeHtml(label)}</button>`;
      })
      .join("");
    return `
      <div class="item-sources-toolbar">
        <div class="item-sources-toolbar__row">
          <input id="itemSourcesSearchInput" class="item-sources-search" type="text" placeholder="${escapeHtml(searchPh)}" value="${escapeHtml(window.itemSourcesSearchText || "")}">
          <button class="btn btn--ghost" type="button" id="itemSourcesClearBtn">${langSelect.value === "ja" ? "クリア" : "Clear"}</button>
        </div>
        <div class="item-sources-toolbar__row item-sources-toolbar__row--wt trello-group-toggle weapon-type-filter-row">
          <span class="item-sources-toolbar__label">${langSelect.value === "ja" ? "武器種" : "Weapon Type"}</span>
          ${weaponTypeButtons}
        </div>
      </div>
    `;
  }

  function renderTableRows(rows, brandNameByKey) {
    return rows.map((r) => {
      const nameText = localizeItemNameWithReplica(r.name_key, r.name || r.name_key || "");
      const bKey = normalizeKey(r.brand_key || "");
      const brandFallback = (brandNameByKey && brandNameByKey.get(bKey)) || r.brand_name || r.brand_key || "";
      const brandText = trByKeyFallback(r.brand_key, brandFallback);
      const isBrandset = normalizeKey(r.entity_type || "") === "brandset";
      const displayName = isBrandset
        ? (brandText || nameText)
        : (brandText && nameText ? `${brandText} / ${nameText}` : (nameText || brandText));
      const itemKindHtml = itemNameSuffixHtml(r);
      const bps = Array.isArray(r.blueprint) ? r.blueprint.filter((bp) => bp && typeof bp === "object") : [];
      let blueprintHtml = "";
      if (bps.length) {
        const explicitSrcs = bps.map((bp) => blueprintSourceRawText(bp)).filter((s) => !!String(s || "").trim());
        const srcSet = new Set(explicitSrcs);
        const allHaveSameExplicitSrc = explicitSrcs.length === bps.length && srcSet.size === 1;
        if (allHaveSameExplicitSrc) {
          const onlySrc = explicitSrcs[0];
          blueprintHtml = `<div class="item-sources-icons item-sources-icons--craft">${bps.map((bp) => `<span class="item-sources-bp-entry">${blueprintEntryHtml(r, bp)}</span>`).join("")}${blueprintSourceTextHtml(onlySrc)}</div>`;
        } else {
          const bpParts = bps.map((bp) => {
            const icon = blueprintEntryHtml(r, bp);
            const srcText = blueprintSourceTextHtml(blueprintSourceRawText(bp));
            if (!icon && !srcText) return "";
            return `<span class="item-sources-bp-entry">${icon}${srcText}</span>`;
          }).filter(Boolean);
          blueprintHtml = `<div class="item-sources-icons item-sources-icons--craft">${bpParts.join("")}</div>`;
        }
      }
      const dropArr = Array.isArray(r.drop) ? r.drop.filter((x) => !!String(x || "").trim()) : [];
      const targetLootedArr = Array.isArray(r.target_looted) ? r.target_looted.filter((x) => !!String(x || "").trim()) : [];
      const targetLootedHtml = targetLootedArr.length
        ? `<div class="item-sources-icons">${targetLootedArr.map((d) => targetLootedEntryHtml(r, d, brandNameByKey)).join("")}</div>`
        : "";
      const dropHtml = dropArr.length
        ? `<div class="item-sources-tags">${dropArr.map((d) => `<span class="item-source-tag">${escapeHtml(localizeDropValue(String(d)))}</span>`).join("")}</div>`
        : "";
      return `
        <tr class="item-sources-row rarity-${escapeHtml(normalizeKey(r.tier || '') || 'highend')}">
          <td><div class="item-sources-name"><span class="item-sources-name-main">${escapeHtml(displayName)}</span></div></td>
          <td>${itemKindHtml}</td>
          <td class="item-sources-col-craft">${blueprintHtml}</td>
          <td>${targetLootedHtml}</td>
          <td>${dropHtml}</td>
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
      const bnm = String(r.brand_name || "").trim();
      const label = bnm || nm;
      if (label) brandNameByKey.set(bk, label);
    });

    const filtered = rows.filter(matchesFilters).sort((a, b) => {
      const ba = normalizeKey(a.brand_key || "");
      const bb = normalizeKey(b.brand_key || "");
      if (ba !== bb) return ba.localeCompare(bb);

      const ea = normalizeKey(a.entity_type || "");
      const eb = normalizeKey(b.entity_type || "");
      const eo = { weapon: 1, brandset: 2, gearset: 3, gear_named: 4, gear_exotic: 5 };
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
              <th>${langSelect.value === "ja" ? "種別" : "Kind"}</th>
              <th class="item-sources-col-craft">${langSelect.value === "ja" ? "設計図" : "Blueprint"}</th>
              <th>${langSelect.value === "ja" ? "目標アイテム" : "Targeted Loot"}</th>
              <th>${langSelect.value === "ja" ? "ドロップ" : "Drop"}</th>
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
        window.itemSourcesWeaponTypeFilter = [];
        window.itemSourcesSearchText = "";
        renderItemSourcesViewFromRows(rows);
      });
    }
    section.querySelectorAll("[data-item-sources-wt]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = normalizeKey(btn.getAttribute("data-item-sources-wt") || "");
        if (!k) return;
        const cur = new Set(Array.isArray(window.itemSourcesWeaponTypeFilter) ? window.itemSourcesWeaponTypeFilter : []);
        if (cur.has(k)) cur.delete(k);
        else cur.add(k);
        window.itemSourcesWeaponTypeFilter = Array.from(cur);
        renderItemSourcesViewFromRows(rows);
      });
    });
  }

  window.itemSourcesViewRender = async function itemSourcesViewRender() {
    // Item Sources view currently has no toggle filters.
    window.itemSourcesEntityFilter = [];
    window.itemSourcesTagFilter = [];
    window.itemSourcesWeaponTypeFilter = [];
    const rows = await loadItemSourcesRows();
    if (!rows.length) {
      clearContent();
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }
    renderItemSourcesViewFromRows(rows);
  };
})();
