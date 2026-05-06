(function () {
  const MODULES = ["offense", "defense", "utility"];

  function toNum(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function roundHalfAwayFromZero(v) {
    const n = toNum(v, 0);
    if (n >= 0) return Math.floor(n + 0.5);
    return -Math.floor(Math.abs(n) + 0.5);
  }

  function cloneObj(o) {
    return JSON.parse(JSON.stringify(o));
  }

  function otherModules(target) {
    return MODULES.filter((m) => m !== target);
  }

  function createState(baseStacks) {
    const base = baseStacks || {};
    const state = {
      modules: MODULES.slice(),
      baseStacks: {},
      stacks: {},
      locked: {},
      potency: {},
      statMode: {},
      activeMode: {},
      conversions: {},
      delta: {}
    };
    MODULES.forEach((m) => {
      const b = toNum(base[m], 0);
      state.baseStacks[m] = b;
      state.stacks[m] = b;
      state.locked[m] = false;
      state.potency[m] = 1;
      state.statMode[m] = "default";
      state.activeMode[m] = "default";
      state.conversions[m] = [];
      state.delta[m] = { normal: 0, invert: 0 };
    });
    return state;
  }

  function changeStack(state, moduleName, delta, sourceType, ignoreLock) {
    if (!MODULES.includes(moduleName)) return 0;
    if (state.locked[moduleName] && !ignoreLock) return 0;
    const prev = toNum(state.stacks[moduleName], 0);
    // Allow temporary negative stacks during sequential modifier resolution.
    // Some in-game combinations (e.g. split -> compress -> nullify) depend on this.
    // Module stacks are integer-only in game behavior; always round after each operation.
    const next = roundHalfAwayFromZero(prev + toNum(delta, 0));
    const actual = next - prev;
    if (!actual) return 0;
    state.stacks[moduleName] = next;
    if (sourceType === "invert_with_highest") state.delta[moduleName].invert += actual;
    else state.delta[moduleName].normal += actual;
    return actual;
  }

  function setStack(state, moduleName, nextValue, sourceType, ignoreLock) {
    if (!MODULES.includes(moduleName)) return 0;
    return changeStack(state, moduleName, toNum(nextValue, 0) - toNum(state.stacks[moduleName], 0), sourceType, ignoreLock);
  }

  function uniqueHighest(state) {
    const vals = MODULES.map((m) => ({ m, v: toNum(state.stacks[m], 0) }));
    vals.sort((a, b) => b.v - a.v);
    if (vals.length < 2) return null;
    if (vals[0].v === vals[1].v) return null;
    return vals[0].m;
  }

  function uniqueLowest(state) {
    const vals = MODULES.map((m) => ({ m, v: toNum(state.stacks[m], 0) }));
    vals.sort((a, b) => a.v - b.v);
    if (vals.length < 2) return null;
    if (vals[0].v === vals[1].v) return null;
    return vals[0].m;
  }

  function middleValueIfDistinct(state) {
    const vals = MODULES.map((m) => toNum(state.stacks[m], 0)).sort((a, b) => a - b);
    if (vals.length !== 3) return null;
    if (vals[0] === vals[1] || vals[1] === vals[2]) return null;
    return vals[1];
  }

  function applyEffect(state, effect, logEntry) {
    const ef = effect || {};
    const t = ef.target;
    const type = String(ef.type || "");
    let applied = false;

    if (type === "add_target") {
      applied = !!changeStack(state, t, toNum(ef.value, 0), type, false);
    } else if (type === "add_target_and_subtract_others") {
      const a = changeStack(state, t, toNum(ef.target_add, 0), type, false);
      const others = otherModules(t);
      const b = others.reduce((sum, m) => sum + Math.abs(changeStack(state, m, -toNum(ef.others_subtract, 0), type, false)), 0);
      applied = !!(a || b);
    } else if (type === "saturate_target") {
      const a = changeStack(state, t, toNum(ef.value, 0), type, false);
      state.statMode[t] = "disabled";
      state.conversions[t] = [];
      applied = !!a || true;
    } else if (type === "pivot_to_lowest") {
      const low = uniqueLowest(state);
      if (low && low !== t) {
        const a = changeStack(state, low, toNum(ef.lowest_add, 0), type, false);
        const b = changeStack(state, t, -toNum(ef.target_subtract, 0), type, false);
        applied = !!(a || b);
      }
    } else if (type === "split_from_target") {
      const a = changeStack(state, t, -toNum(ef.target_subtract, 0), type, false);
      const others = otherModules(t);
      const b = others.reduce((sum, m) => sum + Math.abs(changeStack(state, m, toNum(ef.others_add, 0), type, false)), 0);
      applied = !!(a || b);
    } else if (type === "compress_target") {
      const a = changeStack(state, t, -toNum(ef.target_subtract, 0), type, false);
      state.potency[t] = toNum(ef.potency_multiplier, 1);
      applied = !!a || true;
    } else if (type === "convert_target_stat") {
      // Saturate has higher priority: once a module is disabled, convert cannot re-enable stat scaling.
      if (state.statMode[t] !== "disabled") {
        state.statMode[t] = "converted";
        state.conversions[t].push({
          from_stat: ef.from_stat || "",
          to_stat: ef.to_stat || "",
          base_rate_percent_per_stack: toNum(ef.base_rate_percent_per_stack, 0)
        });
      }
      applied = true;
    } else if (type === "lock_target") {
      state.locked[t] = true;
      applied = true;
    } else if (type === "invert_with_highest") {
      const high = uniqueHighest(state);
      if (high && high !== t && !state.locked[t] && !state.locked[high]) {
        const tv = toNum(state.stacks[t], 0);
        const hv = toNum(state.stacks[high], 0);
        setStack(state, t, hv, type, false);
        setStack(state, high, tv, type, false);
        applied = true;
      }
    } else if (type === "cascade_from_highest") {
      const high = uniqueHighest(state);
      if (high) {
        const v = toNum(state.stacks[high], 0);
        // In-game behavior: use integer stack deltas for cascade-derived additions (e.g. 52.5 -> 53).
        const addVal = roundHalfAwayFromZero(v * toNum(ef.split_ratio, 0.5));
        otherModules(high).forEach((m) => changeStack(state, m, addVal, type, false));
        state.statMode[high] = "ignored_by_cascade";
        state.activeMode[high] = "ignored_by_cascade";
        applied = true;
      }
    } else if (type === "converge_to_lowest") {
      const low = uniqueLowest(state);
      if (low) {
        const others = otherModules(low);
        const avg = (toNum(state.stacks[others[0]], 0) + toNum(state.stacks[others[1]], 0)) / 2;
        changeStack(state, low, avg, type, false);
        setStack(state, others[0], 0, type, false);
        setStack(state, others[1], 0, type, false);
        applied = true;
      }
    } else if (type === "equalize_to_middle") {
      const mid = middleValueIfDistinct(state);
      if (mid != null) {
        MODULES.forEach((m) => setStack(state, m, mid, type, false));
        applied = true;
      }
    } else if (type === "nullify_lowest_changes") {
      const low = uniqueLowest(state);
      if (low) {
        const normalDelta = toNum(state.delta[low] && state.delta[low].normal, 0);
        if (normalDelta) {
          changeStack(state, low, -2 * normalDelta, type, false);
          applied = true;
        }
      }
    }

    if (logEntry) logEntry.applied = applied;
    return applied;
  }

  function findModifierById(seasonData, modifierId) {
    const list = (seasonData && seasonData.passive_modifiers) || [];
    for (let i = 0; i < list.length; i += 1) {
      const mod = list[i];
      if (mod && mod.id === modifierId) return mod;
    }
    return null;
  }

  function findActiveModifierById(seasonData, activeModifierId) {
    const list = (seasonData && seasonData.active_modifiers) || [];
    for (let i = 0; i < list.length; i += 1) {
      const mod = list[i];
      if (mod && mod.id === activeModifierId) return mod;
    }
    return null;
  }

  function simulatePassiveModifiers(seasonData, modifierIds, options) {
    const opts = options || {};
    const state = createState(opts.baseStacks || (seasonData && seasonData.base_stacks) || {});
    const seq = Array.isArray(modifierIds) ? modifierIds : [];
    const log = [];

    for (let i = 0; i < seq.length; i += 1) {
      const id = seq[i];
      const mod = findModifierById(seasonData, id);
      if (!mod || !mod.effect) {
        log.push({ id, applied: false, reason: "modifier_not_found", before: cloneObj(state.stacks), after: cloneObj(state.stacks) });
        continue;
      }
      const entry = {
        id: mod.id,
        name_en: mod.name_en || "",
        group: mod.group || "",
        effect_type: mod.effect.type || "",
        applied: false,
        before: cloneObj(state.stacks),
        after: null
      };
      applyEffect(state, mod.effect, entry);
      entry.after = cloneObj(state.stacks);
      log.push(entry);
    }

    return { state, log };
  }

  function normalizePassiveIds(seasonData, passiveModifierIds) {
    const src = Array.isArray(passiveModifierIds) ? passiveModifierIds : [];
    const maxPassives = toNum(seasonData && seasonData.max_equipped_passives, 3);
    const unique = [];
    const duplicateRejected = [];
    const seen = new Set();
    for (let i = 0; i < src.length; i += 1) {
      const id = String(src[i] || "").trim();
      if (!id) continue;
      if (seen.has(id)) {
        duplicateRejected.push(id);
        continue;
      }
      seen.add(id);
      unique.push(id);
    }
    const accepted = unique.slice(0, Math.max(0, maxPassives));
    const rejected = unique.slice(Math.max(0, maxPassives));
    return { accepted, rejected, duplicateRejected, maxPassives };
  }

  function simulateLoadout(seasonData, loadout, options) {
    const ld = loadout || {};
    const activeModifierId = ld.active_modifier_id || "";
    const activeLevelRaw = toNum(ld.active_level, 1);
    const activeLevel = Math.max(1, Math.min(5, Math.floor(activeLevelRaw)));
    const normalized = normalizePassiveIds(seasonData, ld.passive_modifier_ids);
    const activeDef = findActiveModifierById(seasonData, activeModifierId);
    const baseFromSeason = ((seasonData && seasonData.base_stacks) || {});
    const effectiveBase = {
      offense: toNum(baseFromSeason.offense, 0),
      defense: toNum(baseFromSeason.defense, 0),
      utility: toNum(baseFromSeason.utility, 0)
    };
    // Y8S1: each active modifier level-up grants +1 to all base module stacks.
    // Simulator rule: active_level is treated as global progression level shared by all active modifiers.
    // Example: 3 active modifiers, Lv5 => (5-1) * 3 = +12 to all modules.
    const activeCount = Array.isArray(seasonData && seasonData.active_modifiers)
      ? seasonData.active_modifiers.length
      : 3;
    const activeBaseBonus = Math.max(0, Math.min(4, activeLevel - 1)) * Math.max(1, activeCount);
    MODULES.forEach((m) => {
      effectiveBase[m] += activeBaseBonus;
    });
    const mergedOptions = Object.assign({}, options || {}, { baseStacks: effectiveBase });
    const sim = simulatePassiveModifiers(seasonData, normalized.accepted, mergedOptions);
    return {
      active_modifier_id: activeModifierId,
      active_level: activeLevel,
      active_base_bonus_all_modules: activeBaseBonus,
      active_modifier: activeDef ? { id: activeDef.id, name_en: activeDef.name_en || "", name_ja: activeDef.name_ja || "" } : null,
      passive_modifier_ids: normalized.accepted.slice(),
      dropped_passive_modifier_ids: normalized.rejected.slice(),
      duplicate_passive_modifier_ids: normalized.duplicateRejected.slice(),
      max_equipped_passives: normalized.maxPassives,
      state: sim.state,
      log: sim.log
    };
  }

  window.SeasonModSimulator = {
    modules: MODULES.slice(),
    createState,
    applyEffect,
    simulatePassiveModifiers,
    simulateLoadout,
    normalizePassiveIds,
    findActiveModifierById,
    findModifierById
  };
})();
