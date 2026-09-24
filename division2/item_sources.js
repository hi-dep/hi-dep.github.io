/* Item Source view. The layout intentionally follows blueprint.js. */
(function () {
  const GEAR_SLOTS = ["mask", "backpack", "chest", "glove", "holster", "kneepads"];
  const WEAPON_TYPES = ["ar", "smg", "lmg", "shotgun", "rifle", "mmr", "pistol"];
  const RARITIES = ["named", "exotic"];
  let rowsCache = null;

  const isJa = () => langSelect && langSelect.value === "ja";
  const value = (row, key) => String((row && row[key]) || "").trim();
  const isTrue = (row, key) => row && (row[key] === true || normalizeKey(String(row[key] || "")) === "true");

  function weaponLabel(key) {
    return { ar: "AR", smg: "SMG", lmg: "LMG", shotgun: "SG", rifle: "RF", mmr: "MMR", pistol: "HG" }[normalizeKey(key)] || "";
  }
  function sourceLabel(key) {
    const labels = {
      normal_drop: ["通常ドロップ", "Normal drop"], pvp_drop: ["PVPドロップ", "PVP drop"],
      named_cache: ["名前付きキャッシュ", "Named cache"], exotic_cache: ["エキゾチックキャッシュ", "Exotic cache"],
      pvp_cache: ["PVPキャッシュ", "PVP cache"], target_loot: ["目標アイテム", "Targeted loot"],
    };
    return (labels[key] || [key, key])[isJa() ? 0 : 1];
  }
  function localizeItemNameWithReplica(nameKey, nameText) {
    const key = normalizeKey(nameKey || "");
    const rawName = String(nameText || "");
    const translated = (typeof i18n === "object" && i18n)
      ? (i18n[key] || i18n[String(nameKey || "").trim()])
      : "";
    if (!key.endsWith("replica")) return translated || rawName || nameKey || "";
    const baseKey = key.replace(/replica$/, "");
    const baseName = rawName.replace(/\s+replica\s*$/i, "").trim();
    const baseTranslated = (typeof i18n === "object" && i18n) ? i18n[baseKey] : "";
    return `${baseTranslated || baseName || rawName || nameKey || ""} 模造品`;
  }
  function targetName(raw) {
    const names = { ar: "Assault Rifle", smg: "Submachine Gun", lmg: "Light Machine Gun", shotgun: "Shotgun", rifle: "Rifle", mmr: "Marksman Rifle", pistol: "Pistol", mask: "Mask", backpack: "Backpack", chest: "Chest", glove: "Gloves", holster: "Holster", kneepads: "Kneepads" };
    return names[normalizeKey(raw)] || String(raw || "").trim();
  }
  function targetIcon(raw, row) {
    const key = normalizeKey(raw);
    const weaponKeys = new Set(WEAPON_TYPES);
    if (weaponKeys.has(key)) {
      return `<span class="blueprint-slot-pill is-on" title="${escapeHtml(targetName(raw))}"><img class="ico ico--item-source blueprint-slot-ico" src="./img/icon/weapon/${key}.png" alt="${escapeHtml(key)}"></span>`;
    }
    if (GEAR_SLOTS.includes(key)) {
      return `<span class="blueprint-slot-pill is-on" title="${escapeHtml(targetName(raw))}">${slotIcon(key)}</span>`;
    }
    const category = normalizeKey(value(row, "item_category"));
    const iconGroup = category === "gearset" ? "gearsets" : "brands";
    const iconBase = category === "gearset" ? "img/icon/slotet" : "img/icon/brandset";
    const aliases = { golangear: "golangearltd", walkerharris: "walkerharrisco", chinalight: "chinalightindustriescorporation", ceskavyroba: "ceskavyrobasro", richterkaiser: "richterkaisergmbh", legatus: "legatusspa", hana_u: "hanaucorporation" };
    const keys = [key, aliases[key]].filter(Boolean);
    const src = keys.map((candidate) => iconUrl(iconGroup, candidate, iconBase)).find(Boolean) || "";
    if (src) return `<span class="blueprint-slot-pill is-on" title="${escapeHtml(String(raw || "").trim())}">${iconImgHtml(src, "ico ico--item-source blueprint-slot-ico", String(raw || "").trim())}</span>`;
    return `<span class="blueprint-tag is-on" title="${escapeHtml(String(raw || "").trim())}">${escapeHtml(String(raw || "").trim())}</span>`;
  }
  function itemName(row) {
    const raw = value(row, "item_name");
    return isJa() ? localizeItemNameWithReplica(normalizeKey(raw), raw) : raw;
  }
  function slotIcon(key) {
    const k = normalizeKey(key);
    const file = k === "glove" ? "gloves" : k;
    const src = `./img/icon/slot/${file}.png`;
    return `<img class="ico ico--item-source blueprint-slot-ico" src="${escapeHtml(src)}" alt="${escapeHtml(k)}" title="${escapeHtml(k)}" loading="lazy" decoding="async">`;
  }
  function dropCell(row) {
    const out = [];
    ["normal_drop", "pvp_drop", "named_cache", "exotic_cache", "pvp_cache"].forEach((key) => {
      if (isTrue(row, key)) out.push(`<span class="item-source-tag">${escapeHtml(sourceLabel(key))}</span>`);
    });
    return out.join(" ");
  }
  function targetLootCell(row) {
    const out = [];
    const target = value(row, "target_loot");
    if (target) out.push(`<span class="blueprint-slot-pack" aria-label="${escapeHtml(sourceLabel("target_loot"))}">${target.split(";").map((part) => targetIcon(part.trim(), row)).join("")}</span>`);
    if (isTrue(row, "target_blueprint_required")) out.push(`<span class="item-source-tag">${escapeHtml(isJa() ? "設計図必要" : "Blueprint required")}</span>`);
    return out.join(" ");
  }
  function otherSourceCell(row) {
    const out = [];
    const specific = isJa() && value(row, "specific_source_jp") ? value(row, "specific_source_jp") : value(row, "specific_source");
    if (specific) out.push(`<span>${escapeHtml(specific).replace(/\n/g, "<br>")}</span>`);
    const notes = isJa() && value(row, "notes_jp") ? value(row, "notes_jp") : value(row, "notes");
    if (notes) out.push(`<span>${escapeHtml(notes).replace(/\n/g, "<br>")}</span>`);
    return out.join(" ");
  }
  function rowRarity(row) {
    const category = normalizeKey(value(row, "item_category"));
    if (category === "gearset") return "gearset";
    return category.includes("exotic") ? "exotic" : (category.includes("named") ? "named" : "highend");
  }
  function rowSearch(row) {
    return normalizeKey([value(row, "item_name"), value(row, "item_category"), value(row, "slot_key"), value(row, "target_loot"), value(row, "specific_source"), value(row, "specific_source_jp")].join(" "));
  }
  function filteredRows(rows) {
    const query = normalizeKey(window.itemSourcesSearch || "");
    const types = new Set(window.itemSourcesTypeFilter || []);
    return rows.filter((row) => {
      if (query && !rowSearch(row).includes(query)) return false;
      if (!types.size) return true;
      const category = normalizeKey(value(row, "item_category"));
      const slot = normalizeKey(value(row, "slot_key"));
      const rarity = rowRarity(row);
      return types.has(slot) || types.has(rarity);
    }).sort((a, b) => itemName(a).localeCompare(itemName(b), isJa() ? "ja" : "en"));
  }
  function typeButtons() {
    const types = new Set(window.itemSourcesTypeFilter || []);
    const gear = GEAR_SLOTS.map((key) => `<button class="btn btn--ghost blueprint-type-btn blueprint-type-btn--icon${types.has(key) ? " is-on" : ""}" type="button" data-item-source-type="${key}" title="${escapeHtml(key)}" aria-label="${escapeHtml(key)}">${slotIcon(key)}</button>`).join("");
    const weapons = WEAPON_TYPES.map((key) => `<button class="btn btn--ghost blueprint-type-btn${types.has(key) ? " is-on" : ""}" type="button" data-item-source-type="${key}">${weaponLabel(key)}</button>`).join("");
    const rarity = RARITIES.map((key) => `<button class="btn btn--ghost blueprint-type-btn${types.has(key) ? " is-on" : ""}" type="button" data-item-source-type="${key}">${key.toUpperCase()}</button>`).join("");
    return `<div class="blueprint-type-filter-row" data-blueprint-filter-control="1"${window.itemSourcesFiltersOpen ? "" : " hidden"}><div class="blueprint-type-filter-group"><div class="blueprint-type-filter-buttons">${gear}</div></div><div class="blueprint-type-filter-group"><div class="blueprint-type-filter-buttons">${weapons}</div></div><div class="blueprint-type-filter-group"><div class="blueprint-type-filter-buttons">${rarity}</div></div></div>`;
  }
  function toolbar() {
    const open = !!window.itemSourcesFiltersOpen;
    return `<div class="blueprint-toolbar"><button id="itemSourceFilterToggle" class="btn btn--ghost ui-control" type="button">${escapeHtml(open ? ui("filtersClose") : ui("filtersOpen"))}</button><label class="field blueprint-toolbar__search" data-blueprint-filter-control="1"${open ? "" : " hidden"}><span>${escapeHtml(isJa() ? "検索" : "Search")}</span><input id="itemSourceSearch" type="text" value="${escapeHtml(window.itemSourcesSearch || "")}" placeholder="${escapeHtml(isJa() ? "名前・部位・入手先" : "Search by name, slot, source")}"></label></div>${typeButtons()}`;
  }
  function rowMarkup(row) {
    return `<tr class="blueprint-row rarity-${rowRarity(row)}"><td class="blueprint-td-accent"><span class="blueprint-accent"></span></td><td class="blueprint-td-name">${itemNameCell(row)}</td><td class="blueprint-td-source">${dropCell(row)}</td><td class="blueprint-td-source">${targetLootCell(row)}</td><td class="blueprint-td-source">${otherSourceCell(row)}</td></tr>`;
  }
  function updateRows(section, rows) {
    const tbody = section.querySelector(".blueprint-table tbody");
    if (tbody) tbody.innerHTML = filteredRows(rows).map(rowMarkup).join("");
  }
  function itemNameCell(row) {
    const rawName = value(row, "item_name");
    const displayName = itemName(row);
    const category = normalizeKey(value(row, "item_category"));
    const nameKey = normalizeKey(rawName);
    let attrs = "";
    if (category === "brand" || category === "gearset") {
      attrs = `data-pop-type="brand" data-brand-scope="${category === "gearset" ? "gearset" : "brand"}" data-brand-key="${escapeHtml(nameKey)}" data-brand-name="${escapeHtml(rawName)}"`;
    } else if (category === "gearnamed" || category === "weaponnamed") {
      attrs = `data-pop-type="blueprint-named" data-named-kind="${category === "weaponnamed" ? "weapon" : "gear"}" data-named-name="${escapeHtml(rawName)}" data-named-name-key="${escapeHtml(nameKey)}"`;
    } else if (category === "gearexotic" || category === "weaponexotic") {
      attrs = `data-pop-type="blueprint-exotic" data-exotic-kind="${category === "weaponexotic" ? "weapon" : "gear"}" data-exotic-name="${escapeHtml(rawName)}" data-exotic-name-key="${escapeHtml(nameKey)}"`;
    }
    return attrs ? `<button type="button" class="inline-pop-trigger line__text-pop-trigger" ${attrs}>${escapeHtml(displayName)}</button>` : escapeHtml(displayName);
  }
  function render(rows) {
    const visible = filteredRows(rows);
    clearContent();
    const section = document.createElement("section");
    section.className = "blueprint-view item-sources-view";
    section.innerHTML = `${toolbar()}<section class="blueprint-table-wrap"><div class="blueprint-table-scroll"><table class="blueprint-table"><thead><tr><th class="blueprint-th-accent"></th><th>${escapeHtml(isJa() ? "名前" : "Name")}</th><th>${escapeHtml(isJa() ? "ドロップ" : "Drop")}</th><th>${escapeHtml(isJa() ? "目標アイテム" : "Target Loot")}</th><th>${escapeHtml(isJa() ? "その他の入手先" : "Other Source")}</th></tr></thead><tbody>${visible.map(rowMarkup).join("")}</tbody></table></div></section>`;
    contentEl.appendChild(section);
    const rerender = () => render(rows);
    section.querySelector("#itemSourceFilterToggle")?.addEventListener("click", () => { window.itemSourcesFiltersOpen = !window.itemSourcesFiltersOpen; rerender(); });
    section.querySelector("#itemSourceSearch")?.addEventListener("input", (event) => { window.itemSourcesSearch = event.target.value; updateRows(section, rows); });
    section.querySelectorAll("[data-item-source-type]").forEach((button) => button.addEventListener("click", () => { const key = button.dataset.itemSourceType; const set = new Set(window.itemSourcesTypeFilter || []); set.has(key) ? set.delete(key) : set.add(key); window.itemSourcesTypeFilter = [...set]; rerender(); }));
  }
  async function load() {
    if (rowsCache) return rowsCache;
    const version = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const obj = await fetchJson(`${DATA_BASE}/item_sources.json${version}`);
    rowsCache = Array.isArray(obj?.rows) ? obj.rows : [];
    return rowsCache;
  }
  window.itemSourcesViewRender = async function () {
    if (!Array.isArray(window.itemSourcesTypeFilter)) window.itemSourcesTypeFilter = [];
    if (typeof window.itemSourcesSearch !== "string") window.itemSourcesSearch = "";
    render(await load());
  };
})();
