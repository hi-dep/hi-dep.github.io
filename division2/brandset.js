/* brandset-specific view logic */
(function () {
  let brandRowsCache = null;
  let brandTraitFilters = [];

  function brandTraitLabel(key, fallback) {
    return langSelect.value === "ja"
      ? (i18n[key] ?? fallback ?? key)
      : (fallback ?? key);
  }

  function renderBrandTraitChips(container) {
    if (!container) return;
    container.innerHTML = brandTraitFilters.map((key) => `
      <span class="brand-trait-chip">
        <span>${escapeHtml(brandTraitLabel(key, key))}</span>
        <button type="button" class="brand-trait-chip__remove" data-brand-trait-remove="${escapeHtml(key)}" aria-label="${escapeHtml(ui("removeTraitFilter"))}">×</button>
      </span>
    `).join("");
  }

  window.brandTraitCardMatches = function brandTraitCardMatches(card) {
    if (!brandTraitFilters.length) return true;
    const cardKeys = new Set(String(card?.dataset?.brandTraits || "").split(" ").filter(Boolean));
    return brandTraitFilters.some((key) => cardKeys.has(key));
  };

  window.brandClearTraitFilters = function brandClearTraitFilters(options) {
    brandTraitFilters = [];
    const chips = document.querySelector("[data-brand-trait-chips]");
    renderBrandTraitChips(chips);
    const select = document.querySelector("[data-brand-trait-select]");
    const add = document.querySelector("[data-brand-trait-add]");
    if (select) select.value = "";
    if (add) add.disabled = true;
    if (!options?.silent) applyFiltersToDom();
  };

  async function loadBrandRows() {
    if (brandRowsCache) return brandRowsCache;
    const SQL = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasBrandsets = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_brandsets'").length > 0;
      const hasBonuses = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_brandset_bonuses'").length > 0;
      if (!hasBrandsets || !hasBonuses) {
        console.warn("Brand tables are missing in items.db", { hasBrandsets, hasBonuses });
        throw new Error("data_unavailable");
      }
      const stmt = db.prepare(`
        SELECT
          b.item_id,
          b.brandset_key,
          b.brandset,
          b.core_attribute,
          bo.slot,
          bo.label,
          bo.value,
          bo.type,
          bo.type_key,
          bo.value_num,
          bo.unit
        FROM items_brandsets b
        LEFT JOIN items_brandset_bonuses bo ON bo.parent_item_id = b.item_id
        ORDER BY b.brandset, b.item_id, bo.bonus_ord, bo.bonus_part_ord
      `);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      let namedRows = [];
      const hasGearNamed = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gear_named'").length > 0;
      if (hasGearNamed) {
        const nst = db.prepare(`
          SELECT
            item_id,
            brandset_key,
            brandset,
            item_type,
            name,
            name_key,
            talent,
            talent_key,
            attr,
            attr_type_keys
          FROM items_gear_named
          WHERE (trim(brandset_key) <> '' OR trim(brandset) <> '') AND trim(name) <> ''
          ORDER BY brandset_key, name
        `);
        while (nst.step()) namedRows.push(nst.getAsObject());
        nst.free();
      }
      brandRowsCache = { rows, namedRows };
      return brandRowsCache;
    } finally {
      db.close();
    }
  }

  function renderBrandViewFromRows(payload) {
    const rows = (payload && payload.rows) || [];
    const namedRows = (payload && payload.namedRows) || [];
    clearContent();
    const byItem = new Map();
    const namedByBrand = new Map();
    (rows || []).forEach((r) => {
      const itemId = String(r.item_id || "").trim();
      if (!itemId) return;
      if (!byItem.has(itemId)) {
        byItem.set(itemId, {
          brandset: r.brandset || "",
          brandsetKey: r.brandset_key || normalizeKey(r.brandset || ""),
          core: r.core_attribute || "",
          bonuses: []
        });
      }
      if (r.slot != null && String(r.slot).trim() !== "") {
        byItem.get(itemId).bonuses.push({
          slot: String(r.slot || "").trim(),
          label: String(r.label || "").trim(),
          value: String(r.value || "").trim(),
          type: String(r.type || "").trim(),
          typeKey: String(r.type_key || "").trim(),
          valueNum: String(r.value_num || "").trim(),
          unit: String(r.unit || "").trim()
        });
      }
    });
    (namedRows || []).forEach((r) => {
      const entry = {
        itemId: String(r.item_id || "").trim(),
        itemType: String(r.item_type || "").trim(),
        name: String(r.name || "").trim(),
        nameKey: String(r.name_key || "").trim(),
        talent: String(r.talent || "").trim(),
        talentKey: String(r.talent_key || "").trim(),
        attr: parseJsonObjectArrayText(r.attr || ""),
        attrTypeKeys: parseJsonArrayText(r.attr_type_keys || "")
      };
      const keys = brandJoinCandidates(r.brandset_key || "", r.brandset || "");
      keys.forEach((bk) => {
        if (!bk) return;
        if (!namedByBrand.has(bk)) namedByBrand.set(bk, []);
        namedByBrand.get(bk).push(entry);
      });
    });

    function coreRank(coreText) {
      const k = normalizeKey(coreText || "");
      if (k === "weapondamage") return 0;
      if (k === "armor") return 1;
      if (k === "skilltier") return 2;
      return 9;
    }
    function coreClass(coreText) {
      const k = normalizeKey(coreText || "");
      if (k === "weapondamage") return "brand-core-weapon";
      if (k === "armor") return "brand-core-armor";
      if (k === "skilltier") return "brand-core-skill";
      return "brand-core-other";
    }
    function brandDisplayTitle(it) {
      const brandKeyNorm = normalizeKey(it.brandsetKey || it.brandset || "");
      return (langSelect.value === "ja")
        ? (i18n[it.brandsetKey] ?? i18n[brandKeyNorm] ?? it.brandset)
        : (it.brandset || "");
    }

    const items = Array.from(byItem.values()).sort((a, b) => {
      const ra = coreRank(a.core);
      const rb = coreRank(b.core);
      if (ra !== rb) return ra - rb;
      const ta = String(brandDisplayTitle(a) || "");
      const tb = String(brandDisplayTitle(b) || "");
      return ta.localeCompare(tb, langSelect.value === "ja" ? "ja" : "en");
    });
    if (!items.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }

    const traitOptions = Array.from(new Map(
      items.flatMap((it) => it.bonuses.map((b) => {
        const key = normalizeKey(b.typeKey || b.type || "");
        return key ? [key, { key, label: b.type || b.typeKey || key }] : null;
      }).filter(Boolean))
    ).values()).sort((a, b) => brandTraitLabel(a.key, a.label).localeCompare(brandTraitLabel(b.key, b.label), langSelect.value === "ja" ? "ja" : "en"));
    const availableTraitKeys = new Set(traitOptions.map((x) => x.key));
    brandTraitFilters = brandTraitFilters.filter((key) => availableTraitKeys.has(key));

    const section = document.createElement("section");
    section.className = "catgroup catgroup--gear brandset-view";
    section.innerHTML = `
      <div class="trello-group-toggle">
        <button class="btn btn--ghost brand-named-btn ${window.brandShowNamed ? "is-on" : ""}" type="button" data-toggle-brand-named="1">Named</button>
      </div>
      <div class="grid grid--gear"></div>
    `;
    const grid = section.querySelector(".grid");
    const traitSelect = section.querySelector("[data-brand-trait-select]");
    const traitAdd = section.querySelector("[data-brand-trait-add]");
    const traitChips = section.querySelector("[data-brand-trait-chips]");
    renderBrandTraitChips(traitChips);
    if (traitSelect) {
      traitSelect.addEventListener("change", () => {
        if (traitAdd) traitAdd.disabled = !traitSelect.value || brandTraitFilters.includes(traitSelect.value);
      });
    }
    if (traitAdd) {
      traitAdd.addEventListener("click", () => {
        const key = String(traitSelect?.value || "").trim();
        if (!key || brandTraitFilters.includes(key)) return;
        brandTraitFilters = brandTraitFilters.concat(key);
        renderBrandTraitChips(traitChips);
        traitSelect.value = "";
        traitAdd.disabled = true;
        applyFiltersToDom();
      });
    }
    traitChips?.addEventListener("click", (event) => {
      const remove = event.target.closest("[data-brand-trait-remove]");
      if (!remove) return;
      const key = remove.getAttribute("data-brand-trait-remove");
      brandTraitFilters = brandTraitFilters.filter((x) => x !== key);
      renderBrandTraitChips(traitChips);
      applyFiltersToDom();
    });

    items.forEach((it) => {
      const brandKeyNorm = normalizeKey(it.brandsetKey || it.brandset || "");
      const title = brandDisplayTitle(it);
      const brandIconPrimary = iconUrl("brands", it.brandsetKey || brandKeyNorm, "img/icon/brandset");
      const brandIconAlt = iconUrl("brands", brandKeyNorm, "img/icon/brandset");
      const brandIconFallbacks = [];
      if (brandIconAlt && brandIconAlt !== brandIconPrimary) brandIconFallbacks.push(brandIconAlt);
      const brandBgHtml = brandIconPrimary
        ? bgIconHtml(brandIconPrimary, "card__bg--tr", "brand", brandIconFallbacks)
        : "";
      const core = trText(it.core);
      const baseLines = [];
      if (core) baseLines.push(core);
      it.bonuses.forEach((b) => {
        const typeText = (langSelect.value === "ja")
          ? trText(b.typeKey || b.type || "")
          : trText(b.type || b.typeKey || "");
        let text = "";
        const numUnit = `${formatDisplayNumber(b.valueNum || "")}${b.unit || ""}`.trim();
        if (numUnit || typeText) {
          text = [numUnit, typeText].filter(Boolean).join(" ");
        } else {
          text = stripHtml(b.value || "");
        }
        text = text.trim();
        if (text) baseLines.push(text);
      });
      const namedLines = [];
      if (window.brandShowNamed) {
        const nlRaw = [];
        const candidates = brandJoinCandidates(it.brandsetKey || "", it.brandset || "");
        candidates.forEach((k) => {
          const hit = namedByBrand.get(k);
          if (hit && hit.length) nlRaw.push(...hit);
        });
        const seenNamedItem = new Set();
        const nl = nlRaw.filter((n) => {
          const id = String(n.itemId || "");
          if (!id) return true;
          if (seenNamedItem.has(id)) return false;
          seenNamedItem.add(id);
          return true;
        });
        nl.forEach((n) => {
          const nm = (langSelect.value === "ja")
            ? (i18n[n.nameKey] ?? n.name)
            : n.name;
          const sk = gearSlotKey(n.itemType || "");
          const slotIconSrc = iconUrl("gear_slots", sk, "img/icon/slot");
          const slotIcon = slotIconSrc ? iconImgHtml(slotIconSrc, "ico ico--talent", "slot") : "";
          const details = [];
          if (n.talent || n.talentKey) {
            const talentKeyNorm = normalizeKey(n.talentKey || n.talent || "");
            const talentText = (langSelect.value === "ja")
              ? (i18n[n.talentKey] ?? trText(n.talent || n.talentKey))
              : (n.talent || n.talentKey);
            if (talentText) details.push({ kind: "talent", text: talentText, talentKey: talentKeyNorm });
          } else if (Array.isArray(n.attr) && n.attr.length) {
            const attrLines = [];
            let hasNumeric = false;
            n.attr.forEach((a) => {
              const numOnly = formatDisplayNumber(a.num);
              const numUnit = `${numOnly}${a.unit || ""}`.trim();
              if (numOnly) hasNumeric = true;
              const typeText = trText(a.type || "");
              const line = [numUnit, typeText].filter(Boolean).join(" ").trim();
              if (line) attrLines.push(line);
            });
            if (attrLines.length) {
              if (hasNumeric) {
                attrLines.forEach((line) => details.push({ kind: "attr", text: line, talentKey: "" }));
              } else {
                details.push({ kind: "attr", text: attrLines.join(" / "), talentKey: "" });
              }
            }
          } else if (Array.isArray(n.attrTypeKeys) && n.attrTypeKeys.length) {
            const attrs = n.attrTypeKeys
              .map((k) => String(k || "").trim())
              .filter(Boolean)
              .map((kk) => (langSelect.value === "ja") ? (i18n[kk] ?? trText(kk)) : kk)
              .filter(Boolean);
            if (attrs.length) details.push({ kind: "attr", text: attrs.join(" / "), talentKey: "" });
          }
          if (nm) namedLines.push({
            name: nm,
            details,
            slotIcon,
            itemId: String(n.itemId || ""),
            nameKey: String(n.nameKey || "")
          });
        });
      }

      const searchParts = [];
      const pushSearch = (s) => {
        const n = normalizeKey(stripHtml(s || ""));
        if (n) searchParts.push(n);
      };
      pushSearch(it.brandsetKey || "");
      pushSearch(it.brandset || "");
      pushSearch(title || "");
      pushSearch(it.core || "");
      baseLines.forEach((ln) => pushSearch(ln));
      namedLines.forEach((n) => {
        pushSearch(n.name || "");
        (n.details || []).forEach((d) => pushSearch(d.text || ""));
      });
      const search = searchParts.join(" ");
      const brandCardId = `brand:${brandKeyNorm || normalizeKey(title || it.brandset || "")}`;
      const brandTraitKeys = it.bonuses
        .map((b) => normalizeKey(b.typeKey || b.type || ""))
        .filter(Boolean);

      const card = document.createElement("div");
      card.className = `card rarity-highend ${coreClass(it.core)}`;
      card.setAttribute("data-item-id", brandCardId);
      card.setAttribute("data-search", search);
      card.setAttribute("data-brand-traits", Array.from(new Set(brandTraitKeys)).join(" "));
      card.innerHTML = `
        ${brandBgHtml}
        <div class="card__head">
          <div class="card__title-wrap card__title-wrap--gear">
            <div class="card__titles">
              <div class="card__title"><span class="card__title-text">${escapeHtml(title)}</span></div>
            </div>
          </div>
        </div>
        <div class="lines">
          ${baseLines.map((ln, idx) => `<div class="line ${idx === 0 ? "line--core" : "line--gray"}"><div class="line__body"><div class="line__text">${escapeHtml(ln)}</div></div></div>`).join("")}
          ${namedLines.length ? `<hr class="brand-named-sep">` : ""}
          ${namedLines.map((n) => `
            <div class="line line--named">${n.slotIcon || ""}<div class="line__body"><div class="line__text">${escapeHtml(n.name)}</div></div></div>
            ${(n.details || []).map((d) => {
              const icon = (d && d.kind === "talent") ? brandTalentIconHtml(d.talentKey || "", d.text || "") : "";
              const cls = (d && d.kind === "talent")
                ? "line line--named-meta line--talent"
                : "line line--named-meta line--named-attr";
              if (d && d.kind === "talent") {
                const talentName = String(d.text || "").trim();
                const talentKey = normalizeKey(d.talentKey || talentName || "");
                const popText = window.buildTalentPopTriggerHtml({
                  text: talentName,
                  itemCategory: "gear",
                  itemRarity: "named",
                  itemId: String(n.itemId || ""),
                  itemNameKey: String(n.nameKey || ""),
                  talentKey,
                  talentName,
                  talentNamed: true
                });
                return `<div class="${cls}">${icon}<div class="line__body"><div class="line__text">${popText}</div></div></div>`;
              }
              return `<div class="${cls}">${icon}<div class="line__body"><div class="line__text">${escapeHtml(d.text || "")}</div></div></div>`;
            }).join("")}
          `).join("")}
        </div>
      `;
      grid.appendChild(card);
    });

    contentEl.appendChild(section);
    if (typeof setFiltersOpen === "function") setFiltersOpen(filtersOpen);
    applyFiltersToDom();
  }

  window.brandViewRender = async function brandViewRender() {
    setStatus(ui("loadingDb"));
    try {
      const rows = await loadBrandRows();
      renderBrandViewFromRows(rows);
      setStatus("");
    } catch (e) {
      clearContent();
      const msg = (e && e.message === "data_unavailable") ? ui("dataUnavailable") : e.message;
      setStatus(`${ui("error")}: ${msg}`, "error");
    }
  };
})();
