/* grade-cost specific view logic */
(function () {
  let gradeCostCache = null;

  async function fetchGradeCostData() {
    if (gradeCostCache) return gradeCostCache;
    const SQL = await initSql();
    const v = (window.indexJson && window.indexJson.built_at) ? `?v=${encodeURIComponent(window.indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_grade_cost'").length > 0;
      if (!hasTable) {
        console.warn("Grade-cost table is missing in items.db", { hasTable });
        throw new Error("data_unavailable");
      }
      const stmt = db.prepare("SELECT payload FROM items_grade_cost ORDER BY row_id DESC LIMIT 1");
      let payload = {};
      if (stmt.step()) {
        const rec = stmt.getAsObject() || {};
        const raw = String(rec.payload || "").trim();
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") payload = parsed;
          } catch (_e) {
            payload = {};
          }
        }
      }
      stmt.free();
      gradeCostCache = payload;
      return gradeCostCache;
    } finally {
      db.close();
    }
  }

  function stripHeaderSuffix(name) {
    return String(name || "").replace(/_\d+$/, "").trim();
  }

  function canonicalMaterialLabel(label) {
    const raw = stripHeaderSuffix(label);
    const k = normalizeKey(raw);
    const alias = {
      grade: "グレード",
      グレード: "グレード",
      receiver: "レシーバー部品",
      receiverpart: "レシーバー部品",
      レシーバー部品: "レシーバー部品",
      fabric: "保護布",
      保護布: "保護布",
      steel: "スチール",
      スチール: "スチール",
      polycarbonate: "ポリカーボネート",
      ポリカーボネート: "ポリカーボネート",
      ceramic: "セラミック",
      セラミック: "セラミック",
      titanium: "チタン",
      チタン: "チタン",
      carbonfiber: "カーボンファイバー",
      カーボンファイバー: "カーボンファイバー",
      electronics: "電子機器",
      電子機器: "電子機器",
      printerfilament: "プリンターフィラメント",
      filament: "プリンターフィラメント",
      プリンターフィラメント: "プリンターフィラメント",
      fieldrecondata: "フィールド偵察データ",
      recondata: "フィールド偵察データ",
      recon: "フィールド偵察データ",
      フィールド偵察データ: "フィールド偵察データ",
      shdcalibration: "SHDカリブレーション",
      shd: "SHDカリブレーション",
      shdカリブレーション: "SHDカリブレーション",
      exoticcomponent: "エキゾチック部品",
      exoticcomponents: "エキゾチック部品",
      exotic: "エキゾチック部品",
      エキゾチック部品: "エキゾチック部品",
    };
    return alias[k] || raw;
  }

  function isSpacerKey(key) {
    const k = String(key || "").trim();
    if (!k) return true;
    if (k === "sheet_row_1based") return true;
    return /^col_\d+$/i.test(k);
  }

  function buildUniqueKeysFromHeaders(rawHeaders) {
    const src = Array.isArray(rawHeaders) ? rawHeaders : [];
    const out = [];
    const seen = new Map();
    src.forEach((h, i) => {
      const base = String(h || "").trim() || `col_${i + 1}`;
      const sigRaw = normalizeKey(base);
      const sig = sigRaw || `label::${base}`;
      const next = (seen.get(sig) || 0) + 1;
      seen.set(sig, next);
      out.push(next === 1 ? base : `${base}_${next}`);
    });
    return out;
  }

  function findTableBlocks(uniqueKeys) {
    const h = Array.isArray(uniqueKeys) ? uniqueKeys : [];
    if (!h.length) return [];

    const defs = [
      { id: "weapon", cols: ["グレード", "レシーバー部品", "スチール", "チタン", "フィールド偵察データ", "SHDカリブレーション", "エキゾチック部品"] },
      { id: "gear", cols: ["グレード", "保護布", "ポリカーボネート", "カーボンファイバー", "フィールド偵察データ", "SHDカリブレーション", "エキゾチック部品"] },
      { id: "skill", cols: ["グレード", "セラミック", "電子機器", "プリンターフィラメント", "フィールド偵察データ", "SHDカリブレーション", "エキゾチック部品"] },
    ];

    // label -> available header keys (kept in original order)
    const byLabel = new Map();
    h.forEach((key) => {
      if (isSpacerKey(key)) return;
      const label = canonicalMaterialLabel(key);
      if (!label) return;
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label).push(key);
    });

    // Shared labels appear 3 times. Allocate them by table index (0/1/2) deterministically.
    const sharedLabels = new Set(["グレード", "フィールド偵察データ", "SHDカリブレーション", "エキゾチック部品"]);
    const blocks = [];
    for (let tableIndex = 0; tableIndex < defs.length; tableIndex += 1) {
      const def = defs[tableIndex];
      const cols = [];
      let ok = true;
      def.cols.forEach((label) => {
        const pool = byLabel.get(label) || [];
        let key = "";
        if (sharedLabels.has(label)) {
          key = String(pool[tableIndex] || "");
        } else {
          key = String(pool[0] || "");
        }
        if (!key) {
          ok = false;
          return;
        }
        cols.push({ key, label, tier: materialTier(label) });
      });
      if (!ok) return [];
      blocks.push(cols);
    }
    return blocks;
  }

  function headerLabel(labelJa) {
    return materialLabel(labelJa, false);
  }

  function isNarrowViewport() {
    try {
      return !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
    } catch (_e) {
      return false;
    }
  }

  function materialLabel(labelJa, shortMode) {
    const isJa = langSelect && langSelect.value === "ja";
    const label = canonicalMaterialLabel(labelJa);
    const mapJaFull = {
      "グレード": "グレード",
      "レシーバー部品": "レシーバー部品",
      "スチール": "スチール",
      "チタン": "チタン",
      "フィールド偵察データ": "フィールド偵察データ",
      "SHDカリブレーション": "SHDカリブレーション",
      "エキゾチック部品": "エキゾチック部品",
      "保護布": "保護布",
      "ポリカーボネート": "ポリカーボネート",
      "カーボンファイバー": "カーボンファイバー",
      "セラミック": "セラミック",
      "電子機器": "電子機器",
      "プリンターフィラメント": "プリンターフィラメント",
    };
    const mapJa = {
      "グレード": "GR",
      "レシーバー部品": "レシーバー",
      "スチール": "スチール",
      "チタン": "チタン",
      "フィールド偵察データ": "偵察データ",
      "SHDカリブレーション": "SHD",
      "エキゾチック部品": "エキゾ",
      "保護布": "保護布",
      "ポリカーボネート": "ポリカ",
      "カーボンファイバー": "カーボン",
      "セラミック": "セラミック",
      "電子機器": "電子機器",
      "プリンターフィラメント": "フィラメント",
    };
    const mapEnFull = {
      "グレード": "Grade",
      "レシーバー部品": "Receiver Components",
      "スチール": "Steel",
      "チタン": "Titanium",
      "フィールド偵察データ": "Field Recon Data",
      "SHDカリブレーション": "SHD Calibration",
      "エキゾチック部品": "Exotic Components",
      "保護布": "Protective Fabric",
      "ポリカーボネート": "Polycarbonate",
      "カーボンファイバー": "Carbon Fiber",
      "セラミック": "Ceramics",
      "電子機器": "Electronics",
      "プリンターフィラメント": "Printer Filament",
    };
    const mapEn = {
      "グレード": "GR",
      "レシーバー部品": "Receiver",
      "スチール": "Steel",
      "チタン": "Titanium",
      "フィールド偵察データ": "Recon",
      "SHDカリブレーション": "SHD",
      "エキゾチック部品": "Exotic",
      "保護布": "Fabric",
      "ポリカーボネート": "Poly",
      "カーボンファイバー": "Carbon",
      "セラミック": "Ceramic",
      "電子機器": "Electronics",
      "プリンターフィラメント": "Filament",
    };
    const map = shortMode ? (isJa ? mapJa : mapEn) : (isJa ? mapJaFull : mapEnFull);
    return map[label] || label;
  }

  function materialTier(labelJa) {
    const k = canonicalMaterialLabel(labelJa);
    if (k === "レシーバー部品" || k === "保護布") return "neutral";
    if (k === "スチール" || k === "ポリカーボネート" || k === "セラミック") return "normal";
    if (k === "チタン" || k === "カーボンファイバー" || k === "電子機器") return "uncommon";
    if (k === "プリンターフィラメント") return "rare";
    if (k === "フィールド偵察データ" || k === "SHDカリブレーション") return "highend";
    if (k === "エキゾチック部品") return "exotic";
    if (k === "グレード") return "grade";
    return "neutral";
  }

  function tableTitle(idx) {
    const isJa = langSelect && langSelect.value === "ja";
    const ja = ["武器", "ギア", "スキル"];
    const en = ["Weapon", "Gear", "Skill"];
    return isJa ? (ja[idx] || `表${idx + 1}`) : (en[idx] || `Table ${idx + 1}`);
  }

  function compactDefs() {
    return [
      {
        id: "weapon",
        titleJa: "武器",
        titleEn: "Weapon",
        columns: [
          { key: "grade", label: "グレード" },
          { key: "receiver_components", label: "レシーバー部品" },
          { key: "steel", label: "スチール" },
          { key: "titanium", label: "チタン" },
          { key: "field_recon_data", label: "フィールド偵察データ" },
          { key: "shd_calibration", label: "SHDカリブレーション" },
          { key: "exotic_components", label: "エキゾチック部品" },
        ]
      },
      {
        id: "gear",
        titleJa: "ギア",
        titleEn: "Gear",
        columns: [
          { key: "grade", label: "グレード" },
          { key: "protective_fabric", label: "保護布" },
          { key: "polycarbonate", label: "ポリカーボネート" },
          { key: "carbon_fiber", label: "カーボンファイバー" },
          { key: "field_recon_data", label: "フィールド偵察データ" },
          { key: "shd_calibration", label: "SHDカリブレーション" },
          { key: "exotic_components", label: "エキゾチック部品" },
        ]
      },
      {
        id: "skill",
        titleJa: "スキル",
        titleEn: "Skill",
        columns: [
          { key: "grade", label: "グレード" },
          { key: "ceramics", label: "セラミック" },
          { key: "electronics", label: "電子機器" },
          { key: "printer_filament", label: "プリンターフィラメント" },
          { key: "field_recon_data", label: "フィールド偵察データ" },
          { key: "shd_calibration", label: "SHDカリブレーション" },
          { key: "exotic_components", label: "エキゾチック部品" },
        ]
      },
    ];
  }

  function uiText(key) {
    const isJa = langSelect && langSelect.value === "ja";
    const ja = {
      from: "From",
      to: "To",
      total: "累計",
      category: "カテゴリ"
    };
    const en = {
      from: "From",
      to: "To",
      total: "Total",
      category: "Category"
    };
    const dict = isJa ? ja : en;
    return dict[key] || key;
  }

  function parseNum(raw) {
    const s = String(raw == null ? "" : raw).trim().replace(/,/g, "");
    if (!s) return NaN;
    const n = Number.parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  }

  function formatNum(n) {
    if (!Number.isFinite(n)) return "";
    if (Number.isInteger(n)) return String(n);
    return String(Number(n.toFixed(2)));
  }

  function computeTotals(rows, cols, fromGrade, toGrade) {
    const totals = new Map();
    cols.forEach((c, idx) => {
      if (idx === 0) return; // skip Grade column
      totals.set(c.key, 0);
    });
    rows.forEach((row) => {
      const g = parseNum(cellValue(row, cols[0].key));
      if (!Number.isFinite(g)) return;
      if (!(g > fromGrade && g <= toGrade)) return;
      cols.forEach((c, idx) => {
        if (idx === 0) return;
        const v = parseNum(cellValue(row, c.key));
        if (!Number.isFinite(v)) return;
        totals.set(c.key, (totals.get(c.key) || 0) + v);
      });
    });
    return totals;
  }

  function cellValue(row, key) {
    if (!row || typeof row !== "object") return "";
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    const base = stripHeaderSuffix(key);
    if (Object.prototype.hasOwnProperty.call(row, base)) return row[base];
    return "";
  }

  function renderGradeCost(payload) {
    clearContent();
    const defs = compactDefs();
    const hasCompact = !!(payload && defs.some((d) => Array.isArray(payload[d.id])));
    const explicitTables = hasCompact
      ? defs.map((d) => ({
        id: d.id,
        title_ja: d.titleJa,
        title_en: d.titleEn,
        columns: d.columns.map((c) => ({ key: c.key, label_ja: c.label })),
        rows: Array.isArray(payload[d.id]) ? payload[d.id] : []
      }))
      : ((payload && Array.isArray(payload.grade_cost_tables)) ? payload.grade_cost_tables : []);
    const rawRows = (payload && Array.isArray(payload.items)) ? payload.items : [];
    const rawHeaders = (payload && payload.meta && Array.isArray(payload.meta.header_columns))
      ? payload.meta.header_columns
      : [];
    if (!rawRows.length && !explicitTables.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }
    let blocks = [];
    let tableRowsByIdx = [];
    if (explicitTables.length) {
      blocks = explicitTables.map((t) => {
        const cols = Array.isArray(t.columns) ? t.columns : [];
        return cols.map((c) => {
          const label = canonicalMaterialLabel(c.label_ja || c.label || c.key || "");
          return { key: String(c.key || "").trim(), label, tier: materialTier(label) };
        }).filter((c) => c.key && c.label);
      }).filter((x) => x.length);
      tableRowsByIdx = explicitTables.map((t) => (Array.isArray(t.rows) ? t.rows : []));
    } else {
      const dedupedHeaderKeys = buildUniqueKeysFromHeaders(rawHeaders);
      blocks = findTableBlocks(dedupedHeaderKeys);
      tableRowsByIdx = blocks.map(() => rawRows);
    }
    if (!blocks.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("dataUnavailable"))}</div>`;
      return;
    }

    const titles = explicitTables.length
      ? explicitTables.map((t, idx) => {
        const isJa = langSelect && langSelect.value === "ja";
        return String(isJa ? (t.title_ja || "") : (t.title_en || "")) || tableTitle(idx);
      })
      : blocks.map((_, idx) => tableTitle(idx));

    const panelHtmlList = blocks.map((cols, idx) => {
      const rows = tableRowsByIdx[idx] || [];
      const validGrades = rows
        .map((r) => parseNum(cellValue(r, cols[0].key)))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b);
      const gradeSet = new Set(validGrades.map((g) => String(g)));
      gradeSet.add("0");
      const gradeList = Array.from(gradeSet).map((s) => Number.parseInt(s, 10)).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      const minGrade = validGrades.length ? validGrades[0] : 1;
      const maxGrade = validGrades.length ? validGrades[validGrades.length - 1] : 30;
      const fromDefault = 0;
      const toDefault = maxGrade;
      const shortHeader = isNarrowViewport();
      const headHtml = cols.map((c) => `<th class="grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}">${escapeHtml(materialLabel(c.label, shortHeader))}</th>`).join("");
      const bodyHtml = rows.map((row) => {
        const firstVal = String((cellValue(row, cols[0].key) != null) ? cellValue(row, cols[0].key) : "").trim();
        const hasAny = cols.some((c) => String((cellValue(row, c.key) != null) ? cellValue(row, c.key) : "").trim() !== "");
        if (!hasAny || !firstVal) return "";
        const tds = cols.map((c) => `<td class="grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}">${escapeHtml(String((cellValue(row, c.key) != null) ? cellValue(row, c.key) : ""))}</td>`).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      const gradeOptions = gradeList
        .map((g) => `<option value="${escapeHtml(String(g))}"${g === fromDefault ? " selected" : ""}>${escapeHtml(String(g))}</option>`)
        .join("");
      const gradeOptionsTo = gradeList
        .map((g) => `<option value="${escapeHtml(String(g))}"${g === toDefault ? " selected" : ""}>${escapeHtml(String(g))}</option>`)
        .join("");
      const totalCols = cols.slice(1).map((c) => `<span class="grade-cost-total-chip grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}" data-total-key="${escapeHtml(c.key)}">${escapeHtml(materialLabel(c.label, false))}: 0</span>`).join("");
      return `
        <section class="grade-cost-table" data-grade-cost-table="${idx}"${idx === 0 ? "" : " hidden"}>
          <h3 class="grade-cost-table__title">${escapeHtml(titles[idx] || tableTitle(idx))}</h3>
          <div class="grade-cost-calc">
            <label class="grade-cost-calc__field">${escapeHtml(uiText("from"))}
              <select class="grade-cost-calc__select" data-grade-from>${gradeOptions}</select>
            </label>
            <label class="grade-cost-calc__field">${escapeHtml(uiText("to"))}
              <select class="grade-cost-calc__select" data-grade-to>${gradeOptionsTo}</select>
            </label>
            <div class="grade-cost-total" data-grade-total>${totalCols}</div>
          </div>
          <div class="grade-cost-table__wrap">
            <table class="grade-cost-table__grid">
              <thead><tr>${headHtml}</tr></thead>
              <tbody>${bodyHtml}</tbody>
            </table>
          </div>
        </section>
      `;
    });
    const optionsHtml = blocks
      .map((_, idx) => `<option value="${idx}">${escapeHtml(titles[idx] || tableTitle(idx))}</option>`)
      .join("");

    contentEl.innerHTML = `
      <div class="grade-cost-view">
        <div class="grade-cost-switch">
          <label class="grade-cost-switch__label">${escapeHtml(uiText("category"))}</label>
          <select class="grade-cost-switch__select" data-grade-cost-switch>
            ${optionsHtml}
          </select>
        </div>
        ${panelHtmlList.join("")}
      </div>
    `;

    const tables = Array.from(contentEl.querySelectorAll("[data-grade-cost-table]"));
    tables.forEach((tableEl, idx) => {
      const cols = blocks[idx] || [];
      const rows = tableRowsByIdx[idx] || [];
      if (!cols.length) return;
      const fromEl = tableEl.querySelector("[data-grade-from]");
      const toEl = tableEl.querySelector("[data-grade-to]");
      const totalEl = tableEl.querySelector("[data-grade-total]");
      if (!fromEl || !toEl || !totalEl) return;
      const refreshTotals = () => {
        let fromGrade = parseNum(fromEl.value);
        let toGrade = parseNum(toEl.value);
        if (!Number.isFinite(fromGrade)) fromGrade = 1;
        if (!Number.isFinite(toGrade)) toGrade = fromGrade;
        if (toGrade < fromGrade) {
          const tmp = toGrade;
          toGrade = fromGrade;
          fromGrade = tmp;
        }
        const totals = computeTotals(rows, cols, fromGrade, toGrade);
        cols.slice(1).forEach((c) => {
          const chips = Array.from(totalEl.querySelectorAll("[data-total-key]"));
          const chip = chips.find((x) => String(x.getAttribute("data-total-key") || "") === c.key);
          if (!chip) return;
          chip.textContent = `${materialLabel(c.label, false)}: ${formatNum(totals.get(c.key) || 0)}`;
        });
      };
      fromEl.addEventListener("change", refreshTotals);
      toEl.addEventListener("change", refreshTotals);
      refreshTotals();
    });

    const switchEl = contentEl.querySelector("[data-grade-cost-switch]");
    if (switchEl) {
      switchEl.addEventListener("change", () => {
        const active = Number.parseInt(String(switchEl.value || "0"), 10) || 0;
        tables.forEach((el, i) => {
          if (i === active) el.removeAttribute("hidden");
          else el.setAttribute("hidden", "hidden");
        });
      });
    }
  }

  async function gradeCostViewRender() {
    const payload = await fetchGradeCostData();
    renderGradeCost(payload);
  }

  window.gradeCostViewRender = gradeCostViewRender;
})();
