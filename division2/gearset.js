/* gearset-specific view logic */
(function () {
  let gearsetRowsCache = null;
  function textToHtmlPreserveNewline(text) {
    return escapeHtml(String(text || "")).replace(/\r?\n/g, "<br>");
  }
  function trGearsetTalentDesc(rawDesc, talentKey) {
    return trCategoryText("gearset_talent_desc", talentKey, String(rawDesc || "").replace(/\r/g, ""));
  }

  async function loadGearsetRows() {
    if (gearsetRowsCache) return gearsetRowsCache;
    const SQL = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasGearsets = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gearsets'").length > 0;
      const hasBonuses = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gearset_bonuses'").length > 0;
      if (!hasGearsets || !hasBonuses) {
        console.warn("Gearset tables are missing in items.db", { hasGearsets, hasBonuses });
        throw new Error("data_unavailable");
      }
      const stmt = db.prepare(`
        SELECT
          g.item_id,
          g.gearset_key,
          g.gearset,
          g.core_attribute,
          g.core_attribute_by_piece,
          b.slot,
          b.label,
          b.bonus_type,
          b.value,
          b.value_num,
          b.unit,
          b.type,
          b.type_key,
          b.talent_name,
          b.talent_desc
        FROM items_gearsets g
        LEFT JOIN items_gearset_bonuses b ON b.parent_item_id = g.item_id
        ORDER BY g.gearset, g.item_id, b.bonus_ord, b.bonus_part_ord
      `);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      gearsetRowsCache = { rows };
      return gearsetRowsCache;
    } finally {
      db.close();
    }
  }

  function renderGearsetViewFromRows(payload) {
    const rows = (payload && payload.rows) || [];
    clearContent();
    const byItem = new Map();
    (rows || []).forEach((r) => {
      const itemId = String(r.item_id || "").trim();
      if (!itemId) return;
      if (!byItem.has(itemId)) {
        byItem.set(itemId, {
          itemId,
          gearset: String(r.gearset || "").trim(),
          gearsetKey: String(r.gearset_key || "").trim(),
          core: String(r.core_attribute || "").trim(),
          coreByPiece: parseJsonObjectText(r.core_attribute_by_piece || ""),
          bonuses: []
        });
      }
      if (r.slot != null && String(r.slot).trim() !== "") {
        byItem.get(itemId).bonuses.push({
          slot: String(r.slot || "").trim(),
          label: String(r.label || "").trim(),
          bonusType: String(r.bonus_type || "").trim(),
          value: String(r.value || "").trim(),
          valueNum: String(r.value_num || "").trim(),
          unit: String(r.unit || "").trim(),
          type: String(r.type || "").trim(),
          typeKey: String(r.type_key || "").trim(),
          talentName: String(r.talent_name || "").trim(),
          talentDesc: String(r.talent_desc || "").trim()
        });
      }
    });

    const items = Array.from(byItem.values()).sort((a, b) => {
      const ak = normalizeKey(a.gearsetKey || a.gearset || "");
      const bk = normalizeKey(b.gearsetKey || b.gearset || "");
      const ta = (langSelect.value === "ja")
        ? (i18n[a.gearsetKey] ?? i18n[ak] ?? a.gearset)
        : a.gearset;
      const tb = (langSelect.value === "ja")
        ? (i18n[b.gearsetKey] ?? i18n[bk] ?? b.gearset)
        : b.gearset;
      return String(ta || "").localeCompare(String(tb || ""), langSelect.value === "ja" ? "ja" : "en");
    });
    if (!items.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }

    const section = document.createElement("section");
    section.className = "catgroup catgroup--gear gearset-view";
    section.innerHTML = `
      <div class="trello-group-toggle">
        <button class="btn btn--ghost talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
      </div>
      <div class="grid grid--gear"></div>
    `;
    const grid = section.querySelector(".grid");

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

    function coreClass(coreText) {
      const k = normalizeKey(coreText || "");
      if (k === "weapondamage") return "gearset-core-weapon";
      if (k === "armor") return "gearset-core-armor";
      if (k === "skilltier") return "gearset-core-skill";
      return "gearset-core-other";
    }
    function coreTokensFromValue(v) {
      if (Array.isArray(v)) return v.map((x) => String(x || "").trim()).filter(Boolean);
      const s = String(v || "").trim();
      return s ? [s] : [];
    }
    function coreMixedLineHtml(coreByPiece) {
      if (!coreByPiece || typeof coreByPiece !== "object") return "";
      const grouped = new Map();
      Object.entries(coreByPiece).forEach(([slotRaw, coreRaw]) => {
        const slot = String(slotRaw || "").trim();
        if (!slot) return;
        coreTokensFromValue(coreRaw).forEach((coreText) => {
          let key = normalizeKey(coreText);
          if (key === "random") key = "randomattribute";
          const label = (langSelect.value === "ja")
            ? trText(coreText)
            : coreText;
          if (!key) return;
          if (!grouped.has(key)) grouped.set(key, { label, slots: [] });
          grouped.get(key).slots.push(slot);
        });
      });
      if (!grouped.size) return "";
      const ordered = ["weapondamage", "armor", "skilltier", "randomattribute"];
      const keys = [...grouped.keys()].sort((a, b) => {
        const ai = ordered.indexOf(a);
        const bi = ordered.indexOf(b);
        if (ai >= 0 && bi >= 0) return ai - bi;
        if (ai >= 0) return -1;
        if (bi >= 0) return 1;
        return a.localeCompare(b);
      });
      const rows = keys.map((k) => {
        const g = grouped.get(k);
        if (!g) return "";
        const icons = (g.slots || []).map((slot) => {
          const src = iconUrl("gear_slots", normalizeKey(slot), "img/gears");
          const cls = `ico ico--core-slot core-mixed-icon core-mixed-icon--${escapeHtml(k)}`;
          return src ? iconImgHtml(src, cls, slot) : "";
        }).filter(Boolean).join("");
        const label = (k === "randomattribute")
          ? trText("Random Attribute")
          : trText(g.label || "");
        const rowCls = `core-mixed-row core-mixed-row--${escapeHtml(k)}`;
        return `<span class="${rowCls}"><span class="core-mixed-label">${escapeHtml(label)}</span><span class="core-mixed-icons">${icons}</span></span>`;
      }).filter(Boolean);
      if (!rows.length) return "";
      return `<span class="core-mixed-wrap">${rows.join("")}</span>`;
    }

    items.forEach((it) => {
      const setKeyNorm = normalizeKey(it.gearsetKey || it.gearset || "");
      const setIconPrimary = iconUrl("brands", it.gearsetKey || setKeyNorm, "img/brands");
      const setIconAlt = iconUrl("brands", setKeyNorm, "img/brands");
      const setIconFallbacks = [];
      if (setIconAlt && setIconAlt !== setIconPrimary) setIconFallbacks.push(setIconAlt);
      const setBgHtml = setIconPrimary
        ? bgIconHtml(setIconPrimary, "card__bg--tr", "gearset", setIconFallbacks)
        : "";

      const title = (langSelect.value === "ja")
        ? (i18n[it.gearsetKey] ?? i18n[setKeyNorm] ?? it.gearset)
        : it.gearset;
      const coreText = trText(it.core || "");
      const lines = [];
      const coreKey = normalizeKey(it.core || "");
      if (coreKey === "mixed" && it.coreByPiece && typeof it.coreByPiece === "object") {
        const mixedHtml = coreMixedLineHtml(it.coreByPiece);
        if (mixedHtml) {
          lines.push({
            cls: "line line--core",
            text: stripHtml(mixedHtml),
            textHtml: mixedHtml,
            key: "mixed"
          });
        } else if (coreText) {
          lines.push({ cls: "line line--core", text: coreText, key: coreKey });
        }
      } else if (coreText) {
        lines.push({ cls: "line line--core", text: coreText, key: coreKey });
      }
      const grouped = new Map();
      for (const b of it.bonuses) {
        const gk = `${b.slot}|${b.bonusType || ""}|${b.talentName || ""}|${b.talentDesc || ""}`;
        if (!grouped.has(gk)) grouped.set(gk, []);
        grouped.get(gk).push(b);
      }
      const showDesc = !!window.talentShowDesc;
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
          const talentIcon = pieceIcon || (isFourPc && setIconPrimary ? iconImgHtml(setIconPrimary, "ico ico--talent", "gearset", setIconFallbacks) : "");
          const talentKey = normalizeKey(tn || "");
          const tnDisp = (langSelect.value === "ja")
            ? (i18n[normalizeKey(tn)] ?? trText(tn))
            : tn;
          const tdDisp = (langSelect.value === "ja")
            ? trGearsetTalentDesc(td, talentKey)
            : td;
          if (tnDisp) lines.push({ cls: "line line--gray line--talent", text: tnDisp.trim(), key: talentKey, icon: talentIcon });
          if (tdDisp) {
            lines.push({
              cls: "line line--named-meta line--talent-desc",
              text: tdDisp,
              textHtml: textToHtmlPreserveNewline(tdDisp),
              key: "",
              isDesc: true
            });
          }
          continue;
        }
        const parts = [];
        gs.forEach((x) => {
          const typeText = trText(x.type || x.typeKey || "");
          const numUnit = `${formatDisplayNumber(x.valueNum || "")}${x.unit || ""}`.trim();
          const valText = [numUnit, typeText].filter(Boolean).join(" ").trim() || stripHtml(x.value || "");
          if (valText) parts.push({ text: valText, key: String(x.typeKey || "").trim() });
        });
        if (!parts.length) continue;
        const lineTextHtml = parts.map((p) => escapeHtml(p.text)).join("<br>");
        const lineKey = parts.map((p) => p.key).find(Boolean) || "";
        lines.push({ cls: "line line--gray", text: parts.map((p) => p.text).join(" "), textHtml: lineTextHtml, key: lineKey });
      }

      const searchParts = [];
      const pushSearch = (s) => {
        const n = normalizeKey(stripHtml(s || ""));
        if (n) searchParts.push(n);
      };
      pushSearch(it.gearsetKey || "");
      pushSearch(it.gearset || "");
      pushSearch(title || "");
      pushSearch(coreText || "");
      lines.forEach((ln) => pushSearch(ln.text || ""));

      const card = document.createElement("div");
      card.className = `card rarity-gearset ${coreClass(it.core)}`;
      const hasDescLines = lines.some((ln) => !!ln.isDesc);
      if (hasDescLines) {
        card.setAttribute("data-desc-collapsible", "1");
        card.setAttribute("data-desc-open", showDesc ? "1" : "0");
        card.classList.toggle("is-desc-open", !!showDesc);
      }
      card.setAttribute("data-item-id", `gearset:${it.itemId}`);
      card.setAttribute("data-search", searchParts.join(" "));
      card.innerHTML = `
        ${setBgHtml}
        <div class="card__head">
          <div class="card__title-wrap card__title-wrap--gear">
            <div class="card__titles">
              <div class="card__title"><span class="card__title-text">${escapeHtml(title)}</span></div>
            </div>
          </div>
        </div>
        <div class="lines">
          ${lines.map((ln) => `
            <div class="${ln.cls}" ${ln.key ? `data-stat-key="${escapeHtml(ln.key)}"` : ""} ${ln.isDesc ? `data-desc-line="1"` : ""}>
              ${ln.icon || ""}
              <div class="line__body"><div class="line__text">${ln.textHtml || escapeHtml(ln.text)}</div></div>
            </div>
          `).join("")}
        </div>
      `;
      grid.appendChild(card);
    });

    contentEl.appendChild(section);
    applyFiltersToDom();
  }

  window.gearsetViewRender = async function gearsetViewRender() {
    setStatus(ui("loadingDb"));
    try {
      const rows = await loadGearsetRows();
      renderGearsetViewFromRows(rows);
      setStatus("");
    } catch (e) {
      clearContent();
      const msg = (e && e.message === "data_unavailable") ? ui("dataUnavailable") : e.message;
      setStatus(`${ui("error")}: ${msg}`, "error");
    }
  };
})();
