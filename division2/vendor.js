/* vendor-specific view logic */
(function () {
  let cacheVendorRecordsPromise = null;

  async function loadCacheVendorRecords() {
    if (!cacheVendorRecordsPromise) {
      cacheVendorRecordsPromise = fetchJsonWithTimeout(`${DATA_BASE}/cache_vendor_records.json?ts=${Date.now()}`, 5000)
        .then((cfg) => Array.isArray(cfg?.records) ? cfg.records : null)
        .catch(() => null);
    }
    return cacheVendorRecordsPromise;
  }

  window.vendorViewLoadWeek = async function vendorViewLoadWeek(userDateStr, options = {}) {
    const preserveSelection = !!options.preserveSelection;
    const dateStr = normalizeToShopWeekStart(userDateStr);
    if (dateInput && dateStr) dateInput.value = dateStr;
    if (typeof window.vendorSetDateValue === "function") window.vendorSetDateValue(dateStr);
    if (!indexJson) throw new Error("index.json is not loaded");
    if (!preserveSelection) clearSelection();

    const chunk = pickChunkForDate(dateStr);
    if (!chunk) {
      lastVendorMap = new Map();
      lastItems = [];
      renderVendors(lastVendorMap);
      setStatus(`${ui("noChunk")}（${dateStr}）`);
      return;
    }

    const version = indexJson.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : "";
    const file = String(chunk.file || "").replace(/\.db\.gz$/, ".json.gz");
    setStatus(ui("loadingDb"));
    let rows;
    try {
      const payload = await fetchGzipJson(`${DATA_BASE}/${file}${version}`);
      rows = Array.isArray(payload?.weeks?.[dateStr]) ? payload.weeks[dateStr] : [];
    } catch (err) {
      const msg = String(err?.message || err || "");
      if (/\b404\b/.test(msg)) {
        lastVendorMap = new Map();
        lastItems = [];
        renderVendors(lastVendorMap);
        setStatus("");
        return;
      }
      throw err;
    }

    const vendorMap = new Map();
    const itemMap = new Map();
    rows.forEach((row) => {
      const item = {
        item_id: row.item_id,
        date: row.date,
        category: row.category,
        rarity: row.rarity,
        vendor_en: row.vendor_en,
        vendor_key: row.vendor_key || normalizeKey(row.vendor_en),
        name_en: row.name_en || "",
        name_key: row.name_key || normalizeKey(row.name_en),
        brand_en: row.brand_en || "",
        brand_key: row.brand_key || normalizeKey(row.brand_en),
        slot_en: row.slot_en || "",
        slot_key: row.slot_key || normalizeKey(row.slot_en),
        item_ord: row.item_ord != null ? Number(row.item_ord) : null,
        lines: []
      };
      (row.lines || []).forEach((line) => {
        if (String(line.line_type || "").toLowerCase() === "modslot") return;
        const statText = stripHtml(line.stat_en || "");
        if (!statText || /^[\-–—]+$/.test(statText)) return;
        const raw = String(line.value_raw || "").trim();
        if (raw === "-" || /^[\-–—]+$/.test(raw)) return;
        item.lines.push({
          ord: line.ord,
          line_type: line.line_type,
          icon_class: line.icon_class,
          stat_key: line.stat_key || normalizeKey(statText),
          stat_en: line.stat_en || "",
          value_num: line.value_num,
          value_raw: line.value_raw || "",
          unit: line.unit || ""
        });
      });
      itemMap.set(item.item_id, item);
      if (!vendorMap.has(item.vendor_key)) vendorMap.set(item.vendor_key, []);
      vendorMap.get(item.vendor_key).push(item);
    });

    try {
      const namedLookup = await ensureNamedTalentLookupCache();
      const talentOverrides = await ensureItemTalentOverrideCache();
      for (const item of itemMap.values()) {
        for (const line of item.lines) {
          if (String(line.line_type || "").toLowerCase() !== "talent") continue;
          const override = getVendorTalentOverrideFromCache(talentOverrides, item.category || "", item.item_id || "", item.name_key || "", line.stat_key || "");
          if (override) {
            if (override.talent) line.override_talent_name = override.talent;
            if (override.talentKey) line.override_talent_key = override.talentKey;
            if (override.talentDesc) line.override_talent_desc = override.talentDesc;
          }
          if (hasNamedTalentInLookup(namedLookup, item.category || "", item.item_id || "", item.name_key || "", line.override_talent_key || line.stat_key || "")) {
            line.is_named_talent = true;
          }
        }
      }
    } catch (_) {
      // Optional descriptions do not prevent the weekly items from rendering.
    }

    const cacheVendorRecords = await loadCacheVendorRecords();
    injectStaticCaches(vendorMap, dateStr, cacheVendorRecords);
    lastVendorMap = vendorMap;
    lastItems = Array.from(itemMap.values());
    if (typeof window.vendorApplyRecommendations === "function") {
      window.vendorApplyRecommendations(lastItems, { preserveSelection });
    }
    renderVendors(vendorMap);
    setStatus("");
  };
})();
