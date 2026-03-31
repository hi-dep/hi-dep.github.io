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
      const readPayloadRows = (tableName) => {
        const has = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`).length > 0;
        if (!has) return [];
        const stmt = db.prepare(`SELECT payload FROM ${tableName} ORDER BY row_id ASC`);
        const out = [];
        while (stmt.step()) {
          const rec = stmt.getAsObject() || {};
          const raw = String(rec.payload || "").trim();
          if (!raw) continue;
          try {
            const obj = JSON.parse(raw);
            if (obj && typeof obj === "object") out.push(obj);
          } catch (_e) {
            // Keep rendering robust even if one row is malformed.
          }
        }
        stmt.free();
        return out;
      };

      const rows = readPayloadRows("items_prototype");
      const attrs = readPayloadRows("items_prototype_attributes");
      const readNamedLookup = (tableName, colName, extraCol) => {
        const has = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`).length > 0;
        const byNameKey = {};
        const byName = {};
        if (!has) return { byNameKey, byName };
        const stmt = db.prepare(`SELECT name_key, ${colName}, ${extraCol} FROM ${tableName}`);
        while (stmt.step()) {
          const r = stmt.getAsObject() || {};
          const nk = normalizeKey(String(r.name_key || ""));
          const nn = normalizeKey(String(r[colName] || ""));
          const ev = normalizeKey(String(r[extraCol] || ""));
          if (!ev) continue;
          if (nk && !Object.prototype.hasOwnProperty.call(byNameKey, nk)) byNameKey[nk] = ev;
          if (nn && !Object.prototype.hasOwnProperty.call(byName, nn)) byName[nn] = ev;
        }
        stmt.free();
        return { byNameKey, byName };
      };

      const gearNamed = readNamedLookup("items_gear_named", "name", "item_type");
      const weaponNamed = readNamedLookup("items_weapon_named", "name", "weapon_group");
      prototypeCache = { items: rows, attributes: attrs, namedLookup: { gear: gearNamed, weapon: weaponNamed } };
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

  function localizedAttrCell(row, baseKey) {
    return trText(localizedCell(row, baseKey));
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

  function attrDotColorFromAttrKey(attrKeyText) {
    const fn = globalThis.blueprintPopupAttrDotColorClass;
    if (typeof fn !== "function") return "gray";
    const cls = String(fn(attrKeyText || "") || "");
    if (cls.includes("line--red")) return "red";
    if (cls.includes("line--blue")) return "blue";
    if (cls.includes("line--yellow")) return "yellow";
    return "gray";
  }

  function resolvePrototypeAttrStyle(row) {
    const cat = normalizeKey(cellText(row, "cat"));
    const type = normalizeKey(cellText(row, "type"));
    const attrKeyText = cellText(row, "attr") || localizedCell(row, "attr");
    const byAttr = attrDotColorFromAttrKey(attrKeyText);
    const weaponCats = new Set(["lmg", "mmr", "ar", "pistol", "rifle", "shotgun", "smg"]);

    if (cat === "gear") {
      if (type === "red" || type === "blue" || type === "yellow") {
        return { dot: type, namedText: false, enabled: true };
      }
      if (type === "core") return { dot: byAttr, namedText: false, enabled: true };
      if (type === "named") return { dot: byAttr, namedText: true, enabled: true };
      return { dot: "gray", namedText: false, enabled: false };
    }

    if (weaponCats.has(cat)) {
      if (type === "core1" || type === "core2") return { dot: "gray", namedText: false, enabled: true };
      if (type === "named") return { dot: "gray", namedText: true, enabled: true };
      return { dot: "gray", namedText: false, enabled: false };
    }

    if (cat === "weapon" && type === "attr") {
      return { dot: "gray", namedText: false, enabled: true };
    }

    return { dot: "gray", namedText: false, enabled: false };
  }

  function isWeaponBatchCat(catKey) {
    return new Set(["lmg", "mmr", "ar", "pistol", "rifle", "shotgun", "smg"]).has(catKey);
  }

  function weaponBatchShortLabel(catKey) {
    const fn = globalThis.blueprintPopupWeaponTypeShortLabel;
    if (typeof fn === "function") return String(fn(catKey || "") || "").trim();
    const k = normalizeKey(catKey || "");
    if (k === "ar") return "AR";
    if (k === "smg") return "SMG";
    if (k === "lmg") return "LMG";
    if (k === "shotgun") return "SG";
    if (k === "rifle") return "RF";
    if (k === "mmr") return "MMR";
    if (k === "pistol") return "HG";
    return String(catKey || "").toUpperCase();
  }

  function displayPrototypeCat(row) {
    const isJa = langSelect && langSelect.value === "ja";
    const cat = normalizeKey(cellText(row, "cat"));
    if (cat === "gear") return isJa ? "装備" : "Gear";
    if (cat === "weapon") return isJa ? "武器" : "Weapon";
    if (isWeaponBatchCat(cat)) return `${isJa ? "武器" : "Weapon"} ${weaponBatchShortLabel(cat)}`;
    return localizedAttrCell(row, "cat");
  }

  function renderPrototypeCatCell(row) {
    const isJa = langSelect && langSelect.value === "ja";
    const cat = normalizeKey(cellText(row, "cat"));
    if (isWeaponBatchCat(cat)) {
      const base = isJa ? "武器" : "Weapon";
      const short = weaponBatchShortLabel(cat);
      return `<span class="prototype-cat-wrap"><span>${escapeHtml(base)}</span><span class="wt-badge is-on">${escapeHtml(short)}</span></span>`;
    }
    return escapeHtml(displayPrototypeCat(row));
  }

  function displayPrototypeType(row) {
    const isJa = langSelect && langSelect.value === "ja";
    const cat = normalizeKey(cellText(row, "cat"));
    const type = normalizeKey(cellText(row, "type"));

    if (cat === "gear") {
      if (type === "core") return isJa ? "コア特性" : "Core Attribute";
      if (type === "red" || type === "blue" || type === "yellow") return isJa ? "特性" : "Attribute";
      if (type === "named") return isJa ? "ネームド特性" : "Named Attribute";
    }

    if (isWeaponBatchCat(cat)) {
      if (type === "core1" || type === "core2") return isJa ? "コア特性" : "Core Attribute";
      if (type === "named") return isJa ? "ネームド特性" : "Named Attribute";
    }

    if (cat === "weapon" && type === "attr") return isJa ? "特性" : "Attribute";
    return localizedAttrCell(row, "type");
  }

  function renderPrototypeItemCell(row) {
    const raw = cellText(row, "item");
    const parts = String(raw || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const st = resolvePrototypeAttrStyle(row);
    const cat = normalizeKey(cellText(row, "cat"));
    const namedKind = cat === "gear" ? "gear" : (isWeaponBatchCat(cat) ? "weapon" : "");
    const slotIconHtml = (slotKey, category) => {
      const s = normalizeKey(slotKey || "");
      const c = normalizeKey(category || "");
      let src = "";
      if (c === "weapon" && s) src = appPath(`img/weapons/${s}.png`);
      if (c === "gear") {
        if (s === "mask" || s === "backpack" || s === "chest") src = appPath(`img/gears/${s}.png`);
        if (s === "glove" || s === "gloves") src = appPath("img/gears/gloves.png");
        if (s === "holster") src = appPath("img/gears/holster.png");
        if (s === "kneepads" || s === "knee" || s === "kneepad") src = appPath("img/gears/kneepads.png");
      }
      if (!src) return "";
      return `<img class="ico ico--item-source blueprint-slot-ico" src="${escapeHtml(src)}" alt="${escapeHtml(s)}" loading="lazy" decoding="async" />`;
    };
    const namedExtraKey = (nameRaw) => {
      const key = normalizeKey(nameRaw || "");
      const look = (prototypeCache && prototypeCache.namedLookup) ? prototypeCache.namedLookup : null;
      if (!look) return "";
      if (namedKind === "gear") {
        const g = look.gear || {};
        return (g.byNameKey && g.byNameKey[key]) || (g.byName && g.byName[key]) || "";
      }
      if (namedKind === "weapon") {
        const w = look.weapon || {};
        return (w.byNameKey && w.byNameKey[key]) || (w.byName && w.byName[key]) || normalizeKey(cat);
      }
      return "";
    };
    const renderNamedBtn = (nameRaw) => {
      const label = trText(nameRaw);
      const key = normalizeKey(nameRaw);
      const btn = `<button type="button" class="inline-pop-trigger line__text-pop-trigger prototype-named-item-btn" data-pop-type="blueprint-named" data-named-kind="${escapeHtml(namedKind)}" data-named-name="${escapeHtml(nameRaw)}" data-named-name-key="${escapeHtml(key)}">${escapeHtml(label)}</button>`;
      const extra = namedExtraKey(nameRaw);
      const icon = slotIconHtml(extra, namedKind);
      if (!icon) return btn;
      return `<span class="blueprint-slot-inline"><span class="blueprint-slot-pill is-on">${icon}</span><span class="blueprint-slot-inline-name">${btn}</span></span>`;
    };
    if (parts.length <= 1) {
      if (st.namedText && namedKind && raw) return renderNamedBtn(raw);
      return escapeHtml(trText(raw));
    }
    if (st.namedText && namedKind) return parts.map((s) => renderNamedBtn(s)).join("<br>");
    return parts.map((s) => escapeHtml(trText(s))).join("<br>");
  }

  function renderPrototypeAttrLabelCell(row) {
    const label = localizedAttrCell(row, "attr");
    const st = resolvePrototypeAttrStyle(row);
    if (!st.namedText) return escapeHtml(label);
    return `<span class="prototype-attr-label--named">${escapeHtml(label)}</span>`;
  }

  function compactPercentText(v) {
    const s = String(v == null ? "" : v).trim();
    const m = s.match(/^(-?\d+)\.(\d+)%$/);
    if (!m) return s;
    const frac = String(m[2] || "").replace(/0+$/, "");
    if (!frac) return `${m[1]}%`;
    return `${m[1]}.${frac}%`;
  }

  function renderValueCellText(v) {
    const text = compactPercentText(v);
    if (normalizeKey(text) === "unknown") {
      return `<span class="prototype-value-unknown">${escapeHtml(text)}</span>`;
    }
    return escapeHtml(text);
  }

  function renderPrototypeAttributes(payload) {
    const rows = (payload && Array.isArray(payload.attributes)) ? payload.attributes : [];
    if (!rows.length) return "";
    const isJa = langSelect && langSelect.value === "ja";
    const title = isJa ? "プロトタイプ特性" : "Prototype Attributes";
    const thCat = isJa ? "カテゴリ" : "Category";
    const thType = isJa ? "種別" : "Type";
    const thAttr = isJa ? "属性" : "Attribute";
    const thValue = isJa ? "通常" : "Base";
    const thPValue = isJa ? "プロトタイプ" : "Prototype";
    const thItem = isJa ? "対象" : "Item";
    const body = rows.map((row) => {
      const catHtml = renderPrototypeCatCell(row);
      const type = displayPrototypeType(row);
      const st = resolvePrototypeAttrStyle(row);
      const accentCls = st.enabled ? ` prototype-attrs-accent--${st.dot}` : "";
      const attr = renderPrototypeAttrLabelCell(row);
      const valueHtml = renderValueCellText(localizedCell(row, "value"));
      const pvalHtml = renderValueCellText(localizedCell(row, "prototypeattr"));
      const itemHtml = renderPrototypeItemCell(row);
      return `
        <tr class="prototype-attrs-row">
          <td class="blueprint-td-accent"><span class="blueprint-accent prototype-attrs-accent${accentCls}"></span></td>
          <td class="prototype-attrs-td prototype-attrs-td--cat">${catHtml}</td>
          <td class="prototype-attrs-td">${escapeHtml(type)}</td>
          <td class="prototype-attrs-td">${attr}</td>
          <td class="prototype-attrs-td">${valueHtml}</td>
          <td class="prototype-attrs-td">${pvalHtml}</td>
          <td class="prototype-attrs-td prototype-attrs-td--item">${itemHtml}</td>
        </tr>
      `;
    }).join("");
    return `
      <section class="prototype-attrs blueprint-table-wrap">
        <h3 class="catgroup__title prototype-attrs__title">${escapeHtml(title)}</h3>
        <div class="blueprint-table-scroll">
          <table class="blueprint-table prototype-attrs-table">
            <thead>
              <tr>
                <th class="blueprint-th-accent"></th>
                <th>${escapeHtml(thCat)}</th>
                <th>${escapeHtml(thType)}</th>
                <th>${escapeHtml(thAttr)}</th>
                <th>${escapeHtml(thValue)}</th>
                <th>${escapeHtml(thPValue)}</th>
                <th>${escapeHtml(thItem)}</th>
              </tr>
            </thead>
            <tbody>${body}</tbody>
          </table>
        </div>
      </section>
    `;
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
      const attrText = localizedAttrCell(row, "attr");
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
    const augmentLabel = (langSelect && langSelect.value === "ja") ? "オーグメント" : "Augment";

    contentEl.innerHTML = `
      <section class="catgroup catgroup--gear prototype-view">
        <div class="prototype-view__meta">
          <strong>${escapeHtml(augmentLabel)}</strong>
        </div>
        <div class="grid grid--gear prototype-grid">
          ${cards}
        </div>
        ${renderPrototypeAttributes(payload)}
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
