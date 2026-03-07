/* weapon-talent specific view logic */
(function () {
  let weaponTalentRowsCache = null;

  function tokenizeForDiff(text) {
    const s = String(text || "");
    const re = /(\r\n|\n|[ \t]+|[A-Za-z0-9%+.\-]+|[^A-Za-z0-9\s])/g;
    const out = [];
    let m;
    while ((m = re.exec(s)) !== null) out.push(m[0]);
    return out;
  }

  function tokenToHtml(tok) {
    if (tok === "\r\n" || tok === "\n") return "<br>";
    return escapeHtml(tok);
  }

  function highlightDiffHtml(baseText, perfectText) {
    const a = tokenizeForDiff(baseText);
    const b = tokenizeForDiff(perfectText);
    if (!a.length || !b.length) return b.map(tokenToHtml).join("");

    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    let i = 0;
    let j = 0;
    const chunks = [];
    let diffBuf = [];
    const flushDiff = () => {
      if (!diffBuf.length) return;
      chunks.push(`<span class="gear-talent-diff">${diffBuf.map(tokenToHtml).join("")}</span>`);
      diffBuf = [];
    };
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        flushDiff();
        chunks.push(tokenToHtml(b[j]));
        i++;
        j++;
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        i++;
      } else {
        diffBuf.push(b[j]);
        j++;
      }
    }
    while (j < m) {
      diffBuf.push(b[j]);
      j++;
    }
    flushDiff();
    return chunks.join("");
  }

  function trTextPreserveNewline(raw) {
    const src = String(raw || "").replace(/\r/g, "");
    if (langSelect.value !== "ja") return src;
    const key = normalizeKey(src);
    const mapped = i18n[key];
    return mapped ? String(mapped).replace(/\r/g, "") : src;
  }

  function trTalentDescPreserveNewline(rawDesc, talentKey) {
    return trCategoryText("weapon_talent_desc", talentKey, String(rawDesc || "").replace(/\r/g, ""));
  }

  function textToHtmlPreserveNewline(text) {
    return escapeHtml(String(text || "")).replace(/\r?\n/g, "<br>");
  }

  function expandTalentKeysForMatch(raw) {
    const seed = normalizeKey(raw || "");
    if (!seed) return [];
    const out = [];
    const seen = new Set();
    const add = (k) => {
      const kk = normalizeKey(k || "");
      if (!kk || seen.has(kk)) return;
      seen.add(kk);
      out.push(kk);
    };
    add(seed);
    const alias = (i18nAliases && i18nAliases[seed]) ? i18nAliases[seed] : "";
    if (alias) add(alias);
    if (typeof talentKeyVariants === "function") {
      for (const v of talentKeyVariants(seed)) add(v);
    }
    return out;
  }

  function resolveTalentTitle(rawText, key) {
    const k = normalizeKey(key || rawText || "");
    const raw = String(rawText || "").trim();
    if (langSelect.value !== "ja") return raw;
    if (!k) return trText(raw);
    const direct = i18n[k];
    if (direct) return direct;
    if (typeof talentKeyVariants === "function") {
      for (const vk of talentKeyVariants(k)) {
        const mapped = i18n[vk];
        if (mapped) return mapped;
      }
    }
    return trText(raw);
  }

  function weaponGroupKey(v) {
    const k = normalizeKey(v || "");
    if (k === "assaultrifle" || k === "assaultrifles") return "ar";
    if (k === "submachinegun" || k === "submachineguns") return "smg";
    if (k === "lightmachinegun" || k === "lightmachineguns") return "lmg";
    if (k === "shotgun" || k === "shotguns") return "shotgun";
    if (k === "rifle" || k === "rifles") return "rifle";
    if (k === "marksmanrifle" || k === "marksmanrifles") return "mmr";
    if (k === "pistol" || k === "pistols") return "pistol";
    return k;
  }

  function parseTruthy(v) {
    const s = String(v || "").trim().toLowerCase();
    if (!s) return false;
    if (["0", "-", "false", "off", "no", "n"].includes(s)) return false;
    return true;
  }

  function collectAllowedWeaponTypes(row) {
    const keys = ["ar", "lmg", "mmr", "pistol", "rifle", "shotgun", "smg"];
    return keys.filter((k) => parseTruthy(row[k]));
  }

  function weaponTypeBadgesHtml(enabledTypes) {
    const on = new Set(enabledTypes || []);
    const defs = [
      { key: "ar", label: "AR" },
      { key: "smg", label: "SMG" },
      { key: "lmg", label: "LMG" },
      { key: "shotgun", label: "SG" },
      { key: "rifle", label: "RF" },
      { key: "mmr", label: "MMR" },
      { key: "pistol", label: "HG" },
    ];
    return defs.map((d) => (
      `<span class="wt-badge ${on.has(d.key) ? "is-on" : "is-off"}">${escapeHtml(d.label)}</span>`
    )).join("");
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

  function buildWeaponTypeFilterButtonsHtml() {
    const active = new Set(Array.isArray(window.weaponTalentTypeFilter) ? window.weaponTalentTypeFilter : []);
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
      `<button class="btn btn--ghost weapon-type-filter-btn ${active.has(d.key) ? "is-on" : ""}" type="button" data-wt-type="${escapeHtml(d.key)}">${escapeHtml(d.label)}</button>`
    ).join("");
    return typeBtns;
  }

  function matchesWeaponTypeFilter(allowTypes, matchedItems) {
    const active = new Set(Array.isArray(window.weaponTalentTypeFilter) ? window.weaponTalentTypeFilter : []);
    if (!active.size) return true;
    for (const t of (allowTypes || [])) {
      if (active.has(t)) return true;
    }
    for (const it of (matchedItems || [])) {
      const wg = weaponGroupKey(it.weaponGroup || "");
      if (wg && active.has(wg)) return true;
    }
    return false;
  }

  async function loadWeaponTalentRows() {
    if (weaponTalentRowsCache) return weaponTalentRowsCache;
    const SQL = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasWeaponTalent = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_weapon_talents'").length > 0;
      if (!hasWeaponTalent) {
        console.warn("Weapon talent table is missing in items.db", { hasWeaponTalent });
        throw new Error("data_unavailable");
      }
      const stmt = db.prepare(`
        SELECT
          talent,
          talent_desc,
          perfect_talent,
          perfect_talent_desc,
          ar, lmg, mmr, pistol, rifle, shotgun, smg
        FROM items_weapon_talents
        ORDER BY talent
      `);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      const existingTalentKeys = new Set();
      rows.forEach((r) => {
        const tk = normalizeKey(r.talent || "");
        const pk = normalizeKey(r.perfect_talent || "");
        if (tk) existingTalentKeys.add(tk);
        if (pk) existingTalentKeys.add(pk);
      });
      const isPerfectKey = (k) => k.startsWith("perfect") || k.startsWith("perfectly");
      const hasRegularCovered = (k) => {
        if (!k) return false;
        if (!isPerfectKey(k)) return false;
        if (typeof talentKeyVariants !== "function") return false;
        for (const vk of talentKeyVariants(k)) {
          if (!vk || isPerfectKey(vk)) continue;
          if (existingTalentKeys.has(vk)) return true;
        }
        return false;
      };

      const weaponByTalent = new Map();
      const missingTalentRows = new Map();
      const markType = (rowObj, wg) => {
        const g = weaponGroupKey(wg || "");
        if (["ar", "lmg", "mmr", "pistol", "rifle", "shotgun", "smg"].includes(g)) rowObj[g] = "1";
      };
      const collectToMap = (query, kind) => {
        const st = db.prepare(query);
        while (st.step()) {
          const x = st.getAsObject();
          const keys = expandTalentKeysForMatch(x.talent_key || x.talent || "");
          if (!keys.length) continue;
          const payload = {
            itemId: String(x.item_id || "").trim(),
            name: String(x.name || "").trim(),
            nameKey: String(x.name_key || "").trim(),
            weaponGroup: String(x.weapon_group || "").trim(),
            variant: String(x.variant || "").trim(),
            talentDesc: String(x.talent_desc || "").trim(),
            kind: kind
          };
          keys.forEach((k) => {
            if (!weaponByTalent.has(k)) weaponByTalent.set(k, []);
            weaponByTalent.get(k).push(payload);
          });

          const rawTalent = String(x.talent || "").trim();
          const rawTalentKey = normalizeKey(String(x.talent_key || rawTalent));
          if (kind === "named" && rawTalentKey && !existingTalentKeys.has(rawTalentKey) && !hasRegularCovered(rawTalentKey)) {
            if (!missingTalentRows.has(rawTalentKey)) {
              missingTalentRows.set(rawTalentKey, {
                talent: rawTalent || String(x.talent_key || "").trim(),
                talent_desc: String(x.talent_desc || "").trim(),
                perfect_talent: "",
                perfect_talent_desc: "",
                ar: "", lmg: "", mmr: "", pistol: "", rifle: "", shotgun: "", smg: "",
                __named_only: "1",
              });
            }
            const rowRef = missingTalentRows.get(rawTalentKey);
            if (rowRef && !String(rowRef.talent_desc || "").trim()) {
              rowRef.talent_desc = String(x.talent_desc || "").trim();
            }
            markType(missingTalentRows.get(rawTalentKey), x.weapon_group);
          }
        }
        st.free();
      };

      const hasWeaponNamed = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_weapon_named'").length > 0;
      if (hasWeaponNamed) {
        collectToMap(`
          SELECT item_id, name, name_key, weapon_group, variant, talent, talent_key, talent_desc
          FROM items_weapon_named
          WHERE trim(talent) <> '' OR trim(talent_key) <> ''
          ORDER BY weapon_group, name
        `, "named");
      }
      const hasWeaponExotic = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_weapon_exotic'").length > 0;
      if (hasWeaponExotic) {
        collectToMap(`
          SELECT item_id, name, name_key, weapon_group, variant, talent, talent_key, talent_desc
          FROM items_weapon_exotic
          WHERE trim(talent) <> '' OR trim(talent_key) <> ''
          ORDER BY weapon_group, name
        `, "exotic");
      }

      if (missingTalentRows.size) {
        for (const row of missingTalentRows.values()) rows.push(row);
      }

      weaponTalentRowsCache = { rows, weaponByTalent };
      return weaponTalentRowsCache;
    } finally {
      db.close();
    }
  }

  function renderWeaponTalentViewFromRows(payload) {
    const rowsRaw = (payload && payload.rows) || [];
    const weaponByTalent = (payload && payload.weaponByTalent) || new Map();
    clearContent();
    if (!rowsRaw.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }

    const rows = rowsRaw.slice().sort((a, b) => {
      const ak = normalizeKey(String(a.talent || ""));
      const bk = normalizeKey(String(b.talent || ""));
      const at = resolveTalentTitle(String(a.talent || ""), ak) || String(a.talent || "");
      const bt = resolveTalentTitle(String(b.talent || ""), bk) || String(b.talent || "");
      return String(at).localeCompare(String(bt), langSelect.value === "ja" ? "ja" : "en");
    });

    const section = document.createElement("section");
    section.className = "catgroup catgroup--gear catgroup--gear-talent catgroup--weapon-talent";
    section.innerHTML = `
      <div class="trello-group-toggle weapon-type-filter-row">
        <button class="btn btn--ghost talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
        ${buildWeaponTypeFilterButtonsHtml()}
      </div>
      <div class="grid grid--gear"></div>
    `;
    const grid = section.querySelector(".grid");
    let renderedCount = 0;

    rows.forEach((r, idx) => {
      const namedOnly = String(r.__named_only || "") === "1";
      const talentRaw = namedOnly ? "" : String(r.talent || "").trim();
      const talentKey = normalizeKey(talentRaw);
      const talentTitle = resolveTalentTitle(talentRaw, talentKey);
      const talentDesc = namedOnly ? "" : String(r.talent_desc || "").trim();

      const perfectRaw = namedOnly ? String(r.talent || "").trim() : String(r.perfect_talent || "").trim();
      const perfectKey = normalizeKey(perfectRaw);
      const hasPerfectTalent = !!perfectRaw && !/^[\-–—]+$/.test(perfectRaw);
      const perfectTitle = hasPerfectTalent ? resolveTalentTitle(perfectRaw, perfectKey) : "";
      const perfectDesc = namedOnly ? String(r.talent_desc || "").trim() : String(r.perfect_talent_desc || "").trim();

      const allowTypes = collectAllowedWeaponTypes(r);

      const lines = [];
      const namedOnlyCardClass = namedOnly ? " wt-card--named-only" : "";
      const showDesc = !!window.talentShowDesc;
      if (allowTypes.length || String(r.__named_only || "") === "1") {
        const enabled = String(r.__named_only || "") === "1" ? [] : allowTypes;
        lines.push({
          cls: "line line--weapon-types",
          text: "",
          key: "",
          html: `<div class="wt-badges">${weaponTypeBadgesHtml(enabled)}</div>`
        });
      }
      if (talentTitle) lines.push({ cls: "line line--gray line--talent", text: talentTitle, key: talentKey });
      const talentDescDisp = trTalentDescPreserveNewline(talentDesc, talentKey);
      const perfectDescDisp = trTalentDescPreserveNewline(perfectDesc, perfectKey || talentKey);
      if (talentDescDisp) {
        lines.push({ cls: "line line--named-meta line--talent-desc", text: talentDescDisp, html: textToHtmlPreserveNewline(talentDescDisp), key: "", isDesc: true });
      }
      if (hasPerfectTalent && talentTitle) lines.push({ cls: "brand-named-sep", hr: true, text: "", key: "" });
      if (perfectTitle) lines.push({ cls: "line line--perfect line--talent", text: perfectTitle, key: perfectKey });
      if (hasPerfectTalent && perfectDescDisp) {
        lines.push({ cls: "line line--named-meta line--talent-desc", text: perfectDescDisp, html: highlightDiffHtml(talentDescDisp, perfectDescDisp), key: "", isDesc: true });
      }

      const matchedItems = [];
      const seen = new Set();
      const candKeys = [];
      expandTalentKeysForMatch(talentKey).forEach((k) => candKeys.push(k));
      if (hasPerfectTalent) expandTalentKeysForMatch(perfectKey).forEach((k) => candKeys.push(k));
      candKeys.forEach((k) => {
        const arr = weaponByTalent.get(k) || [];
        arr.forEach((it) => {
          const id = String(it.itemId || "").trim();
          const dedupe = id || `${it.nameKey}|${it.name}|${it.weaponGroup}|${it.variant}|${it.kind}`;
          if (seen.has(dedupe)) return;
          seen.add(dedupe);
          matchedItems.push(it);
        });
      });
      matchedItems.sort((a, b) => {
        const ak = weaponGroupKey(a.weaponGroup || "");
        const bk = weaponGroupKey(b.weaponGroup || "");
        if (ak !== bk) return ak.localeCompare(bk);
        const an = (langSelect.value === "ja") ? (i18n[a.nameKey] ?? a.name) : a.name;
        const bn = (langSelect.value === "ja") ? (i18n[b.nameKey] ?? b.name) : b.name;
        return String(an || "").localeCompare(String(bn || ""), langSelect.value === "ja" ? "ja" : "en");
      });
      if (!matchesWeaponTypeFilter(allowTypes, matchedItems)) return;

      const searchParts = [];
      const pushSearch = (s) => {
        const n = normalizeKey(stripHtml(s || ""));
        if (n) searchParts.push(n);
      };
      pushSearch(talentRaw);
      pushSearch(talentTitle);
      pushSearch(talentDesc);
      pushSearch(perfectRaw);
      pushSearch(perfectTitle);
      pushSearch(perfectDesc);
      matchedItems.forEach((it) => {
        pushSearch(it.nameKey || "");
        pushSearch(it.name || "");
        pushSearch(it.weaponGroup || "");
      });

      const card = document.createElement("div");
      card.className = `card rarity-highend${namedOnlyCardClass}`;
      const hasDescLines = lines.some((ln) => !!ln.isDesc);
      if (hasDescLines) {
        card.setAttribute("data-desc-collapsible", "1");
        card.setAttribute("data-desc-open", showDesc ? "1" : "0");
        card.classList.toggle("is-desc-open", !!showDesc);
      }
      card.setAttribute("data-item-id", `weapon-talent:${idx}:${talentKey || perfectKey || "row"}`);
      card.setAttribute("data-search", searchParts.join(" "));
      const iconPrimary =
        iconUrl("weapon_talents", talentKey || perfectKey, "img/weapon_talents")
        || iconUrl("talents", talentKey || perfectKey, "img/talents");
      const iconAlt =
        iconUrl("weapon_talents", perfectKey || talentKey, "img/weapon_talents")
        || iconUrl("talents", perfectKey || talentKey, "img/talents");
      const iconFallbacks = [];
      if (iconAlt && iconAlt !== iconPrimary) iconFallbacks.push(iconAlt);
      const bg = iconPrimary ? bgIconHtml(iconPrimary, "card__bg--tr", "talent", iconFallbacks) : "";
      card.innerHTML = `
        ${bg}
        <div class="lines">
          ${lines.map((ln) => ln.hr
            ? `<hr class="${ln.cls}">`
            : `<div class="${ln.cls}" ${ln.key ? `data-stat-key="${escapeHtml(ln.key)}"` : ""} ${ln.isDesc ? `data-desc-line="1"` : ""}><div class="line__body"><div class="line__text">${ln.html || escapeHtml(ln.text)}</div></div></div>`
          ).join("")}
          ${matchedItems.length && !hasPerfectTalent ? `<hr class="brand-named-sep">` : ""}
          ${matchedItems.length && hasPerfectTalent && !!talentTitle ? `<div class="gear-talent-gap" aria-hidden="true"></div>` : ""}
          ${matchedItems.map((it) => {
            const wg = weaponGroupKey(it.weaponGroup || "");
            const wIconSrc = iconUrl("weapon_types", wg, "img/weapons");
            const wIcon = wIconSrc ? iconImgHtml(wIconSrc, "ico ico--talent", "weapon") : "";
            const nk = normalizeKey(it.nameKey || it.name || "");
            const itemName = (langSelect.value === "ja") ? (i18n[it.nameKey] ?? i18n[nk] ?? it.name) : it.name;
            const nameLine = itemName;
            const cls = it.kind === "named" ? "line line--named" : "line line--gray";
            const typeLabel = weaponTypeShortLabel(wg);
            const metaBadges = `<span class="wt-inline-badges"><span class="wt-badge is-on">${escapeHtml(typeLabel)}</span></span>`;
            return `<div class="${cls}">${wIcon}${metaBadges}<div class="line__body"><div class="line__text">${escapeHtml(nameLine)}</div></div></div>`;
          }).join("")}
        </div>
      `;
      grid.appendChild(card);
      renderedCount += 1;
    });
    if (!renderedCount) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }
    contentEl.appendChild(section);
    applyFiltersToDom();
  }

  window.weaponTalentViewRender = async function weaponTalentViewRender() {
    setStatus(ui("loadingDb"));
    try {
      const rows = await loadWeaponTalentRows();
      renderWeaponTalentViewFromRows(rows);
      setStatus("");
    } catch (e) {
      clearContent();
      const msg = (e && e.message === "data_unavailable") ? ui("dataUnavailable") : e.message;
      setStatus(`${ui("error")}: ${msg}`, "error");
    }
  };
})();
