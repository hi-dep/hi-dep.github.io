/* prototype-specific view logic */
(function () {
  let prototypeCache = null;

  async function fetchPrototypeData() {
    if (prototypeCache) return prototypeCache;
    const v = (window.indexJson && window.indexJson.built_at) ? `?v=${encodeURIComponent(window.indexJson.built_at)}` : `?v=${Date.now()}`;
    const res = await fetch(`${DATA_BASE}/prototype.json${v}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`prototype load failed: ${res.status}`);
    const data = await res.json();
    prototypeCache = data || {};
    return prototypeCache;
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

    contentEl.innerHTML = `
      <section class="catgroup catgroup--gear prototype-view">
        <div class="prototype-view__meta">
          <strong>Rows:</strong> ${rows.length}
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
