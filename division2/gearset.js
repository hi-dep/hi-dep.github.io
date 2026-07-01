/* gearset-specific view logic */
(function () {
  let gearsetRowsCache = null;
  let gearsetDescMode = String(window.gearsetDescMode || "pve").toLowerCase();
  if (!["pve", "pvp", "compare"].includes(gearsetDescMode)) gearsetDescMode = "pve";
  window.gearsetDescMode = gearsetDescMode;

  function textToHtmlPreserveNewline(text) {
    return escapeHtml(String(text || "")).replace(/\r?\n/g, "<br>");
  }
  function trGearsetTalentDesc(rawDesc, talentKey) {
    return trCategoryText("gearset_talent_desc", talentKey, String(rawDesc || "").replace(/\r/g, ""));
  }
  function trGearsetNormalizeTalentDesc(rawDesc, talentKey) {
    return trCategoryText("gearset_normalize_talent_desc", talentKey, String(rawDesc || "").replace(/\r/g, ""));
  }

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

  function highlightDiffHtml(baseText, compareText, diffClass = "gear-talent-diff") {
    const a = tokenizeForDiff(baseText);
    const b = tokenizeForDiff(compareText);
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
      chunks.push(`<span class="${diffClass}">${diffBuf.map(tokenToHtml).join("")}</span>`);
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

  function gearsetDescModeLabel(mode) {
    if (mode === "pvp") return "PvP";
    if (mode === "compare") return "Compare";
    return "PvE";
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
      const bonusCols = new Set();
      try {
        const info = db.exec("PRAGMA table_info(items_gearset_bonuses)");
        if (info && info[0] && Array.isArray(info[0].values)) {
          const nameIdx = info[0].columns.indexOf("name");
          if (nameIdx >= 0) {
            for (const row of info[0].values) {
              const name = String(row[nameIdx] || "").trim();
              if (name) bonusCols.add(name);
            }
          }
        }
      } catch (e) {
        // keep backward compatibility with older DB snapshots
      }
      const hasNormalizeDesc = bonusCols.has("talent_desc_normalize");
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
          b.talent_desc${hasNormalizeDesc ? ",\n          b.talent_desc_normalize" : ""}
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
          talentDesc: String(r.talent_desc || "").trim(),
          talentDescNormalize: String(r.talent_desc_normalize || "").trim()
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
      <div class="trello-group-toggle gearset-toolbar">
        ${typeof buildInlineConditionFilterHtml === "function" ? buildInlineConditionFilterHtml() : ""}
        <label class="gearset-desc-mode-field">
          <select class="gearset-desc-mode-select" data-gearset-desc-mode-select="1" aria-label="gearset desc mode">
            <option value="pve"${gearsetDescMode === "pve" ? " selected" : ""}>${gearsetDescModeLabel("pve")}</option>
            <option value="pvp"${gearsetDescMode === "pvp" ? " selected" : ""}>${gearsetDescModeLabel("pvp")}</option>
            <option value="compare"${gearsetDescMode === "compare" ? " selected" : ""}>${gearsetDescModeLabel("compare")}</option>
          </select>
        </label>
        <button class="btn btn--ghost talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
      </div>
      <div class="grid grid--gear"></div>
    `;
    const grid = section.querySelector(".grid");
    const modeSelect = section.querySelector("[data-gearset-desc-mode-select]");
    if (modeSelect) {
      modeSelect.addEventListener("change", () => {
        const nextMode = String(modeSelect.value || "pve").toLowerCase();
        gearsetDescMode = ["pve", "pvp", "compare"].includes(nextMode) ? nextMode : "pve";
        window.gearsetDescMode = gearsetDescMode;
        renderGearsetViewFromRows(payload);
      });
    }

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
          if (key === "randomattribute") key = "random";
          const label = (langSelect.value === "ja")
            ? trText(coreText)
            : coreText;
          if (!key) return;
          if (!grouped.has(key)) grouped.set(key, { label, slots: [] });
          grouped.get(key).slots.push(slot);
        });
      });
      if (!grouped.size) return "";
      const ordered = ["weapondamage", "armor", "skilltier", "random"];
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
        const label = (k === "random")
          ? (langSelect.value === "ja" ? "ランダム" : "Random")
          : trText(g.label || "");
        const rowCls = `core-mixed-row core-mixed-row--${escapeHtml(k)}`;
        return `<span class="${rowCls}"><span class="core-mixed-label">${escapeHtml(label)}</span><span class="core-mixed-icons">${icons}</span></span>`;
      }).filter(Boolean);
      if (!rows.length) return "";
      return `<span class="core-mixed-wrap">${rows.join("")}</span>`;
    }
    function gearsetTalentIconHtml(talentKey, pieceIcon, isFourPc, setIconPrimary, setIconFallbacks) {
      const baseKey = normalizeKey(talentKey || "");
      const cands = [];
      const add = (u) => {
        if (!u) return;
        if (!cands.includes(u)) cands.push(u);
      };
      if (pieceIcon) add(pieceIcon);
      if (setIconPrimary) add(setIconPrimary);
      if (baseKey) {
        add(iconUrl("talents", baseKey, "img/talents"));
        if (typeof talentKeyVariants === "function") {
          for (const k of talentKeyVariants(baseKey)) add(iconUrl("talents", k, "img/talents"));
        }
      }
      if (isFourPc) {
        if (cands.length) {
          const fourPcFallbacks = cands.slice(1);
          (setIconFallbacks || []).forEach((u) => {
            if (u && !fourPcFallbacks.includes(u)) fourPcFallbacks.push(u);
          });
          return iconImgHtml(cands[0], "ico ico--talent", "talent", fourPcFallbacks);
        }
        if (setIconPrimary) return iconImgHtml(setIconPrimary, "ico ico--talent", "gearset", setIconFallbacks || []);
        return "";
      }
      if (cands.length) return iconImgHtml(cands[0], "ico ico--talent", "talent", cands.slice(1));
      return "";
    }

    function gearsetTalentDescLines(talentKey, pveRaw, normalizeRaw) {
      const pveText = trGearsetTalentDesc(pveRaw, talentKey);
      const pvpText = trGearsetNormalizeTalentDesc(normalizeRaw, talentKey);
      if (gearsetDescMode === "pvp") {
        return pvpText ? [{ cls: "line line--named-meta line--talent-desc", text: pvpText, textHtml: textToHtmlPreserveNewline(pvpText), isDesc: true }] : [];
      }
      if (gearsetDescMode === "compare") {
        const lines = [];
        if (pveText) {
          lines.push({
            cls: "line line--named-meta line--talent-desc gearset-compare-line gearset-compare-line--pve",
            text: pveText,
            textHtml: `<span class="gearset-compare-label">PvE</span><span class="gearset-compare-text">${highlightDiffHtml(pvpText, pveText, "gear-talent-diff gear-talent-diff--pve")}</span>`,
            isDesc: true
          });
        }
        if (pvpText) {
          lines.push({
            cls: "line line--named-meta line--talent-desc gearset-compare-line gearset-compare-line--pvp",
            text: pvpText,
            textHtml: `<span class="gearset-compare-label">PvP</span><span class="gearset-compare-text">${highlightDiffHtml(pveText, pvpText, "gear-talent-diff gear-talent-diff--pvp")}</span>`,
            isDesc: true
          });
        }
        return lines;
      }
      return pveText ? [{ cls: "line line--named-meta line--talent-desc", text: pveText, textHtml: textToHtmlPreserveNewline(pveText), isDesc: true }] : [];
    }

    items.forEach((it) => {
      const setKeyNorm = normalizeKey(it.gearsetKey || it.gearset || "");
      const setIconPrimary = gearsetIconUrl(it.gearsetKey || setKeyNorm);
      const setIconAlt = gearsetIconUrl(setKeyNorm);
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
          const slotNorm = normalizeKey(String(b.slot || ""));
          const isBackpackTalent = slotNorm.includes("backpack") || labelNorm.includes("backpack");
          const isChestTalent = slotNorm.includes("chest") || labelNorm.includes("chest");
          // Gearset talent rows are effectively: 4pc / chest / backpack.
          // If it's not chest/backpack, treat it as 4pc for icon fallback.
          const isFourPc = !(isBackpackTalent || isChestTalent);
          const pieceSuffix = isFourPc ? "4pc" : (isBackpackTalent ? "backpack" : (isChestTalent ? "chest" : ""));
          const slotIcon = isBackpackTalent
            ? iconImgHtml(iconUrl("gear_slots", "backpack", "img/gears"), "ico ico--talent", "backpack")
            : (isChestTalent ? iconImgHtml(iconUrl("gear_slots", "chest", "img/gears"), "ico ico--talent", "chest") : "");
          const pieceIcon = gearsetIconUrl(setKeyNorm, pieceSuffix) || gearPieceIconByLabels(labelList);
          const talentKey = normalizeKey(tn || "");
          const talentIcon = gearsetTalentIconHtml(talentKey, pieceIcon, isFourPc, setIconPrimary, setIconFallbacks);
          const tnDisp = (langSelect.value === "ja")
            ? (i18n[normalizeKey(tn)] ?? trText(tn))
            : tn;
          const tdDisp = (langSelect.value === "ja")
            ? trGearsetTalentDesc(td, talentKey)
            : td;
          const tdNormalize = (langSelect.value === "ja")
            ? trGearsetNormalizeTalentDesc(String(b.talentDescNormalize || ""), talentKey)
            : String(b.talentDescNormalize || "").trim();
          if (tnDisp) lines.push({
            cls: "line line--gray line--talent",
            text: tnDisp.trim(),
            key: talentKey,
            icon: `${slotIcon || ""}${talentIcon || ""}`
          });
          gearsetTalentDescLines(talentKey, tdDisp, tdNormalize).forEach((descLine) => lines.push(descLine));
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
      for (const itb of it.bonuses || []) {
        pushSearch(itb.talentDesc || "");
        pushSearch(itb.talentDescNormalize || "");
      }
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
