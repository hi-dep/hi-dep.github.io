/* season_mod-specific view logic */
(function () {
  let seasonModCache = null;
  const SEASON_MOD_URL_KEYS = Object.freeze({
    active: "sm_active",
    level: "sm_level",
    passive1: "sm_p1",
    passive2: "sm_p2",
    passive3: "sm_p3",
    activeOpen: "sm_ao",
    passiveOpen: "sm_po"
  });

  function getLang() {
    const sel = document.getElementById("langSelect");
    return (sel && (sel.value === "ja" || sel.value === "en")) ? sel.value : "en";
  }

  function t() {
    const ja = getLang() === "ja";
    return {
      loading: ja ? "シーズンMOD情報を読み込み中..." : "Loading season modifier data...",
      failed: ja ? "シーズンMOD情報の取得に失敗しました。" : "Failed to load season modifier data.",
      noData: ja ? "データなし" : "No Data",
      sectionSimulator: ja ? "Y8S1シミュレータ" : "Y8S1 Simulator",
      sectionActive: ja ? "アクティブMODリスト" : "Active Modifier List",
      sectionPassive: ja ? "パッシブMODリスト" : "Passive Modifier List",
      season: ja ? "シーズン" : "Season",
      globalModifier: ja ? "グローバルMOD" : "Global Modifier",
      activeModifier: ja ? "アクティブMOD" : "Active Modifier",
      activeLevel: ja ? "アクティブレベル" : "Active Level",
      picker: ja ? "候補選択" : "Candidate Picker",
      pickerAddTrait: ja ? "指定特性" : "Target Trait",
      pickerAdd: ja ? "追加" : "Add",
      pickerConds: ja ? "条件" : "Conditions",
      pickerNoCond: ja ? "条件なし" : "No Conditions",
      pickerCandidates: ja ? "候補件数" : "Candidates",
      pickerClose: ja ? "閉じる" : "Close",
      passiveSlot1: ja ? "パッシブMOD" : "Passive MOD",
      passiveSlot2: ja ? "パッシブMOD" : "Passive MOD",
      passiveSlot3: ja ? "パッシブMOD" : "Passive MOD",
      none: ja ? "なし" : "None",
      result: ja ? "結果" : "Result",
      module: ja ? "モジュール" : "Module",
      base: ja ? "基礎値" : "Base",
      final: ja ? "最終値" : "Final",
      delta: ja ? "差分" : "Delta",
      offense: ja ? "攻撃" : "Offense",
      defense: ja ? "防衛" : "Defense",
      utility: ja ? "ユーティリティ" : "Utility",
      dropped: ja ? "装備上限により除外" : "Dropped (slot limit)",
      duplicated: ja ? "重複により除外" : "Dropped (duplicate)",
      cooldown: ja ? "クールダウン" : "Cooldown",
      desc: ja ? "説明" : "Description",
      group: ja ? "グループ" : "Group",
      name: ja ? "名称" : "Name",
      icon: ja ? "アイコン" : "Icon",
      orderApplied: ja ? "適用順" : "Apply Order",
      activeDerived: ja ? "アクティブ効果(現在値)" : "Active Effect (Current)"
      , formula: ja ? "計算式" : "Formula"
      , moduleStacks: ja ? "モジュール累積" : "Module Stacks"
      , stackValue: ja ? "累積値" : "Stacks"
      , buffEffect: ja ? "効果" : "Effect"
      , levelEffects: ja ? "レベル効果" : "Level Effects"
      , perStack: ja ? "1累積ごと" : "per stack"
      , noStatBuff: ja ? "ステータス補正なし" : "No stat buff"
      , selectedMods: ja ? "選択中MOD" : "Selected Mods"
      , slot: ja ? "スロット" : "Slot"
      , mod: ja ? "MOD" : "MOD"
      , effect: ja ? "効果" : "Effect"
      , empRadius: ja ? "EMP範囲" : "EMP Radius"
      , repairPerSec: ja ? "回復 / 秒" : "Repair / sec"
      , skillCdr: ja ? "スキルクールダウン削減" : "Skill Cooldown Reduction"
      , pulseDuration: ja ? "Pulse持続時間" : "Pulse Duration"
      , blindDuration: ja ? "視聴覚持続時間" : "Blind Duration"
      , overchargeDuration: ja ? "オーバーチャージ持続時間" : "Overcharge Duration"
    };
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function nk(s) {
    if (typeof normalizeKey === "function") return normalizeKey(String(s || ""));
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function setContentHtml(html) {
    const content = document.getElementById("content");
    if (!content) return;
    content.innerHTML = html;
  }

  function textByLang(obj) {
    const lang = getLang();
    if (obj && typeof obj === "object") {
      const v = obj[lang]
        || obj.en
        || obj.ja
        || obj[`name_${lang}`]
        || obj.name_en
        || obj.name_ja
        || "";
      return String(v).trim();
    }
    return String(obj || "").trim();
  }

  async function fetchJsonNoStore(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  async function loadSeasonModData() {
    if (seasonModCache) return seasonModCache;
    const index = await fetchJsonNoStore(`./data/season_mod/index.json?ts=${Date.now()}`);
    const seasons = Array.isArray(index?.seasons) ? index.seasons : [];
    if (!seasons.length) throw new Error("season list is empty");
    const latestId = String(index?.latest || "").trim();
    const current = seasons.find((s) => String(s?.id || "").trim() === latestId) || seasons[0];
    const file = String(current?.file || "").trim();
    if (!file) throw new Error("season file is missing");
    const data = await fetchJsonNoStore(`./data/${file}?ts=${Date.now()}`);
    seasonModCache = { index, current, data };
    return seasonModCache;
  }

  function moduleLabel(moduleKey) {
    const ui = t();
    const k = nk(moduleKey);
    if (k === "offense") return ui.offense;
    if (k === "defense") return ui.defense;
    if (k === "utility") return ui.utility;
    return String(moduleKey || "");
  }

  function passiveGroupLabel(groupKey) {
    const lang = getLang();
    const k = nk(groupKey);
    if (k === "offense") return lang === "ja" ? "攻撃" : "Offense";
    if (k === "defense") return lang === "ja" ? "防衛" : "Defense";
    if (k === "utility") return lang === "ja" ? "ユーティリティ" : "Utility";
    if (k === "wildcard") return lang === "ja" ? "ワイルドカード" : "Wildcard";
    return String(groupKey || "");
  }

  function statLabel(statKey) {
    const uiLocal = t();
    const k = nk(statKey);
    const pick = (i18nKey, enText) => {
      if (typeof trText === "function" && i18nKey) {
        const t = String(trText(i18nKey) || "").trim();
        if (t && nk(t) !== nk(i18nKey)) return t;
      }
      return enText;
    };
    if (k === "armor") return pick("armor", "Armor");
    if (k === "weaponhandling") return pick("weaponhandling", "Weapon Handling");
    if (k === "maxarmor") return pick("armor", "Max Armor");
    if (k === "skilldamage") return pick("skilldamage", "Skill Damage");
    if (k === "headshotdamage") return pick("headshotdamage", "Headshot Damage");
    if (k === "magazinesize") return pick("magazinesize", "Magazine Size");
    if (k === "protectionfromelites") return pick("protectionfromelites", "Protection from Elites");
    if (k === "hazardprotection") return pick("hazardprotection", "Hazard Protection");
    if (k === "skillrepair") return pick("repairskills", "Skill Repair");
    if (k === "statuseffects") return pick("statuseffects", "Status Effects");
    if (k === "blackoutempradius") return uiLocal.empRadius;
    if (k === "blackoutcooldown") return uiLocal.cooldown;
    if (k === "blackoutpulseduration") return uiLocal.pulseDuration;
    if (k === "cloudrepairpersec") return uiLocal.repairPerSec;
    if (k === "cloudcooldown") return uiLocal.cooldown;
    if (k === "cloudblindduration") return uiLocal.blindDuration;
    if (k === "optimizeskillcdr") return uiLocal.skillCdr;
    if (k === "optimizecooldown") return uiLocal.cooldown;
    if (k === "optimizeoverchargeduration") return uiLocal.overchargeDuration;
    return String(statKey || "");
  }

  function fmtPct(v) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return "0%";
    const rounded2 = Math.round(n * 100) / 100;
    if (Math.abs(rounded2 - Math.round(rounded2)) < 1e-9) return `${Math.round(rounded2)}%`;
    const s = rounded2.toFixed(2).replace(/\.?0+$/, "");
    return `${s}%`;
  }

  function activeIconPath(seasonId, mod) {
    const file = String(mod?.icon || "").trim();
    if (!file) return "";
    if (typeof appPath === "function") return appPath(`img/season/${seasonId}/${file}`);
    return `./img/season/${seasonId}/${file}`;
  }

  function passiveIconPath(seasonId, mod) {
    const file = String(mod?.icon || `${mod?.id || ""}.png`).trim();
    if (!file) return "";
    if (typeof appPath === "function") return appPath(`img/season/${seasonId}/${file}`);
    return `./img/season/${seasonId}/${file}`;
  }

  function activeNameById(activeId) {
    const ja = getLang() === "ja";
    const k = nk(activeId);
    if (k === "blackoutpulse") return ja ? "ブラックアウトPulse" : "Blackout Pulse";
    if (k === "cloudarmor") return ja ? "クラウドアーマー" : "Cloud Armor";
    if (k === "optimizeoverload") return ja ? "最適化/オーバーロード" : "Optimize / Overload";
    return String(activeId || "");
  }

  function formatLevelEffectText(effect) {
    if (!effect || typeof effect !== "object") return "";
    const ja = getLang() === "ja";
    const t = String(effect.type || "");
    if (t === "increase_all_base_module_stacks") {
      const v = Number(effect.value || 0);
      return ja ? `全モジュールの基礎累積値+${v}` : `All base module stacks +${v}`;
    }
    if (t === "cooldown_reduction") {
      const v = Number(effect.value_seconds_per_stack || 0);
      const m = moduleLabel(effect.stack_source_module);
      return ja
        ? `クールダウン短縮: ${m}${v ? `1累積ごとに${v}秒` : ""}`
        : `Cooldown reduction: ${v}s per ${m} stack`;
    }
    if (t === "pulse_duration_bonus") {
      const b = Number(effect.base_seconds || 0);
      const v = Number(effect.value_seconds_per_stack || 0);
      const m = moduleLabel(effect.stack_source_module);
      return ja
        ? `Pulse持続時間: 基本${b}秒 + ${m}1累積ごとに${v}秒`
        : `Pulse Duration: ${b}s base + ${v}s per ${m} stack`;
    }
    if (t === "blind_duration_bonus") {
      const b = Number(effect.base_seconds || 0);
      const v = Number(effect.value_seconds_per_stack || 0);
      const m = moduleLabel(effect.stack_source_module);
      return ja
        ? `視聴覚持続時間: 基本${b}秒 + ${m}1累積ごとに${v}秒`
        : `Blind Duration: ${b}s base + ${v}s per ${m} stack`;
    }
    if (t === "overcharge_duration_bonus") {
      const b = Number(effect.base_seconds || 0);
      const v = Number(effect.value_seconds_per_stack || 0);
      const m = moduleLabel(effect.stack_source_module);
      return ja
        ? `オーバーチャージ持続時間: 基本${b}秒 + ${m}1累積ごとに${v}秒`
        : `Overcharge Duration: ${b}s base + ${v}s per ${m} stack`;
    }
    return t;
  }

  function buildActiveLevelEffectsHtml(mod) {
    const ui = t();
    const items = Array.isArray(mod?.level_effects) ? mod.level_effects.slice() : [];
    if (!items.length) return "";
    items.sort((a, b) => Number(a?.level || 0) - Number(b?.level || 0));
    const lines = items.map((it) => {
      const lv = Number(it?.level || 0);
      const baseText = formatLevelEffectText(it?.effect);
      const extraText = formatLevelEffectText(it?.extra_effect);
      const merged = [baseText, extraText].filter(Boolean).join(" / ");
      return `Lv${lv}: ${merged}`;
    }).filter(Boolean);
    if (!lines.length) return "";
    return `<div class="seasonmod-level-effects"><strong>${esc(ui.levelEffects)}:</strong><br>${lines.map((s) => esc(s)).join("<br>")}</div>`;
  }

  function buildActiveDerivedRows(activeId, activeLevel, stacks, activeMode) {
    const ui = t();
    const mode = activeMode || {};
    const offIgnored = String(mode?.offense || "") === "ignored_by_cascade";
    const defIgnored = String(mode?.defense || "") === "ignored_by_cascade";
    const utlIgnored = String(mode?.utility || "") === "ignored_by_cascade";
    const offRaw = Number(stacks?.offense || 0);
    const defRaw = Number(stacks?.defense || 0);
    const utlRaw = Number(stacks?.utility || 0);
    const off = offIgnored ? 0 : Math.max(0, offRaw);
    const def = defIgnored ? 0 : Math.max(0, defRaw);
    const utl = utlIgnored ? 0 : Math.max(0, utlRaw);
    const rows = [];
    const level = Math.max(1, Math.min(5, Number(activeLevel || 1)));
    const cdBase = 90;
    const ignoredNote = getLang() === "ja" ? " (カスケードで無効)" : " (ignored by Cascade)";
    const srcLabel = (moduleKey, rawVal, ignored) => {
      const clamped = Math.max(0, Number(rawVal || 0));
      const base = `${moduleLabel(moduleKey)} ${clamped}`;
      return ignored ? `${base}${ignoredNote}` : base;
    };

    if (activeId === "blackout_pulse") {
      const radius = 10 + (off * 0.5);
      const cd = Math.max(0, cdBase - (level >= 3 ? def : 0));
      rows.push([
        ui.empRadius,
        `${radius.toFixed(1)}m`,
        `10m + (0.5m x ${srcLabel("offense", offRaw, offIgnored)})`
      ]);
      rows.push([
        ui.cooldown,
        `${cd.toFixed(0)}s`,
        (level >= 3)
          ? `90s - (1s x ${srcLabel("defense", defRaw, defIgnored)})`
          : (getLang() === "ja" ? "90秒 (Lv3以上)" : "90s (Lv3+)")
      ]);
      if (level >= 5) {
        rows.push([
          ui.pulseDuration,
          `${(4 + (utl * 0.1)).toFixed(1)}s`,
          `4s + (0.1s x ${srcLabel("utility", utlRaw, utlIgnored)})`
        ]);
      }
      return rows;
    }
    if (activeId === "cloud_armor") {
      const repair = 5 + (def * 0.2);
      const cd = Math.max(0, cdBase - (level >= 3 ? utl : 0));
      rows.push([
        ui.repairPerSec,
        `${repair.toFixed(1)}%`,
        `5% + (0.2% x ${srcLabel("defense", defRaw, defIgnored)})`
      ]);
      rows.push([
        ui.cooldown,
        `${cd.toFixed(0)}s`,
        (level >= 3)
          ? `90s - (1s x ${srcLabel("utility", utlRaw, utlIgnored)})`
          : (getLang() === "ja" ? "90秒 (Lv3以上)" : "90s (Lv3+)")
      ]);
      if (level >= 5) {
        rows.push([
          ui.blindDuration,
          `${(4 + (off * 0.1)).toFixed(1)}s`,
          `4s + (0.1s x ${srcLabel("offense", offRaw, offIgnored)})`
        ]);
      }
      return rows;
    }
    if (activeId === "optimize_overload") {
      const cdr = 30 + (utl * 0.8);
      const cd = Math.max(0, cdBase - (level >= 3 ? off : 0));
      rows.push([
        ui.skillCdr,
        `${cdr.toFixed(1)}%`,
        `30% + (0.8% x ${srcLabel("utility", utlRaw, utlIgnored)})`
      ]);
      rows.push([
        ui.cooldown,
        `${cd.toFixed(0)}s`,
        (level >= 3)
          ? `90s - (1s x ${srcLabel("offense", offRaw, offIgnored)})`
          : (getLang() === "ja" ? "90秒 (Lv3以上)" : "90s (Lv3+)")
      ]);
      if (level >= 5) {
        rows.push([
          ui.overchargeDuration,
          `${(5 + (def * 0.2)).toFixed(1)}s`,
          `5s + (0.2s x ${srcLabel("defense", defRaw, defIgnored)})`
        ]);
      }
      return rows;
    }
    return rows;
  }

  function passiveOptionLabel(mod) {
    const lang = getLang();
    const name = (lang === "ja")
      ? (String(mod?.name_ja || "").trim() || String(mod?.name_en || "").trim())
      : (String(mod?.name_en || "").trim() || String(mod?.name_ja || "").trim());
    const group = passiveGroupLabel(mod?.group);
    return `${group} / ${name}`;
  }

  function passiveOptionPreview(mod) {
    const ef = mod?.effect || {};
    const type = String(ef.type || "");
    const ja = getLang() === "ja";
    const m = (k) => moduleLabel(k);
    const ordered = ["offense", "defense", "utility"];
    const deltasText = (deltas) => ordered
      .map((k) => {
        const d = Number(deltas[k] || 0);
        if (!d) return "";
        return `${m(k)} ${d > 0 ? `+${d}` : String(d)}`;
      })
      .filter(Boolean)
      .join(" / ");
    if (type === "add_target") {
      const deltas = { offense: 0, defense: 0, utility: 0 };
      deltas[String(ef.target || "")] = Number(ef.value || 0);
      return deltasText(deltas);
    }
    if (type === "add_target_and_subtract_others") {
      const deltas = { offense: 0, defense: 0, utility: 0 };
      const target = String(ef.target || "");
      if (Object.prototype.hasOwnProperty.call(deltas, target)) deltas[target] = Number(ef.target_add || 0);
      ordered.forEach((k) => {
        if (k !== target) deltas[k] -= Number(ef.others_subtract || 0);
      });
      return deltasText(deltas);
    }
    if (type === "saturate_target") {
      const deltas = { offense: 0, defense: 0, utility: 0 };
      deltas[String(ef.target || "")] = Number(ef.value || 0);
      const deltaText = deltasText(deltas);
      return `${deltaText}${deltaText ? " / " : ""}${ja ? "ステータス補正無効" : "stat bonus disabled"}`;
    }
    if (type === "pivot_to_lowest") {
      return ja ? "最下位モジュールへ移譲" : "shift to lowest module";
    }
    if (type === "split_from_target") {
      const deltas = { offense: 0, defense: 0, utility: 0 };
      const target = String(ef.target || "");
      if (Object.prototype.hasOwnProperty.call(deltas, target)) deltas[target] -= Number(ef.target_subtract || 0);
      ordered.forEach((k) => {
        if (k !== target) deltas[k] += Number(ef.others_add || 0);
      });
      return deltasText(deltas);
    }
    if (type === "compress_target") {
      const deltas = { offense: 0, defense: 0, utility: 0 };
      deltas[String(ef.target || "")] -= Number(ef.target_subtract || 0);
      const deltaText = deltasText(deltas);
      const multText = ja
        ? `ステータス計算 x${Number(ef.potency_multiplier || 1)}`
        : `stat calc x${Number(ef.potency_multiplier || 1)}`;
      return `${deltaText}${deltaText ? " / " : ""}${multText}`;
    }
    if (type === "convert_target_stat") {
      return ja
        ? `${m(ef.target)}: ${statLabel(ef.from_stat)} → ${statLabel(ef.to_stat)}`
        : `${m(ef.target)}: ${statLabel(ef.from_stat)} -> ${statLabel(ef.to_stat)}`;
    }
    if (type === "lock_target") {
      return `${m(ef.target)} ${ja ? "固定" : "locked"}`;
    }
    if (type === "invert_with_highest") {
      return `${m(ef.target)} ${ja ? "↔ 最高値" : "↔ highest"}`;
    }
    if (type === "cascade_from_highest") {
      return ja ? "最高値除外 / 他へ分配" : "exclude highest / split to others";
    }
    if (type === "converge_to_lowest") {
      return ja ? "最下位へ収束 / 他0" : "converge to lowest / others 0";
    }
    if (type === "equalize_to_middle") {
      return ja ? "中央値へ等化" : "equalize to middle";
    }
    if (type === "nullify_lowest_changes") {
      return ja ? "最下位の変化反転" : "reverse lowest changes";
    }
    return textByLang(mod?.desc) || "";
  }

  function orderedPassiveModifiers(list) {
    const src = Array.isArray(list) ? list : [];
    const rank = { offense: 1, defense: 2, utility: 3, wildcard: 4 };
    return src
      .map((m, idx) => ({ m, idx }))
      .sort((a, b) => {
        const ga = nk(a.m && a.m.group);
        const gb = nk(b.m && b.m.group);
        const ra = Object.prototype.hasOwnProperty.call(rank, ga) ? rank[ga] : 99;
        const rb = Object.prototype.hasOwnProperty.call(rank, gb) ? rank[gb] : 99;
        if (ra !== rb) return ra - rb;
        return a.idx - b.idx;
      })
      .map((x) => x.m);
  }

  function buildViewHtml(payload) {
    const ui = t();
    const seasonId = String(payload?.current?.id || payload?.data?.season_id || "").trim();
    const seasonLabel = String(payload?.current?.label || payload?.data?.season_label || seasonId).trim();
    const activeMods = Array.isArray(payload?.data?.active_modifiers) ? payload.data.active_modifiers : [];
    const passiveMods = orderedPassiveModifiers(payload?.data?.passive_modifiers);
    const passiveIdSet = new Set(passiveMods.map((m) => String(m?.id || "").trim()).filter(Boolean));
    const activeRows = activeMods.map((m, i) => {
      const icon = activeIconPath(seasonId, m);
      const name = getLang() === "ja"
        ? (String(m?.name_ja || "").trim() || String(m?.name_en || "").trim())
        : (String(m?.name_en || "").trim() || String(m?.name_ja || "").trim());
      const desc = textByLang(m?.desc);
      const levelEffectsHtml = buildActiveLevelEffectsHtml(m);
      return `
        <tr>
          <td class="seasonmod-icon-cell">${icon ? `<img class="seasonmod-icon" src="${esc(icon)}" alt="${esc(name)}" loading="lazy" decoding="async" />` : ""}</td>
          <td>${esc(name)}</td>
          <td>${esc(desc)}${levelEffectsHtml ? `<br>${levelEffectsHtml}` : ""}</td>
        </tr>
      `;
    }).join("");

    const passiveRows = passiveMods.map((m, i) => {
      const icon = passiveIconPath(seasonId, m);
      const name = passiveOptionLabel(m);
      const desc = textByLang(m?.desc);
      const g = nk(m?.group);
      return `
        <tr class="seasonmod-passive-row seasonmod-passive-row--${esc(g)}">
          <td class="seasonmod-icon-cell">${icon ? `<img class="seasonmod-icon" src="${esc(icon)}" alt="${esc(name)}" loading="lazy" decoding="async" />` : ""}</td>
          <td>${esc(name)}</td>
          <td>${esc(desc)}</td>
        </tr>
      `;
    }).join("");

    return `
      <section class="blueprint-view seasonmod-view">
        <section class="seasonmod-section seasonmod-section--simulator">
          <div class="seasonmod-section__heading">
            <h3 class="seasonmod-section__title">${esc(ui.sectionSimulator)}</h3>
            <button id="seasonModPickerOpenBtn" type="button" class="btn btn--ghost seasonmod-picker-open-btn">${esc(ui.picker)}</button>
          </div>
          <div class="seasonmod-controls">
            <div class="field seasonmod-field seasonmod-active-group">
              <span>${esc(ui.activeModifier)}</span>
              <div class="seasonmod-active-group__grid">
                <label class="field seasonmod-field">
                  <input id="seasonModActiveSelect" type="hidden" value="" />
                  <div id="seasonModActivePicker" class="seasonmod-picker"></div>
                </label>
                <label class="field seasonmod-field seasonmod-active-level-field">
                  <select id="seasonModActiveLevel" class="seasonmod-select">
                    <option value="1">Lv1</option>
                    <option value="2">Lv2</option>
                    <option value="3">Lv3</option>
                    <option value="4">Lv4</option>
                    <option value="5" selected>Lv5</option>
                  </select>
                </label>
              </div>
            </div>
            <div class="field seasonmod-field seasonmod-passive-group">
              <span>${esc(ui.passiveSlot1)}</span>
              <div class="seasonmod-passive-group__grid">
                <label class="field seasonmod-field">
                  <input id="seasonModPassive1" type="hidden" value="" />
                  <div id="seasonModPassive1Picker" class="seasonmod-picker"></div>
                </label>
                <label class="field seasonmod-field">
                  <input id="seasonModPassive2" type="hidden" value="" />
                  <div id="seasonModPassive2Picker" class="seasonmod-picker"></div>
                </label>
                <label class="field seasonmod-field">
                  <input id="seasonModPassive3" type="hidden" value="" />
                  <div id="seasonModPassive3Picker" class="seasonmod-picker"></div>
                </label>
              </div>
            </div>
          </div>
          <div id="seasonModSimResult" class="seasonmod-result"></div>

          <div id="seasonModPickerModal" class="seasonmod-targetpicker" hidden>
            <div class="seasonmod-targetpicker__backdrop"></div>
            <div class="seasonmod-targetpicker__dialog">
              <button type="button" id="seasonModPickerCloseBtn" class="seasonmod-targetpicker__close" aria-label="${esc(ui.pickerClose)}">×</button>
              <div class="seasonmod-targetpicker__controls">
                <label class="field seasonmod-field">
                  <span>${esc(ui.pickerAddTrait)}</span>
                  <div class="seasonmod-targetpicker__addrow">
                    <select id="seasonModPickerCondSelect" class="seasonmod-select"></select>
                    <button id="seasonModPickerAddCondBtn" type="button" class="btn btn--ghost">${esc(ui.pickerAdd)}</button>
                  </div>
                </label>
              </div>
              <div class="seasonmod-targetpicker__chips-wrap">
                <div id="seasonModPickerCondChips" class="seasonmod-targetpicker__chips">${esc(ui.pickerNoCond)}</div>
              </div>
              <div id="seasonModPickerSummary" class="seasonmod-targetpicker__summary"></div>
              <div id="seasonModPickerTableWrap" class="blueprint-table-wrap" hidden>
                <div class="blueprint-table-scroll seasonmod-targetpicker__table-scroll">
                  <table class="blueprint-table seasonmod-table seasonmod-result-table seasonmod-targetpicker__table">
                    <thead>
                      <tr>
                        <th>${esc(ui.offense)}</th>
                        <th>${esc(ui.defense)}</th>
                        <th class="seasonmod-targetpicker__divider-right">${esc(ui.utility)}</th>
                        <th id="seasonModPickerHeadA1" class="seasonmod-targetpicker__divider-left">-</th>
                        <th id="seasonModPickerHeadA2">-</th>
                        <th id="seasonModPickerHeadA3">-</th>
                      </tr>
                    </thead>
                    <tbody id="seasonModPickerBody"><tr><td colspan="6">${esc(ui.noData)}</td></tr></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="seasonmod-section seasonmod-section--active">
          <details id="seasonModActiveAccordion" class="seasonmod-accordion" open>
            <summary class="seasonmod-accordion__summary">${esc(ui.sectionActive)}</summary>
            <div class="seasonmod-accordion__body">
              <section class="blueprint-table-wrap">
                <div class="blueprint-table-scroll">
                  <table class="blueprint-table seasonmod-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>${esc(ui.name)}</th>
                        <th>${esc(ui.desc)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${activeRows || `<tr><td colspan="3">${esc(ui.noData)}</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </details>
        </section>

        <section class="seasonmod-section seasonmod-section--passive">
          <details id="seasonModPassiveAccordion" class="seasonmod-accordion" open>
            <summary class="seasonmod-accordion__summary">${esc(ui.sectionPassive)}</summary>
            <div class="seasonmod-accordion__body">
              <section class="blueprint-table-wrap">
                <div class="blueprint-table-scroll">
                  <table class="blueprint-table seasonmod-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>${esc(ui.mod)}</th>
                        <th>${esc(ui.desc)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${passiveRows || `<tr><td colspan="3">${esc(ui.noData)}</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </details>
        </section>
      </section>
    `;
  }

  function bindSimulator(payload) {
    document.body.classList.remove("seasonmod-modal-open");
    document.body.style.top = "";
    const activeEl = document.getElementById("seasonModActiveSelect");
    const activeLvEl = document.getElementById("seasonModActiveLevel");
    const pickerOpenBtn = document.getElementById("seasonModPickerOpenBtn");
    const pickerModalEl = document.getElementById("seasonModPickerModal");
    const pickerCloseBtn = document.getElementById("seasonModPickerCloseBtn");
    const pickerCondSelectEl = document.getElementById("seasonModPickerCondSelect");
    const pickerAddCondBtn = document.getElementById("seasonModPickerAddCondBtn");
    const pickerCondChipsEl = document.getElementById("seasonModPickerCondChips");
    const pickerBodyEl = document.getElementById("seasonModPickerBody");
    const pickerTableWrapEl = document.getElementById("seasonModPickerTableWrap");
    const pickerTableScrollEl = pickerModalEl ? pickerModalEl.querySelector(".seasonmod-targetpicker__table-scroll") : null;
    const pickerSummaryEl = document.getElementById("seasonModPickerSummary");
    const pickerHeadA1El = document.getElementById("seasonModPickerHeadA1");
    const pickerHeadA2El = document.getElementById("seasonModPickerHeadA2");
    const pickerHeadA3El = document.getElementById("seasonModPickerHeadA3");
    const p1El = document.getElementById("seasonModPassive1");
    const p2El = document.getElementById("seasonModPassive2");
    const p3El = document.getElementById("seasonModPassive3");
    const outEl = document.getElementById("seasonModSimResult");
    const activeAccordionEl = document.getElementById("seasonModActiveAccordion");
    const passiveAccordionEl = document.getElementById("seasonModPassiveAccordion");
    if (!activeEl || !activeLvEl || !p1El || !p2El || !p3El || !outEl) return;
    const ui = t();
    const seasonData = payload.data || {};
    let passiveDedupLock = false;
    const seasonId = String(payload?.current?.id || payload?.data?.season_id || "").trim();
    const activeMods = Array.isArray(seasonData?.active_modifiers) ? seasonData.active_modifiers : [];
    const passiveMods = orderedPassiveModifiers(seasonData?.passive_modifiers);
    const activeIdSet = new Set(activeMods.map((m) => String(m?.id || "").trim()).filter(Boolean));
    const passiveIdSet = new Set(passiveMods.map((m) => String(m?.id || "").trim()).filter(Boolean));

    const passiveMap = new Map();
    passiveMods.forEach((m) => {
      const id = String(m?.id || "").trim();
      if (id) passiveMap.set(id, m);
    });
    const activeMap = new Map();
    activeMods.forEach((m) => {
      const id = String(m?.id || "").trim();
      if (id) activeMap.set(id, m);
    });
    const pickerState = {
      rows: null,
      loading: false,
      conditions: []
    };
    const PICKER_MAX_ROWS = 50;
    const PICKER_STAT_COLS = [
      "weapon_handling",
      "headshot_damage",
      "magazine_size",
      "max_armor",
      "protection_from_elites",
      "hazard_protection",
      "skill_damage",
      "skill_repair",
      "status_effects"
    ];
    const PICKER_EXCLUSIVE_GROUPS = [
      { a: ["weapon_handling"], b: ["headshot_damage", "magazine_size"] },
      { a: ["max_armor"], b: ["protection_from_elites", "hazard_protection"] },
      { a: ["skill_damage"], b: ["skill_repair", "status_effects"] }
    ];
    const PICKER_CONVERT_PAIR = {
      headshot_damage: "magazine_size",
      magazine_size: "headshot_damage",
      protection_from_elites: "hazard_protection",
      hazard_protection: "protection_from_elites",
      skill_repair: "status_effects",
      status_effects: "skill_repair"
    };
    const pickerActiveColsById = {
      blackout_pulse: ["blackout_emp_radius", "blackout_cooldown", "blackout_pulse_duration"],
      cloud_armor: ["cloud_repair_per_sec", "cloud_cooldown", "cloud_blind_duration"],
      optimize_overload: ["optimize_skill_cdr", "optimize_cooldown", "optimize_overcharge_duration"]
    };

    const loadPickerRows = async () => {
      if (Array.isArray(pickerState.rows)) return pickerState.rows;
      if (pickerState.loading) return [];
      pickerState.loading = true;
      try {
        const SQL = await initSql();
        const gz = await fetchArrayBuffer(`./data/season_mod/y8s1_passive_patterns.db.gz?ts=${Date.now()}`);
        const dbBytes = await gunzipToUint8Array(gz);
        const db = new SQL.Database(dbBytes);
        try {
          const hasTable = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='passive_patterns'").length > 0;
          if (!hasTable) throw new Error("passive_patterns table is missing");
          const stmt = db.prepare(`
            SELECT
              slot1, slot2, slot3,
              weapon_handling, headshot_damage, magazine_size,
              max_armor, protection_from_elites, hazard_protection,
              skill_damage, skill_repair, status_effects,
              blackout_emp_radius, blackout_cooldown, blackout_pulse_duration,
              cloud_repair_per_sec, cloud_cooldown, cloud_blind_duration,
              optimize_skill_cdr, optimize_cooldown, optimize_overcharge_duration
            FROM passive_patterns
          `);
          const rows = [];
          while (stmt.step()) rows.push(stmt.getAsObject());
          stmt.free();
          pickerState.rows = rows;
        } finally {
          db.close();
        }
      } finally {
        pickerState.loading = false;
      }
      return pickerState.rows || [];
    };

    const pickerActiveCols = () => {
      const id = String(activeEl.value || "");
      return pickerActiveColsById[id] || pickerActiveColsById.blackout_pulse;
    };

    const pickerTraitText = (row, moduleKey) => {
      const groups = {
        offense: ["weapon_handling", "headshot_damage", "magazine_size"],
        defense: ["max_armor", "protection_from_elites", "hazard_protection"],
        utility: ["skill_damage", "skill_repair", "status_effects"]
      };
      const cols = groups[moduleKey] || [];
      const hits = cols
        .filter((c) => Number(row[c] || 0) > 0)
        .map((c) => `${statLabel(c)} ${fmtPct(Number(row[c] || 0)).replace("%", "")}`);
      return hits.length ? hits : ["-"];
    };

    const renderPickerConditionChips = () => {
      if (!pickerCondChipsEl) return;
      if (!pickerState.conditions.length) {
        pickerCondChipsEl.textContent = ui.pickerNoCond;
        return;
      }
      pickerCondChipsEl.innerHTML = pickerState.conditions.map((c, i) => `
        <button type="button" class="seasonmod-targetpicker__chip" data-idx="${i}">
          <span>${esc(statLabel(c))}</span>
          <span class="seasonmod-targetpicker__chipx">×</span>
        </button>
      `).join("");
      Array.from(pickerCondChipsEl.querySelectorAll(".seasonmod-targetpicker__chip")).forEach((el) => {
        el.addEventListener("click", () => {
          const idx = Number(el.getAttribute("data-idx") || -1);
          if (idx < 0) return;
          pickerState.conditions.splice(idx, 1);
          renderPicker();
        });
      });
    };

    const excludedByExclusiveRule = () => {
      const selected = new Set(pickerState.conditions || []);
      const excluded = new Set();
      PICKER_EXCLUSIVE_GROUPS.forEach((g) => {
        const hasA = g.a.some((c) => selected.has(c));
        const hasB = g.b.some((c) => selected.has(c));
        if (hasA && !hasB) g.b.forEach((c) => excluded.add(c));
        if (hasB && !hasA) g.a.forEach((c) => excluded.add(c));
      });
      return excluded;
    };

    const refreshPickerCondOptions = () => {
      if (!pickerCondSelectEl) return;
      const activeCols = pickerActiveCols();
      if (pickerHeadA1El) pickerHeadA1El.textContent = statLabel(activeCols[0]);
      if (pickerHeadA2El) pickerHeadA2El.textContent = statLabel(activeCols[1]);
      if (pickerHeadA3El) pickerHeadA3El.textContent = statLabel(activeCols[2]);
      const allCols = Array.from(new Set(PICKER_STAT_COLS.concat(activeCols)));
      const excluded = excludedByExclusiveRule();
      const selectable = allCols.filter((c) => !excluded.has(c));
      pickerCondSelectEl.innerHTML = selectable.map((c) => `<option value="${esc(c)}">${esc(statLabel(c))}</option>`).join("");
    };

    const renderPicker = async () => {
      if (!pickerBodyEl) return;
      const rows = await loadPickerRows();
      const activeCols = pickerActiveCols();
      const condCols = pickerState.conditions.slice();
      if (!condCols.length) {
        if (pickerTableWrapEl) pickerTableWrapEl.hidden = true;
        if (pickerSummaryEl) pickerSummaryEl.textContent = "";
        pickerBodyEl.innerHTML = `<tr><td colspan="6">${esc(ui.noData)}</td></tr>`;
        renderPickerConditionChips();
        return;
      }
      if (pickerTableWrapEl) pickerTableWrapEl.hidden = false;
      const filtered = rows.filter((r) => condCols.every((c) => Number(r[c] || 0) > 0));
      const sortCols = condCols.length ? condCols : activeCols.slice();
      const sorted = filtered.slice().sort((a, b) => {
        for (let i = 0; i < sortCols.length; i += 1) {
          const c = sortCols[i];
          const d = Number(b[c] || 0) - Number(a[c] || 0);
          if (d !== 0) return d;
          const pair = PICKER_CONVERT_PAIR[c];
          if (pair) {
            const pd = Number(b[pair] || 0) - Number(a[pair] || 0);
            if (pd !== 0) return pd;
          }
        }
        const ak = `${a.slot1 || ""}\t${a.slot2 || ""}\t${a.slot3 || ""}`;
        const bk = `${b.slot1 || ""}\t${b.slot2 || ""}\t${b.slot3 || ""}`;
        return ak.localeCompare(bk);
      });
      const selected = [];
      const seen = new Set();
      for (let i = 0; i < sorted.length; i += 1) {
        const r = sorted[i];
        const keyCols = condCols.length ? condCols : activeCols.concat(["skill_damage"]);
        // Keep distinct trait-composition rows even when selected condition values are equal.
        // Example: same headshot value but one row also has magazine_size.
        const traitSig = [
          pickerTraitText(r, "offense"),
          pickerTraitText(r, "defense"),
          pickerTraitText(r, "utility")
        ].join("||");
        const k = `${keyCols.map((c) => String(r[c] || "")).join("|")}||${traitSig}`;
        if (seen.has(k)) continue;
        seen.add(k);
        selected.push(r);
        if (selected.length >= PICKER_MAX_ROWS) break;
      }
      if (!selected.length) {
        if (pickerSummaryEl) pickerSummaryEl.textContent = `${ui.pickerCandidates}: 0`;
        pickerBodyEl.innerHTML = `<tr><td colspan="6">${esc(ui.noData)}</td></tr>`;
      } else {
        if (pickerSummaryEl) pickerSummaryEl.textContent = `${ui.pickerCandidates}: ${selected.length}`;
        pickerBodyEl.innerHTML = selected.map((r) => `
          <tr class="seasonmod-targetpicker__row" data-slot1="${esc(r.slot1 || "")}" data-slot2="${esc(r.slot2 || "")}" data-slot3="${esc(r.slot3 || "")}">
            <td>${pickerTraitText(r, "offense").map((x) => esc(x)).join("<br>")}</td>
            <td>${pickerTraitText(r, "defense").map((x) => esc(x)).join("<br>")}</td>
            <td class="seasonmod-targetpicker__divider-right">${pickerTraitText(r, "utility").map((x) => esc(x)).join("<br>")}</td>
            <td class="seasonmod-targetpicker__divider-left">${esc(String(r[activeCols[0]] || "0"))}</td>
            <td>${esc(String(r[activeCols[1]] || "0"))}</td>
            <td>${esc(String(r[activeCols[2]] || "0"))}</td>
          </tr>
        `).join("");
        Array.from(pickerBodyEl.querySelectorAll(".seasonmod-targetpicker__row")).forEach((rowEl) => {
          rowEl.addEventListener("click", () => {
            p1El.value = String(rowEl.getAttribute("data-slot1") || "");
            p2El.value = String(rowEl.getAttribute("data-slot2") || "");
            p3El.value = String(rowEl.getAttribute("data-slot3") || "");
            [p1El, p2El, p3El].forEach((el) => el.dispatchEvent(new Event("change")));
            closePickerModal();
          });
        });
      }
      renderPickerConditionChips();
      refreshPickerCondOptions();
    };

    const activeOptionLabel = (mod) => {
      const lang = getLang();
      const ja = String(mod?.name_ja || "").trim();
      const en = String(mod?.name_en || "").trim();
      return lang === "ja" ? (ja || en || mod?.id || "") : (en || ja || mod?.id || "");
    };

    const buildActivePicker = (rootEl, inputEl) => {
      if (!rootEl || !inputEl) return;
      const uiLocal = t();
      const pickerId = rootEl.id || "";
      const buttonId = `${pickerId}Btn`;
      const listId = `${pickerId}List`;
      rootEl.tabIndex = 0;
      rootEl.innerHTML = `
        <button type="button" id="${esc(buttonId)}" class="seasonmod-picker__button" aria-expanded="false" aria-controls="${esc(listId)}"></button>
        <div id="${esc(listId)}" class="seasonmod-picker__list" hidden></div>
      `;
      const buttonEl = document.getElementById(buttonId);
      const listEl = document.getElementById(listId);
      if (!buttonEl || !listEl) return;

      const renderButton = () => {
        const id = String(inputEl.value || "");
        if (!id) {
          buttonEl.innerHTML = `<span class="seasonmod-picker__label">${esc(uiLocal.none)}</span>`;
          return;
        }
        const mod = activeMap.get(id);
        const icon = activeIconPath(seasonId, mod || { id });
        const label = mod ? activeOptionLabel(mod) : id;
        buttonEl.innerHTML = `${icon ? `<img class="seasonmod-picker__icon" src="${esc(icon)}" alt="${esc(label)}" loading="lazy" decoding="async" />` : ""}<span class="seasonmod-picker__label">${esc(label)}</span>`;
      };

      const renderList = () => {
        const current = String(inputEl.value || "");
        const rows = activeMods.map((m) => {
          const id = String(m?.id || "").trim();
          const icon = activeIconPath(seasonId, m);
          const label = activeOptionLabel(m);
          const active = current === id ? " is-active" : "";
          return `
            <button type="button" class="seasonmod-picker__option${active}" data-value="${esc(id)}">
              ${icon ? `<img class="seasonmod-picker__icon" src="${esc(icon)}" alt="${esc(label)}" loading="lazy" decoding="async" />` : ""}
              <span class="seasonmod-picker__label">${esc(label)}</span>
            </button>
          `;
        }).join("");
        listEl.innerHTML = rows;
        Array.from(listEl.querySelectorAll(".seasonmod-picker__option")).forEach((opt) => {
          opt.addEventListener("click", () => {
            const v = String(opt.getAttribute("data-value") || "");
            listEl.hidden = true;
            buttonEl.setAttribute("aria-expanded", "false");
            inputEl.value = v;
            inputEl.dispatchEvent(new Event("change"));
            renderButton();
            renderList();
            buttonEl.focus();
          });
        });
      };

      const cycleValue = (dir) => {
        const values = activeMods.map((m) => String(m?.id || "").trim()).filter(Boolean);
        if (!values.length) return;
        const cur = String(inputEl.value || "");
        const idx = Math.max(0, values.indexOf(cur));
        let nextIdx = idx + (dir > 0 ? 1 : -1);
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx >= values.length) nextIdx = values.length - 1;
        if (nextIdx === idx) return;
        inputEl.value = values[nextIdx];
        inputEl.dispatchEvent(new Event("change"));
      };

      buttonEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !!listEl.hidden;
        document.querySelectorAll(".seasonmod-picker__list").forEach((el) => {
          el.hidden = true;
        });
        document.querySelectorAll(".seasonmod-picker__button[aria-expanded='true']").forEach((el) => {
          el.setAttribute("aria-expanded", "false");
        });
        listEl.hidden = !willOpen;
        buttonEl.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });

      buttonEl.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "ArrowDown") {
          e.preventDefault();
          cycleValue(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          cycleValue(-1);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          buttonEl.click();
        }
      });

      rootEl.addEventListener("keydown", (e) => {
        if (e.target === buttonEl) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          cycleValue(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          cycleValue(-1);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          buttonEl.click();
        }
      });

      rootEl.addEventListener("click", () => {
        if (document.activeElement !== buttonEl) buttonEl.focus();
      });

      rootEl.__refresh = () => {
        renderButton();
        renderList();
      };
      rootEl.__refresh();
    };

    const buildPassivePicker = (rootEl, inputEl) => {
      if (!rootEl || !inputEl) return;
      const uiLocal = t();
      const pickerId = rootEl.id || "";
      const buttonId = `${pickerId}Btn`;
      const listId = `${pickerId}List`;
      rootEl.tabIndex = 0;
      rootEl.innerHTML = `
        <button type="button" id="${esc(buttonId)}" class="seasonmod-picker__button" aria-expanded="false" aria-controls="${esc(listId)}"></button>
        <div id="${esc(listId)}" class="seasonmod-picker__list" hidden></div>
      `;
      const buttonEl = document.getElementById(buttonId);
      const listEl = document.getElementById(listId);
      if (!buttonEl || !listEl) return;

      const renderButton = () => {
        const id = String(inputEl.value || "");
        if (!id) {
          buttonEl.innerHTML = `<span class="seasonmod-picker__label">${esc(uiLocal.none)}</span>`;
          return;
        }
        const mod = passiveMap.get(id);
        const icon = passiveIconPath(seasonId, mod || { id });
        const label = mod ? passiveOptionLabel(mod) : id;
        buttonEl.innerHTML = `${icon ? `<img class="seasonmod-picker__icon" src="${esc(icon)}" alt="${esc(label)}" loading="lazy" decoding="async" />` : ""}<span class="seasonmod-picker__label">${esc(label)}</span>`;
      };

      const renderList = () => {
        const current = String(inputEl.value || "");
        const simApi = window.SeasonModSimulator;
        const canSim = !!(simApi && typeof simApi.simulateLoadout === "function");
        const basePassiveIds = [String(p1El.value || ""), String(p2El.value || ""), String(p3El.value || "")];
        const baseResult = canSim
          ? simApi.simulateLoadout(seasonData, {
            active_modifier_id: String(activeEl.value || ""),
            active_level: Number(activeLvEl.value || 1),
            passive_modifier_ids: basePassiveIds
          })
          : null;
        const beforeStacks = (baseResult && baseResult.state && baseResult.state.stacks) || {};
        const slotIndex = inputEl === p1El ? 0 : (inputEl === p2El ? 1 : 2);
        const stackImpactParts = (candidateId) => {
          if (!canSim) return "";
          const testIds = [String(p1El.value || ""), String(p2El.value || ""), String(p3El.value || "")];
          testIds[slotIndex] = String(candidateId || "");
          const r = simApi.simulateLoadout(seasonData, {
            active_modifier_id: String(activeEl.value || ""),
            active_level: Number(activeLvEl.value || 1),
            passive_modifier_ids: testIds
          });
          const after = (r && r.state && r.state.stacks) || {};
          const mk = (k) => {
            const b = Number(beforeStacks[k] || 0);
            const a = Number(after[k] || 0);
            const d = a - b;
            return { key: k, value: a, delta: d };
          };
          return [mk("offense"), mk("defense"), mk("utility")];
        };
        const impactHtml = (candidateId) => {
          const parts = stackImpactParts(candidateId);
          if (!Array.isArray(parts) || !parts.length) return "";
          const cells = parts.map((p) => {
            const deltaText = p.delta ? `[${p.delta > 0 ? `+${p.delta}` : String(p.delta)}]` : "";
            const deltaCls = p.delta > 0 ? "seasonmod-picker__impact-delta is-plus"
              : p.delta < 0 ? "seasonmod-picker__impact-delta is-minus"
                : "seasonmod-picker__impact-delta";
            return `<span class="seasonmod-picker__impact-chip seasonmod-picker__impact-chip--${esc(p.key)}"><span class="seasonmod-picker__impact-val">${esc(String(p.value))}</span>${deltaText ? `<span class="${deltaCls}">${esc(deltaText)}</span>` : ""}</span>`;
          }).join("");
          return `<span class="seasonmod-picker__impact">${cells}</span>`;
        };
        const noneRow = `
          <button type="button" class="seasonmod-picker__option${current === "" ? " is-active" : ""}" data-value="">
            <span class="seasonmod-picker__icon seasonmod-picker__icon--empty" aria-hidden="true"></span>
            <span class="seasonmod-picker__option-main">
              <span class="seasonmod-picker__label">${esc(uiLocal.none)}</span>
              ${canSim ? impactHtml("") : ""}
            </span>
          </button>
        `;
        const rows = passiveMods.map((m) => {
          const id = String(m?.id || "").trim();
          const icon = passiveIconPath(seasonId, m);
          const label = passiveOptionLabel(m);
          const preview = passiveOptionPreview(m);
          const impact = impactHtml(id);
          const active = current === id ? " is-active" : "";
          return `
            <button type="button" class="seasonmod-picker__option seasonmod-picker__option--${esc(nk(m?.group))}${active}" data-value="${esc(id)}">
              ${icon ? `<img class="seasonmod-picker__icon" src="${esc(icon)}" alt="${esc(label)}" loading="lazy" decoding="async" />` : ""}
              <span class="seasonmod-picker__option-main">
                <span class="seasonmod-picker__label">${esc(label)}</span>
                ${preview ? `<span class="seasonmod-picker__meta">${esc(preview)}</span>` : ""}
                ${impact || ""}
              </span>
            </button>
          `;
        }).join("");
        listEl.innerHTML = `${noneRow}${rows}`;
        Array.from(listEl.querySelectorAll(".seasonmod-picker__option")).forEach((opt) => {
          opt.addEventListener("click", () => {
            const v = String(opt.getAttribute("data-value") || "");
            listEl.hidden = true;
            buttonEl.setAttribute("aria-expanded", "false");
            inputEl.value = v;
            inputEl.dispatchEvent(new Event("change"));
            renderButton();
            renderList();
            buttonEl.focus();
          });
        });
        const activeOpt = listEl.querySelector(".seasonmod-picker__option.is-active");
        if (activeOpt && !listEl.hidden) {
          try {
            activeOpt.scrollIntoView({ block: "nearest" });
          } catch (_e) {
            // ignore scroll failures
          }
        }
      };

      const getEnabledOptionValues = () => {
        const mine = String(inputEl.value || "");
        const selectedOthers = new Set(
          [String(p1El.value || ""), String(p2El.value || ""), String(p3El.value || "")]
            .filter((v) => v && v !== mine)
        );
        const values = [""];
        passiveMods.forEach((m) => {
          const id = String(m?.id || "").trim();
          if (!id) return;
          const isDisabled = selectedOthers.has(id);
          if (!isDisabled) values.push(id);
        });
        return values;
      };

      const cycleValue = (dir) => {
        const values = getEnabledOptionValues();
        if (!values.length) return;
        const cur = String(inputEl.value || "");
        const idx = Math.max(0, values.indexOf(cur));
        let nextIdx = idx + (dir > 0 ? 1 : -1);
        if (nextIdx < 0) nextIdx = 0;
        if (nextIdx >= values.length) nextIdx = values.length - 1;
        if (nextIdx === idx) return;
        inputEl.value = values[nextIdx];
        inputEl.dispatchEvent(new Event("change"));
      };

      buttonEl.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !!listEl.hidden;
        document.querySelectorAll(".seasonmod-picker__list").forEach((el) => {
          el.hidden = true;
        });
        document.querySelectorAll(".seasonmod-picker__button[aria-expanded='true']").forEach((el) => {
          el.setAttribute("aria-expanded", "false");
        });
        listEl.hidden = !willOpen;
        buttonEl.setAttribute("aria-expanded", willOpen ? "true" : "false");
      });

      buttonEl.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "ArrowDown") {
          e.preventDefault();
          cycleValue(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          cycleValue(-1);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          buttonEl.click();
        }
      });

      rootEl.addEventListener("keydown", (e) => {
        if (e.target === buttonEl) return;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          cycleValue(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          cycleValue(-1);
          return;
        }
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          buttonEl.click();
        }
      });

      rootEl.addEventListener("click", () => {
        if (document.activeElement !== buttonEl) buttonEl.focus();
      });

      rootEl.__refresh = () => {
        renderButton();
        renderList();
      };
      rootEl.__refresh();
    };

    const picker1 = document.getElementById("seasonModPassive1Picker");
    const picker2 = document.getElementById("seasonModPassive2Picker");
    const picker3 = document.getElementById("seasonModPassive3Picker");
    const activePicker = document.getElementById("seasonModActivePicker");
    if (!String(activeEl.value || "").trim() && activeMods.length) {
      activeEl.value = String(activeMods[0]?.id || "").trim();
    }
    buildActivePicker(activePicker, activeEl);
    buildPassivePicker(picker1, p1El);
    buildPassivePicker(picker2, p2El);
    buildPassivePicker(picker3, p3El);
    refreshPickerCondOptions();
    let pickerBodyLockScrollY = 0;
    const openPickerModal = async () => {
      if (!pickerModalEl) return;
      pickerBodyLockScrollY = window.scrollY || window.pageYOffset || 0;
      document.body.classList.add("seasonmod-modal-open");
      document.body.style.top = `-${pickerBodyLockScrollY}px`;
      pickerModalEl.hidden = false;
      refreshPickerCondOptions();
      await renderPicker();
    };
    const closePickerModal = () => {
      if (!pickerModalEl) return;
      pickerModalEl.hidden = true;
      const prevY = pickerBodyLockScrollY || 0;
      document.body.classList.remove("seasonmod-modal-open");
      document.body.style.top = "";
      window.scrollTo(0, prevY);
    };

    if (pickerOpenBtn && pickerModalEl) {
      pickerOpenBtn.addEventListener("click", async () => {
        await openPickerModal();
      });
    }
    if (pickerCloseBtn && pickerModalEl) {
      pickerCloseBtn.addEventListener("click", () => {
        closePickerModal();
      });
    }
    if (pickerModalEl) {
      pickerModalEl.addEventListener("click", (e) => {
        if (e.target === pickerModalEl || (e.target && e.target.classList && e.target.classList.contains("seasonmod-targetpicker__backdrop"))) {
          closePickerModal();
        }
      });
    }
    if (pickerTableScrollEl) {
      pickerTableScrollEl.addEventListener("wheel", (e) => {
        e.stopPropagation();
      }, { passive: true });
      pickerTableScrollEl.addEventListener("touchmove", (e) => {
        e.stopPropagation();
      }, { passive: true });
    }
    if (pickerAddCondBtn && pickerCondSelectEl) {
      pickerAddCondBtn.addEventListener("click", async () => {
        const c = String(pickerCondSelectEl.value || "").trim();
        if (!c) return;
        if (pickerState.conditions.includes(c)) return;
        pickerState.conditions.push(c);
        await renderPicker();
      });
    }

    const readStateFromUrl = () => {
      let q = null;
      try {
        q = new URLSearchParams(window.location.search || "");
      } catch (_e) {
        q = null;
      }
      if (!q) return;
      const a = String(q.get(SEASON_MOD_URL_KEYS.active) || "").trim();
      const lvRaw = String(q.get(SEASON_MOD_URL_KEYS.level) || "").trim();
      const p1 = String(q.get(SEASON_MOD_URL_KEYS.passive1) || "").trim();
      const p2 = String(q.get(SEASON_MOD_URL_KEYS.passive2) || "").trim();
      const p3 = String(q.get(SEASON_MOD_URL_KEYS.passive3) || "").trim();
      const ao = String(q.get(SEASON_MOD_URL_KEYS.activeOpen) || "").trim();
      const po = String(q.get(SEASON_MOD_URL_KEYS.passiveOpen) || "").trim();

      if (a && activeIdSet.has(a)) activeEl.value = a;
      const lvNum = Number(lvRaw || "0");
      if (Number.isFinite(lvNum) && lvNum >= 1 && lvNum <= 5) activeLvEl.value = String(Math.floor(lvNum));
      p1El.value = (p1 && passiveIdSet.has(p1)) ? p1 : "";
      p2El.value = (p2 && passiveIdSet.has(p2)) ? p2 : "";
      p3El.value = (p3 && passiveIdSet.has(p3)) ? p3 : "";
      if (activeAccordionEl && (ao === "0" || ao === "1")) activeAccordionEl.open = ao === "1";
      if (passiveAccordionEl && (po === "0" || po === "1")) passiveAccordionEl.open = po === "1";

      // De-duplicate (keep earlier slot priority on initial restore).
      const seen = new Set();
      [p1El, p2El, p3El].forEach((el) => {
        const v = String(el.value || "");
        if (!v) return;
        if (seen.has(v)) el.value = "";
        else seen.add(v);
      });
    };

    const writeStateToUrl = () => {
      const updates = {
        [SEASON_MOD_URL_KEYS.active]: String(activeEl.value || "").trim() || null,
        [SEASON_MOD_URL_KEYS.level]: String(activeLvEl.value || "").trim() || null,
        [SEASON_MOD_URL_KEYS.passive1]: String(p1El.value || "").trim() || null,
        [SEASON_MOD_URL_KEYS.passive2]: String(p2El.value || "").trim() || null,
        [SEASON_MOD_URL_KEYS.passive3]: String(p3El.value || "").trim() || null,
        [SEASON_MOD_URL_KEYS.activeOpen]: activeAccordionEl ? (activeAccordionEl.open ? "1" : "0") : null,
        [SEASON_MOD_URL_KEYS.passiveOpen]: passiveAccordionEl ? (passiveAccordionEl.open ? "1" : "0") : null
      };
      if (typeof replaceUrlParams === "function") {
        replaceUrlParams(updates);
        return;
      }
      try {
        const p = new URLSearchParams(window.location.search || "");
        Object.keys(updates).forEach((k) => {
          const v = updates[k];
          if (v == null || v === "") p.delete(k);
          else p.set(k, v);
        });
        const next = `${window.location.pathname}?${p.toString()}${window.location.hash || ""}`;
        history.replaceState(null, "", next);
      } catch (_e) {
        // ignore URL update failures
      }
    };
    const syncResultRowHeights = () => {
      if (!outEl) return;
      const grid = outEl.querySelector(".seasonmod-result-grid");
      if (!grid) return;
      const bodies = Array.from(grid.querySelectorAll("table tbody"));
      if (!bodies.length) return;

      const allRows = bodies.map((tb) => Array.from(tb.querySelectorAll("tr")));
      const maxLen = allRows.reduce((m, rows) => Math.max(m, rows.length), 0);

      allRows.forEach((rows) => {
        rows.forEach((r) => { r.style.height = ""; });
      });

      for (let i = 0; i < maxLen; i += 1) {
        let h = 0;
        for (let tIdx = 0; tIdx < allRows.length; tIdx += 1) {
          const row = allRows[tIdx][i];
          if (!row) continue;
          h = Math.max(h, row.getBoundingClientRect().height);
        }
        if (!h) continue;
        for (let tIdx = 0; tIdx < allRows.length; tIdx += 1) {
          const row = allRows[tIdx][i];
          if (!row) continue;
          row.style.height = `${Math.ceil(h)}px`;
        }
      }
    };

    const renderResult = () => {
      const simApi = window.SeasonModSimulator;
      if (!simApi || typeof simApi.simulateLoadout !== "function") {
        outEl.innerHTML = `<p class="event-empty">SeasonModSimulator is not available.</p>`;
        return;
      }
      const passiveIds = [p1El.value, p2El.value, p3El.value].filter(Boolean);
      const result = simApi.simulateLoadout(seasonData, {
        active_modifier_id: String(activeEl.value || ""),
        active_level: Number(activeLvEl.value || 1),
        passive_modifier_ids: passiveIds
      });
      const st = result?.state || {};
      const stacks = st.stacks || {};
      const baseStacks = st.baseStacks || {};
      const potency = st.potency || {};
      const statMode = st.statMode || {};
      const activeMode = st.activeMode || {};
      const conversions = st.conversions || {};
      const stackEffects = (seasonData && seasonData.module_stack_effects) || {};
      const stackRows = ["offense", "defense", "utility"].map((k) => {
        const b = Number(baseStacks[k] || 0);
        const f = Number(stacks[k] || 0);
        const d = f - b;
        return {
          key: k,
          moduleLabel: moduleLabel(k),
          stackValue: f,
          baseValue: b
        };
      });

      const buffRows = ["offense", "defense", "utility"].map((k) => {
        const fRaw = Number(stacks[k] || 0);
        const f = Math.max(0, fRaw);
        const baseDef = stackEffects[k] || {};
        const convList = Array.isArray(conversions[k]) ? conversions[k] : [];
        const p = Number(potency[k] || 1);
        const mode = String(statMode[k] || "");
        const aMode = String(activeMode[k] || "");
        let effectText = "";
        let effectLines = [];
        if (mode === "disabled" || aMode === "ignored_by_cascade") {
          effectText = ui.noStatBuff;
          effectLines = [ui.noStatBuff];
        } else {
          if (convList.length > 0) {
            convList.forEach((conv) => {
              const rate = Number(conv?.base_rate_percent_per_stack || 0) * p;
              const stat = String(conv?.to_stat || "");
              if (!stat || !Number.isFinite(rate) || rate === 0) return;
              const total = f * rate;
              effectLines.push(`+${fmtPct(total)} ${statLabel(stat)} (${fmtPct(rate)} ${ui.perStack})`);
            });
          } else {
            const rate = Number(baseDef.rate_percent_per_stack || 0) * p;
            const stat = String(baseDef.stat || "");
            if (stat && Number.isFinite(rate) && rate !== 0) {
              const total = f * rate;
              effectLines.push(`+${fmtPct(total)} ${statLabel(stat)} (${fmtPct(rate)} ${ui.perStack})`);
            }
          }
          effectText = effectLines.length ? effectLines.join(" / ") : ui.noStatBuff;
          if (!effectLines.length) effectLines = [ui.noStatBuff];
        }
        return {
          key: k,
          effectText,
          effectLines
        };
      });

      const buffByKey = new Map(buffRows.map((r) => [r.key, r]));
      const mergedRows = stackRows.map((r) => {
        const b = buffByKey.get(r.key);
        return `
          <tr>
            <td>${esc(r.moduleLabel)}</td>
            <td>${esc(String(r.stackValue))} <span class="seasonmod-stack-base">[${esc(String(r.baseValue))}]</span></td>
            <td>${(b && Array.isArray(b.effectLines) && b.effectLines.length)
              ? b.effectLines.map((line) => esc(line)).join("<br>")
              : "-"}</td>
          </tr>
        `;
      }).join("");

      const derivedRows = buildActiveDerivedRows(result.active_modifier_id, result.active_level, stacks, activeMode)
        .map((r) => `<tr><td>${esc(String(r[0] || ""))}</td><td>${esc(String(r[1] || ""))}</td><td>${esc(String(r[2] || "-"))}</td></tr>`)
        .join("");
      const selectedPassiveIds = [String(p1El.value || ""), String(p2El.value || ""), String(p3El.value || "")];
      const selectedRows = [
        { id: selectedPassiveIds[0], effect: "-" },
        { id: selectedPassiveIds[1], effect: "-" },
        { id: selectedPassiveIds[2], effect: "-" }
      ].map((row) => {
        const modDef = passiveMap.get(row.id);
        const nm = modDef ? passiveOptionLabel(modDef) : "-";
        const icon = modDef ? passiveIconPath(seasonId, modDef) : "";
        const modHtml = modDef
          ? `<span class="seasonmod-modcell">${icon ? `<img class="seasonmod-picker__icon" src="${esc(icon)}" alt="${esc(nm)}" loading="lazy" decoding="async">` : ""}<span class="seasonmod-picker__label">${esc(nm)}</span></span>`
          : "-";
        const ef = modDef ? (textByLang(modDef?.desc) || "-") : "-";
        return { id: row.id, name: nm, modHtml, effect: ef };
      });
      const selectedRowsHtml = selectedRows.map((row, idx) => `
        <tr>
          <td>${row.modHtml || "-"}</td>
          <td class="seasonmod-selected-desc">${esc(row.effect || "-")}</td>
        </tr>
      `).join("");
      const dropped = Array.isArray(result.dropped_passive_modifier_ids) ? result.dropped_passive_modifier_ids : [];
      const duped = Array.isArray(result.duplicate_passive_modifier_ids) ? result.duplicate_passive_modifier_ids : [];
      const droppedHtml = dropped.length
        ? `<div class="seasonmod-note">${esc(ui.dropped)}: ${esc(dropped.join(", "))}</div>`
        : "";
      const dupedHtml = duped.length
        ? `<div class="seasonmod-note">${esc(ui.duplicated)}: ${esc(duped.join(", "))}</div>`
        : "";
      outEl.innerHTML = `
        <div class="seasonmod-result-grid">
          <section class="blueprint-table-wrap">
            <div class="blueprint-table-scroll">
              <table class="blueprint-table seasonmod-table seasonmod-result-table seasonmod-active-derived-table">
                <thead>
                  <tr>
                    <th>${esc(ui.activeDerived)}</th>
                    <th>${esc(ui.result)}</th>
                    <th>${esc(ui.formula)}</th>
                  </tr>
                </thead>
                <tbody>${derivedRows || `<tr><td colspan="3">-</td></tr>`}</tbody>
              </table>
            </div>
          </section>
          <section class="blueprint-table-wrap">
            <div class="blueprint-table-scroll">
              <table class="blueprint-table seasonmod-table seasonmod-result-table">
                <thead>
                  <tr>
                    <th>${esc(ui.module)}</th>
                    <th>${esc(ui.stackValue)}</th>
                    <th>${esc(ui.result)}</th>
                  </tr>
                </thead>
                <tbody>${mergedRows || `<tr><td colspan="3">-</td></tr>`}</tbody>
              </table>
            </div>
          </section>
          <section class="blueprint-table-wrap">
            <div class="blueprint-table-scroll">
              <table class="blueprint-table seasonmod-table seasonmod-result-table seasonmod-selected-table">
                <thead>
                  <tr>
                    <th>${esc(ui.mod)}</th>
                    <th>${esc(ui.desc)}</th>
                  </tr>
                </thead>
                <tbody>${selectedRowsHtml || `<tr><td colspan="2">-</td></tr>`}</tbody>
              </table>
            </div>
          </section>
        </div>
        ${droppedHtml}
        ${dupedHtml}
      `;
      requestAnimationFrame(syncResultRowHeights);
    };

    [activeEl, activeLvEl, p1El, p2El, p3El].forEach((el) => {
      el.addEventListener("change", renderResult);
      el.addEventListener("change", writeStateToUrl);
    });
    activeEl.addEventListener("change", () => {
      if (activePicker && typeof activePicker.__refresh === "function") activePicker.__refresh();
      refreshPickerCondOptions();
      if (pickerModalEl && !pickerModalEl.hidden) {
        renderPicker();
      }
      writeStateToUrl();
    });
    if (activeAccordionEl) activeAccordionEl.addEventListener("toggle", writeStateToUrl);
    if (passiveAccordionEl) passiveAccordionEl.addEventListener("toggle", writeStateToUrl);
    if (!window.__seasonModRowSyncResizeBound) {
      window.addEventListener("resize", () => {
        const root = document.getElementById("content");
        if (!root || !root.querySelector(".seasonmod-result-grid")) return;
        requestAnimationFrame(() => {
          const grid = root.querySelector(".seasonmod-result-grid");
          if (!grid) return;
          const bodies = Array.from(grid.querySelectorAll("table tbody"));
          const allRows = bodies.map((tb) => Array.from(tb.querySelectorAll("tr")));
          const maxLen = allRows.reduce((m, rows) => Math.max(m, rows.length), 0);
          allRows.forEach((rows) => rows.forEach((r) => { r.style.height = ""; }));
          for (let i = 0; i < maxLen; i += 1) {
            let h = 0;
            for (let t = 0; t < allRows.length; t += 1) {
              const row = allRows[t][i];
              if (!row) continue;
              h = Math.max(h, row.getBoundingClientRect().height);
            }
            if (!h) continue;
            for (let t = 0; t < allRows.length; t += 1) {
              const row = allRows[t][i];
              if (!row) continue;
              row.style.height = `${Math.ceil(h)}px`;
            }
          }
        });
      });
      window.__seasonModRowSyncResizeBound = true;
    }
    const syncDuplicateDisabled = () => {
      const values = [String(p1El.value || ""), String(p2El.value || ""), String(p3El.value || "")];
      const roots = [picker1, picker2, picker3];
      roots.forEach((root, idx) => {
        if (!root) return;
        const mine = values[idx];
        const selectedOthers = new Set(values.filter((v, i) => i !== idx && v));
        Array.from(root.querySelectorAll(".seasonmod-picker__option")).forEach((opt) => {
          const v = String(opt.getAttribute("data-value") || "");
          const disabled = !!(v && selectedOthers.has(v) && v !== mine);
          opt.disabled = disabled;
          opt.classList.toggle("is-disabled", disabled);
        });
      });
    };
    [p1El, p2El, p3El].forEach((el) => {
      el.addEventListener("change", () => {
        if (passiveDedupLock) return;
        const v = String(el.value || "");
        if (!v) return;
        let changed = false;
        passiveDedupLock = true;
        [p1El, p2El, p3El].forEach((other) => {
          if (other === el) return;
          if (String(other.value || "") === v) {
            other.value = "";
            changed = true;
          }
        });
        passiveDedupLock = false;
      if (changed) {
          [activePicker, picker1, picker2, picker3].forEach((r) => {
            if (r && typeof r.__refresh === "function") r.__refresh();
          });
          syncDuplicateDisabled();
          renderResult();
          writeStateToUrl();
        }
      });
      el.addEventListener("change", syncDuplicateDisabled);
      el.addEventListener("change", () => {
        [activePicker, picker1, picker2, picker3].forEach((r) => {
          if (r && typeof r.__refresh === "function") r.__refresh();
        });
      });
    });
    if (!window.__seasonModPickerOutsideBound) {
      document.addEventListener("click", () => {
        document.querySelectorAll(".seasonmod-picker__list").forEach((el) => {
          el.hidden = true;
        });
        document.querySelectorAll(".seasonmod-picker__button[aria-expanded='true']").forEach((el) => {
          el.setAttribute("aria-expanded", "false");
        });
      });
      window.__seasonModPickerOutsideBound = true;
    }

    readStateFromUrl();
    [activePicker, picker1, picker2, picker3].forEach((r) => {
      if (r && typeof r.__refresh === "function") r.__refresh();
    });
    syncDuplicateDisabled();
    renderResult();
    writeStateToUrl();
  }

  window.seasonModViewRender = async function seasonModViewRender() {
    const ui = t();
    if (typeof setStatus === "function") setStatus(ui.loading);
    try {
      const payload = await loadSeasonModData();
      setContentHtml(buildViewHtml(payload));
      bindSimulator(payload);
      if (typeof setStatus === "function") setStatus("");
    } catch (err) {
      setContentHtml(`<section class="seasonmod-view"><p class="event-empty">${esc(ui.failed)}</p></section>`);
      if (typeof setStatus === "function") setStatus(`${ui.failed} ${err?.message || ""}`.trim());
    }
  };
})();
