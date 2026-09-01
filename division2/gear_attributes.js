/* Gear Attributes view: Brandset and Gearset core/stat reference. */
(function () {
  let cache = null;
  let traitFilters = [];

  function traitLabel(key, fallback) {
    return langSelect.value === "ja" ? (i18n[key] ?? fallback ?? key) : (fallback ?? key);
  }

  function renderTraitChips(container) {
    if (!container) return;
    container.innerHTML = traitFilters.map((key) => `
      <span class="brand-trait-chip">
        <span>${escapeHtml(traitLabel(key, key))}</span>
        <button type="button" class="brand-trait-chip__remove" data-gear-attribute-remove="${escapeHtml(key)}" aria-label="${escapeHtml(ui("removeTraitFilter"))}">×</button>
      </span>
    `).join("");
  }

  window.gearAttributesTraitCardMatches = function (card) {
    if (!traitFilters.length) return true;
    const cardKeys = new Set(String(card?.dataset?.gearAttributeTraits || "").split(" ").filter(Boolean));
    return traitFilters.some((key) => cardKeys.has(key));
  };

  window.gearAttributesTraitLineMatches = function (line) {
    if (!traitFilters.length) return false;
    const keys = String(line?.dataset?.statKeys || line?.dataset?.statKey || "")
      .split(" ").filter(Boolean).map((key) => normalizeKey(key));
    return traitFilters.some((key) => keys.includes(key));
  };

  window.gearAttributesTraitKeyMatches = function (key) {
    return traitFilters.includes(normalizeKey(key || ""));
  };

  window.gearAttributesClearTraitFilters = function (options) {
    traitFilters = [];
    renderTraitChips(document.querySelector("[data-gear-attribute-chips]"));
    const select = document.querySelector("[data-gear-attribute-select]");
    const add = document.querySelector("[data-gear-attribute-add]");
    if (select) select.value = "";
    if (add) add.disabled = true;
    if (!options?.silent) applyFiltersToDom();
  };

  async function loadRows() {
    if (cache) return cache;
    const SQL = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const bytes = await gunzipToUint8Array(await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`));
    const db = new SQL.Database(bytes);
    try {
      const out = [];
      const read = (table, keyCol, nameCol, rarity) => {
        const corePieceCol = table === "items_gearsets" ? "t.core_attribute_by_piece," : "";
        const st = db.prepare(`
          SELECT t.${keyCol} AS set_key, t.${nameCol} AS set_name, t.core_attribute,
                 ${corePieceCol} b.bonus_ord, b.slot, b.value, b.value_num, b.unit, b.type, b.type_key, b.bonus_type
          FROM ${table} t
          LEFT JOIN ${table === "items_brandsets" ? "items_brandset_bonuses" : "items_gearset_bonuses"} b
            ON b.parent_item_id = t.item_id
          ORDER BY t.${nameCol}, t.item_id, b.bonus_ord, b.bonus_part_ord
        `);
        while (st.step()) out.push({ ...st.getAsObject(), rarity });
        st.free();
      };
      read("items_brandsets", "brandset_key", "brandset", "brand");
      read("items_gearsets", "gearset_key", "gearset", "gearset");
      cache = out;
      return out;
    } finally {
      db.close();
    }
  }

  function render(rows) {
    clearContent();
    const groups = new Map();
    rows.forEach((r) => {
      const key = `${r.rarity}:${r.set_key || r.set_name}`;
      if (!groups.has(key)) groups.set(key, { ...r, bonuses: [] });
      if (r.slot != null && String(r.slot).trim()) groups.get(key).bonuses.push(r);
    });
    const traitOptions = Array.from(new Map(
      rows.filter((r) => String(r.bonus_type || "attr").trim() !== "talent").map((r) => {
        const key = normalizeKey(r.type_key || r.type || "");
        return key ? [key, { key, label: r.type || r.type_key || key }] : null;
      }).filter(Boolean)
    ).values()).sort((a, b) => traitLabel(a.key, a.label).localeCompare(traitLabel(b.key, b.label), langSelect.value === "ja" ? "ja" : "en"));
    const available = new Set(traitOptions.map((x) => x.key));
    traitFilters = traitFilters.filter((key) => available.has(key));
    const section = document.createElement("section");
    section.className = "catgroup catgroup--gear gear-attributes-view";
    section.innerHTML = `
      <div class="trello-group-toggle gear-attributes-toolbar">
        ${typeof buildInlineConditionFilterHtml === "function" ? buildInlineConditionFilterHtml() : ""}
        <div class="brand-trait-filter" data-vendor-filter-control="1" hidden aria-hidden="true">
          <label class="field brand-trait-filter__field">
            <select data-gear-attribute-select aria-label="${escapeHtml(ui("traitFilter"))}">
              <option value="">${escapeHtml(ui("selectTrait"))}</option>
              ${traitOptions.map((x) => `<option value="${escapeHtml(x.key)}">${escapeHtml(traitLabel(x.key, x.label))}</option>`).join("")}
            </select>
          </label>
          <button class="btn btn--ghost brand-trait-filter__add" type="button" data-gear-attribute-add disabled>${escapeHtml(ui("addTraitFilter"))}</button>
          <div class="brand-trait-chips" data-gear-attribute-chips aria-label="${escapeHtml(ui("activeTraitFilters"))}"></div>
        </div>
      </div>
      <div class="grid grid--gear gear-attributes-brand-grid"></div>
      <div class="grid grid--gear gear-attributes-gearset-grid"></div>
    `;
    const brandGrid = section.querySelector(".gear-attributes-brand-grid");
    const gearsetGrid = section.querySelector(".gear-attributes-gearset-grid");
    const traitSelect = section.querySelector("[data-gear-attribute-select]");
    const traitAdd = section.querySelector("[data-gear-attribute-add]");
    const traitChips = section.querySelector("[data-gear-attribute-chips]");
    renderTraitChips(traitChips);
    traitSelect?.addEventListener("change", () => {
      if (traitAdd) traitAdd.disabled = !traitSelect.value || traitFilters.includes(traitSelect.value);
    });
    traitAdd?.addEventListener("click", () => {
      const key = String(traitSelect?.value || "").trim();
      if (!key || traitFilters.includes(key)) return;
      traitFilters = traitFilters.concat(key);
      renderTraitChips(traitChips);
      traitSelect.value = "";
      traitAdd.disabled = true;
      applyFiltersToDom();
    });
    traitChips?.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-gear-attribute-remove]");
      if (!remove) return;
      traitFilters = traitFilters.filter((x) => x !== remove.getAttribute("data-gear-attribute-remove"));
      renderTraitChips(traitChips);
      applyFiltersToDom();
    });
    const coreMixedHtml = (value) => {
      let obj = value;
      try { if (typeof obj === "string") obj = JSON.parse(obj); } catch (_) { obj = null; }
      if (!obj || typeof obj !== "object") return "";
      const grouped = new Map();
      Object.entries(obj).forEach(([slot, raw]) => {
        const label = String(raw || "").trim();
        if (!label) return;
        const key = normalizeKey(label);
        if (!grouped.has(key)) grouped.set(key, { label, slots: [] });
        grouped.get(key).slots.push(slot);
      });
      return Array.from(grouped.values()).map((g) => {
        const icons = g.slots.map((slot) => {
          const src = iconUrl("gear_slots", normalizeKey(slot), "img/gears");
          return src ? iconImgHtml(src, "ico ico--core-slot", slot) : "";
        }).join("");
        return `<span class="core-mixed-row core-mixed-row--${escapeHtml(normalizeKey(g.label))}"><span class="core-mixed-label">${escapeHtml(trText(g.label))}</span><span class="core-mixed-icons">${icons}</span></span>`;
      }).join("");
    };
    const ordered = Array.from(groups.values()).sort((a, b) => {
      const rarity = (a.rarity === b.rarity) ? 0 : (a.rarity === "brand" ? -1 : 1);
      if (rarity) return rarity;
      if (a.rarity === "gearset") {
        return String(a.set_name).localeCompare(String(b.set_name));
      }
      const coreRank = (value) => {
        const k = normalizeKey(value || "");
        return k === "weapondamage" ? 0 : k === "armor" ? 1 : k === "skilltier" ? 2 : 9;
      };
      return coreRank(a.core_attribute) - coreRank(b.core_attribute)
        || String(a.set_name).localeCompare(String(b.set_name));
    });
    ordered.forEach((it) => {
      const key = normalizeKey(it.set_key || it.set_name || "");
      const title = langSelect.value === "ja" ? (i18n[it.set_key] ?? i18n[key] ?? it.set_name) : it.set_name;
      const coreKey = normalizeKey(it.core_attribute || "");
      const core = trText(it.core_attribute || "");
      const lines = [];
      const traitKeys = new Set();
      const mixed = it.rarity === "gearset" && coreKey === "mixed" ? coreMixedHtml(it.core_attribute_by_piece) : "";
      if (mixed) lines.push({ text: stripHtml(mixed), textHtml: mixed, key: coreKey, cls: "line line--core" });
      else if (core) lines.push({ text: core, key: coreKey, cls: "line line--core" });
      const search = [key, normalizeKey(it.set_name), coreKey];
      const bonusGroups = new Map();
      it.bonuses.forEach((b) => {
        if (String(b.bonus_type || "attr").trim() === "talent") return;
        const typeText = langSelect.value === "ja" ? trText(b.type_key || b.type || "") : String(b.type || b.type_key || "");
        const num = `${formatDisplayNumber(b.value_num || "")}${b.unit || ""}`.trim();
        const text = [num, typeText].filter(Boolean).join(" ") || stripHtml(b.value || "");
        const statKey = String(b.type_key || normalizeKey(b.type || "")).trim();
        if (statKey) traitKeys.add(normalizeKey(statKey));
        if (!text) return;
        const groupKey = it.rarity === "gearset" ? String(b.bonus_ord || b.slot || "") : String(b.slot || "");
        if (!bonusGroups.has(groupKey)) bonusGroups.set(groupKey, []);
        bonusGroups.get(groupKey).push({ text, key: statKey });
        search.push(text, statKey, normalizeKey(b.type || ""));
      });
      bonusGroups.forEach((parts) => {
        lines.push({
          text: parts.map((p) => p.text).join(" "),
          textHtml: parts.map((p) => `<span class="gear-attribute-value" data-gear-attribute-key="${escapeHtml(normalizeKey(p.key))}">${escapeHtml(p.text)}</span>`).join("<br>"),
          key: parts[0].key,
          keys: parts.map((p) => p.key).filter(Boolean),
          cls: "line line--gray"
        });
      });
      const corePrefix = it.rarity === "gearset" ? "gearset" : "brand";
      const coreClass = (coreKey === "weapondamage") ? `${corePrefix}-core-weapon`
        : (coreKey === "armor") ? `${corePrefix}-core-armor`
          : (coreKey === "skilltier") ? `${corePrefix}-core-skill` : `${corePrefix}-core-other`;
      const card = document.createElement("div");
      card.className = `card ${it.rarity === "gearset" ? "rarity-gearset" : "rarity-highend"} ${coreClass}`;
      card.dataset.itemId = `gear-attributes:${it.rarity}:${key}`;
      card.dataset.search = search.filter(Boolean).join(" ");
      card.dataset.gearAttributeTraits = Array.from(traitKeys).join(" ");
      const icon = it.rarity === "gearset"
        ? gearsetIconUrl(it.set_key || key)
        : iconUrl("brands", it.set_key || key, "img/brands");
      const bg = icon ? bgIconHtml(icon, "card__bg--tr", it.set_name || "") : "";
      card.innerHTML = `
        ${bg}
        <div class="card__head"><div class="card__title-wrap card__title-wrap--gear"><div class="card__titles"><div class="card__title"><span class="card__title-text">${escapeHtml(title || "")}</span></div></div></div></div>
        <div class="lines">${lines.map((ln) => `<div class="${ln.cls}" data-stat-key="${escapeHtml(ln.key)}" data-stat-keys="${escapeHtml((ln.keys || [ln.key]).filter(Boolean).join(" "))}">${ln.icon || ""}<div class="line__body"><div class="line__text">${ln.textHtml || escapeHtml(ln.text)}</div></div></div>`).join("")}</div>
      `;
      (it.rarity === "gearset" ? gearsetGrid : brandGrid).appendChild(card);
    });
    contentEl.appendChild(section);
    applyFiltersToDom();
  }

  window.gearAttributesViewRender = async function () {
    setStatus(ui("loadingDb"));
    try { render(await loadRows()); setStatus(""); }
    catch (e) { clearContent(); setStatus(`${ui("error")}: ${e.message}`, "error"); }
  };
})();
