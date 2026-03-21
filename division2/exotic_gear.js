/* exotic-gear specific view logic */
(function () {
  let exoticGearRowsCache = null;
  function textToHtmlPreserveNewline(text) {
    return escapeHtml(String(text || "")).replace(/\r?\n/g, "<br>");
  }
  function trExoticTalentDesc(rawDesc, talentKey, isWeapon) {
    const cat = isWeapon ? "exotic_weapon_talent_desc" : "exotic_gear_talent_desc";
    return trCategoryText(cat, talentKey, String(rawDesc || "").replace(/\r/g, ""));
  }
  function exoticTalentIconHtml(talentKey, fallbackText = "", isWeapon = false) {
    const baseKey = sanitizeFileKey(talentKey || normalizeKey(fallbackText || ""));
    if (!baseKey) return "";
    const cands = [];
    const add = (u) => {
      if (!u) return;
      if (!cands.includes(u)) cands.push(u);
    };
    const primaryKind = isWeapon ? "weapon_talents" : "talents";
    const fallbackKind = isWeapon ? "talents" : "weapon_talents";
    const primaryDir = isWeapon ? "img/weapon_talents" : "img/talents";
    const fallbackDir = isWeapon ? "img/talents" : "img/weapon_talents";
    add(iconUrl(primaryKind, baseKey, primaryDir));
    if (typeof talentKeyVariants === "function") {
      for (const k of talentKeyVariants(baseKey)) add(iconUrl(primaryKind, k, primaryDir));
      for (const k of talentKeyVariants(baseKey)) add(iconUrl(fallbackKind, k, fallbackDir));
    }
    add(iconUrl(fallbackKind, baseKey, fallbackDir));
    if (!cands.length) return "";
    return iconImgHtml(cands[0], "ico ico--talent", "talent", cands.slice(1));
  }

  async function loadExoticGearRows() {
    if (exoticGearRowsCache) return exoticGearRowsCache;
    const SQL = await initSql();
    const v = indexJson?.built_at ? `?v=${encodeURIComponent(indexJson.built_at)}` : `?v=${Date.now()}`;
    const gz = await fetchArrayBuffer(`${DATA_BASE}/items.db.gz${v}`);
    const dbBytes = await gunzipToUint8Array(gz);
    const db = new SQL.Database(dbBytes);
    try {
      const hasGearExotic = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_gear_exotic'").length > 0;
      const hasWeaponExotic = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='items_weapon_exotic'").length > 0;
      if (!hasGearExotic && !hasWeaponExotic) {
        console.warn("Exotic tables are missing in items.db", { hasGearExotic, hasWeaponExotic });
        throw new Error("data_unavailable");
      }
      const rows = [];
      if (hasGearExotic) {
        const gst = db.prepare(`
          SELECT
            item_id,
            name_key,
            name,
            item_type,
            talent,
            talent_key,
            talent_desc,
            attr_types,
            attr_type_keys
          FROM items_gear_exotic
          ORDER BY name
        `);
        while (gst.step()) {
          const r = gst.getAsObject();
          rows.push({ ...r, item_class: "gear" });
        }
        gst.free();
      }
      if (hasWeaponExotic) {
        const wst = db.prepare(`
          SELECT
            item_id,
            name_key,
            name,
            weapon_group,
            variant,
            talent,
            talent_key,
            talent_desc,
            exotic_mods,
            exotic_mod_type_keys
          FROM items_weapon_exotic
          ORDER BY name
        `);
        while (wst.step()) {
          const r = wst.getAsObject();
          rows.push({ ...r, item_class: "weapon" });
        }
        wst.free();
      }
      exoticGearRowsCache = { rows, hasGearExotic, hasWeaponExotic };
      return exoticGearRowsCache;
    } finally {
      db.close();
    }
  }

  function renderExoticGearViewFromRows(payload) {
    const rows = (payload && payload.rows) || [];
    clearContent();
    if (!rows.length) {
      contentEl.innerHTML = `<div class="status">${escapeHtml(ui("noData"))}</div>`;
      return;
    }
    function exoticSlotKey(itemType) {
      const k = normalizeKey(itemType || "");
      if (k === "knee" || k === "knees" || k === "kneepad") return "kneepads";
      return k;
    }
    function weaponGroupKey(v) {
      const k = normalizeKey(v || "");
      if (k === "assaultrifle" || k === "assaultrifles" || k === "ar") return "ar";
      if (k === "submachinegun" || k === "submachineguns" || k === "smg") return "smg";
      if (k === "lightmachinegun" || k === "lightmachineguns" || k === "lmg") return "lmg";
      if (k === "rifle" || k === "rifles" || k === "rf") return "rifle";
      if (k === "marksmanrifle" || k === "marksmanrifles" || k === "mmr") return "mmr";
      if (k === "shotgun" || k === "shotguns" || k === "sg") return "shotgun";
      if (k === "pistol" || k === "pistols" || k === "hg") return "pistol";
      return k;
    }
    function weaponTypeShortLabel(groupKey) {
      const k = normalizeKey(groupKey || "");
      if (k === "ar") return "AR";
      if (k === "smg") return "SMG";
      if (k === "lmg") return "LMG";
      if (k === "shotgun") return "SG";
      if (k === "rifle") return "RF";
      if (k === "mmr") return "MMR";
      if (k === "pistol") return "HG";
      return String(groupKey || "").toUpperCase();
    }
    function attrDotColorClass(attrKey) {
      const k = normalizeKey(attrKey || "");
      if (!k) return "";
      const red = new Set([
        "weapondamage", "totalweapondamage", "criticalhitchance", "criticalhitdamage",
        "headshotdamage", "armordamage", "healthdamage", "dmgtotargetofcover",
        "ardamage", "mmrdamage", "rifledamage", "smgdamage", "shotgundamage", "lmgdamage", "pistoldamage",
        "weaponhandling"
      ]);
      const blue = new Set([
        "armor", "totalarmor", "armorregen", "armoronkill", "health", "healthonkill",
        "hazardprotection", "explosiveresistance", "disruptresistance", "pulseresistance",
        "incomingrepairs", "incomingrepair"
      ]);
      const yellow = new Set([
        "skilltier", "skilldamage", "skillhaste", "skillduration", "repairskills", "skillrepair",
        "statusffects", "statuseffects", "skillhealth", "totalskillrepair"
      ]);
      if (red.has(k)) return "line--red";
      if (blue.has(k)) return "line--blue";
      if (yellow.has(k)) return "line--yellow";
      return "";
    }
    function randomTokenKind(v) {
      const k = normalizeKey(v || "");
      if (!k) return "";
      if (k === "randomcoreattribute" || k === "randomcore") return "core";
      if (k === "random" || k === "ramdom" || k === "randomattribute" || k === "ramdomattribute") return "attr";
      return "";
    }
    const slotOrder = {
      mask: 0,
      backpack: 1,
      chest: 2,
      gloves: 3,
      holster: 4,
      kneepads: 5
    };
    const weaponOrder = {
      ar: 0,
      smg: 1,
      lmg: 2,
      rifle: 3,
      mmr: 4,
      shotgun: 5,
      pistol: 6
    };
    const section = document.createElement("section");
    section.className = "catgroup catgroup--gear";
    section.innerHTML = `
      <div class="trello-group-toggle">
        <button class="btn btn--ghost talent-desc-btn ${window.talentShowDesc ? "is-on" : ""}" type="button" data-toggle-talent-desc="1">Desc</button>
      </div>
      <div class="grid grid--gear"></div>
    `;
    const grid = section.querySelector(".grid");
    const coreLabelByKeyEn = {
      ardamage: "AR Damage",
      healthdamage: "Health Damage",
      lmgdamage: "LMG Damage",
      dmgtotargetofcover: "DMG to target of cover",
      mmrdamage: "MMR Damage",
      headshotdamage: "Headshot Damage",
      rifledamage: "Rifle Damage",
      criticalhitdamage: "Critical Hit Damage",
      shotgundamage: "Shotgun Damage",
      damagetoarmor: "Damage to Armor",
      smgdamage: "SMG Damage",
      criticalhitchance: "Critical Hit Chance",
      pistoldamage: "Pistol Damage"
    };

    const sorted = rows.slice().sort((a, b) => {
      const ac = String(a.item_class || "");
      const bc = String(b.item_class || "");
      if (ac !== bc) return ac.localeCompare(bc);
      if (ac === "weapon") {
        const ag = weaponGroupKey(a.weapon_group || "");
        const bg = weaponGroupKey(b.weapon_group || "");
        const ao = Object.prototype.hasOwnProperty.call(weaponOrder, ag) ? weaponOrder[ag] : 999;
        const bo = Object.prototype.hasOwnProperty.call(weaponOrder, bg) ? weaponOrder[bg] : 999;
        if (ao !== bo) return ao - bo;
      }
      const ask = exoticSlotKey(a.item_type || "");
      const bsk = exoticSlotKey(b.item_type || "");
      const ao = Object.prototype.hasOwnProperty.call(slotOrder, ask) ? slotOrder[ask] : 999;
      const bo = Object.prototype.hasOwnProperty.call(slotOrder, bsk) ? slotOrder[bsk] : 999;
      if (ao !== bo) return ao - bo;
      if (ask !== bsk) return ask.localeCompare(bsk);
      const ak = normalizeKey(a.name_key || a.name || "");
      const bk = normalizeKey(b.name_key || b.name || "");
      const at = (langSelect.value === "ja") ? (i18n[a.name_key] ?? i18n[ak] ?? a.name) : a.name;
      const bt = (langSelect.value === "ja") ? (i18n[b.name_key] ?? i18n[bk] ?? b.name) : b.name;
      return String(at || "").localeCompare(String(bt || ""), langSelect.value === "ja" ? "ja" : "en");
    });

    let prevClass = "";
    sorted.forEach((r) => {
      const rowClass = String(r.item_class || "");
      if (prevClass && rowClass && prevClass !== rowClass) {
        const sep = document.createElement("hr");
        sep.className = "exotic-items-sep";
        grid.appendChild(sep);
      }
      prevClass = rowClass;

      const nameKeyNorm = normalizeKey(r.name_key || r.name || "");
      const isWeapon = String(r.item_class || "") === "weapon";
      const title = (langSelect.value === "ja")
        ? (i18n[r.name_key] ?? i18n[nameKeyNorm] ?? r.name)
        : (r.name || "");
      const talentText = (langSelect.value === "ja")
        ? (i18n[r.talent_key] ?? trText(r.talent || r.talent_key || ""))
        : (r.talent || r.talent_key || "");
      const talentKey = String(r.talent_key || "").trim();
      const talentDescText = trExoticTalentDesc(String(r.talent_desc || "").trim(), talentKey, isWeapon);
      const talentIcon = exoticTalentIconHtml(talentKey, talentText, isWeapon);
      const attrs = [];
      const weaponModTexts = [];
      if (isWeapon) {
        const mods = parseJsonObjectArrayText(r.exotic_mods || "");
        const modKeys = parseJsonArrayText(r.exotic_mod_type_keys || "");
        for (let i = 0; i < mods.length; i++) {
          const m = mods[i] || {};
          const num = formatDisplayNumber(m.num);
          const unit = String(m.unit || "").trim();
          const tv = String(m.type || "").trim();
          if (!tv && !num) continue;
          const tk = String(modKeys[i] || "").trim();
          const tDisp = (langSelect.value === "ja") ? (i18n[tk] ?? trText(tv)) : tv;
          const nv = num ? `${num}${unit ? unit : ""}` : "";
          const text = nv && tDisp ? `${nv} ${tDisp}` : (nv || tDisp);
          if (text) weaponModTexts.push(text);
        }
      } else {
        const attrTypes = parseJsonArrayText(r.attr_types || "");
        const attrTypeKeys = parseJsonArrayText(r.attr_type_keys || "");
        if (attrTypes.length) {
          for (let i = 0; i < attrTypes.length; i++) {
            const tk = String(attrTypeKeys[i] || "").trim();
            const tv = String(attrTypes[i] || "").trim();
            if (!tv) continue;
            const rk = randomTokenKind(tk || tv);
            const key = rk === "core" ? "randomcoreattribute" : (rk === "attr" ? "randomattribute" : (tk || normalizeKey(tv)));
            const text = rk
              ? ((langSelect.value === "ja")
                ? trText(rk === "core" ? "Random Core Attribute" : "Random Attribute")
                : (rk === "core" ? "Random Core Attribute" : "Random Attribute"))
              : ((langSelect.value === "ja") ? (i18n[tk] ?? trText(tv)) : tv);
            attrs.push({ key, text });
          }
        }
      }
      const coreKeySet = new Set(["weapondamage", "armor", "skilltier", "randomcoreattribute"]);
      const coreAttrKeys = new Set(
        attrs
          .map((a) => normalizeKey(a.key || ""))
          .filter((k) => coreKeySet.has(k))
      );
      const lines = [];
      if (isWeapon) {
        const wg = weaponGroupKey(r.weapon_group || "");
        const weaponCoreMap = {
          ar: ["ardamage", "healthdamage"],
          lmg: ["lmgdamage", "dmgtotargetofcover"],
          mmr: ["mmrdamage", "headshotdamage"],
          rifle: ["rifledamage", "criticalhitdamage"],
          shotgun: ["shotgundamage", "damagetoarmor"],
          smg: ["smgdamage", "criticalhitchance"],
          pistol: ["pistoldamage"]
        };
        const coreKeys = weaponCoreMap[wg] || [];
        const coreLabels = coreKeys.map((k) => (
          langSelect.value === "ja"
            ? (i18n[k] ?? k)
            : (coreLabelByKeyEn[k] || k)
        ));
        const randomLabel = (langSelect.value === "ja")
          ? trText("Random Attribute")
          : "Random Attribute";
        const coreRows = [...coreLabels, randomLabel].filter(Boolean);
        if (coreRows.length) {
          lines.push({
            cls: "line line--core",
            text: coreRows.join(" "),
            textHtml: coreRows.map((x) => escapeHtml(x)).join("<br>"),
            key: ""
          });
        }

        const modRows = weaponModTexts.length ? weaponModTexts : [];
        if (modRows.length) {
          lines.push({
            cls: "line line--gray",
            text: modRows.join(" "),
            textHtml: modRows.map((x) => escapeHtml(x)).join("<br>"),
            key: ""
          });
        }

        if (talentText) lines.push({ cls: "line line--gray line--talent", text: talentText, key: talentKey, icon: talentIcon });
        if (talentDescText) {
          lines.push({ cls: "line line--named-meta line--talent-desc", text: talentDescText, textHtml: textToHtmlPreserveNewline(talentDescText), key: "", isDesc: true });
        }
      } else if (attrs.length) {
        attrs.forEach((a) => {
          const ak = normalizeKey(a.key || "");
          const isCore = coreAttrKeys.has(ak);
          const dotColorCls = attrDotColorClass(ak);
          const textCls = (ak === "weapondamage")
            ? "line--core-attr-weapon"
            : (ak === "armor")
              ? "line--core-attr-armor"
              : (ak === "skilltier")
                ? "line--core-attr-skill"
                : "";
          const coreColorCls = (ak === "weapondamage")
            ? "line--red"
            : (ak === "armor")
              ? "line--blue"
              : (ak === "skilltier")
                ? "line--yellow"
                : "";
          const cls = isCore && coreColorCls
            ? `line ${coreColorCls} ${textCls}`
            : (isCore ? "line line--core" : (dotColorCls ? `line ${dotColorCls} line--noncore-attr` : "line line--gray"));
          lines.push({ cls, text: a.text, key: String(a.key || "").trim() });
        });
        if (talentText) lines.push({ cls: "line line--gray line--talent", text: talentText, key: talentKey, icon: talentIcon });
        if (talentDescText) {
          lines.push({ cls: "line line--named-meta line--talent-desc", text: talentDescText, textHtml: textToHtmlPreserveNewline(talentDescText), key: "", isDesc: true });
        }
      }

      const searchParts = [];
      const pushSearch = (s) => {
        const n = normalizeKey(stripHtml(s || ""));
        if (n) searchParts.push(n);
      };
      pushSearch(r.name_key || "");
      pushSearch(r.name || "");
      pushSearch(r.item_type || "");
      pushSearch(r.weapon_group || "");
      pushSearch(r.variant || "");
      pushSearch(r.talent_key || "");
      pushSearch(r.talent || "");
      pushSearch(r.talent_desc || "");
      weaponModTexts.forEach((t) => pushSearch(t || ""));
      lines.forEach((ln) => pushSearch(ln.text || ""));

      let bg = "";
      let typeBadgeHtml = "";
      if (String(r.item_class || "") === "weapon") {
        const wg = weaponGroupKey(r.weapon_group || "");
        const wIcon = iconUrl("weapon_types", wg, "img/weapons");
        bg = wIcon ? bgIconHtml(wIcon, "card__bg--tr", "weapon") : "";
        typeBadgeHtml = `<span class="wt-inline-badges"><span class="wt-badge is-on">${escapeHtml(weaponTypeShortLabel(wg))}</span></span>`;
      } else {
        const slotKey = exoticSlotKey(r.item_type || "");
        const slotIcon = iconUrl("gear_slots", slotKey, "img/gears");
        bg = slotIcon ? bgIconHtml(slotIcon, "card__bg--tr", "slot") : "";
      }

      const card = document.createElement("div");
      card.className = "card rarity-exotic";
      const hasDescLines = lines.some((ln) => !!ln.isDesc);
      if (hasDescLines) {
        card.setAttribute("data-desc-collapsible", "1");
        card.setAttribute("data-desc-open", window.talentShowDesc ? "1" : "0");
        card.classList.toggle("is-desc-open", !!window.talentShowDesc);
      }
      card.setAttribute("data-item-id", `exotic:${String(r.item_id || nameKeyNorm)}`);
      card.setAttribute("data-search", searchParts.join(" "));
      card.innerHTML = `
        ${bg}
        <div class="card__head">
          <div class="card__title-wrap card__title-wrap--gear">
            <div class="card__titles">
              <div class="card__title"><span class="card__title-text">${escapeHtml(title)}</span></div>
            </div>
          </div>
          ${typeBadgeHtml}
        </div>
        <div class="lines">
          ${lines.map((ln) => `<div class="${ln.cls}" ${ln.key ? `data-stat-key="${escapeHtml(ln.key)}"` : ""} ${ln.isDesc ? `data-desc-line="1"` : ""}>${ln.icon || ""}<div class="line__body"><div class="line__text">${ln.textHtml || escapeHtml(ln.text)}</div></div></div>`).join("")}
        </div>
      `;
      grid.appendChild(card);
    });

    contentEl.appendChild(section);
    applyFiltersToDom();
  }

  window.exoticGearViewRender = async function exoticGearViewRender() {
    setStatus(ui("loadingDb"));
    try {
      const rows = await loadExoticGearRows();
      renderExoticGearViewFromRows(rows);
      setStatus("");
    } catch (e) {
      clearContent();
      const msg = (e && e.message === "data_unavailable") ? ui("dataUnavailable") : e.message;
      setStatus(`${ui("error")}: ${msg}`, "error");
    }
  };
})();
