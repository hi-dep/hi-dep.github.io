/* vendor-specific view logic */
(function () {
  window.vendorViewLoadWeek = async function vendorViewLoadWeek(userDateStr, options = {}) {
    const preserveSelection = !!options.preserveSelection;
    const dateStr = normalizeToShopWeekStart(userDateStr);
    if (dateInput && dateStr) dateInput.value = dateStr;
    if (!indexJson) throw new Error("index.json is not loaded");

    if (!preserveSelection) clearSelection();

    const chunk = pickChunkForDate(dateStr);
    if (!chunk) {
      renderVendors(new Map());
      setStatus(`${ui("noChunk")}（${dateStr}）`);
      return;
    }

    const v = indexJson.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : "";
    const chunkUrl = `${DATA_BASE}/${chunk.file}${v}`;
    setStatus(ui("loadingDb"));

    const SQL = await initSql();
    const gz = await fetchArrayBuffer(chunkUrl);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);

    try {
      const stmt = db.prepare(`
        SELECT
          i.item_id, i.date, i.category, i.rarity, i.vendor_en, i.vendor_key,
          i.name_en, i.name_key, i.brand_en, i.brand_key, i.slot_en, i.slot_key,
          i.item_ord, l.ord, l.line_type, l.icon_class, l.stat_key, l.stat_en,
          l.value_num, l.value_raw, l.unit
        FROM shop_items i
        LEFT JOIN shop_lines l ON i.item_id = l.item_id
        WHERE i.date = ?
        ORDER BY i.vendor_key, i.category, i.item_ord, i.item_id, l.ord
      `);

      stmt.bind([dateStr]);
      const vendorMap = new Map();
      const itemMap = new Map();

      while (stmt.step()) {
        const row = stmt.getAsObject();
        let item = itemMap.get(row.item_id);
        if (!item) {
          item = {
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
            item_ord: (row.item_ord != null ? Number(row.item_ord) : null),
            lines: []
          };
          itemMap.set(row.item_id, item);
          const vkey = item.vendor_key;
          if (!vendorMap.has(vkey)) vendorMap.set(vkey, []);
          vendorMap.get(vkey).push(item);
        }

        if (String(row.line_type || "").toLowerCase() === "modslot") continue;
        const statText = stripHtml(row.stat_en || "");
        if (!statText) continue;
        if (/^[\-–—]+$/.test(statText)) continue;
        const vraw = String(row.value_raw || "").trim();
        if (vraw === "-" || /^[\-–—]+$/.test(vraw)) continue;

        item.lines.push({
          ord: row.ord,
          line_type: row.line_type,
          icon_class: row.icon_class,
          stat_key: row.stat_key || normalizeKey(statText),
          stat_en: row.stat_en || "",
          value_num: row.value_num,
          value_raw: row.value_raw || "",
          unit: row.unit || ""
        });
      }

      stmt.free();
      injectStaticCaches(vendorMap, dateStr);
      lastVendorMap = vendorMap;
      lastItems = Array.from(itemMap.values());
      if (typeof window.vendorApplyRecommendations === "function") {
        window.vendorApplyRecommendations(lastItems, { preserveSelection });
      }
      renderVendors(vendorMap);
      setStatus("");
    } finally {
      db.close();
    }
  };
})();

