/* event-specific view logic */
(function () {
  const SECTION_I18N = {
    weeklyescalation: { ja: "ウィークリーエスカレーション", en: "Weekly Escalation" },
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
      mission: ja ? "ミッション" : "Mission",
      targetLoot: ja ? "目標アイテム" : "Target Loot",
      fallbackSection: ja ? "イベント" : "Event",
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
    const key = nk(raw);
    if (!key) return raw;
    const tr = (typeof i18n === "object" && i18n) ? (i18n[key] || i18n[raw] || "") : "";
    return tr || raw;
  }

  function targetLootIconUrl(name) {
    const key = nk(name);
    if (!key || typeof iconUrl !== "function") return "";
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
    if (!rows.length) return [];
    const exact = rows.find((x) => x.day === targetDay);
    if (exact) return exact.targetLoot;
    const prev = rows.filter((x) => x.day <= targetDay);
    if (prev.length) return prev[prev.length - 1].targetLoot;
    return rows[rows.length - 1].targetLoot;
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
        const targetLoot = pickTargetLootByDay(hit, targetDay);
        if (!missions.length) {
          return `
            <section class="event-section">
              <h3 class="event-section__title">${esc(sectionLabel(section))}</h3>
              <div class="event-weekof">${esc(t.weekOf)}: ${esc(section.week)}</div>
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
            <h3 class="event-section__title">${esc(sectionLabel(section))}</h3>
            <div class="event-weekof">${esc(t.weekOf)}: ${esc(week)}</div>
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
      if (typeof setStatus === "function") setStatus("");
    } catch (err) {
      setContentHtml(`<section class="event-view"><p class="event-empty">${esc(t.failed)}</p></section>`);
      if (typeof setStatus === "function") setStatus(`${t.failed} ${err?.message || ""}`.trim());
    }
  };
})();
