/* weapons-specific view logic */
(function () {
  let weaponsRowsCache = null;
  let weaponsSortState = { key: "type", dir: "asc" };
  if (typeof window.weaponsShowDetails === "undefined") {
    window.weaponsShowDetails = false;
  }
  if (!Array.isArray(window.weaponsTypeFilter)) {
    window.weaponsTypeFilter = [];
  }

  function updateWeaponsStickyOffset() {
    const topbar = document.querySelector(".topbar");
    const h = topbar ? Math.ceil(topbar.getBoundingClientRect().height) : 0;
    document.documentElement.style.setProperty("--weapons-sticky-top", `${h}px`);
  }

  async function loadWeaponsRows() {
    if (weaponsRowsCache) return weaponsRowsCache;
    const SQL = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasWeapons = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_weapons'").length > 0;
      if (!hasWeapons) {
        console.warn("Weapons table is missing in items.db", { hasWeapons });
        throw new Error("data_unavailable");
      }
      const stmt = db.prepare(`
        SELECT
          item_id,
          name_key,
          name,
          weapon_group,
          family,
          family_key,
          base,
          base_key,
          rarity_tier,
          rpm,
          base_mag_size,
          empty_reload_secs,
          base_damage,
          optimal_range
        FROM items_weapons
        ORDER BY weapon_group, name
      `);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      weaponsRowsCache = { rows };
      return weaponsRowsCache;
    } finally {
      db.close();
    }
  }

  function renderWeaponsViewFromRows(payload) {
    const rows = (payload && payload.rows) || [];
    updateWeaponsStickyOffset();
    clearContent();
    if (!rows.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }

    function weaponTypeShortLabel(groupKey, fallbackLabel) {
      const k = normalizeKey(groupKey || "");
      const map = { ar: "AR", smg: "SMG", mmr: "MMR", rifle: "RF", shotgun: "SG", pistol: "HG", lmg: "LMG" };
      return map[k] || String(fallbackLabel || "").toUpperCase();
    }
    function buildWeaponsTypeFilterButtonsHtml() {
      const active = new Set(Array.isArray(window.weaponsTypeFilter) ? window.weaponsTypeFilter : []);
      const defs = [
        { key: "ar", label: "AR" },
        { key: "smg", label: "SMG" },
        { key: "lmg", label: "LMG" },
        { key: "shotgun", label: "SG" },
        { key: "rifle", label: "RF" },
        { key: "mmr", label: "MMR" },
        { key: "pistol", label: "HG" },
      ];
      const typeBtns = defs.map((d) =>
        `<button class="btn btn--ghost weapons-type-filter-btn ${active.has(d.key) ? "is-on" : ""}" type="button" data-weapons-type="${escapeHtml(d.key)}">${escapeHtml(d.label)}</button>`
      ).join("");
      return typeBtns;
    }
    function matchesWeaponsTypeFilter(groupKey) {
      const active = new Set(Array.isArray(window.weaponsTypeFilter) ? window.weaponsTypeFilter : []);
      if (!active.size) return true;
      return active.has(normalizeKey(groupKey || ""));
    }
    function typeOrder(groupKey) {
      const k = normalizeKey(groupKey || "");
      const ord = { ar: 1, smg: 2, mmr: 3, rifle: 4, shotgun: 5, pistol: 6, lmg: 7 };
      return ord[k] || 99;
    }
    function compareText(a, b) {
      return String(a || "").localeCompare(String(b || ""), langSelect.value === "ja" ? "ja" : "en");
    }
    function weaponNameJaWithReplica(row) {
      const rawName = String(row.name || "");
      const directKey = String(row.name_key || "").trim();
      const nk = normalizeKey(directKey || rawName);
      const direct = i18n[directKey] ?? i18n[nk];
      if (direct) return direct;
      if (nk.endsWith("replica")) {
        const baseKey = nk.slice(0, -("replica".length));
        const baseName = i18n[baseKey];
        if (baseName) return `${baseName} 模造品`;
      }
      return rawName;
    }
    function displayName(row) {
      return (langSelect.value === "ja") ? weaponNameJaWithReplica(row) : (row.name || "");
    }
    function numOf(v) {
      const n = Number(v);
      return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
    }
    function compareRows(a, b) {
      const key = weaponsSortState.key || "type";
      const dir = (weaponsSortState.dir === "desc") ? -1 : 1;
      let c = 0;
      if (key === "type") {
        c = typeOrder(a.weapon_group) - typeOrder(b.weapon_group);
        if (c === 0) c = compareText(displayName(a), displayName(b));
      } else if (key === "name") {
        c = compareText(displayName(a), displayName(b));
      } else if (key === "base_damage" || key === "rpm" || key === "base_mag_size" || key === "empty_reload_secs" || key === "optimal_range") {
        c = numOf(a[key]) - numOf(b[key]);
        if (c === 0) c = compareText(displayName(a), displayName(b));
      } else {
        c = compareText(displayName(a), displayName(b));
      }
      return c * dir;
    }
    function headerParts(key) {
      const ja = langSelect.value === "ja";
      if (key === "type") return { a: "Type", b: "" };
      if (key === "name") return { a: ja ? "名前" : "Name", b: "" };
      if (key === "base_damage") return { a: ja ? "基礎" : "Base", b: ja ? "ダメージ" : "Damage" };
      if (key === "rpm") return { a: "RPM", b: "" };
      if (key === "base_mag_size") return { a: ja ? "マガジン" : "Base Mag", b: ja ? "容量" : "Size" };
      if (key === "empty_reload_secs") return { a: ja ? "リロード" : "Reload", b: ja ? "速度" : "" };
      if (key === "optimal_range") return { a: ja ? "最適射程" : "Optimal", b: ja ? "距離" : "Range" };
      return { a: key, b: "" };
    }
    function sortArrow(key) {
      if ((weaponsSortState.key || "type") !== key) return "";
      return weaponsSortState.dir === "desc" ? "▼" : "▲";
    }
    function thButton(key) {
      const p = headerParts(key);
      const arrow = sortArrow(key);
      const active = ((weaponsSortState.key || "type") === key) ? " is-active" : "";
      return `<button type="button" class="weapons-th-btn${active}" data-sort-key="${escapeHtml(key)}"><span class="weapons-th-line">${escapeHtml(p.a)}</span>${p.b ? `<span class="weapons-th-line">${escapeHtml(p.b)}</span>` : `<span class="weapons-th-line weapons-th-line--empty"></span>`}<span class="weapons-th-arrow">${escapeHtml(arrow)}</span></button>`;
    }

    const filteredRows = rows.filter((r) => matchesWeaponsTypeFilter(r.weapon_group || ""));
    const sorted = filteredRows.slice().sort(compareRows);
    const showDetailCols = !!window.weaponsShowDetails;

    const section = document.createElement("section");
    section.className = "catgroup catgroup--weapon";
    const detailBtnLabel = (langSelect.value === "ja") ? "詳細" : "Detail";
    section.innerHTML = `
      <div class="trello-group-toggle weapon-type-filter-row">
        <button class="btn btn--ghost weapons-detail-btn ${window.weaponsShowDetails ? "is-on" : ""}" type="button" data-toggle-weapons-detail="1">${escapeHtml(detailBtnLabel)}</button>
        ${buildWeaponsTypeFilterButtonsHtml()}
      </div>
      <div class="weapons-table-wrap">
        <table class="weapons-table">
          <thead>
            <tr>
              <th>${thButton("type")}</th>
              <th>${thButton("name")}</th>
              ${showDetailCols ? `<th>${thButton("base_damage")}</th>` : ""}
              ${showDetailCols ? `<th>${thButton("rpm")}</th>` : ""}
              ${showDetailCols ? `<th>${thButton("base_mag_size")}</th>` : ""}
              ${showDetailCols ? `<th>${thButton("empty_reload_secs")}</th>` : ""}
              ${showDetailCols ? `<th>${thButton("optimal_range")}</th>` : ""}
            </tr>
          </thead>
          <tbody></tbody>
        </table>
      </div>
    `;
    const tbody = section.querySelector("tbody");

    sorted.forEach((r) => {
      const nameNorm = normalizeKey(r.name_key || r.name || "");
      const title = (langSelect.value === "ja") ? weaponNameJaWithReplica(r) : (r.name || "");
      const groupKey = normalizeKey(r.weapon_group || "");
      const groupLabel = weaponTypeShortLabel(groupKey, trText(r.weapon_group || ""));
      const slotIcon = iconUrl("weapon_types", groupKey, "img/weapons");
      const slotIconHtml = slotIcon ? iconImgHtml(slotIcon, "ico", "weapon") : "";

      const mBaseDamage = formatDisplayNumber(r.base_damage);
      const mRpm = formatDisplayNumber(r.rpm);
      const mBaseMag = formatDisplayNumber(r.base_mag_size);
      const mReload = formatDisplayNumber(r.empty_reload_secs);
      const mRange = formatDisplayNumber(r.optimal_range);

      const searchParts = [];
      const pushSearch = (s) => {
        const n = normalizeKey(stripHtml(s || ""));
        if (n) searchParts.push(n);
      };
      pushSearch(r.name_key || "");
      pushSearch(r.name || "");
      pushSearch(r.weapon_group || "");
      pushSearch(r.family || "");
      pushSearch(mBaseDamage);
      pushSearch(mRpm);
      pushSearch(mBaseMag);
      pushSearch(mReload);
      pushSearch(mRange);

      const tr = document.createElement("tr");
      tr.className = `weapon-row rarity-${escapeHtml(r.rarity_tier || "highend")}`;
      tr.setAttribute("data-item-id", `weapon:${String(r.item_id || nameNorm)}`);
      tr.setAttribute("data-search", searchParts.join(" "));
      tr.innerHTML = `
        <td class="weapon-cell weapon-cell--slot">${slotIconHtml}<span class="weapon-type-badge">${escapeHtml(groupLabel || r.weapon_group || "")}</span></td>
        <td class="weapon-cell weapon-cell--name">${escapeHtml(title)}</td>
        ${showDetailCols ? `<td class="weapon-cell">${escapeHtml(mBaseDamage)}</td>` : ""}
        ${showDetailCols ? `<td class="weapon-cell">${escapeHtml(mRpm)}</td>` : ""}
        ${showDetailCols ? `<td class="weapon-cell">${escapeHtml(mBaseMag)}</td>` : ""}
        ${showDetailCols ? `<td class="weapon-cell">${escapeHtml(mReload ? `${mReload}s` : "")}</td>` : ""}
        ${showDetailCols ? `<td class="weapon-cell">${escapeHtml(mRange ? `${mRange}m` : "")}</td>` : ""}
      `;
      tbody.appendChild(tr);
    });

    contentEl.appendChild(section);
    section.querySelectorAll(".weapons-th-btn[data-sort-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const key = String(btn.getAttribute("data-sort-key") || "").trim();
        if (!key) return;
        if (weaponsSortState.key === key) {
          weaponsSortState.dir = weaponsSortState.dir === "asc" ? "desc" : "asc";
        } else {
          weaponsSortState.key = key;
          weaponsSortState.dir = "asc";
        }
        renderWeaponsViewFromRows(payload);
      });
    });
    const detailBtn = section.querySelector(".weapons-detail-btn[data-toggle-weapons-detail]");
    if (detailBtn) {
      detailBtn.addEventListener("click", () => {
        window.weaponsShowDetails = !window.weaponsShowDetails;
        renderWeaponsViewFromRows(payload);
      });
    }
    section.querySelectorAll(".weapons-type-filter-btn[data-weapons-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = normalizeKey(btn.getAttribute("data-weapons-type") || "");
        const all = ["ar", "smg", "lmg", "shotgun", "rifle", "mmr", "pistol"];
        const cur = new Set(Array.isArray(window.weaponsTypeFilter) ? window.weaponsTypeFilter : []);
        if (all.includes(t)) {
          if (cur.has(t)) cur.delete(t);
          else cur.add(t);
          window.weaponsTypeFilter = all.filter((k) => cur.has(k));
        }
        renderWeaponsViewFromRows(payload);
      });
    });
    applyFiltersToDom();
  }

  window.addEventListener("resize", () => {
    updateWeaponsStickyOffset();
  });

  window.weaponsViewRender = async function weaponsViewRender() {
    setStatus(ui("loadingDb"));
    try {
      const rows = await loadWeaponsRows();
      renderWeaponsViewFromRows(rows);
      setStatus("");
    } catch (e) {
      clearContent();
      const msg = (e && e.message === "data_unavailable") ? ui("dataUnavailable") : e.message;
      setStatus(`${ui("error")}: ${msg}`, "error");
    }
  };
})();
