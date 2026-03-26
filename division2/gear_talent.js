/* gear-talent specific view logic */
(function () {
  let gearTalentRowsCache = null;
  const canonicalTalentKey = (k) => {
    const x = normalizeKey(k || "");
    if (x.startsWith("perfectly")) return `perfect${x.slice("perfectly".length)}`;
    return x;
  };

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
    if (!a.length || !b.length) {
      return b.map(tokenToHtml).join("");
    }

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
    return trCategoryText("gear_talent_desc", talentKey, String(rawDesc || "").replace(/\r/g, ""));
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

    const expandFrom = out.slice();
    expandFrom.forEach((k) => {
      if (typeof talentKeyVariants === "function") {
        for (const v of talentKeyVariants(k)) add(v);
      } else {
        if (k.startsWith("perfectly")) {
          const tail = k.slice("perfectly".length);
          if (tail) add(`perfect${tail}`);
        } else if (k.startsWith("perfect")) {
          const tail = k.slice("perfect".length);
          if (tail) add(`perfectly${tail}`);
        }
      }
    });
    return out;
  }

  async function loadGearTalentRows() {
    if (gearTalentRowsCache) return gearTalentRowsCache;
    const SQL = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasGearTalent = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gear_talents'").length > 0;
      if (!hasGearTalent) {
        console.warn("Gear talent table is missing in items.db", { hasGearTalent });
        throw new Error("data_unavailable");
      }
      const stmt = db.prepare(`
        SELECT
          talent_slot,
          talent,
          talent_desc,
          perfect_talent,
          perfect_talent_desc
        FROM items_gear_talents
        ORDER BY talent_slot, talent
      `);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      const existingTalentKeys = new Set();
      rows.forEach((r) => {
        const tk = canonicalTalentKey(r.talent || "");
        const pk = canonicalTalentKey(r.perfect_talent || "");
        if (tk) existingTalentKeys.add(tk);
        if (pk) existingTalentKeys.add(pk);
      });
      const isPerfectKey = (k) => k.startsWith("perfect") || k.startsWith("perfectly");
      const hasRegularCovered = (k) => {
        if (!k) return false;
        if (!isPerfectKey(k)) return false;
        const vars = (typeof talentKeyVariants === "function") ? talentKeyVariants(k) : [];
        for (const vk of vars) {
          if (!vk || isPerfectKey(vk)) continue;
          if (existingTalentKeys.has(canonicalTalentKey(vk))) return true;
        }
        return false;
      };

      const namedByTalent = new Map();
      const missingTalentRows = new Map();
      const hasGearNamed = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gear_named'").length > 0;
      if (hasGearNamed) {
        const nst = db.prepare(`
          SELECT
            item_id,
            name,
            name_key,
            item_type,
            brandset_key,
            brandset,
            talent,
            talent_key,
            talent_desc
          FROM items_gear_named
          WHERE trim(talent) <> '' OR trim(talent_key) <> ''
          ORDER BY name
        `);
        while (nst.step()) {
          const x = nst.getAsObject();
          const keys = expandTalentKeysForMatch(x.talent_key || x.talent || "");
          if (!keys.length) continue;
          const payload = {
            itemId: String(x.item_id || "").trim(),
            name: String(x.name || "").trim(),
            nameKey: String(x.name_key || "").trim(),
            itemType: String(x.item_type || "").trim(),
            brandsetKey: String(x.brandset_key || "").trim(),
            brandset: String(x.brandset || "").trim()
          };
          keys.forEach((k) => {
            if (!namedByTalent.has(k)) namedByTalent.set(k, []);
            namedByTalent.get(k).push(payload);
          });
          const rawTalent = String(x.talent || "").trim();
          const rawTalentKey = normalizeKey(String(x.talent_key || rawTalent));
          const rawTalentKeyCanon = canonicalTalentKey(rawTalentKey);
          if (rawTalentKeyCanon && !existingTalentKeys.has(rawTalentKeyCanon) && !hasRegularCovered(rawTalentKeyCanon)) {
            if (!missingTalentRows.has(rawTalentKeyCanon)) {
              missingTalentRows.set(rawTalentKeyCanon, {
                talent_slot: String(x.item_type || "").trim(),
                talent: rawTalent || String(x.talent_key || "").trim(),
                talent_desc: String(x.talent_desc || "").trim(),
                perfect_talent: "",
                perfect_talent_desc: "",
                __named_only: "1",
              });
            } else {
              const ref = missingTalentRows.get(rawTalentKeyCanon);
              if (ref && !String(ref.talent_desc || "").trim()) {
                ref.talent_desc = String(x.talent_desc || "").trim();
              }
            }
          }
        }
        nst.free();
      }
      if (missingTalentRows.size) {
        for (const row of missingTalentRows.values()) rows.push(row);
      }

      const dedupedRowsMap = new Map();
      rows.forEach((r) => {
        const t = canonicalTalentKey(r.talent || "");
        const p = canonicalTalentKey(r.perfect_talent || "");
        const s = normalizeKey(r.talent_slot || "");
        const n = String(r.__named_only || "") === "1" ? "1" : "0";
        const dedupeKey = `${s}|${t}|${p}|${n}`;
        const prev = dedupedRowsMap.get(dedupeKey);
        if (!prev) {
          dedupedRowsMap.set(dedupeKey, r);
          return;
        }
        if (!String(prev.talent_desc || "").trim() && String(r.talent_desc || "").trim()) prev.talent_desc = r.talent_desc;
        if (!String(prev.perfect_talent_desc || "").trim() && String(r.perfect_talent_desc || "").trim()) prev.perfect_talent_desc = r.perfect_talent_desc;
      });
      const rowsDeduped = Array.from(dedupedRowsMap.values());

      gearTalentRowsCache = { rows: rowsDeduped, namedByTalent };
      return gearTalentRowsCache;
    } finally {
      db.close();
    }
  }

  function renderGearTalentViewFromRows(payload) {
    const rowsRaw = (payload && payload.rows) || [];
    const namedByTalent = (payload && payload.namedByTalent) || new Map();
    const slotOrder = new Map([
      ["mask", 0],
      ["backpack", 1],
      ["chest", 2],
      ["gloves", 3],
      ["holster", 4],
      ["kneepads", 5],
    ]);
    const rows = rowsRaw.slice().sort((a, b) => {
      const ask = gearSlotKey(a.talent_slot || "");
      const bsk = gearSlotKey(b.talent_slot || "");
      const ao = slotOrder.has(ask) ? slotOrder.get(ask) : 999;
      const bo = slotOrder.has(bsk) ? slotOrder.get(bsk) : 999;
      if (ao !== bo) return ao - bo;
      const aslot = trText(a.talent_slot || "");
      const bslot = trText(b.talent_slot || "");
      const sc = String(aslot).localeCompare(String(bslot), langSelect.value === "ja" ? "ja" : "en");
      if (sc !== 0) return sc;

      const aSeed = String(a.talent || a.perfect_talent || "");
      const bSeed = String(b.talent || b.perfect_talent || "");
      const ak = normalizeKey(aSeed);
      const bk = normalizeKey(bSeed);
      const at = (langSelect.value === "ja")
        ? (i18n[ak] ?? trText(aSeed))
        : aSeed;
      const bt = (langSelect.value === "ja")
        ? (i18n[bk] ?? trText(bSeed))
        : bSeed;
      return String(at).localeCompare(String(bt), langSelect.value === "ja" ? "ja" : "en");
    });
    clearContent();
    if (!rows.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }

    const section = document.createElement("section");
    section.className = "catgroup catgroup--gear catgroup--gear-talent";
    section.innerHTML = `
      <div class="trello-group-toggle">
        <button class="btn btn--ghost talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
      </div>
      <div class="grid grid--gear"></div>
    `;
    const grid = section.querySelector(".grid");

    rows.forEach((r, idx) => {
      const namedOnly = String(r.__named_only || "") === "1";
      const talentRaw = namedOnly ? "" : String(r.talent || "").trim();
      const talentKey = normalizeKey(talentRaw);
      const talentSlotKey = gearSlotKey(r.talent_slot || "");
      const talentSlotIconSrc = talentSlotKey ? iconUrl("gear_slots", talentSlotKey, "img/gears") : "";
      const talentSlotIcon = talentSlotIconSrc ? iconImgHtml(talentSlotIconSrc, "ico ico--talent", talentSlotKey) : "";
      const talentTitle = (langSelect.value === "ja")
        ? (i18n[talentKey] ?? trText(talentRaw))
        : talentRaw;
      const talentDesc = namedOnly ? "" : String(r.talent_desc || "").trim();

      const perfectRaw = namedOnly ? String(r.talent || "").trim() : String(r.perfect_talent || "").trim();
      const perfectKey = normalizeKey(perfectRaw);
      const hasPerfectTalent = !!perfectRaw && !/^[\-–—]+$/.test(perfectRaw);
      const perfectTitle = (langSelect.value === "ja")
        ? (hasPerfectTalent ? (i18n[perfectKey] ?? trText(perfectRaw)) : "")
        : (hasPerfectTalent ? perfectRaw : "");
      const perfectDesc = namedOnly ? String(r.talent_desc || "").trim() : String(r.perfect_talent_desc || "").trim();

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

      const lines = [];
      const talentDescDisp = trTalentDescPreserveNewline(talentDesc, talentKey);
      const perfectDescDisp = trTalentDescPreserveNewline(perfectDesc, perfectKey || talentKey);
      const showDesc = !!window.talentShowDesc;
      if (namedOnly) {
        if (perfectTitle) lines.push({ cls: "line line--named line--talent", text: perfectTitle, key: perfectKey || talentKey, icon: talentSlotIcon });
        if (perfectDescDisp) {
          lines.push({
            cls: "line line--named-meta line--talent-desc",
            text: perfectDescDisp,
            html: textToHtmlPreserveNewline(perfectDescDisp),
            key: "",
            isDesc: true
          });
        }
      } else {
        if (talentTitle) lines.push({ cls: "line line--gray line--talent", text: talentTitle, key: talentKey, icon: talentSlotIcon });
        if (talentDescDisp) {
          lines.push({
            cls: "line line--named-meta line--talent-desc",
            text: talentDescDisp,
            html: textToHtmlPreserveNewline(talentDescDisp),
            key: "",
            isDesc: true
          });
        }
        if (hasPerfectTalent) {
          lines.push({ cls: "brand-named-sep", hr: true, text: "", key: "" });
        }
        if (perfectTitle) lines.push({ cls: "line line--named line--talent", text: perfectTitle, key: perfectKey });
        if (hasPerfectTalent && perfectDescDisp) {
          const html = highlightDiffHtml(talentDescDisp, perfectDescDisp);
          lines.push({ cls: "line line--named-meta line--talent-desc", text: perfectDescDisp, html, key: "", isDesc: true });
        }
      }

      const matchedItems = [];
      const seenItem = new Set();
      const candidateKeys = [];
      expandTalentKeysForMatch(talentKey).forEach((k) => candidateKeys.push(k));
      if (hasPerfectTalent) {
        expandTalentKeysForMatch(perfectKey).forEach((k) => candidateKeys.push(k));
      }
      candidateKeys.forEach((k) => {
        const arr = namedByTalent.get(k) || [];
        arr.forEach((it) => {
          const id = String(it.itemId || "").trim();
          const dedupeKey = id || `${it.nameKey}|${it.name}|${it.itemType}`;
          if (seenItem.has(dedupeKey)) return;
          seenItem.add(dedupeKey);
          matchedItems.push(it);
        });
      });
      matchedItems.forEach((it) => {
        pushSearch(it.nameKey || "");
        pushSearch(it.name || "");
        pushSearch(it.brandsetKey || "");
        pushSearch(it.brandset || "");
      });

      const card = document.createElement("div");
      card.className = "card rarity-highend";
      if (namedOnly) card.classList.add("gt-card--named-only");
      const hasDescLines = lines.some((ln) => !!ln.isDesc);
      if (hasDescLines) {
        card.setAttribute("data-desc-collapsible", "1");
        card.setAttribute("data-desc-open", showDesc ? "1" : "0");
        card.classList.toggle("is-desc-open", !!showDesc);
      }
      card.setAttribute("data-item-id", `gear-talent:${idx}:${talentKey || perfectKey || "row"}`);
      card.setAttribute("data-search", searchParts.join(" "));
      const iconPrimary = iconUrl("talents", talentKey || perfectKey, "img/talents");
      const iconAlt = iconUrl("talents", perfectKey || talentKey, "img/talents");
      const iconFallbacks = [];
      if (iconAlt && iconAlt !== iconPrimary) iconFallbacks.push(iconAlt);
      const bg = iconPrimary ? bgIconHtml(iconPrimary, "card__bg--tr", "talent", iconFallbacks) : "";
      card.innerHTML = `
        ${bg}
        <div class="lines">
          ${lines.map((ln) => ln.hr
            ? `<hr class="${ln.cls}">`
            : `<div class="${ln.cls}" ${ln.key ? `data-stat-key="${escapeHtml(ln.key)}"` : ""} ${ln.isDesc ? `data-desc-line="1"` : ""}>${ln.icon || ""}<div class="line__body"><div class="line__text">${ln.html || escapeHtml(ln.text)}</div></div></div>`
          ).join("")}
          ${matchedItems.length && !namedOnly && !hasPerfectTalent ? `<hr class="brand-named-sep">` : ""}
          ${matchedItems.length && !namedOnly && hasPerfectTalent ? `<div class="gear-talent-gap" aria-hidden="true"></div>` : ""}
          ${matchedItems.map((it) => {
            const sk = gearSlotKey(it.itemType || "");
            const slotIconSrc = iconUrl("gear_slots", sk, "img/gears");
            const slotIcon = slotIconSrc ? iconImgHtml(slotIconSrc, "ico ico--talent", "slot") : "";
            const bk = normalizeKey(it.brandsetKey || it.brandset || "");
            const brandIconSrc = iconUrl("brands", it.brandsetKey || bk, "img/brands");
            const brandIcon = brandIconSrc ? iconImgHtml(brandIconSrc, "ico ico--brand-inline", "brand") : "";
            const brandName = (langSelect.value === "ja")
              ? (i18n[it.brandsetKey] ?? i18n[bk] ?? it.brandset)
              : (it.brandset || "");
            const nk = normalizeKey(it.nameKey || it.name || "");
            const itemName = (langSelect.value === "ja") ? (i18n[it.nameKey] ?? i18n[nk] ?? it.name) : it.name;
            const brandKey = normalizeKey(it.brandsetKey || bk || brandName || "");
            const brandLabel = String(brandName || "").trim();
            const brandTextHtml = (brandKey && brandLabel)
              ? `<button type="button" class="inline-pop-trigger line__text-pop-trigger" data-pop-type="brand" data-brand-scope="brand" data-brand-key="${escapeHtml(brandKey)}" data-brand-name="${escapeHtml(brandLabel)}">${escapeHtml(brandLabel)}</button>`
              : escapeHtml(brandLabel);
            const brandLine = (brandIcon || brandName)
              ? `<div class="line line--named">${brandIcon}<div class="line__body"><div class="line__text">${brandTextHtml}</div></div></div>`
              : "";
            const itemLine = `<div class="line line--named line--named-attr">${slotIcon}<div class="line__body"><div class="line__text"><span class="gear-talent-item-name">${escapeHtml(itemName)}</span></div></div></div>`;
            return `${brandLine}${itemLine}`;
          }).join("")}
        </div>
      `;
      grid.appendChild(card);
    });

    contentEl.appendChild(section);
    applyFiltersToDom();
  }

  window.gearTalentViewRender = async function gearTalentViewRender() {
    setStatus(ui("loadingDb"));
    try {
      const rows = await loadGearTalentRows();
      renderGearTalentViewFromRows(rows);
      setStatus("");
    } catch (e) {
      clearContent();
      const msg = (e && e.message === "data_unavailable") ? ui("dataUnavailable") : e.message;
      setStatus(`${ui("error")}: ${msg}`, "error");
    }
  };
})();
