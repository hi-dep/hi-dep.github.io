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
    return window.loadItemsView("gear_talent", indexJson?.built_at);
  }

  function renderGearTalentViewFromRows(payload) {
    const rowsRaw = (payload && payload.rows) || [];
    const namedByTalent = (payload && payload.namedByTalent) || new Map();
    const normalizeAvailable = rowsRaw.some((r) => String(r.talent_normalize || r.perfect_talent_normalize || "").trim());
    if (typeof window.configureNormalizeToggle === "function") {
      window.configureNormalizeToggle(normalizeAvailable, (enabled) => renderGearTalentViewFromRows(payload));
    }
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
        <button class="btn btn--ghost ui-control talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
      </div>
      <div class="grid grid--gear"></div>
    `;
    const grid = section.querySelector(".grid");

    rows.forEach((r, idx) => {
      const namedOnly = String(r.__named_only || "") === "1";
      const talentRaw = namedOnly ? "" : String(r.talent || "").trim();
      const talentKey = normalizeKey(talentRaw);
      const talentSlotKey = gearSlotKey(r.talent_slot || "");
      const talentSlotIconSrc = talentSlotKey ? iconUrl("gear_slots", talentSlotKey, "img/icon/slot") : "";
      const talentSlotIcon = talentSlotIconSrc ? iconImgHtml(talentSlotIconSrc, "ico ico--talent", talentSlotKey) : "";
      const talentTitle = (langSelect.value === "ja")
        ? (i18n[talentKey] ?? trText(talentRaw))
        : talentRaw;
      const normalizeMode = typeof window.getNormalizeDisplayMode === "function" ? window.getNormalizeDisplayMode() : 0;
      const useNormalize = normalizeMode === 1;
      const compareNormalize = normalizeMode === 2;
      const talentDesc = namedOnly ? "" : String((useNormalize
        ? (langSelect.value === "ja" ? (r.talent_normalize_jp || r.talent_normalize) : r.talent_normalize)
        : r.talent_desc) || "").trim();

      const perfectRaw = namedOnly ? String(r.talent || "").trim() : String(r.perfect_talent || "").trim();
      const perfectKey = normalizeKey(perfectRaw);
      const hasPerfectTalent = !!perfectRaw && !/^[\-–—]+$/.test(perfectRaw);
      const perfectTitle = (langSelect.value === "ja")
        ? (hasPerfectTalent ? (i18n[perfectKey] ?? trText(perfectRaw)) : "")
        : (hasPerfectTalent ? perfectRaw : "");
      const pvpTalentDesc = namedOnly ? "" : String((langSelect.value === "ja" ? (r.talent_normalize_jp || r.talent_normalize) : r.talent_normalize) || "").trim();
      const pvpPerfectDesc = namedOnly
        ? String((langSelect.value === "ja" ? (r.talent_normalize_jp || r.talent_normalize) : r.talent_normalize) || "").trim()
        : String((langSelect.value === "ja" ? (r.perfect_talent_normalize_jp || r.perfect_talent_normalize) : r.perfect_talent_normalize) || "").trim();
      const perfectDesc = namedOnly
        ? String((useNormalize
          ? (langSelect.value === "ja" ? (r.talent_normalize_jp || r.talent_normalize) : r.talent_normalize)
          : r.talent_desc) || "").trim()
        : String((useNormalize
          ? (langSelect.value === "ja" ? (r.perfect_talent_normalize_jp || r.perfect_talent_normalize) : r.perfect_talent_normalize)
          : r.perfect_talent_desc) || "").trim();

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
      const talentDescDisp = useNormalize ? talentDesc : trTalentDescPreserveNewline(talentDesc, talentKey);
      const perfectDescDisp = useNormalize ? perfectDesc : trTalentDescPreserveNewline(perfectDesc, perfectKey || talentKey);
      const pveTalentDescDisp = trTalentDescPreserveNewline(String(r.talent_desc || "").trim(), talentKey);
      const pvePerfectDescDisp = trTalentDescPreserveNewline(String(r.perfect_talent_desc || "").trim(), perfectKey || talentKey);
      // normalize_jp is already the translated PvP text. Do not resolve it by
      // talent key here, because that lookup contains the PvE description.
      const pvpTalentDescDisp = pvpTalentDesc;
      const pvpPerfectDescDisp = pvpPerfectDesc;
      const talentDescHtml = useNormalize && pveTalentDescDisp && talentDescDisp
        ? (typeof window.highlightTalentDiffHtml === "function"
          ? window.highlightTalentDiffHtml(pveTalentDescDisp, talentDescDisp)
          : highlightDiffHtml(pveTalentDescDisp, talentDescDisp))
        : textToHtmlPreserveNewline(talentDescDisp);
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
        if (compareNormalize && pvpPerfectDescDisp) {
          lines.push({ cls: "line line--named-meta line--talent-desc normalize-compare-pvp", text: pvpPerfectDescDisp, html: window.normalizePvpCompareHtml(pvpTalentDescDisp, pvpPerfectDescDisp, "gear-talent-diff"), key: "", isDesc: true });
        }
      } else {
        if (talentTitle) lines.push({ cls: "line line--gray line--talent", text: talentTitle, key: talentKey, icon: talentSlotIcon });
        if (talentDescDisp) {
          lines.push({
            cls: "line line--named-meta line--talent-desc",
            text: talentDescDisp,
            html: talentDescHtml,
            key: "",
            isDesc: true
          });
        }
        if (compareNormalize && pvpTalentDescDisp) {
          lines.push({ cls: "line line--named-meta line--talent-desc normalize-compare-pvp", text: pvpTalentDescDisp, html: window.normalizePvpCompareHtml(pveTalentDescDisp, pvpTalentDescDisp), key: "", isDesc: true });
        }
        if (hasPerfectTalent) {
          lines.push({ cls: "brand-named-sep", hr: true, text: "", key: "" });
        }
        if (perfectTitle) lines.push({ cls: "line line--named line--talent", text: perfectTitle, key: perfectKey });
        if (hasPerfectTalent && perfectDescDisp) {
          const html = useNormalize && talentDescDisp && perfectDescDisp
            ? (typeof window.highlightTalentDiffHtml === "function"
              ? (typeof window.highlightTalentMultiDiffHtml === "function"
                ? window.highlightTalentMultiDiffHtml(
                  [pvePerfectDescDisp, talentDescDisp],
                  perfectDescDisp,
                  ["gear-talent-pvp-diff", "gear-talent-diff"]
                )
                : window.highlightTalentDiffHtml(talentDescDisp, perfectDescDisp, "gear-talent-diff"))
              : highlightDiffHtml(talentDescDisp, perfectDescDisp))
            : highlightDiffHtml(talentDescDisp, perfectDescDisp);
          lines.push({ cls: "line line--named-meta line--talent-desc", text: perfectDescDisp, html, key: "", isDesc: true });
          if (compareNormalize && pvpPerfectDescDisp) {
            lines.push({ cls: "line line--named-meta line--talent-desc normalize-compare-pvp", text: pvpPerfectDescDisp, html: window.normalizePvpPerfectCompareHtml(pvePerfectDescDisp, pvpTalentDescDisp, pvpPerfectDescDisp), key: "", isDesc: true });
          }
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
      const iconPrimary = iconUrl("talents", talentKey || perfectKey, "img/icon/talent");
      const iconAlt = iconUrl("talents", perfectKey || talentKey, "img/icon/talent");
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
            const slotIconSrc = iconUrl("gear_slots", sk, "img/icon/slot");
            const slotIcon = slotIconSrc ? iconImgHtml(slotIconSrc, "ico ico--talent", "slot") : "";
            const bk = normalizeKey(it.brandsetKey || it.brandset || "");
            const brandIconSrc = iconUrl("brands", it.brandsetKey || bk, "img/icon/brandset");
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
