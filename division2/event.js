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
    "Coney Island Amusement Park": "コニーアイランドパーク",
    "The Tombs": "墓所",
    "Stranded Tanker": "座礁タンカー",
    "Pathway Park": "パスウェイパーク",
    "Wall Street": "ウォール街",
    "Liberty Island": "リバティ島",
    "Rescue Dr. Kandel in Brooklyn": "",
    "CERA Clinic": "CERA診療所",
    "DUMBO Skate Park": "DUMBOスケートパーク",
    "H5 Refinery": "H5精製所",
    "Clarke Street Hotel": "クラークストリート",
    "Bridge Park Pier": "ブリッジパークピア",
    "The Art Museum": "美術館",
    "Army Terminal": "陸軍ターミナル",
    "District Union Arena": "ディストリクトユニオンアリーナ",
    "Roosevelt Island": "ルーズベルト島",
    "Capitol Building": "キャピトルビル",
    "Tidal Basin": "タイダルベイスン",
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

  window.eventViewRender = async function eventViewRender() {
    const t = labels();
    if (typeof setStatus === "function") setStatus(t.loading);
    try {
      const res = await fetch(`./data/event/index.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const events = (data && typeof data === "object") ? data : {};
      const targetWeek = normalizeToShopWeekStartJst(new Date());
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
          week: hit ? String(hit?.week || "").trim() : targetWeek,
        };
        const missions = Array.isArray(section.missions)
          ? section.missions.map((x) => String(x || "").trim()).filter(Boolean)
          : [];
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
                      </tr>
                    </thead>
                    <tbody>
                      <tr><th scope="row">-</th><td>${esc(t.noData)}</td></tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </section>
          `;
        }
        const missionRows = missions
          .map((m, i) => `<tr><th scope="row">${esc(String(i + 1))}</th><td>${esc(missionLabel(m))}</td></tr>`)
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
