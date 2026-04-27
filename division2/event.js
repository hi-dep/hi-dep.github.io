/* event-specific view logic */
(function () {
  const SECTION_I18N = {
    weeklyescalation: { ja: "エスカレーション", en: "Escalation" },
    escalation: { ja: "エスカレーション", en: "Escalation" },
  };

  const MISSION_I18N_JA = {
    "Grand Washington Hotel": "グランドワシントンホテル",
    "ViewPoint Museum": "ビューポイント博物館",
    "American History Museum": "アメリカ歴史博物館",
    "Air & Space Museum": "航空宇宙博物館",
    "Jefferson Plaza": "ジェファーソンプラザ",
    "Bank Headquarters": "銀行本部",
    "DCD Headquarters": "DCD本部",
    "Lincoln Memorial": "リンカーン記念堂",
    "Potomac Event Center": "ポトマックイベントセンター",
    "Jefferson Trade Center": "ジェファーソントレードセンター",
    "Space Administration HQ": "宇宙局本部",
    "Federal Emergency Bunker": "フェデラルエマージェンシーバンカー",
    "Camp White Oak": "キャンプホワイトオーク",
    "The Pentagon": "ペンタゴン",
    "DARPA Research Labs": "DARPA",
    "Coney Island Ballpark": "コニーアイランド球場",
    "Coney Island Amusement Park": "コニーアイランド遊園地",
    "The Tombs": "墓所",
    "Stranded Tanker": "座礁タンカー",
    "Pathway Park": "パスウェイパーク",
    "Wall Street": "ウォール街",
    "Liberty Island": "リバティ島",
    "Rescue Dr. Kandel in Brooklyn": "Rescue Dr. Kandel in Brooklyn",
    "CERA Clinic": "CERA診療所",
    "DUMBO Skate Park": "ダンボ・スケートパーク",
    "H5 Refinery": "H5精製所",
    "Clarke Street Hotel": "クラーク・ストリート",
    "Bridge Park Pier": "ブリッジパーク埠頭",
    "The Art Museum": "美術館",
    "Army Terminal": "陸軍ターミナル",
    "District Union Arena": "ディストリクトユニオンアリーナ",
    "Roosevelt Island": "ルーズベルト島",
    "Capitol Building": "キャピトルビル",
    "Tidal Basin": "タイダルベイスン",
    "Manning National Zoo": "マニング国立動物園",
  };

  function getLang() {
    const sel = document.getElementById("langSelect");
    return (sel && (sel.value === "ja" || sel.value === "en")) ? sel.value : "en";
  }

  function labels() {
    const ja = getLang() === "ja";
    return {
      loading: ja ? "イベント情報を読み込み中..." : "Loading event data...",
      noData: ja ? "データなし" : "No Data",
      failed: ja ? "イベント情報の取得に失敗しました。" : "Failed to load event data.",
      section: ja ? "セクション" : "Section",
      weekOf: ja ? "週" : "Week of",
      targetLootDate: ja ? "目標アイテム日付" : "Target Loot Date",
      mission: ja ? "ミッション" : "Mission",
      targetLoot: ja ? "目標アイテム" : "Target Loot",
      fallbackSection: ja ? "イベント" : "Event",
      copy: ja ? "コピー" : "Copy",
      copyDone: ja ? "エスカレーションをコピーしました。" : "Escalation copied.",
      copyFailed: ja ? "コピーに失敗しました。" : "Failed to copy.",
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

  function setContentHtml(html) {
    const content = document.getElementById("content");
    if (!content) return;
    content.innerHTML = html;
  }

  function nk(s) {
    if (typeof normalizeKey === "function") return normalizeKey(String(s || ""));
    return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }

  function sectionLabel(section) {
    const lang = getLang();
    const key = nk(section?.section_key || section?.section_name || "");
    const fixed = SECTION_I18N[key];
    if (fixed && fixed[lang]) return fixed[lang];
    return String(section?.section_name || labels().fallbackSection);
  }

  function missionLabel(name) {
    const raw = String(name || "").trim();
    if (!raw) return "";
    if (getLang() !== "ja") return raw;
    const ja = MISSION_I18N_JA[raw];
    return (ja != null && ja !== "") ? ja : raw;
  }

  function isEscalationSection(section) {
    const key = nk(section?.section_key || section?.section_name || "");
    return key === "weeklyescalation" || key === "escalation";
  }

  function compactDate(dateText) {
    const raw = String(dateText || "").trim();
    const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[1]}${m[2]}${m[3]}` : raw.replace(/[^0-9]/g, "");
  }

  async function copyTextToClipboard(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(String(text || ""));
        return true;
      }
    } catch (_e) {
      // fall back to legacy copy API
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = String(text || "");
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return !!ok;
    } catch (_e) {
      return false;
    }
  }

  function buildEscalationCopyText(payload) {
    const lang = getLang();
    const isJa = lang === "ja";
    const dateCompact = compactDate(payload?.targetLootDay || "");
    const hashTag = isJa ? "#ディビジョン2" : "#theDivision2";
    const title = isJa
      ? `${hashTag} エスカレーション 目標アイテム ${dateCompact}`
      : `${hashTag} Escalation Target Loot ${dateCompact}`;
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const body = rows.map((row) => `- ${String(row?.mission || "").trim()}: ${String(row?.targetLoot || "").trim()}`);
    let url = "";
    try {
      const u = new URL(String(window.location.href || ""));
      const langParam = (lang === "ja" || lang === "en") ? lang : "en";
      u.search = "";
      u.searchParams.set("view", "event");
      u.searchParams.set("lang", langParam);
      url = u.toString();
    } catch (_e) {
      url = "";
    }
    if (!url) url = `https://hi-dep.github.io/division2/?view=event&lang=${lang}`;
    return [title, ...body, "", `👉 ${url}`].join("\n");
  }

  function normalizeToShopWeekStartJst(nowDate) {
    const nowMs = (nowDate instanceof Date) ? nowDate.getTime() : Date.now();
    if (typeof lastWeeklyUtcMs !== "function" || typeof formatJstDateTimeFromUtcMs !== "function") {
      throw new Error("shop-week helpers are unavailable");
    }
    const weekUtc = lastWeeklyUtcMs(nowMs, 2, 17, 0); // Tue 17:00 JST
    const s = String(formatJstDateTimeFromUtcMs(weekUtc) || "");
    return s.slice(0, 10);
  }

  function normalizeToShopDayStartJst(nowDate) {
    const nowMs = (nowDate instanceof Date) ? nowDate.getTime() : Date.now();
    if (typeof formatJstDateTimeFromUtcMs !== "function") {
      throw new Error("day-reset helpers are unavailable");
    }
    const dayMs = 24 * 60 * 60 * 1000;
    const jstNow = new Date(nowMs + 9 * 60 * 60 * 1000);
    const y = jstNow.getUTCFullYear();
    const mo = jstNow.getUTCMonth();
    const d = jstNow.getUTCDate();
    const resetUtc = Date.UTC(y, mo, d, 8, 0, 0, 0); // 17:00 JST
    const activeUtc = nowMs < resetUtc ? (resetUtc - dayMs) : resetUtc;
    const s = String(formatJstDateTimeFromUtcMs(activeUtc) || "");
    return s.slice(0, 10);
  }

  function targetLootLabel(name) {
    const raw = String(name || "").trim();
    if (!raw) return "";
    if (getLang() !== "ja") return raw;
    const key = resolveTargetLootKey(raw);
    if (key) {
      const weaponType = getI18nCategoryText("weapon_type", key);
      if (weaponType) return weaponType;
      const gearSlot = getI18nCategoryText("gear_slot", key);
      if (gearSlot) return gearSlot;
    }
    const tr = (typeof i18n === "object" && i18n) ? (i18n[key] || i18n[raw] || "") : "";
    return tr || raw;
  }

  function targetLootIconUrl(name) {
    const resolved = resolveTargetLoot(name);
    const key = resolved.key;
    if (!key || typeof iconUrl !== "function") return "";
    if (resolved.kind === "weapon_types") return iconUrl("weapon_types", key, "img/weapons");
    if (resolved.kind === "gear_slots") return iconUrl("gear_slots", key, "img/gears");
    return iconUrl("brands", key, "img/brands");
  }

  function targetLootCellHtml(name, t) {
    const raw = String(name || "").trim();
    if (!raw) return `<span class="event-targetloot-empty">${esc(t.noData)}</span>`;
    const src = targetLootIconUrl(raw);
    const label = targetLootLabel(raw);
    const icon = src
      ? `<img class="ico ico--brand-inline event-targetloot-icon" src="${esc(src)}" alt="${esc(label || raw)}" loading="lazy" onerror="this.style.display='none'">`
      : "";
    return `<span class="event-targetloot-cell">${icon}<span>${esc(label || raw)}</span></span>`;
  }

  function getI18nCategoryText(category, key) {
    if (!category || !key || typeof i18nCategories !== "object" || !i18nCategories) return "";
    const bucket = i18nCategories[category];
    if (!bucket || typeof bucket !== "object") return "";
    if (Object.prototype.hasOwnProperty.call(bucket, key)) return String(bucket[key] || "");
    const alias = (typeof i18nAliases === "object" && i18nAliases) ? i18nAliases[key] : "";
    if (alias && Object.prototype.hasOwnProperty.call(bucket, alias)) return String(bucket[alias] || "");
    return "";
  }

  function resolveTargetLootKey(name) {
    const raw = String(name || "").trim();
    if (!raw) return "";
    const key = nk(raw);
    if (!key) return "";
    const alias = (typeof i18nAliases === "object" && i18nAliases) ? i18nAliases[key] : "";
    return String(alias || key).trim();
  }

  function resolveTargetLoot(name) {
    const key = resolveTargetLootKey(name);
    if (!key) return { key: "", kind: "brands" };
    if (getI18nCategoryText("weapon_type", key)) return { key, kind: "weapon_types" };
    if (getI18nCategoryText("gear_slot", key)) return { key, kind: "gear_slots" };
    return { key, kind: "brands" };
  }

  function pickTargetLootByDay(entry, targetDay) {
    const rows = Array.isArray(entry?.target_loot_by_day)
      ? entry.target_loot_by_day
          .filter((x) => x && typeof x === "object")
          .map((x) => ({
            day: String(x.day || "").trim(),
            targetLoot: Array.isArray(x.target_loot) ? x.target_loot.map((v) => String(v || "").trim()) : [],
          }))
          .filter((x) => x.day)
      : [];
    if (!rows.length) return { day: String(targetDay || "").trim(), targetLoot: [] };
    const exact = rows.find((x) => x.day === targetDay);
    if (exact) return exact;
    // Do not fall back to previous-day loot after daily reset.
    // If the exact day row is missing, treat as no data for that day.
    return { day: String(targetDay || "").trim(), targetLoot: [] };
  }

  window.eventViewRender = async function eventViewRender() {
    const t = labels();
    if (typeof setStatus === "function") setStatus(t.loading);
    try {
      const res = await fetch(`./data/event/index.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = (data && typeof data === "object") ? data : {};
      const targetWeek = normalizeToShopWeekStartJst(new Date());
      const targetDay = normalizeToShopDayStartJst(new Date());
      const sectionNames = Object.keys(events).sort((a, b) => String(a).localeCompare(String(b)));
      if (!sectionNames.length) {
        setContentHtml(`<section class="event-view"><p class="event-empty">${esc(t.noData)}</p></section>`);
        if (typeof setStatus === "function") setStatus("");
        return;
      }
      const copyPayloads = [];
      const rowHtml = sectionNames.map((name) => {
        const entries = Array.isArray(events[name]) ? events[name] : [];
        const hit = entries.find((e) => String(e?.week || "").trim() === targetWeek);
        const section = {
          section_name: name,
          missions: Array.isArray(hit?.missions) ? hit.missions : [],
          target_loot_by_day: Array.isArray(hit?.target_loot_by_day) ? hit.target_loot_by_day : [],
          week: hit ? String(hit?.week || "").trim() : targetWeek,
        };
        const missions = Array.isArray(section.missions)
          ? section.missions.map((x) => String(x || "").trim()).filter(Boolean)
          : [];
        const targetLootPick = pickTargetLootByDay(hit, targetDay);
        const targetLoot = Array.isArray(targetLootPick?.targetLoot) ? targetLootPick.targetLoot : [];
        const targetLootDay = String(targetLootPick?.day || targetDay || "").trim();
        const canCopyEscalation = isEscalationSection(section) && missions.length > 0;
        let copyButtonHtml = "";
        if (canCopyEscalation) {
          const copyIndex = copyPayloads.length;
          copyPayloads.push({
            targetLootDay,
            rows: missions.map((m, i) => ({
              mission: missionLabel(m),
              targetLoot: targetLootLabel(targetLoot[i]) || t.noData,
            })),
          });
          copyButtonHtml = `
            <button type="button" class="btn btn--ghost seasonmod-share-btn event-copy-btn" data-event-copy-index="${copyIndex}" aria-label="${esc(t.copy)}" title="${esc(t.copy)}">
              <svg class="seasonmod-share-btn__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M16 5a3 3 0 0 0-2.64 1.57l-4.72 2.36a3 3 0 1 0 0 5.14l4.72 2.36A3 3 0 1 0 14 15.3l-4.72-2.36a3.05 3.05 0 0 0 0-1.88L14 8.7A3 3 0 1 0 16 5Zm0 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2ZM8 11a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm8 5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" fill="currentColor"></path>
              </svg>
            </button>
          `;
        }
        const sectionTitleHtml = `
          <div class="event-section__title-row">
            <h3 class="event-section__title">${esc(sectionLabel(section))}</h3>
            ${copyButtonHtml}
          </div>
        `;
        if (!missions.length) {
          return `
            <section class="event-section">
              ${sectionTitleHtml}
              <div class="event-weekof">${esc(t.weekOf)}: ${esc(section.week)} / ${esc(t.targetLootDate)}: ${esc(targetLootDay || t.noData)}</div>
              <section class="blueprint-table-wrap">
                <div class="blueprint-table-scroll">
                  <table class="blueprint-table event-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>${esc(t.mission)}</th>
                        <th>${esc(t.targetLoot)}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><th scope="row">-</th><td>${esc(t.noData)}</td><td>${esc(t.noData)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          `;
        }
        const missionRows = missions
          .map((m, i) => `<tr><th scope="row">${esc(String(i + 1))}</th><td>${esc(missionLabel(m))}</td><td>${targetLootCellHtml(targetLoot[i], t)}</td></tr>`)
          .join("");
        const week = String(section?.week || "").trim();
        return `
          <section class="event-section">
            ${sectionTitleHtml}
            <div class="event-weekof">${esc(t.weekOf)}: ${esc(week)} / ${esc(t.targetLootDate)}: ${esc(targetLootDay || t.noData)}</div>
            <section class="blueprint-table-wrap">
              <div class="blueprint-table-scroll">
                <table class="blueprint-table event-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>${esc(t.mission)}</th>
                      <th>${esc(t.targetLoot)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${missionRows}
                  </tbody>
                </table>
              </div>
            </section>
          </section>
        `;
      }).join("");

      setContentHtml(`
        <section class="blueprint-view event-view" aria-label="event">
          ${rowHtml}
        </section>
      `);
      const copyButtons = Array.from(document.querySelectorAll("button[data-event-copy-index]"));
      copyButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
          const idx = Number(btn.getAttribute("data-event-copy-index"));
          const payload = (idx >= 0) ? copyPayloads[idx] : null;
          if (!payload) return;
          const text = buildEscalationCopyText(payload);
          const ok = await copyTextToClipboard(text);
          if (typeof setStatus === "function") setStatus(ok ? t.copyDone : t.copyFailed);
        });
      });
      if (typeof setStatus === "function") setStatus("");
    } catch (err) {
      setContentHtml(`<section class="event-view"><p class="event-empty">${esc(t.failed)}</p></section>`);
      if (typeof setStatus === "function") setStatus(`${t.failed} ${err?.message || ""}`.trim());
    }
  };
})();
