/* Build-generated item snapshot loader.  It uses only Web Platform APIs. */
(function () {
  let promise;

  async function fetchGzipJson(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`data request failed: ${response.status}`);
    const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
    return JSON.parse(await new Response(stream).text());
  }

  window.fetchGzipJson = fetchGzipJson;
  window.loadItemsData = function loadItemsData(version) {
    if (!promise) {
      const suffix = version ? `?v=${encodeURIComponent(version)}` : "";
      promise = fetchGzipJson(`./data/items_web.json.gz${suffix}`);
    }
    return promise;
  };
  window.itemsTableRows = async function itemsTableRows(table, version) {
    const data = await window.loadItemsData(version);
    return data.tables?.[table]?.rows || [];
  };

  function rows(data, name) { return data.tables?.[name]?.rows || []; }
  function join(parent, child, key) {
    const out = [];
    const children = new Map();
    rows(parent.data, child).forEach((item) => {
      const value = String(item[key] || "");
      if (!children.has(value)) children.set(value, []);
      children.get(value).push(item);
    });
    rows(parent.data, parent.table).forEach((item) => {
      const matches = children.get(String(item.item_id || "")) || [null];
      matches.forEach((extra) => out.push(extra ? { ...item, ...extra } : { ...item }));
    });
    return out;
  }

  window.loadItemsView = async function loadItemsView(view, version) {
    const data = await window.loadItemsData(version);
    const table = (name) => rows(data, name);
    if (view === "weapons") return { rows: table("items_weapons") };
    if (view === "brand") return {
      rows: join({ data, table: "items_brandsets" }, "items_brandset_bonuses", "parent_item_id"),
      namedRows: table("items_gear_named")
    };
    if (view === "gearset") return {
      rows: join({ data, table: "items_gearsets" }, "items_gearset_bonuses", "parent_item_id")
    };
    if (view === "exotic") return {
      rows: table("items_gear_exotic").map((x) => ({ ...x, item_class: "gear" }))
        .concat(table("items_weapon_exotic").map((x) => ({ ...x, item_class: "weapon" })))
    };
    if (view === "gear_talent") return { rows: table("items_gear_talents"), namedRows: table("items_gear_named") };
    if (view === "weapon_talent") return { rows: table("items_weapon_talents"), namedRows: table("items_weapon_named"), exoticRows: table("items_weapon_exotic") };
    if (view === "gear_attributes") {
      const out = [];
      const add = (tableName, key, name, rarity, bonusTable, extra) => {
        const bonuses = new Map();
        table(bonusTable).forEach((b) => {
          const k = String(b.parent_item_id || "");
          if (!bonuses.has(k)) bonuses.set(k, []);
          bonuses.get(k).push(b);
        });
        table(tableName).forEach((item) => {
          const base = { set_key: item[key], set_name: item[name], core_attribute: item.core_attribute, rarity };
          if (extra) base.core_attribute_by_piece = item.core_attribute_by_piece;
          (bonuses.get(String(item.item_id || "")) || [null]).forEach((bonus) => out.push({ ...base, ...(bonus || {}) }));
        });
      };
      add("items_brandsets", "brandset_key", "brandset", "brand", "items_brandset_bonuses", false);
      add("items_gearsets", "gearset_key", "gearset", "gearset", "items_gearset_bonuses", true);
      return out;
    }
    if (view === "blueprint") return table("items_blueprints");
    if (view === "prototype") return {
      items: table("items_prototype"),
      attributes: table("items_prototype_attributes")
    };
    if (view === "cost") return {
      grade: parsePayload(table("items_grade_cost")[0]?.payload),
      optimization: parsePayload(table("items_optimization_cost")[0]?.payload)
    };
    return { rows: [] };
  };

  function parsePayload(value) {
    if (value && typeof value === "object") return value;
    try { return value ? JSON.parse(String(value)) : {}; } catch (_) { return {}; }
  }
})();
