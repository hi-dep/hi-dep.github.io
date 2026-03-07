/* descent-talent specific view logic */
(function () {
  let cache = null;
  const GROUP_ORDER = ["exotic", "offensive", "defensive", "utility"];
  const GROUP_LABEL = {
    exotic: "Exotic",
    offensive: "Offensive",
    defensive: "Defensive",
    utility: "Utility",
  };
  const VALUE_TOKEN_OPEN = "__DESCENT_TIER_VALUE_OPEN__";
  const VALUE_TOKEN_CLOSE = "__DESCENT_TIER_VALUE_CLOSE__";

  const state = {
    selectedPoolKey: "",
    selectedTier: 1,
    poolInitDone: false,
  };

  function getContentEl() {
    return document.getElementById("content");
  }

  function jstNowString() {
    const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const h = String(d.getUTCHours()).padStart(2, "0");
    const min = String(d.getUTCMinutes()).padStart(2, "0");
    const sec = String(d.getUTCSeconds()).padStart(2, "0");
    return `${y}-${m}-${day} ${h}:${min}:${sec}`;
  }

  function addDaysJstString(dateTime, days) {
    const m = String(dateTime || "").match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!m) return "";
    const y = Number(m[1]);
    const mon = Number(m[2]) - 1;
    const d = Number(m[3]);
    const h = Number(m[4]);
    const mi = Number(m[5]);
    const s = Number(m[6]);
    const utc = Date.UTC(y, mon, d, h, mi, s) - 9 * 60 * 60 * 1000;
    const next = new Date(utc + Number(days || 0) * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000);
    const yy = next.getUTCFullYear();
    const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(next.getUTCDate()).padStart(2, "0");
    const hh = String(next.getUTCHours()).padStart(2, "0");
    const mn = String(next.getUTCMinutes()).padStart(2, "0");
    const ss = String(next.getUTCSeconds()).padStart(2, "0");
    return `${yy}-${mm}-${dd} ${hh}:${mn}:${ss}`;
  }

  function normalizeTier(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 1;
    return Math.max(1, Math.min(10, Math.floor(v)));
  }

  function evalTierExpr(expr, tier) {
    const s = String(expr || "").trim();
    if (!s) return "";
    if (!/^[0-9tierTIER+\-*/().\s]+$/.test(s)) return `[${s}]`;
    try {
      const fn = new Function("tier", `return (${s});`);
      const out = Number(fn(normalizeTier(tier)));
      if (!Number.isFinite(out)) return `[${s}]`;
      const rounded = Math.abs(out - Math.round(out)) < 0.000001 ? Math.round(out) : Number(out.toFixed(2));
      return String(rounded);
    } catch (e) {
      return `[${s}]`;
    }
  }

  function buildTierDescription(baseDesc, formula, tier) {
    const f = String(formula || "").trim();
    if (!f) return String(baseDesc || "").trim();
    return f.replace(/\[([^\]]+)\]/g, (_, expr) => `${VALUE_TOKEN_OPEN}${evalTierExpr(expr, tier)}${VALUE_TOKEN_CLOSE}`);
  }

  function formatTierDescriptionHtml(text) {
    const escaped = escapeHtmlWithBr(text);
    return escaped
      .split(VALUE_TOKEN_OPEN).join('<span class="descent-tier-value">')
      .split(VALUE_TOKEN_CLOSE).join("</span>");
  }

  function rarityClassByGroup(group) {
    const g = normalizeKey(group || "");
    if (g === "exotic") return "rarity-exotic";
    if (g === "offensive") return "rarity-offensive";
    if (g === "defensive") return "rarity-defensive";
    if (g === "utility") return "rarity-utility";
    return "rarity-highend";
  }

  function groupLabel(groupKey) {
    const g = normalizeKey(groupKey || "");
    return GROUP_LABEL[g] || g || "Other";
  }

  function escapeHtmlWithBr(text) {
    return escapeHtml(String(text || "")).replace(/\r?\n/g, "<br>");
  }

  function safeLang() {
    try {
      if (typeof langSelect !== "undefined" && langSelect && langSelect.value) return langSelect.value;
    } catch (e) {
      // ignore
    }
    return "en";
  }

  function safeTrText(text) {
    try {
      if (typeof trText === "function") return trText(text);
    } catch (e) {
      // ignore
    }
    return String(text || "");
  }

  function renderShellOnly(extraStatusText) {
    const contentEl = getContentEl();
    if (!contentEl) return;
    const statusHtml = extraStatusText
      ? `<div class="status">${escapeHtml(String(extraStatusText || ""))}</div>`
      : "";
    contentEl.innerHTML = `
      <section class="catgroup catgroup--gear" data-keep-visible="1">
        <div class="status status--schedule" style="display:block;">
          <div class="status__row"><span class="status__label">${escapeHtml(typeof ui === "function" ? ui("descentPool") : "Descent Talent Pool")}</span><span class="status__time">---</span></div>
        </div>
      </section>
      <section class="catgroup catgroup--gear catgroup--gear-talent" data-keep-visible="1">
        <div class="trello-group-toggle descent-controls">
          <div class="descent-controls__row descent-controls__row--top">
            <button class="btn btn--ghost talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
            ${window.talentShowDesc ? `<select id="descentTierSelect" style="height:24px;padding:0 9px;border-radius:999px;font-size:11px;line-height:1;min-width:92px;max-width:120px;">
            <option value="1" selected>Tier 1</option>
            <option value="2">Tier 2</option>
            <option value="3">Tier 3</option>
            <option value="4">Tier 4</option>
            <option value="5">Tier 5</option>
            <option value="6">Tier 6</option>
            <option value="7">Tier 7</option>
            <option value="8">Tier 8</option>
            <option value="9">Tier 9</option>
            <option value="10">Tier 10</option>
          </select>` : ""}
          </div>
          <div class="descent-controls__row descent-controls__row--filters">
            <button class="btn btn--ghost weapon-type-filter-btn is-on" type="button" data-descent-pool="all">All</button>
          </div>
        </div>
      </section>
      ${statusHtml}
    `;
  }

  function sortedPoolOptions(rows) {
    const map = new Map();
    (rows || []).forEach((r) => {
      const k = normalizeKey(String(r.pool_key || ""));
      if (!k) return;
      const label = safeTrText(String(r.pool_key || "").trim());
      if (!map.has(k)) map.set(k, { key: k, label });
    });
    return Array.from(map.values()).sort((a, b) =>
      String(a.label || "").localeCompare(String(b.label || ""), safeLang() === "ja" ? "ja" : "en")
    );
  }

  function dedupeTalentRows(rows) {
    const byKey = new Map();
    (rows || []).forEach((r) => {
      const k = normalizeKey(String(r.talent_key || r.talent_name || ""));
      if (!k) return;
      const prev = byKey.get(k);
      if (!prev) {
        byKey.set(k, r);
        return;
      }
      const prevScore =
        (String(prev.base_description || "").trim() ? 1 : 0) +
        (String(prev.tier_formula || "").trim() ? 1 : 0) +
        (String(prev.talent_group || "").trim() ? 1 : 0);
      const curScore =
        (String(r.base_description || "").trim() ? 1 : 0) +
        (String(r.tier_formula || "").trim() ? 1 : 0) +
        (String(r.talent_group || "").trim() ? 1 : 0);
      if (curScore > prevScore) byKey.set(k, r);
    });
    return Array.from(byKey.values());
  }

  async function loadRows() {
    if (cache) return cache;
    const SQL = await initSql();
    const idxV = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBufferWithTimeout(`${DATA_BASE}/descent/descent_talent_pool_latest.db.gz${idxV}`, 8000);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const nowJst = jstNowString();
      const cycleStmt = db.prepare(`
        SELECT normalized_cycle_jst, talent_pool, talent_pool_key
        FROM descent_talent_pool
        WHERE normalized_cycle_jst <= ?
        ORDER BY normalized_cycle_jst DESC
        LIMIT 1
      `);
      cycleStmt.bind([nowJst]);
      let active = null;
      if (cycleStmt.step()) active = cycleStmt.getAsObject();
      cycleStmt.free();
      if (!active) {
        const st = db.prepare(`
          SELECT normalized_cycle_jst, talent_pool, talent_pool_key
          FROM descent_talent_pool
          ORDER BY normalized_cycle_jst DESC
          LIMIT 1
        `);
        if (st.step()) active = st.getAsObject();
        st.free();
      }
      if (!active) {
        cache = { active: null, rows: [], cycleDays: 3 };
        return cache;
      }

      let cycleDays = 3;
      try {
        const m = db.exec("SELECT value FROM meta WHERE key='cycle_days'");
        if (m && m.length && m[0].values && m[0].values.length) {
          const n = Number(m[0].values[0][0]);
          if (Number.isFinite(n) && n > 0) cycleDays = n;
        }
      } catch (e) {
        cycleDays = 3;
      }

      const poolKey = String(active.talent_pool_key || normalizeKey(active.talent_pool || ""));
      const mapStmt = db.prepare(`
        SELECT
          m.pool_key,
          m.talent_name,
          m.talent_key,
          d.talent_group,
          d.base_description,
          d.tier_formula
        FROM descent_talent_pool_map m
        LEFT JOIN descent_talent_descriptions d ON d.talent_key = m.talent_key
        ORDER BY m.pool_key, m.talent_name
      `);
      const rows = [];
      while (mapStmt.step()) rows.push(mapStmt.getAsObject());
      mapStmt.free();

      cache = {
        active: {
          cycle: String(active.normalized_cycle_jst || ""),
          pool: String(active.talent_pool || ""),
          poolKey,
          expiresAt: addDaysJstString(String(active.normalized_cycle_jst || ""), cycleDays),
        },
        rows,
        cycleDays,
      };
      return cache;
    } finally {
      db.close();
    }
  }

  async function fetchArrayBufferWithTimeout(path, timeoutMs) {
    const ms = Math.max(1, Number(timeoutMs) || 8000);
    const hasAbort = typeof AbortController !== "undefined";
    const ctrl = hasAbort ? new AbortController() : null;
    let timer = null;
    try {
      const fetchPromise = fetch(path, hasAbort
        ? { cache: "no-store", signal: ctrl.signal }
        : { cache: "no-store" }
      ).then((res) => {
        if (!res.ok) throw new Error(`fetch failed: ${res.status} ${path}`);
        return res.arrayBuffer();
      });
      const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
          try {
            if (ctrl) ctrl.abort();
          } catch (e) {
            // ignore
          }
          reject(new Error(`fetch timeout: ${path}`));
        }, ms);
      });
      return await Promise.race([fetchPromise, timeoutPromise]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  function buildCardHtml(row, idx, tier) {
    const rawName = String(row.talent_name || "").trim();
    const talentKey = normalizeKey(String(row.talent_key || rawName));
    const group = normalizeKey(String(row.talent_group || ""));
    const rarityClass = rarityClassByGroup(group);
    const name = safeTrText(rawName || talentKey);
    const descTemplate = trCategoryText(
      "descent_talent_desc",
      talentKey,
      String(row.tier_formula || row.base_description || "").trim()
    );
    const tierText = buildTierDescription("", descTemplate, tier);
    const desc = String(tierText || descTemplate || "").trim();
    const showDesc = !!window.talentShowDesc;
    const search = [rawName, name, talentKey, group, desc].map((x) => normalizeKey(x || "")).filter(Boolean).join(" ");
    const iconPrimary = iconUrl("talents", talentKey, "img/talents");
    const bg = iconPrimary ? bgIconHtml(iconPrimary, "card__bg--tr", "talent") : "";
    const lines = [];
    lines.push({ cls: "line line--talent", html: escapeHtml(name || rawName || talentKey) });
    if (desc) {
      lines.push({
        cls: "line line--named-meta line--talent-desc",
        html: formatTierDescriptionHtml(desc),
        isDesc: true,
      });
    }
    return `
      <article class="card ${rarityClass} ${desc ? "is-desc-open" : ""}" data-item-id="descent-talent:${idx}:${escapeHtml(talentKey || "row")}" data-search="${escapeHtml(search)}" ${desc ? `data-desc-collapsible="1" data-desc-open="${showDesc ? "1" : "0"}"` : ""}>
        ${bg}
        <div class="lines">
          ${lines.map((ln) => `<div class="${ln.cls}" ${ln.isDesc ? `data-desc-line="1"` : ""}><div class="line__body"><div class="line__text">${ln.html}</div></div></div>`).join("")}
        </div>
      </article>
    `;
  }

  function render(payload) {
    const contentEl = getContentEl();
    if (!contentEl) return;
    const active = payload?.active || null;
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const poolOptions = sortedPoolOptions(rows);
    if (!state.poolInitDone) {
      const requestedPoolKey = normalizeKey(String(window.descentTalentInitialPoolKey || ""));
      if (requestedPoolKey && poolOptions.some((x) => x.key === requestedPoolKey)) {
        state.selectedPoolKey = requestedPoolKey;
      } else if (!state.selectedPoolKey && active?.poolKey) {
        state.selectedPoolKey = normalizeKey(active.poolKey);
      }
      state.poolInitDone = true;
    }
    if (state.selectedPoolKey && !poolOptions.some((x) => x.key === state.selectedPoolKey)) {
      state.selectedPoolKey = "";
    }
    window.descentTalentInitialPoolKey = state.selectedPoolKey || "";
    if (typeof replaceUrlParams === "function") {
      replaceUrlParams({ descent_pool: state.selectedPoolKey || null });
    }
    state.selectedTier = normalizeTier(state.selectedTier);
    const filteredByPool = rows.filter((r) => {
      const key = normalizeKey(String(r.pool_key || ""));
      if (!state.selectedPoolKey) return true;
      return key === state.selectedPoolKey;
    });
    const filteredRows = dedupeTalentRows(filteredByPool);

    const groups = new Map();
    GROUP_ORDER.forEach((g) => groups.set(g, []));
    filteredRows.forEach((r) => {
      const g = normalizeKey(String(r.talent_group || ""));
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(r);
    });

    const sections = [];
    let cardIdx = 0;
    GROUP_ORDER.forEach((g) => {
      const list = (groups.get(g) || []).slice().sort((a, b) => {
        const an = safeTrText(String(a.talent_name || ""));
        const bn = safeTrText(String(b.talent_name || ""));
        return String(an).localeCompare(String(bn), safeLang() === "ja" ? "ja" : "en");
      });
      if (!list.length) return;
      const cards = list.map((r) => buildCardHtml(r, cardIdx++, state.selectedTier)).join("");
      sections.push(`
        <section class="catgroup catgroup--gear catgroup--gear-talent">
          <div class="section-title">${escapeHtml(groupLabel(g))}</div>
          <div class="grid grid--gear">${cards}</div>
        </section>
      `);
    });

    const poolButtons = [
      `<button class="btn btn--ghost weapon-type-filter-btn ${state.selectedPoolKey ? "" : "is-on"}" type="button" data-descent-pool="all">All</button>`,
      ...poolOptions.map((opt) => `<button class="btn btn--ghost weapon-type-filter-btn ${state.selectedPoolKey === opt.key ? "is-on" : ""}" type="button" data-descent-pool="${escapeHtml(opt.key)}">${escapeHtml(opt.label || opt.key)}</button>`),
    ].join("");
    const tierSelectOpts = Array.from({ length: 10 }, (_, i) => i + 1)
      .map((n) => `<option value="${n}" ${state.selectedTier === n ? "selected" : ""}>Tier ${n}</option>`)
      .join("");

    let poolRemainText = "---";
    if (active?.pool) {
      const label = safeTrText(active.pool);
      let remain = "";
      if (active?.expiresAt && typeof parseJstDateTimeToUtcMs === "function" && typeof formatRemaining === "function") {
        const expireUtc = Number(parseJstDateTimeToUtcMs(String(active.expiresAt)));
        if (Number.isFinite(expireUtc)) {
          remain = formatRemaining(Math.max(0, expireUtc - Date.now()));
        }
      }
      poolRemainText = remain
        ? `${label} (${(typeof ui === "function" ? ui("remainPrefix") : "Remain")} ${remain})`
        : label;
    }

    contentEl.innerHTML = `
      <section class="catgroup catgroup--gear" data-keep-visible="1">
        <div class="status status--schedule" style="display:block;">
          <div class="status__row"><span class="status__label">${escapeHtml(typeof ui === "function" ? ui("descentPool") : "Descent Talent Pool")}</span><span class="status__time">${escapeHtml(poolRemainText)}</span></div>
        </div>
      </section>
      <section class="catgroup catgroup--gear catgroup--gear-talent" data-keep-visible="1">
        <div class="trello-group-toggle descent-controls">
          <div class="descent-controls__row descent-controls__row--top">
            <button class="btn btn--ghost talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
            ${window.talentShowDesc ? `<select id="descentTierSelect" style="height:24px;padding:0 9px;border-radius:999px;font-size:11px;line-height:1;min-width:92px;max-width:120px;">${tierSelectOpts}</select>` : ""}
          </div>
          <div class="descent-controls__row descent-controls__row--filters">
            ${poolButtons}
          </div>
        </div>
      </section>
      ${sections.length ? sections.join("") : `<div class="status">${escapeHtml(ui("noData"))}</div>`}
    `;

    contentEl.querySelectorAll(".weapon-type-filter-btn[data-descent-pool]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = normalizeKey(btn.getAttribute("data-descent-pool") || "");
        state.selectedPoolKey = (v === "all") ? "" : v;
        window.descentTalentInitialPoolKey = state.selectedPoolKey || "";
        if (typeof replaceUrlParams === "function") {
          replaceUrlParams({ descent_pool: state.selectedPoolKey || null });
        }
        render(payload);
      });
    });
    const tierSel = contentEl.querySelector("#descentTierSelect");
    if (tierSel) {
      tierSel.addEventListener("change", () => {
        state.selectedTier = normalizeTier(tierSel.value);
        render(payload);
      });
    }
    const showDesc = !!window.talentShowDesc;
    contentEl.querySelectorAll('.card[data-desc-collapsible="1"]').forEach((card) => {
      card.classList.toggle("is-desc-open", showDesc);
      card.setAttribute("data-desc-open", showDesc ? "1" : "0");
    });
    if (typeof applyFiltersToDom === "function") applyFiltersToDom();
  }

  async function renderDescentTalentView() {
    renderShellOnly(typeof ui === "function" ? ui("loadingDb") : "Loading DB...");
    try {
      const payload = await loadRows();
      render(payload);
    } catch (err) {
      const msg = ((typeof ui === "function" ? ui("loadError") : "Load error") || "Load error") + ": " + (err?.message || err);
      renderShellOnly(msg);
    }
  }

  window.descentTalentViewRender = renderDescentTalentView;
  window.descentTalentViewInvalidate = function () {
    cache = null;
    state.poolInitDone = false;
  };
})();

