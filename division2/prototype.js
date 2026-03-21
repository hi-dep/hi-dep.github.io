/* prototype-specific view logic */
(function () {
  let prototypeCache = null;

  async function fetchPrototypeData() {
    if (prototypeCache) return prototypeCache;
    const SQL = await initSql();
    const v = (window.indexJson && window.indexJson.built_at) ? `?v=${encodeURIComponent(window.indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_prototype'").length > 0;
      if (!hasTable) {
        console.warn("Prototype table is missing in items.db", { hasTable });
        throw new Error("data_unavailable");
      }
      const stmt = db.prepare("SELECT payload FROM items_prototype ORDER BY row_id ASC");
      const rows = [];
      while (stmt.step()) {
        const rec = stmt.getAsObject() || {};
        const raw = String(rec.payload || "").trim();
        if (!raw) continue;
        try {
          const obj = JSON.parse(raw);
          if (obj && typeof obj === "object") rows.push(obj);
        } catch (_e) {
          // Keep rendering robust even if one row is malformed.
        }
      }
      stmt.free();
      prototypeCache = { items: rows };
      return prototypeCache;
    } finally {
      db.close();
    }
  }

  function cellText(row, key) {
    if (!row || typeof row !== "object") return "";
    return String((row[key] != null) ? row[key] : "").trim();
  }

  function localizedCell(row, baseKey) {
    const isJa = langSelect && langSelect.value === "ja";
    const primary = isJa ? `${baseKey}_ja` : baseKey;
    const fallback = isJa ? baseKey : `${baseKey}_ja`;
    return cellText(row, primary) || cellText(row, fallback);
  }

  function textToHtmlPreserveNewline(text) {
    return escapeHtml(String(text || "")).replace(/\r?\n/g, "<br>");
  }

  function prototypeIconKey(row) {
    const direct = normalizeKey(cellText(row, "icon_key"));
    if (direct) return direct;
    const nameKey = normalizeKey(cellText(row, "name_key"));
    if (nameKey) return nameKey;
    return normalizeKey(cellText(row, "name"));
  }

  function renderPrototype(payload) {
    clearContent();
    const rows = (payload && Array.isArray(payload.items)) ? payload.items : [];
    if (!rows.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }
    const cards = rows.map((row, idx) => {
      const nameText = localizedCell(row, "name");
      const descText = localizedCell(row, "desc");
      const attrText = localizedCell(row, "attr");
      const iconKey = prototypeIconKey(row);
      const iconSrc = iconUrl("prototype", iconKey, "img/prototype");
      const iconBg = iconSrc ? bgIconHtml(iconSrc, "card__bg--tr", nameText || iconKey || "prototype") : "";

      const searchParts = [
        cellText(row, "name"),
        cellText(row, "name_ja"),
        cellText(row, "desc"),
        cellText(row, "desc_ja"),
        cellText(row, "attr"),
        cellText(row, "attr_ja"),
      ].map((s) => normalizeKey(stripHtml(s || ""))).filter(Boolean);

      return `
        <article class="card rarity-prototype prototype-card" data-item-id="prototype:${idx}" data-search="${escapeHtml(searchParts.join(" "))}">
          ${iconBg}
          <div class="lines">
            ${nameText ? `<div class="line line--named"><div class="line__body"><div class="line__text">${escapeHtml(nameText)}</div></div></div>` : ""}
            ${attrText ? `<div class="line line--core"><div class="line__body"><div class="line__text">${escapeHtml(attrText)}</div></div></div>` : ""}
            ${descText ? `<div class="line line--gray"><div class="line__body"><div class="line__text">${textToHtmlPreserveNewline(descText)}</div></div></div>` : ""}
          </div>
        </article>
      `;
    }).join("");
    const augmentLabel = (langSelect && langSelect.value === "ja") ? "オーグメント" : "Augument";

    contentEl.innerHTML = `
      <section class="catgroup catgroup--gear prototype-view">
        <div class="prototype-view__meta">
          <strong>${escapeHtml(augmentLabel)}:</strong> ${rows.length}
        </div>
        <div class="grid grid--gear prototype-grid">
          ${cards}
        </div>
      </section>
    `;
    applyFiltersToDom();
  }

  async function prototypeViewRender() {
    const payload = await fetchPrototypeData();
    renderPrototype(payload);
  }

  window.prototypeViewRender = prototypeViewRender;
})();
