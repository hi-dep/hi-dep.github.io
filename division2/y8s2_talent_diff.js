/* y8s2-talent-diff specific view logic */
(function () {
  let entriesCache = null;

  function removeNonDecimalPeriods(text) {
    // Keep decimal points only when dot is between digits (e.g. 1.5).
    // Remove punctuation periods including trailing "100.".
    return String(text || "").replace(/(?<!\d)\.|\.(?!\d)/g, "");
  }

  function normalizeCompareText(s) {
    return removeNonDecimalPeriods(String(s || ""))
      .replace(/\r/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function normalizeKeyLite(s) {
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function tokenizeForDiff(text) {
    const s = String(text || "");
    const re = /(\r\n|\n|[ \t]+|[A-Za-z0-9%+.\-]+|[^A-Za-z0-9\s])/g;
    const out = [];
    let m;
    while ((m = re.exec(s)) !== null) out.push(m[0]);
    return out;
  }

  function eqTok(a, b) {
    return String(a || "").toLowerCase() === String(b || "").toLowerCase();
  }

  function tokenToHtml(tok) {
    if (tok === "\r\n" || tok === "\n") return "<br>";
    return escapeHtml(tok);
  }

  function highlightDiffHtml(baseText, nextText) {
    const a = tokenizeForDiff(removeNonDecimalPeriods(baseText));
    const b = tokenizeForDiff(removeNonDecimalPeriods(nextText));
    if (!a.length || !b.length) return b.map(tokenToHtml).join("");
    const n = a.length;
    const m = b.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (eqTok(a[i], b[j])) dp[i][j] = dp[i + 1][j + 1] + 1;
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
      if (eqTok(a[i], b[j])) {
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
    while (j < m) diffBuf.push(b[j++]);
    flushDiff();
    return chunks.join("");
  }

  function resolveCurrentCategory(kind) {
    if (kind === "weapon_talent") return "weapon_talent_desc";
    if (kind === "gear_talent") return "gear_talent_desc";
    if (kind === "gearset_talents") return "gearset_talent_desc";
    if (kind === "exotic_weapon_talents") return "exotic_weapon_talent_desc";
    if (kind === "exotic_gear_talents") return "exotic_gear_talent_desc";
    return "";
  }

  function statusFrom(base, pve, pvp) {
    const b = normalizeCompareText(base);
    const e = normalizeCompareText(pve);
    const p = normalizeCompareText(pvp);
    if (!b && (e || p)) return "NEW_IN_Y8S2";
    if (!e && !p) return "MISSING_IN_Y8S2";
    const eqE = b && b === e;
    const eqP = b && b === p;
    if (eqE && eqP) return "UNCHANGED";
    if (!eqE && !eqP) return "BOTH_CHANGED";
    if (!eqE && eqP) return "PVE_CHANGED";
    if (eqE && !eqP) return "PVP_CHANGED";
    return "CHANGED";
  }

  function pickCurrentText(i18nTalents, kind, name, lookup) {
    const itemCategory = (kind === "weapon_talent" || kind === "exotic_weapon_talents") ? "weapon" : "gear";
    const talentKey = normalizeKeyLite(name);
    if (typeof resolveTalentDescription === "function") {
      const resolved = resolveTalentDescription(itemCategory, talentKey, "", lookup, name);
      if (resolved) return String(resolved);
    }
    const catName = resolveCurrentCategory(kind);
    const cat = i18nTalents?.categories?.[catName] || {};
    return String(cat[talentKey] || "");
  }

  function toSubRows(e) {
    const out = [];
    const kind = String(e?.kind || "");
    if (kind === "weapon_talent" || kind === "gear_talent") {
      for (const role of ["normal", "perfect"]) {
        const t = e?.[role];
        if (!t) continue;
        out.push({
          role,
          label: role,
          item: "",
          slot: "",
          name: String(t.name || e.name || "").trim(),
          pve: String(t.pve || "").trim(),
          pvp: String(t.pvp || "").trim()
        });
      }
    } else if (kind === "gearset_talents") {
      const tal = e?.talents || {};
      for (const slot of ["bonus_set_4", "chest", "backpack"]) {
        const t = tal[slot];
        if (!t) continue;
        out.push({
          role: slot,
          label: slot,
          item: String(e.item || "").trim(),
          slot,
          name: String(t.name || "").trim(),
          pve: String(t.pve || "").trim(),
          pvp: String(t.pvp || "").trim()
        });
      }
    } else if (kind === "exotic_weapon_talents" || kind === "exotic_gear_talents") {
      for (const t of (e?.talents || [])) {
        out.push({
          role: "talent",
          label: "talent",
          item: String(e.item || "").trim(),
          slot: "",
          name: String(t.name || "").trim(),
          pve: String(t.pve || "").trim(),
          pvp: String(t.pvp || "").trim()
        });
      }
    }
    return out;
  }

  function flattenY8s2Entries(spec) {
    const out = [];
    (spec?.entries || []).forEach((e, idx) => {
      const kind = String(e?.kind || "");
      if (!kind) return;
      out.push({
        entryIndex: idx,
        kind,
        name: String(e?.name || "").trim(),
        item: String(e?.item || "").trim(),
        subRows: toSubRows(e)
      });
    });
    return out;
  }

  async function loadEntries() {
    if (entriesCache) return entriesCache;
    const ts = Date.now();
    const [i18nTalents, y8s2] = await Promise.all([
      fetchJson(`${DATA_BASE}/i18n_talents.json?ts=${ts}`),
      fetchJson(`${DATA_BASE}/y8s2_spec.json?ts=${ts}`)
    ]);
    const lookup = (typeof ensureTalentDescLookupCache === "function")
      ? await ensureTalentDescLookupCache()
      : null;
    const entries = flattenY8s2Entries(y8s2).map((ent) => {
      const subRows = ent.subRows.map((r) => {
        const base = pickCurrentText(i18nTalents, ent.kind, r.name, lookup);
        const status = statusFrom(base, r.pve, r.pvp);
        return { ...r, base, status };
      });
      const status = subRows.some((x) => x.status !== "UNCHANGED") ? "CHANGED" : "UNCHANGED";
      return { ...ent, subRows, status };
    });
    entriesCache = entries;
    return entries;
  }

  function rowStatusForMode(r, useY8s1) {
    if (useY8s1) return statusFrom(r.base, r.pve, r.pvp);
    return statusFrom(r.pve, r.pve, r.pvp);
  }

  function withViewStatus(entries, useY8s1) {
    return entries.map((ent) => {
      const subRows = ent.subRows.map((r) => ({ ...r, viewStatus: rowStatusForMode(r, useY8s1) }));
      const viewStatus = subRows.some((x) => x.viewStatus !== "UNCHANGED") ? "CHANGED" : "UNCHANGED";
      return { ...ent, subRows, viewStatus };
    });
  }

  function kindDisplay(kind) {
    return String(kind || "")
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  function rarityClassForKind(kind) {
    if (kind === "weapon_talent" || kind === "gear_talent") return "rarity-highend";
    if (kind === "gearset_talents") return "rarity-gearset";
    if (kind === "exotic_weapon_talents" || kind === "exotic_gear_talents") return "rarity-exotic";
    return "rarity-highend";
  }

  function renderEntries(entries, useY8s1) {
    const cards = entries.map((ent) => {
      const kindText = kindDisplay(ent.kind);
      const rarityClass = rarityClassForKind(ent.kind);
      const rowsHtml = ent.subRows.map((r) => {
        const sub = [r.label, r.name].filter(Boolean).join(" : ");
        if (useY8s1) {
          const baseHtml = textToHtmlPreserveNewline(r.base);
          const pveHtml = highlightDiffHtml(r.base, r.pve);
          const pvpHtml = highlightDiffHtml(r.base, r.pvp);
          return `
        <div class="line line--named-meta"><div class="line__body"><div class="line__text"><strong>${escapeHtml(sub)}</strong></div></div></div>
        <div class="line line--named-meta line--talent-desc"><div class="line__body"><div class="line__text"><strong>Y8S1 (Base)</strong><br>${baseHtml}</div></div></div>
        <div class="line line--named-meta line--talent-desc" style="margin-top:10px;"><div class="line__body"><div class="line__text"><strong>Y8S2 PvE</strong><br>${pveHtml}</div></div></div>
        <div class="line line--named-meta line--talent-desc" style="margin-top:10px;"><div class="line__body"><div class="line__text"><strong>Y8S2 PvP</strong><br>${pvpHtml}</div></div></div>
        <div class="brand-named-sep"></div>`;
        }
        const pveHtml = textToHtmlPreserveNewline(r.pve);
        const pvpHtml = highlightDiffHtml(r.pve, r.pvp);
        return `
        <div class="line line--named-meta"><div class="line__body"><div class="line__text"><strong>${escapeHtml(sub)}</strong></div></div></div>
        <div class="line line--named-meta line--talent-desc"><div class="line__body"><div class="line__text"><strong>Y8S2 PvE</strong><br>${pveHtml}</div></div></div>
        <div class="line line--named-meta line--talent-desc" style="margin-top:10px;"><div class="line__body"><div class="line__text"><strong>Y8S2 PvP</strong><br>${pvpHtml}</div></div></div>
        <div class="brand-named-sep"></div>`;
      }).join("");
      return `
      <article class="card card--item is-desc-open ${escapeHtml(rarityClass)}">
        <div class="line line--named line--talent"><div class="line__body"><div class="line__text">${escapeHtml(ent.name)} <span class="line--named-meta" style="color: var(--muted); opacity: .8;">${escapeHtml(kindText)}</span></div></div></div>
        ${rowsHtml}
      </article>`;
    }).join("");
    return cards || `<div class="status">No entries</div>`;
  }

  function textToHtmlPreserveNewline(text) {
    return escapeHtml(String(text || "")).replace(/\r?\n/g, "<br>");
  }

  function applyFilters(allEntries) {
    const qEl = document.getElementById("y8s2DiffSearch");
    const kindEl = document.getElementById("y8s2DiffKind");
    const changedOnlyEl = document.getElementById("y8s2DiffChangedOnly");
    const y8s1El = document.getElementById("y8s2DiffUseY8s1");
    const useY8s1 = !!y8s1El?.checked;
    const q = normalizeCompareText(qEl?.value || "").toLowerCase();
    const kind = String(kindEl?.value || "all");
    const changedOnly = !!changedOnlyEl?.checked;
    const viewEntries = withViewStatus(allEntries, useY8s1);
    return viewEntries.filter((ent) => {
      if (kind !== "all" && ent.kind !== kind) return false;
      if (changedOnly && ent.viewStatus === "UNCHANGED") return false;
      if (!q) return true;
      const hay = `${ent.kind} ${ent.item} ${ent.name} ${ent.subRows.map((r) => `${r.name} ${r.base} ${r.pve} ${r.pvp}`).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
  }

  async function renderY8s2TalentDiffView() {
    setStatus("Loading Y8S2 diff...");
    try {
      const allEntries = await loadEntries();
      contentEl.innerHTML = `
      <section class="catgroup catgroup--gear catgroup--gear-talent">
        <div class="trello-group-head">
          <div class="trello-group-toggle">
            <label class="field" style="display:inline-flex;align-items:center;gap:6px;">
              <span>Kind</span>
              <select id="y8s2DiffKind">
                <option value="all">all</option>
                <option value="weapon_talent">weapon_talent</option>
                <option value="gear_talent">gear_talent</option>
                <option value="gearset_talents">gearset_talents</option>
                <option value="exotic_weapon_talents">exotic_weapon_talents</option>
                <option value="exotic_gear_talents">exotic_gear_talents</option>
              </select>
            </label>
            <label class="field" style="display:inline-flex;align-items:center;gap:6px;">
              <span>Search</span>
              <input id="y8s2DiffSearch" type="text" placeholder="talent / item / text" />
            </label>
            <label class="field" style="display:inline-flex;align-items:center;gap:6px;">
              <input id="y8s2DiffChangedOnly" type="checkbox" checked />
              <span>Changed only</span>
            </label>
            <label class="field" style="display:inline-flex;align-items:center;gap:6px;">
              <input id="y8s2DiffUseY8s1" type="checkbox" />
              <span>Y8S1</span>
            </label>
          </div>
        </div>
        <div id="y8s2DiffList" class="cards"></div>
      </section>`;

      const listEl = document.getElementById("y8s2DiffList");
      const refresh = () => {
        const entries = applyFilters(allEntries);
        const useY8s1 = !!document.getElementById("y8s2DiffUseY8s1")?.checked;
        listEl.innerHTML = renderEntries(entries, useY8s1);
        setStatus(`Y8S2 diff entries: ${entries.length}/${allEntries.length}`);
      };

      ["y8s2DiffKind", "y8s2DiffSearch", "y8s2DiffChangedOnly", "y8s2DiffUseY8s1"].forEach((id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener("input", refresh);
        el.addEventListener("change", refresh);
      });
      refresh();
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err.message || err}`);
      contentEl.innerHTML = "";
    }
  }

  window.renderY8s2TalentDiffView = renderY8s2TalentDiffView;
})();
