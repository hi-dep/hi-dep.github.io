/* trello-specific view logic */
(function () {
  function nk(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }
  const PLANNED_RE = /^planned for\s+/i;
  const STATUS_LABELS = ["Reported", "Investigating", "In Progress", "Won't Fix", "Backlog", "Fix Live"];
  const STATUS_LABELS_NORM = STATUS_LABELS.map((x) => nk(x));
  const ARCHIVE_LIST_KEYS = new Set(["fixlive", "backlog", "wontsfix", "wontfix"]);
  const HIDDEN_CARD_IDS = new Set([
    "62daa1e3f4b5af34ab2cb229",
    "67d85724d3facb0126d10494",
    "62c57f4ace3d29567e4a9193",
    "62c57f4ace3d29567e4a91a7",
    "62c57f4ace3d29567e4a918f",
    "62c57f4ace3d29567e4a9191",
    "62c57f4ace3d29567e4a91a3",
    "62c57f4ace3d29567e4a91a5",
    "62daa2d6abc2d9265c7bb31e",
    "648829f732709b4019e89a8a",
    "634e8b79aa95a30147901372",
    "62c57f4ace3d29567e4a9197",
    "62daa14579dc331a54b4e366",
    "64637d9086ff3c151d07697f",
    "62daa3357bec1502e12dccba",
    "64493573056b78d49f920e75",
    "62daa3a451c28875f5e24e01",
    "6668843bbe5a77d1e7a69fea",
    "65c26aeae066376e0cb9eb19",
    "651aed2d6ccf2cee07a4cf5e",
    "6419b108b4cd0e06147b2eb2",
    "63205f3ba1e79b02a1392d99",
    "62c57f4ace3d29567e4a9195"
  ]);
  const SECTIONS_STATE_KEY = "__trello_sections_state__";
  const SECTIONS_COLLAPSE_STATE_KEY = "__trello_sections_collapse_state__";
  let trelloI18nMapCache = null;
  let trelloPatchesI18nMapCache = null;

  function fmtTrelloDate(s) {
    if (!s) return "";
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return String(s);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day} ${hh}:${mm}`;
  }

  async function loadTrelloSummary() {
    if (window.trelloSummaryCache) return window.trelloSummaryCache;
    const v = indexJson && indexJson.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?ts=${Date.now()}`;
    const ti = await fetchJson(`${DATA_BASE}/trello/index.json${v}`);
    const dbFile = String((ti && ti.db_file) || "trello_latest.db.gz");
    const dbUrl = dbFile.includes("/")
      ? `${DATA_BASE}/${dbFile.replace(/^trello\//, "trello/")}${v}`
      : `${DATA_BASE}/trello/${dbFile}${v}`;

    const SQL = await initSql();
    const gz = await fetchArrayBuffer(dbUrl);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const board = {
        lists: [],
        cards: []
      };

      const bStmt = db.prepare(`
        SELECT board_id, name, url, short_url, date_last_activity
        FROM boards
        LIMIT 1
      `);
      if (bStmt.step()) {
        const b = bStmt.getAsObject();
        board.id = String(b.board_id || "");
        board.name = String(b.name || "");
        board.url = String(b.url || "");
        board.shortUrl = String(b.short_url || "");
        board.dateLastActivity = String(b.date_last_activity || "");
      }
      bStmt.free();

      const lStmt = db.prepare(`
        SELECT list_id, board_id, name, pos, closed
        FROM lists
        ORDER BY COALESCE(pos, 0), name
      `);
      while (lStmt.step()) {
        const r = lStmt.getAsObject();
        board.lists.push({
          id: String(r.list_id || ""),
          idBoard: String(r.board_id || ""),
          name: String(r.name || ""),
          pos: Number(r.pos || 0),
          closed: Number(r.closed || 0) === 1
        });
      }
      lStmt.free();

      const cStmt = db.prepare(`
        SELECT card_id, board_id, list_id, name, description, card_closed, date_last_activity, url, short_url
        FROM cards
        ORDER BY date_last_activity DESC, card_id
      `);
      while (cStmt.step()) {
        const r = cStmt.getAsObject();
        board.cards.push({
          id: String(r.card_id || ""),
          idBoard: String(r.board_id || ""),
          idList: String(r.list_id || ""),
          name: String(r.name || ""),
          desc: String(r.description || ""),
          closed: Number(r.card_closed || 0) === 1,
          dateLastActivity: String(r.date_last_activity || ""),
          url: String(r.url || ""),
          shortUrl: String(r.short_url || ""),
          labels: []
        });
      }
      cStmt.free();

      const labelsByCard = new Map();
      const clStmt = db.prepare(`
        SELECT cl.card_id, l.label_id, l.name, l.color
        FROM card_labels cl
        JOIN labels l ON l.label_id = cl.label_id
        ORDER BY cl.card_id, l.name
      `);
      while (clStmt.step()) {
        const r = clStmt.getAsObject();
        const cardId = String(r.card_id || "");
        if (!cardId) continue;
        if (!labelsByCard.has(cardId)) labelsByCard.set(cardId, []);
        labelsByCard.get(cardId).push({
          id: String(r.label_id || ""),
          name: String(r.name || ""),
          color: String(r.color || "")
        });
      }
      clStmt.free();

      board.cards.forEach((c) => {
        c.labels = labelsByCard.get(String(c.id || "")) || [];
      });

      window.trelloSummaryCache = { index: ti || {}, board };
      return window.trelloSummaryCache;
    } finally {
      db.close();
    }
  }

  async function loadTrelloI18nMap() {
    if (trelloI18nMapCache) return trelloI18nMapCache;
    const v = indexJson && indexJson.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?ts=${Date.now()}`;
    try {
      const ti = await fetchJson(`${DATA_BASE}/trello/index.json${v}`);
      const i18nFile = String((ti && ti.i18n_file) || "trello/i18n_trello.json");
      const url = i18nFile.includes("/")
        ? `${DATA_BASE}/${i18nFile.replace(/^trello\//, "trello/")}${v}`
        : `${DATA_BASE}/trello/${i18nFile}${v}`;
      const data = await fetchJson(url);
      const src = data && typeof data === "object" && data.text_map && typeof data.text_map === "object"
        ? data.text_map
        : (data && typeof data === "object" ? data : {});
      const out = {};
      for (const [k, val] of Object.entries(src || {})) {
        const ks = String(k || "");
        if (!ks) continue;
        out[ks] = String(val == null ? "" : val);
      }
      trelloI18nMapCache = out;
    } catch (e) {
      trelloI18nMapCache = {};
    }
    return trelloI18nMapCache;
  }

  async function loadTrelloPatchesI18nMap() {
    if (trelloPatchesI18nMapCache) return trelloPatchesI18nMapCache;
    const v = indexJson && indexJson.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?ts=${Date.now()}`;
    try {
      const ti = await fetchJson(`${DATA_BASE}/trello/index.json${v}`);
      const i18nFile = String((ti && ti.i18n_patches_file) || (ti && ti.i18n_file) || "trello/i18n_trello.json");
      const url = i18nFile.includes("/")
        ? `${DATA_BASE}/${i18nFile.replace(/^trello\//, "trello/")}${v}`
        : `${DATA_BASE}/trello/${i18nFile}${v}`;
      const data = await fetchJson(url);
      const src = data && typeof data === "object" && data.text_map && typeof data.text_map === "object"
        ? data.text_map
        : (data && typeof data === "object" ? data : {});
      const out = {};
      for (const [k, val] of Object.entries(src || {})) {
        const ks = String(k || "");
        if (!ks) continue;
        out[ks] = String(val == null ? "" : val);
      }
      trelloPatchesI18nMapCache = out;
    } catch (e) {
      trelloPatchesI18nMapCache = {};
    }
    return trelloPatchesI18nMapCache;
  }

  function currentLang() {
    const el = document.getElementById("langSelect");
    const v = String((el && el.value) || "ja").toLowerCase();
    return v === "en" ? "en" : "ja";
  }

  function normalizePhraseKey(text) {
    let s = String(text || "").normalize("NFKC");
    // remove zero-width / BOM-like chars
    s = s.replace(/[\u200B\u200C\u200D\uFEFF]/g, "");
    // normalize any whitespace to ASCII space and collapse repeats
    s = s.replace(/\s/g, " ").replace(/ +/g, " ").trim();
    return s;
  }

  function translateTrelloText(raw, lang, textMap) {
    const src = String(raw || "");
    if (!src) return "";
    if (lang !== "ja") return src;
    const key = normalizePhraseKey(src);
    const exact = String((textMap && textMap[key]) || "");
    if (exact && !exact.startsWith("TODO:")) return exact;
    // line-based fallback translation for multi-line description
    if (src.includes("\n")) {
      const lines = src.split("\n");
      const tr = lines.map((line) => {
        const lk = normalizePhraseKey(line);
        const v = String((textMap && textMap[lk]) || "");
        return (v && !v.startsWith("TODO:")) ? v : String(line || "");
      });
      return tr.join("\n");
    }
    return src;
  }

  function renderMarkdown(md) {
    const src = String(md || "");
    if (!src.trim()) return "";
    const lines = src.split(/\r?\n/);
    const out = [];
    let inList = false;
    const inline = (s) => {
      const raw = String(s || "");
      const links = [];
      const withTokens = raw.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)(?:\s+(?:"[^"]*"|'[^']*'))?\)/g,
        (_m, text, url) => {
          const token = `__MD_LINK_${links.length}__`;
          links.push(`<a href="${escapeHtml(String(url || ""))}" target="_blank" rel="noopener">${escapeHtml(String(text || ""))}</a>`);
          return token;
        }
      );

      let t = escapeHtml(withTokens);
      for (let i = 0; i < links.length; i++) {
        const token = `__MD_LINK_${i}__`;
        t = t.replace(token, links[i]);
      }
      t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      t = t.replace(/__(.+?)__/g, "<strong>$1</strong>");
      t = t.replace(/\*(.+?)\*/g, "<em>$1</em>");
      t = t.replace(/_(.+?)_/g, "<em>$1</em>");
      t = t.replace(/~~(.+?)~~/g, "<del>$1</del>");
      t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
      return t;
    };
    for (const raw of lines) {
      const line = String(raw || "");
      const trim = line.trim();
      if (!trim) {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        continue;
      }
      const mHr = trim.match(/^([-*_])(?:\s*\1){2,}$/);
      if (mHr) {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        out.push("<hr>");
        continue;
      }
      const mH = trim.match(/^(#{1,6})\s+(.+)$/);
      if (mH) {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        const lvl = Math.min(6, mH[1].length);
        out.push(`<h${lvl}>${inline(mH[2])}</h${lvl}>`);
        continue;
      }
      const mL = trim.match(/^[-*]\s+(.+)$/);
      if (mL) {
        if (!inList) {
          out.push("<ul>");
          inList = true;
        }
        out.push(`<li>${inline(mL[1])}</li>`);
        continue;
      }
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push(`<p>${inline(trim)}</p>`);
    }
    if (inList) out.push("</ul>");
    return out.join("");
  }

  function normalizeTerms(arr) {
    return (arr || []).map(s => nk(stripHtml(String(s || "")))).filter(Boolean);
  }

  function cardHasTerms(cardEl, terms) {
    if (!terms.length) return true;
    const hay = String(cardEl.getAttribute("data-search") || "");
    if (!hay) return false;
    if (filterMode === "or") return terms.some(t => hay.includes(t));
    return terms.every(t => hay.includes(t));
  }

  function plannedLabelOf(card) {
    const labels = Array.isArray(card.labels) ? card.labels : [];
    const found = labels.find(lb => lb && PLANNED_RE.test(String(lb.name || "")));
    return found ? String(found.name || "") : "";
  }

  function canonicalStatusFromText(raw) {
    const n = nk(raw);
    if (n === "reported") return "Reported";
    if (n === "investigating") return "Investigating";
    if (n === "inprogress") return "In Progress";
    if (n === "wontsfix" || n === "wontfix") return "Won't Fix";
    if (n === "backlog") return "Backlog";
    if (n === "fixlive") return "Fix Live";
    return "";
  }

  function statusLabelOf(card, listsById) {
    const listName = String((listsById.get(card.idList) || {}).name || "");
    const fromList = canonicalStatusFromText(listName);
    if (fromList) return fromList;

    const labels = Array.isArray(card.labels) ? card.labels : [];
    for (const lb of labels) {
      const raw = String((lb && lb.name) || "");
      const s = canonicalStatusFromText(raw);
      if (s) return s;
    }
    return "";
  }

  function labelsText(card) {
    const labels = Array.isArray(card.labels) ? card.labels : [];
    return labels.map(lb => String((lb && lb.name) || "")).filter(Boolean).join(", ");
  }

  function buildGroups(cards, listsById, groupBy) {
    const groups = new Map();
    const order = [];
    if (groupBy === "planned") {
      // Runtime order:
      // 1) Planned~ sections
      // 2) Reported/Investigating/In Progress/Won't Fix/Backlog/Fix Live
      // 3) Other
    }
    const put = (gk, card) => {
      if (!groups.has(gk)) {
        groups.set(gk, []);
        order.push(gk);
      }
      groups.get(gk).push(card);
    };
    for (const c of cards) {
      if (groupBy === "planned") {
        const p = plannedLabelOf(c);
        if (p) {
          put(p, c);
          continue;
        }
        const s = statusLabelOf(c, listsById);
        if (s) {
          put(s, c);
          continue;
        }
        put("Other", c);
      } else {
        const listName = String((listsById.get(c.idList) || {}).name || "Uncategorized");
        put(listName, c);
      }
    }
    if (groupBy === "planned") {
      const plannedKeys = order.filter((k) => PLANNED_RE.test(String(k || "")));
      plannedKeys.sort((a, b) => String(b).localeCompare(String(a), "en"));

      const statusKeys = STATUS_LABELS.filter((s) => groups.has(s));
      const otherKeys = order.filter((k) => String(k) === "Other");
      const nextOrder = [...plannedKeys, ...statusKeys, ...otherKeys];
      order.length = 0;
      for (const k of nextOrder) order.push(k);
    }
    return { groups, order };
  }

  function isArchiveListName(name) {
    const n = nk(String(name || ""));
    return ARCHIVE_LIST_KEYS.has(n);
  }

  function resolvePatchesListIds(listsById) {
    const ids = [];
    for (const [id, li] of listsById.entries()) {
      const name = String((li && li.name) || "");
      const n = nk(name);
      if (n.includes("patchesandupdates") || n.includes("patch")) {
        ids.push(id);
      }
    }
    return ids;
  }

  function getSectionsState() {
    if (!window[SECTIONS_STATE_KEY]) {
      window[SECTIONS_STATE_KEY] = { name: {}, planned: {} };
    }
    return window[SECTIONS_STATE_KEY];
  }

  function getSectionCollapseState() {
    if (!window[SECTIONS_COLLAPSE_STATE_KEY]) {
      window[SECTIONS_COLLAPSE_STATE_KEY] = { name: {}, planned: {} };
    }
    return window[SECTIONS_COLLAPSE_STATE_KEY];
  }

  function getGroupCollapseMap(groupBy) {
    const st = getSectionCollapseState();
    if (!st[groupBy]) st[groupBy] = {};
    return st[groupBy];
  }

  function isSectionCollapsed(groupBy, key) {
    const mp = getGroupCollapseMap(groupBy);
    return mp[key] === true;
  }

  window.trelloViewSetSectionCollapsed = function trelloViewSetSectionCollapsed(groupBy, key, collapsed) {
    const mp = getGroupCollapseMap(groupBy);
    mp[key] = !!collapsed;
  };

  function getGroupSectionMap(groupBy) {
    const st = getSectionsState();
    if (!st[groupBy]) st[groupBy] = {};
    return st[groupBy];
  }

  function isSectionVisible(groupBy, key) {
    const mp = getGroupSectionMap(groupBy);
    return mp[key] !== false;
  }

  window.trelloViewSetSectionVisible = function trelloViewSetSectionVisible(groupBy, key, visible) {
    const mp = getGroupSectionMap(groupBy);
    mp[key] = !!visible;
  };

  function ensureSectionDefaults(groupBy, keys) {
    const mp = getGroupSectionMap(groupBy);
    for (const k of keys) {
      if (!(k in mp)) mp[k] = true;
    }
  }

  function renderGroupToggle(groupBy, sectionKeys, showArchive) {
    const panelRows = sectionKeys.map((k) => {
      const checked = isSectionVisible(groupBy, k) ? "checked" : "";
      const enc = encodeURIComponent(k);
      return `
        <label class="trello-section-opt">
          <input class="trello-section-check" type="checkbox" data-section-key-enc="${enc}" ${checked} />
          <span>${escapeHtml(k)}</span>
        </label>
      `;
    }).join("");
    return `
      <div class="trello-group-toggle">
        <button class="btn btn--ghost trello-archive-btn ${showArchive ? "is-on" : ""}" type="button" data-toggle-archive="1">Archive</button>
        <button class="btn btn--ghost trello-desc-btn ${window.trelloExpandAll ? "is-on" : ""}" type="button" data-toggle-desc="1">Desc</button>
        <button class="btn btn--ghost trello-sections-btn" type="button" data-toggle-sections-picker="1">Sections</button>
      </div>
      <div class="trello-sections-picker" aria-hidden="true" data-group-by="${groupBy}">
        ${panelRows || `<div class="trello-section-opt"><span>(none)</span></div>`}
      </div>
    `;
  }

  function renderPatchesToggle() {
    return ``;
  }

  window.trelloViewApplyFilters = function trelloViewApplyFilters() {
    const terms = (typeof filtersOpen !== "undefined" && filtersOpen)
      ? normalizeTerms(activeFilterKeys)
      : [];
    const groupBy = "planned";
    const respectSectionVisibility = window.currentViewMode !== "patches";
    document.querySelectorAll(".trello-card[data-trello-card='1']").forEach(card => {
      const ok = cardHasTerms(card, terms);
      card.style.display = ok ? "" : "none";
    });
    document.querySelectorAll(".trello-section").forEach(sec => {
      const sectionKey = String(sec.getAttribute("data-section-key") || "");
      const visibleByUser = (!respectSectionVisibility) || isSectionVisible(groupBy, sectionKey);
      const visibleCount = Array.from(sec.querySelectorAll(".trello-card[data-trello-card='1']"))
        .filter(c => c.style.display !== "none")
        .length;
      const cnt = sec.querySelector("[data-section-count='1']");
      if (cnt) cnt.textContent = String(visibleCount);
      if (!visibleByUser) {
        sec.style.display = "none";
        return;
      }
      sec.style.display = visibleCount > 0 ? "" : "none";
    });
  };

  window.trelloViewRender = async function trelloViewRender() {
    setStatus("Loading Trello...");
    const ts = await loadTrelloSummary();
    const lang = currentLang();
    const b = ts.board || {};
    const idx = ts.index || {};
    const groupBy = "planned";
    const showArchive = !!window.trelloShowArchive;
    const viewMode = window.currentViewMode === "patches" ? "patches" : "trello";
    const textMap = viewMode === "patches"
      ? await loadTrelloPatchesI18nMap()
      : await loadTrelloI18nMap();

    const cards = Array.isArray(b.cards) ? b.cards.slice() : [];
    cards.sort((a, z) => {
      const at = new Date(a.dateLastActivity || 0).getTime();
      const zt = new Date(z.dateLastActivity || 0).getTime();
      return zt - at;
    });

    const listsById = new Map();
    for (const li of (Array.isArray(b.lists) ? b.lists : [])) {
      if (!li || !li.id) continue;
      listsById.set(li.id, li);
    }

    let filtered = cards;
    const patchListIds = new Set(resolvePatchesListIds(listsById));
    if (viewMode === "patches") {
      filtered = cards.filter(c => patchListIds.has(String(c.idList || "")));
    } else {
      filtered = cards.filter(c => !patchListIds.has(String(c.idList || "")));
    }
    filtered = filtered.filter(c => !HIDDEN_CARD_IDS.has(String(c.id || "")));

    if (viewMode === "patches") {
      const expandAll = !!window.trelloExpandAll;
      const parts = [renderPatchesToggle(), `<section class="vendor"><div class="trello-list">`];
      for (const c of filtered) {
        const labelsArr = Array.isArray(c.labels) ? c.labels : [];
        const labels = labelsText(c);
        const titleText = translateTrelloText(String(c.name || ""), lang, textMap);
        const desc = String(translateTrelloText(String(c.desc || ""), lang, textMap) || "").trim();
        const shortUrl = String(c.shortUrl || "");
        const hasDetail = !!desc;
        const updatedMs = new Date(c.dateLastActivity || "").getTime();
        const isRecent = Number.isFinite(updatedMs) && updatedMs > 0 && (Date.now() - updatedMs) <= (3 * 24 * 60 * 60 * 1000);
        const updatedAt = fmtTrelloDate(c.dateLastActivity || "");
        const detailId = `trello_detail_${escapeHtml(String(c.id || ""))}`;
        const searchText = nk([
          titleText || "",
          labels,
          ...labelsArr.map(x => String((x && x.name) || ""))
        ].join(" "));
        const badgeHtml = labelsArr
          .map(lb => String((lb && lb.name) || "").trim())
          .filter(Boolean)
          .filter((name) => !STATUS_LABELS_NORM.includes(nk(name)))
          .map((n) => `<span class="trello-label trello-filter-pill" data-filter-key="${escapeHtml(n)}">${escapeHtml(n)}</span>`)
          .join("");
        const hasBadge = !!(badgeHtml && badgeHtml.trim());

        parts.push(`
          <article class="trello-card card rarity-highend${isRecent ? " trello-card--recent" : ""}${hasBadge ? " trello-card--has-badge" : ""}${(hasDetail && expandAll) ? " is-expanded" : ""}" data-trello-card="1" data-search="${escapeHtml(searchText)}"${hasDetail ? ` data-detail-id="${detailId}"` : ""}>
            <div class="trello-card__head">
              <div class="trello-card__titlebox">
                <a class="trello-card__title-link" href="${escapeHtml(shortUrl || "#")}" target="_blank" rel="noopener">${escapeHtml(titleText || "")}</a>
                <div class="trello-card__meta-row">
                  <div class="trello-labels trello-labels--inline">${badgeHtml}</div>
                  <div class="card__meta">${escapeHtml(updatedAt || "-")}</div>
                </div>
              </div>
            </div>
            ${hasDetail ? `
              <div id="${detailId}" class="trello-card__detail" aria-hidden="${expandAll ? "false" : "true"}">
                <div class="trello-card__line"><div class="trello-md">${renderMarkdown(desc)}</div></div>
              </div>
            ` : ``}
          </article>
        `);
      }
      parts.push(`</div></section>`);
      contentEl.innerHTML = parts.join("");
      if (typeof window.applyFiltersToDom === "function") {
        window.applyFiltersToDom();
      }
      setStatus("");
      return;
    }

    const archiveCards = [];
    const mainCards = [];
    for (const c of filtered) {
      const listName = String((listsById.get(c.idList) || {}).name || "");
      if (isArchiveListName(listName)) archiveCards.push(c);
      else mainCards.push(c);
    }

    const parts = [];

    const gb = buildGroups(mainCards, listsById, groupBy);
    const agb = showArchive ? buildGroups(archiveCards, listsById, groupBy) : { groups: new Map(), order: [] };
    const sectionDefs = [];
    for (const k of gb.order) {
      sectionDefs.push({ sectionKey: k, groupKey: k, isArchive: false });
    }
    if (showArchive) {
      for (const k of agb.order) {
        sectionDefs.push({ sectionKey: `Archive / ${k}`, groupKey: k, isArchive: true });
      }
    }
    const sectionOrder = sectionDefs.map(s => s.sectionKey);
    ensureSectionDefaults(groupBy, sectionOrder);
    parts.push(renderGroupToggle(groupBy, sectionOrder, showArchive));
    for (const sd of sectionDefs) {
      const gk = sd.sectionKey;
      const listCards = sd.isArchive ? (agb.groups.get(sd.groupKey) || []) : (gb.groups.get(sd.groupKey) || []);
      const collapsed = isSectionCollapsed(groupBy, gk);
      const sectionKeyEnc = encodeURIComponent(gk);
      parts.push(`
        <section class="vendor trello-section${collapsed ? " is-collapsed" : ""}" data-section-key="${escapeHtml(gk)}">
          <h3 class="vendor__title trello-section-title" data-section-key-enc="${sectionKeyEnc}" aria-expanded="${collapsed ? "false" : "true"}" role="button" tabindex="0">
            <span class="trello-section-title__text">${escapeHtml(gk)}</span>
            <span class="trello-section-title__count" data-section-count="1">0</span>
            <span class="trello-section-title__caret">${collapsed ? "▸" : "▾"}</span>
          </h3>
          <div class="trello-list" aria-hidden="${collapsed ? "true" : "false"}">
      `);

      for (const c of listCards) {
        const nowMs = Date.now();
        const labelsArr = Array.isArray(c.labels) ? c.labels : [];
        const listName = String((listsById.get(c.idList) || {}).name || "");
        const labelBadges = labelsArr
          .map(lb => String((lb && lb.name) || "").trim())
          .filter(Boolean)
          .filter((name) => !STATUS_LABELS_NORM.includes(nk(name)));
        const labels = labelsText(c);
        const titleText = translateTrelloText(String(c.name || ""), lang, textMap);
        const desc = String(translateTrelloText(String(c.desc || ""), lang, textMap) || "").trim();
        const shortUrl = String(c.shortUrl || "");
        const hasDetail = !!desc;
        const updatedMs = new Date(c.dateLastActivity || "").getTime();
        const isRecent = Number.isFinite(updatedMs) && updatedMs > 0 && (nowMs - updatedMs) <= (3 * 24 * 60 * 60 * 1000);
        const updatedAt = fmtTrelloDate(c.dateLastActivity || "");
        const detailId = `trello_detail_${escapeHtml(String(c.id || ""))}`;
        const sectionKeyBase = String(sd.groupKey || "");
        const isPlannedSection = PLANNED_RE.test(sectionKeyBase);
        const expandAll = !!window.trelloExpandAll;
        const searchText = nk([
          titleText || "",
          gk,
          labels,
          ...labelsArr.map(x => String((x && x.name) || ""))
        ].join(" "));

        const badgeHtml = isPlannedSection
          ? (listName ? `<span class="trello-label trello-filter-pill" data-filter-key="${escapeHtml(listName)}">${escapeHtml(listName)}</span>` : "")
          : labelBadges.map((n) => `<span class="trello-label trello-filter-pill" data-filter-key="${escapeHtml(n)}">${escapeHtml(n)}</span>`).join("");
        const hasBadge = !!(badgeHtml && badgeHtml.trim());

        parts.push(`
          <article class="trello-card card rarity-highend${isRecent ? " trello-card--recent" : ""}${hasBadge ? " trello-card--has-badge" : ""}${(hasDetail && expandAll) ? " is-expanded" : ""}" data-trello-card="1" data-search="${escapeHtml(searchText)}"${hasDetail ? ` data-detail-id="${detailId}"` : ""}>
            <div class="trello-card__head">
              <div class="trello-card__titlebox">
                <a class="trello-card__title-link" href="${escapeHtml(shortUrl || "#")}" target="_blank" rel="noopener">${escapeHtml(titleText || "")}</a>
                <div class="trello-card__meta-row">
                  <div class="trello-labels trello-labels--inline">${badgeHtml}</div>
                  <div class="card__meta">${escapeHtml(updatedAt || "-")}</div>
                </div>
              </div>
            </div>
            ${hasDetail ? `
              <div id="${detailId}" class="trello-card__detail" aria-hidden="${expandAll ? "false" : "true"}">
                <div class="trello-card__line"><div class="trello-md">${renderMarkdown(desc)}</div></div>
              </div>
            ` : ``}
          </article>
        `);
      }
      parts.push(`</div></section>`);
    }

    contentEl.innerHTML = parts.join("");
    if (typeof window.applyFiltersToDom === "function") {
      window.applyFiltersToDom();
    }
    setStatus("");
  };
})();
