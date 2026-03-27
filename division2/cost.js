/* cost specific view logic */
(function () {
  let costCache = null;
  let compactHeaderModeAtRender = null;
  let compactHeaderWatcherBound = false;

  function isJaLang() {
    const v1 = String((langSelect && langSelect.value) || "").trim().toLowerCase();
    const v2 = String((document && document.documentElement && document.documentElement.lang) || "").trim().toLowerCase();
    let v3 = "";
    try {
      v3 = String(localStorage.getItem("division2_lang") || "").trim().toLowerCase();
    } catch (_e) {
      v3 = "";
    }
    return v1.startsWith("ja") || v2.startsWith("ja") || v3.startsWith("ja");
  }

  function shouldUseShortHeader() {
    return isCompactHeaderMode();
  }

  function viewportWidth() {
    if (typeof window === "undefined") return 0;
    const cands = [
      Number(window.innerWidth || 0),
      Number(document && document.documentElement ? document.documentElement.clientWidth : 0),
      Number(window.visualViewport ? window.visualViewport.width : 0),
    ].filter((n) => Number.isFinite(n) && n > 0);
    if (!cands.length) return 0;
    return Math.min.apply(null, cands);
  }

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
    const isJa = isJaLang();
    const label = canonicalMaterialLabel(labelJa);
    const bundleTranslated = translateBundleLabel(label, isJa, shortMode);
    if (bundleTranslated) {
      return bundleTranslated;
    }
    const labelToKey = {
      "グレード": "grade",
      "Grade": "grade",
      Tier: "tier",
      "レシーバー部品": "receivercomponents",
      "Receiver Components": "receivercomponents",
      "保護布": "protectivefabric",
      "Protective Fabric": "protectivefabric",
      "スチール": "steel",
      Steel: "steel",
      "ポリカーボネート": "polycarbonate",
      Polycarbonate: "polycarbonate",
      "セラミック": "ceramics",
      Ceramics: "ceramics",
      Titanium: "titanium",
      "チタン": "titanium",
      "カーボンファイバー": "carbonfiber",
      "Carbon Fiber": "carbonfiber",
      "電子機器": "electronics",
      Electronics: "electronics",
      "プリンターフィラメント": "printerfilament",
      "Printer Filament": "printerfilament",
      "フィールド偵察データ": "fieldrecondata",
      "Field Recon Data": "fieldrecondata",
      "SHDカリブレーション": "shdcalibration",
      "SHD Calibration": "shdcalibration",
      "エキゾチック部品": "exoticcomponents",
      "Exotic Components": "exoticcomponents",
      "合金/ウィーブ": "alloyweave",
      "Alloy/Weave": "alloyweave",
      "戦術評価": "tacticalassessment",
      "Tactical Assessment": "tacticalassessment",
      合金: "alloyweave",
      Alloy: "alloyweave",
      "ウィーブ": "alloyweave",
      Weave: "alloyweave",
    };
    const key = labelToKey[label] || normalizeKey(label);
    const jaFullByKey = {
      grade: "グレード",
      tier: "Tier",
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
    const jaShortByKey = {
      grade: "GR",
      tier: "Tier",
      receivercomponents: "レシーバー",
      protectivefabric: "布",
      steel: "スチール",
      polycarbonate: "ポリカ",
      ceramics: "セラミック",
      titanium: "チタン",
      carbonfiber: "カーボン",
      electronics: "電子",
      printerfilament: "フィラメント",
      fieldrecondata: "偵察データ",
      shdcalibration: "SHD",
      exoticcomponents: "エキゾ部品",
      alloyweave: "合金",
      tacticalassessment: "戦術",
    };
    const enFullByKey = {
      grade: "Grade",
      tier: "Tier",
      receivercomponents: "Receiver Components",
      protectivefabric: "Protective Fabric",
      steel: "Steel",
      polycarbonate: "Polycarbonate",
      ceramics: "Ceramics",
      titanium: "Titanium",
      carbonfiber: "Carbon Fiber",
      electronics: "Electronics",
      printerfilament: "Printer Filament",
      fieldrecondata: "Field Recon Data",
      shdcalibration: "SHD Calibration",
      exoticcomponents: "Exotic Components",
      alloyweave: "Alloy/Weave",
      tacticalassessment: "Tactical Assessment",
    };
    const enShortByKey = {
      grade: "GR",
      tier: "Tier",
      receivercomponents: "Receiver",
      protectivefabric: "Fabric",
      steel: "Steel",
      polycarbonate: "Poly",
      ceramics: "Ceramic",
      titanium: "Titanium",
      carbonfiber: "Carbon",
      electronics: "Electronics",
      printerfilament: "Filament",
      fieldrecondata: "Recon",
      shdcalibration: "SHD",
      exoticcomponents: "Exotic",
      alloyweave: "Alloy",
      tacticalassessment: "Tactical",
    };
    const dict = isJa
      ? (shortMode ? jaShortByKey : jaFullByKey)
      : (shortMode ? enShortByKey : enFullByKey);
    return dict[key] || label;
  }

  function isCompactHeaderMode() {
    const w = viewportWidth();
    return w > 0 && w <= 900;
  }

  function applyHeaderLabelMode() {
    if (!contentEl) return;
    const shortHeader = shouldUseShortHeader();
    compactHeaderModeAtRender = shortHeader;
    const nodes = contentEl.querySelectorAll("th[data-label-full][data-label-short]");
    nodes.forEach((th) => {
      const full = th.getAttribute("data-label-full") || "";
      const short = th.getAttribute("data-label-short") || full;
      th.textContent = shortHeader ? short : full;
    });
  }

  function translateBundleLabel(label, isJa, shortMode) {
    const s = String(label || "").trim();
    if (!s) return "";
    if (isJa) {
      if (s.endsWith("合金バンドル")) {
        const prefix = s.slice(0, -("合金バンドル".length)).trim();
        return shortMode ? `${prefix}合金` : `${prefix}合金バンドル`;
      }
      if (s.endsWith("ウィーブバンドル")) {
        const prefix = s.slice(0, -("ウィーブバンドル".length)).trim();
        return shortMode ? `${prefix}ウィーブ` : `${prefix}ウィーブバンドル`;
      }
      if (s.endsWith("戦術評価バンドル")) {
        const prefix = s.slice(0, -("戦術評価バンドル".length)).trim();
        return shortMode ? `${prefix}戦術` : `${prefix}戦術評価バンドル`;
      }
      return "";
    }

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
      return shortMode ? `${head} Tactical` : `${head} Tactical Assessment`;
    }
    return "";
  }

  function materialTier(labelJa) {
    const k = canonicalMaterialLabel(labelJa);
    const raw = String(labelJa || "");
    if (k === "グレード") return "grade";
    if (normalizeKey(raw) === "tier") return "grade";
    if (k === "レシーバー部品" || k === "保護布") return "basic";
    if (k === "スチール" || k === "ポリカーボネート" || k === "セラミック") return "normal";
    if (k === "エキゾチック部品") return "exotic";
    if (raw.includes("合金バンドル") || raw.includes("ウィーブバンドル")) return "highend";
    if (k === "合金/ウィーブ" || k === "合金" || k === "ウィーブ") return "highend";
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
    const isJa = isJaLang();
    const ja = { from: "From", to: "To", category: "カテゴリ", y8s1: "Y8S1" };
    const en = { from: "From", to: "To", category: "Category", y8s1: "Y8S1" };
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

  function computeTotals(displayRows, rows, cols, fromGrade, toGrade) {
    const totals = new Map();
    cols.forEach((c, idx) => { if (idx > 0) totals.set(c.key, 0); });
    rows.forEach((row, ridx) => {
      const g = parseNum(cellValue(row, cols[0].key));
      if (!Number.isFinite(g)) return;
      if (!(g > fromGrade && g <= toGrade)) return;
      const drow = displayRows[ridx] || {};
      cols.forEach((c, idx) => {
        if (idx === 0) return;
        const v = parseNum(drow[c.key]);
        if (!Number.isFinite(v)) return;
        totals.set(c.key, (totals.get(c.key) || 0) + v);
      });
    });
    return totals;
  }

  function isGradeCategory(cat) {
    const id = normalizeKey(cat && cat.id);
    return id === "weapongrade" || id === "geargrade" || id === "skillgrade";
  }

  function applyY8S1Reduction(value, tier, enabled) {
    const n = Number(value);
    if (!enabled || !Number.isFinite(n)) return n;
    const t = String(tier || "").trim().toLowerCase();
    if (t === "grade") return n;
    if (t === "exotic") return n * 0.5;
    return n * 0.8;
  }

  function allocateIntegerByLargestRemainder(values) {
    const src = Array.isArray(values) ? values : [];
    const base = src.map((v) => Math.floor(v));
    const sumBase = base.reduce((a, b) => a + b, 0);
    const target = Math.round(src.reduce((a, b) => a + b, 0));
    let remain = target - sumBase;
    if (remain > 0) {
      const order = src
        .map((v, i) => ({ i, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac || a.i - b.i);
      for (let k = 0; k < order.length && remain > 0; k++) {
        base[order[k].i] += 1;
        remain -= 1;
      }
    }
    return base;
  }

  function enforceMonotoneNonDecreasing(values, orderKeys) {
    const out = Array.isArray(values) ? values.slice() : [];
    const n = out.length;
    if (!n) return out;
    const order = Array.from({ length: n }, (_, i) => i)
      .sort((a, b) => {
        const ka = Number(orderKeys && orderKeys[a]);
        const kb = Number(orderKeys && orderKeys[b]);
        const fa = Number.isFinite(ka) ? ka : Number.POSITIVE_INFINITY;
        const fb = Number.isFinite(kb) ? kb : Number.POSITIVE_INFINITY;
        return fa - fb || a - b;
      });
    for (let j = 1; j < order.length; j++) {
      const prev = order[j - 1];
      const cur = order[j];
      if (Number(out[cur]) < Number(out[prev])) out[cur] = out[prev];
    }
    return out;
  }

  function allocateIntegerMonotoneByGrade(values, grades) {
    const src = Array.isArray(values) ? values : [];
    if (!src.length) return [];
    const target = Math.round(src.reduce((a, b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0));
    let allocated = allocateIntegerByLargestRemainder(src);
    allocated = enforceMonotoneNonDecreasing(allocated, grades);

    // Keep the rounded total when possible while preserving monotone order.
    let current = allocated.reduce((a, b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0);
    if (current > target) {
      let excess = current - target;
      const n = allocated.length;
      const order = Array.from({ length: n }, (_, i) => i)
        .sort((a, b) => {
          const ga = Number(grades && grades[a]);
          const gb = Number(grades && grades[b]);
          const fa = Number.isFinite(ga) ? ga : Number.POSITIVE_INFINITY;
          const fb = Number.isFinite(gb) ? gb : Number.POSITIVE_INFINITY;
          return fa - fb || a - b;
        });
      for (let j = order.length - 1; j >= 0 && excess > 0; j--) {
        const cur = order[j];
        const minAllowed = (j > 0) ? Number(allocated[order[j - 1]]) : 0;
        const reducible = Math.max(0, Number(allocated[cur]) - minAllowed);
        if (reducible <= 0) continue;
        const dec = Math.min(reducible, excess);
        allocated[cur] = Number(allocated[cur]) - dec;
        excess -= dec;
      }
      current = allocated.reduce((a, b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0);
      if (current > target) {
        // Fallback: keep monotone result even if exact total cannot be preserved under constraints.
      }
    }
    return allocated;
  }

  function buildDisplayRows(rows, cols, useY8S1) {
    const srcRows = Array.isArray(rows) ? rows : [];
    const outRows = srcRows.map((r) => {
      const d = {};
      cols.forEach((c, cidx) => {
        const raw = (cellValue(r, c.key) != null) ? cellValue(r, c.key) : "";
        d[c.key] = (cidx === 0) ? String(raw) : raw;
      });
      return d;
    });
    cols.forEach((c, cidx) => {
      if (cidx === 0) return;
      const numericIndex = [];
      const transformed = [];
      const gradeOrder = [];
      srcRows.forEach((r, ridx) => {
        const raw = (cellValue(r, c.key) != null) ? cellValue(r, c.key) : "";
        const n = parseNum(raw);
        if (!Number.isFinite(n)) return;
        const g = parseNum(cellValue(r, cols[0] && cols[0].key));
        numericIndex.push(ridx);
        transformed.push(applyY8S1Reduction(n, c && c.tier, useY8S1));
        gradeOrder.push(Number.isFinite(g) ? g : ridx);
      });
      const allocated = allocateIntegerMonotoneByGrade(transformed, gradeOrder);
      numericIndex.forEach((ridx, i) => {
        outRows[ridx][c.key] = allocated[i];
      });
    });
    return outRows;
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
        { key: "grade", label: "Tier" },
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
    const isJa = isJaLang();
    const shortHeader = shouldUseShortHeader();
    compactHeaderModeAtRender = shortHeader;
    const tableMetaList = [];
    let y8s1Enabled = false;
    const optionsHtml = categories.map((c, idx) => `<option value="${idx}">${escapeHtml(isJa ? c.titleJa : c.titleEn)}</option>`).join("");
    const panelHtmlList = categories.map((cat, idx) => {
      const resolveCategoryLabel = (label) => {
        const base = canonicalMaterialLabel(label);
        if (base !== "合金/ウィーブ") return base;
        const id = String((cat && cat.id) || "");
        if (id.startsWith("optimization_weapon_")) return isJa ? "合金" : "Alloy";
        if (id.startsWith("optimization_gear_")) return isJa ? "ウィーブ" : "Weave";
        return base;
      };
      const cols = cat.columns.map((c) => {
        const resolvedLabel = resolveCategoryLabel(c.label);
        return { key: c.key, label: resolvedLabel, tier: materialTier(resolvedLabel) };
      });
      const rows = cat.rows || [];
      tableMetaList[idx] = { cat, cols, rows };
      const validGrades = rows.map((r) => parseNum(cellValue(r, cols[0].key))).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
      const maxGrade = validGrades.length ? validGrades[validGrades.length - 1] : 10;
      const gradeList = [0].concat(validGrades);
      const uniqueGradeList = Array.from(new Set(gradeList)).sort((a, b) => a - b);
      const headHtml = cols.map((c) => {
        const fullLabel = materialLabel(c.label, false);
        const shortLabel = materialLabel(c.label, true);
        return `<th class="grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}" data-label-full="${escapeHtml(fullLabel)}" data-label-short="${escapeHtml(shortLabel)}">${escapeHtml(shortHeader ? shortLabel : fullLabel)}</th>`;
      }).join("");
      const bodyRows = buildDisplayRows(rows, cols, false);
      const bodyHtml = bodyRows.map((drow) => {
        const tds = cols.map((c) => {
          const text = (drow[c.key] != null) ? drow[c.key] : "";
          return `<td class="grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}" data-cell-key="${escapeHtml(c.key)}">${escapeHtml(String(text))}</td>`;
        }).join("");
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
          <button class="btn btn--toggle grade-cost-switch__y8s1" type="button" data-cost-y8s1 hidden>${escapeHtml(uiText("y8s1"))}</button>
        </div>
        ${panelHtmlList.join("")}
      </div>
    `;
    applyHeaderLabelMode();

    const tables = Array.from(contentEl.querySelectorAll("[data-cost-table]"));
    const refreshers = [];
    const bodyRefreshers = [];
    tables.forEach((tableEl, idx) => {
      const meta = tableMetaList[idx] || {};
      const cat = meta.cat || categories[idx];
      const cols = Array.isArray(meta.cols) ? meta.cols : [];
      const rows = Array.isArray(meta.rows) ? meta.rows : [];
      const fromEl = tableEl.querySelector("[data-cost-from]");
      const toEl = tableEl.querySelector("[data-cost-to]");
      const totalEl = tableEl.querySelector("[data-cost-total]");
      const tbodyEl = tableEl.querySelector("tbody");
      if (!fromEl || !toEl || !totalEl) return;
      let displayRows = buildDisplayRows(rows, cols, false);
      const refreshBody = () => {
        if (!tbodyEl) return;
        const useY8S1 = y8s1Enabled && isGradeCategory(cat);
        displayRows = buildDisplayRows(rows, cols, useY8S1);
        const bodyHtml = displayRows.map((drow) => {
          const tds = cols.map((c) => {
            const text = (drow[c.key] != null) ? drow[c.key] : "";
            return `<td class="grade-cost-col grade-cost-col--${escapeHtml(c.tier || "neutral")}" data-cell-key="${escapeHtml(c.key)}">${escapeHtml(String(text))}</td>`;
          }).join("");
          return `<tr>${tds}</tr>`;
        }).join("");
        tbodyEl.innerHTML = bodyHtml;
      };
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
        const totals = computeTotals(displayRows, rows, cols, fromGrade, toGrade);
        cols.slice(1).forEach((c) => {
          const chip = totalEl.querySelector(`[data-total-key="${c.key}"]`);
          if (!chip) return;
          const v = totals.get(c.key) || 0;
          chip.textContent = `${materialLabel(c.label, false)}: ${formatNum(v)}`;
        });
      };
      fromEl.addEventListener("change", refreshTotals);
      toEl.addEventListener("change", refreshTotals);
      refreshers[idx] = refreshTotals;
      bodyRefreshers[idx] = refreshBody;
      refreshBody();
      refreshTotals();
    });

    const switchEl = contentEl.querySelector("[data-cost-switch]");
    const y8s1El = contentEl.querySelector("[data-cost-y8s1]");
    const syncY8S1Visibility = () => {
      if (!switchEl || !y8s1El) return;
      const active = Number.parseInt(String(switchEl.value || "0"), 10) || 0;
      const meta = tableMetaList[active] || {};
      const show = isGradeCategory(meta.cat);
      if (show) {
        y8s1El.removeAttribute("hidden");
        y8s1El.style.display = "";
      } else {
        y8s1El.setAttribute("hidden", "hidden");
        y8s1El.style.display = "none";
      }
    };
    const refreshAllVisible = () => {
      tables.forEach((el, i) => {
        if (el.hasAttribute("hidden")) return;
        const bfn = bodyRefreshers[i];
        if (typeof bfn === "function") bfn();
        const fn = refreshers[i];
        if (typeof fn === "function") fn();
      });
    };
    if (y8s1El) {
      y8s1El.classList.toggle("is-on", !!y8s1Enabled);
      y8s1El.addEventListener("click", () => {
        y8s1Enabled = !y8s1Enabled;
        y8s1El.classList.toggle("is-on", !!y8s1Enabled);
        refreshAllVisible();
      });
    }
    if (switchEl) {
      switchEl.addEventListener("change", () => {
        const active = Number.parseInt(String(switchEl.value || "0"), 10) || 0;
        tables.forEach((el, i) => {
          if (i === active) el.removeAttribute("hidden");
          else el.setAttribute("hidden", "hidden");
        });
        syncY8S1Visibility();
        refreshAllVisible();
      });
    }
    syncY8S1Visibility();
  }

  async function costViewRender() {
    const payload = await fetchCostData();
    bindCompactHeaderWatcher();
    renderCost(payload);
  }

  function bindCompactHeaderWatcher() {
    if (compactHeaderWatcherBound || typeof window === "undefined") return;
    compactHeaderWatcherBound = true;

    const handleViewportMaybeChanged = () => {
      if (!contentEl || !contentEl.querySelector(".grade-cost-view")) return;
      const next = shouldUseShortHeader();
      if (compactHeaderModeAtRender == null || next === compactHeaderModeAtRender) return;
      compactHeaderModeAtRender = next;
      applyHeaderLabelMode();
    };

    window.addEventListener("resize", handleViewportMaybeChanged, { passive: true });
    if (window.matchMedia) {
      const mql = window.matchMedia("(max-width: 900px), (hover: none) and (pointer: coarse)");
      if (mql && typeof mql.addEventListener === "function") {
        mql.addEventListener("change", handleViewportMaybeChanged);
      } else if (mql && typeof mql.addListener === "function") {
        mql.addListener(handleViewportMaybeChanged);
      }
    }
  }

  window.costViewRender = costViewRender;
})();
