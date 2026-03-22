/* cost specific view logic */
(function () {
  let costCache = null;

  async function fetchCostData() {
    if (costCache) return costCache;
    const SQL = await initSql();
    const v = (window.indexJson && window.indexJson.built_at) ? `?v=${encodeURIComponent(window.indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const readPayload = (table) => {
        const hasTable = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}'`).length > 0;
        if (!hasTable) return {};
        const stmt = db.prepare(`SELECT payload FROM ${table} ORDER BY row_id DESC LIMIT 1`);
        let out = {};
        if (stmt.step()) {
          const rec = stmt.getAsObject() || {};
          const raw = String(rec.payload || "").trim();
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === "object") out = parsed;
            } catch (_e) {
              out = {};
            }
          }
        }
        stmt.free();
        return out;
      };
      costCache = {
        grade: readPayload("items_grade_cost"),
        optimization: readPayload("items_optimization_cost"),
      };
      return costCache;
    } finally {
      db.close();
    }
  }

  function canonicalMaterialLabel(label) {
    const raw = String(label || "").trim();
    const k = normalizeKey(raw);
    const alias = {
      grade: "グレード",
      receivercomponents: "レシーバー部品",
      protectivefabric: "保護布",
      steel: "スチール",
      polycarbonate: "ポリカーボネート",
      ceramics: "セラミック",
      titanium: "チタン",
      carbonfiber: "カーボンファイバー",
      electronics: "電子機器",
      printerfilament: "プリンターフィラメント",
      fieldrecondata: "フィールド偵察データ",
      shdcalibration: "SHDカリブレーション",
      exoticcomponents: "エキゾチック部品",
      alloyweave: "合金/ウィーブ",
      tacticalassessment: "戦術評価",
    };
    return alias[k] || raw;
  }

  function materialLabel(labelJa, shortMode) {
    const isJa = langSelect && langSelect.value === "ja";
    const label = canonicalMaterialLabel(labelJa);
    const bundleTranslated = translateBundleLabel(label, isJa);
    if (bundleTranslated) {
      return bundleTranslated;
    }
    const mapJaFull = {
      "グレード": "グレード",
      "レシーバー部品": "レシーバー部品",
      "保護布": "保護布",
      "スチール": "スチール",
      "ポリカーボネート": "ポリカーボネート",
      "セラミック": "セラミック",
      "チタン": "チタン",
      "カーボンファイバー": "カーボンファイバー",
      "電子機器": "電子機器",
      "プリンターフィラメント": "プリンターフィラメント",
      "フィールド偵察データ": "フィールド偵察データ",
      "SHDカリブレーション": "SHDカリブレーション",
      "エキゾチック部品": "エキゾチック部品",
      "合金/ウィーブ": "合金/ウィーブ",
      "戦術評価": "戦術評価",
    };
    const mapEnFull = {
      "グレード": "Grade",
      "レシーバー部品": "Receiver Components",
      "保護布": "Protective Fabric",
      "スチール": "Steel",
      "ポリカーボネート": "Polycarbonate",
      "セラミック": "Ceramics",
      "チタン": "Titanium",
      "カーボンファイバー": "Carbon Fiber",
      "電子機器": "Electronics",
      "プリンターフィラメント": "Printer Filament",
      "フィールド偵察データ": "Field Recon Data",
      "SHDカリブレーション": "SHD Calibration",
      "エキゾチック部品": "Exotic Components",
      "合金/ウィーブ": "Alloy/Weave",
      "戦術評価": "Tactical Assessment",
    };
    const mapJa = {
      "グレード": "GR",
      "レシーバー部品": "レシーバー",
      "保護布": "保護布",
      "スチール": "スチール",
      "ポリカーボネート": "ポリカ",
      "セラミック": "セラミック",
      "チタン": "チタン",
      "カーボンファイバー": "カーボン",
      "電子機器": "電子機器",
      "プリンターフィラメント": "フィラメント",
      "フィールド偵察データ": "偵察データ",
      "SHDカリブレーション": "SHD",
      "エキゾチック部品": "エキゾ",
      "合金/ウィーブ": "合金",
      "戦術評価": "戦術評価",
    };
    const mapEn = {
      "グレード": "GR",
      "レシーバー部品": "Receiver",
      "保護布": "Fabric",
      "スチール": "Steel",
      "ポリカーボネート": "Poly",
      "セラミック": "Ceramic",
      "チタン": "Titanium",
      "カーボンファイバー": "Carbon",
      "電子機器": "Electronics",
      "プリンターフィラメント": "Filament",
      "フィールド偵察データ": "Recon",
      "SHDカリブレーション": "SHD",
      "エキゾチック部品": "Exotic",
      "合金/ウィーブ": "Alloy",
      "戦術評価": "Tactical",
    };
    const map = shortMode ? (isJa ? mapJa : mapEn) : (isJa ? mapJaFull : mapEnFull);
    return map[label] || label;
  }

  function translateBundleLabel(label, isJa) {
    const s = String(label || "").trim();
    if (!s) return "";
    if (isJa) return s;

    const alloyMap = {
      LMG: "LMG",
      SMG: "SMG",
      "アサルトライフル": "Assault Rifle",
      "ショットガン": "Shotgun",
      "ピストル": "Pistol",
      "マークスマンライフル": "Marksman Rifle",
      "ライフル": "Rifle",
    };
    const weaveMap = {
      "グローブ": "Gloves",
      "ニーパッド": "Kneepads",
      "バックパック": "Backpack",
      "ホルスター": "Holster",
      "ボディアーマー": "Chest",
      "マスク": "Mask",
      "マウス": "Mask",
    };
    const factionMap = {
      "アウトキャスト": "Outcasts",
      "クリーナーズ": "Cleaners",
      "トゥルーサンズ": "True Sons",
      "ハイエナ": "Hyenas",
      "ブラックタスク": "Black Tusk",
      "ライカーズ": "Rikers",
    };

    if (s.endsWith("合金バンドル")) {
      const prefix = s.slice(0, -("合金バンドル".length)).trim();
      const head = alloyMap[prefix] || prefix;
      return `${head} Alloy`;
    }
    if (s.endsWith("ウィーブバンドル")) {
      const prefix = s.slice(0, -("ウィーブバンドル".length)).trim();
      const head = weaveMap[prefix] || prefix;
      return `${head} Weave`;
    }
    if (s.endsWith("戦術評価バンドル")) {
      const prefix = s.slice(0, -("戦術評価バンドル".length)).trim();
      const head = factionMap[prefix] || prefix;
      return `${head} Tactical Assessment`;
    }
    return "";
  }

  function materialTier(labelJa) {
    const k = canonicalMaterialLabel(labelJa);
    const raw = String(labelJa || "");
    if (k === "グレード") return "grade";
    if (k === "エキゾチック部品") return "exotic";
    if (raw.includes("合金バンドル") || raw.includes("ウィーブバンドル")) return "highend";
    if (/\bAlloy\b/.test(raw) || /\bWeave\b/.test(raw)) return "highend";
    if (k === "フィールド偵察データ" || k === "SHDカリブレーション" || k === "戦術評価") return "highend";
    if (raw.includes("戦術評価")) return "highend";
    if (raw.includes("フィールド偵察データ")) return "highend";
    if (raw.includes("SHDカリブレーション")) return "highend";
    if (k === "チタン" || k === "カーボンファイバー" || k === "電子機器") return "uncommon";
    if (k === "プリンターフィラメント") return "rare";
    return "neutral";
  }

  function uiText(key) {
    const isJa = langSelect && langSelect.value === "ja";
    const ja = { from: "From", to: "To", category: "カテゴリ" };
    const en = { from: "From", to: "To", category: "Category" };
    return (isJa ? ja : en)[key] || key;
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

  function cellValue(row, key) {
    if (!row || typeof row !== "object") return "";
    if (Object.prototype.hasOwnProperty.call(row, key)) return row[key];
    return "";
  }

  function computeTotals(rows, cols, fromGrade, toGrade) {
    const totals = new Map();
    cols.forEach((c, idx) => { if (idx > 0) totals.set(c.key, 0); });
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

  function detectOptimizationMaterialType(label) {
    const s = String(label || "").trim();
    if (!s) return "";
    const n = normalizeKey(s);
    if (s.includes("合金/ウィーブ") || n === "alloyweave") return "alloy_or_weave";
    if (s.includes("戦術評価") || n === "tacticalassessment") return "tactical";
    if (s.includes("フィールド偵察データ") || n === "fieldrecondata") return "recon";
    if (s.includes("SHDカリブレーション") || n === "shdcalibration") return "shd";
    return "";
  }

  function collectOptimizationRowsByType(optRows) {
    const out = {
      alloy_or_weave: null,
      tactical: null,
      recon: null,
      shd: null,
    };
    (Array.isArray(optRows) ? optRows : []).forEach((r) => {
      const t = detectOptimizationMaterialType(r && r.material);
      if (t && !out[t]) out[t] = r;
    });
    return out;
  }

  function collectOptimizationLevels(typeRows) {
    const levels = new Set();
    Object.values(typeRows || {}).forEach((row) => {
      if (!row || typeof row !== "object") return;
      Object.keys(row).forEach((k) => {
        const mm = /^lv(\d+)$/.exec(String(k || "").toLowerCase());
        if (!mm) return;
        const lv = Number.parseInt(mm[1], 10);
        if (Number.isFinite(lv)) levels.add(lv);
      });
    });
    return Array.from(levels).sort((a, b) => a - b);
  }

  function buildOptimizationVariantRows(typeRows, levelList, primaryType, primaryLabel, tacticalLabel) {
    return levelList.map((lv) => {
      const levelKey = `lv${lv}`;
      return {
        grade: lv,
        primary_bundle: typeRows[primaryType] ? typeRows[primaryType][levelKey] : "",
        tactical_bundle: typeRows.tactical ? typeRows.tactical[levelKey] : "",
        field_recon_data: typeRows.recon ? typeRows.recon[levelKey] : "",
        shd_calibration: typeRows.shd ? typeRows.shd[levelKey] : "",
        _primary_label: primaryLabel,
        _tactical_label: tacticalLabel,
      };
    });
  }

  function buildOptimizationVariantCategory(id, titleJa, titleEn, rows) {
    const first = (Array.isArray(rows) && rows.length) ? rows[0] : {};
    const primaryLabel = String((first && first._primary_label) || "素材バンドル");
    const tacticalLabel = String((first && first._tactical_label) || "戦術評価バンドル");
    return {
      id,
      titleJa,
      titleEn,
      columns: [
        { key: "grade", label: "LV" },
        { key: "primary_bundle", label: primaryLabel },
        { key: "tactical_bundle", label: tacticalLabel },
        { key: "field_recon_data", label: "フィールド偵察データ" },
        { key: "shd_calibration", label: "SHDカリブレーション" },
      ],
      rows: (rows || []).map((r) => {
        const x = Object.assign({}, r);
        delete x._primary_label;
        delete x._tactical_label;
        return x;
      }),
    };
  }

  function buildCategories(payload) {
    const grade = payload && payload.grade ? payload.grade : {};
    const optimization = payload && payload.optimization ? payload.optimization : {};

    const defs = [
      {
        id: "weapon_grade",
        titleJa: "武器 Grade",
        titleEn: "Weapon Grade",
        columns: [
          { key: "grade", label: "グレード" },
          { key: "receiver_components", label: "レシーバー部品" },
          { key: "steel", label: "スチール" },
          { key: "titanium", label: "チタン" },
          { key: "field_recon_data", label: "フィールド偵察データ" },
          { key: "shd_calibration", label: "SHDカリブレーション" },
          { key: "exotic_components", label: "エキゾチック部品" },
        ],
        rows: Array.isArray(grade.weapon) ? grade.weapon : [],
      },
      {
        id: "gear_grade",
        titleJa: "ギア Grade",
        titleEn: "Gear Grade",
        columns: [
          { key: "grade", label: "グレード" },
          { key: "protective_fabric", label: "保護布" },
          { key: "polycarbonate", label: "ポリカーボネート" },
          { key: "carbon_fiber", label: "カーボンファイバー" },
          { key: "field_recon_data", label: "フィールド偵察データ" },
          { key: "shd_calibration", label: "SHDカリブレーション" },
          { key: "exotic_components", label: "エキゾチック部品" },
        ],
        rows: Array.isArray(grade.gear) ? grade.gear : [],
      },
      {
        id: "skill_grade",
        titleJa: "スキル Grade",
        titleEn: "Skill Grade",
        columns: [
          { key: "grade", label: "グレード" },
          { key: "ceramics", label: "セラミック" },
          { key: "electronics", label: "電子機器" },
          { key: "printer_filament", label: "プリンターフィラメント" },
          { key: "field_recon_data", label: "フィールド偵察データ" },
          { key: "shd_calibration", label: "SHDカリブレーション" },
          { key: "exotic_components", label: "エキゾチック部品" },
        ],
        rows: Array.isArray(grade.skill) ? grade.skill : [],
      },
    ];

    const typeRows = collectOptimizationRowsByType(optimization.rows);
    const levelList = collectOptimizationLevels(typeRows);
    const weaponDefs = [
      { key: "lmg", titleJa: "武器最適化: LMG", titleEn: "Weapon Optimization: LMG", primaryLabel: "LMG合金バンドル", tacticalLabel: "アウトキャスト戦術評価バンドル" },
      { key: "smg", titleJa: "武器最適化: SMG", titleEn: "Weapon Optimization: SMG", primaryLabel: "SMG合金バンドル", tacticalLabel: "ハイエナ戦術評価バンドル" },
      { key: "ar", titleJa: "武器最適化: アサルトライフル", titleEn: "Weapon Optimization: Assault Rifle", primaryLabel: "アサルトライフル合金バンドル", tacticalLabel: "トゥルーサンズ戦術評価バンドル" },
      { key: "shotgun", titleJa: "武器最適化: ショットガン", titleEn: "Weapon Optimization: Shotgun", primaryLabel: "ショットガン合金バンドル", tacticalLabel: "ライカーズ戦術評価バンドル" },
      { key: "pistol", titleJa: "武器最適化: ピストル", titleEn: "Weapon Optimization: Pistol", primaryLabel: "ピストル合金バンドル", tacticalLabel: "ブラックタスク戦術評価バンドル" },
      { key: "mmr", titleJa: "武器最適化: マークスマンライフル", titleEn: "Weapon Optimization: Marksman Rifle", primaryLabel: "マークスマンライフル合金バンドル", tacticalLabel: "クリーナーズ戦術評価バンドル" },
      { key: "rifle", titleJa: "武器最適化: ライフル", titleEn: "Weapon Optimization: Rifle", primaryLabel: "ライフル合金バンドル", tacticalLabel: "ブラックタスク戦術評価バンドル" },
    ];
    const gearDefs = [
      { key: "gloves", titleJa: "ギア最適化: グローブ", titleEn: "Gear Optimization: Gloves", primaryLabel: "グローブウィーブバンドル", tacticalLabel: "クリーナーズ戦術評価バンドル" },
      { key: "kneepads", titleJa: "ギア最適化: ニーパッド", titleEn: "Gear Optimization: Kneepads", primaryLabel: "ニーパッドウィーブバンドル", tacticalLabel: "アウトキャスト戦術評価バンドル" },
      { key: "backpack", titleJa: "ギア最適化: バックパック", titleEn: "Gear Optimization: Backpack", primaryLabel: "バックパックウィーブバンドル", tacticalLabel: "トゥルーサンズ戦術評価バンドル" },
      { key: "holster", titleJa: "ギア最適化: ホルスター", titleEn: "Gear Optimization: Holster", primaryLabel: "ホルスターウィーブバンドル", tacticalLabel: "ライカーズ戦術評価バンドル" },
      { key: "chest", titleJa: "ギア最適化: ボディアーマー", titleEn: "Gear Optimization: Body Armor", primaryLabel: "ボディアーマーウィーブバンドル", tacticalLabel: "ブラックタスク戦術評価バンドル" },
      { key: "mask", titleJa: "ギア最適化: マスク", titleEn: "Gear Optimization: Mask", primaryLabel: "マスクウィーブバンドル", tacticalLabel: "ハイエナ戦術評価バンドル" },
    ];

    gearDefs.forEach((g) => {
      defs.push(
        buildOptimizationVariantCategory(
          `optimization_gear_${g.key}`,
          g.titleJa,
          g.titleEn,
          buildOptimizationVariantRows(typeRows, levelList, "alloy_or_weave", g.primaryLabel, g.tacticalLabel)
        )
      );
    });
    weaponDefs.forEach((w) => {
      defs.push(
        buildOptimizationVariantCategory(
          `optimization_weapon_${w.key}`,
          w.titleJa,
          w.titleEn,
          buildOptimizationVariantRows(typeRows, levelList, "alloy_or_weave", w.primaryLabel, w.tacticalLabel)
        )
      );
    });
    return defs;
  }

  function renderCost(payload) {
    clearContent();
    const categories = buildCategories(payload).filter((c) => Array.isArray(c.columns) && c.columns.length > 1);
    const hasAnyRows = categories.some((c) => Array.isArray(c.rows) && c.rows.length > 0);
    if (!categories.length || !hasAnyRows) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }
    const isJa = langSelect && langSelect.value === "ja";
    const shortHeader = !!(window.matchMedia && window.matchMedia("(max-width: 768px)").matches);
    const optionsHtml = categories.map((c, idx) => `<option value="${idx}">${escapeHtml(isJa ? c.titleJa : c.titleEn)}</option>`).join("");
    const panelHtmlList = categories.map((cat, idx) => {
      const cols = cat.columns.map((c) => ({ key: c.key, label: canonicalMaterialLabel(c.label), tier: materialTier(c.label) }));
      const rows = cat.rows || [];
      const validGrades = rows.map((r) => parseNum(cellValue(r, cols[0].key))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      const maxGrade = validGrades.length ? validGrades[validGrades.length - 1] : 10;
      const gradeList = [0].concat(validGrades);
      const uniqueGradeList = Array.from(new Set(gradeList)).sort((a, b) => a - b);
      const headHtml = cols.map((c) => `<th class="grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}">${escapeHtml(materialLabel(c.label, shortHeader))}</th>`).join("");
      const bodyHtml = rows.map((row) => {
        const tds = cols.map((c) => `<td class="grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}">${escapeHtml(String((cellValue(row, c.key) != null) ? cellValue(row, c.key) : ""))}</td>`).join("");
        return `<tr>${tds}</tr>`;
      }).join("");
      const gradeOptionsFrom = uniqueGradeList.map((g) => `<option value="${g}"${g === 0 ? " selected" : ""}>${g}</option>`).join("");
      const gradeOptionsTo = uniqueGradeList.map((g) => `<option value="${g}"${g === maxGrade ? " selected" : ""}>${g}</option>`).join("");
      const totalCols = cols.slice(1).map((c) => `<span class="grade-cost-total-chip grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}" data-total-key="${escapeHtml(c.key)}">${escapeHtml(materialLabel(c.label, false))}: 0</span>`).join("");
      return `
        <section class="grade-cost-table" data-cost-table="${idx}"${idx === 0 ? "" : " hidden"}>
          <h3 class="grade-cost-table__title">${escapeHtml(isJa ? cat.titleJa : cat.titleEn)}</h3>
          <div class="grade-cost-calc">
            <label class="grade-cost-calc__field">${escapeHtml(uiText("from"))}
              <select class="grade-cost-calc__select" data-cost-from>${gradeOptionsFrom}</select>
            </label>
            <label class="grade-cost-calc__field">${escapeHtml(uiText("to"))}
              <select class="grade-cost-calc__select" data-cost-to>${gradeOptionsTo}</select>
            </label>
            <div class="grade-cost-total" data-cost-total>${totalCols}</div>
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

    contentEl.innerHTML = `
      <div class="grade-cost-view">
        <div class="grade-cost-switch">
          <label class="grade-cost-switch__label">${escapeHtml(uiText("category"))}</label>
          <select class="grade-cost-switch__select" data-cost-switch>${optionsHtml}</select>
        </div>
        ${panelHtmlList.join("")}
      </div>
    `;

    const tables = Array.from(contentEl.querySelectorAll("[data-cost-table]"));
    tables.forEach((tableEl, idx) => {
      const cat = categories[idx];
      const cols = cat.columns.map((c) => ({ key: c.key, label: canonicalMaterialLabel(c.label) }));
      const rows = cat.rows || [];
      const fromEl = tableEl.querySelector("[data-cost-from]");
      const toEl = tableEl.querySelector("[data-cost-to]");
      const totalEl = tableEl.querySelector("[data-cost-total]");
      if (!fromEl || !toEl || !totalEl) return;
      const refreshTotals = () => {
        let fromGrade = parseNum(fromEl.value);
        let toGrade = parseNum(toEl.value);
        if (!Number.isFinite(fromGrade)) fromGrade = 0;
        if (!Number.isFinite(toGrade)) toGrade = fromGrade;
        if (toGrade < fromGrade) {
          const t = fromGrade;
          fromGrade = toGrade;
          toGrade = t;
        }
        const totals = computeTotals(rows, cols, fromGrade, toGrade);
        cols.slice(1).forEach((c) => {
          const chip = totalEl.querySelector(`[data-total-key="${c.key}"]`);
          if (!chip) return;
          chip.textContent = `${materialLabel(c.label, false)}: ${formatNum(totals.get(c.key) || 0)}`;
        });
      };
      fromEl.addEventListener("change", refreshTotals);
      toEl.addEventListener("change", refreshTotals);
      refreshTotals();
    });

    const switchEl = contentEl.querySelector("[data-cost-switch]");
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

  async function costViewRender() {
    const payload = await fetchCostData();
    renderCost(payload);
  }

  window.costViewRender = costViewRender;
})();
